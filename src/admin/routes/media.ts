import { Hono } from "hono";
import {
	buildProtectedAssetHeaders,
	decodeRouteParam,
	encodeRouteParam,
	escapeAttribute,
	escapeHtml,
	sanitizeMediaKey,
} from "@/lib/security";
import {
	type AdminAppEnv,
	assertCsrfToken,
	getAuthenticatedSession,
	requireAuth,
} from "../middleware/auth";
import { adminLayout } from "../views/layout";

const media = new Hono<AdminAppEnv>();

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = new Map<string, string>([
	["image/jpeg", "jpg"],
	["image/png", "png"],
	["image/webp", "webp"],
	["image/avif", "avif"],
	["image/gif", "gif"],
]);

function renderMediaErrorPage(csrfToken: string, message: string) {
	return adminLayout(
		"媒体处理失败",
		`<div class="alert alert-error">${escapeHtml(message)}</div><p><a href="/api/admin/media">返回媒体库</a></p>`,
		{ csrfToken },
	);
}

function buildObjectKey(file: File): string {
	const extension = ALLOWED_MEDIA_TYPES.get(file.type);
	if (!extension) {
		throw new Error("仅允许上传 JPG、PNG、WEBP、AVIF 或 GIF 图片喵");
	}

	return `uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
}

function getContentTypeForKey(key: string): string | null {
	const extension = key.split(".").pop()?.toLowerCase();
	for (const [contentType, allowedExtension] of ALLOWED_MEDIA_TYPES.entries()) {
		if (allowedExtension === extension) {
			return contentType;
		}
	}

	return null;
}

media.use("*", requireAuth);

media.get("/", async (c) => {
	const session = getAuthenticatedSession(c);
	let objects: R2Object[] = [];

	try {
		const listed = await c.env.MEDIA_BUCKET.list({ limit: 100 });
		objects = listed.objects;
	} catch {
		// R2 未绑定时回退为空列表喵
	}

	const content = `
		<h1>媒体库</h1>
		<form method="post" action="/api/admin/media/upload" enctype="multipart/form-data" class="upload-form">
			<input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
			<input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" required />
			<button type="submit" class="btn btn-primary">上传</button>
		</form>
		<div class="media-grid">
			${
				objects.length > 0
					? objects
							.map(
								(obj) => `
				<div class="media-item">
					<div class="media-preview">
						${
							obj.key.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i)
								? `<img src="/api/admin/media/file/${encodeRouteParam(obj.key)}" alt="${escapeAttribute(obj.key)}" loading="lazy" />`
								: `<span class="file-icon">${escapeHtml(obj.key.split(".").pop()?.toUpperCase() || "文件")}</span>`
						}
					</div>
					<div class="media-info">
						<span class="media-name" title="${escapeAttribute(obj.key)}">${escapeHtml(obj.key)}</span>
						<span class="media-size">${formatBytes(obj.size)}</span>
					</div>
					<form method="post" action="/api/admin/media/delete/${encodeRouteParam(obj.key)}" class="media-actions" data-confirm-message="${escapeAttribute("确认删除这个媒体文件吗？")}">
						<input type="hidden" name="_csrf" value="${escapeAttribute(session.csrfToken)}" />
						<button type="button" class="btn btn-sm" data-copy-value="${escapeAttribute(obj.key)}">复制键名</button>
						<button type="submit" class="btn btn-sm btn-danger">删除</button>
					</form>
				</div>`,
							)
							.join("")
					: "<p class='empty-state'>当前还没有上传任何媒体文件。</p>"
			}
		</div>
	`;

	return c.html(
		adminLayout("媒体库", content, { csrfToken: session.csrfToken }),
	);
});

media.post("/upload", async (c) => {
	const session = getAuthenticatedSession(c);
	const body = await c.req.parseBody();
	if (!assertCsrfToken(body._csrf, session)) {
		return c.text("CSRF 校验失败喵", 403);
	}
	const file = body.file;

	if (!(file instanceof File)) {
		return c.html(
			renderMediaErrorPage(session.csrfToken, "请选择要上传的文件喵"),
			400,
		);
	}

	if (!ALLOWED_MEDIA_TYPES.has(file.type)) {
		return c.html(
			renderMediaErrorPage(
				session.csrfToken,
				"仅允许上传 JPG、PNG、WEBP、AVIF 或 GIF 图片喵",
			),
			400,
		);
	}

	if (file.size > MAX_UPLOAD_BYTES) {
		return c.html(
			renderMediaErrorPage(session.csrfToken, "单个文件不能超过 5 MB 喵"),
			400,
		);
	}

	const key = buildObjectKey(file);
	await c.env.MEDIA_BUCKET.put(key, await file.arrayBuffer(), {
		httpMetadata: { contentType: getContentTypeForKey(key) || file.type },
	});

	return c.redirect("/api/admin/media");
});

media.get("/file/*", async (c) => {
	const decodedKey = decodeRouteParam(
		c.req.path.replace("/api/admin/media/file/", ""),
	);
	const key = sanitizeMediaKey(decodedKey);
	if (!key) {
		return c.notFound();
	}

	const contentType = getContentTypeForKey(key);
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
	const body = await c.req.parseBody();
	if (!assertCsrfToken(body._csrf, session)) {
		return c.text("CSRF 校验失败喵", 403);
	}

	const decodedKey = decodeRouteParam(
		c.req.path.replace("/api/admin/media/delete/", ""),
	);
	const key = sanitizeMediaKey(decodedKey);
	if (!key) {
		return c.text("媒体键名不合法喵", 400);
	}

	await c.env.MEDIA_BUCKET.delete(key);
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
