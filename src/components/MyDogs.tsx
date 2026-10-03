import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Dog, Plus, Pencil, Trash2, Camera, Loader2, Syringe, Stethoscope, HeartPulse } from "lucide-react";

type DogProfile = {
  id: string;
  name: string;
  breed: string | null;
  size: string | null;
  gender: string | null;
  date_of_birth: string | null;
  spayed_neutered: boolean;
  vaccination_status: string;
  vaccination_notes: string | null;
  temperament: string | null;
  medical_conditions: string | null;
  care_notes: string | null;
  feeding_instructions: string | null;
  vet_name: string | null;
  vet_phone: string | null;
  photo_url: string | null;
};

const emptyForm = {
  name: "",
  breed: "",
  size: "medium",
  gender: "",
  date_of_birth: "",
  spayed_neutered: false,
  vaccination_status: "not_vaccinated",
  vaccination_notes: "",
  temperament: "",
  medical_conditions: "",
  care_notes: "",
  feeding_instructions: "",
  vet_name: "",
  vet_phone: "",
  photo_url: "",
};

const vaccinationLabels: Record<string, string> = {
  up_to_date: "Vaccines up to date",
  partial: "Vaccines partial",
  not_vaccinated: "Not vaccinated",
};

const vaccinationBadgeClass: Record<string, string> = {
  up_to_date: "border-emerald-300 text-emerald-700",
  partial: "border-amber-300 text-amber-700",
  not_vaccinated: "border-muted text-muted-foreground",
};

export const DogAvatar = ({ dog, className = "w-10 h-10" }: { dog: { name: string; photo_url?: string | null }; className?: string }) => {
  if (dog.photo_url) {
    return <img src={dog.photo_url} alt={dog.name} className={`${className} rounded-full object-cover`} />;
  }
  return (
    <div className={`${className} rounded-full bg-primary/10 flex items-center justify-center shrink-0`}>
      <Dog className="w-1/2 h-1/2 text-primary" />
    </div>
  );
};

