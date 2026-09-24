"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Film, Frame, Progress } from "@/lib/types";
import { aspectOf, DEFAULT_ASPECT, type AspectId } from "@/lib/aspect";

interface FilmStageProps {
  frame: Frame | null;
  film: Film | null;
  /** Progress of whichever artefact is currently being made. */
  progress: Progress | null;
  error: string | null;
  /** Fallback aspect while waiting for the first frame. */
  aspect?: AspectId;
  /** True while Animate is queued / rendering (no film URL yet). */
  animating?: boolean;
  /** Keep film | still once Animate has been used this session. */
  pairLayout?: boolean;
  /** Redo the still on this stage (no film yet). */
  onRegenerate?: () => void;
  /** Replay Animate on the same still (when a film is showing). */
  onReanimate?: () => void;
  actionDisabled?: boolean;
}

const FILM_SHELL =
  "relative w-full overflow-hidden rounded-[1.75rem] border border-paper-shadow/80 bg-paper";
const STILL_SHELL =
  "edge-wash paper-grain relative w-full overflow-hidden rounded-[1.75rem] border border-twilight-deep/30 bg-gradient-to-br from-twilight via-twilight-deep to-twilight shadow-[0_40px_90px_-60px_rgba(30,38,71,0.85)]";

/**
 * Still alone until Animate starts. Then: film (or its loader) on the left,
 * the generated painting on the right.
 */
export function FilmStage({
  frame,
  film,
  progress,
  error,
  aspect,
  animating = false,
  pairLayout = false,
  onRegenerate,
  onReanimate,
  actionDisabled,
}: FilmStageProps) {
  const isPainting =
    progress !== null &&
    progress.phase === "painting";
  const isFilmWorking =
    animating ||
    (progress !== null &&
      (progress.phase === "composing" ||
        progress.phase === "queued" ||
        progress.phase === "animating"));
  const filmFailed =
    !film &&
    progress?.phase === "failed" &&
    Boolean(error) &&
    !isPainting;

  const [expanded, setExpanded] = useState(false);
  const [expandedFilm, setExpandedFilm] = useState(false);
  const canExpand = Boolean(frame) && !isPainting;

  const stageAspect = aspectOf(frame?.aspect ?? aspect ?? DEFAULT_ASPECT);
  /* While the wash is laying, the plate can fill the column. Once it is
     down, size it from its ratio against the page — not half the screen. */
  const plateStyle = frame && !isPainting
    ? pagePlateStyle(stageAspect)
    : stageAspect.tall
      ? {
          maxHeight: "min(70dvh, 36rem)",
          width: `min(100%, calc(min(70dvh, 36rem) * ${stageAspect.widthOverHeight}))`,
        }
      : undefined;

  const showPair =
    Boolean(frame) &&
    (pairLayout || Boolean(film) || isFilmWorking || filmFailed);

  if (showPair && frame) {
    return (
      <div className="relative w-full">
        <div className="grid w-full gap-4 sm:grid-cols-2 sm:items-start sm:gap-5">
          <StagePane
            shell={film ? FILM_SHELL : STILL_SHELL}
            aspectClass={stageAspect.stageClass}
            tallStyle={plateStyle}
            action={
              film && onReanimate
                ? {
                    run: onReanimate,
                    title: "Animate again",
                    label: "Animate this painting again",
                    disabled: actionDisabled,
                  }
                : null
            }
            download={
              film
                ? {
                    href: mediaDownloadHref(film.videoUrl, "waterlight.mp4"),
                    filename: "waterlight.mp4",
                    label: "Video",
                  }
                : null
            }
            onExpand={film ? () => setExpandedFilm(true) : null}
          >
            {film ? (
              <StageFilm film={film} />
            ) : (
              <FilmLoading
                isWorking={isFilmWorking}
                error={filmFailed ? error : null}
                posterUrl={frame.imageUrl}
              />
            )}
          </StagePane>

          <StagePane
            shell={STILL_SHELL}
            aspectClass={stageAspect.stageClass}
            tallStyle={plateStyle}
            action={
              onRegenerate
                ? {
                    run: onRegenerate,
                    title: "Generate again",
                    label: "Generate this painting again",
                    disabled: actionDisabled,
                  }
                : null
            }
            download={{
              href: mediaDownloadHref(frame.imageUrl, "waterlight.png"),
              filename: "waterlight.png",
              label: "Image",
            }}
            onExpand={canExpand ? () => setExpanded(true) : null}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={frame.id}
              src={frame.imageUrl}
              alt=""
              className={[
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
                isPainting ? "opacity-40" : "opacity-100",
              ].join(" ")}
            />
            {isPainting && (
              <div
                className="animate-breathe absolute inset-0 m-auto h-28 w-28 rounded-full bg-bud/55 blur-[36px]"
                aria-hidden
              />
            )}
          </StagePane>
        </div>

        {(isFilmWorking || filmFailed || isPainting) && progress && (
          <ProgressWash
            progress={progress}
            error={isPainting ? error : isFilmWorking || filmFailed ? error : null}
          />
        )}
        {expanded && frame && (
          <FullscreenStill src={frame.imageUrl} onClose={() => setExpanded(false)} />
        )}
        {expandedFilm && film && (
          <FullscreenFilm
            src={film.videoUrl}
            aspect={stageAspect}
            onClose={() => setExpandedFilm(false)}
          />
        )}
      </div>
    );
  }

  const stageAction =
    onRegenerate && frame
      ? {
          run: onRegenerate,
          title: "Generate again",
          label: "Generate this painting again",
          disabled: actionDisabled,
        }
      : null;

  return (
    <div className="relative w-full">
      <div className="flex w-full justify-center">
        <StagePane
          shell={STILL_SHELL}
          aspectClass={stageAspect.stageClass}
          tallStyle={plateStyle}
          action={stageAction}
          download={
            frame
              ? {
                  href: mediaDownloadHref(frame.imageUrl, "waterlight.png"),
                  filename: "waterlight.png",
                  label: "Image",
                }
              : null
          }
          onExpand={canExpand ? () => setExpanded(true) : null}
        >
          {frame ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={frame.id}
              src={frame.imageUrl}
              alt=""
              className={[
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-1000",
                isPainting ? "opacity-40" : "opacity-100",
              ].join(" ")}
            />
          ) : (
            <EmptyFrame isWorking={isPainting} error={error} />
          )}

          {frame && isPainting && (
            <div
              className="animate-breathe absolute inset-0 m-auto h-32 w-32 rounded-full bg-bud/60 blur-[42px]"
              aria-hidden
            />
          )}
        </StagePane>
      </div>

      {progress && !film && <ProgressWash progress={progress} error={error} />}
      {expanded && frame && (
        <FullscreenStill src={frame.imageUrl} onClose={() => setExpanded(false)} />
      )}
    </div>
  );
}

