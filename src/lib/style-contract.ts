/**
 * The aesthetic is not the user's job. Everything they type is wrapped in this
 * contract before it reaches Livepeer Agent, so a three-word wish still comes
 * back in the language of THE LAST COLOR.
 *
 * Two sources of truth sit behind the clauses below.
 *
 * The six reference frames in /references, measured by references/analyse.py:
 *   - Median saturation is 0.20-0.46 but p99 reaches 0.76-0.99. The world is
 *     genuinely desaturated and the vivid colour is ~1% of the frame, so the
 *     accent is stated as a quantity, not a mood.
 *   - Dominant hues are twilight indigo, slate teal, warm clay and cream
 *     paper. "Desaturated" here means dusk, not ash.
 *   - Median value is 0.45-0.69 — mid-to-dark frames, not pale ones.
 *   - Every reference carries hand-inked linework over the washes.
 *
 * And live probes against the network (see README). What those taught us:
 *   - Asking for a "courtyard garden" returns a flowerbed. The single accent
 *     only survives if we say ONLY ONE FLOWER EXISTS outright.
 *   - Without an explicit night/low-key clause the model returns bright
 *     daylight: measured value median 0.70 versus 0.36 once we demand dusk.
 *   - `flux-schnell` does not declare `negative_prompt` and the provider
 *     silently drops it, so prohibitions MUST live in the positive prompt.
 *     Naming an unsigned painting with empty corners is what actually stops
 *     the model signing its own work — it was inventing signatures and house
 *     numbers otherwise, which breaks the wordless rule outright.
 */

/** Livepeer's i2v capabilities accept 6, 8 or 10 seconds. */
export const FILM_DURATION_SECONDS = 8;

/** Medium and surface. Named first because it anchors everything after it. */
const MEDIUM = [
  "ink and watercolour illustration on cold-press paper",
  "visible dark ink contour lines drawn by hand over the washes",
  "wet-on-wet colour bleeding, blooms and soft backruns",
  "paper tooth and granulation readable through the paint",
].join(", ");

/** Low-key is stated twice: without it the model returns bright daylight. */
const LIGHT = [
  "night, deep dusk",
  "low-key and dark, deep shadows",
  "no bright white areas, no daylight",
].join(", ");

/**
 * "Desaturated" alone gets read as "one strongly tinted hue": a probe came
 * back as a saturated teal monochrome, measured at 0.54 median saturation
 * against the references' 0.20-0.46. Low chroma has to be asked for as low
 * chroma, and the blue-monochrome trap named outright, or the single living
 * colour stops being precious.
 */
const PALETTE = [
  "overwhelmingly desaturated and low-chroma: greyed, dusty, muted washes",
  "twilight indigo, slate blue-grey, faded green, warm clay brown, bone and ash",
  "NOT a strong blue or teal monochrome tint — the greys are genuinely neutral grey and the palette stays mixed and dusty",
  "the single living colour glows faintly and is the only saturated colour anywhere in the picture",
].join(", ");

/**
 * The wordless rule, phrased positively. A negative prompt cannot be relied
 * on here — see the note at the top of this file.
 */
const WORDLESS = [
  "an unsigned painting",
  "no signature, no handwriting, no lettering, no numbers and no markings anywhere on the image",
  "all four corners are empty paper",
  "every wall and surface is completely bare",
].join(", ");

const FRAMING = "wide cinematic composition, the subject small in deep space";

/**
 * The opening frame. We paint a still first because the watercolour look is
 * far more controllable in an image than in text-to-video, and because this
 * costs a third of a cent instead of a dollar.
 */
export function composeFramePrompt(userPrompt: string): string {
  return [
    `${MEDIUM}. ${LIGHT}.`,
    userPrompt.trim(),
    "ONLY ONE flower exists in the entire picture; every other plant is dead, bare and colourless.",
    `${PALETTE}.`,
    `${FRAMING}.`,
    `${WORDLESS}.`,
  ].join(" ");
}

/**
 * Refinements are amendments rather than fresh prompts, so the agent keeps the
 * established scene. The medium and the wordless rule are restated because the
 * look drifts toward clean digital rendering across edits, and the model
 * starts signing its work again the moment we stop forbidding it.
 */
export function composeFrameRefinement(
  userPrompt: string,
  originalPrompt: string,
): string {
  return [
    `${MEDIUM}. ${LIGHT}.`,
    originalPrompt.trim(),
    `Revised: ${userPrompt.trim()}.`,
    "Keep the same scene, character, framing and palette discipline.",
    `${PALETTE}.`,
    `${WORDLESS}.`,
  ].join(" ");
}

/**
 * Motion for the image-to-video stage. Deliberately sparse: the frame already
 * carries the look, so this clause only has to describe how it breathes. Long
 * restatements of the medium here tend to make i2v redraw the scene.
 */
export function composeMotionPrompt(userPrompt: string): string {
  return [
    "The painting comes gently to life, still a moving watercolour on paper.",
    userPrompt.trim(),
    "Organic brush-stroke motion: pigment drifting, wet edges breathing, a soft wind through leaves and cloth.",
    "Slow, patient, almost still camera. One continuous shot, no cuts and no camera shake.",
    "Nothing is added to the scene and no text appears.",
  ].join(" ");
}

/**
 * Only sent to capabilities that actually declare it — `run_capability` warns
 * us when a provider would drop it, and several image models do.
 */
export const NEGATIVE_PROMPT = [
  "text",
  "letters",
  "numbers",
  "handwriting",
  "signature",
  "watermark",
  "caption",
  "logo",
  "photorealistic",
  "3d render",
  "cgi",
  "smooth gradients",
  "glossy",
  "flat vector art",
  "cartoon",
  "anime",
  "cel shaded",
  "thick uniform outlines",
  "oversaturated",
  "neon",
  "high contrast",
  "fast motion",
  "camera shake",
  "morphing",
].join(", ");
