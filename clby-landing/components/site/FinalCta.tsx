import { MessageCircle } from "lucide-react";
import { ButtonLink, Container, waLink } from "./ui";

/** Dark closing band: the one intentional high-contrast section. */
export default function FinalCta({
  base = "",
  whatsappText = "Hi CLBY, I'd like to book a demo",
  gymLabel = "your gym",
}: {
  base?: "" | "/";
  whatsappText?: string;
  gymLabel?: string;
}) {
  return (
    <section aria-labelledby="final-cta" className="on-dark relative overflow-hidden bg-dark py-24 text-on-dark lg:py-36">
      {/* Fine grid texture, decorative only */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#F7F7F2_1px,transparent_1px),linear-gradient(90deg,#F7F7F2_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
      />
      <Container className="relative text-center">
        <span aria-hidden className="mx-auto mb-10 flex h-16 w-16 items-center justify-center rounded-[18px] bg-[#0E100D] ring-1 ring-dark-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={44} height={44} />
        </span>
        <h2 id="final-cta" className="mx-auto max-w-4xl font-display text-display-xl text-on-dark">
          See CLBY on your own gym.
        </h2>
        <p className="mx-auto mt-7 max-w-2xl text-lead text-on-dark-muted">
          Book a 30-minute demo. We&apos;ll show you CLBY on {gymLabel}, not a generic one, and walk you through how it
          can work for your team.
        </p>
        <div className="mt-12 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <ButtonLink href={`${base}#demo`} variant="primary-dark" size="lg" arrow>
            Book My Demo
          </ButtonLink>
          <ButtonLink href="/register" variant="secondary-dark" size="lg">
            Register Your Gym
          </ButtonLink>
          <ButtonLink href={waLink(whatsappText)} target="_blank" rel="noopener noreferrer" variant="secondary-dark" size="lg">
            <MessageCircle className="h-5 w-5" aria-hidden /> WhatsApp Us
            <span className="sr-only">(opens in a new tab)</span>
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
