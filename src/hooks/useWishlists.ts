import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Wishlist {
  id: string;
  name: string;
  note: string | null;
  created_at: string;
  itemCount: number;
  listingIds: string[];
}

/** All wishlists for the signed-in user, with their listing ids. */
export const useWishlists = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["wishlists", user?.id],
    queryFn: async (): Promise<Wishlist[]> => {
      const { data, error } = await supabase
        .from("wishlists")
        .select("id, name, note, created_at, wishlist_items(listing_id)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map((w: any) => {
        const listingIds = (w.wishlist_items || []).map((i: any) => i.listing_id);
        return {
          id: w.id,
          name: w.name,
          note: w.note,
          created_at: w.created_at,
          listingIds,
          itemCount: listingIds.length,
        };
      });
    },
    enabled: !!user,
  });
};

export const useCreateWishlist = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, note }: { name: string; note?: string }) => {
      if (!user) throw new Error("Sign in to create a list");
      const { data, error } = await supabase
        .from("wishlists")
        .insert({ user_id: user.id, name: name.trim(), note: note?.trim() || null })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wishlists"] });
      toast.success("List created");
    },
    onError: (e: any) => toast.error(e.message || "Could not create the list"),
  });
};

export const useRenameWishlist = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("wishlists").update({ name: name.trim() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wishlists"] });
      toast.success("List renamed");
    },
    onError: (e: any) => toast.error(e.message || "Could not rename the list"),
  });
};

export const useDeleteWishlist = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wishlists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wishlists"] });
      toast.success("List deleted");
    },
    onError: (e: any) => toast.error(e.message || "Could not delete the list"),
  });
};

export const useToggleWishlistItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      wishlistId,
      listingId,
      inList,
    }: {
      wishlistId: string;
      listingId: string;
      inList: boolean;
    }) => {
      if (inList) {
        const { error } = await supabase
          .from("wishlist_items")
          .delete()
          .eq("wishlist_id", wishlistId)
          .eq("listing_id", listingId);
        if (error) throw error;
        return false;
      }
      const { error } = await supabase
        .from("wishlist_items")
        .insert({ wishlist_id: wishlistId, listing_id: listingId });
      if (error) throw error;
      return true;
    },
    onSuccess: (added) => {
      qc.invalidateQueries({ queryKey: ["wishlists"] });
      toast.success(added ? "Added to list" : "Removed from list");
    },
    onError: (e: any) => toast.error(e.message || "Could not update the list"),
  });
};
