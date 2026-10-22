import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Icon } from "./icons";
import { getPhoto } from "./photos";
import { km } from "./data";
import { roadRoute } from "./geo";

export interface MapPoint {
  id: string; lat: number; lng: number; label: string; sub?: string;
  kind: "origin" | "dest" | "stop"; n?: number; onOpen?: () => void;
}
interface Props {
  points: MapPoint[];
  lines?: [string, string, string?, string?][];
  onPick?: (p: { lat: number; lng: number }) => void;
  height?: string;
  focus?: { id: string; t: number } | null;
  onSelect?: (id: string) => void;
  className?: string;
  label: string;
}

const BASES = [
  { name: "Streets", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", max: 19, attr: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>' },
  { name: "Terrain", url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", max: 17, attr: '© OpenStreetMap, SRTM · © <a href="https://opentopomap.org" target="_blank" rel="noreferrer">OpenTopoMap</a>' },
  { name: "Satellite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", max: 18, attr: "Imagery © Esri, Maxar, Earthstar Geographics" },
];

const pinHtml = (p: MapPoint) =>
  p.kind === "origin" ? `<div class="pin origin"><span>●</span></div>` : p.kind === "stop" ? `<div class="pin stop"><span>${p.n}</span></div>` : `<div class="pin dest"><span>${p.n ?? "★"}</span></div>`;

export function MapView({ points, lines = [], onPick, height = "420px", focus, onSelect, className = "", label }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const base = useRef<L.TileLayer | null>(null);
  const me = useRef<L.CircleMarker | null>(null);
  const markers = useRef<Record<string, L.Marker>>({});
  const live_ref = useRef({ points, onSelect });
  live_ref.current = { points, onSelect };
  const [tileFail, setTileFail] = useState(false);
  const [note, setNote] = useState("");
  const [baseIx, setBaseIx] = useState(0);
  const [full, setFull] = useState(false);
  const [live, setLive] = useState(false), [following, setFollowing] = useState(true);
  const follow = useRef(true), acc = useRef<L.Circle | null>(null), pick = useRef(onPick);
  pick.current = onPick;
  const [near, setNear] = useState("");
  const gen = useRef(0);
  const [road, setRoad] = useState<{ km: number; min: number; fail: boolean; boat: boolean } | null>(null);
  const sig = JSON.stringify([points.map((p) => [p.id, p.lat, p.lng, p.label, p.sub, p.n]), lines]);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, scrollWheelZoom: false, attributionControl: true }).setView([16.6, 120.3], 9);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(m);
    m.on("focus click", () => m.scrollWheelZoom.enable());
    m.on("blur", () => m.scrollWheelZoom.disable());
    m.on("dragstart", () => { follow.current = false; setFollowing(false); });
    m.on("contextmenu", (e: L.LeafletMouseEvent) => pick.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; };
  }, []);

  // base layer switch
  useEffect(() => {
    const m = map.current; if (!m) return;
    base.current?.remove();
    const b = BASES[baseIx]; let errs = 0;
    const t = L.tileLayer(b.url, { maxZoom: b.max, attribution: b.attr, subdomains: "abc" });
    t.on("tileerror", () => { if (++errs > 3) setTileFail(true); });
    t.on("tileload", () => { errs = 0; setTileFail(false); });
    t.addTo(m).bringToBack(); base.current = t; setTileFail(false);
  }, [baseIx]);

  // redraw only when the points really change (not on every parent render)
  useEffect(() => {
    const m = map.current, g = layer.current; if (!m || !g) return;
    g.clearLayers(); markers.current = {};
    const pts = live_ref.current.points, byId = Object.fromEntries(pts.map((p) => [p.id, p]));
    const token = ++gen.current; setRoad(null);
    const tot = { km: 0, min: 0, n: 0, done: 0, boat: false }, all: L.LatLngTuple[] = [];
    const todo = lines.filter(([x, y]) => byId[x] && byId[y]).length;
    lines.forEach(([x, y, c, mode]) => {
      if (!byId[x] || !byId[y]) return;
      const A = byId[x], B = byId[y], col = c ?? "#1a5a49";
      const ll: L.LatLngTuple[] = [[A.lat, A.lng], [B.lat, B.lng]];
      // placeholder straight line until the real road arrives
      const ph = L.featureGroup([L.polyline(ll, { color: "#fffdf8", weight: 7, opacity: .9 }), L.polyline(ll, { color: col, weight: 3.5, dashArray: "1 9", lineCap: "round" })]).addTo(g);
      const fin = (rd: { pts: [number, number][]; km: number; min: number } | null) => {
        if (token !== gen.current) return;
        if (rd) {
          g.removeLayer(ph);
          L.polyline(rd.pts, { color: "#fffdf8", weight: 9, opacity: .95, lineJoin: "round" }).addTo(g);
          L.polyline(rd.pts, { color: col, weight: 5, opacity: .95, lineJoin: "round" }).addTo(g);
          tot.km += rd.km; tot.min += rd.min; tot.n++; all.push(...rd.pts);
        }
        if (++tot.done === todo) {
          setRoad({ km: tot.km, min: tot.min, fail: tot.n === 0 && !tot.boat, boat: tot.boat });
          if (all.length && !me.current) m.fitBounds(L.latLngBounds(all), { padding: [48, 48], maxZoom: 13 });
        }
      };
      if (mode === "Boat") { tot.boat = true; fin(null); } else roadRoute(A, B, mode === "Walk" ? "foot" : "car").then(fin);
    });
    pts.forEach((p) => {
      const mk = L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: "pin-wrap", html: pinHtml(p), iconSize: [40, 48], iconAnchor: p.kind === "stop" ? [20, 24] : [20, 46], popupAnchor: [0, p.kind === "stop" ? -20 : -44] }),
        title: p.label, keyboard: true, riseOnHover: true,
      }).addTo(g);
      const box = document.createElement("div"); box.className = "pop";
      const ph = p.kind === "dest" ? getPhoto(p.id) : null;
      if (ph) { const im = document.createElement("img"); im.src = ph.url; im.alt = ""; im.referrerPolicy = "no-referrer"; box.appendChild(im); }
      const b = document.createElement("strong"); b.textContent = p.label; box.appendChild(b);
      if (p.sub) { const s = document.createElement("span"); s.textContent = p.sub; box.appendChild(s); }
      if (p.kind !== "origin") {
        const bt = document.createElement("button"); bt.textContent = "View route →";
        bt.onclick = () => live_ref.current.points.find((x) => x.id === p.id)?.onOpen?.(); box.appendChild(bt);
      }
      mk.bindPopup(box, { closeButton: true, minWidth: 190, maxWidth: 240, autoPanPadding: [24, 24] });
      mk.on("click", () => live_ref.current.onSelect?.(p.id));
      markers.current[p.id] = mk;
    });
    if (pts.length) m.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng] as L.LatLngTuple)), { padding: [48, 48], maxZoom: 12, animate: false });
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current, mk = focus && markers.current[focus.id]; if (!m || !mk) return;
    m.flyTo(mk.getLatLng(), Math.max(m.getZoom(), 11), { duration: .6 });
    mk.openPopup();
  }, [focus]);

  useEffect(() => {
    map.current?.invalidateSize();
    if (!full) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    document.addEventListener("keydown", k); document.body.classList.add("noscroll");
    return () => { document.removeEventListener("keydown", k); document.body.classList.remove("noscroll"); };
  }, [full]);


  // live tracking: the blue dot and the map move as you move
  useEffect(() => {
    const m = map.current; if (!m || !live) return;
    if (!navigator.geolocation) { setNote("Location isn't available in this browser"); setLive(false); return; }
    follow.current = true; setFollowing(true); setNote("Finding you…");
    let first = true;
    const id = navigator.geolocation.watchPosition((pos) => {
      const ll: L.LatLngTuple = [pos.coords.latitude, pos.coords.longitude];
      if (!me.current) me.current = L.circleMarker(ll, { radius: 8, color: "#fff", weight: 3, fillColor: "#3b6ea5", fillOpacity: 1 }).addTo(m).bindTooltip("You are here");
      else me.current.setLatLng(ll);
      if (!acc.current) acc.current = L.circle(ll, { radius: pos.coords.accuracy, weight: 0, fillColor: "#3b6ea5", fillOpacity: .12, interactive: false }).addTo(m);
      else acc.current.setLatLng(ll).setRadius(pos.coords.accuracy);
      if (first) { first = false; setNote(""); m.flyTo(ll, Math.max(m.getZoom(), 14), { duration: .8 }); }
      else if (follow.current) m.panTo(ll, { animate: true, duration: .8 });
      const here = { lat: ll[0], lng: ll[1] };
      const next = live_ref.current.points.filter((p) => p.kind !== "origin").map((p) => ({ p, d: km(here, p) })).sort((a, b) => a.d - b.d)[0];
      setNear(next ? `${next.p.label} · ${next.d < 1 ? Math.round(next.d * 1000) + " m" : next.d.toFixed(1) + " km"} away` : "");
    }, () => { setNote("Couldn't track your location. Check the site's location permission."); setLive(false); }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 });
    return () => { navigator.geolocation.clearWatch(id); me.current?.remove(); acc.current?.remove(); me.current = null; acc.current = null; setNear(""); };
  }, [live]);
  const liveBtn = () => { if (!live) setLive(true); else if (!follow.current) { follow.current = true; setFollowing(true); const ll = me.current?.getLatLng(); if (ll) map.current?.panTo(ll); } else setLive(false); };
  const locate = () => {
    if (!navigator.geolocation) return setNote("Location isn't available in this browser");
    setNote("Finding you…");
    navigator.geolocation.getCurrentPosition((pos) => {
      const m = map.current; if (!m) return;
      const ll: L.LatLngTuple = [pos.coords.latitude, pos.coords.longitude];
      me.current?.remove();
      me.current = L.circleMarker(ll, { radius: 8, color: "#fff", weight: 3, fillColor: "#3b6ea5", fillOpacity: 1 }).addTo(m).bindTooltip("You are here");
      m.flyTo(ll, 12); setNote("");
    }, () => setNote("Couldn't get your location. Check the site's location permission."), { timeout: 8000 });
  };
  const fit = () => { const m = map.current, p = live_ref.current.points; if (m && p.length) m.fitBounds(L.latLngBounds(p.map((x) => [x.lat, x.lng] as L.LatLngTuple)), { padding: [48, 48], maxZoom: 12 }); };
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(""), 4000); return () => clearTimeout(t); }, [note]);

  return (
    <div className={`mapbox ${full ? "fs" : ""} ${className}`} style={full ? undefined : { height }}>
      <div ref={el} className="map" role="region" aria-label={label} />
      <div className="map-tools">
        <button className="map-btn" onClick={fit} aria-label="Fit all pins" title="Fit all pins"><Icon name="map" size={18} /></button>
        <button className="map-btn" onClick={liveBtn} aria-pressed={live} aria-label={!live ? "Follow my location" : following ? "Stop following" : "Re-center on me"} title={!live ? "Follow my location live" : following ? "Stop following" : "Re-center on me"}><Icon name={live && !following ? "pin" : "compass"} size={18} /></button>
        <button className="map-btn" onClick={() => setFull(!full)} aria-pressed={full} aria-label={full ? "Exit full screen" : "Full screen map"} title={full ? "Exit full screen" : "Full screen"}><Icon name={full ? "x" : "sliders"} size={18} /></button>
      </div>
      <div className="map-layers" role="group" aria-label="Map style">
        {BASES.map((b, i) => <button key={b.name} className={i === baseIx ? "on" : ""} aria-pressed={i === baseIx} onClick={() => setBaseIx(i)}>{b.name}</button>)}
      </div>
      {road && !road.fail && road.km > 0 && <div className="map-route" role="status"><Icon name="route" size={15} /><b>{Math.round(road.km)} km</b> by road · about {fmtMin(road.min)} driving{road.boat ? " · boat leg dashed" : ""}</div>}
      {road?.fail && <div className="map-note warn-note"><Icon name="alert" size={15} />Road routes need a connection. Showing straight guide lines.</div>}
      {near && <div className="map-note map-live" role="status"><Icon name="route" size={15} />Next: {near}</div>}
      {note && <div className="map-note" role="status"><Icon name="info" size={15} />{note}</div>}
      {tileFail && <div className="map-note warn-note"><Icon name="alert" size={15} />Map tiles need a connection. Pins and distances still work.</div>}
    </div>
  );
}

const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.max(1, Math.round(m))} min`);
