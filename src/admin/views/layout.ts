import { escapeAttribute, escapeHtml } from "@/lib/security";

interface AdminLayoutOptions {
	csrfToken?: string;
}

type AdminNavKey = "dashboard" | "appearance" | "posts" | "media" | "analytics";

const navItems: Array<{ key: AdminNavKey; label: string; href: string }> = [
	{ key: "dashboard", label: "控制台", href: "/api/admin" },
	{ key: "appearance", label: "外观", href: "/api/admin/appearance" },
	{ key: "posts", label: "文章", href: "/api/admin/posts" },
	{ key: "media", label: "媒体", href: "/api/admin/media" },
	{ key: "analytics", label: "统计", href: "/api/admin/analytics" },
];

export const adminSharedStyles = `
		*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

		:root {
			color-scheme: light;
			--bg: #edf3f8;
			--bg-secondary: rgba(255, 255, 255, 0.56);
			--bg-tertiary: rgba(255, 255, 255, 0.34);
			--surface-elevated: rgba(255, 255, 255, 0.7);
			--text: #101828;
			--text-secondary: #3a4357;
			--text-muted: #6d7688;
			--border: rgba(15, 23, 42, 0.09);
			--border-strong: rgba(255, 255, 255, 0.44);
			--accent: #0a84ff;
			--accent-hover: #0066cc;
			--accent-soft: rgba(10, 132, 255, 0.14);
			--success: #16a34a;
			--warning: #d97706;
			--danger: #dc2626;
			--radius-sm: 18px;
			--radius: 24px;
			--radius-lg: 32px;
			--radius-pill: 999px;
			--font:
				"SF Pro Display", "SF Pro Text", "PingFang SC", "Hiragino Sans GB",
				"Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			--font-mono:
				"SF Mono", "JetBrains Mono", "Cascadia Code", "Menlo", "Consolas", monospace;
			--shadow-soft:
				0 24px 56px -34px rgba(15, 23, 42, 0.18),
				0 12px 20px -16px rgba(15, 23, 42, 0.1);
			--shadow-strong:
				0 26px 52px -28px rgba(8, 18, 34, 0.22),
				0 14px 24px -18px rgba(8, 18, 34, 0.16);
			--transition-fast: 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
			--transition-slow: 420ms cubic-bezier(0.22, 1, 0.36, 1);
			--shell-width: min(1440px, calc(100vw - 2rem));
			--sidebar-width: minmax(250px, 280px);
		}

		@media (prefers-color-scheme: dark) {
			:root {
				color-scheme: dark;
				--bg: #07111f;
				--bg-secondary: rgba(13, 24, 40, 0.76);
				--bg-tertiary: rgba(15, 27, 44, 0.6);
				--surface-elevated: rgba(17, 29, 48, 0.9);
				--text: #eef4ff;
				--text-secondary: #cad4e6;
				--text-muted: #93a1bc;
				--border: rgba(147, 161, 188, 0.16);
				--border-strong: rgba(147, 161, 188, 0.24);
				--accent: #57a6ff;
				--accent-hover: #88c0ff;
				--accent-soft: rgba(87, 166, 255, 0.16);
				--success: #4ade80;
				--warning: #fbbf24;
				--danger: #f87171;
				--shadow-soft:
					0 24px 60px -32px rgba(0, 0, 0, 0.44),
					0 12px 24px -18px rgba(0, 0, 0, 0.32);
				--shadow-strong:
					0 28px 68px -34px rgba(0, 0, 0, 0.5),
					0 16px 28px -20px rgba(0, 0, 0, 0.36);
			}
		}

		html {
			font-family: var(--font);
			font-size: 15px;
			line-height: 1.6;
			color: var(--text);
			background: var(--bg);
			-webkit-font-smoothing: antialiased;
			-moz-osx-font-smoothing: grayscale;
		}

		body {
			min-height: 100dvh;
			position: relative;
			overflow-x: hidden;
			background:
				radial-gradient(circle at 12% 10%, rgba(126, 192, 255, 0.18), transparent 22%),
				radial-gradient(circle at 88% 16%, rgba(255, 255, 255, 0.28), transparent 18%),
				radial-gradient(circle at 48% 104%, rgba(88, 192, 255, 0.11), transparent 24%),
				linear-gradient(180deg, rgba(255, 255, 255, 0.3), transparent 32%),
				var(--bg);
		}

		body::before,
		body::after {
			content: "";
			position: fixed;
			width: 24rem;
			height: 24rem;
			border-radius: 50%;
			filter: blur(74px);
			opacity: 0.22;
			pointer-events: none;
			z-index: 0;
			animation: admin-float 18s ease-in-out infinite;
		}

		body::before {
			top: -7rem;
			left: -7rem;
			background: rgba(125, 171, 255, 0.34);
		}

		body::after {
			right: -8rem;
			bottom: 8rem;
			background: rgba(255, 255, 255, 0.28);
			animation-delay: -7s;
		}

		a {
			color: inherit;
			text-decoration: none;
			transition:
				color var(--transition-fast),
				transform var(--transition-fast),
				opacity var(--transition-fast);
		}

		a:hover {
			color: var(--accent-hover);
		}

		button,
		input,
		textarea,
		select {
			font: inherit;
		}

		.admin-shell {
			position: relative;
			z-index: 1;
			width: var(--shell-width);
			margin: 0 auto;
			padding: 1.25rem 0 2rem;
			display: grid;
			grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
			gap: 1.5rem;
		}

		.sidebar {
			position: sticky;
			top: 1.25rem;
			align-self: start;
		}

		.sidebar-panel,
		.admin-toolbar,
		.table-card,
		.stat-card,
		.media-item,
		.upload-form,
		.appearance-panel,
		.appearance-stage {
			position: relative;
			background: var(--bg-secondary);
			border: 1px solid var(--border);
			border-radius: var(--radius-lg);
			backdrop-filter: blur(22px) saturate(138%);
			box-shadow: var(--shadow-soft);
			overflow: hidden;
		}

		.sidebar-panel::before,
		.admin-toolbar::before,
		.table-card::before,
		.stat-card::before,
		.media-item::before,
		.upload-form::before,
		.appearance-panel::before {
			content: "";
			position: absolute;
			inset: 0;
			background:
				linear-gradient(180deg, rgba(255, 255, 255, 0.14), transparent 22%),
				radial-gradient(circle at top left, rgba(10, 132, 255, 0.1), transparent 26%);
			pointer-events: none;
		}

		.sidebar-panel {
			min-height: calc(100dvh - 2.5rem);
			padding: 1rem;
			display: flex;
			flex-direction: column;
			gap: 1rem;
		}

		.sidebar-brand {
			position: relative;
			padding: 1.15rem 1.15rem 1.25rem;
			border-radius: calc(var(--radius-lg) - 8px);
			background: var(--bg-tertiary);
			border: 1px solid var(--border);
			box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
		}

		.sidebar-brand-badge {
			display: inline-flex;
			align-items: center;
			padding: 0.3rem 0.7rem;
			margin-bottom: 0.8rem;
			border-radius: var(--radius-pill);
			background: var(--accent-soft);
			color: var(--accent);
			font-size: 0.8rem;
			font-weight: 600;
			letter-spacing: 0.02em;
		}

		.sidebar-brand-title {
			font-size: 1.45rem;
			font-weight: 700;
			letter-spacing: -0.03em;
		}

		.sidebar-brand-copy {
			margin-top: 0.5rem;
			color: var(--text-muted);
			font-size: 0.92rem;
			line-height: 1.75;
		}

		.sidebar-nav {
			display: grid;
			gap: 0.55rem;
			flex: 1;
		}

		.sidebar-nav a {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.75rem;
			padding: 0.92rem 1rem;
			border-radius: var(--radius);
			color: var(--text-secondary);
			background: rgba(255, 255, 255, 0);
			border: 1px solid transparent;
			transform: translate3d(0, 0, 0);
		}

		.sidebar-nav a::after {
			content: "›";
			color: var(--text-muted);
			transition:
				transform var(--transition-fast),
				color var(--transition-fast);
		}

		.sidebar-nav a:hover,
		.sidebar-nav a.active {
			color: var(--text);
			background: var(--surface-elevated);
			border-color: var(--border-strong);
			box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
			transform: translate3d(4px, 0, 0);
		}

		.sidebar-nav a:hover::after,
		.sidebar-nav a.active::after {
			color: var(--accent);
			transform: translate3d(2px, 0, 0);
		}

		.sidebar-nav a.active {
			background:
				linear-gradient(135deg, rgba(10, 132, 255, 0.14), transparent 82%),
				var(--surface-elevated);
		}

		.sidebar-footer {
			display: grid;
			gap: 0.85rem;
			padding: 1rem;
			border-radius: calc(var(--radius-lg) - 8px);
			background: var(--bg-tertiary);
			border: 1px solid var(--border);
		}

		.sidebar-footer-copy {
			color: var(--text-muted);
			font-size: 0.86rem;
			line-height: 1.75;
		}

		.sidebar-footer-links {
			display: flex;
			flex-wrap: wrap;
			gap: 0.65rem;
			align-items: center;
		}

		.sidebar-footer form {
			width: 100%;
		}

		.main-content {
			display: grid;
			align-content: start;
			gap: 1.25rem;
			min-width: 0;
		}

		.admin-toolbar {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 1rem;
			padding: 1.15rem 1.35rem;
		}

		.admin-toolbar-copy {
			display: grid;
			gap: 0.22rem;
		}

		.admin-toolbar-kicker {
			color: var(--text-muted);
			font-size: 0.82rem;
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}

		.admin-toolbar-title {
			font-size: 1.05rem;
			font-weight: 600;
			color: var(--text);
		}

		.admin-toolbar-note {
			color: var(--text-secondary);
			font-size: 0.9rem;
		}

		.admin-toolbar-actions {
			display: flex;
			flex-wrap: wrap;
			gap: 0.65rem;
			align-items: center;
			justify-content: flex-end;
		}

		.page-header,
		.section-heading {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			justify-content: space-between;
			gap: 1rem;
			margin-bottom: 1.2rem;
		}

		.page-actions,
		.table-actions,
		.form-actions {
			display: flex;
			flex-wrap: wrap;
			gap: 0.6rem;
			align-items: center;
		}

		.page-header h1,
		.section-heading h2 {
			margin-bottom: 0;
		}

		.form-actions {
			margin-top: 1.5rem;
		}

		.page-intro {
			color: var(--text-muted);
			font-size: 0.95rem;
			line-height: 1.8;
			margin-top: -0.5rem;
			margin-bottom: 1.5rem;
		}

		h1 {
			font-size: clamp(1.9rem, 1.55rem + 1vw, 2.7rem);
			line-height: 1.08;
			letter-spacing: -0.04em;
			margin-bottom: 1.35rem;
		}

		h2 {
			font-size: 1.1rem;
			color: var(--text-secondary);
			margin: 1.4rem 0 1rem;
			letter-spacing: -0.02em;
		}

		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
			gap: 1rem;
			margin-bottom: 1.75rem;
		}

		.stat-card {
			display: grid;
			gap: 0.55rem;
			padding: 1.35rem;
			transform: translate3d(0, 0, 0);
			transition:
				transform var(--transition-fast),
				box-shadow var(--transition-fast),
				border-color var(--transition-fast);
		}

		.stat-card:hover {
			transform: translate3d(0, -4px, 0);
			box-shadow: var(--shadow-strong);
			border-color: var(--border-strong);
		}

		.stat-value {
			font-size: clamp(2.2rem, 1.9rem + 1vw, 3rem);
			font-weight: 700;
			line-height: 1;
			letter-spacing: -0.05em;
		}

		.stat-label {
			color: var(--text-muted);
			font-size: 0.88rem;
			text-transform: uppercase;
			letter-spacing: 0.08em;
		}

		.table-card {
			padding: 0.4rem 0;
			margin-bottom: 1.5rem;
		}

		.data-table {
			width: 100%;
			border-collapse: collapse;
		}

		.data-table th, .data-table td {
			padding: 0.95rem 1.15rem;
			text-align: left;
			border-bottom: 1px solid var(--border);
			vertical-align: middle;
		}

		.data-table th {
			color: var(--text-muted);
			font-size: 0.78rem;
			font-weight: 700;
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}

		.data-table tbody tr {
			transition: background-color var(--transition-fast);
		}

		.data-table tbody tr:hover {
			background: rgba(255, 255, 255, 0.1);
		}

		.data-table tbody tr:last-child td {
			border-bottom: 0;
		}

		.data-table td a:not(.btn) {
			color: var(--text);
			font-weight: 600;
		}

		.table-actions form {
			display: inline-flex;
		}

		.btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 0.45rem;
			padding: 0.72rem 1.1rem;
			border: 1px solid var(--border);
			border-radius: var(--radius-pill);
			background: var(--bg-tertiary);
			color: var(--text);
			cursor: pointer;
			box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
			transition:
				transform var(--transition-fast),
				border-color var(--transition-fast),
				background-color var(--transition-fast),
				box-shadow var(--transition-fast);
		}

		.btn:hover {
			transform: translate3d(0, -2px, 0);
			color: var(--text);
			background: var(--surface-elevated);
			border-color: var(--border-strong);
			box-shadow: var(--shadow-soft);
		}

		.btn-primary {
			background:
				linear-gradient(135deg, rgba(255, 255, 255, 0.18), transparent 72%),
				var(--accent);
			color: #fff;
			border-color: transparent;
			box-shadow:
				0 18px 38px -24px rgba(10, 132, 255, 0.5),
				inset 0 1px 0 rgba(255, 255, 255, 0.18);
		}

		.btn-primary:hover {
			background:
				linear-gradient(135deg, rgba(255, 255, 255, 0.22), transparent 72%),
				var(--accent-hover);
			color: #fff;
		}

		.btn-danger {
			color: var(--danger);
		}

		.btn-danger:hover {
			border-color: rgba(220, 38, 38, 0.28);
			background: rgba(220, 38, 38, 0.08);
			color: var(--danger);
		}

		.btn-sm {
			padding: 0.5rem 0.82rem;
			font-size: 0.82rem;
		}

		.badge {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			padding: 0.3rem 0.7rem;
			border-radius: var(--radius-pill);
			font-size: 0.75rem;
			font-weight: 700;
			letter-spacing: 0.04em;
		}

		.badge-published { background: rgba(22, 163, 74, 0.14); color: var(--success); }
		.badge-draft { background: rgba(109, 118, 136, 0.14); color: var(--text-muted); }
		.badge-scheduled { background: rgba(217, 119, 6, 0.14); color: var(--warning); }

		.form-group {
			margin-bottom: 1rem;
		}

		.form-group label {
			display: block;
			margin-bottom: 0.45rem;
			color: var(--text-secondary);
			font-size: 0.88rem;
			font-weight: 600;
		}

		.form-input, .form-textarea, .form-select {
			width: 100%;
			padding: 0.78rem 0.95rem;
			border-radius: var(--radius);
			border: 1px solid var(--border);
			background: rgba(255, 255, 255, 0.34);
			color: var(--text);
			box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
			transition:
				border-color var(--transition-fast),
				box-shadow var(--transition-fast),
				background-color var(--transition-fast);
		}

		.form-input:focus, .form-textarea:focus, .form-select:focus {
			outline: none;
			border-color: rgba(10, 132, 255, 0.42);
			box-shadow:
				0 0 0 4px rgba(10, 132, 255, 0.14),
				inset 0 1px 0 rgba(255, 255, 255, 0.24);
			background: rgba(255, 255, 255, 0.46);
		}

		.form-textarea {
			min-height: 320px;
			resize: vertical;
			font-family: var(--font-mono);
		}

		.editor-grid {
			display: grid;
			grid-template-columns: minmax(0, 1.8fr) minmax(280px, 1fr);
			gap: 1.5rem;
		}

		.editor-panel {
			padding: 1.25rem;
			background: var(--bg-secondary);
			border: 1px solid var(--border);
			border-radius: var(--radius-lg);
			backdrop-filter: blur(22px) saturate(138%);
			box-shadow: var(--shadow-soft);
		}

		.editor-panel details {
			padding: 1rem;
			margin-bottom: 1rem;
			border-radius: var(--radius);
			background: var(--bg-tertiary);
			border: 1px solid var(--border);
		}

		.editor-panel summary {
			cursor: pointer;
			color: var(--text-secondary);
			font-weight: 600;
			list-style: none;
		}

		.editor-panel summary::-webkit-details-marker {
			display: none;
		}

		.tag-list {
			display: flex;
			flex-wrap: wrap;
			gap: 0.55rem;
		}

		.tag-chip {
			display: inline-flex;
			align-items: center;
			gap: 0.42rem;
			padding: 0.48rem 0.75rem;
			border-radius: var(--radius-pill);
			background: var(--bg-tertiary);
			border: 1px solid var(--border);
			font-size: 0.84rem;
			cursor: pointer;
			transition:
				transform var(--transition-fast),
				border-color var(--transition-fast),
				background-color var(--transition-fast);
		}

		.tag-chip:hover {
			transform: translate3d(0, -1px, 0);
			background: var(--surface-elevated);
			border-color: var(--border-strong);
		}

		.upload-form {
			display: flex;
			flex-wrap: wrap;
			gap: 0.85rem;
			align-items: center;
			padding: 1rem 1.1rem;
			margin-bottom: 1.35rem;
		}

		.media-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
			gap: 1rem;
		}

		.media-item {
			display: grid;
			grid-template-rows: 156px auto auto;
			transition:
				transform var(--transition-fast),
				box-shadow var(--transition-fast),
				border-color var(--transition-fast);
		}

		.media-item:hover {
			transform: translate3d(0, -4px, 0);
			box-shadow: var(--shadow-strong);
			border-color: var(--border-strong);
		}

		.media-preview {
			display: flex;
			align-items: center;
			justify-content: center;
			background:
				radial-gradient(circle at top left, rgba(10, 132, 255, 0.12), transparent 22%),
				var(--bg-tertiary);
			border-bottom: 1px solid var(--border);
		}

		.media-preview img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}

		.file-icon {
			font-size: 0.84rem;
			font-weight: 700;
			color: var(--text-muted);
			padding: 0.55rem 0.8rem;
			border-radius: var(--radius-pill);
			background: rgba(255, 255, 255, 0.26);
			border: 1px solid var(--border);
		}

		.media-info {
			padding: 0.8rem 0.95rem 0.4rem;
			display: grid;
			gap: 0.2rem;
		}

		.media-name {
			font-size: 0.86rem;
			font-weight: 600;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.media-size {
			font-size: 0.78rem;
			color: var(--text-muted);
		}

		.media-actions {
			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem;
			padding: 0.9rem 0.95rem 1rem;
			border-top: 1px solid var(--border);
		}

		.empty-state {
			padding: 1.2rem 1.25rem;
			margin-bottom: 1.5rem;
			color: var(--text-muted);
			background: var(--bg-secondary);
			border: 1px solid var(--border);
			border-radius: var(--radius-lg);
			backdrop-filter: blur(18px) saturate(135%);
			box-shadow: var(--shadow-soft);
		}

		.alert {
			padding: 0.95rem 1.05rem;
			margin-bottom: 1rem;
			border-radius: var(--radius);
			font-size: 0.92rem;
			line-height: 1.7;
			backdrop-filter: blur(16px);
		}

		.alert-error {
			background: rgba(220, 38, 38, 0.1);
			color: var(--danger);
			border: 1px solid rgba(220, 38, 38, 0.18);
		}

		.alert-success {
			background: rgba(22, 163, 74, 0.1);
			color: var(--success);
			border: 1px solid rgba(22, 163, 74, 0.18);
		}

		@keyframes admin-float {
			0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
			50% { transform: translate3d(0, 20px, 0) scale(1.08); }
		}

		@media (max-width: 1080px) {
			.admin-shell {
				grid-template-columns: 1fr;
			}

			.sidebar {
				position: static;
			}

			.sidebar-panel {
				min-height: auto;
			}

			.sidebar-nav {
				grid-template-columns: repeat(3, minmax(0, 1fr));
			}

			.editor-grid {
				grid-template-columns: 1fr;
			}
		}

		@media (max-width: 720px) {
			.admin-shell {
				width: min(100vw - 1rem, 100%);
				padding-top: 0.7rem;
				gap: 1rem;
			}

			.sidebar-panel,
			.admin-toolbar,
			.editor-panel,
			.table-card,
			.stat-card,
			.media-item,
			.upload-form {
				border-radius: 26px;
			}

			.sidebar-nav {
				grid-template-columns: repeat(2, minmax(0, 1fr));
			}

			.admin-toolbar {
				padding: 1rem 1.1rem;
			}

			.admin-toolbar-actions,
			.page-actions,
			.table-actions,
			.form-actions,
			.media-actions,
			.sidebar-footer-links {
				width: 100%;
				justify-content: flex-start;
			}

			.data-table th, .data-table td {
				padding: 0.82rem 0.9rem;
			}
		}
`;

