import { escapeAttribute, escapeHtml } from "@/lib/security";

interface LoginPageOptions {
	error?: string;
	turnstileSiteKey?: string;
}

export function loginPage(options: LoginPageOptions = {}): string {
	const { error, turnstileSiteKey } = options;

	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>管理后台登录</title>
	<meta name="robots" content="noindex, nofollow" />
	${turnstileSiteKey ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : ""}
	<style>
		*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
		html {
			font-family: system-ui, -apple-system, sans-serif;
			font-size: 14px;
			color: #f1f5f9;
			background: #0f172a;
		}
		body {
			min-height: 100dvh;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.login-card {
			width: 100%;
			max-width: 400px;
			padding: 2rem;
			background: #1e293b;
			border: 1px solid #334155;
			border-radius: 0.5rem;
		}
		h1 { font-size: 1.5rem; margin-bottom: 1.5rem; text-align: center; }
		.form-group { margin-bottom: 1rem; }
		label { display: block; margin-bottom: 0.375rem; color: #cbd5e1; font-size: 0.85rem; }
		input {
			width: 100%;
			padding: 0.625rem 0.75rem;
			background: #0f172a;
			border: 1px solid #334155;
			border-radius: 0.375rem;
			color: #f1f5f9;
			font-family: inherit;
			font-size: 0.9rem;
		}
		input:focus { outline: none; border-color: #3b82f6; }
		button {
			width: 100%;
			padding: 0.625rem;
			background: #3b82f6;
			color: #fff;
			border: none;
			border-radius: 0.375rem;
			font-family: inherit;
			font-size: 0.9rem;
			font-weight: 600;
			cursor: pointer;
			margin-top: 0.5rem;
		}
		button:hover { background: #60a5fa; }
		.error {
			background: rgba(239,68,68,0.1);
			color: #ef4444;
			padding: 0.625rem;
			border-radius: 0.375rem;
			margin-bottom: 1rem;
			font-size: 0.85rem;
			text-align: center;
			border: 1px solid rgba(239,68,68,0.2);
		}
	</style>
</head>
<body>
	<div class="login-card">
		<h1>管理后台登录</h1>
		${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
		<form method="post" action="/api/auth/login">
			<div class="form-group">
				<label for="username">用户名</label>
				<input type="text" id="username" name="username" required autocomplete="username" />
			</div>
			<div class="form-group">
				<label for="password">密码</label>
				<input type="password" id="password" name="password" required autocomplete="current-password" />
			</div>
			${
				turnstileSiteKey
					? `<div class="form-group"><div class="cf-turnstile" data-sitekey="${escapeAttribute(turnstileSiteKey)}"></div></div>`
					: ""
			}
			<button type="submit">登录</button>
		</form>
	</div>
</body>
</html>`;
}
