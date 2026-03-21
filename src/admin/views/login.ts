import { escapeHtml } from "@/lib/security";

interface LoginPageOptions {
	error?: string;
	oauthEnabled?: boolean;
}

export function loginPage(options: LoginPageOptions = {}): string {
	const { error, oauthEnabled = false } = options;

	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>站点入口</title>
	<meta name="robots" content="noindex, nofollow" />
	<style>
		:root {
			color-scheme: dark light;
			font-family:
				"Space Grotesk",
				"LXGW WenKai",
				"Inter",
				-apple-system,
				BlinkMacSystemFont,
				"Segoe UI",
				sans-serif;
		}

		* {
			box-sizing: border-box;
		}

		body {
			margin: 0;
			min-height: 100vh;
			display: grid;
			place-items: center;
			padding: 1rem;
			background:
				radial-gradient(circle at 18% 16%, rgba(56, 189, 248, 0.24), transparent 42%),
				radial-gradient(circle at 78% 84%, rgba(139, 92, 246, 0.22), transparent 45%),
				linear-gradient(180deg, #070f25 0%, #0d1733 45%, #101a39 100%);
			color: #e2e8f0;
		}

		.entry-shell {
			position: relative;
			width: min(640px, calc(100vw - 1.5rem));
		}

		.entry-card {
			position: relative;
			background:
				linear-gradient(
					145deg,
					rgba(255, 255, 255, 0.16) 0%,
					rgba(255, 255, 255, 0.05) 48%,
					rgba(255, 255, 255, 0.02) 100%
				),
				rgba(7, 17, 41, 0.68);
			border: 1px solid rgba(148, 163, 184, 0.28);
			border-radius: 28px;
			padding: clamp(1.3rem, 1rem + 1.2vw, 2rem);
			backdrop-filter: blur(16px) saturate(125%);
			box-shadow:
				0 24px 56px -36px rgba(15, 23, 42, 0.9),
				inset 0 1px 0 rgba(255, 255, 255, 0.12);
		}

		.entry-kicker {
			margin: 0;
			font-size: 0.82rem;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: rgba(148, 163, 184, 0.92);
		}

		.entry-title {
			margin: 0.55rem 0 0;
			font-size: clamp(1.5rem, 1.2rem + 1vw, 2rem);
			line-height: 1.3;
			color: #f8fafc;
		}

		.entry-description {
			margin: 0.8rem 0 0;
			font-size: 0.96rem;
			line-height: 1.75;
			color: rgba(226, 232, 240, 0.9);
		}

		.entry-error {
			margin: 1rem 0 0;
			padding: 0.82rem 0.95rem;
			border-radius: 14px;
			border: 1px solid rgba(252, 165, 165, 0.42);
			background: rgba(185, 28, 28, 0.2);
			color: #fecaca;
			line-height: 1.7;
		}

		.entry-actions {
			margin-top: 1.2rem;
			display: flex;
			flex-wrap: wrap;
			gap: 0.68rem;
		}

		.entry-btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 0.4rem;
			padding: 0.66rem 1rem;
			border-radius: 999px;
			border: 1px solid transparent;
			font-size: 0.88rem;
			font-weight: 600;
			text-decoration: none;
			transition:
				transform 0.18s ease,
				opacity 0.18s ease,
				border-color 0.18s ease;
		}

		.entry-btn:hover {
			transform: translateY(-1px);
		}

		.entry-btn-primary {
			background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
			border-color: rgba(191, 219, 254, 0.5);
			color: #fff;
		}

		.entry-btn-primary[aria-disabled="true"] {
			opacity: 0.52;
			pointer-events: none;
		}

		.entry-btn-ghost {
			background: rgba(15, 23, 42, 0.38);
			border-color: rgba(148, 163, 184, 0.36);
			color: rgba(226, 232, 240, 0.92);
		}

		@media (prefers-color-scheme: light) {
			body {
				background:
					radial-gradient(circle at 16% 15%, rgba(56, 189, 248, 0.25), transparent 44%),
					radial-gradient(circle at 82% 85%, rgba(99, 102, 241, 0.16), transparent 46%),
					linear-gradient(180deg, #eef6ff 0%, #e2ecff 100%);
				color: #1e293b;
			}

			.entry-card {
				background:
					linear-gradient(
						150deg,
						rgba(255, 255, 255, 0.9) 0%,
						rgba(255, 255, 255, 0.74) 52%,
						rgba(255, 255, 255, 0.66) 100%
					),
					rgba(255, 255, 255, 0.75);
				border-color: rgba(148, 163, 184, 0.38);
				box-shadow:
					0 24px 52px -40px rgba(30, 41, 59, 0.45),
					inset 0 1px 0 rgba(255, 255, 255, 0.9);
			}

			.entry-kicker {
				color: rgba(71, 85, 105, 0.85);
			}

			.entry-title {
				color: #0f172a;
			}

			.entry-description {
				color: rgba(15, 23, 42, 0.86);
			}

			.entry-error {
				border-color: rgba(239, 68, 68, 0.4);
				background: rgba(254, 226, 226, 0.88);
				color: #b91c1c;
			}

			.entry-btn-ghost {
				background: rgba(248, 250, 252, 0.85);
				border-color: rgba(148, 163, 184, 0.48);
				color: #334155;
			}
		}

		@media (max-width: 600px) {
			.entry-actions {
				flex-direction: column;
			}

			.entry-btn {
				width: 100%;
			}
		}

		.sr-only {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			margin: -1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
			border: 0;
		}

		a {
			color: inherit;
		}

		h1 {
			margin: 0;
		}
	</style>
</head>
<body>
	<main class="entry-shell">
		<section class="entry-card">
			<p class="entry-kicker">EricTerminal Blog</p>
			<h1 class="entry-title">这是站点管理入口，界面已与前台风格对齐</h1>
			<p class="entry-description">
				未授权账号无法进入后台，授权流程仅支持 GitHub OAuth。
			</p>
			${error ? `<p class="entry-error" role="alert">${escapeHtml(error)}</p>` : ""}
			<div class="entry-actions">
				<a href="/" class="entry-btn entry-btn-ghost">返回首页</a>
				<a
					href="/api/auth/github"
					class="entry-btn entry-btn-primary"
					aria-disabled="${oauthEnabled ? "false" : "true"}"
				>
					<span class="sr-only">管理员登录入口：</span>
					<span>使用 GitHub 登录</span>
				</a>
			</div>
		</section>
	</main>
</body>
</html>`;
}
