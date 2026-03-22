import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { desc } from "drizzle-orm";
import { blogPosts } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getPublicPostVisibilityCondition } from "@/lib/public-content";
import { siteConfig } from "@/lib/types";

export const GET: APIRoute = async () => {
	let posts: Array<{
		slug: string;
		updatedAt: string;
	}> = [];

	try {
		const db = getDb(env.DB);

		posts = await db
			.select({
				slug: blogPosts.slug,
				updatedAt: blogPosts.updatedAt,
			})
			.from(blogPosts)
			.where(getPublicPostVisibilityCondition())
			.orderBy(desc(blogPosts.updatedAt));
	} catch {
		// D1 not bound
	}

	const staticPages = [
		{ url: "/", priority: "1.0" },
		{ url: "/blog", priority: "0.9" },
		{ url: "/friends", priority: "0.7" },
		{ url: "/search", priority: "0.5" },
	];

	const urls = [
		...staticPages.map(
			(page) => `
	<url>
		<loc>${siteConfig.url}${page.url}</loc>
		<priority>${page.priority}</priority>
	</url>`,
		),
		...posts.map(
			(post) => `
	<url>
		<loc>${siteConfig.url}/blog/${post.slug}</loc>
		<lastmod>${post.updatedAt}</lastmod>
		<priority>0.7</priority>
	</url>`,
		),
	].join("\n");

	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	${urls}
</urlset>`;

	return new Response(sitemap.trim(), {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};
