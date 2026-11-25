(function () {
	const root = document.documentElement;
	const NAV_CONDENSE_ENTER_Y = 56;
	const NAV_CONDENSE_EXIT_Y = 20;
	const ROUTE_TRANSITION_ORDER = [
		{
			order: 0,
			matches: (pathname) => pathname === "/",
		},
		{
			order: 1,
			matches: (pathname) =>
				pathname === "/blog" || pathname.startsWith("/blog/"),
		},
		{
			order: 2,
			matches: (pathname) =>
				pathname === "/friends" || pathname.startsWith("/friends/"),
		},
		{
			order: 3,
			matches: (pathname) => pathname === "/search",
		},
	];
	let isNavCondensed = root.hasAttribute("data-nav-condensed");
	let isRouteTransitioning = false;
	let isThemeTransitioning = false;
	let syncFrame = 0;
	let pendingForceSync = false;
	let lastChapterText = "";
	let lastChapterIndex = -1;
	let hoveredTocChapter = "";
	let hoveredTocIndex = -1;
	let lastPercentValue = -1;
	let lastScrollY = window.scrollY || 0;

	const theme = localStorage.getItem("theme");
	if (theme === "dark" || theme === "light") {
		root.setAttribute("data-theme", theme);
	}

	const normalizeScrollY = (scrollY) =>
		Number.isFinite(scrollY) ? Math.max(0, scrollY) : 0;

	const getRouteTransitionOrder = (pathname) => {
		const matchedRoute = ROUTE_TRANSITION_ORDER.find((route) =>
			route.matches(pathname),
		);

		return matchedRoute?.order ?? null;
	};

	const getRouteTransitionDirection = (fromUrl, toUrl, fallbackDirection) => {
		if (fallbackDirection === "back") {
			return fallbackDirection;
		}

		const fromOrder = getRouteTransitionOrder(fromUrl.pathname);
		const toOrder = getRouteTransitionOrder(toUrl.pathname);

		if (fromOrder === null || toOrder === null || fromOrder === toOrder) {
			return fallbackDirection;
		}

		return toOrder > fromOrder ? "forward" : "back";
	};

	const getInitialNavCondensedState = (scrollY) =>
		normalizeScrollY(scrollY) >= NAV_CONDENSE_ENTER_Y;

	const getNextNavCondensedState = (scrollY) => {
		const normalizedScrollY = normalizeScrollY(scrollY);

		if (isNavCondensed) {
			return normalizedScrollY > NAV_CONDENSE_EXIT_Y;
		}

		return normalizedScrollY >= NAV_CONDENSE_ENTER_Y;
	};

	// 同步导航栏滑动胶囊高亮位置与当前激活路由
	const syncNavGlidePill = (targetLink) => {
		const navList = document.querySelector("[data-nav-links]");
		const indicator = document.querySelector("[data-nav-indicator]");
		if (!(navList instanceof HTMLElement) || !(indicator instanceof HTMLElement)) {
			return;
		}
		const link =
			targetLink instanceof HTMLElement
				? targetLink
				: navList.querySelector(".nav-link.active");
		if (!(link instanceof HTMLElement) || link.offsetWidth === 0) {
			navList.style.setProperty("--glide-opacity", "0");
			return;
		}
		const navRect = navList.getBoundingClientRect();
		const linkRect = link.getBoundingClientRect();
		const offsetX = linkRect.left - navRect.left;
		navList.style.setProperty("--glide-x", `${offsetX.toFixed(1)}px`);
		navList.style.setProperty("--glide-w", `${linkRect.width.toFixed(1)}px`);
		navList.style.setProperty("--glide-opacity", "1");
	};

	const syncActiveNavLinksByPath = () => {
		const currentPath = window.location.pathname;
		const links = document.querySelectorAll(".site-nav .nav-link");
		for (const link of links) {
			if (!(link instanceof HTMLAnchorElement)) continue;
			const href = link.getAttribute("href") || "";
			if (!href.startsWith("/") || href.startsWith("//")) {
				link.classList.remove("active");
				continue;
			}
			const isActive =
				href === "/"
					? currentPath === "/"
					: currentPath === href || currentPath.startsWith(`${href}/`);
			link.classList.toggle("active", isActive);
		}
		syncNavGlidePill();
	};

	const bindNavHoverGlide = () => {
		const navList = document.querySelector("[data-nav-links]");
		if (!(navList instanceof HTMLElement) || navList.dataset.glideBound === "1") {
			return;
		}
		navList.dataset.glideBound = "1";
		navList.addEventListener("pointerover", (event) => {
			if (!(event.target instanceof Element)) return;
			const link = event.target.closest(".nav-link");
			if (link instanceof HTMLElement) {
				syncNavGlidePill(link);
			}
		});
		navList.addEventListener("pointerleave", () => {
			syncNavGlidePill();
		});
	};

	const measureNavContentWidth = (isReadingHudCompact) => {
		const shell = document.querySelector(".site-nav-shell");
		if (!(shell instanceof HTMLElement)) return 0;
		const style = window.getComputedStyle(shell);
		const gap = parseFloat(style.columnGap) || parseFloat(style.gap) || 0;
		const pl = parseFloat(style.paddingLeft) || 0;
		const pr = parseFloat(style.paddingRight) || 0;

		if (isReadingHudCompact) {
			const brand = shell.querySelector(".site-brand");
			const measureEl = shell.querySelector("[data-nav-reading-measure]");
			const actions = shell.querySelector(".nav-actions");
			const brandW = brand instanceof HTMLElement ? brand.offsetWidth : 32;
			const rawChapterW =
				measureEl instanceof HTMLElement ? measureEl.offsetWidth : 120;
			const hudW = 6 + 9 + Math.min(rawChapterW, 460);
			const actionsW =
				actions instanceof HTMLElement ? actions.scrollWidth : 168;
			return Math.ceil(pl + pr + brandW + hudW + actionsW + gap * 2 + 26);
		}

		const visibleChildren = Array.from(shell.children).filter(
			(child) =>
				child instanceof HTMLElement &&
				!child.hasAttribute("data-nav-reading-measure") &&
				window.getComputedStyle(child).display !== "none",
		);
		if (visibleChildren.length === 0) return pl + pr;
		let totalW = pl + pr + gap * Math.max(0, visibleChildren.length - 1);
		for (const child of visibleChildren) {
			totalW += Math.max(
				child.scrollWidth || 0,
				child.getBoundingClientRect().width,
			);
		}
		return Math.ceil(totalW);
	};

	const syncCondensedNavWidth = () => {
		const scrollShell = document.querySelector(".site-nav-shell-scroll");
		if (!isNavCondensed) {
			root.style.removeProperty("--nav-shell-condensed-computed-inset");
			return;
		}
		const MIN_INSET_PX = 16;
		const isReadingHudCompact =
			root.getAttribute("data-reading-active") === "true" &&
			window.innerWidth >= 769 &&
			!document.querySelector(".site-nav-shell-scroll:hover");
		if (isReadingHudCompact && scrollShell instanceof HTMLElement) {
			scrollShell.scrollLeft = 0;
		}
		const vw = window.innerWidth;
		const maxAllowed = vw - MIN_INSET_PX * 2;
		const NAV_MAX_W = isReadingHudCompact
			? Math.min(760, maxAllowed)
			: Math.min(820, maxAllowed);
		const contentW = measureNavContentWidth(isReadingHudCompact);
		if (contentW === 0) {
			return;
		}
		const targetW = isReadingHudCompact
			? Math.min(Math.max(contentW, 320), NAV_MAX_W)
			: Math.min(Math.max(contentW + 16, Math.min(520, NAV_MAX_W)), NAV_MAX_W);
		const newInset = Math.max(MIN_INSET_PX, (vw - targetW) / 2);
		root.style.setProperty(
			"--nav-shell-condensed-computed-inset",
			`${newInset.toFixed(1)}px`,
		);
	};

	// Apple Watch 心率滚轮式方向感知章节翻牌动画
	const animateChapterRoll = (nextText, nextIndex, scrollDir) => {
		const chapterEl = document.querySelector("[data-nav-reading-chapter]");
		const reelEl = document.querySelector("[data-nav-reading-reel]");
		const measureEl = document.querySelector("[data-nav-reading-measure]");
		if (!(chapterEl instanceof HTMLElement)) {
			return;
		}
		if (measureEl instanceof HTMLElement) {
			measureEl.textContent = nextText;
		}
		if (nextText === lastChapterText) {
			return;
		}

		let rollDir = scrollDir === "up" ? "down" : "up";
		if (
			nextIndex >= 0 &&
			lastChapterIndex >= 0 &&
			nextIndex !== lastChapterIndex
		) {
			rollDir = nextIndex > lastChapterIndex ? "up" : "down";
		}

		const shouldAnimate =
			Boolean(lastChapterText) &&
			isNavCondensed &&
			reelEl instanceof HTMLElement &&
			!window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		if (shouldAnimate && reelEl instanceof HTMLElement) {
			reelEl
				.querySelectorAll(".nav-hud-chapter-ghost")
				.forEach((node) => node.remove());
			const ghost = document.createElement("span");
			ghost.className = `nav-hud-chapter-ghost roll-exit-${rollDir}`;
			ghost.setAttribute("aria-hidden", "true");
			ghost.textContent = lastChapterText;
			reelEl.appendChild(ghost);
			const removeGhost = () => ghost.remove();
			ghost.addEventListener("animationend", removeGhost, { once: true });
			window.setTimeout(removeGhost, 360);

			chapterEl.textContent = nextText;
			chapterEl.classList.remove("roll-enter-up", "roll-enter-down");
			void chapterEl.offsetWidth;
			chapterEl.classList.add(`roll-enter-${rollDir}`);
		} else {
			chapterEl.textContent = nextText;
		}

		lastChapterText = nextText;
		lastChapterIndex = nextIndex;

		if (isNavCondensed) {
			syncCondensedNavWidth();
		}
	};

	// 同步文章阅读进度、当前章节播报舱与环形进度胶囊
	const syncReadingProgress = () => {
		const articleBody = document.querySelector(".article-body");
		const backTopButton = document.querySelector("[data-nav-back-top]");
		const percentEl = document.querySelector("[data-nav-reading-percent]");
		const currentScrollY = window.scrollY || 0;
		const scrollDir = currentScrollY < lastScrollY ? "up" : "down";
		lastScrollY = currentScrollY;

		if (!(articleBody instanceof HTMLElement)) {
			root.removeAttribute("data-reading-active");
			root.style.removeProperty("--nav-reading-progress");
			lastChapterText = "";
			lastChapterIndex = -1;
			hoveredTocChapter = "";
			hoveredTocIndex = -1;
			lastPercentValue = -1;
			if (backTopButton instanceof HTMLElement) {
				backTopButton.hidden = true;
			}
			return;
		}

		const rect = articleBody.getBoundingClientRect();
		const articleTop = rect.top + currentScrollY;
		const scrollable = Math.max(
			1,
			articleTop + rect.height - window.innerHeight * 0.75,
		);
		const rawProgress = Math.min(
			1,
			Math.max(
				0,
				(currentScrollY - articleTop * 0.35) /
					Math.max(1, scrollable - articleTop * 0.35),
			),
		);
		const percent = Math.round(rawProgress * 100);

		root.setAttribute("data-reading-active", "true");
		root.style.setProperty("--nav-reading-progress", rawProgress.toFixed(4));

		const tocLinks = Array.from(
			document.querySelectorAll(".article-toc-link[data-toc-id]"),
		);
		const activeTocIndex = tocLinks.findIndex((el) =>
			el.classList.contains("active"),
		);
		const activeToc = activeTocIndex >= 0 ? tocLinks[activeTocIndex] : null;
		const articleTitle = document.querySelector(".article-title");
		const activeTocText =
			activeToc instanceof HTMLElement
				? (
						activeToc.querySelector(".toc-link-label") || activeToc
					).textContent?.trim()
				: "";

		const nextChapter =
			hoveredTocChapter ||
			activeTocText ||
			(articleTitle instanceof HTMLElement &&
				articleTitle.textContent?.trim()) ||
			"正在阅读";
		const nextIndex = hoveredTocChapter ? hoveredTocIndex : activeTocIndex;

		animateChapterRoll(nextChapter, nextIndex, scrollDir);

		if (backTopButton instanceof HTMLElement) {
			const wasHidden = backTopButton.hidden;
			backTopButton.hidden = false;
			backTopButton.title = `${nextChapter} · 点击回到顶部`;
			if (wasHidden && isNavCondensed) {
				syncCondensedNavWidth();
			}
		}

		if (percentEl instanceof HTMLElement && percent !== lastPercentValue) {
			const prevDigits =
				lastPercentValue >= 0 ? String(lastPercentValue).length : 0;
			const nextDigits = String(percent).length;
			const tickClass =
				lastPercentValue >= 0 && percent < lastPercentValue
					? "percent-tick-down"
					: "percent-tick-up";
			percentEl.textContent = `${percent}%`;
			if (
				lastPercentValue >= 0 &&
				isNavCondensed &&
				!window.matchMedia("(prefers-reduced-motion: reduce)").matches
			) {
				percentEl.classList.remove("percent-tick-up", "percent-tick-down");
				void percentEl.offsetWidth;
				percentEl.classList.add(tickClass);
			}
			lastPercentValue = percent;
			if (prevDigits !== nextDigits && isNavCondensed) {
				syncCondensedNavWidth();
			}
		}
	};

	const applyNavState = (nextCondensed) => {
		if (nextCondensed === isNavCondensed) {
			return;
		}

		isNavCondensed = nextCondensed;
		root.toggleAttribute("data-nav-condensed", nextCondensed);
		syncCondensedNavWidth();
		syncNavGlidePill();
		window.requestAnimationFrame(() => {
			syncCondensedNavWidth();
			syncNavGlidePill();
		});
	};

	const syncRootAttributeToDocument = (name, nextDocument) => {
		const value = root.getAttribute(name);

		if (value === null) {
			nextDocument.documentElement.removeAttribute(name);
			return;
		}

		nextDocument.documentElement.setAttribute(name, value);
	};

	const syncNavState = ({ force = false } = {}) => {
		if (isRouteTransitioning) {
			return;
		}

		const nextCondensed = force
			? getInitialNavCondensedState(window.scrollY)
			: getNextNavCondensedState(window.scrollY);

		syncReadingProgress();
		applyNavState(nextCondensed);
	};

	const requestNavSync = (force = false) => {
		pendingForceSync ||= force;

		if (syncFrame) {
			return;
		}

		syncFrame = window.requestAnimationFrame(() => {
			syncFrame = 0;
			const shouldForceSync = pendingForceSync;
			pendingForceSync = false;
			syncNavState({ force: shouldForceSync });
		});
	};

	const bindShellHoverMorph = () => {
		const scrollShell = document.querySelector(".site-nav-shell-scroll");
		if (
			!(scrollShell instanceof HTMLElement) ||
			scrollShell.dataset.morphBound === "1"
		) {
			return;
		}
		scrollShell.dataset.morphBound = "1";
		const resync = () => {
			if (isNavCondensed) {
				window.requestAnimationFrame(() => {
					syncCondensedNavWidth();
					syncNavGlidePill();
				});
			}
		};
		scrollShell.addEventListener("pointerenter", resync);
		scrollShell.addEventListener("pointerleave", resync);
	};

	const focusSearchInputIfRequested = () => {
		if (window.sessionStorage.getItem("focusSearchInput") !== "1") {
			return;
		}
		window.sessionStorage.removeItem("focusSearchInput");
		const input = document.querySelector(".search-input");
		if (input instanceof HTMLInputElement) {
			input.focus({ preventScroll: true });
			input.select();
		}
	};

	// 鼠标划过左侧 ToC 目录列表时，实时联动顶部灵动岛做方向感知滚轮预览
	const bindTocHoverScrub = () => {
		if (window.__tocScrubBound) {
			return;
		}
		window.__tocScrubBound = true;

		document.addEventListener("mouseover", (event) => {
			if (!(event.target instanceof Element)) return;
			const link = event.target.closest(".article-toc-link[data-toc-id]");
			if (!(link instanceof HTMLElement)) return;
			const tocLinks = Array.from(
				document.querySelectorAll(".article-toc-link[data-toc-id]"),
			);
			const idx = tocLinks.indexOf(link);
			const label = (
				link.querySelector(".toc-link-label") || link
			).textContent?.trim();
			if (label && label !== hoveredTocChapter) {
				hoveredTocChapter = label;
				hoveredTocIndex = idx;
				syncReadingProgress();
			}
		});

		document.addEventListener("mouseout", (event) => {
			if (!hoveredTocChapter || !(event.target instanceof Element)) return;
			const toc = event.target.closest(".article-toc");
			if (!toc) return;
			const nextTarget = event.relatedTarget;
			if (nextTarget instanceof Node && toc.contains(nextTarget)) {
				return;
			}
			hoveredTocChapter = "";
			hoveredTocIndex = -1;
			syncReadingProgress();
		});

		window.addEventListener("article:toc-change", () => {
			syncReadingProgress();
		});
	};

	syncNavState({ force: true });
	bindTocHoverScrub();
	document.addEventListener("DOMContentLoaded", () => {
		bindNavHoverGlide();
		bindShellHoverMorph();
		syncActiveNavLinksByPath();
		syncReadingProgress();
		window.requestAnimationFrame(syncCondensedNavWidth);
	});
	window.addEventListener("scroll", () => requestNavSync(), { passive: true });
	window.addEventListener(
		"resize",
		() => {
			requestNavSync(true);
			window.requestAnimationFrame(() => {
				syncCondensedNavWidth();
				syncNavGlidePill();
			});
		},
		{ passive: true },
	);
	document.addEventListener("astro:page-load", () => {
		bindNavHoverGlide();
		bindShellHoverMorph();
		syncActiveNavLinksByPath();
		requestNavSync(true);
		focusSearchInputIfRequested();
		window.requestAnimationFrame(syncCondensedNavWidth);
	});
	document.addEventListener("astro:before-preparation", (event) => {
		event.direction = getRouteTransitionDirection(
			event.from,
			event.to,
			event.direction,
		);
	});
	document.addEventListener("astro:before-swap", (event) => {
		isRouteTransitioning = true;
		syncRootAttributeToDocument("data-theme", event.newDocument);
		event.newDocument.documentElement.toggleAttribute(
			"data-nav-condensed",
			isNavCondensed,
		);

		const unlockNavSync = () => {
			isRouteTransitioning = false;
			requestNavSync(true);
		};

		if (event.viewTransition?.finished) {
			event.viewTransition.finished.finally(() => {
				window.requestAnimationFrame(unlockNavSync);
			});
			return;
		}

		window.requestAnimationFrame(unlockNavSync);
	});

	const prefersReducedMotion = () =>
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	const getThemeToggleCenter = (toggle) => {
		const rect = toggle.getBoundingClientRect();
		return {
			x: rect.left + rect.width / 2,
			y: rect.top + rect.height / 2,
		};
	};

	const clampToViewport = (value, max) =>
		Math.min(Math.max(value, 0), Math.max(max, 0));

	const getThemeTransitionOrigin = (event, toggle) => {
		const isPointerTriggered = event.detail > 0;

		if (isPointerTriggered) {
			return {
				x: clampToViewport(event.clientX, window.innerWidth),
				y: clampToViewport(event.clientY, window.innerHeight),
			};
		}

		return getThemeToggleCenter(toggle);
	};

	const getThemeRippleRadius = (x, y) => {
		const width = window.innerWidth;
		const height = window.innerHeight;
		const maxHorizontal = Math.max(x, width - x);
		const maxVertical = Math.max(y, height - y);
		return Math.hypot(maxHorizontal, maxVertical);
	};

	const applyThemePreference = (nextTheme) => {
		root.setAttribute("data-theme", nextTheme);
		localStorage.setItem("theme", nextTheme);
	};

	const resolveNextTheme = () => {
		const current = root.getAttribute("data-theme");
		const prefersDark = window.matchMedia(
			"(prefers-color-scheme: dark)",
		).matches;

		return current === "dark" || (!current && prefersDark) ? "light" : "dark";
	};

	const runThemeTransition = (nextTheme, origin) => {
		const canUseViewTransition =
			typeof document.startViewTransition === "function" &&
			typeof document.documentElement.animate === "function";

		if (!canUseViewTransition || prefersReducedMotion()) {
			applyThemePreference(nextTheme);
			return Promise.resolve();
		}

		root.setAttribute("data-theme-switching", "ripple");

		let transition;
		try {
			transition = document.startViewTransition(() => {
				applyThemePreference(nextTheme);
			});
		} catch {
			root.removeAttribute("data-theme-switching");
			applyThemePreference(nextTheme);
			return Promise.resolve();
		}

		const rippleMotion = transition.ready
			.then(() => {
				const radius = getThemeRippleRadius(origin.x, origin.y);
				const clipPath = [
					`circle(0px at ${origin.x}px ${origin.y}px)`,
					`circle(${radius}px at ${origin.x}px ${origin.y}px)`,
				];

				const animation = document.documentElement.animate(
					{
						clipPath,
					},
					{
						duration: 580,
						easing: "cubic-bezier(0.22, 1, 0.36, 1)",
						pseudoElement: "::view-transition-new(root)",
					},
				);

				return animation.finished.catch(() => undefined);
			})
			.catch(() => undefined);

		return Promise.allSettled([transition.finished, rippleMotion]).finally(
			() => {
				root.removeAttribute("data-theme-switching");
			},
		);
	};

	document.addEventListener("click", (event) => {
		if (!(event.target instanceof Element)) {
			return;
		}

		const backTop = event.target.closest("[data-nav-back-top]");
		if (backTop) {
			window.scrollTo({
				top: 0,
				behavior: prefersReducedMotion() ? "auto" : "smooth",
			});
			return;
		}

		const toggle = event.target.closest(".theme-toggle");
		if (!toggle) {
			return;
		}

		if (isThemeTransitioning) {
			return;
		}

		isThemeTransitioning = true;
		const next = resolveNextTheme();
		const origin = getThemeTransitionOrigin(event, toggle);

		void runThemeTransition(next, origin).finally(() => {
			isThemeTransitioning = false;
		});
	});
})();
