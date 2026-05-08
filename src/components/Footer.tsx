import { Dog } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-foreground text-background py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Dog className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-serif text-lg font-bold">PawBnB</span>
            </div>
            <p className="text-sm text-background/60 leading-relaxed">
              A home away from home for your best friend. Trusted dog boarding and daycare.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">For Dog Owners</h4>
            <ul className="space-y-2 text-sm text-background/60">
              <li><Link to="/#listings" className="hover:text-background transition-colors">Find a Host</Link></li>
              <li><Link to="/#how-it-works" className="hover:text-background transition-colors">How It Works</Link></li>
              <li><Link to="/insurance" className="hover:text-background transition-colors">Insurance</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">For Hosts</h4>
            <ul className="space-y-2 text-sm text-background/60">
              <li><Link to="/create-listing" className="hover:text-background transition-colors">Become a Host</Link></li>
              <li><Link to="/host-resources" className="hover:text-background transition-colors">Host Resources</Link></li>
              <li><Link to="/pricing" className="hover:text-background transition-colors">Pricing</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Support</h4>
            <ul className="space-y-2 text-sm text-background/60">
              <li><Link to="/help-center" className="hover:text-background transition-colors">Help Center</Link></li>
              <li><Link to="/safety" className="hover:text-background transition-colors">Safety</Link></li>
              <li><Link to="/contact" className="hover:text-background transition-colors">Contact Us</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-background/10 pt-6 text-center text-xs text-background/40">
          © 2026 PawBnB. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
