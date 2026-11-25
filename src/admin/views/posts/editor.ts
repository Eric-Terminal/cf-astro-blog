import type { BlogCategory, BlogPost, BlogTag } from "@/db/schema";
import { getAllowedMediaAcceptValue } from "@/lib/media";
import {
	encodeRouteParam,
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
	defaultAuthorName: string;
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

const POST_BACKGROUND_MODES = ["global", "cover", "custom"] as const;
type PostBackgroundMode = (typeof POST_BACKGROUND_MODES)[number];

const DEFAULT_POST_BACKGROUND = {
	opacity: 72,
	blur: 24,
	scale: 112,
	positionX: 50,
	positionY: 50,
} as const;

function clampInteger(
	value: number | null | undefined,
	min: number,
	max: number,
	fallback: number,
): number {
	if (typeof value !== "number" || Number.isNaN(value)) {
		return fallback;
	}

	return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizePostBackgroundMode(
	value: string | null | undefined,
): PostBackgroundMode {
	const normalized = String(value ?? "")
		.trim()
		.toLowerCase();
	return POST_BACKGROUND_MODES.includes(normalized as PostBackgroundMode)
		? (normalized as PostBackgroundMode)
		: "global";
}

function convertOpacityToTransparency(opacity: number): number {
	return Math.max(0, Math.min(100, 100 - Math.round(opacity)));
}

export function postEditorPage(data: EditorData): string {
	const {
		post,
		categories,
		tags,
		defaultAuthorName,
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
	const authorNameValue = post?.authorName?.trim() || defaultAuthorName.trim();
	const backgroundMode = normalizePostBackgroundMode(post?.backgroundMode);
	const backgroundImageKey = post?.backgroundImageKey || "";
	const backgroundImageUrl = backgroundImageKey
		? `/media/${backgroundImageKey}`
		: "";
	const backgroundTransparency = String(
		convertOpacityToTransparency(
			clampInteger(
				post?.backgroundOpacity,
				0,
				100,
				DEFAULT_POST_BACKGROUND.opacity,
			),
		),
	);
	const backgroundBlur = String(
		clampInteger(post?.backgroundBlur, 0, 60, DEFAULT_POST_BACKGROUND.blur),
	);
	const backgroundScale = String(
		clampInteger(
			post?.backgroundScale,
			100,
			180,
			DEFAULT_POST_BACKGROUND.scale,
		) - 100,
	);
	const backgroundPositionX = String(
		clampInteger(
			post?.backgroundPositionX,
			0,
			100,
			DEFAULT_POST_BACKGROUND.positionX,
		) - 50,
	);
	const backgroundPositionY = String(
		clampInteger(
			post?.backgroundPositionY,
			0,
			100,
			DEFAULT_POST_BACKGROUND.positionY,
		) - 50,
	);
	const showPostBackgroundControls = backgroundMode !== "global";
	const showCustomBackgroundUploader = backgroundMode === "custom";

	const content = `
		<div class="page-header">
			<div class="page-header-copy">
				<span class="page-kicker">Editor</span>
				<h1 style="margin-bottom: 0;">${isEdit ? "编辑文章" : "新建文章"}</h1>
				<p class="form-help" style="margin: 0;">${isEdit ? "修改正文、发布状态与 SEO 信息。" : "写好标题与正文后，可保存草稿或直接发布。"}</p>
			</div>
			<div class="page-actions">
				${
					isEdit && post?.slug
						? `<a href="/blog/${encodeRouteParam(post.slug)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm">查看前台文章</a>`
						: ""
				}
				<a href="/api/admin/posts" class="btn btn-sm">返回列表</a>
			</div>
		</div>
		${error ? `<div class="alert alert-error">${escapeHtml(error)}</div>` : ""}

		<form
			method="post"
			action="${escapeAttribute(formAction)}"
			data-editor-mode="${isEdit ? "edit" : "create"}"
			data-editor-upload-url="/api/admin/media/upload-async"
			data-editor-csrf-token="${escapeAttribute(csrfToken)}"
			data-editor-draft-scope="${escapeAttribute(formAction)}"
		>
			<input type="hidden" name="_csrf" value="${escapeAttribute(csrfToken)}" />

			<div class="editor-studio-bar">
				<div class="editor-studio-left">
					<span class="badge badge-${currentStatus}" data-editor-status-pill>${escapeHtml(getPostStatusLabel(currentStatus))}</span>
					<span class="editor-word-counter" data-editor-word-count>0 字 · 约 1 分钟阅读</span>
				</div>
				<div class="editor-studio-right">
					<div class="editor-mode-switch" role="group" aria-label="编辑器视图切换">
						<button type="button" class="editor-mode-btn is-active" data-editor-view-btn="split">分栏对照</button>
						<button type="button" class="editor-mode-btn" data-editor-view-btn="write">专注写作</button>
						<button type="button" class="editor-mode-btn" data-editor-view-btn="preview">纯预览</button>
					</div>
					<button type="button" class="btn btn-sm" data-editor-inspector-toggle>收起属性栏</button>
					<button type="button" class="btn btn-sm" data-editor-zen-toggle title="隐藏侧栏沉浸写作（Esc 退出）">专注全屏</button>
					<span class="admin-kbd" title="快捷键 ⌘S / Ctrl+S 保存">⌘S</span>
					<button type="submit" class="btn btn-primary btn-sm" data-editor-submit-btn>${isEdit ? "保存修改" : "创建文章"}</button>
				</div>
			</div>

			<div class="editor-grid" data-editor-inspector="open">
				<div class="editor-panel">
					<div class="form-group">
						<label for="title">标题</label>
						<input
							type="text"
							id="title"
							name="title"
							class="form-input editor-title-input"
							value="${escapeAttribute(post?.title || "")}"
							placeholder="输入文章标题…"
							required
							maxlength="200"
						/>
					</div>

					<div class="editor-doc-meta-grid">
						<div class="form-group">
							<label for="slug">访问路径</label>
							<input
								type="text"
								id="slug"
								name="slug"
								class="form-input"
								value="${escapeAttribute(post?.slug || "")}"
								maxlength="120"
								placeholder="留空自动生成"
								data-manual="${isEdit ? "true" : "false"}"
							/>
							<p class="form-help">/blog/<span data-slug-preview>${escapeHtml(post?.slug || "自动生成")}</span>（支持中文，自动 URL 编码）</p>
						</div>

						<div class="form-group">
							<label for="authorName">作者</label>
							<input
								type="text"
								id="authorName"
								name="authorName"
								class="form-input"
								value="${escapeAttribute(authorNameValue)}"
								maxlength="120"
								required
							/>
							<p class="form-help">默认带入外观页“侧栏名称”，不会使用 GitHub 登录名。</p>
						</div>
					</div>

					<div class="form-group">
						<label for="content">正文（Markdown）</label>
						<div class="md-toolbar" role="toolbar" aria-label="Markdown 格式工具栏">
							<button type="button" class="md-tool-btn" data-md-action="h2" title="二级标题">H2</button>
							<button type="button" class="md-tool-btn" data-md-action="h3" title="三级标题">H3</button>
							<button type="button" class="md-tool-btn" data-md-action="bold" title="加粗 (⌘B)"><strong>B</strong></button>
							<button type="button" class="md-tool-btn" data-md-action="italic" title="斜体 (⌘I)"><em>I</em></button>
							<button type="button" class="md-tool-btn" data-md-action="code" title="行内代码">&lt;/&gt;</button>
							<button type="button" class="md-tool-btn" data-md-action="codeblock" title="代码块">代码块</button>
							<span class="md-tool-sep" aria-hidden="true"></span>
							<button type="button" class="md-tool-btn" data-md-action="quote" title="引用">引用</button>
							<button type="button" class="md-tool-btn" data-md-action="ul" title="无序列表">列表</button>
							<button type="button" class="md-tool-btn" data-md-action="link" title="插入链接 (⌘K)">链接</button>
							<button type="button" class="md-tool-btn" data-md-action="details" title="插入折叠详情块">折叠块</button>
							<button type="button" class="md-tool-btn" data-md-action="spoiler" title="插入防剧透遮罩">剧透遮罩</button>
							<span class="md-tool-sep" aria-hidden="true"></span>
							<button type="button" class="md-tool-btn" data-md-action="image" title="选择本地图片上传并插入 Markdown">+ 插入配图</button>
							<input
								type="file"
								class="sr-only"
								accept="${escapeAttribute(getAllowedMediaAcceptValue())}"
								data-md-image-input
							/>
						</div>
						<div class="markdown-editor-shell" data-editor-view="split">
							<textarea id="content" name="content" class="form-textarea" required data-markdown-input="true" placeholder="开始撰写正文… 支持直接粘贴剪贴板截图（⌘V / Ctrl+V）或拖拽图片上传">${escapeTextarea(post?.content || "")}</textarea>
							<section class="markdown-preview-panel" aria-label="Markdown 实时预览">
								<div class="markdown-preview-head">实时预览</div>
								<div class="markdown-preview-body" data-markdown-preview="true"></div>
							</section>
						</div>
						<p class="form-help">支持直接粘贴剪贴板图片或拖拽上传；单换行也会在预览和正文中保留。</p>
						<div class="draft-toolbar" data-draft-toolbar="true" hidden>
							<button type="button" class="btn btn-sm" data-draft-restore="true" hidden>恢复本地草稿</button>
							<button type="button" class="btn btn-sm btn-danger" data-draft-clear="true" hidden>清除本地草稿</button>
							<span class="form-help" data-draft-status="true"></span>
						</div>
						<p class="form-help" data-content-upload-status></p>
					</div>

					<div class="form-group form-group-tight">
						<label for="excerpt">摘要（可选，最多 200 字）</label>
						<textarea id="excerpt" name="excerpt" class="form-textarea form-textarea-sm editor-excerpt-area" maxlength="200" rows="2" placeholder="一句话概括文章核心内容，用于归档列表与分享卡片…">${escapeTextarea(post?.excerpt || "")}</textarea>
						<div class="draft-toolbar ai-seo-toolbar">
							<button
								type="button"
								class="btn btn-sm"
								data-ai-seo-generate="true"
								data-ai-seo-endpoint="/api/admin/posts/ai-seo"
							>
								AI 生成摘要与 SEO
							</button>
							<span class="form-help" data-ai-seo-status>基于当前标题与正文自动生成摘要及右侧 SEO 字段</span>
						</div>
					</div>
				</div>

				<div class="editor-panel editor-inspector-panel">
					<div class="inspector-section">
						<div class="inspector-section-title">发布与排期</div>
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
							<p class="form-help">可手动回填或指定展示日期。</p>
						</div>

						<div class="form-group form-group-tight">
							<label for="isPinned" class="checkbox-row-label">
								<input
									type="checkbox"
									id="isPinned"
									name="isPinned"
									value="1"
									${isPinned ? "checked" : ""}
								/>
								首页置顶文章
							</label>
							<p class="form-help">勾选后固定展示在首页精选区域。</p>
						</div>

						<div class="form-group ${isPinned ? "" : "is-hidden"}" data-pinned-order-wrap style="margin-top: 0.65rem; margin-bottom: 0;">
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
							<p class="form-help">数值越小越靠前（1–9999）。</p>
						</div>
					</div>

					<div class="inspector-section">
						<div class="inspector-section-title">分类与标签</div>
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
									placeholder="输入新分类名称"
									disabled
									data-new-category-input="true"
								/>
							</div>
						</div>

						<div class="form-group form-group-tight">
							<label>标签</label>
							<input type="hidden" id="tagIds" name="tagIds" value="${escapeAttribute(selectedTagIds.join(","))}" />
							<div class="tag-list" style="margin-bottom: 0.6rem;">
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
										: `<span class="form-help" style="margin-top: 0;">暂无历史标签，可在下方直接新建</span>`
								}
							</div>
							<input
								type="text"
								id="newTagNames"
								name="newTagNames"
								class="form-input"
								maxlength="400"
								placeholder="输入新标签，多个用逗号分隔"
							/>
						</div>
					</div>

					<div class="inspector-section">
						<div class="inspector-section-title">封面配图</div>
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

						<div class="form-group form-group-tight">
							<label for="featuredImageAlt">封面替代文本</label>
							<input type="text" id="featuredImageAlt" name="featuredImageAlt" class="form-input" value="${escapeAttribute(featuredImageAlt)}" maxlength="200" placeholder="可选，描述封面画面内容" />
						</div>
					</div>

					<details>
						<summary>文章背景（可选）</summary>
						<div class="form-group" style="margin-top: 0.75rem;">
							<label for="backgroundMode">背景来源</label>
							<select
								id="backgroundMode"
								name="backgroundMode"
								class="form-select"
								data-post-background-mode="true"
							>
								<option value="global" ${backgroundMode === "global" ? "selected" : ""}>跟随站点全局背景</option>
								<option value="cover" ${backgroundMode === "cover" ? "selected" : ""}>使用封面图作为背景</option>
								<option value="custom" ${backgroundMode === "custom" ? "selected" : ""}>上传自定义背景图</option>
							</select>
							<p class="form-help">可单独为当前文章指定沉浸式阅读背景。</p>
						</div>

						<div class="form-group ${showCustomBackgroundUploader ? "" : "is-hidden"}" data-post-background-custom-wrap="true">
							<label for="backgroundImageKey">自定义背景图</label>
							<input
								type="hidden"
								id="backgroundImageKey"
								name="backgroundImageKey"
								value="${escapeAttribute(backgroundImageKey)}"
								maxlength="255"
								data-post-background-key-input="true"
							/>
							<div
								class="cover-uploader"
								data-post-background-uploader="true"
								data-upload-url="/api/admin/media/upload-async"
								data-csrf-token="${escapeAttribute(csrfToken)}"
							>
								<input
									type="file"
									class="sr-only"
									accept="${escapeAttribute(getAllowedMediaAcceptValue())}"
									data-post-background-file-input="true"
								/>
								<div class="cover-dropzone" data-post-background-dropzone="true">
									${
										backgroundImageUrl
											? `<img src="${escapeAttribute(backgroundImageUrl)}" alt="文章背景图预览" class="cover-preview-image" data-post-background-preview-image="true" />`
											: `<div class="cover-empty" data-post-background-empty="true">拖拽图片或点击上传</div>`
									}
								</div>
								<div class="cover-actions">
									<button type="button" class="btn btn-sm" data-post-background-select="true">上传背景图</button>
									<button type="button" class="btn btn-sm btn-danger" data-post-background-clear="true">清空背景图</button>
								</div>
								<p class="form-help" data-post-background-upload-status></p>
							</div>
						</div>

						<div class="form-group form-group-tight ${showPostBackgroundControls ? "" : "is-hidden"}" data-post-background-controls="true">
							<p class="form-help" style="margin-bottom: 0.65rem;">以下参数仅覆盖本文阅读页背景表现。</p>
							<div class="editor-background-grid">
								<div class="editor-background-range">
									<div class="editor-background-range-head">
										<label for="backgroundTransparency">背景透明度</label>
										<span data-post-background-display="backgroundTransparency">${escapeHtml(backgroundTransparency)}%</span>
									</div>
									<input
										id="backgroundTransparency"
										name="backgroundTransparency"
										type="range"
										min="0"
										max="100"
										value="${escapeAttribute(backgroundTransparency)}"
										data-post-background-control="backgroundTransparency"
									/>
								</div>
								<div class="editor-background-range">
									<div class="editor-background-range-head">
										<label for="backgroundBlur">高斯模糊</label>
										<span data-post-background-display="backgroundBlur">${escapeHtml(backgroundBlur)} px</span>
									</div>
									<input
										id="backgroundBlur"
										name="backgroundBlur"
										type="range"
										min="0"
										max="60"
										value="${escapeAttribute(backgroundBlur)}"
										data-post-background-control="backgroundBlur"
									/>
								</div>
								<div class="editor-background-range">
									<div class="editor-background-range-head">
										<label for="backgroundScale">缩放</label>
										<span data-post-background-display="backgroundScale">${escapeHtml(backgroundScale)}%</span>
									</div>
									<input
										id="backgroundScale"
										name="backgroundScale"
										type="range"
										min="0"
										max="80"
										value="${escapeAttribute(backgroundScale)}"
										data-post-background-control="backgroundScale"
									/>
								</div>
								<div class="editor-background-range">
									<div class="editor-background-range-head">
										<label for="backgroundPositionX">横向焦点</label>
										<span data-post-background-display="backgroundPositionX">${escapeHtml(backgroundPositionX)}%</span>
									</div>
									<input
										id="backgroundPositionX"
										name="backgroundPositionX"
										type="range"
										min="-50"
										max="50"
										value="${escapeAttribute(backgroundPositionX)}"
										data-post-background-control="backgroundPositionX"
									/>
								</div>
								<div class="editor-background-range">
									<div class="editor-background-range-head">
										<label for="backgroundPositionY">纵向焦点</label>
										<span data-post-background-display="backgroundPositionY">${escapeHtml(backgroundPositionY)}%</span>
									</div>
									<input
										id="backgroundPositionY"
										name="backgroundPositionY"
										type="range"
										min="-50"
										max="50"
										value="${escapeAttribute(backgroundPositionY)}"
										data-post-background-control="backgroundPositionY"
									/>
								</div>
							</div>
						</div>
					</details>

					<details data-seo-details="true">
						<summary>SEO 与规范链接（可选）</summary>
						<div class="form-group" style="margin-top: 0.75rem;">
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
						<div class="form-group form-group-tight">
							<label for="canonicalUrl">规范链接地址</label>
							<input type="url" id="canonicalUrl" name="canonicalUrl" class="form-input" value="${escapeAttribute(post?.canonicalUrl || "")}" maxlength="255" />
						</div>
					</details>

					<div class="form-actions">
						<button type="submit" class="btn btn-primary" data-editor-submit-btn>${isEdit ? "保存修改" : "创建文章"}</button>
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
