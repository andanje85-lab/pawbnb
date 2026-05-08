import { Search, MapPin, CalendarDays, Dog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import heroImage from "@/assets/hero-dog.jpg";

const Hero = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Happy dog in a cozy home"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/70 via-foreground/40 to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/30 mb-6">
            <Dog className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary-foreground">Trusted by 10,000+ dog parents</span>
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-primary-foreground leading-tight mb-4">
            A home away from home for your best friend
          </h1>

          <p className="text-lg text-primary-foreground/80 mb-8 max-w-lg">
            Find verified, loving hosts who'll treat your pup like family. Boarding, daycare, and overnight stays — all with real-time updates.
          </p>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="bg-card rounded-2xl p-2 shadow-2xl max-w-xl"
          >
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-secondary">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="City or zip code"
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
                />
              </div>
              <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-secondary">
                <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Check in — Check out"
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
                />
              </div>
              <Button
                size="lg"
                className="rounded-xl px-6"
                onClick={() => document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" })}
              >
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
