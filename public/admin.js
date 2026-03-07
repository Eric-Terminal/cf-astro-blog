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
const editorForm = document.querySelector("form[data-editor-upload-url]");
const editorUploadUrl =
	editorForm instanceof HTMLFormElement
		? (editorForm.dataset.editorUploadUrl ?? "")
		: "";
const editorCsrfToken =
	editorForm instanceof HTMLFormElement
		? (editorForm.dataset.editorCsrfToken ?? "")
		: "";
const mediaUploadForm = document.querySelector("[data-media-upload-form='true']");
const mediaUploadInput = document.querySelector("[data-media-upload-input='true']");
const mediaUploadDropzone = document.querySelector(
	"[data-media-upload-dropzone='true']",
);
const mediaUploadFilename = document.querySelector(
	"[data-media-upload-filename='true']",
);

function updateMediaUploadFilename(file) {
	if (!(mediaUploadFilename instanceof HTMLElement)) {
		return;
	}

	if (!(file instanceof File)) {
		mediaUploadFilename.textContent =
			"支持 JPG、PNG、WEBP、AVIF、GIF，单个文件不超过 5 MB";
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
}

function syncNewCategoryInputVisibility() {
	const isCreatingNew =
		categorySelect instanceof HTMLSelectElement &&
		categorySelect.value === "__new__";

	if (newCategoryWrap instanceof HTMLElement) {
		newCategoryWrap.classList.toggle("is-disabled", !isCreatingNew);
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
		scheduleField.classList.toggle("is-disabled", !isScheduled);
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
		.filter(
			(node): node is HTMLInputElement =>
				node instanceof HTMLInputElement && node.checked,
		)
		.map((node) => node.value);

	tagIdsInput.value = checkedValues.join(",");
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
	const hiddenKeyInput = uploader.querySelector("#featuredImageKey");
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

const appearanceForm = document.querySelector("[data-appearance-form='true']");
const appearanceLiveFrame = document.querySelector("[data-appearance-live-frame]");
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
};

function updateAppearanceDisplay(name, value) {
	const target = document.querySelector(`[data-appearance-display="${name}"]`);
	if (!(target instanceof HTMLElement)) {
		return;
	}

	target.textContent =
		name === "backgroundBlur" ? `${value} px` : `${value}%`;
}

function getAppearanceFieldValue(name) {
	if (!(appearanceForm instanceof HTMLFormElement)) {
		return "";
	}

	const field = appearanceForm.elements.namedItem(name);
	if (field instanceof RadioNodeList) {
		return (field.value || "").trim();
	}

	if (
		field instanceof HTMLInputElement ||
		field instanceof HTMLTextAreaElement ||
		field instanceof HTMLSelectElement
	) {
		return field.value.trim();
	}

	return "";
}

function getAppearanceFieldValues(name) {
	if (!(appearanceForm instanceof HTMLFormElement)) {
		return [];
	}

	const values = [];
	for (const field of appearanceForm.querySelectorAll(`[name="${name}"]`)) {
		if (
			field instanceof HTMLInputElement ||
			field instanceof HTMLTextAreaElement ||
			field instanceof HTMLSelectElement
		) {
			values.push(field.value.trim());
		}
	}

	return values;
}

function resolvePreviewImageUrl(rawValue) {
	const value = rawValue.trim();
	if (!value) {
		return "";
	}

	if (value.startsWith("/")) {
		return value.startsWith("//") ? "" : value;
	}

	if (/^https?:\/\//iu.test(value)) {
		return value;
	}

	return `/media/${value.replace(/^\/+/u, "")}`;
}

function collectAppearanceLinks(labelName, hrefName) {
	const labels = getAppearanceFieldValues(labelName);
	const hrefs = getAppearanceFieldValues(hrefName);
	const count = Math.max(labels.length, hrefs.length);
	const items = [];

	for (let index = 0; index < count; index += 1) {
		const label = labels[index] || "";
		const href = hrefs[index] || "";
		if (!label || !href) {
			continue;
		}

		items.push({ label, href });
	}

	return items;
}

function isPreviewInternalHref(href) {
	return href.startsWith("/") && !href.startsWith("//");
}

function isPreviewLinkActive(currentPathname, href) {
	if (!isPreviewInternalHref(href)) {
		return false;
	}

	if (href === "/") {
		return currentPathname === "/";
	}

	return currentPathname === href || currentPathname.startsWith(`${href}/`);
}

function clearElementChildren(node) {
	while (node.firstChild) {
		node.removeChild(node.firstChild);
	}
}

function ensurePreviewBackgroundImage(previewDocument) {
	const container = previewDocument.querySelector(".site-background");
	if (!(container instanceof HTMLElement)) {
		return null;
	}

	const existing = container.querySelector(".site-background-image");
	if (existing instanceof HTMLImageElement) {
		return existing;
	}

	const image = previewDocument.createElement("img");
	image.className = "site-background-image";
	image.alt = "";
	image.decoding = "async";
	image.loading = "eager";
	container.appendChild(image);
	return image;
}

let appearanceLivePreviewFrame = 0;

function syncAppearanceLivePreview() {
	if (!(appearanceLiveFrame instanceof HTMLIFrameElement)) {
		return;
	}

	let previewDocument = null;
	try {
		previewDocument = appearanceLiveFrame.contentDocument;
	} catch {
		return;
	}

	if (!previewDocument) {
		return;
	}

	const headerSubtitle = getAppearanceFieldValue("headerSubtitle");
	const heroKicker = getAppearanceFieldValue("heroKicker");
	const heroTitle = getAppearanceFieldValue("heroTitle");
	const heroIntro = getAppearanceFieldValue("heroIntro");
	const heroSignalLabel = getAppearanceFieldValue("heroSignalLabel");
	const heroSignalHeading = getAppearanceFieldValue("heroSignalHeading");
	const heroSignalCopy = getAppearanceFieldValue("heroSignalCopy");
	const heroMainImagePath = getAppearanceFieldValue("heroMainImagePath");
	const backgroundImageKey = getAppearanceFieldValue("backgroundImageKey");
	const navLinks = collectAppearanceLinks("navLinkLabel", "navLinkHref");
	const heroActions = collectAppearanceLinks("heroActionLabel", "heroActionHref");

	const scaleValue = Number.parseInt(
		getAppearanceFieldValue("backgroundScale") || "112",
		10,
	);
	const blurValue = Number.parseInt(
		getAppearanceFieldValue("backgroundBlur") || "24",
		10,
	);
	const positionXValue = Number.parseInt(
		getAppearanceFieldValue("backgroundPositionX") || "50",
		10,
	);
	const positionYValue = Number.parseInt(
		getAppearanceFieldValue("backgroundPositionY") || "50",
		10,
	);

	const scale = Number.isFinite(scaleValue) ? scaleValue : 112;
	const blur = Number.isFinite(blurValue) ? blurValue : 24;
	const positionX = Number.isFinite(positionXValue) ? positionXValue : 50;
	const positionY = Number.isFinite(positionYValue) ? positionYValue : 50;

	const subtitleNode = previewDocument.querySelector(".site-brand-copy small");
	if (subtitleNode instanceof HTMLElement) {
		subtitleNode.textContent = headerSubtitle;
	}

	const navListNode = previewDocument.querySelector(".nav-links");
	if (navListNode instanceof HTMLElement) {
		clearElementChildren(navListNode);
		const currentPathname = previewDocument.location.pathname;
		for (const item of navLinks) {
			const listItem = previewDocument.createElement("li");
			const link = previewDocument.createElement("a");
			link.href = item.href;
			link.textContent = item.label;
			link.classList.add("nav-link");
			if (isPreviewLinkActive(currentPathname, item.href)) {
				link.classList.add("active");
			}

			if (!isPreviewInternalHref(item.href)) {
				link.target = "_blank";
				link.rel = "noopener noreferrer";
			}

			listItem.appendChild(link);
			navListNode.appendChild(listItem);
		}
	}

	const heroKickerNode = previewDocument.querySelector(
		".home-hero .home-hero-copy .section-kicker",
	);
	if (heroKickerNode instanceof HTMLElement) {
		heroKickerNode.textContent = heroKicker;
	}

	const heroTitleNode = previewDocument.querySelector(
		".home-hero .home-hero-copy .page-title",
	);
	if (heroTitleNode instanceof HTMLElement) {
		heroTitleNode.textContent = heroTitle;
	}

	const heroIntroNode = previewDocument.querySelector(
		".home-hero .home-hero-copy .page-intro",
	);
	if (heroIntroNode instanceof HTMLElement) {
		heroIntroNode.textContent = heroIntro;
	}

	const heroActionsNode = previewDocument.querySelector(".home-hero .hero-actions");
	if (heroActionsNode instanceof HTMLElement) {
		clearElementChildren(heroActionsNode);
		for (const [index, item] of heroActions.entries()) {
			const link = previewDocument.createElement("a");
			link.href = item.href;
			link.textContent = item.label;
			link.classList.add("button");
			if (index > 0) {
				link.classList.add("button-secondary");
			}

			if (!isPreviewInternalHref(item.href)) {
				link.target = "_blank";
				link.rel = "noopener noreferrer";
			}

			heroActionsNode.appendChild(link);
		}
	}

	const signalLabelNode = previewDocument.querySelector(".hero-signal-label");
	if (signalLabelNode instanceof HTMLElement) {
		signalLabelNode.textContent = heroSignalLabel;
	}

	const signalHeadingNode = previewDocument.querySelector(".hero-signal-heading");
	if (signalHeadingNode instanceof HTMLElement) {
		signalHeadingNode.textContent = heroSignalHeading;
	}

	const signalCopyNode = previewDocument.querySelector(".hero-signal-copy");
	if (signalCopyNode instanceof HTMLElement) {
		signalCopyNode.textContent = heroSignalCopy;
	}

	const heroMainMediaNode = previewDocument.querySelector(".hero-main-media");
	if (heroMainMediaNode instanceof HTMLElement) {
		const resolvedHeroImageUrl = resolvePreviewImageUrl(heroMainImagePath);
		let heroImageNode = heroMainMediaNode.querySelector("img");
		if (resolvedHeroImageUrl) {
			if (!(heroImageNode instanceof HTMLImageElement)) {
				heroImageNode = previewDocument.createElement("img");
				heroImageNode.alt = "";
				heroImageNode.decoding = "async";
				heroImageNode.loading = "lazy";
				heroMainMediaNode.appendChild(heroImageNode);
			}

			heroImageNode.src = resolvedHeroImageUrl;
			heroMainMediaNode.classList.add("hero-main-media-has-image");
		} else {
			if (heroImageNode instanceof HTMLImageElement) {
				heroImageNode.remove();
			}
			heroMainMediaNode.classList.remove("hero-main-media-has-image");
		}
	}

	const resolvedBackgroundUrl = resolvePreviewImageUrl(backgroundImageKey);
	const backgroundImageNode = ensurePreviewBackgroundImage(previewDocument);
	if (backgroundImageNode instanceof HTMLImageElement) {
		if (resolvedBackgroundUrl) {
			backgroundImageNode.src = resolvedBackgroundUrl;
			backgroundImageNode.style.objectPosition = `${positionX}% ${positionY}%`;
			backgroundImageNode.style.filter = `blur(${blur}px) saturate(1.08)`;
			backgroundImageNode.style.transform = `scale(${scale / 100})`;
		} else {
			backgroundImageNode.remove();
		}
	}
}

function queueAppearanceLivePreviewSync() {
	if (appearanceLivePreviewFrame) {
		return;
	}

	appearanceLivePreviewFrame = window.requestAnimationFrame(() => {
		appearanceLivePreviewFrame = 0;
		syncAppearanceLivePreview();
	});
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

	updateAppearanceDisplay("backgroundScale", scale);
	updateAppearanceDisplay("backgroundBlur", blur);
	updateAppearanceDisplay("backgroundPositionX", positionX);
	updateAppearanceDisplay("backgroundPositionY", positionY);
	queueAppearanceLivePreviewSync();
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

appearanceLiveFrame?.addEventListener("load", () => {
	queueAppearanceLivePreviewSync();
});

appearanceForm?.addEventListener("input", () => {
	queueAppearanceLivePreviewSync();
});

appearanceForm?.addEventListener("change", () => {
	queueAppearanceLivePreviewSync();
});

appearanceForm?.addEventListener("click", (event) => {
	if (!(event.target instanceof Element)) {
		return;
	}

	if (event.target.closest("[data-link-add], [data-link-remove]")) {
		window.setTimeout(() => {
			queueAppearanceLivePreviewSync();
		}, 0);
	}
});

if (appearanceForm instanceof HTMLFormElement) {
	const observer = new MutationObserver(() => {
		queueAppearanceLivePreviewSync();
	});
	observer.observe(appearanceForm, { childList: true, subtree: true });
}

for (const control of Object.values(appearanceControls)) {
	control?.addEventListener("input", updateAppearancePreview);
}

updateAppearancePreview();
