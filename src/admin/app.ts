import { Hono } from "hono";
import type { AdminAppEnv } from "./middleware/auth";
import { analyticsRoutes } from "./routes/analytics";
import { authRoutes } from "./routes/auth";
import { dashboardRoutes } from "./routes/dashboard";
import { mediaRoutes } from "./routes/media";
import { postsRoutes } from "./routes/posts";

const app = new Hono<AdminAppEnv>();

function applySecurityHeaders(pathname: string, response: Response) {
	response.headers.set("X-Content-Type-Options", "nosniff");
	response.headers.set("X-Frame-Options", "DENY");
	response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	response.headers.set(
		"Permissions-Policy",
		"camera=(), microphone=(), geolocation=()",
	);
	response.headers.set("Cross-Origin-Opener-Policy", "same-origin");

	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("text/html")) {
		return;
	}

	response.headers.set("Cache-Control", "no-store");

	if (pathname.startsWith("/auth")) {
		response.headers.set(
			"Content-Security-Policy",
			[
				"default-src 'self'",
				"base-uri 'self'",
				"frame-ancestors 'none'",
				"object-src 'none'",
				"form-action 'self'",
				"script-src 'self' https://challenges.cloudflare.com",
				"style-src 'self' 'unsafe-inline'",
				"img-src 'self' data:",
				"font-src 'self'",
				"connect-src 'self' https://challenges.cloudflare.com",
				"frame-src https://challenges.cloudflare.com",
			].join("; "),
		);
		return;
	}

	if (pathname.startsWith("/admin")) {
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
}

app.use("*", async (c, next) => {
	await next();
	applySecurityHeaders(c.req.path, c.res);
});

app.route("/auth", authRoutes);
app.route("/admin", dashboardRoutes);
app.route("/admin/posts", postsRoutes);
app.route("/admin/media", mediaRoutes);
app.route("/admin/analytics", analyticsRoutes);

app.get("/health", (c) =>
	c.json({ status: "ok", timestamp: new Date().toISOString() }),
);

export { app };
