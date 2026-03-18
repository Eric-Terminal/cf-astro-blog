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
	test("公开文章详情页使用发布态过滤，搜索页改为 Pagefind 客户端检索", async () => {
		const [postPageSource, searchPageSource] = await Promise.all([
			readFile("src/pages/blog/[slug].astro", "utf8"),
			readFile("src/pages/search.astro", "utf8"),
		]);

		assert.match(postPageSource, /getPublicPostBySlugCondition/u);
		assert.match(postPageSource, /shouldCountPostViewOnce/u);
		assert.match(postPageSource, /buildPostViewDedupKey/u);
		assert.match(postPageSource, /VIEW_COUNT_DEDUP_TTL_SECONDS/u);
		assert.match(postPageSource, /env\.SESSION\.get/u);
		assert.match(postPageSource, /env\.SESSION\.put/u);
		assert.match(
			postPageSource,
			/viewCount:\s*sql`\$\{blogPosts\.viewCount\}\s*\+\s*1`/u,
		);
		assert.match(searchPageSource, /pagefind-search\.js/u);
		assert.match(searchPageSource, /pagefind-search-results/u);
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

	test("404 页面提供可交互终端彩蛋，并通过公开 AI 终端接口返回结果", async () => {
		const [notFoundPageSource, terminalScriptSource] = await Promise.all([
			readFile("src/pages/404.astro", "utf8"),
			readFile("public/not-found-terminal.js", "utf8"),
		]);

		assert.match(notFoundPageSource, /Astro\.response\.status = 404/u);
		assert.match(notFoundPageSource, /data-not-found-terminal="true"/u);
		assert.match(
			notFoundPageSource,
			/data-ai-endpoint="\/api\/ai\/terminal-404"/u,
		);
		assert.match(notFoundPageSource, /guest@404:~\$/u);
		assert.match(notFoundPageSource, /\/not-found-terminal\.js/u);
		assert.match(terminalScriptSource, /\/api\/ai\/terminal-404/u);
		assert.match(terminalScriptSource, /TERMINAL_CLEAR/u);
		assert.match(terminalScriptSource, /guest@404:\$\{cwd\}\$/u);
		assert.match(terminalScriptSource, /cwd,/u);
		assert.match(terminalScriptSource, /normalizeTerminalPath/u);
		assert.match(terminalScriptSource, /astro:page-load/u);
	});

	test("文章卡片封面不再被额外高斯遮罩并保持满高显示", async () => {
		const [postCardSource, postCardStyleSource] = await Promise.all([
			readFile("src/components/PostCard.astro", "utf8"),
			readFile("src/styles/post-card.css", "utf8"),
		]);

		assert.ok(!postCardStyleSource.includes("transform: scale(0.88);"));
		assert.ok(
			!postCardStyleSource.includes(
				"backdrop-filter: blur(var(--post-card-cover-blur-effective))",
			),
		);
		assert.ok(!postCardSource.includes("post-card-cover-fallback"));
		assert.match(postCardSource, /post-card-no-cover/u);
		assert.match(postCardSource, /\{hasCover && \(/u);
		assert.match(postCardStyleSource, /object-position: center;/u);
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
		assert.ok(source.includes('normalizedPath.startsWith("/search")'));
		assert.ok(source.includes("'wasm-unsafe-eval'"));
	});

	test("公共页面中间件会对首页/归档/友链启用边缘缓存", async () => {
		const source = await readFile("src/middleware.ts", "utf8");
		assert.ok(source.includes("getEdgeCache"));
		assert.ok(source.includes("X-Edge-Cache"));
		assert.ok(source.includes("s-maxage"));
		assert.ok(source.includes('case "/blog"'));
		assert.ok(source.includes('case "/friends"'));
		assert.ok(source.includes("buildEdgeCacheKeyUrl"));
	});

	test("搜索组件将标签筛选放入折叠面板并外显已选标签", async () => {
		const source = await readFile("src/components/Search.astro", "utf8");
		assert.ok(source.includes("search-tags-panel"));
		assert.ok(source.includes("search-selected-tags"));
		assert.ok(source.includes("search-selected-chip"));
		assert.ok(source.includes("调整标签（已选"));
	});

	test("文章详情页支持左侧作者信息栏、目录导航并提供阅读去透明度开关", async () => {
		const [
			postLayoutSource,
			postPageSource,
			articleToggleScript,
			sidebarStickyScript,
		] = await Promise.all([
			readFile("src/layouts/Post.astro", "utf8"),
			readFile("src/pages/blog/[slug].astro", "utf8"),
			readFile("public/article-transparency-toggle.js", "utf8"),
			readFile("public/article-sidebar-sticky.js", "utf8"),
		]);

		assert.ok(postLayoutSource.includes("article-sidebar"));
		assert.ok(postLayoutSource.includes("article-sidebar-with-toc"));
		assert.ok(postLayoutSource.includes("article-profile-avatar"));
		assert.ok(postLayoutSource.includes("article-toc"));
		assert.ok(postLayoutSource.includes("align-self: stretch;"));
		assert.ok(postLayoutSource.includes("align-content: start;"));
		assert.ok(postLayoutSource.includes("grid-auto-rows: max-content;"));
		assert.ok(postLayoutSource.includes("--article-profile-height: 0px;"));
		assert.ok(postLayoutSource.includes("data-article-transparency-toggle"));
		assert.ok(postLayoutSource.includes("article-transparency-toggle-compact"));
		assert.ok(postLayoutSource.includes("/article-transparency-toggle.js"));
		assert.ok(postLayoutSource.includes("/article-sidebar-sticky.js"));
		assert.ok(postLayoutSource.includes("article-opaque-mode"));
		assert.match(
			postLayoutSource,
			/\.article-sidebar-with-toc\s+\.article-profile\s*\{[^}]*position:\s*sticky/u,
		);
		assert.ok(postLayoutSource.includes("var(--article-sidebar-sticky-top) -"));
		assert.ok(postLayoutSource.includes("var(--article-profile-height)"));
		assert.match(
			postLayoutSource,
			/\.article-toc\s*\{[^}]*position:\s*sticky/u,
		);
		assert.match(
			postLayoutSource,
			/\.article-toc\s*\{[^}]*top:\s*var\(--article-sidebar-sticky-top\)/u,
		);
		assert.doesNotMatch(
			postLayoutSource,
			/\.article-toc\s*\{[^}]*overflow:\s*auto/u,
		);
		assert.doesNotMatch(
			postLayoutSource,
			/\.article-sidebar\s*\{[^}]*position:\s*sticky/u,
		);
		assert.ok(postLayoutSource.includes("orientation: portrait"));
		assert.ok(postPageSource.includes("articleSidebarAvatarPath"));
		assert.ok(postPageSource.includes("getSiteAppearance"));
		assert.ok(postPageSource.includes("renderSafeMarkdownWithToc"));
		assert.ok(postPageSource.includes("toc={toc}"));
		assert.ok(articleToggleScript.includes("articleOpaqueMode"));
		assert.ok(articleToggleScript.includes("querySelectorAll"));
		assert.ok(articleToggleScript.includes("astro:page-load"));
		assert.ok(sidebarStickyScript.includes("article-sidebar-with-toc"));
		assert.ok(sidebarStickyScript.includes("--article-profile-height"));
		assert.ok(sidebarStickyScript.includes("ResizeObserver"));
		assert.ok(sidebarStickyScript.includes("astro:page-load"));
	});

	test("文章代码块启用 Mac 终端样式增强与复制按钮脚本", async () => {
		const [baseLayoutSource, scriptSource, globalStyleSource] =
			await Promise.all([
				readFile("src/layouts/Base.astro", "utf8"),
				readFile("public/code-block-enhance.js", "utf8"),
				readFile("src/styles/global.css", "utf8"),
			]);

		assert.ok(baseLayoutSource.includes("/code-block-enhance.js"));
		assert.ok(scriptSource.includes("prose-code-block"));
		assert.ok(scriptSource.includes("prose-code-head"));
		assert.ok(scriptSource.includes("prose-code-copy"));
		assert.ok(scriptSource.includes("code-window-dot-close"));
		assert.ok(scriptSource.includes("code-window-dot-minimize"));
		assert.ok(scriptSource.includes("code-window-dot-zoom"));
		assert.ok(scriptSource.includes("language-"));
		assert.ok(globalStyleSource.includes(".prose .prose-code-head"));
		assert.ok(globalStyleSource.includes(".prose .code-window-dot"));
		assert.ok(globalStyleSource.includes(".prose .prose-code-copy"));
		assert.ok(globalStyleSource.includes(".prose .prose-code-block pre"));
	});

	test("后台文章变更会触发可选部署钩子", async () => {
		const [postRouteSource, deployHookSource, workflowSource] =
			await Promise.all([
				readFile("src/admin/routes/posts.ts", "utf8"),
				readFile("src/admin/lib/deploy-hook.ts", "utf8"),
				readFile(".github/workflows/auto-deploy-from-admin.yml", "utf8"),
			]);

		assert.ok(postRouteSource.includes("triggerDeployHook"));
		assert.ok(postRouteSource.includes("post-created"));
		assert.ok(postRouteSource.includes("post-updated"));
		assert.ok(postRouteSource.includes("post-deleted"));
		assert.ok(deployHookSource.includes("AUTO_DEPLOY_WEBHOOK_URL"));
		assert.ok(deployHookSource.includes("x-deploy-token"));
		assert.ok(deployHookSource.includes("authorization"));
		assert.ok(deployHookSource.includes("Bearer"));
		assert.ok(workflowSource.includes("repository_dispatch"));
		assert.ok(workflowSource.includes("rebuild-search-index"));
		assert.ok(workflowSource.includes("npm run deploy"));
	});
});
