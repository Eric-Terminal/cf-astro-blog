import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

describe("SEO 与订阅输出", () => {
	test("基础头部包含 RSS 与 sitemap 链接", async () => {
		const source = await readFile("src/components/BaseHead.astro", "utf8");

		assert.ok(source.includes('rel="sitemap"'));
		assert.ok(source.includes('type="application/rss+xml"'));
		assert.ok(source.includes('href="/rss.xml"'));
		assert.ok(source.includes('rel="webmention"'));
		assert.ok(source.includes('href="/api/webmention"'));
	});

	test("robots 仅屏蔽后台登录与管理路径", async () => {
		const source = await readFile("src/pages/robots.txt.ts", "utf8");

		assert.ok(source.includes('"/api/auth"'));
		assert.ok(source.includes('"/api/admin"'));
		assert.ok(source.includes('"/admin"'));
		assert.ok(source.includes("Allow: /"));
		assert.ok(source.includes("/sitemap.xml"));
	});

	test("RSS 源读取公开文章并输出标准响应头", async () => {
		const source = await readFile("src/pages/rss.xml.ts", "utf8");

		assert.ok(source.includes("getPublicPostVisibilityCondition"));
		assert.ok(source.includes("getSiteAppearance"));
		assert.ok(source.includes("resolveSiteDescriptionFromAppearance"));
		assert.ok(source.includes('<rss version="2.0"'));
		assert.ok(source.includes("application/rss+xml; charset=utf-8"));
		assert.match(source, /\/blog\/\$\{post\.slug\}/u);
		assert.ok(source.includes(".limit(30)"));
	});

	test("基础布局会将外观简介作为默认 description", async () => {
		const source = await readFile("src/layouts/Base.astro", "utf8");

		assert.ok(source.includes("resolveSiteDescriptionFromAppearance"));
		assert.match(source, /description \?\?/u);
	});
});
