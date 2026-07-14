import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const useFavoriteIds = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["favorites", user?.id],
    queryFn: async () => {
      if (!user) return [] as string[];
      const { data, error } = await supabase
        .from("favorites")
        .select("listing_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || []).map((f) => f.listing_id);
    },
    enabled: !!user,
  });
};

export const useToggleFavorite = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listingId, isFav }: { listingId: string; isFav: boolean }) => {
      if (!user) throw new Error("Sign in to save favorites");
      if (isFav) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("listing_id", listingId);
        if (error) throw error;
        return false;
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: user.id, listing_id: listingId });
        if (error) throw error;
        return true;
      }
    },
    onSuccess: (nowFav) => {
      qc.invalidateQueries({ queryKey: ["favorites"] });
      toast.success(nowFav ? "Added to favorites" : "Removed from favorites");
    },
    onError: (err: any) => {
      toast.error(err.message || "Please sign in to save favorites");
    },
  });
};
