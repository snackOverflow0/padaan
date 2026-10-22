import type { Place } from "./data";
/* OpenStreetMap Nominatim: free, CORS-enabled geocoding (light personal use). */
const base = "https://nominatim.openstreetmap.org";
export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  const r = await fetch(`${base}/search?format=jsonv2&limit=6&countrycodes=ph&addressdetails=0&q=${encodeURIComponent(q)}`, { signal });
  if (!r.ok) throw new Error("search failed");
  return ((await r.json()) as any[]).map((x) => ({ name: String(x.display_name).split(",").slice(0, 3).join(",").trim(), lat: +x.lat, lng: +x.lon }));
}
export async function reverse(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(`${base}/reverse?format=jsonv2&zoom=14&lat=${lat}&lon=${lng}`);
    const j = await r.json();
    return String(j.display_name ?? "").split(",").slice(0, 2).join(",").trim() || "Dropped pin";
  } catch { return "Dropped pin"; }
}

/* Real road geometry from OpenStreetMap-based routing (OSRM), the same kind of road data Google Maps draws. */
export interface Road { pts: [number, number][]; km: number; min: number }
const SERVERS = {
  car: ["https://routing.openstreetmap.de/routed-car/route/v1/driving", "https://router.project-osrm.org/route/v1/driving"],
  foot: ["https://routing.openstreetmap.de/routed-foot/route/v1/driving"],
};
const roads = new Map<string, Promise<Road | null>>();
async function fetchRoad(a: { lat: number; lng: number }, b: { lat: number; lng: number }, profile: "car" | "foot"): Promise<Road | null> {
  for (const srv of SERVERS[profile]) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 12000);
    try {
      const r = await fetch(`${srv}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`, { signal: ac.signal });
      const j = await r.json(), rt = j?.routes?.[0];
      if (rt?.geometry?.coordinates?.length) return { pts: rt.geometry.coordinates.map((c: number[]) => [c[1], c[0]]), km: rt.distance / 1000, min: rt.duration / 60 };
    } catch { /* try next server */ } finally { clearTimeout(t); }
  }
  return null;
}
export function roadRoute(a: { lat: number; lng: number }, b: { lat: number; lng: number }, profile: "car" | "foot" = "car") {
  const key = [a.lat, a.lng, b.lat, b.lng].map((n) => n.toFixed(5)).join(",") + profile;
  let p = roads.get(key);
  if (!p) { p = fetchRoad(a, b, profile).then((r) => { if (!r) roads.delete(key); return r; }); roads.set(key, p); }
  return p;
}
