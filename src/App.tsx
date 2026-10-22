import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { reverse, searchPlaces } from "./geo";
import { Icon, type IconName } from "./icons";
import { RoadArt } from "./scenes";
import { Pic } from "./photos";
import { MapView, type MapPoint } from "./map";
import {
  CATS, DEFAULT_START, DESTS, GEO, MODES, PACKS, STOPS, ROLES, directionsLinks, km, agoText, catIcon, dateAgo, fareText, fresh, hm, legTotals, modeIcon, modeKey, peso, tripPlan,
  type Cat, type Dest, type Mode, type Place,
} from "./data";

/* ───────────── starting point ───────────── */
type StartCtxT = Place & { change: () => void; set: (p: Place) => void; pick: (p: { lat: number; lng: number }) => void };
const StartCtx = createContext<StartCtxT>({ ...DEFAULT_START, change: () => {}, set: () => {}, pick: () => {} });
const MODE_COLOR: Record<Mode, string> = { Jeepney: "#1a5a49", Tricycle: "#b9780a", "Habal-habal": "#c4573a", Bus: "#3b6ea5", Boat: "#1f8a96", Walk: "#6a7d4a" };

function StartModal({ st, onClose }: { st: StartCtxT; onClose: () => void }) {
  const [q, setQ] = useState(""), [res, setRes] = useState<Place[]>([]), [msg, setMsg] = useState("");
  useEffect(() => {
    if (q.trim().length < 3) { setRes([]); setMsg(""); return; }
    const ac = new AbortController(), t = setTimeout(() => {
      setMsg("Searching…");
      searchPlaces(q, ac.signal).then((r) => { setRes(r); setMsg(r.length ? "" : "No places found. Try a nearby town or landmark."); }).catch((e) => e.name !== "AbortError" && setMsg("Place search needs an internet connection."));
    }, 400);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q]);
  const choose = (p: Place) => { st.set(p); onClose(); };
  const here = () => {
    if (!navigator.geolocation) return setMsg("Location isn't available in this browser");
    setMsg("Finding you…");
    navigator.geolocation.getCurrentPosition(async (pos) => choose({ name: await reverse(pos.coords.latitude, pos.coords.longitude), lat: pos.coords.latitude, lng: pos.coords.longitude }), () => setMsg("Couldn't get your location. Check the site's location permission."), { timeout: 10000 });
  };
  return (
    <Modal title="Where are you starting from?" onClose={onClose}>
      <label className="field">Search a town, address or landmark
        <input autoFocus value={q} placeholder="e.g. Baguio City, Dagupan, your hotel" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && res[0] && choose(res[0])} />
      </label>
      {msg && <p className="muted start-msg" role="status">{msg}</p>}
      <ul className="start-results">{res.map((r) => <li key={r.lat + "," + r.lng}><button onClick={() => choose(r)}><Icon name="pin" size={16} /><span>{r.name}</span></button></li>)}</ul>
      <div className="row2 start-actions">
        <button className="btn secondary" onClick={here}><Icon name="compass" size={17} />Use my location</button>
        <button className="btn secondary" onClick={() => choose(DEFAULT_START)}><Icon name="refresh" size={16} />Reset to San Fernando</button>
      </div>
      <p className="muted"><Icon name="info" size={15} />You can also right-click (or long-press) anywhere on a map to start from that spot.</p>
    </Modal>
  );
}

/* ───────────── constants & helpers ───────────── */
const nav: { id: string; label: string; short: string; icon: IconName }[] = [
  { id: "explore", label: "Explore", short: "Explore", icon: "compass" },
  { id: "trip", label: "Trip planner", short: "Trips", icon: "route" },
  { id: "saved", label: "Saved", short: "Saved", icon: "bookmark" },
  { id: "offline", label: "Offline packs", short: "Offline", icon: "download" },
  { id: "contribute", label: "Contribute", short: "Share", icon: "users" },
];
const VIEWS = [...nav.map((n) => n.id), "route"];
const titles: Record<string, [string, string]> = {
  explore: ["Region I · La Union", "Explore destinations"],
  route: ["Route details", "How to get there"],
  trip: ["Itinerary builder", "Plan your trip"],
  saved: ["Your shortlist", "Saved destinations"],
  offline: ["No signal needed", "Offline region packs"],
  contribute: ["Community", "Share a road"],
};
const NOTIFS = [
  { t: "Tangadan Falls was re-confirmed 12 days ago", i: "check" as IconName },
  { t: "La Union region pack has an update", i: "download" as IconName },
  { t: "Routes are reviewed by locals before publishing", i: "shield" as IconName },
];
const STAGES = [
  { t: "Submitted", s: "Details received" },
  { t: "Community review", s: "Compared with other reports" },
  { t: "Local verification", s: "A local confirms the road" },
  { t: "Published", s: "Visible to travelers" },
];
const SORTS = [["rec", "Recommended"], ["fare", "Lowest fare"], ["time", "Shortest trip"], ["fresh", "Recently confirmed"]] as const;
type SortKey = (typeof SORTS)[number][0];
interface Submission { id: string; dest: string; start: string; mode: Mode; fare: string; look: string; at: number }

function useStored<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => { try { const s = localStorage.getItem("padaan." + key); return s ? (JSON.parse(s) as T) : init; } catch { return init; } });
  useEffect(() => { try { localStorage.setItem("padaan." + key, JSON.stringify(v)); } catch { /* storage unavailable */ } }, [key, v]);
  return [v, setV] as const;
}

