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

import type { AspectId } from "@/lib/aspect";
import type { FilmQuality } from "@/lib/agent/capabilities";

export type { AspectId, FilmQuality };

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
  /** Aspect used for this wash — drives the stage frame. */
  aspect: AspectId;
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
  /** Which animate tier produced this film. */
  quality: FilmQuality;
  costUsd: number | null;
  createdAt: string;
  isMock: boolean;
}

/** A finished still or film kept in the strip after the stage moves on. */
export interface KeptMedia {
  id: string;
  kind: "image" | "video";
  src: string;
  aspect: AspectId;
  posterUrl?: string;
}

/** One exchange: the wish, and the wash the agent painted for it. */
export interface Turn {
  id: string;
  kind: "seed" | "refinement";
  /** Exactly what the user typed, unembellished. */
  prompt: string;
  /** Format requested for this wash. */
  aspect?: AspectId;
  progress: Progress;
  frame: Frame | null;
  /** Film made from this wash, kept after the stage moves on. */
  film?: Film | null;
  /** Earlier stills and films for this prompt, after a regenerate. */
  kept?: KeptMedia[];
  error: string | null;
}

export interface Session {
  turns: Turn[];
  /** Index into `turns` of the frame currently on the stage. */
  activeTurnIndex: number;
  /** Format chosen for new washes this session. */
  aspect: AspectId;
  /** The film, once the user has asked for one. */
  film: Film | null;
  filmProgress: Progress | null;
  filmError: string | null;
  /**
   * Once Animate has been started, keep film | still side by side — even while
   * the still is re-painted.
   */
  pairLayout: boolean;
  /** Everything spent this session, summed from agent-reported costs. */
  spentUsd: number;
}

/* ---------- API contracts ---------- */

export type ReferenceMode = "style" | "subject";

export interface FrameRequest {
  prompt: string;
  kind: Turn["kind"];
  /** The opening brief, resent so refinements keep the scene. */
  originalPrompt: string;
  /** Output aspect; defaults to 16:9. */
  aspect?: AspectId;
  /** Hosted style plate. Hues, strokes, drawn-art handling. */
  referenceUrl?: string;
  /** Hosted object plate. What is in the frame. */
  subjectUrl?: string;
  /** How the reference is used: style plate vs subject/object lock. */
  referenceMode?: ReferenceMode;
}

export interface FrameResponse {
  frame: Frame;
  /** Provider notes worth surfacing, e.g. a dropped parameter. */
  warnings: string[];
}

export interface FilmRequest {
  /** The approved frame to animate. */
  imageUrl: string;
  /** What the motion should do, in the user's words. Optional. */
  prompt: string;
  /** standard = 5s pixverse; hd = 6s ltx at 1080p. */
  quality?: FilmQuality;
  /** Match the still. ltx-i2v otherwise defaults toward 16:9. */
  aspect?: AspectId;
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
