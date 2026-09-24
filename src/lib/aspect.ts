/**
 * Output formats the studio offers. Keys match the image_size values Flux
 * accepts on Livepeer (`landscape_16_9`, `portrait_16_9`, …).
 */

export type AspectId =
  | "landscape_16_9"
  | "landscape_4_3"
  | "square_hd"
  | "portrait_4_3"
  | "portrait_16_9";

export interface AspectOption {
  id: AspectId;
  /** Short label shown in the picker, e.g. 16:9. */
  label: string;
  /** One word for the kind of frame. */
  hint: string;
  /** Tailwind aspect utility for the stage. */
  stageClass: string;
  /** Width ÷ height — used to cap tall stages so they do not fill the page. */
  widthOverHeight: number;
  /** Tall formats shrink to a max height instead of stretching full column width. */
  tall: boolean;
  /** Phrase embedded in the style contract. */
  framing: string;
}

export const DEFAULT_ASPECT: AspectId = "landscape_16_9";

export const ASPECT_OPTIONS: AspectOption[] = [
  {
    id: "landscape_16_9",
    label: "16:9",
    hint: "wide",
    stageClass: "aspect-video",
    widthOverHeight: 16 / 9,
    tall: false,
    framing: "wide cinematic 16:9 composition",
  },
  {
    id: "landscape_4_3",
    label: "4:3",
    hint: "landscape",
    stageClass: "aspect-[4/3]",
    widthOverHeight: 4 / 3,
    tall: false,
    framing: "classic 4:3 composition",
  },
  {
    id: "square_hd",
    label: "1:1",
    hint: "square",
    stageClass: "aspect-square",
    widthOverHeight: 1,
    tall: false,
    framing: "square 1:1 composition",
  },
  {
    id: "portrait_4_3",
    label: "3:4",
    hint: "portrait",
    stageClass: "aspect-[3/4]",
    widthOverHeight: 3 / 4,
    tall: true,
    framing: "tall 3:4 portrait composition",
  },
  {
    id: "portrait_16_9",
    label: "9:16",
    hint: "story",
    stageClass: "aspect-[9/16]",
    widthOverHeight: 9 / 16,
    tall: true,
    framing: "vertical 9:16 story composition",
  },
];

export function aspectOf(id: AspectId | string | null | undefined): AspectOption {
  return (
    ASPECT_OPTIONS.find((option) => option.id === id) ??
    ASPECT_OPTIONS.find((option) => option.id === DEFAULT_ASPECT)!
  );
}

/** Closest studio format to a plate's own width and height. */
export function nearestAspect(width: number, height: number): AspectId {
  const ratio = width / Math.max(height, 1);
  let best = ASPECT_OPTIONS[0];
  let bestGap = Infinity;
  for (const option of ASPECT_OPTIONS) {
    const gap = Math.abs(Math.log(ratio / option.widthOverHeight));
    if (gap < bestGap) {
      best = option;
      bestGap = gap;
    }
  }
  return best.id;
}

export function isAspectId(value: unknown): value is AspectId {
  return (
    typeof value === "string" &&
    ASPECT_OPTIONS.some((option) => option.id === value)
  );
}

/**
 * Pixel canvas for style plates and post-crop. Sizes sit near Flux HD enums
 * so kontext-edit / flux-dev land on a frame matching the picker, not the
 * reference's native ratio.
 */
export function canvasSize(id: AspectId): { width: number; height: number } {
  switch (id) {
    case "landscape_16_9":
      return { width: 1344, height: 768 };
    case "landscape_4_3":
      return { width: 1152, height: 864 };
    case "square_hd":
      return { width: 1024, height: 1024 };
    case "portrait_4_3":
      return { width: 864, height: 1152 };
    case "portrait_16_9":
      return { width: 768, height: 1344 };
  }
}
