import { Hono } from "hono";
import { blogPosts } from "@/db/schema";
import { getDb } from "@/lib/db";
import {
	deleteMediaObjectAndIndex,
	getAllowedMediaAcceptValue,
	getMediaContentTypeForKey,
	isAllowedImageMimeType,
	isImageMediaKey,
	isMediaHashIndexKey,
	MAX_UPLOAD_BYTES,
	saveMediaObjectWithDedup,
} from "@/lib/media";
import {
	buildProtectedAssetHeaders,
	decodeRouteParam,
	encodeRouteParam,
	escapeAttribute,
	escapeHtml,
	sanitizeMediaKey,
} from "@/lib/security";
import { getSiteAppearance } from "@/lib/site-appearance";
import {
	type AdminAppEnv,
	assertCsrfToken,
	getAuthenticatedSession,
	getBodyFile,
	getBodyText,
	requireAuth,
} from "../middleware/auth";
import { adminLayout } from "../views/layout";

const media = new Hono<AdminAppEnv>();
const DEFAULT_MEDIA_UPLOAD_PREFIX = "uploads";
const POST_UPLOAD_SCOPE_PATTERN = /^[a-z0-9-]{1,80}$/u;

function renderMediaErrorPage(csrfToken: string, message: string) {
	return adminLayout(
		"媒体处理失败",
		`<div class="alert alert-error">${escapeHtml(message)}</div><p><a href="/api/admin/media">返回媒体库</a></p>`,
		{ csrfToken },
	);
}

function parseUploadFile(body: Record<string, unknown>): File | null {
	return getBodyFile(body, "file");
}

function validateUploadFile(file: File): string | null {
	if (!isAllowedImageMimeType(file.type)) {
		return "仅允许上传 JPG、PNG、WEBP、AVIF 或 GIF 图片";
	}

	if (file.size > MAX_UPLOAD_BYTES) {
		return "单个文件不能超过 50 MB ";
	}

	return null;
}

function extractWildcardMediaKey(
	c: {
		req: {
			param: (name: string) => string;
			path: string;
		};
	},
	prefix: string,
) {
	const wildcardRaw =
		c.req.param("*") || c.req.param("0") || c.req.path.replace(prefix, "");
	const normalized = wildcardRaw.replace(/^\/+/u, "");
	return decodeRouteParam(normalized);
}

function sanitizePostUploadScope(value: string): string | null {
	const normalized = String(value ?? "")
		.trim()
		.toLowerCase();
	if (!normalized) {
		return null;
	}

	return POST_UPLOAD_SCOPE_PATTERN.test(normalized) ? normalized : null;
}

function resolveUploadPrefix(body: Record<string, unknown>): {
	error: string | null;
	prefix: string;
} {
	const uploadScopeRaw = getBodyText(body, "uploadScope");
	if (!uploadScopeRaw) {
		return { prefix: DEFAULT_MEDIA_UPLOAD_PREFIX, error: null };
	}

	const uploadScope = sanitizePostUploadScope(uploadScopeRaw);
	if (!uploadScope) {
		return {
			prefix: DEFAULT_MEDIA_UPLOAD_PREFIX,
			error: "上传目录参数不合法，仅允许小写字母、数字和短横线",
		};
	}

	const uploadKindRaw = getBodyText(body, "uploadKind").toLowerCase();
	const uploadKind = uploadKindRaw === "cover" ? "cover" : "content";
	return {
		prefix: `posts/${uploadScope}/${uploadKind}`,
		error: null,
	};
}

function getMediaDisplayName(key: string) {
	const normalized = String(key ?? "").trim();
	if (!normalized) {
		return "-";
	}

	const segments = normalized.split("/").filter(Boolean);
	return segments.at(-1) || normalized;
}

function getMediaDirectoryLabel(key: string) {
	const normalized = String(key ?? "").trim();
	if (!normalized?.includes("/")) {
		return "根目录";
	}

	const segments = normalized.split("/").filter(Boolean);
	if (segments.length <= 1) {
		return "根目录";
	}

	return segments.slice(0, -1).join("/");
}

