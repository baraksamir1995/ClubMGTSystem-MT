"use client";

import { useState, useRef, useEffect, useId } from "react";
import { AlertCircle, ArrowRight, Check, Loader2, X } from "lucide-react";
import { buttonClass } from "@/components/site/ui";
import { OFFERINGS, QUOTE_EVENT, isOffering, type Offering } from "@/lib/offerings";
import { cleanPhone, PHONE_ERROR } from "@/lib/phone";

type FormState = "idle" | "submitting" | "success" | "error";
type FieldErrors = {
  name?: string;
  phone?: string;
  gymName?: string;
  notes?: string;
  general?: string;
};


interface LeadFormProps {
  source?: string;
  compact?: boolean;
}

export default function LeadForm({ source = "landing-hero", compact = false }: LeadFormProps) {
  const [state, setState] = useState<FormState>("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const uid = useId();
  // Set when a pricing "Request a Quote" CTA sends the visitor here.
  const [offering, setOffering] = useState<Offering | null>(null);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("offering");
    if (isOffering(fromUrl)) setOffering(fromUrl);
    const onQuote = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (isOffering(detail)) {
        setOffering(detail);
        setState("idle");
      }
    };
    window.addEventListener(QUOTE_EVENT, onQuote);
    return () => window.removeEventListener(QUOTE_EVENT, onQuote);
  }, []);

  function validate(data: { name: string; phone: string; gymName: string }): FieldErrors {
    const errs: FieldErrors = {};
    if (!data.name || data.name.trim().length < 2) {
      errs.name = "Please enter your name.";
    }
    if (!data.phone.trim()) {
      errs.phone = "Please enter your WhatsApp number.";
    } else if (!cleanPhone(data.phone)) {
      errs.phone = PHONE_ERROR;
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
      // Move focus to the first field that needs fixing.
      const first = (["name", "phone", "gymName"] as const).find((k) => fieldErrors[k]);
      if (first) requestAnimationFrame(() => (formRef.current?.elements.namedItem(first) as HTMLElement | null)?.focus());
      return;
    }

    setState("submitting");
    setErrors({});

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The backend has no service-type column; the selected offering
        // rides along in `source` (e.g. "landing-hero:quote:branded_app").
        body: JSON.stringify({
          ...data,
          source: offering ? `${source}:quote:${offering}` : source,
        }),
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
      <div role="status" className={`rounded-card border border-line bg-card p-7 shadow-lift ${compact ? "" : "md:p-9"}`}>
        <div className="flex items-start gap-4">
          <span className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand" aria-hidden>
            <Check className="h-5 w-5 text-fg" strokeWidth={3} />
          </span>
          <div>
            <h2 className="font-display text-display-sm text-fg">You&apos;re on the list.</h2>
            <p className="mt-2 text-base leading-relaxed text-fg-muted">
              {offering
                ? `We'll WhatsApp you within 24 hours with a quote for the ${OFFERINGS[offering]}.`
                : "We'll send you a WhatsApp message within 24 hours to book your demo. Expect a short walkthrough of CLBY set up for your gym."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const fieldErrorCount = (["name", "phone", "gymName"] as const).filter((k) => errors[k]).length;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby={`${uid}-title`}
      className={`rounded-[22px] border border-line bg-card p-6 shadow-lift sm:p-8 ${compact ? "" : "lg:p-10"}`}
    >
      <div className="mb-6">
        <h2 id={`${uid}-title`} className="font-display text-[2rem] leading-tight tracking-[-0.015em] text-fg">
          {offering ? "Request a quote" : "Book a demo"}
        </h2>
        <p className="mt-2 text-base text-fg-muted">
          We&apos;ll WhatsApp you within 24 hours. No spam, no drip emails.
        </p>
        {offering && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-soft py-1 pl-3.5 pr-1 text-[15px] text-fg ring-1 ring-[#C9E79A]">
            <span>
              <span className="text-fg-muted">For: </span>
              {OFFERINGS[offering]}
            </span>
            <button
              type="button"
              onClick={() => setOffering(null)}
              aria-label={`Clear selected offering: ${OFFERINGS[offering]}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-white hover:text-fg"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Announced when a submit attempt fails validation. */}
      <p className="sr-only" role="status" aria-live="polite">
        {fieldErrorCount > 0 ? `${fieldErrorCount} field${fieldErrorCount > 1 ? "s need" : " needs"} attention.` : ""}
      </p>

      <div className="space-y-6">
        <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2 sm:gap-4">
        <Field
          id={`${uid}-name`}
          label="Your name"
          name="name"
          placeholder="e.g. Ahmed Saleh"
          autoComplete="name"
          error={errors.name}
          onChange={() => errors.name && setErrors((e) => ({ ...e, name: undefined }))}
        />
        <Field
          id={`${uid}-phone`}
          label="WhatsApp number"
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder="01X XXXX XXXX or +962 7X XXX XXXX"
          autoComplete="tel"
          hint={`${offering ? "We'll send your quote here." : "We'll send the demo link here."} Outside Egypt? Include your country code.`}
          error={errors.phone}
          onChange={() => errors.phone && setErrors((e) => ({ ...e, phone: undefined }))}
        />
        </div>
        <Field
          id={`${uid}-gym`}
          label="Gym or club name"
          name="gymName"
          placeholder="e.g. Iron Strong Studio"
          autoComplete="organization"
          error={errors.gymName}
          onChange={() => errors.gymName && setErrors((e) => ({ ...e, gymName: undefined }))}
        />

        <fieldset>
          <legend className="mb-2.5 text-[15px] font-semibold text-fg">Number of branches</legend>
          <div className="grid grid-cols-4 gap-2">
            {["1", "2", "3", "4+"].map((n, i) => (
              <label key={n} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="branches"
                  value={n === "4+" ? "4" : n}
                  defaultChecked={i === 0}
                  className="peer sr-only"
                />
                <span className="flex min-h-[52px] items-center justify-center rounded-control border border-line-strong bg-card text-base font-medium text-fg transition-colors hover:bg-page peer-checked:border-fg peer-checked:bg-brand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-fg">
                  {n}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field
          id={`${uid}-notes`}
          label="Anything we should know?"
          name="notes"
          as="textarea"
          rows={3}
          maxLength={2000}
          optional
          placeholder="Current setup, team size, biggest pain…"
          hint={offering ? "Optional, but helps us prepare your quote." : "Optional, but helps us tailor the demo."}
        />
      </div>

      {errors.general && (
        <div role="alert" className="mt-5 flex items-start gap-2 rounded-control border border-danger/30 bg-danger-soft px-4 py-3 text-[15px] text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden /> {errors.general}
        </div>
      )}

      <button type="submit" disabled={state === "submitting"} className={`mt-6 ${buttonClass("primary", "lg", true)} disabled:cursor-not-allowed disabled:opacity-60`}>
        {state === "submitting" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending…
          </>
        ) : (
          <>
            {offering ? "Request my quote" : "Book my demo"}
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </>
        )}
      </button>

      <p className="mt-5 text-center text-sm leading-relaxed text-fg-muted">
        By submitting, you agree to be contacted via WhatsApp. We never share your info.
      </p>
    </form>
  );
}

// ---------- subcomponents ----------

interface FieldProps {
  id: string;
  label: string;
  name: string;
  type?: string;
  inputMode?: "tel" | "text";
  placeholder?: string;
  optional?: boolean;
  autoComplete?: string;
  hint?: string;
  error?: string;
  as?: "input" | "textarea";
  rows?: number;
  maxLength?: number;
  onChange?: () => void;
}

function Field({ id, label, name, type = "text", inputMode, placeholder, optional = false, autoComplete, hint, error, as = "input", rows = 3, maxLength, onChange }: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const base = `w-full rounded-control border bg-card px-4 text-base text-fg placeholder:text-fg-subtle transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 ${
    error ? "border-danger focus:ring-danger/25" : "border-line-strong focus:border-fg focus:ring-fg/10"
  }`;

  return (
    <div>
      <label htmlFor={id} className="mb-2.5 block text-[15px] font-semibold text-fg">
        {label} {optional && <span className="font-normal text-fg-muted">(optional)</span>}
      </label>
      {as === "textarea" ? (
        <textarea id={id} name={name} placeholder={placeholder} rows={rows} maxLength={maxLength} onChange={onChange}
          aria-describedby={describedBy} aria-invalid={!!error || undefined} className={`${base} resize-y py-3`} />
      ) : (
        <input id={id} name={name} type={type} inputMode={inputMode} placeholder={placeholder} autoComplete={autoComplete} onChange={onChange}
          aria-describedby={describedBy} aria-invalid={!!error || undefined} aria-required={optional ? undefined : true} className={`${base} h-[52px]`} />
      )}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-fg-muted">{hint}</p>
      ) : null}
    </div>
  );
}
