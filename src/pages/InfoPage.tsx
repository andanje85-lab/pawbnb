import { useParams, Link, Navigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowRight, Mail, Phone, ShieldCheck, LifeBuoy, DollarSign, BookOpen, HeartHandshake, Search } from "lucide-react";

type InfoSlug =
  | "find-a-host"
  | "insurance"
  | "host-resources"
  | "pricing"
  | "help-center"
  | "safety"
  | "contact";

const CONTENT: Record<InfoSlug, {
  icon: any;
  title: string;
  subtitle: string;
  sections: { heading: string; body: string }[];
  cta?: { label: string; to: string };
}> = {
  "find-a-host": {
    icon: Search,
    title: "Find the right host for your dog",
    subtitle: "Browse verified sitters near you and book a stay in minutes.",
    sections: [
      { heading: "Search by location", body: "Use the search on the home page to filter by city, dates, and the number of dogs you need looked after." },
      { heading: "Read real reviews", body: "Every review is tied to a confirmed booking, so you only see feedback from real guests." },
      { heading: "Message before you book", body: "Chat with hosts to ask about routines, fenced yards, or anything else your dog needs." },
    ],
    cta: { label: "Browse listings", to: "/#listings" },
  },
  insurance: {
    icon: ShieldCheck,
    title: "Stays you can trust",
    subtitle: "Every confirmed booking is covered by our PawBnB Care guarantee.",
    sections: [
      { heading: "Veterinary support", body: "If something happens during a stay, our care team helps coordinate with a local vet at no cost to you." },
      { heading: "Property protection for hosts", body: "Hosts are protected against accidental damage caused during a confirmed booking." },
      { heading: "24/7 support", body: "Reach our team any time during a stay through the in-app messaging or by email." },
    ],
    cta: { label: "Contact our team", to: "/contact" },
  },
  "host-resources": {
    icon: BookOpen,
    title: "Everything you need to host",
    subtitle: "Guides, checklists, and best practices to help you welcome dogs with confidence.",
    sections: [
      { heading: "Setting up your listing", body: "Add great photos, an honest description, and your house rules to attract the right guests." },
      { heading: "Preparing for a stay", body: "Use our pre-stay checklist to make sure your space is dog-proof and ready for any breed." },
      { heading: "Growing your bookings", body: "Respond quickly, keep your calendar updated, and ask happy guests to leave a review." },
    ],
    cta: { label: "Create a listing", to: "/create-listing" },
  },
  pricing: {
    icon: DollarSign,
    title: "Simple, transparent pricing",
    subtitle: "No subscription fees. You only pay when you get booked.",
    sections: [
      { heading: "For dog owners", body: "You see the full nightly price up front — no hidden fees added at checkout." },
      { heading: "For hosts", body: "PawBnB takes a small service fee from each completed booking. You set your own nightly rate." },
      { heading: "Cancellation policies", body: "Hosts choose between flexible, moderate, and strict policies, shown clearly on every listing." },
    ],
    cta: { label: "See available stays", to: "/#listings" },
  },
  "help-center": {
    icon: LifeBuoy,
    title: "How can we help?",
    subtitle: "Answers to the questions guests and hosts ask most often.",
    sections: [
      { heading: "Booking a stay", body: "Pick a listing, choose your dates and number of dogs, then send a request to the host." },
      { heading: "Managing your listings", body: "Edit your listing, update availability, and review booking requests from your host dashboard." },
      { heading: "Payments and refunds", body: "Refunds follow the cancellation policy on each listing. The full terms are shown before you book." },
    ],
    cta: { label: "Contact support", to: "/contact" },
  },
  safety: {
    icon: HeartHandshake,
    title: "Safety first, always",
    subtitle: "How we keep dogs, owners, and hosts safe at every step.",
    sections: [
      { heading: "Verified hosts", body: "Hosts complete identity verification before their listings appear in search results." },
      { heading: "Secure messaging", body: "All conversations happen inside PawBnB so our team can step in if anything feels off." },
      { heading: "Emergency support", body: "Our care team is on call 24/7 during active stays to help with any urgent issue." },
    ],
    cta: { label: "Read trust & safety", to: "/#trust" },
  },
  contact: {
    icon: Mail,
    title: "Get in touch",
    subtitle: "We usually reply within a few hours.",
    sections: [
      { heading: "Email", body: "Reach our team at hello@pawbnb.com and we'll get back to you as soon as we can." },
      { heading: "Press & partnerships", body: "For media or partnership inquiries, email partners@pawbnb.com." },
      { heading: "Active bookings", body: "If you're in the middle of a stay, the fastest way to reach us is through in-app messaging." },
    ],
    cta: { label: "Email us", to: "mailto:hello@pawbnb.com" },
  },
};

const InfoPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const data = slug && (CONTENT as any)[slug] ? CONTENT[slug as InfoSlug] : null;

  if (!data) return <Navigate to="/" replace />;

  const Icon = data.icon;
  const isExternal = data.cta?.to.startsWith("mailto:") || data.cta?.to.startsWith("http");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6">
            <Icon className="w-6 h-6" />
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-3">{data.title}</h1>
          <p className="text-lg text-muted-foreground mb-10">{data.subtitle}</p>

          <div className="space-y-8">
            {data.sections.map((s) => (
              <div key={s.heading}>
                <h2 className="font-serif text-xl font-semibold text-foreground mb-2">{s.heading}</h2>
                <p className="text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>

          {data.cta && (
            <div className="mt-12">
              {isExternal ? (
                <Button asChild size="lg">
                  <a href={data.cta.to}>
                    {data.cta.label}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              ) : (
                <Button asChild size="lg">
                  <Link to={data.cta.to}>
                    {data.cta.label}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              )}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default InfoPage;
