import { and, asc, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { generatePostSeoWithInternalAi } from "@/admin/lib/ai-post-seo";
import { triggerDeployHook } from "@/admin/lib/deploy-hook";
import { blogCategories, blogPosts, blogPostTags, blogTags } from "@/db/schema";
import { getDb } from "@/lib/db";
import { isOpenAICompatibleEndpointReady } from "@/lib/openai-compatible";
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
	DEFAULT_AI_SETTINGS,
	getResolvedAiSettings,
} from "@/lib/site-appearance";
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
	publishedAt: string | null;
	featuredImageKey: string | null;
	featuredImageAlt: string | null;
	isPinned: boolean;
	pinnedOrder: number;
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

interface TaxonomyRow {
	id: number;
	name: string;
	slug: string;
	postCount: number;
}

function isPostPublic(
	status: string | null | undefined,
	publishAt: string | null | undefined,
): boolean {
	if (status === "published") {
		return true;
	}

	if (status !== "scheduled" || !publishAt) {
		return false;
	}

	const timestamp = Date.parse(publishAt);
	return !Number.isNaN(timestamp) && timestamp <= Date.now();
}

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
		return { error: "标题不能为空" } as const;
	}

	const rawSlugInput = sanitizePlainText(body.slug, 120).toLowerCase();
	const manualSlug = rawSlugInput ? sanitizeSlug(rawSlugInput) : null;
	if (rawSlugInput && !manualSlug) {
		return { error: "网址别名格式不合法" } as const;
	}

	const slug =
		manualSlug ||
		buildUrlSlug(title, { fallbackPrefix: "post", maxLength: 120 });

	const content = sanitizePlainText(body.content, 100_000, {
		allowNewlines: true,
		trim: false,
	});
	if (!content.trim()) {
		return { error: "正文不能为空" } as const;
	}

	const status = sanitizePostStatus(body.status);
	if (!status) {
		return { error: "文章状态不合法" } as const;
	}

	const publishAtRaw = sanitizePlainText(body.publishAt, 32, { trim: true });
	let publishAt: string | null = null;
	if (publishAtRaw) {
		const parsed = new Date(publishAtRaw);
		if (Number.isNaN(parsed.getTime())) {
			return { error: "定时发布时间格式不合法" } as const;
		}
		publishAt = parsed.toISOString();
	}
	if (status === "scheduled" && !publishAt) {
		return { error: "定时发布需要填写发布时间" } as const;
	}

	const publishedAtRaw = sanitizePlainText(body.publishedAt, 32, {
		trim: true,
	});
	let publishedAt: string | null = null;
	if (publishedAtRaw) {
		const parsed = new Date(publishedAtRaw);
		if (Number.isNaN(parsed.getTime())) {
			return { error: "发布日期格式不合法" } as const;
		}
		publishedAt = parsed.toISOString();
	}

	const categoryIdRaw = String(body.categoryId ?? "").trim();
	const isNewCategorySelected = categoryIdRaw === "__new__";
	const categoryId =
		categoryIdRaw && !isNewCategorySelected
			? parseOptionalPositiveInt(categoryIdRaw)
			: null;
	if (categoryIdRaw && !isNewCategorySelected && categoryId === null) {
		return { error: "分类参数不合法" } as const;
	}

	const canonicalUrlRaw = String(body.canonicalUrl ?? "").trim();
	const canonicalUrl = canonicalUrlRaw
		? sanitizeCanonicalUrl(canonicalUrlRaw)
		: null;
	if (canonicalUrlRaw && !canonicalUrl) {
		return { error: "规范链接地址不合法" } as const;
	}

	const featuredImageKeyRaw = String(body.featuredImageKey ?? "").trim();
	const featuredImageKey = featuredImageKeyRaw
		? sanitizeMediaKey(featuredImageKeyRaw)
		: null;
	if (featuredImageKeyRaw && !featuredImageKey) {
		return { error: "封面图片键名不合法" } as const;
	}

	const isPinnedRaw = String(body.isPinned ?? "")
		.trim()
		.toLowerCase();
	const isPinned =
		isPinnedRaw === "1" || isPinnedRaw === "true" || isPinnedRaw === "on";
	const pinnedOrderRaw = String(body.pinnedOrder ?? "").trim();
	let pinnedOrder = 100;
	if (pinnedOrderRaw) {
		const parsedPinnedOrder = Number(pinnedOrderRaw);
		if (
			!Number.isInteger(parsedPinnedOrder) ||
			parsedPinnedOrder < 1 ||
			parsedPinnedOrder > 9999
		) {
			return { error: "置顶顺序需填写 1-9999 的整数" } as const;
		}
		pinnedOrder = parsedPinnedOrder;
	}
	if (!isPinned) {
		pinnedOrder = 100;
	}

	const newTagNamesRaw = sanitizePlainText(body.newTagNames, 400, {
		allowNewlines: true,
	});
	const newCategoryName = sanitizePlainText(body.newCategoryName, 60) || null;
	if (isNewCategorySelected && !newCategoryName) {
		return { error: "你选择了新建分类，请输入分类名称" } as const;
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
			publishedAt,
			featuredImageKey,
			featuredImageAlt: sanitizePlainText(body.featuredImageAlt, 200) || null,
			isPinned,
			pinnedOrder,
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

function resolvePostsAlert(status: string | null) {
	switch (status) {
		case "schedule-cancelled":
			return {
				type: "success",
				message: "已取消定时发布，文章已转为草稿",
			} as const;
		case "category-deleted":
			return { type: "success", message: "分类已删除" } as const;
		case "tag-deleted":
			return { type: "success", message: "标签已删除" } as const;
		case "category-in-use":
			return { type: "error", message: "分类仍有关联文章，无法删除" } as const;
		case "tag-in-use":
			return { type: "error", message: "标签仍有关联文章，无法删除" } as const;
		case "invalid-id":
			return { type: "error", message: "参数不合法" } as const;
		case "csrf-failed":
			return { type: "error", message: "CSRF 校验失败，请刷新后重试" } as const;
		default:
			return undefined;
	}
}

async function getCategoryRows(db: BlogDb): Promise<TaxonomyRow[]> {
	return await db
		.select({
			id: blogCategories.id,
			name: blogCategories.name,
			slug: blogCategories.slug,
			postCount: sql<number>`count(${blogPosts.id})`,
		})
		.from(blogCategories)
		.leftJoin(blogPosts, eq(blogPosts.categoryId, blogCategories.id))
		.groupBy(blogCategories.id)
		.orderBy(asc(blogCategories.name));
}

async function getTagRows(db: BlogDb): Promise<TaxonomyRow[]> {
	return await db
		.select({
			id: blogTags.id,
			name: blogTags.name,
			slug: blogTags.slug,
			postCount: sql<number>`count(${blogPostTags.postId})`,
		})
		.from(blogTags)
		.leftJoin(blogPostTags, eq(blogPostTags.tagId, blogTags.id))
		.groupBy(blogTags.id)
		.orderBy(asc(blogTags.name));
}

posts.use("*", requireAuth);

posts.get("/", async (c) => {
	const session = getAuthenticatedSession(c);
	const status = c.req.query("status") || null;
	try {
		const db = getDb(c.env.DB);
		const allPosts = await db
			.select({
				id: blogPosts.id,
				title: blogPosts.title,
				slug: blogPosts.slug,
				status: blogPosts.status,
				isPinned: blogPosts.isPinned,
				pinnedOrder: blogPosts.pinnedOrder,
				publishedAt: blogPosts.publishedAt,
				viewCount: blogPosts.viewCount,
				createdAt: blogPosts.createdAt,
				categoryName: blogCategories.name,
			})
			.from(blogPosts)
			.leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
			.orderBy(
				desc(blogPosts.isPinned),
				asc(blogPosts.pinnedOrder),
				desc(blogPosts.createdAt),
			);
		const [categories, tags] = await Promise.all([
			getCategoryRows(db),
			getTagRows(db),
		]);

		return c.html(
			postsListPage(
				allPosts,
				categories,
				tags,
				session.csrfToken,
				resolvePostsAlert(status),
			),
		);
	} catch {
		return c.html(
			postsListPage([], [], [], session.csrfToken, resolvePostsAlert(status)),
		);
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
		return c.text("CSRF 校验失败", 403);
	}

	const parsed = parsePostInput(body);
	if ("error" in parsed) {
		return c.html(renderPostErrorPage(session.csrfToken, parsed.error), 400);
	}
	const postInput = parsed.data;

	const now = new Date().toISOString();
	const categoryId = await resolveCategoryId(
		db,
		postInput.categoryId,
		postInput.newCategoryName,
	);
	const tagIds = await resolveTagIds(
		db,
		postInput.tagIds,
		postInput.newTagNames,
	);
	const slug = await resolveUniquePostSlug(db, postInput.slug);
	const publishedAt =
		postInput.status === "published" ? (postInput.publishedAt ?? now) : null;
	const publishAt =
		postInput.status === "scheduled" ? postInput.publishAt : publishedAt;

	const [inserted] = await db
		.insert(blogPosts)
		.values({
			title: postInput.title,
			slug,
			content: postInput.content,
			excerpt: postInput.excerpt,
			status: postInput.status,
			publishAt,
			publishedAt,
			featuredImageKey: postInput.featuredImageKey,
			featuredImageAlt: postInput.featuredImageAlt,
			isPinned: postInput.isPinned,
			pinnedOrder: postInput.pinnedOrder,
			metaTitle: postInput.metaTitle,
			metaDescription: postInput.metaDescription,
			metaKeywords: postInput.metaKeywords,
			canonicalUrl: postInput.canonicalUrl,
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

	if (isPostPublic(postInput.status, publishAt)) {
		await triggerDeployHook(c.env, {
			event: "post-created",
			postId: inserted?.id,
			postSlug: slug,
			postStatus: postInput.status,
		});
	}

	return c.redirect("/api/admin/posts");
});

posts.post("/ai-seo", async (c) => {
	const session = getAuthenticatedSession(c);
	const body = await c.req.parseBody();
	if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
		return c.json(
			{
				success: false,
				message: "CSRF 校验失败，请刷新页面后重试",
			},
			403,
		);
	}

	const title = sanitizePlainText(body.title, 200);
	const content = sanitizePlainText(body.content, 100_000, {
		allowNewlines: true,
		trim: false,
	});
	if (!title) {
		return c.json(
			{
				success: false,
				message: "请先填写文章标题后再生成",
			},
			400,
		);
	}
	if (!content.trim()) {
		return c.json(
			{
				success: false,
				message: "请先填写正文后再生成",
			},
			400,
		);
	}

	const db = getDb(c.env.DB);
	const aiSettings = await getResolvedAiSettings(db, c.env).catch(() => ({
		settings: DEFAULT_AI_SETTINGS,
		keySource: {
			internal: "empty" as const,
			public: "empty" as const,
		},
	}));

	if (!isOpenAICompatibleEndpointReady(aiSettings.settings.internal)) {
		return c.json(
			{
				success: false,
				message: "内部 AI 接口未配置完整，请先在外观设置中填写后再试",
			},
			503,
		);
	}

	let generated = null;
	try {
		generated = await generatePostSeoWithInternalAi(
			{
				title,
				content,
			},
			aiSettings.settings.internal,
		);
	} catch (error) {
		console.error("[文章 AI 生成] 请求失败", error);
		return c.json(
			{
				success: false,
				message:
					error instanceof Error ? error.message : "AI 生成失败，请稍后重试",
			},
			502,
		);
	}
	if (!generated) {
		return c.json(
			{
				success: false,
				message: "AI 未生成结果，请检查标题和正文后重试",
			},
			502,
		);
	}

	return c.json({
		success: true,
		data: generated,
		keySource: aiSettings.keySource.internal,
	});
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
		return c.text("CSRF 校验失败", 403);
	}

	const parsed = parsePostInput(body);
	if ("error" in parsed) {
		return c.html(renderPostErrorPage(session.csrfToken, parsed.error), 400);
	}
	const postInput = parsed.data;

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
		postInput.status === "published"
			? (postInput.publishedAt ??
				(existing.status === "published" ? (existing.publishedAt ?? now) : now))
			: (existing.publishedAt ?? null);
	const publishAt =
		postInput.status === "scheduled"
			? postInput.publishAt
			: postInput.status === "published"
				? publishedAt
				: null;
	const categoryId = await resolveCategoryId(
		db,
		postInput.categoryId,
		postInput.newCategoryName,
	);
	const tagIds = await resolveTagIds(
		db,
		postInput.tagIds,
		postInput.newTagNames,
	);
	const slug = await resolveUniquePostSlug(db, postInput.slug, id);

	await db
		.update(blogPosts)
		.set({
			title: postInput.title,
			slug,
			content: postInput.content,
			excerpt: postInput.excerpt,
			status: postInput.status,
			publishAt,
			publishedAt,
			featuredImageKey: postInput.featuredImageKey,
			featuredImageAlt: postInput.featuredImageAlt,
			isPinned: postInput.isPinned,
			pinnedOrder: postInput.pinnedOrder,
			metaTitle: postInput.metaTitle,
			metaDescription: postInput.metaDescription,
			metaKeywords: postInput.metaKeywords,
			canonicalUrl: postInput.canonicalUrl,
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

	const wasPublic = isPostPublic(existing.status, existing.publishAt);
	const willBePublic = isPostPublic(postInput.status, publishAt);
	if (wasPublic || willBePublic) {
		await triggerDeployHook(c.env, {
			event: "post-updated",
			postId: id,
			postSlug: slug,
			postStatus: postInput.status,
		});
	}

	return c.redirect("/api/admin/posts");
});

posts.post("/:id/delete", async (c) => {
	const session = getAuthenticatedSession(c);
	const body = await c.req.parseBody();
	if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
		return c.text("CSRF 校验失败", 403);
	}

	const id = parseOptionalPositiveInt(c.req.param("id"));
	if (!id) {
		return c.redirect("/api/admin/posts");
	}
	const db = getDb(c.env.DB);
	const [existing] = await db
		.select({
			slug: blogPosts.slug,
			status: blogPosts.status,
			publishAt: blogPosts.publishAt,
		})
		.from(blogPosts)
		.where(eq(blogPosts.id, id))
		.limit(1);
	await db.delete(blogPosts).where(eq(blogPosts.id, id));
	if (existing && isPostPublic(existing.status, existing.publishAt)) {
		await triggerDeployHook(c.env, {
			event: "post-deleted",
			postId: id,
			postSlug: existing.slug,
			postStatus: existing.status,
		});
	}
	return c.redirect("/api/admin/posts");
});

posts.post("/:id/cancel-schedule", async (c) => {
	const session = getAuthenticatedSession(c);
	const body = await c.req.parseBody();
	if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
		return c.redirect("/api/admin/posts?status=csrf-failed");
	}

	const id = parseOptionalPositiveInt(c.req.param("id"));
	if (!id) {
		return c.redirect("/api/admin/posts?status=invalid-id");
	}

	const db = getDb(c.env.DB);
	const [existing] = await db
		.select({
			slug: blogPosts.slug,
			status: blogPosts.status,
			publishAt: blogPosts.publishAt,
		})
		.from(blogPosts)
		.where(eq(blogPosts.id, id))
		.limit(1);
	const now = new Date().toISOString();
	await db
		.update(blogPosts)
		.set({
			status: "draft",
			publishAt: null,
			publishedAt: null,
			updatedAt: now,
		})
		.where(and(eq(blogPosts.id, id), eq(blogPosts.status, "scheduled")));
	if (existing && isPostPublic(existing.status, existing.publishAt)) {
		await triggerDeployHook(c.env, {
			event: "post-schedule-cancelled",
			postId: id,
			postSlug: existing.slug,
			postStatus: "draft",
		});
	}
	return c.redirect("/api/admin/posts?status=schedule-cancelled");
});

posts.post("/categories/:id/delete", async (c) => {
	const session = getAuthenticatedSession(c);
	const body = await c.req.parseBody();
	if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
		return c.redirect("/api/admin/posts?status=csrf-failed");
	}

	const id = parseOptionalPositiveInt(c.req.param("id"));
	if (!id) {
		return c.redirect("/api/admin/posts?status=invalid-id");
	}

	const db = getDb(c.env.DB);
	const [usage] = await db
		.select({ count: sql<number>`count(*)` })
		.from(blogPosts)
		.where(eq(blogPosts.categoryId, id));

	if ((usage?.count ?? 0) > 0) {
		return c.redirect("/api/admin/posts?status=category-in-use");
	}

	await db.delete(blogCategories).where(eq(blogCategories.id, id));
	return c.redirect("/api/admin/posts?status=category-deleted");
});

posts.post("/tags/:id/delete", async (c) => {
	const session = getAuthenticatedSession(c);
	const body = await c.req.parseBody();
	if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
		return c.redirect("/api/admin/posts?status=csrf-failed");
	}

	const id = parseOptionalPositiveInt(c.req.param("id"));
	if (!id) {
		return c.redirect("/api/admin/posts?status=invalid-id");
	}

	const db = getDb(c.env.DB);
	const [usage] = await db
		.select({ count: sql<number>`count(*)` })
		.from(blogPostTags)
		.where(eq(blogPostTags.tagId, id));

	if ((usage?.count ?? 0) > 0) {
		return c.redirect("/api/admin/posts?status=tag-in-use");
	}

	await db.delete(blogTags).where(eq(blogTags.id, id));
	return c.redirect("/api/admin/posts?status=tag-deleted");
});

export { posts as postsRoutes };
