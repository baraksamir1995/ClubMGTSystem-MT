/**
 * Client logos managed in super-admin (`client-logos` endpoint).
 *
 * The Coolify build box cannot reach the API, so callers must not be
 * prerendered: `revalidate` alone still renders at build time, which bakes
 * an empty list into `/` and then serves that cached empty page forever.
 * Callers use `noStore()` to render per request, while `unstable_cache`
 * keeps the actual API call down to once an hour, so a logo added in
 * super-admin shows up within the hour without a redeploy.
 *
 * Returns [] when there are no logos or the API is down.
 */
import { unstable_cache } from "next/cache";

export type ClientLogo = {
  id: string;
  name: string;
  logo_url: string;
  website_url: string | null;
};

export const getClientLogos = unstable_cache(
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
