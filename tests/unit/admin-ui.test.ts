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
		assert.match(html, /href="\/api\/admin\/mentions"/u);
		assert.match(html, />提及</u);
		assert.match(html, /退出登录/u);
	});

	test("登录页会复用后台视觉语言并保留 GitHub OAuth 入口", () => {
		const html = loginPage({
			githubLogin: "Eric-Terminal",
			oauthEnabled: true,
		});

		assert.match(html, /class="login-shell"/u);
		assert.ok(!html.includes('class="login-hero"'));
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
		assert.match(source, /heroSignalImagePath/u);
		assert.match(source, /heroSignalChip1/u);
		assert.match(source, /heroSignalChip2/u);
		assert.match(source, /heroSignalChip3/u);
		assert.match(source, /articleSidebarAvatarPath/u);
		assert.match(source, /articleSidebarName/u);
		assert.match(source, /articleSidebarBadge/u);
		assert.match(source, /articleSidebarBio/u);
		assert.match(source, /aiInternalEnabled/u);
		assert.match(source, /aiInternalBaseUrl/u);
		assert.match(source, /aiInternalApiKey/u);
		assert.match(source, /aiInternalModel/u);
		assert.match(source, /aiPublicEnabled/u);
		assert.match(source, /aiPublicBaseUrl/u);
		assert.match(source, /aiPublicApiKey/u);
		assert.match(source, /aiPublicModel/u);
		assert.match(source, /mcpEnabled/u);
		assert.match(source, /启用 MCP 接口/u);
		assert.doesNotMatch(
			source,
			/value="\$\{escapeAttribute\(aiSettings\.internal\.apiKey\)\}"/u,
		);
		assert.doesNotMatch(
			source,
			/value="\$\{escapeAttribute\(aiSettings\.public\.apiKey\)\}"/u,
		);
		assert.match(source, /留空表示不修改当前 Key/u);
		assert.match(source, /Cloudflare Secret/u);
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
		assert.match(adminScriptSource, /resolveEditorPostMediaScope/u);
		assert.match(adminScriptSource, /uploadKind: "cover"/u);
		assert.match(adminScriptSource, /uploadKind: "content"/u);
	});

	test("文章编辑页状态与分类联动使用隐藏显示逻辑", async () => {
		const [editorSource, adminScriptSource] = await Promise.all([
			readFile("src/admin/views/posts/editor.ts", "utf8"),
			readFile("public/admin.js", "utf8"),
		]);

		assert.ok(editorSource.includes("schedule-field"));
		assert.ok(editorSource.includes("is-hidden"));
		assert.match(editorSource, /new-category-wrap is-hidden/u);
		assert.ok(
			adminScriptSource.includes('classList.toggle("is-hidden", !isScheduled)'),
		);
		assert.ok(
			adminScriptSource.includes(
				'classList.toggle("is-hidden", !isCreatingNew)',
			),
		);
	});

	test("文章编辑页支持首页置顶开关与置顶顺序输入", async () => {
		const [editorSource, listSource] = await Promise.all([
			readFile("src/admin/views/posts/editor.ts", "utf8"),
			readFile("src/admin/views/posts/list.ts", "utf8"),
		]);

		assert.match(editorSource, /name="isPinned"/u);
		assert.match(editorSource, /name="pinnedOrder"/u);
		assert.match(editorSource, /首页置顶文章/u);
		assert.match(listSource, /置顶/u);
		assert.match(listSource, /置顶 #/u);
	});

	test("文章编辑页提供 Markdown 实时预览区域", async () => {
		const [editorSource, adminScriptSource, layoutSource] = await Promise.all([
			readFile("src/admin/views/posts/editor.ts", "utf8"),
			readFile("public/admin.js", "utf8"),
			readFile("src/admin/views/layout.ts", "utf8"),
		]);

		assert.match(editorSource, /data-markdown-preview="true"/u);
		assert.match(editorSource, /markdown-editor-shell/u);
		assert.match(editorSource, /data-editor-draft-scope=/u);
		assert.match(editorSource, /data-draft-status="true"/u);
		assert.match(editorSource, /data-draft-restore="true"/u);
		assert.match(adminScriptSource, /\[data-markdown-preview='true'\]/u);
		assert.match(adminScriptSource, /renderMarkdownPreview/u);
		assert.match(adminScriptSource, /extractPreviewSpoilerShortcodes/u);
		assert.match(adminScriptSource, /EDITOR_DRAFT_STORAGE_PREFIX/u);
		assert.match(adminScriptSource, /initEditorDraft/u);
		assert.match(layoutSource, /markdown-preview-body/u);
		assert.match(layoutSource, /markdown-preview-spoiler/u);
		assert.match(layoutSource, /draft-toolbar/u);
	});

	test("文章编辑页支持手动触发 AI 生成摘要与 SEO 并回填表单", async () => {
		const [editorSource, adminScriptSource] = await Promise.all([
			readFile("src/admin/views/posts/editor.ts", "utf8"),
			readFile("public/admin.js", "utf8"),
		]);

		assert.match(editorSource, /data-ai-seo-generate="true"/u);
		assert.match(
			editorSource,
			/data-ai-seo-endpoint="\/api\/admin\/posts\/ai-seo"/u,
		);
		assert.match(editorSource, /data-ai-seo-status/u);
		assert.match(adminScriptSource, /triggerAiSeoGeneration/u);
		assert.match(adminScriptSource, /applyGeneratedSeoFieldsToEditor/u);
		assert.match(adminScriptSource, /AI 已回填/u);
	});

	test("文章列表提供取消定时和历史分类标签删除入口", async () => {
		const source = await readFile("src/admin/views/posts/list.ts", "utf8");

		assert.match(source, /cancel-schedule/u);
		assert.match(source, /历史分类管理/u);
		assert.match(source, /历史标签管理/u);
		assert.ok(source.includes("/api/admin/posts/categories/"));
		assert.ok(source.includes("/api/admin/posts/tags/"));
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

	test("外观页右侧卡片图片支持拖拽上传并自动回填路径", async () => {
		const [appearanceSource, adminScriptSource] = await Promise.all([
			readFile("src/admin/routes/appearance.ts", "utf8"),
			readFile("public/admin.js", "utf8"),
		]);

		assert.match(appearanceSource, /data-signal-image-uploader="true"/u);
		assert.match(appearanceSource, /data-signal-image-dropzone="true"/u);
		assert.match(appearanceSource, /data-signal-image-path-input="true"/u);
		assert.match(appearanceSource, /data-signal-image-file-input="true"/u);
		assert.match(adminScriptSource, /\[data-signal-image-uploader='true'\]/u);
		assert.match(adminScriptSource, /右侧卡片图片上传成功/u);
	});

	test("外观页透明度与模糊参数统一为 0-100 透明度语义，并绑定完整滑块监听", async () => {
		const [appearanceSource, adminScriptSource] = await Promise.all([
			readFile("src/admin/routes/appearance.ts", "utf8"),
			readFile("public/admin.js", "utf8"),
		]);

		assert.match(appearanceSource, /背景透明度/u);
		assert.match(
			appearanceSource,
			/id="backgroundTransparency"[\s\S]*min="0" max="100"/u,
		);
		assert.match(
			appearanceSource,
			/id="heroCardTransparency"[\s\S]*min="0" max="100"/u,
		);
		assert.match(
			appearanceSource,
			/id="articlePanelTransparency"[\s\S]*min="0" max="100"/u,
		);
		assert.match(
			appearanceSource,
			/id="backgroundBlur"[\s\S]*min="0" max="60"/u,
		);
		assert.match(appearanceSource, /id="heroCardBlur"[\s\S]*min="0" max="48"/u);
		assert.match(
			appearanceSource,
			/id="articlePanelBlur"[\s\S]*min="0" max="48"/u,
		);
		assert.match(appearanceSource, /convertTransparencyToOpacity/u);

		assert.ok(
			adminScriptSource.includes(
				'[data-appearance-control="backgroundTransparency"]',
			),
		);
		assert.ok(
			adminScriptSource.includes(
				'[data-appearance-control="articlePanelTransparency"]',
			),
		);
		assert.ok(
			adminScriptSource.includes(
				'[data-appearance-control="articlePanelBlur"]',
			),
		);
		assert.match(adminScriptSource, /name === "articlePanelBlur"/u);
	});

	test("媒体文件读取与删除使用通配参数提取键名，避免 /api 前缀重写误删", async () => {
		const [mediaRouteSource, layoutSource] = await Promise.all([
			readFile("src/admin/routes/media.ts", "utf8"),
			readFile("src/admin/views/layout.ts", "utf8"),
		]);

		assert.match(mediaRouteSource, /media\.get\("\/file\/\*"/u);
		assert.match(mediaRouteSource, /media\.post\("\/delete\/\*"/u);
		assert.match(mediaRouteSource, /extractWildcardMediaKey/u);
		assert.match(mediaRouteSource, /uploadScope/u);
		assert.match(mediaRouteSource, /uploadKind/u);
		assert.ok(
			mediaRouteSource.includes(`posts/\${uploadScope}/\${uploadKind}`),
		);
		assert.match(mediaRouteSource, /media-directory/u);
		assert.match(layoutSource, /\.media-directory/u);
		assert.ok(mediaRouteSource.includes('c.req.param("0")'));
		assert.ok(mediaRouteSource.includes('"/admin/media/file/"'));
		assert.ok(mediaRouteSource.includes('"/admin/media/delete/"'));
		assert.ok(mediaRouteSource.includes('replace(/^\\/+/u, "")'));
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

	test("友链与提及审核页使用结构化卡片布局，避免信息遮挡", async () => {
		const [friendsSource, mentionsSource, layoutSource] = await Promise.all([
			readFile("src/admin/routes/friends.ts", "utf8"),
			readFile("src/admin/routes/mentions.ts", "utf8"),
			readFile("src/admin/views/layout.ts", "utf8"),
		]);

		assert.match(
			friendsSource,
			/<details class="appearance-panel review-card friend-review-item">/u,
		);
		assert.match(mentionsSource, /class="appearance-panel review-card"/u);
		assert.match(friendsSource, /friend-review-summary/u);
		assert.match(friendsSource, /friend-review-content/u);
		assert.match(friendsSource, /review-card-body/u);
		assert.match(mentionsSource, /review-card-body/u);
		assert.match(friendsSource, /toLocaleString\("zh-CN"/u);
		assert.match(mentionsSource, /toLocaleString\("zh-CN"/u);
		assert.doesNotMatch(friendsSource, /待审核（/u);
		assert.doesNotMatch(friendsSource, /已通过（/u);
		assert.doesNotMatch(friendsSource, /已拒绝（/u);
		assert.doesNotMatch(friendsSource, /已下架（/u);
		assert.match(layoutSource, /\.review-card/u);
		assert.match(layoutSource, /\.friend-review-summary/u);
		assert.match(layoutSource, /\.review-item-value/u);
		assert.match(layoutSource, /\.appearance-inline-grid/u);
	});
});
