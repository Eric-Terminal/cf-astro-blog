import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	buildBackgroundImageUrl,
	buildHeroActionLinks,
	buildSiteNavLinks,
	DEFAULT_SITE_APPEARANCE,
	normalizeSiteAppearanceInput,
} from "../../src/lib/site-appearance";

describe("站点外观设置", () => {
	test("normalizeSiteAppearanceInput 会约束裁切和模糊范围", () => {
		const normalized = normalizeSiteAppearanceInput({
			backgroundImageKey: "appearance/background/2026-03-07/example.webp",
			backgroundBlur: 88,
			backgroundScale: 220,
			backgroundPositionX: -10,
			backgroundPositionY: 140,
			heroCardOpacity: 2,
			heroCardBlur: 77,
			postCardOpacity: 80,
			postCardBlur: -6,
		});

		assert.equal(
			normalized.backgroundImageKey,
			"appearance/background/2026-03-07/example.webp",
		);
		assert.equal(normalized.backgroundBlur, 60);
		assert.equal(normalized.backgroundScale, 180);
		assert.equal(normalized.backgroundPositionX, 0);
		assert.equal(normalized.backgroundPositionY, 100);
		assert.equal(normalized.heroCardOpacity, 4);
		assert.equal(normalized.heroCardBlur, 48);
		assert.equal(normalized.postCardOpacity, 40);
		assert.equal(normalized.postCardBlur, 0);
	});

	test("normalizeSiteAppearanceInput 会回退到默认值", () => {
		const normalized = normalizeSiteAppearanceInput({
			backgroundImageKey: "%%%bad-key%%%",
			navLink1Href: "javascript:alert(1)",
			heroPrimaryHref: "ftp://bad.example.com",
			heroTitle: "",
		});

		assert.deepEqual(normalized, DEFAULT_SITE_APPEARANCE);
	});

	test("normalizeSiteAppearanceInput 会保留合法的文案与链接", () => {
		const normalized = normalizeSiteAppearanceInput({
			headerSubtitle: "我的状态栏",
			navLink1Label: "文档",
			navLink1Href: "https://example.com/docs",
			heroTitle: "新的首页主标题",
			heroIntro: "新的简介内容",
			heroSecondaryHref: "/search?tag=astro",
		});

		assert.equal(normalized.headerSubtitle, "我的状态栏");
		assert.equal(normalized.navLink1Label, "文档");
		assert.equal(normalized.navLink1Href, "https://example.com/docs");
		assert.equal(normalized.heroTitle, "新的首页主标题");
		assert.equal(normalized.heroIntro, "新的简介内容");
		assert.equal(normalized.heroSecondaryHref, "/search?tag=astro");
	});

	test("normalizeSiteAppearanceInput 支持首屏预留图路径", () => {
		const normalized = normalizeSiteAppearanceInput({
			heroMainImagePath: "appearance/home/main.webp",
		});

		assert.equal(
			normalized.heroMainImagePath,
			"/media/appearance/home/main.webp",
		);
	});

	test("buildSiteNavLinks 会按顺序生成顶部导航数据", () => {
		const links = buildSiteNavLinks(DEFAULT_SITE_APPEARANCE);

		assert.equal(links.length, 3);
		assert.deepEqual(links[0], { label: "首页", href: "/" });
		assert.deepEqual(links[1], { label: "归档", href: "/blog" });
		assert.deepEqual(links[2], { label: "搜索", href: "/search" });
	});

	test("normalizeSiteAppearanceInput 支持动态导航与按钮", () => {
		const normalized = normalizeSiteAppearanceInput({
			navLinks: [
				{ label: "项目", href: "/projects" },
				{ label: "友链", href: "https://example.com/friends" },
			],
			heroActions: [
				{ label: "看文章", href: "/blog" },
				{ label: "看项目", href: "/projects" },
				{ label: "看搜索", href: "/search" },
			],
		});

		assert.equal(normalized.navLinks.length, 2);
		assert.deepEqual(normalized.navLinks[0], {
			label: "项目",
			href: "/projects",
		});
		assert.deepEqual(normalized.navLinks[1], {
			label: "友链",
			href: "https://example.com/friends",
		});
		assert.equal(normalized.heroActions.length, 3);
		assert.equal(normalized.heroPrimaryLabel, "看文章");
		assert.equal(normalized.heroSecondaryLabel, "看项目");
	});

	test("buildHeroActionLinks 会在动态按钮缺失时回退默认值", () => {
		const links = buildHeroActionLinks({
			...DEFAULT_SITE_APPEARANCE,
			heroActions: [] as Array<{ label: string; href: string }>,
		});

		assert.equal(links.length, 2);
		assert.deepEqual(links[0], { label: "进入归档", href: "/blog" });
		assert.deepEqual(links[1], { label: "站内搜索", href: "/search" });
	});

	test("buildBackgroundImageUrl 会生成公开媒体地址", () => {
		assert.equal(
			buildBackgroundImageUrl("appearance/background/2026-03-07/example.webp"),
			"/media/appearance/background/2026-03-07/example.webp",
		);
		assert.equal(buildBackgroundImageUrl(null), null);
	});
});
