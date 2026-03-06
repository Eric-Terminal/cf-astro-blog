import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { blogCategories, blogPosts, blogPostTags, blogTags } from "@/db/schema";
import { getDb } from "@/lib/db";
import {
	escapeHtml,
	parseOptionalPositiveInt,
	parseTagIds,
	sanitizeCanonicalUrl,
	sanitizeMediaKey,
	sanitizePlainText,
	sanitizePostStatus,
	sanitizeSlug,
} from "@/lib/security";
import {
	type AdminAppEnv,
	assertCsrfToken,
	getAuthenticatedSession,
	requireAuth,
} from "../middleware/auth";
import { adminLayout } from "../views/layout";
import { postEditorPage } from "../views/posts/editor";
import { postsListPage } from "../views/posts/list";

const posts = new Hono<AdminAppEnv>();

interface ParsedPostInput {
	title: string;
	slug: string;
	content: string;
	excerpt: string | null;
	status: "draft" | "published" | "scheduled";
	featuredImageKey: string | null;
	featuredImageAlt: string | null;
	metaTitle: string | null;
	metaDescription: string | null;
	metaKeywords: string | null;
	canonicalUrl: string | null;
	categoryId: number | null;
	authorName: string;
	tagIds: number[];
}

type ParsedPostInputResult = { data: ParsedPostInput } | { error: string };

function renderPostErrorPage(csrfToken: string, message: string) {
	return adminLayout(
		"文章保存失败",
		`<div class="alert alert-error">${escapeHtml(message)}</div><p><a href="/api/admin/posts">返回文章列表</a></p>`,
		{ csrfToken },
	);
}

function parsePostInput(body: Record<string, unknown>): ParsedPostInputResult {
	const title = sanitizePlainText(body.title, 200);
	if (!title) {
		return { error: "标题不能为空喵" } as const;
	}

	const slug = sanitizeSlug(body.slug);
	if (!slug) {
		return { error: "网址别名格式不合法喵" } as const;
	}

	const content = sanitizePlainText(body.content, 100_000, {
		allowNewlines: true,
		trim: false,
	});
	if (!content.trim()) {
		return { error: "正文不能为空喵" } as const;
	}

	const status = sanitizePostStatus(body.status);
	if (!status) {
		return { error: "文章状态不合法喵" } as const;
	}

	const categoryIdRaw = String(body.categoryId ?? "").trim();
	const categoryId = categoryIdRaw
		? parseOptionalPositiveInt(categoryIdRaw)
		: null;
	if (categoryIdRaw && categoryId === null) {
		return { error: "分类参数不合法喵" } as const;
	}

	const canonicalUrlRaw = String(body.canonicalUrl ?? "").trim();
	const canonicalUrl = canonicalUrlRaw
		? sanitizeCanonicalUrl(canonicalUrlRaw)
		: null;
	if (canonicalUrlRaw && !canonicalUrl) {
		return { error: "规范链接地址不合法喵" } as const;
	}

	const featuredImageKeyRaw = String(body.featuredImageKey ?? "").trim();
	const featuredImageKey = featuredImageKeyRaw
		? sanitizeMediaKey(featuredImageKeyRaw)
		: null;
	if (featuredImageKeyRaw && !featuredImageKey) {
		return { error: "封面图片键名不合法喵" } as const;
	}

	return {
		data: {
			title,
			slug,
			content,
			excerpt:
				sanitizePlainText(body.excerpt, 200, { allowNewlines: true }) || null,
			status,
			featuredImageKey,
			featuredImageAlt: sanitizePlainText(body.featuredImageAlt, 200) || null,
			metaTitle: sanitizePlainText(body.metaTitle, 200) || null,
			metaDescription: sanitizePlainText(body.metaDescription, 160) || null,
			metaKeywords: sanitizePlainText(body.metaKeywords, 200) || null,
			canonicalUrl,
			categoryId,
			authorName: sanitizePlainText(body.authorName, 80) || "管理员",
			tagIds: parseTagIds(body.tagIds),
		} satisfies ParsedPostInput,
	} as const;
}

posts.use("*", requireAuth);

posts.get("/", async (c) => {
	const session = getAuthenticatedSession(c);
	try {
		const db = getDb(c.env.DB);
		const allPosts = await db
			.select({
				id: blogPosts.id,
				title: blogPosts.title,
				slug: blogPosts.slug,
				status: blogPosts.status,
				publishedAt: blogPosts.publishedAt,
				viewCount: blogPosts.viewCount,
				createdAt: blogPosts.createdAt,
				categoryName: blogCategories.name,
			})
			.from(blogPosts)
			.leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
			.orderBy(desc(blogPosts.createdAt));

		return c.html(postsListPage(allPosts, session.csrfToken));
	} catch {
		return c.html(postsListPage([], session.csrfToken));
	}
});

posts.get("/new", async (c) => {
	const session = getAuthenticatedSession(c);
	try {
		const db = getDb(c.env.DB);
		const categories = await db.select().from(blogCategories);
		const tags = await db.select().from(blogTags);
		return c.html(
			postEditorPage({ categories, tags, csrfToken: session.csrfToken }),
		);
	} catch {
		return c.html(
			postEditorPage({
				categories: [],
				tags: [],
				csrfToken: session.csrfToken,
			}),
		);
	}
});

