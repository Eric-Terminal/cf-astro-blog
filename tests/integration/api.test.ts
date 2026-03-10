import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { app } from "../../src/admin/app";

const mockEnv = {
	ADMIN_USERNAME: "Eric-Terminal",
	ADMIN_GITHUB_LOGIN: "Eric-Terminal",
	GITHUB_OAUTH_CLIENT_ID: "client-id",
	GITHUB_OAUTH_CLIENT_SECRET: "client-secret",
	GITHUB_OAUTH_REDIRECT_URI: "",
	SESSION: {
		get: async () => null,
		put: async () => undefined,
		delete: async () => undefined,
	},
} as unknown as Env;

function createMockD1() {
	const calls: Array<{ sql: string; params: unknown[] }> = [];

	const db = {
		prepare(sql: string) {
			return {
				bind(...params: unknown[]) {
					return {
						run: async () => {
							calls.push({ sql, params });
							return { success: true };
						},
					};
				},
			};
		},
	} as unknown as D1Database;

	return { db, calls };
}

function createWebMentionMockD1() {
	const calls: Array<{ sql: string; params: unknown[] }> = [];

	const db = {
		prepare(sql: string) {
			return {
				bind(...params: unknown[]) {
					return {
						run: async () => {
							calls.push({ sql, params });
							return { success: true };
						},
						all: async () => {
							calls.push({ sql, params });
							return { results: [] };
						},
						first: async () => {
							calls.push({ sql, params });
							return undefined;
						},
					};
				},
			};
		},
	} as unknown as D1Database;

	return { db, calls };
}

