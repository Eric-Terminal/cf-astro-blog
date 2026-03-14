import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

describe("MCP 发帖路由", () => {
	test("主应用已挂载 /mcp 路由", async () => {
		const source = await readFile("src/admin/app.ts", "utf8");
		assert.match(source, /app\.route\("\/mcp",\s*mcpRoutes\)/u);
	});

	test("MCP 路由提供 create_post 工具并要求 authorName", async () => {
		const source = await readFile("src/admin/routes/mcp.ts", "utf8");
		assert.match(source, /registerTool\(\s*"create_post"/u);
		assert.match(source, /authorName/u);
		assert.match(source, /首次请求必须为 initialize/u);
		assert.match(source, /MCP_BEARER_TOKEN/u);
		assert.match(
			source,
			/statusRaw\s*\?\s*sanitizePostStatus\(statusRaw\)\s*:\s*\("published"/u,
		);
	});
});
