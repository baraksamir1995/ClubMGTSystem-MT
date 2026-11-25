import { Container, SectionHeader } from "./ui";
import Reveal from "./Reveal";

/**
 * Three-step process on a timeline. Each step pairs with a real product
 * screen: the onboarding form (with its live app preview), the configured
 * admin dashboard, and the member app the gym's members get.
 */
const STEPS = [
  {
    title: "Tell us about your gym",
    body: "Share your gym details, branches, requirements, and the experience you want to offer your members.",
    image: { src: "/screens/register.webp", alt: "CLBY gym registration: gym details, logo and brand colours with a live preview of the member app", w: 1600, h: 1067, kind: "screen" as const },
  },
  {
    title: "We configure your platform",
    body: "Our team sets up your dashboard, branding, modules, and mobile app experience.",
    image: { src: "/screens/dashboard-classes.webp", alt: "CLBY dashboard: Classes & Schedule with scheduled sessions, instructors and capacity", w: 2000, h: 1250, kind: "screen" as const },
  },
  {
    title: "Launch and grow",
    body: "Start managing your gym, onboard your coaches, and give your members access to their connected experience.",
    image: { src: "/screens/m-home.webp", alt: "CLBY member app home screen with a promo banner, the member's active plan and today's classes", w: 600, h: 1305, kind: "phone" as const },
  },
];

export default function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="bg-card py-24 lg:py-32">
      <Container>
        <SectionHeader id="how-title" title="From first conversation to fully connected gym." />

        <ol className="relative mt-16 grid grid-cols-1 gap-16 lg:mt-20 lg:grid-cols-3 lg:gap-10">
          {/* Timeline rail behind the step markers (desktop). */}
          <span aria-hidden className="absolute left-0 right-0 top-[27px] hidden h-px bg-[#D9DBD3] lg:block" />

          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.title} className="relative flex h-full flex-col">
              <span className="relative z-10 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-fg font-display text-2xl text-brand ring-8 ring-card">
                {i + 1}
              </span>

              <h3 className="mt-8 font-display text-display-md text-fg">{s.title}</h3>
              <p className="mt-3 max-w-md text-body text-fg-muted lg:min-h-[5.25rem]">{s.body}</p>

              <div className="relative mt-8 aspect-[4/3] overflow-hidden rounded-card border border-line bg-page-alt">
                {s.image.kind === "screen" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.image.src}
                    alt={s.image.alt}
                    width={s.image.w}
                    height={s.image.h}
                    loading="lazy"
                    className="absolute left-[7%] top-[9%] w-[135%] max-w-none rounded-[10px] border border-line shadow-lift"
                  />
                ) : (
                  <div className="absolute left-1/2 top-[9%] w-[46%] -translate-x-1/2 rounded-[30px] bg-[#0c0d0c] p-[2.2%] shadow-lift">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.image.src} alt={s.image.alt} width={s.image.w} height={s.image.h} loading="lazy" className="block w-full rounded-[26px]" />
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
