import { Shield, Camera, Phone, BadgeCheck } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  { icon: BadgeCheck, title: "Verified Hosts", desc: "Background checks and identity verification for every host." },
  { icon: Camera, title: "Live Updates", desc: "Receive real-time photos and videos of your dog during their stay." },
  { icon: Shield, title: "Insurance Included", desc: "Every booking includes comprehensive pet insurance coverage." },
  { icon: Phone, title: "24/7 Support", desc: "Our team is always available for emergencies or questions." },
];

const TrustSection = () => {
  return (
    <section id="trust" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Your Dog's Safety Comes First
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Built-in trust and safety features so you can relax while your pup enjoys their stay.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-6 rounded-2xl bg-card border border-border hover:shadow-lg transition-shadow"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                <f.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
