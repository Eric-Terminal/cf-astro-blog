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
	buildBackgroundImageUrl,
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
	const backgroundImageUrl = buildBackgroundImageUrl(
		settings.backgroundImageKey,
	);
	const focusHidden = backgroundImageUrl ? "" : " hidden";
	const previewImage = backgroundImageUrl
		? `<img src="${escapeAttribute(backgroundImageUrl)}" alt="" class="appearance-stage-image" data-appearance-image />`
		: `<div class="appearance-stage-empty" data-appearance-empty>上传背景图片后，这里会出现实时预览，点击或拖动即可调整裁切焦点。</div>`;
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

			.appearance-stage {
				position: relative;
				min-height: 360px;
				border-radius: 1rem;
				overflow: hidden;
				background:
					radial-gradient(circle at top left, rgba(59, 130, 246, 0.2), transparent 28%),
					linear-gradient(135deg, #0f172a, #111827 50%, #1e293b);
				border: 1px solid var(--border);
				cursor: crosshair;
				user-select: none;
			}

			.appearance-stage-image {
				position: absolute;
				inset: -10%;
				width: 120%;
				height: 120%;
				object-fit: cover;
				transform-origin: center center;
				opacity: 0.9;
				will-change: transform, filter, object-position;
			}

			.appearance-stage-overlay {
				position: absolute;
				inset: 0;
				background:
					linear-gradient(180deg, rgba(15, 23, 42, 0.1), rgba(15, 23, 42, 0.55)),
					radial-gradient(circle at center, transparent 24%, rgba(15, 23, 42, 0.22));
				pointer-events: none;
			}

			.appearance-stage-label {
				position: absolute;
				left: 1rem;
				bottom: 1rem;
				padding: 0.45rem 0.7rem;
				border-radius: 9999px;
				background: rgba(15, 23, 42, 0.55);
				backdrop-filter: blur(12px);
				font-size: 0.8rem;
				color: var(--text-secondary);
			}

			.appearance-stage-empty {
				position: absolute;
				inset: 0;
				display: flex;
				align-items: center;
				justify-content: center;
				padding: 2rem;
				text-align: center;
				color: var(--text-muted);
			}

			.appearance-focus {
				position: absolute;
				width: 18px;
				height: 18px;
				margin-left: -9px;
				margin-top: -9px;
				border-radius: 9999px;
				background: rgba(255, 255, 255, 0.88);
				border: 2px solid rgba(59, 130, 246, 0.9);
				box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.18);
				pointer-events: none;
			}

			.appearance-hint {
				margin-top: 0.75rem;
				font-size: 0.85rem;
				color: var(--text-muted);
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

				.appearance-stage {
					min-height: 280px;
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
		<form method="post" action="/api/admin/appearance" class="appearance-grid appearance-form-grid">
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
					<h2>实时预览</h2>
					<div
						class="appearance-stage"
						data-appearance-stage
						data-background-scale="${escapeAttribute(String(settings.backgroundScale))}"
						data-background-blur="${escapeAttribute(String(settings.backgroundBlur))}"
						data-background-position-x="${escapeAttribute(String(settings.backgroundPositionX))}"
						data-background-position-y="${escapeAttribute(String(settings.backgroundPositionY))}"
					>
						${previewImage}
						<div class="appearance-stage-overlay"></div>
						<div class="appearance-stage-label">前台背景层</div>
						<div class="appearance-focus" data-appearance-focus${focusHidden}></div>
					</div>
					<p class="appearance-hint">直接在预览图上点击或拖动，就能快速调整裁切焦点位置。</p>
				</section>
				<section class="appearance-panel">
					<h2>背景视觉参数</h2>
					<div class="appearance-controls">
						<div class="appearance-range">
							<div class="appearance-range-meta">
								<label for="backgroundScale">缩放</label>
								<span data-appearance-display="backgroundScale">${escapeHtml(String(settings.backgroundScale))}%</span>
							</div>
							<input id="backgroundScale" name="backgroundScale" type="range" min="100" max="180" value="${escapeAttribute(String(settings.backgroundScale))}" data-appearance-control="backgroundScale" />
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
								<span data-appearance-display="backgroundPositionX">${escapeHtml(String(settings.backgroundPositionX))}%</span>
							</div>
							<input id="backgroundPositionX" name="backgroundPositionX" type="range" min="0" max="100" value="${escapeAttribute(String(settings.backgroundPositionX))}" data-appearance-control="backgroundPositionX" />
						</div>
						<div class="appearance-range">
							<div class="appearance-range-meta">
								<label for="backgroundPositionY">纵向焦点</label>
								<span data-appearance-display="backgroundPositionY">${escapeHtml(String(settings.backgroundPositionY))}%</span>
							</div>
							<input id="backgroundPositionY" name="backgroundPositionY" type="range" min="0" max="100" value="${escapeAttribute(String(settings.backgroundPositionY))}" data-appearance-control="backgroundPositionY" />
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
			return { type: "success" as const, message: "外观设置已保存喵" };
		case "uploaded":
			return {
				type: "success" as const,
				message: "背景图已上传并设为当前背景喵",
			};
		case "cleared":
			return { type: "success" as const, message: "当前背景图引用已移除喵" };
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
		// D1 未绑定时回退默认外观喵
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
		return c.text("CSRF 校验失败喵", 403);
	}

	const backgroundImageKey = getBodyText(body, "backgroundImageKey").trim();
	if (backgroundImageKey && !sanitizeMediaKey(backgroundImageKey)) {
		return c.html(
			renderAppearanceErrorPage(session.csrfToken, "背景图键名格式不合法喵"),
			400,
		);
	}

	await saveSiteAppearance(getDb(c.env.DB), {
		backgroundImageKey: backgroundImageKey || null,
		backgroundBlur: Number(getBodyText(body, "backgroundBlur") || Number.NaN),
		backgroundScale: Number(getBodyText(body, "backgroundScale") || Number.NaN),
		backgroundPositionX: Number(
			getBodyText(body, "backgroundPositionX") || Number.NaN,
		),
		backgroundPositionY: Number(
			getBodyText(body, "backgroundPositionY") || Number.NaN,
		),
		headerSubtitle: getBodyText(body, "headerSubtitle"),
		navLinks: buildLinkItemsFromBody(
			getBodyTexts(body, "navLinkLabel"),
			getBodyTexts(body, "navLinkHref"),
		),
		heroKicker: getBodyText(body, "heroKicker"),
		heroTitle: getBodyText(body, "heroTitle"),
		heroIntro: getBodyText(body, "heroIntro"),
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
	const body = await c.req.parseBody();
	if (!assertCsrfToken(body._csrf, session)) {
		return c.text("CSRF 校验失败喵", 403);
	}

	const file = body.file;
	if (!(file instanceof File)) {
		return c.html(
			renderAppearanceErrorPage(session.csrfToken, "请选择要上传的背景图片喵"),
			400,
		);
	}

	if (!isAllowedImageMimeType(file.type)) {
		return c.html(
			renderAppearanceErrorPage(
				session.csrfToken,
				"背景图仅允许 JPG、PNG、WEBP、AVIF 或 GIF 图片喵",
			),
			400,
		);
	}

	if (file.size > MAX_UPLOAD_BYTES) {
		return c.html(
			renderAppearanceErrorPage(
				session.csrfToken,
				"背景图单个文件不能超过 5 MB 喵",
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
	const body = await c.req.parseBody();
	if (!assertCsrfToken(body._csrf, session)) {
		return c.text("CSRF 校验失败喵", 403);
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
