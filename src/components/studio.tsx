"use client";

import { useState } from "react";
import { AnimateBar } from "@/components/animate-bar";
import { ExamplePrompts } from "@/components/example-prompts";
import { FilmStage } from "@/components/film-stage";
import { PromptComposer } from "@/components/prompt-composer";
import { RefinementPanel } from "@/components/refinement-panel";
import { useSession } from "@/lib/use-session";

/**
 * Single client root. The page has two states rather than two routes: the
 * quiet opening sheet, and the studio once a wash exists. Keeping them in one
 * component lets the transition between them stay soft.
 */
export function Studio() {
  const {
    session,
    activeTurn,
    warnings,
    isAnimating,
    isBusy,
    hasStarted,
    paint,
    animate,
    showTurn,
    reset,
  } = useSession();
  const [draft, setDraft] = useState("");

  const handleSubmit = async (value: string) => {
    setDraft("");
    await paint(value);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 py-10 sm:px-8 sm:py-14">
      <Masthead
        onReset={hasStarted ? reset : null}
        spentUsd={session.spentUsd}
      />

      {hasStarted ? (
        <div className="mt-12 grid flex-1 gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-14">
          <section className="animate-bleed">
            <FilmStage
              frame={activeTurn?.frame ?? null}
              film={session.film}
              progress={session.filmProgress ?? activeTurn?.progress ?? null}
              error={session.filmError ?? activeTurn?.error ?? null}
            />

            <AnimateBar
              canAnimate={Boolean(activeTurn?.frame)}
              disabled={isBusy}
              film={session.film}
              onAnimate={animate}
            />

            {warnings.length > 0 && <Warnings warnings={warnings} />}
          </section>

          <RefinementPanel
            session={session}
            value={draft}
            onChange={setDraft}
            onSubmit={handleSubmit}
            onShowTurn={showTurn}
            disabled={isBusy}
            animating={isAnimating}
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
              placeholder="A tiny gardener finds one bud still alive…"
              submitLabel="Paint the first wash"
            />
          </div>

          <ExamplePrompts onChoose={setDraft} disabled={isBusy} />
        </div>
      )}

      <Colophon />
    </main>
  );
}

function Masthead({
  onReset,
  spentUsd,
}: {
  onReset: (() => void) | null;
  spentUsd: number;
}) {
  return (
    <header className="flex items-center justify-between gap-6">
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 rounded-full bg-bud" aria-hidden />
        <span className="font-serif text-[1.05rem] tracking-wide text-ink">
          The Last Color
        </span>
      </div>

      <div className="flex items-center gap-6">
        {spentUsd > 0 && (
          <span className="text-[0.66rem] tracking-[0.2em] text-ink-faint uppercase">
            ${spentUsd.toFixed(3)} spent
          </span>
        )}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-[0.66rem] tracking-[0.24em] text-ink-faint uppercase transition-colors duration-500 hover:text-bud"
          >
            New sheet
          </button>
        )}
      </div>
    </header>
  );
}

/** The agent tells us when a provider will ignore something we sent. */
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
        Wordless watercolour films
      </p>
      <h1 className="mt-6 font-serif text-4xl leading-[1.15] font-light text-ink sm:text-5xl">
        A world that has forgotten colour,
        <span className="block text-bud italic">and one bud that has not.</span>
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-[0.95rem] leading-relaxed text-ink-soft">
        Write a single line. The agent paints it as a watercolour still, you
        talk it into shape, and only then does it come to life as a short,
        silent film.
      </p>
    </div>
  );
}

function Colophon() {
  return (
    <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-paper-shadow/50 pt-6">
      <p className="text-[0.64rem] tracking-[0.2em] text-ink-faint uppercase">
        Painted by Livepeer Agent
      </p>
      <p className="font-serif text-[0.9rem] text-ink-faint italic">
        no words · one accent of life
      </p>
    </footer>
  );
}
