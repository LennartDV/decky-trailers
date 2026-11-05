import { fetchNoCors } from "@decky/api";
import { TrailerChoice } from "./settings";

/** A trailer ("movie") as listed on a game's Steam store page. */
export interface Trailer {
  id: number;
  name: string;
  thumbnail: string;
  highlight: boolean;
  /** MPEG-DASH manifests (current Steam format). */
  dashH264?: string;
  dashAv1?: string;
  /** HLS master playlist (current Steam format). */
  hls?: string;
  /** Progressive files (legacy Steam format, still returned for some apps). */
  mp4?: string;
  webm?: string;
}

const STORE_API = "https://store.steampowered.com/api/appdetails";

/** Successful lookups are kept for the lifetime of the plugin; failures are retried. */
const cache = new Map<number, Promise<Trailer[]>>();

/** Non-Steam shortcuts get a generated appid with the high bit set; they have no store page. */
export const isNonSteamApp = (appid: number) => appid > 0x7fffffff;

async function fetchJson(url: string): Promise<any> {
  try {
    // The store API allows the Steam client origin (steamloopback.host), so a plain fetch normally works.
    const res = await fetch(url, { credentials: "omit" });
    if (res.ok) return await res.json();
  } catch {
    // fall through to the Decky proxy
  }
  const res = await fetchNoCors(url, { method: "GET" });
  if (!res.ok) throw new Error(`Steam store returned HTTP ${res.status}`);
  return await res.json();
}

function pickUrl(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const v = value as Record<string, string>;
    return v.max ?? v["480"] ?? Object.values(v).find((x) => typeof x === "string");
  }
  return undefined;
}

function toTrailer(m: any): Trailer | null {
  if (!m || typeof m.id !== "number") return null;
  const t: Trailer = {
    id: m.id,
    name: String(m.name ?? `Trailer ${m.id}`),
    thumbnail: String(m.thumbnail ?? ""),
    highlight: !!m.highlight,
    dashH264: pickUrl(m.dash_h264),
    dashAv1: pickUrl(m.dash_av1),
    hls: pickUrl(m.hls_h264),
    mp4: pickUrl(m.mp4),
    webm: pickUrl(m.webm),
  };
  if (!t.dashH264 && !t.dashAv1 && !t.hls && !t.mp4 && !t.webm) return null;
  return t;
}

async function loadTrailers(appid: number): Promise<Trailer[]> {
  const url = `${STORE_API}?appids=${appid}&filters=movies&l=english`;
  const json = await fetchJson(url);
  const entry = json?.[String(appid)];
  if (!entry?.success) return [];
  const movies: any[] = Array.isArray(entry.data?.movies) ? entry.data.movies : [];
  return movies.map(toTrailer).filter((t): t is Trailer => t !== null);
}

/** Returns the trailers on the game's store page, in store order. */
export function getTrailers(appid: number): Promise<Trailer[]> {
  if (!appid || isNonSteamApp(appid)) return Promise.resolve([]);
  let p = cache.get(appid);
  if (!p) {
    p = loadTrailers(appid).catch((e) => {
      console.warn(`[Decky Trailers] Could not load trailers for ${appid}`, e);
      cache.delete(appid);
      return [];
    });
    cache.set(appid, p);
  }
  return p;
}

export function clearTrailerCache(): void {
  cache.clear();
}

/** The trailer used when the user hasn't picked one: the first one on the store page. */
export const automaticTrailer = (trailers: Trailer[]): Trailer | undefined => trailers[0];

/** Resolves the user's choice for a game to an actual trailer (or null for "show hero"). */
export function resolveTrailer(trailers: Trailer[], choice: TrailerChoice): Trailer | null {
  if (choice === "none") return null;
  if (typeof choice === "number") {
    const picked = trailers.find((t) => t.id === choice);
    if (picked) return picked;
    // The chosen trailer was removed from the store page; fall back to automatic.
  }
  return automaticTrailer(trailers) ?? null;
}
