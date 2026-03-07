import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

describe("导航收缩动画保护", () => {
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
		assert.ok(headerSource.includes("width var(--nav-motion-main)"));
		assert.ok(!headerSource.includes("max-width var(--nav-motion-main)"));
		assert.ok(headerSource.includes("padding var(--nav-motion-main)"));
		assert.match(globalStylesSource, /--nav-shell-max-width:/u);
		assert.match(globalStylesSource, /--nav-shell-condensed-scale:/u);
	});
});
