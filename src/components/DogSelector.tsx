import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Users, Plus } from "lucide-react";
import { DogAvatar } from "@/components/MyDogs";

export type DogProfile = {
  id: string;
  name: string;
  breed: string | null;
  size: string | null;
  photo_url: string | null;
};

export const useMyDogs = (enabled: boolean) =>
  useQuery({
    queryKey: ["my-dogs-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dogs")
        .select("id, name, breed, size, photo_url")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as DogProfile[];
    },
    enabled,
  });

/**
 * Dog picker for the booking panel. When the guest has dog profiles, they tap
 * their dogs instead of typing a count; otherwise the plain number input shows.
 * `numDogs` stays the pricing source of truth — selecting dogs drives it.
 */
const DogSelector = ({
  numDogs,
  onNumDogsChange,
  selectedIds,
  onSelectedIdsChange,
  maxDogs,
  isDbListing,
}: {
  numDogs: number;
  onNumDogsChange: (n: number) => void;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  maxDogs: number;
  isDbListing: boolean;
}) => {
  const { user } = useAuth();
  const { data: dogs } = useMyDogs(!!user && isDbListing);
  const hasDogs = !!user && isDbListing && (dogs?.length ?? 0) > 0;

  if (!hasDogs) {
    return (
      <div>
        <Label htmlFor="numDogs" className="text-sm font-medium mb-2 flex items-center gap-1">
          <Users className="w-4 h-4" />
          Number of dogs
        </Label>
        <Input
          id="numDogs"
          type="number"
          min={1}
          max={maxDogs}
          value={numDogs}
          onChange={(e) => onNumDogsChange(Math.min(maxDogs, Math.max(1, parseInt(e.target.value) || 1)))}
        />
        {user && isDbListing && (
          <p className="text-[11px] text-muted-foreground mt-1.5">
            <Link to="/dashboard?tab=dogs" className="text-primary hover:underline inline-flex items-center gap-0.5">
              <Plus className="w-3 h-3" /> Add a dog profile
            </Link>{" "}
            so the host knows their care needs.
          </p>
        )}
      </div>
    );
  }

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((d) => d !== id)
      : selectedIds.length < maxDogs
      ? [...selectedIds, id]
      : selectedIds;
    onSelectedIdsChange(next);
    onNumDogsChange(Math.max(1, next.length));
  };

  return (
    <div>
      <Label className="text-sm font-medium mb-2 flex items-center gap-1">
        <Users className="w-4 h-4" />
        Which dogs are staying? ({selectedIds.length}/{maxDogs})
      </Label>
      <div className="space-y-2">
        {dogs!.map((dog) => {
          const selected = selectedIds.includes(dog.id);
          return (
            <button
              key={dog.id}
              type="button"
              onClick={() => toggle(dog.id)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <DogAvatar dog={dog} className="w-10 h-10" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{dog.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[dog.breed, dog.size ? `${dog.size} breed` : null].filter(Boolean).join(" · ") || "No details"}
                </p>
              </div>
              <div
                className={`w-5 h-5 rounded-md border flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  selected ? "bg-primary border-primary text-primary-foreground" : "border-border"
                }`}
              >
                {selected ? "✓" : ""}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1.5">
        Care notes are shared with the host automatically.{" "}
        <Link to="/dashboard?tab=dogs" className="text-primary hover:underline">Manage profiles</Link>
      </p>
    </div>
  );
};

export default DogSelector;
