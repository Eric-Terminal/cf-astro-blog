(function () {
	const HERO_SELECTOR = "[data-hero-depth]";
	const TILT_SELECTOR = "[data-tilt-card]";
	const FINE_POINTER_QUERY = "(any-hover: hover) and (any-pointer: fine)";
	const HERO_SMOOTHING = 0.14;
	const TILT_SMOOTHING = 0.16;
	const MOTION_EPSILON = 0.001;
	let disposeHomeMotion = () => {};

	const prefersReducedMotion = () =>
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	const prefersFinePointer = () => window.matchMedia(FINE_POINTER_QUERY).matches;

	const isFinePointerEvent = (event) => {
		if (
			typeof PointerEvent !== "undefined" &&
			event instanceof PointerEvent &&
			event.pointerType
		) {
			return event.pointerType === "mouse" || event.pointerType === "pen";
		}

		return prefersFinePointer();
	};

	const stepValue = (current, target, factor) => {
		const next = current + (target - current) * factor;
		return Math.abs(target - next) <= MOTION_EPSILON ? target : next;
	};

	const resetHeroState = (hero) => {
		hero.style.setProperty("--hero-pointer-x", "0");
		hero.style.setProperty("--hero-pointer-y", "0");
		hero.style.setProperty("--hero-scroll-shift", "0px");
	};

	const attachHeroDepth = (hero, disposers) => {
		let frame = 0;
		let currentPointerX = 0;
		let currentPointerY = 0;
		let currentScrollShift = 0;
		let targetPointerX = 0;
		let targetPointerY = 0;
		let targetScrollShift = 0;

		const render = () => {
			currentPointerX = stepValue(
				currentPointerX,
				targetPointerX,
				HERO_SMOOTHING,
			);
			currentPointerY = stepValue(
				currentPointerY,
				targetPointerY,
				HERO_SMOOTHING,
			);
			currentScrollShift = stepValue(
				currentScrollShift,
				targetScrollShift,
				HERO_SMOOTHING,
			);

			hero.style.setProperty("--hero-pointer-x", currentPointerX.toFixed(3));
			hero.style.setProperty("--hero-pointer-y", currentPointerY.toFixed(3));
			hero.style.setProperty(
				"--hero-scroll-shift",
				`${currentScrollShift.toFixed(1)}px`,
			);

			if (
				currentPointerX !== targetPointerX ||
				currentPointerY !== targetPointerY ||
				currentScrollShift !== targetScrollShift
			) {
				frame = window.requestAnimationFrame(render);
				return;
			}

			frame = 0;
		};

		const requestRender = () => {
			if (frame) {
				return;
			}

			frame = window.requestAnimationFrame(render);
		};

		const updateScrollShift = () => {
			targetScrollShift = Math.min(140, Math.max(0, window.scrollY));
			requestRender();
		};

		const handlePointerMove = (event) => {
			if (!isFinePointerEvent(event)) {
				return;
			}

			const rect = hero.getBoundingClientRect();
			if (!rect.width || !rect.height) {
				return;
			}

			const nextX = (event.clientX - rect.left) / rect.width - 0.5;
			const nextY = (event.clientY - rect.top) / rect.height - 0.5;

			targetPointerX = nextX * 1.1;
			targetPointerY = nextY * 1.0;
			requestRender();
		};

		const handlePointerLeave = () => {
			targetPointerX = 0;
			targetPointerY = 0;
			requestRender();
		};

		resetHeroState(hero);
		updateScrollShift();
		hero.addEventListener("pointermove", handlePointerMove);
		hero.addEventListener("pointerleave", handlePointerLeave);
		hero.addEventListener("mousemove", handlePointerMove);
		hero.addEventListener("mouseleave", handlePointerLeave);
		window.addEventListener("scroll", updateScrollShift, { passive: true });
		window.addEventListener("resize", updateScrollShift, { passive: true });
		requestRender();

		disposers.push(() => {
			if (frame) {
				window.cancelAnimationFrame(frame);
			}

			hero.removeEventListener("pointermove", handlePointerMove);
			hero.removeEventListener("pointerleave", handlePointerLeave);
			hero.removeEventListener("mousemove", handlePointerMove);
			hero.removeEventListener("mouseleave", handlePointerLeave);
			window.removeEventListener("scroll", updateScrollShift);
			window.removeEventListener("resize", updateScrollShift);
			resetHeroState(hero);
		});
	};

	const resetTiltState = (card) => {
		card.style.setProperty("--tilt-rotate-x", "0deg");
		card.style.setProperty("--tilt-rotate-y", "0deg");
		card.style.setProperty("--tilt-shift-x", "0");
		card.style.setProperty("--tilt-shift-y", "0");
		card.style.setProperty("--tilt-spot-x", "24%");
		card.style.setProperty("--tilt-spot-y", "0%");
	};

	// 阻尼 3D 透视微倾 + 光学反光焦点追踪
	const attachTiltCard = (card, disposers) => {
		let frame = 0;
		const tiltScale = Math.min(
			1,
			Math.max(0.15, Number.parseFloat(card.dataset.tiltScale || "0.65") || 0.65),
		);
		const shiftScale = Math.min(
			1.4,
			Math.max(
				0.2,
				Number.parseFloat(card.dataset.tiltShiftScale || "0.85") || 0.85,
			),
		);
		let currentRotateX = 0;
		let currentRotateY = 0;
		let currentShiftX = 0;
		let currentShiftY = 0;
		let currentSpotX = 24;
		let currentSpotY = 0;
		let targetRotateX = 0;
		let targetRotateY = 0;
		let targetShiftX = 0;
		let targetShiftY = 0;
		let targetSpotX = 24;
		let targetSpotY = 0;

		const render = () => {
			currentRotateX = stepValue(
				currentRotateX,
				targetRotateX,
				TILT_SMOOTHING,
			);
			currentRotateY = stepValue(
				currentRotateY,
				targetRotateY,
				TILT_SMOOTHING,
			);
			currentShiftX = stepValue(currentShiftX, targetShiftX, TILT_SMOOTHING);
			currentShiftY = stepValue(currentShiftY, targetShiftY, TILT_SMOOTHING);
			currentSpotX = stepValue(currentSpotX, targetSpotX, TILT_SMOOTHING);
			currentSpotY = stepValue(currentSpotY, targetSpotY, TILT_SMOOTHING);

			card.style.setProperty("--tilt-rotate-x", `${currentRotateX.toFixed(2)}deg`);
			card.style.setProperty("--tilt-rotate-y", `${currentRotateY.toFixed(2)}deg`);
			card.style.setProperty("--tilt-shift-x", currentShiftX.toFixed(3));
			card.style.setProperty("--tilt-shift-y", currentShiftY.toFixed(3));
			card.style.setProperty("--tilt-spot-x", `${currentSpotX.toFixed(1)}%`);
			card.style.setProperty("--tilt-spot-y", `${currentSpotY.toFixed(1)}%`);

			if (
				currentRotateX !== targetRotateX ||
				currentRotateY !== targetRotateY ||
				currentShiftX !== targetShiftX ||
				currentShiftY !== targetShiftY ||
				currentSpotX !== targetSpotX ||
				currentSpotY !== targetSpotY
			) {
				frame = window.requestAnimationFrame(render);
				return;
			}

			frame = 0;
		};

		const requestRender = () => {
			if (frame) {
				return;
			}

			frame = window.requestAnimationFrame(render);
		};

		const handlePointerMove = (event) => {
			if (!isFinePointerEvent(event)) {
				return;
			}

			const rect = card.getBoundingClientRect();
			if (!rect.width || !rect.height) {
				return;
			}

			const ratioX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
			const ratioY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
			const normalizedX = (ratioX - 0.5) * 2;
			const normalizedY = (ratioY - 0.5) * 2;

			targetRotateY = normalizedX * 4.2 * tiltScale;
			targetRotateX = normalizedY * -4.2 * tiltScale;
			targetShiftX = normalizedX * 0.9 * shiftScale;
			targetShiftY = normalizedY * 0.8 * shiftScale;
			targetSpotX = ratioX * 100;
			targetSpotY = ratioY * 100;
			requestRender();
		};

		const handlePointerLeave = () => {
			targetRotateX = 0;
			targetRotateY = 0;
			targetShiftX = 0;
			targetShiftY = 0;
			targetSpotX = 24;
			targetSpotY = 0;
			requestRender();
		};

		resetTiltState(card);
		card.addEventListener("pointermove", handlePointerMove);
		card.addEventListener("pointerleave", handlePointerLeave);
		card.addEventListener("mousemove", handlePointerMove);
		card.addEventListener("mouseleave", handlePointerLeave);
		requestRender();

		disposers.push(() => {
			if (frame) {
				window.cancelAnimationFrame(frame);
			}

			card.removeEventListener("pointermove", handlePointerMove);
			card.removeEventListener("pointerleave", handlePointerLeave);
			card.removeEventListener("mousemove", handlePointerMove);
			card.removeEventListener("mouseleave", handlePointerLeave);
			resetTiltState(card);
		});
	};

	const initHomeMotion = () => {
		disposeHomeMotion();

		if (prefersReducedMotion()) {
			return;
		}

		const disposers = [];
		const hero = document.querySelector(HERO_SELECTOR);
		const tiltCards = document.querySelectorAll(TILT_SELECTOR);

		if (hero instanceof HTMLElement) {
			attachHeroDepth(hero, disposers);
		}

		for (const card of tiltCards) {
			if (card instanceof HTMLElement) {
				attachTiltCard(card, disposers);
			}
		}

		disposeHomeMotion = () => {
			for (const dispose of disposers.splice(0)) {
				dispose();
			}
		};
	};

	document.addEventListener("astro:before-swap", () => disposeHomeMotion());
	document.addEventListener("astro:page-load", initHomeMotion);

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initHomeMotion, { once: true });
	} else {
		initHomeMotion();
	}
})();
