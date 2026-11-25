import { Hono } from "hono";
import { getDb } from "@/lib/db";
import {
	getAllowedMediaAcceptValue,
	isAllowedImageMimeType,
	MAX_UPLOAD_BYTES,
	saveMediaObjectWithDedup,
} from "@/lib/media";
import { escapeAttribute, escapeHtml, sanitizeMediaKey } from "@/lib/security";
import {
	type AiApiKeySource,
	type AiSettings,
	DEFAULT_AI_SETTINGS,
	DEFAULT_SITE_APPEARANCE,
	getAiSettings,
	getSiteAppearance,
	invalidateSiteAppearanceCache,
	resolveAiSettingsWithSecrets,
	type SiteNavLink,
	saveAiSettings,
	saveSiteAppearance,
} from "@/lib/site-appearance";
import {
	type AdminAppEnv,
	assertCsrfToken,
	getAuthenticatedSession,
	requireAuth,
} from "../middleware/auth";
import { appearanceStudioStyles } from "../views/appearance-styles";
import { adminLayout } from "../views/layout";

const appearance = new Hono<AdminAppEnv>();

type AppearanceFormValue = string | File | (string | File)[];
type AppearanceFormBody = Record<string, AppearanceFormValue>;

function getBodyText(body: AppearanceFormBody, key: string): string {
	const value = body[key];
	if (Array.isArray(value)) {
		const firstText = value.find(
			(item): item is string => typeof item === "string",
		);
		return firstText?.trim() ?? "";
	}

	return typeof value === "string" ? value : "";
}

function getBodyTexts(body: AppearanceFormBody, key: string): string[] {
	const value = body[key];
	if (Array.isArray(value)) {
		return value
			.filter((item): item is string => typeof item === "string")
			.map((item) => item.trim());
	}

	if (typeof value === "string") {
		return [value.trim()];
	}

	return [];
}

function getBodyFile(body: AppearanceFormBody, key: string): File | null {
	const value = body[key];
	if (Array.isArray(value)) {
		const firstFile = value.find((item): item is File => item instanceof File);
		return firstFile ?? null;
	}

	return value instanceof File ? value : null;
}

function parseBodyNumber(
	body: AppearanceFormBody,
	primaryKey: string,
	fallbackKey?: string,
): number {
	const primaryRaw = getBodyText(body, primaryKey);
	if (primaryRaw !== "") {
		return Number(primaryRaw);
	}

	if (fallbackKey) {
		const fallbackRaw = getBodyText(body, fallbackKey);
		if (fallbackRaw !== "") {
			return Number(fallbackRaw);
		}
	}

	return Number.NaN;
}

function convertOpacityToTransparency(opacity: number): number {
	return Math.max(0, Math.min(100, 100 - Math.round(opacity)));
}

function convertTransparencyToOpacity(transparency: number): number {
	return Math.max(0, Math.min(100, 100 - Math.round(transparency)));
}

function buildLinkItemsFromBody(
	labels: string[],
	hrefs: string[],
): SiteNavLink[] {
	const maxLength = Math.max(labels.length, hrefs.length);
	const items: SiteNavLink[] = [];
	for (let index = 0; index < maxLength; index += 1) {
		const label = labels[index]?.trim() ?? "";
		const href = hrefs[index]?.trim() ?? "";
		if (!label || !href) {
			continue;
		}

		items.push({ label, href });
	}

	return items;
}

function renderLinkRow(options: {
	labelName: string;
	hrefName: string;
	labelText: string;
	hrefText: string;
	labelValue: string;
	hrefValue: string;
	hrefPlaceholder: string;
	removeLabel: string;
}) {
	return `
		<div class="appearance-link-row" data-link-row>
			<div class="appearance-link-field">
				<label>${escapeHtml(options.labelText)}</label>
				<input
					name="${escapeAttribute(options.labelName)}"
					class="form-input"
					value="${escapeAttribute(options.labelValue)}"
					maxlength="24"
					placeholder="例如：归档"
				/>
			</div>
			<div class="appearance-link-field">
				<label>${escapeHtml(options.hrefText)}</label>
				<input
					name="${escapeAttribute(options.hrefName)}"
					class="form-input"
					value="${escapeAttribute(options.hrefValue)}"
					maxlength="240"
					placeholder="${escapeAttribute(options.hrefPlaceholder)}"
				/>
			</div>
			<button type="button" class="btn btn-sm appearance-link-remove" data-link-remove>
				${escapeHtml(options.removeLabel)}
			</button>
		</div>
	`;
}

function renderLinkRows(
	items: SiteNavLink[],
	options: Omit<
		Parameters<typeof renderLinkRow>[0],
		"labelValue" | "hrefValue"
	>,
) {
	const safeItems = items.length > 0 ? items : [{ label: "", href: "" }];
	return safeItems
		.map((item) =>
			renderLinkRow({
				...options,
				labelValue: item.label,
				hrefValue: item.href,
			}),
		)
		.join("");
}

