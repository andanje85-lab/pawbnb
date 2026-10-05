import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

/** Hosts add date ranges (holidays, school breaks) with their own nightly price. */
export default function SeasonalRatesEditor({ listingId }: { listingId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [price, setPrice] = useState("");
  const key = ["seasonal-rates", listingId];
  const { data: rates = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("listing_seasonal_rates").select("*").eq("listing_id", listingId).order("start_date");
      if (error) throw error;
      return data as any[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["listing", listingId] });
  };

  const add = async () => {
    if (!start || !end || !(Number(price) > 0)) return toast.error("Add dates and a price");
    if (end < start) return toast.error("End date must be after the start date");
    const { error } = await (supabase as any).from("listing_seasonal_rates").insert({
      listing_id: listingId, name: name.trim() || "Peak season", start_date: start, end_date: end, price_per_night: Number(price),
    });
    if (error) return toast.error(error.message);
    setName(""); setStart(""); setEnd(""); setPrice("");
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("listing_seasonal_rates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Holiday & seasonal prices</Label>
      {rates.map((r) => (
        <div key={r.id} className="flex items-center justify-between text-xs p-2 rounded-md border border-border">
          <span>{r.name}: {r.start_date} → {r.end_date} · ${r.price_per_night}/night</span>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(r.id)} aria-label="Remove">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Name (e.g. Christmas)" value={name} onChange={(e) => setName(e.target.value)} className="col-span-2" />
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Start date" />
        <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="End date" />
        <Input type="number" min={0} placeholder="$ / night" value={price} onChange={(e) => setPrice(e.target.value)} />
        <Button type="button" variant="outline" onClick={add}>Add period</Button>
      </div>
      <p className="text-[11px] text-muted-foreground">These replace your normal and weekend price for every night in the period.</p>
    </div>
  );
}
