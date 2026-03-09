import type { Context } from "hono";
import { Hono } from "hono";
import { sanitizeCanonicalUrl, sanitizePlainText } from "@/lib/security";
import type { AdminAppEnv } from "../middleware/auth";

const publicAnalyticsRoutes = new Hono<AdminAppEnv>();

const SESSION_ID_PATTERN = /^[a-z0-9_-]{16,64}$/i;
const MAX_BODY_LENGTH = 8192;
const EVENT_TYPE = "page_view";

interface TrackPayload {
	sessionId: string;
	pageUrl: string;
	pageTitle: string | null;
	referrer: string | null;
	utmSource: string | null;
	utmMedium: string | null;
	utmCampaign: string | null;
	touchSession: boolean;
}

function parseBoolean(value: unknown): boolean {
	if (typeof value === "boolean") {
		return value;
	}

	if (typeof value === "string") {
		return value === "1" || value.toLowerCase() === "true";
	}

	return false;
}

function normalizeReferrer(value: unknown, requestUrl: URL): string | null {
	const raw = sanitizePlainText(value, 2048);
	if (!raw) {
		return null;
	}

	try {
		const parsed = new URL(raw, requestUrl.origin);
		return sanitizeCanonicalUrl(parsed.toString());
	} catch {
		return null;
	}
}

function normalizePageUrl(value: unknown, requestUrl: URL): string | null {
	const raw = sanitizePlainText(value, 2048);
	if (!raw) {
		return null;
	}

	try {
		const parsed = new URL(raw, requestUrl.origin);
		const normalized = `${parsed.pathname}${parsed.search}`;
		return sanitizePlainText(normalized, 512);
	} catch {
		return null;
	}
}

function parseTrackPayload(body: string, requestUrl: URL): TrackPayload | null {
	if (!body || body.length > MAX_BODY_LENGTH) {
		return null;
	}

	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(body) as Record<string, unknown>;
	} catch {
		return null;
	}

	const sessionId = sanitizePlainText(parsed.sessionId, 64).toLowerCase();
	if (!SESSION_ID_PATTERN.test(sessionId)) {
		return null;
	}

	const pageUrl = normalizePageUrl(parsed.pageUrl, requestUrl);
	if (!pageUrl) {
		return null;
	}

	const pageTitle = sanitizePlainText(parsed.pageTitle, 160) || null;
	const referrer = normalizeReferrer(parsed.referrer, requestUrl);
	const utmSource = sanitizePlainText(parsed.utmSource, 80) || null;
	const utmMedium = sanitizePlainText(parsed.utmMedium, 80) || null;
	const utmCampaign = sanitizePlainText(parsed.utmCampaign, 120) || null;

	return {
		sessionId,
		pageUrl,
		pageTitle,
		referrer,
		utmSource,
		utmMedium,
		utmCampaign,
		touchSession: parseBoolean(parsed.touchSession),
	};
}

function parseDeviceType(userAgent: string): string {
	const normalized = userAgent.toLowerCase();
	if (
		normalized.includes("ipad") ||
		normalized.includes("tablet") ||
		(normalized.includes("android") && !normalized.includes("mobile"))
	) {
		return "tablet";
	}

	if (
		normalized.includes("mobile") ||
		normalized.includes("iphone") ||
		normalized.includes("ipod")
	) {
		return "mobile";
	}

	return "desktop";
}

function parseBrowser(userAgent: string): string {
	const normalized = userAgent.toLowerCase();
	if (normalized.includes("opr/") || normalized.includes("opera/"))
		return "Opera";
	if (normalized.includes("edg/")) return "Edge";
	if (normalized.includes("firefox/")) return "Firefox";
	if (normalized.includes("safari/") && !normalized.includes("chrome/"))
		return "Safari";
	if (normalized.includes("chrome/")) return "Chrome";
	return "Other";
}

function parseOs(userAgent: string): string {
	const normalized = userAgent.toLowerCase();
	if (normalized.includes("windows")) return "Windows";
	if (normalized.includes("mac os")) return "macOS";
	if (normalized.includes("android")) return "Android";
	if (normalized.includes("iphone") || normalized.includes("ipad"))
		return "iOS";
	if (normalized.includes("linux")) return "Linux";
	return "Other";
}