function renderAppearancePage(options: {
	csrfToken: string;
	settings: typeof DEFAULT_SITE_APPEARANCE;
	aiSettings: AiSettings;
	aiKeySource: {
		internal: AiApiKeySource;
		public: AiApiKeySource;
	};
	aiWebKeyStatus: {
		internalHasSavedKey: boolean;
		publicHasSavedKey: boolean;
	};
	alert?: { type: "success" | "error"; message: string };
}) {
	const {
		csrfToken,
		settings,
		aiSettings,
		aiKeySource,
		aiWebKeyStatus,
		alert,
	} = options;
	const backgroundScaleOffset = Math.min(
		80,
		Math.max(0, settings.backgroundScale - 100),
	);
	const backgroundPositionXOffset = Math.min(
		50,
		Math.max(-50, settings.backgroundPositionX - 50),
	);
	const backgroundPositionYOffset = Math.min(
		50,
		Math.max(-50, settings.backgroundPositionY - 50),
	);
	const backgroundTransparency = convertOpacityToTransparency(
		settings.backgroundOpacity,
	);
	const heroCardTransparency = convertOpacityToTransparency(
		settings.heroCardOpacity,
	);
	const articlePanelTransparency = convertOpacityToTransparency(
		settings.articlePanelOpacity,
	);
	const alertHtml = alert
		? `<div class="alert alert-${escapeAttribute(alert.type)}">${escapeHtml(alert.message)}</div>`
		: "";
	const internalManagedBySecret = aiKeySource.internal === "cloudflare-secret";
	const publicManagedBySecret = aiKeySource.public === "cloudflare-secret";
	const internalApiKeyHelp = internalManagedBySecret
		? "当前优先使用 Cloudflare Secret：AI_INTERNAL_API_KEY，Web 表单不会覆盖此值。"
		: aiWebKeyStatus.internalHasSavedKey
			? "已保存 API Key（出于安全原因不回显）。留空提交可保持不变。"
			: "当前未保存 API Key。留空提交将保持为空。";
	const publicApiKeyHelp = publicManagedBySecret
		? "当前优先使用 Cloudflare Secret：AI_PUBLIC_API_KEY，Web 表单不会覆盖此值。"
		: aiWebKeyStatus.publicHasSavedKey
			? "已保存 API Key（出于安全原因不回显）。留空提交可保持不变。"
			: "当前未保存 API Key。留空提交将保持为空。";
	const internalApiPlaceholder = internalManagedBySecret
		? "已由 AI_INTERNAL_API_KEY 接管"
		: "留空表示不修改当前 Key";
	const publicApiPlaceholder = publicManagedBySecret
		? "已由 AI_PUBLIC_API_KEY 接管"
		: "留空表示不修改当前 Key";
	const internalApiDisabled = internalManagedBySecret ? "disabled" : "";
	const publicApiDisabled = publicManagedBySecret ? "disabled" : "";

	return `
		${appearanceStudioStyles}
		${alertHtml}
		<div class="page-header">
			<div class="page-header-copy">
				<span class="page-kicker">Appearance Studio</span>
				<h1 style="margin-bottom: 0;">站点外观</h1>
				<p class="form-help" style="margin: 0;">分区调节全局壁纸、光学毛玻璃、首屏名片、文章侧栏与 AI / MCP 接口，右侧可实时预览材质与文案。</p>
			</div>
			<div class="page-actions">
				<a href="/" target="_blank" rel="noopener noreferrer" class="btn btn-sm">打开前台预览</a>
				<a href="/api/admin/media" class="btn btn-sm">打开媒体库</a>
			</div>
		</div>

		<form method="post" action="/api/admin/appearance" data-appearance-form="true">
			<input type="hidden" name="_csrf" value="${escapeAttribute(csrfToken)}" />

			<div class="appearance-save-bar" data-appearance-save-bar>
				<div class="filter-tabs appearance-studio-tabs" role="tablist" aria-label="外观设置分区">
					<button type="button" class="filter-tab is-active" data-appearance-tab-btn="optics">背景与材质</button>
					<button type="button" class="filter-tab" data-appearance-tab-btn="hero">导航与首屏</button>
					<button type="button" class="filter-tab" data-appearance-tab-btn="sidebar">文章侧栏</button>
					<button type="button" class="filter-tab" data-appearance-tab-btn="integrations">AI 与 MCP</button>
					<button type="button" class="filter-tab" data-appearance-tab-btn="all">展开全部</button>
				</div>
				<div class="appearance-actions">
					<div class="appearance-save-state">
						<span class="appearance-dirty-dot" aria-hidden="true"></span>
						<span data-appearance-save-state>已同步</span>
					</div>
					<span class="admin-kbd" title="快捷键 ⌘S / Ctrl+S 保存">⌘S</span>
					<button type="submit" class="btn btn-primary btn-sm">保存外观设置</button>
				</div>
			</div>

			<div class="appearance-grid appearance-form-grid">
				<div class="appearance-stack">
					<section class="appearance-panel" data-appearance-section="optics">
						<div class="appearance-list-head">
							<h2>全局背景图</h2>
							${
								settings.backgroundImageKey
									? `<button
										type="submit"
										class="btn btn-sm btn-danger"
										formaction="/api/admin/appearance/background/clear"
										formmethod="post"
										data-confirm-message="${escapeAttribute("确认移除当前背景图引用吗？")}"
										formnovalidate
									>
										移除当前引用
									</button>`
									: ""
							}
						</div>
						<p class="appearance-note">拖拽图片即可自动去重上传并设为全局背景；移除引用不会删除媒体库原图。</p>
						<div class="appearance-stack">
							<div
								class="appearance-upload-dropzone"
								data-appearance-upload-dropzone
								data-appearance-background-dropzone="true"
								role="button"
								tabindex="0"
								aria-label="拖拽文件或点击上传背景图"
							>
								${
									settings.backgroundImageKey
										? `<img src="/media/${escapeAttribute(settings.backgroundImageKey)}" alt="背景图预览" class="cover-preview-image" data-appearance-background-preview="true" />`
										: `<div class="appearance-upload-copy" data-appearance-background-empty="true">
												<strong>拖拽图片到这里</strong>
												<span>或点击选择文件，自动上传并设为当前背景</span>
											</div>`
								}
							</div>
							<input
								type="file"
								name="file"
								accept="${escapeAttribute(getAllowedMediaAcceptValue())}"
								class="appearance-upload-input"
								data-appearance-upload-input
							/>
						</div>
						<div class="form-group form-group-tight" style="margin-top: 0.8rem;">
							<label for="backgroundImageKey">背景图键名或路径</label>
							<input
								id="backgroundImageKey"
								name="backgroundImageKey"
								class="form-input appearance-key-input"
								value="${escapeAttribute(settings.backgroundImageKey ?? "")}"
								placeholder="appearance/background/2026-03-07/xxxx.webp"
								data-appearance-background-key-input="true"
							/>
						</div>
					</section>

					<section class="appearance-panel" data-appearance-section="optics">
						<div class="appearance-list-head">
							<h2>光学毛玻璃与焦点参数</h2>
							<button type="button" class="btn btn-xs" data-appearance-reset-focus>重置缩放与居中焦点</button>
						</div>
						<p class="appearance-note">透明度 0% 表示完全不透明，100% 表示完全透明；调节滑块可在右侧预览窗即时查看层次变化。</p>
						<div class="appearance-controls">
							<div class="appearance-range">
								<div class="appearance-range-meta">
									<label for="backgroundTransparency">背景透明度</label>
									<span data-appearance-display="backgroundTransparency">${escapeHtml(String(backgroundTransparency))}%</span>
								</div>
								<input id="backgroundTransparency" name="backgroundTransparency" type="range" min="0" max="100" value="${escapeAttribute(String(backgroundTransparency))}" data-appearance-control="backgroundTransparency" />
							</div>
							<div class="appearance-range">
								<div class="appearance-range-meta">
									<label for="backgroundBlur">高斯模糊</label>
									<span data-appearance-display="backgroundBlur">${escapeHtml(String(settings.backgroundBlur))} px</span>
								</div>
								<input id="backgroundBlur" name="backgroundBlur" type="range" min="0" max="60" value="${escapeAttribute(String(settings.backgroundBlur))}" data-appearance-control="backgroundBlur" />
							</div>
							<div class="appearance-range">
								<div class="appearance-range-meta">
									<label for="heroCardTransparency">首页卡片透明度</label>
									<span data-appearance-display="heroCardTransparency">${escapeHtml(String(heroCardTransparency))}%</span>
								</div>
								<input id="heroCardTransparency" name="heroCardTransparency" type="range" min="0" max="100" value="${escapeAttribute(String(heroCardTransparency))}" data-appearance-control="heroCardTransparency" />
							</div>
							<div class="appearance-range">
								<div class="appearance-range-meta">
									<label for="heroCardBlur">首页卡片高斯模糊</label>
									<span data-appearance-display="heroCardBlur">${escapeHtml(String(settings.heroCardBlur))} px</span>
								</div>
								<input id="heroCardBlur" name="heroCardBlur" type="range" min="0" max="48" value="${escapeAttribute(String(settings.heroCardBlur))}" data-appearance-control="heroCardBlur" />
							</div>
							<div class="appearance-range">
								<div class="appearance-range-meta">
									<label for="articlePanelTransparency">文章页卡片透明度</label>
									<span data-appearance-display="articlePanelTransparency">${escapeHtml(String(articlePanelTransparency))}%</span>
								</div>
								<input id="articlePanelTransparency" name="articlePanelTransparency" type="range" min="0" max="100" value="${escapeAttribute(String(articlePanelTransparency))}" data-appearance-control="articlePanelTransparency" />
							</div>
							<div class="appearance-range">
								<div class="appearance-range-meta">
									<label for="articlePanelBlur">文章页卡片高斯模糊</label>
									<span data-appearance-display="articlePanelBlur">${escapeHtml(String(settings.articlePanelBlur))} px</span>
								</div>
								<input id="articlePanelBlur" name="articlePanelBlur" type="range" min="0" max="48" value="${escapeAttribute(String(settings.articlePanelBlur))}" data-appearance-control="articlePanelBlur" />
							</div>
							<div class="appearance-range">
								<div class="appearance-range-meta">
									<label for="backgroundScale">缩放</label>
									<span data-appearance-display="backgroundScale">${escapeHtml(String(backgroundScaleOffset))}%</span>
								</div>
								<input id="backgroundScale" name="backgroundScale" type="range" min="0" max="80" value="${escapeAttribute(String(backgroundScaleOffset))}" data-appearance-control="backgroundScale" />
							</div>
							<div class="appearance-range">
								<div class="appearance-range-meta">
									<label for="backgroundPositionX">横向焦点</label>
									<span data-appearance-display="backgroundPositionX">${escapeHtml(String(backgroundPositionXOffset))}%</span>
								</div>
								<input id="backgroundPositionX" name="backgroundPositionX" type="range" min="-50" max="50" value="${escapeAttribute(String(backgroundPositionXOffset))}" data-appearance-control="backgroundPositionX" />
							</div>
							<div class="appearance-range" style="grid-column: 1 / -1;">
								<div class="appearance-range-meta">
									<label for="backgroundPositionY">纵向焦点</label>
									<span data-appearance-display="backgroundPositionY">${escapeHtml(String(backgroundPositionYOffset))}%</span>
								</div>
								<input id="backgroundPositionY" name="backgroundPositionY" type="range" min="-50" max="50" value="${escapeAttribute(String(backgroundPositionYOffset))}" data-appearance-control="backgroundPositionY" />
							</div>
						</div>
					</section>

					<section class="appearance-panel" data-appearance-section="hero">
						<div class="appearance-list-head">
							<h2>顶部状态栏与导航索引</h2>
							<button type="button" class="btn btn-sm" data-link-add="nav">+ 新增导航</button>
						</div>
						<div class="form-group">
							<label for="headerSubtitle">顶部状态栏文案</label>
							<input
								id="headerSubtitle"
								name="headerSubtitle"
								class="form-input"
								value="${escapeAttribute(settings.headerSubtitle)}"
								maxlength="120"
							/>
						</div>
						<p class="appearance-note">导航支持自由增删，前台胶囊导航栏会自动适配宽度。</p>
						<div class="appearance-link-list" data-link-list="nav">
							${renderLinkRows(settings.navLinks, {
								labelName: "navLinkLabel",
								hrefName: "navLinkHref",
								labelText: "导航文案",
								hrefText: "导航链接",
								hrefPlaceholder: "/blog",
								removeLabel: "移除",
							})}
						</div>
						<template data-link-template="nav">
							${renderLinkRow({
								labelName: "navLinkLabel",
								hrefName: "navLinkHref",
								labelText: "导航文案",
								hrefText: "导航链接",
								labelValue: "",
								hrefValue: "",
								hrefPlaceholder: "/blog",
								removeLabel: "移除",
							})}
						</template>
					</section>

					<section class="appearance-panel" data-appearance-section="hero">
						<h2>首页首屏左侧主卡</h2>
						<div class="appearance-inline-grid">
							<div class="form-group">
								<label for="heroKicker">顶部标签</label>
								<input
									id="heroKicker"
									name="heroKicker"
									class="form-input"
									value="${escapeAttribute(settings.heroKicker)}"
									maxlength="24"
								/>
							</div>
							<div class="form-group">
								<label for="heroTitle">主标题</label>
								<input
									id="heroTitle"
									name="heroTitle"
									class="form-input"
									value="${escapeAttribute(settings.heroTitle)}"
									maxlength="120"
								/>
							</div>
						</div>
						<div class="form-group">
							<label for="heroIntro">简介</label>
							<textarea id="heroIntro" name="heroIntro" class="form-textarea" maxlength="600">${escapeHtml(settings.heroIntro)}</textarea>
						</div>
						<div class="form-group">
							<label for="heroMainImagePath">首屏主视觉图片路径（可选，留空不占位）</label>
							<input
								id="heroMainImagePath"
								name="heroMainImagePath"
								class="form-input appearance-key-input"
								value="${escapeAttribute(settings.heroMainImagePath ?? "")}"
								maxlength="320"
								placeholder="/media/appearance/home/hero-main.webp"
								data-hero-image-path-input="true"
							/>
							<div
								class="appearance-hero-uploader"
								data-hero-image-uploader="true"
								data-upload-url="/api/admin/media/upload-async"
								data-csrf-token="${escapeAttribute(csrfToken)}"
							>
								<input
									type="file"
									accept="${escapeAttribute(getAllowedMediaAcceptValue())}"
									class="appearance-upload-input"
									data-hero-image-file-input="true"
								/>
								<div
									class="appearance-upload-dropzone appearance-hero-dropzone"
									data-hero-image-dropzone="true"
									role="button"
									tabindex="0"
									aria-label="拖拽文件或点击上传首屏图片"
								>
									${
										settings.heroMainImagePath
											? `<img src="${escapeAttribute(settings.heroMainImagePath)}" alt="首屏图片预览" class="cover-preview-image" data-hero-image-preview="true" />`
											: `<div class="cover-empty" data-hero-image-empty="true">拖拽图片或点击上传首屏图片</div>`
									}
								</div>
								<div class="appearance-background-actions">
									<button type="button" class="btn btn-sm" data-hero-image-select="true">上传首屏图片</button>
									<button type="button" class="btn btn-sm btn-danger" data-hero-image-clear="true">清空首屏引用</button>
								</div>
								<p class="form-help" data-hero-image-status></p>
							</div>
						</div>
						<div class="appearance-list-head" style="margin-top: 1rem;">
							<h4>首页按钮</h4>
							<button type="button" class="btn btn-sm" data-link-add="hero">+ 新增按钮</button>
						</div>
						<p class="appearance-note">第一个按钮使用主强调色样式，其余按钮使用次级胶囊样式。</p>
						<div class="appearance-link-list" data-link-list="hero">
							${renderLinkRows(settings.heroActions, {
								labelName: "heroActionLabel",
								hrefName: "heroActionHref",
								labelText: "按钮文案",
								hrefText: "按钮链接",
								hrefPlaceholder: "/search",
								removeLabel: "移除",
							})}
						</div>
						<template data-link-template="hero">
							${renderLinkRow({
								labelName: "heroActionLabel",
								hrefName: "heroActionHref",
								labelText: "按钮文案",
								hrefText: "按钮链接",
								labelValue: "",
								hrefValue: "",
								hrefPlaceholder: "/search",
								removeLabel: "移除",
							})}
						</template>
					</section>

					<section class="appearance-panel" data-appearance-section="hero">
						<h2>首屏右侧展示名片</h2>
						<p class="appearance-note">支持透明通道角色立绘、状态签名与三枚个性铭牌。</p>
						<div class="appearance-inline-grid">
							<div class="form-group">
								<label for="heroSignalLabel">右侧卡片标签</label>
								<input
									id="heroSignalLabel"
									name="heroSignalLabel"
									class="form-input"
									value="${escapeAttribute(settings.heroSignalLabel)}"
									maxlength="30"
								/>
							</div>
							<div class="form-group">
								<label for="heroSignalHeading">右侧卡片标题</label>
								<input
									id="heroSignalHeading"
									name="heroSignalHeading"
									class="form-input"
									value="${escapeAttribute(settings.heroSignalHeading)}"
									maxlength="120"
								/>
							</div>
						</div>
						<div class="form-group">
							<label for="heroSignalCopy">右侧卡片描述</label>
							<textarea id="heroSignalCopy" name="heroSignalCopy" class="form-textarea form-textarea-sm" maxlength="300">${escapeHtml(settings.heroSignalCopy)}</textarea>
						</div>
						<div class="form-group">
							<label for="heroSignalImagePath">右侧卡片图片路径（可选）</label>
							<input
								id="heroSignalImagePath"
								name="heroSignalImagePath"
								class="form-input appearance-key-input"
								value="${escapeAttribute(settings.heroSignalImagePath ?? "")}"
								maxlength="320"
								placeholder="/media/appearance/home/hero-signal.webp"
								data-signal-image-path-input="true"
							/>
							<div
								class="appearance-hero-uploader"
								data-signal-image-uploader="true"
								data-upload-url="/api/admin/media/upload-async"
								data-csrf-token="${escapeAttribute(csrfToken)}"
							>
								<input
									type="file"
									accept="${escapeAttribute(getAllowedMediaAcceptValue())}"
									class="appearance-upload-input"
									data-signal-image-file-input="true"
								/>
								<div
									class="appearance-upload-dropzone appearance-hero-dropzone"
									data-signal-image-dropzone="true"
									role="button"
									tabindex="0"
									aria-label="拖拽文件或点击上传右侧卡片图片"
								>
									${
										settings.heroSignalImagePath
											? `<img src="${escapeAttribute(settings.heroSignalImagePath)}" alt="右侧卡片图片预览" class="cover-preview-image" data-signal-image-preview="true" />`
											: `<div class="cover-empty" data-signal-image-empty="true">拖拽图片或点击上传右侧卡片图片</div>`
									}
								</div>
								<div class="appearance-background-actions">
									<button type="button" class="btn btn-sm" data-signal-image-select="true">上传卡片图片</button>
									<button type="button" class="btn btn-sm btn-danger" data-signal-image-clear="true">清空卡片图片</button>
								</div>
								<p class="form-help" data-signal-image-status></p>
							</div>
						</div>
						<div class="appearance-chip-grid">
							<div class="form-group form-group-tight">
								<label for="heroSignalChip1">卡片标签 1</label>
								<input
									id="heroSignalChip1"
									name="heroSignalChip1"
									class="form-input"
									value="${escapeAttribute(settings.heroSignalChip1)}"
									maxlength="24"
								/>
							</div>
							<div class="form-group form-group-tight">
								<label for="heroSignalChip2">卡片标签 2</label>
								<input
									id="heroSignalChip2"
									name="heroSignalChip2"
									class="form-input"
									value="${escapeAttribute(settings.heroSignalChip2)}"
									maxlength="24"
								/>
							</div>
							<div class="form-group form-group-tight">
								<label for="heroSignalChip3">卡片标签 3</label>
								<input
									id="heroSignalChip3"
									name="heroSignalChip3"
									class="form-input"
									value="${escapeAttribute(settings.heroSignalChip3)}"
									maxlength="24"
								/>
							</div>
						</div>
					</section>

					<section class="appearance-panel" data-appearance-section="sidebar">
						<h2>文章页左侧作者栏</h2>
						<p class="appearance-note">用于文章阅读页左侧个人画廊名片，以及新建文章时的默认作者名。</p>
						<div class="form-group">
							<label for="articleSidebarAvatarPath">头像路径（可选）</label>
							<input
								id="articleSidebarAvatarPath"
								name="articleSidebarAvatarPath"
								class="form-input appearance-key-input"
								value="${escapeAttribute(settings.articleSidebarAvatarPath ?? "")}"
								maxlength="320"
								placeholder="/media/appearance/profile/avatar.webp"
							/>
							<div
								class="appearance-hero-uploader"
								data-avatar-image-uploader="true"
								data-upload-url="/api/admin/media/upload-async"
								data-csrf-token="${escapeAttribute(csrfToken)}"
							>
								<input
									type="file"
									accept="${escapeAttribute(getAllowedMediaAcceptValue())}"
									class="appearance-upload-input"
									data-avatar-image-file-input="true"
								/>
								<div
									class="appearance-upload-dropzone appearance-hero-dropzone"
									data-avatar-image-dropzone="true"
									role="button"
									tabindex="0"
									aria-label="拖拽或点击上传侧栏头像"
								>
									${
										settings.articleSidebarAvatarPath
											? `<img src="${escapeAttribute(settings.articleSidebarAvatarPath)}" alt="侧栏头像预览" class="cover-preview-image" />`
											: `<div class="cover-empty">拖拽图片或点击上传侧栏头像</div>`
									}
								</div>
								<div class="appearance-background-actions">
									<button type="button" class="btn btn-sm" data-avatar-image-select="true">上传侧栏头像</button>
									<button type="button" class="btn btn-sm btn-danger" data-avatar-image-clear="true">清空头像路径</button>
								</div>
								<p class="form-help" data-avatar-image-status></p>
							</div>
						</div>
						<div class="appearance-inline-grid">
							<div class="form-group">
								<label for="articleSidebarName">侧栏名称</label>
								<input
									id="articleSidebarName"
									name="articleSidebarName"
									class="form-input"
									value="${escapeAttribute(settings.articleSidebarName)}"
									maxlength="36"
								/>
							</div>
							<div class="form-group">
								<label for="articleSidebarBadge">侧栏徽标文案</label>
								<input
									id="articleSidebarBadge"
									name="articleSidebarBadge"
									class="form-input"
									value="${escapeAttribute(settings.articleSidebarBadge)}"
									maxlength="24"
								/>
							</div>
						</div>
						<div class="form-group form-group-tight">
							<label for="articleSidebarBio">侧栏简介</label>
							<textarea id="articleSidebarBio" name="articleSidebarBio" class="form-textarea form-textarea-sm" maxlength="320" rows="3">${escapeHtml(settings.articleSidebarBio)}</textarea>
						</div>
					</section>

					<section class="appearance-panel" data-appearance-section="integrations">
						<h2>AI 模型接口与 MCP 端点</h2>
						<p class="appearance-note">支持任意 OpenAI 兼容接口；生产环境推荐使用 Cloudflare Secret 托管密钥。</p>
						<div class="appearance-content-fieldset">
							<h3>内部接口（编辑器自动摘要与 SEO）</h3>
							<div class="form-group">
								<label class="checkbox-row-label">
									<input
										type="checkbox"
										name="aiInternalEnabled"
										value="1"
										${aiSettings.internal.enabled ? "checked" : ""}
									/>
									启用内部 AI 自动生成
								</label>
							</div>
							<div class="appearance-inline-grid">
								<div class="form-group">
									<label for="aiInternalBaseUrl">接口基地址</label>
									<input
										id="aiInternalBaseUrl"
										name="aiInternalBaseUrl"
										class="form-input"
										value="${escapeAttribute(aiSettings.internal.baseUrl)}"
										maxlength="240"
										placeholder="https://api.openai.com/v1"
									/>
								</div>
								<div class="form-group">
									<label for="aiInternalModel">模型名称</label>
									<input
										id="aiInternalModel"
										name="aiInternalModel"
										class="form-input"
										value="${escapeAttribute(aiSettings.internal.model)}"
										maxlength="120"
										placeholder="gpt-4o-mini"
									/>
								</div>
							</div>
							<div class="form-group form-group-tight">
								<label for="aiInternalApiKey">API Key</label>
								<input
									id="aiInternalApiKey"
									name="aiInternalApiKey"
									type="password"
									class="form-input"
									maxlength="400"
									autocomplete="off"
									placeholder="${escapeAttribute(internalApiPlaceholder)}"
									${internalApiDisabled}
								/>
								<p class="form-help">${escapeHtml(internalApiKeyHelp)}</p>
							</div>
						</div>
						<div class="appearance-content-fieldset">
							<h3>公开接口（访客能力预留）</h3>
							<div class="form-group">
								<label class="checkbox-row-label">
									<input
										type="checkbox"
										name="aiPublicEnabled"
										value="1"
										${aiSettings.public.enabled ? "checked" : ""}
									/>
									启用公开 AI 接口
								</label>
							</div>
							<div class="appearance-inline-grid">
								<div class="form-group">
									<label for="aiPublicBaseUrl">接口基地址</label>
									<input
										id="aiPublicBaseUrl"
										name="aiPublicBaseUrl"
										class="form-input"
										value="${escapeAttribute(aiSettings.public.baseUrl)}"
										maxlength="240"
										placeholder="https://api.openai.com/v1"
									/>
								</div>
								<div class="form-group">
									<label for="aiPublicModel">模型名称</label>
									<input
										id="aiPublicModel"
										name="aiPublicModel"
										class="form-input"
										value="${escapeAttribute(aiSettings.public.model)}"
										maxlength="120"
										placeholder="gpt-4o-mini"
									/>
								</div>
							</div>
							<div class="form-group form-group-tight">
								<label for="aiPublicApiKey">API Key</label>
								<input
									id="aiPublicApiKey"
									name="aiPublicApiKey"
									type="password"
									class="form-input"
									maxlength="400"
									autocomplete="off"
									placeholder="${escapeAttribute(publicApiPlaceholder)}"
									${publicApiDisabled}
								/>
								<p class="form-help">${escapeHtml(publicApiKeyHelp)}</p>
							</div>
						</div>
						<div class="appearance-content-fieldset">
							<h3>MCP 远程写作端点</h3>
							<div class="form-group form-group-tight">
								<label class="checkbox-row-label">
									<input
										type="checkbox"
										name="mcpEnabled"
										value="1"
										${settings.mcpEnabled ? "checked" : ""}
									/>
									启用 MCP 接口（/api/mcp）
								</label>
								<p class="form-help">关闭后即使携带正确 Bearer，MCP 端点也会直接返回 404。</p>
							</div>
						</div>
					</section>
				</div>

				<aside class="appearance-preview-rail" aria-label="实时视觉预览">
					<div class="appearance-live-stage" data-appearance-live-stage>
						<div class="appearance-stage-bar">
							<span class="appearance-stage-dots" aria-hidden="true"><i></i><i></i><i></i></span>
							<span>实时材质与文案预览</span>
							<span>Live</span>
						</div>
						<div class="appearance-stage-viewport">
							<div class="appearance-stage-wallpaper" data-stage-wallpaper></div>
							<div class="appearance-stage-scrim"></div>
							<div class="appearance-stage-nav">
								<span class="appearance-stage-subtitle" data-stage-subtitle>${escapeHtml(settings.headerSubtitle)}</span>
								<span class="appearance-stage-links" data-stage-nav-links>${escapeHtml(
									settings.navLinks
										.slice(0, 3)
										.map((l) => l.label)
										.join(" · "),
								)}</span>
							</div>
							<div class="appearance-stage-deck">
								<div class="appearance-stage-card">
									<span class="appearance-stage-kicker" data-stage-kicker>${escapeHtml(settings.heroKicker)}</span>
									<strong class="appearance-stage-title" data-stage-title>${escapeHtml(settings.heroTitle)}</strong>
									<p class="appearance-stage-intro" data-stage-intro>${escapeHtml(settings.heroIntro)}</p>
								</div>
								<div class="appearance-stage-card">
									<span class="appearance-stage-kicker" data-stage-signal-label>${escapeHtml(settings.heroSignalLabel)}</span>
									<strong class="appearance-stage-title" data-stage-signal-heading>${escapeHtml(settings.heroSignalHeading)}</strong>
									<div class="appearance-stage-chips" data-stage-chips>
										<span>${escapeHtml(settings.heroSignalChip1)}</span>
										<span>${escapeHtml(settings.heroSignalChip2)}</span>
										<span>${escapeHtml(settings.heroSignalChip3)}</span>
									</div>
								</div>
							</div>
							<div class="appearance-stage-article">
								<div class="appearance-stage-avatar" data-stage-avatar>
									${
										settings.articleSidebarAvatarPath
											? `<img src="${escapeAttribute(settings.articleSidebarAvatarPath)}" alt="" />`
											: escapeHtml(
													Array.from(settings.articleSidebarName || "A")[0] ||
														"A",
												)
									}
								</div>
								<div style="min-width: 0; display: grid; gap: 0.1rem;">
									<span class="appearance-stage-kicker" data-stage-sidebar-badge>${escapeHtml(settings.articleSidebarBadge)}</span>
									<strong style="font-size: 0.82rem; color: #f8fafc;" data-stage-sidebar-name>${escapeHtml(settings.articleSidebarName)}</strong>
									<span style="font-size: 0.7rem; color: rgba(203, 213, 225, 0.8); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" data-stage-sidebar-bio>${escapeHtml(settings.articleSidebarBio)}</span>
								</div>
							</div>
						</div>
					</div>
					<div class="appearance-panel" style="margin-bottom: 0; padding: 0.95rem 1.05rem;">
						<div class="appearance-actions" style="justify-content: space-between;">
							<span class="form-help" style="margin: 0;">所有分区的更改会一并提交保存。</span>
							<button type="submit" class="btn btn-primary btn-sm">保存外观设置</button>
						</div>
					</div>
				</aside>
			</div>
		</form>
	`;
}

