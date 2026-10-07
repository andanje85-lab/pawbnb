import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Camera, ChevronDown, ChevronUp, X } from "lucide-react";
import { toast } from "sonner";

const MOODS = ["😄 Happy", "😴 Sleepy", "🎾 Playful", "🍖 Hungry", "🥰 Cuddly"];

/** Pup-date diary for a confirmed stay. Host posts; host and owner read. */
export default function PupUpdates({ bookingId, canPost }: { bookingId: string; canPost: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const key = ["pup-updates", bookingId];

  const { data: updates = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pup_updates").select("*").eq("booking_id", bookingId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const post = async () => {
    if (!user || (!content.trim() && files.length === 0)) return;
    setPosting(true);
    try {
      const urls: string[] = [];
      for (const f of files.slice(0, 6)) {
        const path = `${user.id}/pupdates/${bookingId}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        const { error } = await supabase.storage.from("avatars").upload(path, f);
        if (error) throw error;
        urls.push(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
      }
      const { error } = await supabase.from("pup_updates").insert({
        booking_id: bookingId, author_id: user.id, content: content.trim(), mood, photo_urls: urls,
      });
      if (error) throw error;
      setContent(""); setMood(null); setFiles([]);
      qc.invalidateQueries({ queryKey: key });
      toast.success("Pup-date sent");
    } catch (e: any) {
      toast.error(e.message || "Could not send the update");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-border">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium">
        <span>🐾 Pup-dates ({updates.length})</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          {canPost && (
            <div className="space-y-2 p-2 rounded-md bg-muted/40">
              <Textarea placeholder="How's the day going? Walks, meals, naps…" value={content} onChange={(e) => setContent(e.target.value)} rows={2} className="text-sm" />
              <div className="flex flex-wrap gap-1">
                {MOODS.map((m) => (
                  <button key={m} type="button" onClick={() => setMood(mood === m ? null : m)}
                    className={`text-xs px-2 py-1 rounded-full border ${mood === m ? "border-primary bg-primary/10" : "border-border"}`}>{m}</button>
                ))}
              </div>
              {files.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {files.map((f, i) => (
                    <span key={i} className="text-xs bg-background rounded px-2 py-0.5 flex items-center gap-1">
                      {f.name.slice(0, 18)}
                      <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <label className="inline-flex items-center gap-1 text-xs cursor-pointer px-2 py-1 rounded-md border border-border">
                  <Camera className="w-3.5 h-3.5" /> Photos
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => setFiles([...files, ...Array.from(e.target.files || [])].slice(0, 6))} />
                </label>
                <Button size="sm" onClick={post} disabled={posting || (!content.trim() && files.length === 0)}>
                  {posting ? "Sending…" : "Send pup-date"}
                </Button>
              </div>
            </div>
          )}
          {updates.length === 0 && <p className="text-xs text-muted-foreground">No updates yet.</p>}
          {updates.map((u: any) => (
            <div key={u.id} className="text-sm space-y-1 border-t border-border pt-2 first:border-0 first:pt-0">
              <p className="text-[11px] text-muted-foreground">{format(new Date(u.created_at), "MMM d, h:mm a")}{u.mood ? ` · ${u.mood}` : ""}</p>
              {u.content && <p className="whitespace-pre-wrap">{u.content}</p>}
              {Array.isArray(u.photo_urls) && u.photo_urls.length > 0 && (
                <div className="grid grid-cols-3 gap-1">
                  {(u.photo_urls as string[]).map((url) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt="Pup-date" className="w-full aspect-square object-cover rounded" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
