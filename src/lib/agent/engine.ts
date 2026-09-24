import { randomUUID } from "node:crypto";
import {
  filmTier,
  FRAME,
  type FilmQuality,
} from "@/lib/agent/capabilities";
import { fitFilmToAspect } from "@/lib/agent/fit-film";
import {
  fitReferenceToAspect,
  paintStyleOntoObject,
} from "@/lib/agent/fit-reference";
import { AgentError, callTool, num, str } from "@/lib/agent/mcp";
import { trimEdgesAndRehost } from "@/lib/agent/trim-edges";
import { aspectOf, DEFAULT_ASPECT, isAspectId, type AspectId } from "@/lib/aspect";
import {
  composeFramePrompt,
  composeFrameRefinement,
  composeMotionPrompt,
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
 * Frames and films both go through the creative MCP `create_media` tool
 * (hackathon harness — no `run_capability` on that surface). Images return a
 * URL inline; video returns a `job_id` and we poll `get_create_media`, which
 * the network documents as free and safe at 5–10s intervals.
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
  const aspect = isAspectId(request.aspect) ? request.aspect : DEFAULT_ASPECT;
  const framing = aspectOf(aspect).framing;
  const referenceUrl = request.referenceUrl?.trim() || undefined;
  const subjectUrl = request.subjectUrl?.trim() || undefined;
  const prompt = subjectUrl
    ? composeObjectPrompt(request.prompt, framing, Boolean(referenceUrl))
    : referenceUrl
      ? composeReferencePrompt(request.prompt, framing)
      : request.kind === "seed"
        ? composeFramePrompt(request.prompt, { framing })
        : composeFrameRefinement(request.prompt, request.originalPrompt, {
            framing,
          });

  if (USE_MOCK) {
    await sleep(900);
    return {
      frame: {
        id: randomUUID(),
        imageUrl: MOCK_FRAME_URL,
        capability: `${FRAME.name} (mock)`,
        costUsd: 0,
        aspect,
        createdAt: new Date().toISOString(),
        isMock: true,
      },
      warnings: [],
    };
  }

  let result;
  try {
    result = await runFrameCapability(prompt, aspect, referenceUrl, subjectUrl);
  } catch (error) {
    throw new AgentError(
      humanizeAgentError(
        error instanceof Error ? error.message : "The agent returned no image.",
      ),
    );
  }

  const rawUrl = str(result.structured, "url");
  if (!rawUrl) {
    throw new AgentError(
      humanizeAgentError(result.text || "The agent returned no image."),
    );
  }

  /* Guarantee the wordless rule rather than hoping the model honoured it.
     If the trim fails we still have a usable frame, so fall back to the
     original rather than losing the render the user just paid for. */
  let imageUrl = rawUrl;
  const warnings = [...result.warnings];
  try {
    imageUrl = await trimEdgesAndRehost(rawUrl, aspect);
  } catch (error) {
    console.error(
      "waterlight: frame edge trim failed",
      error instanceof Error ? error.message : error,
    );
  }

  return {
    frame: {
      id: randomUUID(),
      imageUrl,
      capability: str(result.structured, "capability") ?? FRAME.name,
      costUsd: num(result.structured, "cost_usd_estimated"),
      aspect,
      createdAt: new Date().toISOString(),
      isMock: false,
    },
    warnings,
  };
}

/* ---------- films ---------- */

interface FilmJob {
  id: string;
  /** Livepeer's job id, absent while we are on the mock path. */
  remoteJobId: string | null;
  posterUrl: string;
  /** Motion prompt already composed for this job. */
  motionPrompt: string;
  seconds: number;
  capability: string;
  quality: FilmQuality;
  resolution?: string;
  /** Same picker ratio as the still, so the clip is not forced to 16:9. */
  aspectId: AspectId;
  aspectRatio: string;
  /** Crop-to-frame in flight, so two polls do not encode twice. */
  fitPromise?: Promise<string>;
  timeoutSeconds: number;
  p50Seconds: number;
  startedAt: number;
  /** How many times we re-dispatched after a dead runner. */
  retries: number;
  progress: Progress;
  film: Film | null;
  error: string | null;
}

/** Process-local: survives hot reloads, not a cold start. */
const jobs: Map<string, FilmJob> = ((
  globalThis as { __waterlightFilmJobs?: Map<string, FilmJob> }
).__waterlightFilmJobs ??= new Map());

