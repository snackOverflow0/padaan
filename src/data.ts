import type { IconName } from "./icons";

/* Content mirrors the Padaan MVP documentation (GEIST, DMMMSU). All routes are SAMPLE data until field-verified. */
export type Mode = "Jeepney" | "Tricycle" | "Habal-habal" | "Bus" | "Boat" | "Walk";
export type Cat = "Waterfall" | "Beach" | "Heritage" | "Island";
export interface Leg { mode: Mode; from: string; to: string; fMin: number; fMax: number; tMin: number; tMax: number; look: string }
export interface Dest {
  id: string; name: string; place: string; cat: Cat; verified: boolean; budget: 1 | 2 | 3;
  daysAgo: number; blurb: string; legs: Leg[]; people: { n: string; role: string }[];
}
export interface Ev { time: string; title: string; meta: string; duration: string; icon: IconName }

export const ORIGIN = { name: "San Fernando, La Union", landmark: "Partas Terminal / Bus Terminal" };
export const MODES: Mode[] = ["Jeepney", "Tricycle", "Habal-habal", "Walk"];
export const CATS: Cat[] = ["Waterfall", "Beach", "Heritage", "Island"];
export const ROLES: [string, IconName][] = [["Local driver", "car"], ["Tourism officer", "shield"], ["Store owner", "pin"], ["Repeat traveler", "route"], ["Local resident", "users"]];
export const modeIcon: Record<Mode, IconName> = { Jeepney: "jeepney", Tricycle: "tricycle", "Habal-habal": "bike", Bus: "bus", Boat: "boat", Walk: "walk" };
export const modeKey = (m: Mode) => m.toLowerCase();
export const catIcon: Record<Cat, IconName> = { Waterfall: "leaf", Beach: "compass", Heritage: "flag", Island: "boat" };

