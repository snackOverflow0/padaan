import { useEffect, useState } from "react";
import { Scene } from "./scenes";
import type { Dest } from "./data";

/* Real photos: each destination's lead image is read live from Wikipedia (CORS-enabled API) in the visitor's browser,
   filtered to skip maps/logos, cached locally, and always layered over the illustration so nothing breaks offline.
   To use your own photos, set `photo` in PHOTO_OVERRIDE below (any https URL or a file in /public). */
export const PHOTO_OVERRIDE: Record<string, { url: string; credit?: string; href?: string }> = {};

const CANDIDATES: Record<string, string[]> = {
  tangadan: ["Tangadan Falls", "San Gabriel, La Union"],
  urbiztondo: ["Urbiztondo Beach", "San Juan, La Union", "San Juan, La Union surfing"],
  vigan: ["Calle Crisologo", "Vigan", "Historic Town of Vigan"],
  hundred: ["Hundred Islands National Park", "Hundred Islands"],
  bolinao: ["Bolinao Falls", "Bolinao, Pangasinan", "Bolinao"],
};
export interface Photo { url: string; credit: string; href: string }
const KEY = "padaan.photos.v2";
const cache: Record<string, Photo | null> = {};
const subs = new Set<() => void>();
let started = false;
try { Object.assign(cache, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { /* no storage */ }
const BAD = /map|locator|location|seal|flag|logo|coat|emblem|diagram|\.svg/i;

const COMMONS: Record<string, string> = { tangadan: "Tangadan Falls", urbiztondo: "Urbiztondo San Juan La Union beach", vigan: "Calle Crisologo Vigan", hundred: "Hundred Islands Pangasinan", bolinao: "Bolinao Falls" };
/** Fallback: search Wikimedia Commons photos directly. */
async function commons(id: string): Promise<Photo | null> {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=8&gsrsearch=${encodeURIComponent(COMMONS[id] ?? id)}&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1100`;
  const r = await fetch(u); if (!r.ok) return null;
  const pages: any[] = Object.values((await r.json())?.query?.pages ?? {});
  for (const p of pages) {
    const i = p.imageinfo?.[0];
    if (i && /jpe?g/.test(i.mime) && i.width >= 1000 && i.width / i.height >= 1.2 && i.thumburl && !BAD.test(p.title)) return { url: i.thumburl, credit: "Photo via Wikimedia Commons", href: i.descriptionurl };
  }
  return null;
}
async function lookup(title: string): Promise<Photo | null> {
  const u = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=thumbnail|name&pithumbsize=1100&titles=${encodeURIComponent(title)}`;
  const r = await fetch(u); if (!r.ok) return null;
  const pages = (await r.json())?.query?.pages ?? {};
  const p: any = Object.values(pages)[0];
  const t = p?.thumbnail;
  if (!t || !p.pageimage || BAD.test(p.pageimage) || t.width < 560 || t.width / t.height < 1.15) return null;
  return { url: t.source, credit: "Photo via Wikipedia", href: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(p.title).replace(/ /g, "_"))}` };
}
function start(ids: string[]) {
  if (started) return; started = true;
  ids.filter((id) => !cache[id]).forEach(async (id) => {
    let found: Photo | null = null;
    for (const t of CANDIDATES[id] ?? []) { try { found = await lookup(t); } catch { found = null; } if (found) break; }
    if (!found) { try { found = await commons(id); } catch { found = null; } }
    cache[id] = found; try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(Object.entries(cache).filter(([, v]) => v)))); } catch { /* ignore */ }
    subs.forEach((f) => f());
  });
}
export const getPhoto = (id: string): Photo | null => (PHOTO_OVERRIDE[id] ? { credit: "Photo", href: "#", ...PHOTO_OVERRIDE[id] } as Photo : cache[id] ?? null);
export function usePhoto(id: string) {
  const [, tick] = useState(0);
  useEffect(() => { start(Object.keys(CANDIDATES)); const f = () => tick((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return getPhoto(id);
}

/** Illustration underneath, photo fades in on top when available. */
export function Pic({ d, credit }: { d: Pick<Dest, "id" | "cat" | "name">; credit?: boolean }) {
  const photo = usePhoto(d.id);
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(false), [photo?.url]);
  return (
    <>
      <Scene cat={d.cat} seed={d.name.length} />
      {photo && <img className={`photo ${ok ? "in" : ""}`} src={photo.url} alt={`${d.name}`} loading="lazy" decoding="async" onLoad={() => setOk(true)} onError={() => setOk(false)} referrerPolicy="no-referrer" />}
      {credit && photo && ok && <a className="credit" href={photo.href} target="_blank" rel="noreferrer">{photo.credit}</a>}
    </>
  );
}
