import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DogAvatar } from "@/components/MyDogs";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Opens a printable one-page care sheet per dog. */
function printCareSheet(dogs: any[]) {
  const row = (label: string, v: unknown) => (v ? `<tr><th>${label}</th><td>${esc(v)}</td></tr>` : "");
  const pages = dogs.map((d) => `
    <section>
      <header>${d.photo_url ? `<img src="${esc(d.photo_url)}" />` : ""}<div><h1>${esc(d.name)}</h1><p>${esc([d.breed, d.size, d.gender].filter(Boolean).join(" · "))}</p></div></header>
      <table>
        ${row("Feeding", d.feeding_instructions)}
        ${row("Medication / medical", d.medical_conditions)}
        ${row("Care notes", d.care_notes)}
        ${row("Temperament", d.temperament)}
        ${row("Vaccinations", `${String(d.vaccination_status).replace(/_/g, " ")}${d.vaccination_notes ? ` (${d.vaccination_notes})` : ""}`)}
        ${row("Vet", [d.vet_name, d.vet_phone].filter(Boolean).join(" · "))}
      </table>
    </section>`).join("");
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>Care sheet</title><style>
    body{font-family:Georgia,serif;margin:32px;color:#222}section{page-break-after:always}
    header{display:flex;gap:20px;align-items:center;margin-bottom:20px}img{width:140px;height:140px;object-fit:cover;border-radius:12px}
    h1{font-size:36px;margin:0}table{width:100%;border-collapse:collapse;font-size:16px}
    th{text-align:left;width:30%;vertical-align:top;padding:10px;border-bottom:1px solid #ddd}td{padding:10px;border-bottom:1px solid #ddd}
  </style></head><body>${pages}<script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

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
      <button type="button" onClick={() => printCareSheet(data)} className="text-xs underline text-primary">
        🖨️ Print care sheet
      </button>
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
