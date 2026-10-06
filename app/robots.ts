import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [{ userAgent: "*", allow: ["/", "/login"], disallow: ["/api/", "/workflows", "/home", "/templates", "/settings"] }],
        sitemap: `${siteUrl}/sitemap.xml`,
    };
}
