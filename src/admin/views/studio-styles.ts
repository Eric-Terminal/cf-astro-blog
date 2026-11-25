// 后台工作室增强组件样式（侧栏分组、快捷命令面板、沉浸式编辑器、筛选栏、灯箱与全局提示）
export const adminStudioStyles = `
		/* 侧栏顶部快速写作与分组导航 */
		.sidebar-quick-actions {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 0.45rem;
			align-items: stretch;
		}

		.sidebar-compose-btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 0.45rem;
			padding: 0.58rem 0.82rem;
			border-radius: 11px;
			background: var(--text);
			color: var(--bg);
			font-size: 0.86rem;
			font-weight: 680;
			letter-spacing: -0.01em;
			box-shadow: 0 8px 20px -12px rgba(0, 0, 0, 0.35);
			transition:
				transform var(--transition-fast),
				background-color var(--transition-fast),
				color var(--transition-fast),
				box-shadow var(--transition-fast);
		}

		.sidebar-compose-btn:hover {
			transform: translate3d(0, -1px, 0);
			background: var(--accent);
			color: #fff;
		}

		.sidebar-cmd-trigger {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 0.28rem;
			padding: 0 0.65rem;
			border-radius: 11px;
			border: 1px solid var(--border);
			background: var(--surface-elevated);
			color: var(--text-muted);
			font-family: var(--font-mono);
			font-size: 0.75rem;
			font-weight: 650;
			cursor: pointer;
			transition:
				border-color var(--transition-fast),
				color var(--transition-fast),
				transform var(--transition-fast);
		}

		.sidebar-cmd-trigger:hover {
			border-color: var(--border-strong);
			color: var(--text);
			transform: translate3d(0, -1px, 0);
		}

		.sidebar-nav-group-label {
			padding: 0.52rem 0.68rem 0.18rem;
			font-size: 0.68rem;
			font-weight: 720;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: var(--text-muted);
			user-select: none;
		}

		.sidebar-nav-group-label:first-child {
			padding-top: 0.1rem;
		}

		.admin-kbd {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			padding: 0.1rem 0.38rem;
			border-radius: 6px;
			border: 1px solid var(--border-strong);
			background: rgba(var(--card-surface-rgb), 0.65);
			color: var(--text-muted);
			font-family: var(--font-mono);
			font-size: 0.72rem;
			font-weight: 650;
			line-height: 1.3;
		}

		/* 全局轻量 Toast 反馈 */
		.admin-toast-stack {
			position: fixed;
			right: 1.25rem;
			bottom: 1.25rem;
			z-index: 900;
			display: grid;
			gap: 0.5rem;
			pointer-events: none;
			max-width: min(360px, calc(100vw - 2rem));
		}

		.admin-toast {
			pointer-events: auto;
			display: flex;
			align-items: center;
			gap: 0.55rem;
			padding: 0.68rem 0.92rem;
			border-radius: 12px;
			border: 1px solid var(--border-strong);
			background: var(--surface-elevated);
			color: var(--text);
			font-size: 0.85rem;
			font-weight: 600;
			box-shadow: var(--shadow-strong);
			backdrop-filter: blur(20px) saturate(150%);
			-webkit-backdrop-filter: blur(20px) saturate(150%);
			animation: admin-toast-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
		}

		.admin-toast::before {
			content: "";
			width: 0.46rem;
			height: 0.46rem;
			border-radius: 999px;
			flex-shrink: 0;
			background: var(--accent);
		}

		.admin-toast.is-success::before {
			background: var(--success);
		}

		.admin-toast.is-error::before {
			background: var(--danger);
		}

		@keyframes admin-toast-in {
			from {
				opacity: 0;
				transform: translate3d(0, 10px, 0) scale(0.98);
			}
			to {
				opacity: 1;
				transform: translate3d(0, 0, 0) scale(1);
			}
		}

		/* 后台快捷跳转面板 (⌘K) */
		.admin-cmd-backdrop {
			position: fixed;
			inset: 0;
			z-index: 850;
			display: grid;
			align-items: start;
			justify-items: center;
			padding: min(13vh, 6.5rem) 1rem 1.5rem;
			background: rgba(9, 14, 24, 0.42);
			backdrop-filter: blur(10px);
			-webkit-backdrop-filter: blur(10px);
		}

		.admin-cmd-backdrop[hidden] {
			display: none !important;
		}

		.admin-cmd-dialog {
			width: min(540px, 100%);
			border-radius: 16px;
			border: 1px solid var(--border-strong);
			background: var(--surface-elevated);
			box-shadow: var(--shadow-strong);
			overflow: hidden;
			animation: admin-toast-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
		}

		.admin-cmd-head {
			display: flex;
			align-items: center;
			gap: 0.6rem;
			padding: 0.78rem 0.95rem;
			border-bottom: 1px solid var(--border);
		}

		.admin-cmd-input {
			flex: 1;
			border: 0;
			background: transparent;
			color: var(--text);
			font-size: 0.95rem;
			outline: none;
		}

		.admin-cmd-list {
			max-height: min(56vh, 360px);
			overflow-y: auto;
			padding: 0.42rem;
			display: grid;
			gap: 0.2rem;
		}

		.admin-cmd-item {
			width: 100%;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.75rem;
			padding: 0.6rem 0.75rem;
			border: 0;
			border-radius: 10px;
			background: transparent;
			color: var(--text-secondary);
			font-size: 0.88rem;
			font-weight: 600;
			text-align: left;
			cursor: pointer;
			transition:
				background-color var(--transition-fast),
				color var(--transition-fast);
		}

		.admin-cmd-item:hover,
		.admin-cmd-item.is-active {
			background: var(--accent-soft);
			color: var(--accent);
		}

		.admin-cmd-hint {
			font-size: 0.76rem;
			font-weight: 500;
			color: var(--text-muted);
		}

		/* 控制台指挥中心组件 */
		.dashboard-status-strip {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.5rem;
			margin-bottom: 1.15rem;
		}

		.dashboard-status-pill {
			display: inline-flex;
			align-items: center;
			gap: 0.42rem;
			padding: 0.36rem 0.72rem;
			border-radius: var(--radius-pill);
			border: 1px solid var(--border);
			background: var(--surface-elevated);
			font-size: 0.8rem;
			font-weight: 620;
			color: var(--text-secondary);
		}

		.dashboard-status-pill.is-attention {
			border-color: rgba(217, 119, 6, 0.32);
			background: rgba(217, 119, 6, 0.1);
			color: var(--warning);
		}

		.dashboard-status-dot {
			width: 0.44rem;
			height: 0.44rem;
			border-radius: 999px;
			background: var(--text-muted);
		}

		.dashboard-status-dot.is-ok {
			background: var(--success);
		}

		.dashboard-status-dot.is-warn {
			background: var(--warning);
		}

		.dashboard-quick-grid {
			display: grid;
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 0.75rem;
			margin-bottom: 1.4rem;
		}

		.dashboard-quick-card {
			position: relative;
			display: grid;
			gap: 0.35rem;
			align-content: start;
			padding: 0.95rem 1.05rem;
			border-radius: var(--radius);
			border: 1px solid var(--border);
			background: rgba(var(--card-surface-rgb), 0.62);
			box-shadow: var(--shadow-soft);
			transition:
				transform var(--transition-fast),
				border-color var(--transition-fast),
				box-shadow var(--transition-fast);
		}

		.dashboard-quick-card:hover {
			transform: translate3d(0, -2px, 0);
			border-color: rgba(var(--accent-rgb), 0.35);
			box-shadow: var(--shadow-strong);
			color: var(--text);
		}

		.dashboard-quick-kicker {
			font-size: 0.7rem;
			font-weight: 720;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: var(--accent);
		}

		.dashboard-quick-title {
			font-size: 0.95rem;
			font-weight: 720;
			color: var(--text);
			letter-spacing: -0.02em;
		}

		.dashboard-quick-desc {
			font-size: 0.8rem;
			line-height: 1.5;
			color: var(--text-muted);
		}

		/* 通用即时筛选与搜索工具栏（文章列表、媒体库、友链） */
		.admin-filter-bar {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			justify-content: space-between;
			gap: 0.65rem 0.85rem;
			margin-bottom: 1rem;
		}

		.admin-filter-bar .filter-tabs {
			margin-bottom: 0;
		}

		.admin-filter-controls {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.55rem;
			flex: 1;
			justify-content: flex-end;
			min-width: min(260px, 100%);
		}

		.admin-search-input {
			width: min(280px, 100%);
			padding: 0.48rem 0.78rem;
			border-radius: 10px;
			border: 1px solid var(--border);
			background: var(--surface-elevated);
			color: var(--text);
			font-size: 0.84rem;
		}

		.admin-search-input:focus {
			outline: none;
			border-color: rgba(var(--accent-rgb), 0.45);
			box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.12);
		}

		.admin-filter-select {
			width: auto;
			min-width: 132px;
			padding: 0.46rem 0.72rem;
			border-radius: 10px;
			font-size: 0.83rem;
		}

		.post-row-title-wrap {
			display: grid;
			gap: 0.14rem;
		}

		.post-row-slug {
			font-family: var(--font-mono);
			font-size: 0.74rem;
			color: var(--text-muted);
		}

		.taxonomy-drawer-grid {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.85rem;
			align-items: start;
			margin-top: 1.25rem;
		}

		.taxonomy-drawer-grid .section-block {
			margin-top: 0;
		}

		/* 文章编辑器工作室增强（吸顶操作栏、视图模式切换、Markdown 工具栏、禅模式） */
		.editor-studio-bar {
			position: sticky;
			top: 0.65rem;
			z-index: 30;
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			justify-content: space-between;
			gap: 0.65rem 0.9rem;
			padding: 0.62rem 0.85rem;
			margin-bottom: 1rem;
			border-radius: 14px;
			border: 1px solid var(--border-strong);
			background: rgba(var(--card-surface-rgb), 0.86);
			backdrop-filter: blur(22px) saturate(160%);
			-webkit-backdrop-filter: blur(22px) saturate(160%);
			box-shadow: var(--shadow-soft);
		}

		.editor-studio-left,
		.editor-studio-right {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.5rem;
		}

		.editor-word-counter {
			font-size: 0.78rem;
			font-weight: 600;
			color: var(--text-muted);
			font-variant-numeric: tabular-nums;
			padding-inline: 0.25rem;
		}

		.editor-mode-switch {
			display: inline-flex;
			align-items: center;
			gap: 0.2rem;
			padding: 0.2rem;
			border-radius: 10px;
			border: 1px solid var(--border);
			background: var(--bg-tertiary);
		}

		.editor-mode-btn {
			padding: 0.3rem 0.62rem;
			border: 0;
			border-radius: 8px;
			background: transparent;
			color: var(--text-secondary);
			font-size: 0.78rem;
			font-weight: 650;
			cursor: pointer;
			transition:
				background-color var(--transition-fast),
				color var(--transition-fast),
				box-shadow var(--transition-fast);
		}

		.editor-mode-btn:hover {
			color: var(--text);
		}

		.editor-mode-btn.is-active {
			background: var(--surface-elevated);
			color: var(--text);
			box-shadow: var(--shadow-soft);
		}

		.editor-doc-meta-grid {
			display: grid;
			grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.9fr);
			gap: 0.85rem;
			align-items: start;
		}

		.editor-title-input {
			font-size: 1.18rem;
			font-weight: 720;
			letter-spacing: -0.02em;
			padding: 0.75rem 0.92rem;
		}

		.editor-excerpt-area {
			min-height: 4.1rem;
			font-family: var(--font);
			line-height: 1.55;
		}

		.md-toolbar {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.28rem;
			padding: 0.45rem 0.55rem;
			margin-bottom: 0.55rem;
			border-radius: 11px;
			border: 1px solid var(--border);
			background: var(--bg-tertiary);
		}

		.md-tool-btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 0.28rem;
			height: 1.88rem;
			padding: 0 0.54rem;
			border-radius: 8px;
			border: 1px solid transparent;
			background: transparent;
			color: var(--text-secondary);
			font-size: 0.78rem;
			font-weight: 650;
			cursor: pointer;
			transition:
				background-color var(--transition-fast),
				border-color var(--transition-fast),
				color var(--transition-fast);
		}

		.md-tool-btn:hover {
			background: var(--surface-elevated);
			border-color: var(--border);
			color: var(--text);
		}

		.md-tool-sep {
			width: 1px;
			height: 1.1rem;
			background: var(--border-strong);
			margin-inline: 0.18rem;
		}

		/* 编辑器视图与侧栏收起状态 */
		.editor-grid[data-editor-inspector="collapsed"] {
			grid-template-columns: minmax(0, 1fr);
		}

		.editor-grid[data-editor-inspector="collapsed"] .editor-inspector-panel {
			display: none;
		}

		.markdown-editor-shell[data-editor-view="write"] {
			grid-template-columns: minmax(0, 1fr);
		}

		.markdown-editor-shell[data-editor-view="write"] .markdown-preview-panel {
			display: none;
		}

		.markdown-editor-shell[data-editor-view="preview"] {
			grid-template-columns: minmax(0, 1fr);
		}

		.markdown-editor-shell[data-editor-view="preview"] #content {
			display: none;
		}

		.markdown-editor-shell[data-editor-view="preview"] .markdown-preview-body {
			max-height: none;
		}

		body.is-editor-zen {
			overflow-y: auto;
		}

		body.is-editor-zen .sidebar,
		body.is-editor-zen .page-header {
			display: none !important;
		}

		body.is-editor-zen .admin-shell {
			grid-template-columns: minmax(0, 1fr);
			width: min(1600px, calc(100vw - 1.5rem));
			padding-top: 0.65rem;
		}

		body.is-editor-zen .markdown-editor-shell .form-textarea,
		body.is-editor-zen .markdown-preview-body {
			min-height: calc(100dvh - 240px);
			max-height: none;
		}

		/* 右侧检查器分组卡片与标签选中高亮 */
		.inspector-section {
			padding-bottom: 0.95rem;
			margin-bottom: 0.95rem;
			border-bottom: 1px solid var(--border);
		}

		.inspector-section:last-of-type {
			border-bottom: 0;
			margin-bottom: 0;
			padding-bottom: 0;
		}

		.inspector-section-title {
			font-size: 0.74rem;
			font-weight: 740;
			letter-spacing: 0.07em;
			text-transform: uppercase;
			color: var(--text-muted);
			margin-bottom: 0.72rem;
		}

		.checkbox-row-label {
			display: inline-flex !important;
			align-items: center;
			gap: 0.5rem;
			cursor: pointer;
			margin-bottom: 0 !important;
			color: var(--text) !important;
		}

		.tag-chip input[type="checkbox"] {
			accent-color: var(--accent);
			margin: 0;
		}

		.tag-chip:has(input:checked) {
			background: var(--accent-soft);
			border-color: rgba(var(--accent-rgb), 0.38);
			color: var(--accent);
			font-weight: 650;
		}

		/* 媒体库紧凑上传条、复制按钮组与预览灯箱 */
		.media-upload-compact {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			justify-content: space-between;
			gap: 0.85rem 1.2rem;
			padding: 0.95rem 1.15rem;
			margin-bottom: 1.1rem;
		}

		.media-upload-compact .media-upload-dropzone {
			flex: 1;
			min-width: min(320px, 100%);
			aspect-ratio: auto;
			min-height: 76px;
			padding: 0.75rem 1rem;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 1rem;
			text-align: left;
		}

		.media-preview-trigger {
			width: 100%;
			height: 100%;
			border: 0;
			padding: 0;
			background: transparent;
			cursor: zoom-in;
			display: flex;
			align-items: center;
			justify-content: center;
			overflow: hidden;
		}

		.media-preview-trigger img {
			transition: transform var(--transition-slow);
		}

		.media-item:hover .media-preview-trigger img {
			transform: scale(1.03);
		}

		.media-actions {
			justify-content: space-between;
			align-items: center;
		}

		.media-copy-group {
			display: flex;
			flex-wrap: wrap;
			gap: 0.35rem;
		}

		.media-lightbox {
			position: fixed;
			inset: 0;
			z-index: 880;
			display: grid;
			place-items: center;
			padding: 1.25rem;
			background: rgba(8, 12, 18, 0.78);
			backdrop-filter: blur(14px);
			-webkit-backdrop-filter: blur(14px);
		}

		.media-lightbox[hidden] {
			display: none !important;
		}

		.media-lightbox-card {
			width: min(860px, 100%);
			max-height: calc(100dvh - 2.5rem);
			display: grid;
			grid-template-rows: minmax(0, 1fr) auto;
			border-radius: 16px;
			border: 1px solid var(--border-strong);
			background: var(--surface-elevated);
			box-shadow: var(--shadow-strong);
			overflow: hidden;
		}

		.media-lightbox-stage {
			display: grid;
			place-items: center;
			background: rgba(9, 12, 16, 0.55);
			min-height: 280px;
			max-height: calc(100dvh - 11rem);
			overflow: auto;
			padding: 1rem;
		}

		.media-lightbox-stage img {
			max-width: 100%;
			max-height: calc(100dvh - 13rem);
			object-fit: contain;
			border-radius: 10px;
		}

		.media-lightbox-bar {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			justify-content: space-between;
			gap: 0.75rem;
			padding: 0.85rem 1.05rem;
			border-top: 1px solid var(--border);
		}

		.media-lightbox-meta {
			display: grid;
			gap: 0.14rem;
			min-width: 0;
		}

		.media-lightbox-key {
			font-family: var(--font-mono);
			font-size: 0.78rem;
			color: var(--text-secondary);
			word-break: break-all;
		}

		/* 统计页双栏排行与 HTTP 状态徽标 */
		.analytics-split-grid {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 1rem;
			align-items: start;
			margin-bottom: 0.5rem;
		}

		.analytics-split-grid h2 {
			margin-top: 0;
		}

		.badge-http-ok {
			background: rgba(22, 163, 74, 0.12);
			color: var(--success);
			border-color: rgba(22, 163, 74, 0.18);
			font-family: var(--font-mono);
		}

		.badge-http-warn {
			background: rgba(217, 119, 6, 0.12);
			color: var(--warning);
			border-color: rgba(217, 119, 6, 0.18);
			font-family: var(--font-mono);
		}

		.badge-http-err {
			background: rgba(220, 38, 38, 0.12);
			color: var(--danger);
			border-color: rgba(220, 38, 38, 0.18);
			font-family: var(--font-mono);
		}

		@media (max-width: 1080px) {
			.dashboard-quick-grid {
				grid-template-columns: repeat(2, minmax(0, 1fr));
			}

			.sidebar-nav-group-label {
				display: none;
			}

			.taxonomy-drawer-grid,
			.analytics-split-grid,
			.editor-doc-meta-grid {
				grid-template-columns: 1fr;
			}
		}

		@media (max-width: 720px) {
			.dashboard-quick-grid {
				grid-template-columns: 1fr;
			}

			.admin-filter-controls {
				justify-content: stretch;
			}

			.admin-search-input,
			.admin-filter-select {
				width: 100%;
			}

			.editor-studio-bar {
				position: static;
			}
		}
`;