function resolveMediaScopeBucket(
	key: string,
): "posts" | "appearance" | "uploads" {
	if (key.startsWith("posts/")) {
		return "posts";
	}
	if (key.startsWith("appearance/")) {
		return "appearance";
	}
	return "uploads";
}

async function collectMediaUsageLabels(
	dbBinding: D1Database | undefined,
	keys: string[],
): Promise<Map<string, string[]>> {
	const usageMap = new Map<string, string[]>();
	if (!dbBinding || keys.length === 0) {
		return usageMap;
	}

	const addRef = (key: string, label: string) => {
		const list = usageMap.get(key) ?? [];
		if (!list.includes(label)) {
			list.push(label);
			usageMap.set(key, list);
		}
	};

	const matchesPathOrKey = (
		candidate: string | null | undefined,
		key: string,
	) => {
		const raw = String(candidate ?? "").trim();
		if (!raw) {
			return false;
		}
		return (
			raw === key ||
			raw === `/media/${key}` ||
			raw.endsWith(`/media/${key}`) ||
			raw.endsWith(`/media/${encodeRouteParam(key)}`)
		);
	};

	try {
		const db = getDb(dbBinding);
		const [appearance, posts] = await Promise.all([
			getSiteAppearance(db).catch(() => null),
			db
				.select({
					title: blogPosts.title,
					content: blogPosts.content,
					featuredImageKey: blogPosts.featuredImageKey,
					backgroundImageKey: blogPosts.backgroundImageKey,
				})
				.from(blogPosts)
				.catch(() => []),
		]);

		for (const key of keys) {
			if (appearance) {
				if (matchesPathOrKey(appearance.backgroundImageKey, key)) {
					addRef(key, "全局壁纸");
				}
				if (matchesPathOrKey(appearance.heroMainImagePath, key)) {
					addRef(key, "首屏主图");
				}
				if (matchesPathOrKey(appearance.heroSignalImagePath, key)) {
					addRef(key, "右侧名片");
				}
				if (matchesPathOrKey(appearance.articleSidebarAvatarPath, key)) {
					addRef(key, "侧栏头像");
				}
			}

			const encodedKey = encodeRouteParam(key);
			for (const post of posts) {
				if (
					post.featuredImageKey === key ||
					post.backgroundImageKey === key ||
					post.content.includes(key) ||
					post.content.includes(encodedKey)
				) {
					addRef(key, "文章引用");
					break;
				}
			}
		}
	} catch {
		// 数据库不可用时降级为不展示引用标签
	}

	return usageMap;
}

async function saveUploadFile(
	c: { env: AdminAppEnv["Bindings"] },
	file: File,
	prefix = DEFAULT_MEDIA_UPLOAD_PREFIX,
) {
	return saveMediaObjectWithDedup({
		bucket: c.env.MEDIA_BUCKET,
		file,
		prefix,
	});
}

async function listVisibleMediaObjects(
	bucket: AdminAppEnv["Bindings"]["MEDIA_BUCKET"],
	limit: number,
) {
	const visibleObjects: R2Object[] = [];
	let cursor: string | undefined;

	while (visibleObjects.length < limit) {
		const listed = await bucket.list({ cursor, limit: 1000 });
		for (const object of listed.objects) {
			if (!isMediaHashIndexKey(object.key)) {
				visibleObjects.push(object);
			}

			if (visibleObjects.length >= limit) {
				break;
			}
		}

		if (!listed.truncated) {
			break;
		}
		cursor = listed.cursor;
	}

	return visibleObjects;
}

media.use("*", requireAuth);