function renderAppearanceErrorPage(csrfToken: string, message: string) {
	return adminLayout(
		"站点外观",
		`<div class="alert alert-error">${escapeHtml(message)}</div><p><a href="/api/admin/appearance">返回外观页</a></p>`,
		{ csrfToken },
	);
}

function getAppearanceAlert(url: string) {
	const status = new URL(url).searchParams.get("status");
	switch (status) {
		case "saved":
			return { type: "success" as const, message: "外观设置已保存" };
		case "uploaded":
			return {
				type: "success" as const,
				message: "背景图已上传并设为当前背景",
			};
		case "cleared":
			return { type: "success" as const, message: "当前背景图引用已移除" };
		default:
			return undefined;
	}
}

appearance.use("*", requireAuth);

appearance.get("/", async (c) => {
	const session = getAuthenticatedSession(c);
	let settings = DEFAULT_SITE_APPEARANCE;
	let aiSettings = DEFAULT_AI_SETTINGS;

	try {
		settings = await getSiteAppearance(getDb(c.env.DB));
	} catch {
		// D1 未绑定时回退默认外观
	}
	try {
		aiSettings = await getAiSettings(getDb(c.env.DB));
	} catch {
		// D1 未绑定时回退默认 AI 配置
	}
	const resolvedAi = resolveAiSettingsWithSecrets(aiSettings, c.env);

	return c.html(
		adminLayout(
			"站点外观",
			renderAppearancePage({
				csrfToken: session.csrfToken,
				settings,
				aiSettings: resolvedAi.settings,
				aiKeySource: resolvedAi.keySource,
				aiWebKeyStatus: {
					internalHasSavedKey: Boolean(aiSettings.internal.apiKey.trim()),
					publicHasSavedKey: Boolean(aiSettings.public.apiKey.trim()),
				},
				alert: getAppearanceAlert(c.req.url),
			}),
			{ csrfToken: session.csrfToken },
		),
	);
});

