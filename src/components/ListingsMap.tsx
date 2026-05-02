import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface MapListing {
  id: string;
  title: string;
  image: string;
  price: number;
  location: string;
  latitude: number;
  longitude: number;
}

interface ListingsMapProps {
  listings: MapListing[];
  height?: number;
  /** Optional center to fit to (e.g. user search center). */
  center?: { lat: number; lng: number } | null;
}

const FitBounds = ({
  points,
}: {
  points: [number, number][];
}) => {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 12);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [points, map]);
  return null;
};

const ListingsMap = ({ listings, height = 480, center }: ListingsMapProps) => {
  const points = useMemo(
    () =>
      listings
        .filter((l) => l.latitude != null && l.longitude != null)
        .map((l) => [l.latitude, l.longitude] as [number, number]),
    [listings]
  );

  // Fallback center: provided center, first point, or US-ish center
  const initialCenter: [number, number] =
    center ? [center.lat, center.lng] : points[0] ?? [39.8, -98.5];

  return (
    <div
      className="rounded-2xl overflow-hidden border border-border"
      style={{ height }}
    >
      <MapContainer
        center={initialCenter}
        zoom={4}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png"
        />
        <FitBounds points={points} />
        {listings
          .filter((l) => l.latitude != null && l.longitude != null)
          .map((l) => (
            <Marker key={l.id} position={[l.latitude, l.longitude]} icon={markerIcon}>
              <Popup>
                <Link to={`/listing/${l.id}`} className="block w-44">
                  <img
                    src={l.image}
                    alt={l.title}
                    className="w-full h-24 object-cover rounded-md mb-2"
                  />
                  <p className="text-sm font-semibold leading-tight mb-1">{l.title}</p>
                  <p className="text-xs text-muted-foreground mb-1">{l.location}</p>
                  <p className="text-sm">
                    <span className="font-semibold">${l.price}</span>
                    <span className="text-muted-foreground"> / night</span>
                  </p>
                </Link>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
};

export default ListingsMap;