/** Tiny hash router so the browser back button and shared links work: #/route/tangadan, #/trip … */
function readHash() {
  const [v, id] = location.hash.replace(/^#\/?/, "").split("/");
  const view = VIEWS.includes(v) ? v : "explore";
  const sel = DESTS.some((d) => d.id === id) ? id : DESTS[0].id;
  return { view: view === "route" && !DESTS.some((d) => d.id === id) ? "explore" : view, sel };
}

const Badge = ({ d, onDark }: { d: Dest; onDark?: boolean }) => (
  <span className={`badge ${d.verified ? "ok" : "pending"} ${onDark ? "on-dark" : ""}`}>
    <Icon name={d.verified ? "shield" : "clock"} size={13} />{d.verified ? "Verified" : "Awaiting 2nd confirmation"}
  </span>
);
const Freshness = ({ days }: { days: number }) => (
  <span className={`fresh ${fresh(days)}`}><i aria-hidden="true" />Confirmed {agoText(days)}</span>
);
const ModeStrip = ({ d }: { d: Dest }) => (
  <ul className="modestrip" aria-label={`Transport: ${d.legs.map((l) => l.mode).join(", then ")}`}>
    {d.legs.map((l, i) => (
      <li key={i} data-k={modeKey(l.mode)} title={l.mode}><Icon name={modeIcon[l.mode]} size={15} /></li>
    ))}
  </ul>
);
const Empty = ({ icon, title, text, cta, onCta }: { icon: IconName; title: string; text: string; cta?: string; onCta?: () => void }) => (
  <div className="empty">
    <span className="empty-icon"><Icon name={icon} size={26} /></span>
    <h3>{title}</h3><p>{text}</p>
    {cta && <button className="btn primary" onClick={onCta}>{cta}<Icon name="arrow" size={16} /></button>}
  </div>
);

/* ───────────── shell ───────────── */
/** Full multi-leg road geometry for a set of destinations, starting at the traveler's start point. */
function dayGeometry(list: Dest[], st: Place, open?: (id: string) => void) {
  const pts: MapPoint[] = [{ id: "origin", ...st, label: st.name.split(",")[0], sub: st.landmark ?? "Your starting point", kind: "origin" }];
  const lines: [string, string, string, string][] = [];
  list.forEach((d, k) => {
    const sp = STOPS[d.id] ?? []; let prev = "origin";
    const dest: MapPoint = { id: d.id, ...GEO[d.id], label: d.name, sub: d.place, kind: "dest", n: k + 1, onOpen: () => open?.(d.id) };
    if (!sp.length) { pts.push(dest); lines.push(["origin", d.id, "#1a5a49", "Jeepney"]); return; }
    sp.forEach((s, i) => {
      const last = i === sp.length - 1, id = last ? d.id : `${d.id}-s${i}`, mode = d.legs[Math.min(i, d.legs.length - 1)].mode;
      pts.push(last ? dest : { id, lat: s.lat, lng: s.lng, label: s.name, sub: `${d.name} · step ${i + 1} (${mode})`, kind: "stop", n: i + 1 });
      lines.push([prev, id, MODE_COLOR[mode], mode]); prev = id;
    });
  });
  return { pts, lines };
}

function Rail({ view, go, ready, savedN }: { view: string; go: (v: string) => void; ready: string[]; savedN: number }) {
  return (
    <aside className="rail">
      <button className="brand" onClick={() => go("explore")} aria-label="Padaan home">
        <span className="brand-mark"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 21V4h5.5a4.5 4.5 0 0 1 0 9H7" /></svg></span>
        <span className="brand-name">padaan<small>The Road There</small></span>
      </button>
      <nav className="tabs" aria-label="Main">
        <span className="rail-label">Menu</span>
        {nav.map((n) => {
          const on = view === n.id || (view === "route" && n.id === "explore");
          return (
            <button key={n.id} className={`tab ${on ? "on" : ""}`} aria-current={on ? "page" : undefined} onClick={() => go(n.id)}>
              <span className="tab-ic"><Icon name={on && n.id === "saved" ? "bookmark-fill" : n.icon} size={21} />{n.id === "offline" && ready.length > 0 && <b className="dot" aria-label={`${ready.length} downloaded`}>{ready.length}</b>}{n.id === "saved" && savedN > 0 && <b className="dot" aria-label={`${savedN} saved`}>{savedN}</b>}</span>
              <span className="tab-lb"><span className="full">{n.label}</span><span className="short">{n.short}</span></span>
            </button>
          );
        })}
      </nav>
      <button className="rail-card" onClick={() => go("offline")}>
        <span className="rail-card-ic"><Icon name={ready.length ? "check" : "cloud"} size={18} /></span>
        <span><strong>{ready.length ? "Offline-ready" : "No offline packs"}</strong><small>{ready.length ? "Routes work without signal" : "Download a region pack"}</small></span>
        <Icon name="chevron" size={16} />
      </button>
      <div className="rail-user"><span className="avatar">GT</span><span><strong>Guest traveler</strong><small>Region I pilot</small></span></div>
    </aside>
  );
}

function Topbar(p: { start: string; onStart: () => void; view: string; unread: boolean; onSearch: () => void; onHelp: () => void; bell: boolean; onBell: () => void; onRead: () => void; onHome: () => void }) {
  const [eyebrow, title] = titles[p.view];
  return (
    <header className="topbar">
      <button className="brand-sm" onClick={p.onHome} aria-label="Padaan home"><span className="brand-mark"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 21V4h5.5a4.5 4.5 0 0 1 0 9H7" /></svg></span></button>
      <div className="topbar-title"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1></div>
      <div className="top-actions">
        <button className="start-btn" onClick={p.onStart} aria-label={`Starting point: ${p.start}. Change`}><Icon name="pin" size={17} /><span>{p.start}</span></button>
        <button className="search-btn" onClick={p.onSearch} aria-label="Search destinations"><Icon name="search" size={18} /><span>Search destinations</span><kbd>Ctrl K</kbd></button>
        <div className="bell-wrap">
          <button className="icon-btn" aria-label={p.unread ? "Notifications, unread" : "Notifications"} aria-expanded={p.bell} onClick={p.onBell}><Icon name="bell" size={19} />{p.unread && <i className="ping" />}</button>
          {p.bell && (
            <div className="dropdown" role="region" aria-label="Notifications">
              <strong>Notifications</strong>
              <ul>{NOTIFS.map((n) => <li key={n.t}><span><Icon name={n.i} size={15} /></span>{n.t}</li>)}</ul>
              <button className="btn ghost sm" onClick={p.onRead}>Mark all as read</button>
            </div>
          )}
        </div>
        <button className="btn dark help-btn" onClick={p.onHelp}><Icon name="info" size={17} /><span>Help &amp; tips</span></button>
      </div>
    </header>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>{title}</h3><button className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="x" size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

function Palette({ onClose, go, open }: { onClose: () => void; go: (v: string) => void; open: (id: string) => void }) {
  const [q, setQ] = useState(""), [i, setI] = useState(0);
  const items = [
    ...DESTS.map((d) => ({ label: d.name, hint: d.place, icon: catIcon[d.cat], run: () => open(d.id) })),
    ...nav.map((n) => ({ label: n.label, hint: "Page", icon: n.icon, run: () => go(n.id) })),
  ].filter((x) => (x.label + x.hint).toLowerCase().includes(q.toLowerCase()));
  const run = (f: () => void) => { f(); onClose(); };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setI((i + 1) % Math.max(items.length, 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setI((i - 1 + items.length) % Math.max(items.length, 1)); }
    if (e.key === "Enter" && items[i]) run(items[i].run);
  };
  return (
    <div className="overlay top" onClick={onClose}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input"><Icon name="search" size={19} /><input autoFocus placeholder="Search destinations, towns, pages…" aria-label="Search" value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} onKeyDown={key} /><kbd>Esc</kbd></div>
        <ul>
          {items.map((x, n) => <li key={x.label}><button className={n === i ? "hot" : ""} onMouseEnter={() => setI(n)} onClick={() => run(x.run)}><span className="pi"><Icon name={x.icon} size={16} /></span><span>{x.label}</span><small>{x.hint}</small></button></li>)}
          {!items.length && <li className="none">No matches for “{q}”</li>}
        </ul>
      </div>
    </div>
  );
}

/* ───────────── destination card ───────────── */
function DestCard({ d, ago, saved, onOpen, onSave }: { d: Dest; ago: number; saved: boolean; onOpen: () => void; onSave: () => void }) {
  const t = legTotals(d);
  return (
    <article className="card">
      <div className="card-art">
        <Pic d={d} />
        <Badge d={d} />
        <button className={`save ${saved ? "on" : ""}`} aria-pressed={saved} aria-label={saved ? `Remove ${d.name} from saved` : `Save ${d.name}`} onClick={onSave}><Icon name={saved ? "bookmark-fill" : "bookmark"} size={18} /></button>
      </div>
      <div className="card-body">
        <span className="kicker"><Icon name={catIcon[d.cat]} size={13} />{d.cat}</span>
        <h3><button className="stretch" onClick={onOpen}>{d.name}</button></h3>
        <p className="place"><Icon name="pin" size={14} />{d.place}</p>
        <div className="card-stats">
          <div><span>Fare</span><strong>{fareText({ fMin: t.f0, fMax: t.f1 })}</strong></div>
          <div><span>Time</span><strong>~{hm(t.t)}</strong></div>
          <div><span>Legs</span><strong>{d.legs.length}</strong></div>
        </div>
        <div className="card-foot"><ModeStrip d={d} /><Freshness days={ago} /></div>
      </div>
    </article>
  );
}

/* ───────────── pages ───────────── */
function Explore({ saved, toggleSave, open, ago }: { saved: string[]; toggleSave: (id: string) => void; open: (id: string) => void; ago: (d: Dest) => number }) {
  const st = useContext(StartCtx);
  const [mode, setMode] = useState<"grid" | "map">("grid"), [focus, setFocus] = useState<{ id: string; t: number } | null>(null);
  const [q, setQ] = useState(""), [cat, setCat] = useState<"All" | Cat>("All"), [stat, setStat] = useState("All"), [bud, setBud] = useState(0), [sort, setSort] = useState<SortKey>("rec");
  const list = useMemo(() => {
    const f = DESTS.filter((d) => (cat === "All" || d.cat === cat) && (stat === "All" || (stat === "Verified") === d.verified) && (!bud || d.budget === bud) && (d.name + d.place + d.cat).toLowerCase().includes(q.toLowerCase()));
    const key = (d: Dest) => (sort === "fare" ? legTotals(d).f0 : sort === "time" ? legTotals(d).t : sort === "fresh" ? ago(d) : 0);
    return sort === "rec" ? f : [...f].sort((a, b) => key(a) - key(b));
  }, [q, cat, stat, bud, sort, ago]);
  const people = new Set(DESTS.flatMap((d) => d.people.map((p) => p.n))).size;
  const legs = DESTS.reduce((a, d) => a + d.legs.length, 0);
  const dirty = q || cat !== "All" || stat !== "All" || bud || sort !== "rec";
  const reset = () => { setQ(""); setCat("All"); setStat("All"); setBud(0); setSort("rec"); };
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="pill"><Icon name="leaf" size={14} />Crowd-sourced · locally verified</span>
          <h2>Know the road <em>before</em> you go.</h2>
          <p>Leg-by-leg directions, fares and landmarks for places Google Maps skips, confirmed by the people who ride these roads.</p>
          <label className="hero-search">
            <Icon name="search" size={20} />
            <input type="search" placeholder="Try “Tangadan”, “beach” or “San Juan”" aria-label="Search destinations" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && document.getElementById("results")?.scrollIntoView({ behavior: "smooth" })} />
          </label>
          <button className="start-chip" onClick={st.change}><Icon name="pin" size={16} />Starting from <b>{st.name.split(",")[0]}</b><span>Change</span></button>
          <div className="hero-cta">
            <button className="btn lime" onClick={() => { setMode("map"); document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }); }}><Icon name="map" size={18} />Browse the map</button>
            <button className="btn outline-light" onClick={() => { setMode("grid"); document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }); }}>See all destinations</button>
          </div>
          <dl className="hero-stats">
            <div><dt>Destinations</dt><dd>{DESTS.length}</dd></div>
            <div><dt>Route legs</dt><dd>{legs}</dd></div>
            <div><dt>Contributors</dt><dd>{people}</dd></div>
          </dl>
        </div>
        <div className="hero-art"><RoadArt /></div>
      </section>

      <section className="filters" aria-label="Filter destinations">
        <div className="chips" role="group" aria-label="Category">
          {(["All", ...CATS] as const).map((c) => (
            <button key={c} className={`chip ${cat === c ? "on" : ""}`} aria-pressed={cat === c} onClick={() => setCat(c)}>{c !== "All" && <Icon name={catIcon[c]} size={15} />}{c}</button>
          ))}
        </div>
        <div className="filter-tools">
          <div className="seg" role="group" aria-label="Route status">
            {["All", "Verified", "Pending"].map((s) => { const v = s === "Pending" ? "Sample" : s; return <button key={s} className={stat === v ? "on" : ""} aria-pressed={stat === v} onClick={() => setStat(v)}>{s}</button>; })}
          </div>
          <div className="seg" role="group" aria-label="Budget">
            {[1, 2, 3].map((b) => <button key={b} className={bud === b ? "on" : ""} aria-pressed={bud === b} aria-label={`Budget level ${b} of 3`} onClick={() => setBud(bud === b ? 0 : b)}>{"₱".repeat(b)}</button>)}
          </div>
          <label className="select-wrap"><span className="sr">Sort by</span><Icon name="sliders" size={16} />
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
        </div>
      </section>

      <div className="results-head" id="results" aria-live="polite">
        <h3>{list.length} {list.length === 1 ? "destination" : "destinations"}<small> across Region I</small></h3>
        <div className="head-tools">
          {dirty && <button className="link" onClick={reset}><Icon name="refresh" size={14} />Clear filters</button>}
          <div className="seg view-toggle" role="group" aria-label="View">
            <button className={mode === "grid" ? "on" : ""} aria-pressed={mode === "grid"} onClick={() => setMode("grid")}><Icon name="sliders" size={16} />List</button>
            <button className={mode === "map" ? "on" : ""} aria-pressed={mode === "map"} onClick={() => setMode("map")}><Icon name="map" size={16} />Map</button>
          </div>
        </div>
      </div>
      {!list.length
        ? <Empty icon="search" title="No destinations match" text="Try a different category or clear your filters to see everything." cta="Clear filters" onCta={reset} />
        : mode === "grid"
          ? <div className="grid">{list.map((d) => <DestCard key={d.id} d={d} ago={ago(d)} saved={saved.includes(d.id)} onOpen={() => open(d.id)} onSave={() => toggleSave(d.id)} />)}</div>
          : (
            <div className="mapsplit">
              <MapView onPick={st.pick} label="Map of destinations" height="100%" className="tall" focus={focus} onSelect={(id) => setFocus({ id, t: Date.now() })}
                points={[{ id: "origin", ...st, label: st.name.split(",")[0], sub: (st.landmark ?? "Your starting point"), kind: "origin" }, ...list.map((d, i): MapPoint => ({ id: d.id, ...GEO[d.id], label: d.name, sub: `${d.place} · ${fareText({ fMin: legTotals(d).f0, fMax: legTotals(d).f1 })}`, kind: "dest", n: i + 1, onOpen: () => open(d.id) }))]} />
              <ul className="maplist">
                {list.map((d, i) => (
                  <li key={d.id}><button className={focus?.id === d.id ? "on" : ""} onClick={() => setFocus({ id: d.id, t: Date.now() })}>
                    <span className="mthumb"><Pic d={d} /><b>{i + 1}</b></span>
                    <span className="mtxt"><strong>{d.name}</strong><small>{d.place}</small><small>{fareText({ fMin: legTotals(d).f0, fMax: legTotals(d).f1 })} · ~{hm(legTotals(d).t)}</small></span>
                  </button><button className="icon-btn sm" aria-label={`Open ${d.name}`} onClick={() => open(d.id)}><Icon name="chevron" size={16} /></button></li>
                ))}
              </ul>
            </div>
          )}

      <section className="next">
        <div><span className="eyebrow">Roadmap</span><h3>More regions on the way</h3></div>
        <ul>{["Baguio", "Sagada", "Banaue", "Sanga", "Camiguin", "Bohol", "Palawan", "Cebu"].map((c) => <li key={c}>{c}</li>)}</ul>
      </section>
    </>
  );
}

