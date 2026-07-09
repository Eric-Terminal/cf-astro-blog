import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

describe("后台友链直录能力", () => {
	test("友链管理页提供后台直接新增按钮和完整配置项", async () => {
		const source = await readFile("src/admin/routes/friends.ts", "utf8");

		assert.match(source, /href="#friend-create-form"/u);
		assert.match(source, /添加友链/u);
		assert.match(source, /action="\/api\/admin\/friends\/settings"/u);
		assert.match(source, /name="friendApplyNotice"/u);
		assert.match(source, /仅在「\/friends\/apply」申请页面展示/u);
		assert.match(source, /id="friend-create-form"/u);
		assert.match(source, /action="\/api\/admin\/friends\/create"/u);
		assert.match(source, /name="createName"/u);
		assert.match(source, /name="createSiteUrl"/u);
		assert.match(source, /name="createAvatarUrl"/u);
		assert.match(source, /name="createDescription"/u);
		assert.match(source, /站点简介（可选）/u);
		assert.doesNotMatch(
			source,
			/<textarea[^>]*name="createDescription"[^>]*required/u,
		);
		assert.match(source, /name="createContact"/u);
		assert.match(source, /name="createStatus"/u);
		assert.match(source, /name="createReviewNote"/u);
		assert.match(source, /name="createNote"/u);
		assert.match(source, /不需要前台申请/u);
		assert.match(source, /admin-secondary-panel/u);
	});

	test("友链管理路由支持创建友链并处理非法参数与重复站点", async () => {
		const source = await readFile("src/admin/routes/friends.ts", "utf8");

		assert.match(source, /friendsRoutes\.post\("\/create"/u);
		assert.match(source, /friendsRoutes\.post\("\/settings"/u);
		assert.match(source, /parseFriendCreateInput/u);
		assert.match(source, /sanitizeCanonicalUrl/u);
		assert.match(source, /friendApplyNotice/u);
		assert.match(source, /siteAppearanceSettings/u);
		assert.match(
			source,
			/if \(!name \|\| !siteUrl \|\| !contact \|\| !status\)/u,
		);
		assert.match(source, /status=create-invalid/u);
		assert.match(source, /status=create-duplicate/u);
		assert.match(source, /status=created/u);
		assert.match(source, /status=settings-updated/u);
	});

	test("友链审核表单支持编辑完整字段并处理更新校验", async () => {
		const source = await readFile("src/admin/routes/friends.ts", "utf8");

		assert.match(source, /name="name"/u);
		assert.match(source, /name="siteUrl"/u);
		assert.match(source, /name="avatarUrl"/u);
		assert.match(source, /name="description"/u);
		assert.match(source, /name="contact"/u);
		assert.match(source, /name="note"/u);
		assert.match(source, /parseFriendReviewInput/u);
		assert.match(source, /status: "update-invalid"/u);
		assert.match(source, /status: "update-duplicate"/u);
		assert.match(source, /and\(eq\(friendLinks\.siteUrl/u);
		assert.match(source, /ne\(friendLinks\.id, id\)/u);
		assert.match(source, /siteUrl: parsed\.data\.siteUrl/u);
		assert.match(source, /status: nextStatus/u);
	});

	test("友链支持一键改状态并保留筛选上下文", async () => {
		const source = await readFile("src/admin/routes/friends.ts", "utf8");

		assert.match(source, /friendsRoutes\.post\("\/:id\/status"/u);
		assert.match(source, /status-updated/u);
		assert.match(source, /buildFriendsRedirect/u);
		assert.match(source, /normalizeFriendLinkFilter/u);
		assert.match(source, /btn-success-solid/u);
		assert.match(source, /label: "通过"/u);
		assert.match(source, /label: "拒绝"/u);
		assert.match(source, /action="\/api\/admin\/friends\/\$\{id\}\/status"/u);
	});
});
