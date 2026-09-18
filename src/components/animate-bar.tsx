"use client";

import { useState } from "react";
import {
  estimateFilmCost,
  FILM_TIERS,
  type FilmTier,
} from "@/lib/agent/capabilities";
import type { Film } from "@/lib/types";

interface AnimateBarProps {
  /** Null until a frame exists to animate. */
  canAnimate: boolean;
  disabled: boolean;
  film: Film | null;
  onAnimate: (tier: FilmTier, seconds: number, motion: string) => void;
}

const DURATIONS = [6, 8, 10];

/**
 * The one place in the product that spends real money, so it says what it will
 * cost and how long it will take before the user commits. Everything up to
 * here is a third of a cent a go; this is about a dollar.
 */
export function AnimateBar({
  canAnimate,
  disabled,
  film,
  onAnimate,
}: AnimateBarProps) {
  const [tier, setTier] = useState<FilmTier>("preview");
  const [seconds, setSeconds] = useState(8);
  const [motion, setMotion] = useState("");

  if (film) return <FilmFooter film={film} />;
  if (!canAnimate) return null;

  const spec = FILM_TIERS[tier];
  const cost = estimateFilmCost(tier, seconds);

  return (
    <section className="animate-rise mt-6 rounded-2xl border border-paper-shadow/70 bg-paper/60 p-5">
      <h2 className="font-serif text-lg text-ink">Bring it to life</h2>
      <p className="mt-1 text-[0.82rem] leading-relaxed text-ink-soft/85">
        The painting is the cheap part. Animating it is the one step that costs
        something, so it only happens when you ask.
      </p>

      <div className="mt-4 flex flex-wrap gap-5">
        <Choice label="Take">
          {(Object.keys(FILM_TIERS) as FilmTier[]).map((key) => (
            <Pill
              key={key}
              active={tier === key}
              disabled={disabled}
              onClick={() => setTier(key)}
            >
              {FILM_TIERS[key].label}
            </Pill>
          ))}
        </Choice>

        <Choice label="Length">
          {DURATIONS.map((value) => (
            <Pill
              key={value}
              active={seconds === value}
              disabled={disabled}
              onClick={() => setSeconds(value)}
            >
              {value}s
            </Pill>
          ))}
        </Choice>
      </div>

      <input
        value={motion}
        onChange={(event) => setMotion(event.target.value)}
        disabled={disabled}
        placeholder="How should it move? A soft wind, petals drifting…"
        aria-label="How should it move"
        className="mt-4 w-full rounded-xl border border-paper-shadow/70 bg-paper/70 px-4 py-3 text-[0.9rem] text-ink outline-none placeholder:text-ink-faint/70 focus:border-bud-soft/70 disabled:opacity-50"
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <p className="text-[0.68rem] tracking-[0.18em] text-ink-faint uppercase">
          ≈ ${cost.toFixed(2)} · about {spec.p50Seconds}s · {spec.name}
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAnimate(tier, seconds, motion)}
          className="rounded-full bg-bud px-6 py-2.5 text-[0.7rem] tracking-[0.22em] text-paper uppercase transition-all duration-500 hover:bg-bud/90 disabled:cursor-not-allowed disabled:bg-paper-shadow/60 disabled:text-ink-faint"
        >
          Animate
        </button>
      </div>
    </section>
  );
}

function FilmFooter({ film }: { film: Film }) {
  const downloadHref = film.videoUrl.startsWith("/")
    ? film.videoUrl
    : `/api/download?url=${encodeURIComponent(film.videoUrl)}`;

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
      <p className="text-[0.68rem] tracking-[0.2em] text-ink-faint uppercase">
        {film.durationSeconds}s · wordless · {film.capability}
        {film.costUsd !== null && ` · $${film.costUsd.toFixed(2)}`}
        {film.isMock && " · placeholder"}
      </p>

      <a
        href={downloadHref}
        download="waterlight.mp4"
        className="rounded-full border border-ink/25 px-6 py-2.5 text-[0.7rem] tracking-[0.22em] text-ink uppercase transition-all duration-500 hover:border-bud hover:bg-bud hover:text-paper"
      >
        Download film
      </a>
    </div>
  );
}

function Choice({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-[0.62rem] tracking-[0.24em] text-ink-faint uppercase">
        {label}
      </p>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

function Pill({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={[
        "rounded-full border px-4 py-1.5 text-[0.75rem] transition-all duration-500 disabled:opacity-50",
        active
          ? "border-bud/60 bg-bud/10 text-bud"
          : "border-paper-shadow/70 text-ink-soft hover:border-bud-soft/60",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
