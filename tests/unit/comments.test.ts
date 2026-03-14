import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

describe("评论组件保护", () => {
	test("文章布局会挂载默认折叠的评论面板", async () => {
		const [postLayoutSource, commentsComponentSource] = await Promise.all([
			readFile("src/layouts/Post.astro", "utf8"),
			readFile("src/components/CommentsPanel.astro", "utf8"),
		]);

		assert.match(postLayoutSource, /<CommentsPanel/u);
		assert.match(postLayoutSource, /article-comments-slot/u);
		assert.match(commentsComponentSource, /data-comments-panel/u);
		assert.match(commentsComponentSource, /data-comments-toggle/u);
		assert.match(commentsComponentSource, /aria-expanded="false"/u);
		assert.match(commentsComponentSource, /article-opaque-mode/u);
	});

	test("评论脚本会按展开时机懒加载 giscus 并同步主题", async () => {
		const commentsScriptSource = await readFile("public/comments.js", "utf8");

		assert.match(commentsScriptSource, /giscus\.app\/client\.js/u);
		assert.match(commentsScriptSource, /commentsLoaded/u);
		assert.match(commentsScriptSource, /MutationObserver/u);
		assert.match(commentsScriptSource, /astro:page-load/u);
	});

	test("站点配置会预留 giscus 仓库配置", async () => {
		const typesSource = await readFile("src/lib/types.ts", "utf8");

		assert.match(typesSource, /comments:/u);
		assert.match(typesSource, /repo:\s*"Eric-Terminal\/cf-astro-blog"/u);
		assert.match(typesSource, /repoId:\s*"R_kgDORhlfAw"/u);
		assert.match(typesSource, /category:\s*"Announcements"/u);
		assert.match(typesSource, /categoryId:\s*"DIC_kwDORhlfA84C39BM"/u);
	});
});