media.get("/", async (c) => {
	const session = getAuthenticatedSession(c);
	let objects: R2Object[] = [];

	try {
		objects = await listVisibleMediaObjects(c.env.MEDIA_BUCKET, 100);
	} catch {
		// R2 未绑定时回退为空列表
	}

	const usageMap = await collectMediaUsageLabels(
		c.env.DB,
		objects.map((o) => o.key),
	);
	const totalBytes = objects.reduce((sum, item) => sum + item.size, 0);
	const usedCount = objects.filter(
		(o) => (usageMap.get(o.key)?.length ?? 0) > 0,
	).length;
	const unusedCount = objects.length - usedCount;
	const scopeCounts = {
		all: objects.length,
		used: usedCount,
		unused: unusedCount,
		posts: objects.filter((o) => resolveMediaScopeBucket(o.key) === "posts")
			.length,
		appearance: objects.filter(
			(o) => resolveMediaScopeBucket(o.key) === "appearance",
		).length,
		uploads: objects.filter((o) => resolveMediaScopeBucket(o.key) === "uploads")
			.length,
	};

	const content = `
		<div class="page-header">
			<div class="page-header-copy">
				<span class="page-kicker">Assets</span>
				<h1 style="margin-bottom: 0;">媒体库</h1>
				<p class="form-help" style="margin: 0;">自动按 SHA-256 哈希去重存储，并实时扫描外观与文章引用状态，方便一键筛出闲置旧图清理。</p>
			</div>
			<div class="page-actions">
				<span class="dashboard-status-pill">共 ${objects.length} 个文件 · ${formatBytes(totalBytes)}</span>
			</div>
		</div>
		<form
			method="post"
			action="/api/admin/media/upload"
			enctype="multipart/form-data"
			class="upload-form media-upload-form media-upload-compact"
			data-media-upload-form="true"
		>
			<input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
			<input
				type="file"
				id="mediaUploadInput"
				name="file"
				accept="${escapeAttribute(getAllowedMediaAcceptValue())}"
				class="media-upload-input"
				data-media-upload-input="true"
				required
			/>
			<label
				for="mediaUploadInput"
				class="media-upload-dropzone"
				data-media-upload-dropzone="true"
				tabindex="0"
			>
				<span class="media-upload-copy">
					<strong>拖拽图片到这里，或点击选择文件自动上传</strong>
					<span data-media-upload-filename="true">支持 JPG、PNG、WEBP、AVIF、GIF，单个文件不超过 50 MB</span>
				</span>
				<span class="btn btn-primary btn-sm" style="pointer-events: none; flex-shrink: 0;">选择图片上传</span>
			</label>
		</form>

		${
			objects.length > 0
				? `<div class="admin-filter-bar" data-media-filter-root>
					<div class="filter-tabs" role="tablist" aria-label="媒体引用与目录筛选">
						<button type="button" class="filter-tab is-active" data-media-scope-tab="all">全部<span class="filter-tab-count">${scopeCounts.all}</span></button>
						<button type="button" class="filter-tab" data-media-scope-tab="used">使用中<span class="filter-tab-count">${scopeCounts.used}</span></button>
						<button type="button" class="filter-tab" data-media-scope-tab="unused">闲置未引用<span class="filter-tab-count">${scopeCounts.unused}</span></button>
						${scopeCounts.posts > 0 ? `<button type="button" class="filter-tab" data-media-scope-tab="posts">文章配图<span class="filter-tab-count">${scopeCounts.posts}</span></button>` : ""}
						${scopeCounts.appearance > 0 ? `<button type="button" class="filter-tab" data-media-scope-tab="appearance">壁纸目录<span class="filter-tab-count">${scopeCounts.appearance}</span></button>` : ""}
						${scopeCounts.uploads > 0 ? `<button type="button" class="filter-tab" data-media-scope-tab="uploads">通用目录<span class="filter-tab-count">${scopeCounts.uploads}</span></button>` : ""}
					</div>
					<div class="admin-filter-controls">
						<input type="search" class="admin-search-input" data-media-search-input placeholder="按文件名、目录或用途搜索…" aria-label="搜索媒体文件" />
					</div>
				</div>`
				: ""
		}

		<div class="media-grid">
			${
				objects.length > 0
					? objects
							.map((obj) => {
								const displayName = getMediaDisplayName(obj.key);
								const directory = getMediaDirectoryLabel(obj.key);
								const scopeBucket = resolveMediaScopeBucket(obj.key);
								const refs = usageMap.get(obj.key) ?? [];
								const isUsed = refs.length > 0;
								const refSummary = isUsed ? refs.join(" / ") : "未引用";
								const publicUrl = `/media/${obj.key}`;
								const altBase = displayName.replace(/\.[^.]+$/u, "") || "图片";
								const mdSnippet = `![${altBase}](${publicUrl})`;
								const adminPreviewSrc = `/api/admin/media/file/${encodeRouteParam(obj.key)}`;
								const formattedSize = formatBytes(obj.size);
								const confirmMsg = isUsed
									? `该图片正被「${refSummary}」引用，删除后前台对应位置可能无法显示，确认仍要删除吗？`
									: "确认删除这个闲置未引用的媒体文件吗？";

								return `
				<div
					class="media-item"
					data-media-card
					data-media-scope="${escapeAttribute(scopeBucket)}"
					data-media-used="${isUsed ? "used" : "unused"}"
					data-media-key="${escapeAttribute(`${obj.key} ${refSummary}`)}"
				>
					<div class="media-preview">
						${
							isImageMediaKey(obj.key)
								? `<button
										type="button"
										class="media-preview-trigger"
										data-media-zoom-trigger
										data-media-src="${escapeAttribute(adminPreviewSrc)}"
										data-media-key="${escapeAttribute(obj.key)}"
										data-media-size="${escapeAttribute(`${formattedSize} · ${refSummary}`)}"
										aria-label="放大预览 ${escapeAttribute(displayName)}"
									>
										<img src="${escapeAttribute(adminPreviewSrc)}" alt="${escapeAttribute(obj.key)}" loading="lazy" />
									</button>`
								: `<span class="file-icon">${escapeHtml(obj.key.split(".").pop()?.toUpperCase() || "文件")}</span>`
						}
					</div>
					<div class="media-info">
						<span class="media-name" title="${escapeAttribute(obj.key)}">${escapeHtml(displayName)}</span>
						<span class="media-directory" title="${escapeAttribute(directory)}">目录：${escapeHtml(directory)}</span>
						<div class="media-ref-row">
							<span class="media-size">${formattedSize}</span>
							<span class="media-ref-badge ${isUsed ? "is-used" : "is-unused"}">${escapeHtml(refSummary)}</span>
						</div>
					</div>
					<form method="post" action="/api/admin/media/delete/${encodeRouteParam(obj.key)}" class="media-actions" data-confirm-message="${escapeAttribute(confirmMsg)}">
						<input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
						<div class="media-copy-group">
							<button type="button" class="btn btn-xs" data-copy-value="${escapeAttribute(publicUrl)}" data-copy-toast="已复制图片访问路径">复制 URL</button>
							<button type="button" class="btn btn-xs" data-copy-value="${escapeAttribute(mdSnippet)}" data-copy-toast="已复制 Markdown 图片语法">复制 MD</button>
							<button type="button" class="btn btn-xs" data-copy-value="${escapeAttribute(obj.key)}" data-copy-toast="已复制 R2 媒体键名">复制键名</button>
						</div>
						<button type="submit" class="btn btn-xs btn-danger">删除</button>
					</form>
				</div>`;
							})
							.join("")
					: "<p class='empty-state'>当前还没有上传任何媒体文件。</p>"
			}
		</div>
		<p class="empty-state" data-media-filter-empty hidden style="margin-top: 1rem;">没有匹配当前目录或关键词的媒体文件。</p>

		<div class="media-lightbox" data-media-lightbox hidden role="dialog" aria-modal="true" aria-label="图片放大预览">
			<div class="media-lightbox-card">
				<div class="media-lightbox-stage">
					<img src="" alt="" data-lightbox-img />
				</div>
				<div class="media-lightbox-bar">
					<div class="media-lightbox-meta">
						<span class="media-lightbox-key" data-lightbox-key></span>
						<span class="media-size" data-lightbox-size></span>
					</div>
					<div class="media-copy-group">
						<button type="button" class="btn btn-sm" data-lightbox-copy-url data-copy-value="" data-copy-toast="已复制图片访问路径">复制 URL</button>
						<button type="button" class="btn btn-sm" data-lightbox-copy-md data-copy-value="" data-copy-toast="已复制 Markdown 语法">复制 Markdown</button>
						<button type="button" class="btn btn-sm" data-lightbox-copy-key data-copy-value="" data-copy-toast="已复制媒体键名">复制键名</button>
						<button type="button" class="btn btn-sm" data-lightbox-close>关闭</button>
					</div>
				</div>
			</div>
		</div>
	`;

	return c.html(
		adminLayout("媒体库", content, { csrfToken: session.csrfToken }),
	);
});

