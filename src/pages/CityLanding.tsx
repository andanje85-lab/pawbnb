import { useMemo } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MapPin, ArrowRight, ShieldCheck, Star, Dog } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ListingCard from "@/components/ListingCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { CITIES, getCityBySlug } from "@/data/cities";
import listing1 from "@/assets/listing-1.jpg";

const SITE_URL = "https://doggo-digs-home.lovable.app";

const CityLanding = () => {
  const { citySlug } = useParams();
  const city = getCityBySlug(citySlug);

  const { data: listings, isLoading } = useQuery({
    queryKey: ["city-listings", city?.name],
    enabled: !!city,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, city, price_per_night, amenities, created_at, listing_photos(url, sort_order)")
        .eq("is_active", true)
        .ilike("city", `%${city!.name}%`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: ratings } = useQuery({
    queryKey: ["listings-ratings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("listing_id, rating");
      if (error) throw error;
      const map = new Map<string, { sum: number; count: number }>();
      (data || []).forEach((r) => {
        const cur = map.get(r.listing_id) || { sum: 0, count: 0 };
        cur.sum += r.rating;
        cur.count += 1;
        map.set(r.listing_id, cur);
      });
      const out: Record<string, { avg: number; count: number }> = {};
      map.forEach((v, k) => (out[k] = { avg: parseFloat((v.sum / v.count).toFixed(1)), count: v.count }));
      return out;
    },
  });

  const cards = useMemo(() => {
    return (listings || []).map((l) => {
      const photos = (l.listing_photos || []).sort((a, b) => a.sort_order - b.sort_order);
      const stats = ratings?.[l.id];
      return {
        id: l.id,
        image: photos[0]?.url || listing1,
        title: l.title,
        location: l.city || city?.name || "",
        rating: stats?.avg ?? 0,
        reviews: stats?.count ?? 0,
        price: l.price_per_night as number,
        verified: true,
        tags: ((l.amenities as string[]) || []).slice(0, 2),
      };
    });
  }, [listings, ratings, city?.name]);

  if (!city) return <Navigate to="/" replace />;

  const label = `${city.name}, ${city.state}`;
  const url = `${SITE_URL}/dog-boarding/${city.slug}`;
  const title = `Dog Boarding & Sitters in ${label} | PawBnB`;
  const description = `Find trusted dog boarding and daycare in ${label}. Compare verified local hosts, nightly rates and real reviews, then book your dog's stay on PawBnB.`;
  const fromPrice = cards.length ? Math.min(...cards.map((c) => c.price)) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "PawBnB", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: `Dog boarding in ${label}`, item: url },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: city.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  const otherCities = CITIES.filter((c) => c.slug !== city.slug);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={url} />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Header />

      <main className="flex-1 pt-16">
        {/* Hero */}
        <section className="border-b border-border bg-secondary/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
            <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground mb-4">
              <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
              <span className="mx-2">/</span>
              <span className="text-foreground">Dog boarding in {label}</span>
            </nav>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <div className="inline-flex items-center gap-2 text-sm text-primary mb-3">
                <MapPin className="w-4 h-4" />
                {label}
              </div>
              <h1 className="font-serif text-3xl sm:text-5xl font-bold text-foreground mb-4 max-w-3xl">
                Dog boarding &amp; sitters in {city.name}
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">{city.intro}</p>
              <div className="flex flex-wrap gap-3 mt-7">
                <Button asChild size="lg">
                  <Link to="/#listings">
                    Browse {city.name} hosts
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/create-listing">Host in {city.name}</Link>
                </Button>
              </div>
              {fromPrice !== null && (
                <p className="text-sm text-muted-foreground mt-4">
                  Stays from <span className="font-semibold text-foreground">${fromPrice}</span> per night
                </p>
              )}
            </motion.div>
          </div>
        </section>

        {/* Listings */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Available hosts in {city.name}
          </h2>
          <p className="text-muted-foreground mb-8">
            Every review on PawBnB comes from a confirmed stay, so what you read is what you get.
          </p>

          {isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[4/3] rounded-2xl" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              ))}
            </div>
          ) : cards.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {cards.map((c) => (
                <ListingCard key={c.id} {...c} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border p-10 text-center">
              <Dog className="w-8 h-8 text-primary mx-auto mb-3" />
              <p className="text-foreground font-medium mb-1">No {city.name} listings yet</p>
              <p className="text-muted-foreground text-sm mb-6">
                Browse nearby stays, or be the first host in {city.name}.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button asChild variant="outline"><Link to="/#listings">See all stays</Link></Button>
                <Button asChild><Link to="/create-listing">Become a host</Link></Button>
              </div>
            </div>
          )}
        </section>

        {/* Neighborhoods + trust */}
        <section className="bg-secondary/30 border-y border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid lg:grid-cols-2 gap-12">
            <div>
              <h2 className="font-serif text-2xl font-bold text-foreground mb-4">
                Popular {city.name} neighborhoods
              </h2>
              <ul className="grid grid-cols-2 gap-3 text-muted-foreground">
                {city.neighborhoods.map((n) => (
                  <li key={n} className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    {n}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold text-foreground mb-4">
                Why owners in {city.name} book with PawBnB
              </h2>
              <ul className="space-y-4 text-muted-foreground">
                <li className="flex gap-3">
                  <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  Hosts complete identity verification before their listing goes live.
                </li>
                <li className="flex gap-3">
                  <Star className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  Reviews are tied to confirmed bookings — no anonymous ratings.
                </li>
                <li className="flex gap-3">
                  <Dog className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  Message a host, or arrange a meet &amp; greet, before you confirm a stay.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground mb-8">
            Dog boarding in {city.name}: common questions
          </h2>
          <div className="space-y-8">
            {city.faq.map((f) => (
              <div key={f.q}>
                <h3 className="font-semibold text-foreground mb-2">{f.q}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Other cities */}
        <section className="border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
            <h2 className="font-serif text-xl font-bold text-foreground mb-5">Dog boarding in other cities</h2>
            <div className="flex flex-wrap gap-3">
              {otherCities.map((c) => (
                <Link
                  key={c.slug}
                  to={`/dog-boarding/${c.slug}`}
                  className="text-sm px-4 py-2 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
                >
                  {c.name}, {c.state}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default CityLanding;
