import { useState, useEffect } from "react";
import { MapPin, SlidersHorizontal, Dog, DollarSign, X, Locate, Ruler, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

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
  /** Center used for distance filtering (geocoded from city or device location). */
  center: { lat: number; lng: number } | null;
  /** Radius in km. null disables distance filtering. */
  radiusKm: number | null;
  /** Availability window. null disables availability filtering. */
  dateRange: { from: Date; to: Date } | null;
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
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const activeCount = [
    city.length > 0,
    priceRange[0] > 0 || priceRange[1] < 200,
    maxDogs !== null,
    amenities.length > 0,
    radiusKm !== null && center !== null,
    !!(dateRange?.from && dateRange?.to),
  ].filter(Boolean).length;

  // Debounce-geocode the city when distance filter is enabled
  useEffect(() => {
    if (radiusKm === null || !city.trim()) {
      // If user cleared city, also clear center derived from city
      if (!city.trim()) setCenter((c) => (c ? null : c));
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city)}`
        );
        const data = await res.json();
        if (data && data.length > 0) {
          setCenter({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        }
      } catch {
        // ignore
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [city, radiusKm]);

  useEffect(() => {
    onFilterChange({
      city,
      priceRange,
      maxDogs,
      amenities,
      center,
      radiusKm,
      dateRange:
        dateRange?.from && dateRange?.to
          ? { from: dateRange.from, to: dateRange.to }
          : null,
    });
  }, [city, priceRange, maxDogs, amenities, center, radiusKm, dateRange]);

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // Always set center from device GPS — works even without typing a city
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
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
    setCenter(null);
    setRadiusKm(null);
    setDateRange(undefined);
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

        {/* Availability date range */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "rounded-xl gap-2 justify-start font-normal",
                !dateRange?.from && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="w-4 h-4" />
              {dateRange?.from && dateRange?.to ? (
                <span className="text-sm">
                  {format(dateRange.from, "MMM d")} – {format(dateRange.to, "MMM d")}
                </span>
              ) : (
                <span className="text-sm">Available dates</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={1}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
            {dateRange?.from && (
              <div className="p-2 border-t border-border flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)}>
                  Clear dates
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

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
              {/* Distance */}
              <div>
                <label className="flex items-center justify-between text-sm font-medium text-foreground mb-3">
                  <span className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-muted-foreground" />
                    Distance from {city ? `"${city}"` : "search point"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {radiusKm === null ? "Off" : `Within ${radiusKm} km`}
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <Slider
                    min={1}
                    max={200}
                    step={1}
                    value={[radiusKm ?? 50]}
                    onValueChange={(v) => setRadiusKm(v[0])}
                    className="flex-1"
                  />
                  {radiusKm !== null && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRadiusKm(null)}
                      className="text-muted-foreground"
                    >
                      Off
                    </Button>
                  )}
                </div>
                {radiusKm !== null && !center && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Enter a city or use your location to apply distance.
                  </p>
                )}
              </div>

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
