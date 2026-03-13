import { desc, sql } from "drizzle-orm";
import { Hono } from "hono";
import {
	ANALYTICS_RETENTION_DAYS,
	maybeCleanupAnalyticsData,
} from "@/admin/lib/analytics-retention";
import { analyticsEvents, analyticsSessions } from "@/db/schema";
import { getDb } from "@/lib/db";
import { escapeAttribute, escapeHtml } from "@/lib/security";
import {
	type AdminAppEnv,
	getAuthenticatedSession,
	requireAuth,
} from "../middleware/auth";
import { adminLayout } from "../views/layout";

const analytics = new Hono<AdminAppEnv>();

const TOP_ITEMS_LIMIT = 10;
const RECENT_EVENTS_PAGE_SIZE = 20;
const RECENT_SESSIONS_PAGE_SIZE = 20;

type RecentSessionRow = {
	ipAddress: string | null;
	browser: string | null;
	deviceType: string | null;
	landingPage: string | null;
	lastSeenAt: string;
};

type RecentEventRow = {
	eventType: string;
	pageUrl: string | null;
	timestamp: string;
};

type FullSessionRow = {
	id: number;
	sessionId: string;
	ipAddress: string | null;
	ipHash: string | null;
	country: string | null;
	region: string | null;
	city: string | null;
	userAgent: string | null;
	browser: string | null;
	os: string | null;
	deviceType: string | null;
	referrer: string | null;
	utmSource: string | null;
	utmMedium: string | null;
	utmCampaign: string | null;
	landingPage: string | null;
	startedAt: string;
	lastSeenAt: string;
};

type FullEventRow = {
	id: number;
	sessionId: string;
	eventType: string;
	eventName: string | null;
	pageUrl: string | null;
	pageTitle: string | null;
	eventData: string | null;
	scrollDepth: number | null;
	timeOnPageSeconds: number | null;
	timestamp: string;
};

function parsePageValue(value: string | undefined, fallback = 1) {
	const parsed = Number.parseInt(String(value ?? ""), 10);
	if (!Number.isFinite(parsed) || parsed < 1) {
		return fallback;
	}

	return parsed;
}

function buildPageHref(
	requestUrl: string,
	paramKey: "eventsPage" | "sessionsPage",
	page: number,
) {
	const url = new URL(requestUrl);
	url.searchParams.set(paramKey, String(page));
	url.searchParams.delete("cleanup");
	return `${url.pathname}${url.search}`;
}

function renderPagination(options: {
	requestUrl: string;
	paramKey: "eventsPage" | "sessionsPage";
	current: number;
	total: number;
}) {
	const { requestUrl, paramKey, current, total } = options;
	if (total <= 1) {
		return "";
	}

	const previous = current > 1 ? current - 1 : null;
	const next = current < total ? current + 1 : null;

	return `
		<div class="table-actions" style="margin-top: 0.75rem;">
			${
				previous
					? `<a class="btn btn-sm" href="${escapeAttribute(buildPageHref(requestUrl, paramKey, previous))}">上一页</a>`
					: `<span class="btn btn-sm" aria-disabled="true" style="pointer-events:none;opacity:0.48;">上一页</span>`
			}
			<span class="form-help">第 ${current} / ${total} 页</span>
			${
				next
					? `<a class="btn btn-sm" href="${escapeAttribute(buildPageHref(requestUrl, paramKey, next))}">下一页</a>`
					: `<span class="btn btn-sm" aria-disabled="true" style="pointer-events:none;opacity:0.48;">下一页</span>`
			}
		</div>
	`;
}

