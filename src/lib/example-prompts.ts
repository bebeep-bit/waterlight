export interface ExamplePrompt {
  /** Two or three words shown on the card. */
  label: string;
  /** The full brief dropped into the composer when chosen. */
  prompt: string;
}

/**
 * Deliberately spread across subjects — a vessel, a creature, a landscape, a
 * building, weather, an interior — because the style is not tied to any one of
 * them. Briefs stay short (about 5–10 words): enough scene, no style lecture.
 */
export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    label: "The sky ark",
    prompt: "Wooden boat drifting above a flowering sea of clouds",
  },
  {
    label: "The stone keeper",
    prompt: "Giant armoured figure in a canyon with waterfall",
  },
  {
    label: "Sea of clouds",
    prompt: "Sunrise over endless clouds and two distant peaks",
  },
  {
    label: "Wind chimes",
    prompt: "Hilltop pavilion with ribbons pulled by wind",
  },
  {
    label: "The lantern keeper",
    prompt: "Hooded traveller crossing a flooded causeway at dusk",
  },
  {
    label: "Library of rain",
    prompt: "Rain falling through a broken abandoned library roof",
  },
  {
    label: "Glass of citrus",
    prompt: "Peach lemonade glass with citrus on checkered napkin",
  },
  {
    label: "Desert train",
    prompt: "Pale passenger train crossing desert at warm sunset",
  },
  {
    label: "Morning balloon",
    prompt: "Striped hot-air balloon above soft rolling hills",
  },
  {
    label: "Forest bridge",
    prompt: "Arched wooden bridge over a calm forest stream",
  },
  {
    label: "Winter fox",
    prompt: "Red fox standing in soft snow among bare trees",
  },
  {
    label: "Mushroom glade",
    prompt: "Forest clearing of oversized pink and gold mushrooms",
  },
  {
    label: "Bowl of berries",
    prompt: "Wooden bowl overflowing with ripe strawberries",
  },
  {
    label: "Desk lamp",
    prompt: "Pastel books leaning beside a cream desk lamp",
  },
  {
    label: "Tide pool",
    prompt: "Quiet canyon pool with stones and thin waterfall",
  },
  {
    label: "Ribbon moth",
    prompt: "Large ribbon-winged moth resting on a blossom",
  },
  {
    label: "Cloud puffs",
    prompt: "Soft rounded clouds drifting over a pale horizon",
  },
];
