import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";
import {
	hashPassword,
	isLegacyPasswordHash,
	verifyPassword,
} from "../../src/lib/password";
import {
	buildUrlSlug,
	renderSafeMarkdown,
	renderSafeMarkdownWithToc,
	sanitizeCanonicalUrl,
	sanitizeSlug,
} from "../../src/lib/security";

describe("安全工具", () => {
	test("renderSafeMarkdown 会转义原始 HTML ", async () => {
		const html = await renderSafeMarkdown(
			'# 标题\n<script>alert("xss")</script>',
		);

		assert.match(html, /<h1 id="标题">标题<\/h1>/u);
		assert.ok(!html.includes("<script>"));
		assert.ok(html.includes("&lt;script&gt;alert"));
	});

	test("renderSafeMarkdown 会拒绝 javascript 链接与协议相对链接", async () => {
		const html = await renderSafeMarkdown(
			"[危险链接](javascript:alert(1)) [外链](//evil.example.com)",
		);

		assert.ok(!html.includes("javascript:"));
		assert.ok(!html.includes("//evil.example.com"));
		assert.match(html, /危险链接/u);
		assert.match(html, /外链/u);
		assert.ok(!html.includes("<a href="));
	});

	test("renderSafeMarkdown 不允许把 mailto 用作图片地址", async () => {
		const html = await renderSafeMarkdown("![封面](mailto:test@example.com)");

		assert.ok(!html.includes("<img"));
		assert.match(html, /封面/u);
	});

	test("renderSafeMarkdown 会保留段内单换行", async () => {
		const html = await renderSafeMarkdown("第一行\n第二行\n第三行");

		assert.match(html, /<p>第一行<br>第二行<br>第三行<\/p>/u);
	});

	test("renderSafeMarkdown 支持 details 短代码语法", async () => {
		const html = await renderSafeMarkdown(
			'前文\n\n[details="总结"]\n隐藏 **内容**\n[/details]\n\n后文',
		);

		assert.match(
			html,
			/<details class="prose-details"><summary>总结<\/summary>/u,
		);
		assert.match(html, /隐藏 <strong>内容<\/strong>/u);
		assert.match(html, /<p>后文<\/p>/u);
	});

	test("renderSafeMarkdown 会转义 details 标题中的危险标签", async () => {
		const html = await renderSafeMarkdown(
			'[details="<img src=x onerror=alert(1)>"]\n测试\n[/details]',
		);

		assert.ok(!html.includes('onerror="'));
		assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/u);
	});

	test("renderSafeMarkdown 支持 spoiler 短代码语法", async () => {
		const html = await renderSafeMarkdown(
			"这是一段文本 [spoiler]此文本将被模糊处理[/spoiler] 结束。",
		);

		assert.match(
			html,
			/<span class="prose-spoiler">此文本将被模糊处理<\/span>/u,
		);
	});

	test("renderSafeMarkdown 会转义 spoiler 内的危险标签", async () => {
		const html = await renderSafeMarkdown(
			"[spoiler]<img src=x onerror=alert(1)>[/spoiler]",
		);

		assert.ok(!html.includes("<img"));
		assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/u);
	});

	test("renderSafeMarkdownWithToc 会返回标题目录并注入锚点 id", async () => {
		const { html, toc } = await renderSafeMarkdownWithToc(
			"# 页面标题\n\n## 近况\n文本\n\n### 开发体验\n更多文本",
		);

		assert.match(html, /<h2 id="近况">近况<\/h2>/u);
		assert.match(html, /<h3 id="开发体验">开发体验<\/h3>/u);
		assert.equal(toc.length, 2);
		assert.deepEqual(toc[0], { id: "近况", text: "近况", level: 2 });
		assert.deepEqual(toc[1], {
			id: "开发体验",
			text: "开发体验",
			level: 3,
		});
	});

	test("renderSafeMarkdownWithToc 会为重复标题追加序号", async () => {
		const { html, toc } = await renderSafeMarkdownWithToc(
			"## 重复标题\n内容 A\n\n## 重复标题\n内容 B",
		);

		assert.match(html, /<h2 id="重复标题">重复标题<\/h2>/u);
		assert.match(html, /<h2 id="重复标题-2">重复标题<\/h2>/u);
		assert.equal(toc.length, 2);
		assert.equal(toc[0]?.id, "重复标题");
		assert.equal(toc[1]?.id, "重复标题-2");
	});

	test("verifyPassword 支持新的 PBKDF2 哈希", async () => {
		const password = "correct-horse-battery-staple";
		const hash = await hashPassword(password);

		assert.ok(hash.startsWith("pbkdf2_sha256$"));
		assert.equal(isLegacyPasswordHash(hash), false);
		assert.equal(await verifyPassword(password, hash), true);
		assert.equal(await verifyPassword("wrong-password", hash), false);
	});

	test("verifyPassword 兼容旧版 SHA-256 哈希", async () => {
		const password = "legacy-password";
		const legacyHash = createHash("sha256").update(password).digest("hex");

		assert.equal(isLegacyPasswordHash(legacyHash), true);
		assert.equal(await verifyPassword(password, legacyHash), true);
		assert.equal(await verifyPassword("wrong-password", legacyHash), false);
	});

	test("buildUrlSlug 会把标题转成 URL 友好的路径", () => {
		assert.equal(buildUrlSlug("Hello Astro Blog"), "hello-astro-blog");
		assert.equal(buildUrlSlug("Cloudflare + D1 + R2"), "cloudflare-d1-r2");
		assert.equal(
			buildUrlSlug("在 UCG Fiber 上优雅地使用 SoftBank 10G"),
			"在-ucg-fiber-上优雅地使用-softbank-10g",
		);
	});

	test("buildUrlSlug 遇到无法转写的字符时会回退到前缀随机路径", () => {
		const slug = buildUrlSlug("🙂🙂", { fallbackPrefix: "post" });
		assert.match(slug, /^post-[0-9a-f]{8}$/u);
	});

	test("buildUrlSlug 支持长度限制", () => {
		const slug = buildUrlSlug("a".repeat(140), { maxLength: 24 });
		assert.equal(slug.length, 24);
	});

	test("sanitizeSlug 支持解析 URL 编码后的中文路径", () => {
		assert.equal(
			sanitizeSlug("%E5%9C%A8-ucg-fiber-%E4%B8%8A"),
			"在-ucg-fiber-上",
		);
	});

	test("sanitizeCanonicalUrl 仅允许 http 与 https 协议", () => {
		assert.equal(
			sanitizeCanonicalUrl("https://example.com/path?x=1"),
			"https://example.com/path?x=1",
		);
		assert.equal(sanitizeCanonicalUrl("mailto:admin@example.com"), null);
		assert.equal(sanitizeCanonicalUrl("javascript:alert(1)"), null);
	});

	// ── Typora 语法支持 ────────────────────────────────────────────────────

	test("renderSafeMarkdown 支持 Typora 高亮语法 ==text==", async () => {
		const html = await renderSafeMarkdown("这是一段 ==重要内容== 文本。");

		assert.match(
			html,
			/<mark class="prose-mark">重要内容<\/mark>/u,
		);
	});

	test("renderSafeMarkdown 会转义高亮语法中的危险标签", async () => {
		const html = await renderSafeMarkdown(
			"==<img src=x onerror=alert(1)>==",
		);

		assert.ok(!html.includes("<img"));
		assert.match(html, /&lt;img/u);
	});

	test("renderSafeMarkdown 支持 Typora 下划线语法 ++text++", async () => {
		const html = await renderSafeMarkdown("这是 ++下划线文本++ 示例。");

		assert.match(
			html,
			/<u class="prose-underline">下划线文本<\/u>/u,
		);
	});

	test("renderSafeMarkdown 支持 Typora 下标语法 ~text~", async () => {
		const html = await renderSafeMarkdown("H~2~O 是水的化学式。");

		assert.match(html, /H<sub class="prose-sub">2<\/sub>O/u);
	});

	test("renderSafeMarkdown 不与 GFM 删除线 ~~text~~ 冲突", async () => {
		const html = await renderSafeMarkdown("这是~~删除线~~，不是~下标~。");

		assert.match(html, /<del>删除线<\/del>/u);
		assert.match(html, /<sub class="prose-sub">下标<\/sub>/u);
	});

	test("renderSafeMarkdown 支持 Typora 上标语法 ^text^", async () => {
		const html = await renderSafeMarkdown("面积单位：m^2^。");

		assert.match(html, /m<sup class="prose-sup">2<\/sup>/u);
	});

	test("renderSafeMarkdown 支持 Typora emoji 语法 :emoji:", async () => {
		const html = await renderSafeMarkdown("这是一条 :smile: 消息 :heart:。");

		assert.ok(html.includes("😄"));
		assert.ok(html.includes("❤️"));
	});

	test("renderSafeMarkdown 支持脚注语法 [^id]", async () => {
		const html = await renderSafeMarkdown(
			"这是一段带有脚注的文本[^1]。\n\n[^1]: 这是脚注的内容。",
		);

		assert.match(html, /<sup class="prose-footnote-ref"/u);
		assert.match(html, /href="#fn-1"/u);
		assert.match(html, /<section class="prose-footnotes">/u);
		assert.match(html, /<li id="fn-1">/u);
		assert.match(html, /这是脚注的内容/u);
	});

	test("renderSafeMarkdown 支持 [TOC] 标记（会被移除）", async () => {
		const html = await renderSafeMarkdown(
			"[TOC]\n\n# 标题\n\n正文内容",
		);

		assert.ok(!html.includes("[TOC]"));
		assert.match(html, /<h1 id="标题">标题<\/h1>/u);
		assert.match(html, /正文内容/u);
	});

	test("renderSafeMarkdown 支持数学公式 $...$", async () => {
		const html = await renderSafeMarkdown("公式：$E = mc^2$");

		assert.ok(html.includes("katex"));
		assert.match(html, /E/u);
		assert.match(html, /mc/u);
	});

	test("renderSafeMarkdown 支持独立数学公式 $$...$$", async () => {
		const html = await renderSafeMarkdown("$$\n\\int_a^b f(x)\\,dx\n$$");

		assert.ok(html.includes("katex-display"));
		assert.ok(html.includes("\\int"));
	});

	test("renderSafeMarkdown 在 Typora 语法出错时不会崩溃", async () => {
		// 同时使用多种 Typora 语法，确保不会因边缘情况崩溃
		const html = await renderSafeMarkdown(
			[
				"# 综合测试",
				"",
				"这是一段 ==高亮== 和 ++下划线++ 的文本。",
				"",
				"H~2~O 和 m^2^。",
				":smile: :heart:",
				"",
				"脚注示例[^life]：",
				"",
				"[^life]: 生命、宇宙以及一切。",
				"",
				"公式：$a^2 + b^2 = c^2$",
				"",
				"[details=\"提示\"]",
				"这是折叠内容",
				"[/details]",
			].join("\n"),
		);

		assert.match(html, /<mark class="prose-mark">高亮<\/mark>/u);
		assert.match(html, /<u class="prose-underline">下划线<\/u>/u);
		assert.match(html, /<sub class="prose-sub">2<\/sub>/u);
		assert.match(html, /<sup class="prose-sup">2<\/sup>/u);
		assert.ok(html.includes("😄"));
		assert.ok(html.includes("❤️"));
		assert.match(html, /<section class="prose-footnotes">/u);
		assert.ok(html.includes("katex"));
		assert.match(html, /<details class="prose-details">/u);
	});

	// ── Callouts ──────────────────────────────────────────────────────────

	test("renderSafeMarkdown 支持 Callout > [!NOTE]", async () => {
		const html = await renderSafeMarkdown(
			"> [!NOTE]\n> 这是一个提示信息。\n> 第二行内容。",
		);

		assert.match(html, /<div class="prose-callout prose-callout-note">/u);
		assert.match(html, /<span class="prose-callout-label">NOTE<\/span>/u);
		assert.match(html, /这是一个提示信息/u);
		assert.match(html, /第二行内容/u);
	});

	test("renderSafeMarkdown 支持所有 Callout 类型", async () => {
		const html = await renderSafeMarkdown(
			[
				"> [!NOTE]\n> 注意",
				"",
				"> [!TIP]\n> 提示",
				"",
				"> [!IMPORTANT]\n> 重要",
				"",
				"> [!WARNING]\n> 警告",
				"",
				"> [!CAUTION]\n> 小心",
			].join("\n\n"),
		);

		assert.match(html, /prose-callout-note/u);
		assert.match(html, /prose-callout-tip/u);
		assert.match(html, /prose-callout-important/u);
		assert.match(html, /prose-callout-warning/u);
		assert.match(html, /prose-callout-caution/u);
	});

	// ── 安全 HTML ─────────────────────────────────────────────────────────

	test("renderSafeMarkdown 允许安全 HTML 标签通过", async () => {
		const html = await renderSafeMarkdown(
			'<video src="test.mp4" controls width="100%"></video>',
		);

		// 安全标签被保留，但属性重新序列化后可能含额外空格
		assert.ok(html.includes("<video"), "video 标签应被保留");
		assert.ok(html.includes('src="test.mp4"'), "src 属性应被保留");
		assert.ok(html.includes("<video"), "不应被转义");
	});

	test("renderSafeMarkdown 转义危险 HTML 标签（如图 img）", async () => {
		const html = await renderSafeMarkdown(
			'<img src=x onerror="alert(1)">',
		);

		// img 不在安全标签白名单中，整个标签会被转义
		assert.ok(!html.includes("<img"), "img 标签应被转义而非原样输出");
		assert.ok(html.includes("&lt;img"), "img 标签应以 HTML 实体形式输出");
	});

	// ── 图表代码块 ────────────────────────────────────────────────────────

	test("renderSafeMarkdown 支持 Mermaid 图表", async () => {
		const html = await renderSafeMarkdown(
			"```mermaid\ngraph TD\n    A-->B\n```",
		);

		assert.match(html, /<div class="prose-mermaid">/u);
		assert.match(html, /graph TD/u);
	});

	test("renderSafeMarkdown 支持 Kanban 看板", async () => {
		const html = await renderSafeMarkdown(
			"```kanban\n## 待办\n- 任务1\n- 任务2\n\n## 进行中\n- 任务3\n```",
		);

		assert.match(html, /<div class="prose-kanban">/u);
		assert.match(html, /prose-kanban-column/u);
		assert.match(html, /待办/u);
		assert.match(html, /任务1/u);
	});

	test("renderSafeMarkdown 支持 Chat 聊天", async () => {
		const html = await renderSafeMarkdown(
			"```chat\n%% left\n**Alice** 你好！\n%% right\n**Bob** 嗨！\n```",
		);

		assert.match(html, /<div class="prose-chat">/u);
		assert.match(html, /prose-chat-left/u);
		assert.match(html, /prose-chat-right/u);
		assert.match(html, /Alice/u);
		assert.match(html, /Bob/u);
	});

	test("renderSafeMarkdown 支持 Timeline 时间线", async () => {
		const html = await renderSafeMarkdown(
			"```timeline\n## 2024年\n- 项目启动\n## 2025年\n- 项目上线\n```",
		);

		assert.match(html, /<div class="prose-timeline">/u);
		assert.match(html, /prose-timeline-title/u);
		assert.match(html, /2024年/u);
		assert.match(html, /项目启动/u);
	});

	test("renderSafeMarkdown 支持 Calendar 日历事件", async () => {
		const html = await renderSafeMarkdown(
			"```calendar\n## 2024-01-01\n- 新年 [high]\n- 休息 @假期\n```",
		);

		assert.match(html, /<div class="prose-calendar">/u);
		assert.match(html, /新年/u);
		assert.match(html, /假期/u);
	});

	test("renderSafeMarkdown 支持 PlantUML 和 Drawio", async () => {
		const html = await renderSafeMarkdown(
			["```plantuml\n@startuml\nAlice->Bob: Hello\n@enduml\n```"].join("\n"),
		);

		assert.match(html, /<div class="prose-plantuml">/u);
	});

	test("renderSafeMarkdown 支持 ECharts 配置", async () => {
		const html = await renderSafeMarkdown(
			'```echarts\n{"xAxis":{},"yAxis":{},"series":[{"data":[1,2,3]}]}\n```',
		);

		assert.match(html, /<div class="prose-echarts"/u);
		assert.match(html, /data-echarts/u);
	});

	test("renderSafeMarkdown 支持 Chart.js 配置", async () => {
		const html = await renderSafeMarkdown(
			'```chartjs\n{"type":"bar","data":{"labels":["A"],"datasets":[{"data":[1]}]}}\n```',
		);

		assert.match(html, /<div class="prose-chartjs"/u);
		assert.match(html, /data-chart/u);
	});

	test("renderSafeMarkdown Callout 内部支持 Markdown 格式", async () => {
		const html = await renderSafeMarkdown(
			"> [!TIP]\n> 这是 **加粗** 和 `代码`。",
		);

		assert.match(html, /<strong>/u);
		assert.match(html, /<code>/u);
	});
});
