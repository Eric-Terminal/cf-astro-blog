import { escapeAttribute, escapeHtml } from "@/lib/security";

interface AdminLayoutOptions {
	csrfToken?: string;
}

export function adminLayout(
	title: string,
	content: string,
	options: AdminLayoutOptions = {},
): string {
	const logoutForm = options.csrfToken
		? `<form method="post" action="/api/auth/logout">
				<input type="hidden" name="_csrf" value="${escapeAttribute(options.csrfToken)}" />
				<button type="submit" class="btn btn-sm">退出登录</button>
			</form>`
		: "";

	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>${escapeHtml(title)} | 后台</title>
	<meta name="robots" content="noindex, nofollow" />
	<script src="/admin.js" defer></script>
	<style>
		*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

		:root {
			--bg: #0f172a;
			--bg-secondary: #1e293b;
			--bg-tertiary: #334155;
			--text: #f1f5f9;
			--text-secondary: #cbd5e1;
			--text-muted: #94a3b8;
			--border: #334155;
			--accent: #3b82f6;
			--accent-hover: #60a5fa;
			--success: #22c55e;
			--warning: #f59e0b;
			--danger: #ef4444;
			--radius: 0.5rem;
			--font: system-ui, -apple-system, sans-serif;
			--font-mono: ui-monospace, 'Cascadia Code', Consolas, monospace;
		}

		html { font-family: var(--font); font-size: 14px; line-height: 1.6; color: var(--text); background: var(--bg); }
		body { display: flex; min-height: 100dvh; }

		a { color: var(--accent); text-decoration: none; }
		a:hover { color: var(--accent-hover); }

		.sidebar {
			width: 240px;
			background: var(--bg-secondary);
			border-right: 1px solid var(--border);
			padding: 1.5rem 0;
			display: flex;
			flex-direction: column;
			position: fixed;
			top: 0;
			left: 0;
			bottom: 0;
		}

		.sidebar-brand {
			padding: 0 1.5rem 1.5rem;
			border-bottom: 1px solid var(--border);
			font-weight: 700;
			font-size: 1.1rem;
		}

		.sidebar-nav { padding: 1rem 0; flex: 1; }
		.sidebar-nav a {
			display: block;
			padding: 0.5rem 1.5rem;
			color: var(--text-secondary);
			transition: background 150ms, color 150ms;
		}
		.sidebar-nav a:hover, .sidebar-nav a.active {
			background: var(--bg-tertiary);
			color: var(--text);
		}

		.sidebar-footer {
			padding: 1rem 1.5rem;
			border-top: 1px solid var(--border);
		}

		.main-content {
			margin-left: 240px;
			flex: 1;
			padding: 2rem;
			max-width: 1200px;
		}

		h1 { font-size: 1.75rem; margin-bottom: 1.5rem; }
		h2 { font-size: 1.25rem; margin: 1.5rem 0 1rem; color: var(--text-secondary); }

		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 1rem;
			margin-bottom: 2rem;
		}

		.stat-card {
			background: var(--bg-secondary);
			border: 1px solid var(--border);
			border-radius: var(--radius);
			padding: 1.25rem;
			display: flex;
			flex-direction: column;
		}

		.stat-value { font-size: 2rem; font-weight: 700; }
		.stat-label { color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem; }

		.data-table {
			width: 100%;
			border-collapse: collapse;
			margin-bottom: 1.5rem;
		}

		.data-table th, .data-table td {
			padding: 0.625rem 0.75rem;
			text-align: left;
			border-bottom: 1px solid var(--border);
		}

		.data-table th {
			color: var(--text-muted);
			font-weight: 600;
			font-size: 0.8rem;
			text-transform: uppercase;
			letter-spacing: 0.05em;
		}

		.data-table tr:hover td { background: var(--bg-secondary); }

		.btn {
			display: inline-flex;
			align-items: center;
			gap: 0.375rem;
			padding: 0.5rem 1rem;
			border: 1px solid var(--border);
			border-radius: var(--radius);
			background: var(--bg-secondary);
			color: var(--text);
			font-family: var(--font);
			font-size: 0.85rem;
			cursor: pointer;
			transition: background 150ms, border-color 150ms;
			text-decoration: none;
		}

		.btn:hover { background: var(--bg-tertiary); border-color: var(--text-muted); }
		.btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
		.btn-primary:hover { background: var(--accent-hover); }
		.btn-danger { color: var(--danger); }
		.btn-danger:hover { background: rgba(239, 68, 68, 0.1); border-color: var(--danger); }
		.btn-sm { padding: 0.25rem 0.625rem; font-size: 0.8rem; }

		.badge {
			display: inline-block;
			padding: 0.15rem 0.5rem;
			border-radius: 9999px;
			font-size: 0.75rem;
			font-weight: 600;
		}

		.badge-published { background: rgba(34,197,94,0.15); color: var(--success); }
		.badge-draft { background: rgba(148,163,184,0.15); color: var(--text-muted); }
		.badge-scheduled { background: rgba(245,158,11,0.15); color: var(--warning); }

		.form-group { margin-bottom: 1rem; }
		.form-group label { display: block; margin-bottom: 0.375rem; color: var(--text-secondary); font-size: 0.85rem; }

		.form-input, .form-textarea, .form-select {
			width: 100%;
			padding: 0.5rem 0.75rem;
			background: var(--bg);
			border: 1px solid var(--border);
			border-radius: var(--radius);
			color: var(--text);
			font-family: var(--font);
			font-size: 0.9rem;
		}

		.form-input:focus, .form-textarea:focus, .form-select:focus {
			outline: none;
			border-color: var(--accent);
		}

		.form-textarea { min-height: 300px; resize: vertical; font-family: var(--font-mono); }

		.upload-form {
			display: flex;
			gap: 0.75rem;
			align-items: center;
			margin-bottom: 1.5rem;
			padding: 1rem;
			background: var(--bg-secondary);
			border: 1px solid var(--border);
			border-radius: var(--radius);
		}

		.media-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
			gap: 1rem;
		}

		.media-item {
			background: var(--bg-secondary);
			border: 1px solid var(--border);
			border-radius: var(--radius);
			overflow: hidden;
		}

		.media-preview {
			height: 140px;
			display: flex;
			align-items: center;
			justify-content: center;
			background: var(--bg);
		}

		.media-preview img { width: 100%; height: 100%; object-fit: cover; }

		.file-icon {
			font-size: 0.85rem;
			font-weight: 700;
			color: var(--text-muted);
			background: var(--bg-tertiary);
			padding: 0.5rem 0.75rem;
			border-radius: var(--radius);
		}

		.media-info {
			padding: 0.5rem 0.75rem;
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
		}

		.media-name { font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
		.media-size { font-size: 0.75rem; color: var(--text-muted); }

		.media-actions {
			padding: 0.5rem 0.75rem;
			border-top: 1px solid var(--border);
			display: flex;
			gap: 0.375rem;
		}

		.empty-state { color: var(--text-muted); padding: 2rem 0; }

		.alert {
			padding: 0.75rem 1rem;
			border-radius: var(--radius);
			margin-bottom: 1rem;
			font-size: 0.9rem;
		}

		.alert-error { background: rgba(239,68,68,0.1); color: var(--danger); border: 1px solid rgba(239,68,68,0.2); }

		@media (max-width: 768px) {
			.sidebar { display: none; }
			.main-content { margin-left: 0; }
		}
	</style>
</head>
<body>
	<aside class="sidebar">
		<div class="sidebar-brand">管理后台</div>
		<nav class="sidebar-nav">
			<a href="/api/admin">控制台</a>
			<a href="/api/admin/posts">文章</a>
			<a href="/api/admin/media">媒体</a>
			<a href="/api/admin/analytics">统计</a>
		</nav>
		<div class="sidebar-footer">
			<a href="/" target="_blank" rel="noopener noreferrer">查看站点</a>
			<br />
			${logoutForm}
		</div>
	</aside>
	<main class="main-content">
		${content}
	</main>
</body>
</html>`;
}
