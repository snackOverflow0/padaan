import { CATS, DESTS, GEO, STOPS, fareText, hm, km, legTotals, modeIcon, ev, clock, type Cat, type Dest, type Ev, type Place } from "./data";

export type Pace = "Relaxed" | "Balanced" | "Packed";
export interface DaySummary { hours: number; km: number; badge?: string }
export interface PlanDay { stops: Dest[]; events: Ev[]; summary?: DaySummary }
type P = { lat: number; lng: number };
type Blk = { stops: Dest[]; part?: "out" | "back" };

const CAP: Record<Pace, number> = { Relaxed: 600, Balanced: 720, Packed: 840 }; // door-to-door minutes per day
const DWELL: Record<Cat, number> = { Waterfall: 150, Beach: 180, Heritage: 90, Island: 240 };
const TIP: Record<Cat, string> = {
  Waterfall: "Start early, wear grippy footwear, and skip it after heavy rain.",
  Beach: "Bring sun protection and some cash for tricycles and food.",
  Heritage: "Churches and museums may close to visitors during services.",
  Island: "Boats usually stop late in the afternoon. Confirm the last trip.",
};
const HUB: P = { lat: 16.6159, lng: 120.3209 }; // San Fernando, where the written routes begin
const road = (a: P, b: P) => km(a, b) * 1.35;
const hop = (a: P, b: P) => Math.round((road(a, b) / 32) * 60 + 20);
const nearHub = (s: P) => km(s, HUB) < 8;
const oneWay = (d: Dest, s: P) => (nearHub(s) ? Math.round(legTotals(d).t) : Math.max(25, Math.round((road(s, GEO[d.id]) / 30) * 60 + 30 + (d.cat === "Island" ? 45 : 0))));
const fareOne = (d: Dest, s: P): [number, number] => (nearHub(s) ? [legTotals(d).f0, legTotals(d).f1] : [Math.round(road(s, GEO[d.id]) * 1.8), Math.round(road(s, GEO[d.id]) * 3.2)]);
const town = (d: Dest) => (STOPS[d.id] ?? []).slice(-2)[0]?.name ?? d.place;

function nearest(ds: Dest[], s: P): Dest[] {
  const left = [...ds], out: Dest[] = []; let cur: P = s;
  while (left.length) { let b = 0; left.forEach((d, i) => { if (km(cur, GEO[d.id]) < km(cur, GEO[left[b].id])) b = i; }); const [n] = left.splice(b, 1); out.push(n); cur = GEO[n.id]; }
  return out;
}
const dayMin = (g: Dest[], s: P) => oneWay(g[0], s) + g.slice(1).reduce((n, d, i) => n + hop(GEO[g[i].id], GEO[d.id]), 0) + g.reduce((n, d) => n + DWELL[d.cat], 0) + oneWay(g[g.length - 1], s);

function pack(ds: Dest[], s: P, cap: number): Dest[][] {
  const groups: Dest[][] = []; let cur: Dest[] = [];
  for (const d of ds) { if (cur.length < 3 && dayMin([...cur, d], s) <= cap) cur.push(d); else { if (cur.length) groups.push(cur); cur = [d]; } }
  if (cur.length) groups.push(cur);
  return groups;
}

function buildDay(b: Blk, s: Place, origin: string, landmark: string) {
  const g = b.stops, E: Ev[] = [], first = g[0], last = g[g.length - 1];
  const early = g.some((d) => d.cat === "Island" || d.cat === "Waterfall");
  const start = b.part === "back" ? 8 * 60 : (early ? 6 : 7) * 60; let t = start, travel = 0, kms = 0, fMin = 0, fMax = 0, transfers = 0;
  if (b.part === "back") {
    E.push(ev(clock(t), `Morning in ${town(first)}`, "Breakfast and a slow start", "1h", "star")); t += 60;
    const m = oneWay(first, s), [a, z] = fareOne(first, s);
    E.push(ev(clock(t), `Return to ${origin}`, "Same route in reverse; fares may differ", hm(m), "route")); t += m; travel = m; kms = road(s, GEO[first.id]); fMin = a; fMax = z; transfers = nearHub(s) ? first.legs.length - 1 : 1;
    E.push(ev(clock(t), `Back in ${origin}`, "Trip complete", "", "pin"));
  } else {
    E.push(ev(clock(t), `Depart ${origin}`, landmark, "", "pin"));
    g.forEach((d, i) => {
      if (i === 0) {
        if (nearHub(s)) for (const l of d.legs) { const m = (l.tMin + l.tMax) / 2; E.push(ev(clock(t), l.mode, `${l.from} -> ${l.to} · ${fareText(l)}`, hm(m), modeIcon[l.mode])); t += m; }
        else { const m = oneWay(d, s); E.push(ev(clock(t), `Travel to ${d.name}`, `About ${Math.round(road(s, GEO[d.id]))} km by bus, jeepney or tricycle`, hm(m), "route")); t += m; }
        travel += oneWay(d, s); kms += road(s, GEO[d.id]);
      } else {
        const m = hop(GEO[g[i - 1].id], GEO[d.id]), k = road(GEO[g[i - 1].id], GEO[d.id]);
        E.push(ev(clock(t), `Transfer to ${d.name}`, `About ${Math.round(k)} km. Ask locals for the nearest ride`, hm(m), "route")); t += m; travel += m; kms += k; fMin += 30; fMax += 60; transfers++;
      }
      E.push(ev(clock(t), `Arrive at ${d.name}`, TIP[d.cat], hm(DWELL[d.cat]), "star")); t += DWELL[d.cat];
    });
    const [a, z] = fareOne(first, s);
    if (b.part === "out") { E.push(ev(clock(t), `Overnight in ${town(first)}`, "Book a room ahead and ask your host about the ride back", "", "pin")); fMin += a; fMax += z; transfers += nearHub(s) ? first.legs.length - 1 : 1; }
    else {
      const m = oneWay(last, s), [a2, z2] = fareOne(last, s);
      E.push(ev(clock(t), `Return to ${origin}`, "Same legs in reverse; fares may differ", hm(m), "route")); t += m; travel += m; kms += road(s, GEO[last.id]);
      fMin += a + a2; fMax += z + z2; transfers += nearHub(s) ? first.legs.length - 1 + last.legs.length - 1 : 2;
      E.push(ev(clock(t), `Back in ${origin}`, "Trip complete", "", "pin"));
    }
  }
  const hours = (t - start) / 60;
  const badge = b.part === "out" ? "Overnight" : b.part === "back" ? "Return day" : early ? "Early start" : hours < 6 ? "Light day" : undefined;
  return { day: { stops: g, events: E, summary: { hours, km: kms, badge } } as PlanDay, travel, fMin, fMax, transfers };
}

