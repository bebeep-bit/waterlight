"use client";

import { EXAMPLE_PROMPTS } from "@/lib/example-prompts";

interface ExamplePromptsProps {
  onChoose: (prompt: string) => void;
  disabled: boolean;
}

export function ExamplePrompts({ onChoose, disabled }: ExamplePromptsProps) {
  return (
    <section aria-labelledby="examples-heading" className="animate-rise">
      <h2
        id="examples-heading"
        className="mb-5 text-center text-[0.68rem] tracking-[0.3em] text-ink-faint uppercase"
      >
        Or begin from one of these
      </h2>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {EXAMPLE_PROMPTS.map((example, index) => (
          <li key={example.label}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChoose(example.prompt)}
              style={{ animationDelay: `${120 * index}ms` }}
              className="edge-wash group animate-rise h-full w-full rounded-2xl border border-paper-shadow/60 bg-paper/50 p-5 text-left transition-all duration-500 hover:-translate-y-0.5 hover:border-bud-soft/60 hover:bg-paper/80 disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="font-serif text-lg text-ink transition-colors duration-500 group-hover:text-bud">
                {example.label}
              </span>
              <span className="mt-2 block text-[0.82rem] leading-relaxed text-ink-soft/85">
                {example.prompt}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
