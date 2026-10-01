import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface MapListing {
  id: string;
  title: string;
  image: string;
  price: number;
  location: string;
  latitude: number;
  longitude: number;
}

interface ListingsMapProps {
  listings: MapListing[];
  height?: number;
  /** Optional center to fit to (e.g. user search center). */
  center?: { lat: number; lng: number } | null;
  /** Currently highlighted listing (syncs with the mobile card row). */
  selectedId?: string | null;
  /** Fired when a pin is tapped. */
  onSelectListing?: (id: string) => void;
  /** Suppress popups (mobile card row shows the detail instead). */
  disablePopups?: boolean;
  className?: string;
}

const ListingsMap = ({
  listings,
  height = 480,
  center,
  selectedId,
  onSelectListing,
  disablePopups,
  className,
}: ListingsMapProps) => {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const selectHandlerRef = useRef(onSelectListing);
  selectHandlerRef.current = onSelectListing;

  const points = useMemo(
    () =>
      listings
        .filter((l) => l.latitude != null && l.longitude != null)
        .map((l) => [l.latitude, l.longitude] as [number, number]),
    [listings]
  );

  // Fallback center: provided center, first point, or US-ish center
  const initialCenter: [number, number] =
    center ? [center.lat, center.lng] : points[0] ?? [39.8, -98.5];

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;

    const map = L.map(mapNodeRef.current, { scrollWheelZoom: true }).setView(initialCenter, 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      markersRef.current = {};
    };
    // Initialize once; listing changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!map || !markerLayer) return;

    markerLayer.clearLayers();
    markersRef.current = {};
    listings
      .filter((l) => l.latitude != null && l.longitude != null)
      .forEach((listing) => {
        const marker = L.marker([listing.latitude, listing.longitude], { icon: markerIcon });

        if (!disablePopups) {
          const popup = document.createElement("a");
          popup.href = `/listing/${listing.id}`;
          popup.className = "block w-44";

          const image = document.createElement("img");
          image.src = listing.image;
          image.alt = listing.title;
          image.className = "w-full h-24 object-cover rounded-md mb-2";
          popup.appendChild(image);

          const title = document.createElement("p");
          title.className = "text-sm font-semibold leading-tight mb-1";
          title.textContent = listing.title;
          popup.appendChild(title);

          const location = document.createElement("p");
          location.className = "text-xs text-muted-foreground mb-1";
          location.textContent = listing.location;
          popup.appendChild(location);

          const price = document.createElement("p");
          price.className = "text-sm";
          price.textContent = `$${listing.price} / night`;
          popup.appendChild(price);

          marker.bindPopup(popup);
        }

        marker.on("click", () => selectHandlerRef.current?.(listing.id));
        marker.addTo(markerLayer);
        markersRef.current[listing.id] = marker;
      });

    if (points.length === 0) {
      map.setView(initialCenter, 4);
    } else if (points.length === 1) {
      map.setView(points[0], 12);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 13 });
    }
  }, [initialCenter, listings, points, disablePopups]);

  // Pan to and emphasise the selected listing
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const marker = markersRef.current[selectedId];
    if (!marker) return;
    map.panTo(marker.getLatLng(), { animate: true });
    const el = marker.getElement();
    Object.values(markersRef.current).forEach((m) => {
      const e = m.getElement();
      if (e) {
        e.style.filter = "";
        e.style.zIndex = "";
      }
    });
    if (el) {
      el.style.filter = "drop-shadow(0 0 6px hsl(var(--primary)))";
      el.style.zIndex = "1000";
    }
  }, [selectedId, listings]);

  // Keep Leaflet in sync when the container size changes (e.g. view toggle)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [height]);

  return (
    <div
      ref={mapNodeRef}
      className={className ?? "rounded-2xl overflow-hidden border border-border"}
      style={{ height }}
    />
  );
};

export default ListingsMap;
