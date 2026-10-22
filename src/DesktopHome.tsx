import { useMemo, useRef, useState } from "react";
import { CATS, DESTS, GEO, catIcon, fareText, hm, km, legTotals, modeIcon, type Cat, type Dest, type Place } from "./data";
import { Icon } from "./icons";
import { MapView, type MapPoint } from "./map";
import { Pic } from "./photos";

type St = Place & { change: () => void; pick: (p: { lat: number; lng: number }) => void };
interface Props { saved: string[]; toggleSave: (id: string) => void; open: (id: string) => void; st: St }
type Sort = "near" | "fare" | "time";
const dist = (n: number) => (n < 10 ? n.toFixed(1) : Math.round(n)) + " km";

/** Desktop home: a trip-finder hero, category tiles, photo cards and a region map. Deliberately not a map-with-a-list. */
export function DesktopHome({ saved, toggleSave, open, st }: Props) {
  const [to, setTo] = useState(""), [focus, setFocus] = useState(false);
  const [q, setQ] = useState(""), [cat, setCat] = useState<"All" | Cat>("All"), [ver, setVer] = useState(false), [sort, setSort] = useState<Sort>("near");
  const grid = useRef<HTMLElement>(null);
  const match = (s: string) => DESTS.filter((d) => (d.name + " " + d.place + " " + d.cat).toLowerCase().includes(s.trim().toLowerCase()));
  const sugg = to.trim() ? match(to).slice(0, 5) : DESTS.slice(0, 5);
  const find = () => { const m = match(to); if (m.length === 1 || (m[0] && m[0].name.toLowerCase() === to.trim().toLowerCase())) return open(m[0].id); setQ(to); setCat("All"); grid.current?.scrollIntoView({ behavior: "smooth" }); };
  const list = useMemo(() => {
    const f = DESTS.filter((d) => (cat === "All" || d.cat === cat) && (!ver || d.verified) && (d.name + d.place + d.cat).toLowerCase().includes(q.trim().toLowerCase()));
    const key = (d: Dest) => (sort === "fare" ? legTotals(d).f0 : sort === "time" ? legTotals(d).t : km(st, GEO[d.id]));
    return [...f].sort((a, b) => key(a) - key(b));
  }, [q, cat, ver, sort, st.lat, st.lng]);
  const pts: MapPoint[] = [
    { id: "origin", ...st, label: st.name.split(",")[0], sub: st.landmark ?? "Your starting point", kind: "origin" },
    ...DESTS.map((d): MapPoint => ({ id: d.id, ...GEO[d.id], label: d.name, sub: d.place, kind: "dest", onOpen: () => open(d.id) })),
  ];
  const verified = DESTS.filter((d) => d.verified).length, legs = DESTS.reduce((n, d) => n + d.legs.length, 0);

  return (
    <div className="dh">
      <section className="dh-hero">
        <div className="dh-copy">
          <span className="dh-eyebrow">Region I · Ilocos</span>
          <h1>Where does the <em>road</em> take you?</h1>
          <p>Real local routes, fares and road maps, from where you are to the last jeepney stop.</p>
          <div className="dh-find" role="search">
            <button className="dh-from" onClick={st.change}><small>From</small><b><Icon name="pin" size={16} />{st.name.split(",")[0]}</b></button>
            <label className="dh-to"><small>To</small>
              <input value={to} placeholder="Search a destination" onChange={(e) => setTo(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} onKeyDown={(e) => e.key === "Enter" && find()} aria-label="Destination" />
              {focus && sugg.length > 0 && <ul className="dh-sugg">{sugg.map((d) => <li key={d.id}><button onMouseDown={() => open(d.id)}><Icon name={catIcon[d.cat]} size={16} /><span><b>{d.name}</b><small>{d.place}</small></span></button></li>)}</ul>}
            </label>
            <button className="dh-go" onClick={find}><Icon name="route" size={18} />Find route</button>
          </div>
        </div>
        <div className="dh-collage" aria-hidden="true">
          {DESTS.slice(0, 3).map((d, i) => { const t = legTotals(d); return (
            <figure key={d.id} className={`dh-photo p${i}`}><Pic d={d} /><figcaption><b>{d.name}</b><span>{fareText({ fMin: t.f0, fMax: t.f1 })} · ~{hm(t.t)}</span></figcaption></figure>); })}
        </div>
      </section>

      <section className="dh-stats" aria-label="Padaan at a glance">
        <div><b>{DESTS.length}</b><span>destinations mapped</span></div>
        <div><b>{legs}</b><span>local rides explained step by step</span></div>
        <div><b>{verified}</b><span>routes verified by locals</span></div>
      </section>

      <section aria-labelledby="dh-cats">
        <div className="dh-head"><h2 id="dh-cats">Pick your kind of trip</h2></div>
        <div className="dh-tiles">
          {CATS.map((c) => (
            <button key={c} className={`dh-tile ${cat === c ? "on" : ""}`} data-c={c} onClick={() => { setCat(cat === c ? "All" : c); grid.current?.scrollIntoView({ behavior: "smooth" }); }}>
              <Icon name={catIcon[c]} size={28} /><b>{c === "Heritage" ? "Heritage" : c + "s"}</b><span>{DESTS.filter((d) => d.cat === c).length} places</span>
            </button>
          ))}
        </div>
      </section>

      <section ref={grid} id="all" aria-labelledby="dh-all">
        <div className="dh-head"><h2 id="dh-all">{cat === "All" ? "All destinations" : cat === "Heritage" ? "Heritage" : cat + "s"} <small>{list.length}</small></h2>
          <div className="dh-tools">
            <label className="dh-search"><Icon name="search" size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name or town" aria-label="Filter destinations" /></label>
            <button className={`dh-toggle ${ver ? "on" : ""}`} aria-pressed={ver} onClick={() => setVer(!ver)}><Icon name="shield" size={16} />Verified only</button>
            <label className="dh-sort"><Icon name="sliders" size={16} /><select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort"><option value="near">Nearest to {st.name.split(",")[0]}</option><option value="fare">Lowest fare</option><option value="time">Shortest trip</option></select></label>
          </div>
        </div>
        {!list.length && <p className="dh-empty">No destinations match. <button onClick={() => { setQ(""); setCat("All"); setVer(false); }}>Clear filters</button></p>}
        <ul className="dh-grid">
          {list.map((d) => { const t = legTotals(d), on = saved.includes(d.id); return (
            <li key={d.id} className="dh-card">
              <button className="dh-pic" onClick={() => open(d.id)} aria-label={`Open ${d.name}`}><Pic d={d} /><span className="dh-badge"><Icon name={catIcon[d.cat]} size={14} />{d.cat}</span></button>
              <button className={`dh-save ${on ? "on" : ""}`} aria-pressed={on} aria-label={on ? `Remove ${d.name} from saved` : `Save ${d.name}`} onClick={() => toggleSave(d.id)}><Icon name={on ? "bookmark-fill" : "bookmark"} size={19} /></button>
              <div className="dh-body">
                <h3>{d.name}{!d.verified && <i title="Pending verification">pending</i>}</h3>
                <p>{d.place} · {dist(km(st, GEO[d.id]))} away</p>
                <div className="dh-meta"><span><small>Fare</small><b>{fareText({ fMin: t.f0, fMax: t.f1 })}</b></span><span><small>Time</small><b>~{hm(t.t)}</b></span><span className="dh-modes">{[...new Set(d.legs.map((l) => l.mode))].map((m) => <Icon key={m} name={modeIcon[m]} size={17} />)}</span></div>
                <button className="dh-route" onClick={() => open(d.id)}>See route<Icon name="arrow" size={16} /></button>
              </div>
            </li>); })}
        </ul>
      </section>

      <section aria-labelledby="dh-map">
        <div className="dh-head"><h2 id="dh-map">The region at a glance</h2><p>Right-click the map to start from any spot.</p></div>
        <div className="dh-map"><MapView onPick={st.pick} label="Map of all destinations" height="100%" points={pts} /></div>
      </section>

      <section className="dh-steps" aria-labelledby="dh-how">
        <h2 id="dh-how">How Padaan works</h2>
        <ol>
          <li><span>1</span><b>Set where you are</b><p>Use your location or search any town, then pick a destination.</p></li>
          <li><span>2</span><b>Follow each ride</b><p>Jeepney, tricycle, bus or boat, with fares, times and what to look for.</p></li>
          <li><span>3</span><b>Plan and go offline</b><p>Build a multi-day trip and download a region pack before you leave signal.</p></li>
        </ol>
      </section>
    </div>
  );
}
