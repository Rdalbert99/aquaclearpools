import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Navigation, Phone, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Numbered marker icon
function createNumberedIcon(num: number) {
  return L.divIcon({
    className: 'custom-numbered-marker',
    html: `<div style="
      background: hsl(221, 83%, 53%);
      color: white;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    ">${num}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

interface ClientWithCoords {
  id: string;
  customer: string;
  address: string;
  phone?: string;
  lat: number;
  lng: number;
  pool_size?: number;
  pool_type?: string;
  last_service_date?: string;
}

// Geocode an address using Nominatim (free, no API key)
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { 'User-Agent': 'AquaClearPools/1.0' } }
    );
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [positions, map]);
  return null;
}

interface RouteMapProps {
  clients: any[];
}

export function RouteMap({ clients }: RouteMapProps) {
  const [geocodedClients, setGeocodedClients] = useState<ClientWithCoords[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function geocodeAll() {
      setLoading(true);
      const results: ClientWithCoords[] = [];
      let failed = 0;

      for (const client of clients) {
        const address = client.contact_address || client.client_user?.address;
        if (!address) {
          failed++;
          continue;
        }

        const coords = await geocodeAddress(address);
        if (coords && !cancelled) {
          results.push({
            id: client.id,
            customer: client.customer,
            address,
            phone: client.contact_phone || client.client_user?.phone,
            lat: coords.lat,
            lng: coords.lng,
            pool_size: client.pool_size,
            pool_type: client.pool_type,
            last_service_date: client.last_service_date,
          });
        } else {
          failed++;
        }

        // Rate limit: Nominatim asks for max 1 req/sec
        await new Promise(r => setTimeout(r, 1100));
      }

      if (!cancelled) {
        setGeocodedClients(results);
        setFailedCount(failed);
        setLoading(false);
      }
    }

    geocodeAll();
    return () => { cancelled = true; };
  }, [clients]);

  const positions = useMemo<[number, number][]>(
    () => geocodedClients.map(c => [c.lat, c.lng]),
    [geocodedClients]
  );

  // Default center (US center) if no clients
  const defaultCenter: [number, number] = positions.length > 0
    ? [positions.reduce((s, p) => s + p[0], 0) / positions.length,
       positions.reduce((s, p) => s + p[1], 0) / positions.length]
    : [39.8283, -98.5795];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">
          Loading map... ({geocodedClients.length}/{clients.length} clients located)
        </p>
      </div>
    );
  }

  if (geocodedClients.length === 0) {
    return (
      <div className="text-center py-12">
        <Navigation className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No client addresses could be mapped.</p>
        <p className="text-sm text-muted-foreground mt-1">Make sure clients have addresses set.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {failedCount > 0 && (
        <p className="text-sm text-orange-500">
          {failedCount} client(s) couldn't be mapped (missing or invalid address).
        </p>
      )}

      <div className="rounded-lg overflow-hidden border" style={{ height: '500px' }}>
        <MapContainer
          center={defaultCenter}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds positions={positions} />
          {geocodedClients.map((client, index) => (
            <Marker
              key={client.id}
              position={[client.lat, client.lng]}
              icon={createNumberedIcon(index + 1)}
            >
              <Popup>
                <div className="space-y-2 min-w-[200px]">
                  <div className="font-semibold text-sm">{index + 1}. {client.customer}</div>
                  <div className="text-xs text-gray-600">{client.address}</div>
                  {client.pool_size && (
                    <div className="text-xs text-gray-500">
                      {client.pool_size.toLocaleString()} gal • {client.pool_type}
                    </div>
                  )}
                  <div className="flex gap-1 pt-1">
                    {client.phone && (
                      <a
                        href={`tel:${client.phone}`}
                        className="inline-flex items-center text-xs bg-gray-100 hover:bg-gray-200 rounded px-2 py-1"
                      >
                        📞 Call
                      </a>
                    )}
                    <a
                      href={`https://maps.apple.com/?daddr=${encodeURIComponent(client.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded px-2 py-1"
                    >
                      🧭 Navigate
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Client list below map */}
      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Stop Order</h4>
        {geocodedClients.map((client, index) => (
          <div key={client.id} className="flex items-center justify-between p-2 border rounded-lg text-sm">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold text-xs">
                {index + 1}
              </div>
              <div>
                <Link to={`/admin/clients/${client.id}`} className="font-medium hover:underline text-primary">
                  {client.customer}
                </Link>
                <p className="text-xs text-muted-foreground">{client.address}</p>
              </div>
            </div>
            <div className="flex space-x-1">
              {client.phone && (
                <Button size="sm" variant="outline" className="h-7" asChild>
                  <a href={`tel:${client.phone}`}>
                    <Phone className="h-3 w-3" />
                  </a>
                </Button>
              )}
              <Button size="sm" variant="default" className="h-7" asChild>
                <a
                  href={`https://maps.apple.com/?daddr=${encodeURIComponent(client.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Navigation className="h-3 w-3 mr-1" />
                  Go
                </a>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