appearance.post("/", async (c) => {
	const session = getAuthenticatedSession(c);
	const body = (await c.req.parseBody({ all: true })) as AppearanceFormBody;
	if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
		return c.text("CSRF 校验失败", 403);
	}

	const backgroundImageKey = getBodyText(body, "backgroundImageKey").trim();
	if (backgroundImageKey && !sanitizeMediaKey(backgroundImageKey)) {
		return c.html(
			renderAppearanceErrorPage(session.csrfToken, "背景图键名格式不合法"),
			400,
		);
	}

	const backgroundTransparency = parseBodyNumber(
		body,
		"backgroundTransparency",
		"backgroundOpacity",
	);
	const unifiedCardTransparency = parseBodyNumber(
		body,
		"heroCardTransparency",
		"heroCardOpacity",
	);
	const unifiedCardBlur = parseBodyNumber(body, "heroCardBlur");
	const articlePanelTransparency = parseBodyNumber(
		body,
		"articlePanelTransparency",
		"articlePanelOpacity",
	);
	const articlePanelBlur = parseBodyNumber(body, "articlePanelBlur");
	const db = getDb(c.env.DB);
	const storedAiSettings = await getAiSettings(db).catch(
		() => DEFAULT_AI_SETTINGS,
	);
	const internalInputApiKey = getBodyText(body, "aiInternalApiKey").trim();
	const publicInputApiKey = getBodyText(body, "aiPublicApiKey").trim();
	const useInternalSecret = Boolean(c.env.AI_INTERNAL_API_KEY?.trim());
	const usePublicSecret = Boolean(c.env.AI_PUBLIC_API_KEY?.trim());
	const nextInternalApiKey = useInternalSecret
		? storedAiSettings.internal.apiKey
		: internalInputApiKey || storedAiSettings.internal.apiKey;
	const nextPublicApiKey = usePublicSecret
		? storedAiSettings.public.apiKey
		: publicInputApiKey || storedAiSettings.public.apiKey;

	await saveSiteAppearance(db, {
		backgroundImageKey: backgroundImageKey || null,
		backgroundOpacity: convertTransparencyToOpacity(backgroundTransparency),
		backgroundBlur: parseBodyNumber(body, "backgroundBlur"),
		backgroundScale: 100 + parseBodyNumber(body, "backgroundScale"),
		backgroundPositionX: 50 + parseBodyNumber(body, "backgroundPositionX"),
		backgroundPositionY: 50 + parseBodyNumber(body, "backgroundPositionY"),
		heroCardOpacity: convertTransparencyToOpacity(unifiedCardTransparency),
		heroCardBlur: unifiedCardBlur,
		postCardOpacity: convertTransparencyToOpacity(unifiedCardTransparency),
		postCardBlur: unifiedCardBlur,
		articlePanelOpacity: convertTransparencyToOpacity(articlePanelTransparency),
		articlePanelBlur,
		headerSubtitle: getBodyText(body, "headerSubtitle"),
		navLinks: buildLinkItemsFromBody(
			getBodyTexts(body, "navLinkLabel"),
			getBodyTexts(body, "navLinkHref"),
		),
		heroKicker: getBodyText(body, "heroKicker"),
		heroTitle: getBodyText(body, "heroTitle"),
		heroIntro: getBodyText(body, "heroIntro"),
		heroMainImagePath: getBodyText(body, "heroMainImagePath"),
		heroActions: buildLinkItemsFromBody(
			getBodyTexts(body, "heroActionLabel"),
			getBodyTexts(body, "heroActionHref"),
		),
		heroSignalLabel: getBodyText(body, "heroSignalLabel"),
		heroSignalHeading: getBodyText(body, "heroSignalHeading"),
		heroSignalCopy: getBodyText(body, "heroSignalCopy"),
		heroSignalImagePath: getBodyText(body, "heroSignalImagePath"),
		heroSignalChip1: getBodyText(body, "heroSignalChip1"),
		heroSignalChip2: getBodyText(body, "heroSignalChip2"),
		heroSignalChip3: getBodyText(body, "heroSignalChip3"),
		articleSidebarAvatarPath: getBodyText(body, "articleSidebarAvatarPath"),
		articleSidebarName: getBodyText(body, "articleSidebarName"),
		articleSidebarBadge: getBodyText(body, "articleSidebarBadge"),
		articleSidebarBio: getBodyText(body, "articleSidebarBio"),
		mcpEnabled: getBodyText(body, "mcpEnabled"),
	});
	await saveAiSettings(db, {
		aiInternalEnabled: getBodyText(body, "aiInternalEnabled"),
		aiInternalBaseUrl: getBodyText(body, "aiInternalBaseUrl"),
		aiInternalApiKey: nextInternalApiKey,
		aiInternalModel: getBodyText(body, "aiInternalModel"),
		aiPublicEnabled: getBodyText(body, "aiPublicEnabled"),
		aiPublicBaseUrl: getBodyText(body, "aiPublicBaseUrl"),
		aiPublicApiKey: nextPublicApiKey,
		aiPublicModel: getBodyText(body, "aiPublicModel"),
	});
	// 外观更新后立即失效进程内缓存，使下一次请求读取最新配置
	invalidateSiteAppearanceCache();

	return c.redirect("/api/admin/appearance?status=saved");
});

