import { defineMiddleware } from "astro:middleware";

const EDGE_CACHE_TTL_SECONDS = 300;

function normalizePathname(pathname: string): string {
	if (!pathname || pathname === "/") {
		return "/";
	}

	return pathname.replace(/\/+$/u, "") || "/";
}

function resolveEdgeCacheTtl(pathname: string): number {
	switch (pathname) {
		case "/":
		case "/blog":
		case "/friends":
			return EDGE_CACHE_TTL_SECONDS;
		default:
			return 0;
	}
}

function buildEdgeCacheKeyUrl(url: URL): URL {
	const cacheUrl = new URL(url.toString());
	const pathname = normalizePathname(cacheUrl.pathname);
	cacheUrl.pathname = pathname;
	cacheUrl.hash = "";

	if (pathname === "/" || pathname === "/friends") {
		cacheUrl.search = "";
		return cacheUrl;
	}

	if (pathname === "/blog") {
		const page = Number.parseInt(cacheUrl.searchParams.get("page") || "", 10);
		cacheUrl.search = "";
		if (Number.isInteger(page) && page > 1 && page <= 500) {
			cacheUrl.searchParams.set("page", String(page));
		}
	}

	return cacheUrl;
}

function canUseEdgeCache(options: {
	method: string;
	isAdminPreview: boolean;
	pathname: string;
	hasAuthorization: boolean;
	hasCookie: boolean;
}): boolean {
	if (options.method !== "GET") {
		return false;
	}
	if (options.isAdminPreview || options.hasAuthorization || options.hasCookie) {
		return false;
	}
	return resolveEdgeCacheTtl(options.pathname) > 0;
}

function getEdgeCache(): Cache | null {
	if (typeof caches === "undefined") {
		return null;
	}

	const defaultCache = (caches as unknown as { default?: Cache }).default;
	return defaultCache || null;
}

function applySecurityHeaders(
	pathname: string,
	response: Response,
	isAdminPreview: boolean,
) {
	const normalizedPath = normalizePathname(pathname);

	response.headers.set("X-Content-Type-Options", "nosniff");
	response.headers.set(
		"X-Frame-Options",
		isAdminPreview ? "SAMEORIGIN" : "DENY",
	);
	response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	response.headers.set(
		"Permissions-Policy",
		"camera=(), microphone=(), geolocation=()",
	);
	response.headers.set("Cross-Origin-Opener-Policy", "same-origin");

	if (!normalizedPath.startsWith("/api/")) {
		const frameAncestors = isAdminPreview ? "'self'" : "'none'";
		const scriptSources = [
			"'self'",
			"https://giscus.app",
			"https://challenges.cloudflare.com",
		];
		if (normalizedPath.startsWith("/search")) {
			scriptSources.push("'wasm-unsafe-eval'");
		}
		response.headers.set(
			"Content-Security-Policy",
			[
				"default-src 'self'",
				"base-uri 'self'",
				`frame-ancestors ${frameAncestors}`,
				"object-src 'none'",
				"form-action 'self'",
				`script-src ${scriptSources.join(" ")}`,
				"style-src 'self' 'unsafe-inline' https://giscus.app",
				"img-src 'self' data: https://assets.ericterminal.com",
				"font-src 'self'",
				"connect-src 'self' https://giscus.app https://challenges.cloudflare.com",
				"frame-src 'self' https://giscus.app https://challenges.cloudflare.com",
			].join("; "),
		);
	}
}

export const onRequest = defineMiddleware(async (context, next) => {
	const isAdminPreview = context.url.searchParams.get("adminPreview") === "1";
	const pathname = normalizePathname(context.url.pathname);
	const shouldUseEdgeCache = canUseEdgeCache({
		method: context.request.method.toUpperCase(),
		isAdminPreview,
		pathname,
		hasAuthorization: context.request.headers.has("authorization"),
		hasCookie: context.request.headers.has("cookie"),
	});
	const edgeCache = getEdgeCache();
	const edgeCacheTtl = resolveEdgeCacheTtl(pathname);
	const cacheKeyUrl = buildEdgeCacheKeyUrl(context.url);
	const cacheKey = new Request(cacheKeyUrl.toString(), { method: "GET" });

	if (shouldUseEdgeCache && edgeCache) {
		try {
			const cachedResponse = await edgeCache.match(cacheKey);
			if (cachedResponse) {
				const response = cachedResponse.clone();
				response.headers.set("X-Edge-Cache", "HIT");
				applySecurityHeaders(pathname, response, isAdminPreview);
				return response;
			}
		} catch {
			// 边缘缓存读取失败时回退实时渲染，避免影响主链路
		}
	}

	const response = await next();
	applySecurityHeaders(pathname, response, isAdminPreview);

	if (
		shouldUseEdgeCache &&
		edgeCache &&
		edgeCacheTtl > 0 &&
		response.status === 200 &&
		!response.headers.has("set-cookie")
	) {
		const existingCacheControl = response.headers.get("cache-control") || "";
		if (!/no-store|private/iu.test(existingCacheControl)) {
			const cacheControl = `public, s-maxage=${edgeCacheTtl}, max-age=0, stale-while-revalidate=86400`;
			response.headers.set("Cache-Control", cacheControl);
			response.headers.set("X-Edge-Cache", "MISS");

			const responseForCache = response.clone();
			responseForCache.headers.set("Cache-Control", cacheControl);
			try {
				await edgeCache.put(cacheKey, responseForCache);
			} catch {
				// 边缘缓存写入失败时忽略，避免影响正文返回
			}
		}
	}

	return response;
});
