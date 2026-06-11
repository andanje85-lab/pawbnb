import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { Loader2, MapPin } from "lucide-react";

export interface PlaceResult {
  address: string;
  city: string;
  lat: number;
  lng: number;
}

interface Suggestion {
  placeId: string;
  primary: string;
  secondary: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onPlaceSelected: (place: PlaceResult) => void;
  placeholder?: string;
  id?: string;
}

export default function AddressAutocomplete({ value, onChange, onPlaceSelected, placeholder, id }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const placesLibRef = useRef<google.maps.PlacesLibrary | null>(null);
  const debounceRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const ensurePlaces = async () => {
    if (placesLibRef.current) return placesLibRef.current;
    const g = await loadGoogleMaps(["places"]);
    const lib = (await g.maps.importLibrary("places")) as google.maps.PlacesLibrary;
    placesLibRef.current = lib;
    sessionTokenRef.current = new lib.AutocompleteSessionToken();
    return lib;
  };

  const fetchSuggestions = async (input: string) => {
    if (!input || input.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const lib = await ensurePlaces();
      const { suggestions } = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: sessionTokenRef.current!,
      });
      const mapped: Suggestion[] = suggestions
        .map((s) => s.placePrediction)
        .filter((p): p is google.maps.places.PlacePrediction => !!p)
        .slice(0, 6)
        .map((p) => ({
          placeId: p.placeId,
          primary: p.mainText?.text || p.text.text,
          secondary: p.secondaryText?.text || "",
        }));
      setSuggestions(mapped);
      setOpen(true);
    } catch (e) {
      console.error("Autocomplete failed", e);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (v: string) => {
    onChange(v);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => fetchSuggestions(v), 220);
  };

  const handleSelect = async (s: Suggestion) => {
    setOpen(false);
    onChange(`${s.primary}${s.secondary ? `, ${s.secondary}` : ""}`);
    try {
      const lib = await ensurePlaces();
      const place = new lib.Place({ id: s.placeId });
      await place.fetchFields({
        fields: ["formattedAddress", "location", "addressComponents"],
      });

      const lat = place.location?.lat();
      const lng = place.location?.lng();
      const formatted = place.formattedAddress || `${s.primary}, ${s.secondary}`;

      // Derive a city from address components (locality → postal_town → sublocality → admin_area_2)
      const components = (place.addressComponents || []) as google.maps.places.AddressComponent[];
      const pick = (type: string) =>
        components.find((c) => c.types?.includes(type))?.longText || "";
      const city =
        pick("locality") ||
        pick("postal_town") ||
        pick("sublocality") ||
        pick("administrative_area_level_2") ||
        pick("administrative_area_level_1") ||
        "";

      if (lat == null || lng == null) return;
      onPlaceSelected({ address: formatted, city, lat, lng });
    } catch (e) {
      console.error("Place details failed", e);
    } finally {
      // Reset session token after a selection
      sessionTokenRef.current = placesLibRef.current
        ? new placesLibRef.current.AutocompleteSessionToken()
        : null;
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => suggestions.length && setOpen(true)}
        placeholder={placeholder || "Start typing your address…"}
        autoComplete="off"
        className="mt-1.5"
      />
      {loading && (
        <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
      )}

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => handleSelect(s)}
              className="w-full text-left px-3 py-2 hover:bg-secondary flex items-start gap-2 transition-colors"
            >
              <MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{s.primary}</div>
                {s.secondary && (
                  <div className="text-xs text-muted-foreground truncate">{s.secondary}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
