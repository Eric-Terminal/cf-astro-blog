import { Hono } from "hono";
import { getDb } from "@/lib/db";
import {
	buildMediaObjectKey,
	getAllowedMediaAcceptValue,
	isAllowedImageMimeType,
	MAX_UPLOAD_BYTES,
} from "@/lib/media";
import { escapeAttribute, escapeHtml, sanitizeMediaKey } from "@/lib/security";
import {
	DEFAULT_SITE_APPEARANCE,
	getSiteAppearance,
	type SiteNavLink,
	saveSiteAppearance,
} from "@/lib/site-appearance";
import {
	type AdminAppEnv,
	assertCsrfToken,
	getAuthenticatedSession,
	requireAuth,
} from "../middleware/auth";
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
			<button type="button" class="btn appearance-link-remove" data-link-remove>
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
	alert?: { type: "success" | "error"; message: string };
}) {
	const { csrfToken, settings, alert } = options;
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
	const alertHtml = alert
		? `<div class="alert alert-${escapeAttribute(alert.type)}">${escapeHtml(alert.message)}</div>`
		: "";

	return `
		<style>
			.appearance-grid {
				display: grid;
				grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
				gap: 1.5rem;
			}

			.appearance-form-grid {
				align-items: start;
				margin-bottom: 1.5rem;
			}

			.appearance-panel {
				background: var(--bg-secondary);
				border: 1px solid var(--border);
				border-radius: var(--radius);
				padding: 1.25rem;
				margin-bottom: 1.5rem;
			}

			.appearance-panel h2 {
				margin-top: 0;
			}

			.appearance-copy {
				color: var(--text-muted);
				margin-top: -0.75rem;
				margin-bottom: 1rem;
			}

			.appearance-stack {
				display: grid;
				gap: 1rem;
			}

			.appearance-upload-dropzone {
				position: relative;
				width: 100%;
				aspect-ratio: 5 / 2;
				border: 1px dashed rgba(10, 132, 255, 0.34);
				border-radius: 0.95rem;
				background:
					linear-gradient(140deg, rgba(10, 132, 255, 0.08), rgba(10, 132, 255, 0.02)),
					rgba(255, 255, 255, 0.02);
				display: grid;
				place-items: center;
				padding: 1rem;
				text-align: center;
				cursor: pointer;
				transition:
					border-color var(--transition),
					background-color var(--transition),
					transform var(--transition);
			}

			.appearance-upload-dropzone:hover,
			.appearance-upload-dropzone.is-dragover {
				border-color: rgba(10, 132, 255, 0.65);
				background:
					linear-gradient(140deg, rgba(10, 132, 255, 0.16), rgba(10, 132, 255, 0.06)),
					rgba(255, 255, 255, 0.03);
				transform: translateY(-1px);
			}

			.appearance-upload-dropzone:focus-visible {
				outline: 2px solid rgba(10, 132, 255, 0.6);
				outline-offset: 2px;
			}

			.appearance-upload-copy {
				display: grid;
				gap: 0.4rem;
				color: var(--text-secondary);
			}

			.appearance-upload-copy strong {
				font-size: 1rem;
				color: var(--text-primary);
			}

			.appearance-upload-copy span {
				font-size: 0.86rem;
			}

			.appearance-upload-input {
				display: none;
			}

			.appearance-background-actions {
				display: flex;
				flex-wrap: wrap;
				gap: 0.75rem;
				margin-top: 0.85rem;
			}

			.appearance-controls {
				display: grid;
				gap: 1rem;
			}

			.appearance-inline-grid {
				display: grid;
				grid-template-columns: repeat(2, minmax(0, 1fr));
				gap: 0.85rem;
			}

			.appearance-list-head {
				display: flex;
				justify-content: space-between;
				align-items: center;
				flex-wrap: wrap;
				gap: 0.75rem;
				margin-bottom: 0.8rem;
			}

			.appearance-list-head h3,
			.appearance-list-head h4 {
				margin: 0;
			}

			.appearance-note {
				margin: 0 0 0.8rem;
				color: var(--text-muted);
				font-size: 0.85rem;
			}

			.appearance-link-list {
				display: grid;
				gap: 0.75rem;
			}

			.appearance-link-row {
				display: grid;
				grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
				gap: 0.75rem;
				align-items: end;
				padding: 0.8rem;
				border: 1px solid var(--border);
				border-radius: 0.8rem;
				background: rgba(255, 255, 255, 0.02);
			}

			.appearance-link-field {
				display: grid;
				gap: 0.4rem;
			}

			.appearance-link-field label {
				font-size: 0.82rem;
				color: var(--text-secondary);
			}

			.appearance-link-remove {
				align-self: center;
			}

			.appearance-content-fieldset {
				margin-top: 1.25rem;
				border-top: 1px solid var(--border);
				padding-top: 1.25rem;
			}

			.appearance-content-fieldset h3 {
				margin-bottom: 0.8rem;
			}

			.appearance-range {
				display: grid;
				gap: 0.5rem;
			}

			.appearance-range-meta {
				display: flex;
				justify-content: space-between;
				align-items: center;
				color: var(--text-secondary);
				font-size: 0.85rem;
			}

			.appearance-range input[type="range"] {
				width: 100%;
			}

			.appearance-actions {
				display: flex;
				flex-wrap: wrap;
				gap: 0.75rem;
				margin-top: 1.5rem;
			}

			.appearance-key-input {
				font-family: var(--font-mono);
				font-size: 0.82rem;
			}

			.appearance-panel .form-textarea {
				min-height: 120px;
			}

			@media (max-width: 980px) {
				.appearance-grid {
					grid-template-columns: 1fr;
				}

				.appearance-inline-grid {
					grid-template-columns: 1fr;
				}

				.appearance-link-row {
					grid-template-columns: 1fr;
				}

				.appearance-link-remove {
					justify-self: start;
				}
			}

		</style>
		${alertHtml}
		<h1>站点外观</h1>
		<p class="appearance-copy">这里统一控制前台背景、顶部状态栏、导航索引链接和首页首屏文案。</p>
		<form method="post" action="/api/admin/appearance" class="appearance-grid appearance-form-grid" data-appearance-form="true">
			<input type="hidden" name="_csrf" value="${escapeAttribute(csrfToken)}" />
			<div class="appearance-stack">
				<section class="appearance-panel">
					<h2>背景图管理</h2>
					<div class="appearance-stack">
						<div
							class="appearance-upload-dropzone"
							data-appearance-upload-dropzone
							role="button"
							tabindex="0"
							aria-label="拖拽文件或点击上传背景图"
						>
							<div class="appearance-upload-copy">
								<strong>拖拽图片到这里</strong>
								<span>或点击选择文件，自动上传并设为当前背景</span>
							</div>
						</div>
						<input
							type="file"
							name="file"
							accept="${escapeAttribute(getAllowedMediaAcceptValue())}"
							class="appearance-upload-input"
							data-appearance-upload-input
						/>
					</div>
					<div class="form-group">
						<label for="backgroundImageKey">背景图键名</label>
						<input
							id="backgroundImageKey"
							name="backgroundImageKey"
							class="form-input appearance-key-input"
							value="${escapeAttribute(settings.backgroundImageKey ?? "")}"
							placeholder="appearance/background/2026-03-07/xxxx.webp"
						/>
					</div>
					<p class="appearance-copy">上传和移除只影响“当前引用”，不会删除媒体库里的原始文件。</p>
					${
						settings.backgroundImageKey
							? `<div class="appearance-background-actions">
									<button
										type="submit"
										class="btn"
										formaction="/api/admin/appearance/background/clear"
										formmethod="post"
										data-confirm-message="${escapeAttribute("确认移除当前背景图引用吗？")}"
										formnovalidate
									>
										移除当前引用
									</button>
								</div>`
							: ""
					}
				</section>
				<section class="appearance-panel">
					<div class="appearance-list-head">
						<h2>顶部状态栏与导航索引</h2>
						<button type="button" class="btn" data-link-add="nav">+ 新增导航</button>
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
					<p class="appearance-note">导航支持无限新增，前台会自动换行适配。</p>
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
				<section class="appearance-panel">
					<h2>首页首屏文案</h2>
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
					<div class="form-group">
						<label for="heroIntro">简介</label>
						<textarea id="heroIntro" name="heroIntro" class="form-textarea" maxlength="600">${escapeHtml(settings.heroIntro)}</textarea>
					</div>
					<div class="form-group">
						<label for="heroMainImagePath">首屏图片预留位路径</label>
						<input
							id="heroMainImagePath"
							name="heroMainImagePath"
							class="form-input appearance-key-input"
							value="${escapeAttribute(settings.heroMainImagePath ?? "")}"
							maxlength="320"
							placeholder="/media/appearance/home/hero-main.webp"
						/>
					</div>
					<p class="appearance-note">支持 /media/...、站内绝对路径或 https:// 外链。</p>
					<div class="appearance-list-head">
						<h4>首页按钮</h4>
						<button type="button" class="btn" data-link-add="hero">+ 新增按钮</button>
					</div>
					<p class="appearance-note">第一个按钮使用主样式，其余按钮会自动使用次级样式。</p>
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
			</div>
			<div class="appearance-stack">
				<section class="appearance-panel">
					<h2>背景与卡片视觉参数</h2>
					<p class="appearance-note">缩放 0% 表示原始比例；横向/纵向焦点 0% 表示画面居中。</p>
					<div class="appearance-controls">
						<div class="appearance-range">
							<div class="appearance-range-meta">
								<label for="backgroundScale">缩放</label>
								<span data-appearance-display="backgroundScale">${escapeHtml(String(backgroundScaleOffset))}%</span>
							</div>
							<input id="backgroundScale" name="backgroundScale" type="range" min="0" max="80" value="${escapeAttribute(String(backgroundScaleOffset))}" data-appearance-control="backgroundScale" />
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
								<label for="backgroundPositionX">横向焦点</label>
								<span data-appearance-display="backgroundPositionX">${escapeHtml(String(backgroundPositionXOffset))}%</span>
							</div>
							<input id="backgroundPositionX" name="backgroundPositionX" type="range" min="-50" max="50" value="${escapeAttribute(String(backgroundPositionXOffset))}" data-appearance-control="backgroundPositionX" />
						</div>
						<div class="appearance-range">
							<div class="appearance-range-meta">
								<label for="backgroundPositionY">纵向焦点</label>
								<span data-appearance-display="backgroundPositionY">${escapeHtml(String(backgroundPositionYOffset))}%</span>
							</div>
							<input id="backgroundPositionY" name="backgroundPositionY" type="range" min="-50" max="50" value="${escapeAttribute(String(backgroundPositionYOffset))}" data-appearance-control="backgroundPositionY" />
						</div>
						<div class="appearance-range">
							<div class="appearance-range-meta">
								<label for="heroCardOpacity">顶部介绍卡透明度</label>
								<span data-appearance-display="heroCardOpacity">${escapeHtml(String(settings.heroCardOpacity))}%</span>
							</div>
							<input id="heroCardOpacity" name="heroCardOpacity" type="range" min="4" max="40" value="${escapeAttribute(String(settings.heroCardOpacity))}" data-appearance-control="heroCardOpacity" />
						</div>
						<div class="appearance-range">
							<div class="appearance-range-meta">
								<label for="heroCardBlur">顶部介绍卡高斯模糊</label>
								<span data-appearance-display="heroCardBlur">${escapeHtml(String(settings.heroCardBlur))} px</span>
							</div>
							<input id="heroCardBlur" name="heroCardBlur" type="range" min="0" max="48" value="${escapeAttribute(String(settings.heroCardBlur))}" data-appearance-control="heroCardBlur" />
						</div>
						<div class="appearance-range">
							<div class="appearance-range-meta">
								<label for="postCardOpacity">文章卡透明度</label>
								<span data-appearance-display="postCardOpacity">${escapeHtml(String(settings.postCardOpacity))}%</span>
							</div>
							<input id="postCardOpacity" name="postCardOpacity" type="range" min="4" max="40" value="${escapeAttribute(String(settings.postCardOpacity))}" data-appearance-control="postCardOpacity" />
						</div>
						<div class="appearance-range">
							<div class="appearance-range-meta">
								<label for="postCardBlur">文章卡高斯模糊</label>
								<span data-appearance-display="postCardBlur">${escapeHtml(String(settings.postCardBlur))} px</span>
							</div>
							<input id="postCardBlur" name="postCardBlur" type="range" min="0" max="48" value="${escapeAttribute(String(settings.postCardBlur))}" data-appearance-control="postCardBlur" />
						</div>
					</div>
				</section>
				<section class="appearance-panel">
					<h2>右侧信息卡文案</h2>
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
					<div class="form-group">
						<label for="heroSignalCopy">右侧卡片描述</label>
						<textarea id="heroSignalCopy" name="heroSignalCopy" class="form-textarea" maxlength="300">${escapeHtml(settings.heroSignalCopy)}</textarea>
					</div>
					<div class="appearance-inline-grid">
						<div class="form-group">
							<label for="heroTopicText">关注主题</label>
							<input
								id="heroTopicText"
								name="heroTopicText"
								class="form-input"
								value="${escapeAttribute(settings.heroTopicText)}"
								maxlength="120"
							/>
						</div>
						<div class="form-group">
							<label for="heroWritingText">写作方式</label>
							<input
								id="heroWritingText"
								name="heroWritingText"
								class="form-input"
								value="${escapeAttribute(settings.heroWritingText)}"
								maxlength="120"
							/>
						</div>
					</div>
				</section>
				<section class="appearance-panel">
					<div class="appearance-actions">
						<button type="submit" class="btn btn-primary">保存外观设置</button>
						<a href="/api/admin/media" class="btn">打开媒体库</a>
					</div>
				</section>
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

	try {
		settings = await getSiteAppearance(getDb(c.env.DB));
	} catch {
		// D1 未绑定时回退默认外观
	}

	return c.html(
		adminLayout(
			"站点外观",
			renderAppearancePage({
				csrfToken: session.csrfToken,
				settings,
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

	await saveSiteAppearance(getDb(c.env.DB), {
		backgroundImageKey: backgroundImageKey || null,
		backgroundBlur: Number(getBodyText(body, "backgroundBlur") || Number.NaN),
		backgroundScale:
			100 + Number(getBodyText(body, "backgroundScale") || Number.NaN),
		backgroundPositionX:
			50 + Number(getBodyText(body, "backgroundPositionX") || Number.NaN),
		backgroundPositionY:
			50 + Number(getBodyText(body, "backgroundPositionY") || Number.NaN),
		heroCardOpacity: Number(getBodyText(body, "heroCardOpacity") || Number.NaN),
		heroCardBlur: Number(getBodyText(body, "heroCardBlur") || Number.NaN),
		postCardOpacity: Number(getBodyText(body, "postCardOpacity") || Number.NaN),
		postCardBlur: Number(getBodyText(body, "postCardBlur") || Number.NaN),
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
		heroTopicText: getBodyText(body, "heroTopicText"),
		heroWritingText: getBodyText(body, "heroWritingText"),
	});

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
				"背景图单个文件不能超过 5 MB ",
			),
			400,
		);
	}

	const key = buildMediaObjectKey(file, "appearance/background");
	await c.env.MEDIA_BUCKET.put(key, await file.arrayBuffer(), {
		httpMetadata: { contentType: file.type },
	});

	const currentSettings = await getSiteAppearance(getDb(c.env.DB)).catch(
		() => DEFAULT_SITE_APPEARANCE,
	);
	await saveSiteAppearance(getDb(c.env.DB), {
		...currentSettings,
		backgroundImageKey: key,
	});

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

	return c.redirect("/api/admin/appearance?status=cleared");
});

export { appearance as appearanceRoutes };
