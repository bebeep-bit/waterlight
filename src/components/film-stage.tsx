"use client";

import type { Film, RenderProgress } from "@/lib/types";

interface FilmStageProps {
  film: Film | null;
  progress: RenderProgress | null;
  error: string | null;
}

/**
 * The frame the film lives in. Holds a 16:9 area at all times so the layout
 * never jumps between the empty, rendering and finished states.
 */
export function FilmStage({ film, progress, error }: FilmStageProps) {
  const isRendering =
    progress !== null &&
    progress.phase !== "ready" &&
    progress.phase !== "failed" &&
    progress.phase !== "idle";

  return (
    <div className="relative">
      <div className="edge-wash relative aspect-video overflow-hidden rounded-[1.75rem] border border-paper-shadow/70 bg-paper-deep/60 shadow-[0_40px_90px_-60px_rgba(43,39,35,0.75)]">
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
        ) : (
          <EmptyFrame isRendering={isRendering} error={error} />
        )}
      </div>

      {progress && !film && (
        <ProgressWash progress={progress} error={error} />
      )}

      {film && <FilmCaption film={film} />}
    </div>
  );
}

function EmptyFrame({
  isRendering,
  error,
}: {
  isRendering: boolean;
  error: string | null;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      {/* A pale bud that breathes while we wait, and stills when we are idle. */}
      <div
        className={[
          "h-28 w-28 rounded-full blur-2xl",
          isRendering ? "animate-breathe bg-bud/40" : "bg-ink-faint/20",
        ].join(" ")}
        aria-hidden
      />
      <p className="absolute font-serif text-lg text-ink-faint italic">
        {error
          ? "Nothing took to the paper."
          : isRendering
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
  progress: RenderProgress;
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
          className="h-full rounded-full bg-gradient-to-r from-dusk/60 via-sap/60 to-bud transition-[width] duration-[1200ms] ease-out"
          style={{ width: `${Math.max(fraction * 100, failed ? 100 : 4)}%` }}
        />
      </div>
    </div>
  );
}

function FilmCaption({ film }: { film: Film }) {
  /* Same-origin files download directly; the agent's CDN needs the proxy. */
  const downloadHref = film.videoUrl.startsWith("/")
    ? film.videoUrl
    : `/api/download?url=${encodeURIComponent(film.videoUrl)}`;

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
      <p className="text-[0.68rem] tracking-[0.2em] text-ink-faint uppercase">
        {film.durationSeconds}s · wordless · {film.capability}
        {film.isMock && " · placeholder render"}
      </p>

      <a
        href={downloadHref}
        download="the-last-color.mp4"
        className="rounded-full border border-ink/25 px-6 py-2.5 text-[0.7rem] tracking-[0.22em] text-ink uppercase transition-all duration-500 hover:border-bud hover:bg-bud hover:text-paper"
      >
        Download film
      </a>
    </div>
  );
}
