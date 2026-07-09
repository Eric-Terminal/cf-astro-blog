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

const navItems: Array<{
	key: AdminNavKey;
	label: string;
	href: string;
	icon: string;
}> = [
	{
		key: "dashboard",
		label: "控制台",
		href: "/api/admin",
		icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4V4zm9 0h7v5h-7V4zM4 13h7v7H4v-7zm9 3h7v4h-7v-4z"/></svg>',
	},
	{
		key: "appearance",
		label: "外观",
		href: "/api/admin/appearance",
		icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9c0-.5-.04-1-.12-1.5a4 4 0 0 1-5.38-5.38A9 9 0 0 0 12 3zm-4.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm1 5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>',
	},
	{
		key: "posts",
		label: "文章",
		href: "/api/admin/posts",
		icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6V3zm8 1.5V7h2.5L14 4.5zM8 10h8v1.5H8V10zm0 3.5h8V15H8v-1.5zm0 3.5h5V18H8v-1z"/></svg>',
	},
	{
		key: "friends",
		label: "友链",
		href: "/api/admin/friends",
		icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 13.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zm-6.2 6.2c.5-2.7 2.8-4.7 6.2-4.7s5.7 2 6.2 4.7H4.3zM16.2 11.4l1.3-1.3 1.8 1.8 3.2-3.2 1.3 1.3-4.5 4.5-3.1-3.1z"/></svg>',
	},
	{
		key: "mentions",
		label: "提及",
		href: "/api/admin/mentions",
		icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a8 8 0 0 0-1.2 15.9V21l3.4-2.1A8 8 0 1 0 12 3zm0 3.2a3.4 3.4 0 0 1 3.4 3.4v.7c0 1.5-.9 2.7-2.1 3.2-.3.1-.6.2-.9.2h-.8c-1.9 0-3.4-1.5-3.4-3.4v-.7A3.4 3.4 0 0 1 12 6.2z"/></svg>',
	},
	{
		key: "media",
		label: "媒体",
		href: "/api/admin/media",
		icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1.5 10.2 3.2-4.1 2.6 3.2 2.3-2.8 4.4 5.5H5.5v-1.8zM8.2 9.2a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8z"/></svg>',
	},
	{
		key: "analytics",
		label: "统计",
		href: "/api/admin/analytics",
		icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16v1.5H4V19zm2.2-2.2V11h2.3v5.8H6.2zm4.6 0V7h2.3v9.8h-2.3zm4.6 0V9.5H18v7.3h-2.6z"/></svg>',
	},
];

