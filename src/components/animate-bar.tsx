"use client";

import { useEffect, useState } from "react";
import { FILM_HD } from "@/lib/agent/capabilities";
import type { Film } from "@/lib/types";

interface AnimateBarProps {
  canAnimate: boolean;
  disabled: boolean;
  film: Film | null;
  onAnimate: (motion: string) => void;
}

/**
 * Animate commits to a silent loop of the approved still. Always HD under
 * the hood — the UI does not expose quality tiers.
 */
export function AnimateBar({
  canAnimate,
  disabled,
  film,
  onAnimate,
}: AnimateBarProps) {
  const [motion, setMotion] = useState("");

  useEffect(() => {
    if (film) setMotion("");
  }, [film]);

  if (!canAnimate && !film) return null;

  return (
    <section className="animate-rise mt-6 rounded-2xl border border-paper-shadow/70 bg-paper/60 p-5">
      {film && <FilmFooter film={film} />}
      <h2 className="font-serif text-lg text-ink">Bring it to life</h2>
      <p className="mt-1 text-[0.82rem] leading-relaxed text-ink-soft/85">
        A {FILM_HD.durationSeconds}-second silent loop of this exact painting —
        nothing new is drawn. Empty field: only what is already in the frame
        may stir slightly.
      </p>

      <input
        value={motion}
        onChange={(event) => setMotion(event.target.value)}
        disabled={disabled}
        placeholder="Optional — empty, no new objects"
        aria-label="How should it move (optional)"
        className="mt-4 w-full rounded-xl border border-paper-shadow/70 bg-paper/70 px-4 py-3 text-[0.9rem] text-ink outline-none placeholder:text-ink-faint/70 focus:border-bud-soft/70 disabled:opacity-50"
      />

      <div className="mt-4 flex flex-wrap items-center justify-end gap-4">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAnimate(motion.trim())}
          className="rounded-full bg-bud px-6 py-2.5 text-[0.7rem] tracking-[0.22em] text-paper uppercase transition-all duration-500 hover:bg-bud/90 disabled:cursor-not-allowed disabled:bg-paper-shadow/60 disabled:text-ink-faint"
        >
          Animate
        </button>
      </div>
    </section>
  );
}

function FilmFooter({ film }: { film: Film }) {
  return (
    <div className="mb-4">
      <p className="text-[0.68rem] tracking-[0.2em] text-ink-faint uppercase">
        {film.durationSeconds}s · wordless
        {film.isMock && " · placeholder"}
      </p>
    </div>
  );
}
