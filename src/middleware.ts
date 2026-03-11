import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
	const response = await next();
	const isAdminPreview = context.url.searchParams.get("adminPreview") === "1";

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

	if (!context.url.pathname.startsWith("/api/")) {
		const frameAncestors = isAdminPreview ? "'self'" : "'none'";
		const scriptSources = [
			"'self'",
			"https://giscus.app",
			"https://challenges.cloudflare.com",
		];
		if (context.url.pathname.startsWith("/search")) {
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

	return response;
});
