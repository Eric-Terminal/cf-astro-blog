import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";
import {
	hashPassword,
	isLegacyPasswordHash,
	verifyPassword,
} from "../../src/lib/password";
import { renderSafeMarkdown } from "../../src/lib/security";

describe("安全工具喵", () => {
	test("renderSafeMarkdown 会转义原始 HTML 喵", async () => {
		const html = await renderSafeMarkdown(
			'# 标题\n<script>alert("xss")</script>',
		);

		assert.match(html, /<h1>标题<\/h1>/u);
		assert.ok(!html.includes("<script>"));
		assert.ok(html.includes("&lt;script&gt;alert"));
	});

	test("renderSafeMarkdown 会拒绝 javascript 链接与协议相对链接喵", async () => {
		const html = await renderSafeMarkdown(
			"[危险链接](javascript:alert(1)) [外链](//evil.example.com)",
		);

		assert.ok(!html.includes("javascript:"));
		assert.ok(!html.includes("//evil.example.com"));
		assert.match(html, /危险链接/u);
		assert.match(html, /外链/u);
		assert.ok(!html.includes("<a href="));
	});

	test("renderSafeMarkdown 不允许把 mailto 用作图片地址喵", async () => {
		const html = await renderSafeMarkdown("![封面](mailto:test@example.com)");

		assert.ok(!html.includes("<img"));
		assert.match(html, /封面/u);
	});

	test("verifyPassword 支持新的 PBKDF2 哈希喵", async () => {
		const password = "correct-horse-battery-staple";
		const hash = await hashPassword(password);

		assert.ok(hash.startsWith("pbkdf2_sha256$"));
		assert.equal(isLegacyPasswordHash(hash), false);
		assert.equal(await verifyPassword(password, hash), true);
		assert.equal(await verifyPassword("wrong-password", hash), false);
	});

	test("verifyPassword 兼容旧版 SHA-256 哈希喵", async () => {
		const password = "legacy-password";
		const legacyHash = createHash("sha256").update(password).digest("hex");

		assert.equal(isLegacyPasswordHash(legacyHash), true);
		assert.equal(await verifyPassword(password, legacyHash), true);
		assert.equal(await verifyPassword("wrong-password", legacyHash), false);
	});
});
