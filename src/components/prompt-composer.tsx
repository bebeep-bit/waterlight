"use client";

import { useEffect, useRef, useState } from "react";

interface PromptComposerProps {
  /** Text pushed in from outside, e.g. when an example prompt is chosen. */
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  disabled: boolean;
  placeholder: string;
  /** The hero composer is larger and serif; the refinement one is compact. */
  size: "hero" | "compact";
  submitLabel: string;
}

export function PromptComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  size,
  submitLabel,
}: PromptComposerProps) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  /* Grow with the text so the field never scrolls mid-thought. */
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const isHero = size === "hero";
  const canSubmit = value.trim().length > 0 && !disabled;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit(value);
      }}
      className={[
        "edge-wash relative rounded-[2rem] border bg-paper/70 backdrop-blur-sm transition-all duration-700",
        focused
          ? "border-bud-soft/70 shadow-[0_24px_60px_-40px_rgba(194,85,47,0.5)]"
          : "border-paper-shadow/70 shadow-[0_18px_50px_-44px_rgba(43,39,35,0.6)]",
        isHero ? "p-6 sm:p-8" : "p-4",
      ].join(" ")}
    >
      <textarea
        ref={textarea}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (canSubmit) onSubmit(value);
          }
        }}
        rows={isHero ? 3 : 2}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={isHero ? "Describe your film" : "Ask for a change"}
        className={[
          "w-full resize-none bg-transparent text-ink outline-none placeholder:text-ink-faint/70 disabled:opacity-50",
          isHero
            ? "font-serif text-2xl leading-relaxed sm:text-[1.75rem]"
            : "text-[0.95rem] leading-relaxed",
        ].join(" ")}
      />

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-[0.7rem] tracking-[0.18em] text-ink-faint/80 uppercase">
          Enter to paint · Shift+Enter for a new line
        </p>
        <button
          type="submit"
          disabled={!canSubmit}
          className={[
            "shrink-0 rounded-full px-6 py-2.5 text-[0.7rem] tracking-[0.22em] uppercase transition-all duration-500",
            canSubmit
              ? "bg-bud text-paper hover:bg-bud/90 hover:shadow-[0_10px_30px_-14px_rgba(194,85,47,0.8)]"
              : "cursor-not-allowed bg-paper-shadow/60 text-ink-faint",
          ].join(" ")}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
