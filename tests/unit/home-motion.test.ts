import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

describe("首页灵动交互与编辑级首屏保护", () => {
	test("基础布局会加载首页交互脚本", async () => {
		const baseLayoutSource = await readFile("src/layouts/Base.astro", "utf8");

		assert.match(baseLayoutSource, /home-motion\.js/u);
		assert.match(baseLayoutSource, /site-shell-has-background-image/u);
	});

	test("首页首屏采用非对称双舱 Bento 舞台，完整保留主图视窗、右侧立绘名片、动态索引与棱镜追光边框", async () => {
		const [homePageSource, globalStyleSource] = await Promise.all([
			readFile("src/pages/index.astro", "utf8"),
			readFile("src/styles/global.css", "utf8"),
		]);

		assert.match(homePageSource, /home-bento-stage/u);
		assert.match(homePageSource, /hero-masthead-deck/u);
		assert.match(homePageSource, /masthead-spotlight-bar/u);
		assert.match(homePageSource, /data-hero-depth/u);
		assert.match(homePageSource, /data-tilt-card/u);
		assert.match(homePageSource, /hero-signal-card/u);
		assert.match(homePageSource, /homepageAppearance\.heroMainImagePath &&/u);
		assert.match(homePageSource, /homepageAppearance\.heroSignalImagePath &&/u);
		assert.match(homePageSource, /homepageAppearance\.heroSignalHeading/u);
		assert.match(homePageSource, /homepageAppearance\.heroSignalCopy/u);
		assert.match(homePageSource, /heroActions\.map/u);
		assert.match(homePageSource, /hero-dispatch/u);
		assert.match(homePageSource, /repeat\(2,\s*minmax\(0,\s*1fr\)\)/u);
		assert.ok(!homePageSource.includes("hero-atmosphere"));
		assert.ok(!homePageSource.includes("图片预留位"));
		assert.match(globalStyleSource, /\[data-tilt-card\]\.glass-panel::before/u);
		assert.match(globalStyleSource, /mask-composite:\s*exclude/u);
	});

	test("首页会单独渲染置顶文章板块并将最近更新与置顶分离", async () => {
		const homePageSource = await readFile("src/pages/index.astro", "utf8");

		assert.match(homePageSource, /置顶文章/u);
		assert.match(homePageSource, /eq\(blogPosts\.isPinned, true\)/u);
		assert.match(homePageSource, /eq\(blogPosts\.isPinned, false\)/u);
		assert.match(homePageSource, /recentSectionSubheading/u);
	});

	test("首页仅在存在置顶文章时渲染置顶栏目", async () => {
		const homePageSource = await readFile("src/pages/index.astro", "utf8");

		assert.match(homePageSource, /pinnedPosts\.length > 0 &&/u);
	});

	test("首页交互脚本会在切页后重新初始化并驱动 3D 倾斜与光学反光变量", async () => {
		const homeMotionSource = await readFile("public/home-motion.js", "utf8");

		assert.match(homeMotionSource, /astro:page-load/u);
		assert.match(homeMotionSource, /astro:before-swap/u);
		assert.match(homeMotionSource, /--hero-pointer-x/u);
		assert.match(homeMotionSource, /--tilt-rotate-x/u);
		assert.match(homeMotionSource, /--tilt-spot-x/u);
		assert.match(homeMotionSource, /pointermove/u);
		assert.match(homeMotionSource, /mousemove/u);
		assert.match(homeMotionSource, /any-pointer:\s*fine/u);
	});

	test("首页首屏简介支持保留换行展示", async () => {
		const homePageSource = await readFile("src/pages/index.astro", "utf8");

		assert.match(homePageSource, /\.home-hero-copy \.page-intro/u);
		assert.match(homePageSource, /white-space:\s*pre-line/u);
	});
});
