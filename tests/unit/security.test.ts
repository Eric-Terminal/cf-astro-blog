import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";
import {
	hashPassword,
	isLegacyPasswordHash,
	verifyPassword,
} from "../../src/lib/password";
import { buildUrlSlug, renderSafeMarkdown } from "../../src/lib/security";

describe("安全工具", () => {
	test("renderSafeMarkdown 会转义原始 HTML ", async () => {
		const html = await renderSafeMarkdown(
			'# 标题\n<script>alert("xss")</script>',
		);

		assert.match(html, /<h1>标题<\/h1>/u);
		assert.ok(!html.includes("<script>"));
		assert.ok(html.includes("&lt;script&gt;alert"));
	});

	test("renderSafeMarkdown 会拒绝 javascript 链接与协议相对链接", async () => {
		const html = await renderSafeMarkdown(
			"[危险链接](javascript:alert(1)) [外链](//evil.example.com)",
		);

		assert.ok(!html.includes("javascript:"));
		assert.ok(!html.includes("//evil.example.com"));
		assert.match(html, /危险链接/u);
		assert.match(html, /外链/u);
		assert.ok(!html.includes("<a href="));
	});

	test("renderSafeMarkdown 不允许把 mailto 用作图片地址", async () => {
		const html = await renderSafeMarkdown("![封面](mailto:test@example.com)");

		assert.ok(!html.includes("<img"));
		assert.match(html, /封面/u);
	});

	test("renderSafeMarkdown 会保留段内单换行", async () => {
		const html = await renderSafeMarkdown("第一行\n第二行\n第三行");

		assert.match(html, /<p>第一行<br>第二行<br>第三行<\/p>/u);
	});

	test("renderSafeMarkdown 支持 details 短代码语法", async () => {
		const html = await renderSafeMarkdown(
			'前文\n\n[details="总结"]\n隐藏 **内容**\n[/details]\n\n后文',
		);

		assert.match(
			html,
			/<details class="prose-details"><summary>总结<\/summary>/u,
		);
		assert.match(html, /隐藏 <strong>内容<\/strong>/u);
		assert.match(html, /<p>后文<\/p>/u);
	});

	test("renderSafeMarkdown 会转义 details 标题中的危险标签", async () => {
		const html = await renderSafeMarkdown(
			'[details="<img src=x onerror=alert(1)>"]\n测试\n[/details]',
		);

		assert.ok(!html.includes('onerror="'));
		assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/u);
	});

	test("renderSafeMarkdown 支持 spoiler 短代码语法", async () => {
		const html = await renderSafeMarkdown(
			"这是一段文本 [spoiler]此文本将被模糊处理[/spoiler] 结束。",
		);

		assert.match(
			html,
			/<span class="prose-spoiler">此文本将被模糊处理<\/span>/u,
		);
	});

	test("renderSafeMarkdown 会转义 spoiler 内的危险标签", async () => {
		const html = await renderSafeMarkdown(
			"[spoiler]<img src=x onerror=alert(1)>[/spoiler]",
		);

		assert.ok(!html.includes("<img"));
		assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/u);
	});

	test("verifyPassword 支持新的 PBKDF2 哈希", async () => {
		const password = "correct-horse-battery-staple";
		const hash = await hashPassword(password);

		assert.ok(hash.startsWith("pbkdf2_sha256$"));
		assert.equal(isLegacyPasswordHash(hash), false);
		assert.equal(await verifyPassword(password, hash), true);
		assert.equal(await verifyPassword("wrong-password", hash), false);
	});

	test("verifyPassword 兼容旧版 SHA-256 哈希", async () => {
		const password = "legacy-password";
		const legacyHash = createHash("sha256").update(password).digest("hex");

		assert.equal(isLegacyPasswordHash(legacyHash), true);
		assert.equal(await verifyPassword(password, legacyHash), true);
		assert.equal(await verifyPassword("wrong-password", legacyHash), false);
	});

	test("buildUrlSlug 会把标题转成 URL 友好的路径", () => {
		assert.equal(buildUrlSlug("Hello Astro Blog"), "hello-astro-blog");
		assert.equal(buildUrlSlug("Cloudflare + D1 + R2"), "cloudflare-d1-r2");
	});

	test("buildUrlSlug 遇到无法转写的字符时会回退到前缀随机路径", () => {
		const slug = buildUrlSlug("中文标题", { fallbackPrefix: "post" });
		assert.match(slug, /^post-[0-9a-f]{8}$/u);
	});

	test("buildUrlSlug 支持长度限制", () => {
		const slug = buildUrlSlug("a".repeat(140), { maxLength: 24 });
		assert.equal(slug.length, 24);
	});
});
