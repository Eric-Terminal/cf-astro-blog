import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { autoFillPostSeoWithInternalAi } from "../../src/admin/lib/ai-post-seo";
import type { OpenAICompatibleEndpointConfig } from "../../src/lib/openai-compatible";

const originalFetch = globalThis.fetch;

const endpoint: OpenAICompatibleEndpointConfig = {
	enabled: true,
	baseUrl: "https://api.openai.com/v1",
	apiKey: "sk-internal",
	model: "gpt-4o-mini",
};

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("文章 AI 摘要与 SEO 自动生成", () => {
	test("已发布文章在缺失字段时会自动补全摘要与 SEO", async () => {
		globalThis.fetch = (async () =>
			new Response(
				JSON.stringify({
					choices: [
						{
							message: {
								content: JSON.stringify({
									excerpt: "这是一段摘要",
									metaTitle: "示例文章 SEO 标题",
									metaDescription: "示例文章 SEO 描述",
									metaKeywords: ["Cloudflare", "Astro", "SEO"],
								}),
							},
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			)) as typeof fetch;

		const result = await autoFillPostSeoWithInternalAi(
			{
				title: "示例文章",
				content: "正文内容",
				status: "published",
				excerpt: null,
				metaTitle: null,
				metaDescription: null,
				metaKeywords: null,
			},
			endpoint,
		);

		assert.equal(result.excerpt, "这是一段摘要");
		assert.equal(result.metaTitle, "示例文章 SEO 标题");
		assert.equal(result.metaDescription, "示例文章 SEO 描述");
		assert.equal(result.metaKeywords, "Cloudflare, Astro, SEO");
	});

	test("手动填写字段不会被 AI 覆盖", async () => {
		globalThis.fetch = (async () =>
			new Response(
				JSON.stringify({
					choices: [
						{
							message: {
								content: JSON.stringify({
									excerpt: "AI摘要",
									metaTitle: "AI标题",
									metaDescription: "AI描述",
									metaKeywords: ["AI关键词"],
								}),
							},
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			)) as typeof fetch;

		const result = await autoFillPostSeoWithInternalAi(
			{
				title: "示例文章",
				content: "正文内容",
				status: "published",
				excerpt: "手写摘要",
				metaTitle: "手写标题",
				metaDescription: null,
				metaKeywords: "手写关键词",
			},
			endpoint,
		);

		assert.equal(result.excerpt, "手写摘要");
		assert.equal(result.metaTitle, "手写标题");
		assert.equal(result.metaDescription, "AI描述");
		assert.equal(result.metaKeywords, "手写关键词");
	});

	test("草稿状态不会触发自动生成", async () => {
		let called = false;
		globalThis.fetch = (async () => {
			called = true;
			return new Response("{}");
		}) as typeof fetch;

		const result = await autoFillPostSeoWithInternalAi(
			{
				title: "示例文章",
				content: "正文内容",
				status: "draft",
				excerpt: null,
				metaTitle: null,
				metaDescription: null,
				metaKeywords: null,
			},
			endpoint,
		);

		assert.equal(called, false);
		assert.equal(result.excerpt, null);
		assert.equal(result.metaTitle, null);
	});
});
