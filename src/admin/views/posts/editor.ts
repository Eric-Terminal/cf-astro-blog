import type { BlogCategory, BlogPost, BlogTag } from "@/db/schema";
import { getAllowedMediaAcceptValue } from "@/lib/media";
import {
	escapeAttribute,
	escapeHtml,
	escapeTextarea,
	getPostStatusLabel,
	normalizeDisplayStatus,
} from "@/lib/security";
import { adminLayout } from "../layout";

interface EditorData {
	post?: BlogPost;
	categories: BlogCategory[];
	tags: BlogTag[];
	currentUsername: string;
	selectedTagIds?: number[];
	csrfToken: string;
	error?: string;
}

function toDateTimeLocalValue(value?: string | null): string {
	if (!value) {
		return "";
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}

	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hour = String(date.getHours()).padStart(2, "0");
	const minute = String(date.getMinutes()).padStart(2, "0");
	return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function postEditorPage(data: EditorData): string {
	const {
		post,
		categories,
		tags,
		selectedTagIds = [],
		csrfToken,
		error,
	} = data;
	const isEdit = !!post;
	const formAction = isEdit
		? `/api/admin/posts/${post.id}`
		: "/api/admin/posts";
	const currentStatus = normalizeDisplayStatus(post?.status || "draft");
	const featuredImageKey = post?.featuredImageKey || "";
	const featuredImageAlt = post?.featuredImageAlt || "";
	const featuredImageUrl = featuredImageKey ? `/media/${featuredImageKey}` : "";
	const isPinned = Boolean(post?.isPinned);
	const pinnedOrderValue =
		typeof post?.pinnedOrder === "number" && post.pinnedOrder > 0
			? String(post.pinnedOrder)
			: "100";
	const publishAtValue = toDateTimeLocalValue(post?.publishAt || null);
	const publishedAtValue = toDateTimeLocalValue(post?.publishedAt || null);
	const isScheduled = currentStatus === "scheduled";
	const isPublished = currentStatus === "published";

	const content = `
		<h1>${isEdit ? "编辑文章" : "新建文章"}</h1>
		${error ? `<div class="alert alert-error">${escapeHtml(error)}</div>` : ""}

		<form
			method="post"
			action="${escapeAttribute(formAction)}"
			data-editor-upload-url="/api/admin/media/upload-async"
			data-editor-csrf-token="${escapeAttribute(csrfToken)}"
			data-editor-draft-scope="${escapeAttribute(formAction)}"
		>
			<input type="hidden" name="_csrf" value="${escapeAttribute(csrfToken)}" />
			<div class="editor-grid">
				<div class="editor-panel">
					<div class="form-group">
						<label for="title">标题</label>
						<input type="text" id="title" name="title" class="form-input" value="${escapeAttribute(post?.title || "")}" required maxlength="200" />
					</div>

					<div class="form-group">
						<label for="slug">访问路径</label>
						<input
							type="text"
							id="slug"
							name="slug"
							class="form-input"
							value="${escapeAttribute(post?.slug || "")}"
							pattern="[a-z0-9\\-]*"
							maxlength="120"
							placeholder="留空自动生成"
							data-manual="${isEdit ? "true" : "false"}"
						/>
						<p class="form-help">/blog/<span data-slug-preview>${escapeHtml(post?.slug || "自动生成")}</span></p>
					</div>

					<div class="form-group">
						<label for="excerpt">摘要</label>
						<input type="text" id="excerpt" name="excerpt" class="form-input" value="${escapeAttribute(post?.excerpt || "")}" maxlength="200" />
						<div class="draft-toolbar ai-seo-toolbar">
							<button
								type="button"
								class="btn btn-sm"
								data-ai-seo-generate="true"
								data-ai-seo-endpoint="/api/admin/posts/ai-seo"
							>
								AI 生成摘要与 SEO
							</button>
							<span class="form-help" data-ai-seo-status>将基于当前标题和正文回填摘要、SEO 标题/描述/关键词</span>
						</div>
					</div>

					<div class="form-group">
						<label for="content">正文（Markdown）</label>
						<div class="markdown-editor-shell">
							<textarea id="content" name="content" class="form-textarea" required data-markdown-input="true">${escapeTextarea(post?.content || "")}</textarea>
							<section class="markdown-preview-panel" aria-label="Markdown 实时预览">
								<div class="markdown-preview-head">实时预览</div>
								<div class="markdown-preview-body" data-markdown-preview="true"></div>
							</section>
						</div>
						<p class="form-help">输入内容后会在右侧实时预览，单换行也会保留显示。</p>
						<div class="draft-toolbar" data-draft-toolbar="true" hidden>
							<button type="button" class="btn btn-sm" data-draft-restore="true" hidden>恢复本地草稿</button>
							<button type="button" class="btn btn-sm btn-danger" data-draft-clear="true" hidden>清除本地草稿</button>
							<span class="form-help" data-draft-status="true"></span>
						</div>
						<p class="form-help" data-content-upload-status></p>
					</div>
				</div>

				<div class="editor-panel">
					<div class="form-group">
						<label for="status">状态</label>
						<select id="status" name="status" class="form-select">
							<option value="draft" ${currentStatus === "draft" ? "selected" : ""}>${getPostStatusLabel("draft")}</option>
							<option value="published" ${currentStatus === "published" ? "selected" : ""}>${getPostStatusLabel("published")}</option>
							<option value="scheduled" ${currentStatus === "scheduled" ? "selected" : ""}>${getPostStatusLabel("scheduled")}</option>
						</select>
					</div>

					<div class="form-group schedule-field ${isScheduled ? "" : "is-hidden"}" data-schedule-field="true">
						<label for="publishAt">定时发布时间</label>
						<input
							type="datetime-local"
							id="publishAt"
							name="publishAt"
							class="form-input"
							value="${escapeAttribute(publishAtValue)}"
							data-publish-at-input="true"
							${isScheduled ? "" : "disabled"}
							${isScheduled ? "required" : ""}
						/>
					</div>

					<div class="form-group published-date-field ${isPublished ? "" : "is-hidden"}" data-published-date-field="true">
						<label for="publishedAt">发布日期</label>
						<input
							type="datetime-local"
							id="publishedAt"
							name="publishedAt"
							class="form-input"
							value="${escapeAttribute(publishedAtValue)}"
							data-published-at-input="true"
							min="0001-01-01T00:00"
							max="9999-12-31T23:59"
							${isPublished ? "" : "disabled"}
						/>
						<p class="form-help">支持手动修改发布日期，最晚可设置到 9999 年。</p>
					</div>

					<div class="form-group">
						<label for="isPinned">
							<input
								type="checkbox"
								id="isPinned"
								name="isPinned"
								value="1"
								${isPinned ? "checked" : ""}
							/>
							首页置顶文章
						</label>
						<p class="form-help">勾选后会在首页“置顶文章”板块固定展示。</p>
					</div>

					<div class="form-group">
						<label for="pinnedOrder">置顶顺序</label>
						<input
							type="number"
							id="pinnedOrder"
							name="pinnedOrder"
							class="form-input"
							value="${escapeAttribute(pinnedOrderValue)}"
							min="1"
							max="9999"
						/>
						<p class="form-help">数值越小越靠前；未勾选置顶时此值会自动忽略。</p>
					</div>

					<div class="form-group">
						<label for="categoryId">分类</label>
						<select id="categoryId" name="categoryId" class="form-select">
							<option value="">未分类</option>
							${categories.map((cat) => `<option value="${cat.id}" ${post?.categoryId === cat.id ? "selected" : ""}>${escapeHtml(cat.name)}</option>`).join("")}
							<option value="__new__">+ 新建分类</option>
						</select>
						<div class="new-category-wrap is-hidden" data-new-category-wrap="true">
							<input
								type="text"
								id="newCategoryName"
								name="newCategoryName"
								class="form-input"
								maxlength="60"
								placeholder="输入新分类"
								disabled
								data-new-category-input="true"
							/>
						</div>
					</div>

					<div class="form-group">
						<label for="featuredImageKey">封面图片</label>
						<input
							type="hidden"
							id="featuredImageKey"
							name="featuredImageKey"
							value="${escapeAttribute(featuredImageKey)}"
							maxlength="255"
							data-cover-key-input="true"
						/>
						<div
							class="cover-uploader"
							data-cover-uploader="true"
							data-upload-url="/api/admin/media/upload-async"
							data-csrf-token="${escapeAttribute(csrfToken)}"
						>
							<input
								type="file"
								class="sr-only"
								accept="${escapeAttribute(getAllowedMediaAcceptValue())}"
								data-cover-file-input="true"
							/>
							<div class="cover-dropzone" data-cover-dropzone="true">
								${
									featuredImageUrl
										? `<img src="${escapeAttribute(featuredImageUrl)}" alt="${escapeAttribute(featuredImageAlt || "封面预览")}" class="cover-preview-image" data-cover-preview-image="true" />`
										: `<div class="cover-empty" data-cover-empty="true">拖拽图片或点击上传</div>`
								}
							</div>
							<div class="cover-actions">
								<button type="button" class="btn btn-sm" data-cover-select="true">上传封面</button>
								<button type="button" class="btn btn-sm btn-danger" data-cover-clear="true">清空封面</button>
							</div>
							<p class="form-help" data-cover-upload-status></p>
						</div>
					</div>

					<div class="form-group">
						<label for="featuredImageAlt">封面替代文本</label>
						<input type="text" id="featuredImageAlt" name="featuredImageAlt" class="form-input" value="${escapeAttribute(featuredImageAlt)}" maxlength="200" placeholder="可选，建议描述封面内容用于可访问性" />
					</div>

					<details>
						<summary>SEO（可选）</summary>
						<div class="form-group">
							<label for="metaTitle">SEO 标题</label>
							<input type="text" id="metaTitle" name="metaTitle" class="form-input" value="${escapeAttribute(post?.metaTitle || "")}" maxlength="200" />
						</div>
						<div class="form-group">
							<label for="metaDescription">SEO 描述</label>
							<input type="text" id="metaDescription" name="metaDescription" class="form-input" value="${escapeAttribute(post?.metaDescription || "")}" maxlength="160" />
						</div>
						<div class="form-group">
							<label for="metaKeywords">SEO 关键词</label>
							<input type="text" id="metaKeywords" name="metaKeywords" class="form-input" value="${escapeAttribute(post?.metaKeywords || "")}" maxlength="200" />
						</div>
						<div class="form-group">
							<label for="canonicalUrl">规范链接地址</label>
							<input type="url" id="canonicalUrl" name="canonicalUrl" class="form-input" value="${escapeAttribute(post?.canonicalUrl || "")}" maxlength="255" />
						</div>
					</details>

					<div class="form-group">
						<label>标签</label>
						<input type="hidden" id="tagIds" name="tagIds" value="${escapeAttribute(selectedTagIds.join(","))}" />
						<div class="tag-list">
							${
								tags.length > 0
									? tags
											.map(
												(tag) => `
								<label class="tag-chip">
									<input type="checkbox" value="${tag.id}" ${selectedTagIds.includes(tag.id) ? "checked" : ""} data-tag-checkbox="true" />
									${escapeHtml(tag.name)}
								</label>`,
											)
											.join("")
									: `<span class="form-help">暂无标签</span>`
							}
						</div>
						<input
							type="text"
							id="newTagNames"
							name="newTagNames"
							class="form-input"
							maxlength="400"
							placeholder="新标签，多个用逗号分隔"
						/>
					</div>

					<div class="form-actions">
						<button type="submit" class="btn btn-primary">${isEdit ? "保存修改" : "创建文章"}</button>
						<a href="/api/admin/posts" class="btn">取消</a>
					</div>
				</div>
			</div>
		</form>

	`;

	return adminLayout(isEdit ? "编辑文章" : "新建文章", content, {
		csrfToken,
	});
}
