import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/session/", "/api/"],
      },
      {
        userAgent: "Googlebot",
        allow: [
          "/",
          "/mena",
          "/egypt", "/cairo",
          "/saudi-arabia", "/riyadh",
          "/uae", "/dubai",
          "/kuwait", "/bahrain", "/jordan",
          "/qatar", "/oman", "/morocco", "/lebanon",
        ],
        disallow: ["/session/", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
