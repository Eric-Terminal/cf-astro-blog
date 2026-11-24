(function () {
	if (window.__commandPaletteBooted) {
		return;
	}
	window.__commandPaletteBooted = true;

	let metaCache = null;
	let pagefindCache = null;
	let lastFocusedEl = null;
	let selectedIndex = 0;

	const escapeHtml = (value) =>
		String(value ?? "")
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;")
			.replaceAll('"', "&quot;")
			.replaceAll("'", "&#39;");

	const loadMeta = async () => {
		if (metaCache) {
			return metaCache;
		}
		try {
			const res = await fetch("/pagefind-meta.json", {
				headers: { Accept: "application/json" },
			});
			if (!res.ok) {
				metaCache = [];
				return metaCache;
			}
			const data = await res.json();
			metaCache = Array.isArray(data?.posts) ? data.posts : [];
			return metaCache;
		} catch {
			metaCache = [];
			return metaCache;
		}
	};

	const loadPagefind = async () => {
		if (pagefindCache) {
			return pagefindCache;
		}
		try {
			const mod = await import("/pagefind/pagefind.js");
			pagefindCache = mod?.default ?? mod;
			return pagefindCache;
		} catch {
			return null;
		}
	};

	const extractSlug = (urlPath) => {
		const normalized = String(urlPath || "").replace(/\/+$/u, "");
		const match = normalized.match(/\/blog\/([^/]+)$/u);
		return match?.[1] || "";
	};

	const getElements = () => {
		const backdrop = document.querySelector("[data-cmd-backdrop]");
		if (!(backdrop instanceof HTMLElement)) {
			return null;
		}
		return {
			backdrop,
			input: backdrop.querySelector("[data-cmd-input]"),
			quickGroup: backdrop.querySelector("[data-cmd-quick-group]"),
			postsLabel: backdrop.querySelector("[data-cmd-posts-label]"),
			postsList: backdrop.querySelector("[data-cmd-posts-list]"),
			advancedLink: backdrop.querySelector("[data-cmd-advanced]"),
		};
	};

	const getSelectableItems = (backdrop) =>
		Array.from(backdrop.querySelectorAll(".cmd-item")).filter(
			(el) => el instanceof HTMLElement && !el.closest("[hidden]"),
		);

	const syncSelection = (backdrop, nextIndex) => {
		const items = getSelectableItems(backdrop);
		if (items.length === 0) {
			selectedIndex = 0;
			return;
		}
		selectedIndex = ((nextIndex % items.length) + items.length) % items.length;
		items.forEach((item, idx) => {
			item.classList.toggle("is-selected", idx === selectedIndex);
		});
		items[selectedIndex]?.scrollIntoView({ block: "nearest" });
	};

	const renderPostItems = (posts, emptyText) => {
		if (!posts || posts.length === 0) {
			return `<li class="cmd-empty">${escapeHtml(emptyText)}</li>`;
		}
		return posts
			.slice(0, 8)
			.map((post, idx) => {
				const url = post.url || `/blog/${encodeURIComponent(post.slug || "")}`;
				const sub = post.excerpt || post.authorName || "阅读全文";
				const tag = post.categoryName || "文章";
				const indexCode = String(idx + 1).padStart(2, "0");
				return `<li>
					<a href="${escapeHtml(url)}" class="cmd-item" data-cmd-nav>
						<span class="cmd-item-icon" aria-hidden="true">${indexCode}</span>
						<span class="cmd-item-main">
							<strong>${escapeHtml(post.title || "无标题")}</strong>
							<small>${escapeHtml(sub)}</small>
						</span>
						<span class="cmd-item-tag">${escapeHtml(tag)}</span>
					</a>
				</li>`;
			})
			.join("");
	};

	const updateResults = async (query) => {
		const els = getElements();
		if (!els || !(els.postsList instanceof HTMLElement)) {
			return;
		}
		const trimmed = String(query || "").trim();
		if (els.advancedLink instanceof HTMLAnchorElement) {
			els.advancedLink.href = trimmed
				? `/search?q=${encodeURIComponent(trimmed)}`
				: "/search";
		}

		const allPosts = await loadMeta();

		if (!trimmed) {
			if (els.quickGroup instanceof HTMLElement) {
				els.quickGroup.hidden = false;
			}
			if (els.postsLabel instanceof HTMLElement) {
				els.postsLabel.textContent = "近期发布";
			}
			els.postsList.innerHTML = renderPostItems(
				allPosts.slice(0, 5),
				"暂无已索引文章，可直接进入归档页查看",
			);
			syncSelection(els.backdrop, 0);
			return;
		}

		if (els.quickGroup instanceof HTMLElement) {
			els.quickGroup.hidden = true;
		}
		if (els.postsLabel instanceof HTMLElement) {
			els.postsLabel.textContent = `检索结果 · "${trimmed}"`;
		}

		let matched = [];
		const pf = await loadPagefind();
		if (pf && typeof pf.search === "function") {
			try {
				const res = await pf.search(trimmed);
				const items = await Promise.all(
					(res?.results ?? []).slice(0, 10).map((r) => r.data()),
				);
				const slugOrder = new Map();
				items.forEach((item, idx) => {
					const slug = extractSlug(
						new URL(item.url, window.location.origin).pathname,
					);
					if (slug) slugOrder.set(slug, idx);
				});
				if (allPosts.length > 0 && slugOrder.size > 0) {
					matched = allPosts
						.filter((p) => slugOrder.has(p.slug))
						.sort(
							(a, b) =>
								(slugOrder.get(a.slug) ?? 99) - (slugOrder.get(b.slug) ?? 99),
						);
				} else {
					matched = items.map((item) => ({
						title: item.meta?.title || "文章",
						excerpt: item.excerpt?.replace(/<[^>]+>/gu, "") || "",
						url: item.url,
						categoryName: "命中",
					}));
				}
			} catch {
				matched = [];
			}
		}

		if (matched.length === 0 && allPosts.length > 0) {
			const kw = trimmed.toLowerCase();
			matched = allPosts.filter((p) =>
				[p.title, p.excerpt, p.categoryName, ...(p.tagNames || [])]
					.join(" ")
					.toLowerCase()
					.includes(kw),
			);
		}

		els.postsList.innerHTML = renderPostItems(
			matched,
			"未找到匹配文章，可按回车前往高级搜索页",
		);
		syncSelection(els.backdrop, 0);
	};

	const openPalette = () => {
		const els = getElements();
		if (!els || !els.backdrop.hidden) {
			return;
		}
		lastFocusedEl =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		els.backdrop.hidden = false;
		document.documentElement.style.overflow = "hidden";
		if (els.input instanceof HTMLInputElement) {
			els.input.value = "";
			window.requestAnimationFrame(() => els.input.focus());
		}
		void updateResults("");
	};

	const closePalette = () => {
		const els = getElements();
		if (!els || els.backdrop.hidden) {
			return;
		}
		els.backdrop.hidden = true;
		document.documentElement.style.removeProperty("overflow");
		if (lastFocusedEl) {
			lastFocusedEl.focus({ preventScroll: true });
			lastFocusedEl = null;
		}
	};

	window.__openCommandPalette = openPalette;
	window.__closeCommandPalette = closePalette;

	document.addEventListener("click", (event) => {
		if (!(event.target instanceof Element)) {
			return;
		}
		if (event.target.closest("[data-command-trigger]")) {
			event.preventDefault();
			openPalette();
			return;
		}
		if (event.target.closest("[data-cmd-close]")) {
			closePalette();
			return;
		}
		const els = getElements();
		if (!els || els.backdrop.hidden) {
			return;
		}
		if (event.target === els.backdrop) {
			closePalette();
			return;
		}
		const themeAction = event.target.closest('[data-cmd-action="theme"]');
		if (themeAction) {
			closePalette();
			const toggle = document.querySelector(".theme-toggle");
			if (toggle instanceof HTMLElement) {
				toggle.click();
			}
			return;
		}
		if (event.target.closest("[data-cmd-nav]")) {
			closePalette();
		}
	});

	document.addEventListener("input", (event) => {
		if (
			event.target instanceof HTMLInputElement &&
			event.target.hasAttribute("data-cmd-input")
		) {
			void updateResults(event.target.value);
		}
	});

	document.addEventListener("keydown", (event) => {
		const els = getElements();
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
			if (window.location.pathname.startsWith("/api/admin")) {
				return;
			}
			event.preventDefault();
			if (els && !els.backdrop.hidden) {
				closePalette();
			} else {
				openPalette();
			}
			return;
		}

		if (!els || els.backdrop.hidden) {
			return;
		}

		if (event.key === "Escape") {
			event.preventDefault();
			closePalette();
			return;
		}

		if (event.key === "ArrowDown") {
			event.preventDefault();
			syncSelection(els.backdrop, selectedIndex + 1);
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			syncSelection(els.backdrop, selectedIndex - 1);
			return;
		}

		if (event.key === "Enter") {
			const items = getSelectableItems(els.backdrop);
			const activeItem = items[selectedIndex];
			if (activeItem instanceof HTMLElement) {
				event.preventDefault();
				activeItem.click();
			} else if (
				els.input instanceof HTMLInputElement &&
				els.input.value.trim()
			) {
				event.preventDefault();
				const q = encodeURIComponent(els.input.value.trim());
				closePalette();
				window.location.href = `/search?q=${q}`;
			}
		}
	});

	document.addEventListener("astro:before-swap", () => {
		document.documentElement.style.removeProperty("overflow");
	});
})();
