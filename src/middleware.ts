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
			// 文章详情页同样缓存 300 秒，大幅降低 D1 查询压力和导航延迟
			if (pathname.startsWith("/blog/")) {
				return EDGE_CACHE_TTL_SECONDS;
			}
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

	// 文章详情页不含任何影响内容的查询参数，清空 search 确保缓存命中稳定
	if (pathname.startsWith("/blog/")) {
		cacheUrl.search = "";
	}

	return cacheUrl;
}

function canUseEdgeCache(options: {
	method: string;
	isAdminPreview: boolean;
	pathname: string;
	hasAuthorization: boolean;
}): boolean {
	if (options.method !== "GET") {
		return false;
	}
	if (options.isAdminPreview || options.hasAuthorization) {
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
		// 'wasm-unsafe-eval' 须在所有非 API 页面上生效：
		// Astro ClientRouter (View Transitions) 客户端导航时不会刷新文档级 CSP，
		// 任何页面都可能成为 Pagefind WASM 的宿主文档。
		// WebAssembly.instantiate(bytes) 必须有此指令，否则 WASM 编译被 CSP 拦截。
		// 同时 ClientRouter 在页面切换时会执行内联脚本片段，未放行时会在控制台持续报错。
		const scriptSources = [
			"'self'",
			"'unsafe-inline'",
			"https://giscus.app",
			"https://challenges.cloudflare.com",
			"https://static.cloudflareinsights.com",
			"'wasm-unsafe-eval'",
		];
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
				"font-src 'self' data: https:",
				"connect-src 'self' https://giscus.app https://challenges.cloudflare.com https://static.cloudflareinsights.com https://cloudflareinsights.com",
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
			// max-age 与 s-maxage 保持一致：
			// 浏览器缓存使 Astro prefetch 预取的内容可以被 ClientRouter 的 fetch() 直接命中，
			// 避免每次导航都需要服务器往返，彻底消除点击延迟。
			const cacheControl = `public, s-maxage=${edgeCacheTtl}, max-age=${edgeCacheTtl}, stale-while-revalidate=86400`;
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
