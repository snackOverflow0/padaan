import { createContext, useContext, useEffect, useMemo, useRef, useState, type PointerEvent as RPE, type ReactNode } from "react";
import { reverse, searchPlaces } from "./geo";
import { Icon, type IconName } from "./icons";
import { Pic } from "./photos";
import { DesktopHome } from "./DesktopHome";
import { LoginPage } from "./Login";
import { clearGuest, currentUser, isGuest, signOut, type User } from "./auth";
import { buildTrip, smartPlan, type Pace } from "./planner";
import { MapView, type MapPoint } from "./map";
import {
  CATS, DEFAULT_START, DESTS, GEO, MODES, PACKS, STOPS, ROLES, directionsLinks, km, agoText, catIcon, dateAgo, fareText, fresh, hm, legTotals, modeIcon, modeKey, peso,
  type Cat, type Dest, type Mode, type Place,
} from "./data";

/* ───────────── starting point ───────────── */
type StartCtxT = Place & { account: () => void; initials: string; change: () => void; set: (p: Place) => void; pick: (p: { lat: number; lng: number }) => void };
const StartCtx = createContext<StartCtxT>({ ...DEFAULT_START, account: () => {}, initials: "G", change: () => {}, set: () => {}, pick: () => {} });
const MODE_COLOR: Record<Mode, string> = { Jeepney: "#188038", Tricycle: "#e37400", "Habal-habal": "#d93025", Bus: "#1a73e8", Boat: "#129eaf", Walk: "#5f6368" };

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
  { id: "explore", label: "Explore", short: "Explore", icon: "explore" },
  { id: "trip", label: "Trip planner", short: "Trips", icon: "directions" },
  { id: "saved", label: "Saved", short: "Saved", icon: "bookmark" },
  { id: "offline", label: "Offline packs", short: "Offline", icon: "download" },
  { id: "contribute", label: "Contribute", short: "Share", icon: "plus" },
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
    if (!sp.length) { pts.push(dest); lines.push(["origin", d.id, "#188038", "Jeepney"]); return; }
    sp.forEach((s, i) => {
      const last = i === sp.length - 1, id = last ? d.id : `${d.id}-s${i}`, mode = d.legs[Math.min(i, d.legs.length - 1)].mode;
      pts.push(last ? dest : { id, lat: s.lat, lng: s.lng, label: s.name, sub: `${d.name} · step ${i + 1} (${mode})`, kind: "stop", n: i + 1 });
      lines.push([prev, id, MODE_COLOR[mode], mode]); prev = id;
    });
  });
  return { pts, lines };
}

const useMedia = (q: string) => {
  const [m, setM] = useState(() => typeof matchMedia !== "undefined" && matchMedia(q).matches);
  useEffect(() => { const l = matchMedia(q), f = () => setM(l.matches); f(); l.addEventListener("change", f); return () => l.removeEventListener("change", f); }, [q]);
  return m;
};