function RouteDetail({ d, ago, saved, onSave, onAdd, inTrip, onConfirm, onBack }: { d: Dest; ago: number; saved: boolean; onSave: () => void; onAdd: () => void; inTrip: boolean; onConfirm: () => void; onBack: () => void }) {
  const st = useContext(StartCtx);
  const t = legTotals(d);
  const sp = STOPS[d.id] ?? [];
  const routePts: MapPoint[] = [{ id: "origin", ...st, label: st.name.split(",")[0], sub: st.landmark ?? "Your starting point", kind: "origin" },
    ...sp.slice(0, -1).map((s, i): MapPoint => ({ id: "s" + i, lat: s.lat, lng: s.lng, label: s.name, sub: `End of step ${i + 1} · ${d.legs[i].mode}`, kind: "stop", n: i + 1 })),
    { id: d.id, ...GEO[d.id], label: d.name, sub: d.place, kind: "dest", n: sp.length || 1 }];
  const ids = routePts.map((x) => x.id);
  const routeLines = ids.slice(1).map((id, i) => [ids[i], id, MODE_COLOR[d.legs[Math.min(i, d.legs.length - 1)].mode], d.legs[Math.min(i, d.legs.length - 1)].mode] as [string, string, string, string]);
  const addLabel = inTrip ? "In your trip · Open planner" : "Add to trip";
  return (
    <>
      <button className="back" onClick={onBack}><Icon name="arrow-left" size={17} />All destinations</button>
      <header className="d-hero">
        <Pic d={d} credit />
        <div className="d-hero-shade" />
        <div className="d-hero-top"><Badge d={d} onDark /><button className={`save ${saved ? "on" : ""}`} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save destination"} onClick={onSave}><Icon name={saved ? "bookmark-fill" : "bookmark"} size={18} /></button></div>
        <div className="d-hero-copy">
          <span className="kicker light"><Icon name={catIcon[d.cat]} size={14} />{d.cat}</span>
          <h2>{d.name}</h2>
          <p><Icon name="pin" size={16} />{d.place}</p>
        </div>
      </header>

      <div className="d-grid">
        <div className="d-main">
          <p className="lead">{d.blurb}</p>
          <dl className="facts">
            <div><dt><Icon name="pin" size={15} />From</dt><dd>{st.name.split(",")[0]}</dd></div>
            <div><dt><Icon name="wallet" size={15} />Est. fare</dt><dd>{fareText({ fMin: t.f0, fMax: t.f1 })}</dd></div>
            <div><dt><Icon name="clock" size={15} />Travel time</dt><dd>~{hm(t.t)}</dd></div>
            <div><dt><Icon name="swap" size={15} />Transfers</dt><dd>{d.legs.length - 1}</dd></div>
          </dl>

          <nav className="jump" aria-label="On this page">
            {[["route-map", "map", "Map"], ["route-steps", "route", "Steps"], ["route-trust", "shield", "Trust"]].map(([id, ic, l]) => (
              <button key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}><Icon name={ic as IconName} size={16} />{l}</button>
            ))}
          </nav>

          {km(st, DEFAULT_START) > 3 && <p className="warn start-warn"><Icon name="alert" size={18} /><span>The steps below begin at San Fernando. You are about {Math.round(km(st, DEFAULT_START))} km from there, so use the Google Maps or OpenStreetMap links to reach the first stop.</span></p>}
          <div className="sec-head" id="route-steps"><h3>How to get there</h3><span>{d.legs.length} local legs</span></div>
          <ol className="journey">
            <li className="jstop start"><span className="jnode"><Icon name="pin" size={14} /></span><div><strong>Start · {st.name.split(",")[0]}</strong><small>{(st.landmark ?? "Your starting point")}</small></div></li>
            {d.legs.map((l, i) => (
              <li className="leg" key={i} data-k={modeKey(l.mode)}>
                <span className="jnode lg"><Icon name={modeIcon[l.mode]} size={20} /></span>
                <article>
                  <div className="leg-top"><span className="mode-tag">Step {i + 1} · {l.mode}</span><Freshness days={ago} /></div>
                  <h4>{l.from}<Icon name="arrow" size={16} />{l.to}</h4>
                  <div className="leg-stats">
                    <span><Icon name="wallet" size={15} /><small>Fare</small><b>{fareText(l)}</b></span>
                    <span><Icon name="clock" size={15} /><small>Time</small><b>{l.tMin === l.tMax ? `${l.tMin} min` : `${l.tMin}–${l.tMax} min`}</b></span>
                  </div>
                  <p className="look"><Icon name="info" size={16} /><span><b>Look for</b>{l.look}</span></p>
                </article>
              </li>
            ))}
            <li className="jstop end"><span className="jnode"><Icon name="flag" size={14} /></span><div><strong>Arrive · {d.name}</strong><small>{d.place}</small></div></li>
          </ol>
        </div>

        <aside className="d-side">
          <section className="route-map-card" id="route-map">
            <div className="sec-head"><h3>Route map</h3><span>≈ {Math.round(km(st, GEO[d.id]))} km straight line</span></div>
            <div className="route-map-body"><MapView onPick={st.pick} label={`Map from ${st.name.split(",")[0]} to ${d.name}`} height="100%" points={routePts} lines={routeLines} /></div>
            <div className="map-actions">
              <p className="muted"><Icon name="info" size={15} />Lines follow real roads from OpenStreetMap, like Google Maps. Stops are approximate; the last stretch to a trailhead or island may be off-road. Right-click or long-press to change your start. The compass follows your live location.</p>
              <div className="row2">
                <a className="btn secondary sm" href={directionsLinks(d.id, st).google} target="_blank" rel="noreferrer"><Icon name="arrow" size={15} />Open in Google Maps</a>
                <a className="btn secondary sm" href={directionsLinks(d.id, st).osm} target="_blank" rel="noreferrer"><Icon name="arrow" size={15} />OpenStreetMap</a>
              </div>
            </div>
          </section>
          <section className="trust" id="route-trust">
            <span className="kicker light"><Icon name="shield" size={14} />Transparency</span>
            <h3>Why this route can be trusted</h3>
            <ul>
              <li><Icon name="check" size={16} />{d.people.length > 1 ? "Route corroborated" : "Single source, awaiting a second confirmation"}</li>
              <li><Icon name="check" size={16} />Local contributor included</li>
              <li><Icon name="check" size={16} />Last checked {dateAgo(ago)}</li>
            </ul>
          </section>
          <section className="panel">
            <h4>Verified by {d.people.length} {d.people.length === 1 ? "contributor" : "contributors"}</h4>
            <ul className="people">{d.people.map((p) => <li key={p.n}><span className="avatar sm">{p.n.slice(0, 2).toUpperCase()}</span><div><b>{p.n}</b><small>{p.role}</small></div><Icon name="check" size={16} /></li>)}</ul>
          </section>
          <p className="warn"><Icon name="alert" size={18} /><span>Local conditions can change. Confirm locally when necessary, especially after severe weather.</span></p>
          <div className="actions">
            <button className="btn primary lg" onClick={onAdd}><Icon name={inTrip ? "route" : "plus"} size={18} />{addLabel}</button>
            <div className="row2"><button className="btn secondary" onClick={onSave}><Icon name={saved ? "bookmark-fill" : "bookmark"} size={17} />{saved ? "Saved" : "Save"}</button><button className="btn secondary" onClick={onConfirm}><Icon name="check" size={17} />Still accurate?</button></div>
          </div>
        </aside>
      </div>

      <div className="cta-bar">
        <button className="btn secondary icon-only" aria-label={saved ? "Remove from saved" : "Save"} onClick={onSave}><Icon name={saved ? "bookmark-fill" : "bookmark"} size={20} /></button>
        <button className="btn primary lg" onClick={onAdd}><Icon name={inTrip ? "route" : "plus"} size={18} />{addLabel}</button>
      </div>
    </>
  );
}

