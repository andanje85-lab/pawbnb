import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Loader2, Upload, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const CLAIM_TYPES = [
  { value: "property_damage", label: "Property damage" },
  { value: "veterinary", label: "Veterinary expense" },
  { value: "injury", label: "Injury" },
  { value: "other", label: "Something else" },
];

const schema = z.object({
  claim_type: z.enum(["property_damage", "veterinary", "injury", "other"]),
  incident_date: z.string().min(1, "Required"),
  description: z.string().trim().min(20, "Please add at least 20 characters").max(4000),
  amount_requested: z.string().optional(),
  contact_email: z.string().trim().email("Enter a valid email").max(255),
  contact_phone: z.string().trim().max(30).optional(),
  booking_id: z.string().uuid().optional().or(z.literal("")),
});

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-secondary text-secondary-foreground",
  reviewing: "bg-amber-100 text-amber-900",
  approved: "bg-emerald-100 text-emerald-900",
  denied: "bg-destructive/10 text-destructive",
  paid: "bg-emerald-500/15 text-emerald-900",
};

const InsuranceClaim = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [claimType, setClaimType] = useState<string>("");
  const [incidentDate, setIncidentDate] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [bookingId, setBookingId] = useState<string>("");
  const [evidence, setEvidence] = useState<{ name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  }, [user, email]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  // User's bookings for context linking
  const { data: bookings } = useQuery({
    queryKey: ["claim-bookings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, check_in, check_out, listings(title, city)")
        .eq("guest_id", user!.id)
        .order("check_out", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Prior claims
  const { data: myClaims, refetch: refetchClaims } = useQuery({
    queryKey: ["my-claims", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insurance_claims")
        .select("id, claim_type, incident_date, status, amount_requested, created_at")
        .eq("claimant_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10 MB per file.", variant: "destructive" });
      return;
    }
    setUploading(true);
    const path = `${user.id}/claims/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("message-attachments").upload(path, file);
    if (error) {
      setUploading(false);
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      return;
    }
    const { data } = supabase.storage.from("message-attachments").getPublicUrl(path);
    setEvidence((prev) => [...prev, { name: file.name, url: data.publicUrl }]);
    setUploading(false);
    e.target.value = "";
  };

  const submit = async () => {
    const parsed = schema.safeParse({
      claim_type: claimType,
      incident_date: incidentDate,
      description,
      amount_requested: amount,
      contact_email: email,
      contact_phone: phone,
      booking_id: bookingId,
    });
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      toast({ title: "Check the form", description: first || "Please fill required fields.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("insurance_claims").insert({
      claimant_id: user!.id,
      booking_id: bookingId || null,
      claim_type: claimType,
      incident_date: incidentDate,
      description: description.trim(),
      amount_requested: amount ? Number(amount) : null,
      contact_email: email.trim(),
      contact_phone: phone.trim() || null,
      evidence_urls: evidence,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Couldn't file claim", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Claim filed",
      description: "Our care team will reach out within 1 business day.",
    });
    setClaimType(""); setIncidentDate(""); setDescription(""); setAmount("");
    setPhone(""); setBookingId(""); setEvidence([]);
    refetchClaims();
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 pt-24 pb-16 px-4 max-w-3xl mx-auto w-full">
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-2">File an insurance claim</h1>
        <p className="text-muted-foreground mb-8">
          Tell us what happened. Attach photos, receipts, or vet records so our care team can process your claim quickly.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">Claim details</CardTitle>
            <CardDescription>All fields with * are required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Claim type *</Label>
                <Select value={claimType} onValueChange={setClaimType}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {CLAIM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="incident-date">Incident date *</Label>
                <Input
                  id="incident-date"
                  type="date"
                  max={format(new Date(), "yyyy-MM-dd")}
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                />
              </div>
            </div>

            {bookings && bookings.length > 0 && (
              <div className="space-y-2">
                <Label>Related booking (optional)</Label>
                <Select value={bookingId} onValueChange={setBookingId}>
                  <SelectTrigger><SelectValue placeholder="Not related to a booking" /></SelectTrigger>
                  <SelectContent>
                    {bookings.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.listings?.title || "Booking"} · {format(new Date(b.check_in), "MMM d")}–{format(new Date(b.check_out), "MMM d, yyyy")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">What happened? *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 4000))}
                placeholder="Describe the incident, what was damaged or treated, and any people or animals involved."
                rows={6}
              />
              <p className="text-xs text-muted-foreground">{description.length}/4000</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount requested (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 250.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Contact phone (optional)</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Contact email *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Evidence (photos, receipts, vet records)</Label>
              <label className="flex items-center gap-2 border border-dashed border-border rounded-lg p-4 cursor-pointer hover:bg-secondary/40 transition-colors">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-primary" />}
                <span className="text-sm text-muted-foreground">
                  {uploading ? "Uploading…" : "Click to upload (10 MB max per file)"}
                </span>
                <input type="file" className="hidden" onChange={uploadFile} disabled={uploading} accept="image/*,.pdf" />
              </label>
              {evidence.length > 0 && (
                <ul className="space-y-1.5">
                  {evidence.map((f, i) => (
                    <li key={i} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                      <a href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 truncate hover:underline">
                        <FileText className="w-4 h-4 shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setEvidence((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        aria-label="Remove attachment"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Button onClick={submit} disabled={submitting} className="w-full sm:w-auto">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit claim
            </Button>
          </CardContent>
        </Card>

        {myClaims && myClaims.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="font-serif text-xl">Your claims</CardTitle>
              <CardDescription>Track the status of claims you've filed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {myClaims.map((c: any) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
                  <div>
                    <p className="font-medium text-foreground capitalize">{c.claim_type.replace("_", " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      Incident {format(new Date(c.incident_date), "MMM d, yyyy")} · filed {format(new Date(c.created_at), "MMM d, yyyy")}
                      {c.amount_requested ? ` · $${Number(c.amount_requested).toFixed(2)}` : ""}
                    </p>
                  </div>
                  <Badge className={`${STATUS_COLORS[c.status] || ""} capitalize`}>{c.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default InsuranceClaim;
