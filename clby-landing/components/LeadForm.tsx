"use client";

import { useState, useRef } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";

type FormState = "idle" | "submitting" | "success" | "error";
type FieldErrors = {
  name?: string;
  phone?: string;
  gymName?: string;
  notes?: string;
  general?: string;
};

// Simple Egyptian phone validation
const EG_PHONE = /^(\+?20|0)?1[0125]\d{8}$/;

interface LeadFormProps {
  source?: string;
  compact?: boolean;
}

export default function LeadForm({ source = "landing-hero", compact = false }: LeadFormProps) {
  const [state, setState] = useState<FormState>("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const formRef = useRef<HTMLFormElement>(null);

  function validate(data: { name: string; phone: string; gymName: string }): FieldErrors {
    const errs: FieldErrors = {};
    if (!data.name || data.name.trim().length < 2) {
      errs.name = "Please enter your name.";
    }
    const cleanPhone = data.phone.replace(/\s|-/g, "");
    if (!cleanPhone) {
      errs.phone = "Please enter your WhatsApp number.";
    } else if (!EG_PHONE.test(cleanPhone)) {
      errs.phone = "Enter a valid Egyptian mobile (e.g. 01X XXXX XXXX).";
    }
    if (!data.gymName || data.gymName.trim().length < 2) {
      errs.gymName = "Please tell us your gym or club name.";
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "submitting") return;

    const fd = new FormData(e.currentTarget);
    const data = {
      name: String(fd.get("name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      gymName: String(fd.get("gymName") ?? ""),
      branches: String(fd.get("branches") ?? "1"),
      notes: String(fd.get("notes") ?? ""),
    };

    const fieldErrors = validate(data);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setState("submitting");
    setErrors({});

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, source }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setErrors({ general: body.error ?? "Something went wrong." });
        setState("error");
        return;
      }
      setState("success");
      formRef.current?.reset();
    } catch {
      setErrors({ general: "Network error. Please try again." });
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div
        className={`rounded-sm border border-canvas/10 bg-surface text-canvas p-8 ${
          compact ? "" : "md:p-10"
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-entry">
            <Check className="h-4 w-4 text-ink" strokeWidth={3} />
          </div>
          <div>
            <h3 className="font-display text-3xl leading-none mb-3">
              You're on the list.
            </h3>
            <p className="text-canvas/70 leading-relaxed">
              We'll send you a WhatsApp message within 24 hours to book your demo.
              Expect a short, founder-led walkthrough. No slides, just your gym.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className={`rounded-sm border border-canvas/15 bg-surface p-6 ${
        compact ? "" : "md:p-8"
      } shadow-[0_1px_0_0_rgba(10,14,26,0.04),0_24px_48px_-24px_rgba(10,14,26,0.12)]`}
    >
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted mb-3">
          <span className="h-1.5 w-1.5 rounded-full bg-entry animate-blink" />
          Book a demo
        </div>
        <h3 className="font-display text-3xl md:text-4xl leading-none mb-2">
          See CLBY in action.
        </h3>
        <p className="text-sm text-muted">
          We'll WhatsApp you within 24 hours. No spam, no drip emails.
        </p>
      </div>

      <div className="space-y-4">
        <Field
          label="Your name"
          name="name"
          placeholder="e.g. Ahmed Saleh"
          autoComplete="name"
          error={errors.name}
          onChange={() => errors.name && setErrors(e => ({ ...e, name: undefined }))}
        />

        <Field
          label="WhatsApp number"
          name="phone"
          type="tel"
          placeholder="01X XXXX XXXX"
          autoComplete="tel"
          hint="We'll send the demo link here."
          error={errors.phone}
          onChange={() => errors.phone && setErrors(e => ({ ...e, phone: undefined }))}
        />

        <Field
          label="Gym or club name"
          name="gymName"
          placeholder="e.g. Iron Strong Studio"
          autoComplete="organization"
          error={errors.gymName}
          onChange={() => errors.gymName && setErrors(e => ({ ...e, gymName: undefined }))}
        />

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-muted mb-2">
            Number of branches
          </label>
          <div className="grid grid-cols-4 gap-2">
            {["1", "2", "3", "4+"].map((n, i) => (
              <label
                key={n}
                className="relative cursor-pointer group"
              >
                <input
                  type="radio"
                  name="branches"
                  value={n === "4+" ? "4" : n}
                  defaultChecked={i === 0}
                  className="peer sr-only"
                />
                <div className="border border-canvas/15 bg-surface text-canvas rounded-sm py-3 text-center font-medium transition-all peer-checked:border-entry peer-checked:bg-entry peer-checked:text-ink group-hover:border-canvas/40">
                  {n}
                </div>
              </label>
            ))}
          </div>
        </div>

        <Field
          label="Anything we should know?"
          name="notes"
          as="textarea"
          rows={2}
          optional
          placeholder="Current setup, team size, biggest pain…"
          hint="Optional, but helps us tailor the demo."
        />
      </div>

      {errors.general && (
        <div className="mt-4 rounded-sm border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {errors.general}
        </div>
      )}

      <button
        type="submit"
        disabled={state === "submitting"}
        className="mt-6 group relative w-full bg-entry text-ink font-semibold py-4 px-6 rounded-sm transition-all hover:bg-entry/90 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className="flex items-center justify-center gap-2">
          {state === "submitting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              Book my demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </span>
      </button>

      <p className="mt-4 text-[11px] text-muted text-center leading-relaxed">
        By submitting, you agree to be contacted via WhatsApp. We never share your info.
      </p>
    </form>
  );
}

// ---------- subcomponents ----------

interface FieldProps {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  optional?: boolean;
  autoComplete?: string;
  hint?: string;
  error?: string;
  as?: "input" | "textarea";
  rows?: number;
  onChange?: () => void;
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  optional = false,
  autoComplete,
  hint,
  error,
  as = "input",
  rows = 3,
  onChange,
}: FieldProps) {
  const base = `w-full bg-ink border rounded-sm px-4 py-3 text-canvas placeholder:text-muted/60 transition-colors focus:outline-none ${
    error
      ? "border-red-400/60 focus:border-red-400"
      : "border-canvas/15 focus:border-entry"
  }`;

  return (
    <div>
      <label className="block text-xs font-mono uppercase tracking-wider text-muted mb-2">
        {label} {optional && <span className="normal-case tracking-normal text-muted/60">(optional)</span>}
      </label>
      {as === "textarea" ? (
        <textarea
          name={name}
          placeholder={placeholder}
          rows={rows}
          onChange={onChange}
          className={`${base} resize-none`}
        />
      ) : (
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={onChange}
          className={base}
        />
      )}
      {error ? (
        <p className="mt-1.5 text-[11px] text-red-400">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[11px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
