"use client";

import { useState, useRef } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";

type FormState = "idle" | "submitting" | "success" | "error";

interface LeadFormProps {
  source?: string;
  compact?: boolean;
}

export default function LeadForm({ source = "landing-hero", compact = false }: LeadFormProps) {
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "submitting") return;

    setState("submitting");
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name"),
      phone: fd.get("phone"),
      gymName: fd.get("gymName"),
      branches: fd.get("branches"),
      notes: fd.get("notes"),
      source,
    };

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong.");
        setState("error");
        return;
      }
      setState("success");
      formRef.current?.reset();
    } catch (err) {
      setError("Network error. Please try again.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div
        className={`rounded-sm border border-ink/10 bg-ink text-canvas p-8 ${
          compact ? "" : "md:p-10"
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-accent">
            <Check className="h-4 w-4 text-canvas" strokeWidth={3} />
          </div>
          <div>
            <h3 className="font-display text-3xl leading-none mb-3">
              You're on the list.
            </h3>
            <p className="text-canvas/70 leading-relaxed">
              We'll send you a WhatsApp message within 24 hours to book your demo.
              Expect a short, founder-led walkthrough — no slides, just your gym.
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
      className={`rounded-sm border border-ink/15 bg-paper p-6 ${
        compact ? "" : "md:p-8"
      } shadow-[0_1px_0_0_rgba(10,14,26,0.04),0_24px_48px_-24px_rgba(10,14,26,0.12)]`}
    >
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted mb-3">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-blink" />
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
          required
          autoComplete="name"
        />

        <Field
          label="WhatsApp number"
          name="phone"
          type="tel"
          placeholder="01X XXXX XXXX"
          required
          autoComplete="tel"
          hint="We'll send the demo link here."
        />

        <Field
          label="Gym or club name"
          name="gymName"
          placeholder="e.g. Iron Strong Studio"
          required
          autoComplete="organization"
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
                <div className="border border-ink/15 bg-canvas rounded-sm py-3 text-center font-medium transition-all peer-checked:border-ink peer-checked:bg-ink peer-checked:text-canvas group-hover:border-ink/40">
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
          required={false}
          placeholder="Current setup, team size, biggest pain…"
          hint="Optional — but helps us tailor the demo."
        />
      </div>

      {error && (
        <div className="mt-4 rounded-sm border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={state === "submitting"}
        className="mt-6 group relative w-full bg-ink text-canvas font-medium py-4 px-6 rounded-sm transition-all hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed"
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
  required?: boolean;
  autoComplete?: string;
  hint?: string;
  as?: "input" | "textarea";
  rows?: number;
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = true,
  autoComplete,
  hint,
  as = "input",
  rows = 3,
}: FieldProps) {
  const base =
    "w-full bg-canvas border border-ink/15 rounded-sm px-4 py-3 text-ink placeholder:text-muted/60 transition-colors focus:border-ink focus:outline-none";

  return (
    <div>
      <label className="block text-xs font-mono uppercase tracking-wider text-muted mb-2">
        {label} {!required && <span className="normal-case tracking-normal text-muted/60">(optional)</span>}
      </label>
      {as === "textarea" ? (
        <textarea
          name={name}
          placeholder={placeholder}
          required={required}
          rows={rows}
          className={`${base} resize-none`}
        />
      ) : (
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          className={base}
        />
      )}
      {hint && <p className="mt-1.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
