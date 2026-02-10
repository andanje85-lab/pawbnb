import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ListingCard from "@/components/ListingCard";
import HowItWorks from "@/components/HowItWorks";
import TrustSection from "@/components/TrustSection";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";

import listing1 from "@/assets/listing-1.jpg";
import listing2 from "@/assets/listing-2.jpg";
import listing3 from "@/assets/listing-3.jpg";
import listing4 from "@/assets/listing-4.jpg";
import listing5 from "@/assets/listing-5.jpg";
import listing6 from "@/assets/listing-6.jpg";

const listings = [
  {
    image: listing1,
    title: "Sunny Backyard Haven",
    location: "Portland, OR",
    rating: 4.9,
    reviews: 127,
    price: 45,
    verified: true,
    tags: ["Fenced Yard", "Small Dogs"],
  },
  {
    image: listing2,
    title: "Downtown Dog-Friendly Loft",
    location: "Austin, TX",
    rating: 4.8,
    reviews: 89,
    price: 55,
    verified: true,
    tags: ["All Sizes", "Daycare"],
  },
  {
    image: listing3,
    title: "Country Farmhouse Retreat",
    location: "Asheville, NC",
    rating: 5.0,
    reviews: 203,
    price: 38,
    verified: true,
    tags: ["Large Yard", "Multiple Dogs"],
  },
  {
    image: listing4,
    title: "Luxury Pool Villa",
    location: "Scottsdale, AZ",
    rating: 4.9,
    reviews: 156,
    price: 75,
    verified: true,
    tags: ["Pool", "Premium"],
  },
  {
    image: listing5,
    title: "Coastal Beach Cottage",
    location: "Malibu, CA",
    rating: 4.7,
    reviews: 64,
    price: 65,
    verified: false,
    tags: ["Beach Access", "Medium Dogs"],
  },
  {
    image: listing6,
    title: "English Garden Cottage",
    location: "Denver, CO",
    rating: 4.9,
    reviews: 198,
    price: 42,
    verified: true,
    tags: ["Garden", "Small Dogs"],
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />

      {/* Listings */}
      <section id="listings" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12"
          >
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-3">
              Top-Rated Hosts Near You
            </h2>
            <p className="text-muted-foreground">
              Loving homes vetted by our team and trusted by thousands of dog parents.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <ListingCard key={listing.title} {...listing} />
            ))}
          </div>
        </div>
      </section>

      <HowItWorks />
      <TrustSection />
      <Footer />
    </div>
  );
};

export default Index;
