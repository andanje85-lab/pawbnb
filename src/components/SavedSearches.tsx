import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Bell, BellOff, BookmarkPlus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import type { FilterValues } from "./ListingFilters";

interface Props {
  currentFilters: FilterValues;
  onApply: (filters: FilterValues) => void;
}

const summarize = (f: any): string => {
  const parts: string[] = [];
  if (f.city) parts.push(f.city);
  if (f.priceRange && (f.priceRange[0] > 0 || f.priceRange[1] < 200))
    parts.push(`$${f.priceRange[0]}–${f.priceRange[1]}`);
  if (f.maxDogs) parts.push(`${f.maxDogs}+ dogs`);
  if (f.radiusKm && f.center) parts.push(`within ${f.radiusKm}km`);
  if (f.amenities?.length) parts.push(f.amenities.slice(0, 2).join(", "));
  return parts.join(" · ") || "Any";
};

const SavedSearches = ({ currentFilters, onApply }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [alertsOn, setAlertsOn] = useState(true);

  const { data: searches } = useQuery({
    queryKey: ["saved_searches", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("saved_searches")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to save searches");
      const { center, radiusKm, priceRange, maxDogs, amenities, city } = currentFilters;
      const { error } = await supabase.from("saved_searches").insert({
        user_id: user.id,
        name: name.trim() || summarize(currentFilters),
        email_alerts: alertsOn,
        filters: { city, priceRange, maxDogs, amenities, center, radiusKm },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Search saved");
      qc.invalidateQueries({ queryKey: ["saved_searches"] });
      setSaveOpen(false);
      setName("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleAlerts = useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      const { error } = await supabase
        .from("saved_searches")
        .update({ email_alerts: on })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved_searches"] }),
  });

  const deleteSearch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_searches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Search removed");
      qc.invalidateQueries({ queryKey: ["saved_searches"] });
    },
  });

  if (!user) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="rounded-xl gap-2">
            <BookmarkPlus className="w-4 h-4" />
            Save this search
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save this search</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Name</label>
              <Input
                placeholder={summarize(currentFilters)}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Current filters: {summarize(currentFilters)}
            </p>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Email me when new stays match</p>
                <p className="text-xs text-muted-foreground">
                  We'll send a daily digest of new matching listings.
                </p>
              </div>
              <Switch checked={alertsOn} onCheckedChange={setAlertsOn} />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {searches?.map((s: any) => (
        <div
          key={s.id}
          className="group flex items-center gap-1.5 bg-secondary rounded-full pl-3 pr-1 py-1"
        >
          <button
            onClick={() => onApply({ ...(s.filters as any), dateRange: null } as FilterValues)}
            className="flex items-center gap-1.5 text-xs font-medium"
            title={summarize(s.filters)}
          >
            <Search className="w-3 h-3" />
            {s.name}
          </button>
          {s.email_alerts && (
            <Badge variant="outline" className="text-[10px] py-0 h-4 border-primary/40 text-primary">
              alerts on
            </Badge>
          )}
          <button
            onClick={() =>
              toggleAlerts.mutate({ id: s.id, on: !s.email_alerts })
            }
            className="p-1 rounded-full hover:bg-muted"
            title={s.email_alerts ? "Mute alerts" : "Enable alerts"}
          >
            {s.email_alerts ? (
              <Bell className="w-3 h-3 text-primary" />
            ) : (
              <BellOff className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={() => deleteSearch.mutate(s.id)}
            className="p-1 rounded-full hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete"
          >
            <Trash2 className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default SavedSearches;
