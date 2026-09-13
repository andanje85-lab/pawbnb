import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { MapPin, Star } from "lucide-react";

export interface MapCardListing {
  id: string;
  title: string;
  image: string;
  price: number;
  location: string;
  rating?: number;
  reviews?: number;
  distanceKm?: number | null;
}

interface Props {
  listings: MapCardListing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Swipeable row of listing cards that stays in sync with the map pins. */
const MapCardRow = ({ listings, selectedId, onSelect }: Props) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollingFromSelection = useRef(false);

  // Scroll the selected card into view when a pin is tapped
  useEffect(() => {
    if (!selectedId) return;
    const el = itemRefs.current[selectedId];
    if (!el) return;
    scrollingFromSelection.current = true;
    el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    const t = setTimeout(() => {
      scrollingFromSelection.current = false;
    }, 600);
    return () => clearTimeout(t);
  }, [selectedId]);

  const handleScroll = () => {
    if (scrollingFromSelection.current) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const centerX = scroller.scrollLeft + scroller.clientWidth / 2;
    let closestId: string | null = null;
    let closestDist = Infinity;
    listings.forEach((l) => {
      const el = itemRefs.current[l.id];
      if (!el) return;
      const mid = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(mid - centerX);
      if (dist < closestDist) {
        closestDist = dist;
        closestId = l.id;
      }
    });
    if (closestId && closestId !== selectedId) onSelect(closestId);
  };

  if (listings.length === 0) return null;

  return (
    <div
      ref={scrollerRef}
      onScroll={handleScroll}
      className="flex gap-3 overflow-x-auto snap-x snap-mandatory px-4 pb-1 -mx-4 scrollbar-none"
    >
      {listings.map((l) => (
        <div
          key={l.id}
          ref={(el) => {
            itemRefs.current[l.id] = el;
          }}
          className="snap-center shrink-0 w-[78vw] max-w-[320px]"
        >
          <Link
            to={`/listing/${l.id}`}
            onClick={(e) => {
              if (selectedId !== l.id) {
                e.preventDefault();
                onSelect(l.id);
              }
            }}
            className={`flex gap-3 p-2 rounded-2xl bg-card border transition shadow-sm ${
              selectedId === l.id ? "border-primary ring-1 ring-primary/40" : "border-border"
            }`}
          >
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted shrink-0">
              <img src={l.image} alt={l.title} className="w-full h-full object-cover" loading="lazy" />
            </div>
            <div className="flex-1 min-w-0 py-0.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">{l.title}</p>
                {l.reviews ? (
                  <span className="flex items-center gap-1 shrink-0">
                    <Star className="w-3.5 h-3.5 fill-warm-gold text-warm-gold" />
                    <span className="text-xs font-medium">{l.rating}</span>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground shrink-0">New</span>
                )}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground mt-1">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="text-xs truncate">{l.location}</span>
              </div>
              <p className="text-sm mt-1">
                <span className="font-semibold text-foreground">${l.price}</span>
                <span className="text-muted-foreground"> / night</span>
                {l.distanceKm != null && (
                  <span className="text-xs text-muted-foreground">
                    {" "}· {l.distanceKm < 1 ? `${Math.round(l.distanceKm * 1000)} m` : `${l.distanceKm.toFixed(1)} km`}
                  </span>
                )}
              </p>
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
};

export default MapCardRow;