async function hashIp(ip: string | null): Promise<string | null> {
	if (!ip) {
		return null;
	}

	const normalized = ip.trim();
	if (!normalized) {
		return null;
	}

	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(normalized),
	);
	const hash = Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
	return hash.slice(0, 32);
}

function isSameOriginRequest(c: Context<AdminAppEnv>) {
	const origin = c.req.header("origin");
	if (!origin) {
		return true;
	}

	try {
		const originUrl = new URL(origin);
		const requestUrl = new URL(c.req.url);
		return originUrl.origin === requestUrl.origin;
	} catch {
		return false;
	}
}

const UPSERT_SESSION_SQL = `
INSERT INTO analytics_sessions (
	session_id,
	ip_hash,
	country,
	region,
	city,
	user_agent,
	browser,
	os,
	device_type,
	referrer,
	utm_source,
	utm_medium,
	utm_campaign,
	landing_page,
	started_at,
	last_seen_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
ON CONFLICT(session_id) DO UPDATE SET
	ip_hash = excluded.ip_hash,
	country = excluded.country,
	region = excluded.region,
	city = excluded.city,
	user_agent = excluded.user_agent,
	browser = excluded.browser,
	os = excluded.os,
	device_type = excluded.device_type,
	referrer = excluded.referrer,
	utm_source = excluded.utm_source,
	utm_medium = excluded.utm_medium,
	utm_campaign = excluded.utm_campaign,
	last_seen_at = datetime('now')
`;

const INSERT_EVENT_SQL = `
INSERT INTO analytics_events (
	session_id,
	event_type,
	page_url,
	page_title,
	event_data,
	timestamp
) VALUES (?, ?, ?, ?, ?, datetime('now'))
`;

publicAnalyticsRoutes.post("/track", async (c) => {
	if (!isSameOriginRequest(c)) {
		return c.json({ error: "非法来源请求" }, 403);
	}

	const body = await c.req.text();
	const requestUrl = new URL(c.req.url);
	const payload = parseTrackPayload(body, requestUrl);
	if (!payload) {
		return c.json({ error: "无效的统计上报数据" }, 400);
	}

	const userAgent = sanitizePlainText(c.req.header("user-agent"), 255);
	const cf = (
		c.req.raw as Request & {
			cf?: { country?: string; region?: string; city?: string };
		}
	).cf as
		| {
				country?: string;
				region?: string;
				city?: string;
		  }
		| undefined;
	const country = sanitizePlainText(cf?.country, 16) || null;
	const region = sanitizePlainText(cf?.region, 80) || null;
	const city = sanitizePlainText(cf?.city, 80) || null;
	const browser = parseBrowser(userAgent);
	const os = parseOs(userAgent);
	const deviceType = parseDeviceType(userAgent);
	const ipHash = await hashIp(c.req.header("CF-Connecting-IP") || null);

	try {
		if (payload.touchSession) {
			await c.env.DB.prepare(UPSERT_SESSION_SQL)
				.bind(
					payload.sessionId,
					ipHash,
					country,
					region,
					city,
					userAgent || null,
					browser,
					os,
					deviceType,
					payload.referrer,
					payload.utmSource,
					payload.utmMedium,
					payload.utmCampaign,
					payload.pageUrl,
				)
				.run();
		}

		const eventData = JSON.stringify({
			referrer: payload.referrer,
			utmSource: payload.utmSource,
			utmMedium: payload.utmMedium,
			utmCampaign: payload.utmCampaign,
		});

		await c.env.DB.prepare(INSERT_EVENT_SQL)
			.bind(
				payload.sessionId,
				EVENT_TYPE,
				payload.pageUrl,
				payload.pageTitle,
				eventData,
			)
			.run();
	} catch (error) {
		console.error("analytics_track_failed", error);
		return c.json({ error: "统计写入失败" }, 503);
	}

	return c.body(null, 204);
});

export { publicAnalyticsRoutes };
