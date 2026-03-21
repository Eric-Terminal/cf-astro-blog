import { escapeAttribute, escapeHtml } from "@/lib/security";

interface LoginPageOptions {
	error?: string;
	oauthEnabled?: boolean;
	backgroundImageUrl?: string | null;
}

export function loginPage(options: LoginPageOptions = {}): string {
	const { error, oauthEnabled = false, backgroundImageUrl } = options;
	const hasBackgroundImage = Boolean(backgroundImageUrl);

	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>登录 · EricTerminal's Blog</title>
	<meta name="robots" content="noindex, nofollow" />
	<script>
		(function () {
			var theme = localStorage.getItem("theme");
			if (theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
				document.documentElement.setAttribute("data-theme", "dark");
			}
		})();
	</script>
	<style>
		:root {
			--color-bg: #edf3f8;
			--color-text: #101828;
			--color-text-secondary: #3a4357;
			--color-text-muted: #6d7688;
			--color-border: rgba(15, 23, 42, 0.08);
			--color-accent: #0a84ff;
			--color-accent-hover: #0066cc;
			--card-surface-rgb: 255, 255, 255;
			--card-sheen-rgb: 255, 255, 255;
			--shadow-card:
				0 18px 40px -30px rgba(8, 18, 34, 0.18),
				0 6px 18px -12px rgba(8, 18, 34, 0.12);
			--radius-panel: 34px;
			--radius-pill: 999px;
			--font-sans:
				"SF Pro Display", "SF Pro Text", "PingFang SC", "Hiragino Sans GB",
				"Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			--glow-a: rgba(126, 171, 255, 0.32);
			--glow-b: rgba(100, 200, 255, 0.22);
			--glass-opacity: 0.13;
		}

		/* JS 设置 data-theme 的精确覆盖 */
		[data-theme="dark"] {
			--color-bg: #040d17;
			--color-text: #eef4ff;
			--color-text-secondary: #cad4e6;
			--color-text-muted: #93a1bc;
			--color-border: rgba(147, 161, 188, 0.14);
			--color-accent: #57a6ff;
			--color-accent-hover: #88c0ff;
			--card-surface-rgb: 24, 36, 54;
			--card-sheen-rgb: 142, 178, 224;
			--glow-a: rgba(48, 100, 220, 0.42);
			--glow-b: rgba(20, 60, 140, 0.34);
			--glass-opacity: 0.16;
		}

		/* 系统深色模式兜底（未访问博客/无 localStorage 时）*/
		@media (prefers-color-scheme: dark) {
			:root:not([data-theme="light"]) {
				--color-bg: #040d17;
				--color-text: #eef4ff;
				--color-text-secondary: #cad4e6;
				--color-text-muted: #93a1bc;
				--color-border: rgba(147, 161, 188, 0.14);
				--color-accent: #57a6ff;
				--color-accent-hover: #88c0ff;
				--card-surface-rgb: 24, 36, 54;
				--card-sheen-rgb: 142, 178, 224;
				--glow-a: rgba(48, 100, 220, 0.42);
				--glow-b: rgba(20, 60, 140, 0.34);
				--glass-opacity: 0.16;
			}
		}

		*,
		*::before,
		*::after {
			box-sizing: border-box;
		}

		html,
		body {
			margin: 0;
			min-height: 100vh;
		}

		@keyframes float-glow {
			0%, 100% { transform: translateY(0) scale(1); }
			33% { transform: translateY(-2rem) scale(1.05); }
			66% { transform: translateY(1.2rem) scale(0.96); }
		}

		body {
			display: grid;
			place-items: center;
			padding: 1.5rem 1rem;
			font-family: var(--font-sans);
			color: var(--color-text);
			background:
				radial-gradient(circle at 14% 10%, rgba(126, 192, 255, 0.14), transparent 24%),
				radial-gradient(circle at 84% 12%, rgba(255, 255, 255, 0.24), transparent 20%),
				radial-gradient(circle at 48% 100%, rgba(88, 192, 255, 0.08), transparent 26%),
				linear-gradient(180deg, rgba(255, 255, 255, 0.3), transparent 30%),
				var(--color-bg);
			position: relative;
			min-height: 100dvh;
			overflow: hidden;
		}

		/* 有背景图时 body 背景透明，让背景图层显示 */
		body.has-bg-image {
			background: transparent;
		}

		/* 深色背景渐变（JS 设置 data-theme 时生效）*/
		[data-theme="dark"] body {
			background:
				radial-gradient(circle at 14% 10%, rgba(30, 80, 200, 0.22), transparent 28%),
				radial-gradient(circle at 84% 12%, rgba(10, 40, 100, 0.18), transparent 24%),
				radial-gradient(circle at 48% 100%, rgba(20, 60, 160, 0.16), transparent 30%),
				var(--color-bg);
		}

		/* 系统深色模式兜底（未访问博客 / 无 localStorage 时）*/
		@media (prefers-color-scheme: dark) {
			:root:not([data-theme="light"]) body {
				background:
					radial-gradient(circle at 14% 10%, rgba(30, 80, 200, 0.22), transparent 28%),
					radial-gradient(circle at 84% 12%, rgba(10, 40, 100, 0.18), transparent 24%),
					radial-gradient(circle at 48% 100%, rgba(20, 60, 160, 0.16), transparent 30%),
					var(--color-bg);
			}
		}

		body::before,
		body::after {
			content: "";
			position: fixed;
			inset: auto;
			width: 24rem;
			height: 24rem;
			border-radius: 50%;
			filter: blur(70px);
			opacity: 0.24;
			pointer-events: none;
			z-index: -1;
			animation: float-glow 16s ease-in-out infinite;
		}

		body::before {
			top: -6rem;
			left: -6rem;
			background: var(--glow-a);
		}

		body::after {
			right: -8rem;
			bottom: 8rem;
			background: var(--glow-b);
			animation-delay: -6s;
		}

		.entry-shell {
			width: min(520px, calc(100vw - 1rem));
			display: grid;
			gap: 1.5rem;
		}

		/* ---- 背景图层（与首页 .site-background 逻辑一致）---- */
		.bg-image-layer {
			position: fixed;
			inset: 0;
			z-index: -2;
			overflow: hidden;
			background-color: var(--color-bg);
		}

		.bg-image-layer img {
			position: absolute;
			inset: 0;
			width: 100%;
			height: 100%;
			object-fit: cover;
			object-position: var(--bg-focus-x, 50%) var(--bg-focus-y, 50%);
			filter: blur(var(--bg-blur, 24px));
			transform: scale(var(--bg-scale, 1.12));
			opacity: var(--bg-opacity, 0.72);
			transform-origin: center;
		}

		/* ---- 顶部品牌栏 ---- */
		.entry-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
		}

		.entry-brand {
			display: inline-flex;
			align-items: center;
			gap: 0.62rem;
			color: inherit;
			text-decoration: none;
			font-weight: 700;
			font-size: 0.95rem;
			letter-spacing: 0.01em;
			opacity: 0.9;
			transition: opacity 200ms ease;
		}

		.entry-brand:hover {
			opacity: 1;
		}

		.entry-brand-logo {
			width: 2rem;
			height: 2rem;
			border-radius: 0.48rem;
			object-fit: contain;
			flex-shrink: 0;
		}

		/* ---- 主卡片 ---- */
		.entry-panel {
			position: relative;
			overflow: hidden;
			background: transparent;
			border: 1px solid rgba(255, 255, 255, 0.2);
			border-radius: var(--radius-panel);
			box-shadow: var(--shadow-card);
		}

		[data-theme="dark"] .entry-panel {
			border-color: rgba(147, 161, 188, 0.12);
		}

		.entry-panel::after {
			content: "";
			position: absolute;
			inset: 0;
			border-radius: inherit;
			background: rgba(var(--card-surface-rgb), var(--glass-opacity, 0.13));
			backdrop-filter: blur(22px) saturate(148%);
			-webkit-backdrop-filter: blur(22px) saturate(148%);
			pointer-events: none;
			z-index: 0;
		}

		.entry-panel::before {
			content: "";
			position: absolute;
			inset: 0;
			border-radius: inherit;
			background: linear-gradient(
				160deg,
				rgba(var(--card-sheen-rgb), 0.1) 0%,
				rgba(var(--card-sheen-rgb), 0.04) 36%,
				transparent 100%
			);
			pointer-events: none;
			z-index: 1;
		}

		.entry-content {
			position: relative;
			z-index: 2;
			display: grid;
			gap: 1.1rem;
			padding: clamp(1.5rem, 1.2rem + 1.4vw, 2.1rem);
		}

		/* ---- 标题区 ---- */
		.entry-eyebrow {
			display: flex;
			align-items: center;
			gap: 0.45rem;
			font-size: 0.8rem;
			font-weight: 600;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: var(--color-accent);
			opacity: 0.85;
		}

		.entry-eyebrow-dot {
			width: 0.36rem;
			height: 0.36rem;
			border-radius: 50%;
			background: currentColor;
		}

		.entry-title {
			margin: 0;
			font-size: clamp(1.55rem, 1.2rem + 1vw, 2rem);
			font-weight: 700;
			line-height: 1.22;
			letter-spacing: -0.02em;
		}

		.entry-subtitle {
			margin: 0;
			color: var(--color-text-secondary);
			font-size: 0.96rem;
			line-height: 1.7;
		}

		/* ---- 专属提示 ---- */
		.entry-notice {
			display: flex;
			align-items: flex-start;
			gap: 0.6rem;
			padding: 0.78rem 0.92rem;
			border-radius: 16px;
			border: 1px solid var(--color-border);
			background: rgba(var(--card-surface-rgb), 0.36);
			font-size: 0.875rem;
			line-height: 1.65;
			color: var(--color-text-muted);
		}

		.entry-notice-icon {
			flex-shrink: 0;
			width: 1rem;
			margin-top: 0.14rem;
			color: var(--color-accent);
			opacity: 0.7;
		}

		.entry-notice strong {
			color: var(--color-text-secondary);
			font-weight: 600;
		}

		/* ---- 错误提示 ---- */
		.entry-error {
			margin: 0;
			padding: 0.72rem 0.88rem;
			border-radius: 14px;
			border: 1px solid rgba(220, 38, 38, 0.25);
			background: rgba(220, 38, 38, 0.08);
			color: #dc2626;
			font-size: 0.9rem;
			line-height: 1.7;
		}

		[data-theme="dark"] .entry-error {
			color: #f87171;
		}

		/* ---- 操作按钮 ---- */
		.entry-actions {
			display: flex;
			flex-wrap: wrap;
			gap: 0.65rem;
			padding-top: 0.15rem;
		}

		.entry-btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 0.45rem;
			padding: 0.85rem 1.25rem;
			border-radius: var(--radius-pill);
			text-decoration: none;
			font-size: 0.925rem;
			font-weight: 600;
			transition:
				transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
				box-shadow 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
				opacity 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
				background 220ms ease;
			cursor: pointer;
			border: none;
			white-space: nowrap;
		}

		.entry-btn:hover {
			transform: translateY(-1.5px);
		}

		.entry-btn-primary {
			border: 1px solid rgba(10, 132, 255, 0.15);
			background: var(--color-accent);
			color: #f0f7ff;
			box-shadow: 0 12px 28px -20px rgba(10, 132, 255, 0.5);
			flex: 1;
		}

		.entry-btn-primary:hover {
			color: #ffffff;
			background: var(--color-accent-hover);
			box-shadow: 0 16px 32px -20px rgba(10, 132, 255, 0.45);
		}

		.entry-btn-primary[aria-disabled="true"] {
			opacity: 0.42;
			pointer-events: none;
			box-shadow: none;
		}

		.entry-btn-ghost {
			border: 1px solid var(--color-border);
			background: rgba(var(--card-surface-rgb), 0.55);
			color: var(--color-text-secondary);
		}

		.entry-btn-ghost:hover {
			background: rgba(var(--card-surface-rgb), 0.75);
		}

		.entry-btn svg {
			width: 1.05rem;
			height: 1.05rem;
			flex-shrink: 0;
		}

		/* ---- 底部分隔 ---- */
		.entry-footer {
			font-size: 0.8rem;
			color: var(--color-text-muted);
			text-align: center;
			opacity: 0.7;
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
<body${hasBackgroundImage ? ' class="has-bg-image"' : ''}>
	${hasBackgroundImage ? `<div class="bg-image-layer" aria-hidden="true"><img src="${escapeAttribute(backgroundImageUrl!)}" alt="" loading="eager" decoding="async" /></div>` : ''}
	<main class="entry-shell">
		<header class="entry-header">
			<a href="/" class="entry-brand" aria-label="返回 EricTerminal's Blog 首页">
				<img
					src="https://assets.ericterminal.com/logo-transparent.png"
					alt=""
					class="entry-brand-logo"
				/>
				<span>EricTerminal's Blog</span>
			</a>
		</header>

		<section class="entry-panel">
			<div class="entry-content">
				<div class="entry-eyebrow">
					<span class="entry-eyebrow-dot" aria-hidden="true"></span>
					<span>站点管理</span>
				</div>
				<h1 class="entry-title">欢迎回来</h1>
				<p class="entry-subtitle">请通过 GitHub 验证身份以继续访问后台。</p>

				<div class="entry-notice" role="note">
					<svg class="entry-notice-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
						<path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 4a1 1 0 011 1v4a1 1 0 11-2 0V7a1 1 0 011-1zm0 8a1.25 1.25 0 110-2.5A1.25 1.25 0 0110 14z" fill="currentColor"/>
					</svg>
					<span>此后台仅供 <strong>@Eric-Terminal</strong> 登录使用，暂不对外开放。</span>
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

		<p class="entry-footer">EricTerminal's Blog &mdash; 后台入口</p>
	</main>
</body>
</html>`;
}
