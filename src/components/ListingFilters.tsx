import { useState, useEffect } from "react";
import { MapPin, SlidersHorizontal, Dog, DollarSign, X, Locate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

const ALL_AMENITIES = [
  "Fenced Yard",
  "Pool",
  "Garden",
  "Beach Access",
  "Daycare",
  "Grooming",
  "Training",
  "Webcam",
  "Medication Admin",
  "Pickup/Dropoff",
];

export interface FilterValues {
  city: string;
  priceRange: [number, number];
  maxDogs: number | null;
  amenities: string[];
}

interface ListingFiltersProps {
  onFilterChange: (filters: FilterValues) => void;
}

const ListingFilters = ({ onFilterChange }: ListingFiltersProps) => {
  const [expanded, setExpanded] = useState(false);
  const [city, setCity] = useState("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 200]);
  const [maxDogs, setMaxDogs] = useState<number | null>(null);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [detectingLocation, setDetectingLocation] = useState(false);

  const activeCount = [
    city.length > 0,
    priceRange[0] > 0 || priceRange[1] < 200,
    maxDogs !== null,
    amenities.length > 0,
  ].filter(Boolean).length;

  useEffect(() => {
    onFilterChange({ city, priceRange, maxDogs, amenities });
  }, [city, priceRange, maxDogs, amenities]);

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
          );
          const data = await res.json();
          const detectedCity =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.county ||
            "";
          if (detectedCity) setCity(detectedCity);
        } catch {
          // silently fail
        } finally {
          setDetectingLocation(false);
        }
      },
      () => setDetectingLocation(false),
      { timeout: 8000 }
    );
  };

  const clearAll = () => {
    setCity("");
    setPriceRange([0, 200]);
    setMaxDogs(null);
    setAmenities([]);
  };

  const toggleAmenity = (a: string) => {
    setAmenities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
    >
      {/* Compact bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4">
        {/* City input with location detect */}
        <div className="relative flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-secondary">
          <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Filter by city…"
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
          />
          <button
            onClick={detectLocation}
            disabled={detectingLocation}
            title="Use my location"
            className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <Locate className={`w-4 h-4 ${detectingLocation ? "animate-pulse" : ""}`} />
          </button>
        </div>

        {/* Toggle filters */}
        <Button
          variant="outline"
          onClick={() => setExpanded(!expanded)}
          className="rounded-xl gap-2"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeCount > 0 && (
            <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full bg-primary text-primary-foreground">
              {activeCount}
            </Badge>
          )}
        </Button>

        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-muted-foreground gap-1"
          >
            <X className="w-3 h-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Expanded filters */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 pt-1 space-y-5 border-t border-border">
              {/* Price range */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  Price range: ${priceRange[0]} – ${priceRange[1]}+
                </label>
                <Slider
                  min={0}
                  max={200}
                  step={5}
                  value={priceRange}
                  onValueChange={(v) => setPriceRange(v as [number, number])}
                  className="w-full"
                />
              </div>

              {/* Dog capacity */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
                  <Dog className="w-4 h-4 text-muted-foreground" />
                  Minimum dog capacity
                </label>
                <div className="flex gap-2">
                  {[null, 1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n ?? "any"}
                      onClick={() => setMaxDogs(n)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        maxDogs === n
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-muted"
                      }`}
                    >
                      {n === null ? "Any" : `${n}+`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amenities */}
              <div>
                <label className="text-sm font-medium text-foreground mb-3 block">
                  Amenities
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_AMENITIES.map((a) => (
                    <button
                      key={a}
                      onClick={() => toggleAmenity(a)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        amenities.includes(a)
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-muted"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ListingFilters;
