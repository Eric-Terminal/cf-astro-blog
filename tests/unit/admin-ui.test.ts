import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import { adminLayout } from "../../src/admin/views/layout";
import { loginPage } from "../../src/admin/views/login";

describe("后台界面风格保护", () => {
	test("后台布局会渲染主页同风格的浮层骨架和当前导航态", () => {
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

	test("登录页会复用后台视觉语言并保留 GitHub OAuth 入口", () => {
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

	test("外观页提供顶部状态栏与首页文案编辑入口", async () => {
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
		assert.match(source, /heroMainImagePath/u);
		assert.match(source, /heroSignalHeading/u);
		assert.match(source, /heroTopicText/u);
		assert.match(source, /heroWritingText/u);
	});

	test("文章封面上传会回填隐藏字段用于持久化保存", async () => {
		const editorSource = await readFile(
			"src/admin/views/posts/editor.ts",
			"utf8",
		);
		const adminScriptSource = await readFile("public/admin.js", "utf8");

		assert.match(editorSource, /data-cover-key-input="true"/u);
		assert.match(adminScriptSource, /\[data-cover-key-input='true'\]/u);
		assert.match(adminScriptSource, /uploader\.closest\("\.form-group"\)/u);
	});

	test("外观页首屏图片预留位支持拖拽上传并自动回填路径", async () => {
		const [appearanceSource, adminScriptSource] = await Promise.all([
			readFile("src/admin/routes/appearance.ts", "utf8"),
			readFile("public/admin.js", "utf8"),
		]);

		assert.match(appearanceSource, /data-hero-image-uploader="true"/u);
		assert.match(appearanceSource, /data-hero-image-dropzone="true"/u);
		assert.match(appearanceSource, /data-hero-image-path-input="true"/u);
		assert.match(appearanceSource, /data-hero-image-file-input="true"/u);
		assert.match(appearanceSource, /\/api\/admin\/media\/upload-async/u);
		assert.match(adminScriptSource, /\[data-hero-image-uploader='true'\]/u);
		assert.match(adminScriptSource, /首屏图片上传成功/u);
	});

	test("媒体文件读取与删除使用通配参数提取键名，避免 /api 前缀重写误删", async () => {
		const mediaRouteSource = await readFile(
			"src/admin/routes/media.ts",
			"utf8",
		);

		assert.match(mediaRouteSource, /media\.get\("\/file\/\*"/u);
		assert.match(mediaRouteSource, /media\.post\("\/delete\/\*"/u);
		assert.match(mediaRouteSource, /c\.req\.param\("\*"\)/u);
		assert.ok(
			!mediaRouteSource.includes(
				'c.req.path.replace("/api/admin/media/file/", "")',
			),
		);
		assert.ok(
			!mediaRouteSource.includes(
				'c.req.path.replace("/api/admin/media/delete/", "")',
			),
		);
	});
});
