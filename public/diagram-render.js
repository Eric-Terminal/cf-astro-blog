(function () {
	if (window.__diagramRendererInitialized) {
		return;
	}
	window.__diagramRendererInitialized = true;

	const MERMAID_CDN = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
	const ECHARTS_CDN = "https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js";
	const CHARTJS_CDN = "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js";

	function loadScript(src) {
		return new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = src;
			script.onload = resolve;
			script.onerror = reject;
			document.head.appendChild(script);
		});
	}

	function parseYamlLike(code) {
		// 简易解析：尝试提取 key: value 对
		const result = {};
		for (const line of code.split("\n")) {
			const match = line.match(/^\s*(\w+)\s*:\s*(.+)$/);
			if (match) {
				let value = match[2].trim();
				if ((value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"))) {
					value = value.slice(1, -1);
				}
				result[match[1]] = value;
			}
		}
		return result;
	}

	async function renderMermaid() {
		const containers = document.querySelectorAll(".prose-mermaid");
		if (!containers.length) return;

		try {
			await loadScript(MERMAID_CDN);
			window.mermaid.initialize({
				startOnLoad: false,
				theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "default",
				securityLevel: "loose",
			});

			for (const container of containers) {
				const code = container.textContent.trim();
				if (!code) continue;

				try {
					const { svg } = await window.mermaid.render("mermaid-" + Math.random().toString(36).slice(2), code);
					container.innerHTML = svg;
				} catch (err) {
					container.innerHTML = `<pre class="prose-mermaid-error"><code>${code}</code></pre>`;
					console.warn("[Mermaid] 渲染失败:", err);
				}
			}
		} catch (err) {
			console.warn("[Mermaid] 加载失败:", err);
		}
	}

	async function renderECharts() {
		const containers = document.querySelectorAll(".prose-echarts");
		if (!containers.length) return;

		try {
			await loadScript(ECHARTS_CDN);

			for (const container of containers) {
				const raw = container.getAttribute("data-echarts");
				if (!raw) continue;

				try {
					const option = JSON.parse(raw);
					const chart = window.echarts.init(container);
					chart.setOption(option);

					// 跟随主题切换
					const observer = new MutationObserver(() => {
						chart.dispose();
						const newChart = window.echarts.init(container);
						newChart.setOption(option);
					});
					observer.observe(document.documentElement, {
						attributes: true,
						attributeFilter: ["data-theme"],
					});
				} catch (err) {
					container.innerHTML = `<div class="prose-chart-loading">ECharts 配置错误</div>`;
					console.warn("[ECharts] 渲染失败:", err);
				}
			}
		} catch (err) {
			console.warn("[ECharts] 加载失败:", err);
		}
	}

	async function renderChartJS() {
		const containers = document.querySelectorAll(".prose-chartjs");
		if (!containers.length) return;

		try {
			await loadScript(CHARTJS_CDN);

			for (const container of containers) {
				const raw = container.getAttribute("data-chart");
				if (!raw) continue;

				try {
					const config = JSON.parse(raw);
					const canvas = document.createElement("canvas");
					container.innerHTML = "";
					container.appendChild(canvas);
					new window.Chart(canvas.getContext("2d"), config);
				} catch (err) {
					container.innerHTML = `<div class="prose-chart-loading">Chart.js 配置错误</div>`;
					console.warn("[Chart.js] 渲染失败:", err);
				}
			}
		} catch (err) {
			console.warn("[Chart.js] 加载失败:", err);
		}
	}

	async function renderAll() {
		await Promise.allSettled([
			renderMermaid(),
			renderECharts(),
			renderChartJS(),
		]);
	}

	// 页面加载后渲染
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", renderAll);
	} else {
		renderAll();
	}

	// 支持 Astro 页面切换后重新渲染
	document.addEventListener("astro:page-load", renderAll);
})();