export async function startFilm(request: FilmRequest): Promise<FilmAccepted> {
  const tier = filmTier(request.quality);
  const seconds = tier.durationSeconds;
  const motionPrompt = composeMotionPrompt(request.prompt);

  const job: FilmJob = {
    id: randomUUID(),
    remoteJobId: null,
    posterUrl: request.imageUrl,
    motionPrompt,
    seconds,
    capability: tier.name,
    quality: tier.quality,
    resolution: tier.resolution,
    aspectId: isAspectId(request.aspect) ? request.aspect : DEFAULT_ASPECT,
    aspectRatio: aspectOf(
      isAspectId(request.aspect) ? request.aspect : DEFAULT_ASPECT,
    ).label,
    timeoutSeconds: tier.timeoutSeconds,
    p50Seconds: tier.p50Seconds,
    startedAt: Date.now(),
    retries: 0,
    progress: {
      phase: "queued",
      fraction: 0.08,
      note:
        tier.quality === "hd"
          ? "Handing the painting to the HD network."
          : "Handing the painting to the network.",
    },
    film: null,
    error: null,
  };
  jobs.set(job.id, job);

  if (USE_MOCK) return { jobId: job.id, progress: job.progress };

  await dispatchFilm(job);

  return { jobId: job.id, progress: job.progress };
}

async function dispatchFilm(job: FilmJob): Promise<void> {
  const result = await callTool("create_media", {
    action: "animate",
    prompt: job.motionPrompt,
    source_url: job.posterUrl,
    model_override: job.capability,
    duration: job.seconds,
    aspect_ratio: job.aspectRatio,
    /* New key on each dispatch so a dead runner can be retried. */
    idempotency_key: `wl-film-${job.quality}-${job.id}-r${job.retries}`,
  });

  const remoteJobId = str(result.structured, "job_id");

  /* A fast provider may answer inline even on the async path. */
  const inlineUrl = str(result.structured, "url");
  if (!remoteJobId && inlineUrl) {
    const fitted = await matchFilmFrame(job, inlineUrl);
    job.film = finishFilm(job, fitted, num(result.structured, "cost_usd_estimated"));
    job.progress = { phase: "ready", fraction: 1, note: "The film is dry." };
    return;
  }

  if (!remoteJobId) {
    throw new AgentError(result.text || "The agent accepted no film job.");
  }

  job.remoteJobId = remoteJobId;
  job.startedAt = Date.now();
  job.progress = {
    phase: "animating",
    fraction: 0.2,
    note:
      job.retries > 0
        ? "The network stalled — trying again."
        : "Teaching the strokes to move.",
  };
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
      const fitted = await matchFilmFrame(job, url);
      job.film = finishFilm(job, fitted, num(result.structured, "cost_usd_estimated"));
      job.progress = { phase: "ready", fraction: 1, note: "The film is dry." };
    } else if (status === "failed") {
      const raw = result.text || "The render failed.";
      if (isDeadRunner(raw) && job.retries < 1) {
        job.retries += 1;
        job.remoteJobId = null;
        job.progress = {
          phase: "queued",
          fraction: 0.12,
          note: "The network stalled — trying again.",
        };
        await dispatchFilm(job);
      } else {
        job.error = humanizeFilmError(raw, job.quality);
        job.progress = { phase: "failed", fraction: null, note: "The paper tore." };
      }
    } else {
      /* No real percentage exists, so creep toward 0.9 on elapsed time
         rather than inventing precision we do not have. */
      const elapsed = (Date.now() - job.startedAt) / 1000;
      const expected = job.p50Seconds;
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
    const raw = error instanceof Error ? error.message : "Unknown failure.";
    job.error = humanizeFilmError(raw, job.quality);
    job.progress = { phase: "failed", fraction: null, note: "The paper tore." };
  }

  return snapshot(job);
}

/** Livepeer dispatched nothing — safe to ask once more. */
function isDeadRunner(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes("runner_never_entered") ||
    text.includes("did not start within") ||
    text.includes("not-entered") ||
    text.includes("no entered_at")
  );
}

/** Livepeer demo credit sometimes flaps — safe to ask again. */
function isTransientAgentRefusal(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes("demo budget store unavailable") ||
    text.includes("budget store unavailable") ||
    text.includes("try again shortly") ||
    text.includes("not-entered") ||
    text.includes("runner_never_entered")
  );
}

