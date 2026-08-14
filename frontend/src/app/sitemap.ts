import { MetadataRoute } from "next";
import { TOOLS } from "../lib/toolsData";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://docflow.com";

  const staticPages = [
    "",
    "/about",
    "/pricing",
    "/contact",
    "/privacy",
    "/terms",
    "/cookies",
    "/dashboard"
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: path === "" ? 1.0 : path === "/about" || path === "/pricing" ? 0.85 : 0.8,
  }));

  // Set top 0.95 priority for all 37+ document & image tools for maximum Google search index ranking
  const toolPages = TOOLS.map((tool) => ({
    url: `${baseUrl}${tool.href}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.95,
  }));

  return [...staticPages, ...toolPages];
}