describe("后台接口", () => {
	test("GET /health 会返回健康状态", async () => {
		const res = await app.request("/health");
		assert.equal(res.status, 200);

		const body = (await res.json()) as {
			status: string;
			timestamp: string;
		};
		assert.equal(body.status, "ok");
		assert.ok(body.timestamp);
	});

	test("GET /auth/login 会返回 GitHub OAuth 登录页面", async () => {
		const res = await app.request("/auth/login", undefined, mockEnv);
		assert.equal(res.status, 200);

		const html = await res.text();
		assert.match(html, /GitHub OAuth 登录/u);
		assert.match(html, /Eric-Terminal/u);
		assert.match(html, /\/api\/auth\/github/u);
		assert.ok(!html.includes('name="username"'));
		assert.ok(!html.includes('name="password"'));
	});

	test("POST /analytics/track 接收有效事件并写入数据库", async () => {
		const { db, calls } = createMockD1();
		const res = await app.request(
			"/analytics/track",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost",
					"CF-Connecting-IP": "203.0.113.10",
				},
				body: JSON.stringify({
					sessionId: "sid_test_1234567890abcd",
					pageUrl: "/blog/test?from=home",
					pageTitle: "测试文章",
					referrer: "https://google.com",
					utmSource: "google",
					utmMedium: "organic",
					utmCampaign: "spring",
					touchSession: true,
				}),
			},
			{
				...mockEnv,
				DB: db,
			} as unknown as Env,
		);

		assert.equal(res.status, 204);
		assert.equal(calls.length, 2);
		assert.match(calls[0]?.sql ?? "", /insert into analytics_sessions/iu);
		assert.match(calls[1]?.sql ?? "", /insert into analytics_events/iu);
		assert.equal(calls[0]?.params[1], "203.0.113.10");
	});

	test("POST /analytics/track 会拒绝无效事件数据", async () => {
		const { db, calls } = createMockD1();
		const res = await app.request(
			"/analytics/track",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost",
				},
				body: JSON.stringify({
					sessionId: "bad",
					pageUrl: "javascript:alert(1)",
				}),
			},
			{
				...mockEnv,
				DB: db,
			} as unknown as Env,
		);

		assert.equal(res.status, 400);
		assert.equal(calls.length, 0);
	});

	test("POST /analytics/track 在未触达会话时只写入事件表", async () => {
		const { db, calls } = createMockD1();
		const res = await app.request(
			"/analytics/track",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost",
				},
				body: JSON.stringify({
					sessionId: "sid_test_1234567890abcd",
					pageUrl: "/",
					touchSession: false,
				}),
			},
			{
				...mockEnv,
				DB: db,
			} as unknown as Env,
		);

		assert.equal(res.status, 204);
		assert.equal(calls.length, 1);
		assert.match(calls[0]?.sql ?? "", /insert into analytics_events/iu);
	});

	test("未登录访问 /admin 会跳转到登录页", async () => {
		const res = await app.request("/admin", { redirect: "manual" });
		assert.equal(res.status, 302);
		assert.equal(res.headers.get("location"), "/api/auth/login");
	});

	test("未登录访问 /admin/posts 会跳转到登录页", async () => {
		const res = await app.request("/admin/posts", { redirect: "manual" });
		assert.equal(res.status, 302);
		assert.equal(res.headers.get("location"), "/api/auth/login");
	});

	test("未登录访问 /admin/media 会跳转到登录页", async () => {
		const res = await app.request("/admin/media", { redirect: "manual" });
		assert.equal(res.status, 302);
		assert.equal(res.headers.get("location"), "/api/auth/login");
	});

	test("未登录访问 /admin/friends 会跳转到登录页", async () => {
		const res = await app.request("/admin/friends", { redirect: "manual" });
		assert.equal(res.status, 302);
		assert.equal(res.headers.get("location"), "/api/auth/login");
	});

	test("未登录访问 /admin/appearance 会跳转到登录页", async () => {
		const res = await app.request("/admin/appearance", {
			redirect: "manual",
		});
		assert.equal(res.status, 302);
		assert.equal(res.headers.get("location"), "/api/auth/login");
	});

	test("未登录访问 /admin/analytics 会跳转到登录页", async () => {
		const res = await app.request("/admin/analytics", {
			redirect: "manual",
		});
		assert.equal(res.status, 302);
		assert.equal(res.headers.get("location"), "/api/auth/login");
	});

	test("未登录访问 /admin/mentions 会跳转到登录页", async () => {
		const res = await app.request("/admin/mentions", {
			redirect: "manual",
		});
		assert.equal(res.status, 302);
		assert.equal(res.headers.get("location"), "/api/auth/login");
	});

	test("POST /webmention 缺少参数时会返回 400", async () => {
		const res = await app.request(
			"/webmention",
			{
				method: "POST",
				headers: {
					"content-type": "application/x-www-form-urlencoded",
				},
				body: "source=&target=",
			},
			{
				...mockEnv,
				DB: createWebMentionMockD1().db,
			} as unknown as Env,
		);

		assert.equal(res.status, 400);
		assert.match(await res.text(), /source 和 target 参数不能为空/u);
	});

	test("POST /webmention 成功时会写入待审核记录并返回 202", async () => {
		const { db, calls } = createWebMentionMockD1();
		const sourceUrl = "https://example.org/posts/webmention-demo";
		const targetUrl = "https://blog.ericterminal.com/search";
		const originalFetch = globalThis.fetch;

		globalThis.fetch = async (input) => {
			if (String(input) === sourceUrl) {
				return new Response(
					`<!doctype html><html><head><title>来源文章</title><meta name="description" content="一篇测试提及"></head><body><a href="${targetUrl}">提到你</a></body></html>`,
					{
						status: 200,
						headers: { "content-type": "text/html; charset=utf-8" },
					},
				);
			}

			return new Response("not found", { status: 404 });
		};

		try {
			const res = await app.request(
				"/webmention",
				{
					method: "POST",
					headers: {
						"content-type": "application/x-www-form-urlencoded",
					},
					body: `source=${encodeURIComponent(sourceUrl)}&target=${encodeURIComponent(targetUrl)}`,
				},
				{
					...mockEnv,
					DB: db,
				} as unknown as Env,
			);

			assert.equal(res.status, 202);
			assert.match(await res.text(), /等待审核/u);
			assert.ok(
				calls.some((entry) =>
					/insert into\s+"?web_mentions"?/iu.test(entry.sql),
				),
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("POST /auth/login 会拒绝密码表单登录", async () => {
		const res = await app.request(
			"/auth/login",
			{
				method: "POST",
			},
			mockEnv,
		);
		assert.equal(res.status, 405);
		assert.match(await res.text(), /仅支持 GitHub OAuth 登录/u);
	});

	test("GET /auth/github 缺少配置时会返回 503 ", async () => {
		const res = await app.request("/auth/github", undefined, {
			...mockEnv,
			GITHUB_OAUTH_CLIENT_ID: "",
			GITHUB_OAUTH_CLIENT_SECRET: "",
		} as unknown as Env);
		assert.equal(res.status, 503);
		assert.match(await res.text(), /尚未完成 GitHub OAuth 配置/u);
	});

	test("GET /auth/github 在触发限流锁定时返回 429", async () => {
		const lockedUntil = new Date(Date.now() + 60 * 1000).toISOString();
		const res = await app.request("/auth/github", undefined, {
			...mockEnv,
			SESSION: {
				get: async (key: string) =>
					key === "login-rate:unknown"
						? JSON.stringify({
								attempts: 5,
								lockedUntil,
								lastAttempt: new Date().toISOString(),
							})
						: null,
				put: async () => undefined,
				delete: async () => undefined,
			},
		} as unknown as Env);

		assert.equal(res.status, 429);
		assert.match(await res.text(), /登录尝试过多/u);
	});
});
