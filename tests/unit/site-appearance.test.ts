import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	buildBackgroundImageUrl,
	buildHeroActionLinks,
	buildSiteNavLinks,
	DEFAULT_AI_SETTINGS,
	DEFAULT_SITE_APPEARANCE,
	normalizeAiSettingsInput,
	normalizeSiteAppearanceInput,
	resolveAiSettingsWithSecrets,
	resolveSiteDescriptionFromAppearance,
} from "../../src/lib/site-appearance";

describe("站点外观设置", () => {
	test("normalizeSiteAppearanceInput 会约束裁切和模糊范围", () => {
		const normalized = normalizeSiteAppearanceInput({
			backgroundImageKey: "appearance/background/2026-03-07/example.webp",
			backgroundOpacity: -8,
			backgroundBlur: 144,
			backgroundScale: 220,
			backgroundPositionX: -10,
			backgroundPositionY: 140,
			heroCardOpacity: -6,
			heroCardBlur: 177,
			postCardOpacity: 180,
			postCardBlur: -6,
			articlePanelOpacity: 160,
			articlePanelBlur: 130,
		});

		assert.equal(
			normalized.backgroundImageKey,
			"appearance/background/2026-03-07/example.webp",
		);
		assert.equal(normalized.backgroundOpacity, 0);
		assert.equal(normalized.backgroundBlur, 60);
		assert.equal(normalized.backgroundScale, 180);
		assert.equal(normalized.backgroundPositionX, 0);
		assert.equal(normalized.backgroundPositionY, 100);
		assert.equal(normalized.heroCardOpacity, 0);
		assert.equal(normalized.heroCardBlur, 48);
		assert.equal(normalized.postCardOpacity, 100);
		assert.equal(normalized.postCardBlur, 0);
		assert.equal(normalized.articlePanelOpacity, 100);
		assert.equal(normalized.articlePanelBlur, 48);
	});

	test("normalizeSiteAppearanceInput 会回退到默认值", () => {
		const normalized = normalizeSiteAppearanceInput({
			backgroundImageKey: "%%%bad-key%%%",
			navLink1Href: "javascript:alert(1)",
			heroPrimaryHref: "ftp://bad.example.com",
			heroTitle: "",
		});

		assert.equal(
			normalized.backgroundImageKey,
			DEFAULT_SITE_APPEARANCE.backgroundImageKey,
		);
		assert.equal(normalized.heroTitle, DEFAULT_SITE_APPEARANCE.heroTitle);
		assert.equal(normalized.navLink1Href, "/");
		assert.equal(normalized.navLink2Href, "/blog");
		assert.equal(
			normalized.navLinks.some((item) => item.href === "/friends"),
			true,
		);
		assert.equal(normalized.heroPrimaryHref, "/blog");
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

	test("normalizeSiteAppearanceInput 支持右侧信息卡图片与标签", () => {
		const normalized = normalizeSiteAppearanceInput({
			heroSignalImagePath: "appearance/home/signal.webp",
			heroSignalChip1: "指针联动",
			heroSignalChip2: "柔和轨道",
			heroSignalChip3: "卡片抬升",
		});

		assert.equal(
			normalized.heroSignalImagePath,
			"/media/appearance/home/signal.webp",
		);
		assert.equal(normalized.heroSignalChip1, "指针联动");
		assert.equal(normalized.heroSignalChip2, "柔和轨道");
		assert.equal(normalized.heroSignalChip3, "卡片抬升");
	});

	test("normalizeSiteAppearanceInput 支持文章页左侧栏头像与简介", () => {
		const normalized = normalizeSiteAppearanceInput({
			articleSidebarAvatarPath: "appearance/profile/avatar.webp",
			articleSidebarName: "Eric-Terminal",
			articleSidebarBadge: "站点作者",
			articleSidebarBio: "这里放作者简介，用于文章页左侧信息栏展示。",
		});

		assert.equal(
			normalized.articleSidebarAvatarPath,
			"/media/appearance/profile/avatar.webp",
		);
		assert.equal(normalized.articleSidebarName, "Eric-Terminal");
		assert.equal(normalized.articleSidebarBadge, "站点作者");
		assert.equal(
			normalized.articleSidebarBio,
			"这里放作者简介，用于文章页左侧信息栏展示。",
		);
	});

	test("normalizeSiteAppearanceInput 支持 MCP 开关并回退默认值", () => {
		const enabled = normalizeSiteAppearanceInput({
			mcpEnabled: "1",
		});
		assert.equal(enabled.mcpEnabled, true);

		const disabled = normalizeSiteAppearanceInput({
			mcpEnabled: "false",
		});
		assert.equal(disabled.mcpEnabled, false);

		const fallback = normalizeSiteAppearanceInput({
			mcpEnabled: "not-bool",
		});
		assert.equal(fallback.mcpEnabled, DEFAULT_SITE_APPEARANCE.mcpEnabled);
	});

	test("normalizeAiSettingsInput 支持 OpenAI 兼容接口配置", () => {
		const normalized = normalizeAiSettingsInput({
			aiInternalEnabled: "1",
			aiInternalBaseUrl: "https://api.openai.com/v1/",
			aiInternalApiKey: "sk-internal",
			aiInternalModel: "gpt-4.1-mini",
			aiPublicEnabled: "true",
			aiPublicBaseUrl: "https://llm.example.com/v1/",
			aiPublicApiKey: "sk-public",
			aiPublicModel: "qwen-plus",
		});

		assert.equal(normalized.internal.enabled, true);
		assert.equal(normalized.internal.baseUrl, "https://api.openai.com/v1");
		assert.equal(normalized.internal.apiKey, "sk-internal");
		assert.equal(normalized.internal.model, "gpt-4.1-mini");
		assert.equal(normalized.public.enabled, true);
		assert.equal(normalized.public.baseUrl, "https://llm.example.com/v1");
		assert.equal(normalized.public.apiKey, "sk-public");
		assert.equal(normalized.public.model, "qwen-plus");
	});

	test("normalizeAiSettingsInput 在非法值下会回退默认配置", () => {
		const normalized = normalizeAiSettingsInput({
			aiInternalEnabled: "not-bool",
			aiInternalBaseUrl: "javascript:alert(1)",
			aiInternalApiKey: "",
			aiInternalModel: "",
		});

		assert.deepEqual(normalized.internal, DEFAULT_AI_SETTINGS.internal);
		assert.deepEqual(normalized.public, DEFAULT_AI_SETTINGS.public);
	});

	test("resolveAiSettingsWithSecrets 会优先使用 Cloudflare Secret", () => {
		const resolved = resolveAiSettingsWithSecrets(
			{
				internal: {
					enabled: true,
					baseUrl: "https://api.openai.com/v1",
					apiKey: "sk-web-internal",
					model: "gpt-4o-mini",
				},
				public: {
					enabled: true,
					baseUrl: "https://llm.example.com/v1",
					apiKey: "sk-web-public",
					model: "qwen-plus",
				},
			},
			{
				AI_INTERNAL_API_KEY: "sk-secret-internal",
				AI_PUBLIC_API_KEY: "",
			},
		);

		assert.equal(resolved.settings.internal.apiKey, "sk-secret-internal");
		assert.equal(resolved.settings.public.apiKey, "sk-web-public");
		assert.equal(resolved.keySource.internal, "cloudflare-secret");
		assert.equal(resolved.keySource.public, "web-config");
	});

	test("resolveSiteDescriptionFromAppearance 会优先使用首页简介", () => {
		const description = resolveSiteDescriptionFromAppearance(
			{
				heroIntro: "  第一行\n第二行  ",
				headerSubtitle: "顶部副标题",
			},
			"默认描述",
		);

		assert.equal(description, "第一行 第二行");
	});

	test("resolveSiteDescriptionFromAppearance 会在简介为空时回退顶部文案", () => {
		const description = resolveSiteDescriptionFromAppearance(
			{
				heroIntro: " ",
				headerSubtitle: "顶部副标题",
			},
			"默认描述",
		);

		assert.equal(description, "顶部副标题");
	});

	test("resolveSiteDescriptionFromAppearance 会在外观为空时回退默认描述", () => {
		const description = resolveSiteDescriptionFromAppearance(
			{
				heroIntro: " ",
				headerSubtitle: " ",
			},
			"默认描述",
		);

		assert.equal(description, "默认描述");
	});

	test("buildSiteNavLinks 会按顺序生成顶部导航数据", () => {
		const links = buildSiteNavLinks(DEFAULT_SITE_APPEARANCE);

		assert.equal(links.length, 4);
		assert.deepEqual(links[0], { label: "首页", href: "/" });
		assert.deepEqual(links[1], { label: "归档", href: "/blog" });
		assert.deepEqual(links[2], { label: "友链", href: "/friends" });
		assert.deepEqual(links[3], { label: "搜索", href: "/search" });
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

		assert.equal(normalized.navLinks.length, 3);
		assert.deepEqual(normalized.navLinks[0], {
			label: "项目",
			href: "/projects",
		});
		assert.deepEqual(normalized.navLinks[1], {
			label: "友链",
			href: "https://example.com/friends",
		});
		assert.deepEqual(normalized.navLinks[2], {
			label: "友链",
			href: "/friends",
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
