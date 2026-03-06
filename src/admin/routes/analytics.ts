import { desc, sql } from "drizzle-orm";
import { Hono } from "hono";
import { analyticsEvents, analyticsSessions } from "@/db/schema";
import { getDb } from "@/lib/db";
import { escapeHtml } from "@/lib/security";
import {
	type AdminAppEnv,
	getAuthenticatedSession,
	requireAuth,
} from "../middleware/auth";
import { adminLayout } from "../views/layout";

const analytics = new Hono<AdminAppEnv>();

analytics.use("*", requireAuth);

analytics.get("/", async (c) => {
	const session = getAuthenticatedSession(c);
	const stats = {
		totalSessions: 0,
		totalPageViews: 0,
		topPages: [] as Array<{ pageUrl: string; views: number }>,
		topReferrers: [] as Array<{ referrer: string; count: number }>,
		recentEvents: [] as Array<{
			eventType: string;
			pageUrl: string | null;
			timestamp: string;
		}>,
	};

	try {
		const db = getDb(c.env.DB);

		const [sessionCount] = await db
			.select({ count: sql<number>`count(*)` })
			.from(analyticsSessions);
		stats.totalSessions = sessionCount?.count ?? 0;

		const [pageViewCount] = await db
			.select({ count: sql<number>`count(*)` })
			.from(analyticsEvents);
		stats.totalPageViews = pageViewCount?.count ?? 0;

		stats.topPages = (await db
			.select({
				pageUrl: analyticsEvents.pageUrl,
				views: sql<number>`count(*)`,
			})
			.from(analyticsEvents)
			.groupBy(analyticsEvents.pageUrl)
			.orderBy(desc(sql`count(*)`))
			.limit(10)) as Array<{ pageUrl: string; views: number }>;

		stats.topReferrers = (
			await db
				.select({
					referrer: analyticsSessions.referrer,
					count: sql<number>`count(*)`,
				})
				.from(analyticsSessions)
				.groupBy(analyticsSessions.referrer)
				.orderBy(desc(sql`count(*)`))
				.limit(10)
		).filter((r) => r.referrer) as Array<{ referrer: string; count: number }>;

		stats.recentEvents = await db
			.select({
				eventType: analyticsEvents.eventType,
				pageUrl: analyticsEvents.pageUrl,
				timestamp: analyticsEvents.timestamp,
			})
			.from(analyticsEvents)
			.orderBy(desc(analyticsEvents.timestamp))
			.limit(20);
	} catch {
		// D1 未绑定时回退为空统计喵
	}

	const content = `
		<h1>访问统计</h1>
		<div class="stats-grid">
			<div class="stat-card">
				<span class="stat-value">${stats.totalSessions}</span>
				<span class="stat-label">总会话数</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">${stats.totalPageViews}</span>
				<span class="stat-label">总事件数</span>
			</div>
		</div>

		<h2>热门页面</h2>
		${
			stats.topPages.length > 0
				? `<table class="data-table">
				<thead><tr><th>页面</th><th>浏览量</th></tr></thead>
				<tbody>
					${stats.topPages.map((p) => `<tr><td>${escapeHtml(p.pageUrl || "-")}</td><td>${p.views}</td></tr>`).join("")}
				</tbody>
			</table>`
				: "<p class='empty-state'>当前还没有页面访问数据。</p>"
		}

		<h2>来源站点</h2>
		${
			stats.topReferrers.length > 0
				? `<table class="data-table">
				<thead><tr><th>来源</th><th>次数</th></tr></thead>
				<tbody>
					${stats.topReferrers.map((r) => `<tr><td>${escapeHtml(r.referrer)}</td><td>${r.count}</td></tr>`).join("")}
				</tbody>
			</table>`
				: "<p class='empty-state'>当前还没有来源统计数据。</p>"
		}

		<h2>最近事件</h2>
		${
			stats.recentEvents.length > 0
				? `<table class="data-table">
				<thead><tr><th>类型</th><th>页面</th><th>时间</th></tr></thead>
				<tbody>
					${stats.recentEvents.map((e) => `<tr><td>${escapeHtml(e.eventType)}</td><td>${escapeHtml(e.pageUrl || "-")}</td><td>${escapeHtml(e.timestamp)}</td></tr>`).join("")}
				</tbody>
			</table>`
				: "<p class='empty-state'>当前还没有事件记录。</p>"
		}
	`;

	return c.html(
		adminLayout("访问统计", content, { csrfToken: session.csrfToken }),
	);
});

export { analytics as analyticsRoutes };
