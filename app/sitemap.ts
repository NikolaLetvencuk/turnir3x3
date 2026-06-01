import type { MetadataRoute } from "next";

// Served at /sitemap.xml — the list of public pages we want Google to crawl.
// Admin/auth/fantasy-private pages are intentionally left out.
const BASE = "https://turnir3x3.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = ["", "/matches", "/standings", "/bracket", "/players", "/vesti", "/fantasy"];
  return routes.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: path === "" ? 1 : 0.7,
  }));
}
