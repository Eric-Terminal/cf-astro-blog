import {
	isOpenAICompatibleEndpointReady,
	type OpenAICompatibleEndpointConfig,
	requestOpenAICompatibleChatCompletion,
} from "@/lib/openai-compatible";
import { type PostStatus, sanitizePlainText } from "@/lib/security";

const MAX_CONTENT_CHARS = 12_000;
const SEO_COMPLETION_MAX_TOKENS = 1_200;
const ERROR_RESPONSE_SNIPPET_LENGTH = 480;
const EXCERPT_MAX_CHARS = 88;

interface GeneratedSeoPayload {
	excerpt?: unknown;
	metaTitle?: unknown;
	metaDescription?: unknown;
	metaKeywords?: unknown;
}

interface GeneratedSeoResponse {
	payload: GeneratedSeoPayload | null;
	rawResponse: string;
}

export interface GeneratedPostSeoFields {
	excerpt: string | null;
	metaTitle: string | null;
	metaDescription: string | null;
	metaKeywords: string | null;
}

export interface PostSeoFields {
	title: string;
	content: string;
	status: PostStatus;
	excerpt: string | null;
	metaTitle: string | null;
	metaDescription: string | null;
	metaKeywords: string | null;
}

function shouldGenerateForStatus(status: PostStatus) {
	return status === "published" || status === "scheduled";
}

function hasMissingSeoFields(input: PostSeoFields) {
	return !(
		input.excerpt?.trim() &&
		input.metaTitle?.trim() &&
		input.metaDescription?.trim() &&
		input.metaKeywords?.trim()
	);
}

