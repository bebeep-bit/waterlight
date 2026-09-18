/**
 * Shared vocabulary between the UI, the API routes and the Livepeer Agent layer.
 * The shapes deliberately mirror what `create_media` / `get_create_media`
 * return so swapping the mock engine for the real MCP client is a no-op here.
 */

/** Lifecycle of a single render request. */
export type RenderPhase =
  | "idle"
  | "composing"
  | "queued"
  | "painting"
  | "animating"
  | "ready"
  | "failed";

/** A phase the agent reports while it works, surfaced verbatim in the UI. */
export interface RenderProgress {
  phase: RenderPhase;
  /** 0–1. Null while the agent has not yet committed to an estimate. */
  fraction: number | null;
  /** One short, human line. Never raw JSON. */
  note: string;
}

/** A finished film. */
export interface Film {
  id: string;
  videoUrl: string;
  posterUrl: string | null;
  durationSeconds: number;
  /** Which capability actually ran — the agent may substitute a sibling model. */
  capability: string;
  /** Present only when the served model differs from the requested one. */
  modelNote: string | null;
  createdAt: string;
  /** True while we are running against the mock engine rather than Livepeer. */
  isMock: boolean;
}

/** One exchange in the conversation: the wish, then what the agent painted. */
export interface Turn {
  id: string;
  /** "seed" is the opening prompt; "refinement" is every follow-up. */
  kind: "seed" | "refinement";
  /** Exactly what the user typed, unembellished. */
  prompt: string;
  progress: RenderProgress;
  film: Film | null;
  error: string | null;
}

/** The whole session. One film lineage, refined turn by turn. */
export interface Session {
  turns: Turn[];
  /** Index into `turns` of the film currently on the stage. */
  activeTurnIndex: number;
  /** Agent-side conversation handle, so refinements build on prior renders. */
  threadId: string | null;
}

/* ---------- API contracts ---------- */

export interface RenderRequest {
  prompt: string;
  kind: Turn["kind"];
  threadId: string | null;
  /** The opening brief, resent with refinements so the agent keeps the scene. */
  originalPrompt: string;
  /** The film a refinement should build upon. */
  parentFilmId: string | null;
}

export interface RenderAccepted {
  jobId: string;
  threadId: string;
  progress: RenderProgress;
}

export interface RenderStatus {
  jobId: string;
  progress: RenderProgress;
  film: Film | null;
  error: string | null;
}
