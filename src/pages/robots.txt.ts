import type { APIRoute } from "astro";
import { siteConfig } from "@/lib/types";

const disallowPaths = ["/api/auth", "/api/admin", "/admin"];

export const GET: APIRoute = () => {
	const content = [
		"User-agent: *",
		"Allow: /",
		...disallowPaths.map((path) => `Disallow: ${path}`),
		"",
		`Sitemap: ${siteConfig.url}/sitemap.xml`,
	].join("\n");

	return new Response(content, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};
