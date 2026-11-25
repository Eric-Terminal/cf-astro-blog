/**
 * article-toc-highlight.js
 *
 * 功能：
 * 1. 使用 IntersectionObserver 追踪当前可视标题，为 TOC 对应链接添加 .active 类
 * 2. .active 条目变化时，自动将该链接滚动到 .article-toc-body 可视区内
 */
(function () {
	if (window.__articleTocHighlightBooted) return;
	window.__articleTocHighlightBooted = true;

	const TOC_NAV_SELECTOR = ".article-toc";
	const TOC_BODY_SELECTOR = ".article-toc-body";
	const TOC_LINK_SELECTOR = ".article-toc-link[data-toc-id]";
	const PROSE_SELECTOR = ".article-prose";
	const ACTIVE_CLASS = "active";

	let disposeCurrent = null;

	const init = () => {
		const tocNav = document.querySelector(TOC_NAV_SELECTOR);
		if (!tocNav) return;

		const tocBody = tocNav.querySelector(TOC_BODY_SELECTOR);
		const prose = document.querySelector(PROSE_SELECTOR);
		if (!tocBody || !prose) return;

		/** @type {Map<string, HTMLElement>} id → TOC 链接元素 */
		const linkMap = new Map();
		tocNav.querySelectorAll(TOC_LINK_SELECTOR).forEach((link) => {
			linkMap.set(link.dataset.tocId, link);
		});
		if (linkMap.size === 0) return;

		/** 按文档顺序收集所有带 id 的标题 */
		const headings = Array.from(
			prose.querySelectorAll(":is(h1,h2,h3,h4,h5,h6)[id]"),
		).filter((h) => linkMap.has(h.id));
		if (headings.length === 0) return;

		/** 当前高亮的 id */
		let activeId = null;

		/**
		 * 设置高亮：移除旧 .active，添加新 .active，并将新链接滚动入 TOC body 可视区
		 * @param {string} id
		 */
		const setActive = (id) => {
			if (id === activeId) return;
			activeId = id;

			linkMap.forEach((link) => link.classList.remove(ACTIVE_CLASS));

			const activeLink = linkMap.get(id);
			if (!activeLink) return;
			activeLink.classList.add(ACTIVE_CLASS);

			// 将高亮项自动滚动到 tocBody 可视范围内
			const bodyRect = tocBody.getBoundingClientRect();
			const linkRect = activeLink.getBoundingClientRect();
			if (linkRect.top < bodyRect.top || linkRect.bottom > bodyRect.bottom) {
				activeLink.scrollIntoView({ block: "nearest", behavior: "smooth" });
			}

			window.dispatchEvent(
				new CustomEvent("article:toc-change", { detail: { id } }),
			);
		};

		/**
		 * 维护一个"当前可见标题"计数集合。
		 * 使用 rootMargin 让标题在进入导航栏底部下方时即触发。
		 * 取所有可见标题中文档顺序最靠前的一个作为 active。
		 */
		const visibleIds = new Set();

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					const id = entry.target.id;
					if (entry.isIntersecting) {
						visibleIds.add(id);
					} else {
						visibleIds.delete(id);
					}
				});

				if (visibleIds.size > 0) {
					// 从可见集中选文档顺序最靠前的标题
					const firstVisible = headings.find((h) => visibleIds.has(h.id));
					if (firstVisible) setActive(firstVisible.id);
				} else {
					// 没有标题可见时：选取滚动位置上方最近的一个标题
					const scrollY = window.scrollY;
					let best = null;
					for (const h of headings) {
						const top = h.getBoundingClientRect().top + scrollY;
						if (top <= scrollY + 120) {
							best = h;
						} else {
							break;
						}
					}
					if (best) setActive(best.id);
				}
			},
			{
				// rootMargin: 负的上方偏移量等于导航栏高度，让标题刚离开导航栏下方时触发
				rootMargin: "-96px 0px -60% 0px",
				threshold: 0,
			},
		);

		headings.forEach((h) => observer.observe(h));

		// 页面加载时立即同步一次活跃标题
		const syncOnLoad = () => {
			const scrollY = window.scrollY;
			let best = null;
			for (const h of headings) {
				const top = h.getBoundingClientRect().top + scrollY;
				if (top <= scrollY + 120) {
					best = h;
				} else {
					break;
				}
			}
			if (best) setActive(best.id);
		};
		syncOnLoad();

		disposeCurrent = () => {
			observer.disconnect();
			linkMap.forEach((link) => link.classList.remove(ACTIVE_CLASS));
			activeId = null;
		};
	};

	const cleanup = () => {
		if (disposeCurrent) {
			disposeCurrent();
			disposeCurrent = null;
		}
		// 允许下次页面加载时重新初始化
		window.__articleTocHighlightBooted = false;
	};

	document.addEventListener("astro:before-swap", cleanup);
	document.addEventListener("astro:page-load", () => {
		window.__articleTocHighlightBooted = true;
		init();
	});
})();
