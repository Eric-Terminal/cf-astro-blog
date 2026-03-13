const slugInput = document.getElementById("slug");
const titleInput = document.getElementById("title");
const tagIdsInput = document.getElementById("tagIds");
const slugPreview = document.querySelector("[data-slug-preview]");
const categorySelect = document.getElementById("categoryId");
const newCategoryWrap = document.querySelector("[data-new-category-wrap='true']");
const newCategoryInput = document.getElementById("newCategoryName");
const statusSelect = document.getElementById("status");
const scheduleField = document.querySelector("[data-schedule-field='true']");
const publishAtInput = document.querySelector("[data-publish-at-input='true']");
const contentTextarea = document.getElementById("content");
const contentUploadStatus = document.querySelector("[data-content-upload-status]");
const markdownPreview = document.querySelector("[data-markdown-preview='true']");
const draftToolbar = document.querySelector("[data-draft-toolbar='true']");
const draftStatus = document.querySelector("[data-draft-status='true']");
const draftRestoreButton = document.querySelector("[data-draft-restore='true']");
const draftClearButton = document.querySelector("[data-draft-clear='true']");
const aiSeoGenerateButton = document.querySelector("[data-ai-seo-generate='true']");
const aiSeoStatus = document.querySelector("[data-ai-seo-status]");
const editorForm = document.querySelector("form[data-editor-upload-url]");
const editorUploadUrl =
	editorForm instanceof HTMLFormElement
		? (editorForm.dataset.editorUploadUrl ?? "")
		: "";
const editorCsrfToken =
	editorForm instanceof HTMLFormElement
		? (editorForm.dataset.editorCsrfToken ?? "")
		: "";
const editorDraftScope =
	editorForm instanceof HTMLFormElement
		? (editorForm.dataset.editorDraftScope ?? "")
		: "";
const mediaUploadForm = document.querySelector("[data-media-upload-form='true']");
const mediaUploadInput = document.querySelector("[data-media-upload-input='true']");
const mediaUploadDropzone = document.querySelector(
	"[data-media-upload-dropzone='true']",
);
const mediaUploadFilename = document.querySelector(
	"[data-media-upload-filename='true']",
);

const EDITOR_DRAFT_STORAGE_PREFIX = "cf-astro-blog:editor-draft";
const EDITOR_DRAFT_SCHEMA_VERSION = 1;
const EDITOR_DRAFT_SAVE_DEBOUNCE_MS = 600;

function parseUtcDateForAdmin(value) {
	const raw = String(value ?? "").trim();
	if (!raw) {
		return null;
	}

	let normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
	if (!/[zZ]$|[+-]\d{2}:\d{2}$/.test(normalized)) {
		normalized = `${normalized}Z`;
	}

	const date = new Date(normalized);
	return Number.isNaN(date.getTime()) ? null : date;
}

function formatAdminLocalTime(date) {
	return date.toLocaleString(undefined, { hour12: false });
}

function applyAdminLocalTimes() {
	const nodes = document.querySelectorAll("time[data-admin-local-time='utc']");
	for (const node of nodes) {
		if (!(node instanceof HTMLTimeElement)) {
			continue;
		}

		const rawValue = node.dataset.adminTimeValue || node.textContent || "";
		const date = parseUtcDateForAdmin(rawValue);
		if (!date) {
			continue;
		}

		node.dateTime = date.toISOString();
		node.textContent = formatAdminLocalTime(date);
		node.title = date.toISOString();
	}
}

function updateMediaUploadFilename(file) {
	if (!(mediaUploadFilename instanceof HTMLElement)) {
		return;
	}

	if (!(file instanceof File)) {
		mediaUploadFilename.textContent =
			"支持 JPG、PNG、WEBP、AVIF、GIF，单个文件不超过 50 MB";
		return;
	}

	mediaUploadFilename.textContent = `已选择：${file.name}`;
}

function submitMediaUploadForm() {
	if (
		!(mediaUploadForm instanceof HTMLFormElement) ||
		!(mediaUploadInput instanceof HTMLInputElement) ||
		!mediaUploadInput.files?.[0]
	) {
		return;
	}

	mediaUploadForm.requestSubmit();
}

function assignMediaUploadFile(file) {
	if (!(file instanceof File) || !(mediaUploadInput instanceof HTMLInputElement)) {
		return;
	}

	const dataTransfer = new DataTransfer();
	dataTransfer.items.add(file);
	mediaUploadInput.files = dataTransfer.files;
	updateMediaUploadFilename(file);
	submitMediaUploadForm();
}

function setStatusMessage(target, message, mode = "") {
	if (!(target instanceof HTMLElement)) {
		return;
	}

	target.textContent = message;
	target.classList.remove("is-error", "is-success");
	if (mode === "error") {
		target.classList.add("is-error");
	}
	if (mode === "success") {
		target.classList.add("is-success");
	}
}

function escapePreviewHtml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function escapePreviewAttr(value) {
	return escapePreviewHtml(value).replaceAll("`", "&#96;");
}

function sanitizePreviewUrl(rawValue) {
	const normalized = String(rawValue ?? "").trim();
	if (!normalized) {
		return null;
	}

	if (normalized.startsWith("/")) {
		return normalized.startsWith("//") ? null : normalized;
	}

	if (
		normalized.startsWith("./") ||
		normalized.startsWith("../") ||
		normalized.startsWith("#")
	) {
		return normalized;
	}

	try {
		const parsed = new URL(normalized);
		if (parsed.protocol === "http:" || parsed.protocol === "https:") {
			return parsed.toString();
		}
		return null;
	} catch {
		return null;
	}
}

