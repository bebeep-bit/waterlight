"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { AspectPicker } from "@/components/aspect-picker";
import type { AspectId } from "@/lib/aspect";

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
  /** When set, shows the format row under the field. */
  aspect?: AspectId;
  onAspectChange?: (value: AspectId) => void;
  /** Object plate sets the format; the row cannot be changed. */
  aspectLocked?: boolean;
  /** Style plate: hues, strokes, drawn-art handling. */
  referencePreview?: string | null;
  referenceBusy?: boolean;
  onReferenceFile?: (file: File) => void;
  onClearReference?: () => void;
}

export function PromptComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  size,
  submitLabel,
  aspect,
  onAspectChange,
  aspectLocked,
  referencePreview,
  referenceBusy,
  onReferenceFile,
  onClearReference,
}: PromptComposerProps) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  /* Grow with the text so the field never scrolls mid-thought. */
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const isHero = size === "hero";
  const readValue = () => (textarea.current?.value ?? text).trim();

  const submit = () => {
    const next = readValue();
    if (!next || disabled) return;
    onChange(next);
    onSubmit(next);
  };

  const handleTyped = (next: string) => {
    setText(next);
    onChange(next);
  };

  const canSubmit = text.trim().length > 0 && !disabled;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className={[
        "relative rounded-[2rem] border bg-paper/70 backdrop-blur-sm transition-all duration-700",
        focused
          ? "border-bud-soft/70 shadow-[0_24px_60px_-40px_rgba(194,85,47,0.5)]"
          : "border-paper-shadow/70 shadow-[0_18px_50px_-44px_rgba(43,39,35,0.6)]",
        isHero ? "p-6 sm:p-8" : "p-4",
      ].join(" ")}
    >
      <div className="relative">
        <textarea
          ref={textarea}
          value={text}
          onInput={(event) => handleTyped(event.currentTarget.value)}
          onChange={(event) => handleTyped(event.currentTarget.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={isHero ? 3 : 2}
          placeholder={placeholder}
          aria-label={isHero ? "Describe what to paint" : "Ask for a change"}
          className={[
            "w-full resize-none bg-transparent text-ink outline-none placeholder:text-ink-faint/70",
            isHero
              ? "font-serif text-2xl leading-relaxed sm:text-[1.75rem]"
              : "pr-8 text-[0.95rem] leading-relaxed",
          ].join(" ")}
        />
        {!isHero && text.trim().length > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleTyped("")}
            title="Clear prompt"
            aria-label="Clear prompt"
            className="absolute top-0 right-0 rounded-lg p-1.5 text-ink transition-colors duration-300 hover:bg-paper-deep/80 disabled:cursor-not-allowed"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {aspect && onAspectChange && (
        <div className="mt-4">
          <AspectPicker
            value={aspect}
            onChange={onAspectChange}
            disabled={disabled}
            locked={false}
          />
        </div>
      )}

      <div className="mt-4 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {onReferenceFile && (
            <PlateButton
              label="Style"
              busyLabel="Adding…"
              preview={referencePreview}
              busy={referenceBusy}
              disabled={disabled}
              inputRef={fileInput}
              onFile={onReferenceFile}
              onClear={onClearReference}
            />
          )}
          <p className="pointer-events-none text-[0.7rem] tracking-[0.18em] text-ink-faint/80 uppercase">
            Enter to paint · Shift+Enter for a new line
          </p>
        </div>
        <button
          type="button"
          onClick={submit}
          aria-disabled={!canSubmit}
          className={[
            "relative z-10 min-h-11 cursor-pointer rounded-full px-6 py-2.5 text-[0.7rem] tracking-[0.22em] uppercase transition-all duration-500 sm:min-h-0 sm:shrink-0",
            canSubmit
              ? "bg-bud text-paper hover:bg-bud/90 hover:shadow-[0_10px_30px_-14px_rgba(194,85,47,0.8)]"
              : "bg-bud/40 text-paper",
          ].join(" ")}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function PlateButton({
  label,
  busyLabel,
  preview,
  busy,
  disabled,
  inputRef,
  onFile,
  onClear,
}: {
  label: string;
  busyLabel: string;
  preview?: string | null;
  busy?: boolean;
  disabled: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
  onClear?: () => void;
}) {
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      {preview ? (
        <span className="inline-flex min-w-0 items-center gap-2 rounded-full border border-paper-shadow/80 bg-paper/80 py-1 pr-2 pl-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="h-7 w-7 rounded-full object-cover" />
          <span className="truncate text-[0.62rem] tracking-[0.14em] text-ink uppercase">
            {label}
          </span>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              title={`Remove ${label.toLowerCase()}`}
              aria-label={`Remove ${label.toLowerCase()}`}
              className="rounded-full p-1 text-ink hover:bg-paper-deep/80 disabled:opacity-40"
            >
              <CloseIcon />
            </button>
          )}
        </span>
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-full border border-paper-shadow/80 bg-paper/80 px-4 py-2 text-[0.62rem] tracking-[0.16em] text-ink uppercase transition-colors hover:border-bud-soft/70 disabled:opacity-40"
        >
          {busy ? busyLabel : label}
        </button>
      )}
    </>
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
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
