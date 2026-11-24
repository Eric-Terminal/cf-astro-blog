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

	const measureNavContentWidth = () => {
		const shell = document.querySelector(".site-nav-shell");
		if (!shell) return 0;
		const style = window.getComputedStyle(shell);
		const gap = parseFloat(style.columnGap) || parseFloat(style.gap) || 0;
		const pl = parseFloat(style.paddingLeft) || 0;
		const pr = parseFloat(style.paddingRight) || 0;
		const visibleChildren = Array.from(shell.children).filter(
			(child) =>
				child instanceof HTMLElement &&
				window.getComputedStyle(child).display !== "none",
		);
		if (visibleChildren.length === 0) return pl + pr;
		let totalW = pl + pr + gap * Math.max(0, visibleChildren.length - 1);
		for (const child of visibleChildren) {
			totalW += child.getBoundingClientRect().width;
		}
		return Math.ceil(totalW);
	};

	const syncCondensedNavWidth = () => {
		if (!isNavCondensed) {
			root.style.removeProperty("--nav-shell-condensed-computed-inset");
			return;
		}
		const MIN_INSET_PX = 16;
		const isReadingHudCompact =
			root.getAttribute("data-reading-active") === "true" &&
			window.innerWidth >= 769 &&
			!document.querySelector(".site-nav-shell-scroll:hover");
		const NAV_MAX_W = isReadingHudCompact ? 560 : 760;
		const vw = window.innerWidth;
		const contentW = measureNavContentWidth();
		if (contentW === 0) {
			return;
		}
		const targetW = isReadingHudCompact
			? Math.min(Math.max(contentW + 18, 340), NAV_MAX_W)
			: Math.min(Math.max(contentW + 16, Math.min(NAV_MAX_W, vw - MIN_INSET_PX * 2)), vw - MIN_INSET_PX * 2);
		const newInset = Math.max(MIN_INSET_PX, (vw - targetW) / 2);
		root.style.setProperty(
			"--nav-shell-condensed-computed-inset",
			`${newInset.toFixed(1)}px`,
		);
	};

	// 同步文章阅读进度、当前章节播报舱与环形进度胶囊
	const syncReadingProgress = () => {
		const articleBody = document.querySelector(".article-body");
		const backTopButton = document.querySelector("[data-nav-back-top]");
		const percentEl = document.querySelector("[data-nav-reading-percent]");
		const chapterEl = document.querySelector("[data-nav-reading-chapter]");

		if (!(articleBody instanceof HTMLElement)) {
			root.removeAttribute("data-reading-active");
			root.style.removeProperty("--nav-reading-progress");
			lastChapterText = "";
			if (backTopButton instanceof HTMLElement) {
				backTopButton.hidden = true;
			}
			return;
		}

		const rect = articleBody.getBoundingClientRect();
		const articleTop = rect.top + window.scrollY;
		const scrollable = Math.max(
			1,
			articleTop + rect.height - window.innerHeight * 0.75,
		);
		const rawProgress = Math.min(
			1,
			Math.max(
				0,
				(window.scrollY - articleTop * 0.35) /
					Math.max(1, scrollable - articleTop * 0.35),
			),
		);
		const percent = Math.round(rawProgress * 100);

		root.setAttribute("data-reading-active", "true");
		root.style.setProperty("--nav-reading-progress", rawProgress.toFixed(4));

		const activeToc = document.querySelector(".article-toc-link.active");
		const articleTitle = document.querySelector(".article-title");
		const nextChapter =
			(activeToc instanceof HTMLElement && activeToc.textContent?.trim()) ||
			(articleTitle instanceof HTMLElement && articleTitle.textContent?.trim()) ||
			"正在阅读";

		if (chapterEl instanceof HTMLElement && nextChapter !== lastChapterText) {
			lastChapterText = nextChapter;
			chapterEl.textContent = nextChapter;
		}

		if (backTopButton instanceof HTMLElement) {
			const wasHidden = backTopButton.hidden;
			backTopButton.hidden = false;
			backTopButton.title = `${nextChapter} · 点击回到顶部`;
			if (wasHidden && isNavCondensed) {
				window.requestAnimationFrame(syncCondensedNavWidth);
			}
		}

		if (percentEl instanceof HTMLElement) {
			percentEl.textContent = `${percent}%`;
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

	syncNavState({ force: true });
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
