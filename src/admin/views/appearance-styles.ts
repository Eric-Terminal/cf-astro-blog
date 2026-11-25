// 站点外观工作室专属样式（分区标签页、吸顶保存栏与实时光学预览舞台）
export const appearanceStudioStyles = `
		<style>
			.appearance-studio-head {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				justify-content: space-between;
				gap: 0.75rem 1rem;
				margin-bottom: 1rem;
			}

			.appearance-studio-tabs {
				margin-bottom: 0;
			}

			.appearance-save-bar {
				position: sticky;
				top: 0.65rem;
				z-index: 28;
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				justify-content: space-between;
				gap: 0.65rem 1rem;
				padding: 0.65rem 0.95rem;
				margin-bottom: 1.15rem;
				border-radius: 14px;
				border: 1px solid var(--border-strong);
				background: rgba(var(--card-surface-rgb), 0.86);
				backdrop-filter: blur(22px) saturate(160%);
				-webkit-backdrop-filter: blur(22px) saturate(160%);
				box-shadow: var(--shadow-soft);
			}

			.appearance-save-bar.is-dirty {
				border-color: rgba(var(--accent-rgb), 0.42);
			}

			.appearance-save-state {
				display: inline-flex;
				align-items: center;
				gap: 0.48rem;
				font-size: 0.82rem;
				font-weight: 620;
				color: var(--text-secondary);
			}

			.appearance-dirty-dot {
				width: 0.46rem;
				height: 0.46rem;
				border-radius: 999px;
				background: var(--success);
				transition: background-color var(--transition-fast);
			}

			.appearance-save-bar.is-dirty .appearance-dirty-dot {
				background: var(--warning);
				box-shadow: 0 0 0 4px rgba(217, 119, 6, 0.18);
			}

			.appearance-grid {
				display: grid;
				grid-template-columns: minmax(0, 1.18fr) minmax(320px, 0.82fr);
				gap: 1.25rem;
				align-items: start;
			}

			.appearance-form-grid {
				margin-bottom: 1rem;
			}

			.appearance-panel {
				background: var(--bg-secondary);
				border: 1px solid var(--border);
				border-radius: var(--radius);
				padding: 1.15rem 1.2rem;
				margin-bottom: 1rem;
			}

			.appearance-panel:last-child {
				margin-bottom: 0;
			}

			.appearance-panel h2 {
				margin-top: 0;
			}

			[data-appearance-section].is-tab-hidden {
				display: none !important;
			}

			.appearance-copy {
				color: var(--text-muted);
				margin-top: -0.45rem;
				margin-bottom: 0.85rem;
				font-size: 0.84rem;
			}

			.appearance-stack {
				display: grid;
				gap: 1rem;
			}

			/* 右侧吸顶实时光学预览舞台 */
			.appearance-preview-rail {
				position: sticky;
				top: 4.5rem;
				display: grid;
				gap: 0.9rem;
			}

			.appearance-live-stage {
				position: relative;
				border-radius: var(--radius-lg);
				border: 1px solid var(--border-strong);
				background: #0c1118;
				color: #f4f7fb;
				overflow: hidden;
				box-shadow: var(--shadow-strong);
				--stage-bg-opacity: 0.72;
				--stage-bg-blur: 24px;
				--stage-bg-scale: 1.12;
				--stage-bg-pos-x: 50%;
				--stage-bg-pos-y: 50%;
				--stage-hero-alpha: 0.84;
				--stage-hero-blur: 18px;
				--stage-article-alpha: 0.86;
				--stage-article-blur: 18px;
			}

			.appearance-stage-bar {
				position: relative;
				z-index: 2;
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.5rem;
				padding: 0.55rem 0.8rem;
				border-bottom: 1px solid rgba(255, 255, 255, 0.1);
				background: rgba(9, 13, 20, 0.72);
				font-size: 0.73rem;
				color: rgba(226, 232, 240, 0.78);
			}

			.appearance-stage-dots {
				display: inline-flex;
				gap: 0.3rem;
			}

			.appearance-stage-dots i {
				width: 0.48rem;
				height: 0.48rem;
				border-radius: 999px;
				background: rgba(255, 255, 255, 0.24);
			}

			.appearance-stage-viewport {
				position: relative;
				padding: 0.85rem;
				min-height: 310px;
				display: grid;
				align-content: start;
				gap: 0.7rem;
				overflow: hidden;
			}

			.appearance-stage-wallpaper {
				position: absolute;
				inset: 0;
				background-color: #121926;
				background-image:
					radial-gradient(circle at 20% 20%, rgba(77, 163, 255, 0.34), transparent 52%),
					radial-gradient(circle at 82% 76%, rgba(56, 189, 248, 0.22), transparent 50%);
				background-size: cover;
				background-position: var(--stage-bg-pos-x) var(--stage-bg-pos-y);
				opacity: var(--stage-bg-opacity);
				filter: blur(var(--stage-bg-blur));
				transform: scale(var(--stage-bg-scale));
				transition:
					opacity 80ms linear,
					filter 80ms linear,
					transform 80ms linear,
					background-position 80ms linear;
			}

			.appearance-stage-scrim {
				position: absolute;
				inset: 0;
				background: linear-gradient(180deg, rgba(9, 13, 20, 0.24), rgba(9, 13, 20, 0.52));
				pointer-events: none;
			}

			.appearance-stage-nav,
			.appearance-stage-deck,
			.appearance-stage-article {
				position: relative;
				z-index: 1;
			}

			.appearance-stage-nav {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.5rem;
				padding: 0.42rem 0.68rem;
				border-radius: 999px;
				border: 1px solid rgba(255, 255, 255, 0.16);
				background: rgba(18, 24, 34, var(--stage-hero-alpha));
				backdrop-filter: blur(var(--stage-hero-blur));
				-webkit-backdrop-filter: blur(var(--stage-hero-blur));
				font-size: 0.72rem;
			}

			.appearance-stage-subtitle {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				color: rgba(241, 245, 249, 0.92);
				font-weight: 650;
			}

			.appearance-stage-links {
				display: inline-flex;
				gap: 0.38rem;
				color: rgba(203, 213, 225, 0.85);
				font-size: 0.68rem;
				flex-shrink: 0;
			}

			.appearance-stage-deck {
				display: grid;
				grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.9fr);
				gap: 0.6rem;
			}

			.appearance-stage-card {
				padding: 0.75rem;
				border-radius: 12px;
				border: 1px solid rgba(255, 255, 255, 0.15);
				background: rgba(18, 24, 34, var(--stage-hero-alpha));
				backdrop-filter: blur(var(--stage-hero-blur));
				-webkit-backdrop-filter: blur(var(--stage-hero-blur));
				display: grid;
				gap: 0.35rem;
				align-content: start;
			}

			.appearance-stage-kicker {
				font-size: 0.62rem;
				font-weight: 700;
				letter-spacing: 0.08em;
				text-transform: uppercase;
				color: #7cc0ff;
			}

			.appearance-stage-title {
				font-size: 0.92rem;
				font-weight: 740;
				line-height: 1.25;
				color: #f8fafc;
			}

			.appearance-stage-intro {
				font-size: 0.72rem;
				line-height: 1.45;
				color: rgba(203, 213, 225, 0.86);
				display: -webkit-box;
				-webkit-line-clamp: 3;
				-webkit-box-orient: vertical;
				overflow: hidden;
			}

			.appearance-stage-chips {
				display: flex;
				flex-wrap: wrap;
				gap: 0.25rem;
				margin-top: 0.2rem;
			}

			.appearance-stage-chips span {
				padding: 0.12rem 0.42rem;
				border-radius: 999px;
				background: rgba(255, 255, 255, 0.1);
				font-size: 0.64rem;
				color: rgba(241, 245, 249, 0.9);
			}

			.appearance-stage-article {
				display: flex;
				align-items: center;
				gap: 0.6rem;
				padding: 0.62rem 0.75rem;
				border-radius: 12px;
				border: 1px solid rgba(255, 255, 255, 0.14);
				background: rgba(18, 24, 34, var(--stage-article-alpha));
				backdrop-filter: blur(var(--stage-article-blur));
				-webkit-backdrop-filter: blur(var(--stage-article-blur));
			}

			.appearance-stage-avatar {
				width: 2.2rem;
				height: 2.2rem;
				border-radius: 9px;
				background: rgba(255, 255, 255, 0.12);
				overflow: hidden;
				display: grid;
				place-items: center;
				font-size: 0.72rem;
				font-weight: 700;
				flex-shrink: 0;
			}

			.appearance-stage-avatar img {
				width: 100%;
				height: 100%;
				object-fit: cover;
			}

			.appearance-upload-dropzone {
				position: relative;
				width: 100%;
				border: 1px dashed rgba(var(--accent-rgb), 0.34);
				border-radius: 0.95rem;
				background:
					linear-gradient(140deg, rgba(var(--accent-rgb), 0.08), rgba(var(--accent-rgb), 0.02)),
					rgba(255, 255, 255, 0.02);
				display: grid;
				place-items: center;
				padding: 0.9rem;
				text-align: center;
				overflow: hidden;
				cursor: pointer;
				min-height: 148px;
				transition:
					border-color var(--transition-fast),
					background-color var(--transition-fast),
					transform var(--transition-fast);
			}

			.appearance-upload-dropzone[data-appearance-background-dropzone="true"] .cover-preview-image[data-appearance-background-preview="true"] {
				display: block;
				width: 100%;
				max-height: 210px;
				object-fit: cover;
				border-radius: 10px;
			}

			.appearance-upload-dropzone:hover,
			.appearance-upload-dropzone.is-dragover {
				border-color: rgba(var(--accent-rgb), 0.65);
				background:
					linear-gradient(140deg, rgba(var(--accent-rgb), 0.16), rgba(var(--accent-rgb), 0.06)),
					rgba(255, 255, 255, 0.03);
				transform: translateY(-1px);
			}

			.appearance-upload-dropzone:focus-visible {
				outline: 2px solid rgba(var(--accent-rgb), 0.6);
				outline-offset: 2px;
			}

			.appearance-upload-copy {
				display: grid;
				gap: 0.35rem;
				color: var(--text-secondary);
			}

			.appearance-upload-copy strong {
				font-size: 0.95rem;
				color: var(--text);
			}

			.appearance-upload-copy span {
				font-size: 0.82rem;
				color: var(--text-muted);
			}

			.appearance-upload-input {
				display: none;
			}

			.appearance-hero-uploader {
				display: grid;
				gap: 0.6rem;
				margin-top: 0.65rem;
			}

			.appearance-hero-dropzone {
				min-height: 136px;
			}

			.appearance-hero-dropzone .cover-preview-image {
				max-height: 180px;
				object-fit: contain;
			}

			.appearance-background-actions {
				display: flex;
				flex-wrap: wrap;
				gap: 0.6rem;
				margin-top: 0.55rem;
			}

			.appearance-controls {
				display: grid;
				grid-template-columns: repeat(2, minmax(0, 1fr));
				gap: 0.85rem 1rem;
			}

			.appearance-inline-grid {
				display: grid;
				grid-template-columns: repeat(2, minmax(0, 1fr));
				gap: 0.85rem;
			}

			.appearance-chip-grid {
				display: grid;
				grid-template-columns: repeat(3, minmax(0, 1fr));
				gap: 0.75rem;
			}

			.appearance-list-head {
				display: flex;
				justify-content: space-between;
				align-items: center;
				flex-wrap: wrap;
				gap: 0.75rem;
				margin-bottom: 0.75rem;
			}

			.appearance-list-head h2,
			.appearance-list-head h3,
			.appearance-list-head h4 {
				margin: 0;
			}

			.appearance-note {
				margin: 0 0 0.75rem;
				color: var(--text-muted);
				font-size: 0.82rem;
				line-height: 1.55;
			}

			.appearance-link-list {
				display: grid;
				gap: 0.65rem;
			}

			.appearance-link-row {
				display: grid;
				grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
				gap: 0.65rem;
				align-items: end;
				padding: 0.72rem;
				border: 1px solid var(--border);
				border-radius: 0.8rem;
				background: rgba(var(--card-surface-rgb), 0.35);
			}

			.appearance-link-field {
				display: grid;
				gap: 0.32rem;
			}

			.appearance-link-field label {
				font-size: 0.78rem;
				font-weight: 620;
				color: var(--text-secondary);
			}

			.appearance-link-remove {
				align-self: end;
			}

			.appearance-content-fieldset {
				margin-top: 1rem;
				border-top: 1px solid var(--border);
				padding-top: 1rem;
			}

			.appearance-content-fieldset:first-of-type {
				margin-top: 0.5rem;
			}

			.appearance-content-fieldset h3 {
				font-size: 0.92rem;
				margin-bottom: 0.65rem;
			}

			.appearance-range {
				display: grid;
				gap: 0.42rem;
				padding: 0.62rem 0.75rem;
				border-radius: 10px;
				border: 1px solid var(--border);
				background: rgba(var(--card-surface-rgb), 0.36);
			}

			.appearance-range-meta {
				display: flex;
				justify-content: space-between;
				align-items: center;
				color: var(--text-secondary);
				font-size: 0.82rem;
				font-weight: 620;
			}

			.appearance-range-meta span {
				font-family: var(--font-mono);
				font-size: 0.76rem;
				color: var(--accent);
			}

			.appearance-range input[type="range"] {
				width: 100%;
				accent-color: var(--accent);
			}

			.appearance-actions {
				display: flex;
				flex-wrap: wrap;
				gap: 0.6rem;
				align-items: center;
			}

			.appearance-key-input {
				font-family: var(--font-mono);
				font-size: 0.8rem;
			}

			.appearance-panel .form-textarea:not(.form-textarea-sm) {
				min-height: 96px;
				font-family: var(--font);
				line-height: 1.58;
			}

			@media (max-width: 1040px) {
				.appearance-grid {
					grid-template-columns: 1fr;
				}

				.appearance-preview-rail {
					position: static;
					order: -1;
				}
			}

			@media (max-width: 760px) {
				.appearance-controls,
				.appearance-inline-grid,
				.appearance-chip-grid,
				.appearance-link-row,
				.appearance-stage-deck {
					grid-template-columns: 1fr;
				}

				.appearance-save-bar {
					position: static;
				}

				.appearance-link-remove {
					justify-self: start;
				}
			}
		</style>
`;
