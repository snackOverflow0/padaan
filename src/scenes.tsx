import { useId } from "react";
import type { Cat } from "./data";

/* Original, lightweight landscape illustrations (no network, no photo licensing). Each is a layered scene:
   sky → far hills → mid ground → focal feature → foreground, so cards read figure-over-ground. */

const SKY: Record<Cat, [string, string]> = {
  Waterfall: ["#bfe3cf", "#eaf6e3"],
  Beach: ["#ffd9a8", "#fff1d6"],
  Heritage: ["#f6c9a0", "#fbe8d0"],
  Island: ["#a9dcdf", "#e3f5ef"],
};

export function Scene({ cat, className = "", seed = 0 }: { cat: Cat; className?: string; seed?: number }) {
  const id = useId().replace(/:/g, "");
  const [s0, s1] = SKY[cat];
  const sh = (n: number) => ((seed * 37 + n * 53) % 40) - 20; // small deterministic variation per destination
  return (
    <svg className={`scene ${className}`} viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${cat} illustration`}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s0} /><stop offset="1" stopColor={s1} /></linearGradient>
        <linearGradient id={`${id}-fall`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset="1" stopColor="#d4f1ef" stopOpacity=".8" /></linearGradient>
        <linearGradient id={`${id}-sea`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3d9aa6" /><stop offset="1" stopColor="#1f6f86" /></linearGradient>
      </defs>
      <rect width="400" height="240" fill={`url(#${id}-sky)`} />

      {cat === "Waterfall" && (<>
        <circle cx={320 + sh(1)} cy="52" r="22" fill="#fff8d6" opacity=".9" />
        <path d="M0 120 Q60 70 120 104 T250 92 T400 110 V240H0z" fill="#7fb894" />
        <path d="M0 140 Q80 96 160 128 T320 112 T400 130 V240H0z" fill="#4f9a78" />
        <path d="M150 88 Q200 70 250 88 L246 130 H154z" fill="#2f7660" />
        <g fill={`url(#${id}-fall)`}><path d="M188 90h26l5 78h-36z" /><path d="M176 112h8l-3 56h-8zM218 108h8l3 60h-8z" opacity=".7" /></g>
        <ellipse cx="201" cy="170" rx="58" ry="11" fill="#7ccfc4" /><ellipse cx="201" cy="170" rx="34" ry="6" fill="#bff0e6" opacity=".8" />
        <path d="M0 240V176 Q70 150 140 178 T260 176 T400 170 V240z" fill="#1e5c49" />
        <g fill="#154536"><path d="M24 240l16-62 16 62zM62 240l12-46 12 46zM330 240l14-56 14 56zM366 240l12-42 12 42z" /></g>
        <g fill="#2f7660" opacity=".9"><path d="M10 240l12-38 12 38zM344 240l10-34 10 34z" /></g>
      </>)}

      {cat === "Beach" && (<>
        <circle cx={90 + sh(2)} cy="96" r="34" fill="#ffb15e" opacity=".95" /><circle cx={90 + sh(2)} cy="96" r="50" fill="#ffc98a" opacity=".35" />
        <rect y="118" width="400" height="70" fill={`url(#${id}-sea)`} />
        <g stroke="#bfe8e8" strokeWidth="2" strokeLinecap="round" opacity=".7"><path d="M20 134h46M150 146h60M270 132h70M60 160h54M220 170h80" /></g>
        <path d="M60 118h60" stroke="#ffe3b8" strokeWidth="3" opacity=".7" strokeLinecap="round" />
        <path d="M0 240V182 Q100 160 200 178 T400 170 V240z" fill="#f1d9a6" />
        <path d="M0 188 Q100 168 200 184 T400 176" stroke="#fff" strokeWidth="5" fill="none" opacity=".75" strokeLinecap="round" />
        <path d="M300 240c-4-40 2-72 10-98" stroke="#6b4a32" strokeWidth="5" fill="none" strokeLinecap="round" />
        <g fill="#2d7a56"><path d="M310 142c-24-14-40-6-52 6 22-6 36-4 52-6zM310 142c20-16 38-10 48 2-18-6-32-4-48-2zM310 142c-6-22 4-34 18-38-8 12-12 24-18 38zM310 142c-12-18-26-22-40-18 14 6 26 10 40 18z" /></g>
        <path d="M60 232c10-6 20-6 30 0z" fill="#c4573a" opacity=".9" /><rect x="74" y="206" width="3" height="26" fill="#6b4a32" /><path d="M54 208c10-14 40-14 50 0z" fill="#e8744f" />
      </>)}

      {cat === "Heritage" && (<>
        <circle cx={310 + sh(3)} cy="58" r="26" fill="#fff0c8" opacity=".9" />
        <path d="M0 150 Q100 120 200 144 T400 130 V240H0z" fill="#d7a77d" opacity=".7" />
        {[[18, 96, 62], [90, 80, 74], [172, 100, 58], [240, 84, 70], [318, 92, 66]].map(([x, y, w], i) => (
          <g key={i}>
            <rect x={x} y={y + 18} width={w} height={150 - y} fill={["#b8613f", "#c97a52", "#a85536", "#c46d49", "#b3593a"][i]} />
            <path d={`M${x - 4} ${y + 18}h${w + 8}l-${(w + 8) / 2 - 8} -${14 + (i % 2) * 6}h-${w - 8}z`} fill="#7b3a26" />
            <g fill="#4a2519"><rect x={x + 8} y={y + 36} width="12" height="22" rx="6" /><rect x={x + w - 20} y={y + 36} width="12" height="22" rx="6" /></g>
            <g fill="#f4d9a8" opacity=".9"><rect x={x + 10} y={y + 80} width="9" height="14" rx="4.5" /><rect x={x + w - 19} y={y + 80} width="9" height="14" rx="4.5" /></g>
          </g>
        ))}
        <path d="M0 240V168 H400 V240z" fill="#8c6a55" />
        <g stroke="#6f5242" strokeWidth="1.5" opacity=".6"><path d="M0 188h400M0 210h400M40 168l-30 72M130 168l-14 72M220 168l6 72M310 168l22 72M390 168l40 72" /></g>
        <g fill="#2d3a33"><circle cx="150" cy="178" r="4" /><path d="M146 182h8l2 18h-12z" /></g>
      </>)}

      {cat === "Island" && (<>
        <circle cx={300 + sh(4)} cy="54" r="24" fill="#fff6d0" opacity=".95" />
        <rect y="112" width="400" height="128" fill={`url(#${id}-sea)`} />
        <path d="M0 120h400" stroke="#d8f3f0" strokeWidth="2" opacity=".6" />
        <g fill="#2f8a66"><path d="M30 130c14-34 54-34 66 0z" /><path d="M150 126c10-24 40-26 50 0z" /><path d="M262 132c18-40 64-40 80 0z" /></g>
        <g fill="#3fa77c"><path d="M44 130c8-20 30-20 38 0z" /><path d="M280 132c10-24 38-24 48 0z" /></g>
        <g fill="#f3e2b4"><path d="M20 130h86v6H20zM140 126h70v6h-70zM250 132h104v6H250z" opacity=".9" /></g>
        <g stroke="#e6f9f6" strokeWidth="2" strokeLinecap="round" opacity=".55"><path d="M20 168h60M170 182h74M300 164h66M80 206h90M240 214h80" /></g>
        <g transform={`translate(${150 + sh(5)} 176)`}><path d="M0 14h70l-10 14H10z" fill="#c4573a" /><path d="M20 14V-8l22 22zM46 14V-4l16 18z" fill="#fff" /><rect x="0" y="12" width="70" height="3" fill="#8a2f1c" /></g>
        <path d="M150 192c26 6 52 6 78 0" stroke="#fff" strokeWidth="2" fill="none" opacity=".5" strokeLinecap="round" />
      </>)}
    </svg>
  );
}

/** Winding road illustration for the Explore hero: a dashed route linking four stops. */
export function RoadArt() {
  return (
    <svg className="roadart" viewBox="0 0 520 320" role="img" aria-label="A route winding from a city terminal to a waterfall through four stops">
      <defs>
        <linearGradient id="ra-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1d5c4b" /><stop offset="1" stopColor="#0d3329" /></linearGradient>
      </defs>
      <rect width="520" height="320" rx="28" fill="url(#ra-bg)" />
      <g opacity=".5"><path d="M0 250 Q90 190 180 230 T360 200 T520 230 V320H0z" fill="#16483b" /><path d="M0 285 Q120 235 240 270 T520 262 V320H0z" fill="#0f3d31" /></g>
      <g stroke="#2d6e5b" strokeWidth="1" opacity=".5" fill="none"><circle cx="410" cy="78" r="26" /><circle cx="410" cy="78" r="44" /><circle cx="410" cy="78" r="64" /></g>
      <path d="M60 252 C140 252 150 170 230 178 S330 250 360 170 S400 90 462 82" fill="none" stroke="#0a2a21" strokeWidth="16" strokeLinecap="round" />
      <path d="M60 252 C140 252 150 170 230 178 S330 250 360 170 S400 90 462 82" className="roadart-dash" fill="none" stroke="#d9ef6d" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 12" />
      {[
        { x: 60, y: 252, t: "Bus terminal", i: "bus" },
        { x: 230, y: 178, t: "Public market", i: "jeepney" },
        { x: 360, y: 170, t: "Barangay road", i: "tricycle" },
        { x: 462, y: 82, t: "Falls", i: "flag" },
      ].map((p, k) => (
        <g key={k}>
          <circle cx={p.x} cy={p.y} r="15" fill={k === 3 ? "#d9ef6d" : "#fffdf8"} />
          <circle cx={p.x} cy={p.y} r="5" fill={k === 3 ? "#0f3d31" : "#1a5a49"} />
          <text x={p.x} y={p.y + (k === 3 ? -26 : 34)} textAnchor="middle" className="roadart-label">{p.t}</text>
        </g>
      ))}
    </svg>
  );
}
