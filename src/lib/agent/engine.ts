import { randomUUID } from "node:crypto";
import {
  composeRefinementPrompt,
  composeSeedPrompt,
  FILM_DURATION_SECONDS,
} from "@/lib/style-contract";
import type {
  Film,
  RenderAccepted,
  RenderProgress,
  RenderRequest,
  RenderStatus,
} from "@/lib/types";

/**
 * The single seam between the product and Livepeer Agent.
 *
 * Today this is a mock that walks a job through the same phases the agent
 * reports, on the same async accept-then-poll contract as `create_media` +
 * `get_create_media`. When the MCP client lands, only this file changes.
 */

interface Job {
  id: string;
  threadId: string;
  /** The fully composed prompt that would go to `create_media`. */
  composedPrompt: string;
  startedAt: number;
  progress: RenderProgress;
  film: Film | null;
  error: string | null;
}

/**
 * Process-local, so it survives dev hot reloads but not a serverless cold
 * start. Fine for the mock; the real agent keeps job state server-side.
 */
const jobs: Map<string, Job> = ((
  globalThis as { __lastColorJobs?: Map<string, Job> }
).__lastColorJobs ??= new Map());

/**
 * Placeholder footage so preview and download are wired end to end. Vendored
 * into /public (CC0, from MDN) rather than pulled from a CDN, so the studio
 * works offline and the demo can never 403 mid-presentation.
 */
const MOCK_VIDEO_URL = process.env.MOCK_VIDEO_URL ?? "/placeholder-film.mp4";

const SCRIPT: ReadonlyArray<{ at: number; progress: RenderProgress }> = [
  {
    at: 0,
    progress: { phase: "queued", fraction: 0.05, note: "Stretching the paper." },
  },
  {
    at: 1_800,
    progress: {
      phase: "painting",
      fraction: 0.35,
      note: "Laying the first grey wash.",
    },
  },
  {
    at: 5_000,
    progress: {
      phase: "painting",
      fraction: 0.6,
      note: "Letting the colour bleed.",
    },
  },
  {
    at: 8_500,
    progress: {
      phase: "animating",
      fraction: 0.85,
      note: "Teaching the strokes to move.",
    },
  },
  { at: 12_000, progress: { phase: "ready", fraction: 1, note: "The film is dry." } },
];

function progressFor(elapsed: number): RenderProgress {
  let current = SCRIPT[0].progress;
  for (const step of SCRIPT) {
    if (elapsed >= step.at) current = step.progress;
  }
  return current;
}

export function startRender(request: RenderRequest): RenderAccepted {
  const composedPrompt =
    request.kind === "seed"
      ? composeSeedPrompt(request.prompt)
      : composeRefinementPrompt(request.prompt, request.originalPrompt);

  const job: Job = {
    id: randomUUID(),
    threadId: request.threadId ?? randomUUID(),
    composedPrompt,
    startedAt: Date.now(),
    progress: SCRIPT[0].progress,
    film: null,
    error: null,
  };
  jobs.set(job.id, job);

  return { jobId: job.id, threadId: job.threadId, progress: job.progress };
}

export function readRender(jobId: string): RenderStatus | null {
  const job = jobs.get(jobId);
  if (!job) return null;

  job.progress = progressFor(Date.now() - job.startedAt);

  if (job.progress.phase === "ready" && !job.film) {
    job.film = {
      id: job.id,
      videoUrl: MOCK_VIDEO_URL,
      posterUrl: null,
      durationSeconds: FILM_DURATION_SECONDS,
      capability: "mock-watercolour-t2v",
      modelNote: null,
      createdAt: new Date().toISOString(),
      isMock: true,
    };
  }

  return {
    jobId: job.id,
    progress: job.progress,
    film: job.film,
    error: job.error,
  };
}