function Stepper({ label, icon, value, min, max, unit, set }: { label: string; icon: IconName; value: number; min: number; max: number; unit?: [string, string]; set: (n: number) => void }) {
  return (
    <div className="stepper-card">
      <span className="lbl"><Icon name={icon} size={15} />{label}</span>
      <div className="stepper">
        <button aria-label={`Decrease ${label.toLowerCase()}`} disabled={value <= min} onClick={() => set(value - 1)}><Icon name="minus" size={16} /></button>
        <strong aria-live="polite">{value}{unit ? <small> {value === 1 ? unit[0] : unit[1]}</small> : null}</strong>
        <button aria-label={`Increase ${label.toLowerCase()}`} disabled={value >= max} onClick={() => set(value + 1)}><Icon name="plus" size={16} /></button>
      </div>
    </div>
  );
}

function TripPlanner(p: { stops: string[]; setStops: (s: string[]) => void; days: number; setDays: (n: number) => void; people: number; setPeople: (n: number) => void; open: (id: string) => void }) {
  const { stops, days, people } = p;
  const st = useContext(StartCtx);
  const [day, setDay] = useState(0);
  const plan = useMemo(() => tripPlan(stops, days, st.name, st.landmark), [stops, days, st.name, st.landmark]);
  const di = Math.min(day, days - 1);
  const cur = plan.days[di];
  const free = DESTS.filter((d) => !stops.includes(d.id));
  const move = (i: number) => { const s = [...stops]; [s[i - 1], s[i]] = [s[i], s[i - 1]]; p.setStops(s); };
  const hero = plan.stops[0];
  const geo = useMemo(() => dayGeometry(cur.stops, st, p.open), [cur, st]);
  return (
    <div className="plan">
      <section className="plan-controls no-print" aria-label="Trip settings">
        <div className="card-pad">
          <span className="eyebrow">Build a real journey</span>
          <h2>{days}-day Region I trip</h2>

          <div className="startpoint"><span className="jnode"><Icon name="pin" size={14} /></span><div><small>Starting point</small><strong>{st.name}</strong></div></div>

          <div className="sec-head sm"><h3>Your stops</h3><span>{stops.length}</span></div>
          {!stops.length && <p className="hint">No stops yet. Add a destination below to build your itinerary.</p>}
          <ol className="stops">
            {stops.map((id, i) => { const d = DESTS.find((x) => x.id === id)!; return (
              <li key={id}>
                <span className="num">{i + 1}</span>
                <div><b>{d.name}</b><small>{d.place}</small></div>
                {i > 0 && <button className="icon-btn sm" aria-label={`Move ${d.name} earlier`} onClick={() => move(i)}><Icon name="up" size={16} /></button>}
                <button className="icon-btn sm" aria-label={`Remove ${d.name}`} onClick={() => p.setStops(stops.filter((s) => s !== id))}><Icon name="x" size={16} /></button>
              </li>); })}
          </ol>
          {free.length > 0 && (
            <label className="add-stop"><Icon name="plus" size={17} />
              <select aria-label="Add destination" value="" onChange={(e) => e.target.value && p.setStops([...stops, e.target.value])}>
                <option value="">Add a destination</option>{free.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.place}</option>)}
              </select>
            </label>
          )}

          <div className="two">
            <Stepper label="Duration" icon="calendar" value={days} min={1} max={7} unit={["day", "days"]} set={p.setDays} />
            <Stepper label="Travelers" icon="users" value={people} min={1} max={12} set={p.setPeople} />
          </div>

          <dl className="totals">
            <div><dt><Icon name="clock" size={14} />Travel time</dt><dd>{hm(plan.minutes)}</dd></div>
            <div><dt><Icon name="wallet" size={14} />Est. fare</dt><dd>{peso(plan.fMin * people)}–{peso(plan.fMax * people)}</dd></div>
            <div><dt><Icon name="swap" size={14} />Transfers</dt><dd>{plan.transfers}</dd></div>
            <div><dt><Icon name="flag" size={14} />Stops</dt><dd>{stops.length}</dd></div>
          </dl>
          <button className="btn primary lg" disabled={!stops.length} onClick={() => { setDay(0); window.print(); }}><Icon name="printer" size={18} />Download trip sheet</button>
          <p className="hint center">Opens your print dialog. Choose “Save as PDF” to keep an offline copy.</p>
        </div>
      </section>

      <section className="sheet print-area" aria-label="Itinerary">
        <div className="sheet-hero">
          <Pic d={hero ?? { id: "none", cat: "Beach", name: "La Union" }} />
          <div className="d-hero-shade" />
          <div className="sheet-hero-in">
            <span className="pill light"><Icon name="download" size={14} />Offline copy</span>
            <div>
              <span className="eyebrow light">Region I trip sheet · {people} {people === 1 ? "traveler" : "travelers"}</span>
              <h2>{days} {days === 1 ? "day" : "days"} <i>/</i> {Math.max(days - 1, 0)} {days === 2 ? "night" : "nights"}</h2>
              <p>{stops.length ? plan.stops.map((s) => s.name).join(" · ") : "Add destinations to build your itinerary"}</p>
            </div>
          </div>
        </div>

        <div className="tabs-day no-print" role="tablist" aria-label="Trip days">
          {plan.days.map((dd, n) => (
            <button key={n} role="tab" aria-selected={di === n} className={di === n ? "on" : ""} onClick={() => setDay(n)}>
              <small>Day</small><b>{n + 1}</b>{dd.stops.length > 0 && <i className="has" aria-hidden="true" />}
            </button>
          ))}
        </div>

        <div className="sheet-map no-print">
          <MapView onPick={st.pick} label={`Map for day ${di + 1}`} height="clamp(300px, 44dvh, 480px)" points={geo.pts} lines={geo.lines} />
          <p className="muted"><Icon name="info" size={15} />{cur.stops.length ? `Day ${di + 1}: ${cur.stops.map((s) => s.name).join(" + ")}, routed from ${st.name.split(",")[0]} along real roads. Tap a day to switch the map.` : `Day ${di + 1} is a free day. Add a destination to see its route.`}</p>
        </div>

        {plan.days.map((dd, n) => (
          <div key={n} className={n === di ? "day" : "day print-only"} role={n === di ? "tabpanel" : undefined}>
            <div className="day-head"><span className="eyebrow">Day {n + 1}</span><h3>{dd.stops.length ? dd.stops.map((s) => s.name).join(" + ") : "Free day"}</h3></div>
            <ol className="timeline">
              {dd.events.map((e, i) => (
                <li key={i} data-k={e.icon}>
                  <time>{e.time}</time>
                  <span className="tnode"><Icon name={e.icon} size={16} /></span>
                  <div className="tev"><strong>{e.title}</strong><span>{e.meta}</span></div>
                  {e.duration && <span className="dur">{e.duration}</span>}
                </li>
              ))}
            </ol>
          </div>
        ))}

        {cur.stops[0] && (
          <div className="safety no-print">
            <Icon name="shield" size={20} /><div><strong>Check each route before you go</strong><span>Fares and times are estimates and may change.</span></div>
            <button className="btn ghost sm" onClick={() => p.open(cur.stops[0].id)}>View route</button>
          </div>
        )}
        <p className="fine">Route conditions can change. Confirm locally before each leg.</p>
      </section>
    </div>
  );
}

