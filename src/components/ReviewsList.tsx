import { Star, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ReviewsListProps {
  listingId: string;
}

const ReviewsList = ({ listingId }: ReviewsListProps) => {
  const { data: reviews, isLoading } = useQuery({
    queryKey: ["reviews", listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*, profiles:reviewer_id(full_name)")
        .eq("listing_id", listingId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const avgRating = reviews && reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  if (isLoading) {
    return (
      <div className="space-y-4 mt-10">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!reviews || reviews.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-6">
        <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
        <h2 className="font-serif text-xl font-bold text-foreground">
          {avgRating} · {reviews.length} review{reviews.length !== 1 ? "s" : ""}
        </h2>
      </div>
      <div className="space-y-6">
        {reviews.map((review) => {
          const profile = review.profiles as any;
          const name = profile?.full_name || "Guest";
          const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
          return (
            <div key={review.id} className="flex gap-3">
              <Avatar className="w-10 h-10 shrink-0">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-foreground">{name}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(review.created_at), "MMM yyyy")}
                  </span>
                </div>
                <div className="flex gap-0.5 mb-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3.5 h-3.5 ${
                        s <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"
                      }`}
                    />
                  ))}
                </div>
                {review.comment && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReviewsList;
