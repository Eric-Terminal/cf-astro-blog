(function () {
	if (window.__articleTransparencyToggleInitialized) {
		return;
	}
	window.__articleTransparencyToggleInitialized = true;

	const STORAGE_KEY = "articleOpaqueMode";
	const ROOT = document.documentElement;
	const TOGGLE_SELECTOR = "[data-article-transparency-toggle]";
	const TRANSITION_ATTR = "data-article-transparency-switching";
	let isTransitioning = false;

	const readPreference = () => {
		try {
			return window.localStorage.getItem(STORAGE_KEY) === "1";
		} catch {
			return false;
		}
	};

	const writePreference = (enabled) => {
		try {
			window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
		} catch {
			// 私密模式或受限环境中忽略存储失败
		}
	};

	const setOpaqueMode = (enabled) => {
		ROOT.classList.toggle("article-opaque-mode", enabled);
	};

	const prefersReducedMotion = () =>
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	const clampToViewport = (value, max) =>
		Math.min(Math.max(value, 0), Math.max(max, 0));

	const getToggleCenter = (button) => {
		const rect = button.getBoundingClientRect();
		return {
			x: rect.left + rect.width / 2,
			y: rect.top + rect.height / 2,
		};
	};

	const getTransitionOrigin = (event, button) => {
		const isPointerTriggered = event.detail > 0;

		if (isPointerTriggered) {
			return {
				x: clampToViewport(event.clientX, window.innerWidth),
				y: clampToViewport(event.clientY, window.innerHeight),
			};
		}

		return getToggleCenter(button);
	};

	const getRippleRadius = (x, y) => {
		const width = window.innerWidth;
		const height = window.innerHeight;
		const maxHorizontal = Math.max(x, width - x);
		const maxVertical = Math.max(y, height - y);
		return Math.hypot(maxHorizontal, maxVertical);
	};

	const runTransparencyTransition = (applyState, origin) => {
		const canUseViewTransition =
			typeof document.startViewTransition === "function" &&
			typeof document.documentElement.animate === "function";

		if (!canUseViewTransition || prefersReducedMotion()) {
			applyState();
			return Promise.resolve();
		}

		ROOT.setAttribute(TRANSITION_ATTR, "ripple");

		let transition;
		try {
			transition = document.startViewTransition(() => {
				applyState();
			});
		} catch {
			ROOT.removeAttribute(TRANSITION_ATTR);
			applyState();
			return Promise.resolve();
		}

		const rippleMotion = transition.ready
			.then(() => {
				const radius = getRippleRadius(origin.x, origin.y);
				const clipPath = [
					`circle(0px at ${origin.x}px ${origin.y}px)`,
					`circle(${radius}px at ${origin.x}px ${origin.y}px)`,
				];

				const animation = document.documentElement.animate(
					{
						clipPath,
					},
					{
						duration: 620,
						easing: "cubic-bezier(0.22, 1, 0.36, 1)",
						pseudoElement: "::view-transition-new(root)",
					},
				);

				return animation.finished.catch(() => undefined);
			})
			.catch(() => undefined);

		return Promise.allSettled([transition.finished, rippleMotion]).finally(
			() => {
				ROOT.removeAttribute(TRANSITION_ATTR);
			},
		);
	};

	const updateToggleLabel = (button, enabled) => {
		button.textContent = enabled ? "恢复透明度" : "取消透明度";
		button.setAttribute("aria-pressed", String(enabled));
	};

	const syncToggleButtons = (buttons, enabled) => {
		for (const button of buttons) {
			updateToggleLabel(button, enabled);
		}
	};

	const initArticleToggle = () => {
		const articleShell = document.querySelector(".article-shell");
		if (!(articleShell instanceof HTMLElement)) {
			setOpaqueMode(false);
			return;
		}

		const enabled = readPreference();
		setOpaqueMode(enabled);

		const toggleButtons = Array.from(
			document.querySelectorAll(TOGGLE_SELECTOR),
		).filter((button) => button instanceof HTMLButtonElement);
		if (toggleButtons.length === 0) {
			return;
		}

		syncToggleButtons(
			toggleButtons,
			enabled,
		);

		for (const toggleButton of toggleButtons) {
			if (toggleButton.dataset.bound === "true") {
				continue;
			}
			toggleButton.dataset.bound = "true";
			toggleButton.addEventListener("click", (event) => {
				if (isTransitioning) {
					return;
				}

				const nextEnabled = !ROOT.classList.contains("article-opaque-mode");
				const origin = getTransitionOrigin(event, toggleButton);
				isTransitioning = true;

				const applyState = () => {
					setOpaqueMode(nextEnabled);
					writePreference(nextEnabled);
					syncToggleButtons(toggleButtons, nextEnabled);
				};

				void runTransparencyTransition(applyState, origin).finally(() => {
					isTransitioning = false;
				});
			});
		}
	};

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initArticleToggle, {
			once: true,
		});
	} else {
		initArticleToggle();
	}

	document.addEventListener("astro:page-load", initArticleToggle);
})();