function Ring({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r;
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" className="ring-bg" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" strokeLinecap="round" className="ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dy=".35em" textAnchor="middle" className="ring-t">{Math.round(pct)}%</text>
    </svg>
  );
}

function Offline({ ready, prog, start, remove, go }: { ready: string[]; prog: Record<string, number>; start: (id: string) => void; remove: (id: string) => void; go: (v: string) => void }) {
  const mb = PACKS.filter((k) => ready.includes(k.id)).reduce((a, k) => a + k.mb, 0);
  return (
    <>
      <section className={`status-banner ${ready.length ? "ok" : ""}`}>
        <span className="sb-ic"><Icon name={ready.length ? "check" : "cloud"} size={22} /></span>
        <div><strong>{ready.length ? "You're offline-ready" : "Nothing downloaded yet"}</strong><span>{ready.length ? "Downloaded routes stay available when signal is limited." : "Download a region pack before you leave coverage."}</span></div>
        <dl><dt>Stored</dt><dd>{mb.toFixed(1)} <small>MB</small></dd></dl>
      </section>
      <div className="packs">
        {PACKS.map((k) => { const ok = ready.includes(k.id), pr = prog[k.id]; return (
          <article className={`pack ${ok ? "ok" : ""}`} key={k.id}>
            <div className="pack-head">
              <div><span className="kicker"><Icon name="map" size={13} />Region pack</span><h3>{k.name}</h3><p className="place">Updated {k.updated}</p></div>
              {pr !== undefined ? <Ring pct={Math.min(pr, 100)} /> : ok ? <span className="badge ok"><Icon name="check" size={13} />Downloaded</span> : <span className="pack-ic"><Icon name="cloud" size={22} /></span>}
            </div>
            <dl className="pack-stats">
              <div><dd>{k.routes}</dd><dt>routes</dt></div>
              <div><dd>{k.dests}</dd><dt>destinations</dt></div>
              <div><dd>{k.mb}</dd><dt>MB</dt></div>
            </dl>
            <div className="row2">
              {ok ? <><button className="btn primary" onClick={() => go("explore")}>Open routes</button><button className="btn secondary" onClick={() => go("trip")}>Trip sheet</button><button className="btn secondary danger icon-only" aria-label={`Remove ${k.name} pack`} onClick={() => remove(k.id)}><Icon name="trash" size={18} /></button></>
                : <button className="btn primary" disabled={pr !== undefined} onClick={() => start(k.id)}><Icon name="download" size={18} />{pr !== undefined ? `Downloading ${Math.min(Math.round(pr), 100)}%` : "Download region pack"}</button>}
            </div>
          </article>); })}
      </div>
    </>
  );
}

