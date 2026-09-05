import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ListingCard from "@/components/ListingCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Heart, Plus, ListPlus, Check, Pencil, Trash2 } from "lucide-react";
import listing1 from "@/assets/listing-1.jpg";
import {
  useWishlists,
  useCreateWishlist,
  useDeleteWishlist,
  useRenameWishlist,
  useToggleWishlistItem,
} from "@/hooks/useWishlists";

const FavoritesList = () => {
  const { user } = useAuth();
  const { data: wishlists } = useWishlists();
  const createList = useCreateWishlist();
  const renameList = useRenameWishlist();
  const deleteList = useDeleteWishlist();
  const toggleItem = useToggleWishlistItem();

  const [activeList, setActiveList] = useState<string>("all");
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const { data: listings, isLoading } = useQuery({
    queryKey: ["favorite-listings", user?.id],
    queryFn: async () => {
      const { data: favs, error: fe } = await supabase
        .from("favorites")
        .select("listing_id, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (fe) throw fe;
      const ids = (favs || []).map((f) => f.listing_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, city, price_per_night, amenities, listing_photos(url, sort_order)")
        .in("id", ids)
        .eq("is_active", true);
      if (error) throw error;
      const map = new Map((data || []).map((l) => [l.id, l]));
      return ids.map((id) => map.get(id)).filter(Boolean) as any[];
    },
    enabled: !!user,
  });

  const current = (wishlists || []).find((w) => w.id === activeList) || null;

  const visible = useMemo(() => {
    if (!listings) return [];
    if (!current) return listings;
    return listings.filter((l) => current.listingIds.includes(l.id));
  }, [listings, current]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
        ))}
      </div>
    );
  }

  const hasFavorites = !!listings && listings.length > 0;

  return (
    <div className="space-y-5">
      {/* List chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Button
          size="sm"
          variant={activeList === "all" ? "default" : "outline"}
          className="shrink-0 rounded-full"
          onClick={() => setActiveList("all")}
        >
          All saved {hasFavorites ? `(${listings!.length})` : ""}
        </Button>
        {(wishlists || []).map((w) => (
          <Button
            key={w.id}
            size="sm"
            variant={activeList === w.id ? "default" : "outline"}
            className="shrink-0 rounded-full"
            onClick={() => setActiveList(w.id)}
          >
            {w.name} ({w.itemCount})
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 rounded-full gap-1"
          onClick={() => {
            setNewName("");
            setNewOpen(true);
          }}
        >
          <Plus className="w-4 h-4" />
          New list
        </Button>
      </div>

      {current && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {current.itemCount} {current.itemCount === 1 ? "stay" : "stays"} in “{current.name}”
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1"
            onClick={() => {
              setRenameValue(current.name);
              setRenameOpen(true);
            }}
          >
            <Pencil className="w-3.5 h-3.5" />
            Rename
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-destructive hover:text-destructive"
            onClick={() => {
              deleteList.mutate(current.id);
              setActiveList("all");
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </Button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <Heart className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="font-serif text-lg font-bold text-foreground mb-1">
            {current ? "This list is empty" : "No favorites yet"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {current
              ? "Open “All saved” and use “Add to list” on any stay."
              : "Tap the heart on any listing to save it here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.map((l) => {
            const photos = (l.listing_photos || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
            return (
              <div key={l.id} className="space-y-2">
                <ListingCard
                  id={l.id}
                  image={photos[0]?.url || listing1}
                  title={l.title}
                  location={l.city || "Unknown"}
                  rating={0}
                  reviews={0}
                  price={l.price_per_night}
                  verified={true}
                  tags={(l.amenities || []).slice(0, 2)}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="w-full gap-1.5 rounded-xl">
                      <ListPlus className="w-4 h-4" />
                      Add to list
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {(wishlists || []).length === 0 && (
                      <DropdownMenuItem disabled>No lists yet</DropdownMenuItem>
                    )}
                    {(wishlists || []).map((w) => {
                      const inList = w.listingIds.includes(l.id);
                      return (
                        <DropdownMenuItem
                          key={w.id}
                          onClick={() =>
                            toggleItem.mutate({ wishlistId: w.id, listingId: l.id, inList })
                          }
                        >
                          <span className="flex-1 truncate">{w.name}</span>
                          {inList && <Check className="w-4 h-4 text-primary" />}
                        </DropdownMenuItem>
                      );
                    })}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setNewName("");
                        setNewOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      New list
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {/* New list dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a list</DialogTitle>
            <DialogDescription>Group saved stays, e.g. “Summer road trip”.</DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="List name"
            maxLength={60}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newName.trim() || createList.isPending}
              onClick={async () => {
                const id = await createList.mutateAsync({ name: newName });
                setActiveList(id);
                setNewOpen(false);
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename list</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} maxLength={60} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!renameValue.trim() || !current}
              onClick={() => {
                if (current) renameList.mutate({ id: current.id, name: renameValue });
                setRenameOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FavoritesList;
