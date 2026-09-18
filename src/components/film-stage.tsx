"use client";

import type { Film, Frame, Progress } from "@/lib/types";

interface FilmStageProps {
  frame: Frame | null;
  film: Film | null;
  /** Progress of whichever artefact is currently being made. */
  progress: Progress | null;
  error: string | null;
}

/**
 * Holds a 16:9 area at all times so the layout never jumps between the empty,
 * painting and finished states. The film wins the stage when it exists,
 * because it is what the user came for.
 */
export function FilmStage({ frame, film, progress, error }: FilmStageProps) {
  const isWorking =
    progress !== null &&
    progress.phase !== "ready" &&
    progress.phase !== "failed" &&
    progress.phase !== "idle";

  return (
    <div className="relative">
      <div className="edge-wash paper-grain relative aspect-video overflow-hidden rounded-[1.75rem] border border-twilight-deep/30 bg-gradient-to-br from-twilight via-twilight-deep to-twilight shadow-[0_40px_90px_-60px_rgba(30,38,71,0.85)]">
        {film ? (
          <video
            key={film.id}
            src={film.videoUrl}
            poster={film.posterUrl ?? undefined}
            controls
            autoPlay
            loop
            muted
            playsInline
            className="animate-bleed h-full w-full object-cover"
          />
        ) : frame ? (
          /* The still, shown at full bleed. Dimmed while a film renders from
             it, so the stage reads as busy without losing the image.
             Plain <img>: the agent's CDN hosts these behind signed one-off
             paths, so there is nothing for next/image to cache usefully. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={frame.id}
            src={frame.imageUrl}
            alt=""
            className={[
              "animate-bleed h-full w-full object-cover transition-opacity duration-1000",
              isWorking ? "opacity-40" : "opacity-100",
            ].join(" ")}
          />
        ) : (
          <EmptyFrame isWorking={isWorking} error={error} />
        )}

        {frame && !film && isWorking && (
          <div
            className="animate-breathe absolute inset-0 m-auto h-32 w-32 rounded-full bg-bud/60 blur-[42px]"
            aria-hidden
          />
        )}
      </div>

      {progress && !film && <ProgressWash progress={progress} error={error} />}
    </div>
  );
}

function EmptyFrame({
  isWorking,
  error,
}: {
  isWorking: boolean;
  error: string | null;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      {/* The last living colour, before there is anything to hold it. */}
      <div
        className={[
          "h-32 w-32 rounded-full blur-[42px]",
          isWorking ? "animate-breathe bg-bud/70" : "bg-slate/25",
        ].join(" ")}
        aria-hidden
      />
      <p className="absolute font-serif text-lg text-paper/70 italic">
        {error
          ? "Nothing took to the paper."
          : isWorking
            ? "The paper is still wet."
            : "An empty sheet, waiting."}
      </p>
    </div>
  );
}

function ProgressWash({
  progress,
  error,
}: {
  progress: Progress;
  error: string | null;
}) {
  const fraction = progress.fraction ?? 0;
  const failed = progress.phase === "failed";

  return (
    <div className="mt-5" role="status" aria-live="polite">
      <div className="flex items-baseline justify-between gap-4">
        <p
          className={[
            "font-serif text-[1.05rem] italic",
            failed ? "text-bud" : "text-ink-soft",
          ].join(" ")}
        >
          {error ?? progress.note}
        </p>
        <p className="shrink-0 text-[0.68rem] tracking-[0.24em] text-ink-faint uppercase">
          {failed ? "torn" : progress.phase}
        </p>
      </div>

      {/* A wash that seeps across the page rather than a hard progress bar. */}
      <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-paper-shadow/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-twilight/50 via-slate/60 to-bud transition-[width] duration-[1200ms] ease-out"
          style={{ width: `${Math.max(fraction * 100, failed ? 100 : 4)}%` }}
        />
      </div>
    </div>
  );
}
