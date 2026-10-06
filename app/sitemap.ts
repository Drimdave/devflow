import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
    return [
        { url: `${siteUrl}/`, changeFrequency: "monthly", priority: 1 },
        { url: `${siteUrl}/login`, changeFrequency: "yearly", priority: 0.5 },
        { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.3 },
        { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
    ];
}