appearance.post("/background/upload", async (c) => {
	const session = getAuthenticatedSession(c);
	const body = (await c.req.parseBody({ all: true })) as AppearanceFormBody;
	if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
		return c.text("CSRF 校验失败", 403);
	}

	const file = getBodyFile(body, "file");
	if (!(file instanceof File)) {
		return c.html(
			renderAppearanceErrorPage(session.csrfToken, "请选择要上传的背景图片"),
			400,
		);
	}

	if (!isAllowedImageMimeType(file.type)) {
		return c.html(
			renderAppearanceErrorPage(
				session.csrfToken,
				"背景图仅允许 JPG、PNG、WEBP、AVIF 或 GIF 图片",
			),
			400,
		);
	}

	if (file.size > MAX_UPLOAD_BYTES) {
		return c.html(
			renderAppearanceErrorPage(
				session.csrfToken,
				"背景图单个文件不能超过 50 MB ",
			),
			400,
		);
	}

	const uploaded = await saveMediaObjectWithDedup({
		bucket: c.env.MEDIA_BUCKET,
		file,
		prefix: "appearance/background",
	});

	const currentSettings = await getSiteAppearance(getDb(c.env.DB)).catch(
		() => DEFAULT_SITE_APPEARANCE,
	);
	await saveSiteAppearance(getDb(c.env.DB), {
		...currentSettings,
		backgroundImageKey: uploaded.key,
	});
	invalidateSiteAppearanceCache();

	return c.redirect("/api/admin/appearance?status=uploaded");
});

appearance.post("/background/clear", async (c) => {
	const session = getAuthenticatedSession(c);
	const body = (await c.req.parseBody({ all: true })) as AppearanceFormBody;
	if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
		return c.text("CSRF 校验失败", 403);
	}

	const currentSettings = await getSiteAppearance(getDb(c.env.DB)).catch(
		() => DEFAULT_SITE_APPEARANCE,
	);
	await saveSiteAppearance(getDb(c.env.DB), {
		...currentSettings,
		backgroundImageKey: null,
	});
	invalidateSiteAppearanceCache();

	return c.redirect("/api/admin/appearance?status=cleared");
});

export { appearance as appearanceRoutes };
