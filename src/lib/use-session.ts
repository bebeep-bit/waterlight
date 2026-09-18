"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  RenderAccepted,
  RenderStatus,
  Session,
  Turn,
} from "@/lib/types";

const POLL_INTERVAL_MS = 1_200;

function newTurn(prompt: string, kind: Turn["kind"]): Turn {
  return {
    id: crypto.randomUUID(),
    kind,
    prompt,
    progress: { phase: "composing", fraction: null, note: "Reading your wish." },
    film: null,
    error: null,
  };
}

/**
 * Owns the whole conversation with the agent: the ordered turns, which film is
 * on the stage, and the polling loop for whichever render is still wet.
 */
export function useSession() {
  const [session, setSession] = useState<Session>({
    turns: [],
    activeTurnIndex: -1,
    threadId: null,
  });

  /** jobId of the render we are currently polling, if any. */
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  /** Turn that job belongs to, so status lands on the right row. */
  const pendingTurnId = useRef<string | null>(null);

  const patchTurn = useCallback((turnId: string, patch: Partial<Turn>) => {
    setSession((prev) => ({
      ...prev,
      turns: prev.turns.map((turn) =>
        turn.id === turnId ? { ...turn, ...patch } : turn,
      ),
    }));
  }, []);

  const submit = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || pendingJobId) return;

      const kind: Turn["kind"] = session.turns.length === 0 ? "seed" : "refinement";
      const turn = newTurn(trimmed, kind);

      setSession((prev) => ({
        ...prev,
        turns: [...prev.turns, turn],
        activeTurnIndex: prev.turns.length,
      }));
      pendingTurnId.current = turn.id;

      const seedPrompt = session.turns[0]?.prompt ?? trimmed;
      const parentFilmId =
        [...session.turns].reverse().find((t) => t.film)?.film?.id ?? null;

      try {
        const response = await fetch("/api/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: trimmed,
            kind,
            threadId: session.threadId,
            originalPrompt: seedPrompt,
            parentFilmId,
          }),
        });

        if (!response.ok) throw new Error(await readError(response));

        const accepted: RenderAccepted = await response.json();
        setSession((prev) => ({ ...prev, threadId: accepted.threadId }));
        patchTurn(turn.id, { progress: accepted.progress });
        setPendingJobId(accepted.jobId);
      } catch (error) {
        pendingTurnId.current = null;
        patchTurn(turn.id, {
          progress: { phase: "failed", fraction: null, note: "The paper tore." },
          error: error instanceof Error ? error.message : "Unknown failure.",
        });
      }
    },
    [patchTurn, pendingJobId, session.threadId, session.turns],
  );

  /* Poll the wet render until it is dry or torn. */
  useEffect(() => {
    if (!pendingJobId) return;
    let cancelled = false;

    const tick = async () => {
      const turnId = pendingTurnId.current;
      if (!turnId) return;

      try {
        const response = await fetch(`/api/render/${pendingJobId}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(await readError(response));

        const status: RenderStatus = await response.json();
        if (cancelled) return;

        patchTurn(turnId, {
          progress: status.progress,
          film: status.film,
          error: status.error,
        });

        if (status.progress.phase === "ready" || status.progress.phase === "failed") {
          pendingTurnId.current = null;
          setPendingJobId(null);
        }
      } catch (error) {
        if (cancelled) return;
        pendingTurnId.current = null;
        setPendingJobId(null);
        patchTurn(turnId, {
          progress: { phase: "failed", fraction: null, note: "The paper tore." },
          error: error instanceof Error ? error.message : "Unknown failure.",
        });
      }
    };

    void tick();
    const timer = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [patchTurn, pendingJobId]);

  const showTurn = useCallback((index: number) => {
    setSession((prev) => ({ ...prev, activeTurnIndex: index }));
  }, []);

  const reset = useCallback(() => {
    pendingTurnId.current = null;
    setPendingJobId(null);
    setSession({ turns: [], activeTurnIndex: -1, threadId: null });
  }, []);

  const activeTurn = session.turns[session.activeTurnIndex] ?? null;

  /** The newest finished film, which is what the download button hands over. */
  const latestFilm = useMemo(
    () => [...session.turns].reverse().find((turn) => turn.film)?.film ?? null,
    [session.turns],
  );

  return {
    session,
    activeTurn,
    latestFilm,
    isRendering: pendingJobId !== null || activeTurn?.progress.phase === "composing",
    hasStarted: session.turns.length > 0,
    submit,
    showTurn,
    reset,
  };
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error;
  } catch {
    /* fall through to the status line */
  }
  return `Request failed (${response.status}).`;
}
