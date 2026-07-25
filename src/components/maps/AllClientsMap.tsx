import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPin, Navigation, Phone, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// --- palette (deterministic per tech index) -------------------------------

const TECH_PALETTE = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#ca8a04', // amber
  '#9333ea', // purple
  '#0891b2', // cyan
  '#db2777', // pink
  '#ea580c', // orange
  '#4d7c0f', // olive
  '#0f766e', // teal
  '#7c3aed', // violet
  '#b91c1c', // dark red
];
const UNASSIGNED_COLOR = '#6b7280'; // gray

// --- address helpers (small, focused subset) -----------------------------

function s(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
function first(...vals: unknown[]): string {
  for (const v of vals) {
    const t = s(v);
    if (t) return t;
  }
  return '';
}
function fromParts(src: any): string {
  if (!src) return '';
  const street = first(src.street_address, src.address_line1, src.street);
  const city = first(src.city);
  const state = first(src.state);
  const zip = first(src.zip_code, src.zip, src.postal_code);
  const stateZip = [state, zip].filter(Boolean).join(' ');
  const cityStateZip = [city, stateZip].filter(Boolean).join(', ');
  return [street, cityStateZip].filter(Boolean).join(', ');
}
function bestAddress(client: any, linkedUser?: any): string {
  const candidates = [
    client?.contact_address,
    client?.service_address,
    client?.address,
    fromParts(client),
    linkedUser?.address,
    fromParts(linkedUser),
  ]
    .map(s)
    .filter(Boolean);
  // pick the longest / most complete
  candidates.sort((a, b) => {
    const sa = /\b[A-Z]{2}\s+\d{5}/i.test(a) ? 1 : 0;
    const sb = /\b[A-Z]{2}\s+\d{5}/i.test(b) ? 1 : 0;
    if (sa !== sb) return sb - sa;
    return b.length - a.length;
  });
  return candidates[0] || '';
}
function looksComplete(addr: string): boolean {
  return /,\s*[^,]+,\s*[A-Z]{2}\s+\d{5}/i.test(addr);
}

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&countrycodes=us&limit=1&q=${encodeURIComponent(
        address
      )}`
    );
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

// Persist geocode cache across mounts to avoid re-hitting Nominatim.
const GEOCODE_CACHE_KEY = 'aqua_geocode_cache_v1';
function loadCache(): Record<string, { lat: number; lng: number }> {
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveCache(cache: Record<string, { lat: number; lng: number }>) {
  try {
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore quota */
  }
}

// --- marker icon builder --------------------------------------------------

function coloredIcon(color: string, highlight = false): L.DivIcon {
  const size = highlight ? 34 : 26;
  const ring = highlight ? '4px solid #ffffff' : '2px solid #ffffff';
  const shadow = highlight
    ? '0 0 0 3px rgba(0,0,0,0.35), 0 3px 8px rgba(0,0,0,0.4)'
    : '0 2px 5px rgba(0,0,0,0.35)';
  return L.divIcon({
    className: 'aqua-tech-marker',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:${ring};box-shadow:${shadow};
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    const bounds = L.latLngBounds(positions.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [positions, map]);
  return null;
}

// --- types ----------------------------------------------------------------

export interface AllClientsMapClient {
  id: string;
  customer: string;
  assigned_technician_id?: string | null;
  contact_address?: string | null;
  service_address?: string | null;
  address?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  contact_phone?: string | null;
  phone?: string | null;
  pool_size?: number | null;
  pool_type?: string | null;
  user_id?: string | null;
  [key: string]: any;
}

export interface TechnicianOption {
  id: string;
  name: string;
}

interface AllClientsMapProps {
  clients: AllClientsMapClient[];
  technicians: TechnicianOption[];
  currentTechId?: string;
  showAdminFilter?: boolean;
  title?: string;
  description?: string;
}

interface PinnedClient {
  id: string;
  customer: string;
  address: string;
  phone?: string;
  lat: number;
  lng: number;
  pool_size?: number;
  pool_type?: string;
  assigned_technician_id?: string | null;
  secondary_technician_id?: string | null;

}

export function AllClientsMap({
  clients,
  technicians,
  currentTechId,
  showAdminFilter = false,
  title = 'All Clients Map',
  description = 'Every client pinned by assigned technician',
}: AllClientsMapProps) {
  const [linkedUsers, setLinkedUsers] = useState<Record<string, any>>({});
  const [pinned, setPinned] = useState<PinnedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [filterTechId, setFilterTechId] = useState<string>('all');

  // color per tech id, stable by tech order
  const techColor = useMemo(() => {
    const map: Record<string, string> = {};
    technicians.forEach((t, i) => {
      map[t.id] = TECH_PALETTE[i % TECH_PALETTE.length];
    });
    return map;
  }, [technicians]);

  const techName = useMemo(() => {
    const map: Record<string, string> = {};
    technicians.forEach((t) => (map[t.id] = t.name));
    return map;
  }, [technicians]);

  // fetch linked user addresses for clients missing their own address
  useEffect(() => {
    let cancelled = false;
    const ids = Array.from(
      new Set(
        clients
          .filter((c) => !bestAddress(c) && s(c.user_id))
          .map((c) => c.user_id as string)
      )
    );
    if (ids.length === 0) {
      setLinkedUsers({});
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('id, address, street_address, city, state, zip_code, phone')
        .in('id', ids);
      if (cancelled) return;
      setLinkedUsers(Object.fromEntries((data || []).map((u: any) => [u.id, u])));
    })();
    return () => {
      cancelled = true;
    };
  }, [clients]);

  // Build the address-resolved list once inputs are stable
  const addressed = useMemo(() => {
    return clients
      .map((c) => {
        const linked = c.user_id ? linkedUsers[c.user_id] : undefined;
        const address = bestAddress(c, linked);
        return { c, address, phone: first(c.contact_phone, c.phone, linked?.phone) };
      })
      .filter((x) => looksComplete(x.address));
  }, [clients, linkedUsers]);

  // geocode with cache
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const cache = loadCache();
      const out: PinnedClient[] = [];
      setProgress({ done: 0, total: addressed.length });

      for (let i = 0; i < addressed.length; i++) {
        const { c, address, phone } = addressed[i];
        let coords = cache[address];
        if (!coords) {
          const g = await geocode(address);
          if (g) {
            coords = g;
            cache[address] = g;
            saveCache(cache);
          }
          // Nominatim rate limit
          await new Promise((r) => setTimeout(r, 1100));
          if (cancelled) return;
        }
        if (coords) {
          out.push({
            id: c.id,
            customer: c.customer,
            address,
            phone: phone || undefined,
            lat: coords.lat,
            lng: coords.lng,
            pool_size: c.pool_size ?? undefined,
            pool_type: c.pool_type ?? undefined,
            assigned_technician_id: c.assigned_technician_id ?? null,
            secondary_technician_id: c.secondary_technician_id ?? null,

          });
        }
        setProgress({ done: i + 1, total: addressed.length });
      }

      if (!cancelled) {
        setPinned(out);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addressed]);

  // legend counts (using ALL pinned, regardless of filter)
  const legend = useMemo(() => {
    const counts: Record<string, number> = {};
    let unassigned = 0;
    pinned.forEach((p) => {
      if (p.assigned_technician_id) {
        counts[p.assigned_technician_id] = (counts[p.assigned_technician_id] || 0) + 1;
      } else {
        unassigned++;
      }
    });
    const rows = technicians
      .filter((t) => counts[t.id])
      .map((t) => ({
        id: t.id,
        name: t.name,
        color: techColor[t.id],
        count: counts[t.id],
      }));
    // put the current tech first for their view
    if (currentTechId) {
      rows.sort((a, b) => (a.id === currentTechId ? -1 : b.id === currentTechId ? 1 : 0));
    }
    if (unassigned > 0) {
      rows.push({ id: '__unassigned__', name: 'Unassigned', color: UNASSIGNED_COLOR, count: unassigned });
    }
    return rows;
  }, [pinned, technicians, techColor, currentTechId]);

  const visible = useMemo(() => {
    if (filterTechId === 'all') return pinned;
    if (filterTechId === '__unassigned__') return pinned.filter((p) => !p.assigned_technician_id);
    return pinned.filter((p) => p.assigned_technician_id === filterTechId);
  }, [pinned, filterTechId]);

  const positions = useMemo<[number, number][]>(
    () => visible.map((p) => [p.lat, p.lng]),
    [visible]
  );

  const defaultCenter: [number, number] =
    positions.length > 0
      ? [
          positions.reduce((sum, p) => sum + p[0], 0) / positions.length,
          positions.reduce((sum, p) => sum + p[1], 0) / positions.length,
        ]
      : [39.8283, -98.5795];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {showAdminFilter && technicians.length > 0 && (
            <div className="w-56">
              <Select value={filterTechId} onValueChange={setFilterTechId}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by technician" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All technicians</SelectItem>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Locating clients… {progress.done}/{progress.total}
          </div>
        )}

        {pinned.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No client addresses could be mapped yet. Add or fix addresses in each client's profile,
            then reload.
          </p>
        ) : (
          <div className="rounded-md overflow-hidden border" style={{ height: 480 }}>
            <MapContainer
              center={defaultCenter}
              zoom={11}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds positions={positions} />
              <MarkerClusterGroup chunkedLoading spiderfyOnMaxZoom>
                {visible.map((p) => {
                  const color = p.assigned_technician_id
                    ? techColor[p.assigned_technician_id] || UNASSIGNED_COLOR
                    : UNASSIGNED_COLOR;
                  const highlight =
                    !!currentTechId && p.assigned_technician_id === currentTechId;
                  const assignedName = p.assigned_technician_id
                    ? techName[p.assigned_technician_id] || 'Unknown'
                    : 'Unassigned';
                  const mapsHref = /iPhone|iPad|iPod|Macintosh/i.test(
                    typeof navigator !== 'undefined' ? navigator.userAgent : ''
                  )
                    ? `https://maps.apple.com/?daddr=${encodeURIComponent(p.address)}`
                    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.address)}`;
                  return (
                    <Marker key={p.id} position={[p.lat, p.lng]} icon={coloredIcon(color, highlight)}>
                      <Popup>
                        <div className="space-y-1 text-sm">
                          <p className="font-semibold">{p.customer}</p>
                          <p className="text-muted-foreground">{p.address}</p>
                          {(p.pool_size || p.pool_type) && (
                            <p className="text-muted-foreground">
                              Pool: {p.pool_size?.toLocaleString()} gal
                              {p.pool_type ? `, ${p.pool_type}` : ''}
                            </p>
                          )}
                          <p>
                            <span
                              className="inline-block rounded-full mr-1"
                              style={{
                                width: 10,
                                height: 10,
                                background: color,
                                verticalAlign: 'middle',
                              }}
                            />
                            {assignedName}
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/admin/clients/${p.id}`}>Details</Link>
                            </Button>
                            {p.phone && (
                              <Button size="sm" variant="outline" asChild>
                                <a href={`tel:${p.phone}`}>
                                  <Phone className="h-3 w-3 mr-1" />
                                  Call
                                </a>
                              </Button>
                            )}
                            <Button size="sm" asChild>
                              <a href={mapsHref} target="_blank" rel="noopener noreferrer">
                                <Navigation className="h-3 w-3 mr-1" />
                                Navigate
                              </a>
                            </Button>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MarkerClusterGroup>
            </MapContainer>
          </div>
        )}

        {legend.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => setFilterTechId('all')}
              className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                filterTechId === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              All ({pinned.length})
            </button>
            {legend.map((row) => {
              const active = filterTechId === row.id;
              const isMe = row.id === currentTechId;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setFilterTechId(active ? 'all' : row.id)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors flex items-center gap-1.5 ${
                    active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                  title={isMe ? 'You' : row.name}
                >
                  <span
                    className="inline-block rounded-full"
                    style={{ width: 10, height: 10, background: row.color }}
                  />
                  {row.name}
                  {isMe && ' (you)'}
                  <span className="opacity-70">· {row.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
