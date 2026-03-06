(function () {
	const theme = localStorage.getItem("theme");
	if (theme === "dark" || theme === "light") {
		document.documentElement.setAttribute("data-theme", theme);
	}
})();
