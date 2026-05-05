import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, MapPin, RefreshCw } from 'lucide-react';
import { adminApi } from '../../api/client';

// Fix Leaflet's default icon paths broken by bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Status colours ────────────────────────────────────────────
const STATUS_CONFIG = {
  active:          { color: '#22c55e', label: 'Active'          },
  inactive:        { color: '#f97316', label: 'Inactive'        },
  pending_payment: { color: '#eab308', label: 'Pending Payment' },
  suspended:       { color: '#6b7280', label: 'Suspended'       },
  expired:         { color: '#ef4444', label: 'Expired'         },
};

function colorForShop(shop) {
  if (shop.activation_status === 'inactive') return STATUS_CONFIG.inactive.color;
  return (STATUS_CONFIG[shop.subscription_status] || STATUS_CONFIG.suspended).color;
}

function labelForShop(shop) {
  if (shop.activation_status === 'inactive') return STATUS_CONFIG.inactive.label;
  return (STATUS_CONFIG[shop.subscription_status] || STATUS_CONFIG.suspended).label;
}

function makeIcon(color) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z"
            fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="5" fill="white" opacity="0.85"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -38],
  });
}

// ── Google Maps URL → lat/lng parser ─────────────────────────
// Handles formats:
//   maps.google.com/maps?q=6.9271,79.8612
//   google.com/maps/place/.../@6.9271,79.8612,15z
//   goo.gl/maps/... (no coords — skipped)
//   maps.app.goo.gl/... (no coords — skipped)
function parseGoogleMapsUrl(url) {
  if (!url) return null;

  // @lat,lng,zoom pattern (share links)
  let m = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };

  // ?q=lat,lng
  m = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };

  // ll=lat,lng
  m = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };

  // saddr / daddr
  m = url.match(/(?:saddr|daddr)=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };

  return null;
}

// Augment shop with parsed coords (prefer stored lat/lng, fall back to URL parse)
function withCoords(shop) {
  const lat = parseFloat(shop.location_lat);
  const lng = parseFloat(shop.location_lng);
  if (!isNaN(lat) && !isNaN(lng)) return { ...shop, lat, lng };

  const parsed = parseGoogleMapsUrl(shop.location_map_url);
  if (parsed) return { ...shop, lat: parsed.lat, lng: parsed.lng };

  return null; // no location data
}

// Keeps map bounds fitted to visible markers
function BoundsFitter({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [points, map]);
  return null;
}

// ── Sri Lanka districts (for filter dropdown) ─────────────────
const SL_DISTRICTS = [
  'Ampara','Anuradhapura','Badulla','Batticaloa','Colombo',
  'Galle','Gampaha','Hambantota','Jaffna','Kalutara',
  'Kandy','Kegalle','Kilinochchi','Kurunegala','Mannar',
  'Matale','Matara','Monaragala','Mullaitivu','Nuwara Eliya',
  'Polonnaruwa','Puttalam','Ratnapura','Trincomalee','Vavuniya',
];

