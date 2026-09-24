"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_ASPECT, type AspectId } from "@/lib/aspect";
import type {
  Film,
  FilmAccepted,
  FilmStatus,
  Frame,
  FrameResponse,
  KeptMedia,
  ReferenceMode,
  Session,
  Turn,
} from "@/lib/types";

/** The network documents polling get_create_media at 5-10s as safe and free. */
const POLL_INTERVAL_MS = 5_000;

export interface PaintOptions {
  referenceUrl?: string;
  subjectUrl?: string;
  referenceMode?: ReferenceMode;
  /** Object plate's own format. Wins over the picker. */
  aspect?: AspectId;
}

function blankSession(aspect: AspectId = DEFAULT_ASPECT): Session {
  return {
    turns: [],
    activeTurnIndex: -1,
    aspect,
    film: null,
    filmProgress: null,
    filmError: null,
    pairLayout: false,
    spentUsd: 0,
  };
}

const EMPTY: Session = blankSession();

/**
 * Owns the conversation. Two loops live here, and they are deliberately
 * different shapes: frames resolve inside a single request, so refining is a
 * plain await. Films take a minute, so they are polled.
 */
export function useSession() {
  const [session, setSession] = useState<Session>(EMPTY);
  const [pendingFilmJob, setPendingFilmJob] = useState<string | null>(null);
  /** Which wash the in-flight film belongs to, so it can drop into history. */
  const filmTurnId = useRef<string | null>(null);
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

  const setAspect = useCallback((aspect: AspectId) => {
    setSession((prev) => ({ ...prev, aspect }));
  }, []);

  /** Paint or repaint the still. Cheap enough to do freely. */
  const paint = useCallback(
    async (prompt: string, options?: PaintOptions) => {
      const trimmed = prompt.trim();
      const subjectUrl = options?.subjectUrl;
      if (!trimmed && !subjectUrl) return;
      const shown = trimmed || "Objects in the frame";

      const isSeed = session.turns.length === 0;
      const aspect = options?.aspect ?? session.aspect;
      const turn: Turn = {
        id: crypto.randomUUID(),
        kind: isSeed ? "seed" : "refinement",
        prompt: shown,
        aspect,
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
        /* A new wash replaces any film on the stage. */
        film: null,
        filmProgress: null,
        filmError: null,
      }));
      setPendingFilmJob(null);

      try {
        const response = await fetch("/api/frame", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: trimmed,
            kind: turn.kind,
            originalPrompt: session.turns[0]?.prompt ?? shown,
            aspect,
            referenceUrl: options?.referenceUrl,
            subjectUrl,
            referenceMode: options?.referenceMode,
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
    [patchTurn, session.aspect, session.turns],
  );

  /**
   * Redo one existing wash in place. The previous still and its film stay in
   * the history strip; the stage shows only the new wash.
   */
  const regenerate = useCallback(
    async (turnIndex: number, options?: PaintOptions) => {
      const turn = session.turns[turnIndex];
      if (!turn) return;
      if (session.turns.some((t) => t.progress.phase === "painting")) return;

      const aspect = session.aspect;
      const originalPrompt = session.turns[0]?.prompt ?? turn.prompt;
      const turnId = turn.id;

      /* Drop an in-flight film job; keep any finished film on the left lane. */
      setPendingFilmJob(null);
      setSession((prev) => ({
        ...prev,
        activeTurnIndex: turnIndex,
        film: null,
        filmProgress: null,
        filmError: null,
        pairLayout: false,
        turns: prev.turns.map((t, i) => {
          if (i !== turnIndex) return t;
          const kept = [...(t.kept ?? [])];
          if (t.frame?.imageUrl) {
            kept.push({
              id: t.frame.id,
              kind: "image",
              src: t.frame.imageUrl,
              aspect: t.frame.aspect,
            });
          }
          const film = t.film ?? (i === prev.activeTurnIndex ? prev.film : null);
          if (film?.videoUrl) {
            kept.push({
              id: film.id,
              kind: "video",
              src: film.videoUrl,
              aspect: t.frame?.aspect ?? t.aspect ?? prev.aspect,
              posterUrl: film.posterUrl ?? t.frame?.imageUrl,
            });
          }
          return {
            ...t,
            kept,
            film: null,
            aspect,
            progress: {
              phase: "painting",
              fraction: 0.4,
              note: "Laying the wash again.",
            },
            error: null,
          };
        }),
      }));

      try {
        const response = await fetch("/api/frame", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: turn.prompt,
            kind: turn.kind,
            originalPrompt,
            aspect,
            referenceUrl: options?.referenceUrl,
            referenceMode: options?.referenceMode,
          }),
        });
        if (!response.ok) throw new Error(await readError(response));

        const { frame, warnings: warned }: FrameResponse = await response.json();
        patchTurn(turnId, {
          frame,
          progress: { phase: "ready", fraction: 1, note: "The wash is down." },
          error: null,
        });
        setSession((prev) => ({
          ...prev,
          spentUsd: prev.spentUsd + (frame.costUsd ?? 0),
        }));
        if (warned.length) setWarnings(warned);
      } catch (error) {
        patchTurn(turnId, {
          progress: { phase: "failed", fraction: null, note: "The paper tore." },
          error: error instanceof Error ? error.message : "Unknown failure.",
        });
      }
    },
    [patchTurn, session.aspect, session.turns],
  );

  /** Animate the frame currently on the stage. This is the expensive step. */
  const animate = useCallback(
    async (motion: string) => {
      const turn = session.turns[session.activeTurnIndex];
      const frame = turn?.frame;
      if (!frame || !turn || pendingFilmJob) return;
      filmTurnId.current = turn.id;

      setSession((prev) => ({
        ...prev,
        film: null,
        filmError: null,
        pairLayout: true,
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
            quality: "hd",
            aspect: frame.aspect,
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

        const ownerId = filmTurnId.current;
        setSession((prev) => ({
          ...prev,
          film: status.film,
          filmProgress: status.progress,
          filmError: status.error,
          turns:
            status.film && ownerId
              ? prev.turns.map((turn) =>
                  turn.id === ownerId ? { ...turn, film: status.film } : turn,
                )
              : prev.turns,
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

  /**
   * Put one history still on the large stage so it can be animated.
   * The previous still and its film stay in the strip.
   */
  const showStill = useCallback((turnIndex: number, src: string, aspect: AspectId) => {
    if (pendingFilmJob) return;
    setSession((prev) => {
      const turn = prev.turns[turnIndex];
      if (!turn || turn.progress.phase === "painting") return prev;
      if (prev.turns.some((item) => item.progress.phase === "painting")) return prev;

      const kept: KeptMedia[] = [...(turn.kept ?? [])];
      const remember = (item: KeptMedia) => {
        if (!kept.some((existing) => existing.kind === item.kind && existing.src === item.src)) {
          kept.push(item);
        }
      };

      if (turn.frame?.imageUrl && turn.frame.imageUrl !== src) {
        remember({
          id: turn.frame.id,
          kind: "image",
          src: turn.frame.imageUrl,
          aspect: turn.frame.aspect,
        });
      }

      const film: Film | null =
        turn.film ?? (turnIndex === prev.activeTurnIndex ? prev.film : null);
      if (film?.videoUrl) {
        remember({
          id: film.id,
          kind: "video",
          src: film.videoUrl,
          aspect: turn.frame?.aspect ?? aspect,
          posterUrl: film.posterUrl ?? turn.frame?.imageUrl,
        });
      }

      const picked = kept.find((item) => item.kind === "image" && item.src === src);
      const nextKept = kept.filter((item) => !(item.kind === "image" && item.src === src));
      const frame: Frame =
        turn.frame?.imageUrl === src
          ? turn.frame
          : {
              id: picked?.id ?? crypto.randomUUID(),
              imageUrl: src,
              capability: turn.frame?.capability ?? "flux-dev",
              costUsd: null,
              aspect: picked?.aspect ?? aspect,
              createdAt: new Date().toISOString(),
              isMock: false,
            };

      return {
        ...prev,
        activeTurnIndex: turnIndex,
        film: null,
        filmProgress: null,
        filmError: null,
        pairLayout: false,
        turns: prev.turns.map((item, index) =>
          index === turnIndex
            ? {
                ...item,
                frame,
                kept: nextKept,
                film: null,
                aspect: frame.aspect,
                progress: { phase: "ready", fraction: 1, note: "The wash is down." },
                error: null,
              }
            : item,
        ),
      };
    });
  }, [pendingFilmJob]);

  /** Drop one wash from the conversation. Studio stays open for the next brief. */
  const removeTurn = useCallback((index: number) => {
    setPendingFilmJob(null);
    setSession((prev) => {
      if (index < 0 || index >= prev.turns.length) return prev;
      const turns = prev.turns.filter((_, i) => i !== index);
      if (turns.length === 0) {
        return blankSession(prev.aspect);
      }
      let activeTurnIndex = prev.activeTurnIndex;
      if (index < activeTurnIndex) activeTurnIndex -= 1;
      else if (index === activeTurnIndex) {
        activeTurnIndex = Math.min(index, turns.length - 1);
      }
      const droppedActive = index === prev.activeTurnIndex;
      return {
        ...prev,
        turns,
        activeTurnIndex,
        film: droppedActive ? null : prev.film,
        filmProgress: droppedActive ? null : prev.filmProgress,
        filmError: droppedActive ? null : prev.filmError,
        pairLayout: droppedActive ? false : prev.pairLayout,
      };
    });
  }, []);

  const reset = useCallback(() => {
    setPendingFilmJob(null);
    setWarnings([]);
    setSession((prev) => blankSession(prev.aspect));
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
    regenerate,
    removeTurn,
    animate,
    showTurn,
    showStill,
    setAspect,
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
