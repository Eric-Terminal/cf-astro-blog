import { escapeAttribute, escapeHtml } from "@/lib/security";

interface AdminLayoutOptions {
	csrfToken?: string;
}

type AdminNavKey =
	| "dashboard"
	| "appearance"
	| "posts"
	| "friends"
	| "mentions"
	| "media"
	| "analytics";

const navItems: Array<{ key: AdminNavKey; label: string; href: string }> = [
	{ key: "dashboard", label: "控制台", href: "/api/admin" },
	{ key: "appearance", label: "外观", href: "/api/admin/appearance" },
	{ key: "posts", label: "文章", href: "/api/admin/posts" },
	{ key: "friends", label: "友链", href: "/api/admin/friends" },
	{ key: "mentions", label: "提及", href: "/api/admin/mentions" },
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
			--card-surface-rgb: 255, 255, 255;
			--card-sheen-rgb: 255, 255, 255;
		}

		@media (prefers-color-scheme: dark) {
			:root:not([data-theme="light"]) {
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
				--card-surface-rgb: 24, 36, 54;
				--card-sheen-rgb: 142, 178, 224;
			}
			:root:not([data-theme="light"]) body {
				background:
					radial-gradient(circle at 12% 10%, rgba(30, 80, 200, 0.22), transparent 28%),
					radial-gradient(circle at 88% 16%, rgba(10, 40, 100, 0.18), transparent 24%),
					radial-gradient(circle at 48% 104%, rgba(20, 60, 160, 0.16), transparent 30%),
					var(--bg);
			}
			:root:not([data-theme="light"]) body::after {
				background: rgba(48, 100, 220, 0.22);
			}
		}

		[data-theme="dark"] {
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
			--card-surface-rgb: 24, 36, 54;
			--card-sheen-rgb: 142, 178, 224;
		}

		[data-theme="dark"] body {
			background:
				radial-gradient(circle at 12% 10%, rgba(30, 80, 200, 0.22), transparent 28%),
				radial-gradient(circle at 88% 16%, rgba(10, 40, 100, 0.18), transparent 24%),
				radial-gradient(circle at 48% 104%, rgba(20, 60, 160, 0.16), transparent 30%),
				var(--bg);
		}

		[data-theme="dark"] body::after {
			background: rgba(48, 100, 220, 0.22);
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
			animation: admin-page-in 400ms cubic-bezier(0.22, 1, 0.36, 1) both;
		}

		.sidebar {
			position: sticky;
			top: 1.25rem;
			align-self: start;
		}

		.sidebar-panel,
		.table-card,
		.stat-card,
		.media-item,
		.upload-form,
		.appearance-panel,
		.appearance-stage {
			position: relative;
			background: rgba(var(--card-surface-rgb), 0.11);
			border: 1px solid var(--border);
			border-radius: var(--radius-lg);
			backdrop-filter: blur(24px) saturate(140%);
			-webkit-backdrop-filter: blur(24px) saturate(140%);
			box-shadow:
				var(--shadow-soft),
				inset 0 1px 0 rgba(var(--card-sheen-rgb), 0.16);
			overflow: hidden;
		}

		.sidebar-panel::before,
		.table-card::before,
		.stat-card::before,
		.media-item::before,
		.upload-form::before,
		.appearance-panel::before {
			content: "";
			position: absolute;
			inset: 0;
			background:
				linear-gradient(160deg, rgba(var(--card-sheen-rgb), 0.1), transparent 40%),
				radial-gradient(circle at top left, rgba(10, 132, 255, 0.08), transparent 30%);
			pointer-events: none;
			z-index: 0;
		}

		.sidebar-panel {
			min-height: calc(100dvh - 2.5rem);
			padding: 1rem;
			display: flex;
			flex-direction: column;
			gap: 1rem;
		}

		.sidebar-brand {
			display: flex;
			align-items: center;
			gap: 0.65rem;
			padding: 0.2rem 0.4rem 0.9rem;
			border-bottom: 1px solid var(--border);
			margin-bottom: 0.2rem;
		}

		.sidebar-brand-mark {
			width: 2.1rem;
			height: 2.1rem;
			border-radius: 10px;
			background:
				linear-gradient(135deg, rgba(255, 255, 255, 0.22), transparent 72%),
				var(--accent);
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 0.82rem;
			font-weight: 700;
			color: #fff;
			box-shadow:
				0 4px 14px -6px rgba(10, 132, 255, 0.55),
				inset 0 1px 0 rgba(255, 255, 255, 0.24);
			flex-shrink: 0;
			letter-spacing: -0.02em;
		}

		.sidebar-brand-info {
			display: grid;
			gap: 0.06rem;
			min-width: 0;
		}

		.sidebar-brand-title {
			font-size: 0.9rem;
			font-weight: 700;
			letter-spacing: -0.02em;
			color: var(--text);
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.sidebar-brand-subtitle {
			font-size: 0.68rem;
			color: var(--text-muted);
			letter-spacing: 0.05em;
			text-transform: uppercase;
		}

		.sidebar-nav {
			display: grid;
			gap: 0.55rem;
			align-content: start;
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
			box-shadow: inset 0 1px 0 rgba(var(--card-sheen-rgb), 0.18);
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
			gap: 0.65rem;
			padding: 1rem;
			margin-top: auto;
			border-radius: calc(var(--radius-lg) - 8px);
			background: var(--bg-tertiary);
			border: 1px solid var(--border);
		}

		.admin-toolbar {
			display: grid;
			gap: 0.65rem;
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
			min-width: 0;
		}

		.admin-page-content {
			min-width: 0;
			width: 100%;
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
			overflow-x: auto;
			overflow-y: hidden;
			-webkit-overflow-scrolling: touch;
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
			background: rgba(var(--card-sheen-rgb), 0.06);
		}

		.data-table tbody tr:last-child td {
			border-bottom: 0;
		}

		.data-table td a:not(.btn) {
			color: var(--text);
			font-weight: 600;
		}

		.table-cell-break {
			white-space: normal;
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.table-actions form {
			display: inline-flex;
		}

		.analytics-actions .btn {
			max-width: 100%;
			white-space: normal;
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
			box-shadow: inset 0 1px 0 rgba(var(--card-sheen-rgb), 0.16);
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

		.form-group-tight {
			margin-bottom: 0;
		}

		.form-group.is-disabled {
			opacity: 0.72;
		}

		.is-hidden {
			display: none !important;
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
			background: var(--bg-tertiary);
			color: var(--text);
			box-shadow: inset 0 1px 0 rgba(var(--card-sheen-rgb), 0.14);
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
				inset 0 1px 0 rgba(var(--card-sheen-rgb), 0.2);
			background: var(--bg-secondary);
		}

		.form-textarea {
			min-height: 320px;
			resize: vertical;
			font-family: var(--font-mono);
			line-height: 1.7;
		}

		.form-textarea.is-dragover {
			border-color: rgba(10, 132, 255, 0.55);
			background: rgba(10, 132, 255, 0.08);
			box-shadow:
				0 0 0 4px rgba(10, 132, 255, 0.16),
				inset 0 1px 0 rgba(var(--card-sheen-rgb), 0.22);
		}

		.form-help {
			margin-top: 0.4rem;
			color: var(--text-muted);
			font-size: 0.8rem;
			line-height: 1.6;
		}

		.form-help.is-error {
			color: var(--danger);
		}

		.form-help.is-success {
			color: var(--success);
		}

		.appearance-inline-grid {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.75rem 0.85rem;
			align-items: end;
		}

		.review-card {
			margin-bottom: 1rem;
			padding: 1rem 1.05rem 1.05rem;
		}

		.friend-review-item {
			padding: 0;
		}

		.friend-review-summary {
			list-style: none;
			cursor: pointer;
			display: flex;
			align-items: flex-start;
			justify-content: space-between;
			gap: 0.9rem;
			padding: 1rem 1.05rem;
		}

		.friend-review-summary::-webkit-details-marker {
			display: none;
		}

		.friend-review-summary::marker {
			content: "";
		}

		.friend-review-summary-main {
			min-width: 0;
			flex: 1;
		}

		.friend-review-summary-extra {
			min-width: min(42%, 20rem);
			display: grid;
			gap: 0.48rem;
			justify-items: end;
			align-content: start;
		}

		.friend-review-summary-site {
			margin: 0;
			color: var(--text-secondary);
			font-size: 0.84rem;
			line-height: 1.45;
			word-break: break-all;
			text-align: right;
		}

		.friend-review-summary-state {
			display: inline-flex;
			align-items: center;
			gap: 0.56rem;
		}

		.friend-review-summary-caret {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 1.2rem;
			height: 1.2rem;
			border-radius: 999px;
			border: 1px solid var(--border);
			color: var(--text-muted);
			font-size: 0.72rem;
			line-height: 1;
			transition:
				transform var(--transition-fast),
				border-color var(--transition-fast),
				color var(--transition-fast);
		}

		.friend-review-summary-caret::before {
			content: "▾";
		}

		.friend-review-item[open] .friend-review-summary {
			background: rgba(10, 132, 255, 0.06);
			border-bottom: 1px solid var(--border);
		}

		.friend-review-item[open] .friend-review-summary-caret {
			color: var(--accent);
			border-color: rgba(10, 132, 255, 0.4);
			transform: rotate(180deg);
		}

		.friend-review-content {
			padding: 0.95rem 1.05rem 1.05rem;
		}

		.review-card-header {
			display: flex;
			align-items: flex-start;
			justify-content: space-between;
			gap: 0.8rem;
			flex-wrap: wrap;
			margin-bottom: 0.8rem;
		}

		.review-card-title {
			margin-bottom: 0.2rem;
			font-size: 1.25rem;
			line-height: 1.2;
		}

		.review-card-meta {
			margin-top: 0;
		}

		.review-card-body {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.72rem 1rem;
			margin-bottom: 0.9rem;
		}

		.review-item {
			min-width: 0;
			display: grid;
			gap: 0.25rem;
			align-content: start;
		}

		.review-item-span-2 {
			grid-column: 1 / -1;
		}

		.review-item-label {
			font-size: 0.75rem;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: var(--text-muted);
		}

		.review-item-value {
			color: var(--text);
			line-height: 1.55;
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.review-item-value a {
			color: var(--accent);
			text-decoration: underline;
			text-underline-offset: 0.14em;
		}

		.review-card-actions {
			display: grid;
			gap: 0.68rem;
			padding-top: 0.88rem;
			border-top: 1px solid var(--border);
		}

		.review-review-form,
		.review-delete-form {
			margin: 0;
		}

		.draft-toolbar {
			margin-top: 0.46rem;
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.48rem 0.6rem;
		}

		.draft-toolbar .form-help {
			margin-top: 0;
		}

		.markdown-editor-shell {
			display: grid;
			grid-template-columns: minmax(0, 1.08fr) minmax(280px, 1fr);
			gap: 0.85rem;
			align-items: stretch;
		}

		.markdown-editor-shell .form-textarea {
			min-height: 420px;
		}

		.markdown-preview-panel {
			display: grid;
			grid-template-rows: auto minmax(0, 1fr);
			border-radius: var(--radius);
			border: 1px solid var(--border);
			background: var(--bg-tertiary);
			box-shadow: inset 0 1px 0 rgba(var(--card-sheen-rgb), 0.14);
			overflow: hidden;
		}

		.markdown-preview-head {
			padding: 0.7rem 0.88rem;
			font-size: 0.78rem;
			color: var(--text-muted);
			letter-spacing: 0.05em;
			text-transform: uppercase;
			border-bottom: 1px solid var(--border);
			background: var(--bg-secondary);
		}

		.markdown-preview-body {
			min-height: 420px;
			max-height: 620px;
			overflow: auto;
			padding: 0.95rem 1rem 1.05rem;
			color: var(--text);
			line-height: 1.8;
			word-break: break-word;
		}

		.markdown-preview-body .markdown-preview-empty {
			color: var(--text-muted);
			font-size: 0.9rem;
		}

		.markdown-preview-body h1,
		.markdown-preview-body h2,
		.markdown-preview-body h3,
		.markdown-preview-body h4,
		.markdown-preview-body h5,
		.markdown-preview-body h6 {
			margin: 0.2rem 0 0.72rem;
			line-height: 1.35;
			color: var(--text);
		}

		.markdown-preview-body h1 {
			font-size: 1.5rem;
		}

		.markdown-preview-body h2 {
			font-size: 1.3rem;
		}

		.markdown-preview-body h3 {
			font-size: 1.14rem;
		}

		.markdown-preview-body p {
			margin: 0 0 0.8rem;
		}

		.markdown-preview-body ul,
		.markdown-preview-body ol {
			margin: 0.2rem 0 0.8rem 1.1rem;
		}

		.markdown-preview-body li + li {
			margin-top: 0.18rem;
		}

		.markdown-preview-body blockquote {
			margin: 0.2rem 0 0.9rem;
			padding: 0.12rem 0.82rem;
			border-left: 3px solid rgba(10, 132, 255, 0.42);
			color: var(--text-secondary);
			background: rgba(10, 132, 255, 0.08);
			border-radius: 0 12px 12px 0;
		}

		.markdown-preview-body blockquote > :first-child {
			margin-top: 0;
		}

		.markdown-preview-body blockquote > :last-child {
			margin-bottom: 0;
		}

		.markdown-preview-body details {
			margin: 0.2rem 0 0.9rem;
			border-radius: 12px;
			border: 1px solid var(--border);
			background: rgba(10, 132, 255, 0.06);
			overflow: hidden;
		}

		.markdown-preview-body details summary {
			cursor: pointer;
			padding: 0.64rem 0.82rem;
			font-weight: 600;
		}

		.markdown-preview-body details > :not(summary) {
			padding: 0 0.82rem 0.82rem;
		}

		.markdown-preview-body .markdown-preview-spoiler {
			display: inline;
			padding: 0.08em 0.32em;
			border-radius: 0.38em;
			background: rgba(15, 23, 42, 0.22);
			filter: blur(0.38em);
			transition:
				filter var(--transition-fast),
				background-color var(--transition-fast);
			cursor: help;
		}

		.markdown-preview-body .markdown-preview-spoiler:hover,
		.markdown-preview-body .markdown-preview-spoiler:focus,
		.markdown-preview-body .markdown-preview-spoiler:focus-visible {
			filter: blur(0);
			background: rgba(10, 132, 255, 0.12);
		}

		.markdown-preview-body pre {
			margin: 0.2rem 0 0.9rem;
			padding: 0.7rem 0.82rem;
			border-radius: 12px;
			background: rgba(15, 23, 42, 0.9);
			color: #dbe7ff;
			overflow: auto;
			font-size: 0.86rem;
			line-height: 1.62;
		}

		.markdown-preview-body code {
			padding: 0.08rem 0.34rem;
			border-radius: 8px;
			background: rgba(10, 132, 255, 0.1);
			font-family: var(--font-mono);
			font-size: 0.84em;
		}

		.markdown-preview-body pre code {
			padding: 0;
			border-radius: 0;
			background: transparent;
		}

		.markdown-preview-body a {
			color: var(--accent);
			text-decoration: underline;
			text-underline-offset: 0.14em;
		}

		.markdown-preview-body img {
			display: block;
			max-width: 100%;
			height: auto;
			margin: 0.3rem 0 0.9rem;
			border-radius: 12px;
		}

		.form-readonly {
			padding: 0.72rem 0.95rem;
			border-radius: var(--radius);
			border: 1px solid var(--border);
			background: var(--bg-tertiary);
			color: var(--text);
			font-weight: 600;
		}

		.cover-uploader {
			display: grid;
			gap: 0.65rem;
		}

		.cover-dropzone {
			position: relative;
			min-height: 168px;
			border-radius: var(--radius);
			border: 1px dashed var(--border);
			background:
				radial-gradient(circle at top left, rgba(10, 132, 255, 0.08), transparent 28%),
				var(--bg-tertiary);
			display: flex;
			align-items: center;
			justify-content: center;
			overflow: hidden;
			cursor: pointer;
			transition:
				border-color var(--transition-fast),
				background-color var(--transition-fast),
				transform var(--transition-fast);
		}

		.cover-dropzone:hover,
		.cover-dropzone.is-dragover {
			border-color: rgba(10, 132, 255, 0.42);
			background-color: rgba(10, 132, 255, 0.08);
			transform: translate3d(0, -1px, 0);
		}

		.cover-empty {
			padding: 0 1rem;
			text-align: center;
			color: var(--text-muted);
			font-size: 0.85rem;
			line-height: 1.7;
		}

		.cover-preview-image {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}

		.cover-actions {
			display: flex;
			flex-wrap: wrap;
			gap: 0.6rem;
		}

		.editor-background-grid {
			display: grid;
			gap: 0.72rem;
		}

		.editor-background-range {
			display: grid;
			gap: 0.42rem;
		}

		.editor-background-range-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.7rem;
		}

		.editor-background-range-head label {
			margin-bottom: 0;
		}

		.editor-background-range-head span {
			font-size: 0.82rem;
			color: var(--text-muted);
		}

		.editor-background-range input[type="range"] {
			width: 100%;
		}

		.new-category-wrap {
			margin-top: 0.7rem;
		}

		.new-category-wrap.is-disabled {
			opacity: 0.72;
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

		.editor-grid {
			display: grid;
			grid-template-columns: minmax(0, 1.8fr) minmax(280px, 1fr);
			gap: 1.5rem;
		}

		.editor-panel {
			padding: 1.25rem;
			background: rgba(var(--card-surface-rgb), 0.11);
			border: 1px solid var(--border);
			border-radius: var(--radius-lg);
			backdrop-filter: blur(24px) saturate(140%);
			-webkit-backdrop-filter: blur(24px) saturate(140%);
			box-shadow:
				var(--shadow-soft),
				inset 0 1px 0 rgba(var(--card-sheen-rgb), 0.16);
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

		.media-upload-form {
			display: grid;
			gap: 0.85rem;
			align-items: stretch;
		}

		.media-upload-input {
			display: none;
		}

		.media-upload-dropzone {
			position: relative;
			width: 100%;
			aspect-ratio: 5 / 2;
			border: 1px dashed rgba(10, 132, 255, 0.34);
			border-radius: var(--radius);
			background:
				linear-gradient(140deg, rgba(10, 132, 255, 0.08), rgba(10, 132, 255, 0.02)),
				rgba(255, 255, 255, 0.02);
			display: grid;
			place-items: center;
			padding: 1rem;
			text-align: center;
			cursor: pointer;
			transition:
				border-color var(--transition-fast),
				background-color var(--transition-fast),
				transform var(--transition-fast);
		}

		.media-upload-dropzone:hover,
		.media-upload-dropzone.is-dragover {
			border-color: rgba(10, 132, 255, 0.65);
			background:
				linear-gradient(140deg, rgba(10, 132, 255, 0.16), rgba(10, 132, 255, 0.06)),
				rgba(255, 255, 255, 0.03);
			transform: translateY(-1px);
		}

		.media-upload-dropzone:focus-visible {
			outline: 2px solid rgba(10, 132, 255, 0.6);
			outline-offset: 2px;
		}

		.media-upload-copy {
			display: grid;
			gap: 0.4rem;
			color: var(--text-secondary);
		}

		.media-upload-copy strong {
			font-size: 1rem;
			color: var(--text);
		}

		.media-upload-copy span {
			font-size: 0.86rem;
			color: var(--text-muted);
			word-break: break-word;
		}

		.media-upload-actions {
			display: flex;
			justify-content: flex-end;
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

		.media-directory {
			font-size: 0.76rem;
			color: var(--text-muted);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
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

		@keyframes admin-page-in {
			from { opacity: 0; transform: translateY(8px); }
			to { opacity: 1; transform: translateY(0); }
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

			.markdown-editor-shell {
				grid-template-columns: 1fr;
			}

			.analytics-actions {
				width: 100%;
				justify-content: flex-start;
			}

			.review-card-body {
				grid-template-columns: 1fr;
			}

			.friend-review-summary {
				flex-direction: column;
				align-items: flex-start;
			}

			.friend-review-summary-extra {
				width: 100%;
				justify-items: start;
			}

			.friend-review-summary-site {
				text-align: left;
			}
		}

		@media (max-width: 720px) {
			.admin-shell {
				width: min(100vw - 1rem, 100%);
				padding-top: 0.7rem;
				gap: 1rem;
			}

			.sidebar-panel,
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

			.page-actions,
			.table-actions,
			.form-actions,
			.media-actions,
			.media-upload-actions,
			.sidebar-footer-links {
				width: 100%;
				justify-content: flex-start;
			}

			.data-table th, .data-table td {
				padding: 0.82rem 0.9rem;
			}

			.markdown-editor-shell .form-textarea,
			.markdown-preview-body {
				min-height: 300px;
			}

			.appearance-inline-grid {
				grid-template-columns: 1fr;
			}
		}
`;

function resolveActiveNav(title: string): AdminNavKey {
	if (title.includes("外观")) return "appearance";
	if (title.includes("友链")) return "friends";
	if (title.includes("提及")) return "mentions";
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
	<script src="/theme.js"></script>
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
					<div class="sidebar-brand-mark">管</div>
					<div class="sidebar-brand-info">
						<span class="sidebar-brand-title">管理后台</span>
						<span class="sidebar-brand-subtitle">Admin Panel</span>
					</div>
				</div>
				<nav class="sidebar-nav">
					${renderNav(title)}
				</nav>
				<div class="sidebar-footer">
					<div class="admin-toolbar">
						<div class="sidebar-footer-links">
							<a href="/" target="_blank" rel="noopener noreferrer" class="btn btn-sm">查看站点</a>
						</div>
						${logoutForm}
					</div>
				</div>
			</div>
		</aside>
		<main class="main-content">
			<section class="admin-page-content">
				${content}
			</section>
		</main>
	</div>
</body>
</html>`;
}
