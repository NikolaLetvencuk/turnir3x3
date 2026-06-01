import type { MetadataRoute } from "next";

// Served at /robots.txt — tells crawlers everything is open and points them
// at the sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://turnir3x3.vercel.app/sitemap.xml",
    host: "https://turnir3x3.vercel.app",
  };
}
