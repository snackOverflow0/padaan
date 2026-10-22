import { CATS, DESTS, GEO, STOPS, fareText, hm, km, legTotals, modeIcon, ev, clock, type Cat, type Dest, type Ev, type Place } from "./data";

export type Pace = "Relaxed" | "Balanced" | "Packed";
export interface DaySummary { hours: number; km: number; places: number; badge?: string }
export interface PlanDay { stops: Dest[]; events: Ev[]; title?: string; summary?: DaySummary }
type P = { lat: number; lng: number };
type Blk = { stops: Dest[]; from?: Dest; end: "home" | "stay" };

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

/** Walks through the stops day by day. A day ends back home, or with an overnight stay when the next place is
    close by and home is far, which links far-away places into one road trip instead of many round trips. */
function sequence(ds: Dest[], s: P, cap: number): Blk[] {
  const blocks: Blk[] = [], rest = [...ds]; let from: Dest | undefined;
  while (rest.length) {
    const day: Dest[] = []; let t = 0, end: "home" | "stay" = "home";
    while (rest.length && day.length < 3) {
      const d = rest[0], prev = day.length ? day[day.length - 1] : from;
      const arrive = t + (prev ? hop(GEO[prev.id], GEO[d.id]) : oneWay(d, s)) + DWELL[d.cat];
      const homeOK = arrive + oneWay(d, s) <= cap, stayOK = arrive <= cap - 60 && oneWay(d, s) > 180;
      if (day.length && !homeOK && !stayOK) break;
      day.push(d); rest.shift(); t = arrive; end = homeOK ? "home" : "stay";
      if (!homeOK && !stayOK) break;
    }
    const last = day[day.length - 1];
    if (end === "home" && rest.length && oneWay(last, s) > 180 && hop(GEO[last.id], GEO[rest[0].id]) <= 150) end = "stay";
    blocks.push({ stops: day, from, end });
    from = end === "stay" ? last : undefined;
    if (end === "stay" && !rest.length) { blocks.push({ stops: [], from, end: "home" }); from = undefined; }
  }
  return blocks;
}

function buildDay(b: Blk, s: Place, origin: string, lm: string) {
  const g = b.stops, E: Ev[] = [], from = b.from;
  const early = !from && g.some((d) => d.cat === "Island" || d.cat === "Waterfall");
  const start = from ? 8 * 60 : (early ? 6 : 7) * 60; let t = start, travel = 0, kms = 0, fMin = 0, fMax = 0, transfers = 0;
  let prev: Dest | undefined = from;
  if (from) { E.push(ev(clock(t), `Morning in ${town(from)}`, "Breakfast and a slow start", "1h", "star")); t += 60; }
  else E.push(ev(clock(t), `Depart ${origin}`, lm, "", "pin"));
  g.forEach((d) => {
    if (!prev) {
      if (nearHub(s)) for (const l of d.legs) { const m = (l.tMin + l.tMax) / 2; E.push(ev(clock(t), l.mode, `${l.from} -> ${l.to} · ${fareText(l)}`, hm(m), modeIcon[l.mode])); t += m; }
      else { const m = oneWay(d, s); E.push(ev(clock(t), `Travel to ${d.name}`, `About ${Math.round(road(s, GEO[d.id]))} km by bus, jeepney or tricycle`, hm(m), "route")); t += m; }
      const [a, z] = fareOne(d, s); fMin += a; fMax += z; travel += oneWay(d, s); kms += road(s, GEO[d.id]); transfers += nearHub(s) ? d.legs.length - 1 : 1;
    } else {
      const m = hop(GEO[prev.id], GEO[d.id]), k = road(GEO[prev.id], GEO[d.id]);
      E.push(ev(clock(t), `Transfer to ${d.name}`, `About ${Math.round(k)} km. Ask locals for the nearest ride`, hm(m), "route")); t += m; travel += m; kms += k; fMin += 30; fMax += 60; transfers++;
    }
    E.push(ev(clock(t), `Arrive at ${d.name}`, TIP[d.cat], hm(DWELL[d.cat]), "star")); t += DWELL[d.cat]; prev = d;
  });
  const last = prev as Dest;
  if (b.end === "home") {
    const m = oneWay(last, s), [a, z] = fareOne(last, s);
    E.push(ev(clock(t), `Return to ${origin}`, "Same legs in reverse; fares may differ", hm(m), "route")); t += m; travel += m; kms += road(s, GEO[last.id]); fMin += a; fMax += z; transfers += nearHub(s) ? last.legs.length - 1 : 1;
    E.push(ev(clock(t), `Back in ${origin}`, "Trip complete", "", "pin"));
  } else E.push(ev(clock(t), `Overnight in ${town(last)}`, "Book a room ahead and ask your host about the ride back", "", "pin"));
  const hours = (t - start) / 60;
  const badge = b.end === "stay" ? "Overnight" : from && !g.length ? "Return day" : early ? "Early start" : hours < 6 ? "Light day" : undefined;
  const day: PlanDay = { stops: g.length ? g : from ? [from] : [], events: E, title: g.length ? undefined : `Return to ${origin}`, summary: { hours, km: kms, places: g.length, badge } };
  return { day, travel, fMin, fMax, transfers };
}