/** Left lane while i2v runs: soft poster + wash bloom. */
function FilmLoading({
  isWorking,
  error,
  posterUrl,
}: {
  isWorking: boolean;
  error: string | null;
  posterUrl: string;
}) {
  return (
    <div className="absolute inset-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={posterUrl}
        alt=""
        className={[
          "absolute inset-0 h-full w-full object-cover",
          isWorking ? "animate-poster-pulse" : "opacity-50",
        ].join(" ")}
      />
      <p className="absolute inset-x-4 bottom-6 text-center font-serif text-[0.95rem] text-paper/80 italic">
        {error
          ? "The film tore."
          : isWorking
            ? "Teaching the strokes to move…"
            : "Waiting for the film."}
      </p>
    </div>
  );
}

/** Finished plate: longest side stays a share of the page, ratio sets the other. */
function pagePlateStyle(aspect: ReturnType<typeof aspectOf>): {
  maxHeight?: string;
  width: string;
} {
  if (aspect.tall || aspect.widthOverHeight <= 1) {
    const maxHeight = "min(46dvh, 26rem)";
    return {
      maxHeight,
      width: `min(100%, calc(${maxHeight} * ${aspect.widthOverHeight}))`,
    };
  }
  return {
    width: "min(100%, 32rem)",
  };
}

function mediaDownloadHref(url: string, filename: string): string {
  if (url.startsWith("/")) return url;
  const params = new URLSearchParams({ url, filename });
  return `/api/download?${params.toString()}`;
}

function StagePane({
  shell,
  aspectClass,
  tallStyle,
  action,
  download,
  onExpand,
  children,
}: {
  shell: string;
  aspectClass: string;
  tallStyle?: { maxHeight?: string; width: string };
  action: {
    run: () => void;
    title: string;
    label: string;
    disabled?: boolean;
  } | null;
  download?: {
    href: string;
    filename: string;
    label: string;
  } | null;
  onExpand?: (() => void) | null;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full justify-center">
      <div className={[shell, aspectClass].join(" ")} style={tallStyle}>
        {children}
        {action && (
          <button
            type="button"
            disabled={action.disabled}
            onClick={action.run}
            title={action.title}
            aria-label={action.label}
            className="absolute top-3 right-3 z-10 rounded-full border border-paper-shadow/80 bg-paper/85 p-2.5 text-ink-soft shadow-sm backdrop-blur-sm transition-colors duration-300 hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshIcon />
          </button>
        )}
        {download && (
          <a
            href={download.href}
            download={download.filename}
            title={`Download ${download.label.toLowerCase()}`}
            aria-label={`Download ${download.label.toLowerCase()}`}
            className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-paper-shadow/80 bg-paper/90 px-3 py-2 text-[0.65rem] tracking-[0.16em] text-ink-soft uppercase shadow-sm backdrop-blur-sm transition-colors duration-300 hover:bg-paper hover:text-ink"
          >
            <DownloadIcon />
            {download.label}
          </a>
        )}
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            title="Full screen"
            aria-label="View the painting full screen"
            className="absolute right-3 bottom-3 z-10 rounded-full border border-paper-shadow/80 bg-paper/85 p-2.5 text-ink-soft shadow-sm backdrop-blur-sm transition-colors duration-300 hover:bg-paper hover:text-ink"
          >
            <ExpandIcon />
          </button>
        )}
      </div>
    </div>
  );
}

