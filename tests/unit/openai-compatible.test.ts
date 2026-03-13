import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import {
	isOpenAICompatibleEndpointReady,
	normalizeOpenAICompatibleBaseUrl,
	type OpenAICompatibleEndpointConfig,
	requestOpenAICompatibleChatCompletion,
} from "../../src/lib/openai-compatible";

const originalFetch = globalThis.fetch;

const endpoint: OpenAICompatibleEndpointConfig = {
	enabled: true,
	baseUrl: "https://api.openai.com/v1",
	apiKey: "sk-test",
	model: "gpt-4o-mini",
};

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("OpenAI 兼容接口", () => {
	test("normalizeOpenAICompatibleBaseUrl 会规范化地址并移除尾斜杠", () => {
		assert.equal(
			normalizeOpenAICompatibleBaseUrl(
				"https://api.openai.com/v1/",
				"https://fallback.example.com/v1",
			),
			"https://api.openai.com/v1",
		);
		assert.equal(
			normalizeOpenAICompatibleBaseUrl(
				"javascript:alert(1)",
				"https://fallback.example.com/v1",
			),
			"https://fallback.example.com/v1",
		);
	});

	test("isOpenAICompatibleEndpointReady 会校验必要字段", () => {
		assert.equal(isOpenAICompatibleEndpointReady(endpoint), true);
		assert.equal(
			isOpenAICompatibleEndpointReady({ ...endpoint, apiKey: "" }),
			false,
		);
	});

	test("requestOpenAICompatibleChatCompletion 会按标准 chat/completions 发请求", async () => {
		const requests: Array<{ url: string; init?: RequestInit }> = [];
		globalThis.fetch = (async (input, init) => {
			requests.push({ url: String(input), init });
			return new Response(
				JSON.stringify({
					choices: [
						{
							message: {
								content: '{"ok":true}',
							},
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}) as typeof fetch;

		const content = await requestOpenAICompatibleChatCompletion(
			endpoint,
			[
				{ role: "system", content: "你是助手" },
				{ role: "user", content: "输出 JSON" },
			],
			{
				maxTokens: 256,
				temperature: 0.1,
				jsonMode: true,
			},
		);

		assert.equal(content, '{"ok":true}');
		assert.equal(requests.length, 1);
		assert.equal(requests[0].url, "https://api.openai.com/v1/chat/completions");
		assert.equal(requests[0].init?.method, "POST");
		const headers = new Headers(requests[0].init?.headers);
		assert.equal(headers.get("authorization"), "Bearer sk-test");

		const payload = JSON.parse(String(requests[0].init?.body));
		assert.equal(payload.model, "gpt-4o-mini");
		assert.equal(payload.messages.length, 2);
		assert.deepEqual(payload.response_format, { type: "json_object" });
	});
});
