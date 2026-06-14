import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Camera, X, Plus, DollarSign, MapPin, Dog, Sparkles, ArrowLeft, Loader2, Shield, Check } from "lucide-react";
import { POLICY_PRESETS, type CancellationPolicy } from "@/lib/cancellationPolicy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LocationPicker from "@/components/LocationPicker";
import AddressAutocomplete from "@/components/AddressAutocomplete";

const AMENITY_OPTIONS = [
  "Fenced Yard", "Dog Beds", "Treats Provided", "Daily Photos",
  "Webcam Access", "Medication Admin", "All Dog Sizes", "Daily Walks",
  "Daycare Available", "City Park Access", "Dog Toys", "Climate Controlled",
  "Swimming Pool", "Hiking Trails", "Grooming Service", "Night Walks",
];

const CreateListing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [maxDogs, setMaxDogs] = useState("1");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pinConfirmed, setPinConfirmed] = useState(false);
  const updateCoords = (next: { lat: number; lng: number } | null) => {
    setCoords(next);
    setPinConfirmed(false);
  };
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicy>("moderate");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-20 pb-24 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h1 className="font-serif text-2xl font-bold text-foreground mb-2">Sign in to become a host</h1>
            <p className="text-muted-foreground mb-4">You need an account to create listings.</p>
            <Button onClick={() => navigate("/auth")}>Sign In</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (photos.length + files.length > 6) {
      toast.error("Maximum 6 photos allowed");
      return;
    }
    const newPhotos = [...photos, ...files];
    setPhotos(newPhotos);

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotoPreviews((prev) => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error("Please add a title"); return; }
    if (!city.trim()) { toast.error("Please add a city"); return; }
    if (!price || parseFloat(price) <= 0) { toast.error("Please set a valid price"); return; }
    if (photos.length === 0) { toast.error("Please add at least one photo"); return; }
    if (!coords) { toast.error("Please pin your location on the map"); return; }
    if (!pinConfirmed) { toast.error("Please confirm the pin location before publishing"); return; }

    setSubmitting(true);
    try {
      // 1. Update profile to host
      await supabase
        .from("profiles")
        .update({ is_host: true })
        .eq("user_id", user.id);

      // 2. Create listing
      const { data: listing, error: listingError } = await supabase
        .from("listings")
        .insert({
          host_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          city: city.trim(),
          address: address.trim() || null,
          price_per_night: parseFloat(price),
          max_dogs: parseInt(maxDogs) || 1,
          amenities: selectedAmenities,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
          cancellation_policy: cancellationPolicy,
        })
        .select("id")
        .single();

      if (listingError) throw listingError;

      // 3. Upload photos and create listing_photos records
      for (let i = 0; i < photos.length; i++) {
        const file = photos[i];
        const ext = file.name.split(".").pop();
        const filePath = `${user.id}/${listing.id}/${i}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("listing-photos")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("listing-photos")
          .getPublicUrl(filePath);

        const { error: photoError } = await supabase
          .from("listing_photos")
          .insert({
            listing_id: listing.id,
            url: urlData.publicUrl,
            sort_order: i,
          });

        if (photoError) throw photoError;
      }

      toast.success("Listing created successfully!");
      navigate(`/listing/${listing.id}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20 pb-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="font-serif text-3xl font-bold text-foreground mb-2">Create Your Listing</h1>
            <p className="text-muted-foreground mb-10">Share your space with dog parents looking for a loving sitter.</p>

            {/* Photos */}
            <section className="mb-10">
              <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                <Camera className="w-5 h-5 text-primary" />
                Photos (up to 6)
              </Label>
              <div className="grid grid-cols-3 gap-3">
                {photoPreviews.map((src, i) => (
                  <div key={i} className="relative aspect-[4/3] rounded-xl overflow-hidden border border-border bg-secondary">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {i === 0 && (
                      <span className="absolute bottom-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                        Cover
                      </span>
                    )}
                  </div>
                ))}
                {photos.length < 6 && (
                  <label className="aspect-[4/3] rounded-xl border-2 border-dashed border-border bg-secondary/50 flex flex-col items-center justify-center cursor-pointer hover:bg-secondary transition-colors">
                    <Plus className="w-6 h-6 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">Add Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handlePhotoAdd}
                    />
                  </label>
                )}
              </div>
            </section>

            {/* Details */}
            <section className="mb-10 space-y-5">
              <div>
                <Label htmlFor="title" className="text-sm font-medium">Listing Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Sunny Backyard Haven"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your space and what makes it great for dogs..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="address" className="text-sm font-medium flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Address
                </Label>
                <p className="text-xs text-muted-foreground mt-1 mb-1">
                  Start typing your address — we'll fill in the city and pin the map for you.
                </p>
                <AddressAutocomplete
                  id="address"
                  value={address}
                  onChange={setAddress}
                  onPlaceSelected={(p) => {
                    setAddress(p.address);
                    if (p.city) setCity(p.city);
                    setCoords({ lat: p.lat, lng: p.lng });
                  }}
                  placeholder="123 Main St, Portland, OR"
                />
              </div>

              <div>
                <Label htmlFor="city" className="text-sm font-medium flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> City
                </Label>
                <Input
                  id="city"
                  placeholder="e.g. Portland, OR"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price" className="text-sm font-medium flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" /> Price per night
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    min={1}
                    placeholder="45"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="maxDogs" className="text-sm font-medium flex items-center gap-1">
                    <Dog className="w-3.5 h-3.5" /> Max dogs
                  </Label>
                  <Input
                    id="maxDogs"
                    type="number"
                    min={1}
                    max={10}
                    value={maxDogs}
                    onChange={(e) => setMaxDogs(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </section>

            {/* Map Location */}
            <section className="mb-10">
              <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-primary" />
                Pin your location
              </Label>
              <p className="text-sm text-muted-foreground mb-4">
                Help guests see exactly where your space is. Search, use your current location, or click the map to drop a pin.
              </p>
              <LocationPicker value={coords} onChange={setCoords} city={city} />
            </section>


            <section className="mb-10">
              <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-primary" />
                Amenities
              </Label>
              <div className="flex flex-wrap gap-2">
                {AMENITY_OPTIONS.map((amenity) => {
                  const selected = selectedAmenities.includes(amenity);
                  return (
                    <button
                      key={amenity}
                      onClick={() => toggleAmenity(amenity)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
                      }`}
                    >
                      {amenity}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mb-10">
              <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-primary" />
                Cancellation Policy
              </Label>
              <p className="text-sm text-muted-foreground mb-4">
                Choose how flexible you are with cancellations. Guests will see the exact deadlines on the calendar.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {Object.values(POLICY_PRESETS).map((preset) => {
                  const selected = cancellationPolicy === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setCancellationPolicy(preset.id)}
                      className={`text-left rounded-xl border p-4 transition-colors ${
                        selected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                          : "border-border bg-card hover:bg-secondary/50"
                      }`}
                    >
                      <div className="font-semibold text-foreground mb-1">{preset.label}</div>
                      <div className="text-xs text-muted-foreground">{preset.tagline}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Submit */}
            <Button
              size="lg"
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Publish Listing"
              )}
            </Button>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CreateListing;