export function FullscreenFilm({
  src,
  aspect,
  onClose,
}: {
  src: string;
  aspect: { widthOverHeight: number };
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Film full screen"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        title="Close"
        aria-label="Close full screen"
        className="absolute top-4 right-4 z-10 rounded-full border border-paper-shadow/80 bg-paper/90 p-2.5 text-ink-soft shadow-sm"
      >
        <CloseIcon />
      </button>
      <div
        className="overflow-hidden rounded-2xl"
        style={{
          width: `min(92vw, calc(88vh * ${aspect.widthOverHeight}))`,
          aspectRatio: String(aspect.widthOverHeight),
          maxHeight: "88vh",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <video
          src={src}
          controls
          controlsList="nofullscreen"
          autoPlay
          muted
          playsInline
          className="h-full w-full object-contain"
        />
      </div>
    </div>
  );
}

export function FullscreenStill({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-transparent"
      role="dialog"
      aria-modal="true"
      aria-label="Painting full screen"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        title="Close"
        aria-label="Close full screen"
        className="sticky top-4 z-10 float-right mt-4 mr-4 rounded-full border border-paper-shadow/80 bg-paper/90 p-2.5 text-ink-soft shadow-sm transition-colors hover:text-ink"
      >
        <CloseIcon />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onClick={(event) => event.stopPropagation()}
        className="mx-auto my-8 block h-auto w-[min(96vw,72rem)] max-w-full rounded-2xl shadow-[0_40px_90px_-40px_rgba(0,0,0,0.6)]"
      />
    </div>
  );
}

/**
 * i2v clips often underexpose the whole take and dump the last half-second
 * to black. Native `loop` flashes that seam. We:
 *   - loop inside a trimmed window
 *   - cover the seek with the still so the seam is invisible
 */
function StageFilm({ film }: { film: Film }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [covering, setCovering] = useState(false);
  const HEAD_S = 0.2;
  const TAIL_S = 0.9;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    let coverTimer: ReturnType<typeof setTimeout> | null = null;

    const restart = () => {
      const duration = el.duration;
      if (!Number.isFinite(duration) || duration < 1.5) {
        el.currentTime = 0;
        return;
      }
      setCovering(true);
      el.currentTime = HEAD_S;
    };

    const onSeeked = () => {
      if (coverTimer) clearTimeout(coverTimer);
      /* One frame after decode so the bright frame is painted before uncover. */
      coverTimer = setTimeout(() => setCovering(false), 48);
      void el.play().catch(() => {});
    };

    const onTimeUpdate = () => {
      const duration = el.duration;
      if (!Number.isFinite(duration) || duration < 1.5) return;
      if (el.currentTime >= duration - TAIL_S) restart();
    };

    const onLoaded = () => {
      if (Number.isFinite(el.duration) && el.duration >= 1.5) {
        setCovering(true);
        el.currentTime = HEAD_S;
      }
    };

    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", restart);
    el.addEventListener("seeked", onSeeked);
    el.addEventListener("loadedmetadata", onLoaded);
    return () => {
      if (coverTimer) clearTimeout(coverTimer);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", restart);
      el.removeEventListener("seeked", onSeeked);
      el.removeEventListener("loadedmetadata", onLoaded);
    };
  }, [film.id]);

  return (
    <div className="absolute inset-0">
      {film.posterUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={film.posterUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <video
        ref={videoRef}
        key={film.id}
        src={film.videoUrl}
        controls
        controlsList="nofullscreen"
        autoPlay
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Covers the i2v black/dark seam while the playhead jumps. */}
      {film.posterUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={film.posterUrl}
          alt=""
          aria-hidden
          className={[
            "pointer-events-none absolute inset-0 z-10 h-full w-full object-cover transition-opacity duration-150",
            covering ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />
      )}
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

function DownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3 14 10" />
      <path d="m3 21 7-7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-2.6-6.3" />
      <path d="M21 3v6h-6" />
    </svg>
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
