import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

describe("页脚精简保护", () => {
	test("页脚不再渲染重复的小导航链接", async () => {
		const footerSource = await readFile("src/components/Footer.astro", "utf8");

		assert.ok(!footerSource.includes('class="footer-links"'));
		assert.ok(!footerSource.includes('href="/blog"'));
		assert.ok(!footerSource.includes('href="/search"'));
		assert.ok(!footerSource.includes('href="/sitemap.xml"'));
		assert.match(footerSource, /footer-meta/u);
		assert.match(footerSource, /icp\.gov\.moe\/\?keyword=20260163/u);
		assert.match(footerSource, /萌ICP备20260163号/u);
		assert.match(footerSource, /target="_blank"/u);
	});

	test("页脚会在接近页面底部时缓慢上浮出现", async () => {
		const [
			footerSource,
			baseLayoutSource,
			globalStylesSource,
			footerScriptSource,
		] = await Promise.all([
			readFile("src/components/Footer.astro", "utf8"),
			readFile("src/layouts/Base.astro", "utf8"),
			readFile("src/styles/global.css", "utf8"),
			readFile("public/footer-reveal.js", "utf8"),
		]);

		assert.match(footerSource, /data-footer-reveal/u);
		assert.match(baseLayoutSource, /footer-reveal\.js/u);
		assert.match(globalStylesSource, /--footer-reveal-space:/u);
		assert.match(globalStylesSource, /\.site-footer\.is-visible/u);
		assert.match(footerScriptSource, /remaining <=/u);
		assert.match(footerScriptSource, /is-visible/u);
	});

	test("页脚浮层会跟随首页卡片透明度与高斯模糊参数", async () => {
		const globalStylesSource = await readFile("src/styles/global.css", "utf8");

		assert.match(
			globalStylesSource,
			/\.footer-inner\s*\{[\s\S]*?--glass-panel-opacity:\s*calc\(var\(--hero-card-opacity,\s*14\)\s*\/\s*100\);[\s\S]*?--glass-panel-blur:\s*var\(--hero-card-blur,\s*18px\);/u,
		);
	});
});
