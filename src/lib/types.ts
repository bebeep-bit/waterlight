/**
 * Shared vocabulary between the UI, the API routes and the Livepeer Agent
 * layer.
 *
 * The product has two distinct artefacts, and keeping them separate in the
 * types is the whole design: a Frame is a still watercolour that costs a third
 * of a cent and arrives in two seconds, so it is what the conversation acts
 * on. A Film is the animation of an approved frame, costs about a dollar, and
 * is therefore only ever made on an explicit request.
 */

export type Phase =
  | "idle"
  | "composing"
  | "queued"
  | "painting"
  | "animating"
  | "ready"
  | "failed";

export interface Progress {
  phase: Phase;
  /** 0-1. Null while the agent has not committed to an estimate. */
  fraction: number | null;
  /** One short, human line. Never raw JSON. */
  note: string;
}

/** A still watercolour. Cheap, fast, and what the user refines. */
export interface Frame {
  id: string;
  imageUrl: string;
  /** Which capability actually ran. */
  capability: string;
  /** USD, as reported by the agent for this call. */
  costUsd: number | null;
  createdAt: string;
  isMock: boolean;
}

/** An animated film, made from one approved frame. */
export interface Film {
  id: string;
  videoUrl: string;
  /** The frame it was animated from, used as the poster. */
  posterUrl: string | null;
  durationSeconds: number;
  capability: string;
  costUsd: number | null;
  createdAt: string;
  isMock: boolean;
}

/** One exchange: the wish, and the wash the agent painted for it. */
export interface Turn {
  id: string;
  kind: "seed" | "refinement";
  /** Exactly what the user typed, unembellished. */
  prompt: string;
  progress: Progress;
  frame: Frame | null;
  error: string | null;
}

export interface Session {
  turns: Turn[];
  /** Index into `turns` of the frame currently on the stage. */
  activeTurnIndex: number;
  /** The film, once the user has asked for one. */
  film: Film | null;
  filmProgress: Progress | null;
  filmError: string | null;
  /** Everything spent this session, summed from agent-reported costs. */
  spentUsd: number;
}

/* ---------- API contracts ---------- */

export interface FrameRequest {
  prompt: string;
  kind: Turn["kind"];
  /** The opening brief, resent so refinements keep the scene. */
  originalPrompt: string;
}

export interface FrameResponse {
  frame: Frame;
  /** Provider notes worth surfacing, e.g. a dropped parameter. */
  warnings: string[];
}

export interface FilmRequest {
  /** The approved frame to animate. */
  imageUrl: string;
  /** What the motion should do, in the user's words. */
  prompt: string;
  tier: "preview" | "final";
  seconds: number;
}

export interface FilmAccepted {
  jobId: string;
  progress: Progress;
}

export interface FilmStatus {
  jobId: string;
  progress: Progress;
  film: Film | null;
  error: string | null;
}
