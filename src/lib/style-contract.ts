/**
 * The aesthetic is not the user's job. Everything they type is wrapped in this
 * contract before it reaches Livepeer Agent, so a three-word wish still comes
 * back as a wordless watercolour film in the language of THE LAST COLOR.
 */

export const FILM_DURATION_SECONDS = 8;

const LOOK = [
  "hand-painted watercolour on cold-press paper",
  "visible paper tooth and soft granulation",
  "wet-on-wet colour bleeding at every edge",
  "brush-like motion, strokes that breathe rather than slide",
  "desaturated near-monochrome world of ash grey, bone, faded indigo",
  "one rare vivid accent of living colour, small in frame",
  "no hard outlines, no digital gloss, no 3D render look",
].join(", ");

const WORDLESS = [
  "absolutely no text",
  "no letters, numerals, signage, captions, subtitles or watermarks",
  "no dialogue and no lip movement",
  "the story is carried only by image and motion",
].join(", ");

const MOTION = [
  `${FILM_DURATION_SECONDS} second continuous shot`,
  "slow, patient camera",
  "gentle wind and pigment drift",
  "no cuts, no transitions, no zoom punches",
].join(", ");

/** Build the prompt sent to `create_media` for the opening render. */
export function composeSeedPrompt(userPrompt: string): string {
  return [
    `Wordless watercolour animated short. ${userPrompt.trim()}`,
    `Look: ${LOOK}.`,
    `Motion: ${MOTION}.`,
    `Constraints: ${WORDLESS}.`,
  ].join("\n");
}

/**
 * Refinements are phrased as amendments rather than new prompts, so the agent
 * keeps the established palette, gardener and framing intact.
 */
export function composeRefinementPrompt(
  userPrompt: string,
  originalPrompt: string,
): string {
  return [
    `Revise the existing watercolour short. Keep the same scene, palette discipline, gardener and framing.`,
    `Original brief: ${originalPrompt.trim()}`,
    `Change requested: ${userPrompt.trim()}`,
    `Preserve: ${WORDLESS}.`,
  ].join("\n");
}

/** Negative prompt, kept separate because most capabilities take it as a param. */
export const NEGATIVE_PROMPT = [
  "text",
  "watermark",
  "subtitles",
  "captions",
  "signature",
  "logo",
  "photorealistic",
  "3d render",
  "oversaturated",
  "neon",
  "cgi",
  "harsh outlines",
].join(", ");