function humanizeAgentError(message: string): string {
  const text = message.toLowerCase();
  if (
    text.includes("demo_budget_exhausted") ||
    text.includes("demo budget") ||
    text.includes("budget store unavailable")
  ) {
    return "Livepeer demo credit ran out. Unlock the hackathon $100 by verifying your email with Livepeer Agent, then try Paint again.";
  }
  if (text.includes("daily cap") || text.includes("spend_cap")) {
    return "Today's Livepeer credit is used up. Try again after it re-ups.";
  }
  if (text.includes("unknown tool") || text.includes("tool not found")) {
    return "Livepeer Agent tools changed. Restart the app and try Paint again.";
  }
  if (message.length > 220 || message.includes("create_media")) {
    return "The wash could not finish. Try Paint again in a moment.";
  }
  return message;
}

function composeObjectPrompt(
  userPrompt: string,
  framing: string,
  withStyle: boolean,
): string {
  const change = userPrompt.trim();
  return [
    change
      ? `Keep the objects in this picture and where they sit. Change only this: ${change}.`
      : "Keep the objects in this picture and where they sit.",
    withStyle
      ? "The hues and wash already on them are the style plate. Push that into watercolour brushstrokes and the look of drawn art, across this one picture."
      : "Paint them as ink-and-wash watercolour, a drawn plate.",
    "The painting fills the frame edge to edge.",
    `${framing}.`,
    "An unsigned painting.",
  ].join(" ");
}

function composeReferencePrompt(userPrompt: string, framing: string): string {
  const subject = userPrompt.trim();
  return [
    `Scene (follow exactly): ${subject}.`,
    "Paint that scene.",
    "From the style reference, take the pigment hues, the watercolour brushstrokes, and the drawing style.",
    "The subject of the picture is the scene.",
    "The painting fills the frame edge to edge.",
    `${framing}.`,
    "An unsigned painting.",
  ].join(" ");
}

async function runFrameCapability(
  prompt: string,
  aspectId: AspectId,
  referenceUrl?: string,
  subjectUrl?: string,
) {
  const maxAttempts = 5;
  const aspectRatio = aspectOf(aspectId).label;
  let lastError: unknown;

  /* Objects ride in as the edit source so the frame keeps them. Style, when
     it is the only plate, is a cast. model_override would ignore that cast. */
  const objectUrl =
    subjectUrl && referenceUrl
      ? await paintStyleOntoObject(subjectUrl, referenceUrl, aspectId)
      : subjectUrl
        ? await fitReferenceToAspect(subjectUrl, aspectId)
        : null;
  const styleUrl =
    !objectUrl && referenceUrl
      ? await fitReferenceToAspect(referenceUrl, aspectId)
      : null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (objectUrl) {
        return await callTool("create_media", {
          action: "generate",
          prompt,
          aspect_ratio: aspectRatio,
          cast: { reference_url: objectUrl, lock: "full" },
        });
      }
      return await callTool("create_media", {
        action: "generate",
        prompt,
        aspect_ratio: aspectRatio,
        ...(styleUrl
          ? { cast: { reference_url: styleUrl, lock: "style" } }
          : { model_override: FRAME.name }),
      });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : "";
      if (!isTransientAgentRefusal(message) || attempt === maxAttempts - 1) break;
      await sleep(1_200 * (attempt + 1));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new AgentError("The agent returned no image.");
}

function humanizeFilmError(message: string, quality: FilmQuality): string {
  const text = message.toLowerCase();
  if (isDeadRunner(message)) {
    return quality === "hd"
      ? "The network did not pick up the HD job. Try Animate again in a moment."
      : "The network did not pick up the job. Try Animate again in a moment.";
  }
  if (
    text.includes("demo_budget_exhausted") ||
    text.includes("demo budget") ||
    text.includes("budget store unavailable")
  ) {
    return "Livepeer demo credit ran out for video. Unlock the hackathon $100 by verifying your email with Livepeer Agent (Discord support thread or reply to the Atumera welcome mail), then try Animate again.";
  }
  if (text.includes("daily cap") || text.includes("spend_cap")) {
    return "Today's Livepeer credit is used up. Try again after it re-ups.";
  }
  /* Keep product copy short; raw job dumps are useless in the stage. */
  if (message.length > 180 || message.includes("Capability:") || message.includes("create_media")) {
    return "The film could not finish. Try Animate again.";
  }
  return message;
}

/** ltx often returns 16:9. Crop once so the file matches the still. */
async function matchFilmFrame(job: FilmJob, url: string): Promise<string> {
  job.fitPromise ??= fitFilmToAspect(url, job.aspectId, job.posterUrl);
  return job.fitPromise;
}

function finishFilm(job: FilmJob, videoUrl: string, costUsd: number | null): Film {
  return {
    id: job.id,
    videoUrl,
    posterUrl: job.posterUrl,
    durationSeconds: job.seconds,
    capability: job.capability,
    quality: job.quality,
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
