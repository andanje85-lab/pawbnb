import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";

export interface BiscuitListingMeta {
  id: string;
  title: string;
  city: string | null;
  price_per_night: number | null;
  photo?: string | null;
}

interface Props {
  listing: BiscuitListingMeta;
  onNavigate?: () => void;
}

const BiscuitListingCard = ({ listing, onNavigate }: Props) => {
  return (
    <Link
      to={`/listing/${listing.id}`}
      onClick={onNavigate}
      className="flex gap-3 p-2 rounded-xl bg-background border border-border hover:border-primary/50 hover:shadow-sm transition group"
    >
      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
        {listing.photo ? (
          <img
            src={listing.photo}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            🐾
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
          {listing.title}
        </div>
        {listing.city && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{listing.city}</span>
          </div>
        )}
        {listing.price_per_night != null && (
          <div className="text-xs mt-1">
            <span className="font-semibold text-foreground">${listing.price_per_night}</span>
            <span className="text-muted-foreground"> / night</span>
          </div>
        )}
      </div>
    </Link>
  );
};

export default BiscuitListingCard;
