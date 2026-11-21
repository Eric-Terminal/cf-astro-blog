import { escapeAttribute, escapeHtml } from "@/lib/security";

interface LoginPageOptions {
	error?: string;
	oauthEnabled?: boolean;
	backgroundImageUrl?: string | null;
}

export function loginPage(options: LoginPageOptions = {}): string {
	const { error, oauthEnabled = false, backgroundImageUrl } = options;
	const hasBackgroundImage = Boolean(backgroundImageUrl);
	const escapedBackgroundImageUrl = backgroundImageUrl
		? escapeAttribute(backgroundImageUrl)
		: "";

	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>登录 · Eric-Terminal 的博客</title>
	<meta name="robots" content="noindex, nofollow" />
	<script src="/theme.js"></script>
	<style>
		:root {
			--color-bg: #f6f7f9;
			--color-bg-tertiary: rgba(15, 23, 42, 0.045);
			--color-text: #0f1419;
			--color-text-secondary: #3b4454;
			--color-text-muted: #687385;
			--color-border: rgba(15, 23, 42, 0.085);
			--color-border-strong: rgba(15, 23, 42, 0.14);
			--color-accent: #0066dc;
			--color-accent-hover: #0052b4;
			--color-accent-rgb: 0, 102, 220;
			--color-accent-soft: rgba(0, 102, 220, 0.09);
			--card-surface-rgb: 255, 255, 255;
			--glass-border: rgba(15, 23, 42, 0.085);
			--glass-highlight: rgba(255, 255, 255, 0.72);
			--shadow-card:
				0 1px 2px rgba(9, 14, 24, 0.04),
				0 18px 42px -22px rgba(9, 14, 24, 0.14);
			--radius-panel: 20px;
			--radius-inner: 12px;
			--radius-pill: 999px;
			--transition: 200ms cubic-bezier(0.22, 1, 0.36, 1);
			--font-sans:
				"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont,
				"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", sans-serif;
			--font-mono:
				"SF Mono", "JetBrains Mono", ui-monospace, "Cascadia Code", "Menlo",
				"Consolas", monospace;
		}

		[data-theme="dark"] {
			--color-bg: #090c10;
			--color-bg-tertiary: rgba(255, 255, 255, 0.055);
			--color-text: #f0f4f8;
			--color-text-secondary: #a8b3c4;
			--color-text-muted: #6e7b8f;
			--color-border: rgba(255, 255, 255, 0.085);
			--color-border-strong: rgba(255, 255, 255, 0.15);
			--color-accent: #4da3ff;
			--color-accent-hover: #7cc0ff;
			--color-accent-rgb: 77, 163, 255;
			--color-accent-soft: rgba(77, 163, 255, 0.13);
			--card-surface-rgb: 18, 23, 31;
			--glass-border: rgba(255, 255, 255, 0.09);
			--glass-highlight: rgba(255, 255, 255, 0.09);
			--shadow-card:
				0 2px 6px rgba(0, 0, 0, 0.35),
				0 24px 52px -22px rgba(0, 0, 0, 0.65);
		}

		@media (prefers-color-scheme: dark) {
			:root:not([data-theme="light"]) {
				--color-bg: #090c10;
				--color-bg-tertiary: rgba(255, 255, 255, 0.055);
				--color-text: #f0f4f8;
				--color-text-secondary: #a8b3c4;
				--color-text-muted: #6e7b8f;
				--color-border: rgba(255, 255, 255, 0.085);
				--color-border-strong: rgba(255, 255, 255, 0.15);
				--color-accent: #4da3ff;
				--color-accent-hover: #7cc0ff;
				--color-accent-rgb: 77, 163, 255;
				--color-accent-soft: rgba(77, 163, 255, 0.13);
				--card-surface-rgb: 18, 23, 31;
				--glass-border: rgba(255, 255, 255, 0.09);
				--glass-highlight: rgba(255, 255, 255, 0.09);
				--shadow-card:
					0 2px 6px rgba(0, 0, 0, 0.35),
					0 24px 52px -22px rgba(0, 0, 0, 0.65);
			}
		}

		*,
		*::before,
		*::after {
			box-sizing: border-box;
		}

		html {
			background-color: var(--color-bg);
			-webkit-font-smoothing: antialiased;
			-moz-osx-font-smoothing: grayscale;
		}

		body {
			margin: 0;
			min-height: 100dvh;
			display: grid;
			place-items: center;
			padding: 1.5rem 1rem;
			font-family: var(--font-sans);
			color: var(--color-text);
			background:
				radial-gradient(
					ellipse 80% 42% at 50% -10%,
					rgba(var(--color-accent-rgb), 0.06),
					transparent 70%
				),
				var(--color-bg);
			position: relative;
			overflow-x: hidden;
		}

		body.has-bg-image {
			background: transparent;
		}

		.bg-image-layer {
			position: fixed;
			inset: 0;
			z-index: -2;
			overflow: hidden;
			background-color: var(--color-bg);
		}

		.bg-image-layer::after {
			content: "";
			position: absolute;
			inset: 0;
			background: rgba(246, 247, 249, 0.24);
			transition: background-color var(--transition);
		}

		[data-theme="dark"] .bg-image-layer::after {
			background: rgba(7, 10, 15, 0.58);
		}

		@media (prefers-color-scheme: dark) {
			:root:not([data-theme="light"]) .bg-image-layer::after {
				background: rgba(7, 10, 15, 0.58);
			}
		}

		.bg-image-layer img {
			position: absolute;
			inset: 0;
			width: 100%;
			height: 100%;
			object-fit: cover;
			object-position: center;
			filter: blur(20px) saturate(1.08);
			transform: scale(1.08);
			opacity: 0.78;
		}

		.entry-shell {
			width: min(460px, calc(100vw - 1.5rem));
			display: grid;
			gap: 1.15rem;
		}

		.entry-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding-inline: 0.2rem;
		}

		.entry-brand {
			display: inline-flex;
			align-items: center;
			gap: 0.62rem;
			color: inherit;
			text-decoration: none;
			font-weight: 680;
			font-size: 0.92rem;
			letter-spacing: -0.015em;
			transition: color var(--transition);
		}

		.entry-brand:hover {
			color: var(--color-accent);
		}

		.entry-brand-mark {
			width: 2rem;
			height: 2rem;
			padding: 0.2rem;
			border-radius: 9px;
			background: var(--color-bg-tertiary);
			border: 1px solid var(--color-border);
			box-shadow: inset 0 1px 0 var(--glass-highlight);
			display: flex;
			align-items: center;
			justify-content: center;
		}

		.entry-brand-logo {
			width: 100%;
			height: 100%;
			object-fit: contain;
		}

		.theme-toggle {
			width: 2rem;
			height: 2rem;
			background: var(--color-bg-tertiary);
			border: 1px solid var(--color-border);
			border-radius: var(--radius-pill);
			padding: 0;
			cursor: pointer;
			color: var(--color-text-secondary);
			display: inline-flex;
			align-items: center;
			justify-content: center;
			box-shadow: inset 0 1px 0 var(--glass-highlight);
			transition:
				color var(--transition),
				border-color var(--transition),
				transform 120ms ease-out,
				background-color var(--transition);
		}

		.theme-toggle:hover {
			color: var(--color-text);
			border-color: var(--color-border-strong);
			background: var(--color-accent-soft);
		}

		.theme-toggle:active {
			transform: scale(0.92);
		}

		.icon-sun { display: none; }
		.icon-moon { display: block; }

		[data-theme="dark"] .icon-sun { display: block; }
		[data-theme="dark"] .icon-moon { display: none; }

		@media (prefers-color-scheme: dark) {
			:root:not([data-theme="light"]) .icon-sun { display: block; }
			:root:not([data-theme="light"]) .icon-moon { display: none; }
		}

		.entry-panel {
			position: relative;
			overflow: hidden;
			border: 1px solid var(--glass-border);
			border-radius: var(--radius-panel);
			box-shadow:
				inset 0 1px 0 var(--glass-highlight),
				var(--shadow-card);
		}

		.entry-panel::after {
			content: "";
			position: absolute;
			inset: 0;
			border-radius: inherit;
			background: rgba(var(--card-surface-rgb), 0.78);
			backdrop-filter: blur(28px) saturate(140%);
			-webkit-backdrop-filter: blur(28px) saturate(140%);
			pointer-events: none;
			z-index: 0;
		}

		.entry-content {
			position: relative;
			z-index: 2;
			display: grid;
			gap: 1.05rem;
			padding: clamp(1.5rem, 1.2rem + 1.4vw, 2.1rem);
		}

		.entry-eyebrow {
			display: inline-flex;
			align-items: center;
			gap: 0.45rem;
			font-family: var(--font-mono);
			font-size: 0.74rem;
			font-weight: 600;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: var(--color-accent);
		}

		.entry-eyebrow-dot {
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: currentColor;
			box-shadow: 0 0 0 3px var(--color-accent-soft);
		}

		.entry-title {
			margin: 0;
			font-size: clamp(1.55rem, 1.3rem + 0.8vw, 1.9rem);
			font-weight: 750;
			line-height: 1.2;
			letter-spacing: -0.026em;
		}

		.entry-subtitle {
			margin: 0;
			color: var(--color-text-secondary);
			font-size: 0.94rem;
			line-height: 1.68;
		}

		.entry-notice {
			display: flex;
			align-items: flex-start;
			gap: 0.6rem;
			padding: 0.78rem 0.92rem;
			border-radius: var(--radius-inner);
			border: 1px solid var(--color-border);
			background: var(--color-bg-tertiary);
			font-size: 0.85rem;
			line-height: 1.65;
			color: var(--color-text-muted);
		}

		.entry-notice-icon {
			flex-shrink: 0;
			width: 1rem;
			margin-top: 0.16rem;
			color: var(--color-accent);
		}

		.entry-notice strong {
			color: var(--color-text);
			font-weight: 600;
		}

		.entry-error {
			margin: 0;
			padding: 0.72rem 0.88rem;
			border-radius: var(--radius-inner);
			border: 1px solid rgba(220, 38, 38, 0.28);
			background: rgba(220, 38, 38, 0.1);
			color: #dc2626;
			font-size: 0.86rem;
			line-height: 1.65;
		}

		[data-theme="dark"] .entry-error {
			color: #fca5a5;
		}

		.entry-actions {
			display: flex;
			flex-wrap: wrap;
			gap: 0.65rem;
			padding-top: 0.2rem;
		}

		.entry-btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 0.45rem;
			padding: 0.74rem 1.2rem;
			border-radius: var(--radius-pill);
			text-decoration: none;
			font-size: 0.9rem;
			font-weight: 600;
			cursor: pointer;
			white-space: nowrap;
			transition:
				transform 120ms cubic-bezier(0.22, 1, 0.36, 1),
				background-color var(--transition),
				border-color var(--transition),
				color var(--transition),
				box-shadow var(--transition);
		}

		.entry-btn:active {
			transform: scale(0.97);
		}

		.entry-btn-primary {
			flex: 1;
			border: 1px solid transparent;
			background: var(--color-text);
			color: var(--color-bg);
			box-shadow: 0 8px 20px -12px rgba(0, 0, 0, 0.35);
		}

		.entry-btn-primary:hover {
			background: var(--color-accent);
			color: #ffffff;
			transform: translateY(-1px);
			box-shadow: 0 10px 24px -12px rgba(var(--color-accent-rgb), 0.45);
		}

		.entry-btn-primary[aria-disabled="true"] {
			opacity: 0.42;
			pointer-events: none;
			box-shadow: none;
		}

		.entry-btn-ghost {
			border: 1px solid var(--color-border-strong);
			background: var(--color-bg-tertiary);
			color: var(--color-text-secondary);
		}

		.entry-btn-ghost:hover {
			border-color: rgba(var(--color-accent-rgb), 0.3);
			background: var(--color-accent-soft);
			color: var(--color-accent);
		}

		.entry-btn svg {
			width: 1.02rem;
			height: 1.02rem;
			flex-shrink: 0;
		}

		.entry-footer {
			margin: 0;
			font-family: var(--font-mono);
			font-size: 0.76rem;
			color: var(--color-text-muted);
			text-align: center;
		}

		@media (max-width: 480px) {
			.entry-actions {
				flex-direction: column;
			}

			.entry-btn {
				width: 100%;
			}
		}
	</style>
