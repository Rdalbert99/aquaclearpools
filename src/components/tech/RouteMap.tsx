import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import { Button } from '@/components/ui/button';
import { Navigation, Phone, GripVertical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { formatAddress, normalizeAddressInput, type AddressComponents } from '@/lib/address-validation';

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

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return '';
}

function singleRelation(value: unknown): any {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeAddressText(value: unknown): string {
  const text = cleanText(value)
    .replace(/\bUnited States(?: of America)?\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,+/g, ',')
    .replace(/,+\s*$/g, '')
    .trim();

  if (!text) return '';

  const stateZipAtEnd = text.match(/^(.*?)(?:,\s*)?([^,]+?),\s*([A-Za-z]{2}),?\s*(\d{5}(?:-\d{4})?)$/);
  if (stateZipAtEnd) {
    const [, streetPart, cityPart, statePart, zipPart] = stateZipAtEnd;
    const city = cityPart.trim();
    const state = statePart.toUpperCase();
    const zip = zipPart.trim();
    const street = stripTrailingLocation(streetPart, city, state, zip);
    return [street, city, `${state} ${zip}`].filter(Boolean).join(', ');
  }

  const cityZipAtEnd = text.match(/^(.*?)(?:,\s*)?([^,]+?),\s*(\d{5}(?:-\d{4})?)$/);
  if (cityZipAtEnd) {
    const [, streetPart, cityPart, zipPart] = cityZipAtEnd;
    const stateMatch = streetPart.match(/\b([A-Za-z]{2})\s+\d{5}(?:-\d{4})?\b/);
    const city = cityPart.trim();
    const state = stateMatch?.[1]?.toUpperCase() || '';
    const street = stripTrailingLocation(streetPart, city, state, zipPart);
    return [street, city, [state, zipPart].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  }

  return text;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripTrailingLocation(streetPart: string, city: string, state: string, zip: string): string {
  let street = cleanText(streetPart);
  const cityPattern = city ? escapeRegex(city) : '';
  const statePattern = state ? escapeRegex(state) : '[A-Za-z]{2}';
  const zipPattern = zip ? escapeRegex(zip) : '\\d{5}(?:-\\d{4})?';

  const patterns = [
    cityPattern && new RegExp(`\\b${cityPattern}\\s+${statePattern}\\s+${zipPattern}$`, 'i'),
    cityPattern && new RegExp(`\\b${cityPattern}\\s+${statePattern}$`, 'i'),
    new RegExp(`\\b${statePattern}\\s+${zipPattern}$`, 'i'),
    cityPattern && new RegExp(`\\b${cityPattern}$`, 'i'),
  ].filter(Boolean) as RegExp[];

  for (const pattern of patterns) {
    street = street.replace(pattern, '').replace(/[,\s]+$/g, '').trim();
  }

  return street;
}

function addressCompletenessScore(address: string): number {
  const text = normalizeAddressText(address);
  if (!text) return 0;
  let score = 1;
  if (/\d/.test(text)) score += 1;
  if (/,/.test(text)) score += 1;
  if (/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/i.test(text)) score += 3;
  if (/\b\d{5}(?:-\d{4})?\b/.test(text)) score += 1;
  return score;
}

function isCompleteRouteAddress(address: string): boolean {
  const text = normalizeAddressText(address);
  return /,\s*[^,]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/i.test(text);
}

function bestAddress(...values: unknown[]): string {
  return values
    .map(normalizeAddressText)
    .filter(Boolean)
    .sort((a, b) => addressCompletenessScore(b) - addressCompletenessScore(a) || b.length - a.length)[0] || '';
}

function clientRecordId(client: any): string {
  const nestedClient = singleRelation(client?.clients);
  return firstText(nestedClient?.id, client?.client_id, client?.id);
}

function fullAddressFromParts(source: any): string {
  if (!source) return '';
  const street = firstText(source.street_address, source.address_line1, source.street, source.line1);
  const city = firstText(source.city);
  const state = firstText(source.state);
  const zip = firstText(source.zip_code, source.zip, source.postal_code);
  const stateZip = [state, zip].filter(Boolean).join(' ');
  const cityStateZip = [city, stateZip].filter(Boolean).join(', ');
  return normalizeAddressText([street, cityStateZip].filter(Boolean).join(', '));
}

function relatedUserFor(client: any, linkedUsers: Record<string, any> = {}): any {
  return singleRelation(client?.client_user) || singleRelation(client?.users) || singleRelation(client?.user) || linkedUsers[client?.user_id];
}

function addressFor(client: any, linkedUsers: Record<string, any> = {}): string {
  const relatedUser = relatedUserFor(client, linkedUsers);
  const nestedClient = singleRelation(client?.clients);
  return bestAddress(
    client?.contact_address,
    client?.contactAddress,
    client?.service_address,
    client?.serviceAddress,
    client?.address,
    client?.formatted_address,
    client?.formattedAddress,
    fullAddressFromParts(client),
    nestedClient?.contact_address,
    nestedClient?.contactAddress,
    nestedClient?.service_address,
    fullAddressFromParts(nestedClient),
    relatedUser?.address,
    relatedUser?.formatted_address,
    fullAddressFromParts(relatedUser)
  );
}

function phoneFor(client: any, linkedUsers: Record<string, any> = {}): string | undefined {
  const relatedUser = relatedUserFor(client, linkedUsers);
  const nestedClient = singleRelation(client?.clients);
  return firstText(client?.contact_phone, client?.phone, nestedClient?.contact_phone, relatedUser?.phone) || undefined;
}

function customerFor(client: any): string {
  const nestedClient = singleRelation(client?.clients);
  return firstText(client?.customer, client?.contact_name, nestedClient?.customer, 'Customer');
}

function routeClientFor(client: any, linkedUsers: Record<string, any> = {}): ClientWithCoords | null {
  const address = addressFor(client, linkedUsers);
  if (!address) return null;
  const nestedClient = singleRelation(client?.clients);
  const id = clientRecordId(client);
  return {
    id: id || client.id,
    customer: customerFor(client),
    address,
    phone: phoneFor(client, linkedUsers),
    lat: 0,
    lng: 0,
    pool_size: client.pool_size ?? nestedClient?.pool_size,
    pool_type: client.pool_type ?? nestedClient?.pool_type,
    last_service_date: client.last_service_date ?? nestedClient?.last_service_date,
  };
}

// Geocode an address using Nominatim (free, no API key)
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const candidates = Array.from(new Set([
      normalizeAddressText(address),
      address,
    ].filter(Boolean)));

    for (const candidate of candidates) {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&countrycodes=us&q=${encodeURIComponent(candidate)}&limit=1`
      );
      const data = await res.json();
      if (data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
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
  const { user } = useAuth();
  const [geocodedClients, setGeocodedClients] = useState<ClientWithCoords[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedCount, setFailedCount] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [linkedUsers, setLinkedUsers] = useState<Record<string, any>>({});
  const [fetchedClients, setFetchedClients] = useState<any[]>([]);
  const [addressOverrides, setAddressOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const missingAddressIds = Array.from(new Set(
      clients
        .filter(client => !isCompleteRouteAddress(addressFor(client)) && clientRecordId(client))
        .map(clientRecordId)
    ));

    async function loadFullClientRecords() {
      let query = supabase
        .from('clients')
        .select(`
          *,
          client_user:users!clients_user_id_fkey(name, phone, email, address, street_address, city, state, zip_code)
        `);

      if (missingAddressIds.length > 0) {
        query = query.in('id', missingAddressIds);
      } else if (clients.length === 0 && user?.id) {
        query = query.eq('assigned_technician_id', user.id);
      } else {
        setFetchedClients([]);
        return;
      }

      const { data, error } = await query;
      if (cancelled) return;
      setFetchedClients(error || !data ? [] : data);
    }

    loadFullClientRecords();
    return () => { cancelled = true; };
  }, [clients, user?.id]);

  const sourceClients = useMemo(() => {
    const applyOverrides = (items: any[]) => items.map(client => {
      const id = clientRecordId(client);
      const override = id ? addressOverrides[id] : '';
      return override ? { ...client, contact_address: normalizeAddressInput(override) } : client;
    });

    if (fetchedClients.length === 0) return applyOverrides(clients);
    const fetchedById = new Map(fetchedClients.map(client => [client.id, client]));
    const merged = clients.map(client => {
      const id = clientRecordId(client);
      if (!id || isCompleteRouteAddress(addressFor(client))) return client;
      return fetchedById.get(id) || client;
    });
    return applyOverrides(merged.length > 0 ? merged : fetchedClients);
  }, [clients, fetchedClients, addressOverrides]);

  const handleAddressSelect = (clientId: string, components: AddressComponents) => {
    setAddressOverrides(prev => ({ ...prev, [clientId]: formatAddress(components) }));
  };

  const handleAddressInput = (clientId: string, value: string) => {
    setAddressOverrides(prev => ({ ...prev, [clientId]: value }));
  };

  useEffect(() => {
    let cancelled = false;
    const missingUserIds = Array.from(new Set(
      sourceClients
        .filter(client => !addressFor(client) && cleanText(client?.user_id))
        .map(client => client.user_id as string)
    ));

    if (missingUserIds.length === 0) {
      setLinkedUsers({});
      return;
    }

    async function loadLinkedUserAddresses() {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, phone, address, street_address, city, state, zip_code')
        .in('id', missingUserIds);

      if (cancelled) return;
      if (error || !data) {
        setLinkedUsers({});
        return;
      }

      setLinkedUsers(
        Object.fromEntries(data.map(user => [user.id, user]))
      );
    }

    loadLinkedUserAddresses();
    return () => { cancelled = true; };
  }, [sourceClients]);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const updated = [...geocodedClients];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setGeocodedClients(updated);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // Build a fallback list (no coords) so we always have something to show
  const fallbackList = useMemo<ClientWithCoords[]>(
    () =>
      sourceClients
        .map((client) => routeClientFor(client, linkedUsers))
        .filter(Boolean) as ClientWithCoords[],
    [sourceClients, linkedUsers]
  );

  useEffect(() => {
    let cancelled = false;

    async function geocodeAll() {
      setLoading(true);
      const results: ClientWithCoords[] = [];
      let failed = 0;

      for (const client of sourceClients) {
        const routeClient = routeClientFor(client, linkedUsers);
        if (!routeClient) {
          failed++;
          continue;
        }

        const coords = await geocodeAddress(routeClient.address);
        if (cancelled) return;
        if (coords) {
          results.push({
            ...routeClient,
            lat: coords.lat,
            lng: coords.lng,
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
  }, [sourceClients, linkedUsers]);

  const positions = useMemo<[number, number][]>(
    () => geocodedClients.map(c => [c.lat, c.lng]),
    [geocodedClients]
  );

  // Default center (US center) if no clients
  const defaultCenter: [number, number] = positions.length > 0
    ? [positions.reduce((s, p) => s + p[0], 0) / positions.length,
       positions.reduce((s, p) => s + p[1], 0) / positions.length]
    : [39.8283, -98.5795];

  // Which list to show in the sidebar: geocoded (with map) or fallback (list only)
  const displayList = geocodedClients.length > 0 ? geocodedClients : fallbackList;
  const missingAddressClients = sourceClients.filter(client => !isCompleteRouteAddress(addressFor(client, linkedUsers)));
  const routeReadyList = displayList.filter(client => isCompleteRouteAddress(client.address));

  const renderAddressReview = () => (
    <div className="space-y-3 rounded-lg border p-3">
      <div>
        <h4 className="font-semibold text-sm">Address check</h4>
        <p className="text-xs text-muted-foreground">Select or enter the full street, city, state, and ZIP before opening the route.</p>
      </div>
      {missingAddressClients.map((client) => {
        const id = clientRecordId(client);
        if (!id) return null;
        const currentAddress = addressOverrides[id] || addressFor(client, linkedUsers);
        return (
          <div key={id} className="space-y-2">
            <p className="font-medium text-sm">{customerFor(client)}</p>
            <AddressAutocomplete
              label="Full service address"
              value={currentAddress}
              placeholder="Street, city, state, ZIP"
              onInputChange={(value) => handleAddressInput(id, value)}
              onAddressSelect={(components) => handleAddressSelect(id, components)}
            />
          </div>
        );
      })}
    </div>
  );

  // Build a multi-stop route URL for Apple Maps (falls back to Google Maps).
  // Apple Maps supports daddr chained with "+to:" between stops, and saddr=Current+Location.
  const buildAppleMapsRouteUrl = (stops: ClientWithCoords[]) => {
    if (stops.length === 0) return '#';
    const daddr = stops.map(s => encodeURIComponent(s.address)).join('+to:');
    return `https://maps.apple.com/?saddr=Current+Location&daddr=${daddr}`;
  };
  const buildGoogleMapsRouteUrl = (stops: ClientWithCoords[]) => {
    if (stops.length === 0) return '#';
    const destination = encodeURIComponent(stops[stops.length - 1].address);
    const waypoints = stops.slice(0, -1).map(s => encodeURIComponent(s.address)).join('|');
    const wp = waypoints ? `&waypoints=${waypoints}` : '';
    return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${destination}${wp}`;
  };

  if (loading && geocodedClients.length === 0 && fallbackList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">
          Loading map... ({geocodedClients.length}/{sourceClients.length} clients located)
        </p>
      </div>
    );
  }

  if (displayList.length === 0) {
    return (
      <div className="space-y-4 py-6">
        <div className="text-center">
          <Navigation className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No client addresses could be mapped.</p>
          <p className="text-sm text-muted-foreground mt-1">
            {sourceClients.length > 0
              ? 'Review the missing addresses below, choose the suggested full address, then the route will build automatically.'
              : 'Make sure this route selection has clients assigned.'}
          </p>
        </div>

        {missingAddressClients.length > 0 && renderAddressReview()}
      </div>
    );
  }


  const hasCoords = geocodedClients.length > 0;

  return (
    <div className="space-y-3">
      {failedCount > 0 && (
        <p className="text-sm text-orange-500">
          {failedCount} client(s) couldn't be pinned on the map (address wasn't recognized), but they're still in the route list below.
        </p>
      )}

      {missingAddressClients.length > 0 && renderAddressReview()}

      {/* Full-route navigation buttons — routes from current location through every stop in order */}
      <div className="flex flex-wrap gap-2">
        <Button asChild className="flex-1 min-w-[160px]" disabled={routeReadyList.length === 0}>
          <a href={buildAppleMapsRouteUrl(routeReadyList)} target="_blank" rel="noopener noreferrer">
            <Navigation className="h-4 w-4 mr-2" />
            Open Route in Apple Maps
          </a>
        </Button>
        <Button asChild variant="outline" className="flex-1 min-w-[160px]" disabled={routeReadyList.length === 0}>
          <a href={buildGoogleMapsRouteUrl(routeReadyList)} target="_blank" rel="noopener noreferrer">
            <Navigation className="h-4 w-4 mr-2" />
            Open in Google Maps
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Routes from your current location through all {routeReadyList.length} ready stop{routeReadyList.length === 1 ? '' : 's'} in the order shown. Drag stops below to reorder.
      </p>

      {hasCoords && (
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
            <MarkerClusterGroup
              chunkedLoading
              spiderfyOnMaxZoom
              showCoverageOnHover={false}
              spiderfyDistanceMultiplier={1.6}
              maxClusterRadius={45}
            >
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
                      {client.last_service_date && (
                        <div className="text-xs text-gray-500">
                          Last service: {new Date(client.last_service_date).toLocaleDateString()}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1 pt-1">
                        <Link
                          to={`/admin/clients/${client.id}`}
                          className="inline-flex items-center text-xs bg-gray-100 hover:bg-gray-200 rounded px-2 py-1"
                        >
                          👤 Details
                        </Link>
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
            </MarkerClusterGroup>

          </MapContainer>
        </div>
      )}

      {/* Client list below map */}
      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Stop Order <span className="text-muted-foreground font-normal">(drag to reorder)</span></h4>
        {displayList.map((client, index) => (
          <div
            key={client.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
            className={`flex items-center justify-between p-2 border rounded-lg text-sm cursor-grab active:cursor-grabbing transition-colors ${
              dragOverIndex === index ? 'border-primary bg-primary/5' : ''
            } ${dragIndex === index ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center space-x-2">
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold text-xs flex-shrink-0">
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

