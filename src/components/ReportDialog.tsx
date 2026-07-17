import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Flag, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type Props = {
  targetType: "user" | "listing";
  targetId: string;
  triggerLabel?: string;
  variant?: "outline" | "ghost" | "link";
  size?: "sm" | "default";
};

const REASONS_USER = [
  { value: "harassment", label: "Harassment or abusive behavior" },
  { value: "impersonation", label: "Impersonation or fake profile" },
  { value: "spam", label: "Spam or scam" },
  { value: "unsafe", label: "Unsafe or threatening conduct" },
  { value: "other", label: "Something else" },
];

const REASONS_LISTING = [
  { value: "misleading", label: "Misleading photos or description" },
  { value: "unsafe", label: "Unsafe conditions for dogs" },
  { value: "off_platform", label: "Off-platform payment or contact request" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Something else" },
];

const schema = z.object({
  reason: z.string().min(1),
  details: z.string().trim().max(1000).optional(),
});

const ReportDialog = ({ targetType, targetId, triggerLabel, variant = "ghost", size = "sm" }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reasons = targetType === "user" ? REASONS_USER : REASONS_LISTING;

  const submit = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    const parsed = schema.safeParse({ reason, details });
    if (!parsed.success) {
      toast({ title: "Please choose a reason", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Couldn't submit report", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Report submitted",
      description: "Thanks for helping keep PawBnB safe. Our team will review it shortly.",
    });
    setOpen(false);
    setReason("");
    setDetails("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className="gap-1.5">
          <Flag className="w-3.5 h-3.5" />
          {triggerLabel ?? (targetType === "user" ? "Report user" : "Report listing")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this {targetType}</DialogTitle>
          <DialogDescription>
            Your report is confidential. Our trust & safety team will follow up if we need more information.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-details">Additional details (optional)</Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
              placeholder="Share anything that will help us investigate."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">{details.length}/1000</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !reason}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;
