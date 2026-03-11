function normalizePathname(pathname) {
	if (!pathname || pathname === "/") {
		return "/";
	}

	return pathname.replace(/\/+$/u, "") || "/";
}

function escapeHtml(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function formatDate(value) {
	if (!value) {
		return "";
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return "";
	}

	return parsed.toLocaleDateString("zh-CN");
}

function createResultCard(post) {
	const metaParts = [];
	if (post.categoryName) {
		metaParts.push(`分类：${post.categoryName}`);
	}
	if (Array.isArray(post.tagNames) && post.tagNames.length > 0) {
		metaParts.push(`标签：${post.tagNames.join("、")}`);
	}
	if (post.publishedAt) {
		const formatted = formatDate(post.publishedAt);
		if (formatted) {
			metaParts.push(`发布时间：${formatted}`);
		}
	}

	return `<article class="search-result-card glass-panel">
	<h3><a href="${escapeHtml(post.url)}">${escapeHtml(post.title)}</a></h3>
	<p>${escapeHtml(post.excerpt || "")}</p>
	${metaParts.length > 0 ? `<p class="search-result-meta">${escapeHtml(metaParts.join(" · "))}</p>` : ""}
</article>`;
}

function readSearchState(form) {
	const formData = new FormData(form);
	const query = String(formData.get("q") ?? "").trim();
	const category = String(formData.get("category") ?? "").trim().toLowerCase();
	const tags = [...new Set(formData.getAll("tags").map((item) => String(item).trim().toLowerCase()).filter(Boolean))];

	return { query, category, tags };
}

function updateAddressBar(state) {
	const url = new URL(window.location.href);
	url.searchParams.delete("q");
	url.searchParams.delete("category");
	url.searchParams.delete("tags");

	if (state.query) {
		url.searchParams.set("q", state.query);
	}
	if (state.category) {
		url.searchParams.set("category", state.category);
	}
	for (const tag of state.tags) {
		url.searchParams.append("tags", tag);
	}

	window.history.replaceState({}, "", `${url.pathname}${url.search}`);
}

function rankPosts(posts) {
	return [...posts].sort((a, b) => {
		const aTime = Date.parse(a.publishedAt || a.updatedAt || "");
		const bTime = Date.parse(b.publishedAt || b.updatedAt || "");
		return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
	});
}

function applyFilters(posts, state) {
	return posts.filter((post) => {
		if (state.category && post.categorySlug !== state.category) {
			return false;
		}

		if (state.tags.length > 0) {
			const tagSlugs = Array.isArray(post.tagSlugs) ? post.tagSlugs : [];
			const hasAny = state.tags.some((tag) => tagSlugs.includes(tag));
			if (!hasAny) {
				return false;
			}
		}

		return true;
	});
}

async function loadPagefindModule() {
	const imported = await import("/pagefind/pagefind.js");
	return imported?.default ?? imported;
}

function extractSlugFromUrl(urlPath) {
	const normalized = normalizePathname(urlPath);
	const match = normalized.match(/^\/blog\/([^/]+)$/u);
	return match?.[1] || "";
}

function updateSummary(summaryEl, text) {
	if (!summaryEl) {
		return;
	}
	summaryEl.textContent = text;
}

async function withTimeout(promise, ms, message) {
	let timeoutId;
	const timeout = new Promise((_, reject) => {
		timeoutId = window.setTimeout(() => {
			reject(new Error(message));
		}, ms);
	});

	try {
		return await Promise.race([promise, timeout]);
	} finally {
		window.clearTimeout(timeoutId);
	}
}

async function performSearch(context, state, options = {}) {
	const { metaData, resultsEl, summaryEl } = context;
	const hasCriteria = Boolean(state.query || state.category || state.tags.length > 0);

	if (!hasCriteria) {
		resultsEl.innerHTML = "";
		updateSummary(summaryEl, "输入关键词或筛选条件后开始搜索");
		return;
	}

	updateSummary(summaryEl, "正在搜索中...");
	let filteredPosts = applyFilters(metaData.posts, state);

	if (state.query) {
		try {
			const pagefind = await loadPagefindModule();
			const searchResponse = await withTimeout(
				pagefind.search(state.query),
				10000,
				"Pagefind 搜索超时",
			);
			const results = searchResponse?.results ?? [];
			const fetched = await withTimeout(
				Promise.all(results.map((result) => result.data())),
				10000,
				"Pagefind 结果加载超时",
			);
			const rankMap = new Map();
			fetched.forEach((item, index) => {
				const slug = extractSlugFromUrl(new URL(item.url, window.location.origin).pathname);
				if (slug) {
					rankMap.set(slug, index);
				}
			});

			filteredPosts = filteredPosts
				.filter((post) => rankMap.has(post.slug))
				.sort((a, b) => (rankMap.get(a.slug) ?? 99999) - (rankMap.get(b.slug) ?? 99999));
		} catch (error) {
			console.error("[Pagefind] 搜索失败", error);
			resultsEl.innerHTML = '<div class="empty-state glass-panel"><p>搜索索引尚未就绪，请稍后再试。</p></div>';
			updateSummary(summaryEl, "搜索索引暂不可用");
			return;
		}
	} else {
		filteredPosts = rankPosts(filteredPosts);
	}

	const limited = filteredPosts.slice(0, 20);
	if (limited.length === 0) {
		resultsEl.innerHTML = '<div class="empty-state glass-panel"><p>没有找到符合当前条件的内容。</p></div>';
		updateSummary(summaryEl, "没有找到符合当前条件的内容");
		return;
	}

	resultsEl.innerHTML = limited.map((post) => createResultCard(post)).join("\n");
	updateSummary(summaryEl, `共找到 ${limited.length} 条结果`);

	if (options.updateUrl) {
		updateAddressBar(state);
	}
}

async function loadMetaData() {
	const response = await fetch("/pagefind-meta.json", {
		headers: { Accept: "application/json" },
		cache: "no-cache",
	});
	if (!response.ok) {
		throw new Error(`加载 pagefind-meta.json 失败: ${response.status}`);
	}

	const payload = await response.json();
	const posts = Array.isArray(payload?.posts) ? payload.posts : [];
	return { posts };
}

async function initPagefindSearch() {
	const form = document.querySelector(".search-form");
	const resultsEl = document.querySelector("#pagefind-search-results");
	const summaryEl = document.querySelector("#pagefind-results-summary");
	if (!form || !resultsEl) {
		return;
	}

	if (form.dataset.pagefindReady === "true") {
		return;
	}
	form.dataset.pagefindReady = "true";

	let metaData = { posts: [] };
	try {
		metaData = await loadMetaData();
	} catch (error) {
		console.error("[Pagefind] 元数据加载失败", error);
		resultsEl.innerHTML = '<div class="empty-state glass-panel"><p>搜索索引尚未生成，请先执行索引构建。</p></div>';
		updateSummary(summaryEl, "搜索索引尚未生成");
		return;
	}

	const context = { metaData, resultsEl, summaryEl };
	await performSearch(context, readSearchState(form));

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		await performSearch(context, readSearchState(form), { updateUrl: true });
	});
}

document.addEventListener("astro:page-load", () => {
	void initPagefindSearch();
});
void initPagefindSearch();