/** Orders the stops, fits them into days, and builds the timeline. Estimates only; confirm locally. */
export function smartPlan(ids: string[], start: Place, o: { days: number | "auto"; pace: Pace; optimize: boolean }) {
  const given = ids.map((id) => DESTS.find((d) => d.id === id)).filter((d): d is Dest => !!d);
  const ordered = o.optimize ? nearest(given, start) : given, cap = CAP[o.pace], notes: string[] = [];
  const len = (l: Dest[]) => l.reduce((n, d, i) => n + km(i ? GEO[l[i - 1].id] : start, GEO[d.id]), 0);
  if (o.optimize && given.length > 2) { const sv = len(given) - len(ordered); if (sv > 5) notes.push(`Reordered your stops to save about ${Math.round(sv)} km of travel.`); }
  if (!nearHub(start) && given.length) notes.push(`Your start is about ${Math.round(km(start, HUB))} km from San Fernando, so times and fares are estimated from distance.`);
  let blocks: Blk[] = [];
  for (const g of pack(ordered, start, cap)) {
    if (g.length === 1 && dayMin(g, start) > cap) { blocks.push({ stops: g, part: "out" }, { stops: g, part: "back" }); notes.push(`${g[0].name} is about ${hm(oneWay(g[0], start))} each way, so it is planned as an overnight stay.`); }
    else blocks.push({ stops: g });
  }
  if (o.days !== "auto") {
    if (blocks.length > o.days) notes.push(`At a ${o.pace.toLowerCase()} pace this trip needs ${blocks.length} days. Turn on Auto days, add days or remove a place.`);
    while (blocks.length < o.days) { const i = blocks.findIndex((b) => !b.part && b.stops.length > 1); if (i < 0) break; const b = blocks[i]; blocks.splice(i, 1, { stops: [b.stops[0]] }, { stops: b.stops.slice(1) }); }
  }
  const origin = start.name.split(",")[0], lm = start.landmark ?? "Your starting point";
  const built = blocks.map((b) => buildDay(b, start, origin, lm));
  const days: PlanDay[] = built.map((x) => x.day), want = o.days === "auto" ? Math.max(days.length, 1) : Math.max(o.days, days.length);
  while (days.length < want) days.push({ stops: [], events: [ev("09:00", "Free day", "Rest, or add a destination to fill this day", "", "star")] });
  const sel = new Set(given.map((d) => d.id));
  const suggest = DESTS.filter((d) => !sel.has(d.id)).map((d) => { let k = Infinity, near: Dest | null = null; given.forEach((g) => { const x = km(GEO[g.id], GEO[d.id]); if (x < k) { k = x; near = g; } }); return { d, k, near }; })
    .filter((x) => x.near && x.k <= 35).sort((a, b) => a.k - b.k).slice(0, 4).map((x) => ({ d: x.d, why: `${Math.round(x.k)} km from ${(x.near as Dest).name}` }));
  return { days, notes, suggest, stops: ordered, minutes: built.reduce((n, x) => n + x.travel, 0), fMin: built.reduce((n, x) => n + x.fMin, 0), fMax: built.reduce((n, x) => n + x.fMax, 0), transfers: built.reduce((n, x) => n + x.transfers, 0) };
}

/** "Build my trip": picks places from the chosen interests that fit the day budget, nearest and verified first. */
export function buildTrip(interests: Cat[], start: Place, days: number | "auto", pace: Pace): string[] {
  const score = (d: Dest) => km(start, GEO[d.id]) - (d.verified ? 15 : 0);
  const pool = DESTS.filter((d) => !interests.length || interests.includes(d.cat)).sort((a, b) => score(a) - score(b));
  const limit = days === "auto" ? 3 : days, picked: string[] = [];
  for (const d of pool) { if (picked.length >= 8) break; if (smartPlan([...picked, d.id], start, { days: "auto", pace, optimize: true }).days.length <= limit) picked.push(d.id); }
  return picked;
}
export { CATS };
