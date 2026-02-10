import { useState } from "react";
import { Dog, Menu, X, Heart, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Dog className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-serif text-xl font-bold text-foreground">
              PawBnB
            </span>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#listings" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Explore
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </a>
            <a href="#trust" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Trust & Safety
            </a>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Heart className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="sm">
              Become a Host
            </Button>
            <Button size="sm">
              <User className="w-4 h-4 mr-1" />
              Sign In
            </Button>
          </div>

          {/* Mobile Menu */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-border bg-background overflow-hidden"
          >
            <div className="px-4 py-4 space-y-3">
              <a href="#listings" className="block text-sm font-medium text-muted-foreground">Explore</a>
              <a href="#how-it-works" className="block text-sm font-medium text-muted-foreground">How It Works</a>
              <a href="#trust" className="block text-sm font-medium text-muted-foreground">Trust & Safety</a>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1">Become a Host</Button>
                <Button size="sm" className="flex-1">Sign In</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
