import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import { adminLayout } from "../../src/admin/views/layout";
import { loginPage } from "../../src/admin/views/login";

describe("后台界面风格保护喵", () => {
	test("后台布局会渲染主页同风格的浮层骨架和当前导航态喵", () => {
		const html = adminLayout("文章", "<h1>文章</h1>", {
			csrfToken: "csrf-token",
		});

		assert.match(html, /class="admin-shell"/u);
		assert.match(html, /class="sidebar-panel"/u);
		assert.match(html, /主页同款视觉/u);
		assert.match(html, /class="admin-toolbar"/u);
		assert.match(html, /href="\/api\/admin\/posts" class="active"/u);
		assert.match(html, /退出登录/u);
	});

	test("登录页会复用后台视觉语言并保留 GitHub OAuth 入口喵", () => {
		const html = loginPage({
			githubLogin: "Eric-Terminal",
			oauthEnabled: true,
		});

		assert.match(html, /class="login-shell"/u);
		assert.match(html, /class="login-hero"/u);
		assert.match(html, /主页同款后台/u);
		assert.match(html, /GitHub OAuth/u);
		assert.match(html, /\/api\/auth\/github/u);
	});

	test("外观页提供顶部状态栏与首页文案编辑入口喵", async () => {
		const source = await readFile("src/admin/routes/appearance.ts", "utf8");

		assert.match(source, /headerSubtitle/u);
		assert.match(source, /data-link-add="nav"/u);
		assert.match(source, /navLinkLabel/u);
		assert.match(source, /navLinkHref/u);
		assert.match(source, /data-link-add="hero"/u);
		assert.match(source, /heroActionLabel/u);
		assert.match(source, /heroActionHref/u);
		assert.match(source, /heroTitle/u);
		assert.match(source, /heroIntro/u);
		assert.match(source, /heroLandscapeImagePath/u);
		assert.match(source, /heroPortraitImagePath/u);
		assert.match(source, /heroSignalHeading/u);
		assert.match(source, /heroTopicText/u);
		assert.match(source, /heroWritingText/u);
	});
});
