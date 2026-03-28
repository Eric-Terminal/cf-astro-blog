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

function createMemorySessionKv() {
	const store = new Map<string, string>();
	const kv = {
		get: async (key: string) => store.get(key) ?? null,
		put: async (key: string, value: string) => {
			store.set(key, value);
		},
		delete: async (key: string) => {
			store.delete(key);
		},
	} as unknown as KVNamespace;

	return { kv, store };
}

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

function createMcpPostMockD1() {
	const calls: Array<{ sql: string; params: unknown[] }> = [];
	let nextCategoryId = 3100;
	let nextTagId = 4100;

	const db = {
		prepare(sql: string) {
			return {
				bind(...params: unknown[]) {
					return {
						run: async () => {
							calls.push({ sql, params });
							return { success: true };
						},
						raw: async () => {
							calls.push({ sql, params });
							if (
								/insert into\s+"?blog_posts"?/iu.test(sql) &&
								/returning/iu.test(sql)
							) {
								return [[9527]];
							}
							if (
								/insert into\s+"?blog_categories"?/iu.test(sql) &&
								/returning/iu.test(sql)
							) {
								return [[nextCategoryId++]];
							}
							if (
								/insert into\s+"?blog_tags"?/iu.test(sql) &&
								/returning/iu.test(sql)
							) {
								return [[nextTagId++]];
							}
							return [];
						},
						all: async () => {
							calls.push({ sql, params });
							if (
								/insert into\s+"?blog_posts"?/iu.test(sql) &&
								/returning/iu.test(sql)
							) {
								return { results: [{ id: 9527 }] };
							}
							if (
								/insert into\s+"?blog_categories"?/iu.test(sql) &&
								/returning/iu.test(sql)
							) {
								return { results: [{ id: nextCategoryId++ }] };
							}
							if (
								/insert into\s+"?blog_tags"?/iu.test(sql) &&
								/returning/iu.test(sql)
							) {
								return { results: [{ id: nextTagId++ }] };
							}
							return { results: [] };
						},
						first: async () => {
							calls.push({ sql, params });
							if (
								/insert into\s+"?blog_posts"?/iu.test(sql) &&
								/returning/iu.test(sql)
							) {
								return { id: 9527 };
							}
							if (
								/insert into\s+"?blog_categories"?/iu.test(sql) &&
								/returning/iu.test(sql)
							) {
								return { id: nextCategoryId++ };
							}
							if (
								/insert into\s+"?blog_tags"?/iu.test(sql) &&
								/returning/iu.test(sql)
							) {
								return { id: nextTagId++ };
							}
							return undefined;
						},
					};
				},
			};
		},
	} as unknown as D1Database;

	return { db, calls };
}

