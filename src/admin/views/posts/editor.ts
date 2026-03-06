import type { BlogCategory, BlogPost, BlogTag } from "@/db/schema";
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
	selectedTagIds?: number[];
	csrfToken: string;
	error?: string;
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

	const content = `
		<h1>${isEdit ? "编辑文章" : "新建文章"}</h1>
		${error ? `<div class="alert alert-error">${escapeHtml(error)}</div>` : ""}

		<form method="post" action="${escapeAttribute(formAction)}">
			<input type="hidden" name="_csrf" value="${escapeAttribute(csrfToken)}" />
			<div style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem;">
				<div>
					<div class="form-group">
						<label for="title">标题</label>
						<input type="text" id="title" name="title" class="form-input" value="${escapeAttribute(post?.title || "")}" required maxlength="200" />
					</div>

					<div class="form-group">
						<label for="slug">网址别名</label>
						<input type="text" id="slug" name="slug" class="form-input" value="${escapeAttribute(post?.slug || "")}" required pattern="[a-z0-9\\-]+" maxlength="120" />
					</div>

					<div class="form-group">
						<label for="excerpt">摘要</label>
						<input type="text" id="excerpt" name="excerpt" class="form-input" value="${escapeAttribute(post?.excerpt || "")}" maxlength="200" />
					</div>

					<div class="form-group">
						<label for="content">正文（Markdown）</label>
						<textarea id="content" name="content" class="form-textarea" required>${escapeTextarea(post?.content || "")}</textarea>
					</div>
				</div>

				<div>
					<div class="form-group">
						<label for="status">状态</label>
						<select id="status" name="status" class="form-select">
							<option value="draft" ${currentStatus === "draft" ? "selected" : ""}>${getPostStatusLabel("draft")}</option>
							<option value="published" ${currentStatus === "published" ? "selected" : ""}>${getPostStatusLabel("published")}</option>
							<option value="scheduled" ${currentStatus === "scheduled" ? "selected" : ""}>${getPostStatusLabel("scheduled")}</option>
						</select>
					</div>

					<div class="form-group">
						<label for="categoryId">分类</label>
						<select id="categoryId" name="categoryId" class="form-select">
							<option value="">未分类</option>
							${categories.map((cat) => `<option value="${cat.id}" ${post?.categoryId === cat.id ? "selected" : ""}>${escapeHtml(cat.name)}</option>`).join("")}
						</select>
					</div>

					<div class="form-group">
						<label for="authorName">作者</label>
						<input type="text" id="authorName" name="authorName" class="form-input" value="${escapeAttribute(post?.authorName || "管理员")}" maxlength="80" />
					</div>

					<div class="form-group">
						<label for="featuredImageKey">封面图片键名（R2）</label>
						<input type="text" id="featuredImageKey" name="featuredImageKey" class="form-input" value="${escapeAttribute(post?.featuredImageKey || "")}" maxlength="255" />
					</div>

					<div class="form-group">
						<label for="featuredImageAlt">封面替代文本</label>
						<input type="text" id="featuredImageAlt" name="featuredImageAlt" class="form-input" value="${escapeAttribute(post?.featuredImageAlt || "")}" maxlength="200" />
					</div>

					<details style="margin-bottom: 1rem;">
						<summary style="cursor: pointer; color: var(--text-secondary); margin-bottom: 0.75rem;">SEO 设置</summary>
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

					${
						tags.length > 0
							? `<div class="form-group">
							<label>标签</label>
							<input type="hidden" id="tagIds" name="tagIds" value="${escapeAttribute(selectedTagIds.join(","))}" />
							<div style="display: flex; flex-wrap: wrap; gap: 0.375rem;">
								${tags
									.map(
										(tag) => `
								<label style="display: flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); font-size: 0.8rem; cursor: pointer;">
									<input type="checkbox" value="${tag.id}" ${selectedTagIds.includes(tag.id) ? "checked" : ""} data-tag-checkbox="true" />
									${escapeHtml(tag.name)}
								</label>`,
									)
									.join("")}
						</div>
					</div>`
							: ""
					}

					<div style="display: flex; gap: 0.5rem; margin-top: 1.5rem;">
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
