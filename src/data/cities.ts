export interface City {
  slug: string;
  name: string;
  country: string;
  intro: string;
  neighborhoods: string[];
  faq: { q: string; a: string }[];
}

type CityDetails = Omit<City, "faq">;

const createCity = (city: CityDetails): City => ({
  ...city,
  faq: [
    {
      q: `How do I choose a dog boarding host in ${city.name}?`,
      a: "Compare host profiles, verified reviews, availability, and the care details that matter to your dog. You can message a host or arrange a meet & greet before confirming a stay.",
    },
    {
      q: `Can I find dog boarding near me in ${city.name}?`,
      a: "Browse local host listings and check each host's location, services, and calendar. Availability depends on the dates and care needs you select.",
    },
  ],
});

export const CITIES: City[] = [
  createCity({
    slug: "portland-or",
    name: "Portland",
    country: "United States",
    intro: "Find dog boarding with local hosts across Portland, from leafy residential streets to walkable inner-city neighborhoods. Compare care routines, home details, and availability for your dog's stay.",
    neighborhoods: ["Sellwood-Moreland", "Alberta Arts", "Hawthorne", "St. Johns"],
  }),
  createCity({
    slug: "austin-tx",
    name: "Austin",
    country: "United States",
    intro: "Explore dog boarding in Austin with hosts who can share their home setup, daily routines, and outdoor space. Choose a stay that suits your dog's temperament and schedule.",
    neighborhoods: ["East Austin", "South Congress", "Zilker", "Mueller"],
  }),
  createCity({
    slug: "denver-co",
    name: "Denver",
    country: "United States",
    intro: "Discover dog boarding options in Denver and compare local hosts by the care, home environment, and dates they offer. Message a host to talk through your dog's routine before booking.",
    neighborhoods: ["Wash Park", "Highlands", "RiNo", "Cherry Creek"],
  }),
  createCity({
    slug: "asheville-nc",
    name: "Asheville",
    country: "United States",
    intro: "Find a comfortable dog boarding stay in Asheville with local hosts. Review each home, ask about exercise and daily care, and choose a host whose routine fits your dog.",
    neighborhoods: ["West Asheville", "North Asheville", "Montford", "Biltmore Village"],
  }),
  createCity({
    slug: "scottsdale-az",
    name: "Scottsdale",
    country: "United States",
    intro: "Browse dog boarding hosts in Scottsdale and compare their home environments, services, and availability. Share your dog's needs with a host before arranging a stay.",
    neighborhoods: ["Old Town", "McCormick Ranch", "North Scottsdale", "Arcadia"],
  }),
  createCity({
    slug: "malibu-ca",
    name: "Malibu",
    country: "United States",
    intro: "Explore dog boarding in Malibu with hosts who can describe their home, daily routine, and the care they provide. Check the details and connect before choosing a stay.",
    neighborhoods: ["Point Dume", "Zuma", "Malibu Colony", "Trancas"],
  }),
  createCity({
    slug: "nairobi",
    name: "Nairobi",
    country: "Kenya",
    intro: "Find dog boarding in Nairobi with local hosts across the city. Compare home settings and daily care in areas such as Karen, Westlands, and Kilimani, then message a host about your dog's needs.",
    neighborhoods: ["Karen", "Westlands", "Kilimani", "Lavington"],
  }),
  createCity({
    slug: "mombasa",
    name: "Mombasa",
    country: "Kenya",
    intro: "Browse dog boarding stays in Mombasa and connect with local hosts about your dog's routine, comfort, and care. Explore options around Nyali, Bamburi, and other neighborhoods.",
    neighborhoods: ["Nyali", "Bamburi", "Shanzu", "Mtwapa"],
  }),
  createCity({
    slug: "accra",
    name: "Accra",
    country: "Ghana",
    intro: "Explore dog boarding in Accra with hosts who can share details about their homes and the care they provide. Compare options across the city and discuss your dog's routine before booking.",
    neighborhoods: ["East Legon", "Osu", "Cantonments", "Labone"],
  }),
  createCity({
    slug: "cape-town",
    name: "Cape Town",
    country: "South Africa",
    intro: "Discover dog boarding in Cape Town with local hosts in neighborhoods from Sea Point to Constantia. Review each stay and ask about the daily routine that will keep your dog settled.",
    neighborhoods: ["Sea Point", "Gardens", "Claremont", "Constantia"],
  }),
  createCity({
    slug: "johannesburg",
    name: "Johannesburg",
    country: "South Africa",
    intro: "Find dog boarding in Johannesburg and compare local hosts by their home, services, and availability. Talk through your dog's care needs before selecting a stay.",
    neighborhoods: ["Rosebank", "Melville", "Parkhurst", "Sandton"],
  }),
  createCity({
    slug: "london",
    name: "London",
    country: "United Kingdom",
    intro: "Browse dog boarding in London with hosts across the city. Compare home environments, daily routines, and availability, then connect with a host about what helps your dog feel at home.",
    neighborhoods: ["Hackney", "Richmond", "Camden", "Greenwich"],
  }),
  createCity({
    slug: "manchester",
    name: "Manchester",
    country: "United Kingdom",
    intro: "Explore Manchester dog boarding with local hosts who can explain their home setup and care routine. Find a stay that fits your dog's needs and your travel dates.",
    neighborhoods: ["Didsbury", "Chorlton", "Ancoats", "Sale"],
  }),
  createCity({
    slug: "paris",
    name: "Paris",
    country: "France",
    intro: "Find dog boarding in Paris by browsing local hosts and the care they offer. Review each profile, check availability, and discuss your dog's routine before arranging a stay.",
    neighborhoods: ["Le Marais", "Montmartre", "Batignolles", "Bastille"],
  }),
  createCity({
    slug: "berlin",
    name: "Berlin",
    country: "Germany",
    intro: "Discover dog boarding in Berlin with hosts across the city. Compare the details of each home and get in touch to make sure the care is right for your dog.",
    neighborhoods: ["Kreuzberg", "Prenzlauer Berg", "Neukölln", "Charlottenburg"],
  }),
  createCity({
    slug: "toronto",
    name: "Toronto",
    country: "Canada",
    intro: "Browse dog boarding in Toronto and compare local hosts by home setting, services, and availability. Message a host to share your dog's care notes before booking.",
    neighborhoods: ["The Annex", "Leslieville", "High Park", "North York"],
  }),
  createCity({
    slug: "vancouver",
    name: "Vancouver",
    country: "Canada",
    intro: "Find dog boarding in Vancouver with local hosts throughout the city. Review their home and care details, then discuss your dog's needs and schedule directly.",
    neighborhoods: ["Kitsilano", "Mount Pleasant", "Commercial Drive", "West End"],
  }),
  createCity({
    slug: "sao-paulo",
    name: "São Paulo",
    country: "Brazil",
    intro: "Explore dog boarding in São Paulo with hosts who can share their home's setup and daily routine. Compare local options and discuss the right fit for your dog.",
    neighborhoods: ["Pinheiros", "Vila Madalena", "Moema", "Jardins"],
  }),
  createCity({
    slug: "mexico-city",
    name: "Mexico City",
    country: "Mexico",
    intro: "Browse dog boarding in Mexico City and connect with local hosts about your dog's routine, care, and stay dates. Compare profiles to find a welcoming fit.",
    neighborhoods: ["Roma Norte", "Condesa", "Polanco", "Coyoacán"],
  }),
  createCity({
    slug: "dubai",
    name: "Dubai",
    country: "United Arab Emirates",
    intro: "Find dog boarding in Dubai with hosts who can explain their home environment and care routine. Check each listing's services and availability, then message about your dog's needs.",
    neighborhoods: ["Jumeirah", "Dubai Marina", "Al Barsha", "Downtown Dubai"],
  }),
  createCity({
    slug: "singapore",
    name: "Singapore",
    country: "Singapore",
    intro: "Explore dog boarding in Singapore with local hosts across the island. Compare home details and daily care, and talk with a host about your dog's routine before booking.",
    neighborhoods: ["Tiong Bahru", "Holland Village", "Katong", "Bukit Timah"],
  }),
  createCity({
    slug: "tokyo",
    name: "Tokyo",
    country: "Japan",
    intro: "Browse dog boarding in Tokyo and find local hosts whose home and care routine suit your dog. Review the listing details and connect before choosing a stay.",
    neighborhoods: ["Shibuya", "Setagaya", "Meguro", "Nakameguro"],
  }),
  createCity({
    slug: "sydney",
    name: "Sydney",
    country: "Australia",
    intro: "Find dog boarding in Sydney with local hosts across the city. Compare their home environments, care routines, and availability, then discuss your dog's needs before booking.",
    neighborhoods: ["Newtown", "Surry Hills", "Bondi", "Parramatta"],
  }),
  createCity({
    slug: "melbourne",
    name: "Melbourne",
    country: "Australia",
    intro: "Explore dog boarding in Melbourne and compare local hosts by the care and home setting they offer. Check dates and message a host about your dog's routine.",
    neighborhoods: ["Fitzroy", "Carlton", "Brunswick", "South Yarra"],
  }),
  createCity({
    slug: "auckland",
    name: "Auckland",
    country: "New Zealand",
    intro: "Browse dog boarding in Auckland with hosts around the city. Review each listing's home and services, and connect with a host to find a comfortable match for your dog.",
    neighborhoods: ["Ponsonby", "Mount Eden", "Grey Lynn", "Devonport"],
  }),
];

export const getCityBySlug = (slug?: string) =>
  CITIES.find((city) => city.slug === slug?.toLowerCase());