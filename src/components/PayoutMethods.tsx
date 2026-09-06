import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, CheckCircle2, Landmark, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface PayoutMethodsProps {
  userId: string;
}

const CURRENCIES = ["USD", "EUR", "GBP", "KES", "CAD", "AUD"];
const COUNTRIES = ["US", "GB", "KE", "CA", "AU", "DE", "FR", "NL"];

const emptyForm = {
  method_type: "bank_account",
  account_holder_name: "",
  bank_name: "",
  account_number: "",
  routing_number: "",
  paypal_email: "",
  country: "US",
  currency: "USD",
};

export function PayoutMethods({ userId }: PayoutMethodsProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ["payout-methods", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_methods")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const set = (k: keyof typeof emptyForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const isBank = form.method_type === "bank_account";

  const validate = () => {
    if (!form.account_holder_name.trim()) return "Enter the name on the account.";
    if (isBank) {
      if (!form.bank_name.trim()) return "Enter your bank name.";
      if (!/^\d{6,20}$/.test(form.account_number.replace(/\s/g, ""))) return "Enter a valid account number (6–20 digits).";
      if (!/^[A-Za-z0-9-]{4,20}$/.test(form.routing_number.trim())) return "Enter a valid routing or sort code.";
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.paypal_email.trim())) {
      return "Enter a valid PayPal email.";
    }
    return null;
  };

  const addMethod = useMutation({
    mutationFn: async () => {
      const digits = form.account_number.replace(/\s/g, "");
      const { error } = await supabase.from("payout_methods").insert({
        user_id: userId,
        method_type: form.method_type,
        account_holder_name: form.account_holder_name.trim(),
        bank_name: isBank ? form.bank_name.trim() : null,
        account_last4: isBank ? digits.slice(-4) : null,
        routing_number: isBank ? form.routing_number.trim() : null,
        paypal_email: isBank ? null : form.paypal_email.trim(),
        country: form.country,
        currency: form.currency,
        is_default: methods.length === 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payout-methods", userId] });
      setForm({ ...emptyForm });
      setOpen(false);
      toast({ title: "Payout details saved" });
    },
    onError: (e: any) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const makeDefault = useMutation({
    mutationFn: async (id: string) => {
      const { error: clearErr } = await supabase
        .from("payout_methods")
        .update({ is_default: false })
        .eq("user_id", userId);
      if (clearErr) throw clearErr;
      const { error } = await supabase.from("payout_methods").update({ is_default: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payout-methods", userId] });
      toast({ title: "Default payout updated" });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payout_methods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payout-methods", userId] });
      toast({ title: "Payout method removed" });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Banknote className="h-4 w-4" /> Payout details
          </CardTitle>
          <CardDescription>Where we send your earnings after a stay finishes.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0">
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add payout details</DialogTitle>
              <DialogDescription>
                We only keep the last 4 digits of your account number.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Payout method</Label>
                <Select value={form.method_type} onValueChange={(v) => set("method_type", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_account">Bank account</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="holder">Name on account</Label>
                <Input
                  id="holder"
                  value={form.account_holder_name}
                  onChange={(e) => set("account_holder_name", e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>

              {isBank ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="bank">Bank name</Label>
                    <Input id="bank" value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="acct">Account number</Label>
                      <Input
                        id="acct"
                        inputMode="numeric"
                        value={form.account_number}
                        onChange={(e) => set("account_number", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="routing">Routing / sort code</Label>
                      <Input
                        id="routing"
                        value={form.routing_number}
                        onChange={(e) => set("routing_number", e.target.value)}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="paypal">PayPal email</Label>
                  <Input
                    id="paypal"
                    type="email"
                    value={form.paypal_email}
                    onChange={(e) => set("paypal_email", e.target.value)}
                  />
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select value={form.country} onValueChange={(v) => set("country", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  const err = validate();
                  if (err) {
                    toast({ title: "Check your details", description: err, variant: "destructive" });
                    return;
                  }
                  addMethod.mutate();
                }}
                disabled={addMethod.isPending}
              >
                {addMethod.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save details
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : methods.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No payout details yet. Add a bank account or PayPal so you can get paid.
          </p>
        ) : (
          <ul className="space-y-3">
            {methods.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Landmark className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {m.method_type === "paypal"
                        ? `PayPal · ${m.paypal_email}`
                        : `${m.bank_name} · ••••${m.account_last4}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.account_holder_name} · {m.country} · {m.currency}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {m.is_default ? (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Default
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => makeDefault.mutate(m.id)}>
                      Make default
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove.mutate(m.id)}
                    aria-label="Remove payout method"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
