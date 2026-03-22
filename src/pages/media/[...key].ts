import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import {
	buildPublicImageHeaders,
	getMediaContentTypeForKey,
} from "@/lib/media";
import { sanitizeMediaKey } from "@/lib/security";

export const GET: APIRoute = async ({ params }) => {
	const key = sanitizeMediaKey(params.key ?? "");
	if (!key) {
		return new Response(null, { status: 404 });
	}

	const contentType = getMediaContentTypeForKey(key);
	if (!contentType) {
		return new Response(null, { status: 404 });
	}

	try {
		const object = await env.MEDIA_BUCKET.get(key);
		if (!object) {
			return new Response(null, { status: 404 });
		}

		return new Response(object.body, {
			headers: buildPublicImageHeaders(contentType),
		});
	} catch {
		return new Response(null, { status: 404 });
	}
};
