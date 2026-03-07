import { escapeHtml } from "@/lib/security";
import { adminSharedStyles } from "./layout";

interface LoginPageOptions {
	error?: string;
	githubLogin?: string;
	oauthEnabled?: boolean;
}

export function loginPage(options: LoginPageOptions = {}): string {
	const { error, githubLogin, oauthEnabled = false } = options;

	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>GitHub OAuth 登录</title>
	<meta name="robots" content="noindex, nofollow" />
	<style>
${adminSharedStyles}

		body {
			display: grid;
			place-items: center;
			padding: 1.25rem;
		}

		.login-shell {
			position: relative;
			z-index: 1;
			width: min(1120px, calc(100vw - 2rem));
			display: grid;
			grid-template-columns: minmax(0, 1.05fr) minmax(360px, 0.95fr);
			gap: 1.25rem;
			align-items: stretch;
		}

		.login-hero,
		.login-card {
			position: relative;
			background: var(--bg-secondary);
			border: 1px solid var(--border);
			border-radius: 36px;
			backdrop-filter: blur(24px) saturate(140%);
			box-shadow: var(--shadow-strong);
			overflow: hidden;
		}

		.login-hero::before,
		.login-card::before {
			content: "";
			position: absolute;
			inset: 0;
			pointer-events: none;
			background:
				radial-gradient(circle at top left, rgba(10, 132, 255, 0.18), transparent 28%),
				linear-gradient(180deg, rgba(255, 255, 255, 0.12), transparent 26%);
		}

		.login-hero {
			padding: 2rem;
			display: grid;
			gap: 1.4rem;
			align-content: space-between;
			min-height: min(720px, calc(100dvh - 2.5rem));
		}

		.login-hero-copy {
			position: relative;
			display: grid;
			gap: 0.9rem;
		}

		.login-eyebrow {
			display: inline-flex;
			align-items: center;
			width: fit-content;
			padding: 0.35rem 0.8rem;
			border-radius: var(--radius-pill);
			background: var(--accent-soft);
			color: var(--accent);
			font-size: 0.84rem;
			font-weight: 700;
			letter-spacing: 0.04em;
		}

		.login-hero h1 {
			margin: 0;
			font-size: clamp(2.5rem, 2rem + 1.7vw, 4.2rem);
			line-height: 0.98;
		}

		.login-hero p {
			color: var(--text-secondary);
			font-size: 1rem;
			line-height: 1.85;
			max-width: 38rem;
		}

		.login-orb-grid {
			position: relative;
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.9rem;
		}

		.login-orb-card,
		.login-meta-card {
			position: relative;
			padding: 1rem 1.05rem;
			border-radius: 28px;
			background: var(--bg-tertiary);
			border: 1px solid var(--border);
			box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
		}

		.login-orb-card strong,
		.login-meta-card strong {
			display: block;
			font-size: 0.82rem;
			color: var(--text-muted);
			letter-spacing: 0.08em;
			text-transform: uppercase;
			margin-bottom: 0.38rem;
		}

		.login-orb-card span,
		.login-meta-card span {
			display: block;
			font-size: 1.18rem;
			font-weight: 700;
			letter-spacing: -0.03em;
		}

		.login-card {
			padding: 1.65rem;
			display: grid;
			align-content: center;
		}

		.login-card-inner {
			position: relative;
			display: grid;
			gap: 1rem;
			padding: 1.4rem;
			border-radius: 30px;
			background: rgba(255, 255, 255, 0.18);
			border: 1px solid var(--border);
			box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
		}

		.login-card-header {
			display: grid;
			gap: 0.55rem;
		}

		.login-card-header h2 {
			margin: 0;
			font-size: 1.75rem;
			color: var(--text);
		}

		.login-hint {
			color: var(--text-secondary);
			line-height: 1.8;
			font-size: 0.96rem;
		}

		.login-notice {
			padding: 0.95rem 1rem;
			border-radius: 24px;
			background: rgba(10, 132, 255, 0.12);
			border: 1px solid rgba(10, 132, 255, 0.16);
			color: var(--text-secondary);
			display: grid;
			gap: 0.28rem;
			line-height: 1.75;
		}

		.login-notice strong {
			color: var(--text);
		}

		.oauth-button {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 0.7rem;
			width: 100%;
			padding: 0.95rem 1.15rem;
			border-radius: var(--radius-pill);
			border: 1px solid transparent;
			background:
				linear-gradient(135deg, rgba(255, 255, 255, 0.18), transparent 72%),
				var(--accent);
			color: #fff;
			font-size: 0.98rem;
			font-weight: 700;
			letter-spacing: 0.01em;
			box-shadow:
				0 20px 40px -26px rgba(10, 132, 255, 0.56),
				inset 0 1px 0 rgba(255, 255, 255, 0.18);
			transition:
				transform var(--transition-fast),
				box-shadow var(--transition-fast),
				background-color var(--transition-fast);
		}

		.oauth-button:hover {
			color: #fff;
			transform: translate3d(0, -2px, 0);
			background:
				linear-gradient(135deg, rgba(255, 255, 255, 0.22), transparent 72%),
				var(--accent-hover);
		}

		.oauth-button[aria-disabled="true"] {
			opacity: 0.58;
			pointer-events: none;
			box-shadow: none;
		}

		.oauth-mark {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 2rem;
			height: 2rem;
			border-radius: 999px;
			background: rgba(0, 0, 0, 0.18);
			font-size: 0.82rem;
			font-weight: 800;
			letter-spacing: 0.04em;
		}

		.login-links {
			display: flex;
			flex-wrap: wrap;
			gap: 0.65rem;
		}

		.login-link {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			padding: 0.62rem 0.9rem;
			border-radius: var(--radius-pill);
			background: var(--bg-tertiary);
			border: 1px solid var(--border);
			color: var(--text-secondary);
		}

		.login-link:hover {
			color: var(--text);
			background: var(--surface-elevated);
			border-color: var(--border-strong);
		}

		.error {
			padding: 0.95rem 1rem;
			border-radius: 24px;
			border: 1px solid rgba(220, 38, 38, 0.18);
			background: rgba(220, 38, 38, 0.1);
			color: var(--danger);
			line-height: 1.75;
		}

		@media (max-width: 960px) {
			.login-shell {
				grid-template-columns: 1fr;
			}

			.login-hero {
				min-height: auto;
			}
		}

		@media (max-width: 720px) {
			body {
				padding: 0.75rem;
			}

			.login-shell {
				width: min(100vw - 1rem, 100%);
				gap: 0.9rem;
			}

			.login-hero,
			.login-card {
				border-radius: 28px;
			}

			.login-hero {
				padding: 1.35rem;
			}

			.login-card {
				padding: 1rem;
			}

			.login-card-inner {
				padding: 1.15rem;
			}

			.login-orb-grid {
				grid-template-columns: 1fr;
			}
		}
	</style>
</head>
<body>
	<div class="login-shell">
		<section class="login-hero">
			<div class="login-hero-copy">
				<span class="login-eyebrow">主页同款后台</span>
				<h1>用和首页一致的浮层节奏，进入你的内容后台。</h1>
				<p>后台已经切到 GitHub OAuth Only 登录模式，视觉上也同步借用了主页的胶囊、毛玻璃和柔和背景光晕，让管理界面不再像一块完全割裂的系统面板。</p>
			</div>
			<div class="login-orb-grid">
				<div class="login-orb-card">
					<strong>准入账号</strong>
					<span>${escapeHtml(githubLogin || "未配置")}</span>
				</div>
				<div class="login-orb-card">
					<strong>登录方式</strong>
					<span>GitHub OAuth</span>
				</div>
				<div class="login-meta-card">
					<strong>会话策略</strong>
					<span>只允许白名单账号进入后台</span>
				</div>
				<div class="login-meta-card">
					<strong>体验方向</strong>
					<span>沿用主页的玻璃悬浮 UI</span>
				</div>
			</div>
		</section>

		<section class="login-card">
			<div class="login-card-inner">
				<div class="login-card-header">
					<h2>使用 GitHub 登录后台</h2>
					<p class="login-hint">点击后会跳转到 GitHub 授权页，只允许指定账号完成登录并进入管理后台。</p>
				</div>
				${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
				<div class="login-notice">
					<p><strong>允许访问的 GitHub 账号：</strong>${escapeHtml(githubLogin || "未配置")}</p>
					<p>如果这里还是未配置状态，请先补充 GitHub OAuth 相关环境变量。</p>
				</div>
				<a
					href="/api/auth/github"
					class="oauth-button"
					aria-disabled="${oauthEnabled ? "false" : "true"}"
				>
					<span class="oauth-mark">GH</span>
					<span>使用 GitHub OAuth 登录</span>
				</a>
				<div class="login-links">
					<a href="/" class="login-link">返回前台</a>
				</div>
			</div>
		</section>
	</div>
</body>
</html>`;
}
