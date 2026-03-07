import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { blogCategories, blogPosts, blogPostTags, blogTags } from "@/db/schema";
import { getDb } from "@/lib/db";
import {
	buildUrlSlug,
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
	getBodyText,
	requireAuth,
} from "../middleware/auth";
import { adminLayout } from "../views/layout";
import { postEditorPage } from "../views/posts/editor";
import { postsListPage } from "../views/posts/list";

const posts = new Hono<AdminAppEnv>();
type BlogDb = ReturnType<typeof getDb>;

interface ParsedPostInput {
	title: string;
	slug: string;
	content: string;
	excerpt: string | null;
	status: "draft" | "published" | "scheduled";
	publishAt: string | null;
	featuredImageKey: string | null;
	featuredImageAlt: string | null;
	metaTitle: string | null;
	metaDescription: string | null;
	metaKeywords: string | null;
	canonicalUrl: string | null;
	categoryId: number | null;
	newCategoryName: string | null;
	tagIds: number[];
	newTagNames: string[];
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

	const rawSlugInput = sanitizePlainText(body.slug, 120).toLowerCase();
	const manualSlug = rawSlugInput ? sanitizeSlug(rawSlugInput) : null;
	if (rawSlugInput && !manualSlug) {
		return { error: "网址别名格式不合法喵" } as const;
	}

	const slug =
		manualSlug ||
		buildUrlSlug(title, { fallbackPrefix: "post", maxLength: 120 });

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

	const publishAtRaw = sanitizePlainText(body.publishAt, 32, { trim: true });
	let publishAt: string | null = null;
	if (publishAtRaw) {
		const parsed = new Date(publishAtRaw);
		if (Number.isNaN(parsed.getTime())) {
			return { error: "定时发布时间格式不合法喵" } as const;
		}
		publishAt = parsed.toISOString();
	}
	if (status === "scheduled" && !publishAt) {
		return { error: "定时发布需要填写发布时间喵" } as const;
	}

	const categoryIdRaw = String(body.categoryId ?? "").trim();
	const isNewCategorySelected = categoryIdRaw === "__new__";
	const categoryId =
		categoryIdRaw && !isNewCategorySelected
			? parseOptionalPositiveInt(categoryIdRaw)
			: null;
	if (categoryIdRaw && !isNewCategorySelected && categoryId === null) {
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

	const newTagNamesRaw = sanitizePlainText(body.newTagNames, 400, {
		allowNewlines: true,
	});
	const newCategoryName = sanitizePlainText(body.newCategoryName, 60) || null;
	if (isNewCategorySelected && !newCategoryName) {
		return { error: "你选择了新建分类，请输入分类名称喵" } as const;
	}

	return {
		data: {
			title,
			slug,
			content,
			excerpt:
				sanitizePlainText(body.excerpt, 200, { allowNewlines: true }) || null,
			status,
			publishAt,
			featuredImageKey,
			featuredImageAlt: sanitizePlainText(body.featuredImageAlt, 200) || null,
			metaTitle: sanitizePlainText(body.metaTitle, 200) || null,
			metaDescription: sanitizePlainText(body.metaDescription, 160) || null,
			metaKeywords: sanitizePlainText(body.metaKeywords, 200) || null,
			canonicalUrl,
			categoryId,
			newCategoryName,
			tagIds: parseTagIds(body.tagIds),
			newTagNames: [
				...new Set(
					newTagNamesRaw
						.split(/[\n,，]/)
						.map((value) => sanitizePlainText(value, 60))
						.filter(Boolean),
				),
			],
		} satisfies ParsedPostInput,
	} as const;
}

function buildSlugCandidate(
	baseSlug: string,
	index: number,
	maxLength: number,
): string {
	const suffix = index === 0 ? "" : `-${index + 1}`;
	const trimmedBase = baseSlug
		.slice(0, Math.max(1, maxLength - suffix.length))
		.replaceAll(/-+$/g, "");
	return `${trimmedBase}${suffix}`;
}

async function resolveUniquePostSlug(
	db: BlogDb,
	baseSlug: string,
	excludePostId?: number,
): Promise<string> {
	for (let index = 0; index < 120; index += 1) {
		const candidate = buildSlugCandidate(baseSlug, index, 120);
		const [existing] = await db
			.select({ id: blogPosts.id })
			.from(blogPosts)
			.where(eq(blogPosts.slug, candidate))
			.limit(1);

		if (!existing || existing.id === excludePostId) {
			return candidate;
		}
	}

	return buildSlugCandidate(
		`${baseSlug}-${crypto.randomUUID().slice(0, 8)}`,
		0,
		120,
	);
}

async function createOrGetCategoryId(
	db: BlogDb,
	categoryName: string,
): Promise<number | null> {
	const [existingByName] = await db
		.select({ id: blogCategories.id })
		.from(blogCategories)
		.where(eq(blogCategories.name, categoryName))
		.limit(1);

	if (existingByName) {
		return existingByName.id;
	}

	const baseSlug = buildUrlSlug(categoryName, {
		fallbackPrefix: "category",
		maxLength: 80,
	});

	for (let index = 0; index < 120; index += 1) {
		const candidate = buildSlugCandidate(baseSlug, index, 80);
		const [existingBySlug] = await db
			.select({ id: blogCategories.id })
			.from(blogCategories)
			.where(eq(blogCategories.slug, candidate))
			.limit(1);

		if (existingBySlug) {
			continue;
		}

		const now = new Date().toISOString();
		const [inserted] = await db
			.insert(blogCategories)
			.values({
				name: categoryName,
				slug: candidate,
				createdAt: now,
				updatedAt: now,
			})
			.returning({ id: blogCategories.id });

		return inserted?.id ?? null;
	}

	return null;
}

async function createOrGetTagId(
	db: BlogDb,
	tagName: string,
): Promise<number | null> {
	const [existingByName] = await db
		.select({ id: blogTags.id })
		.from(blogTags)
		.where(eq(blogTags.name, tagName))
		.limit(1);

	if (existingByName) {
		return existingByName.id;
	}

	const baseSlug = buildUrlSlug(tagName, {
		fallbackPrefix: "tag",
		maxLength: 80,
	});

	for (let index = 0; index < 120; index += 1) {
		const candidate = buildSlugCandidate(baseSlug, index, 80);
		const [existingBySlug] = await db
			.select({ id: blogTags.id })
			.from(blogTags)
			.where(eq(blogTags.slug, candidate))
			.limit(1);

		if (existingBySlug) {
			continue;
		}

		const [inserted] = await db
			.insert(blogTags)
			.values({
				name: tagName,
				slug: candidate,
			})
			.returning({ id: blogTags.id });

		return inserted?.id ?? null;
	}

	return null;
}

async function resolveCategoryId(
	db: BlogDb,
	categoryId: number | null,
	newCategoryName: string | null,
): Promise<number | null> {
	if (!newCategoryName) {
		return categoryId;
	}

	const createdCategoryId = await createOrGetCategoryId(db, newCategoryName);
	return createdCategoryId ?? categoryId;
}

async function resolveTagIds(
	db: BlogDb,
	tagIds: number[],
	newTagNames: string[],
): Promise<number[]> {
	const finalTagIds = new Set(tagIds);
	for (const tagName of newTagNames) {
		const tagId = await createOrGetTagId(db, tagName);
		if (tagId) {
			finalTagIds.add(tagId);
		}
	}

	return [...finalTagIds];
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
			postEditorPage({
				categories,
				tags,
				currentUsername: session.username,
				csrfToken: session.csrfToken,
			}),
		);
	} catch {
		return c.html(
			postEditorPage({
				categories: [],
				tags: [],
				currentUsername: session.username,
				csrfToken: session.csrfToken,
			}),
		);
	}
});

