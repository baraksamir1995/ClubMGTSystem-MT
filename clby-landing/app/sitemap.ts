import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

const geoPages = [
  // Hub
  { slug: "mena", priority: 0.9 },
  // Country pages
  { slug: "egypt", priority: 0.9 },
  { slug: "saudi-arabia", priority: 0.9 },
  { slug: "uae", priority: 0.9 },
  { slug: "kuwait", priority: 0.8 },
  { slug: "bahrain", priority: 0.8 },
  { slug: "jordan", priority: 0.8 },
  { slug: "qatar", priority: 0.8 },
  { slug: "oman", priority: 0.8 },
  { slug: "morocco", priority: 0.8 },
  { slug: "lebanon", priority: 0.8 },
  // City pages
  { slug: "cairo", priority: 0.85 },
  { slug: "riyadh", priority: 0.85 },
  { slug: "dubai", priority: 0.85 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...geoPages.map(({ slug, priority }) => ({
      url: `${SITE_URL}/${slug}`,
      changeFrequency: "monthly" as const,
      priority,
    })),
    {
      url: `${SITE_URL}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
