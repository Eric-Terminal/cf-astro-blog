import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

describe("公开 AI 接口防护", () => {
	test("公开 AI 路由包含同源校验、限流配额与 Turnstile 校验，并提供 404 终端模式", async () => {
		const source = await readFile("src/admin/routes/public-ai.ts", "utf8");

		assert.match(source, /isSameOriginRequest/u);
		assert.match(source, /public-ai:minute:/u);
		assert.match(source, /public-ai:day:/u);
		assert.match(source, /PUBLIC_AI_RATE_LIMIT_PER_MINUTE/u);
		assert.match(source, /PUBLIC_AI_DAILY_LIMIT_PER_IP/u);
		assert.match(source, /TURNSTILE_SECRET_KEY/u);
		assert.match(source, /verifyTurnstileToken/u);
		assert.match(source, /\/chat/u);
		assert.match(source, /\/terminal-404/u);
		assert.match(source, /NOT_FOUND_TERMINAL_SYSTEM_PROMPT/u);
		assert.match(source, /TERMINAL_CLEAR/u);
		assert.match(source, /command not found/u);
		assert.match(source, /PWD=/u);
		assert.match(source, /COMMAND=/u);
		assert.match(source, /normalizeTerminalCwd/u);
		assert.match(source, /normalizeTerminalHistory/u);
		assert.match(source, /MAX_TERMINAL_BODY_LENGTH/u);
		assert.match(source, /MAX_TERMINAL_HISTORY_MESSAGE_LENGTH/u);
		assert.match(source, /history/u);
	});

	test("主应用会挂载公开 AI 路由", async () => {
		const appSource = await readFile("src/admin/app.ts", "utf8");
		assert.match(appSource, /app\.route\("\/ai", publicAiRoutes\)/u);
	});
});
