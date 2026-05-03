import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapPin, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Fix default marker icon (Leaflet's bundled images don't resolve under Vite)
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface LocationPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (coords: { lat: number; lng: number }) => void;
  city?: string;
}

const LocationPicker = ({ value, onChange, city }: LocationPickerProps) => {
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);

  const center = useMemo<[number, number]>(() => {
    if (value) return [value.lat, value.lng];
    return [39.8283, -98.5795]; // US center default
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;

    const map = L.map(mapNodeRef.current, { scrollWheelZoom: true }).setView(center, value ? 13 : 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    map.on("click", (e) => {
      onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Initialize Leaflet once; later effects keep marker and viewport in sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const nextCenter: [number, number] = [value.lat, value.lng];
    map.setView(nextCenter, Math.max(map.getZoom(), 12));

    if (markerRef.current) {
      markerRef.current.setLatLng(nextCenter);
    } else {
      markerRef.current = L.marker(nextCenter, { icon: markerIcon }).addTo(map);
    }
  }, [value]);

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        onChange({ lat: parseFloat(lat), lng: parseFloat(lon) });
      } else {
        toast.error("Location not found");
      }
    } catch {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => toast.error("Unable to get your location")
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search address or place..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch(searchQuery);
              }
            }}
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleSearch(searchQuery || city || "")}
          disabled={searching}
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
        </Button>
        <Button type="button" variant="outline" onClick={useMyLocation}>
          <MapPin className="w-4 h-4" />
        </Button>
      </div>

      <div ref={mapNodeRef} className="h-[300px] rounded-xl overflow-hidden border border-border" />

      <p className="text-xs text-muted-foreground">
        {value
          ? `Pinned at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} — click the map to adjust.`
          : "Search, use your location, or click the map to drop a pin."}
      </p>
    </div>
  );
};

export default LocationPicker;
