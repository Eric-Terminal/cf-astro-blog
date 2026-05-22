import { marked, type Tokens } from "marked";
import katex from "katex";
import { emojify } from "node-emoji";

const POST_STATUS_VALUES = ["draft", "published", "scheduled"] as const;
const SAFE_HTTP_URL_PROTOCOLS = new Set(["http:", "https:"]);
const SAFE_URL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const SLUG_SEGMENT_PATTERN = /[^\p{Letter}\p{Number}]+/gu;
const SLUG_VALID_PATTERN =
	/^[\p{Letter}\p{Number}]+(?:-[\p{Letter}\p{Number}]+)*$/u;

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
	const normalized = decodeRouteParam(String(value ?? ""))
		.trim()
		.toLowerCase()
		.normalize("NFKC")
		.replaceAll(/\s+/gu, "-")
		.replaceAll(/-+/g, "-")
		.replaceAll(/^-+|-+$/g, "");

	if (!normalized || !SLUG_VALID_PATTERN.test(normalized)) {
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
		.toLowerCase()
		.normalize("NFKC")
		.replaceAll(SLUG_SEGMENT_PATTERN, "-")
		.replaceAll(/-+/g, "-")
		.replaceAll(/^-+|-+$/g, "");
	const safeSlug = sanitizeSlug(normalized);

	if (!safeSlug) {
		const fallback = `${fallbackPrefix}-${crypto.randomUUID().slice(0, 8)}`;
		return fallback.slice(0, maxLength);
	}

	const truncated = [...safeSlug].slice(0, maxLength).join("");
	return truncated.replaceAll(/-+$/g, "") || fallbackPrefix;
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
		return SAFE_HTTP_URL_PROTOCOLS.has(url.protocol) ? url.toString() : null;
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

interface MathBlock {
	placeholder: string;
	content: string;
	display: boolean;
}

interface HighlightBlock {
	placeholder: string;
	content: string;
}

interface UnderlineBlock {
	placeholder: string;
	content: string;
}

interface SubscriptBlock {
	placeholder: string;
	content: string;
}

interface SuperscriptBlock {
	placeholder: string;
	content: string;
}

interface EmojiBlock {
	placeholder: string;
	content: string;
}

interface FootnoteRef {
	placeholder: string;
	id: string;
}

interface FootnoteDef {
	id: string;
	content: string;
}

export interface MarkdownTocItem {
	id: string;
	text: string;
	level: number;
}

interface MarkdownRenderState {
	toc: MarkdownTocItem[];
	headingSlugCount: Map<string, number>;
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

function extractDisplayMath(markdown: string): {
	markdown: string;
	blocks: MathBlock[];
} {
	const pattern = /\$\$([\s\S]*?)\$\$/g;
	let index = 0;
	const blocks: MathBlock[] = [];

	const markdownWithPlaceholders = markdown.replace(pattern, (_match, content) => {
		const placeholder = `@@MATH_DISPLAY_${index}@@`;
		blocks.push({
			placeholder,
			content: String(content ?? "").trim(),
			display: true,
		});
		index += 1;
		return `\n\n${placeholder}\n\n`;
	});

	return { markdown: markdownWithPlaceholders, blocks };
}

function extractInlineMath(markdown: string): {
	markdown: string;
	blocks: MathBlock[];
} {
	const pattern = /(?<!\$)\$([^$\n]+?)\$(?!\$)/g;
	let index = 0;
	const blocks: MathBlock[] = [];

	const markdownWithPlaceholders = markdown.replace(pattern, (_match, content) => {
		const placeholder = `@@MATH_INLINE_${index}@@`;
		blocks.push({
			placeholder,
			content: String(content ?? "").trim(),
			display: false,
		});
		index += 1;
		return placeholder;
	});

	return { markdown: markdownWithPlaceholders, blocks };
}

function extractHighlight(markdown: string): {
	markdown: string;
	blocks: HighlightBlock[];
} {
	const pattern = /==([\s\S]*?)==/g;
	let index = 0;
	const blocks: HighlightBlock[] = [];

	const markdownWithPlaceholders = markdown.replace(pattern, (_match, content) => {
		const placeholder = `@@HIGHLIGHT_${index}@@`;
		blocks.push({
			placeholder,
			content: String(content ?? ""),
		});
		index += 1;
		return placeholder;
	});

	return { markdown: markdownWithPlaceholders, blocks };
}

function extractUnderline(markdown: string): {
	markdown: string;
	blocks: UnderlineBlock[];
} {
	const pattern = /\+\+([\s\S]*?)\+\+/g;
	let index = 0;
	const blocks: UnderlineBlock[] = [];

	const markdownWithPlaceholders = markdown.replace(pattern, (_match, content) => {
		const placeholder = `@@UNDERLINE_${index}@@`;
		blocks.push({
			placeholder,
			content: String(content ?? ""),
		});
		index += 1;
		return placeholder;
	});

	return { markdown: markdownWithPlaceholders, blocks };
}

function extractSubscript(markdown: string): {
	markdown: string;
	blocks: SubscriptBlock[];
} {
	// 单波浪线 ~text~ 作为下标，与 ~~strikethrough~~ 区分
	const pattern = /(?<![~])~([^~\n]+)~(?!~)/g;
	let index = 0;
	const blocks: SubscriptBlock[] = [];

	const markdownWithPlaceholders = markdown.replace(pattern, (_match, content) => {
		const placeholder = `@@SUBSCRIPT_${index}@@`;
		blocks.push({
			placeholder,
			content: String(content ?? ""),
		});
		index += 1;
		return placeholder;
	});

	return { markdown: markdownWithPlaceholders, blocks };
}

function extractSuperscript(markdown: string): {
	markdown: string;
	blocks: SuperscriptBlock[];
} {
	const pattern = /\^([^^\n]+?)\^/g;
	let index = 0;
	const blocks: SuperscriptBlock[] = [];

	const markdownWithPlaceholders = markdown.replace(pattern, (_match, content) => {
		const placeholder = `@@SUPERSCRIPT_${index}@@`;
		blocks.push({
			placeholder,
			content: String(content ?? ""),
		});
		index += 1;
		return placeholder;
	});

	return { markdown: markdownWithPlaceholders, blocks };
}

function extractEmoji(markdown: string): {
	markdown: string;
	blocks: EmojiBlock[];
} {
	const pattern = /(:[a-zA-Z0-9_+\-]+:)/g;
	let index = 0;
	const blocks: EmojiBlock[] = [];

	const markdownWithPlaceholders = markdown.replace(pattern, (_match, code) => {
		const placeholder = `@@EMOJI_${index}@@`;
		blocks.push({
			placeholder,
			content: code,
		});
		index += 1;
		return placeholder;
	});

	return { markdown: markdownWithPlaceholders, blocks };
}

function extractFootnotes(markdown: string): {
	markdown: string;
	refs: FootnoteRef[];
	defs: FootnoteDef[];
} {
	let index = 0;
	const refs: FootnoteRef[] = [];
	const defs: FootnoteDef[] = [];

	// 提取脚注定义 [^id]: content
	const defPattern = /^\[\^([^\]]+)\]:\s+([\s\S]*?)(?=\n\n|\n\[\^|$)/gm;
	const markdownWithoutDefs = markdown.replace(defPattern, (_match, id, content) => {
		defs.push({
			id: String(id ?? "").trim(),
			content: String(content ?? "").trim(),
		});
		return "";
	});

	// 提取脚注引用 [^id]
	const refPattern = /\[\^([^\]]+)\]/g;
	const markdownWithPlaceholders = markdownWithoutDefs.replace(refPattern, (_match, id) => {
		const placeholder = `@@FOOTNOTE_REF_${index}@@`;
		refs.push({
			placeholder,
			id: String(id ?? "").trim(),
		});
		index += 1;
		return placeholder;
	});

	return { markdown: markdownWithPlaceholders, refs, defs };
}

function removeTocMarkers(markdown: string): string {
	return markdown.replaceAll(/^\[TOC\]\s*$/gim, "");
}

function escapeRegExp(value: string): string {
	return value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHeadingSlug(rawText: string): string {
	const normalized = rawText
		.normalize("NFKD")
		.replaceAll(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replaceAll(/<[^>]*>/g, " ")
		.replaceAll(/&[a-zA-Z0-9#]+;/g, " ")
		.replaceAll(/[^a-z0-9\u4e00-\u9fff\s-]/g, "")
		.trim()
		.replaceAll(/\s+/g, "-")
		.replaceAll(/-+/g, "-")
		.replaceAll(/^-+|-+$/g, "");

	return normalized || "section";
}

function buildUniqueHeadingId(
	baseSlug: string,
	headingSlugCount: Map<string, number>,
): string {
	const currentCount = headingSlugCount.get(baseSlug) ?? 0;
	headingSlugCount.set(baseSlug, currentCount + 1);

	if (currentCount === 0) {
		return baseSlug;
	}

	return `${baseSlug}-${currentCount + 1}`;
}

export async function renderSafeMarkdown(markdown: string): Promise<string> {
	const rendered = await renderSafeMarkdownWithToc(markdown);
	return rendered.html;
}

export async function renderSafeMarkdownWithToc(markdown: string): Promise<{
	html: string;
	toc: MarkdownTocItem[];
}> {
	const state: MarkdownRenderState = {
		toc: [],
		headingSlugCount: new Map<string, number>(),
	};

	const html = await renderSafeMarkdownInternal(markdown, 0, state);

	return {
		html,
		toc: state.toc,
	};
}

async function renderSafeMarkdownInternal(
	markdown: string,
	depth: number,
	state: MarkdownRenderState,
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

	renderer.heading = function (token: Tokens.Heading) {
		const depthLevel = Number(token.depth);
		const level =
			Number.isInteger(depthLevel) && depthLevel >= 1 && depthLevel <= 6
				? depthLevel
				: 2;
		const headingText = sanitizePlainText(token.text ?? "", 160);
		const baseSlug = buildHeadingSlug(
			headingText || `section-${state.toc.length + 1}`,
		);
		const headingId = buildUniqueHeadingId(baseSlug, state.headingSlugCount);

		if (level >= 2 && level <= 4 && headingText) {
			state.toc.push({
				id: headingId,
				text: headingText,
				level,
			});
		}

		const innerHtml = this.parser.parseInline(token.tokens ?? []);
		return `<h${level} id="${escapeAttribute(headingId)}">${innerHtml}</h${level}>`;
	};

	// ── Typora 语法预处理管线 ──────────────────────────────────────────────
	// 顺序：先处理 $$ 再处理 $（避免冲突），然后处理 Typora 扩展语法

	// 1. 移除 [TOC] 标记（TOC 由外部独立生成）
	const noToc = removeTocMarkers(markdown);

	// 2. 数学公式（先 display math 再 inline math）
	const extractedDisplayMath = extractDisplayMath(noToc);
	const extractedInlineMath = extractInlineMath(extractedDisplayMath.markdown);

	// 3. Typora 行内扩展语法
	const extractedHighlight = extractHighlight(extractedInlineMath.markdown);
	const extractedUnderline = extractUnderline(extractedHighlight.markdown);
	// 下标（~text~）放在末尾，避免与 GFM ~~strikethrough~~ 冲突
	const extractedSuperscript = extractSuperscript(extractedUnderline.markdown);
	const extractedSubscript = extractSubscript(extractedSuperscript.markdown);

	// 4. Emoji
	const extractedEmoji = extractEmoji(extractedSubscript.markdown);

	// 5. 脚注
	const extractedFootnotes = extractFootnotes(extractedEmoji.markdown);

	// 6. 现有的短代码语法
	const extractedDetails = extractDetailsShortcodes(extractedFootnotes.markdown);
	const extractedSpoilers = extractSpoilerShortcodes(extractedDetails.markdown);

	// ── marked 渲染 ──────────────────────────────────────────────────────
	const rendered = marked.parse(extractedSpoilers.markdown, {
		gfm: true,
		breaks: true,
		renderer,
	});
	let html = typeof rendered === "string" ? rendered : await rendered;

	// ── 占位符替换 ────────────────────────────────────────────────────────

	// 替换 spoiler
	for (const block of extractedSpoilers.blocks) {
		const spoilerHtml = `<span class="prose-spoiler">${escapeHtml(block.content).replaceAll("\n", "<br>")}</span>`;
		const placeholderPattern = escapeRegExp(block.placeholder);
		html = html.replaceAll(new RegExp(placeholderPattern, "gu"), spoilerHtml);
	}

	// 替换 details
	for (const block of extractedDetails.blocks) {
		const innerHtml = await renderSafeMarkdownInternal(
			block.content,
			depth + 1,
			state,
		);
		const detailsHtml = `<details class="prose-details"><summary>${escapeHtml(block.summary)}</summary>${innerHtml}</details>`;
		const placeholderPattern = escapeRegExp(block.placeholder);

		html = html.replaceAll(
			new RegExp(`<p>${placeholderPattern}</p>\\n?`, "gu"),
			detailsHtml,
		);
		html = html.replaceAll(new RegExp(placeholderPattern, "gu"), detailsHtml);
	}

	// 替换数学公式
	for (const block of extractedDisplayMath.blocks) {
		try {
			const mathHtml = katex.renderToString(block.content, {
				displayMode: true,
				throwOnError: false,
				trust: false,
			});
			html = html.replaceAll(escapeRegExp(block.placeholder), mathHtml);
		} catch {
			html = html.replaceAll(
				escapeRegExp(block.placeholder),
				escapeHtml(block.content),
			);
		}
	}

	for (const block of extractedInlineMath.blocks) {
		try {
			const mathHtml = katex.renderToString(block.content, {
				displayMode: false,
				throwOnError: false,
				trust: false,
			});
			html = html.replaceAll(escapeRegExp(block.placeholder), mathHtml);
		} catch {
			html = html.replaceAll(
				escapeRegExp(block.placeholder),
				escapeHtml(block.content),
			);
		}
	}

	// 替换 highlight (==text== → <mark>)
	for (const block of extractedHighlight.blocks) {
		const markHtml = `<mark class="prose-mark">${escapeHtml(block.content)}</mark>`;
		html = html.replaceAll(escapeRegExp(block.placeholder), markHtml);
	}

	// 替换 underline (++text++ → <u>)
	for (const block of extractedUnderline.blocks) {
		const uHtml = `<u class="prose-underline">${escapeHtml(block.content)}</u>`;
		html = html.replaceAll(escapeRegExp(block.placeholder), uHtml);
	}

	// 替换 subscript (~text~ → <sub>)
	for (const block of extractedSubscript.blocks) {
		const subHtml = `<sub class="prose-sub">${escapeHtml(block.content)}</sub>`;
		html = html.replaceAll(escapeRegExp(block.placeholder), subHtml);
	}

	// 替换 superscript (^text^ → <sup>)
	for (const block of extractedSuperscript.blocks) {
		const supHtml = `<sup class="prose-sup">${escapeHtml(block.content)}</sup>`;
		html = html.replaceAll(escapeRegExp(block.placeholder), supHtml);
	}

	// 替换 emoji (:emoji: → 🎉)
	for (const block of extractedEmoji.blocks) {
		const emojiHtml = emojify(block.content);
		html = html.replaceAll(
			escapeRegExp(block.placeholder),
			emojiHtml,
		);
	}

	// 替换脚注引用并追加脚注列表
	if (extractedFootnotes.refs.length > 0 || extractedFootnotes.defs.length > 0) {
		const footnoteHtmlParts: string[] = [];

		for (const ref of extractedFootnotes.refs) {
			const defIndex = extractedFootnotes.defs.findIndex(
				(d) => d.id === ref.id,
			);
			if (defIndex !== -1) {
				const fnNum = defIndex + 1;
				const fnLink = `<sup class="prose-footnote-ref" id="fnref-${escapeAttribute(ref.id)}"><a href="#fn-${escapeAttribute(ref.id)}">${fnNum}</a></sup>`;
				html = html.replaceAll(escapeRegExp(ref.placeholder), fnLink);
			} else {
				html = html.replaceAll(
					escapeRegExp(ref.placeholder),
					`[${escapeHtml(ref.id)}]`,
				);
			}
		}

		if (extractedFootnotes.defs.length > 0) {
			footnoteHtmlParts.push(
				'<section class="prose-footnotes"><ol>',
			);
			for (const def of extractedFootnotes.defs) {
				const renderedDef = await renderSafeMarkdownInternal(
					def.content,
					depth + 1,
					state,
				);
				footnoteHtmlParts.push(
					`<li id="fn-${escapeAttribute(def.id)}">${renderedDef} <a class="prose-footnote-backref" href="#fnref-${escapeAttribute(def.id)}" aria-label="返回">↩</a></li>`,
				);
			}
			footnoteHtmlParts.push("</ol></section>");
		}

		html += footnoteHtmlParts.join("");
	}

	return html;
}