function compactMarkdownForPrompt(value: string) {
	return String(value)
		.replaceAll(/```[\s\S]*?```/g, " ")
		.replaceAll(/`[^`]*`/g, " ")
		.replaceAll(/\[([^\]]+)]\(([^)]+)\)/g, "$1")
		.replaceAll(/!\[[^\]]*]\([^)]*\)/g, " ")
		.replaceAll(/[*_~>#-]+/g, " ")
		.replaceAll(/\r/g, "")
		.replaceAll(/\n+/g, "\n")
		.trim()
		.slice(0, MAX_CONTENT_CHARS);
}

function extractJsonObject(content: string): Record<string, unknown> | null {
	function parseJsonObject(value: string): Record<string, unknown> | null {
		try {
			const parsed = JSON.parse(value);
			return parsed && typeof parsed === "object"
				? (parsed as Record<string, unknown>)
				: null;
		} catch {
			return null;
		}
	}

	function repairMalformedJson(value: string): string {
		let result = "";
		let inString = false;
		let escaped = false;

		for (const char of value) {
			if (!inString) {
				if (char === '"') {
					inString = true;
				}
				result += char;
				continue;
			}

			if (escaped) {
				result += char;
				escaped = false;
				continue;
			}

			if (char === "\\") {
				result += char;
				escaped = true;
				continue;
			}

			if (char === '"') {
				inString = false;
				result += char;
				continue;
			}

			// 部分模型会直接输出原始换行或制表符，导致 JSON 非法，这里做最小修复。
			if (char === "\n") {
				result += "\\n";
				continue;
			}
			if (char === "\r") {
				continue;
			}
			if (char === "\t") {
				result += "\\t";
				continue;
			}

			result += char;
		}

		return result;
	}

	function parseJsonObjectWithRepair(
		value: string,
	): Record<string, unknown> | null {
		const direct = parseJsonObject(value);
		if (direct) {
			return direct;
		}

		const repaired = repairMalformedJson(value);
		const repairedParsed = parseJsonObject(repaired);
		if (repairedParsed) {
			return repairedParsed;
		}

		const withoutTrailingCommas = repaired.replaceAll(/,\s*([}\]])/g, "$1");
		if (withoutTrailingCommas !== repaired) {
			return parseJsonObject(withoutTrailingCommas);
		}

		return null;
	}

	const normalized = content.trim();
	if (!normalized) {
		return null;
	}

	const parsedDirect = parseJsonObjectWithRepair(normalized);
	if (parsedDirect) {
		return parsedDirect;
	}

	const withoutFence = normalized
		.replace(/^```(?:json)?\s*/iu, "")
		.replace(/```$/u, "")
		.trim();
	const start = withoutFence.indexOf("{");
	const end = withoutFence.lastIndexOf("}");
	if (start < 0 || end <= start) {
		return null;
	}

	return parseJsonObjectWithRepair(withoutFence.slice(start, end + 1));
}

function normalizeKeywords(value: unknown): string | null {
	const rawItems = Array.isArray(value)
		? value
		: String(value ?? "").split(/[\n,，]/u);
	const keywords = [
		...new Set(
			rawItems
				.map((item) => sanitizePlainText(item, 24))
				.filter((item) => Boolean(item)),
		),
	].slice(0, 12);
	if (keywords.length === 0) {
		return null;
	}

	return sanitizePlainText(keywords.join(", "), 200);
}

function normalizeGeneratedSeoFields(
	generated: GeneratedSeoPayload,
): GeneratedPostSeoFields {
	const excerpt = normalizeGeneratedExcerpt(generated.excerpt);
	const metaTitle = sanitizePlainText(generated.metaTitle, 200) || null;
	const metaDescription =
		sanitizePlainText(generated.metaDescription, 160) || null;
	const metaKeywords = normalizeKeywords(generated.metaKeywords);

	return {
		excerpt,
		metaTitle,
		metaDescription,
		metaKeywords,
	};
}

function normalizeGeneratedExcerpt(value: unknown): string | null {
	const raw =
		sanitizePlainText(value, 320, {
			allowNewlines: true,
		}) || "";
	if (!raw) {
		return null;
	}

	let excerpt = raw
		.replaceAll(/[\r\n]+/g, " ")
		.replaceAll(/\s+/g, " ")
		.trim();

	// 将常见第三人称主语改为第一人称，避免“作者/本文”口吻。
	excerpt = excerpt
		.replaceAll(
			/(作者|博主)(?=分享|记录|介绍|提到|讲述|总结|复盘|展示|完善|讨论|反思)/gu,
			"我",
		)
		.replaceAll(
			/(本文|该文|这篇文章|文章)(?=分享|记录|介绍|提到|讲述|总结|复盘|展示|完善|讨论|反思)/gu,
			"我",
		);
	excerpt = excerpt.replaceAll(/我我+/g, "我");

	if (excerpt.length > EXCERPT_MAX_CHARS) {
		const firstSentence = excerpt
			.match(/^[\s\S]{0,220}?[。！？!?]/u)?.[0]
			?.trim();
		if (firstSentence && firstSentence.length >= 18) {
			excerpt = firstSentence;
		}
	}

	return sanitizePlainText(excerpt, EXCERPT_MAX_CHARS) || null;
}

function normalizeLooseTextField(
	value: string,
	maxLength: number,
	options?: { allowNewlines?: boolean },
): string | null {
	const normalized = value
		.trim()
		.replaceAll(/^[\s"“”'`[{(]+/g, "")
		.replaceAll(/[\s"“”'`}\]),;]+$/g, "")
		.replaceAll(/\\n/g, "\n")
		.replaceAll(/\\t/g, "\t");
	return (
		sanitizePlainText(normalized, maxLength, {
			allowNewlines: options?.allowNewlines ?? false,
		}) || null
	);
}

function extractLooseGeneratedSeoPayload(
	content: string,
): GeneratedSeoPayload | null {
	const source = content
		.replace(/^```(?:json)?\s*/iu, "")
		.replace(/```$/u, "")
		.trim();
	if (!source) {
		return null;
	}

	const keyOrder = ["excerpt", "metaTitle", "metaDescription", "metaKeywords"];
	const matches = keyOrder
		.map((key) => {
			const pattern = new RegExp(`["“”']?${key}["“”']?\\s*[:：]`, "iu");
			const match = pattern.exec(source);
			return match
				? {
						key,
						index: match.index,
						valueStart: match.index + match[0].length,
					}
				: null;
		})
		.filter(
			(item): item is { key: string; index: number; valueStart: number } =>
				item !== null,
		)
		.sort((left, right) => left.index - right.index);

	if (matches.length === 0) {
		return null;
	}

	const payload: GeneratedSeoPayload = {};
	for (let index = 0; index < matches.length; index += 1) {
		const current = matches[index];
		const next = matches[index + 1];
		const rawValue = source
			.slice(current.valueStart, next ? next.index : source.length)
			.trim();
		if (!rawValue) {
			continue;
		}

		if (current.key === "metaKeywords") {
			const arrayMatch = rawValue.match(/\[([\s\S]*?)\]/u);
			if (arrayMatch) {
				payload.metaKeywords = arrayMatch[1]
					.split(/[,，\n]/u)
					.map((item) => normalizeLooseTextField(item, 24))
					.filter(Boolean);
				continue;
			}

			const keywordText = normalizeLooseTextField(rawValue, 120);
			if (keywordText) {
				payload.metaKeywords = keywordText
					.split(/[,，\n]/u)
					.map((item) => sanitizePlainText(item, 24))
					.filter(Boolean);
			}
			continue;
		}

		const maxLength =
			current.key === "excerpt"
				? 200
				: current.key === "metaDescription"
					? 160
					: 200;
		const value = normalizeLooseTextField(rawValue, maxLength, {
			allowNewlines: current.key === "excerpt",
		});
		if (!value) {
			continue;
		}

		if (current.key === "excerpt") payload.excerpt = value;
		if (current.key === "metaTitle") payload.metaTitle = value;
		if (current.key === "metaDescription") payload.metaDescription = value;
	}

	return payload;
}

async function requestGeneratedSeoPayload(
	input: { title: string; content: string },
	endpoint: OpenAICompatibleEndpointConfig,
): Promise<GeneratedSeoResponse> {
	const responseContent = await requestOpenAICompatibleChatCompletion(
		endpoint,
		[
			{
				role: "system",
				content:
					"你是中文技术博客编辑与 SEO 顾问。请基于文章标题与正文生成摘要和 SEO 字段。摘要必须使用第一人称作者口吻，语言自然，不要使用“作者/本文/该文/这篇文章”等第三人称。严格返回 JSON 对象，不要输出解释文本。",
			},
			{
				role: "user",
				content: JSON.stringify({
					task: "生成摘要与SEO",
					rules: {
						excerpt:
							"1 段第一人称中文摘要，建议 45-80 字，像作者本人在叙述，不要写“作者/本文/该文/这篇文章”",
						metaTitle: "中文 SEO 标题，建议 18-36 字",
						metaDescription: "中文 SEO 描述，建议 50-120 字",
						metaKeywords: "3-8 个关键词，数组格式",
					},
					outputSchema: {
						excerpt: "string",
						metaTitle: "string",
						metaDescription: "string",
						metaKeywords: ["string"],
					},
					article: {
						title: input.title,
						content: input.content,
					},
				}),
			},
		],
		{
			temperature: 0.2,
			maxTokens: SEO_COMPLETION_MAX_TOKENS,
			timeoutMs: 20_000,
			jsonMode: true,
		},
	);
	const parsed = extractJsonObject(responseContent);
	return {
		payload: parsed ? (parsed as GeneratedSeoPayload) : null,
		rawResponse: responseContent,
	};
}

function mergeGeneratedSeo<T extends PostSeoFields>(
	input: T,
	generated: GeneratedPostSeoFields,
): T {
	return {
		...input,
		excerpt: input.excerpt || generated.excerpt,
		metaTitle: input.metaTitle || generated.metaTitle,
		metaDescription: input.metaDescription || generated.metaDescription,
		metaKeywords: input.metaKeywords || generated.metaKeywords,
	} as T;
}

export async function generatePostSeoWithInternalAi(
	input: Pick<PostSeoFields, "title" | "content">,
	endpoint: OpenAICompatibleEndpointConfig,
): Promise<GeneratedPostSeoFields | null> {
	if (!isOpenAICompatibleEndpointReady(endpoint)) {
		return null;
	}

	const title = sanitizePlainText(input.title, 200);
	const cleanedContent = compactMarkdownForPrompt(input.content);
	if (!title || !cleanedContent) {
		return null;
	}

	const generatedResponse = await requestGeneratedSeoPayload(
		{
			title,
			content: cleanedContent,
		},
		endpoint,
	);
	const parsedPayload =
		generatedResponse.payload ||
		extractLooseGeneratedSeoPayload(generatedResponse.rawResponse);
	if (!parsedPayload) {
		const snippet =
			sanitizePlainText(
				generatedResponse.rawResponse,
				ERROR_RESPONSE_SNIPPET_LENGTH,
			) || "空响应";
		throw new Error(
			`AI 返回内容无法解析为 JSON，请确认模型支持 JSON 输出。响应片段：${snippet}`,
		);
	}

	const normalized = normalizeGeneratedSeoFields(parsedPayload);
	if (
		!normalized.excerpt &&
		!normalized.metaTitle &&
		!normalized.metaDescription &&
		!normalized.metaKeywords
	) {
		throw new Error("AI 已返回 JSON，但摘要与 SEO 字段均为空");
	}

	return normalized;
}

export async function autoFillPostSeoWithInternalAi<T extends PostSeoFields>(
	input: T,
	endpoint: OpenAICompatibleEndpointConfig,
): Promise<T> {
	if (!shouldGenerateForStatus(input.status) || !hasMissingSeoFields(input)) {
		return input;
	}

	if (!isOpenAICompatibleEndpointReady(endpoint)) {
		return input;
	}

	try {
		const generated = await generatePostSeoWithInternalAi(
			{
				title: input.title,
				content: input.content,
			},
			endpoint,
		);
		if (!generated) {
			return input;
		}

		return mergeGeneratedSeo(input, generated);
	} catch {
		return input;
	}
}