function Contribute({ subs, submit }: { subs: Submission[]; submit: (s: Omit<Submission, "id" | "at">) => void }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ dest: "", start: "", mode: "Jeepney" as Mode, fare: "", look: "" });
  const ok1 = f.dest.trim() && f.start.trim(), ok2 = f.look.trim() && Number(f.fare) >= 0 && f.fare !== "";
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });
  const LABELS = ["Route", "Details", "Review"];
  return (
    <div className="contribute">
      <section className="panel form" aria-label="Submit a route">
        <ol className="stepbar" aria-label="Progress">
          {LABELS.map((l, i) => <li key={l} className={step > i + 1 ? "done" : step === i + 1 ? "cur" : ""} aria-current={step === i + 1 ? "step" : undefined}><span>{step > i + 1 ? <Icon name="check" size={14} /> : i + 1}</span>{l}</li>)}
        </ol>
        {step === 1 && <>
          <h2>Where does this route go?</h2><p className="sub-lead">Start with the two places you know best.</p>
          <label className="field">Destination<input value={f.dest} placeholder="e.g. Tangadan Falls" onChange={(e) => set("dest", e.target.value)} /></label>
          <label className="field">Starting point<input value={f.start} placeholder="e.g. San Gabriel Public Market" onChange={(e) => set("start", e.target.value)} /></label>
          <fieldset className="modes"><legend>Transport type</legend>
            {MODES.map((m) => <button type="button" key={m} data-k={modeKey(m)} className={f.mode === m ? "on" : ""} aria-pressed={f.mode === m} onClick={() => set("mode", m)}><Icon name={modeIcon[m]} size={22} />{m}</button>)}
          </fieldset></>}
        {step === 2 && <>
          <h2>Fare and landmark</h2><p className="sub-lead">Details that save a stranger from getting lost.</p>
          <label className="field">Fare in ₱ (0 if free)<input type="number" inputMode="numeric" min="0" value={f.fare} placeholder="e.g. 40" onChange={(e) => set("fare", e.target.value)} /></label>
          <label className="field">What should travelers look for?<textarea rows={4} value={f.look} placeholder="e.g. Get off near the public market" onChange={(e) => set("look", e.target.value)} /></label></>}
        {step === 3 && <>
          <h2>Review and submit</h2><p className="sub-lead">Check everything looks right.</p>
          <dl className="review"><div><dt>Route</dt><dd>{f.start} <Icon name="arrow" size={14} /> {f.dest}</dd></div><div><dt>Transport</dt><dd>{f.mode}</dd></div><div><dt>Fare</dt><dd>{peso(Number(f.fare))}</dd></div><div><dt>Look for</dt><dd>{f.look}</dd></div></dl>
          <p className="warn"><Icon name="shield" size={18} /><span>Every route is reviewed by the community and a local verifier before it is published.</span></p></>}
        <div className="form-actions">
          {step > 1 && <button className="btn secondary" onClick={() => setStep(step - 1)}><Icon name="arrow-left" size={16} />Back</button>}
          {step < 3 ? <button className="btn primary" disabled={step === 1 ? !ok1 : !ok2} onClick={() => setStep(step + 1)}>Continue<Icon name="arrow" size={16} /></button>
            : <button className="btn primary" onClick={() => { submit(f); setF({ dest: "", start: "", mode: "Jeepney", fare: "", look: "" }); setStep(1); }}><Icon name="check" size={17} />Submit route</button>}
        </div>
      </section>
      <div className="side-col">
        <section className="panel"><h3>Who can contribute?</h3><ul className="roles">{ROLES.map(([r, ic]) => <li key={r}><Icon name={ic} size={16} />{r}</li>)}</ul>
          <p className="muted">You already know these roads. Help someone else get there.</p></section>
        <section className="panel"><h3>Your submissions</h3>
          {!subs.length && <p className="muted">Nothing submitted yet. Your routes will appear here with their review status.</p>}
          <ul className="subs">{subs.map((s) => (
            <li key={s.id}><div className="sub-top"><b>{s.start}<Icon name="arrow" size={14} />{s.dest}</b><small>{s.mode} · {peso(Number(s.fare))} · {new Date(s.at).toLocaleDateString("en", { month: "short", day: "numeric" })}</small></div>
              <ol className="track">{STAGES.map((t, i) => <li key={t.t} className={i === 0 ? "done" : i === 1 ? "cur" : ""}><span>{t.t}</span></li>)}</ol></li>
          ))}</ul>
        </section>
      </div>
    </div>
  );
}

