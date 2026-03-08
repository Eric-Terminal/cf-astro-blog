import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import { sql } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { blogPosts } from "../../src/db/schema";
import {
	getPublicPostBySlugCondition,
	getPublicPostKeywordCondition,
	getPublicPostSearchCondition,
} from "../../src/lib/public-content";
import { buildProtectedAssetHeaders } from "../../src/lib/security";

const dialect = new SQLiteSyncDialect();

describe("公开内容保护", () => {
	test("文章详情过滤条件会限制为已发布或已到时的定时文章", () => {
		const compiled = dialect.sqlToQuery(
			sql`select * from ${blogPosts} where ${getPublicPostBySlugCondition("draft-post")}`,
		);

		assert.match(compiled.sql, /"blog_posts"\."slug" = \?/u);
		assert.match(compiled.sql, /"blog_posts"\."status" = \?/u);
		assert.ok(compiled.params.includes("draft-post"));
		assert.ok(compiled.params.includes("published"));
		assert.ok(compiled.params.includes("scheduled"));
	});

	test("搜索过滤条件会限制为已发布或已到时的定时文章", () => {
		const compiled = dialect.sqlToQuery(
			sql`select * from ${blogPosts} where ${getPublicPostSearchCondition("%draft%")}`,
		);

		assert.match(compiled.sql, /"blog_posts"\."status" = \?/u);
		assert.ok(compiled.params.includes("published"));
		assert.ok(compiled.params.includes("scheduled"));
		assert.equal(
			compiled.params.filter((value) => value === "%draft%").length,
			3,
		);
	});

	test("关键词过滤条件会覆盖标题、正文与摘要", () => {
		const compiled = dialect.sqlToQuery(
			sql`select * from ${blogPosts} where ${getPublicPostKeywordCondition("%astro%")}`,
		);

		assert.equal(
			compiled.params.filter((value) => value === "%astro%").length,
			3,
		);
		assert.match(compiled.sql, /"blog_posts"\."title" like \?/u);
		assert.match(compiled.sql, /"blog_posts"\."content" like \?/u);
		assert.match(compiled.sql, /"blog_posts"\."excerpt" like \?/u);
	});

	test("受保护资源响应头会禁用共享缓存", () => {
		const headers = buildProtectedAssetHeaders("image/png");

		assert.equal(headers["Content-Type"], "image/png");
		assert.equal(headers["Cache-Control"], "private, no-store, max-age=0");
		assert.equal(headers.Vary, "Cookie");
		assert.equal(headers.Pragma, "no-cache");
		assert.equal(headers["X-Content-Type-Options"], "nosniff");
	});
});

describe("源码回归保护", () => {
	test("公开文章详情与搜索页面都使用发布态过滤辅助函数", async () => {
		const [postPageSource, searchPageSource] = await Promise.all([
			readFile("src/pages/blog/[slug].astro", "utf8"),
			readFile("src/pages/search.astro", "utf8"),
		]);

		assert.match(postPageSource, /getPublicPostBySlugCondition/u);
		assert.match(searchPageSource, /getPublicPostVisibilityCondition/u);
		assert.match(searchPageSource, /getPublicPostKeywordCondition/u);
	});

	test("主题切换组件不再包含内联脚本，并改由外置脚本接管", async () => {
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

	test("文章卡片封面不再被额外高斯遮罩并保持满高显示", async () => {
		const postCardSource = await readFile(
			"src/components/PostCard.astro",
			"utf8",
		);

		assert.ok(!postCardSource.includes("transform: scale(0.88);"));
		assert.ok(
			!postCardSource.includes(
				"backdrop-filter: blur(var(--post-card-cover-blur-effective))",
			),
		);
		assert.match(postCardSource, /object-position: center;/u);
	});

	test("友链页只保留申请入口卡片，申请表移到独立页面", async () => {
		const [friendsSource, applyPageSource] = await Promise.all([
			readFile("src/pages/friends.astro", "utf8"),
			readFile("src/pages/friends/apply.astro", "utf8"),
		]);

		assert.ok(friendsSource.includes('href="/friends/apply"'));
		assert.ok(!friendsSource.includes('action="/api/friend-links/apply"'));
		assert.ok(applyPageSource.includes('action="/api/friend-links/apply"'));
		assert.ok(
			applyPageSource.includes(
				"https://challenges.cloudflare.com/turnstile/v0/api.js",
			),
		);
		assert.ok(applyPageSource.includes('class="cf-turnstile"'));
	});

	test("友链申请接口会校验 Turnstile token", async () => {
		const source = await readFile("src/admin/routes/friend-links.ts", "utf8");

		assert.ok(source.includes("cf-turnstile-response"));
		assert.ok(
			source.includes(
				"https://challenges.cloudflare.com/turnstile/v0/siteverify",
			),
		);
	});

	test("公共页面 CSP 放行 Turnstile 域名", async () => {
		const source = await readFile("src/middleware.ts", "utf8");
		assert.ok(source.includes("https://challenges.cloudflare.com"));
	});

	test("搜索组件将标签筛选放入折叠面板并外显已选标签", async () => {
		const source = await readFile("src/components/Search.astro", "utf8");
		assert.ok(source.includes("search-tags-panel"));
		assert.ok(source.includes("search-selected-tags"));
		assert.ok(source.includes("search-selected-chip"));
		assert.ok(source.includes("调整标签（已选"));
	});
});
