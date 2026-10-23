import type { Metadata } from "next";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import GymRegistrationForm from "@/components/GymRegistrationForm";

export const metadata: Metadata = {
  title: "Register your gym",
  description:
    "Register your gym or club on CLBY. Submit your details, we review them, and your gym goes live in the CLBY member app with your own admin dashboard.",
  alternates: { canonical: "/register" },
};

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-ink text-canvas">
      <nav className="border-b border-canvas/10">
        <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="CLBY" className="h-9 w-9 object-contain" />
            <span className="font-sans font-black text-xl leading-none tracking-tight text-canvas">CLBY</span>
          </a>
          <a href="/" className="inline-flex items-center gap-1.5 text-sm text-canvas/70 hover:text-canvas transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to site
          </a>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-10 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
        <aside className="lg:col-span-4">
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-entry animate-blink" />
            Register your gym
          </div>
          <h1 className="font-display text-display-md mb-5">Bring your gym to CLBY.</h1>
          <p className="text-canvas/70 leading-relaxed mb-8">
            Takes about three minutes. Our team reviews every request before it goes live, so your members only
            ever see real, verified gyms.
          </p>
          <ul className="space-y-3 text-sm text-canvas/80">
            {[
              "Your gym listed in the CLBY member app",
              "Admin dashboard for members, classes and payments",
              "Secure setup link emailed once you're approved",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-entry mt-0.5 flex-shrink-0" /> {t}
              </li>
            ))}
          </ul>
        </aside>

        <section className="lg:col-span-8">
          <GymRegistrationForm />
        </section>
      </div>
    </main>
  );
}