/* ───────────── app ───────────── */
export default function App() {
  const [{ view, sel }, setLoc] = useState(readHash);
  const [saved, setSaved] = useStored<string[]>("saved", []);
  const [stops, setStops] = useStored<string[]>("stops", ["tangadan", "urbiztondo", "vigan"]);
  const [days, setDays] = useStored<number>("days", 3), [people, setPeople] = useStored<number>("people", 2);
  const [ready, setReady] = useStored<string[]>("ready", ["launion"]);
  const [confirmed, setConfirmed] = useStored<Record<string, number>>("confirmed", {});
  const [subs, setSubs] = useStored<Submission[]>("subs", []);
  const [read, setRead] = useStored<boolean>("read", false);
  const [prog, setProg] = useState<Record<string, number>>({});
  const [start, setStart] = useStored<Place>("start", DEFAULT_START), [startOpen, setStartOpen] = useState(false);
  const [palette, setPalette] = useState(false), [help, setHelp] = useState(false), [bell, setBell] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number>(0);
  const say = (m: string) => { setToast(m); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(""), 2600); };
  const go = (v: string) => { setBell(false); location.hash = `#/${v}`; };
  const open = (id: string) => { location.hash = `#/route/${id}`; setBell(false); };
  const toggleSave = (id: string) => { const on = saved.includes(id); setSaved(on ? saved.filter((x) => x !== id) : [...saved, id]); say(on ? "Removed from saved" : "Saved to your shortlist"); };
  const [manual, setManual] = useStored<boolean>("startManual", false);
  useEffect(() => {
    if (manual || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (km(c, start) < 0.3) return;
      const name = await reverse(c.lat, c.lng); setStart({ name, ...c }); say(`Starting from your location: ${name.split(",")[0]}`);
    }, () => {}, { timeout: 10000, maximumAge: 600000 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const setPlace = (p: Place) => { setManual(true); setStart(p); say(`Starting from ${p.name.split(",")[0]}`); };
  const pickPlace = async (c: { lat: number; lng: number }) => setPlace({ name: await reverse(c.lat, c.lng), ...c });
  const ctx: StartCtxT = { ...start, change: () => setStartOpen(true), set: setPlace, pick: pickPlace };
  const d = DESTS.find((x) => x.id === sel)!;
  const ago = (x: Dest) => confirmed[x.id] ?? x.daysAgo;

  useEffect(() => {
    const h = () => { setLoc(readHash()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  useEffect(() => {
    if (!bell) return;
    const c = (e: MouseEvent) => { if (!(e.target as Element).closest(".bell-wrap")) setBell(false); };
    document.addEventListener("mousedown", c); return () => document.removeEventListener("mousedown", c);
  }, [bell]);
  useEffect(() => { document.title = view === "route" ? `${d.name} · Padaan` : `${titles[view][1]} · Padaan`; }, [view, d.name]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette(true); }
      if (e.key === "Escape") { setPalette(false); setHelp(false); setBell(false); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  // Region-pack download progress.
  useEffect(() => {
    if (!Object.keys(prog).length) return;
    const t = window.setTimeout(() => setProg((x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v + 20]))), 350);
    return () => window.clearTimeout(t);
  }, [prog]);
  useEffect(() => {
    const done = Object.keys(prog).filter((k) => prog[k] >= 100);
    if (!done.length) return;
    setReady((r) => [...new Set([...r, ...done])]);
    setProg((x) => { const n = { ...x }; done.forEach((k) => delete n[k]); return n; });
    say("Region pack ready offline");
  }, [prog, setReady]);

  return (
    <StartCtx.Provider value={ctx}>
    <div className="app">
      <a className="skip" href="#main">Skip to content</a>
      <Rail view={view} go={go} ready={ready} savedN={saved.length} />
      <div className="stage">
        <Topbar start={start.name.split(",")[0]} onStart={() => setStartOpen(true)} view={view} unread={!read} onSearch={() => setPalette(true)} onHelp={() => setHelp(true)} bell={bell} onBell={() => setBell(!bell)} onRead={() => { setRead(true); setBell(false); }} onHome={() => go("explore")} />
        <main id="main" className={`page v-${view}`} key={view + (view === "route" ? sel : "")}>
          {view === "explore" && <Explore saved={saved} toggleSave={toggleSave} open={open} ago={ago} />}
          {view === "route" && <RouteDetail d={d} ago={ago(d)} saved={saved.includes(d.id)} onSave={() => toggleSave(d.id)} inTrip={stops.includes(d.id)} onBack={() => history.length > 1 ? history.back() : go("explore")}
            onAdd={() => { if (!stops.includes(d.id)) { setStops([...stops, d.id]); say(`${d.name} added to your trip`); } go("trip"); }}
            onConfirm={() => { setConfirmed({ ...confirmed, [d.id]: 0 }); say("Thanks. Marked as confirmed today."); }} />}
          {view === "trip" && <TripPlanner stops={stops} setStops={setStops} days={days} setDays={setDays} people={people} setPeople={setPeople} open={open} />}
          {view === "saved" && (saved.length
            ? <div className="grid">{DESTS.filter((x) => saved.includes(x.id)).map((x) => <DestCard key={x.id} d={x} ago={ago(x)} saved onOpen={() => open(x.id)} onSave={() => toggleSave(x.id)} />)}</div>
            : <Empty icon="bookmark" title="Nothing saved yet" text="Tap the bookmark on any destination to keep it here for later." cta="Explore destinations" onCta={() => go("explore")} />)}
          {view === "offline" && <Offline ready={ready} prog={prog} start={(id) => setProg({ ...prog, [id]: 0 })} remove={(id) => { setReady(ready.filter((x) => x !== id)); say("Region pack removed"); }} go={go} />}
          {view === "contribute" && <Contribute subs={subs} submit={(s) => { setSubs([{ ...s, id: crypto.randomUUID(), at: Date.now() }, ...subs]); say("Route submitted for review"); }} />}
          <footer className="foot">Padaan · The Road There · Team GEIST, DMMMSU College of Information Technology</footer>
        </main>
      </div>
      {startOpen && <StartModal st={ctx} onClose={() => setStartOpen(false)} />}
      {palette && <Palette onClose={() => setPalette(false)} go={go} open={open} />}
      {help && (
        <Modal title="Help &amp; tips" onClose={() => setHelp(false)}>
          <ul className="sos"><li><span><Icon name="phone" size={17} />National emergency hotline</span><b>911</b></li></ul>
          <ul className="tips">
            <li><Icon name="wallet" size={17} /><span>Fares and travel times are estimates. Agree on tricycle and habal-habal fares <b>before</b> you ride.</span></li>
            <li><Icon name="pin" size={17} /><span>Confirm the last leg with a local when you arrive. Landmarks are the most reliable guide.</span></li>
            <li><Icon name="download" size={17} /><span>Download a region pack before leaving coverage so routes still work offline.</span></li>
            <li><Icon name="alert" size={17} /><span>Conditions change, especially after bad weather. Check the “last confirmed” date on every route.</span></li>
          </ul>
        </Modal>
      )}
      <div className="toast-zone" aria-live="polite">{toast && <div className="toast" role="status"><Icon name="check" size={16} />{toast}</div>}</div>
    </div>
    </StartCtx.Provider>
  );
}
