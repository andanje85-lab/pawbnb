import { MapContainer, TileLayer, Marker, Circle } from "react-leaflet";
import L from "leaflet";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface LocationMapProps {
  lat: number;
  lng: number;
  /** When true, hides the precise pin and shows an approximate-area circle instead. */
  approximate?: boolean;
  height?: number;
}

const LocationMap = ({ lat, lng, approximate = false, height = 280 }: LocationMapProps) => {
  return (
    <div
      className="rounded-xl overflow-hidden border border-border"
      style={{ height }}
    >
      <MapContainer
        center={[lat, lng]}
        zoom={approximate ? 12 : 14}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png"
        />
        {approximate ? (
          <Circle
            center={[lat, lng]}
            radius={500}
            pathOptions={{ color: "hsl(var(--primary))", fillOpacity: 0.15 }}
          />
        ) : (
          <Marker position={[lat, lng]} icon={markerIcon} />
        )}
      </MapContainer>
    </div>
  );
};

export default LocationMap;
