import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

describe("GitHub OAuth 后台认证保护", () => {
	test("登录页只渲染 GitHub OAuth 登录入口", async () => {
		const loginViewSource = await readFile("src/admin/views/login.ts", "utf8");

		assert.match(loginViewSource, /GitHub OAuth/u);
		assert.match(loginViewSource, /站点管理入口/u);
		assert.match(loginViewSource, /\/api\/auth\/github/u);
		assert.ok(!loginViewSource.includes('name="password"'));
		assert.ok(!loginViewSource.includes('name="username"'));
		assert.ok(!loginViewSource.includes("允许访问账号"));
	});

	test("认证路由会处理 GitHub 授权跳转和回调", async () => {
		const authRouteSource = await readFile("src/admin/routes/auth.ts", "utf8");

		assert.match(authRouteSource, /\/github/u);
		assert.match(authRouteSource, /\/github\/callback/u);
		assert.match(authRouteSource, /code_challenge/u);
		assert.match(authRouteSource, /https:\/\/api\.github\.com\/user/u);
		assert.match(authRouteSource, /仅支持 GitHub OAuth 登录/u);
		assert.match(authRouteSource, /rateLimit/u);
		assert.match(authRouteSource, /recordFailedAttempt/u);
		assert.match(authRouteSource, /clearAttempts/u);
	});

	test("会话中间件会以 GitHub 用户名作为后台身份", async () => {
		const authMiddlewareSource = await readFile(
			"src/admin/middleware/auth.ts",
			"utf8",
		);

		assert.match(authMiddlewareSource, /ADMIN_GITHUB_LOGIN/u);
		assert.match(authMiddlewareSource, /username:\s*string/u);
		assert.match(authMiddlewareSource, /setSubject\(session\.username\)/u);
		assert.ok(!authMiddlewareSource.includes("fingerprintPasswordHash"));
	});
});
