import { marked, type Tokens } from "marked";

const POST_STATUS_VALUES = ["draft", "published", "scheduled"] as const;
const SAFE_URL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export type PostStatus = (typeof POST_STATUS_VALUES)[number];

export function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

export function escapeAttribute(value: string): string {
	return escapeHtml(value).replaceAll("`", "&#96;");
}

export function escapeTextarea(value: string): string {
	return escapeHtml(value);
}

export function encodeRouteParam(value: string): string {
	return encodeURIComponent(value);
}

export function decodeRouteParam(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

export function sanitizeSlug(value: unknown): string | null {
	const normalized = String(value ?? "")
		.trim()
		.toLowerCase();

	if (!normalized || !/^[a-z0-9-]+$/.test(normalized)) {
		return null;
	}

	return normalized;
}

export function buildUrlSlug(
	value: unknown,
	options?: { fallbackPrefix?: string; maxLength?: number },
): string {
	const fallbackPrefix =
		sanitizeSlug(options?.fallbackPrefix || "post") || "post";
	const maxLength = Math.max(8, options?.maxLength ?? 120);
	const normalized = String(value ?? "")
		.normalize("NFKD")
		.replaceAll(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-+|-+$/g, "");

	if (!normalized) {
		const fallback = `${fallbackPrefix}-${crypto.randomUUID().slice(0, 8)}`;
		return fallback.slice(0, maxLength);
	}

	return (
		normalized.slice(0, maxLength).replaceAll(/-+$/g, "") || fallbackPrefix
	);
}

export function sanitizePostStatus(value: unknown): PostStatus | null {
	const normalized = String(value ?? "").trim();
	return POST_STATUS_VALUES.includes(normalized as PostStatus)
		? (normalized as PostStatus)
		: null;
}

export function parseOptionalPositiveInt(value: unknown): number | null {
	if (value === null || value === undefined || value === "") {
		return null;
	}

	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseTagIds(value: unknown): number[] {
	const raw = String(value ?? "");
	const seen = new Set<number>();

	for (const part of raw.split(",")) {
		const parsed = Number(part);
		if (Number.isInteger(parsed) && parsed > 0) {
			seen.add(parsed);
		}
	}

	return [...seen];
}

export function sanitizeCanonicalUrl(value: unknown): string | null {
	const normalized = String(value ?? "").trim();
	if (!normalized) {
		return null;
	}

	try {
		const url = new URL(normalized);
		return SAFE_URL_PROTOCOLS.has(url.protocol) ? url.toString() : null;
	} catch {
		return null;
	}
}

export function sanitizeMediaKey(value: unknown): string | null {
	const normalized = String(value ?? "").trim();
	if (!normalized) {
		return null;
	}

	return /^[a-zA-Z0-9/_\-.]+$/.test(normalized) ? normalized : null;
}

export function sanitizePlainText(
	value: unknown,
	maxLength: number,
	options?: { allowNewlines?: boolean; trim?: boolean },
): string {
	const normalized = String(value ?? "");
	const trimmed = options?.trim === false ? normalized : normalized.trim();
	const withoutControlChars = options?.allowNewlines
		? trimmed.replaceAll(/\r/g, "")
		: trimmed.replaceAll(/[\r\n\t]+/g, " ");

	return withoutControlChars.slice(0, maxLength);
}

export function normalizeDisplayStatus(value: string): PostStatus {
	const normalized = sanitizePostStatus(value);
	return normalized ?? "draft";
}

export function getPostStatusLabel(value: string): string {
	switch (normalizeDisplayStatus(value)) {
		case "published":
			return "已发布";
		case "scheduled":
			return "定时发布";
		default:
			return "草稿";
	}
}

export function buildProtectedAssetHeaders(contentType: string) {
	return {
		"Content-Type": contentType,
		"Cache-Control": "private, no-store, max-age=0",
		Pragma: "no-cache",
		Vary: "Cookie",
		"X-Content-Type-Options": "nosniff",
	};
}

function sanitizeUrl(
	href: string | null | undefined,
	options?: { allowMailto?: boolean },
): string | null {
	if (!href) {
		return null;
	}

	const normalized = href.trim();
	if (!normalized) {
		return null;
	}

	if (normalized.startsWith("/")) {
		return normalized.startsWith("//") ? null : normalized;
	}

	if (
		normalized.startsWith("./") ||
		normalized.startsWith("../") ||
		normalized.startsWith("#")
	) {
		return normalized;
	}

	try {
		const url = new URL(normalized);
		if (url.protocol === "mailto:" && !options?.allowMailto) {
			return null;
		}

		return SAFE_URL_PROTOCOLS.has(url.protocol) ? url.toString() : null;
	} catch {
		return null;
	}
}

interface DetailsShortcodeBlock {
	placeholder: string;
	summary: string;
	content: string;
}

interface SpoilerShortcodeBlock {
	placeholder: string;
	content: string;
}

function extractDetailsShortcodes(markdown: string): {
	markdown: string;
	blocks: DetailsShortcodeBlock[];
} {
	const pattern =
		/\[details(?:=(?:"([^"\n]*)"|'([^'\n]*)'|([^\]\n]+)))?\]([\s\S]*?)\[\/details\]/giu;
	let index = 0;
	const blocks: DetailsShortcodeBlock[] = [];

	const markdownWithPlaceholders = markdown.replace(
		pattern,
		(
			_match,
			doubleQuotedSummary,
			singleQuotedSummary,
			plainSummary,
			content,
		) => {
			const summarySource =
				doubleQuotedSummary ?? singleQuotedSummary ?? plainSummary ?? "";
			const summary = String(summarySource).trim() || "详情";
			const cleanedContent = String(content ?? "")
				.replaceAll(/\r/g, "")
				.replace(/^\n/u, "")
				.replace(/\n$/u, "");
			const placeholder = `@@DETAILS_BLOCK_${index}@@`;

			blocks.push({
				placeholder,
				summary,
				content: cleanedContent,
			});

			index += 1;
			return `\n\n${placeholder}\n\n`;
		},
	);

	return {
		markdown: markdownWithPlaceholders,
		blocks,
	};
}

function extractSpoilerShortcodes(markdown: string): {
	markdown: string;
	blocks: SpoilerShortcodeBlock[];
} {
	const pattern = /\[spoiler\]([\s\S]*?)\[\/spoiler\]/giu;
	let index = 0;
	const blocks: SpoilerShortcodeBlock[] = [];

	const markdownWithPlaceholders = markdown.replace(
		pattern,
		(_match, content) => {
			const cleanedContent = String(content ?? "").replaceAll(/\r/g, "");
			const placeholder = `@@SPOILER_BLOCK_${index}@@`;

			blocks.push({
				placeholder,
				content: cleanedContent,
			});

			index += 1;
			return placeholder;
		},
	);

	return {
		markdown: markdownWithPlaceholders,
		blocks,
	};
}

function escapeRegExp(value: string): string {
	return value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function renderSafeMarkdown(markdown: string): Promise<string> {
	return renderSafeMarkdownInternal(markdown, 0);
}

async function renderSafeMarkdownInternal(
	markdown: string,
	depth: number,
): Promise<string> {
	if (depth > 5) {
		return escapeHtml(markdown);
	}

	const renderer = new marked.Renderer();

	renderer.html = (token: Tokens.HTML | Tokens.Tag) => {
		return escapeHtml(token?.text ?? token?.raw ?? "");
	};

	renderer.link = function (token: Tokens.Link) {
		const text = this.parser.parseInline(token.tokens ?? []);
		const href = sanitizeUrl(token.href, { allowMailto: true });

		if (!href) {
			return text;
		}

		const title = token.title
			? ` title="${escapeAttribute(String(token.title))}"`
			: "";

		return `<a href="${escapeAttribute(href)}"${title} rel="nofollow ugc noopener noreferrer">${text}</a>`;
	};

	renderer.image = (token: Tokens.Image) => {
		const href = sanitizeUrl(token.href);
		if (!href) {
			return escapeHtml(String(token.text ?? ""));
		}

		const title = token.title
			? ` title="${escapeAttribute(String(token.title))}"`
			: "";

		return `<img src="${escapeAttribute(href)}" alt="${escapeAttribute(String(token.text ?? ""))}"${title} loading="lazy" decoding="async" />`;
	};

	const extracted = extractDetailsShortcodes(markdown);
	const extractedSpoilers = extractSpoilerShortcodes(extracted.markdown);
	const rendered = marked.parse(extractedSpoilers.markdown, {
		gfm: true,
		breaks: true,
		renderer,
	});
	let html = typeof rendered === "string" ? rendered : await rendered;

	for (const block of extractedSpoilers.blocks) {
		const spoilerHtml = `<span class="prose-spoiler">${escapeHtml(block.content).replaceAll("\n", "<br>")}</span>`;
		const placeholderPattern = escapeRegExp(block.placeholder);
		html = html.replaceAll(new RegExp(placeholderPattern, "gu"), spoilerHtml);
	}

	for (const block of extracted.blocks) {
		const innerHtml = await renderSafeMarkdownInternal(
			block.content,
			depth + 1,
		);
		const detailsHtml = `<details class="prose-details"><summary>${escapeHtml(block.summary)}</summary>${innerHtml}</details>`;
		const placeholderPattern = escapeRegExp(block.placeholder);

		html = html.replaceAll(
			new RegExp(`<p>${placeholderPattern}</p>\\n?`, "gu"),
			detailsHtml,
		);
		html = html.replaceAll(new RegExp(placeholderPattern, "gu"), detailsHtml);
	}

	return html;
}
