import { sanitizePlainText } from "@/lib/security";

const DEFAULT_TIMEOUT_MS = 15_000;

export interface OpenAICompatibleEndpointConfig {
	enabled: boolean;
	baseUrl: string;
	apiKey: string;
	model: string;
}

export interface OpenAICompatibleMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

interface RequestChatOptions {
	temperature?: number;
	maxTokens?: number;
	timeoutMs?: number;
	jsonMode?: boolean;
}

export function normalizeOpenAICompatibleBaseUrl(
	value: unknown,
	fallback: string,
): string {
	const raw = sanitizePlainText(value, 240);
	if (!raw) {
		return fallback;
	}

	try {
		const parsed = new URL(raw);
		if (!["http:", "https:"].includes(parsed.protocol)) {
			return fallback;
		}

		parsed.hash = "";
		parsed.search = "";
		parsed.pathname = parsed.pathname.replace(/\/+$/u, "");
		const normalized = parsed.toString().replace(/\/+$/u, "");
		return normalized || fallback;
	} catch {
		return fallback;
	}
}

export function isOpenAICompatibleEndpointReady(
	endpoint: OpenAICompatibleEndpointConfig,
): boolean {
	return Boolean(
		endpoint.enabled &&
			endpoint.baseUrl.trim() &&
			endpoint.model.trim() &&
			endpoint.apiKey.trim(),
	);
}

function extractMessageContent(payload: unknown): string | null {
	const firstChoice =
		Array.isArray((payload as { choices?: unknown[] })?.choices) &&
		(payload as { choices?: unknown[] }).choices
			? (payload as { choices: unknown[] }).choices[0]
			: null;
	if (!firstChoice || typeof firstChoice !== "object") {
		return null;
	}

	const message = (firstChoice as { message?: unknown }).message;
	if (message && typeof message === "object") {
		const content = (message as { content?: unknown }).content;
		if (typeof content === "string") {
			return content.trim();
		}

		if (Array.isArray(content)) {
			const merged = content
				.map((item) => {
					if (typeof item === "string") {
						return item;
					}
					if (item && typeof item === "object") {
						const text = (item as { text?: unknown }).text;
						return typeof text === "string" ? text : "";
					}
					return "";
				})
				.join("")
				.trim();
			return merged || null;
		}
	}

	const plainText = (firstChoice as { text?: unknown }).text;
	return typeof plainText === "string" ? plainText.trim() : null;
}

export async function requestOpenAICompatibleChatCompletion(
	endpoint: OpenAICompatibleEndpointConfig,
	messages: OpenAICompatibleMessage[],
	options: RequestChatOptions = {},
): Promise<string> {
	if (!isOpenAICompatibleEndpointReady(endpoint)) {
		throw new Error("AI 模型接口尚未配置完整");
	}

	const abortController = new AbortController();
	const timeoutMs = Math.max(2_000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
	const timer = setTimeout(() => {
		abortController.abort();
	}, timeoutMs);

	const url = `${endpoint.baseUrl.replace(/\/+$/u, "")}/chat/completions`;
	const headers = new Headers({
		"content-type": "application/json",
		authorization: `Bearer ${endpoint.apiKey.trim()}`,
	});

	const payload: Record<string, unknown> = {
		model: endpoint.model.trim(),
		messages,
		temperature:
			typeof options.temperature === "number" ? options.temperature : 0.2,
		max_tokens: typeof options.maxTokens === "number" ? options.maxTokens : 700,
	};
	if (options.jsonMode !== false) {
		payload.response_format = { type: "json_object" };
	}

	try {
		const response = await fetch(url, {
			method: "POST",
			headers,
			body: JSON.stringify(payload),
			signal: abortController.signal,
		});
		const responseText = await response.text();
		let responseJson: unknown = null;
		try {
			responseJson = responseText ? JSON.parse(responseText) : null;
		} catch {
			responseJson = null;
		}

		if (!response.ok) {
			const providerMessage =
				(responseJson as { error?: { message?: string } })?.error?.message ??
				"";
			const fallbackMessage = sanitizePlainText(responseText, 180);
			throw new Error(
				`AI 请求失败（${response.status}）：${providerMessage || fallbackMessage || "未知错误"}`,
			);
		}

		const content = extractMessageContent(responseJson);
		if (!content) {
			throw new Error("AI 响应中未包含可用内容");
		}

		return content;
	} finally {
		clearTimeout(timer);
	}
}
