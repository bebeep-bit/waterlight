export interface ExamplePrompt {
  /** Two or three words shown on the card. */
  label: string;
  /** The full brief dropped into the composer when chosen. */
  prompt: string;
}

export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    label: "The last bud",
    prompt:
      "A tiny gardener kneels in an ash-grey courtyard and cups her hands around the single red bud still alive in the world.",
  },
  {
    label: "Rain remembers",
    prompt:
      "Grey rain falls on a dead garden. Where each drop lands, a faint colour surfaces for a moment, then forgets itself again.",
  },
  {
    label: "Carrying it home",
    prompt:
      "A small figure walks a long colourless bridge at dusk, shielding one glowing yellow flower from the wind with her coat.",
  },
  {
    label: "The watering",
    prompt:
      "An old tin can tips. Water spreads through pale paper soil and a thread of green climbs slowly toward the light.",
  },
  {
    label: "Petals let go",
    prompt:
      "The last petal loosens and drifts across a washed-out city. Everything it passes gains a breath of colour and loses it.",
  },
  {
    label: "Two hands",
    prompt:
      "A child's hand passes the bud into a weathered hand. The paper around them blooms warm for a single heartbeat.",
  },
];
