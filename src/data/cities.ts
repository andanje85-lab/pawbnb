export interface City {
  slug: string;
  name: string;
  state: string;
  intro: string;
  neighborhoods: string[];
  faq: { q: string; a: string }[];
}

export const CITIES: City[] = [
  {
    slug: "portland-or",
    name: "Portland",
    state: "OR",
    intro:
      "Portland dogs are spoiled for choice — fenced backyards in Sellwood, riverside walks along the Willamette, and off-leash romps at Mt. Tabor. Our local hosts know the trails, the rainy-day routines, and the nearest emergency vet.",
    neighborhoods: ["Sellwood-Moreland", "Alberta Arts", "Hawthorne", "St. Johns"],
    faq: [
      { q: "How much does dog boarding cost in Portland?", a: "Most Portland hosts charge between $35 and $60 per night, with lower rates for stays longer than a week and discounts for repeat guests." },
      { q: "Do hosts walk dogs in the rain?", a: "Yes — Portland hosts are used to wet weather. Listings note towel-down routines, covered yards, and indoor play space." },
    ],
  },
  {
    slug: "austin-tx",
    name: "Austin",
    state: "TX",
    intro:
      "From patio brunches to Barton Creek swims, Austin is built for dogs. Hosts here offer shaded yards, early-morning walks that beat the Texas heat, and plenty of air-conditioned nap space.",
    neighborhoods: ["East Austin", "South Congress", "Zilker", "Mueller"],
    faq: [
      { q: "How do hosts handle Austin summer heat?", a: "Listings describe cooling setups — indoor A/C, shaded yards, splash pools, and walks scheduled for early morning and evening." },
      { q: "Can I book same-day dog boarding in Austin?", a: "Instant Book listings confirm immediately, so same-day stays are often possible when the calendar is open." },
    ],
  },
  {
    slug: "denver-co",
    name: "Denver",
    state: "CO",
    intro:
      "Denver hosts are outdoors people, and their dog guests benefit. Expect long walks in Wash Park, altitude-aware exercise, and hosts who know which trails are dog-friendly year-round.",
    neighborhoods: ["Wash Park", "Highlands", "RiNo", "Cherry Creek"],
    faq: [
      { q: "Are Denver hosts comfortable with big dogs?", a: "Many are — filter by number of dogs and check each listing's size notes and yard details before booking." },
      { q: "What about winter stays?", a: "Hosts list indoor play areas and paw-care routines for snow and de-icer, so cold-weather stays stay comfortable." },
    ],
  },
  {
    slug: "asheville-nc",
    name: "Asheville",
    state: "NC",
    intro:
      "Mountain air, big yards, and a town that genuinely loves dogs. Asheville hosts often have acreage, making it a favourite for multi-dog households and high-energy breeds.",
    neighborhoods: ["West Asheville", "North Asheville", "Montford", "Biltmore Village"],
    faq: [
      { q: "Can I board more than one dog in Asheville?", a: "Yes — several Asheville listings accept three or more dogs, with per-dog pricing shown clearly at checkout." },
      { q: "Do hosts take dogs on hikes?", a: "Many do. Listings mention hiking, and you can message a host before booking to confirm activity levels." },
    ],
  },
  {
    slug: "scottsdale-az",
    name: "Scottsdale",
    state: "AZ",
    intro:
      "Scottsdale stays lean upscale: pools, misters, and shaded travertine patios. Hosts here plan around desert heat and know which local vets handle cactus and snake encounters.",
    neighborhoods: ["Old Town", "McCormick Ranch", "North Scottsdale", "Arcadia"],
    faq: [
      { q: "Are pool stays safe for dogs?", a: "Hosts with pools describe supervision rules and fencing on their listing, and you can ask about swim experience before booking." },
      { q: "What's the typical nightly rate?", a: "Scottsdale rates run higher than the national average, commonly $55 to $85 per night depending on amenities." },
    ],
  },
  {
    slug: "malibu-ca",
    name: "Malibu",
    state: "CA",
    intro:
      "Beach access is the headline in Malibu. Hosts along the coast build stays around morning sand walks, rinse-off routines, and calm evenings with ocean air.",
    neighborhoods: ["Point Dume", "Zuma", "Malibu Colony", "Trancas"],
    faq: [
      { q: "Do Malibu hosts take dogs to the beach?", a: "Beach-access listings say so directly. Confirm leash rules and swim comfort with your host in the app before you book." },
      { q: "Is Malibu good for anxious dogs?", a: "Quiet coastal homes with low foot traffic suit nervous dogs well — look for listings that mention one-dog-at-a-time hosting." },
    ],
  },
];

export const getCityBySlug = (slug?: string) =>
  CITIES.find((c) => c.slug === slug?.toLowerCase());