export const adminSharedStyles = `
		*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

		:root {
			color-scheme: light;
			/* 与前台统一的 indigo-slate 色板 */
			--bg: #eef1f6;
			--bg-secondary: rgba(255, 255, 255, 0.74);
			--bg-tertiary: rgba(255, 255, 255, 0.5);
			--surface-elevated: rgba(255, 255, 255, 0.88);
			--text: #0f172a;
			--text-secondary: #334155;
			--text-muted: #64748b;
			--border: rgba(15, 23, 42, 0.08);
			--border-strong: rgba(15, 23, 42, 0.12);
			--accent: #4f46e5;
			--accent-hover: #4338ca;
			--accent-soft: rgba(79, 70, 229, 0.12);
			--accent-rgb: 79, 70, 229;
			--success: #16a34a;
			--warning: #d97706;
			--danger: #dc2626;
			--radius-sm: 12px;
			--radius: 16px;
			--radius-lg: 22px;
			--radius-pill: 999px;
			--font:
				"SF Pro Display", "SF Pro Text", "PingFang SC", "Hiragino Sans GB",
				"Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			--font-mono:
				"SF Mono", "JetBrains Mono", "Cascadia Code", "Menlo", "Consolas", monospace;
			--shadow-soft:
				0 1px 2px rgba(15, 23, 42, 0.04),
				0 12px 32px -18px rgba(15, 23, 42, 0.16);
			--shadow-strong:
				0 2px 4px rgba(15, 23, 42, 0.05),
				0 18px 40px -20px rgba(15, 23, 42, 0.2);
			--transition-fast: 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
			--transition-slow: 360ms cubic-bezier(0.22, 1, 0.36, 1);
			--shell-width: min(1480px, calc(100vw - 1.5rem));
			--sidebar-width: 252px;
			--card-surface-rgb: 255, 255, 255;
			--card-sheen-rgb: 255, 255, 255;
			--workspace-pad: 1.35rem 1.45rem 1.6rem;
		}

		@media (prefers-color-scheme: dark) {
			:root:not([data-theme="light"]) {
				color-scheme: dark;
				--bg: #090b12;
				--bg-secondary: rgba(18, 22, 36, 0.84);
				--bg-tertiary: rgba(24, 28, 44, 0.7);
				--surface-elevated: rgba(26, 30, 48, 0.94);
				--text: #eef0ff;
				--text-secondary: #c4c9e0;
				--text-muted: #9399b5;
				--border: rgba(160, 170, 210, 0.12);
				--border-strong: rgba(160, 170, 210, 0.2);
				--accent: #818cf8;
				--accent-hover: #a5b4fc;
				--accent-soft: rgba(129, 140, 248, 0.16);
				--accent-rgb: 129, 140, 248;
				--success: #4ade80;
				--warning: #fbbf24;
				--danger: #f87171;
				--shadow-soft:
					0 1px 2px rgba(0, 0, 0, 0.28),
					0 16px 36px -20px rgba(0, 0, 0, 0.5);
				--shadow-strong:
					0 2px 6px rgba(0, 0, 0, 0.32),
					0 22px 48px -22px rgba(0, 0, 0, 0.55);
				--card-surface-rgb: 20, 24, 40;
				--card-sheen-rgb: 160, 170, 255;
			}
			:root:not([data-theme="light"]) body {
				background:
					radial-gradient(circle at 8% 0%, rgba(var(--accent-rgb), 0.18), transparent 32%),
					radial-gradient(circle at 92% 8%, rgba(129, 140, 248, 0.1), transparent 26%),
					radial-gradient(circle at 50% 100%, rgba(79, 70, 229, 0.12), transparent 34%),
					var(--bg);
			}
			:root:not([data-theme="light"]) body::after {
				background: rgba(var(--accent-rgb), 0.14);
			}
		}

		[data-theme="dark"] {
			color-scheme: dark;
			--bg: #090b12;
			--bg-secondary: rgba(18, 22, 36, 0.84);
			--bg-tertiary: rgba(24, 28, 44, 0.7);
			--surface-elevated: rgba(26, 30, 48, 0.94);
			--text: #eef0ff;
			--text-secondary: #c4c9e0;
			--text-muted: #9399b5;
			--border: rgba(160, 170, 210, 0.12);
			--border-strong: rgba(160, 170, 210, 0.2);
			--accent: #818cf8;
			--accent-hover: #a5b4fc;
			--accent-soft: rgba(129, 140, 248, 0.16);
			--accent-rgb: 129, 140, 248;
			--success: #4ade80;
			--warning: #fbbf24;
			--danger: #f87171;
			--shadow-soft:
				0 1px 2px rgba(0, 0, 0, 0.28),
				0 16px 36px -20px rgba(0, 0, 0, 0.5);
			--shadow-strong:
				0 2px 6px rgba(0, 0, 0, 0.32),
				0 22px 48px -22px rgba(0, 0, 0, 0.55);
			--card-surface-rgb: 20, 24, 40;
			--card-sheen-rgb: 160, 170, 255;
		}

		[data-theme="dark"] body {
			background:
				radial-gradient(circle at 8% 0%, rgba(var(--accent-rgb), 0.18), transparent 32%),
				radial-gradient(circle at 92% 8%, rgba(129, 140, 248, 0.1), transparent 26%),
				radial-gradient(circle at 50% 100%, rgba(79, 70, 229, 0.12), transparent 34%),
				var(--bg);
		}

		[data-theme="dark"] body::after {
			background: rgba(var(--accent-rgb), 0.14);
		}

		html {
			font-family: var(--font);
			font-size: 14.5px;
			line-height: 1.55;
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
				radial-gradient(ellipse 70% 50% at 12% -8%, rgba(var(--accent-rgb), 0.22), transparent 55%),
				radial-gradient(ellipse 50% 40% at 88% 0%, rgba(255, 255, 255, 0.45), transparent 50%),
				radial-gradient(ellipse 60% 45% at 60% 100%, rgba(var(--accent-rgb), 0.1), transparent 55%),
				linear-gradient(180deg, rgba(255, 255, 255, 0.35), transparent 28%),
				var(--bg);
		}

		body::before,
		body::after {
			content: "";
			position: fixed;
			width: 28rem;
			height: 28rem;
			border-radius: 50%;
			filter: blur(80px);
			opacity: 0.18;
			pointer-events: none;
			z-index: 0;
			animation: admin-float 22s ease-in-out infinite;
		}

		body::before {
			top: -10rem;
			left: -8rem;
			background: rgba(var(--accent-rgb), 0.4);
		}

		body::after {
			right: -10rem;
			bottom: 4rem;
			background: rgba(255, 255, 255, 0.35);
			animation-delay: -9s;
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
			padding: 1rem 0 1.75rem;
			display: grid;
			grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
			gap: 1.1rem;
			animation: admin-page-in 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
		}

		.sidebar {
			position: sticky;
			top: 1rem;
			align-self: start;
		}

		.sidebar-panel,
		.table-card,
		.stat-card,
		.media-item,
		.upload-form,
		.appearance-panel,
		.appearance-stage,
		.admin-workspace {
			position: relative;
			background: rgba(var(--card-surface-rgb), 0.58);
			border: 1px solid var(--border);
			border-radius: var(--radius-lg);
			backdrop-filter: blur(28px) saturate(150%);
			-webkit-backdrop-filter: blur(28px) saturate(150%);
			box-shadow:
				var(--shadow-soft),
				inset 0 1px 0 rgba(var(--card-sheen-rgb), 0.28);
			overflow: hidden;
		}

		.sidebar-panel::before,
		.table-card::before,
		.stat-card::before,
		.media-item::before,
		.upload-form::before,
		.appearance-panel::before,
		.admin-workspace::before {
			content: "";
			position: absolute;
			inset: 0;
			background:
				linear-gradient(165deg, rgba(var(--card-sheen-rgb), 0.14), transparent 42%),
				radial-gradient(circle at top left, rgba(var(--accent-rgb), 0.07), transparent 34%);
			pointer-events: none;
			z-index: 0;
		}

		.sidebar-panel {
			min-height: calc(100dvh - 2rem);
			padding: 0.9rem;
			display: flex;
			flex-direction: column;
			gap: 0.85rem;
		}

		.sidebar-panel > * {
			position: relative;
			z-index: 1;
		}

		.sidebar-brand {
			display: flex;
			align-items: center;
			gap: 0.7rem;
			padding: 0.45rem 0.5rem 0.95rem;
			border-bottom: 1px solid var(--border);
			margin-bottom: 0.15rem;
		}

		.sidebar-brand-mark {
			width: 2.25rem;
			height: 2.25rem;
			border-radius: 12px;
			background:
				linear-gradient(145deg, rgba(255, 255, 255, 0.28), transparent 68%),
				linear-gradient(135deg, #6366f1, var(--accent) 55%, var(--accent-hover));
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 0.78rem;
			font-weight: 800;
			color: #fff;
			box-shadow:
				0 8px 18px -10px rgba(var(--accent-rgb), 0.7),
				inset 0 1px 0 rgba(255, 255, 255, 0.3);
			flex-shrink: 0;
			letter-spacing: -0.02em;
		}

		.sidebar-brand-info {
			display: grid;
			gap: 0.08rem;
			min-width: 0;
		}

		.sidebar-brand-title {
			font-size: 0.92rem;
			font-weight: 750;
			letter-spacing: -0.03em;
			color: var(--text);
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.sidebar-brand-subtitle {
			font-size: 0.66rem;
			color: var(--text-muted);
			letter-spacing: 0.08em;
			text-transform: uppercase;
			font-weight: 600;
		}

		.sidebar-nav {
			display: grid;
			gap: 0.28rem;
			align-content: start;
		}

		.sidebar-nav a {
			display: flex;
			align-items: center;
			gap: 0.7rem;
			padding: 0.62rem 0.72rem;
			border-radius: 12px;
			color: var(--text-secondary);
			background: transparent;
			border: 1px solid transparent;
			font-weight: 600;
			font-size: 0.9rem;
			transform: none;
			transition:
				background-color var(--transition-fast),
				border-color var(--transition-fast),
				color var(--transition-fast),
				box-shadow var(--transition-fast);
		}

		.sidebar-nav a::after {
			display: none;
		}

		.sidebar-nav-icon {
			width: 1.7rem;
			height: 1.7rem;
			border-radius: 9px;
			display: grid;
			place-items: center;
			flex-shrink: 0;
			background: rgba(15, 23, 42, 0.04);
			border: 1px solid transparent;
			color: var(--text-muted);
			transition:
				background-color var(--transition-fast),
				color var(--transition-fast),
				border-color var(--transition-fast);
		}

		.sidebar-nav-icon svg {
			width: 0.95rem;
			height: 0.95rem;
			fill: currentColor;
		}

		.sidebar-nav-label {
			min-width: 0;
			flex: 1;
		}

		.sidebar-nav a:hover {
			color: var(--text);
			background: rgba(var(--card-sheen-rgb), 0.22);
			border-color: var(--border);
		}

		.sidebar-nav a:hover .sidebar-nav-icon {
			color: var(--accent);
			background: var(--accent-soft);
		}

		.sidebar-nav a.active {
			color: var(--text);
			background:
				linear-gradient(135deg, rgba(var(--accent-rgb), 0.14), rgba(var(--accent-rgb), 0.04) 70%),
				var(--surface-elevated);
			border-color: rgba(var(--accent-rgb), 0.18);
			box-shadow:
				0 8px 20px -16px rgba(var(--accent-rgb), 0.45),
				inset 0 1px 0 rgba(var(--card-sheen-rgb), 0.35);
		}

		.sidebar-nav a.active .sidebar-nav-icon {
			color: #fff;
			background:
				linear-gradient(145deg, rgba(255, 255, 255, 0.22), transparent 70%),
				var(--accent);
			border-color: transparent;
			box-shadow: 0 6px 14px -8px rgba(var(--accent-rgb), 0.7);
		}

		.sidebar-footer {
			display: grid;
			gap: 0.55rem;
			padding: 0.75rem;
			margin-top: auto;
			border-radius: 14px;
			background: rgba(15, 23, 42, 0.03);
			border: 1px solid var(--border);
		}

		.admin-toolbar {
			display: grid;
			gap: 0.5rem;
		}

		.sidebar-footer-links {
			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem;
			align-items: center;
		}

		.sidebar-footer form {
			width: 100%;
		}

		.sidebar-footer .btn {
			width: 100%;
		}

		.main-content {
			display: grid;
			align-content: start;
			min-width: 0;
		}

		.admin-workspace {
			min-width: 0;
			width: 100%;
		}

		.admin-page-content {
			position: relative;
			z-index: 1;
			min-width: 0;
			width: 100%;
			padding: var(--workspace-pad);
		}

		.page-header,
		.section-heading {
			display: flex;
			flex-wrap: wrap;
			align-items: flex-start;
			justify-content: space-between;
			gap: 0.85rem 1rem;
			margin-bottom: 1.15rem;
		}

		.page-header-copy {
			display: grid;
			gap: 0.28rem;
			min-width: 0;
		}

		.page-kicker {
			display: inline-flex;
			align-items: center;
			gap: 0.35rem;
			font-size: 0.72rem;
			font-weight: 700;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: var(--accent);
		}

		.page-actions,
		.table-actions,
		.form-actions {
			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem;
			align-items: center;
		}

		.page-header h1,
		.section-heading h2 {
			margin-bottom: 0;
		}

		.form-actions {
			margin-top: 1.15rem;
		}

		.page-intro {
			color: var(--text-muted);
			font-size: 0.9rem;
			line-height: 1.65;
			margin-top: -0.35rem;
			margin-bottom: 1.25rem;
		}

		h1 {
			font-size: clamp(1.55rem, 1.35rem + 0.7vw, 2rem);
			line-height: 1.15;
			letter-spacing: -0.035em;
			font-weight: 760;
			margin-bottom: 1.1rem;
		}

		h2 {
			font-size: 1rem;
			color: var(--text);
			margin: 1.35rem 0 0.75rem;
			letter-spacing: -0.02em;
			font-weight: 700;
		}

		.section-block {
			margin-top: 1.35rem;
		}

		.section-block > h2:first-child {
			margin-top: 0;
		}

		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
			gap: 0.75rem;
			margin-bottom: 1.35rem;
		}

		.stat-card {
			display: grid;
			gap: 0.45rem;
			padding: 1rem 1.05rem 1.05rem;
			transform: translate3d(0, 0, 0);
			transition:
				transform var(--transition-fast),
				box-shadow var(--transition-fast),
				border-color var(--transition-fast);
		}

		.stat-card > * {
			position: relative;
			z-index: 1;
		}

		.stat-card:hover {
			transform: translate3d(0, -2px, 0);
			box-shadow: var(--shadow-strong);
			border-color: var(--border-strong);
		}

		.stat-label {
			color: var(--text-muted);
			font-size: 0.74rem;
			text-transform: uppercase;
			letter-spacing: 0.07em;
			font-weight: 700;
			order: -1;
		}

		.stat-value {
			font-size: clamp(1.7rem, 1.5rem + 0.7vw, 2.15rem);
			font-weight: 780;
			line-height: 1.05;
			letter-spacing: -0.045em;
			font-variant-numeric: tabular-nums;
		}

		.table-card {
			padding: 0;
			margin-bottom: 1.15rem;
			overflow-x: auto;
			overflow-y: hidden;
			-webkit-overflow-scrolling: touch;
		}

		.data-table {
			width: 100%;
			border-collapse: collapse;
		}

		.data-table th, .data-table td {
			padding: 0.78rem 1rem;
			text-align: left;
			border-bottom: 1px solid var(--border);
			vertical-align: middle;
		}

		.data-table th {
			color: var(--text-muted);
			font-size: 0.72rem;
			font-weight: 750;
			letter-spacing: 0.07em;
			text-transform: uppercase;
			background: rgba(15, 23, 42, 0.025);
			position: sticky;
			top: 0;
			z-index: 1;
		}

		.data-table tbody tr {
			transition: background-color var(--transition-fast);
		}

		.data-table tbody tr:hover {
			background: rgba(var(--accent-rgb), 0.04);
		}

		.data-table tbody tr:last-child td {
			border-bottom: 0;
		}

		.data-table td a:not(.btn) {
			color: var(--text);
			font-weight: 650;
		}

		.data-table td a:not(.btn):hover {
			color: var(--accent);
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
			gap: 0.4rem;
			padding: 0.58rem 0.95rem;
			border: 1px solid var(--border);
			border-radius: 11px;
			background: var(--surface-elevated);
			color: var(--text);
			cursor: pointer;
			font-weight: 600;
			font-size: 0.88rem;
			box-shadow:
				0 1px 1px rgba(15, 23, 42, 0.03),
				inset 0 1px 0 rgba(var(--card-sheen-rgb), 0.35);
			transition:
				transform var(--transition-fast),
				border-color var(--transition-fast),
				background-color var(--transition-fast),
				box-shadow var(--transition-fast),
				color var(--transition-fast);
		}

		.btn:hover {
			transform: translate3d(0, -1px, 0);
			color: var(--text);
			background: var(--surface-elevated);
			border-color: var(--border-strong);
			box-shadow: var(--shadow-soft);
		}

		.btn:active {
			transform: translate3d(0, 0, 0);
		}

		.btn-primary {
			background:
				linear-gradient(145deg, rgba(255, 255, 255, 0.2), transparent 65%),
				linear-gradient(135deg, #6366f1, var(--accent));
			color: #fff;
			border-color: transparent;
			box-shadow:
				0 10px 22px -14px rgba(var(--accent-rgb), 0.75),
				inset 0 1px 0 rgba(255, 255, 255, 0.22);
		}

		.btn-primary:hover {
			background:
				linear-gradient(145deg, rgba(255, 255, 255, 0.24), transparent 65%),
				linear-gradient(135deg, var(--accent), var(--accent-hover));
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

		.btn-success {
			color: var(--success);
		}

		.btn-success:hover {
			border-color: rgba(22, 163, 74, 0.28);
			background: rgba(22, 163, 74, 0.1);
			color: var(--success);
		}

		.btn-success-solid {
			background:
				linear-gradient(135deg, rgba(255, 255, 255, 0.16), transparent 72%),
				var(--success);
			color: #fff;
			border-color: transparent;
			box-shadow:
				0 14px 30px -20px rgba(22, 163, 74, 0.5),
				inset 0 1px 0 rgba(255, 255, 255, 0.16);
		}

		.btn-success-solid:hover {
			background:
				linear-gradient(135deg, rgba(255, 255, 255, 0.2), transparent 72%),
				#15803d;
			color: #fff;
		}

		.btn-sm {
			padding: 0.42rem 0.72rem;
			font-size: 0.8rem;
			border-radius: 10px;
		}

		.btn-xs {
			padding: 0.34rem 0.62rem;
			font-size: 0.76rem;
			border-radius: 9px;
		}

		.badge {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			padding: 0.22rem 0.58rem;
			border-radius: var(--radius-pill);
			font-size: 0.72rem;
			font-weight: 750;
			letter-spacing: 0.03em;
			border: 1px solid transparent;
		}

		.badge-published {
			background: rgba(22, 163, 74, 0.12);
			color: var(--success);
			border-color: rgba(22, 163, 74, 0.16);
		}
		.badge-draft {
			background: rgba(100, 116, 139, 0.12);
			color: var(--text-muted);
			border-color: rgba(100, 116, 139, 0.14);
		}
		.badge-scheduled {
			background: rgba(217, 119, 6, 0.12);
			color: var(--warning);
			border-color: rgba(217, 119, 6, 0.16);
		}

		.form-group {
			margin-bottom: 0.85rem;
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
			margin-bottom: 0.38rem;
			color: var(--text-secondary);
			font-size: 0.84rem;
			font-weight: 650;
		}

		.form-input, .form-textarea, .form-select {
			width: 100%;
			padding: 0.68rem 0.85rem;
			border-radius: 12px;
			border: 1px solid var(--border);
			background: rgba(var(--card-surface-rgb), 0.42);
			color: var(--text);
			box-shadow: inset 0 1px 0 rgba(var(--card-sheen-rgb), 0.2);
			transition:
				border-color var(--transition-fast),
				box-shadow var(--transition-fast),
				background-color var(--transition-fast);
		}

		.form-input:focus, .form-textarea:focus, .form-select:focus {
			outline: none;
			border-color: rgba(var(--accent-rgb), 0.45);
			box-shadow:
				0 0 0 3px rgba(var(--accent-rgb), 0.12),
				inset 0 1px 0 rgba(var(--card-sheen-rgb), 0.25);
			background: var(--surface-elevated);
		}

		.form-textarea {
			min-height: 320px;
			resize: vertical;
			font-family: var(--font-mono);
			line-height: 1.7;
		}

		/* 短备注/简介用：避免继承文章编辑器 320px 最小高度 */
		.form-textarea-sm {
			min-height: 4.6rem;
			font-family: var(--font);
			line-height: 1.55;
			resize: vertical;
		}

		.form-textarea-md {
			min-height: 7.5rem;
			font-family: var(--font);
			line-height: 1.55;
			resize: vertical;
		}

		.form-textarea.is-dragover {
			border-color: rgba(var(--accent-rgb), 0.55);
			background: rgba(var(--accent-rgb), 0.08);
			box-shadow:
				0 0 0 4px rgba(var(--accent-rgb), 0.16),
				inset 0 1px 0 rgba(var(--card-sheen-rgb), 0.22);
		}

		.filter-tabs {
			display: flex;
			flex-wrap: wrap;
			gap: 0.35rem;
			margin-bottom: 1rem;
			padding: 0.3rem;
			border-radius: 14px;
			background: rgba(15, 23, 42, 0.035);
			border: 1px solid var(--border);
			width: fit-content;
			max-width: 100%;
		}

		.filter-tab {
			display: inline-flex;
			align-items: center;
			gap: 0.38rem;
			padding: 0.42rem 0.72rem;
			border-radius: 10px;
			border: 1px solid transparent;
			background: transparent;
			color: var(--text-secondary);
			font-size: 0.82rem;
			font-weight: 650;
			transition:
				transform var(--transition-fast),
				border-color var(--transition-fast),
				background-color var(--transition-fast),
				color var(--transition-fast),
				box-shadow var(--transition-fast);
		}

		.filter-tab:hover {
			color: var(--text);
			background: rgba(var(--card-sheen-rgb), 0.35);
		}

		.filter-tab.is-active {
			color: var(--text);
			border-color: rgba(var(--accent-rgb), 0.16);
			background: var(--surface-elevated);
			box-shadow: var(--shadow-soft);
		}

		.filter-tab-count {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 1.25rem;
			height: 1.15rem;
			padding: 0 0.32rem;
			border-radius: 999px;
			font-size: 0.7rem;
			font-weight: 750;
			background: rgba(15, 23, 42, 0.06);
			color: var(--text-muted);
			font-variant-numeric: tabular-nums;
		}

		.filter-tab.is-active .filter-tab-count {
			background: var(--accent-soft);
			color: var(--accent);
		}

		.admin-secondary-panel {
			margin-bottom: 0.85rem;
		}

		.admin-secondary-panel > summary {
			list-style: none;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.75rem;
			padding: 0.85rem 1rem;
			font-weight: 600;
			color: var(--text-secondary);
		}

		.admin-secondary-panel > summary::-webkit-details-marker {
			display: none;
		}

		.admin-secondary-panel > summary::after {
			content: "▾";
			font-size: 0.72rem;
			color: var(--text-muted);
			transition: transform var(--transition-fast);
		}

		.admin-secondary-panel[open] > summary::after {
			transform: rotate(180deg);
			color: var(--accent);
		}

		.admin-secondary-panel-body {
			padding: 0 1rem 1rem;
			border-top: 1px solid var(--border);
		}

		.quick-actions {
			display: flex;
			flex-wrap: wrap;
			gap: 0.4rem;
			align-items: center;
		}

		.quick-actions form {
			display: inline-flex;
			margin: 0;
		}

		.review-queue {
			display: grid;
			gap: 0.7rem;
		}

		.friend-queue-item {
			display: grid;
			gap: 0;
			padding: 0;
			margin-bottom: 0;
		}

		.friend-queue-head {
			display: grid;
			grid-template-columns: auto minmax(0, 1fr) auto;
			gap: 0.85rem;
			align-items: center;
			padding: 0.85rem 1rem;
		}

		.friend-queue-avatar {
			width: 2.75rem;
			height: 2.75rem;
			border-radius: 14px;
			overflow: hidden;
			background:
				radial-gradient(circle at top left, rgba(var(--accent-rgb), 0.18), transparent 55%),
				var(--bg-tertiary);
			border: 1px solid var(--border);
			display: grid;
			place-items: center;
			flex-shrink: 0;
			color: var(--text-muted);
			font-size: 0.78rem;
			font-weight: 700;
		}

		.friend-queue-avatar img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}

		.friend-queue-main {
			min-width: 0;
			display: grid;
			gap: 0.18rem;
		}

		.friend-queue-title-row {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.45rem 0.6rem;
		}

		.friend-queue-name {
			margin: 0;
			font-size: 1.02rem;
			font-weight: 700;
			line-height: 1.25;
			letter-spacing: -0.02em;
		}

		.friend-queue-url {
			color: var(--text-muted);
			font-size: 0.82rem;
			word-break: break-all;
			line-height: 1.4;
		}

		.friend-queue-url a {
			color: var(--accent);
		}

		.friend-queue-desc {
			margin: 0.12rem 0 0;
			color: var(--text-secondary);
			font-size: 0.86rem;
			line-height: 1.5;
			display: -webkit-box;
			-webkit-line-clamp: 2;
			-webkit-box-orient: vertical;
			overflow: hidden;
		}

		.friend-queue-meta {
			margin: 0.15rem 0 0;
			color: var(--text-muted);
			font-size: 0.78rem;
		}

		.friend-queue-side {
			display: grid;
			gap: 0.5rem;
			justify-items: end;
			align-content: start;
		}

		.friend-queue-edit {
			border-top: 1px solid var(--border);
		}

		.friend-queue-edit > summary {
			list-style: none;
			cursor: pointer;
			padding: 0.65rem 1rem;
			font-size: 0.84rem;
			font-weight: 600;
			color: var(--text-muted);
		}

		.friend-queue-edit > summary::-webkit-details-marker {
			display: none;
		}

		.friend-queue-edit[open] > summary {
			color: var(--accent);
			background: rgba(var(--accent-rgb), 0.05);
		}

		.friend-queue-edit-body {
			padding: 0.85rem 1rem 1rem;
			border-top: 1px solid var(--border);
		}

		.mention-queue-item {
			padding: 0.9rem 1rem 1rem;
			margin-bottom: 0;
		}

		.mention-queue-actions {
			margin-top: 0.75rem;
			padding-top: 0.75rem;
			border-top: 1px solid var(--border);
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			justify-content: space-between;
			gap: 0.6rem;
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
			background: rgba(var(--accent-rgb), 0.06);
			border-bottom: 1px solid var(--border);
		}

		.friend-review-item[open] .friend-review-summary-caret {
			color: var(--accent);
			border-color: rgba(var(--accent-rgb), 0.4);
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
			border-left: 3px solid rgba(var(--accent-rgb), 0.42);
			color: var(--text-secondary);
			background: rgba(var(--accent-rgb), 0.08);
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
			background: rgba(var(--accent-rgb), 0.06);
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
			background: rgba(var(--accent-rgb), 0.12);
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
			background: rgba(var(--accent-rgb), 0.1);
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
				radial-gradient(circle at top left, rgba(var(--accent-rgb), 0.08), transparent 28%),
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
			border-color: rgba(var(--accent-rgb), 0.42);
			background-color: rgba(var(--accent-rgb), 0.08);
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
			padding: 1.1rem 1.15rem;
			background: rgba(var(--card-surface-rgb), 0.58);
			border: 1px solid var(--border);
			border-radius: var(--radius-lg);
			backdrop-filter: blur(28px) saturate(150%);
			-webkit-backdrop-filter: blur(28px) saturate(150%);
			box-shadow:
				var(--shadow-soft),
				inset 0 1px 0 rgba(var(--card-sheen-rgb), 0.28);
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
			border: 1px dashed rgba(var(--accent-rgb), 0.34);
			border-radius: var(--radius);
			background:
				linear-gradient(140deg, rgba(var(--accent-rgb), 0.08), rgba(var(--accent-rgb), 0.02)),
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
			border-color: rgba(var(--accent-rgb), 0.65);
			background:
				linear-gradient(140deg, rgba(var(--accent-rgb), 0.16), rgba(var(--accent-rgb), 0.06)),
				rgba(255, 255, 255, 0.03);
			transform: translateY(-1px);
		}

		.media-upload-dropzone:focus-visible {
			outline: 2px solid rgba(var(--accent-rgb), 0.6);
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
			grid-template-rows: 148px auto auto;
			transition:
				transform var(--transition-fast),
				box-shadow var(--transition-fast),
				border-color var(--transition-fast);
		}

		.media-item > * {
			position: relative;
			z-index: 1;
		}

		.media-item:hover {
			transform: translate3d(0, -2px, 0);
			box-shadow: var(--shadow-strong);
			border-color: var(--border-strong);
		}

		.media-preview {
			display: flex;
			align-items: center;
			justify-content: center;
			background:
				radial-gradient(circle at top left, rgba(var(--accent-rgb), 0.12), transparent 22%),
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
			padding: 1.35rem 1.2rem;
			margin-bottom: 1.15rem;
			color: var(--text-muted);
			background:
				linear-gradient(160deg, rgba(var(--accent-rgb), 0.04), transparent 50%),
				var(--bg-secondary);
			border: 1px dashed var(--border-strong);
			border-radius: var(--radius-lg);
			text-align: center;
			font-size: 0.92rem;
			line-height: 1.7;
		}

		.empty-state a {
			color: var(--accent);
			font-weight: 650;
			text-decoration: underline;
			text-underline-offset: 0.14em;
		}

		.alert {
			display: flex;
			align-items: flex-start;
			gap: 0.55rem;
			padding: 0.78rem 0.95rem;
			margin-bottom: 0.95rem;
			border-radius: 12px;
			font-size: 0.88rem;
			line-height: 1.55;
			font-weight: 550;
			backdrop-filter: blur(12px);
		}

		.alert::before {
			content: "";
			width: 0.45rem;
			height: 0.45rem;
			border-radius: 50%;
			margin-top: 0.42rem;
			flex-shrink: 0;
			background: currentColor;
			box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 16%, transparent);
		}

		.alert-error {
			background: rgba(220, 38, 38, 0.08);
			color: var(--danger);
			border: 1px solid rgba(220, 38, 38, 0.16);
		}

		.alert-success {
			background: rgba(22, 163, 74, 0.08);
			color: var(--success);
			border: 1px solid rgba(22, 163, 74, 0.16);
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
				grid-template-columns: repeat(4, minmax(0, 1fr));
				gap: 0.35rem;
			}

			.sidebar-nav a {
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: 0.35rem;
				padding: 0.55rem 0.4rem;
				text-align: center;
				font-size: 0.78rem;
			}

			.sidebar-footer .btn {
				width: auto;
			}

			.sidebar-footer-links,
			.sidebar-footer form {
				width: auto;
			}

			.admin-toolbar {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.5rem;
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

			.friend-queue-head {
				grid-template-columns: auto minmax(0, 1fr);
			}

			.friend-queue-side {
				grid-column: 1 / -1;
				justify-items: start;
			}

			.friend-queue-side .quick-actions {
				width: 100%;
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
				grid-template-columns: repeat(3, minmax(0, 1fr));
			}

			.admin-page-content {
				padding: 1rem 0.95rem 1.2rem;
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
		.map((item) => {
			const activeClass = item.key === activeNav ? ' class="active"' : "";
			return `<a href="${item.href}"${activeClass}>
				<span class="sidebar-nav-icon">${item.icon}</span>
				<span class="sidebar-nav-label">${item.label}</span>
			</a>`;
		})
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
					<div class="sidebar-brand-mark">CMS</div>
					<div class="sidebar-brand-info">
						<span class="sidebar-brand-title">站点管理</span>
						<span class="sidebar-brand-subtitle">Control Center</span>
					</div>
				</div>
				<nav class="sidebar-nav" aria-label="后台导航">
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
			<div class="admin-workspace">
				<section class="admin-page-content">
					${content}
				</section>
			</div>
		</main>
	</div>
</body>
</html>`;
}
