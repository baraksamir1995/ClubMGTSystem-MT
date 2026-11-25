import { Check } from "lucide-react";
import { Container, SectionHeader } from "@/components/site/ui";
import Reveal from "@/components/site/Reveal";
import QuoteButton from "@/components/QuoteButton";
import type { Offering } from "@/lib/offerings";

const PLANS: {
  offering: Offering;
  label: string;
  title: string;
  description: string;
  features: string[];
}[] = [
  {
    offering: "clby_marketplace",
    label: "CLBY App",
    title: "CLBY Marketplace App",
    description:
      "List your gym on the shared CLBY consumer app and let members discover your services, explore classes, and join your gym.",
    features: [
      "Listed on the CLBY marketplace app",
      "Dedicated gym admin dashboard",
      "Unlimited members and staff",
      "Complete gym management modules",
      "Member card payments, BNPL, and Apple Pay",
      "Group sessions and classes",
      "Reports and analytics",
    ],
  },
  {
    offering: "branded_app",
    label: "Branded App",
    title: "Your Own Branded App",
    description:
      "Launch your own gym application on the App Store and Google Play, fully customized with your brand identity and built on the CLBY platform.",
    features: [
      "Your own branded iOS and Android apps",
      "Custom logo, colors, and splash screen",
      "Published under your own developer accounts",
      "Everything included in the CLBY Marketplace offering",
      "Custom onboarding and priority support",
      "Optional custom features and integrations",
    ],
  },
];

export default function Pricing({ className = "" }: { className?: string }) {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className={`scroll-mt-20 bg-page py-24 lg:py-32 ${className}`}>
      <Container>
        <SectionHeader
          id="pricing-title"
          title="Choose how your gym goes digital."
          lead="Choose how your gym wants to operate with CLBY. Both options run on the same connected platform, with solutions tailored to your business needs."
        />

        <div className="mt-14 grid grid-cols-1 gap-6 lg:mt-16 lg:grid-cols-2 lg:gap-8">
          {PLANS.map((plan) => {
            return (
              <Reveal key={plan.offering} className="h-full">
                <article
                  aria-labelledby={`plan-${plan.offering}`}
                  className="flex h-full flex-col overflow-hidden rounded-[24px] border border-line bg-card shadow-card"
                >
                  <div className="border-b border-line bg-[#FBFBF8] p-8 lg:p-11">
                    <p className="text-[15px] font-medium text-fg-muted">{plan.label}</p>
                    <h3 id={`plan-${plan.offering}`} className="mt-2 font-display text-[clamp(2rem,1.5rem+1.4vw,2.625rem)] leading-[1.08] tracking-[-0.02em] text-fg">
                      {plan.title}
                    </h3>
                    <p className="mt-4 text-body text-fg-muted lg:min-h-[5.25rem]">{plan.description}</p>
                  </div>

                  <div className="flex flex-1 flex-col p-8 lg:p-11">
                    <ul className="flex-1 divide-y divide-line">
                      {plan.features.map((item) => (
                        <li key={item} className="flex items-start gap-3.5 py-3.5 text-[17px] text-fg first:pt-0">
                          <Check aria-hidden className="mt-[3px] h-5 w-5 flex-shrink-0 text-brand-ink" strokeWidth={2.5} />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <QuoteButton offering={plan.offering} label={`Request a Quote for ${plan.title}`} />
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
