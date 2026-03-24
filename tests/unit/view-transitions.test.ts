import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

describe("页面过渡与跨页状态保护", () => {
	test("基础布局通过 CSS 根节点覆盖实现页面滑动过渡，不在 frame 上挂载 VTN 以保护 backdrop-filter 合成层", async () => {
		const [baseLayoutSource, baseHeadSource, globalStylesSource] =
			await Promise.all([
				readFile("src/layouts/Base.astro", "utf8"),
				readFile("src/components/BaseHead.astro", "utf8"),
				readFile("src/styles/global.css", "utf8"),
			]);

		// ClientRouter 已在 BaseHead 中启用视图过渡
		assert.match(baseHeadSource, /ClientRouter/u);
		// 不在页面外壳上挂载 view-transition-name，避免创建合成层隔离导致 backdrop-filter 失效
		assert.ok(
			!baseLayoutSource.includes('transition:name="page-shell"'),
			"site-route-frame 不应挂载 page-shell VTN，否则 backdrop-filter 在子元素中会失效",
		);
		// 全局 CSS 用 root 级别切换覆盖默认淡化，实现滑动效果
		assert.match(globalStylesSource, /::view-transition-old\(root\)/u);
		assert.match(globalStylesSource, /::view-transition-new\(root\)/u);
		assert.match(globalStylesSource, /vt-slide-from-right/u);
		assert.match(globalStylesSource, /vt-slide-to-left/u);
		assert.match(
			globalStylesSource,
			/cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\)/u,
		);
	});

	test("主题脚本会在切页时保留根节点状态并重写顶层页面方向", async () => {
		const themeScriptSource = await readFile("public/theme.js", "utf8");

		assert.match(themeScriptSource, /astro:before-preparation/u);
		assert.match(themeScriptSource, /astro:before-swap/u);
		assert.match(themeScriptSource, /data-nav-condensed/u);
		assert.match(
			themeScriptSource,
			/syncRootAttributeToDocument\("data-theme"/u,
		);
		assert.match(themeScriptSource, /startViewTransition/u);
		assert.match(themeScriptSource, /data-theme-switching/u);
		assert.match(themeScriptSource, /pathname === "\/search"/u);
		assert.match(themeScriptSource, /pathname === "\/"/u);
	});

	test("主题切换会覆盖默认 root 过渡并使用从按钮扩散的波纹裁剪", async () => {
		const globalStylesSource = await readFile("src/styles/global.css", "utf8");

		assert.match(globalStylesSource, /html\[data-theme-switching\]/u);
		assert.match(
			globalStylesSource,
			/html\[data-theme-switching\]::view-transition-new\(root\)/u,
		);
		assert.match(globalStylesSource, /mix-blend-mode:\s*normal/u);
	});

	test("文章透明度切换也会复用 root 波纹过渡并禁用具名快照穿透", async () => {
		const [globalStylesSource, articleToggleScript] = await Promise.all([
			readFile("src/styles/global.css", "utf8"),
			readFile("public/article-transparency-toggle.js", "utf8"),
		]);

		assert.match(
			globalStylesSource,
			/html\[data-article-transparency-switching\]::view-transition-new\(root\)/u,
		);
		assert.match(
			globalStylesSource,
			/html\[data-article-transparency-switching\]\s*\*/u,
		);
		assert.match(articleToggleScript, /startViewTransition/u);
		assert.match(articleToggleScript, /data-article-transparency-switching/u);
		assert.match(articleToggleScript, /clipPath/u);
	});

	test("首页与搜索页会共享搜索入口过渡，而归档页不会介入这条链路", async () => {
		const [homePageSource, archivePageSource, searchPageSource] =
			await Promise.all([
				readFile("src/pages/index.astro", "utf8"),
				readFile("src/pages/blog/index.astro", "utf8"),
				readFile("src/pages/search.astro", "utf8"),
			]);

		assert.match(homePageSource, /transition:name="search-entry"/u);
		assert.match(searchPageSource, /transition:name="search-entry"/u);
		assert.ok(!archivePageSource.includes('transition:name="search-entry"'));
		assert.ok(!homePageSource.includes('transition:name="top-page-hero"'));
		assert.ok(!archivePageSource.includes('transition:name="top-page-hero"'));
		assert.ok(!searchPageSource.includes('transition:name="top-page-hero"'));
	});
});
