import { desc, sql } from "drizzle-orm";
import { Hono } from "hono";
import { analyticsEvents, analyticsSessions, blogPosts } from "@/db/schema";
import { getDb } from "@/lib/db";
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
			})
			.from(blogPosts);

		const [sessionStats] = await db
			.select({ total: sql<number>`count(*)` })
			.from(analyticsSessions);

		const [eventStats] = await db
			.select({ total: sql<number>`count(*)` })
			.from(analyticsEvents);

		const recentPosts = await db
			.select({
				id: blogPosts.id,
				title: blogPosts.title,
				slug: blogPosts.slug,
				status: blogPosts.status,
				viewCount: blogPosts.viewCount,
				createdAt: blogPosts.createdAt,
			})
			.from(blogPosts)
			.orderBy(desc(blogPosts.createdAt))
			.limit(5);

		return c.html(
			dashboardPage(
				{
					posts: {
						total: postStats?.total ?? 0,
						published: postStats?.published ?? 0,
						drafts: postStats?.drafts ?? 0,
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
					posts: { total: 0, published: 0, drafts: 0 },
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
