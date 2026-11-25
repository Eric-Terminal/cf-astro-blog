import { desc, sql } from "drizzle-orm";
import { Hono } from "hono";
import {
	analyticsEvents,
	analyticsSessions,
	blogPosts,
	friendLinks,
	webMentions,
} from "@/db/schema";
import { getDb } from "@/lib/db";
import {
	DEFAULT_AI_SETTINGS,
	DEFAULT_SITE_APPEARANCE,
	getResolvedAiSettings,
	getSiteAppearance,
} from "@/lib/site-appearance";
import {
	type AdminAppEnv,
	getAuthenticatedSession,
	requireAuth,
} from "../middleware/auth";
import { dashboardPage } from "../views/dashboard";

const dashboard = new Hono<AdminAppEnv>();

dashboard.use("*", requireAuth);

dashboard.get("/", async (c) => {
	const session = getAuthenticatedSession(c);
	try {
		const db = getDb(c.env.DB);

		const [postStats] = await db
			.select({
				total: sql<number>`count(*)`,
				published: sql<number>`sum(case when status = 'published' then 1 else 0 end)`,
				drafts: sql<number>`sum(case when status = 'draft' then 1 else 0 end)`,
				scheduled: sql<number>`sum(case when status = 'scheduled' then 1 else 0 end)`,
			})
			.from(blogPosts);

		const [sessionStats] = await db
			.select({ total: sql<number>`count(*)` })
			.from(analyticsSessions);

		const [eventStats] = await db
			.select({ total: sql<number>`count(*)` })
			.from(analyticsEvents);

		const [friendStats] = await db
			.select({
				approved: sql<number>`sum(case when status = 'approved' then 1 else 0 end)`,
				pending: sql<number>`sum(case when status = 'pending' then 1 else 0 end)`,
			})
			.from(friendLinks)
			.catch(() => [{ approved: 0, pending: 0 }]);

		const [mentionStats] = await db
			.select({
				pending: sql<number>`sum(case when status = 'pending' then 1 else 0 end)`,
			})
			.from(webMentions)
			.catch(() => [{ pending: 0 }]);

		const [appearance, resolvedAi] = await Promise.all([
			getSiteAppearance(db).catch(() => DEFAULT_SITE_APPEARANCE),
			getResolvedAiSettings(db, c.env).catch(() => ({
				settings: DEFAULT_AI_SETTINGS,
			})),
		]);

		const recentPosts = await db
			.select({
				id: blogPosts.id,
				title: blogPosts.title,
				slug: blogPosts.slug,
				status: blogPosts.status,
				isPinned: blogPosts.isPinned,
				viewCount: blogPosts.viewCount,
				createdAt: blogPosts.createdAt,
			})
			.from(blogPosts)
			.orderBy(desc(blogPosts.createdAt))
			.limit(6);

		return c.html(
			dashboardPage(
				{
					posts: {
						total: postStats?.total ?? 0,
						published: postStats?.published ?? 0,
						drafts: postStats?.drafts ?? 0,
						scheduled: postStats?.scheduled ?? 0,
					},
					friends: {
						approved: friendStats?.approved ?? 0,
						pending: friendStats?.pending ?? 0,
					},
					mentions: {
						pending: mentionStats?.pending ?? 0,
					},
					system: {
						mcpEnabled: appearance.mcpEnabled,
						aiEnabled: resolvedAi.settings.internal.enabled,
					},
					sessions: sessionStats?.total ?? 0,
					events: eventStats?.total ?? 0,
					recentPosts,
				},
				session.csrfToken,
			),
		);
	} catch {
		return c.html(
			dashboardPage(
				{
					posts: { total: 0, published: 0, drafts: 0, scheduled: 0 },
					friends: { approved: 0, pending: 0 },
					mentions: { pending: 0 },
					system: { mcpEnabled: false, aiEnabled: false },
					sessions: 0,
					events: 0,
					recentPosts: [],
				},
				session.csrfToken,
			),
		);
	}
});

export { dashboard as dashboardRoutes };
