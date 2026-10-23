"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  Loader2,
  LocateFixed,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

/* ─────────────────────────────── config ─────────────────────────────── */

// Country → IANA timezone, so the gym's schedule starts in the right zone.
const COUNTRIES: { name: string; tz: string }[] = [
  { name: "Egypt", tz: "Africa/Cairo" },
  { name: "Saudi Arabia", tz: "Asia/Riyadh" },
  { name: "United Arab Emirates", tz: "Asia/Dubai" },
  { name: "Kuwait", tz: "Asia/Kuwait" },
  { name: "Qatar", tz: "Asia/Qatar" },
  { name: "Bahrain", tz: "Asia/Bahrain" },
  { name: "Oman", tz: "Asia/Muscat" },
  { name: "Jordan", tz: "Asia/Amman" },
  { name: "Lebanon", tz: "Asia/Beirut" },
  { name: "Morocco", tz: "Africa/Casablanca" },
];
const OTHER_COUNTRY = "Other";

// Must match GymRequestController::CATEGORIES.
const CATEGORIES: { value: string; label: string }[] = [
  { value: "gym", label: "Gym" },
  { value: "crossfit", label: "CrossFit / Functional" },
  { value: "martial_arts", label: "Martial arts" },
  { value: "boxing", label: "Boxing / Kickboxing" },
  { value: "yoga_pilates", label: "Yoga / Pilates" },
  { value: "dance", label: "Dance" },
  { value: "swimming", label: "Swimming" },
  { value: "sports_club", label: "Sports club" },
  { value: "other", label: "Other" },
];