</head>
<body${hasBackgroundImage ? ' class="has-bg-image"' : ""}>
	${hasBackgroundImage ? `<div class="bg-image-layer" aria-hidden="true"><img src="${escapedBackgroundImageUrl}" alt="" loading="eager" decoding="async" /></div>` : ""}
	<main class="entry-shell">
		<header class="entry-header">
			<a href="/" class="entry-brand" aria-label="返回博客首页">
				<span class="entry-brand-mark" aria-hidden="true">
					<img
						src="https://assets.ericterminal.com/logo-transparent.png"
						alt=""
						class="entry-brand-logo"
					/>
				</span>
				<span>Eric-Terminal 的博客</span>
			</a>
			<button class="theme-toggle" type="button" aria-label="切换主题" title="切换主题">
				<svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
				<svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
			</button>
		</header>

		<section class="entry-panel">
			<div class="entry-content">
				<div class="entry-eyebrow">
					<span class="entry-eyebrow-dot" aria-hidden="true"></span>
					<span>站点管理</span>
				</div>
				<h1 class="entry-title">欢迎回来</h1>
				<p class="entry-subtitle">请通过 GitHub 验证管理员身份以进入工作台。</p>

				<div class="entry-notice" role="note">
					<svg class="entry-notice-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
						<path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 4a1 1 0 011 1v4a1 1 0 11-2 0V7a1 1 0 011-1zm0 8a1.25 1.25 0 110-2.5A1.25 1.25 0 0110 14z" fill="currentColor"/>
					</svg>
					<span>此工作台仅供 <strong>@Eric-Terminal</strong> 本人登录维护，暂不对外开放。</span>
				</div>

				${error ? `<p class="entry-error" role="alert">${escapeHtml(error)}</p>` : ""}

				<div class="entry-actions">
					<a
						href="/api/auth/github"
						class="entry-btn entry-btn-primary"
						aria-disabled="${oauthEnabled ? "false" : "true"}"
					>
						<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
						</svg>
						使用 GitHub 继续
					</a>
					<a href="/" class="entry-btn entry-btn-ghost">返回首页</a>
				</div>
			</div>
		</section>

		<p class="entry-footer">Eric-Terminal 的博客 · 管理入口</p>
	</main>
</body>
</html>`;
}
