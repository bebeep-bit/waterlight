"use client";

import { useEffect, useState } from "react";
import { PromptComposer } from "@/components/prompt-composer";
import { aspectOf, type AspectId } from "@/lib/aspect";
import type { Phase, Session } from "@/lib/types";

/** Still-image briefs from the places-and-objects prompt board. */
const IMAGE_POOL = [
  "Quiet library at dawn, dust in the light beams",
  "Foggy pier by a lake, wet wooden planks",
  "Greenhouse after rain, droplets on the glass",
  "Attic with a skylight and old suitcases",
  "Grandmother's kitchen, soft morning light",
  "Empty train platform at dusk",
  "Mountain path through pines, low clouds",
  "Narrow street with old lanterns at night",
  "Potter's workshop, shelves of clay forms",
  "Winter yard with a clothesline and snow",
  "Garden with a stone bench and ivy",
  "Bright artist's loft, canvases by the wall",
  "Coastal cliffs at sunset, calm sea",
  "Reading room with tall windows and wood",
  "Bridge over a quiet river in fog",
  "Rural post office with wooden shutters",
  "Balcony with climbing flowers over a courtyard",
  "Forest clearing with morning dew",
  "Old cinema with velvet seats",
  "Cafe by the window on a rainy day",
  "Spice market early morning, empty stalls",
  "Observatory on a hill under a clear sky",
  "Empty metro station, soft lamp light",
  "Farm barn with open doors",
  "Rooftop at sunset, city view",
  "Ceramic cup with a fine crack",
  "Brass key on a marble table",
  "Folded letter with a wax seal",
  "Vintage camera in a leather case",
  "Glass jar with dried flowers",
  "Wool scarf on a wooden hanger",
  "Old compass with a worn casing",
  "Book with a ribbon bookmark",
  "Clay pitcher of water with droplets",
  "Pair of leather boots by the door",
  "Copper kettle on the stove",
  "Woven basket of apples",
  "Candle in a holder, wax dripping",
  "Music box with the lid open",
  "Umbrella with a wooden handle by the door",
  "Pendulum clock on a mantel",
  "Fountain pen beside an inkwell",
  "Lantern with warm glass",
  "Old suitcase with city stickers",
  "Cup of coffee with steam rising",
  "Small globe on a writing desk",
];

const IDEA_COUNT = 8;

function pickIdeas(previous: string[]): string[] {
  const rest = IMAGE_POOL.filter((prompt) => !previous.includes(prompt));
  const bag = rest.length >= IDEA_COUNT ? rest : [...IMAGE_POOL];
  const shuffled = [...bag];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, IDEA_COUNT);
}

interface RefinementPanelProps {
  session: Session;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onRegenerate: (turnIndex: number) => void;
  onShowTurn: (index: number) => void;
  onAspectChange: (value: AspectId) => void;
  aspectLocked?: boolean;
  disabled: boolean;
  animating: boolean;
  referencePreview?: string | null;
  referenceBusy?: boolean;
  onReferenceFile?: (file: File) => void;
  onClearReference?: () => void;
  subjectPreview?: string | null;
  subjectBusy?: boolean;
  onSubjectFile?: (file: File) => void;
  onClearSubject?: () => void;
}

/**
 * The conversation with the agent. Every wash stays on the page and can be
 * clicked to bring it back to the stage, so a refinement that went the wrong
 * way is never destructive.
 */
