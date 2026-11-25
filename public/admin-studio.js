// 后台工作室增强脚本：Toast 通知、⌘K 快捷面板、⌘S 保存、沉浸式 Markdown 编辑器、即时筛选与外观实时预览
(() => {
	const toastRoot = document.querySelector("[data-admin-toast-root]");

	function showAdminToast(message, tone = "info") {
		if (!(toastRoot instanceof HTMLElement) || !message) {
			return;
		}

		const toast = document.createElement("div");
		toast.className = `admin-toast${tone === "success" ? " is-success" : tone === "error" ? " is-error" : ""}`;
		toast.textContent = message;
		toastRoot.appendChild(toast);

		window.setTimeout(() => {
			toast.style.opacity = "0";
			toast.style.transform = "translate3d(0, 6px, 0)";
			toast.style.transition = "opacity 180ms ease, transform 180ms ease";
			window.setTimeout(() => toast.remove(), 200);
		}, 2400);
	}

	window.showAdminToast = showAdminToast;

	// 为所有复制按钮增加明确视觉反馈与全局 Toast（支持动态渲染或灯箱内复制按钮）
	document.addEventListener("click", async (event) => {
		const target = event.target;
		if (!(target instanceof Element)) {
			return;
		}

		const copyBtn = target.closest("button[data-copy-value]");
		if (copyBtn instanceof HTMLButtonElement) {
			const value = copyBtn.getAttribute("data-copy-value") ?? "";
			if (!value) {
				return;
			}

			try {
				await navigator.clipboard.writeText(value);
				const labelHint = copyBtn.getAttribute("data-copy-toast") || "已复制到剪贴板";
				const originalText =
					copyBtn.dataset.originalLabel || copyBtn.textContent || "复制";
				copyBtn.dataset.originalLabel = originalText;
				copyBtn.textContent = "已复制 ✓";
				showAdminToast(labelHint, "success");
				window.setTimeout(() => {
					copyBtn.textContent = originalText;
				}, 1500);
			} catch {
				showAdminToast("复制失败，请检查浏览器剪贴板权限", "error");
			}
			return;
		}

		const confirmLink = target.closest("a[data-confirm-message]");
		if (confirmLink instanceof HTMLAnchorElement) {
			const message = confirmLink.getAttribute("data-confirm-message");
			if (message && !window.confirm(message)) {
				event.preventDefault();
			}
		}
	});

	// ─── 后台快捷命令面板 (⌘K / Ctrl+K) ─────────────────────────────
	const cmdBackdrop = document.querySelector("[data-admin-cmd-backdrop]");
	const cmdInput = document.querySelector("[data-admin-cmd-input]");
	const cmdList = document.querySelector("[data-admin-cmd-list]");
	const cmdTriggers = document.querySelectorAll("[data-admin-cmd-open]");

	const COMMAND_ITEMS = [
		{ label: "写新文章", hint: "新建 Markdown 文章", href: "/api/admin/posts/new", keywords: "new write post xinjian xiewenzhang" },
		{ label: "控制台概览", hint: "查看站点数据与待办提醒", href: "/api/admin", keywords: "dashboard home overview kongzhitai" },
		{ label: "文章管理", hint: "搜索、筛选文章与分类标签", href: "/api/admin/posts", keywords: "posts articles list wenzhang" },
		{ label: "站点外观工作室", hint: "壁纸、毛玻璃、导航、首屏名片与 AI", href: "/api/admin/appearance", keywords: "appearance theme hero bg ai mcp waiguan" },
		{ label: "媒体资源库", hint: "上传图片、复制 URL 或 Markdown", href: "/api/admin/media", keywords: "media images r2 upload meiti" },
		{ label: "友链管理与审核", hint: "审核互链申请或手动录入友链", href: "/api/admin/friends", keywords: "friends links review youlian" },
		{ label: "Webmention 提及审核", hint: "处理外部跨站引用通知", href: "/api/admin/mentions", keywords: "mentions webmention review tiji" },
		{ label: "访问统计与 MCP 审计", hint: "查看热门页面、来源与导出日志", href: "/api/admin/analytics", keywords: "analytics stats mcp logs tongji" },
		{ label: "在新标签页打开前台首页", hint: "预览公开博客页面", href: "/", external: true, keywords: "frontend site preview qiantai" },
		{ label: "切换深浅色主题", hint: "同步切换前后台配色模式", action: "toggle-theme", keywords: "theme dark light shense qianse" },
	];

	let activeCmdIndex = 0;
	let filteredCmdItems = [...COMMAND_ITEMS];

	function executeCommandItem(item) {
		if (!item) {
			return;
		}
		closeAdminCmd();
		if (item.action === "toggle-theme") {
			const themeBtn = document.querySelector(".theme-toggle");
			if (themeBtn instanceof HTMLElement) {
				themeBtn.click();
			}
			return;
		}
		if (item.external && item.href) {
			window.open(item.href, "_blank", "noopener,noreferrer");
			return;
		}
		if (item.href) {
			window.location.href = item.href;
		}
	}

	function renderAdminCmdItems() {
		if (!(cmdList instanceof HTMLElement)) {
			return;
		}
		cmdList.innerHTML = "";
		if (filteredCmdItems.length === 0) {
			const empty = document.createElement("div");
			empty.className = "form-help";
			empty.style.padding = "0.75rem";
			empty.textContent = "没有匹配的后台入口";
			cmdList.appendChild(empty);
			return;
		}

		filteredCmdItems.forEach((item, index) => {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = `admin-cmd-item${index === activeCmdIndex ? " is-active" : ""}`;
			const titleSpan = document.createElement("span");
			titleSpan.textContent = item.label;
			const hintSpan = document.createElement("span");
			hintSpan.className = "admin-cmd-hint";
			hintSpan.textContent = item.hint;
			btn.append(titleSpan, hintSpan);
			btn.addEventListener("click", () => executeCommandItem(item));
			cmdList.appendChild(btn);
		});
	}

	function openAdminCmd() {
		if (!(cmdBackdrop instanceof HTMLElement)) {
			return;
		}
		cmdBackdrop.hidden = false;
		if (cmdInput instanceof HTMLInputElement) {
			cmdInput.value = "";
			filteredCmdItems = [...COMMAND_ITEMS];
			activeCmdIndex = 0;
			renderAdminCmdItems();
			window.requestAnimationFrame(() => cmdInput.focus());
		}
	}

	function closeAdminCmd() {
		if (cmdBackdrop instanceof HTMLElement) {
			cmdBackdrop.hidden = true;
		}
	}

	for (const trigger of cmdTriggers) {
		trigger.addEventListener("click", openAdminCmd);
	}

	cmdBackdrop?.addEventListener("click", (event) => {
		if (event.target === cmdBackdrop) {
			closeAdminCmd();
		}
	});

	cmdInput?.addEventListener("input", () => {
		if (!(cmdInput instanceof HTMLInputElement)) {
			return;
		}
		const query = cmdInput.value.trim().toLowerCase();
		filteredCmdItems = !query
			? [...COMMAND_ITEMS]
			: COMMAND_ITEMS.filter((item) =>
					`${item.label} ${item.hint} ${item.keywords}`.toLowerCase().includes(query),
				);
		activeCmdIndex = 0;
		renderAdminCmdItems();
	});

	cmdInput?.addEventListener("keydown", (event) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			if (filteredCmdItems.length > 0) {
				activeCmdIndex = (activeCmdIndex + 1) % filteredCmdItems.length;
				renderAdminCmdItems();
			}
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			if (filteredCmdItems.length > 0) {
				activeCmdIndex =
					(activeCmdIndex - 1 + filteredCmdItems.length) % filteredCmdItems.length;
				renderAdminCmdItems();
			}
		} else if (event.key === "Enter") {
			event.preventDefault();
			executeCommandItem(filteredCmdItems[activeCmdIndex]);
		} else if (event.key === "Escape") {
			event.preventDefault();
			closeAdminCmd();
		}
	});

	// ─── 全局快捷键：⌘S 保存当前表单、⌘K 打开快捷面板、Esc 退出禅模式/弹窗 ───
	document.addEventListener("keydown", (event) => {
		const isMod = event.metaKey || event.ctrlKey;

		if (isMod && event.key.toLowerCase() === "s") {
			const activeSaveForm =
				document.querySelector("form[data-editor-upload-url]") ||
				document.querySelector("form[data-appearance-form='true']");
			if (activeSaveForm instanceof HTMLFormElement) {
				event.preventDefault();
				showAdminToast("正在提交保存…");
				activeSaveForm.requestSubmit();
			}
			return;
		}

		if (isMod && event.key.toLowerCase() === "k") {
			// 在正文输入框内按 ⌘K 留给插入链接快捷操作
			if (document.activeElement?.id === "content") {
				return;
			}
			event.preventDefault();
			if (cmdBackdrop instanceof HTMLElement && !cmdBackdrop.hidden) {
				closeAdminCmd();
			} else {
				openAdminCmd();
			}
			return;
		}

		if (event.key === "Escape") {
			if (cmdBackdrop instanceof HTMLElement && !cmdBackdrop.hidden) {
				closeAdminCmd();
				return;
			}
			const lightbox = document.querySelector("[data-media-lightbox]");
			if (lightbox instanceof HTMLElement && !lightbox.hidden) {
				lightbox.hidden = true;
				return;
			}
			if (document.body.classList.contains("is-editor-zen")) {
				document.body.classList.remove("is-editor-zen");
				const zenBtn = document.querySelector("[data-editor-zen-toggle]");
				if (zenBtn instanceof HTMLElement) {
					zenBtn.classList.remove("is-active");
				}
			}
		}
	});

	// ─── 文章编辑器工作室增强 ────────────────────────────────────────
	const editorForm = document.querySelector("form[data-editor-upload-url]");
	if (editorForm instanceof HTMLFormElement) {
		const editorGrid = editorForm.querySelector(".editor-grid");
		const mdShell = editorForm.querySelector(".markdown-editor-shell");
		const contentArea = document.getElementById("content");
		const wordCounter = editorForm.querySelector("[data-editor-word-count]");
		const statusSelect = document.getElementById("status");
		const statusPill = editorForm.querySelector("[data-editor-status-pill]");
		const submitButtons = editorForm.querySelectorAll("[data-editor-submit-btn]");
		const isEditMode = editorForm.dataset.editorMode === "edit";
		const pinnedCheckbox = document.getElementById("isPinned");
		const pinnedOrderWrap = editorForm.querySelector("[data-pinned-order-wrap]");
		const inspectorToggleBtn = editorForm.querySelector("[data-editor-inspector-toggle]");
		const zenToggleBtn = editorForm.querySelector("[data-editor-zen-toggle]");
		const mdImageInput = editorForm.querySelector("[data-md-image-input]");

		const updateWordStats = () => {
			if (!(contentArea instanceof HTMLTextAreaElement) || !(wordCounter instanceof HTMLElement)) {
				return;
			}
			const raw = contentArea.value.trim();
			if (!raw) {
				wordCounter.textContent = "0 字 · 约 1 分钟阅读";
				return;
			}
			const cjkCount = (raw.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) || []).length;
			const latinWords = (
				raw
					.replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu, " ")
					.match(/[A-Za-z0-9_'-]+/g) || []
			).length;
			const totalUnits = cjkCount + latinWords;
			const minutes = Math.max(1, Math.round(totalUnits / 320));
			wordCounter.textContent = `${totalUnits.toLocaleString("zh-CN")} 字 · 约 ${minutes} 分钟阅读`;
		};

		const syncEditorHeaderByStatus = () => {
			if (!(statusSelect instanceof HTMLSelectElement)) {
				return;
			}
			const status = statusSelect.value;
			if (statusPill instanceof HTMLElement) {
				statusPill.className = `badge badge-${status === "published" ? "published" : status === "scheduled" ? "scheduled" : "draft"}`;
				statusPill.textContent =
					status === "published" ? "已发布" : status === "scheduled" ? "定时发布" : "草稿";
			}
			const nextLabel = isEditMode
				? status === "draft"
					? "保存草稿修改"
					: status === "scheduled"
						? "保存定时设置"
						: "保存修改"
				: status === "published"
					? "立即发布文章"
					: status === "scheduled"
						? "创建定时文章"
						: "保存为草稿";
			for (const btn of submitButtons) {
				if (btn instanceof HTMLElement) {
					btn.textContent = nextLabel;
				}
			}
		};

		const syncPinnedOrderVisibility = () => {
			if (!(pinnedCheckbox instanceof HTMLInputElement) || !(pinnedOrderWrap instanceof HTMLElement)) {
				return;
			}
			pinnedOrderWrap.classList.toggle("is-hidden", !pinnedCheckbox.checked);
		};

		// 视图模式切换：split / write / preview
		const savedView = window.localStorage.getItem("cf-astro-blog:editor-view") || "split";
		const applyEditorView = (view) => {
			const nextView = ["split", "write", "preview"].includes(view) ? view : "split";
			if (mdShell instanceof HTMLElement) {
				mdShell.dataset.editorView = nextView;
			}
			for (const btn of editorForm.querySelectorAll("[data-editor-view-btn]")) {
				if (btn instanceof HTMLElement) {
					btn.classList.toggle("is-active", btn.dataset.editorViewBtn === nextView);
				}
			}
			try {
				window.localStorage.setItem("cf-astro-blog:editor-view", nextView);
			} catch {
				// 忽略隐私模式异常
			}
		};

		for (const btn of editorForm.querySelectorAll("[data-editor-view-btn]")) {
			btn.addEventListener("click", () => {
				if (btn instanceof HTMLElement) {
					applyEditorView(btn.dataset.editorViewBtn || "split");
				}
			});
		}
		applyEditorView(savedView);

		// 右侧属性栏折叠
		const applyInspectorCollapsed = (collapsed) => {
			if (!(editorGrid instanceof HTMLElement)) {
				return;
			}
			editorGrid.dataset.editorInspector = collapsed ? "collapsed" : "open";
			if (inspectorToggleBtn instanceof HTMLElement) {
				inspectorToggleBtn.textContent = collapsed ? "展开属性栏" : "收起属性栏";
				inspectorToggleBtn.classList.toggle("is-active", collapsed);
			}
		};

		inspectorToggleBtn?.addEventListener("click", () => {
			const isCollapsed =
				editorGrid instanceof HTMLElement && editorGrid.dataset.editorInspector === "collapsed";
			applyInspectorCollapsed(!isCollapsed);
		});

		// 禅模式全屏写作
		zenToggleBtn?.addEventListener("click", () => {
			const nextZen = !document.body.classList.contains("is-editor-zen");
			document.body.classList.toggle("is-editor-zen", nextZen);
			if (zenToggleBtn instanceof HTMLElement) {
				zenToggleBtn.classList.toggle("is-active", nextZen);
			}
			if (nextZen) {
				showAdminToast("已进入专注全屏，按 Esc 可退出");
			}
		});

		// Markdown 语法插入工具栏
		const wrapSelection = (before, after = "", placeholder = "") => {
			if (!(contentArea instanceof HTMLTextAreaElement)) {
				return;
			}
			const start = contentArea.selectionStart ?? contentArea.value.length;
			const end = contentArea.selectionEnd ?? start;
			const selected = contentArea.value.slice(start, end);
			const body = selected || placeholder;
			const replacement = `${before}${body}${after}`;
			contentArea.setRangeText(replacement, start, end, "select");
			const innerStart = start + before.length;
			contentArea.setSelectionRange(innerStart, innerStart + body.length);
			contentArea.focus();
			contentArea.dispatchEvent(new Event("input", { bubbles: true }));
		};

		for (const toolBtn of editorForm.querySelectorAll("[data-md-action]")) {
			toolBtn.addEventListener("click", () => {
				if (!(toolBtn instanceof HTMLElement)) {
					return;
				}
				const action = toolBtn.dataset.mdAction;
				switch (action) {
					case "h2":
						wrapSelection("\n## ", "\n", "章节标题");
						break;
					case "h3":
						wrapSelection("\n### ", "\n", "小节标题");
						break;
					case "bold":
						wrapSelection("**", "**", "加粗文本");
						break;
					case "italic":
						wrapSelection("*", "*", "斜体文本");
						break;
					case "code":
						wrapSelection("`", "`", "code");
						break;
					case "codeblock":
						wrapSelection("\n```ts\n", "\n```\n", "// 在此输入代码");
						break;
					case "quote":
						wrapSelection("\n> ", "\n", "引用内容");
						break;
					case "ul":
						wrapSelection("\n- ", "\n", "列表项");
						break;
					case "link":
						wrapSelection("[", "](https://)", "链接文字");
						break;
					case "details":
						wrapSelection('\n[details="点击展开详情"]\n', "\n[/details]\n", "折叠内容");
						break;
					case "spoiler":
						wrapSelection("[spoiler]", "[/spoiler]", "隐藏剧透内容");
						break;
					case "image":
						if (mdImageInput instanceof HTMLInputElement) {
							mdImageInput.click();
						}
						break;
				}
			});
		}

		// 工具栏图片选择上传：直接复用正文 DataTransfer drop 通道，确保 scope 与去重逻辑完全一致
		mdImageInput?.addEventListener("change", () => {
			if (
				!(mdImageInput instanceof HTMLInputElement) ||
				!mdImageInput.files?.[0] ||
				!(contentArea instanceof HTMLTextAreaElement)
			) {
				return;
			}
			const file = mdImageInput.files[0];
			const dt = new DataTransfer();
			dt.items.add(file);
			const dropEvent = new DragEvent("drop", {
				bubbles: true,
				cancelable: true,
				dataTransfer: dt,
			});
			contentArea.dispatchEvent(dropEvent);
			mdImageInput.value = "";
		});

		// 正文框内快捷键：⌘B 加粗、⌘I 斜体、⌘K 链接、Tab 缩进
		contentArea?.addEventListener("keydown", (event) => {
			if (!(contentArea instanceof HTMLTextAreaElement)) {
				return;
			}
			const isMod = event.metaKey || event.ctrlKey;
			if (isMod && event.key.toLowerCase() === "b") {
				event.preventDefault();
				wrapSelection("**", "**", "加粗文本");
			} else if (isMod && event.key.toLowerCase() === "i") {
				event.preventDefault();
				wrapSelection("*", "*", "斜体文本");
			} else if (isMod && event.key.toLowerCase() === "k") {
				event.preventDefault();
				wrapSelection("[", "](https://)", "链接文字");
			} else if (event.key === "Tab") {
				event.preventDefault();
				const start = contentArea.selectionStart ?? 0;
				const end = contentArea.selectionEnd ?? start;
				contentArea.setRangeText("  ", start, end, "end");
				contentArea.dispatchEvent(new Event("input", { bubbles: true }));
			}
		});

		contentArea?.addEventListener("input", updateWordStats);
		statusSelect?.addEventListener("change", syncEditorHeaderByStatus);
		pinnedCheckbox?.addEventListener("change", syncPinnedOrderVisibility);

		updateWordStats();
		syncEditorHeaderByStatus();
		syncPinnedOrderVisibility();
	}

	// ─── 文章列表页：即时状态筛选、分类过滤与关键词搜索 ─────────────────
	const postsFilterRoot = document.querySelector("[data-posts-filter-root]");
	if (postsFilterRoot instanceof HTMLElement) {
		const postRows = Array.from(document.querySelectorAll("tr[data-post-row]"));
		const filterTabs = Array.from(
			postsFilterRoot.querySelectorAll("button[data-post-status-tab]"),
		);
		const searchInput = postsFilterRoot.querySelector("[data-post-search-input]");
		const categoryFilter = postsFilterRoot.querySelector("[data-post-category-filter]");
		const emptyHint = document.querySelector("[data-posts-filter-empty]");

		let activeStatus = "all";

		const applyPostsFilter = () => {
			const query =
				searchInput instanceof HTMLInputElement
					? searchInput.value.trim().toLowerCase()
					: "";
			const selectedCategory =
				categoryFilter instanceof HTMLSelectElement ? categoryFilter.value : "";

			let visibleCount = 0;
			for (const row of postRows) {
				if (!(row instanceof HTMLElement)) {
					continue;
				}
				const rowStatus = row.dataset.postStatus || "";
				const rowPinned = row.dataset.postPinned === "true";
				const rowCategory = row.dataset.postCategory || "";
				const rowSearch = (row.dataset.postSearch || "").toLowerCase();

				const statusMatch =
					activeStatus === "all"
						? true
						: activeStatus === "pinned"
							? rowPinned
							: rowStatus === activeStatus;
				const categoryMatch = !selectedCategory || rowCategory === selectedCategory;
				const queryMatch = !query || rowSearch.includes(query);

				const show = statusMatch && categoryMatch && queryMatch;
				row.hidden = !show;
				row.classList.toggle("is-hidden", !show);
				if (show) {
					visibleCount += 1;
				}
			}

			if (emptyHint instanceof HTMLElement) {
				const hideEmpty = visibleCount > 0 || postRows.length === 0;
				emptyHint.hidden = hideEmpty;
				emptyHint.classList.toggle("is-hidden", hideEmpty);
			}
		};

		for (const tab of filterTabs) {
			tab.addEventListener("click", () => {
				if (!(tab instanceof HTMLElement)) {
					return;
				}
				activeStatus = tab.dataset.postStatusTab || "all";
				for (const item of filterTabs) {
					item.classList.toggle("is-active", item === tab);
				}
				applyPostsFilter();
			});
		}

		searchInput?.addEventListener("input", applyPostsFilter);
		categoryFilter?.addEventListener("change", applyPostsFilter);
	}

	// ─── 站点外观工作室：分区标签页、未保存提醒、侧栏头像拖拽上传与 60fps 实时预览 ───
	const appearanceForm = document.querySelector("form[data-appearance-form='true']");
	if (appearanceForm instanceof HTMLFormElement) {
		const tabButtons = Array.from(
			document.querySelectorAll("button[data-appearance-tab-btn]"),
		);
		const sections = Array.from(
			appearanceForm.querySelectorAll("[data-appearance-section]"),
		);
		const saveBar = document.querySelector("[data-appearance-save-bar]");
		const saveStateText = document.querySelector("[data-appearance-save-state]");
		const resetFocusBtn = appearanceForm.querySelector("[data-appearance-reset-focus]");
		const liveStage = appearanceForm.querySelector("[data-appearance-live-stage]");

		const APPEARANCE_TAB_KEY = "cf-astro-blog:appearance-tab";

		const applyAppearanceTab = (tabId) => {
			const nextTab = tabId || "optics";
			for (const btn of tabButtons) {
				if (btn instanceof HTMLElement) {
					btn.classList.toggle("is-active", btn.dataset.appearanceTabBtn === nextTab);
				}
			}
			for (const section of sections) {
				if (!(section instanceof HTMLElement)) {
					continue;
				}
				const belongs = (section.dataset.appearanceSection || "").split(" ");
				const visible = nextTab === "all" || belongs.includes(nextTab);
				section.classList.toggle("is-tab-hidden", !visible);
			}
			try {
				window.sessionStorage.setItem(APPEARANCE_TAB_KEY, nextTab);
			} catch {
				// 忽略存储异常
			}
		};

		for (const btn of tabButtons) {
			btn.addEventListener("click", () => {
				if (btn instanceof HTMLElement) {
					applyAppearanceTab(btn.dataset.appearanceTabBtn || "optics");
				}
			});
		}

		let initialTab = "optics";
		try {
			initialTab = window.sessionStorage.getItem(APPEARANCE_TAB_KEY) || "optics";
		} catch {
			initialTab = "optics";
		}
		applyAppearanceTab(initialTab);

		// 未保存状态追踪
		const markDirty = () => {
			if (saveBar instanceof HTMLElement) {
				saveBar.classList.add("is-dirty");
			}
			if (saveStateText instanceof HTMLElement) {
				saveStateText.textContent = "未保存修改";
			}
		};

		appearanceForm.addEventListener("input", markDirty);
		appearanceForm.addEventListener("change", markDirty);

		// 一键重置壁纸焦点与缩放
		resetFocusBtn?.addEventListener("click", () => {
			const defaults = [
				["backgroundScale", "12"],
				["backgroundPositionX", "0"],
				["backgroundPositionY", "0"],
			];
			for (const [id, val] of defaults) {
				const el = document.getElementById(id);
				if (el instanceof HTMLInputElement) {
					el.value = val;
					el.dispatchEvent(new Event("input", { bubbles: true }));
				}
			}
			showAdminToast("已恢复默认缩放与居中焦点");
		});

		// 文章侧栏头像异步拖拽上传器
		const avatarUploader = appearanceForm.querySelector("[data-avatar-image-uploader='true']");
		if (avatarUploader instanceof HTMLElement) {
			const uploadUrl = avatarUploader.dataset.uploadUrl || "";
			const csrfToken = avatarUploader.dataset.csrfToken || "";
			const pathInput = document.getElementById("articleSidebarAvatarPath");
			const fileInput = avatarUploader.querySelector("[data-avatar-image-file-input='true']");
			const dropzone = avatarUploader.querySelector("[data-avatar-image-dropzone='true']");
			const selectBtn = avatarUploader.querySelector("[data-avatar-image-select='true']");
			const clearBtn = avatarUploader.querySelector("[data-avatar-image-clear='true']");
			const statusEl = avatarUploader.querySelector("[data-avatar-image-status]");

			const syncAvatarDropzone = (urlValue) => {
				if (!(dropzone instanceof HTMLElement)) {
					return;
				}
				const clean = String(urlValue || "").trim();
				if (!clean) {
					dropzone.innerHTML =
						'<div class="cover-empty">拖拽图片或点击上传侧栏头像</div>';
					return;
				}
				dropzone.innerHTML = "";
				const img = document.createElement("img");
				img.className = "cover-preview-image";
				img.src = clean;
				img.alt = "侧栏头像预览";
				dropzone.appendChild(img);
			};

			const uploadAvatar = async (file) => {
				if (!file || !uploadUrl || !csrfToken) {
					return;
				}
				if (statusEl instanceof HTMLElement) {
					statusEl.textContent = "正在上传头像…";
				}
				try {
					const fd = new FormData();
					fd.append("_csrf", csrfToken);
					fd.append("file", file);
					const res = await fetch(uploadUrl, {
						method: "POST",
						body: fd,
						credentials: "same-origin",
					});
					const payload = await res.json().catch(() => ({}));
					if (!res.ok || !payload?.key) {
						throw new Error(payload?.message || "头像上传失败");
					}
					const nextUrl = payload.url || `/media/${payload.key}`;
					if (pathInput instanceof HTMLInputElement) {
						pathInput.value = nextUrl;
						pathInput.dispatchEvent(new Event("input", { bubbles: true }));
					}
					syncAvatarDropzone(nextUrl);
					if (statusEl instanceof HTMLElement) {
						statusEl.textContent = "头像已上传，保存外观后生效";
						statusEl.className = "form-help is-success";
					}
					showAdminToast("侧栏头像上传成功", "success");
				} catch (err) {
					const msg = err instanceof Error ? err.message : "头像上传失败";
					if (statusEl instanceof HTMLElement) {
						statusEl.textContent = msg;
						statusEl.className = "form-help is-error";
					}
				}
			};

			selectBtn?.addEventListener("click", () => {
				if (fileInput instanceof HTMLInputElement) {
					fileInput.click();
				}
			});
			dropzone?.addEventListener("click", () => {
				if (fileInput instanceof HTMLInputElement) {
					fileInput.click();
				}
			});
			fileInput?.addEventListener("change", () => {
				if (fileInput instanceof HTMLInputElement && fileInput.files?.[0]) {
					void uploadAvatar(fileInput.files[0]);
					fileInput.value = "";
				}
			});
			clearBtn?.addEventListener("click", () => {
				if (pathInput instanceof HTMLInputElement) {
					pathInput.value = "";
					pathInput.dispatchEvent(new Event("input", { bubbles: true }));
				}
				syncAvatarDropzone("");
			});
			dropzone?.addEventListener("dragover", (event) => {
				event.preventDefault();
				dropzone.classList.add("is-dragover");
			});
			dropzone?.addEventListener("dragleave", () => {
				dropzone.classList.remove("is-dragover");
			});
			dropzone?.addEventListener("drop", (event) => {
				event.preventDefault();
				dropzone.classList.remove("is-dragover");
				const file = event.dataTransfer?.files?.[0];
				if (file) {
					void uploadAvatar(file);
				}
			});
			pathInput?.addEventListener("input", () => {
				if (pathInput instanceof HTMLInputElement) {
					syncAvatarDropzone(pathInput.value);
				}
			});
		}

		// 实时光学预览舞台同步
		const syncLiveStage = () => {
			if (!(liveStage instanceof HTMLElement)) {
				return;
			}
			const getVal = (id, fallback = "") => {
				const el = document.getElementById(id);
				return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
					? el.value
					: fallback;
			};

			const bgTransparency = Number(getVal("backgroundTransparency", "28"));
			const bgBlur = Number(getVal("backgroundBlur", "24"));
			const bgScale = Number(getVal("backgroundScale", "12"));
			const bgPosX = Number(getVal("backgroundPositionX", "0"));
			const bgPosY = Number(getVal("backgroundPositionY", "0"));
			const heroTransparency = Number(getVal("heroCardTransparency", "18"));
			const heroBlur = Number(getVal("heroCardBlur", "18"));
			const articleTransparency = Number(getVal("articlePanelTransparency", "16"));
			const articleBlur = Number(getVal("articlePanelBlur", "18"));

			liveStage.style.setProperty(
				"--stage-bg-opacity",
				String(Math.max(0, Math.min(1, (100 - bgTransparency) / 100))),
			);
			liveStage.style.setProperty("--stage-bg-blur", `${Math.round(bgBlur * 0.35)}px`);
			liveStage.style.setProperty(
				"--stage-bg-scale",
				String(((100 + bgScale) / 100).toFixed(2)),
			);
			liveStage.style.setProperty("--stage-bg-pos-x", `${50 + bgPosX}%`);
			liveStage.style.setProperty("--stage-bg-pos-y", `${50 + bgPosY}%`);
			liveStage.style.setProperty(
				"--stage-hero-alpha",
				String(Math.max(0.08, Math.min(0.98, (100 - heroTransparency) / 100))),
			);
			liveStage.style.setProperty("--stage-hero-blur", `${Math.round(heroBlur * 0.5)}px`);
			liveStage.style.setProperty(
				"--stage-article-alpha",
				String(Math.max(0.08, Math.min(0.98, (100 - articleTransparency) / 100))),
			);
			liveStage.style.setProperty(
				"--stage-article-blur",
				`${Math.round(articleBlur * 0.5)}px`,
			);

			const wallpaperEl = liveStage.querySelector("[data-stage-wallpaper]");
			const bgKey = getVal("backgroundImageKey").trim();
			if (wallpaperEl instanceof HTMLElement) {
				if (bgKey) {
					const bgUrl =
						bgKey.startsWith("http://") ||
						bgKey.startsWith("https://") ||
						bgKey.startsWith("/")
							? bgKey
							: `/media/${bgKey.replace(/^\/+/u, "")}`;
					wallpaperEl.style.backgroundImage = `url("${CSS.escape ? bgUrl.replaceAll('"', '\\"') : bgUrl}")`;
				} else {
					wallpaperEl.style.backgroundImage = "";
				}
			}

			const bindText = (selector, text) => {
				const node = liveStage.querySelector(selector);
				if (node instanceof HTMLElement) {
					node.textContent = text;
				}
			};

			bindText("[data-stage-subtitle]", getVal("headerSubtitle") || "顶部状态栏");
			bindText("[data-stage-kicker]", getVal("heroKicker") || "FEATURED");
			bindText("[data-stage-title]", getVal("heroTitle") || "站点主标题");
			bindText("[data-stage-intro]", getVal("heroIntro") || "首页首屏简介预览");
			bindText("[data-stage-signal-label]", getVal("heroSignalLabel") || "SIGNAL");
			bindText("[data-stage-signal-heading]", getVal("heroSignalHeading") || "右侧展示名片");
			bindText("[data-stage-sidebar-name]", getVal("articleSidebarName") || "作者名称");
			bindText("[data-stage-sidebar-badge]", getVal("articleSidebarBadge") || "AUTHOR");
			bindText("[data-stage-sidebar-bio]", getVal("articleSidebarBio") || "文章侧栏简介");

			const chipsWrap = liveStage.querySelector("[data-stage-chips]");
			if (chipsWrap instanceof HTMLElement) {
				const chips = [
					getVal("heroSignalChip1").trim(),
					getVal("heroSignalChip2").trim(),
					getVal("heroSignalChip3").trim(),
				].filter(Boolean);
				chipsWrap.innerHTML = "";
				for (const chip of chips) {
					const span = document.createElement("span");
					span.textContent = chip;
					chipsWrap.appendChild(span);
				}
			}

			const navWrap = liveStage.querySelector("[data-stage-nav-links]");
			if (navWrap instanceof HTMLElement) {
				const labels = Array.from(
					appearanceForm.querySelectorAll("input[name='navLinkLabel']"),
				)
					.map((el) => (el instanceof HTMLInputElement ? el.value.trim() : ""))
					.filter(Boolean)
					.slice(0, 4);
				navWrap.textContent = labels.join(" · ") || "首页 · 归档";
			}

			const avatarStage = liveStage.querySelector("[data-stage-avatar]");
			if (avatarStage instanceof HTMLElement) {
				const avatarPath = getVal("articleSidebarAvatarPath").trim();
				const authorName = getVal("articleSidebarName").trim() || "A";
				avatarStage.innerHTML = "";
				if (avatarPath) {
					const img = document.createElement("img");
					img.src = avatarPath;
					img.alt = "";
					avatarStage.appendChild(img);
				} else {
					avatarStage.textContent = Array.from(authorName)[0] || "A";
				}
			}
		};

		appearanceForm.addEventListener("input", syncLiveStage);
		appearanceForm.addEventListener("change", syncLiveStage);
		syncLiveStage();
	}

	// ─── 媒体库：目录分类筛选、文件名即时搜索与大图灯箱 ─────────────────
	const mediaFilterRoot = document.querySelector("[data-media-filter-root]");
	const mediaCards = Array.from(document.querySelectorAll("[data-media-card]"));
	const mediaLightbox = document.querySelector("[data-media-lightbox]");

	if (mediaFilterRoot instanceof HTMLElement && mediaCards.length > 0) {
		const scopeButtons = Array.from(
			mediaFilterRoot.querySelectorAll("button[data-media-scope-tab]"),
		);
		const searchInput = mediaFilterRoot.querySelector("[data-media-search-input]");
		const emptyHint = document.querySelector("[data-media-filter-empty]");
		let activeScope = "all";

		const applyMediaFilter = () => {
			const query =
				searchInput instanceof HTMLInputElement
					? searchInput.value.trim().toLowerCase()
					: "";
			let visible = 0;
			for (const card of mediaCards) {
				if (!(card instanceof HTMLElement)) {
					continue;
				}
				const cardScope = card.dataset.mediaScope || "other";
				const cardUsed = card.dataset.mediaUsed || "unused";
				const cardKey = (card.dataset.mediaKey || "").toLowerCase();
				const scopeMatch =
					activeScope === "all"
						? true
						: activeScope === "used" || activeScope === "unused"
							? cardUsed === activeScope
							: cardScope === activeScope;
				const queryMatch = !query || cardKey.includes(query);
				const show = scopeMatch && queryMatch;
				card.hidden = !show;
				card.classList.toggle("is-hidden", !show);
				if (show) {
					visible += 1;
				}
			}
			if (emptyHint instanceof HTMLElement) {
				const hideEmpty = visible > 0;
				emptyHint.hidden = hideEmpty;
				emptyHint.classList.toggle("is-hidden", hideEmpty);
			}
		};

		for (const btn of scopeButtons) {
			btn.addEventListener("click", () => {
				if (!(btn instanceof HTMLElement)) {
					return;
				}
				activeScope = btn.dataset.mediaScopeTab || "all";
				for (const item of scopeButtons) {
					item.classList.toggle("is-active", item === btn);
				}
				applyMediaFilter();
			});
		}

		searchInput?.addEventListener("input", applyMediaFilter);
	}

	if (mediaLightbox instanceof HTMLElement) {
		const stageImg = mediaLightbox.querySelector("[data-lightbox-img]");
		const keyLabel = mediaLightbox.querySelector("[data-lightbox-key]");
		const sizeLabel = mediaLightbox.querySelector("[data-lightbox-size]");
		const copyUrlBtn = mediaLightbox.querySelector("[data-lightbox-copy-url]");
		const copyMdBtn = mediaLightbox.querySelector("[data-lightbox-copy-md]");
		const copyKeyBtn = mediaLightbox.querySelector("[data-lightbox-copy-key]");
		const closeBtn = mediaLightbox.querySelector("[data-lightbox-close]");

		for (const trigger of document.querySelectorAll("[data-media-zoom-trigger]")) {
			trigger.addEventListener("click", () => {
				if (!(trigger instanceof HTMLElement)) {
					return;
				}
				const src = trigger.dataset.mediaSrc || "";
				const key = trigger.dataset.mediaKey || "";
				const publicUrl = `/media/${key}`;
				const name = (key.split("/").pop() || "图片").replace(/\.[^.]+$/u, "");
				const size = trigger.dataset.mediaSize || "";

				if (stageImg instanceof HTMLImageElement) {
					stageImg.src = src;
					stageImg.alt = key;
				}
				if (keyLabel instanceof HTMLElement) {
					keyLabel.textContent = key;
				}
				if (sizeLabel instanceof HTMLElement) {
					sizeLabel.textContent = size;
				}
				if (copyUrlBtn instanceof HTMLElement) {
					copyUrlBtn.setAttribute("data-copy-value", publicUrl);
				}
				if (copyMdBtn instanceof HTMLElement) {
					copyMdBtn.setAttribute("data-copy-value", `![${name}](${publicUrl})`);
				}
				if (copyKeyBtn instanceof HTMLElement) {
					copyKeyBtn.setAttribute("data-copy-value", key);
				}
				mediaLightbox.hidden = false;
			});
		}

		closeBtn?.addEventListener("click", () => {
			mediaLightbox.hidden = true;
		});
		mediaLightbox.addEventListener("click", (event) => {
			if (event.target === mediaLightbox) {
				mediaLightbox.hidden = true;
			}
		});
	}

	// ─── 友链管理：即时关键词过滤 ──────────────────────────────────────
	const friendSearchInput = document.querySelector("[data-friend-search-input]");
	if (friendSearchInput instanceof HTMLInputElement) {
		const friendCards = Array.from(document.querySelectorAll(".friend-queue-item"));
		friendSearchInput.addEventListener("input", () => {
			const query = friendSearchInput.value.trim().toLowerCase();
			for (const card of friendCards) {
				if (!(card instanceof HTMLElement)) {
					continue;
				}
				const text = (card.textContent || "").toLowerCase();
				const hide = Boolean(query && !text.includes(query));
				card.hidden = hide;
				card.classList.toggle("is-hidden", hide);
			}
		});
	}
})();
