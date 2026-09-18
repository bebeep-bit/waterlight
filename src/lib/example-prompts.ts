export interface ExamplePrompt {
  /** Two or three words shown on the card. */
  label: string;
  /** The full brief dropped into the composer when chosen. */
  prompt: string;
}

/**
 * Deliberately spread across subjects — a vessel, a creature, a landscape, a
 * building, weather, an interior — because the style is not tied to any one of
 * them. The reference frames range from a flying ark to a sea of clouds, and
 * the examples should show that range rather than teach people the app only
 * paints one kind of thing.
 *
 * Each one describes a scene and leaves the painting to the style contract.
 */
export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    label: "The sky ark",
    prompt:
      "A wooden boat drifts above a sea of clouds, a great flowering vine growing out of its hull and trailing behind it.",
  },
  {
    label: "The stone keeper",
    prompt:
      "An enormous armoured figure stands waist-deep in a narrow canyon, a slow waterfall falling from its shoulders.",
  },
  {
    label: "Sea of clouds",
    prompt:
      "Sunrise over an endless field of cloud, with the peaks of two far mountains breaking the surface.",
  },
  {
    label: "Wind chimes",
    prompt:
      "A small hilltop pavilion of pale columns, its chimes and ribbons pulled sideways by the wind.",
  },
  {
    label: "The lantern keeper",
    prompt:
      "A hooded traveller crosses a long flooded causeway at dusk, carrying a lantern that lights only the water at their feet.",
  },
  {
    label: "Library of rain",
    prompt:
      "Rain falls through the broken roof of an abandoned library, pooling between the shelves and reflecting the grey sky.",
  },
];
