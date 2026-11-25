"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, RotateCcw, Sparkles } from "lucide-react";
import { readable, type LogoPalette } from "@/lib/logoColors";
import {
  checkColor,
  DEFAULT_PRIMARY,
  COMFORT_CONTRAST,
  DEFAULT_SECONDARY,
  HEX_RE,
  MIN_CONTRAST,
  PRESETS,
} from "@/components/app-preview/brand";

/**
 * Primary + secondary brand colour pickers for gym onboarding: native
 * colour input, hex field, suggested palettes, reset, and contrast checks
 * against the white text the member app draws on these colours.
 */
export default function BrandColorFields({
  primary,
  secondary,
  onChange,
  errors,
  logoPalette,
  onApplyLogo,
}: {
  primary: string;
  secondary: string;
  onChange: (next: { primary?: string; secondary?: string }) => void;
  errors?: { primary?: string; secondary?: string };
  /** Colours extracted from the uploaded logo, if any. */
  logoPalette?: LogoPalette | null;
  onApplyLogo?: () => void;
}) {
  const isDefault = primary.toUpperCase() === DEFAULT_PRIMARY && secondary.toUpperCase() === DEFAULT_SECONDARY;
  const [target, setTarget] = useState<"primary" | "secondary">("primary");
  const logoApplied =
    !!logoPalette && logoPalette.primary === primary.toUpperCase() && logoPalette.secondary === secondary.toUpperCase();

  return (
    <fieldset id="branding" className="scroll-mt-28">
      <div className="mb-3 flex items-center justify-between gap-3">
        <legend className="text-[15px] font-medium text-fg">Brand colours</legend>
        <button
          type="button"
          onClick={() => onChange({ primary: DEFAULT_PRIMARY, secondary: DEFAULT_SECONDARY })}
          disabled={isDefault}
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg disabled:opacity-40 disabled:hover:text-fg-muted"
        >
          <RotateCcw className="h-3 w-3" /> Reset to default
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ColorInput
          id="primary_color"
          label="Primary"
          help="Buttons, selected tabs, links"
          role="primary"
          value={primary}
          onChange={(v) => onChange({ primary: v })}
          serverError={errors?.primary}
        />
        <ColorInput
          id="secondary_color"
          label="Secondary"
          help="Membership card gradient"
          role="secondary"
          value={secondary}
          onChange={(v) => onChange({ secondary: v })}
          serverError={errors?.secondary}
        />
      </div>

      {logoPalette && (
        <div className="mt-5 rounded-control border border-line bg-page p-4" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="h-10 w-10 flex-shrink-0 rounded-full ring-1 ring-black/15"
                style={{ background: `linear-gradient(135deg, ${logoPalette.primary} 50%, ${logoPalette.secondary} 50%)` }}
              />
              <div>
                <p className="flex items-center gap-1.5 text-[15px] font-semibold text-fg">
                  <Sparkles className="h-4 w-4" aria-hidden /> Recommended from your logo
                </p>
                <p className="font-mono text-sm text-fg-muted">
                  {logoPalette.primary} · {logoPalette.secondary}
                </p>
              </div>
            </div>
            {logoApplied ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-ink">
                <Check className="h-4 w-4" aria-hidden /> Applied
              </span>
            ) : (
              <button
                type="button"
                onClick={onApplyLogo}
                className="inline-flex min-h-[40px] items-center rounded-control border border-line-strong bg-card px-4 text-sm font-semibold text-fg transition-colors hover:border-fg"
              >
                Use these colours
              </button>
            )}
          </div>

          {logoPalette.colors.length > 0 && (
            <div className="mt-4 border-t border-line pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-fg-muted">Colours in your logo</p>
                <div role="radiogroup" aria-label="Apply a logo colour to" className="inline-flex rounded-full bg-page-alt p-0.5 text-xs">
                  {(["primary", "secondary"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={target === t}
                      onClick={() => setTarget(t)}
                      className={`rounded-full px-3 py-1 font-medium capitalize transition-colors ${target === t ? "bg-card text-fg shadow-sm" : "text-fg-muted"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {logoPalette.colors.map((c) => {
                  const fixed = readable(c, target === "primary" ? COMFORT_CONTRAST : MIN_CONTRAST.secondary).hex;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onChange({ [target]: fixed })}
                      aria-label={`Use ${c} as ${target}${fixed !== c ? ` (darkened to ${fixed} for readability)` : ""}`}
                      title={fixed !== c ? `${c} → ${fixed} (darkened for readability)` : c}
                      className="h-9 w-9 rounded-full ring-1 ring-black/15 transition-transform hover:scale-110"
                      style={{ background: c }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {logoPalette.adjusted && (
            <p className="mt-3 text-sm text-fg-muted">
              We darkened your logo&apos;s colour slightly so white text in the app stays easy to read.
            </p>
          )}
        </div>
      )}

      <div className="mt-4">
        <p className="mb-2 text-sm text-fg-muted">Suggested combinations</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const on = p.primary === primary.toUpperCase() && p.secondary === secondary.toUpperCase();
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => onChange({ primary: p.primary, secondary: p.secondary })}
                aria-pressed={on}
                title={p.name}
                className={`group inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs transition-colors ${
                  on ? "border-fg text-fg" : "border-line-strong text-fg-muted hover:border-fg"
                }`}
              >
                <span
                  className="h-5 w-5 rounded-full ring-1 ring-black/20"
                  style={{ background: `linear-gradient(135deg, ${p.primary} 50%, ${p.secondary} 50%)` }}
                />
                {p.name}
              </button>
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}

function ColorInput({
  id,
  label,
  help,
  role,
  value,
  onChange,
  serverError,
}: {
  id: string;
  label: string;
  help: string;
  role: "primary" | "secondary";
  value: string;
  onChange: (v: string) => void;
  serverError?: string;
}) {
  // The hex field keeps its own text so a half-typed value doesn't fight
  // the picker; the parent only receives complete #RRGGBB values.
  const [text, setText] = useState(value.toUpperCase());
  useEffect(() => setText(value.toUpperCase()), [value]);

  const check = checkColor(role, HEX_RE.test(text) ? text : value);
  const typingInvalid = text !== "" && !HEX_RE.test(text);
  const message = serverError ?? (typingInvalid ? "Use a 6-digit hex colour, e.g. #4F46E5." : check.message);
  const level = serverError || typingInvalid ? "error" : check.level;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm text-fg">
        {label} <span className="text-sm text-fg-muted">· {help}</span>
      </label>
      <div
        className={`flex items-center gap-2 rounded-control border bg-card p-1.5 transition-colors focus-within:border-fg ${
          level === "error" ? "border-danger" : "border-line-strong"
        }`}
      >
        <label className="relative h-9 w-9 flex-shrink-0 cursor-pointer overflow-hidden rounded-control ring-1 ring-line-strong" style={{ background: value }}>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            aria-label={`${label} colour picker`}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <input
          id={id}
          value={text}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={level === "error"}
          onChange={(e) => {
            let t = e.target.value.trim().toUpperCase();
            if (t && !t.startsWith("#")) t = `#${t}`;
            setText(t);
            if (HEX_RE.test(t)) onChange(t);
          }}
          onBlur={() => { if (!HEX_RE.test(text)) setText(value.toUpperCase()); }}
          className="w-full bg-transparent font-mono text-sm uppercase text-fg outline-none"
        />
        {level === "ok" && <Check className="mr-1 h-4 w-4 flex-shrink-0 text-brand-ink" aria-label="Good contrast" />}
      </div>
      {message && (
        <p className={`mt-1.5 flex items-start gap-1 text-sm ${level === "error" ? "text-danger" : "text-warn"}`} role={level === "error" ? "alert" : undefined}>
          <AlertTriangle className="mt-[1px] h-3 w-3 flex-shrink-0" /> {message}
        </p>
      )}
    </div>
  );
}
