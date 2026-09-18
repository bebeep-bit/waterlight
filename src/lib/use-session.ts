"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FilmTier } from "@/lib/agent/capabilities";
import type {
  FilmAccepted,
  FilmStatus,
  FrameResponse,
  Session,
  Turn,
} from "@/lib/types";

/** The network documents polling get_create_media at 5-10s as safe and free. */
const POLL_INTERVAL_MS = 5_000;

const EMPTY: Session = {
  turns: [],
  activeTurnIndex: -1,
  film: null,
  filmProgress: null,
  filmError: null,
  spentUsd: 0,
};

/**
 * Owns the conversation. Two loops live here, and they are deliberately
 * different shapes: frames resolve inside a single request, so refining is a
 * plain await. Films take a minute, so they are polled.
 */
export function useSession() {
  const [session, setSession] = useState<Session>(EMPTY);
  const [pendingFilmJob, setPendingFilmJob] = useState<string | null>(null);
  /** Warnings from the provider, e.g. a parameter it silently ignores. */
  const [warnings, setWarnings] = useState<string[]>([]);

  const patchTurn = useCallback((turnId: string, patch: Partial<Turn>) => {
    setSession((prev) => ({
      ...prev,
      turns: prev.turns.map((turn) =>
        turn.id === turnId ? { ...turn, ...patch } : turn,
      ),
    }));
  }, []);

  /** Paint or repaint the still. Cheap enough to do freely. */
  const paint = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed) return;

      const isSeed = session.turns.length === 0;
      const turn: Turn = {
        id: crypto.randomUUID(),
        kind: isSeed ? "seed" : "refinement",
        prompt: trimmed,
        progress: {
          phase: "painting",
          fraction: 0.4,
          note: "Laying the wash.",
        },
        frame: null,
        error: null,
      };

      setSession((prev) => ({
        ...prev,
        turns: [...prev.turns, turn],
        activeTurnIndex: prev.turns.length,
      }));

      try {
        const response = await fetch("/api/frame", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: trimmed,
            kind: turn.kind,
            originalPrompt: session.turns[0]?.prompt ?? trimmed,
          }),
        });
        if (!response.ok) throw new Error(await readError(response));

        const { frame, warnings: warned }: FrameResponse = await response.json();
        patchTurn(turn.id, {
          frame,
          progress: { phase: "ready", fraction: 1, note: "The wash is down." },
        });
        setSession((prev) => ({
          ...prev,
          spentUsd: prev.spentUsd + (frame.costUsd ?? 0),
        }));
        if (warned.length) setWarnings(warned);
      } catch (error) {
        patchTurn(turn.id, {
          progress: { phase: "failed", fraction: null, note: "The paper tore." },
          error: error instanceof Error ? error.message : "Unknown failure.",
        });
      }
    },
    [patchTurn, session.turns],
  );

  /** Animate the frame currently on the stage. This is the expensive step. */
  const animate = useCallback(
    async (tier: FilmTier, seconds: number, motion: string) => {
      const frame = session.turns[session.activeTurnIndex]?.frame;
      if (!frame || pendingFilmJob) return;

      setSession((prev) => ({
        ...prev,
        film: null,
        filmError: null,
        filmProgress: {
          phase: "composing",
          fraction: 0.05,
          note: "Reading the painting.",
        },
      }));

      try {
        const response = await fetch("/api/film", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: frame.imageUrl,
            prompt: motion,
            tier,
            seconds,
          }),
        });
        if (!response.ok) throw new Error(await readError(response));

        const accepted: FilmAccepted = await response.json();
        setSession((prev) => ({ ...prev, filmProgress: accepted.progress }));
        setPendingFilmJob(accepted.jobId);
      } catch (error) {
        setSession((prev) => ({
          ...prev,
          filmProgress: {
            phase: "failed",
            fraction: null,
            note: "The paper tore.",
          },
          filmError: error instanceof Error ? error.message : "Unknown failure.",
        }));
      }
    },
    [pendingFilmJob, session.activeTurnIndex, session.turns],
  );

  /* Poll the film until it is dry or torn. */
  useEffect(() => {
    if (!pendingFilmJob) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const response = await fetch(`/api/film/${pendingFilmJob}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(await readError(response));

        const status: FilmStatus = await response.json();
        if (cancelled) return;

        setSession((prev) => ({
          ...prev,
          film: status.film,
          filmProgress: status.progress,
          filmError: status.error,
          spentUsd:
            status.film && !prev.film
              ? prev.spentUsd + (status.film.costUsd ?? 0)
              : prev.spentUsd,
        }));

        if (status.progress.phase === "ready" || status.progress.phase === "failed") {
          setPendingFilmJob(null);
        }
      } catch (error) {
        if (cancelled) return;
        setPendingFilmJob(null);
        setSession((prev) => ({
          ...prev,
          filmProgress: {
            phase: "failed",
            fraction: null,
            note: "The paper tore.",
          },
          filmError: error instanceof Error ? error.message : "Unknown failure.",
        }));
      }
    };

    void tick();
    const timer = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pendingFilmJob]);

  const showTurn = useCallback((index: number) => {
    setSession((prev) => ({ ...prev, activeTurnIndex: index }));
  }, []);

  const reset = useCallback(() => {
    setPendingFilmJob(null);
    setWarnings([]);
    setSession(EMPTY);
  }, []);

  const activeTurn = session.turns[session.activeTurnIndex] ?? null;

  const isPainting = useMemo(
    () => session.turns.some((turn) => turn.progress.phase === "painting"),
    [session.turns],
  );

  const isAnimating =
    pendingFilmJob !== null || session.filmProgress?.phase === "composing";

  return {
    session,
    activeTurn,
    warnings,
    isPainting,
    isAnimating,
    isBusy: isPainting || isAnimating,
    hasStarted: session.turns.length > 0,
    paint,
    animate,
    showTurn,
    reset,
  };
}

/* Keeps a ref-free module boundary for the error text. */
async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error;
  } catch {
    /* fall through to the status line */
  }
  return `Request failed (${response.status}).`;
}
