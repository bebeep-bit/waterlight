/**
 * The house style. The subject is always the user's; this file only decides
 * how it is painted.
 *
 * The line between the two matters and was drawn the wrong way at first: an
 * earlier version hardcoded a lone flower in a dead world, which is a story,
 * not a style. It forced that story onto every prompt. Everything below is
 * restricted to what the reference plates in /references actually share,
 * looked at as drawings, not as saturation numbers:
 *
 *   - Construction, not mood. The picture is a puzzle of closed ink shapes
 *     that are then filled. Line weight matches the forest line-ref: medium-thin,
 *     clear, slightly wobbly hand-inked contours — not hairline pencil, not
 *     thick comic ink. Volume is short hatch ticks, fine cross-hatch patches,
 *     dash clusters, and soft halftone stipple inside the contour — never soft
 *     painterly shading that eats the line. Shape recipes stay out of the
 *     prompt unless the user named that thing.
 *   - Transparent watercolour lives inside those shapes. Paper tooth shows
 *     in the cream. Wet blooms stay in empty cream fields, never dissolving
 *     the ink.
 *   - Pigments from the plates — a full family, not a green wash:
 *     cream paper; peach, apricot, salmon, coral; pale lemon and warm gold;
 *     rose and soft magenta accents; lavender, periwinkle, dusty mauve;
 *     twilight indigo and plum; pale sky cyan and slate-blue; turquoise water
 *     accents; olive and teal greens; clay, sandstone and wood browns.
 *     Soft pastel mixes, matte — not neon, not grey ash, not blown white.
 *   - Wide 16:9, illustrated depth. Light is soft and diffused; horizon glow
 *     keeps colour and detail rather than bleaching the paper.
 *
 * What they do not share, and so we do not copy into every prompt:
 *   - The pink gardener, the ark, the moth, the bud. Those are subjects.
 *   - Palette from any one plate (e.g. a green forest path). Colour follows
 *     the house pastel family and the user's scene — line grammar is shared.
 *   - Brightness. The cloud-sea is almost white paper; the forest is night.
 *     Light follows the user's scene.
 *
 * Live probes taught three more things, all about how models fail:
 *
 *   - `flux-schnell` does not declare `negative_prompt` and the provider drops
 *     it silently, so prohibitions have to sit in the positive prompt.
 *   - Negation does not work at all on diffusion models. Enumerating what to
 *     leave out ("no other flowers, not in pots…") produced the exact thing it
 *     forbade, because every noun you forbid is a noun you supply. Anything we
 *     want absent has to be phrased as something present instead.
 *   - A two-word subject ("deep sea") drowned in the medium clauses and came
 *     back as an abstract wash: the model painted blooms and paper, which is
 *     most of the prompt, instead of the sea. Subject has to lead, and it has
 *     to ask for a readable scene, not merely name a noun among the washes.
 *     That is still not choosing a story — it is requiring the user's words to
 *     be the picture. Inventory is universal: every closed shape must match a
 *     word in the brief — never volunteer extra environment.
 */

/**
 * Native default of `pixverse-i2v` (1–15 allowed). HD films use `ltx-i2v`,
 * whose shortest duration is 6 seconds — see `FILM_HD` in capabilities.
 */
export const FILM_DURATION_SECONDS = 5;

/**
 * Locked look, shared by the house plates (bowl, train, ark, moth, forest
 * path, night garden). Take the drawing only. Never list those subjects:
 * diffusion paints them.
 *
 * What the plates share: a medium hand-inked contour, then transparent
 * watercolour inside it. Saturation follows the scene's light — a day
 * still life stays soft, dusk and night may pool deeper. One plate's
 * palette is not the palette of every prompt.
 */
const DRAWING = [
  "inked watercolour on cold-press paper: contour first, then colour",
  "the line is black-brown ink, medium-thin, clear and slightly wobbly, with a little pressure variation, present on every shape",
  "each shape is a closed outline; the line stays crisp while the colour inside it is allowed to move",
  "volume is a few short hatch ticks, a little cross-hatch, and soft stipple inside the contour",
].join(", ");

/**
 * Paint, after the ink. Soft blooms stay in empty cream paper, never eating
 * the ink of named forms. Light stays diffused — bright areas keep pigment.
 */
