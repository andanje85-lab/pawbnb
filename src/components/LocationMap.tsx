import { useEffect, useRef } from "react";
import L from "leaflet";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface LocationMapProps {
  lat: number;
  lng: number;
  /** When true, hides the precise pin and shows an approximate-area circle instead. */
  approximate?: boolean;
  height?: number;
}

const LocationMap = ({ lat, lng, approximate = false, height = 280 }: LocationMapProps) => {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;

    const map = L.map(mapNodeRef.current, { scrollWheelZoom: false }).setView(
      [lat, lng],
      approximate ? 12 : 14
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // Initialize once; the next effect syncs viewport and overlays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const center: [number, number] = [lat, lng];
    map.setView(center, approximate ? 12 : 14);

    markerRef.current?.remove();
    circleRef.current?.remove();
    markerRef.current = null;
    circleRef.current = null;

    if (approximate) {
      circleRef.current = L.circle(center, {
        radius: 500,
        color: "hsl(var(--primary))",
        fillOpacity: 0.15,
      }).addTo(map);
    } else {
      markerRef.current = L.marker(center, { icon: markerIcon }).addTo(map);
    }
  }, [approximate, lat, lng]);

  return (
    <div
      ref={mapNodeRef}
      className="rounded-xl overflow-hidden border border-border"
      style={{ height }}
    />
  );
};

export default LocationMap;
