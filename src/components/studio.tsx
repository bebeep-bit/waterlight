"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimateBar } from "@/components/animate-bar";
import { ExamplePrompts } from "@/components/example-prompts";
import { FilmStage, FullscreenFilm, FullscreenStill } from "@/components/film-stage";
import { PromptComposer } from "@/components/prompt-composer";
import { RefinementPanel } from "@/components/refinement-panel";
import { aspectOf, type AspectId } from "@/lib/aspect";
import { useSession } from "@/lib/use-session";
import type { Film, Turn } from "@/lib/types";

/**
 * Single client root. The page has two states rather than two routes: the
 * quiet opening sheet, and the studio once a wash exists. Keeping them in one
 * component lets the transition between them stay soft.
 *
 * New sheet opens a fresh tab so the current painting stays put. Deleting the
 * last prompt clears the wash but keeps the studio open for the next brief.
 */
export function Studio() {
  const {
    session,
    activeTurn,
    warnings,
    isAnimating,
    isBusy,
    paint,
    regenerate,
    animate,
    showTurn,
    showStill,
    setAspect,
  } = useSession();
  const [draft, setDraft] = useState("");
  const [reference, setReference] = useState<{
    url: string;
    preview: string;
  } | null>(null);
  const [referenceBusy, setReferenceBusy] = useState(false);
  /** Sticky once the first Paint runs — delete must not kick back to overture. */
  const [inStudio, setInStudio] = useState(false);

  const showStudio = inStudio || session.turns.length > 0;

  const attachPlate = async (
    file: File,
    setPlate: typeof setReference,
    setBusy: (busy: boolean) => void,
  ) => {
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/reference", { method: "POST", body });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Could not add the reference.");
      }
      setPlate((prev) => {
        if (prev?.preview.startsWith("blob:")) URL.revokeObjectURL(prev.preview);
        return { url: payload.url!, preview: URL.createObjectURL(file) };
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not add the reference.");
    } finally {
      setBusy(false);
    }
  };

  const clearPlate = (setPlate: typeof setReference) => {
    setPlate((prev) => {
      if (prev?.preview.startsWith("blob:")) URL.revokeObjectURL(prev.preview);
      return null;
    });
  };

  const handleSubmit = async (value: string) => {
    setInStudio(true);
    setDraft("");
    await paint(
      value,
      reference
        ? { referenceUrl: reference.url, referenceMode: "style" }
        : undefined,
    );
  };

  const handleNewSheet = () => {
    const url = `${window.location.origin}${window.location.pathname}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 py-10 sm:px-8 sm:py-14 xl:max-w-7xl">
      <Masthead onNewSheet={showStudio ? handleNewSheet : null} />

      {showStudio ? (
        <div
          className={[
            "mt-12 grid flex-1 gap-10 lg:gap-12",
            session.film || isAnimating || session.pairLayout
              ? "xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]"
              : "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-14",
          ].join(" ")}
        >
          <section className="animate-bleed min-w-0">
            <FilmStage
              frame={activeTurn?.frame ?? null}
              film={session.film}
              progress={session.filmProgress ?? activeTurn?.progress ?? null}
              error={session.filmError ?? activeTurn?.error ?? null}
              aspect={session.aspect}
              animating={isAnimating}
              pairLayout={session.pairLayout}
              onRegenerate={
                session.activeTurnIndex >= 0 && activeTurn?.frame
                  ? () => void regenerate(session.activeTurnIndex)
                  : undefined
              }
              onReanimate={() => void animate("")}
              actionDisabled={isBusy}
            />

            <AnimateBar
              key={activeTurn?.id ?? "sheet"}
              canAnimate={Boolean(activeTurn?.frame)}
              disabled={isBusy}
              film={session.film}
              onAnimate={(motion) => void animate(motion)}
            />

            {warnings.length > 0 && <Warnings warnings={warnings} />}
          </section>

          <RefinementPanel
            session={session}
            value={draft}
            onChange={setDraft}
            onSubmit={handleSubmit}
            onRegenerate={(index) => void regenerate(index)}
            onShowTurn={showTurn}
            onAspectChange={setAspect}
            disabled={isBusy}
            animating={isAnimating}
            referencePreview={reference?.preview}
            referenceBusy={referenceBusy}
            onReferenceFile={(file) => void attachPlate(file, setReference, setReferenceBusy)}
            onClearReference={() => clearPlate(setReference)}
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-14 py-10">
          <Overture />

          <div className="animate-rise mx-auto w-full max-w-3xl [animation-delay:200ms]">
            <PromptComposer
              value={draft}
              onChange={setDraft}
              onSubmit={handleSubmit}
              disabled={isBusy}
              size="hero"
              placeholder="Anything. A city at dusk, a cat in a window, a ship in the clouds…"
              submitLabel="Paint"
              aspect={session.aspect}
              onAspectChange={setAspect}
              referencePreview={reference?.preview}
              referenceBusy={referenceBusy}
              onReferenceFile={(file) => void attachPlate(file, setReference, setReferenceBusy)}
              onClearReference={() => clearPlate(setReference)}
            />
          </div>

          <ExamplePrompts onChoose={setDraft} disabled={isBusy} />
        </div>
      )}

      {showStudio && (
        <FinishedStrip
          turns={session.turns}
          activeIndex={session.activeTurnIndex}
          stageFilm={session.film}
          onShow={showTurn}
          onShowStill={showStill}
        />
      )}

      <Colophon />
    </main>
  );
}

function Masthead({ onNewSheet }: { onNewSheet: (() => void) | null }) {
  return (
    <header className="flex items-center justify-between gap-6">
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 rounded-full bg-bud" aria-hidden />
        <span className="font-serif text-[1.05rem] tracking-wide text-ink">
          Waterlight
        </span>
      </div>

      {onNewSheet && (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onNewSheet();
          }}
          className="text-[0.66rem] tracking-[0.24em] text-ink-faint uppercase transition-colors duration-500 hover:text-bud"
        >
          New sheet
        </button>
      )}
    </header>
  );
}

/** The agent tells us when a provider tells us something worth surfacing. */
function Warnings({ warnings }: { warnings: string[] }) {
  return (
    <ul className="mt-4 space-y-1">
      {warnings.map((warning) => (
        <li key={warning} className="text-[0.75rem] leading-relaxed text-clay">
          {warning}
        </li>
      ))}
    </ul>
  );
}

function Overture() {
  return (
    <div className="animate-rise mx-auto max-w-2xl text-center">
      <p className="text-[0.66rem] tracking-[0.34em] text-ink-faint uppercase">
        Any subject · watercolour · 6 seconds
      </p>
      <h1 className="mt-6 font-serif text-4xl leading-[1.15] font-light text-ink sm:text-5xl">
        Write anything.
        <span className="block text-bud italic">It will be painted.</span>
      </h1>
      <div className="mx-auto mt-6 max-w-xl text-[0.95rem] leading-relaxed text-ink-soft">
        <p>
          A prompt alone, or a prompt with a reference. The reference
          strengthens the watercolour: the hues, the brushstrokes, and the look
          of drawn art. When the still is right, it becomes a silent 6-second
          film.
        </p>
      </div>
    </div>
  );
}

function FinishedStrip({
  turns,
  activeIndex,
  stageFilm,
  onShow,
  onShowStill,
}: {
  turns: Turn[];
  activeIndex: number;
  stageFilm: Film | null;
  onShow: (index: number) => void;
  onShowStill: (index: number, src: string, aspect: AspectId) => void;
}) {
  const plates = turns.flatMap((turn, index) => {
    const items: {
      key: string;
      kind: "image" | "video";
      src: string;
      aspect: Turn["aspect"];
      poster?: string;
    }[] = [];
    for (const kept of turn.kept ?? []) {
      items.push({
        key: kept.id,
        kind: kept.kind,
        src: kept.src,
        aspect: kept.aspect,
        poster: kept.posterUrl,
      });
    }
    if (
      turn.frame?.imageUrl &&
      !turn.kept?.some((item) => item.kind === "image" && item.src === turn.frame?.imageUrl)
    ) {
      items.push({
        key: `${turn.id}-image`,
        kind: "image",
        src: turn.frame.imageUrl,
        aspect: turn.frame.aspect,
      });
    }
    const film = turn.film ?? (index === activeIndex ? stageFilm : null);
    if (film?.videoUrl) {
      items.push({
        key: `${turn.id}-video`,
        kind: "video",
        src: film.videoUrl,
        aspect: turn.frame?.aspect ?? turn.aspect,
        poster: film.posterUrl ?? turn.frame?.imageUrl,
      });
    }
    return items.map((item) => ({ ...item, turn, index }));
  });

  const [expanded, setExpanded] = useState<{
    kind: "image" | "video";
    src: string;
    widthOverHeight: number;
  } | null>(null);
  const scroller = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const node = scroller.current;
    if (!node) return;
    const left = node.scrollLeft > 4;
    const right = node.scrollLeft + node.clientWidth < node.scrollWidth - 4;
    setEdges((prev) =>
      prev.left === left && prev.right === right ? prev : { left, right },
    );
  }, []);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    measure();
    node.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure, plates.length]);

  const nudge = (direction: -1 | 1) => {
    const node = scroller.current;
    if (!node) return;
    node.scrollBy({
      left: direction * Math.max(node.clientWidth * 0.72, 180),
      behavior: "smooth",
    });
  };

  if (plates.length === 0) return null;

  return (
    <section aria-label="Finished paintings" className="relative mt-14">
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-screen -translate-x-1/2">
        {edges.left && (
          <button
            type="button"
            onClick={() => nudge(-1)}
            title="Earlier"
            aria-label="Show earlier paintings"
            className="pointer-events-auto absolute top-1/2 left-3 -translate-y-1/2 rounded-full border border-paper-shadow/80 bg-paper/95 p-2.5 text-ink shadow-sm transition-colors hover:text-ink"
          >
            <ChevronIcon direction="left" />
          </button>
        )}
        {edges.right && (
          <button
            type="button"
            onClick={() => nudge(1)}
            title="Later"
            aria-label="Show later paintings"
            className="pointer-events-auto absolute top-1/2 right-3 -translate-y-1/2 rounded-full border border-paper-shadow/80 bg-paper/95 p-2.5 text-ink shadow-sm transition-colors hover:text-ink"
          >
            <ChevronIcon direction="right" />
          </button>
        )}
      </div>
      <ul
        ref={scroller}
        className="flex items-end gap-4 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {plates.map(({ key, kind, src, aspect, poster, turn, index }) => {
          const active =
            kind === "image" &&
            index === activeIndex &&
            src === turn.frame?.imageUrl;
          const ratio = aspectOf(aspect);
          return (
            <li key={key} className="flex shrink-0 flex-col gap-1.5">
              <span className="px-0.5 text-[0.58rem] tracking-[0.16em] text-ink-faint">
                {kind === "image" ? "Image" : "Video"}
              </span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (kind === "image") onShowStill(index, src, ratio.id);
                    else onShow(index);
                  }}
                  aria-current={active ? "true" : undefined}
                  aria-label={turn.prompt}
                  title={turn.prompt}
                  className={[
                    "block overflow-hidden rounded-xl border bg-paper transition-all duration-300",
                    active
                      ? "border-bud shadow-[0_10px_24px_-16px_rgba(194,85,47,0.8)]"
                      : "border-paper-shadow/80 hover:-translate-y-0.5 hover:border-bud-soft/70",
                  ].join(" ")}
                  style={{
                    height: "5.5rem",
                    width: `calc(5.5rem * ${ratio.widthOverHeight})`,
                  }}
                >
                  {kind === "video" ? (
                    <video
                      src={src}
                      poster={poster}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
                <a
                  href={mediaDownloadHref(
                    src,
                    kind === "video" ? "waterlight.mp4" : "waterlight.png",
                  )}
                  download={kind === "video" ? "waterlight.mp4" : "waterlight.png"}
                  title={`Download ${kind}`}
                  aria-label={`Download ${kind}`}
                  className="absolute top-1.5 right-1.5 rounded-full border border-paper-shadow/80 bg-paper/90 p-1.5 text-ink shadow-sm transition-colors hover:text-ink"
                >
                  <DownloadIcon />
                </a>
                <button
                  type="button"
                  onClick={() =>
                    setExpanded({
                      kind,
                      src,
                      widthOverHeight: ratio.widthOverHeight,
                    })
                  }
                  title="Full screen"
                  aria-label={`View ${kind} full screen`}
                  className="absolute right-1.5 bottom-1.5 rounded-full border border-paper-shadow/80 bg-paper/90 p-1.5 text-ink shadow-sm transition-colors hover:text-ink"
                >
                  <ExpandIcon />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {expanded?.kind === "image" && (
        <FullscreenStill
          src={expanded.src}
          onClose={() => setExpanded(null)}
        />
      )}
      {expanded?.kind === "video" && (
        <FullscreenFilm
          src={expanded.src}
          aspect={{ widthOverHeight: expanded.widthOverHeight }}
          onClose={() => setExpanded(null)}
        />
      )}
    </section>
  );
}

function mediaDownloadHref(url: string, filename: string): string {
  if (url.startsWith("/")) return url;
  const params = new URLSearchParams({ url, filename });
  return `/api/download?${params.toString()}`;
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {direction === "left" ? <path d="m15 6-6 6 6 6" /> : <path d="m9 6 6 6-6 6" />}
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="13"
      height="13"
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
      width="13"
      height="13"
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

function Colophon() {
  return (
    <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-paper-shadow/50 pt-6">
      <p className="text-[0.64rem] tracking-[0.2em] text-ink-faint uppercase">
        Painted by Livepeer Agent
      </p>
      <p className="font-serif text-[0.9rem] text-ink-faint italic">
        ink and water on paper · 6 seconds · no words
      </p>
    </footer>
  );
}
