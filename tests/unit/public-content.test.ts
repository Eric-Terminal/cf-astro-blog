import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import { sql } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { blogPosts } from "../../src/db/schema";
import {
	getPublicPostBySlugCondition,
	getPublicPostSearchCondition,
} from "../../src/lib/public-content";
import { buildProtectedAssetHeaders } from "../../src/lib/security";

const dialect = new SQLiteSyncDialect();

describe("公开内容保护喵", () => {
	test("文章详情过滤条件会强制限制为已发布状态喵", () => {
		const compiled = dialect.sqlToQuery(
			sql`select * from ${blogPosts} where ${getPublicPostBySlugCondition("draft-post")}`,
		);

		assert.match(compiled.sql, /"blog_posts"\."slug" = \?/u);
		assert.match(compiled.sql, /"blog_posts"\."status" = \?/u);
		assert.deepEqual(compiled.params, ["draft-post", "published"]);
	});

	test("搜索过滤条件会强制限制为已发布状态喵", () => {
		const compiled = dialect.sqlToQuery(
			sql`select * from ${blogPosts} where ${getPublicPostSearchCondition("%draft%")}`,
		);

		assert.match(compiled.sql, /"blog_posts"\."status" = \?/u);
		assert.ok(compiled.params.includes("published"));
		assert.equal(
			compiled.params.filter((value) => value === "%draft%").length,
			3,
		);
	});

	test("受保护资源响应头会禁用共享缓存喵", () => {
		const headers = buildProtectedAssetHeaders("image/png");

		assert.equal(headers["Content-Type"], "image/png");
		assert.equal(headers["Cache-Control"], "private, no-store, max-age=0");
		assert.equal(headers.Vary, "Cookie");
		assert.equal(headers.Pragma, "no-cache");
		assert.equal(headers["X-Content-Type-Options"], "nosniff");
	});
});

describe("源码回归保护喵", () => {
	test("公开文章详情与搜索页面都使用发布态过滤辅助函数喵", async () => {
		const [postPageSource, searchPageSource] = await Promise.all([
			readFile("src/pages/blog/[slug].astro", "utf8"),
			readFile("src/pages/search.astro", "utf8"),
		]);

		assert.match(postPageSource, /getPublicPostBySlugCondition/u);
		assert.match(searchPageSource, /getPublicPostSearchCondition/u);
	});

	test("主题切换组件不再包含内联脚本，并改由外置脚本接管喵", async () => {
		const [toggleSource, themeScriptSource, mediaRouteSource] =
			await Promise.all([
				readFile("src/components/ThemeToggle.astro", "utf8"),
				readFile("public/theme.js", "utf8"),
				readFile("src/admin/routes/media.ts", "utf8"),
			]);

		assert.ok(!toggleSource.includes("<script"));
		assert.match(themeScriptSource, /closest\("\.theme-toggle"\)/u);
		assert.match(mediaRouteSource, /buildProtectedAssetHeaders/u);
	});
});
