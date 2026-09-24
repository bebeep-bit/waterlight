"use client";

import { ASPECT_OPTIONS, type AspectId } from "@/lib/aspect";

interface AspectPickerProps {
  value: AspectId;
  onChange: (value: AspectId) => void;
  disabled?: boolean;
  /** Object plate owns the format, so the row cannot be changed. */
  locked?: boolean;
}

/**
 * Compact format row. Lives under the prompt so the ratio is chosen before
 * Paint, without looking like a dashboard of chips.
 */
export function AspectPicker({ value, onChange, disabled, locked }: AspectPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Output format"
      className="flex flex-wrap items-center gap-1.5"
    >
      <span className="mr-1 text-[0.62rem] tracking-[0.2em] text-ink-faint uppercase">
        Format
      </span>
      {ASPECT_OPTIONS.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled || locked}
            title={option.hint}
            onClick={() => onChange(option.id)}
            className={[
              "min-h-8 rounded-full px-3 py-1 text-[0.68rem] tracking-[0.14em] uppercase transition-colors duration-300",
              selected
                ? "bg-ink text-paper"
                : "bg-paper-deep/70 text-ink-soft hover:bg-paper-shadow/60",
              locked && selected
                ? "cursor-not-allowed"
                : disabled || locked
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