const MyDogs = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: dogs, isLoading } = useQuery({
    queryKey: ["my-dogs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dogs")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as DogProfile[];
    },
    enabled: !!user,
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (dog: DogProfile) => {
    setEditingId(dog.id);
    setForm({
      name: dog.name || "",
      breed: dog.breed || "",
      size: dog.size || "medium",
      gender: dog.gender || "",
      date_of_birth: dog.date_of_birth || "",
      spayed_neutered: dog.spayed_neutered,
      vaccination_status: dog.vaccination_status || "not_vaccinated",
      vaccination_notes: dog.vaccination_notes || "",
      temperament: dog.temperament || "",
      medical_conditions: dog.medical_conditions || "",
      care_notes: dog.care_notes || "",
      feeding_instructions: dog.feeding_instructions || "",
      vet_name: dog.vet_name || "",
      vet_phone: dog.vet_phone || "",
      photo_url: dog.photo_url || "",
    });
    setDialogOpen(true);
  };

  const handlePhoto = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const path = `dogs/${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setForm((f) => ({ ...f, photo_url: data.publicUrl }));
    } catch (e: any) {
      toast.error(e.message || "Photo upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Please give your dog a name");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        breed: form.breed.trim() || null,
        size: form.size,
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        spayed_neutered: form.spayed_neutered,
        vaccination_status: form.vaccination_status,
        vaccination_notes: form.vaccination_notes.trim() || null,
        temperament: form.temperament.trim() || null,
        medical_conditions: form.medical_conditions.trim() || null,
        care_notes: form.care_notes.trim() || null,
        feeding_instructions: form.feeding_instructions.trim() || null,
        vet_name: form.vet_name.trim() || null,
        vet_phone: form.vet_phone.trim() || null,
        photo_url: form.photo_url || null,
      };
      const { error } = editingId
        ? await supabase.from("dogs").update(payload).eq("id", editingId).eq("owner_id", user!.id)
        : await supabase.from("dogs").insert({ ...payload, owner_id: user!.id });
      if (error) throw error;
      toast.success(editingId ? "Dog profile updated" : `${payload.name} added`);
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["my-dogs"] });
    } catch (e: any) {
      toast.error(e.message || "Could not save dog profile");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const { error } = await supabase.from("dogs").delete().eq("id", id).eq("owner_id", user!.id);
    if (error) {
      toast.error("Could not delete dog profile");
    } else {
      toast.success(`${name} removed`);
      queryClient.invalidateQueries({ queryKey: ["my-dogs"] });
    }
  };

  const set = (key: keyof typeof emptyForm, value: any) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Save each dog's details once — they're shared with hosts automatically when you book.
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Add Dog
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 rounded-xl border border-border animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : !dogs || dogs.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Dog className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="font-serif text-lg font-bold text-foreground mb-1">No dog profiles yet</h3>
          <p className="text-muted-foreground text-sm mb-4">Add your dog's details so hosts know how to care for them.</p>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Add your first dog
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {dogs.map((dog) => (
            <motion.div
              key={dog.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 rounded-xl border border-border bg-card"
            >
              <div className="flex items-start gap-3">
                <DogAvatar dog={dog} className="w-14 h-14" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif font-bold text-foreground truncate">{dog.name}</h3>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(dog)} title="Edit">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(dog.id, dog.name)} title="Remove">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[dog.breed, dog.size ? `${dog.size} breed` : null, dog.gender].filter(Boolean).join(" · ") || "Details not added"}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge variant="outline" className={`text-[10px] ${vaccinationBadgeClass[dog.vaccination_status] || ""}`}>
                      <Syringe className="w-3 h-3 mr-1" /> {vaccinationLabels[dog.vaccination_status] || dog.vaccination_status}
                    </Badge>
                    {dog.spayed_neutered && (
                      <Badge variant="outline" className="text-[10px]">Spayed/Neutered</Badge>
                    )}
                    {dog.medical_conditions && (
                      <Badge variant="outline" className="text-[10px] border-red-200 text-red-700">
                        <HeartPulse className="w-3 h-3 mr-1" /> Medical notes
                      </Badge>
                    )}
                    {dog.vet_name && (
                      <Badge variant="outline" className="text-[10px]">
                        <Stethoscope className="w-3 h-3 mr-1" /> Vet on file
                      </Badge>
                    )}
                  </div>
                  {dog.care_notes && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">"{dog.care_notes}"</p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit dog profile" : "Add a dog"}</DialogTitle>
            <DialogDescription>
              Hosts see these details for bookings that include this dog.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {form.photo_url ? (
                <img src={form.photo_url} alt="" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Dog className="w-7 h-7 text-primary" />
                </div>
              )}
              <div>
                <Label htmlFor="dog-photo" className="cursor-pointer inline-flex items-center gap-1.5 text-sm text-primary">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  {form.photo_url ? "Change photo" : "Upload photo"}
                </Label>
                <input
                  id="dog-photo"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="dog-name">Name *</Label>
                <Input id="dog-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Biscuit" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="dog-breed">Breed</Label>
                <Input id="dog-breed" value={form.breed} onChange={(e) => set("breed", e.target.value)} placeholder="Golden Retriever" />
              </div>
              <div>
                <Label>Size</Label>
                <Select value={form.size} onValueChange={(v) => set("size", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={form.gender || "unknown"} onValueChange={(v) => set("gender", v === "unknown" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Prefer not to say</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dog-dob">Date of birth</Label>
                <Input id="dog-dob" type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
              </div>
              <div>
                <Label>Vaccinations</Label>
                <Select value={form.vaccination_status} onValueChange={(v) => set("vaccination_status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="up_to_date">Up to date</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="not_vaccinated">Not vaccinated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="dog-vax-notes">Vaccination details (which vaccines, dates)</Label>
                <Input id="dog-vax-notes" value={form.vaccination_notes} onChange={(e) => set("vaccination_notes", e.target.value)} placeholder="Rabies 2026-03, Bordetella 2026-01" />
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <Checkbox
                  id="dog-spayed"
                  checked={form.spayed_neutered}
                  onCheckedChange={(c) => set("spayed_neutered", !!c)}
                />
                <Label htmlFor="dog-spayed" className="font-normal">Spayed or neutered</Label>
              </div>
              <div className="col-span-2">
                <Label htmlFor="dog-temperament">Temperament</Label>
                <Input id="dog-temperament" value={form.temperament} onChange={(e) => set("temperament", e.target.value)} placeholder="Friendly, loves fetch, shy with strangers" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="dog-care">Care notes for the host</Label>
                <Textarea id="dog-care" rows={2} value={form.care_notes} onChange={(e) => set("care_notes", e.target.value)} placeholder="Two walks a day, scared of thunder, needs a bedtime treat" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="dog-feeding">Feeding instructions</Label>
                <Input id="dog-feeding" value={form.feeding_instructions} onChange={(e) => set("feeding_instructions", e.target.value)} placeholder="1 cup kibble morning & evening" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="dog-medical">Medical conditions or medication</Label>
                <Input id="dog-medical" value={form.medical_conditions} onChange={(e) => set("medical_conditions", e.target.value)} placeholder="Hip dysplasia — joint supplement with dinner" />
              </div>
              <div>
                <Label htmlFor="dog-vet-name">Vet name</Label>
                <Input id="dog-vet-name" value={form.vet_name} onChange={(e) => set("vet_name", e.target.value)} placeholder="Dr. Amani, PawCare Clinic" />
              </div>
              <div>
                <Label htmlFor="dog-vet-phone">Vet phone</Label>
                <Input id="dog-vet-phone" value={form.vet_phone} onChange={(e) => set("vet_phone", e.target.value)} placeholder="+254 700 000 000" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingId ? "Save changes" : "Add dog"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyDogs;