function renderInlineMarkdown(source) {
	const tokens = [];
	const stash = (html) => {
		const token = `@@MD_PREVIEW_${tokens.length}@@`;
		tokens.push(html);
		return token;
	};

	let text = String(source ?? "");

	text = text.replace(/`([^`\n]+)`/g, (_, code) => {
		return stash(`<code>${escapePreviewHtml(code)}</code>`);
	});

	text = text.replace(
		/!\[([^\]]*?)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
		(_, alt, href, title) => {
			const safeHref = sanitizePreviewUrl(href);
			if (!safeHref) {
				return stash(escapePreviewHtml(alt || ""));
			}

			const titleAttr = title ? ` title="${escapePreviewAttr(title)}"` : "";
			return stash(
				`<img src="${escapePreviewAttr(safeHref)}" alt="${escapePreviewAttr(alt || "")}"${titleAttr} loading="lazy" decoding="async" />`,
			);
		},
	);

	text = text.replace(
		/\[([^\]]+?)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
		(_, label, href, title) => {
			const safeHref = sanitizePreviewUrl(href);
			const safeLabel = escapePreviewHtml(label);
			if (!safeHref) {
				return stash(safeLabel);
			}

			const titleAttr = title ? ` title="${escapePreviewAttr(title)}"` : "";
			return stash(
				`<a href="${escapePreviewAttr(safeHref)}"${titleAttr} target="_blank" rel="nofollow ugc noopener noreferrer">${safeLabel}</a>`,
			);
		},
	);

	text = text.replace(/\*\*([^*\n]+?)\*\*/g, (_, strongText) => {
		return stash(`<strong>${escapePreviewHtml(strongText)}</strong>`);
	});

	text = text.replace(/\*([^*\n]+?)\*/g, (_, emText) => {
		return stash(`<em>${escapePreviewHtml(emText)}</em>`);
	});

	text = text.replace(/~~([^~\n]+?)~~/g, (_, deletedText) => {
		return stash(`<del>${escapePreviewHtml(deletedText)}</del>`);
	});

	let escaped = escapePreviewHtml(text);
	escaped = escaped.replace(/@@MD_PREVIEW_(\d+)@@/g, (_, index) => {
		return tokens[Number(index)] ?? "";
	});

	return escaped;
}

function extractPreviewDetailsShortcodes(markdown) {
	const pattern =
		/\[details(?:=(?:"([^"\n]*)"|'([^'\n]*)'|([^\]\n]+)))?\]([\s\S]*?)\[\/details\]/giu;
	let index = 0;
	const blocks = [];

	const markdownWithPlaceholders = markdown.replace(
		pattern,
		(_match, doubleQuotedSummary, singleQuotedSummary, plainSummary, content) => {
			const summarySource =
				doubleQuotedSummary ?? singleQuotedSummary ?? plainSummary ?? "";
			const summary = String(summarySource).trim() || "详情";
			const cleanedContent = String(content ?? "")
				.replaceAll("\r", "")
				.replace(/^\n/u, "")
				.replace(/\n$/u, "");
			const placeholder = `@@MD_PREVIEW_DETAILS_${index}@@`;
			blocks.push({
				placeholder,
				summary,
				content: cleanedContent,
			});
			index += 1;
			return `\n\n${placeholder}\n\n`;
		},
	);

	return {
		markdown: markdownWithPlaceholders,
		blocks,
	};
}

function extractPreviewSpoilerShortcodes(markdown) {
	const pattern = /\[spoiler\]([\s\S]*?)\[\/spoiler\]/giu;
	let index = 0;
	const blocks = [];

	const markdownWithPlaceholders = markdown.replace(pattern, (_match, content) => {
		const cleanedContent = String(content ?? "").replaceAll("\r", "");
		const placeholder = `@@MD_PREVIEW_SPOILER_${index}@@`;
		blocks.push({
			placeholder,
			content: cleanedContent,
		});
		index += 1;
		return placeholder;
	});

	return {
		markdown: markdownWithPlaceholders,
		blocks,
	};
}

function escapeRegExp(value) {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderMarkdownPreview(markdown, showEmptyHint = true) {
	const normalized = String(markdown ?? "").replaceAll("\r", "");
	const extractedDetails = extractPreviewDetailsShortcodes(normalized);
	const extractedSpoilers = extractPreviewSpoilerShortcodes(
		extractedDetails.markdown,
	);
	if (!normalized.trim()) {
		return showEmptyHint
			? '<p class="markdown-preview-empty">开始输入 Markdown，这里会实时预览</p>'
			: "";
	}

	const lines = extractedSpoilers.markdown.split("\n");
	const blocks = [];
	let paragraphLines = [];
	let listItems = [];
	let listTag = "";
	let quoteLines = [];
	let codeLines = [];
	let codeLanguage = "";
	let inCodeBlock = false;

	const flushParagraph = () => {
		if (paragraphLines.length === 0) {
			return;
		}
		blocks.push(`<p>${paragraphLines.join("<br>")}</p>`);
		paragraphLines = [];
	};

	const flushList = () => {
		if (!listTag || listItems.length === 0) {
			return;
		}
		blocks.push(`<${listTag}>${listItems.join("")}</${listTag}>`);
		listTag = "";
		listItems = [];
	};

	const flushQuote = () => {
		if (quoteLines.length === 0) {
			return;
		}
		const quoteBody = quoteLines.map((line) => renderInlineMarkdown(line));
		blocks.push(`<blockquote><p>${quoteBody.join("<br>")}</p></blockquote>`);
		quoteLines = [];
	};

	const flushCodeBlock = () => {
		if (!inCodeBlock) {
			return;
		}
		const safeLanguage = codeLanguage
			.toLowerCase()
			.replaceAll(/[^a-z0-9-]/g, "");
		const languageClass = safeLanguage ? ` class="language-${safeLanguage}"` : "";
		blocks.push(
			`<pre><code${languageClass}>${escapePreviewHtml(codeLines.join("\n"))}</code></pre>`,
		);
		inCodeBlock = false;
		codeLines = [];
		codeLanguage = "";
	};

	for (const line of lines) {
		if (inCodeBlock) {
			if (/^```/u.test(line.trim())) {
				flushCodeBlock();
				continue;
			}

			codeLines.push(line);
			continue;
		}

		const fenceMatch = line.match(/^```([a-zA-Z0-9_-]*)\s*$/u);
		if (fenceMatch) {
			flushParagraph();
			flushList();
			flushQuote();
			inCodeBlock = true;
			codeLines = [];
			codeLanguage = fenceMatch[1] || "";
			continue;
		}

		if (!line.trim()) {
			flushParagraph();
			flushList();
			flushQuote();
			continue;
		}

		const headingMatch = line.match(/^(#{1,6})\s+(.*)$/u);
		if (headingMatch) {
			flushParagraph();
			flushList();
			flushQuote();
			const level = headingMatch[1].length;
			blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2].trim())}</h${level}>`);
			continue;
		}

		const quoteMatch = line.match(/^>\s?(.*)$/u);
		if (quoteMatch) {
			flushParagraph();
			flushList();
			quoteLines.push(quoteMatch[1]);
			continue;
		}

		flushQuote();

		const orderedItemMatch = line.match(/^\d+\.\s+(.*)$/u);
		if (orderedItemMatch) {
			flushParagraph();
			if (listTag !== "ol") {
				flushList();
				listTag = "ol";
			}
			listItems.push(`<li>${renderInlineMarkdown(orderedItemMatch[1].trim())}</li>`);
			continue;
		}

		const unorderedItemMatch = line.match(/^[-*+]\s+(.*)$/u);
		if (unorderedItemMatch) {
			flushParagraph();
			if (listTag !== "ul") {
				flushList();
				listTag = "ul";
			}
			listItems.push(`<li>${renderInlineMarkdown(unorderedItemMatch[1].trim())}</li>`);
			continue;
		}

		flushList();
		paragraphLines.push(renderInlineMarkdown(line));
	}

	flushParagraph();
	flushList();
	flushQuote();
	flushCodeBlock();

	let html = blocks.join("");
	for (const block of extractedSpoilers.blocks) {
		const spoilerHtml = `<span class="markdown-preview-spoiler">${escapePreviewHtml(block.content).replaceAll("\n", "<br>")}</span>`;
		const placeholderPattern = escapeRegExp(block.placeholder);
		html = html.replace(new RegExp(placeholderPattern, "gu"), spoilerHtml);
	}

	for (const block of extractedDetails.blocks) {
		const innerHtml = renderMarkdownPreview(block.content, false);
		const summaryHtml = renderInlineMarkdown(block.summary);
		const detailsHtml = `<details class="markdown-preview-details"><summary>${summaryHtml}</summary>${innerHtml}</details>`;
		const placeholderPattern = escapeRegExp(block.placeholder);
		html = html.replace(
			new RegExp(`<p>${placeholderPattern}</p>\\n?`, "gu"),
			detailsHtml,
		);
		html = html.replace(new RegExp(placeholderPattern, "gu"), detailsHtml);
	}

	return html;
}

let markdownPreviewRafId = 0;

function syncMarkdownPreview() {
	if (
		!(contentTextarea instanceof HTMLTextAreaElement) ||
		!(markdownPreview instanceof HTMLElement)
	) {
		return;
	}

	markdownPreview.innerHTML = renderMarkdownPreview(contentTextarea.value);
}

