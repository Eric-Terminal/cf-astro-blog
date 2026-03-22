import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { app } from "@/admin/app";

export const ALL: APIRoute = async (context) => {
	// Strip /api prefix since Hono routes are mounted relative
	const url = new URL(context.request.url);
	const path = url.pathname.replace(/^\/api/, "") || "/";
	const newUrl = new URL(path + url.search, url.origin);

	const request = new Request(newUrl, context.request);
	return app.fetch(request, env);
};
