import { type Context, Hono } from "hono";
import { blogPosts, webMentions } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getPublicPostBySlugCondition } from "@/lib/public-content";
import { sanitizeCanonicalUrl, sanitizePlainText } from "@/lib/security";
import { siteConfig } from "@/lib/types";
import type { AdminAppEnv } from "../middleware/auth";

const webmentionRoutes = new Hono<AdminAppEnv>();
const targetOrigin = new URL(siteConfig.url).origin;
const allowedStaticTargets = new Set(["/", "/blog", "/friends", "/search"]);

function getBodyText(body: Record<string, unknown>, key: string): string {
	const value = body[key];
	if (Array.isArray(value)) {
		const firstText = value.find(
			(item): item is string => typeof item === "string",
		);
		return firstText?.trim() ?? "";
	}

	return typeof value === "string" ? value.trim() : "";
}

function normalizePathname(pathname: string): string {
	if (!pathname || pathname === "/") {
		return "/";
	}

	return pathname.replace(/\/+$/u, "") || "/";
}

function resolveBlogSlug(pathname: string): string | null {
	const match = pathname.match(/^\/blog\/([^/]+)$/u);
	if (!match?.[1]) {
		return null;
	}

	try {
		return decodeURIComponent(match[1]);
	} catch {
		return null;
	}
}

function escapeRegExp(value: string): string {
	return value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isPrivateIpv4(hostname: string): boolean {
	const parts = hostname.split(".").map((part) => Number(part));
	if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
		return false;
	}

	const [a, b] = parts;
	if (a === 10 || a === 127 || a === 0) {
		return true;
	}

	if (a === 169 && b === 254) {
		return true;
	}

	if (a === 172 && b >= 16 && b <= 31) {
		return true;
	}

	return a === 192 && b === 168;
}

function isBlockedSourceHost(hostname: string): boolean {
	const normalized = hostname.toLowerCase();
	if (!normalized) {
		return true;
	}

	if (
		normalized === "localhost" ||
		normalized.endsWith(".local") ||
		normalized.endsWith(".internal")
	) {
		return true;
	}

	if (isPrivateIpv4(normalized)) {
		return true;
	}

	if (
		normalized === "::1" ||
		normalized.startsWith("fe80:") ||
		normalized.startsWith("fc") ||
		normalized.startsWith("fd")
	) {
		return true;
	}

	return false;
}

function decodeHtmlEntities(value: string): string {
	return value
		.replaceAll("&amp;", "&")
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'")
		.replaceAll("&apos;", "'");
}

function findMetaContent(
	html: string,
	attr: "name" | "property",
	key: string,
): string | null {
	const keyPattern = escapeRegExp(key);
	const direct = new RegExp(
		`<meta\\b[^>]*\\b${attr}\\s*=\\s*["']${keyPattern}["'][^>]*\\bcontent\\s*=\\s*["']([^"']+)["'][^>]*>`,
		"iu",
	);
	const reverse = new RegExp(
		`<meta\\b[^>]*\\bcontent\\s*=\\s*["']([^"']+)["'][^>]*\\b${attr}\\s*=\\s*["']${keyPattern}["'][^>]*>`,
		"iu",
	);
	const matched = html.match(direct) || html.match(reverse);
	if (!matched?.[1]) {
		return null;
	}

	return decodeHtmlEntities(matched[1]).trim() || null;
}

function findTagText(
	html: string,
	tagName: string,
	maxLength: number,
): string | null {
	const pattern = new RegExp(
		`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
		"iu",
	);
	const matched = html.match(pattern);
	if (!matched?.[1]) {
		return null;
	}

	const stripped = decodeHtmlEntities(matched[1].replaceAll(/<[^>]+>/g, " "))
		.replaceAll(/\s+/g, " ")
		.trim();

	return sanitizePlainText(stripped, maxLength) || null;
}

function extractSourceMetadata(html: string): {
	sourceTitle: string | null;
	sourceExcerpt: string | null;
	sourceAuthor: string | null;
	sourcePublishedAt: string | null;
} {
	const sourceTitle =
		sanitizePlainText(
			findMetaContent(html, "property", "og:title") ||
				findTagText(html, "title", 180) ||
				"",
			180,
		) || null;

	const sourceExcerpt =
		sanitizePlainText(
			findMetaContent(html, "name", "description") ||
				findMetaContent(html, "property", "og:description") ||
				findTagText(html, "p", 320) ||
				"",
			320,
			{ allowNewlines: true },
		) || null;

	const sourceAuthor =
		sanitizePlainText(findMetaContent(html, "name", "author") || "", 120) ||
		null;

	const published =
		findMetaContent(html, "property", "article:published_time") ||
		findMetaContent(html, "name", "date") ||
		null;
	const sourcePublishedAt = sanitizeCanonicalDate(published);

	return {
		sourceTitle,
		sourceExcerpt,
		sourceAuthor,
		sourcePublishedAt,
	};
}

function sanitizeCanonicalDate(value: string | null): string | null {
	if (!value) {
		return null;
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return parsed.toISOString();
}

function buildTargetCandidates(targetUrl: URL): string[] {
	const normalized = targetUrl.toString();
	const withoutHash = new URL(targetUrl.toString());
	withoutHash.hash = "";
	const normalizedWithoutHash = withoutHash.toString();

	const candidates = new Set<string>([normalized, normalizedWithoutHash]);
	if (normalizedWithoutHash.endsWith("/")) {
		candidates.add(normalizedWithoutHash.replace(/\/+$/u, ""));
	} else {
		candidates.add(`${normalizedWithoutHash}/`);
	}

	return [...candidates].filter(Boolean);
}

function sourceContainsTargetLink(html: string, targetUrl: URL): boolean {
	const candidates = buildTargetCandidates(targetUrl);
	return candidates.some((candidate) => {
		const pattern = new RegExp(
			`<a\\b[^>]*\\bhref\\s*=\\s*["'][^"']*${escapeRegExp(candidate)}[^"']*["']`,
			"iu",
		);
		return pattern.test(html) || html.includes(candidate);
	});
}

