import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

describe("Webmention 接入保护", () => {
	test("主应用挂载公共接收端点和后台审核路由", async () => {
		const source = await readFile("src/admin/app.ts", "utf8");

		assert.ok(source.includes('app.route("/webmention", webmentionRoutes)'));
		assert.ok(source.includes('app.route("/admin/mentions", mentionsRoutes)'));
	});

	test("接收端会校验 source/target 并按 source+target 幂等入库", async () => {
		const source = await readFile("src/admin/routes/webmention.ts", "utf8");

		assert.ok(source.includes("sourceContainsTargetLink"));
		assert.ok(source.includes("target 必须是本站页面"));
		assert.ok(source.includes("onConflictDoUpdate"));
		assert.ok(source.includes('status: "pending"'));
	});

	test("后台提及管理页支持审核和删除", async () => {
		const source = await readFile("src/admin/routes/mentions.ts", "utf8");

		assert.ok(source.includes('mentionsRoutes.use("*", requireAuth)'));
		assert.ok(source.includes('"/api/admin/mentions?status=updated"'));
		assert.ok(source.includes('"/api/admin/mentions?status=deleted"'));
	});
});
