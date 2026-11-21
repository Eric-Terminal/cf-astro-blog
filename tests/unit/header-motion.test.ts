import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

describe("导航收缩与灵动岛进阶交互保护", () => {
	test("头部会把外壳动画与内容布局拆开，并保留壳体宽度/内边距曲线过渡", async () => {
		const [headerSource, globalStylesSource] = await Promise.all([
			readFile("src/components/Header.astro", "utf8"),
			readFile("src/styles/global.css", "utf8"),
		]);

		assert.match(headerSource, /class="site-nav-shell"/u);
		assert.match(headerSource, /\.site-nav::before/u);
		assert.match(headerSource, /contain: paint/u);
		assert.match(headerSource, /var\(--nav-shell-max-width\)/u);
		assert.match(headerSource, /var\(--nav-shell-condensed-scale\)/u);
		assert.match(headerSource, /var\(--nav-shell-blur-effective,\s*14px\)/u);
		assert.ok(headerSource.includes("width var(--nav-motion-main)"));
		assert.ok(!headerSource.includes("max-width var(--nav-motion-main)"));
		assert.ok(headerSource.includes("padding var(--nav-motion-main)"));
		assert.match(globalStylesSource, /--nav-shell-max-width:/u);
		assert.match(globalStylesSource, /--nav-shell-condensed-scale:/u);
		assert.match(
			globalStylesSource,
			/--nav-shell-blur:\s*var\(--hero-card-blur,\s*18px\)/u,
		);
		assert.match(
			globalStylesSource,
			/--nav-shell-open-surface:\s*rgba\(\s*var\(--card-surface-rgb\),\s*calc\(var\(--hero-card-opacity,\s*14\)\s*\/\s*100\)\s*\)/u,
		);
	});

	test("灵动岛在文章阅读时提供实时阅读进度丝线与快速回顶入口", async () => {
		const [headerSource, themeScriptSource] = await Promise.all([
			readFile("src/components/Header.astro", "utf8"),
			readFile("public/theme.js", "utf8"),
		]);

		assert.match(headerSource, /data-nav-back-top/u);
		assert.match(headerSource, /data-nav-reading-percent/u);
		assert.match(headerSource, /--nav-reading-progress/u);
		assert.match(themeScriptSource, /syncReadingProgress/u);
		assert.match(themeScriptSource, /data-reading-active/u);
		assert.match(themeScriptSource, /window\.scrollTo/u);
	});
});
