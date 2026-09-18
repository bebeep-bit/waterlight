import { randomUUID } from "node:crypto";
import { FILM_TIERS, FRAME } from "@/lib/agent/capabilities";
import { AgentError, callTool, num, str } from "@/lib/agent/mcp";
import {
  composeFramePrompt,
  composeFrameRefinement,
  composeMotionPrompt,
  FILM_DURATION_SECONDS,
} from "@/lib/style-contract";
import type {
  Film,
  FilmAccepted,
  FilmRequest,
  FilmStatus,
  FrameRequest,
  FrameResponse,
  Progress,
} from "@/lib/types";

/**
 * The only file that knows how films get made.
 *
 * Frames run on the blocking path: `flux-schnell` answers in about two
 * seconds, well inside a request. Films run async because the i2v capabilities
 * take a minute — `run_capability` hands back a job id and we poll
 * `get_create_media`, which the network documents as free and safe at 5-10s
 * intervals.
 *
 * Set MOCK_AGENT=1 to run the whole studio without spending anything. The mock
 * is not just for development: a live demo that cannot fail is worth keeping.
 */

const USE_MOCK = process.env.MOCK_AGENT === "1";

const MOCK_FRAME_URL = "/placeholder-frame.jpg";
const MOCK_FILM_URL = "/placeholder-film.mp4";

/* ---------- frames ---------- */

export async function paintFrame(
  request: FrameRequest,
): Promise<FrameResponse> {
  const prompt =
    request.kind === "seed"
      ? composeFramePrompt(request.prompt)
      : composeFrameRefinement(request.prompt, request.originalPrompt);

  if (USE_MOCK) {
    await sleep(900);
    return {
      frame: {
        id: randomUUID(),
        imageUrl: MOCK_FRAME_URL,
        capability: `${FRAME.name} (mock)`,
        costUsd: 0,
        createdAt: new Date().toISOString(),
        isMock: true,
      },
      warnings: [],
    };
  }

  const result = await callTool("run_capability", {
    capability: FRAME.name,
    prompt,
    inputs: { image_size: "landscape_16_9" },
    async: false,
  });

  const imageUrl = str(result.structured, "url");
  if (!imageUrl) {
    throw new AgentError(result.text || "The agent returned no image.");
  }

  return {
    frame: {
      id: randomUUID(),
      imageUrl,
      capability: str(result.structured, "capability") ?? FRAME.name,
      costUsd: num(result.structured, "cost_usd_estimated"),
      createdAt: new Date().toISOString(),
      isMock: false,
    },
    warnings: result.warnings,
  };
}

/* ---------- films ---------- */

interface FilmJob {
  id: string;
  /** Livepeer's job id, absent while we are on the mock path. */
  remoteJobId: string | null;
  posterUrl: string;
  seconds: number;
  capability: string;
  startedAt: number;
  progress: Progress;
  film: Film | null;
  error: string | null;
}

/** Process-local: survives hot reloads, not a cold start. */
const jobs: Map<string, FilmJob> = ((
  globalThis as { __lastColorFilmJobs?: Map<string, FilmJob> }
).__lastColorFilmJobs ??= new Map());

export async function startFilm(request: FilmRequest): Promise<FilmAccepted> {
  const tier = FILM_TIERS[request.tier];
  const seconds = [6, 8, 10].includes(request.seconds)
    ? request.seconds
    : FILM_DURATION_SECONDS;

  const job: FilmJob = {
    id: randomUUID(),
    remoteJobId: null,
    posterUrl: request.imageUrl,
    seconds,
    capability: tier.name,
    startedAt: Date.now(),
    progress: {
      phase: "queued",
      fraction: 0.08,
      note: "Handing the painting to the network.",
    },
    film: null,
    error: null,
  };
  jobs.set(job.id, job);

  if (USE_MOCK) return { jobId: job.id, progress: job.progress };

  const result = await callTool("run_capability", {
    capability: tier.name,
    prompt: composeMotionPrompt(request.prompt),
    source_url: request.imageUrl,
    inputs: { duration: seconds },
    async: true,
    timeout: 300,
    /* Guards against a double-submit billing us twice for one film. */
    idempotency_key: `lca-film-${job.id}`,
  });

  const remoteJobId = str(result.structured, "job_id");

  /* A fast provider may answer inline even on the async path. */
  const inlineUrl = str(result.structured, "url");
  if (!remoteJobId && inlineUrl) {
    job.film = finishFilm(job, inlineUrl, num(result.structured, "cost_usd_estimated"));
    job.progress = { phase: "ready", fraction: 1, note: "The film is dry." };
    return { jobId: job.id, progress: job.progress };
  }

  if (!remoteJobId) {
    throw new AgentError(result.text || "The agent accepted no film job.");
  }

  job.remoteJobId = remoteJobId;
  job.progress = {
    phase: "animating",
    fraction: 0.2,
    note: "Teaching the strokes to move.",
  };

  return { jobId: job.id, progress: job.progress };
}

export async function readFilm(jobId: string): Promise<FilmStatus | null> {
  const job = jobs.get(jobId);
  if (!job) return null;

  if (job.film || job.error) return snapshot(job);

  if (USE_MOCK) {
    const elapsed = Date.now() - job.startedAt;
    if (elapsed > 8_000) {
      job.film = finishFilm(job, MOCK_FILM_URL, 0);
      job.progress = { phase: "ready", fraction: 1, note: "The film is dry." };
    } else {
      job.progress = {
        phase: "animating",
        fraction: 0.2 + (elapsed / 8_000) * 0.7,
        note: "Teaching the strokes to move.",
      };
    }
    return snapshot(job);
  }

  try {
    const result = await callTool("get_create_media", {
      job_id: job.remoteJobId,
    });

    const status = str(result.structured, "status");
    const url = str(result.structured, "url");

    if (url) {
      job.film = finishFilm(job, url, num(result.structured, "cost_usd_estimated"));
      job.progress = { phase: "ready", fraction: 1, note: "The film is dry." };
    } else if (status === "failed") {
      job.error = result.text || "The render failed.";
      job.progress = { phase: "failed", fraction: null, note: "The paper tore." };
    } else {
      /* No real percentage exists, so creep toward 0.9 on elapsed time
         rather than inventing precision we do not have. */
      const elapsed = (Date.now() - job.startedAt) / 1000;
      const expected = FILM_TIERS.final.p50Seconds;
      job.progress = {
        phase: status === "queued" ? "queued" : "animating",
        fraction: Math.min(0.2 + (elapsed / expected) * 0.7, 0.9),
        note:
          status === "queued"
            ? "Waiting for a painter on the network."
            : "Teaching the strokes to move.",
      };
    }
  } catch (error) {
    job.error = error instanceof Error ? error.message : "Unknown failure.";
    job.progress = { phase: "failed", fraction: null, note: "The paper tore." };
  }

  return snapshot(job);
}

function finishFilm(job: FilmJob, videoUrl: string, costUsd: number | null): Film {
  return {
    id: job.id,
    videoUrl,
    posterUrl: job.posterUrl,
    durationSeconds: job.seconds,
    capability: job.capability,
    costUsd,
    createdAt: new Date().toISOString(),
    isMock: USE_MOCK,
  };
}

function snapshot(job: FilmJob): FilmStatus {
  return {
    jobId: job.id,
    progress: job.progress,
    film: job.film,
    error: job.error,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
