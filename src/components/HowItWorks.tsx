import { Search, MessageCircle, Heart } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    icon: Search,
    title: "Search & Filter",
    description: "Find the perfect host by location, yard size, experience level, and dog compatibility.",
  },
  {
    icon: MessageCircle,
    title: "Meet & Greet",
    description: "Message hosts, ask questions, and arrange a meet & greet so your pup feels comfortable.",
  },
  {
    icon: Heart,
    title: "Book with Confidence",
    description: "Secure booking with insurance coverage, real-time photo updates, and 24/7 support.",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 bg-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-3">
            How PawBnB Works
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Three simple steps to give your dog the best stay ever.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <step.icon className="w-7 h-7 text-primary" />
              </div>
              <div className="text-xs font-semibold text-primary mb-2">Step {i + 1}</div>
              <h3 className="font-serif text-xl font-semibold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
