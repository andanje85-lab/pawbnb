import { Star, Heart, Shield, MapPin } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

interface ListingCardProps {
  id: string;
  image: string;
  title: string;
  location: string;
  rating: number;
  reviews: number;
  price: number;
  verified: boolean;
  tags: string[];
  /** Distance from search center in km. Shown as a small badge when provided. */
  distanceKm?: number | null;
}

const ListingCard = ({ id, image, title, location, rating, reviews, price, verified, tags, distanceKm }: ListingCardProps) => {
  const [liked, setLiked] = useState(false);

  return (
    <Link to={`/listing/${id}`} className="block">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="group cursor-pointer"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] rounded-2xl overflow-hidden mb-3">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <button
          onClick={(e) => { e.stopPropagation(); setLiked(!liked); }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center transition-colors hover:bg-card"
        >
          <Heart className={`w-4 h-4 transition-colors ${liked ? "fill-primary text-primary" : "text-foreground"}`} />
        </button>
        {verified && (
          <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium">
            <Shield className="w-3 h-3" />
            Verified
          </div>
        )}
      </div>

      {/* Info */}
      <div className="space-y-1">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-foreground text-sm leading-tight">{title}</h3>
          {reviews > 0 ? (
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <Star className="w-3.5 h-3.5 fill-warm-gold text-warm-gold" />
              <span className="text-xs font-medium text-foreground">{rating}</span>
              <span className="text-xs text-muted-foreground">({reviews})</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground shrink-0 ml-2">New</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="w-3 h-3" />
          <span className="text-xs">{location}</span>
          {distanceKm != null && (
            <span className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
              {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`} away
            </span>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {tags.map((tag) => (
            <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
              {tag}
            </span>
          ))}
        </div>
        <p className="text-sm">
          <span className="font-semibold text-foreground">${price}</span>
          <span className="text-muted-foreground"> / night</span>
        </p>
      </div>
    </motion.div>
    </Link>
  );
};

export default ListingCard;