posts.post("/", async (c) => {
	const session = getAuthenticatedSession(c);
	const db = getDb(c.env.DB);
	const body = await c.req.parseBody();
	if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
		return c.text("CSRF 校验失败喵", 403);
	}

	const parsed = parsePostInput(body);
	if ("error" in parsed) {
		return c.html(renderPostErrorPage(session.csrfToken, parsed.error), 400);
	}

	const now = new Date().toISOString();
	const categoryId = await resolveCategoryId(
		db,
		parsed.data.categoryId,
		parsed.data.newCategoryName,
	);
	const tagIds = await resolveTagIds(
		db,
		parsed.data.tagIds,
		parsed.data.newTagNames,
	);
	const slug = await resolveUniquePostSlug(db, parsed.data.slug);
	const publishAt =
		parsed.data.status === "scheduled"
			? parsed.data.publishAt
			: parsed.data.status === "published"
				? now
				: null;
	const publishedAt = parsed.data.status === "published" ? now : null;

	const [inserted] = await db
		.insert(blogPosts)
		.values({
			title: parsed.data.title,
			slug,
			content: parsed.data.content,
			excerpt: parsed.data.excerpt,
			status: parsed.data.status,
			publishAt,
			publishedAt,
			featuredImageKey: parsed.data.featuredImageKey,
			featuredImageAlt: parsed.data.featuredImageAlt,
			metaTitle: parsed.data.metaTitle,
			metaDescription: parsed.data.metaDescription,
			metaKeywords: parsed.data.metaKeywords,
			canonicalUrl: parsed.data.canonicalUrl,
			categoryId,
			authorName: session.username,
			createdAt: now,
			updatedAt: now,
		})
		.returning({ id: blogPosts.id });

	if (inserted && tagIds.length > 0) {
		await db.insert(blogPostTags).values(
			tagIds.map((tagId) => ({
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
			currentUsername: session.username,
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
	if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
		return c.text("CSRF 校验失败喵", 403);
	}

	const parsed = parsePostInput(body);
	if ("error" in parsed) {
		return c.html(renderPostErrorPage(session.csrfToken, parsed.error), 400);
	}

	const now = new Date().toISOString();

	const [existing] = await db
		.select({
			status: blogPosts.status,
			publishedAt: blogPosts.publishedAt,
			publishAt: blogPosts.publishAt,
		})
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
	const publishAt =
		parsed.data.status === "scheduled"
			? parsed.data.publishAt
			: parsed.data.status === "published"
				? now
				: null;
	const categoryId = await resolveCategoryId(
		db,
		parsed.data.categoryId,
		parsed.data.newCategoryName,
	);
	const tagIds = await resolveTagIds(
		db,
		parsed.data.tagIds,
		parsed.data.newTagNames,
	);
	const slug = await resolveUniquePostSlug(db, parsed.data.slug, id);

	await db
		.update(blogPosts)
		.set({
			title: parsed.data.title,
			slug,
			content: parsed.data.content,
			excerpt: parsed.data.excerpt,
			status: parsed.data.status,
			publishAt,
			publishedAt,
			featuredImageKey: parsed.data.featuredImageKey,
			featuredImageAlt: parsed.data.featuredImageAlt,
			metaTitle: parsed.data.metaTitle,
			metaDescription: parsed.data.metaDescription,
			metaKeywords: parsed.data.metaKeywords,
			canonicalUrl: parsed.data.canonicalUrl,
			categoryId,
			authorName: session.username,
			updatedAt: now,
		})
		.where(eq(blogPosts.id, id));

	await db.delete(blogPostTags).where(eq(blogPostTags.postId, id));
	if (tagIds.length > 0) {
		await db.insert(blogPostTags).values(
			tagIds.map((tagId) => ({
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
	if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
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