/** Orders the stops, fits them into days, and builds the timeline. Estimates only; confirm locally. */
export function smartPlan(ids: string[], start: Place, o: { days: number | "auto"; pace: Pace; optimize: boolean }) {
  const given = ids.map((id) => DESTS.find((d) => d.id === id)).filter((d): d is Dest => !!d);
  const ordered = o.optimize ? nearest(given, start) : given, cap = CAP[o.pace], notes: string[] = [];
  const origin = start.name.split(",")[0], lm = start.landmark ?? "Your starting point";
  const len = (l: Dest[]) => l.reduce((n, d, i) => n + km(i ? GEO[l[i - 1].id] : start, GEO[d.id]), 0);
  if (o.optimize && given.length > 2) { const sv = len(given) - len(ordered); if (sv > 5) notes.push(`Reordered your stops to save about ${Math.round(sv)} km of travel.`); }
  if (!nearHub(start) && given.length) notes.push(`Your start is about ${Math.round(km(start, HUB))} km from San Fernando, so times and fares are estimated from distance.`);
  const blocks = sequence(ordered, start, cap);
  blocks.filter((b) => b.end === "stay").forEach((b) => { const l = b.stops[b.stops.length - 1]; notes.push(`Overnight near ${town(l)}: ${l.name} is about ${hm(oneWay(l, start))} from ${origin}, so staying nearby saves long round trips.`); });
  let overflow: Dest[] = [];
  if (o.days !== "auto") {
    while (blocks.length < o.days) { const i = blocks.findIndex((b) => !b.from && b.end === "home" && b.stops.length > 1); if (i < 0) break; const b = blocks[i]; blocks.splice(i, 1, { stops: [b.stops[0]], end: "home" }, { stops: b.stops.slice(1), end: "home" }); }
    if (blocks.length > o.days) { overflow = blocks.slice(o.days).flatMap((b) => b.stops); notes.push(`${overflow.map((d) => d.name).join(", ")} would need ${blocks.length} days at a ${o.pace.toLowerCase()} pace.`); }
  }
  const built = blocks.map((b) => buildDay(b, start, origin, lm));
  const days: PlanDay[] = built.map((x) => x.day), want = o.days === "auto" ? Math.max(days.length, 1) : Math.max(o.days, days.length);
  while (days.length < want) days.push({ stops: [], events: [ev("09:00", "Free day", "Rest, or add a destination to fill this day", "", "star")] });
  const sel = new Set(given.map((d) => d.id));
  const suggest = DESTS.filter((d) => !sel.has(d.id)).map((d) => { let k = Infinity, near: Dest | null = null; given.forEach((g) => { const x = km(GEO[g.id], GEO[d.id]); if (x < k) { k = x; near = g; } }); return { d, k, near }; })
    .filter((x) => x.near && x.k <= 35).sort((a, b) => a.k - b.k).slice(0, 4).map((x) => ({ d: x.d, why: `${Math.round(x.k)} km from ${(x.near as Dest).name}` }));
  return { days, notes, suggest, overflow, free: days.filter((d) => !d.summary).length, stops: ordered, minutes: built.reduce((n, x) => n + x.travel, 0), fMin: built.reduce((n, x) => n + x.fMin, 0), fMax: built.reduce((n, x) => n + x.fMax, 0), transfers: built.reduce((n, x) => n + x.transfers, 0) };
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