export function RefinementPanel({
  session,
  value,
  onChange,
  onSubmit,
  onRegenerate,
  onShowTurn,
  onAspectChange,
  aspectLocked,
  disabled,
  animating,
  referencePreview,
  referenceBusy,
  onReferenceFile,
  onClearReference,
}: RefinementPanelProps) {
  const repainting = session.turns.some(
    (turn) => turn.progress.phase === "painting",
  );
  const paintStamp = session.turns
    .filter((turn) => turn.progress.phase === "painting")
    .map((turn) => turn.id)
    .join("|");
  const [ideas, setIdeas] = useState(() => pickIdeas([]));

  useEffect(() => {
    if (!paintStamp) return;
    setIdeas((current) => pickIdeas(current));
  }, [paintStamp]);

  return (
    <aside className="flex h-full flex-col gap-6">
      <header>
        <h2 className="font-serif text-xl text-ink">The conversation</h2>
        <p className="mt-1 text-[0.82rem] leading-relaxed text-ink-soft/85">
          Ask for changes the way you would ask a painter. Each wash takes a
          few seconds.
        </p>
      </header>

      <ol className="flex flex-col gap-2">
        {session.turns.map((turn, index) => {
          const isActive = index === session.activeTurnIndex;
          return (
            <li key={turn.id}>
              <div
                className={[
                  "flex items-start gap-1 rounded-xl border border-l-2 transition-all duration-500",
                  isActive
                    ? "border-paper-shadow/60 border-l-bud bg-paper/90"
                    : "border-transparent border-l-transparent bg-paper/40 hover:bg-paper/70",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => onShowTurn(index)}
                  aria-current={isActive ? "true" : undefined}
                  className="min-w-0 flex-1 px-4 py-3 text-left"
                >
                  <span className="flex items-center gap-2 text-[0.62rem] tracking-[0.14em] text-ink-soft">
                    {aspectOf(turn.frame?.aspect ?? turn.aspect).label}
                    <PhaseDot phase={turn.progress.phase} />
                  </span>
                  <span className="mt-1.5 block text-[0.88rem] leading-relaxed text-ink-soft">
                    {turn.prompt}
                  </span>
                  {turn.error && (
                    <span className="mt-1.5 block text-[0.78rem] text-bud">
                      {turn.error}
                    </span>
                  )}
                </button>
                <div className="mr-1 mt-1.5 flex shrink-0 flex-col">
                  <RegeneratePromptButton
                    disabled={disabled}
                    onRegenerate={() => onRegenerate(index)}
                  />
                  <CopyPromptButton text={turn.prompt} disabled={disabled} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div
        className={[
          "flex flex-col gap-3",
          repainting ? "mt-2" : "mt-auto",
        ].join(" ")}
      >
        <PromptComposer
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          disabled={disabled}
          size="compact"
          placeholder={
            animating ? "The film is rendering…" : "A new scene…"
          }
          submitLabel="Paint"
          aspect={session.aspect}
          onAspectChange={onAspectChange}
          aspectLocked={aspectLocked}
          referencePreview={referencePreview}
          referenceBusy={referenceBusy}
          onReferenceFile={onReferenceFile}
          onClearReference={onClearReference}
        />

        <ul className="flex flex-col gap-1.5">
          {ideas.map((prompt) => (
            <li key={prompt}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(prompt)}
                className="w-full rounded-xl px-3 py-1.5 text-left text-[0.78rem] leading-snug text-ink-soft transition-colors duration-300 hover:bg-paper/80 hover:text-ink disabled:opacity-50"
              >
                {prompt}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

const TURN_ICON_BTN =
  "rounded-lg p-2 text-ink transition-colors duration-300 hover:bg-paper-deep/80 hover:text-ink disabled:cursor-not-allowed";

function RegeneratePromptButton({
  disabled,
  onRegenerate,
}: {
  disabled: boolean;
  onRegenerate: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onRegenerate();
      }}
      title="Generate again"
      aria-label="Generate this prompt again"
      className={TURN_ICON_BTN}
    >
      <RefreshIcon />
    </button>
  );
}

function CopyPromptButton({
  text,
  disabled,
}: {
  text: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard can be denied; button stays quiet */
    }
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        void copy();
      }}
      title={copied ? "Copied" : "Copy prompt"}
      aria-label={copied ? "Prompt copied" : "Copy generation prompt"}
      className={TURN_ICON_BTN}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
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
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-2.6-6.3" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function PhaseDot({ phase }: { phase: Phase }) {
  const tone =
    phase === "ready"
      ? "bg-sap"
      : phase === "failed"
        ? "bg-bud"
        : "bg-slate animate-breathe";

  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${tone}`}
      aria-label={phase}
    />
  );
}