function scheduleMarkdownPreview() {
	if (
		!(contentTextarea instanceof HTMLTextAreaElement) ||
		!(markdownPreview instanceof HTMLElement)
	) {
		return;
	}

	if (markdownPreviewRafId) {
		return;
	}

	markdownPreviewRafId = window.requestAnimationFrame(() => {
		markdownPreviewRafId = 0;
		syncMarkdownPreview();
	});
}

async function uploadImageToMedia(file, uploadUrl, csrfToken) {
	if (!file || !uploadUrl || !csrfToken) {
		throw new Error("上传配置缺失，请刷新页面后重试");
	}

	const formData = new FormData();
	formData.append("_csrf", csrfToken);
	formData.append("file", file);

	const response = await fetch(uploadUrl, {
		method: "POST",
		body: formData,
		credentials: "same-origin",
	});

	const payload = await response.json().catch(() => ({}));
	if (!response.ok || !payload?.key) {
		throw new Error(payload?.message || "图片上传失败，请重试");
	}

	return {
		key: payload.key,
		url: payload.url || `/media/${payload.key}`,
	};
}

function getFirstImageFile(fileList) {
	if (!fileList) {
		return null;
	}

	for (const file of fileList) {
		if (file.type.startsWith("image/")) {
			return file;
		}
	}

	return null;
}