const SUGGESTED_SERVICES = [
  "Personal training",
  "Group classes",
  "Women-only area",
  "Kids programs",
  "Sauna / Steam",
  "Swimming pool",
  "Nutrition coaching",
  "Physiotherapy",
  "Parking",
  "Lockers & showers",
];

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const PHONE_RE = /^\+?[0-9]{7,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DRAFT_KEY = "clby:gym-registration:draft";

/* ─────────────────────────────── types ─────────────────────────────── */

type Values = {
  gym_name: string;
  description: string;
  country: string;
  other_country: string;
  city: string;
  address: string;
  latitude: string;
  longitude: string;
  phone: string;
  business_email: string;
  category: string;
  services: string[];
  branches_count: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  agree: boolean;
  company_website: string; // honeypot
};

type Errors = Partial<Record<keyof Values | "logo" | "general", string>>;

const INITIAL: Values = {
  gym_name: "",
  description: "",
  country: "Egypt",
  other_country: "",
  city: "",
  address: "",
  latitude: "",
  longitude: "",
  phone: "",
  business_email: "",
  category: "gym",
  services: [],
  branches_count: "1",
  owner_name: "",
  owner_email: "",
  owner_phone: "",
  agree: false,
  company_website: "",
};

const STEPS = ["Gym information", "Business details", "Owner account"] as const;

// Which step each server-side field error belongs to, so a 422 jumps back.
const FIELD_STEP: Record<string, number> = {
  gym_name: 0, description: 0, logo: 0, country: 0, city: 0, address: 0,
  latitude: 0, longitude: 0, phone: 0, business_email: 0,
  category: 1, services: 1, branches_count: 1, timezone: 1,
  owner_name: 2, owner_email: 2, owner_phone: 2,
};

const cleanPhone = (p: string) => p.replace(/[\s()-]/g, "");

function newSubmissionKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* ─────────────────────────────── component ─────────────────────────────── */

export default function GymRegistrationForm() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [customService, setCustomService] = useState("");
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ reference: string } | null>(null);
  // One key per attempt-sequence: a retried POST after a network blip maps
  // to the same request server-side instead of creating a duplicate.
  const submissionKey = useRef<string>("");
  const fileInput = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Restore a draft after an accidental reload (text fields only).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) setValues((v) => ({ ...v, ...JSON.parse(raw), agree: false, company_website: "" }));
    } catch {}
    submissionKey.current = newSubmissionKey();
  }, []);

  useEffect(() => {
    if (result) return;
    try {
      const { agree, company_website, ...draft } = values;
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [values, result]);

  useEffect(() => {
    return () => { if (logoPreview) URL.revokeObjectURL(logoPreview); };
  }, [logoPreview]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const goTo = (n: number) => {
    setStep(n);
    // Move focus to the step heading for keyboard / screen-reader users.
    requestAnimationFrame(() => {
      headingRef.current?.focus();
      headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  /* ── logo ── */

  function pickLogo(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setErrors((e) => ({ ...e, logo: "Use a PNG, JPG or WebP image." }));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setErrors((e) => ({ ...e, logo: "Logo must be 2 MB or smaller." }));
      return;
    }
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogo(file);
    setLogoPreview(URL.createObjectURL(file));
    setErrors((e) => ({ ...e, logo: undefined }));
  }

  function removeLogo() {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogo(null);
    setLogoPreview(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  /* ── location ── */

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setErrors((e) => ({ ...e, address: "Location isn't available in this browser." }));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set("latitude", pos.coords.latitude.toFixed(6));
        set("longitude", pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        setErrors((e) => ({ ...e, address: "Couldn't get your location. You can skip this." }));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  /* ── services ── */

  function toggleService(s: string) {
    set("services", values.services.includes(s) ? values.services.filter((x) => x !== s) : [...values.services, s]);
  }

  function addCustomService() {
    const s = customService.trim().slice(0, 50);
    if (!s || values.services.some((x) => x.toLowerCase() === s.toLowerCase()) || values.services.length >= 20) return;
    set("services", [...values.services, s]);
    setCustomService("");
  }

  /* ── validation ── */

  function validateStep(n: number): Errors {
    const v = values;
    const e: Errors = {};
    if (n === 0) {
      if (v.gym_name.trim().length < 2) e.gym_name = "Enter your gym or club name.";
      if (!logo) e.logo = "Upload your gym logo — it's shown on your members' app splash screen.";
      if (v.country === OTHER_COUNTRY && v.other_country.trim().length < 2) e.other_country = "Enter your country.";
      if (!v.city.trim()) e.city = "Enter the city.";
      if (!PHONE_RE.test(cleanPhone(v.phone))) e.phone = "Enter a valid phone number (digits, optional +country code).";
      if (!EMAIL_RE.test(v.business_email.trim())) e.business_email = "Enter a valid email address.";
    }
    if (n === 1) {
      const b = Number(v.branches_count);
      if (!Number.isInteger(b) || b < 1 || b > 100) e.branches_count = "Enter a number between 1 and 100.";
    }
    if (n === 2) {
      if (v.owner_name.trim().length < 2) e.owner_name = "Enter your full name.";
      if (!EMAIL_RE.test(v.owner_email.trim())) e.owner_email = "Enter a valid email address.";
      if (!PHONE_RE.test(cleanPhone(v.owner_phone))) e.owner_phone = "Enter a valid mobile number.";
      if (!v.agree) e.agree = "Please accept the terms to continue.";
    }
    return e;
  }

  function next() {
    const e = validateStep(step);
    setErrors(e);
    if (Object.keys(e).length === 0) goTo(step + 1);
  }

  /* ── submit ── */

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (submitting) return;
    if (step < STEPS.length - 1) { next(); return; }

    const e = validateStep(2);
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    const v = values;
    const country = v.country === OTHER_COUNTRY ? v.other_country.trim() : v.country;
    const tz =
      COUNTRIES.find((c) => c.name === v.country)?.tz ??
      (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ""; } })();

    const fd = new FormData();
    fd.set("submission_key", submissionKey.current);
    fd.set("gym_name", v.gym_name.trim());
    if (v.description.trim()) fd.set("description", v.description.trim());
    fd.set("country", country);
    fd.set("city", v.city.trim());
    if (v.address.trim()) fd.set("address", v.address.trim());
    if (v.latitude && v.longitude) { fd.set("latitude", v.latitude); fd.set("longitude", v.longitude); }
    fd.set("phone", cleanPhone(v.phone));
    fd.set("business_email", v.business_email.trim());
    fd.set("category", v.category);
    v.services.forEach((s) => fd.append("services[]", s));
    fd.set("branches_count", String(Number(v.branches_count)));
    if (tz) fd.set("timezone", tz);
    fd.set("owner_name", v.owner_name.trim());
    fd.set("owner_email", v.owner_email.trim());
    fd.set("owner_phone", cleanPhone(v.owner_phone));
    if (v.company_website) fd.set("company_website", v.company_website);
    if (logo) fd.set("logo", logo);

    setSubmitting(true);
    setErrors({});
    try {
      const res = await fetch("/api/gym-request", { method: "POST", body: fd });
      const body = await res.json().catch(() => null);

      if (res.ok && body?.data?.reference) {
        try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
        setResult({ reference: body.data.reference });
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
        return;
      }

      if (res.status === 422 && body?.errors) {
        const fieldErrors: Errors = {};
        let firstStep = STEPS.length - 1;
        for (const [field, msgs] of Object.entries(body.errors as Record<string, string[]>)) {
          const key = (field.startsWith("services") ? "services" : field) as keyof Errors;
          fieldErrors[key] = msgs[0];
          if (FIELD_STEP[key] !== undefined) firstStep = Math.min(firstStep, FIELD_STEP[key]);
        }
        setErrors(fieldErrors);
        if (firstStep !== step) goTo(firstStep);
        return;
      }

      // A server-side rejection (not a network failure) is final for this
      // attempt — use a fresh key so a corrected resubmission isn't deduped.
      if (res.status < 500) submissionKey.current = newSubmissionKey();
      setErrors({ general: body?.message ?? "Something went wrong. Please try again." });
    } catch {
      setErrors({ general: "Network error. Please check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  /* ── confirmation ── */

  if (result) {
    return (
      <div className="rounded-sm border border-canvas/10 bg-surface p-8 md:p-12 text-canvas" role="status">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-entry mb-6">
          <Check className="h-6 w-6 text-ink" strokeWidth={3} />
        </div>
        <h2 className="font-display text-display-md mb-4">Request received.</h2>
        <p className="text-canvas/70 leading-relaxed max-w-xl">
          Thanks for registering <span className="text-canvas font-medium">{values.gym_name}</span>.
          Our team will review your request, usually within one business day.
        </p>
        <div className="mt-6 inline-flex items-center gap-3 rounded-sm border border-canvas/15 px-4 py-3">
          <span className="text-xs font-mono uppercase tracking-wider text-muted">Reference</span>
          <span className="font-mono text-entry">{result.reference}</span>
        </div>
        <ol className="mt-8 space-y-3 text-sm text-canvas/70">
          <li className="flex gap-3"><span className="font-mono text-entry">01</span> <span>We sent a confirmation to <span className="text-canvas">{values.owner_email}</span>.</span></li>
          <li className="flex gap-3"><span className="font-mono text-entry">02</span> Once approved, you'll get an email with your dashboard link and a secure link to set your password.</li>
          <li className="flex gap-3"><span className="font-mono text-entry">03</span> Your gym goes live in the CLBY app for your members.</li>
        </ol>
        <a href="/" className="mt-10 inline-flex items-center gap-2 text-sm text-canvas/70 hover:text-entry transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to clbyapp.com
        </a>
      </div>
    );
  }

  /* ── form ── */

  const countryOptions = [...COUNTRIES.map((c) => c.name), OTHER_COUNTRY];

  return (
    <form
      onSubmit={submit}
      noValidate
      className="relative rounded-sm border border-canvas/15 bg-surface p-6 md:p-10 text-canvas"
    >
      {/* Progress */}
      <ol className="grid grid-cols-3 gap-2 mb-8" aria-label="Registration progress">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined}>
            <div className={`h-1 rounded-full transition-colors ${i <= step ? "bg-entry" : "bg-canvas/15"}`} />
            <p className={`mt-2 text-[11px] font-mono uppercase tracking-wider ${i === step ? "text-canvas" : "text-muted"}`}>
              <span className="hidden sm:inline">{String(i + 1).padStart(2, "0")} · </span>{label}
            </p>
          </li>
        ))}
      </ol>

      <h2 ref={headingRef} tabIndex={-1} className="font-display text-3xl md:text-4xl leading-none mb-2 outline-none scroll-mt-28">
        {STEPS[step]}
      </h2>
      <p className="text-sm text-muted mb-8">
        {step === 0 && "Tell us about your gym. This is what members will see in the CLBY app."}
        {step === 1 && "A few details to set up your gym's profile. You can change these later."}
        {step === 2 && "This person will own the admin dashboard. We'll email them once the gym is approved."}
      </p>

      {/* Honeypot — hidden from people, tempting to bots */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={values.company_website}
            onChange={(e) => set("company_website", e.target.value)} />
        </label>
      </div>

      {step === 0 && (
        <div className="space-y-5">
          <Field label="Gym or club name" id="gym_name" error={errors.gym_name}>
            <input id="gym_name" className={inputCls(errors.gym_name)} value={values.gym_name} autoComplete="organization"
              placeholder="e.g. Iron Strong Studio" maxLength={255} onChange={(e) => set("gym_name", e.target.value)} />
          </Field>

          {/* Logo */}
          <div>
            <span className={labelCls}>Logo</span>
            <div className="flex items-center gap-4">
              <div className={`h-20 w-20 flex-shrink-0 rounded-sm border ${errors.logo ? "border-red-400/60" : "border-canvas/15"} bg-ink flex items-center justify-center overflow-hidden`}>
                {logoPreview
                  ? <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover" />
                  : <ImagePlus className="h-6 w-6 text-muted" />}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => fileInput.current?.click()}
                  className="inline-flex items-center gap-1.5 border border-canvas/15 hover:border-entry rounded-sm px-3 py-2 text-sm transition-colors">
                  {logo ? <><RefreshCw className="h-3.5 w-3.5" /> Replace</> : <><ImagePlus className="h-3.5 w-3.5" /> Upload logo</>}
                </button>
                {logo && (
                  <button type="button" onClick={removeLogo}
                    className="inline-flex items-center gap-1.5 border border-canvas/15 hover:border-red-400 hover:text-red-300 rounded-sm px-3 py-2 text-sm transition-colors">
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
              </div>
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
                aria-label="Upload logo" onChange={(e) => pickLogo(e.target.files?.[0])} />
            </div>
            {errors.logo
              ? <p className="mt-1.5 text-[11px] text-red-400">{errors.logo}</p>
              : <p className="mt-1.5 text-[11px] text-muted">Shown on your members' app splash screen. PNG, JPG or WebP, up to 2 MB. Square works best.</p>}
          </div>

          <Field label="Description" id="description" optional error={errors.description}>
            <textarea id="description" rows={3} className={`${inputCls(errors.description)} resize-none`} maxLength={2000}
              value={values.description} placeholder="What makes your gym special?" onChange={(e) => set("description", e.target.value)} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Country" id="country" error={errors.country}>
              <select id="country" className={inputCls(errors.country)} value={values.country}
                onChange={(e) => set("country", e.target.value)}>
                {countryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            {values.country === OTHER_COUNTRY ? (
              <Field label="Country name" id="other_country" error={errors.other_country}>
                <input id="other_country" className={inputCls(errors.other_country)} value={values.other_country}
                  maxLength={100} autoComplete="country-name" onChange={(e) => set("other_country", e.target.value)} />
              </Field>
            ) : (
              <Field label="City" id="city" error={errors.city}>
                <input id="city" className={inputCls(errors.city)} value={values.city} maxLength={100}
                  autoComplete="address-level2" placeholder="e.g. Cairo" onChange={(e) => set("city", e.target.value)} />
              </Field>
            )}
          </div>
          {values.country === OTHER_COUNTRY && (
            <Field label="City" id="city" error={errors.city}>
              <input id="city" className={inputCls(errors.city)} value={values.city} maxLength={100}
                autoComplete="address-level2" onChange={(e) => set("city", e.target.value)} />
            </Field>
          )}

          <Field label="Address" id="address" optional error={errors.address}
            hint={values.latitude ? `Pinned at ${values.latitude}, ${values.longitude}` : "Street, building, area."}>
            <div className="flex gap-2">
              <input id="address" className={inputCls(errors.address)} value={values.address} maxLength={500}
                autoComplete="street-address" placeholder="e.g. 12 Nile St, Zamalek" onChange={(e) => set("address", e.target.value)} />
              {values.latitude ? (
                <button type="button" onClick={() => { set("latitude", ""); set("longitude", ""); }}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 border border-entry text-entry rounded-sm px-3 text-sm"
                  aria-label="Clear pinned location">
                  <MapPin className="h-4 w-4" /> <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button type="button" onClick={useMyLocation} disabled={locating}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 border border-canvas/15 hover:border-entry rounded-sm px-3 text-sm transition-colors disabled:opacity-60"
                  title="Use my current location">
                  {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                  <span className="hidden sm:inline">Pin location</span>
                </button>
              )}
            </div>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Gym phone" id="phone" error={errors.phone}>
              <input id="phone" type="tel" className={inputCls(errors.phone)} value={values.phone} autoComplete="tel"
                placeholder="+20 10 1234 5678" onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="Business email" id="business_email" error={errors.business_email}>
              <input id="business_email" type="email" className={inputCls(errors.business_email)} value={values.business_email}
                autoComplete="email" placeholder="hello@yourgym.com" onChange={(e) => set("business_email", e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-7">
          <fieldset>
            <legend className={labelCls}>Type of business</legend>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((c) => (
                <label key={c.value} className="relative cursor-pointer group">
                  <input type="radio" name="category" value={c.value} checked={values.category === c.value}
                    onChange={() => set("category", c.value)} className="peer sr-only" />
                  <div className="border border-canvas/15 rounded-sm py-3 px-3 text-sm text-center transition-all peer-checked:border-entry peer-checked:bg-entry peer-checked:text-ink peer-focus-visible:ring-2 peer-focus-visible:ring-entry group-hover:border-canvas/40">
                    {c.label}
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className={labelCls}>Facilities & services <span className="normal-case tracking-normal text-muted/60">(optional)</span></legend>
            <div className="flex flex-wrap gap-2">
              {[...SUGGESTED_SERVICES, ...values.services.filter((s) => !SUGGESTED_SERVICES.includes(s))].map((s) => {
                const on = values.services.includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggleService(s)} aria-pressed={on}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? "border-entry bg-entry text-ink" : "border-canvas/15 hover:border-canvas/40"}`}>
                    {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />} {s}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex gap-2 max-w-sm">
              <input className={inputCls()} value={customService} maxLength={50} placeholder="Add another…"
                aria-label="Add another service"
                onChange={(e) => setCustomService(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomService(); } }} />
              <button type="button" onClick={addCustomService} aria-label="Add service"
                className="flex-shrink-0 border border-canvas/15 hover:border-entry rounded-sm px-3 transition-colors">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {errors.services && <p className="mt-1.5 text-[11px] text-red-400">{errors.services}</p>}
          </fieldset>

          <Field label="Number of branches" id="branches_count" error={errors.branches_count}>
            <input id="branches_count" type="number" min={1} max={100} inputMode="numeric"
              className={`${inputCls(errors.branches_count)} max-w-[140px]`} value={values.branches_count}
              onChange={(e) => set("branches_count", e.target.value)} />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <Field label="Full name" id="owner_name" error={errors.owner_name}>
            <input id="owner_name" className={inputCls(errors.owner_name)} value={values.owner_name} autoComplete="name"
              placeholder="e.g. Ahmed Saleh" maxLength={255} onChange={(e) => set("owner_name", e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Email" id="owner_email" error={errors.owner_email} hint="This becomes your dashboard login.">
              <input id="owner_email" type="email" className={inputCls(errors.owner_email)} value={values.owner_email}
                autoComplete="email" placeholder="you@example.com" onChange={(e) => set("owner_email", e.target.value)} />
            </Field>
            <Field label="Mobile number" id="owner_phone" error={errors.owner_phone}>
              <input id="owner_phone" type="tel" className={inputCls(errors.owner_phone)} value={values.owner_phone}
                autoComplete="tel" placeholder="+20 10 1234 5678" onChange={(e) => set("owner_phone", e.target.value)} />
            </Field>
          </div>

          {/* Review */}
          <div className="rounded-sm border border-canvas/10 bg-ink/60 p-5 text-sm">
            <p className={labelCls}>Review</p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <Review label="Gym" value={values.gym_name} onEdit={() => goTo(0)} />
              <Review label="Location" value={[values.city, values.country === OTHER_COUNTRY ? values.other_country : values.country].filter(Boolean).join(", ")} onEdit={() => goTo(0)} />
              <Review label="Contact" value={`${values.phone} · ${values.business_email}`} onEdit={() => goTo(0)} />
              <Review label="Type" value={CATEGORIES.find((c) => c.value === values.category)?.label ?? "—"} onEdit={() => goTo(1)} />
              <Review label="Branches" value={values.branches_count} onEdit={() => goTo(1)} />
              <Review label="Logo" value={logo ? logo.name : "Missing"} onEdit={() => goTo(0)} />
            </dl>
          </div>

          <label className="flex items-start gap-3 text-sm text-canvas/80 cursor-pointer">
            <input type="checkbox" checked={values.agree} onChange={(e) => set("agree", e.target.checked)}
              className="mt-1 h-4 w-4 accent-[#B8FF2E]" aria-invalid={!!errors.agree} />
            <span>
              I agree to the{" "}
              <a href="/terms" target="_blank" className="underline underline-offset-2 hover:text-entry">Terms</a> and{" "}
              <a href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-entry">Privacy Policy</a>, and confirm
              I'm authorised to register this business.
            </span>
          </label>
          {errors.agree && <p className="-mt-3 text-[11px] text-red-400">{errors.agree}</p>}
        </div>
      )}

      {errors.general && (
        <div role="alert" className="mt-6 rounded-sm border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {errors.general}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-10 flex items-center justify-between gap-3">
        {step > 0 ? (
          <button type="button" onClick={() => { setErrors({}); goTo(step - 1); }} disabled={submitting}
            className="inline-flex items-center gap-2 text-sm text-canvas/70 hover:text-canvas transition-colors disabled:opacity-50">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        ) : <span />}

        <button type="submit" disabled={submitting}
          className="group inline-flex items-center gap-2 bg-entry text-ink font-semibold py-3.5 px-6 rounded-sm transition-all hover:bg-entry/90 disabled:opacity-60 disabled:cursor-not-allowed">
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
          ) : step < STEPS.length - 1 ? (
            <>Continue <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></>
          ) : (
            <>Submit for review <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></>
          )}
        </button>
      </div>
    </form>
  );
}

/* ─────────────────────────────── pieces ─────────────────────────────── */

const labelCls = "block text-xs font-mono uppercase tracking-wider text-muted mb-2";

function inputCls(error?: string) {
  return `w-full bg-ink border rounded-sm px-4 py-3 text-canvas placeholder:text-muted/60 transition-colors focus:outline-none ${
    error ? "border-red-400/60 focus:border-red-400" : "border-canvas/15 focus:border-entry"
  }`;
}

function Field({
  label, id, optional = false, hint, error, children,
}: {
  label: string; id: string; optional?: boolean; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label} {optional && <span className="normal-case tracking-normal text-muted/60">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-[11px] text-red-400" role="alert">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[11px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function Review({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-baseline justify-between gap-3 min-w-0">
      <div className="min-w-0">
        <dt className="text-[11px] font-mono uppercase tracking-wider text-muted">{label}</dt>
        <dd className="text-canvas truncate">{value || "—"}</dd>
      </div>
      <button type="button" onClick={onEdit} className="text-[11px] text-muted hover:text-entry underline underline-offset-2 flex-shrink-0">
        Edit
      </button>
    </div>
  );
}
