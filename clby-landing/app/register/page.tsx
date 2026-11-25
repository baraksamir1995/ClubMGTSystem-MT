import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import GymRegistrationForm from "@/components/GymRegistrationForm";
import { Logo } from "@/components/site/ui";

export const metadata: Metadata = {
  title: "Register your gym",
  description:
    "Register your gym or club on CLBY. Submit your details, we review them, and your gym goes live in the CLBY member app with your own admin dashboard.",
  alternates: { canonical: "/register" },
};

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-page text-fg">
      <nav className="border-b border-line">
        <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <Logo />
          </a>
          <a href="/" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to site
          </a>
        </div>
      </nav>

      <div className="max-w-[1440px] mx-auto px-5 md:px-8 py-10 md:py-14">
        <GymRegistrationForm />
      </div>
    </main>
  );
}