// ── Main component ────────────────────────────────────────────
export default function ShopMapTab() {
  const [shops,   setShops]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // Filters
  const [filterStatus,   setFilterStatus]   = useState('all');
  const [filterAgent,    setFilterAgent]     = useState('all');
  const [filterDistrict, setFilterDistrict]  = useState('all');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await adminApi.shopsMapData();
      setShops(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to load shop data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // All shops enriched with parsed coordinates
  const shopsWithCoords = useMemo(() => shops.map(withCoords).filter(Boolean), [shops]);
  const shopsNoCoords   = useMemo(() => shops.filter((s) => !withCoords(s)), [shops]);

  // Unique agents for filter dropdown
  const agents = useMemo(() => {
    const seen = new Map();
    shops.forEach((s) => { if (s.agent_id) seen.set(s.agent_id, s.agent_name); });
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [shops]);

  // Apply filters
  const visible = useMemo(() => shopsWithCoords.filter((s) => {
    if (filterStatus !== 'all') {
      const eff = s.activation_status === 'inactive' ? 'inactive' : s.subscription_status;
      if (eff !== filterStatus) return false;
    }
    if (filterAgent !== 'all' && String(s.agent_id) !== filterAgent) return false;
    if (filterDistrict !== 'all') {
      const d = (s.district || s.agent_district || '').toLowerCase();
      if (!d.includes(filterDistrict.toLowerCase())) return false;
    }
    return true;
  }), [shopsWithCoords, filterStatus, filterAgent, filterDistrict]);

  // Status counts for legend
  const counts = useMemo(() => {
    const c = {};
    shopsWithCoords.forEach((s) => {
      const k = s.activation_status === 'inactive' ? 'inactive' : (s.subscription_status || 'suspended');
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  }, [shopsWithCoords]);

  const SL_CENTER = [7.8731, 80.7718];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white">Shop Distribution Map</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {shopsWithCoords.length} shops plotted · {shopsNoCoords.length} missing location
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded-lg disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive (awaiting payment)</option>
          <option value="pending_payment">Pending Payment</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
        </select>

        <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}
          className="bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          <option value="all">All Agents</option>
          {agents.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>

        <select value={filterDistrict} onChange={(e) => setFilterDistrict(e.target.value)}
          className="bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          <option value="all">All Districts</option>
          {SL_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        {(filterStatus !== 'all' || filterAgent !== 'all' || filterDistrict !== 'all') && (
          <button
            onClick={() => { setFilterStatus('all'); setFilterAgent('all'); setFilterDistrict('all'); }}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg">
            Clear filters
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, { color, label }]) => (
          counts[key] ? (
            <div key={key} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-400">{label} ({counts[key]})</span>
            </div>
          ) : null
        ))}
        {shopsNoCoords.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-gray-600 shrink-0" />
            <span className="text-xs text-gray-500">No location ({shopsNoCoords.length})</span>
          </div>
        )}
      </div>

      {/* Map */}
      {loading ? (
        <div className="h-[520px] rounded-2xl bg-gray-800 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        </div>
      ) : error ? (
        <div className="h-[520px] rounded-2xl bg-gray-800 flex items-center justify-center text-red-400 text-sm">
          {error}
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border border-gray-700 h-[520px]">
          <MapContainer
            center={SL_CENTER}
            zoom={7}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <BoundsFitter points={visible} />
            {visible.map((shop) => (
              <Marker
                key={shop.id}
                position={[shop.lat, shop.lng]}
                icon={makeIcon(colorForShop(shop))}
              >
                <Popup maxWidth={240}>
                  <div className="text-sm space-y-1 py-1">
                    <p className="font-bold text-gray-900 leading-tight">{shop.name}</p>
                    {shop.shop_reference_id && (
                      <p className="text-xs font-mono text-gray-500">{shop.shop_reference_id}</p>
                    )}
                    <p className="text-xs text-gray-600">Owner: {shop.owner_name}</p>
                    {shop.agent_name && (
                      <p className="text-xs text-indigo-700 font-medium">Agent: {shop.agent_name}</p>
                    )}
                    {shop.district && (
                      <p className="text-xs text-gray-500">District: {shop.district}</p>
                    )}
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: colorForShop(shop) }} />
                      <span className="text-xs font-medium" style={{ color: colorForShop(shop) }}>
                        {labelForShop(shop)}
                      </span>
                    </div>
                    {shop.location_map_url && (
                      <a href={shop.location_map_url} target="_blank" rel="noreferrer"
                        className="text-xs text-blue-600 underline block pt-0.5">
                        Open in Google Maps ↗
                      </a>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* Shops without location */}
      {shopsNoCoords.length > 0 && (
        <details className="bg-gray-800 rounded-xl p-4">
          <summary className="text-xs text-gray-400 cursor-pointer select-none">
            {shopsNoCoords.length} shop{shopsNoCoords.length > 1 ? 's' : ''} not shown (no location data)
          </summary>
          <div className="mt-3 space-y-1">
            {shopsNoCoords.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs text-gray-500">
                <span>{s.name}</span>
                <span className="text-gray-600">{s.agent_name || '—'}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
