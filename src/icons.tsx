import type { ReactNode } from "react";

export type IconName =
  | "route" | "bookmark" | "bookmark-fill" | "download" | "users" | "shield" | "search" | "bell" | "calendar"
  | "walk" | "car" | "pin" | "plus" | "more" | "arrow" | "arrow-left" | "check" | "cloud" | "map" | "clock"
  | "star" | "x" | "trash" | "minus" | "jeepney" | "tricycle" | "bike" | "bus" | "boat" | "wallet" | "swap"
  | "alert" | "info" | "printer" | "compass" | "sliders" | "chevron" | "up" | "flag" | "leaf" | "phone" | "refresh";

const iconPaths: Record<IconName, ReactNode> = {
  route: <><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h3a3 3 0 0 0 3-3V8a3 3 0 0 1 3-3" /></>,
  bookmark: <path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-3.8L6 21z" />,
  "bookmark-fill": <path fill="currentColor" d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-3.8L6 21z" />,
  download: <><path d="M12 3v12m-4-4 4 4 4-4" /><path d="M5 20h14" /></>,
  users: <><path d="M16 20v-1.6a4.4 4.4 0 0 0-4.4-4.4H6.4A4.4 4.4 0 0 0 2 18.4V20" /><circle cx="9" cy="7" r="4" /><path d="M17 11a4 4 0 0 1 0 8M22 20v-1.2a4 4 0 0 0-3-3.8" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  walk: <><circle cx="13" cy="4" r="2" /><path d="m10 22 1-7-3-3 3-5 4 3 4 1M6 22l3-7m4 0 4 7" /></>,
  car: <><path d="m5 17-2-2 2-7h14l2 7-2 2" /><path d="M5 17h14v3H5zM7 12h.01M17 12h.01" /></>,
  jeepney: <><path d="M4 16V9a2 2 0 0 1 2-2h9l5 4v5" /><path d="M3 16h18v2.5H3z" /><circle cx="7.5" cy="19" r="1.6" fill="currentColor" /><circle cx="16.5" cy="19" r="1.6" fill="currentColor" /><path d="M8 7v4M13 7v4M4 11h16" /></>,
  tricycle: <><circle cx="5" cy="17" r="3" /><circle cx="18.5" cy="17" r="2.5" /><path d="M8 17h6l-2-8H9m5 0h2.5l2 8M3 10h6" /></>,
  bike: <><circle cx="5.5" cy="16.5" r="3.5" /><circle cx="18.5" cy="16.5" r="3.5" /><path d="M5.5 16.5 9 8h4m5.5 8.5L14 8h-2l-2 5h6M13 5h3" /></>,
  bus: <><rect x="4" y="4" width="16" height="13" rx="2.5" /><path d="M4 11h16M8 17v3M16 17v3M8 14h.01M16 14h.01" /></>,
  boat: <><path d="M3 17h18l-2.5 4h-13z" /><path d="M12 3v11M12 4c3 1.5 5 5 5.5 9H12M12 6c-2.5 1.5-4 4-4.5 7H12" /></>,
  pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z" /><circle cx="12" cy="10" r="2.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
  "arrow-left": <><path d="M19 12H5" /><path d="m10 7-5 5 5 5" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  cloud: <><path d="M17.5 19H6a4 4 0 0 1-.4-8A6.5 6.5 0 0 1 18 9.5 4.8 4.8 0 0 1 17.5 19z" /><path d="M12 11v5m-2-2 2 2 2-2" /></>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15m6-12v15" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  trash: <><path d="M4 7h16M10 11v6m4-6v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  minus: <path d="M5 12h14" />,
  star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  wallet: <><path d="M4 7a2 2 0 0 1 2-2h12v4" /><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M16 13.5h.01" /></>,
  swap: <><path d="M4 8h14m-3-3 3 3-3 3M20 16H6m3-3-3 3 3 3" /></>,
  alert: <><path d="M12 3 2.5 20h19z" /><path d="M12 10v4m0 3h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
  printer: <><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3" /><rect x="7" y="14" width="10" height="7" rx="1" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  sliders: <><path d="M4 7h9m4 0h3M4 17h3m4 0h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  chevron: <path d="m9 6 6 6-6 6" />,
  up: <path d="m6 15 6-6 6 6" />,
  flag: <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>,
  leaf: <><path d="M5 20c0-9 5-15 15-15 0 10-6 15-15 15z" /><path d="M5 20 14 11" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  refresh: <><path d="M20 11a8 8 0 0 0-14.5-3M4 5v4h4M4 13a8 8 0 0 0 14.5 3M20 19v-4h-4" /></>,
};

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {iconPaths[name]}
    </svg>
  );
}