function createMcpReadMockD1(options?: { mcpEnabled?: boolean }) {
	const calls: Array<{ sql: string; params: unknown[] }> = [];
	const postRow = {
		id: 88,
		title: "MCP 读取测试文章",
		slug: "mcp-read-demo",
		content: "# 标题\n\n这里是用于 MCP 读取工具测试的正文。",
		excerpt: "用于 MCP 读取的摘要",
		status: "published",
		publishAt: "2026-03-15T08:00:00.000Z",
		publishedAt: "2026-03-15T08:00:00.000Z",
		featuredImageKey: null,
		featuredImageAlt: null,
		metaTitle: "MCP 读取测试 SEO 标题",
		metaDescription: "MCP 读取测试 SEO 描述",
		metaKeywords: "MCP, 读取",
		canonicalUrl: null,
		categoryName: "工程实践",
		authorName: "AI-Agent",
		createdAt: "2026-03-15T08:00:00.000Z",
		updatedAt: "2026-03-15T08:00:00.000Z",
	};
	const tagRows = [
		{ postId: 88, tagName: "MCP" },
		{ postId: 88, tagName: "工具测试" },
	];

	const db = {
		prepare(sql: string) {
			return {
				bind(...params: unknown[]) {
					const buildResults = () => {
						if (/from\s+["`]?site_appearance_settings["`]?/iu.test(sql)) {
							return [{ mcpEnabled: options?.mcpEnabled ?? 1 }];
						}

						if (
							/from\s+["`]?blog_posts["`]?/iu.test(sql) &&
							/left join\s+["`]?blog_categories["`]?/iu.test(sql)
						) {
							return [postRow];
						}

						if (
							/from\s+["`]?blog_post_tags["`]?/iu.test(sql) &&
							/join\s+["`]?blog_tags["`]?/iu.test(sql)
						) {
							return tagRows;
						}

						return [];
					};

					return {
						run: async () => {
							calls.push({ sql, params });
							return { success: true };
						},
						raw: async () => {
							calls.push({ sql, params });
							return buildResults().map((item) => Object.values(item));
						},
						all: async () => {
							calls.push({ sql, params });
							return { results: buildResults() };
						},
						first: async () => {
							calls.push({ sql, params });
							return buildResults()[0];
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

	test("GET /auth/login 会返回前台风格的管理员入口页", async () => {
		const res = await app.request("/auth/login", undefined, mockEnv);
		assert.equal(res.status, 200);

		const html = await res.text();
		assert.match(html, /欢迎回来/u);
		assert.match(html, /返回首页/u);
		assert.match(html, /\/api\/auth\/github/u);
		assert.doesNotMatch(html, /站点管理入口/u);
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
					"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)",
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
		const sessionUpsert = calls.find((entry) =>
			/insert into analytics_sessions/iu.test(entry.sql),
		);
		const eventInsert = calls.find((entry) =>
			/insert into analytics_events/iu.test(entry.sql),
		);
		assert.ok(sessionUpsert);
		assert.ok(eventInsert);
		assert.equal(sessionUpsert?.params[1], "203.0.113.10");
		assert.equal(eventInsert?.params[4], "203.0.113.10");
		assert.equal(
			eventInsert?.params[5],
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)",
		);
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
					"CF-Connecting-IP": "198.51.100.22",
					"user-agent":
						"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
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
		assert.equal(
			calls.some((entry) => /insert into analytics_sessions/iu.test(entry.sql)),
			false,
		);
		assert.ok(
			calls.some((entry) => /insert into analytics_events/iu.test(entry.sql)),
		);
		const eventInsert = calls.find((entry) =>
			/insert into analytics_events/iu.test(entry.sql),
		);
		assert.equal(eventInsert?.params[4], "198.51.100.22");
		assert.equal(
			eventInsert?.params[5],
			"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
		);
	});

	test("GET /friend-links/avatar 会拒绝无效 URL", async () => {
		const res = await app.request(
			"/friend-links/avatar?url=bad-url",
			undefined,
			{
				...mockEnv,
				DB: createMockD1().db,
			} as unknown as Env,
		);

		assert.equal(res.status, 400);
		assert.match(await res.text(), /头像地址不合法/u);
	});

	test("GET /friend-links/avatar 会拒绝本地或内网地址", async () => {
		const res = await app.request(
			"/friend-links/avatar?url=http%3A%2F%2Flocalhost%2Favatar.png",
			undefined,
			{
				...mockEnv,
				DB: createMockD1().db,
			} as unknown as Env,
		);

		assert.equal(res.status, 400);
		assert.match(await res.text(), /本地或内网主机/u);
	});

	test("GET /friend-links/avatar 会拒绝重定向到本地地址", async () => {
		const originalFetch = globalThis.fetch;
		const sourceUrl = "https://avatar.example.com/redirect";

		globalThis.fetch = async (input) => {
			if (String(input) === sourceUrl) {
				return new Response(null, {
					status: 302,
					headers: {
						location: "http://127.0.0.1/internal-avatar.png",
					},
				});
			}

			return new Response("not found", { status: 404 });
		};

		try {
			const res = await app.request(
				`/friend-links/avatar?url=${encodeURIComponent(sourceUrl)}`,
				undefined,
				{
					...mockEnv,
					DB: createMockD1().db,
				} as unknown as Env,
			);

			assert.equal(res.status, 400);
			assert.match(await res.text(), /本地或内网主机/u);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("GET /friend-links/avatar 允许 SVG 头像资源", async () => {
		const originalFetch = globalThis.fetch;
		const sourceUrl = "https://avatar.example.com/avatar.svg";
		const svgBody = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

		globalThis.fetch = async (input) => {
			if (String(input) === sourceUrl) {
				return new Response(svgBody, {
					status: 200,
					headers: {
						"content-type": "image/svg+xml",
					},
				});
			}

			return new Response("not found", { status: 404 });
		};

		try {
			const res = await app.request(
				`/friend-links/avatar?url=${encodeURIComponent(sourceUrl)}`,
				undefined,
				{
					...mockEnv,
					DB: createMockD1().db,
				} as unknown as Env,
			);

			assert.equal(res.status, 200);
			assert.equal(res.headers.get("content-type"), "image/svg+xml");
			assert.equal(await res.text(), svgBody);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("POST /ai/chat 会拒绝跨站来源请求", async () => {
		const res = await app.request(
			"/ai/chat",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "https://evil.example.com",
				},
				body: JSON.stringify({
					message: "你好",
				}),
			},
			mockEnv,
		);

		assert.equal(res.status, 403);
		assert.match(await res.text(), /非法来源请求/u);
	});

	test("POST /ai/terminal-404 缺少来源头会拒绝请求", async () => {
		const res = await app.request(
			"/ai/terminal-404",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify({
					message: "pwd",
				}),
			},
			mockEnv,
		);

		assert.equal(res.status, 403);
		assert.match(await res.text(), /非法来源请求/u);
	});

	test("POST /ai/chat 在启用 Turnstile 且缺少令牌时返回 403", async () => {
		const res = await app.request(
			"/ai/chat",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost",
				},
				body: JSON.stringify({
					message: "你好",
				}),
			},
			{
				...mockEnv,
				TURNSTILE_SECRET_KEY: "turnstile-secret",
			} as unknown as Env,
		);

		assert.equal(res.status, 403);
		assert.match(await res.text(), /人机校验失败/u);
	});

	test("POST /ai/terminal-404 即使配置 Turnstile 也不要求令牌", async () => {
		const res = await app.request(
			"/ai/terminal-404",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost",
				},
				body: JSON.stringify({
					message: "pwd",
				}),
			},
			{
				...mockEnv,
				TURNSTILE_SECRET_KEY: "turnstile-secret",
			} as unknown as Env,
		);

		assert.equal(res.status, 503);
		assert.match(await res.text(), /公开 AI 接口/u);
	});

	test("POST /ai/chat 在公开接口未配置时返回 503", async () => {
		const res = await app.request(
			"/ai/chat",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost",
				},
				body: JSON.stringify({
					message: "帮我总结这篇文章",
				}),
			},
			mockEnv,
		);

		assert.equal(res.status, 503);
		assert.match(await res.text(), /公开 AI 接口/u);
	});

	test("POST /ai/terminal-404 在公开接口未配置时返回 503", async () => {
		const res = await app.request(
			"/ai/terminal-404",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost",
				},
				body: JSON.stringify({
					message: "help",
				}),
			},
			mockEnv,
		);

		assert.equal(res.status, 503);
		assert.match(await res.text(), /公开 AI 接口/u);
	});

	test("POST /ai/chat 在超过分钟限流时返回 429", async () => {
		const res = await app.request(
			"/ai/chat",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost",
					"CF-Connecting-IP": "203.0.113.77",
				},
				body: JSON.stringify({
					message: "限流测试",
				}),
			},
			{
				...mockEnv,
				PUBLIC_AI_RATE_LIMIT_PER_MINUTE: "1",
				SESSION: {
					get: async (key: string) =>
						key.startsWith("public-ai:minute:") ? "1" : null,
					put: async () => undefined,
					delete: async () => undefined,
				},
			} as unknown as Env,
		);

		assert.equal(res.status, 429);
		assert.match(await res.text(), /请求过于频繁/u);
	});

	test("POST /mcp 缺少 Bearer 时返回 404", async () => {
		const initializeRequest = {
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-11-25",
				clientInfo: {
					name: "integration-test-client",
					version: "1.0.0",
				},
				capabilities: {},
			},
		};

		const res = await app.request(
			"/mcp",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify(initializeRequest),
			},
			{
				...mockEnv,
				MCP_BEARER_TOKEN: "mcp-secret",
			} as unknown as Env,
		);

		assert.equal(res.status, 404);
		assert.equal(await res.text(), "Not Found");
	});

	test("POST /mcp 鉴权失败触发 404 时会写入 MCP 审计日志", async () => {
		const { db, calls } = createMcpReadMockD1();
		const initializeRequest = {
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-11-25",
				clientInfo: {
					name: "integration-test-client",
					version: "1.0.0",
				},
				capabilities: {},
			},
		};

		const res = await app.request(
			"/mcp",
			{
				method: "POST",
				headers: {
					accept: "application/json, text/event-stream",
					"content-type": "application/json",
					authorization: "Bearer invalid-token",
					"CF-Connecting-IP": "198.51.100.7",
				},
				body: JSON.stringify(initializeRequest),
			},
			{
				...mockEnv,
				DB: db,
				MCP_BEARER_TOKEN: "mcp-secret",
			} as unknown as Env,
		);

		assert.equal(res.status, 404);
		assert.equal(await res.text(), "Not Found");

		const auditInsertCall = calls.find((entry) =>
			/insert into\s+"?mcp_audit_logs"?/iu.test(entry.sql),
		);
		assert.ok(auditInsertCall);
		assert.ok(auditInsertCall?.params.includes("token_invalid"));
		assert.ok(auditInsertCall?.params.includes("not_found"));
		assert.ok(auditInsertCall?.params.includes(404));
	});

	test("POST /mcp 在后台关闭开关时返回 404", async () => {
		const { db } = createMcpReadMockD1({ mcpEnabled: false });
		const initializeRequest = {
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-11-25",
				clientInfo: {
					name: "integration-test-client",
					version: "1.0.0",
				},
				capabilities: {},
			},
		};

		const res = await app.request(
			"/mcp",
			{
				method: "POST",
				headers: {
					accept: "application/json, text/event-stream",
					"content-type": "application/json",
					authorization: "Bearer mcp-secret",
				},
				body: JSON.stringify(initializeRequest),
			},
			{
				...mockEnv,
				DB: db,
				MCP_BEARER_TOKEN: "mcp-secret",
			} as unknown as Env,
		);

		assert.equal(res.status, 404);
		assert.equal(await res.text(), "Not Found");
	});

	test("POST /mcp 鉴权失败超过阈值后会触发短时封禁", async () => {
		const { kv, store } = createMemorySessionKv();
		const initializeRequest = {
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-11-25",
				clientInfo: {
					name: "integration-test-client",
					version: "1.0.0",
				},
				capabilities: {},
			},
		};
		const authLimitEnv = {
			...mockEnv,
			SESSION: kv,
			MCP_BEARER_TOKEN: "mcp-secret",
			MCP_AUTH_FAIL_LIMIT_PER_MINUTE: "1",
			MCP_AUTH_BLOCK_SECONDS: "3600",
		} as unknown as Env;

		const firstRes = await app.request(
			"/mcp",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: "Bearer wrong-token",
				},
				body: JSON.stringify(initializeRequest),
			},
			authLimitEnv,
		);
		assert.equal(firstRes.status, 404);

		const secondRes = await app.request(
			"/mcp",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: "Bearer wrong-token",
				},
				body: JSON.stringify(initializeRequest),
			},
			authLimitEnv,
		);
		assert.equal(secondRes.status, 404);

		const authBlockKey = [...store.keys()].find((key) =>
			key.startsWith("mcp:auth:block:"),
		);
		assert.ok(authBlockKey);

		const blockedRes = await app.request(
			"/mcp",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: "Bearer mcp-secret",
				},
				body: JSON.stringify(initializeRequest),
			},
			authLimitEnv,
		);
		assert.equal(blockedRes.status, 404);
		assert.equal(await blockedRes.text(), "Not Found");
	});

	test("POST /mcp 在缺少会话头且未 initialize 时可走无会话兼容模式", async () => {
		const { db, calls } = createMcpPostMockD1();
		const createRequest = {
			jsonrpc: "2.0",
			id: 1,
			method: "tools/call",
			params: {
				name: "create_post",
				arguments: {
					title: "无会话兼容模式测试",
					content: "这是一次直接工具调用",
					authorName: "AI-Agent",
				},
			},
		};

		const callRes = await app.request(
			"/mcp",
			{
				method: "POST",
				headers: {
					accept: "application/json, text/event-stream",
					"content-type": "application/json",
					authorization: "Bearer mcp-secret",
				},
				body: JSON.stringify(createRequest),
			},
			{
				...mockEnv,
				DB: db,
				MCP_BEARER_TOKEN: "mcp-secret",
			} as unknown as Env,
		);
		assert.equal(callRes.status, 200);

		const payload = (await callRes.json()) as {
			result?: { isError?: boolean; content?: Array<{ text?: string }> };
		};
		assert.notEqual(payload?.result?.isError, true);
		assert.match(
			String(payload?.result?.content?.[0]?.text || ""),
			/"authorName":\s*"AI-Agent"/u,
		);

		const insertCall = calls.find((entry) =>
			/insert into\s+"?blog_posts"?/iu.test(entry.sql),
		);
		assert.ok(insertCall);
		assert.ok(insertCall?.params.includes("无会话兼容模式测试"));

		const auditInsertCall = calls.find(
			(entry) =>
				/insert into\s+"?mcp_audit_logs"?/iu.test(entry.sql) &&
				entry.params.includes("无会话兼容模式处理成功"),
		);
		assert.ok(auditInsertCall);
	});

	test("POST /mcp 在 create_post 缺少 authorName 时返回工具错误", async () => {
		const initializeRequest = {
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-11-25",
				clientInfo: {
					name: "integration-test-client",
					version: "1.0.0",
				},
				capabilities: {},
			},
		};

		const initRes = await app.request(
			"/mcp",
			{
				method: "POST",
				headers: {
					accept: "application/json, text/event-stream",
					"content-type": "application/json",
					authorization: "Bearer mcp-secret",
				},
				body: JSON.stringify(initializeRequest),
			},
			{
				...mockEnv,
				MCP_BEARER_TOKEN: "mcp-secret",
			} as unknown as Env,
		);
		assert.equal(initRes.status, 200);

		const sessionId = initRes.headers.get("mcp-session-id");
		assert.ok(sessionId);

		const createRequest = {
			jsonrpc: "2.0",
			id: 2,
			method: "tools/call",
			params: {
				name: "create_post",
				arguments: {
					title: "MCP 测试文章",
					content: "这是一段测试正文",
				},
			},
		};

		const callRes = await app.request(
			"/mcp",
			{
				method: "POST",
				headers: {
					accept: "application/json, text/event-stream",
					"content-type": "application/json",
					authorization: "Bearer mcp-secret",
					"mcp-session-id": sessionId as string,
				},
				body: JSON.stringify(createRequest),
			},
			{
				...mockEnv,
				MCP_BEARER_TOKEN: "mcp-secret",
			} as unknown as Env,
		);
		assert.equal(callRes.status, 200);

		const payload = (await callRes.json()) as {
			result?: { isError?: boolean; content?: Array<{ text?: string }> };
		};
		assert.equal(payload?.result?.isError, true);
		assert.match(
			String(payload?.result?.content?.[0]?.text || ""),
			/authorName/u,
		);
	});

	test("POST /mcp 在 create_post 成功时会写入 author_name 且默认已发布", async () => {
		const { db, calls } = createMcpPostMockD1();
		const initializeRequest = {
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-11-25",
				clientInfo: {
					name: "integration-test-client",
					version: "1.0.0",
				},
				capabilities: {},
			},
		};

		const initRes = await app.request(
			"/mcp",
			{
				method: "POST",
				headers: {
					accept: "application/json, text/event-stream",
					"content-type": "application/json",
					authorization: "Bearer mcp-secret",
				},
				body: JSON.stringify(initializeRequest),
			},
			{
				...mockEnv,
				DB: db,
				MCP_BEARER_TOKEN: "mcp-secret",
			} as unknown as Env,
		);
		assert.equal(initRes.status, 200);

		const sessionId = initRes.headers.get("mcp-session-id");
		assert.ok(sessionId);

		const createRequest = {
			jsonrpc: "2.0",
			id: 2,
			method: "tools/call",
			params: {
				name: "create_post",
				arguments: {
					title: "MCP 发布测试",
					content: "# 标题\\n\\n这是一段测试内容",
					authorName: "AI-Agent",
				},
			},
		};

		const callRes = await app.request(
			"/mcp",
			{
				method: "POST",
				headers: {
					accept: "application/json, text/event-stream",
					"content-type": "application/json",
					authorization: "Bearer mcp-secret",
					"mcp-session-id": sessionId as string,
				},
				body: JSON.stringify(createRequest),
			},
			{
				...mockEnv,
				DB: db,
				MCP_BEARER_TOKEN: "mcp-secret",
			} as unknown as Env,
		);
		assert.equal(callRes.status, 200);

		const payload = (await callRes.json()) as {
			result?: { isError?: boolean; content?: Array<{ text?: string }> };
		};
		assert.notEqual(payload?.result?.isError, true);
		assert.match(
			String(payload?.result?.content?.[0]?.text || ""),
			/"authorName":\s*"AI-Agent"/u,
		);
		assert.match(
			String(payload?.result?.content?.[0]?.text || ""),
			/"status":\s*"published"/u,
		);
		assert.match(
			String(payload?.result?.content?.[0]?.text || ""),
			/"slug":\s*"mcp-发布测试"/u,
		);
		assert.match(
			String(payload?.result?.content?.[0]?.text || ""),
			/"url":\s*"\/blog\/mcp-%E5%8F%91%E5%B8%83%E6%B5%8B%E8%AF%95"/u,
		);

		const insertCall = calls.find((entry) =>
			/insert into\s+"?blog_posts"?/iu.test(entry.sql),
		);
		assert.ok(insertCall);
		assert.ok(insertCall?.params.includes("AI-Agent"));
		assert.ok(insertCall?.params.includes("published"));

		const auditInsertCalls = calls.filter((entry) =>
			/insert into\s+"?mcp_audit_logs"?/iu.test(entry.sql),
		);
		assert.ok(auditInsertCalls.length >= 2);
		const toolAuditCall = auditInsertCalls.find((entry) =>
			entry.params.includes("create_post"),
		);
		assert.ok(toolAuditCall);
		assert.ok(toolAuditCall?.params.includes("tools/call"));
		assert.ok(toolAuditCall?.params.includes("success"));
	});

	test("POST /mcp 在 create_post 使用摘要/分类/标签/SEO别名时可写入数据库", async () => {
		const { db, calls } = createMcpPostMockD1();
		const initializeRequest = {
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-11-25",
				clientInfo: {
					name: "integration-test-client",
					version: "1.0.0",
				},
				capabilities: {},
			},
		};

		const initRes = await app.request(
			"/mcp",
			{
				method: "POST",
				headers: {
					accept: "application/json, text/event-stream",
					"content-type": "application/json",
					authorization: "Bearer mcp-secret",
				},
				body: JSON.stringify(initializeRequest),
			},
			{
				...mockEnv,
				DB: db,
				MCP_BEARER_TOKEN: "mcp-secret",
			} as unknown as Env,
		);
		assert.equal(initRes.status, 200);

		const sessionId = initRes.headers.get("mcp-session-id");
		assert.ok(sessionId);

		const createRequest = {
			jsonrpc: "2.0",
			id: 2,
			method: "tools/call",
			params: {
				name: "create_post",
				arguments: {
					title: "MCP 字段兼容测试",
					content: "测试正文",
					authorName: "AI-Agent",
					pathName: "在-ucg-fiber-上优雅地使用-softbank-10g",
					summary: "这是一段摘要",
					category: { name: "工程实践" },
					tags: [{ name: "MCP" }, { label: "SEO" }],
					seo: {
						title: "SEO 主标题",
						description: "SEO 描述文本",
						keywords: ["关键词A", "关键词B"],
					},
				},
			},
		};

		const callRes = await app.request(
			"/mcp",
			{
				method: "POST",
				headers: {
					accept: "application/json, text/event-stream",
					"content-type": "application/json",
					authorization: "Bearer mcp-secret",
					"mcp-session-id": sessionId as string,
				},
				body: JSON.stringify(createRequest),
			},
			{
				...mockEnv,
				DB: db,
				MCP_BEARER_TOKEN: "mcp-secret",
			} as unknown as Env,
		);
		assert.equal(callRes.status, 200);

		const payload = (await callRes.json()) as {
			result?: { isError?: boolean; content?: Array<{ text?: string }> };
		};
		assert.notEqual(payload?.result?.isError, true);

		const postInsertCall = calls.find((entry) =>
			/insert into\s+"?blog_posts"?/iu.test(entry.sql),
		);
		assert.ok(postInsertCall);
		assert.ok(
			postInsertCall?.params.includes("在-ucg-fiber-上优雅地使用-softbank-10g"),
		);
		assert.ok(postInsertCall?.params.includes("这是一段摘要"));
		assert.ok(postInsertCall?.params.includes("SEO 主标题"));
		assert.ok(postInsertCall?.params.includes("SEO 描述文本"));
		assert.ok(postInsertCall?.params.includes("关键词A, 关键词B"));

		const categoryInsertCall = calls.find((entry) =>
			/insert into\s+"?blog_categories"?/iu.test(entry.sql),
		);
		assert.ok(categoryInsertCall);
		assert.ok(categoryInsertCall?.params.includes("工程实践"));

		const tagInsertCalls = calls.filter((entry) =>
			/insert into\s+"?blog_tags"?/iu.test(entry.sql),
		);
		assert.ok(tagInsertCalls.length >= 2);

		const relationInsertCall = calls.find((entry) =>
			/insert into\s+"?blog_post_tags"?/iu.test(entry.sql),
		);
		assert.ok(relationInsertCall);
	});

	test("POST /mcp 在 list_posts 可读取文章列表", async () => {
		const { db } = createMcpReadMockD1();
		const initializeRequest = {
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-11-25",
				clientInfo: {
					name: "integration-test-client",
					version: "1.0.0",
				},
				capabilities: {},
			},
		};

		const initRes = await app.request(
			"/mcp",
			{
				method: "POST",
				headers: {
					accept: "application/json, text/event-stream",
					"content-type": "application/json",
					authorization: "Bearer mcp-secret",
				},
				body: JSON.stringify(initializeRequest),
			},
			{
				...mockEnv,
				DB: db,
				MCP_BEARER_TOKEN: "mcp-secret",
			} as unknown as Env,
		);
		assert.equal(initRes.status, 200);

		const sessionId = initRes.headers.get("mcp-session-id");
		assert.ok(sessionId);

		const listRequest = {
			jsonrpc: "2.0",
			id: 2,
			method: "tools/call",
			params: {
				name: "list_posts",
				arguments: {
					limit: 5,
					includeContent: false,
				},
			},
		};

		const callRes = await app.request(
			"/mcp",
			{
				method: "POST",
				headers: {
					accept: "application/json, text/event-stream",
					"content-type": "application/json",
					authorization: "Bearer mcp-secret",
					"mcp-session-id": sessionId as string,
				},
				body: JSON.stringify(listRequest),
			},
			{
				...mockEnv,
				DB: db,
				MCP_BEARER_TOKEN: "mcp-secret",
			} as unknown as Env,
		);
		assert.equal(callRes.status, 200);

		const payload = (await callRes.json()) as {
			result?: { isError?: boolean; content?: Array<{ text?: string }> };
		};
		assert.notEqual(payload?.result?.isError, true);

		const text = String(payload?.result?.content?.[0]?.text ?? "{}");
		const toolResult = JSON.parse(text) as {
			total: number;
			posts: Array<{ slug: string; content?: string }>;
		};
		assert.equal(toolResult.total, 1);
		assert.equal(toolResult.posts[0]?.slug, "mcp-read-demo");
		assert.equal(toolResult.posts[0]?.content, undefined);
	});

	test("POST /mcp 在 get_post 可按 slug 读取文章详情", async () => {
		const { db } = createMcpReadMockD1();
		const initializeRequest = {
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-11-25",
				clientInfo: {
					name: "integration-test-client",
					version: "1.0.0",
				},
				capabilities: {},
			},
		};

		const initRes = await app.request(
			"/mcp",
			{
				method: "POST",
				headers: {
					accept: "application/json, text/event-stream",
					"content-type": "application/json",
					authorization: "Bearer mcp-secret",
				},
				body: JSON.stringify(initializeRequest),
			},
			{
				...mockEnv,
				DB: db,
				MCP_BEARER_TOKEN: "mcp-secret",
			} as unknown as Env,
		);
		assert.equal(initRes.status, 200);

		const sessionId = initRes.headers.get("mcp-session-id");
		assert.ok(sessionId);

		const getRequest = {
			jsonrpc: "2.0",
			id: 2,
			method: "tools/call",
			params: {
				name: "get_post",
				arguments: {
					slug: "mcp-read-demo",
					includeContent: true,
				},
			},
		};

		const callRes = await app.request(
			"/mcp",
			{
				method: "POST",
				headers: {
					accept: "application/json, text/event-stream",
					"content-type": "application/json",
					authorization: "Bearer mcp-secret",
					"mcp-session-id": sessionId as string,
				},
				body: JSON.stringify(getRequest),
			},
			{
				...mockEnv,
				DB: db,
				MCP_BEARER_TOKEN: "mcp-secret",
			} as unknown as Env,
		);
		assert.equal(callRes.status, 200);

		const payload = (await callRes.json()) as {
			result?: { isError?: boolean; content?: Array<{ text?: string }> };
		};
		assert.notEqual(payload?.result?.isError, true);

		const text = String(payload?.result?.content?.[0]?.text ?? "{}");
		const toolResult = JSON.parse(text) as {
			post: { slug: string; content: string; tags: string[] };
		};
		assert.equal(toolResult.post.slug, "mcp-read-demo");
		assert.match(toolResult.post.content, /MCP 读取工具测试/u);
		assert.ok(toolResult.post.tags.includes("MCP"));
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

	test("POST /webmention 会拒绝跳转到本地地址的 source", async () => {
		const { db, calls } = createWebMentionMockD1();
		const sourceUrl = "https://example.org/posts/redirect-local";
		const targetUrl = "https://blog.ericterminal.com/search";
		const originalFetch = globalThis.fetch;

		globalThis.fetch = async (input) => {
			if (String(input) === sourceUrl) {
				return new Response(null, {
					status: 302,
					headers: {
						location: "http://localhost/internal",
					},
				});
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

			assert.equal(res.status, 400);
			assert.match(await res.text(), /本地或内网主机地址/u);
			assert.ok(
				!calls.some((entry) =>
					/insert into\s+"?web_mentions"?/iu.test(entry.sql),
				),
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("POST /webmention 会拒绝体积过大的 source 页面", async () => {
		const { db, calls } = createWebMentionMockD1();
		const sourceUrl = "https://example.org/posts/huge";
		const targetUrl = "https://blog.ericterminal.com/search";
		const originalFetch = globalThis.fetch;
		const hugeHtml = `<html><body>${"a".repeat(1024 * 1024 + 128)}</body></html>`;

		globalThis.fetch = async (input) => {
			if (String(input) === sourceUrl) {
				return new Response(hugeHtml, {
					status: 200,
					headers: { "content-type": "text/html; charset=utf-8" },
				});
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

			assert.equal(res.status, 400);
			assert.match(await res.text(), /体积过大/u);
			assert.ok(
				!calls.some((entry) =>
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
