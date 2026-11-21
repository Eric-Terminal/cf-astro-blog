import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

describe("页脚精简与流式收尾保护", () => {
	test("页脚不再渲染重复的小导航链接，保留版权、RSS 与备案号", async () => {
		const footerSource = await readFile("src/components/Footer.astro", "utf8");

		assert.ok(!footerSource.includes('class="footer-links"'));
		assert.ok(!footerSource.includes('href="/blog"'));
		assert.ok(!footerSource.includes('href="/search"'));
		assert.ok(!footerSource.includes('href="/sitemap.xml"'));
		assert.match(footerSource, /href="\/rss\.xml"/u);
		assert.match(footerSource, /footer-meta/u);
		assert.match(footerSource, /icp\.gov\.moe\/\?keyword=20260256/u);
		assert.match(footerSource, /萌ICP备20260256号/u);
		assert.match(footerSource, /target="_blank"/u);
	});

	test("页脚回归自然文档流，不再使用固定定位弹窗遮挡正文", async () => {
		const [baseLayoutSource, globalStylesSource] = await Promise.all([
			readFile("src/layouts/Base.astro", "utf8"),
			readFile("src/styles/global.css", "utf8"),
		]);

		assert.ok(!baseLayoutSource.includes("footer-reveal.js"));
		assert.match(
			globalStylesSource,
			/\.site-footer\s*\{[\s\S]*?margin-top:\s*auto;/u,
		);
		assert.doesNotMatch(
			globalStylesSource,
			/\.site-footer\s*\{[^}]*position:\s*fixed/u,
		);
	});

	test("页脚面板会跟随首页卡片透明度与高斯模糊参数", async () => {
		const globalStylesSource = await readFile("src/styles/global.css", "utf8");

		assert.match(
			globalStylesSource,
			/\.footer-inner\s*\{[\s\S]*?--glass-panel-opacity:\s*calc\(var\(--hero-card-opacity,\s*14\)\s*\/\s*100\);[\s\S]*?--glass-panel-blur:\s*var\(--hero-card-blur,\s*18px\);/u,
		);
	});
});