function formatExportTimestamp() {
	return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

analytics.use("*", requireAuth);

analytics.get("/", async (c) => {
	const session = getAuthenticatedSession(c);
	const requestedEventsPage = parsePageValue(c.req.query("eventsPage"), 1);
	const requestedSessionsPage = parsePageValue(c.req.query("sessionsPage"), 1);
	const forceCleanup = c.req.query("cleanup") === "1";

	const stats = {
		totalSessions: 0,
		totalPageViews: 0,
		topPages: [] as Array<{ pageUrl: string; views: number }>,
		topReferrers: [] as Array<{ referrer: string; count: number }>,
		recentSessions: [] as RecentSessionRow[],
		recentEvents: [] as RecentEventRow[],
		eventsPage: 1,
		sessionsPage: 1,
		totalEventPages: 1,
		totalSessionPages: 1,
		cleanupNotice: "",
	};

	try {
		const db = getDb(c.env.DB);
		const cleanup = await maybeCleanupAnalyticsData(c.env, {
			force: forceCleanup,
		});
		if (cleanup.ran) {
			stats.cleanupNotice = `统计保留策略已执行：删除事件 ${cleanup.deletedEvents} 条，会话 ${cleanup.deletedSessions} 条（保留最近 ${ANALYTICS_RETENTION_DAYS} 天）`;
		}

		const [sessionCount] = await db
			.select({ count: sql<number>`count(*)` })
			.from(analyticsSessions);
		stats.totalSessions = sessionCount?.count ?? 0;

		const [pageViewCount] = await db
			.select({ count: sql<number>`count(*)` })
			.from(analyticsEvents);
		stats.totalPageViews = pageViewCount?.count ?? 0;

		stats.totalEventPages = Math.max(
			1,
			Math.ceil(stats.totalPageViews / RECENT_EVENTS_PAGE_SIZE),
		);
		stats.totalSessionPages = Math.max(
			1,
			Math.ceil(stats.totalSessions / RECENT_SESSIONS_PAGE_SIZE),
		);
		stats.eventsPage = Math.min(requestedEventsPage, stats.totalEventPages);
		stats.sessionsPage = Math.min(
			requestedSessionsPage,
			stats.totalSessionPages,
		);
		const eventsOffset = (stats.eventsPage - 1) * RECENT_EVENTS_PAGE_SIZE;
		const sessionsOffset = (stats.sessionsPage - 1) * RECENT_SESSIONS_PAGE_SIZE;

		stats.topPages = (await db
			.select({
				pageUrl: analyticsEvents.pageUrl,
				views: sql<number>`count(*)`,
			})
			.from(analyticsEvents)
			.groupBy(analyticsEvents.pageUrl)
			.orderBy(desc(sql`count(*)`))
			.limit(TOP_ITEMS_LIMIT)) as Array<{ pageUrl: string; views: number }>;

		stats.topReferrers = (
			await db
				.select({
					referrer: analyticsSessions.referrer,
					count: sql<number>`count(*)`,
				})
				.from(analyticsSessions)
				.groupBy(analyticsSessions.referrer)
				.orderBy(desc(sql`count(*)`))
				.limit(TOP_ITEMS_LIMIT)
		).filter((r) => r.referrer) as Array<{ referrer: string; count: number }>;

		stats.recentEvents = await db
			.select({
				eventType: analyticsEvents.eventType,
				pageUrl: analyticsEvents.pageUrl,
				timestamp: analyticsEvents.timestamp,
			})
			.from(analyticsEvents)
			.orderBy(desc(analyticsEvents.timestamp))
			.limit(RECENT_EVENTS_PAGE_SIZE)
			.offset(eventsOffset);

		stats.recentSessions = await db
			.select({
				ipAddress: analyticsSessions.ipAddress,
				browser: analyticsSessions.browser,
				deviceType: analyticsSessions.deviceType,
				landingPage: analyticsSessions.landingPage,
				lastSeenAt: analyticsSessions.lastSeenAt,
			})
			.from(analyticsSessions)
			.orderBy(desc(analyticsSessions.lastSeenAt))
			.limit(RECENT_SESSIONS_PAGE_SIZE)
			.offset(sessionsOffset);
	} catch {
		// D1 未绑定时回退为空统计
	}

	const content = `
		<div class="page-header">
			<h1>访问统计</h1>
			<div class="table-actions analytics-actions">
				<a href="/api/admin/analytics/export?format=jsonl" class="btn">下载全部明细（JSONL）</a>
				<a href="/api/admin/analytics/export?format=json" class="btn">下载全部明细（JSON）</a>
				<a href="/api/admin/analytics?cleanup=1" class="btn">清理 ${ANALYTICS_RETENTION_DAYS} 天前数据</a>
			</div>
		</div>
		<p class="page-intro">这里集中查看页面访问、来源分布和最近事件。默认自动保留最近 ${ANALYTICS_RETENTION_DAYS} 天数据，避免日志无限增长。</p>
		${
			stats.cleanupNotice
				? `<div class="alert alert-success">${escapeHtml(stats.cleanupNotice)}</div>`
				: ""
		}
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
				? `<div class="table-card"><table class="data-table">
				<thead><tr><th>页面</th><th>浏览量</th></tr></thead>
				<tbody>
					${stats.topPages.map((p) => `<tr><td class="table-cell-break">${escapeHtml(p.pageUrl || "-")}</td><td>${p.views}</td></tr>`).join("")}
				</tbody>
			</table></div>`
				: "<p class='empty-state'>当前还没有页面访问数据。</p>"
		}

		<h2>来源站点</h2>
		${
			stats.topReferrers.length > 0
				? `<div class="table-card"><table class="data-table">
				<thead><tr><th>来源</th><th>次数</th></tr></thead>
				<tbody>
					${stats.topReferrers.map((r) => `<tr><td class="table-cell-break">${escapeHtml(r.referrer)}</td><td>${r.count}</td></tr>`).join("")}
				</tbody>
			</table></div>`
				: "<p class='empty-state'>当前还没有来源统计数据。</p>"
		}

		<h2>最近会话（审计）</h2>
		${
			stats.recentSessions.length > 0
				? `<div class="table-card"><table class="data-table">
				<thead><tr><th>IP</th><th>浏览器/设备</th><th>落地页</th><th>最后访问</th></tr></thead>
				<tbody>
					${stats.recentSessions
						.map(
							(s) =>
								`<tr><td>${escapeHtml(s.ipAddress || "-")}</td><td>${escapeHtml(`${s.browser || "Unknown"} / ${s.deviceType || "Unknown"}`)}</td><td class="table-cell-break">${escapeHtml(s.landingPage || "-")}</td><td>${escapeHtml(s.lastSeenAt)}</td></tr>`,
						)
						.join("")}
				</tbody>
			</table></div>
			${renderPagination({
				requestUrl: c.req.url,
				paramKey: "sessionsPage",
				current: stats.sessionsPage,
				total: stats.totalSessionPages,
			})}`
				: "<p class='empty-state'>当前还没有会话审计数据。</p>"
		}

		<h2>最近事件</h2>
		${
			stats.recentEvents.length > 0
				? `<div class="table-card"><table class="data-table">
				<thead><tr><th>类型</th><th>页面</th><th>时间</th></tr></thead>
				<tbody>
					${stats.recentEvents.map((e) => `<tr><td>${escapeHtml(e.eventType)}</td><td class="table-cell-break">${escapeHtml(e.pageUrl || "-")}</td><td>${escapeHtml(e.timestamp)}</td></tr>`).join("")}
				</tbody>
			</table></div>
			${renderPagination({
				requestUrl: c.req.url,
				paramKey: "eventsPage",
				current: stats.eventsPage,
				total: stats.totalEventPages,
			})}`
				: "<p class='empty-state'>当前还没有事件记录。</p>"
		}
	`;

	return c.html(
		adminLayout("访问统计", content, { csrfToken: session.csrfToken }),
	);
});

analytics.get("/export", async (c) => {
	const db = getDb(c.env.DB);
	const format = c.req.query("format") === "json" ? "json" : "jsonl";
	const generatedAt = new Date().toISOString();

	const sessions = (await db
		.select({
			id: analyticsSessions.id,
			sessionId: analyticsSessions.sessionId,
			ipAddress: analyticsSessions.ipAddress,
			ipHash: analyticsSessions.ipHash,
			country: analyticsSessions.country,
			region: analyticsSessions.region,
			city: analyticsSessions.city,
			userAgent: analyticsSessions.userAgent,
			browser: analyticsSessions.browser,
			os: analyticsSessions.os,
			deviceType: analyticsSessions.deviceType,
			referrer: analyticsSessions.referrer,
			utmSource: analyticsSessions.utmSource,
			utmMedium: analyticsSessions.utmMedium,
			utmCampaign: analyticsSessions.utmCampaign,
			landingPage: analyticsSessions.landingPage,
			startedAt: analyticsSessions.startedAt,
			lastSeenAt: analyticsSessions.lastSeenAt,
		})
		.from(analyticsSessions)
		.orderBy(desc(analyticsSessions.lastSeenAt))) as FullSessionRow[];

	const events = (await db
		.select({
			id: analyticsEvents.id,
			sessionId: analyticsEvents.sessionId,
			eventType: analyticsEvents.eventType,
			eventName: analyticsEvents.eventName,
			pageUrl: analyticsEvents.pageUrl,
			pageTitle: analyticsEvents.pageTitle,
			eventData: analyticsEvents.eventData,
			scrollDepth: analyticsEvents.scrollDepth,
			timeOnPageSeconds: analyticsEvents.timeOnPageSeconds,
			timestamp: analyticsEvents.timestamp,
		})
		.from(analyticsEvents)
		.orderBy(desc(analyticsEvents.timestamp))) as FullEventRow[];

	const fileName = `analytics-export-${formatExportTimestamp()}.${format === "json" ? "json" : "jsonl"}`;
	if (format === "json") {
		const payload = JSON.stringify(
			{
				generatedAt,
				retentionDays: ANALYTICS_RETENTION_DAYS,
				sessions,
				events,
			},
			null,
			2,
		);

		return new Response(payload, {
			headers: {
				"content-type": "application/json; charset=utf-8",
				"content-disposition": `attachment; filename="${fileName}"`,
				"cache-control": "no-store",
			},
		});
	}

	const lines = [
		JSON.stringify({
			type: "meta",
			generatedAt,
			retentionDays: ANALYTICS_RETENTION_DAYS,
			sessionsCount: sessions.length,
			eventsCount: events.length,
		}),
	];

	for (const row of sessions) {
		lines.push(JSON.stringify({ type: "session", ...row }));
	}
	for (const row of events) {
		lines.push(JSON.stringify({ type: "event", ...row }));
	}

	return new Response(lines.join("\n"), {
		headers: {
			"content-type": "application/x-ndjson; charset=utf-8",
			"content-disposition": `attachment; filename="${fileName}"`,
			"cache-control": "no-store",
		},
	});
});

export { analytics as analyticsRoutes };