async function validateTargetPath(
	c: Context<AdminAppEnv>,
	targetUrl: URL,
): Promise<boolean> {
	const normalizedPath = normalizePathname(targetUrl.pathname);
	if (allowedStaticTargets.has(normalizedPath)) {
		return true;
	}

	const blogSlug = resolveBlogSlug(normalizedPath);
	if (!blogSlug) {
		return false;
	}

	const db = getDb(c.env.DB);
	const [post] = await db
		.select({ id: blogPosts.id })
		.from(blogPosts)
		.where(getPublicPostBySlugCondition(blogSlug))
		.limit(1);

	return Boolean(post);
}

webmentionRoutes.get("/", (c) =>
	c.text("Webmention endpoint: use POST with source and target fields."),
);

webmentionRoutes.post("/", async (c) => {
	const body = await c.req.parseBody();
	const source = sanitizeCanonicalUrl(getBodyText(body, "source"));
	const target = sanitizeCanonicalUrl(getBodyText(body, "target"));

	if (!source || !target) {
		return c.text(
			"source 和 target 参数不能为空，且必须是有效的 http/https URL。",
			400,
		);
	}

	let sourceUrl: URL;
	let targetUrl: URL;
	try {
		sourceUrl = new URL(source);
		targetUrl = new URL(target);
	} catch {
		return c.text("source 或 target URL 解析失败。", 400);
	}

	if (targetUrl.origin !== targetOrigin) {
		return c.text("target 必须是本站页面。", 400);
	}

	if (isBlockedSourceHost(sourceUrl.hostname)) {
		return c.text("source 不允许使用本地或内网主机地址。", 400);
	}

	const targetPath = normalizePathname(targetUrl.pathname);
	if (targetPath.startsWith("/api/") || targetPath.startsWith("/admin")) {
		return c.text("target 不能指向后台或 API 路径。", 400);
	}

	const targetAllowed = await validateTargetPath(c, targetUrl);
	if (!targetAllowed) {
		return c.text("target 页面不存在或不在允许接收 Webmention 的范围内。", 400);
	}

	let sourceHtml = "";
	try {
		const response = await fetch(sourceUrl.toString(), {
			headers: {
				Accept: "text/html,application/xhtml+xml",
				"User-Agent": "cf-astro-blog-starter-webmention/1.0",
			},
		});
		if (!response.ok) {
			return c.text("无法访问 source 页面。", 400);
		}

		const contentType = response.headers.get("content-type") || "";
		if (
			!contentType.includes("text/html") &&
			!contentType.includes("application/xhtml+xml")
		) {
			return c.text("source 必须是 HTML 页面。", 400);
		}

		sourceHtml = await response.text();
	} catch {
		return c.text("抓取 source 页面失败。", 400);
	}

	if (!sourceContainsTargetLink(sourceHtml, targetUrl)) {
		return c.text("source 页面中未找到指向 target 的链接。", 400);
	}

	const metadata = extractSourceMetadata(sourceHtml);
	const now = new Date().toISOString();
	const db = getDb(c.env.DB);

	await db
		.insert(webMentions)
		.values({
			sourceUrl: sourceUrl.toString(),
			targetUrl: targetUrl.toString(),
			sourceTitle: metadata.sourceTitle,
			sourceExcerpt: metadata.sourceExcerpt,
			sourceAuthor: metadata.sourceAuthor,
			sourcePublishedAt: metadata.sourcePublishedAt,
			status: "pending",
			reviewNote: null,
			reviewedAt: null,
			lastCheckedAt: now,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [webMentions.sourceUrl, webMentions.targetUrl],
			set: {
				sourceTitle: metadata.sourceTitle,
				sourceExcerpt: metadata.sourceExcerpt,
				sourceAuthor: metadata.sourceAuthor,
				sourcePublishedAt: metadata.sourcePublishedAt,
				status: "pending",
				reviewNote: null,
				reviewedAt: null,
				lastCheckedAt: now,
				updatedAt: now,
			},
		});

	return c.text("Webmention 已接收，等待审核。", 202);
});

export { webmentionRoutes };