function insertMarkdownImage(textarea, file, url) {
	if (!(textarea instanceof HTMLTextAreaElement)) {
		return;
	}

	const altRaw = (file?.name || "图片").replace(/\.[^.]+$/u, "").trim();
	const alt = altRaw || "图片";
	const markdown = `![${alt}](${url})`;
	const start = textarea.selectionStart ?? textarea.value.length;
	const end = textarea.selectionEnd ?? start;
	const before = textarea.value.slice(0, start);
	const after = textarea.value.slice(end);
	const prefix = before && !before.endsWith("\n") ? "\n" : "";
	const suffix = after && !after.startsWith("\n") ? "\n" : "";
	const inserted = `${prefix}${markdown}${suffix}`;

	textarea.setRangeText(inserted, start, end, "end");
	textarea.focus();
	textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function syncNewCategoryInputVisibility() {
	const isCreatingNew =
		categorySelect instanceof HTMLSelectElement &&
		categorySelect.value === "__new__";

	if (newCategoryWrap instanceof HTMLElement) {
		newCategoryWrap.classList.toggle("is-hidden", !isCreatingNew);
	}

	if (newCategoryInput instanceof HTMLInputElement) {
		newCategoryInput.disabled = !isCreatingNew;
		newCategoryInput.required = isCreatingNew;
		if (!isCreatingNew) {
			newCategoryInput.value = "";
		}
	}
}

function syncScheduleFieldVisibility() {
	const isScheduled =
		statusSelect instanceof HTMLSelectElement &&
		statusSelect.value === "scheduled";

	if (scheduleField instanceof HTMLElement) {
		scheduleField.classList.toggle("is-hidden", !isScheduled);
	}

	if (publishAtInput instanceof HTMLInputElement) {
		publishAtInput.disabled = !isScheduled;
		publishAtInput.required = isScheduled;
	}
}

function buildSlugValue(value) {
	return value
		.toLowerCase()
		.normalize("NFKD")
		.replaceAll(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

function updateSlugPreview() {
	if (!(slugPreview instanceof HTMLElement)) {
		return;
	}

	if (!(slugInput instanceof HTMLInputElement)) {
		slugPreview.textContent = "自动生成";
		return;
	}

	slugPreview.textContent = slugInput.value.trim() || "自动生成";
}

function updateSlugFromTitle() {
	if (!(titleInput instanceof HTMLInputElement)) {
		return;
	}

	if (!(slugInput instanceof HTMLInputElement)) {
		return;
	}

	if (slugInput.dataset.manual === "true") {
		return;
	}

	slugInput.value = buildSlugValue(titleInput.value);
	updateSlugPreview();
}

function updateTagIds() {
	if (!(tagIdsInput instanceof HTMLInputElement)) {
		return;
	}

	const checkedValues = Array.from(
		document.querySelectorAll("input[data-tag-checkbox='true']"),
	)
		.filter((node) => node instanceof HTMLInputElement && node.checked)
		.map((node) => node.value);

	tagIdsInput.value = checkedValues.join(",");
}

let editorDraftSaveTimer = 0;
let editorDraftState = null;
let isApplyingEditorDraft = false;

function canUseEditorDraftStorage() {
	try {
		const probeKey = "__editor_draft_probe__";
		window.localStorage.setItem(probeKey, "1");
		window.localStorage.removeItem(probeKey);
		return true;
	} catch {
		return false;
	}
}

const editorDraftStorageAvailable = canUseEditorDraftStorage();

function getEditorDraftStorageKey() {
	if (!editorDraftScope) {
		return "";
	}

	return `${EDITOR_DRAFT_STORAGE_PREFIX}:${editorDraftScope}`;
}

function getEditorFieldValue(id) {
	const element = document.getElementById(id);
	if (
		element instanceof HTMLInputElement ||
		element instanceof HTMLTextAreaElement ||
		element instanceof HTMLSelectElement
	) {
		return element.value;
	}

	return "";
}

function collectEditorDraftValues() {
	return {
		title: getEditorFieldValue("title"),
		slug: getEditorFieldValue("slug"),
		excerpt: getEditorFieldValue("excerpt"),
		content: getEditorFieldValue("content"),
		status: getEditorFieldValue("status") || "draft",
		publishAt: getEditorFieldValue("publishAt"),
		categoryId: getEditorFieldValue("categoryId"),
		newCategoryName: getEditorFieldValue("newCategoryName"),
		featuredImageKey: getEditorFieldValue("featuredImageKey"),
		featuredImageAlt: getEditorFieldValue("featuredImageAlt"),
		metaTitle: getEditorFieldValue("metaTitle"),
		metaDescription: getEditorFieldValue("metaDescription"),
		metaKeywords: getEditorFieldValue("metaKeywords"),
		canonicalUrl: getEditorFieldValue("canonicalUrl"),
		tagIds: getEditorFieldValue("tagIds"),
		newTagNames: getEditorFieldValue("newTagNames"),
	};
}

function serializeEditorDraftValues(values) {
	try {
		return JSON.stringify(values);
	} catch {
		return "";
	}
}

function isEditorDraftPristine(values) {
	return (
		!values.title.trim() &&
		!values.slug.trim() &&
		!values.excerpt.trim() &&
		!values.content.trim() &&
		(values.status || "draft") === "draft" &&
		!values.publishAt.trim() &&
		!values.categoryId.trim() &&
		!values.newCategoryName.trim() &&
		!values.featuredImageKey.trim() &&
		!values.featuredImageAlt.trim() &&
		!values.metaTitle.trim() &&
		!values.metaDescription.trim() &&
		!values.metaKeywords.trim() &&
		!values.canonicalUrl.trim() &&
		!values.tagIds.trim() &&
		!values.newTagNames.trim()
	);
}

function normalizeEditorDraftValues(raw) {
	const normalized = {
		title: String(raw?.title ?? ""),
		slug: String(raw?.slug ?? ""),
		excerpt: String(raw?.excerpt ?? ""),
		content: String(raw?.content ?? ""),
		status: String(raw?.status ?? "draft"),
		publishAt: String(raw?.publishAt ?? ""),
		categoryId: String(raw?.categoryId ?? ""),
		newCategoryName: String(raw?.newCategoryName ?? ""),
		featuredImageKey: String(raw?.featuredImageKey ?? ""),
		featuredImageAlt: String(raw?.featuredImageAlt ?? ""),
		metaTitle: String(raw?.metaTitle ?? ""),
		metaDescription: String(raw?.metaDescription ?? ""),
		metaKeywords: String(raw?.metaKeywords ?? ""),
		canonicalUrl: String(raw?.canonicalUrl ?? ""),
		tagIds: String(raw?.tagIds ?? ""),
		newTagNames: String(raw?.newTagNames ?? ""),
	};

	if (!["draft", "published", "scheduled"].includes(normalized.status)) {
		normalized.status = "draft";
	}

	return normalized;
}

function formatDraftSavedAt(isoString) {
	if (!isoString) {
		return "未知时间";
	}

	const date = new Date(isoString);
	if (Number.isNaN(date.getTime())) {
		return "未知时间";
	}

	return date.toLocaleString("zh-CN", { hour12: false });
}

function setDraftUiStatus(message, mode = "") {
	setStatusMessage(draftStatus, message, mode);
}

function setAiSeoUiStatus(message, mode = "") {
	setStatusMessage(aiSeoStatus, message, mode);
}

function applyGeneratedSeoFieldsToEditor(fields) {
	const mapping = [
		["excerpt", fields?.excerpt],
		["metaTitle", fields?.metaTitle],
		["metaDescription", fields?.metaDescription],
		["metaKeywords", fields?.metaKeywords],
	];

	let appliedCount = 0;
	for (const [id, rawValue] of mapping) {
		if (typeof rawValue !== "string") {
			continue;
		}

		const value = rawValue.trim();
		if (!value) {
			continue;
		}

		const element = document.getElementById(id);
		if (
			!(element instanceof HTMLInputElement) &&
			!(element instanceof HTMLTextAreaElement)
		) {
			continue;
		}

		element.value = value;
		element.dispatchEvent(new Event("input", { bubbles: true }));
		appliedCount += 1;
	}

	const seoDetails = document.querySelector(".editor-panel details");
	if (seoDetails instanceof HTMLDetailsElement && appliedCount > 0) {
		seoDetails.open = true;
	}

	return appliedCount;
}

async function triggerAiSeoGeneration() {
	if (!(aiSeoGenerateButton instanceof HTMLButtonElement)) {
		return;
	}

	const endpoint = aiSeoGenerateButton.dataset.aiSeoEndpoint || "";
	if (!endpoint) {
		setAiSeoUiStatus("AI 生成接口缺失，请刷新页面后重试", "error");
		return;
	}

	if (!editorCsrfToken) {
		setAiSeoUiStatus("CSRF 令牌缺失，请刷新页面后重试", "error");
		return;
	}

	const title = getEditorFieldValue("title").trim();
	const content = getEditorFieldValue("content");
	if (!title) {
		setAiSeoUiStatus("请先填写文章标题", "error");
		return;
	}
	if (!content.trim()) {
		setAiSeoUiStatus("请先填写正文内容", "error");
		return;
	}

	const formData = new FormData();
	formData.append("_csrf", editorCsrfToken);
	formData.append("title", title);
	formData.append("content", content);

	const originalLabel = aiSeoGenerateButton.textContent || "AI 生成摘要与 SEO";
	aiSeoGenerateButton.disabled = true;
	aiSeoGenerateButton.textContent = "AI 生成中...";
	setAiSeoUiStatus("AI 正在生成，请稍候");

	try {
		const response = await fetch(endpoint, {
			method: "POST",
			body: formData,
			credentials: "same-origin",
		});
		const payload = await response.json().catch(() => ({}));
		if (!response.ok || !payload?.success) {
			throw new Error(payload?.message || "AI 生成失败，请稍后重试");
		}

		const appliedCount = applyGeneratedSeoFieldsToEditor(payload.data);
		if (appliedCount === 0) {
			setAiSeoUiStatus("AI 已返回结果，但没有可回填字段，请补充正文后重试", "error");
			return;
		}

		scheduleEditorDraftSave();
		setAiSeoUiStatus(
			`AI 已回填 ${appliedCount} 个字段，请确认后再保存或发布`,
			"success",
		);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "AI 生成失败，请稍后重试";
		setAiSeoUiStatus(message, "error");
	} finally {
		aiSeoGenerateButton.disabled = false;
		aiSeoGenerateButton.textContent = originalLabel;
	}
}

function syncDraftActionButtons({
	showToolbar = true,
	showRestore = false,
	showClear = false,
} = {}) {
	if (draftToolbar instanceof HTMLElement) {
		draftToolbar.hidden = !showToolbar;
	}

	if (draftRestoreButton instanceof HTMLButtonElement) {
		draftRestoreButton.hidden = !showRestore;
	}

	if (draftClearButton instanceof HTMLButtonElement) {
		draftClearButton.hidden = !showClear;
	}
}

function readEditorDraftFromStorage() {
	const storageKey = getEditorDraftStorageKey();
	if (!storageKey || !editorDraftStorageAvailable) {
		return null;
	}

	try {
		const raw = window.localStorage.getItem(storageKey);
		if (!raw) {
			return null;
		}

		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") {
			return null;
		}

		const values = normalizeEditorDraftValues(parsed.values);
		const savedAt = String(parsed.savedAt ?? "");
		return {
			version: Number(parsed.version ?? 0),
			savedAt,
			values,
		};
	} catch {
		return null;
	}
}

function writeEditorDraftToStorage(values) {
	const storageKey = getEditorDraftStorageKey();
	if (!storageKey || !editorDraftStorageAvailable) {
		return false;
	}

	try {
		const payload = {
			version: EDITOR_DRAFT_SCHEMA_VERSION,
			savedAt: new Date().toISOString(),
			values,
		};
		window.localStorage.setItem(storageKey, JSON.stringify(payload));
		editorDraftState = payload;
		return true;
	} catch {
		return false;
	}
}

function clearEditorDraftStorage() {
	const storageKey = getEditorDraftStorageKey();
	if (!storageKey || !editorDraftStorageAvailable) {
		return;
	}

	try {
		window.localStorage.removeItem(storageKey);
	} catch {
		// 忽略本地存储异常，避免影响编辑流程
	}
}

function syncEditorCoverPreviewFromKey() {
	const keyInput = document.querySelector("[data-cover-key-input='true']");
	const dropzone = document.querySelector("[data-cover-dropzone='true']");
	const altInput = document.getElementById("featuredImageAlt");

	if (!(keyInput instanceof HTMLInputElement) || !(dropzone instanceof HTMLElement)) {
		return;
	}

	const key = keyInput.value.trim();
	if (!key) {
		dropzone.innerHTML =
			'<div class="cover-empty" data-cover-empty="true">拖拽图片或点击上传</div>';
		return;
	}

	const altText =
		altInput instanceof HTMLInputElement && altInput.value.trim()
			? altInput.value.trim()
			: "封面预览";
	let image = dropzone.querySelector("[data-cover-preview-image='true']");
	if (!(image instanceof HTMLImageElement)) {
		image = document.createElement("img");
		image.className = "cover-preview-image";
		image.setAttribute("data-cover-preview-image", "true");
		dropzone.innerHTML = "";
		dropzone.appendChild(image);
	}

	image.src = `/media/${key}`;
	image.alt = altText;
}

function applyEditorDraftValues(values) {
	const normalized = normalizeEditorDraftValues(values);
	isApplyingEditorDraft = true;

	for (const [key, value] of Object.entries(normalized)) {
		const element = document.getElementById(key);
		if (
			element instanceof HTMLInputElement ||
			element instanceof HTMLTextAreaElement ||
			element instanceof HTMLSelectElement
		) {
			element.value = value;
		}
	}

	const selectedTagIds = new Set(
		normalized.tagIds
			.split(",")
			.map((value) => value.trim())
			.filter(Boolean),
	);

	for (const checkbox of document.querySelectorAll("input[data-tag-checkbox='true']")) {
		if (!(checkbox instanceof HTMLInputElement)) {
			continue;
		}
		checkbox.checked = selectedTagIds.has(checkbox.value);
	}

	if (slugInput instanceof HTMLInputElement) {
		slugInput.dataset.manual = normalized.slug ? "true" : "false";
	}

	updateTagIds();
	syncNewCategoryInputVisibility();
	syncScheduleFieldVisibility();
	updateSlugPreview();
	syncEditorCoverPreviewFromKey();
	syncMarkdownPreview();
	isApplyingEditorDraft = false;
}

function saveEditorDraftNow() {
	if (!(editorForm instanceof HTMLFormElement) || isApplyingEditorDraft) {
		return;
	}

	const currentValues = collectEditorDraftValues();
	if (isEditorDraftPristine(currentValues)) {
		clearEditorDraftStorage();
		editorDraftState = null;
		syncDraftActionButtons({
			showToolbar: false,
			showRestore: false,
			showClear: false,
		});
		return;
	}

	const previousSerialized = editorDraftState
		? serializeEditorDraftValues(editorDraftState.values)
		: "";
	const nextSerialized = serializeEditorDraftValues(currentValues);
	if (previousSerialized && previousSerialized === nextSerialized) {
		return;
	}

	const saved = writeEditorDraftToStorage(currentValues);
	if (!saved || !editorDraftState) {
		setDraftUiStatus("本地草稿保存失败，请检查浏览器存储权限", "error");
		return;
	}

	setDraftUiStatus(
		`本地草稿已保存（${formatDraftSavedAt(editorDraftState.savedAt)}）`,
		"success",
	);
	syncDraftActionButtons({
		showToolbar: true,
		showRestore: false,
		showClear: true,
	});
}

function scheduleEditorDraftSave() {
	if (!(editorForm instanceof HTMLFormElement) || isApplyingEditorDraft) {
		return;
	}

	if (editorDraftSaveTimer) {
		window.clearTimeout(editorDraftSaveTimer);
	}

	editorDraftSaveTimer = window.setTimeout(() => {
		editorDraftSaveTimer = 0;
		saveEditorDraftNow();
	}, EDITOR_DRAFT_SAVE_DEBOUNCE_MS);
}

function initEditorDraft() {
	if (!(editorForm instanceof HTMLFormElement)) {
		return;
	}

	if (!editorDraftStorageAvailable) {
		syncDraftActionButtons({
			showToolbar: true,
			showRestore: false,
			showClear: false,
		});
		setDraftUiStatus("当前浏览器不支持本地草稿存储");
		return;
	}

	const draft = readEditorDraftFromStorage();
	const currentValues = collectEditorDraftValues();

	if (!draft || !draft.values) {
		syncDraftActionButtons({
			showToolbar: false,
			showRestore: false,
			showClear: false,
		});
		return;
	}

	const currentSerialized = serializeEditorDraftValues(currentValues);
	const draftSerialized = serializeEditorDraftValues(draft.values);
	const savedAtText = formatDraftSavedAt(draft.savedAt);
	const shouldAutoRestore =
		isEditorDraftPristine(currentValues) && !isEditorDraftPristine(draft.values);

	editorDraftState = draft;

	if (currentSerialized === draftSerialized) {
		syncDraftActionButtons({
			showToolbar: true,
			showRestore: false,
			showClear: true,
		});
		setDraftUiStatus(`本地草稿已同步（${savedAtText}）`);
		return;
	}

	if (shouldAutoRestore) {
		applyEditorDraftValues(draft.values);
		setDraftUiStatus(`已自动恢复本地草稿（${savedAtText}）`, "success");
		syncDraftActionButtons({
			showToolbar: true,
			showRestore: false,
			showClear: true,
		});
		return;
	}

	setDraftUiStatus(`发现本地草稿（${savedAtText}），可选择恢复或清除`);
	syncDraftActionButtons({
		showToolbar: true,
		showRestore: true,
		showClear: true,
	});
}

titleInput?.addEventListener("input", updateSlugFromTitle);

slugInput?.addEventListener("input", () => {
	if (slugInput instanceof HTMLInputElement) {
		slugInput.value = buildSlugValue(slugInput.value);
		slugInput.dataset.manual = slugInput.value ? "true" : "false";
		if (!slugInput.value) {
			slugInput.dataset.manual = "false";
			updateSlugFromTitle();
		}
		updateSlugPreview();
	}
});

for (const checkbox of document.querySelectorAll("input[data-tag-checkbox='true']")) {
	checkbox.addEventListener("change", updateTagIds);
}

categorySelect?.addEventListener("change", syncNewCategoryInputVisibility);
syncNewCategoryInputVisibility();
statusSelect?.addEventListener("change", syncScheduleFieldVisibility);
syncScheduleFieldVisibility();

draftRestoreButton?.addEventListener("click", () => {
	if (!editorDraftState?.values) {
		return;
	}

	applyEditorDraftValues(editorDraftState.values);
	setDraftUiStatus(
		`已恢复本地草稿（${formatDraftSavedAt(editorDraftState.savedAt)}）`,
		"success",
	);
	syncDraftActionButtons({
		showToolbar: true,
		showRestore: false,
		showClear: true,
	});
	scheduleEditorDraftSave();
});

draftClearButton?.addEventListener("click", () => {
	clearEditorDraftStorage();
	editorDraftState = null;
	setDraftUiStatus("本地草稿已清除", "success");
	syncDraftActionButtons({
		showToolbar: false,
		showRestore: false,
		showClear: false,
	});
});

editorForm?.addEventListener("input", scheduleEditorDraftSave);
editorForm?.addEventListener("change", scheduleEditorDraftSave);
editorForm?.addEventListener("submit", () => {
	if (editorDraftSaveTimer) {
		window.clearTimeout(editorDraftSaveTimer);
		editorDraftSaveTimer = 0;
	}
	clearEditorDraftStorage();
	editorDraftState = null;
});
applyAdminLocalTimes();
initEditorDraft();
aiSeoGenerateButton?.addEventListener("click", () => {
	void triggerAiSeoGeneration();
});

mediaUploadInput?.addEventListener("change", () => {
	if (!(mediaUploadInput instanceof HTMLInputElement)) {
		return;
	}

	const file = mediaUploadInput.files?.[0];
	updateMediaUploadFilename(file ?? null);
	if (file instanceof File) {
		submitMediaUploadForm();
	}
});

mediaUploadDropzone?.addEventListener("keydown", (event) => {
	if (event.key !== "Enter" && event.key !== " ") {
		return;
	}

	event.preventDefault();
	if (mediaUploadInput instanceof HTMLInputElement) {
		mediaUploadInput.click();
	}
});

mediaUploadDropzone?.addEventListener("dragover", (event) => {
	event.preventDefault();
	if (mediaUploadDropzone instanceof HTMLElement) {
		mediaUploadDropzone.classList.add("is-dragover");
	}
});

mediaUploadDropzone?.addEventListener("dragleave", () => {
	if (mediaUploadDropzone instanceof HTMLElement) {
		mediaUploadDropzone.classList.remove("is-dragover");
	}
});

mediaUploadDropzone?.addEventListener("drop", (event) => {
	event.preventDefault();
	if (mediaUploadDropzone instanceof HTMLElement) {
		mediaUploadDropzone.classList.remove("is-dragover");
	}

	const file = event.dataTransfer?.files?.[0];
	if (!(file instanceof File)) {
		return;
	}

	assignMediaUploadFile(file);
});

for (const uploader of document.querySelectorAll("[data-cover-uploader='true']")) {
	if (!(uploader instanceof HTMLElement)) {
		continue;
	}

	const uploadUrl = uploader.dataset.uploadUrl || "";
	const csrfToken = uploader.dataset.csrfToken || "";
	const hiddenKeyInput =
		uploader.querySelector("[data-cover-key-input='true']") ||
		uploader.closest(".form-group")?.querySelector("[data-cover-key-input='true']") ||
		document.querySelector("[data-cover-key-input='true']");
	const fileInput = uploader.querySelector("[data-cover-file-input='true']");
	const dropzone = uploader.querySelector("[data-cover-dropzone='true']");
	const keyDisplay = uploader.querySelector("[data-cover-key-display]");
	const status = uploader.querySelector("[data-cover-upload-status]");
	const selectButton = uploader.querySelector("[data-cover-select='true']");
	const clearButton = uploader.querySelector("[data-cover-clear='true']");

	const ensurePreviewImage = () => {
		if (!(dropzone instanceof HTMLElement)) {
			return null;
		}

		const existing = dropzone.querySelector("[data-cover-preview-image='true']");
		if (existing instanceof HTMLImageElement) {
			return existing;
		}

		const image = document.createElement("img");
		image.className = "cover-preview-image";
		image.setAttribute("data-cover-preview-image", "true");
		image.alt = "封面预览";
		dropzone.innerHTML = "";
		dropzone.appendChild(image);
		return image;
	};

	const setEmptyState = () => {
		if (!(dropzone instanceof HTMLElement)) {
			return;
		}

		dropzone.innerHTML =
			'<div class="cover-empty" data-cover-empty="true">拖拽图片或点击上传</div>';
	};

	const setStatus = (message) => {
		setStatusMessage(status, message);
	};

	const setCoverValue = (key, url) => {
		if (hiddenKeyInput instanceof HTMLInputElement) {
			hiddenKeyInput.value = key;
		}

		if (keyDisplay instanceof HTMLElement) {
			keyDisplay.textContent = key || "";
		}

		if (!key) {
			setEmptyState();
			return;
		}

		const image = ensurePreviewImage();
		if (image instanceof HTMLImageElement) {
			image.src = url;
		}
	};

	const uploadFile = async (file) => {
		if (!file || !uploadUrl || !csrfToken) {
			return;
		}

		setStatus("正在上传封面");

		try {
			const uploaded = await uploadImageToMedia(file, uploadUrl, csrfToken);
			setCoverValue(uploaded.key, uploaded.url);
			setStatusMessage(status, "封面上传成功", "success");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "封面上传失败，请检查网络后重试";
			setStatusMessage(status, message, "error");
		}
	};

	selectButton?.addEventListener("click", () => {
		if (fileInput instanceof HTMLInputElement) {
			fileInput.click();
		}
	});

	fileInput?.addEventListener("change", () => {
		if (!(fileInput instanceof HTMLInputElement) || !fileInput.files?.[0]) {
			return;
		}

		void uploadFile(fileInput.files[0]);
		fileInput.value = "";
	});

	clearButton?.addEventListener("click", () => {
		setCoverValue("", "");
		setStatus("封面已清空");
	});

	dropzone?.addEventListener("dragover", (event) => {
		event.preventDefault();
		if (dropzone instanceof HTMLElement) {
			dropzone.classList.add("is-dragover");
		}
	});

	dropzone?.addEventListener("click", () => {
		if (fileInput instanceof HTMLInputElement) {
			fileInput.click();
		}
	});

	dropzone?.addEventListener("dragleave", () => {
		if (dropzone instanceof HTMLElement) {
			dropzone.classList.remove("is-dragover");
		}
	});

	dropzone?.addEventListener("drop", (event) => {
		event.preventDefault();
		if (dropzone instanceof HTMLElement) {
			dropzone.classList.remove("is-dragover");
		}

		const file = event.dataTransfer?.files?.[0];
		if (!file) {
			return;
		}

		void uploadFile(file);
	});
}

for (const uploader of document.querySelectorAll("[data-hero-image-uploader='true']")) {
	if (!(uploader instanceof HTMLElement)) {
		continue;
	}

	const uploadUrl = uploader.dataset.uploadUrl || "";
	const csrfToken = uploader.dataset.csrfToken || "";
	const pathInput =
		uploader.querySelector("[data-hero-image-path-input='true']") ||
		uploader.closest(".form-group")?.querySelector("[data-hero-image-path-input='true']") ||
		document.querySelector("[data-hero-image-path-input='true']");
	const fileInput = uploader.querySelector("[data-hero-image-file-input='true']");
	const dropzone = uploader.querySelector("[data-hero-image-dropzone='true']");
	const status = uploader.querySelector("[data-hero-image-status]");
	const selectButton = uploader.querySelector("[data-hero-image-select='true']");
	const clearButton = uploader.querySelector("[data-hero-image-clear='true']");

	const ensurePreviewImage = () => {
		if (!(dropzone instanceof HTMLElement)) {
			return null;
		}

		const existing = dropzone.querySelector("[data-hero-image-preview='true']");
		if (existing instanceof HTMLImageElement) {
			return existing;
		}

		const image = document.createElement("img");
		image.className = "cover-preview-image";
		image.setAttribute("data-hero-image-preview", "true");
		image.alt = "首屏图片预览";
		dropzone.innerHTML = "";
		dropzone.appendChild(image);
		return image;
	};

	const setEmptyState = () => {
		if (!(dropzone instanceof HTMLElement)) {
			return;
		}

		dropzone.innerHTML =
			'<div class="cover-empty" data-hero-image-empty="true">拖拽图片或点击上传首屏图片</div>';
	};

	const setPathValue = (path, previewUrl = path) => {
		if (pathInput instanceof HTMLInputElement) {
			pathInput.value = path;
		}

		if (!path) {
			setEmptyState();
			return;
		}

		const image = ensurePreviewImage();
		if (image instanceof HTMLImageElement) {
			image.src = previewUrl;
		}
	};

	const uploadFile = async (file) => {
		if (!file || !uploadUrl || !csrfToken) {
			return;
		}

		setStatusMessage(status, "正在上传首屏图片");
		try {
			const uploaded = await uploadImageToMedia(file, uploadUrl, csrfToken);
			setPathValue(uploaded.url, uploaded.url);
			setStatusMessage(status, "首屏图片上传成功", "success");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "首屏图片上传失败，请稍后重试";
			setStatusMessage(status, message, "error");
		}
	};

	selectButton?.addEventListener("click", () => {
		if (fileInput instanceof HTMLInputElement) {
			fileInput.click();
		}
	});

	fileInput?.addEventListener("change", () => {
		if (!(fileInput instanceof HTMLInputElement) || !fileInput.files?.[0]) {
			return;
		}

		void uploadFile(fileInput.files[0]);
		fileInput.value = "";
	});

	clearButton?.addEventListener("click", () => {
		setPathValue("");
		setStatusMessage(status, "首屏图片引用已清空", "success");
	});

	dropzone?.addEventListener("click", () => {
		if (fileInput instanceof HTMLInputElement) {
			fileInput.click();
		}
	});

	dropzone?.addEventListener("keydown", (event) => {
		if (event.key !== "Enter" && event.key !== " ") {
			return;
		}

		event.preventDefault();
		if (fileInput instanceof HTMLInputElement) {
			fileInput.click();
		}
	});

	dropzone?.addEventListener("dragover", (event) => {
		event.preventDefault();
		if (dropzone instanceof HTMLElement) {
			dropzone.classList.add("is-dragover");
		}
	});

	dropzone?.addEventListener("dragleave", () => {
		if (dropzone instanceof HTMLElement) {
			dropzone.classList.remove("is-dragover");
		}
	});

	dropzone?.addEventListener("drop", (event) => {
		event.preventDefault();
		if (dropzone instanceof HTMLElement) {
			dropzone.classList.remove("is-dragover");
		}

		const file = event.dataTransfer?.files?.[0];
		if (!(file instanceof File)) {
			return;
		}

		void uploadFile(file);
	});
}

for (const uploader of document.querySelectorAll("[data-signal-image-uploader='true']")) {
	if (!(uploader instanceof HTMLElement)) {
		continue;
	}

	const uploadUrl = uploader.dataset.uploadUrl || "";
	const csrfToken = uploader.dataset.csrfToken || "";
	const pathInput =
		uploader.querySelector("[data-signal-image-path-input='true']") ||
		uploader
			.closest(".form-group")
			?.querySelector("[data-signal-image-path-input='true']") ||
		document.querySelector("[data-signal-image-path-input='true']");
	const fileInput = uploader.querySelector("[data-signal-image-file-input='true']");
	const dropzone = uploader.querySelector("[data-signal-image-dropzone='true']");
	const status = uploader.querySelector("[data-signal-image-status]");
	const selectButton = uploader.querySelector("[data-signal-image-select='true']");
	const clearButton = uploader.querySelector("[data-signal-image-clear='true']");

	const ensurePreviewImage = () => {
		if (!(dropzone instanceof HTMLElement)) {
			return null;
		}

		const existing = dropzone.querySelector("[data-signal-image-preview='true']");
		if (existing instanceof HTMLImageElement) {
			return existing;
		}

		const image = document.createElement("img");
		image.className = "cover-preview-image";
		image.setAttribute("data-signal-image-preview", "true");
		image.alt = "右侧卡片图片预览";
		dropzone.innerHTML = "";
		dropzone.appendChild(image);
		return image;
	};

	const setEmptyState = () => {
		if (!(dropzone instanceof HTMLElement)) {
			return;
		}

		dropzone.innerHTML =
			'<div class="cover-empty" data-signal-image-empty="true">拖拽图片或点击上传右侧卡片图片</div>';
	};

	const setPathValue = (path, previewUrl = path) => {
		if (pathInput instanceof HTMLInputElement) {
			pathInput.value = path;
		}

		if (!path) {
			setEmptyState();
			return;
		}

		const image = ensurePreviewImage();
		if (image instanceof HTMLImageElement) {
			image.src = previewUrl;
		}
	};

	const uploadFile = async (file) => {
		if (!file || !uploadUrl || !csrfToken) {
			return;
		}

		setStatusMessage(status, "正在上传右侧卡片图片");
		try {
			const uploaded = await uploadImageToMedia(file, uploadUrl, csrfToken);
			setPathValue(uploaded.url, uploaded.url);
			setStatusMessage(status, "右侧卡片图片上传成功", "success");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "右侧卡片图片上传失败，请稍后重试";
			setStatusMessage(status, message, "error");
		}
	};

	selectButton?.addEventListener("click", () => {
		if (fileInput instanceof HTMLInputElement) {
			fileInput.click();
		}
	});

	fileInput?.addEventListener("change", () => {
		if (!(fileInput instanceof HTMLInputElement) || !fileInput.files?.[0]) {
			return;
		}

		void uploadFile(fileInput.files[0]);
		fileInput.value = "";
	});

	clearButton?.addEventListener("click", () => {
		setPathValue("");
		setStatusMessage(status, "右侧卡片图片引用已清空", "success");
	});

	dropzone?.addEventListener("click", () => {
		if (fileInput instanceof HTMLInputElement) {
			fileInput.click();
		}
	});

	dropzone?.addEventListener("keydown", (event) => {
		if (event.key !== "Enter" && event.key !== " ") {
			return;
		}

		event.preventDefault();
		if (fileInput instanceof HTMLInputElement) {
			fileInput.click();
		}
	});

	dropzone?.addEventListener("dragover", (event) => {
		event.preventDefault();
		if (dropzone instanceof HTMLElement) {
			dropzone.classList.add("is-dragover");
		}
	});

	dropzone?.addEventListener("dragleave", () => {
		if (dropzone instanceof HTMLElement) {
			dropzone.classList.remove("is-dragover");
		}
	});

	dropzone?.addEventListener("drop", (event) => {
		event.preventDefault();
		if (dropzone instanceof HTMLElement) {
			dropzone.classList.remove("is-dragover");
		}

		const file = event.dataTransfer?.files?.[0];
		if (!(file instanceof File)) {
			return;
		}

		void uploadFile(file);
	});
}

const handleEditorImageUpload = async (file) => {
	if (!(contentTextarea instanceof HTMLTextAreaElement) || !file) {
		return;
	}

	setStatusMessage(contentUploadStatus, "上传中");
	try {
		const uploaded = await uploadImageToMedia(file, editorUploadUrl, editorCsrfToken);
		insertMarkdownImage(contentTextarea, file, uploaded.url);
		setStatusMessage(contentUploadStatus, "已插入", "success");
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "正文图片上传失败，请稍后重试";
		setStatusMessage(contentUploadStatus, message, "error");
	}
};

contentTextarea?.addEventListener("input", scheduleMarkdownPreview);

contentTextarea?.addEventListener("dragover", (event) => {
	const file = getFirstImageFile(event.dataTransfer?.files);
	if (!file) {
		return;
	}

	event.preventDefault();
	if (contentTextarea instanceof HTMLTextAreaElement) {
		contentTextarea.classList.add("is-dragover");
	}
});

contentTextarea?.addEventListener("dragleave", () => {
	if (contentTextarea instanceof HTMLTextAreaElement) {
		contentTextarea.classList.remove("is-dragover");
	}
});

contentTextarea?.addEventListener("drop", (event) => {
	const file = getFirstImageFile(event.dataTransfer?.files);
	if (!file) {
		return;
	}

	event.preventDefault();
	if (contentTextarea instanceof HTMLTextAreaElement) {
		contentTextarea.classList.remove("is-dragover");
	}

	void handleEditorImageUpload(file);
});

contentTextarea?.addEventListener("paste", (event) => {
	const file = getFirstImageFile(event.clipboardData?.files);
	if (!file) {
		return;
	}

	event.preventDefault();
	void handleEditorImageUpload(file);
});

updateSlugPreview();
syncMarkdownPreview();
if (slugInput instanceof HTMLInputElement && !slugInput.value) {
	updateSlugFromTitle();
}

for (const button of document.querySelectorAll("button[data-copy-value]")) {
	button.addEventListener("click", async () => {
		const value = button.getAttribute("data-copy-value") ?? "";
		if (!value) {
			return;
		}

		await navigator.clipboard.writeText(value);
	});
}

for (const form of document.querySelectorAll("form[data-confirm-message]")) {
	form.addEventListener("submit", (event) => {
		const message = form.getAttribute("data-confirm-message");
		if (message && !window.confirm(message)) {
			event.preventDefault();
		}
	});
}

for (const button of document.querySelectorAll("button[data-confirm-message]")) {
	button.addEventListener("click", (event) => {
		const message = button.getAttribute("data-confirm-message");
		if (message && !window.confirm(message)) {
			event.preventDefault();
		}
	});
}

function syncDynamicLinkRemoveButtons(list) {
	if (!(list instanceof HTMLElement)) {
		return;
	}

	const rows = Array.from(list.querySelectorAll("[data-link-row]"));
	for (const row of rows) {
		if (!(row instanceof HTMLElement)) {
			continue;
		}

		const removeButton = row.querySelector("[data-link-remove]");
		if (removeButton instanceof HTMLButtonElement) {
			removeButton.disabled = rows.length <= 1;
		}
	}
}

function bindDynamicLinkRow(list, row) {
	if (!(list instanceof HTMLElement) || !(row instanceof HTMLElement)) {
		return;
	}

	if (row.dataset.linkRowBound === "true") {
		return;
	}

	row.dataset.linkRowBound = "true";
	const removeButton = row.querySelector("[data-link-remove]");
	removeButton?.addEventListener("click", () => {
		const rows = list.querySelectorAll("[data-link-row]");
		if (rows.length <= 1) {
			return;
		}

		row.remove();
		syncDynamicLinkRemoveButtons(list);
	});
}

function initDynamicLinkEditor(name) {
	const list = document.querySelector(`[data-link-list="${name}"]`);
	const template = document.querySelector(`template[data-link-template="${name}"]`);
	const addButton = document.querySelector(`[data-link-add="${name}"]`);

	if (!(list instanceof HTMLElement) || !(template instanceof HTMLTemplateElement)) {
		return;
	}

	for (const row of list.querySelectorAll("[data-link-row]")) {
		bindDynamicLinkRow(list, row);
	}
	syncDynamicLinkRemoveButtons(list);

	addButton?.addEventListener("click", () => {
		const fragment = template.content.cloneNode(true);
		list.appendChild(fragment);

		const rows = list.querySelectorAll("[data-link-row]");
		const newestRow = rows[rows.length - 1];
		if (newestRow instanceof HTMLElement) {
			bindDynamicLinkRow(list, newestRow);
			const firstInput = newestRow.querySelector("input");
			if (firstInput instanceof HTMLInputElement) {
				firstInput.focus();
			}
		}

		syncDynamicLinkRemoveButtons(list);
	});
}

initDynamicLinkEditor("nav");
initDynamicLinkEditor("hero");

const appearanceUploadDropzone = document.querySelector(
	"[data-appearance-upload-dropzone]",
);
const uploadInput = document.querySelector("[data-appearance-upload-input]");
const appearanceControls = {
	backgroundScale: document.querySelector(
		'[data-appearance-control="backgroundScale"]',
	),
	backgroundBlur: document.querySelector(
		'[data-appearance-control="backgroundBlur"]',
	),
	backgroundPositionX: document.querySelector(
		'[data-appearance-control="backgroundPositionX"]',
	),
	backgroundPositionY: document.querySelector(
		'[data-appearance-control="backgroundPositionY"]',
	),
	heroCardOpacity: document.querySelector(
		'[data-appearance-control="heroCardOpacity"]',
	),
	heroCardBlur: document.querySelector(
		'[data-appearance-control="heroCardBlur"]',
	),
};

function updateAppearanceDisplay(name, value) {
	const target = document.querySelector(`[data-appearance-display="${name}"]`);
	if (!(target instanceof HTMLElement)) {
		return;
	}

	target.textContent =
		name === "backgroundBlur" ||
		name === "heroCardBlur"
			? `${value} px`
			: `${value}%`;
}

function updateAppearancePreview() {
	const scaleInput = appearanceControls.backgroundScale;
	const blurInput = appearanceControls.backgroundBlur;
	const positionXInput = appearanceControls.backgroundPositionX;
	const positionYInput = appearanceControls.backgroundPositionY;

	if (
		!(scaleInput instanceof HTMLInputElement) ||
		!(blurInput instanceof HTMLInputElement) ||
		!(positionXInput instanceof HTMLInputElement) ||
		!(positionYInput instanceof HTMLInputElement)
	) {
		return;
	}

	const scale = Number(scaleInput.value);
	const blur = Number(blurInput.value);
	const positionX = Number(positionXInput.value);
	const positionY = Number(positionYInput.value);
	const heroCardOpacityInput = appearanceControls.heroCardOpacity;
	const heroCardBlurInput = appearanceControls.heroCardBlur;

	updateAppearanceDisplay("backgroundScale", scale);
	updateAppearanceDisplay("backgroundBlur", blur);
	updateAppearanceDisplay("backgroundPositionX", positionX);
	updateAppearanceDisplay("backgroundPositionY", positionY);
	if (heroCardOpacityInput instanceof HTMLInputElement) {
		updateAppearanceDisplay("heroCardOpacity", Number(heroCardOpacityInput.value));
	}
	if (heroCardBlurInput instanceof HTMLInputElement) {
		updateAppearanceDisplay("heroCardBlur", Number(heroCardBlurInput.value));
	}
}

function submitAppearanceUpload() {
	if (
		!(uploadInput instanceof HTMLInputElement) ||
		!(uploadInput.form instanceof HTMLFormElement)
	) {
		return;
	}

	const form = uploadInput.form;
	form.action = "/api/admin/appearance/background/upload";
	form.method = "post";
	form.enctype = "multipart/form-data";
	form.submit();
}

function handleAppearanceUploadSelection(file) {
	if (!(file instanceof File)) {
		return;
	}

	submitAppearanceUpload();
}

uploadInput?.addEventListener("change", () => {
	if (!(uploadInput instanceof HTMLInputElement) || !uploadInput.files?.[0]) {
		return;
	}

	handleAppearanceUploadSelection(uploadInput.files[0]);
});

appearanceUploadDropzone?.addEventListener("click", () => {
	if (uploadInput instanceof HTMLInputElement) {
		uploadInput.click();
	}
});

appearanceUploadDropzone?.addEventListener("keydown", (event) => {
	if (event.key !== "Enter" && event.key !== " ") {
		return;
	}

	event.preventDefault();
	if (uploadInput instanceof HTMLInputElement) {
		uploadInput.click();
	}
});

appearanceUploadDropzone?.addEventListener("dragover", (event) => {
	event.preventDefault();
	if (appearanceUploadDropzone instanceof HTMLElement) {
		appearanceUploadDropzone.classList.add("is-dragover");
	}
});

appearanceUploadDropzone?.addEventListener("dragleave", () => {
	if (appearanceUploadDropzone instanceof HTMLElement) {
		appearanceUploadDropzone.classList.remove("is-dragover");
	}
});

appearanceUploadDropzone?.addEventListener("drop", (event) => {
	event.preventDefault();
	if (appearanceUploadDropzone instanceof HTMLElement) {
		appearanceUploadDropzone.classList.remove("is-dragover");
	}

	if (!(uploadInput instanceof HTMLInputElement)) {
		return;
	}

	const file = event.dataTransfer?.files?.[0];
	if (!(file instanceof File)) {
		return;
	}

	const dataTransfer = new DataTransfer();
	dataTransfer.items.add(file);
	uploadInput.files = dataTransfer.files;
	handleAppearanceUploadSelection(file);
});

for (const control of Object.values(appearanceControls)) {
	control?.addEventListener("input", updateAppearancePreview);
}

updateAppearancePreview();