posts.post("/", async (c) => {
	const session = getAuthenticatedSession(c);
	const db = getDb(c.env.DB);
	const body = await c.req.parseBody();
	if (!assertCsrfToken(body._csrf, session)) {
		return c.text("CSRF 校验失败喵", 403);
	}

	const parsed = parsePostInput(body);
	if ("error" in parsed) {
		return c.html(renderPostErrorPage(session.csrfToken, parsed.error), 400);
	}

	const now = new Date().toISOString();
	const publishedAt = parsed.data.status === "published" ? now : null;

	const [inserted] = await db
		.insert(blogPosts)
		.values({
			title: parsed.data.title,
			slug: parsed.data.slug,
			content: parsed.data.content,
			excerpt: parsed.data.excerpt,
			status: parsed.data.status,
			publishedAt,
			featuredImageKey: parsed.data.featuredImageKey,
			featuredImageAlt: parsed.data.featuredImageAlt,
			metaTitle: parsed.data.metaTitle,
			metaDescription: parsed.data.metaDescription,
			metaKeywords: parsed.data.metaKeywords,
			canonicalUrl: parsed.data.canonicalUrl,
			categoryId: parsed.data.categoryId,
			authorName: parsed.data.authorName,
			createdAt: now,
			updatedAt: now,
		})
		.returning({ id: blogPosts.id });

	if (inserted && parsed.data.tagIds.length > 0) {
		await db.insert(blogPostTags).values(
			parsed.data.tagIds.map((tagId) => ({
				postId: inserted.id,
				tagId,
			})),
		);
	}

	return c.redirect("/api/admin/posts");
});

posts.get("/:id/edit", async (c) => {
	const session = getAuthenticatedSession(c);
	const id = parseOptionalPositiveInt(c.req.param("id"));
	if (!id) {
		return c.redirect("/api/admin/posts");
	}
	const db = getDb(c.env.DB);

	const [post] = await db
		.select()
		.from(blogPosts)
		.where(eq(blogPosts.id, id))
		.limit(1);

	if (!post) {
		return c.redirect("/api/admin/posts");
	}

	const categories = await db.select().from(blogCategories);
	const tags = await db.select().from(blogTags);
	const postTagRows = await db
		.select({ tagId: blogPostTags.tagId })
		.from(blogPostTags)
		.where(eq(blogPostTags.postId, id));

	return c.html(
		postEditorPage({
			post,
			categories,
			tags,
			selectedTagIds: postTagRows.map((r) => r.tagId),
			csrfToken: session.csrfToken,
		}),
	);
});

posts.post("/:id", async (c) => {
	const session = getAuthenticatedSession(c);
	const id = parseOptionalPositiveInt(c.req.param("id"));
	if (!id) {
		return c.redirect("/api/admin/posts");
	}
	const db = getDb(c.env.DB);
	const body = await c.req.parseBody();
	if (!assertCsrfToken(body._csrf, session)) {
		return c.text("CSRF 校验失败喵", 403);
	}

	const parsed = parsePostInput(body);
	if ("error" in parsed) {
		return c.html(renderPostErrorPage(session.csrfToken, parsed.error), 400);
	}

	const now = new Date().toISOString();

	const [existing] = await db
		.select({ status: blogPosts.status, publishedAt: blogPosts.publishedAt })
		.from(blogPosts)
		.where(eq(blogPosts.id, id))
		.limit(1);
	if (!existing) {
		return c.redirect("/api/admin/posts");
	}

	const publishedAt =
		parsed.data.status === "published" && existing.status !== "published"
			? now
			: (existing.publishedAt ?? null);

	await db
		.update(blogPosts)
		.set({
			title: parsed.data.title,
			slug: parsed.data.slug,
			content: parsed.data.content,
			excerpt: parsed.data.excerpt,
			status: parsed.data.status,
			publishedAt,
			featuredImageKey: parsed.data.featuredImageKey,
			featuredImageAlt: parsed.data.featuredImageAlt,
			metaTitle: parsed.data.metaTitle,
			metaDescription: parsed.data.metaDescription,
			metaKeywords: parsed.data.metaKeywords,
			canonicalUrl: parsed.data.canonicalUrl,
			categoryId: parsed.data.categoryId,
			authorName: parsed.data.authorName,
			updatedAt: now,
		})
		.where(eq(blogPosts.id, id));

	await db.delete(blogPostTags).where(eq(blogPostTags.postId, id));
	if (parsed.data.tagIds.length > 0) {
		await db.insert(blogPostTags).values(
			parsed.data.tagIds.map((tagId) => ({
				postId: id,
				tagId,
			})),
		);
	}

	return c.redirect("/api/admin/posts");
});

posts.post("/:id/delete", async (c) => {
	const session = getAuthenticatedSession(c);
	const body = await c.req.parseBody();
	if (!assertCsrfToken(body._csrf, session)) {
		return c.text("CSRF 校验失败喵", 403);
	}

	const id = parseOptionalPositiveInt(c.req.param("id"));
	if (!id) {
		return c.redirect("/api/admin/posts");
	}
	const db = getDb(c.env.DB);
	await db.delete(blogPosts).where(eq(blogPosts.id, id));
	return c.redirect("/api/admin/posts");
});

export { posts as postsRoutes };