function resolveActiveNav(title: string): AdminNavKey {
	if (title.includes("外观")) return "appearance";
	if (
		title.includes("文章") ||
		title.includes("编辑") ||
		title.includes("新建")
	) {
		return "posts";
	}
	if (title.includes("媒体")) return "media";
	if (title.includes("统计")) return "analytics";
	return "dashboard";
}

function renderNav(title: string): string {
	const activeNav = resolveActiveNav(title);

	return navItems
		.map(
			(
				item,
			) => `<a href="${item.href}"${item.key === activeNav ? ' class="active"' : ""}>
				<span>${item.label}</span>
			</a>`,
		)
		.join("");
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
${adminSharedStyles}
	</style>
</head>
<body>
	<div class="admin-shell">
		<aside class="sidebar">
			<div class="sidebar-panel">
				<div class="sidebar-brand">
					<span class="sidebar-brand-badge">主页同款视觉</span>
					<div class="sidebar-brand-title">管理后台</div>
					<p class="sidebar-brand-copy">和前台共用胶囊、毛玻璃与柔和缓动，减少后台和站点主界面的割裂感。</p>
				</div>
				<nav class="sidebar-nav">
					${renderNav(title)}
				</nav>
				<div class="sidebar-footer">
					<p class="sidebar-footer-copy">当前后台仅支持 GitHub OAuth 登录，并继续沿用前台那套轻量玻璃面板语言。</p>
					<div class="sidebar-footer-links">
						<a href="/" target="_blank" rel="noopener noreferrer" class="btn btn-sm">查看站点</a>
					</div>
					${logoutForm}
				</div>
			</div>
		</aside>
		<main class="main-content">
			<header class="admin-toolbar">
				<div class="admin-toolbar-copy">
					<span class="admin-toolbar-kicker">后台工作台</span>
					<div class="admin-toolbar-title">${escapeHtml(title)}</div>
					<p class="admin-toolbar-note">在内容管理、媒体维护和站点配置之间保持和主页一致的浮层体验。</p>
				</div>
				<div class="admin-toolbar-actions">
					<a href="/" target="_blank" rel="noopener noreferrer" class="btn btn-sm">打开前台</a>
				</div>
			</header>
			<section class="admin-page-content">
				${content}
			</section>
		</main>
	</div>
</body>
</html>`;
}
