import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Zap, Handshake } from "lucide-react";

interface Props {
  listing: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ListingSettingsDialog({ listing, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [bookingType, setBookingType] = useState<"instant" | "request">("request");
  const [extraDogPrice, setExtraDogPrice] = useState<string>("0");
  const [repeatPct, setRepeatPct] = useState<string>("0");
  const [longMin, setLongMin] = useState<string>("");
  const [longPct, setLongPct] = useState<string>("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && listing) {
      setBookingType((listing.booking_type as any) === "instant" ? "instant" : "request");
      setExtraDogPrice(String(listing.extra_dog_price ?? 0));
      setRepeatPct(String(listing.repeat_guest_discount_pct ?? 0));
      setLongMin(listing.long_stay_min_nights ? String(listing.long_stay_min_nights) : "");
      setLongPct(String(listing.long_stay_discount_pct ?? 0));
    }
  }, [open, listing]);

  const save = async () => {
    setSaving(true);
    try {
      const patch: any = {
        booking_type: bookingType,
        extra_dog_price: Number(extraDogPrice) || 0,
        repeat_guest_discount_pct: Math.min(100, Math.max(0, parseInt(repeatPct) || 0)),
        long_stay_min_nights: longMin ? Math.max(2, parseInt(longMin)) : null,
        long_stay_discount_pct: Math.min(100, Math.max(0, parseInt(longPct) || 0)),
      };
      const { error } = await (supabase as any).from("listings").update(patch).eq("id", listing.id);
      if (error) throw error;
      toast.success("Booking settings updated");
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      qc.invalidateQueries({ queryKey: ["listing", listing.id] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Booking settings</DialogTitle>
          <DialogDescription>Configure how guests book "{listing?.title}"</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-border">
            <div className="min-w-0">
              <Label className="flex items-center gap-1.5 font-medium">
                <Zap className="w-4 h-4 text-amber-500" /> Instant Book
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Guests can confirm without waiting for your approval. Otherwise, requests are pending.
              </p>
            </div>
            <Switch
              checked={bookingType === "instant"}
              onCheckedChange={(v) => setBookingType(v ? "instant" : "request")}
            />
          </div>

          <div>
            <Label htmlFor="extra-dog" className="text-sm font-medium">Extra dog price / night</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input id="extra-dog" type="number" min={0} step="0.01" className="pl-6"
                value={extraDogPrice} onChange={(e) => setExtraDogPrice(e.target.value)} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Added per extra dog beyond the first, per night.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="repeat-pct" className="text-sm font-medium">Repeat guest discount</Label>
              <div className="relative mt-1">
                <Input id="repeat-pct" type="number" min={0} max={100}
                  value={repeatPct} onChange={(e) => setRepeatPct(e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              </div>
            </div>
            <div>
              <Label htmlFor="long-min" className="text-sm font-medium">Long stay from</Label>
              <div className="relative mt-1">
                <Input id="long-min" type="number" min={2}
                  placeholder="e.g. 7"
                  value={longMin} onChange={(e) => setLongMin(e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">nights</span>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="long-pct" className="text-sm font-medium">Long stay discount</Label>
            <div className="relative mt-1">
              <Input id="long-pct" type="number" min={0} max={100}
                value={longPct} onChange={(e) => setLongPct(e.target.value)} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Applied when nights ≥ the long-stay threshold. The larger of repeat/long-stay is used.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save settings"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
