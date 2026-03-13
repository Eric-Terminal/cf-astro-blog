import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

describe("访问统计后台能力保护", () => {
	test("统计页支持分页、保留策略与全量导出入口", async () => {
		const analyticsRouteSource = await readFile(
			"src/admin/routes/analytics.ts",
			"utf8",
		);

		assert.match(analyticsRouteSource, /eventsPage/u);
		assert.match(analyticsRouteSource, /sessionsPage/u);
		assert.match(analyticsRouteSource, /RECENT_EVENTS_PAGE_SIZE/u);
		assert.match(analyticsRouteSource, /RECENT_SESSIONS_PAGE_SIZE/u);
		assert.match(analyticsRouteSource, /cleanup=1/u);
		assert.match(analyticsRouteSource, /下载全部明细（JSONL）/u);
		assert.match(analyticsRouteSource, /analytics\.get\("\/export"/u);
		assert.match(analyticsRouteSource, /application\/x-ndjson/u);
		assert.match(analyticsRouteSource, /attachment; filename=/u);
	});

	test("统计页操作区与表格容器具备响应式防遮挡样式", async () => {
		const [analyticsRouteSource, layoutSource] = await Promise.all([
			readFile("src/admin/routes/analytics.ts", "utf8"),
			readFile("src/admin/views/layout.ts", "utf8"),
		]);

		assert.match(analyticsRouteSource, /table-actions analytics-actions/u);
		assert.match(analyticsRouteSource, /class="table-cell-break"/u);
		assert.match(layoutSource, /\.analytics-actions \.btn/u);
		assert.match(layoutSource, /\.table-card\s*\{[\s\S]*overflow-x: auto;/u);
		assert.match(
			layoutSource,
			/\.table-cell-break\s*\{[\s\S]*overflow-wrap: anywhere;/u,
		);
		assert.match(
			layoutSource,
			/\.admin-page-content\s*\{[\s\S]*min-width: 0;/u,
		);
	});

	test("统计上报路由会按周期触发保留策略清理", async () => {
		const publicAnalyticsSource = await readFile(
			"src/admin/routes/public-analytics.ts",
			"utf8",
		);

		assert.match(publicAnalyticsSource, /maybeCleanupAnalyticsData/u);
		assert.match(publicAnalyticsSource, /payload\.touchSession/u);
	});

	test("统计表会补充查询索引迁移", async () => {
		const migrationSource = await readFile(
			"drizzle/0013_analytics_query_indexes.sql",
			"utf8",
		);

		assert.match(migrationSource, /analytics_events_timestamp_idx/u);
		assert.match(migrationSource, /analytics_events_page_url_idx/u);
		assert.match(migrationSource, /analytics_events_session_id_idx/u);
		assert.match(migrationSource, /analytics_sessions_last_seen_idx/u);
	});
});
