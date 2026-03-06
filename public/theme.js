(function () {
	const theme = localStorage.getItem("theme");
	if (theme === "dark" || theme === "light") {
		document.documentElement.setAttribute("data-theme", theme);
	}

	document.addEventListener("click", (event) => {
		if (!(event.target instanceof Element)) {
			return;
		}

		const toggle = event.target.closest(".theme-toggle");
		if (!toggle) {
			return;
		}

		const root = document.documentElement;
		const current = root.getAttribute("data-theme");
		const prefersDark = window.matchMedia(
			"(prefers-color-scheme: dark)",
		).matches;

		const next =
			current === "dark" || (!current && prefersDark) ? "light" : "dark";

		root.setAttribute("data-theme", next);
		localStorage.setItem("theme", next);
	});
})();
