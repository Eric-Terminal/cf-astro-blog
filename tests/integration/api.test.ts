import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { app } from "../../src/admin/app";

const mockEnv = {
	TURNSTILE_SITE_KEY: "",
	SESSION: {
		get: async () => null,
		put: async () => undefined,
		delete: async () => undefined,
	},
} as unknown as Env;

describe("后台接口喵", () => {
	test("GET /health 会返回健康状态喵", async () => {
		const res = await app.request("/health");
		assert.equal(res.status, 200);

		const body = (await res.json()) as {
			status: string;
			timestamp: string;
		};
		assert.equal(body.status, "ok");
		assert.ok(body.timestamp);
	});

	test("GET /auth/login 会返回登录页面喵", async () => {
		const res = await app.request("/auth/login", undefined, mockEnv);
		assert.equal(res.status, 200);

		const html = await res.text();
		assert.match(html, /管理后台登录/u);
		assert.match(html, /name="username"/u);
		assert.match(html, /name="password"/u);
	});

	test("未登录访问 /admin 会跳转到登录页喵", async () => {
		const res = await app.request("/admin", { redirect: "manual" });
		assert.equal(res.status, 302);
		assert.equal(res.headers.get("location"), "/api/auth/login");
	});

	test("未登录访问 /admin/posts 会跳转到登录页喵", async () => {
		const res = await app.request("/admin/posts", { redirect: "manual" });
		assert.equal(res.status, 302);
		assert.equal(res.headers.get("location"), "/api/auth/login");
	});

	test("未登录访问 /admin/media 会跳转到登录页喵", async () => {
		const res = await app.request("/admin/media", { redirect: "manual" });
		assert.equal(res.status, 302);
		assert.equal(res.headers.get("location"), "/api/auth/login");
	});

	test("未登录访问 /admin/analytics 会跳转到登录页喵", async () => {
		const res = await app.request("/admin/analytics", {
			redirect: "manual",
		});
		assert.equal(res.status, 302);
		assert.equal(res.headers.get("location"), "/api/auth/login");
	});

	test("POST /auth/login 缺少凭据时会返回 400 喵", async () => {
		const res = await app.request(
			"/auth/login",
			{
				method: "POST",
				body: new URLSearchParams({}),
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
			},
			mockEnv,
		);
		assert.equal(res.status, 400);

		const html = await res.text();
		assert.match(html, /用户名和密码不能为空/u);
	});
});