function AccountBtn({ className }: { className: string }) {
  const c = useContext(StartCtx);
  return <button className={className} onClick={c.account} aria-label="Account">{c.initials}</button>;
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

function DeskNav(p: { view: string; go: (v: string) => void; ready: string[]; savedN: number; start: string; onStart: () => void; onSearch: () => void; onHelp: () => void; onBell: () => void; unread: boolean }) {
  return (
    <header className="dnav">
      <button className="dn-brand" onClick={() => p.go("explore")} aria-label="Padaan home"><img src="/logo-mark.png" alt="" /><span><b>padaan</b><small>The Road There</small></span></button>
      <nav className="dn-links" aria-label="Main">
        {nav.map((n) => {
          const on = p.view === n.id || (p.view === "route" && n.id === "explore");
          const badge = n.id === "offline" ? p.ready.length : n.id === "saved" ? p.savedN : 0;
          return (
            <button key={n.id} className={`dn-link ${on ? "on" : ""}`} aria-current={on ? "page" : undefined} onClick={() => p.go(n.id)}>
              <span className="dn-ic"><Icon name={on && n.id === "saved" ? "bookmark-fill" : n.icon} size={22} />{badge > 0 && <b className="dn-badge">{badge}</b>}</span>
              <span>{n.short}</span>
            </button>
          );
        })}
      </nav>
      <div className="dn-tools">
        <button className="dn-start" onClick={p.onStart} aria-label={`Starting point: ${p.start}. Change`}><Icon name="pin" size={17} /><span>{p.start}</span></button>
        <button className="dn-icon" onClick={p.onSearch} aria-label="Search (Ctrl K)"><Icon name="search" size={20} /></button>
        <button className="dn-icon" onClick={p.onBell} aria-label={p.unread ? "Notifications, unread" : "Notifications"}><Icon name="bell" size={20} />{p.unread && <i className="dn-dot" />}</button>
        <button className="dn-icon" onClick={p.onHelp} aria-label="Help and tips"><Icon name="info" size={20} /></button>
        <AccountBtn className="dn-icon dn-acct" />
      </div>
    </header>
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
const BrandPin = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 2.2a7.6 7.6 0 0 0-7.6 7.6c0 5.4 7.6 12 7.6 12s7.6-6.6 7.6-12A7.6 7.6 0 0 0 12 2.2z" fill="#1a73e8" /><path d="M10 14.6V6.2h2.9a2.6 2.6 0 0 1 0 5.2H10" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
/* ───────────── map-first Explore (Google-Maps-style sheet on phones, side panel on desktop) ───────────── */
const SNAP = [0.17, 0.52, 0.9]; // sheet heights as a share of the map area: peek, half, full
/** CSS height for a snap point; "full" always leaves the search pill and chips visible above the sheet. */
const sheetH = (i: number) => (i === 2 ? "min(90%, calc(100% - 124px))" : `${SNAP[i] * 100}%`);

function Explore({ saved, toggleSave, open, ago, onSearch, onHelp }: { saved: string[]; toggleSave: (id: string) => void; open: (id: string) => void; ago: (d: Dest) => number; onSearch: () => void; onHelp: () => void }) {
  const st = useContext(StartCtx);
  const [focus, setFocus] = useState<{ id: string; t: number } | null>(null);
  const [q, setQ] = useState(""), [cat, setCat] = useState<"All" | Cat>("All"), [ver, setVer] = useState(false), [sort, setSort] = useState<SortKey>("rec");
  const list = useMemo(() => {
    const f = DESTS.filter((d) => (cat === "All" || d.cat === cat) && (!ver || d.verified) && (d.name + d.place + d.cat).toLowerCase().includes(q.toLowerCase()));
    const key = (d: Dest) => (sort === "fare" ? legTotals(d).f0 : sort === "time" ? legTotals(d).t : sort === "fresh" ? ago(d) : 0);
    return sort === "rec" ? f : [...f].sort((a, b) => key(a) - key(b));
  }, [q, cat, ver, sort, ago]);
  const reset = () => { setQ(""); setCat("All"); setVer(false); setSort("rec"); };

  // Bottom sheet: drag the handle (or tap / use arrow keys) to snap between peek, half and full.
  const box = useRef<HTMLDivElement>(null), g = useRef({ y: 0, h: 0, moved: false });
  const [snap, setSnap] = useState(1), [drag, setDrag] = useState<number | null>(null), [shown, setShown] = useState(true);
  const px = (i: number) => { const h = box.current?.clientHeight ?? 700; return i === 2 ? Math.min(h * SNAP[2], h - 124) : h * SNAP[i]; };
  const down = (e: RPE) => { e.currentTarget.setPointerCapture(e.pointerId); g.current = { y: e.clientY, h: px(snap), moved: false }; setDrag(px(snap)); };
  const move = (e: RPE) => { if (drag === null) return; if (Math.abs(e.clientY - g.current.y) > 5) g.current.moved = true; setDrag(Math.min(px(2), Math.max(px(0), g.current.h + g.current.y - e.clientY))); };
  const up = () => { if (drag === null) return; setSnap(!g.current.moved ? (snap + 1) % 3 : [0, 1, 2].reduce((a, i) => (Math.abs(px(i) - drag) < Math.abs(px(a) - drag) ? i : a), 0)); setDrag(null); };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") { e.preventDefault(); setSnap(Math.min(2, snap + 1)); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSnap(Math.max(0, snap - 1)); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSnap((snap + 1) % 3); }
  };
  useEffect(() => { document.body.classList.add("lock-m"); return () => document.body.classList.remove("lock-m"); }, []);
  useEffect(() => { if (focus) document.getElementById(`row-${focus.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [focus]);

  const pts: MapPoint[] = [
    { id: "origin", ...st, label: st.name.split(",")[0], sub: st.landmark ?? "Your starting point", kind: "origin" },
    ...list.map((d, i): MapPoint => ({ id: d.id, ...GEO[d.id], label: d.name, sub: `${d.place} · ${fareText({ fMin: legTotals(d).f0, fMax: legTotals(d).f1 })}`, kind: "dest", n: i + 1, onOpen: () => open(d.id) })),
  ];
  return (
    <div className={`gm ${snap === 2 && drag === null ? "sheet-full" : ""} ${drag !== null ? "dragging" : ""} ${shown ? "" : "sheet-closed"}`} ref={box}>
      <div className="gm-map">
        <MapView bleed dock={!shown ? "0px" : drag !== null ? `${drag}px` : sheetH(snap)} primary={{ icon: "directions", label: `Starting from ${st.name.split(",")[0]}. Change starting point`, onClick: st.change }} onPick={st.pick} label="Map of destinations" height="100%" focus={focus} onSelect={(id) => { setFocus({ id, t: Date.now() }); setSnap(1); }} points={pts} />
      </div>

      <header className="gm-top">
        <div className="gm-hero"><span>Region I · Ilocos</span><h1>Where does the <em>road</em> take you?</h1><p>Real local routes, fares and road maps, from where you are to the last jeepney stop.</p></div>
        <div className="gm-search">
          <button className="gm-search-main" onClick={onSearch} aria-label="Search destinations"><span className="gm-logo"><img src="/logo-mark.png" alt="" /></span><span>Search destinations</span></button>
          <AccountBtn className="gm-avatar" />
        </div>
        <label className="gm-find"><Icon name="search" size={18} /><input type="search" placeholder="Filter destinations" aria-label="Filter destinations" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <div className="gm-chips" role="group" aria-label="Filters">
          <button className="gm-chip start" onClick={st.change}><Icon name="pin" size={16} />From {st.name.split(",")[0]}</button>
          {CATS.map((c) => <button key={c} className={`gm-chip ${cat === c ? "on" : ""}`} aria-pressed={cat === c} onClick={() => setCat(cat === c ? "All" : c)}><Icon name={catIcon[c]} size={16} />{c}</button>)}
          <button className={`gm-chip ${ver ? "on" : ""}`} aria-pressed={ver} onClick={() => setVer(!ver)}><Icon name="shield" size={16} />Verified</button>
        </div>
      </header>

      {!shown && <button className="gm-reopen" onClick={() => setShown(true)}><Icon name="up" size={18} />Explore · {list.length} {list.length === 1 ? "place" : "places"}</button>}
      <section className={`gm-sheet ${snap === 2 ? "full" : ""} ${drag !== null ? "dragging" : ""} ${shown ? "" : "closed"}`} style={{ height: !shown ? 0 : drag !== null ? drag : sheetH(snap) }} aria-label="Destinations" aria-hidden={!shown}>
        <button className="gm-grab" aria-label="Resize destination list" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}><i /></button>
        <div className="gm-head">
          <div className="gm-title"><h2>Explore</h2><p>{list.length} {list.length === 1 ? "destination" : "destinations"} across Region I</p></div>
          <label className="gm-sort"><span className="sr">Sort by</span><Icon name="sliders" size={16} /><select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <button className="gm-close" aria-label="Close destination list" onClick={() => setShown(false)}><Icon name="x" size={20} /></button>
        </div>
        <div className="gm-scroll">
          {!list.length ? <Empty icon="search" title="No destinations match" text="Try another category or clear your filters." cta="Clear filters" onCta={reset} /> : (
            <ul className="gm-list">
              {list.map((d) => { const t = legTotals(d), on = saved.includes(d.id); return (
                <li key={d.id} id={`row-${d.id}`} className={`gm-item ${focus?.id === d.id ? "on" : ""}`}>
                  <button className="gm-row" onClick={() => open(d.id)}>
                    <span className="gm-txt">
                      <strong>{d.name}{d.verified && <span className="gm-ok" title="Verified route"><Icon name="check" size={11} /></span>}</strong>
                      <small className="gm-sub">{d.cat} · {d.place}</small>
                      <small className="gm-meta"><b>{fareText({ fMin: t.f0, fMax: t.f1 })}</b> · ~{hm(t.t)} · {d.legs.length} {d.legs.length === 1 ? "leg" : "legs"}</small>
                      <ModeStrip d={d} />
                    </span>
                    <span className="gm-thumb"><Pic d={d} /></span>
                  </button>
                  <div className="gm-acts">
                    <button className="pillbtn pri" onClick={() => open(d.id)}><Icon name="route" size={16} />Route</button>
                    <button className={`pillbtn ${on ? "on" : ""}`} aria-pressed={on} aria-label={on ? `Remove ${d.name} from saved` : `Save ${d.name}`} onClick={() => toggleSave(d.id)}><Icon name={on ? "bookmark-fill" : "bookmark"} size={16} />{on ? "Saved" : "Save"}</button>
                  </div>
                </li>
              ); })}
            </ul>
          )}
          <div className="gm-soon"><b>More regions on the way</b><div>{["Baguio", "Sagada", "Banaue", "Camiguin", "Bohol", "Palawan"].map((c) => <span key={c}>{c}</span>)}</div></div>
        </div>
      </section>
    </div>
  );
}

function BottomNav({ view, go, ready, savedN }: { view: string; go: (v: string) => void; ready: string[]; savedN: number }) {
  return (
    <nav className="bnav" aria-label="Main">
      <img className="bn-brand" src="/logo-mark.png" alt="Padaan" />
      {nav.map((n) => {
        const on = view === n.id || (view === "route" && n.id === "explore");
        const badge = n.id === "offline" ? ready.length : n.id === "saved" ? savedN : 0;
        return (
          <button key={n.id} className={`bn ${on ? "on" : ""}`} aria-current={on ? "page" : undefined} onClick={() => go(n.id)}>
            <span className="bn-ic"><Icon name={on && n.id === "saved" ? "bookmark-fill" : n.icon} size={22} />{badge > 0 && <i className="bn-badge">{badge}</i>}</span>
            <span className="bn-lb">{n.short}</span>
          </button>
        );
      })}
    </nav>
  );
}

function YouHeader({ view, go, unread, onBell, start, onStart }: { view: string; go: (v: string) => void; unread: boolean; onBell: () => void; start: string; onStart: () => void }) {
  const tabs: [string, string, IconName][] = [["saved", "Saved", "bookmark"], ["trip", "Trips", "route"], ["offline", "Offline", "download"]];
  return (
    <div className="you-head">
      <div className="you-title"><h2>{view === "trip" ? "Trips" : view === "offline" ? "Offline" : "Saved"}</h2><button className="icon-btn" aria-label={unread ? "Notifications, unread" : "Notifications"} onClick={onBell}><Icon name="bell" size={20} />{unread && <i className="ping" />}</button></div>
      <button className="you-row" onClick={onStart}><span className="you-ic"><Icon name="pin" size={20} /></span><span><b>Starting point</b><small>{start}</small></span><Icon name="chevron" size={18} /></button>
      <div className="you-tabs" role="group" aria-label="Your things">
        {tabs.map(([id, label, ic]) => <button key={id} className={view === id ? "on" : ""} aria-pressed={view === id} onClick={() => go(id)}><Icon name={ic} size={16} />{label}</button>)}
      </div>
    </div>
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
  const addLabel = inTrip ? "In your trip" : "Add to trip";
  const g = directionsLinks(d.id, st);
  const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div className="rd">
      <div className="rd-map" id="route-map">
        <MapView bleed onPick={st.pick} label={`Map from ${st.name.split(",")[0]} to ${d.name}`} height="100%" points={routePts} lines={routeLines}
          primary={{ icon: "directions", label: "Open in Google Maps", onClick: () => window.open(g.google, "_blank", "noopener") }} />
      </div>
      <button className="rd-back" onClick={onBack} aria-label="Back to all destinations"><Icon name="arrow-left" size={22} /><span>All destinations</span></button>

      <section className="rd-sheet" aria-label={`How to get to ${d.name}`}>
        <i className="rd-grab" aria-hidden="true" />
        <header className="rd-head">
          <h2>{d.name}</h2>
          <p className="rd-cat"><Icon name={catIcon[d.cat]} size={15} />{d.cat} · {d.place}</p>
          <p className="rd-status"><Badge d={d} /><Freshness days={ago} /></p>
        </header>

        <div className="rd-acts" role="group" aria-label="Actions">
          <button className="pillbtn pri lg" onClick={onAdd}><Icon name={inTrip ? "route" : "plus"} size={18} />{addLabel}</button>
          <button className={`pillbtn lg ${saved ? "on" : ""}`} aria-pressed={saved} onClick={onSave}><Icon name={saved ? "bookmark-fill" : "bookmark"} size={18} />{saved ? "Saved" : "Save"}</button>
          <button className="pillbtn lg" onClick={onConfirm}><Icon name="check" size={18} />Still accurate?</button>
          <a className="pillbtn lg" href={g.google} target="_blank" rel="noreferrer"><Icon name="directions" size={18} />Google Maps</a>
          <a className="pillbtn lg" href={g.osm} target="_blank" rel="noreferrer"><Icon name="map" size={18} />OpenStreetMap</a>
        </div>

        <dl className="facts">
          <div><dt><Icon name="wallet" size={15} />Est. fare</dt><dd>{fareText({ fMin: t.f0, fMax: t.f1 })}</dd></div>
          <div><dt><Icon name="clock" size={15} />Travel time</dt><dd>~{hm(t.t)}</dd></div>
          <div><dt><Icon name="swap" size={15} />Transfers</dt><dd>{d.legs.length - 1}</dd></div>
          <div><dt><Icon name="pin" size={15} />From</dt><dd>{st.name.split(",")[0]}</dd></div>
        </dl>

        <div className="rd-photo"><Pic d={d} credit /></div>
        <p className="lead">{d.blurb}</p>

        <nav className="jump" aria-label="On this page">
          {([["route-steps", "route", "Steps"], ["route-trust", "shield", "Trust"], ["route-more", "info", "Notes"]] as [string, IconName, string][]).map(([id, ic, l]) => (
            <button key={id} onClick={() => jumpTo(id)}><Icon name={ic} size={16} />{l}</button>
          ))}
        </nav>

        {km(st, DEFAULT_START) > 3 && <p className="warn start-warn"><Icon name="alert" size={18} /><span>The steps below begin at San Fernando. You are about {Math.round(km(st, DEFAULT_START))} km from there, so use the Google Maps or OpenStreetMap links to reach the first stop.</span></p>}
        <div className="sec-head" id="route-steps"><h3>How to get there</h3><span>{d.legs.length} local legs · ≈ {Math.round(km(st, GEO[d.id]))} km straight line</span></div>
        <ol className="journey">
          <li className="jstop start"><span className="jnode"><Icon name="pin" size={14} /></span><div><strong>Start · {st.name.split(",")[0]}</strong><small>{(st.landmark ?? "Your starting point")}</small></div></li>
          {d.legs.map((l, i) => (
            <li className="leg" key={i} data-k={modeKey(l.mode)}>
              <span className="jnode lg"><Icon name={modeIcon[l.mode]} size={20} /></span>
              <article>
                <div className="leg-top"><span className="mode-tag">Step {i + 1} · {l.mode}</span></div>
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

        <section className="trust" id="route-trust">
          <span className="kicker"><Icon name="shield" size={14} />Transparency</span>
          <h3>Why this route can be trusted</h3>
          <ul>
            <li><Icon name="check" size={16} />{d.people.length > 1 ? "Route corroborated" : "Single source, awaiting a second confirmation"}</li>
            <li><Icon name="check" size={16} />Local contributor included</li>
            <li><Icon name="check" size={16} />Last checked {dateAgo(ago)}</li>
          </ul>
        </section>
        <section className="panel" id="route-more">
          <h4>Verified by {d.people.length} {d.people.length === 1 ? "contributor" : "contributors"}</h4>
          <ul className="people">{d.people.map((p) => <li key={p.n}><span className="avatar sm">{p.n.slice(0, 2).toUpperCase()}</span><div><b>{p.n}</b><small>{p.role}</small></div><Icon name="check" size={16} /></li>)}</ul>
        </section>
        <p className="warn"><Icon name="alert" size={18} /><span>Local conditions can change. Confirm locally when necessary, especially after severe weather.</span></p>
        <p className="muted rd-hint"><Icon name="info" size={15} />Lines follow real roads from OpenStreetMap. Stops are approximate; the last stretch to a trailhead or island may be off-road. Right-click or long-press the map to change your start.</p>
      </section>
    </div>
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
  const [auto, setAuto] = useStored<boolean>("tripAuto", true), [opt, setOpt] = useStored<boolean>("tripOpt", true), [pace, setPace] = useStored<Pace>("tripPace", "Balanced");
  const [interests, setInterests] = useState<Cat[]>([]);
  const plan = useMemo(() => smartPlan(stops, st, { days: auto ? "auto" : days, pace, optimize: opt }), [stops, days, auto, pace, opt, st.lat, st.lng, st.name]);
  const nd = plan.days.length, di = Math.min(day, nd - 1);
  const cur = plan.days[di];
  const hero = plan.stops[0];
  const geo = useMemo(() => dayGeometry(cur.stops, st, p.open), [cur, st]);
  return (
    <div className="plan">
      <section className="plan-controls no-print" aria-label="Trip settings">
        <div className="card-pad">
          <span className="eyebrow">Build a real journey</span>
          <h2>{nd}-day Region I trip</h2>
          <div className="startpoint"><span className="jnode"><Icon name="pin" size={14} /></span><div><small>Starting point</small><strong>{st.name}</strong></div><button className="link" onClick={st.change}>Change</button></div>

          <div className="step"><span className="step-n">1</span><div><h3>Where do you want to go?</h3><small>Tap the places you want to visit</small></div></div>
          <div className="pickgrid" role="group" aria-label="Places to visit">
            {DESTS.map((d) => { const on = stops.includes(d.id); return <button key={d.id} className={on ? "on" : ""} aria-pressed={on} onClick={() => p.setStops(on ? stops.filter((s) => s !== d.id) : [...stops, d.id])}><Icon name={on ? "check" : "plus"} size={15} />{d.name}</button>; })}
          </div>

          <div className="step"><span className="step-n">2</span><div><h3>How long?</h3><small>{auto ? "Padaan will choose the number of days" : `${days} ${days === 1 ? "day" : "days"}`}</small></div></div>
          <div className="durpick" role="group" aria-label="Trip length">
            <button className={auto ? "on" : ""} aria-pressed={auto} onClick={() => setAuto(true)}>Auto</button>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => <button key={n} className={!auto && days === n ? "on" : ""} aria-pressed={!auto && days === n} onClick={() => { setAuto(false); p.setDays(n); }}>{n}<small>{n === 1 ? "day" : "days"}</small></button>)}
          </div>
          <Stepper label="Travelers" icon="users" value={people} min={1} max={12} set={p.setPeople} />

          <div className="step"><span className="step-n">3</span><div><h3>{stops.length ? "Your trip is ready" : "Your trip builds itself"}</h3><small>{stops.length ? "It updates when you change places or days" : "Add a place above to start"}</small></div></div>
          {stops.length > 0 && <ol className="stops">{plan.stops.map((d, i) => (
            <li key={d.id}><span className="num">{i + 1}</span><div><b>{d.name}</b><small>{d.place}</small></div>
              <button className="icon-btn sm" aria-label={`Remove ${d.name}`} onClick={() => p.setStops(stops.filter((s) => s !== d.id))}><Icon name="x" size={16} /></button></li>))}</ol>}
          {plan.overflow.length > 0 && <div className="smart-fit no-print"><p><Icon name="alert" size={16} />That is more than {days} {days === 1 ? "day" : "days"} of travel.</p><div><button className="btn secondary sm" onClick={() => setAuto(true)}>Let Padaan add days</button><button className="btn secondary sm" onClick={() => p.setStops(stops.filter((id) => !plan.overflow.some((o) => o.id === id)))}>Keep only what fits</button></div></div>}
          {plan.notes.length > 0 && <ul className="smart-notes no-print">{plan.notes.map((n, i) => <li key={i}><Icon name="info" size={15} />{n}</li>)}</ul>}
          {plan.suggest.length > 0 && <div className="smart-sugg no-print"><small>{plan.free > 0 ? "Free days left? Add one of these" : "Nearby add-ons"}</small>{plan.suggest.map((x) => <button key={x.d.id} onClick={() => p.setStops([...stops, x.d.id])}><Icon name="plus" size={15} /><span><b>{x.d.name}</b><small>{x.why}</small></span></button>)}</div>}

          <details className="more no-print"><summary><Icon name="star" size={16} />Not sure where to go? Let Padaan pick</summary>
            <div className="smart-chips" role="group" aria-label="Interests">{CATS.map((c) => <button key={c} className={interests.includes(c) ? "on" : ""} aria-pressed={interests.includes(c)} onClick={() => setInterests(interests.includes(c) ? interests.filter((x) => x !== c) : [...interests, c])}><Icon name={catIcon[c]} size={15} />{c}</button>)}</div>
            <button className="btn primary smart-go" onClick={() => { p.setStops(buildTrip(interests, st, auto ? "auto" : days, pace)); setDay(0); }}><Icon name="star" size={17} />Pick places for me</button>
          </details>
          <details className="more no-print"><summary><Icon name="sliders" size={16} />Pace and order</summary>
            <div className="smart-pace" role="group" aria-label="Pace">{(["Relaxed", "Balanced", "Packed"] as Pace[]).map((x) => <button key={x} className={pace === x ? "on" : ""} aria-pressed={pace === x} onClick={() => setPace(x)}>{x}</button>)}</div>
            <label className="sw"><input type="checkbox" checked={opt} onChange={(e) => setOpt(e.target.checked)} />Put my stops in the best order</label>
          </details>

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
              <h2>{nd} {nd === 1 ? "day" : "days"} <i>/</i> {Math.max(nd - 1, 0)} {nd === 2 ? "night" : "nights"}</h2>
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
            <div className="day-head"><span className="eyebrow">Day {n + 1}</span><h3>{dd.title ?? (dd.stops.length ? dd.stops.map((s) => s.name).join(" + ") : "Free day")}</h3>{dd.summary && <p className="day-sum">{dd.summary.badge && <b>{dd.summary.badge}</b>}About {hm(dd.summary.hours * 60)} · {Math.round(dd.summary.km)} km · {dd.summary.places} {dd.summary.places === 1 ? "place" : "places"}</p>}</div>
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
  const [toast, setToast] = useState(""), [notifOpen, setNotifOpen] = useState(false);
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
  const [user, setUser] = useState<User | null>(currentUser), [guest, setGuest] = useState(isGuest), [acctOpen, setAcctOpen] = useState(false);
  const initials = user ? user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "G";
  const wide = useMedia("(min-width: 981px)");
  const ctx: StartCtxT = { account: () => setAcctOpen(true), initials, ...start, change: () => setStartOpen(true), set: setPlace, pick: pickPlace };
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

  if (!user && !guest) return <LoginPage onDone={(u) => { setUser(u); setGuest(!u); }} />;
  return (
    <StartCtx.Provider value={ctx}>
    <div className={`app v-${view}`}>
      {notifOpen && <Modal title="Notifications" onClose={() => { setNotifOpen(false); setRead(true); }}><ul className="notif-list">{NOTIFS.map((n) => <li key={n.t}><span><Icon name={n.i} size={16} /></span>{n.t}</li>)}</ul></Modal>}
      <a className="skip" href="#main">Skip to content</a>
      <Rail view={view} go={go} ready={ready} savedN={saved.length} />
      <BottomNav view={view} go={go} ready={ready} savedN={saved.length} />
      <DeskNav view={view} go={go} ready={ready} savedN={saved.length} start={start.name.split(",")[0]} onStart={() => setStartOpen(true)} onSearch={() => setPalette(true)} onHelp={() => setHelp(true)} onBell={() => setNotifOpen(true)} unread={!read} />
      <div className="stage">
        <Topbar start={start.name.split(",")[0]} onStart={() => setStartOpen(true)} view={view} unread={!read} onSearch={() => setPalette(true)} onHelp={() => setHelp(true)} bell={bell} onBell={() => setBell(!bell)} onRead={() => { setRead(true); setBell(false); }} onHome={() => go("explore")} />
        <main id="main" className={`page v-${view}`} key={view + (view === "route" ? sel : "")}>
          {(view === "saved" || view === "trip" || view === "offline") && <YouHeader view={view} go={go} unread={!read} onBell={() => setNotifOpen(true)} start={start.name.split(",")[0]} onStart={() => setStartOpen(true)} />}
          {view === "explore" && wide && <DesktopHome saved={saved} toggleSave={toggleSave} open={open} st={ctx} />}
          {view === "explore" && !wide && <Explore saved={saved} toggleSave={toggleSave} open={open} ago={ago} onSearch={() => setPalette(true)} onHelp={() => setHelp(true)} />}
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
      {acctOpen && (
        <Modal title="Account" onClose={() => setAcctOpen(false)}>
          <div className="acct"><span className="acct-av">{initials}</span><div><b>{user?.name ?? "Guest traveler"}</b><small>{user?.email ?? "Saved places and trips stay on this device"}</small></div></div>
          {user
            ? <button className="btn secondary" onClick={() => { signOut(); setUser(null); setGuest(false); setAcctOpen(false); }}>Sign out</button>
            : <button className="btn primary" onClick={() => { clearGuest(); setGuest(false); setAcctOpen(false); }}>Sign in or create account</button>}
        </Modal>
      )}
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
