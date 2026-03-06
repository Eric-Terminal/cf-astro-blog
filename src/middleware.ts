import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
	const response = await next();

	response.headers.set("X-Content-Type-Options", "nosniff");
	response.headers.set("X-Frame-Options", "DENY");
	response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	response.headers.set(
		"Permissions-Policy",
		"camera=(), microphone=(), geolocation=()",
	);
	response.headers.set("Cross-Origin-Opener-Policy", "same-origin");

	if (!context.url.pathname.startsWith("/api/")) {
		response.headers.set(
			"Content-Security-Policy",
			[
				"default-src 'self'",
				"base-uri 'self'",
				"frame-ancestors 'none'",
				"object-src 'none'",
				"form-action 'self'",
				"script-src 'self'",
				"style-src 'self' 'unsafe-inline'",
				"img-src 'self' data:",
				"font-src 'self'",
				"connect-src 'self'",
			].join("; "),
		);
	}

	return response;
});
