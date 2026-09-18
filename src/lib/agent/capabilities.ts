/**
 * The capabilities this product runs, and what they cost.
 *
 * Prices and latencies are the network's own figures, read from
 * `describe_capability` on 18 Sep 2026. They are estimates shown to the user
 * before they spend anything; the real charge comes back on every response as
 * `cost_usd_estimated` and is what we actually record.
 *
 * The two-stage shape is the network's own advice: `ltx-25-i2v-pro` describes
 * itself as "the keeper animation from a locked keyframe" and points at
 * `ltx-25-i2v-fast` for iteration. So we lock a frame first, refine it while
 * it is cheap, and only animate once it is right.
 */

export interface CapabilitySpec {
  name: string;
  /** What the user is told this step does. */
  label: string;
  /** USD, per unit described by `unit`. */
  price: number;
  unit: "image" | "second";
  /** Median seconds, from the network's measured p50. */
  p50Seconds: number;
  /** Whether the provider honours `negative_prompt`. */
  takesNegativePrompt: boolean;
}

/**
 * Frames are near-free and near-instant, which is what makes conversational
 * refinement viable at all: ~$0.003 and 2s per attempt instead of ~$1 and a
 * minute. Note flux-schnell drops `negative_prompt` — the wordless rule has to
 * live in the positive prompt instead.
 */
export const FRAME: CapabilitySpec = {
  name: "flux-schnell",
  label: "wash",
  price: 0.0032,
  unit: "image",
  p50Seconds: 2,
  takesNegativePrompt: false,
};

/**
 * The two animation tiers, offered to the user as an explicit choice.
 *
 * These carry the 1080p rates, not the 720p ones the capability cards lead
 * with. A measured 6-second render on `ltx-25-i2v-fast` was billed $0.819,
 * which is exactly 6 x $0.1365 — the 1080p rate — even though the card says
 * "we send 720p unless you name one". Quoting the 720p price would understate
 * what the user actually pays by 45%, so we quote what really runs. Pass
 * `resolution: "720p"` explicitly if the cheaper tier is ever wanted.
 */
export const FILM_TIERS = {
  preview: {
    name: "ltx-25-i2v-fast",
    label: "preview",
    price: 0.1365,
    unit: "second",
    p50Seconds: 48,
    takesNegativePrompt: false,
  },
  final: {
    name: "ltx-25-i2v-pro",
    label: "final take",
    price: 0.1785,
    unit: "second",
    p50Seconds: 58,
    takesNegativePrompt: false,
  },
} satisfies Record<string, CapabilitySpec>;

export type FilmTier = keyof typeof FILM_TIERS;

/** What animating this frame will cost, before the user commits to it. */
export function estimateFilmCost(tier: FilmTier, seconds: number): number {
  return FILM_TIERS[tier].price * seconds;
}