media.post("/upload", async (c) => {
	const session = getAuthenticatedSession(c);
	const body = await c.req.parseBody({ all: true });
	if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
		return c.text("CSRF 校验失败", 403);
	}
	const file = parseUploadFile(body);
	if (!file) {
		return c.html(
			renderMediaErrorPage(session.csrfToken, "请选择要上传的文件"),
			400,
		);
	}

	const validationError = validateUploadFile(file);
	if (validationError) {
		return c.html(
			renderMediaErrorPage(session.csrfToken, validationError),
			400,
		);
	}

	const uploadTarget = resolveUploadPrefix(body);
	if (uploadTarget.error) {
		return c.html(
			renderMediaErrorPage(session.csrfToken, uploadTarget.error),
			400,
		);
	}

	await saveUploadFile(c, file, uploadTarget.prefix);

	return c.redirect("/api/admin/media");
});

media.post("/upload-async", async (c) => {
	const session = getAuthenticatedSession(c);
	const body = await c.req.parseBody({ all: true });
	if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
		return c.json({ message: "CSRF 校验失败" }, 403);
	}

	const file = parseUploadFile(body);
	if (!file) {
		return c.json({ message: "请选择要上传的文件" }, 400);
	}

	const validationError = validateUploadFile(file);
	if (validationError) {
		return c.json({ message: validationError }, 400);
	}

	const uploadTarget = resolveUploadPrefix(body);
	if (uploadTarget.error) {
		return c.json({ message: uploadTarget.error }, 400);
	}

	try {
		const uploaded = await saveUploadFile(c, file, uploadTarget.prefix);
		return c.json({
			key: uploaded.key,
			url: `/media/${uploaded.key}`,
			deduplicated: uploaded.deduplicated,
			message: uploaded.deduplicated
				? "检测到重复内容，已复用已有媒体文件"
				: "上传成功",
		});
	} catch {
		return c.json({ message: "上传失败，请稍后再试" }, 500);
	}
});

media.get("/file/*", async (c) => {
	const decodedKey = extractWildcardMediaKey(c, "/admin/media/file/");
	const key = sanitizeMediaKey(decodedKey);
	if (!key) {
		return c.notFound();
	}

	const contentType = getMediaContentTypeForKey(key);
	if (!contentType) {
		return c.notFound();
	}

	const object = await c.env.MEDIA_BUCKET.get(key);

	if (!object) {
		return c.notFound();
	}

	return new Response(object.body, {
		headers: buildProtectedAssetHeaders(contentType),
	});
});

media.post("/delete/*", async (c) => {
	const session = getAuthenticatedSession(c);
	const body = await c.req.parseBody({ all: true });
	if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
		return c.text("CSRF 校验失败", 403);
	}

	const decodedKey = extractWildcardMediaKey(c, "/admin/media/delete/");
	const key = sanitizeMediaKey(decodedKey);
	if (!key) {
		return c.text("媒体键名不合法", 400);
	}
	if (isMediaHashIndexKey(key)) {
		return c.text("不允许删除内部索引对象", 400);
	}

	await deleteMediaObjectAndIndex(c.env.MEDIA_BUCKET, key);
	return c.redirect("/api/admin/media");
});

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

export { media as mediaRoutes };
