import { useState } from "react";
import { Star } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const reviewSchema = z.object({
  rating: z.number().int().min(1, "Please select a rating").max(5),
  comment: z.string().trim().max(1000, "Comment must be 1000 characters or fewer").optional(),
});

interface ReviewFormProps {
  bookingId: string;
  listingId: string;
  reviewerId: string;
  onClose: () => void;
}

const ReviewForm = ({ bookingId, listingId, reviewerId, onClose }: ReviewFormProps) => {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    const parsed = reviewSchema.safeParse({ rating, comment: comment.trim() || undefined });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("reviews").insert({
        booking_id: bookingId,
        listing_id: listingId,
        reviewer_id: reviewerId,
        rating: parsed.data.rating,
        comment: parsed.data.comment ?? null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("You've already reviewed this stay");
        throw error;
      }
      toast.success("Review submitted!");
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["reviews-stats"] });
      queryClient.invalidateQueries({ queryKey: ["listings-ratings"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 p-4 rounded-xl border border-border bg-secondary/50 space-y-3">
      <p className="text-sm font-medium text-foreground">Rate your stay</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={`w-6 h-6 transition-colors ${
                star <= (hovered || rating)
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/30"
              }`}
            />
          </button>
        ))}
      </div>
      <Textarea
        placeholder="Tell others about your experience..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Review"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default ReviewForm;
