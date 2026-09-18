/**
 * The house style. The subject is always the user's; this file only decides
 * how it is painted.
 *
 * The line between the two matters and was drawn the wrong way at first: an
 * earlier version hardcoded a lone flower in a dead world, which is a story,
 * not a style. It forced that story onto every prompt. Everything below is
 * restricted to what the six reference frames in /references actually have in
 * common, measured by references/analyse.py:
 *
 *   - Ink linework over watercolour washes, on visible cold-press paper. This
 *     is the strongest invariant — present in all six, and the thing models
 *     drop first, returning smooth digital gradients instead.
 *   - Median saturation 0.20-0.46 in every single frame. Muted is the one
 *     colour rule that genuinely holds.
 *   - Wide 16:9 with illustrative depth (measured 1.72-1.79:1).
 *
 * And, just as importantly, what they do NOT have in common:
 *
 *   - Brightness. Median value runs 0.45 to 0.99 across the set; the cloud-sea
 *     reference is almost white. So light is the user's call, not ours, and an
 *     earlier "night, deep dusk" clause was overreach.
 *   - Subject. The references are a flying ark, a stone giant, a night forest,
 *     a sea of clouds, a forest clearing and a hilltop pavilion. Nothing about
 *     the style implies any particular thing to paint.
 *
 * Live probes taught two more things, both about how models fail:
 *
 *   - `flux-schnell` does not declare `negative_prompt` and the provider drops
 *     it silently, so prohibitions have to sit in the positive prompt.
 *   - Negation does not work at all on diffusion models. Enumerating what to
 *     leave out ("no other flowers, not in pots…") produced the exact thing it
 *     forbade, because every noun you forbid is a noun you supply. Anything we
 *     want absent has to be phrased as something present instead.
 */

/** Livepeer's i2v capabilities accept 6, 8 or 10 seconds. */
export const FILM_DURATION_SECONDS = 8;

/**
 * Medium and surface — the heart of the style, and the part worth repeating
 * whenever there is a risk of drift.
 */
const MEDIUM = [
  "ink and watercolour illustration on cold-press paper",
  "delicate dark ink contour lines drawn by hand over the washes",
  "wet-on-wet colour bleeding, soft blooms and backruns at the edges",
  "pigment granulation and paper tooth readable through the paint",
  "luminous transparent washes with the white of the paper showing through",
].join(", ");

/**
 * The one colour rule that every reference obeys. Deliberately says nothing
 * about which hues or how bright — that follows the user's scene.
 *
 * "Desaturated" alone is read as "one strongly tinted hue": a probe returned a
 * saturated teal monochrome at 0.54 median saturation. Naming the monochrome
 * trap is what brought it back to 0.38, inside the reference band.
 */
const COLOUR = [
  "muted, low-chroma palette: greyed and dusty washes, never bright or candy pigment",
  "the colour is muted but definitely present and rich — not pale, bleached or nearly colourless",
  "NOT a single strong monochrome tint — the palette stays mixed, and neutral greys stay genuinely neutral",
  "any vivid colour is small and deliberate, never spread across the whole frame",
].join(", ");

/**
 * Density, deliberately separate from time of day. Removing the old forced
 * "night, deep dusk" clause was right — the references run from 0.45 to 0.99
 * median value, so brightness belongs to the user — but removing it alone
 * produced a bleached frame at 0.06 saturation and 0.86 value, mostly bare
 * paper. What the references actually share is built-up washes with real
 * darks, at any hour. That is what this asks for.
 */
const DENSITY = [
  "washes built up to a full mid-tone density, with real darks and deep shadow in the composition",
  "bare paper is left only as deliberate highlights, and does not dominate the frame",
].join(", ");

const FRAMING = [
  "wide cinematic 16:9 composition",
  "illustrative storybook depth, with air and distance in the scene",
].join(", ");

/**
 * The wordless rule, phrased positively, since a negative prompt cannot be
 * relied on here. A crop guard in `trim-edges.ts` backs this up, because
 * wording alone did not stop the models signing their own paintings.
 */
const WORDLESS = [
  "an unsigned painting",
  "no lettering, numbers, captions, signature or markings anywhere on the image",
  "all four corners are empty paper",
].join(", ");

/** The opening frame: the user's subject, painted in the house style. */
export function composeFramePrompt(userPrompt: string): string {
  return [
    `${MEDIUM}.`,
    userPrompt.trim(),
    `${COLOUR}.`,
    `${DENSITY}.`,
    `${FRAMING}.`,
    `${WORDLESS}.`,
  ].join(" ");
}

/**
 * Refinements are amendments rather than fresh prompts, so the scene survives.
 * The medium and colour rules are restated because the look drifts toward
 * clean digital rendering across edits, and the model starts signing its work
 * again the moment we stop forbidding it.
 */
export function composeFrameRefinement(
  userPrompt: string,
  originalPrompt: string,
): string {
  return [
    `${MEDIUM}.`,
    originalPrompt.trim(),
    `Revised: ${userPrompt.trim()}.`,
    "Keep the same scene, subject and composition; change only what was asked.",
    `${COLOUR}.`,
    `${DENSITY}.`,
    `${WORDLESS}.`,
  ].join(" ");
}

/**
 * Motion for the image-to-video stage. Deliberately sparse: the frame already
 * carries the look, and long restatements of the medium here make i2v redraw
 * the scene instead of animating it.
 */
export function composeMotionPrompt(userPrompt: string): string {
  const wish = userPrompt.trim();
  return [
    "The painting comes gently to life, still a moving watercolour on paper.",
    wish || "Only what is already in the scene moves.",
    "Organic brush-stroke motion: pigment drifting, wet edges breathing, soft air moving through the scene.",
    "Slow, patient, almost still camera. One continuous shot, no cuts and no camera shake.",
    "Nothing is added to the scene and no text appears.",
  ].join(" ");
}

/**
 * Only reaches capabilities that actually declare it — `run_capability` warns
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
  "photograph",
  "3d render",
  "cgi",
  "digital airbrush",
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
