/**
 * Client-logo carousel.
 *
 * Server component: the logos come from the super-admin-managed
 * `client-logos` endpoint, cached for an hour so the landing page isn't
 * doing an API round-trip per visitor but still picks up a newly added
 * logo without a redeploy.
 *
 * The Coolify build box cannot reach the API, so this section must not be
 * prerendered: `revalidate` alone still renders at build time, which bakes
 * an empty carousel into `/` and then serves that cached empty page
 * forever — the logos would silently never appear in production.
 * `noStore()` forces the surrounding route to render per request, while
 * `unstable_cache` keeps the actual API call down to once an hour, so a
 * logo added in super-admin shows up within the hour without a redeploy.
 *
 * Renders nothing at all when there are no logos (or the API is down), so
 * an empty carousel never ships to visitors.
 */
import { unstable_cache, unstable_noStore as noStore } from "next/cache";

type ClientLogo = {
  id: string;
  name: string;
  logo_url: string;
  website_url: string | null;
};

const getLogos = unstable_cache(
  async (): Promise<ClientLogo[]> => {
    const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";
    try {
      const res = await fetch(`${BACKEND_URL}/api/client-logos`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : [];
    } catch {
      // Landing page must render even if the API is unreachable.
      return [];
    }
  },
  ["client-logos"],
  { revalidate: 3600 },
);

export default async function ClientLogos() {
  noStore();
  const logos = await getLogos();
  if (logos.length === 0) return null;

  // The marquee keyframe translates the track by -50%, so the loop is only
  // seamless if the track is exactly two identical halves. Each half needs
  // enough logos to span a wide viewport on its own — with 3 logos, one
  // half would run out mid-screen and show a gap before it wrapped — so a
  // short list is repeated up to HALF_MIN before the halves are built.
  //
  // The spacing is padding *inside* each item rather than a flex `gap`:
  // a gap sits between items only, so the seam between the two halves
  // would be one gap narrower than every other spacing and -50% would
  // land short, jerking the track sideways once per cycle.
  const HALF_MIN = 6;
  const half = Array.from(
    { length: Math.ceil(HALF_MIN / logos.length) },
    () => logos,
  ).flat();
  const track = [...half, ...half];

  return (
    <section className="py-14 md:py-20 border-y border-canvas/10 bg-ink overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-5 md:px-8 mb-10">
        <p className="text-center text-xs font-mono uppercase tracking-wider text-canvas/50">
          Trusted by organizations
        </p>
      </div>

      <div className="marquee-mask">
        <ul className="flex items-center w-max animate-marquee motion-reduce:animate-none hover:[animation-play-state:paused]">
          {track.map((logo, i) => {
            const content = (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={logo.logo_url}
                alt={logo.name}
                loading="lazy"
                className="h-10 md:h-14 w-auto max-w-[180px] object-contain opacity-60 hover:opacity-100 transition-opacity duration-300"
              />
            );

            return (
              <li
                key={`${logo.id}-${i}`}
                className="flex-shrink-0 flex items-center justify-center px-6 md:px-10"
                /* Only the first copy is real content; the rest are visual
                   duplicates and must not be announced by screen readers. */
                aria-hidden={i >= logos.length ? true : undefined}
              >
                {logo.website_url ? (
                  <a
                    href={logo.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    tabIndex={i >= logos.length ? -1 : undefined}
                    aria-label={logo.name}
                  >
                    {content}
                  </a>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
