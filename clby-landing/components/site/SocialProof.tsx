import { unstable_noStore as noStore } from "next/cache";
import { getClientLogos } from "@/components/ClientLogos";
import { PROOF_METRICS, TESTIMONIALS } from "@/lib/proof";
import { Container, SectionHeader } from "./ui";

/**
 * Trust section built only from verified data: client logos from
 * super-admin, plus metrics/testimonials from lib/proof.ts (empty until
 * real, approved data exists). Renders nothing when there's nothing real.
 *
 * Logos sit in white tiles: logos uploaded for the old dark site may be
 * light-on-transparent and should be re-uploaded in a light-safe version.
 */
export default async function SocialProof() {
  noStore();
  const logos = await getClientLogos();
  if (!logos.length && !PROOF_METRICS.length && !TESTIMONIALS.length) return null;

  return (
    <section aria-labelledby="proof-title" className="bg-page-alt py-24 lg:py-32">
      <Container>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)] lg:gap-20">
          <div>
            <SectionHeader id="proof-title" title="Built for the way gyms actually operate." />
            {logos.length > 0 && (
              <p className="mt-6 max-w-md text-lead text-fg-muted">Gyms and clubs running their memberships, classes and check-ins on CLBY.</p>
            )}
          </div>

          <div className="space-y-12">
            {PROOF_METRICS.length > 0 && (
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-4">
                {PROOF_METRICS.map((m) => (
                  <div key={m.label} className="flex flex-col bg-card p-6">
                    <dt className="mt-2 text-[15px] text-fg-muted">{m.label}</dt>
                    <dd className="order-first font-display text-[2.5rem] leading-none text-fg tabular">{m.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {logos.length > 0 && (
              <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-3">
                {logos.map((logo) => {
                  const img = (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo.logo_url} alt={logo.name} loading="lazy" className="max-h-16 w-auto max-w-[170px] object-contain" />
                  );
                  return (
                    <li key={logo.id} className="flex h-36 items-center justify-center bg-card px-6">
                      {logo.website_url ? (
                        <a href={logo.website_url} target="_blank" rel="noopener noreferrer" className="rounded-control" aria-label={`${logo.name} (opens in a new tab)`}>
                          {img}
                        </a>
                      ) : img}
                    </li>
                  );
                })}
                {/* Blank tiles complete the last row: 2 columns on phones, 3 from sm. */}
                {Array.from({ length: (2 - (logos.length % 2)) % 2 }, (_, i) => (
                  <li key={`pad2-${i}`} aria-hidden className="bg-card sm:hidden" />
                ))}
                {Array.from({ length: (3 - (logos.length % 3)) % 3 }, (_, i) => (
                  <li key={`pad3-${i}`} aria-hidden className="hidden bg-card sm:block" />
                ))}
              </ul>
            )}

            {TESTIMONIALS.length > 0 && (
              <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {TESTIMONIALS.map((t) => (
                  <li key={t.name}>
                    <figure className="flex h-full flex-col rounded-card border border-line bg-card p-8">
                      <blockquote className="font-display text-[1.5rem] leading-snug text-fg">“{t.quote}”</blockquote>
                      <figcaption className="mt-auto pt-6 text-[15px] text-fg-muted">
                        <span className="font-semibold text-fg">{t.name}</span>, {t.role}, {t.gym}
                      </figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
