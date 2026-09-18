/**
 * The aesthetic is not the user's job. Everything they type is wrapped in this
 * contract before it reaches Livepeer Agent, so a three-word wish still comes
 * back as a wordless watercolour film in the language of THE LAST COLOR.
 *
 * Every clause below is derived from the six reference frames in /references.
 * `references/analyse.py` re-derives the numbers if those frames ever change;
 * what it told us, and why it matters:
 *
 *   - Median saturation across the references is 0.20–0.46, but the 99th
 *     percentile reaches 0.76–0.99. The world is genuinely desaturated and the
 *     vivid colour is roughly the top 1% of the frame. Hence ONE small accent,
 *     stated as a proportion rather than a mood.
 *   - Dominant hues are twilight indigo (#1e2f61, #282852), slate teal
 *     (#607c7b, #5a7981), warm clay (#87533c, #c78870) and cream paper
 *     (#f4d5be, #fdf3e1) — not neutral grey. "Desaturated" here means dusk,
 *     not ash.
 *   - Median value is 0.45–0.69: these are mid-to-dark frames, not pale ones.
 *   - Every reference carries visible hand-inked linework over the washes, and
 *     an audible paper grain. Without naming both, models return smooth
 *     digital gradients — the single biggest way this look goes wrong.
 */

export const FILM_DURATION_SECONDS = 8;

/** Medium and surface. Named first because it anchors everything after it. */
const MEDIUM = [
  "traditional watercolour painting on cold-press paper",
  "visible paper tooth and granulation in every wash",
  "wet-on-wet colour bleeding, blooms and soft backruns at the edges",
  "pigment pooling and drying rings left visible",
  "delicate hand-inked linework over the washes, slightly uneven, drawn by hand",
  "the paper grain readable through the paint",
].join(", ");

/**
 * Stated as a proportion because that is what the references actually do.
 * Models treat "muted with vivid accents" as licence to saturate everything.
 */
const PALETTE = [
  "overwhelmingly desaturated: twilight indigo, slate blue-grey, muted teal, faded green, warm clay brown, bone and cream paper",
  "roughly ninety-nine percent of the frame is low-saturation",
  "exactly one small area of precious vivid colour — the last living colour — occupying only a few percent of the frame",
  "that accent glows faintly, as if lit from within, and is the only thing the eye lands on",
  "mid-to-dark overall value, dusk rather than daylight, never pale or washed out",
].join(", ");

const MOTION = [
  `${FILM_DURATION_SECONDS} second continuous shot`,
  "slow, patient, almost still camera",
  "organic brush-stroke motion: pigment drifting, edges breathing, washes shifting as if still wet",
  "gentle wind through leaves and cloth",
  "no cuts, no transitions, no camera shake, no zoom punches",
  "movement is delicate and hand-painted, never mechanical or snappy",
].join(", ");

const ATMOSPHERE = [
  "melancholic, poetic and quiet",
  "wide cinematic framing with deep space, the subject small within it",
  "tender, unhurried, a held breath",
].join(", ");

const WORDLESS = [
  "absolutely no text",
  "no letters, numerals, signage, captions, subtitles or watermarks",
  "no dialogue and no lip movement",
  "the story is carried only by image and motion",
].join(", ");

/** Build the prompt sent to `create_media` for the opening render. */
export function composeSeedPrompt(userPrompt: string): string {
  return [
    `Wordless watercolour animated short. ${userPrompt.trim()}`,
    `Medium: ${MEDIUM}.`,
    `Palette: ${PALETTE}.`,
    `Motion: ${MOTION}.`,
    `Atmosphere: ${ATMOSPHERE}.`,
    `Constraints: ${WORDLESS}.`,
  ].join("\n");
}

/**
 * Refinements are phrased as amendments rather than new prompts, so the agent
 * keeps the established palette, gardener and framing intact. The medium is
 * restated because models drift toward smooth digital rendering across edits —
 * the look degrades a little with every turn otherwise.
 */
export function composeRefinementPrompt(
  userPrompt: string,
  originalPrompt: string,
): string {
  return [
    "Revise the existing watercolour short. Keep the same scene, palette discipline, character and framing.",
    `Original brief: ${originalPrompt.trim()}`,
    `Change requested: ${userPrompt.trim()}`,
    `Hold the medium unchanged: ${MEDIUM}.`,
    `Hold the palette discipline unchanged: ${PALETTE}.`,
    `Preserve: ${WORDLESS}.`,
  ].join("\n");
}

/**
 * Negative prompt, kept separate because most capabilities take it as a param.
 * The first group is the no-text rule; the second is everything that would make
 * this read as sharp, digital or cartoonish instead of hand-painted.
 */
export const NEGATIVE_PROMPT = [
  "text",
  "watermark",
  "subtitles",
  "captions",
  "signature",
  "logo",
  // Wrong medium.
  "photorealistic",
  "photograph",
  "3d render",
  "cgi",
  "digital airbrush",
  "smooth gradients",
  "glossy",
  "plastic",
  "flat vector art",
  // Wrong drawing language.
  "cartoon",
  "anime",
  "comic book",
  "thick uniform outlines",
  "hard sharp edges",
  "cel shaded",
  // Wrong colour discipline.
  "oversaturated",
  "neon",
  "vibrant",
  "high contrast",
  "rainbow palette",
  // Wrong motion.
  "fast motion",
  "jerky animation",
  "camera shake",
  "morphing",
].join(", ");
