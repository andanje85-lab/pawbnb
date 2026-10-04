import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DogAvatar } from "@/components/MyDogs";

/** Shows the dog profiles attached to a booking (host view). */
const BookingDogs = ({ bookingId }: { bookingId: string }) => {
  const { data } = useQuery({
    queryKey: ["booking-dogs", bookingId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("booking_dogs")
        .select("dogs(*)")
        .eq("booking_id", bookingId);
      if (error) throw error;
      return ((data || []) as any[]).map((r) => r.dogs).filter(Boolean);
    },
  });
  if (!data || data.length === 0) return null;
  return (
    <div className="space-y-2 mb-3">
      {data.map((dog: any) => (
        <div key={dog.id} className="flex gap-3 p-2.5 rounded-lg bg-muted/40 text-xs">
          <DogAvatar dog={dog} className="w-9 h-9" />
          <div className="min-w-0 space-y-0.5 text-muted-foreground">
            <p className="text-sm font-medium text-foreground">
              {dog.name}
              {dog.breed && <span className="font-normal text-muted-foreground"> · {dog.breed}</span>}
              {dog.size && <span className="font-normal text-muted-foreground"> · {dog.size}</span>}
            </p>
            <p>Vaccinations: {String(dog.vaccination_status).replace(/_/g, " ")}{dog.vaccination_notes ? ` (${dog.vaccination_notes})` : ""}</p>
            {dog.temperament && <p>Temperament: {dog.temperament}</p>}
            {dog.care_notes && <p>Care: {dog.care_notes}</p>}
            {dog.feeding_instructions && <p>Feeding: {dog.feeding_instructions}</p>}
            {dog.medical_conditions && <p className="text-destructive">Medical: {dog.medical_conditions}</p>}
            {dog.vet_name && <p>Vet: {dog.vet_name}{dog.vet_phone ? ` · ${dog.vet_phone}` : ""}</p>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default BookingDogs;