const MEDIUM = [
  "watercolour drops bloom inside the shapes: a wet edge, a feathered rim, pigment pooling darker where the drop sat, lighter where it ran out",
  "colours bleed into each other only inside the ink, the contour itself staying sharp",
  "paper grain shows in the lights and in the thin parts of the wash",
  "matte painted plate, brush on cold-press paper, the wash visibly handmade",
].join(", ");

/**
 * Hue follows the scene. The shared family is cream paper and clear
 * watercolour — peach, coral, lemon, olive, slate, teal, indigo — used
 * only where the light of the brief calls for them.
 */
const COLOUR = [
  "transparent watercolour on cream paper, matte, pigment pooling in the shadows of this scene and thinning to the paper in the lights",
  "the hue is the scene's own light: warm daylight stays peach, gold, coral and olive; cool or night light may pool slate, teal and indigo",
  "the darkest note is the ink line; the washes stay clear watercolour",
].join(", ");

/**
 * Finished plate — clear subjects, not abstract washes.
 */
const DENSITY = [
  "a finished ink-and-wash storybook plate: readable hand-inked contours, watercolour filling the shapes, cream paper as light",
  "calm whimsical atmosphere, gentle illustrated depth",
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

/**
 * Craft notes tweak the wash ("soften the light"). A full new brief replaces
 * the scene. Without this split, an opening like "cat in the window" rode into
 * a later pier prompt and the cat sat on the dock.
 */
const CRAFT_NOTE =
  /^(let |show more|pull |soften |leave more|make (it |the )|darker|lighter|closer|further|bleed|ink line|empty paper|camera|colour|color|more ink|less ink)/i;

function isCraftNote(prompt: string): boolean {
  return CRAFT_NOTE.test(prompt.trim());
}

/**
 * Object-on-surface briefs. Diffusion pads still lifes with extra props
 * ("cup on table" → mug + teacup + vase) and with outdoor scenery when the
 * brief also says "in room". Scope is a counted inventory: the named
 * thing(s), an otherwise empty tabletop, cream paper — never a landscape.
 */
const STILL_SURFACE =
  /\bon\s+(a\s+|the\s+)?(table|desk|shelf|counter|plate|saucer|windowsill|cloth)\b/i;
const PLURAL_OR_GROUP =
  /\b(two|three|four|several|few|many|pair|couple|and|&|cups|mugs|bowls|vases|bottles|plates|books|glasses|fishes)\b/i;

/** "fish in ocean" must not become fish in the sky above a coast. */
const IN_WATER =
  /^(.+?)\s+in\s+(?:the\s+|an?\s+)?(ocean|sea|lake|river|pond|water)\b/i;
const IN_PLACE =
  /^(.+?)\s+in\s+(?:the\s+|an?\s+)?(forest|woods|garden|cave|sky|clouds?|city|street|room)\b/i;

/** Sky drama only when the user names it — otherwise coasts invent moons. */
const NAMED_SKY_DRAMA =
  /\b(moon|sun|suns|star|stars|sunset|sunrise|dusk|dawn|night|midnight|twilight|eclipse|planet|full\s*moon)\b/i;

/** English "fish" is both singular and plural — default to one unless counted. */
function isSingularSubject(phrase: string): boolean {
  const text = phrase.trim();
  if (PLURAL_OR_GROUP.test(text)) return false;
  if (/^\d+\s/.test(text)) return false;
  /* Bare "fish" / "a fish" / "the fish" → one. "fish swimming" still one. */
  if (/^(a|an|the|one)\s+/i.test(text)) return true;
  if (/^fish\b/i.test(text) && !/\bfishes\b/i.test(text)) return true;
  /* Simple singular noun phrases without a trailing plural -s (sheep/fish aside). */
  if (!/\b\w+s\b/i.test(text.replace(/\b(fish|sheep|deer|species)\b/gi, "SING"))) {
    return text.split(/\s+/).length <= 4;
  }
  return false;
}

function countPhrase(who: string): string {
  const trimmed = who.trim();
  if (isSingularSubject(trimmed)) {
    if (/^(a|an|the|one)\s+/i.test(trimmed)) return `exactly ${trimmed}`;
    if (/^fish\b/i.test(trimmed)) return `exactly one fish`;
    return `exactly one ${trimmed}`;
  }
  return `only the named ${trimmed}`;
}

/** Tabletop briefs win even when "in room" is also present. */
function isStillLife(subject: string): boolean {
  return STILL_SURFACE.test(subject);
}

function stillLifeParts(subject: string): { item: string; surface: string } {
  const match = subject.match(
    /^(.+?)\s+on\s+(?:a\s+|the\s+)?(table|desk|shelf|counter|plate|saucer|windowsill|cloth)\b/i,
  );
  return {
    item: (match?.[1] ?? subject).trim(),
    surface: (match?.[2] ?? "table").toLowerCase(),
  };
}

/** Strict: only named words. Do not volunteer ground/water/sky — that invents worlds. */
function inventoryLock(subject: string): string {
  return [
    `Inventory lock: paint only what «${subject}» names`,
    "every closed ink shape matches a word in that brief",
    "add nothing beyond those words",
  ].join("; ");
}

function sceneScope(subject: string): string {
  let specific: string;

  if (isStillLife(subject)) {
    const { item, surface } = stillLifeParts(subject);
    const count = countPhrase(item);
    specific = [
      `Picture contents: ${count}, centered on an otherwise empty wooden ${surface}`,
      `the ${surface} is a solid plank across the lower half, with a clear front edge and quiet wood-grain wash`,
      `the ${surface} holds that alone — empty wood around it`,
      "the upper half is bare cream paper — indoor tabletop still life, blank wall air, no window view and no outdoor scenery",
    ].join("; ");
  } else {
    const water = subject.match(IN_WATER);
    if (water) {
      const who = water[1].trim();
      const where = water[2].toLowerCase();
      const count = countPhrase(who);
      const singular = isSingularSubject(who);
      const verb = singular ? "swims" : "swim";
      const around = singular ? "around it" : "around them";
      specific = [
        `Underwater ${where} scene`,
        `${count} ${verb} inside the water`,
        `${where} water fills the whole plate ${around}`,
        "viewpoint is submerged in the water — a water world, not a coast, not a sky above waves",
      ].join("; ");
    } else {
      const placed = subject.match(IN_PLACE);
      if (placed) {
        const who = placed[1].trim();
        const where = placed[2].toLowerCase();
        const count = countPhrase(who);
        specific = [
          `Scene set inside the ${where}`,
          `${count} in the ${where}, surrounded by it`,
          `the ${where} fills the plate`,
        ].join("; ");
      } else if (/\b(indoor|inside|room|interior)\b/i.test(subject)) {
        specific =
          "Indoor scene: the room fills the plate; outdoors appear only if a window is named, and only through that glass";
      } else {
        specific =
          "the named subjects and their stated setting fill the plate";
      }
    }
  }

  return `${specific}; ${inventoryLock(subject)}`;
}

/**
 * Spatial fidelity — positive inventory. Listing things to avoid made the
 * model paint them. Never volunteer extra environment nouns — that becomes scenery.
 */
const FIDELITY = [
  "Follow the scene exactly as written: setting, point of view, count, and every named subject",
  "Prepositions are literal: in means inside that place, on means on that surface, under means beneath it",
  "Closed-shape rule: every outlined form matches a word in the scene",
  "The plate is sparse: only the words in the scene — nothing more",
].join(". ");
function framingOf(aspectLabel: string, kind: "still" | "underwater" | "default"): string {
  if (kind === "still") {
    return `${aspectLabel}, tight tabletop still-life crop, shallow space, drawn rather than photographed`;
  }
  if (kind === "underwater") {
    return `${aspectLabel}, submerged viewpoint, water filling the frame, drawn rather than photographed`;
  }
  return `${aspectLabel}, illustrated depth, drawn rather than photographed`;
}

function framingKind(subject: string): "still" | "underwater" | "default" {
  if (isStillLife(subject)) return "still";
  if (IN_WATER.test(subject)) return "underwater";
  return "default";
}

export interface ComposeOptions {
  /** Framing clause from the chosen aspect ratio. */
  framing?: string;
}

/** The opening frame: the user's subject, painted in the house style. */
export function composeFramePrompt(
  userPrompt: string,
  options: ComposeOptions = {},
): string {
  const subject = userPrompt.trim();
  const kind = framingKind(subject);
  const framing = framingOf(
    options.framing ?? "wide cinematic 16:9 composition",
    kind,
  );
  /* Subject + placement first: style clauses later used to drown a short brief
     ("fish in ocean" became a sky coast from the cloud-plate bias). */
  return [
    `Scene (follow exactly): ${subject}.`,
    `${sceneScope(subject)}.`,
    kind === "still"
      ? "Draw only those picture contents as the house ink-and-wash plate, every form a closed outlined shape."
      : "Draw only that inventory as the house ink-and-wash plate — every closed shape belongs to it.",
    "Style lock: medium hand-inked contour, watercolour that blooms and pools inside the line, paper grain in the lights, saturation following the light of this scene.",
    `${FIDELITY}.`,
    `${DRAWING}.`,
    `${COLOUR}.`,
    `${MEDIUM}.`,
    `${DENSITY}.`,
    `${framing}.`,
    `${WORDLESS}.`,
  ].join(" ");
}

/**
 * Refinements are amendments when they are craft notes, so the scene survives.
 * A full new brief is treated as a fresh plate — otherwise earlier subjects
 * leak into unrelated scenes. The medium is restated either way because the
 * look drifts toward clean digital rendering across edits.
 */
export function composeFrameRefinement(
  userPrompt: string,
  originalPrompt: string,
  options: ComposeOptions = {},
): string {
  const revision = userPrompt.trim();
  if (!isCraftNote(revision)) {
    return composeFramePrompt(revision, options);
  }

  const original = originalPrompt.trim();
  const kind = framingKind(original);
  const framing = framingOf(
    options.framing ?? "wide cinematic 16:9 composition",
    kind,
  );
  return [
    `Scene (follow exactly): ${original}.`,
    `${sceneScope(original)}.`,
    kind === "still"
      ? "Draw only those picture contents as an ink-and-wash plate, every form a closed outlined shape."
      : "Draw only that inventory as an ink-and-wash plate — every closed shape belongs to it.",
    `Revised: ${revision}.`,
    "Keep the same setting, subjects and point of view; change only what was asked.",
    `${FIDELITY}.`,
    `${DRAWING}.`,
    `${COLOUR}.`,
    `${MEDIUM}.`,
    `${DENSITY}.`,
    `${framing}.`,
    `${WORDLESS}.`,
  ].join(" ");
}

/**
 * Motion for the image-to-video stage. Sparse on purpose: restating the whole
 * medium here makes pixverse redraw the plate.
 *
 * Live failures taught the rules below:
 *   - "leaves and clouds" → floating foliage and cloud blobs inside a room
 *   - "distant traffic" → a car invented on the street that was not in the still
 *   - HD / ltx often pushes in. Naming the zoom made it worse, so the
 *     camera is described as already locked, and motion is given to the
 *     background that is already in the painting.
 */
export function composeMotionPrompt(userPrompt: string): string {
  const wish = userPrompt.trim();
  const asked = wish
    ? `Also, only if it is already in the painting: ${wish}.`
    : "";

  return [
    "Static camera, locked tripod, fixed focal length, fixed scale for the whole clip. The frame size on frame 1 is the frame size on the last frame.",
    "The foreground subject stays the same size and in the same place.",
    "Motion is only in the background that is already painted behind the subject: a slow drift of distant air, a slight sway where foliage is already drawn, a small ripple where water is already drawn. If the still has no such background, the plate stays nearly still.",
    "Same outlines, same colours, same crop, same brightness. One continuous shot.",
    asked,
  ]
    .filter(Boolean)
    .join(" ");
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
  "anime",
  "oil painting",
  "impressionist landscape without outlines",
  "abstract wash",
  "oversaturated",
  "neon",
  "fast motion",
  "camera shake",
  "camera zoom",
  "zoom in",
  "push in",
  "dolly in",
  "Ken Burns",
  "scale up",
  "tight crop",
  "morphing",
].join(", ");