/** Freshness of a last-confirmed date: drives the colour of the dot beside it. */
export type Fresh = "fresh" | "aging" | "stale";
export const fresh = (days: number): Fresh => (days <= 30 ? "fresh" : days <= 60 ? "aging" : "stale");
export const agoText = (d: number) => (d === 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`);

export const legTotals = (d: Dest) => d.legs.reduce((a, l) => ({ f0: a.f0 + l.fMin, f1: a.f1 + l.fMax, t: a.t + (l.tMin + l.tMax) / 2 }), { f0: 0, f1: 0, t: 0 });

const L = (mode: Mode, from: string, to: string, fMin: number, fMax: number, tMin: number, tMax: number, look: string): Leg => ({ mode, from, to, fMin, fMax, tMin, tMax, look });

export const DESTS: Dest[] = [
  { id: "tangadan", name: "Tangadan Falls", place: "San Gabriel, La Union", cat: "Waterfall", verified: true, budget: 1, daysAgo: 12,
    blurb: "A forest waterfall reached by jeepney, tricycle, habal-habal and a short riverside walk.",
    people: [{ n: "Juan D.", role: "Local Driver" }, { n: "Mara L.", role: "Repeat Traveler" }, { n: "Ana T.", role: "Tourism Officer" }],
    legs: [
      L("Jeepney", "San Fernando", "San Gabriel", 30, 40, 35, 45, "Get off near San Gabriel Public Market"),
      L("Tricycle", "Public Market", "Barangay Road", 80, 120, 15, 15, "Ask for the old market road near the barangay hall"),
      L("Habal-habal", "Barangay Road", "Jump-off", 50, 70, 15, 20, "The jump-off has a green hikers' shed"),
      L("Walk", "Jump-off", "Tangadan Falls", 0, 0, 15, 15, "Stay on the marked riverside trail"),
    ] },
  { id: "urbiztondo", name: "Urbiztondo Beach", place: "San Juan, La Union", cat: "Beach", verified: false, budget: 1, daysAgo: 20,
    blurb: "La Union's surf strip, a short jeepney ride up the coast from the city.",
    people: [{ n: "Rico P.", role: "Local Driver" }],
    legs: [L("Jeepney", "San Fernando", "San Juan", 20, 30, 20, 30, "Tell the driver you are heading to the surf strip"), L("Tricycle", "San Juan Poblacion", "Urbiztondo", 40, 60, 10, 15, "Ask for the beachfront road")] },
  { id: "vigan", name: "Vigan Heritage Village", place: "Vigan, Ilocos Sur", cat: "Heritage", verified: false, budget: 2, daysAgo: 35,
    blurb: "Spanish-era streets reached by bus from the Partas terminal.",
    people: [{ n: "Lena S.", role: "Repeat Traveler" }],
    legs: [L("Bus", "San Fernando Partas Terminal", "Vigan", 180, 260, 150, 200, "Board a northbound Ilocos Sur bus"), L("Tricycle", "Vigan Terminal", "Calle Crisologo", 40, 60, 10, 15, "Heritage village is a short ride from the terminal")] },
  { id: "hundred", name: "Hundred Islands", place: "Alaminos, Pangasinan", cat: "Island", verified: false, budget: 3, daysAgo: 48,
    blurb: "Island-hopping from Lucap Wharf; plan for a boat fare on top of the road leg.",
    people: [{ n: "Ben C.", role: "Store Owner" }],
    legs: [L("Bus", "San Fernando", "Alaminos", 200, 280, 180, 220, "Take a Pangasinan-bound bus"), L("Tricycle", "Alaminos Terminal", "Lucap Wharf", 50, 80, 15, 20, "Ask for Lucap Wharf"), L("Boat", "Lucap Wharf", "Immuki Island", 700, 1200, 20, 30, "Shared island-hopping boat; confirm rates at the tourism office")] },
  { id: "bolinao", name: "Bolinao Falls", place: "Bolinao, Pangasinan", cat: "Waterfall", verified: false, budget: 2, daysAgo: 60,
    blurb: "Tiered turquoise falls reached through a tricycle ride from town.",
    people: [{ n: "Sol R.", role: "Local Resident" }],
    legs: [L("Bus", "San Fernando", "Bolinao", 240, 320, 240, 280, "Bolinao-bound bus, long ride"), L("Tricycle", "Bolinao Town", "Falls entrance", 60, 100, 15, 20, "Agree on a fare before riding")] },
  { id: "bauang", name: "Bauang Beach", place: "Bauang, La Union", cat: "Beach", verified: false, budget: 1, daysAgo: 90,
    blurb: "A long, easygoing stretch of dark sand just up the coast from San Fernando, good for sunsets and cheap seafood.", people: [],
    legs: [L("Jeepney", "San Fernando Market", "Bauang Poblacion", 25, 35, 25, 35, "Bauang-bound jeepney on the national highway"), L("Tricycle", "Bauang Poblacion", "Beach", 30, 50, 10, 15, "Ask for the beach front, agree on the fare first")] },
  { id: "laoagbell", name: "Sinking Bell Tower", place: "Laoag, Ilocos Norte", cat: "Heritage", verified: false, budget: 2, daysAgo: 90,
    blurb: "A leaning 18th-century bell tower in the middle of Laoag City, an easy first stop in Ilocos Norte.", people: [],
    legs: [L("Bus", "San Fernando", "Laoag", 450, 650, 270, 330, "Laoag-bound bus, long ride; sit on the shaded side"), L("Tricycle", "Laoag Terminal", "Bell Tower", 30, 50, 10, 15, "Tricycles queue outside the terminal")] },
  { id: "paoay", name: "Paoay Church", place: "Paoay, Ilocos Norte", cat: "Heritage", verified: false, budget: 2, daysAgo: 90,
    blurb: "A UNESCO World Heritage earthquake baroque church with massive buttresses, ten minutes from the Paoay Lake.", people: [],
    legs: [L("Bus", "San Fernando", "Laoag", 450, 650, 270, 330, "Laoag-bound bus, long ride"), L("Jeepney", "Laoag Terminal", "Paoay Poblacion", 40, 60, 30, 40, "Paoay-bound jeepney or van from Laoag"), L("Tricycle", "Paoay Poblacion", "Church", 20, 40, 5, 10, "The church faces the town plaza")] },
  { id: "bantay", name: "Bantay Bell Tower", place: "Bantay, Ilocos Sur", cat: "Heritage", verified: false, budget: 1, daysAgo: 90,
    blurb: "A hillside watchtower and bell tower just outside Vigan with wide views over the town and the Abra River.", people: [],
    legs: [L("Bus", "San Fernando", "Vigan", 250, 350, 150, 200, "Vigan-bound bus from the terminal"), L("Tricycle", "Vigan Terminal", "Bantay Bell Tower", 60, 100, 15, 20, "Tell the driver Bantay Church and Bell Tower")] },
  { id: "bojeador", name: "Cape Bojeador Lighthouse", place: "Burgos, Ilocos Norte", cat: "Heritage", verified: false, budget: 3, daysAgo: 90,
    blurb: "A Spanish-era lighthouse on a headland above the sea, with coastal views toward Pagudpud.", people: [],
    legs: [L("Bus", "San Fernando", "Laoag", 450, 650, 270, 330, "Laoag-bound bus, long ride"), L("Bus", "Laoag Terminal", "Burgos", 70, 100, 60, 75, "Pagudpud-bound bus or van; ask to drop at Burgos"), L("Tricycle", "Burgos Poblacion", "Lighthouse", 100, 150, 15, 20, "Hilltop road; confirm the return ride")] },
];

export const PACKS = [
  { id: "launion", name: "La Union", routes: 24, dests: 8, mb: 18.4, updated: "August 2026" },
  { id: "ilocosnorte", name: "Ilocos Norte", routes: 19, dests: 7, mb: 15.2, updated: "July 2026" },
];

export const peso = (n: number) => "₱" + Math.round(n).toLocaleString();
export const fareText = (l: Pick<Leg, "fMin" | "fMax">) => (l.fMax === 0 ? "Free" : l.fMin === l.fMax ? peso(l.fMin) : `${peso(l.fMin)}–${peso(l.fMax)}`);
export const hm = (m: number) => { const h = Math.floor(m / 60), r = Math.round(m % 60); return h ? `${h}h${r ? ` ${r}m` : ""}` : `${r}m`; };
const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
const ev = (time: string, title: string, meta: string, duration: string, icon: IconName): Ev => ({ time, title, meta, duration, icon });
export const dateAgo = (d: number) => new Date(Date.now() - d * 864e5).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" });

/** Turns chosen destinations into a day-by-day plan (each stop is an out-and-back day trip from the hub). */
export function tripPlan(ids: string[], dayCount: number, originName = ORIGIN.name, landmark = ORIGIN.landmark) {
  const stops = ids.map((id) => DESTS.find((d) => d.id === id)).filter((d): d is Dest => !!d);
  const days = Array.from({ length: dayCount }, () => ({ stops: [] as Dest[], events: [] as Ev[] }));
  stops.forEach((d, i) => days[Math.min(i, dayCount - 1)].stops.push(d));
  let minutes = 0, fMin = 0, fMax = 0, transfers = 0;
  for (const day of days) {
    if (!day.stops.length) { day.events.push(ev("09:00", "Free day", "Add a destination to fill this day", "", "star")); continue; }
    let t = 7 * 60;
    for (const d of day.stops) {
      day.events.push(ev(clock(t), `Depart ${originName}`, landmark, "", "pin"));
      let out = 0;
      for (const l of d.legs) {
        const m = (l.tMin + l.tMax) / 2;
        day.events.push(ev(clock(t), l.mode, `${l.from} → ${l.to} · ${fareText(l)}`, hm(m), modeIcon[l.mode]));
        t += m; out += m; fMin += l.fMin * 2; fMax += l.fMax * 2;
      }
      day.events.push(ev(clock(t), `Arrive at ${d.name}`, "Allow about 3 hours to explore", "3h", "star"));
      t += 180;
      day.events.push(ev(clock(t), `Return to ${originName.split(",")[0]}`, "Same legs in reverse; fares may differ", hm(out), "route"));
      t += out; minutes += out * 2; transfers += (d.legs.length - 1) * 2;
    }
  }
  return { days, minutes, fMin, fMax, transfers, stops };
}

/* Approximate map pins (town / landmark level, not surveyed). Replace with surveyed coordinates once routes are field-verified. */
export const GEO: Record<string, { lat: number; lng: number }> = {
  tangadan: { lat: 16.6175, lng: 120.4105 },
  urbiztondo: { lat: 16.6745, lng: 120.3225 },
  vigan: { lat: 17.5733, lng: 120.3870 },
  hundred: { lat: 16.2090, lng: 120.0170 },
  bolinao: { lat: 16.3330, lng: 119.9040 },
  bauang: { lat: 16.5280, lng: 120.3170 },
  laoagbell: { lat: 18.1972, lng: 120.5917 },
  paoay: { lat: 18.0603, lng: 120.5196 },
  bantay: { lat: 17.5860, lng: 120.3925 },
  bojeador: { lat: 18.4950, lng: 120.5866 },
};
export const ORIGIN_GEO = { lat: 16.6159, lng: 120.3209 };

export const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371, r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
export interface Place { name: string; lat: number; lng: number; landmark?: string }
export const DEFAULT_START: Place = { name: ORIGIN.name, landmark: ORIGIN.landmark, ...ORIGIN_GEO };
/* Approximate end point of each leg, in order (town / landmark level, not surveyed). Last entry = the destination. */
export const STOPS: Record<string, { name: string; lat: number; lng: number }[]> = {
  tangadan: [{ name: "San Gabriel Public Market", lat: 16.6397, lng: 120.4058 }, { name: "Barangay road", lat: 16.6290, lng: 120.4090 }, { name: "Hikers' jump-off", lat: 16.6215, lng: 120.4100 }, { name: "Tangadan Falls", ...GEO.tangadan }],
  urbiztondo: [{ name: "San Juan Poblacion", lat: 16.6676, lng: 120.3318 }, { name: "Urbiztondo Beach", ...GEO.urbiztondo }],
  vigan: [{ name: "Vigan Terminal", lat: 17.5690, lng: 120.3890 }, { name: "Calle Crisologo", ...GEO.vigan }],
  hundred: [{ name: "Alaminos Terminal", lat: 16.1583, lng: 119.9818 }, { name: "Lucap Wharf", lat: 16.1995, lng: 120.0325 }, { name: "Immuki Island", ...GEO.hundred }],
  bauang: [{ name: "Bauang Poblacion", lat: 16.5306, lng: 120.3326 }, { name: "Bauang Beach", ...GEO.bauang }],
  laoagbell: [{ name: "Laoag Terminal", lat: 18.1960, lng: 120.5920 }, { name: "Sinking Bell Tower", ...GEO.laoagbell }],
  paoay: [{ name: "Laoag Terminal", lat: 18.1960, lng: 120.5920 }, { name: "Paoay Poblacion", lat: 18.0585, lng: 120.5185 }, { name: "Paoay Church", ...GEO.paoay }],
  bantay: [{ name: "Vigan Terminal", lat: 17.5690, lng: 120.3890 }, { name: "Bantay Bell Tower", ...GEO.bantay }],
  bojeador: [{ name: "Laoag Terminal", lat: 18.1960, lng: 120.5920 }, { name: "Burgos Poblacion", lat: 18.5214, lng: 120.6178 }, { name: "Cape Bojeador Lighthouse", ...GEO.bojeador }],
  bolinao: [{ name: "Bolinao Town", lat: 16.3912, lng: 119.8896 }, { name: "Bolinao Falls", ...GEO.bolinao }],
};
/** Hand-off links so travelers can check the road in a full navigation app. */
export const directionsLinks = (id: string, from: { lat: number; lng: number } = ORIGIN_GEO) => {
  const g = GEO[id], o = from;
  return {
    google: `https://www.google.com/maps/dir/?api=1&origin=${o.lat},${o.lng}&destination=${g.lat},${g.lng}&travelmode=transit`,
    osm: `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${o.lat}%2C${o.lng}%3B${g.lat}%2C${g.lng}`,
  };
};
