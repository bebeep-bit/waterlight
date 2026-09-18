"use client";

import { PromptComposer } from "@/components/prompt-composer";
import type { Session } from "@/lib/types";

const SUGGESTIONS = [
  "Make the bud brighter.",
  "Add a soft wind.",
  "Make the world greyer.",
  "Hold the camera stiller.",
  "Let the colour bleed further.",
];

interface RefinementPanelProps {
  session: Session;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onShowTurn: (index: number) => void;
  disabled: boolean;
}

/**
 * The conversation with the agent. Every turn stays on the page and can be
 * clicked to bring that version of the film back to the stage.
 */
export function RefinementPanel({
  session,
  value,
  onChange,
  onSubmit,
  onShowTurn,
  disabled,
}: RefinementPanelProps) {
  return (
    <aside className="flex h-full flex-col gap-6">
      <header>
        <h2 className="font-serif text-xl text-ink">The conversation</h2>
        <p className="mt-1 text-[0.82rem] leading-relaxed text-ink-soft/85">
          Ask for changes the way you would ask a painter.
        </p>
      </header>

      <ol className="flex flex-col gap-2">
        {session.turns.map((turn, index) => {
          const isActive = index === session.activeTurnIndex;
          return (
            <li key={turn.id}>
              <button
                type="button"
                onClick={() => onShowTurn(index)}
                aria-current={isActive ? "true" : undefined}
                className={[
                  "w-full rounded-xl border border-l-2 px-4 py-3 text-left transition-all duration-500",
                  isActive
                    ? "border-paper-shadow/60 border-l-bud bg-paper/90"
                    : "border-transparent border-l-transparent bg-paper/40 hover:bg-paper/70",
                ].join(" ")}
              >
                <span className="flex items-center gap-2 text-[0.62rem] tracking-[0.22em] text-ink-faint uppercase">
                  {turn.kind === "seed" ? "Opening" : `Change ${index}`}
                  <PhaseDot phase={turn.progress.phase} />
                </span>
                <span className="mt-1.5 block text-[0.88rem] leading-relaxed text-ink-soft">
                  {turn.prompt}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-auto flex flex-col gap-3">
        <ul className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(suggestion)}
                className="rounded-full border border-paper-shadow/70 px-3.5 py-1.5 text-[0.72rem] text-ink-soft transition-all duration-500 hover:border-bud-soft/70 hover:text-bud disabled:opacity-50"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>

        <PromptComposer
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          disabled={disabled}
          size="compact"
          placeholder="Make the bud brighter…"
          submitLabel="Refine"
        />
      </div>
    </aside>
  );
}

function PhaseDot({ phase }: { phase: Session["turns"][number]["progress"]["phase"] }) {
  const tone =
    phase === "ready"
      ? "bg-sap"
      : phase === "failed"
        ? "bg-bud"
        : "bg-dusk animate-breathe";

  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${tone}`}
      aria-label={phase}
    />
  );
}
