/**
 * The capabilities this product runs, and what they cost.
 *
 * Prices and latencies are the network's own figures, read from
 * `describe_capability`. They are estimates shown to the user before they
 * spend anything; the real charge comes back on every response as
 * `cost_usd_estimated` and is what we actually record.
 *
 * Two film tiers:
 *   - standard — `pixverse-i2v`, native 5s, follows the still's size (~1K)
 *   - hd — `ltx-i2v` at 1080p, native minimum 6s
 */

export type FilmQuality = "standard" | "hd";

export interface CapabilitySpec {
  name: string;
  /** What the user is told this step does. */
  label: string;
  /** USD, per unit described by `unit`. */
  price: number;
  unit: "image" | "second";
  /** Median seconds, from the network's measured p50. */
  p50Seconds: number;
  /** Abort timeout to send with `run_capability`. */
  timeoutSeconds: number;
}

export interface FilmTier extends CapabilitySpec {
  quality: FilmQuality;
  durationSeconds: number;
  /** Provider resolution tier, when the capability accepts one. */
  resolution?: "720p" | "1080p" | "1440p" | "2160p";
}

/**
 * Frames used to run on `flux-schnell` (~$0.003). It is fast, but it drops
 * the storybook ink line and returns either a generic wash or a photograph.
 * `flux-dev` is ~8× the price and still a few cents; it actually holds the
 * plate style that the references are made of.
 */
export const FRAME: CapabilitySpec = {
  name: "flux-dev",
  label: "wash",
  price: 0.02625,
  unit: "image",
  p50Seconds: 3,
  timeoutSeconds: 45,
};

/** Fast silent loop; resolution follows the still. */
export const FILM_STANDARD: FilmTier = {
  quality: "standard",
  name: "pixverse-i2v",
  label: "5s film",
  price: 0.06825,
  unit: "second",
  p50Seconds: 29,
  timeoutSeconds: 240,
  durationSeconds: 5,
};

/** 1080p; LTX's shortest native duration is 6 seconds. */
export const FILM_HD: FilmTier = {
  quality: "hd",
  name: "ltx-i2v",
  label: "HD film",
  price: 0.063,
  unit: "second",
  p50Seconds: 60,
  timeoutSeconds: 245,
  durationSeconds: 6,
  resolution: "1080p",
};

/** @deprecated Prefer FILM_STANDARD — kept for call sites that mean the default. */
export const FILM = FILM_STANDARD;

export function filmTier(quality: FilmQuality | string | null | undefined): FilmTier {
  return quality === "hd" ? FILM_HD : FILM_STANDARD;
}

export function isFilmQuality(value: unknown): value is FilmQuality {
  return value === "standard" || value === "hd";
}

export function estimateFilmCost(quality: FilmQuality = "standard"): number {
  const tier = filmTier(quality);
  return tier.price * tier.durationSeconds;
}
