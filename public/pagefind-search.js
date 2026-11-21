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

	return parsed.toLocaleDateString();
}

function normalizeDateInput(value) {
	const normalized = String(value ?? "").trim();
	if (!normalized) {
		return "";
	}

	if (!/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) {
		return "";
	}

	const parsed = new Date(`${normalized}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) {
		return "";
	}

	const [year, month, day] = normalized.split("-").map((item) => Number(item));
	if (
		parsed.getFullYear() !== year ||
		parsed.getMonth() + 1 !== month ||
		parsed.getDate() !== day
	) {
		return "";
	}

	return normalized;
}

function toStartOfDayTimestamp(value) {
	if (!value) {
		return null;
	}

	const parsed = new Date(`${value}T00:00:00`);
	const timestamp = parsed.getTime();
	return Number.isNaN(timestamp) ? null : timestamp;
}

function toEndOfDayExclusiveTimestamp(value) {
	const start = toStartOfDayTimestamp(value);
	if (start === null) {
		return null;
	}

	const parsed = new Date(start);
	parsed.setDate(parsed.getDate() + 1);
	return parsed.getTime();
}

function createResultCard(post) {
	const formattedDate = formatDate(post.publishedAt);
	const coverImageUrl = post.featuredImageKey
		? `/media/${post.featuredImageKey}`
		: "";
	const coverImageAlt = post.featuredImageAlt?.trim() || `${post.title} 的封面图`;
	const hasCover = Boolean(coverImageUrl);
	const cardClassName = [
		"post-card",
		"glass-panel",
		"post-card-regular",
		hasCover ? "post-card-has-cover" : "post-card-no-cover",
	].join(" ");

	return `<article class="${cardClassName}">
	${hasCover
		? `<a href="${escapeHtml(post.url)}" class="post-card-cover" tabindex="-1" aria-hidden="true">
		<img src="${escapeHtml(coverImageUrl)}" alt="${escapeHtml(coverImageAlt)}" loading="lazy" decoding="async" />
	</a>`
		: ""}
	<div class="post-card-content">
		<div class="post-card-top">
			<div class="post-card-eyebrow">
				<div class="post-card-taxonomy">
					${post.categoryName ? `<span class="post-card-category">${escapeHtml(post.categoryName)}</span>` : ""}
					${formattedDate ? `<time class="post-card-date" datetime="${escapeHtml(post.publishedAt || "")}">${escapeHtml(formattedDate)}</time>` : ""}
				</div>
			</div>
			<a href="${escapeHtml(post.url)}" class="post-card-link">
				<h3 class="post-card-title">${escapeHtml(post.title)}</h3>
			</a>
		</div>
		${post.excerpt ? `<p class="post-card-excerpt">${escapeHtml(post.excerpt)}</p>` : ""}
		<div class="post-card-meta">
			<span class="post-card-author">${escapeHtml(post.authorName || "本站作者")}</span>
			<span class="post-card-readmore" aria-hidden="true">
				<span>阅读全文</span>
				<span class="post-card-arrow">→</span>
			</span>
		</div>
	</div>
</article>`;
}

function readSearchState(form) {
	const formData = new FormData(form);
	const query = String(formData.get("q") ?? "").trim();
	const category = String(formData.get("category") ?? "").trim().toLowerCase();
	const tags = [
		...new Set(
			formData
				.getAll("tags")
				.map((item) => String(item).trim().toLowerCase())
				.filter(Boolean),
		),
	];
	let dateFrom = normalizeDateInput(formData.get("dateFrom"));
	let dateTo = normalizeDateInput(formData.get("dateTo"));

	if (dateFrom && dateTo && dateFrom > dateTo) {
		[dateFrom, dateTo] = [dateTo, dateFrom];
	}

	const dateFromInput = form.querySelector('input[name="dateFrom"]');
	const dateToInput = form.querySelector('input[name="dateTo"]');
	if (dateFromInput instanceof HTMLInputElement) {
		dateFromInput.value = dateFrom;
	}
	if (dateToInput instanceof HTMLInputElement) {
		dateToInput.value = dateTo;
	}

	return { query, category, tags, dateFrom, dateTo };
}

function buildSearchHref(state) {
	const url = new URL(window.location.href);
	url.searchParams.delete("q");
	url.searchParams.delete("category");
	url.searchParams.delete("tags");
	url.searchParams.delete("dateFrom");
	url.searchParams.delete("dateTo");

	if (state.query) {
		url.searchParams.set("q", state.query);
	}
	if (state.category) {
		url.searchParams.set("category", state.category);
	}
	for (const tag of state.tags) {
		url.searchParams.append("tags", tag);
	}
	if (state.dateFrom) {
		url.searchParams.set("dateFrom", state.dateFrom);
	}
	if (state.dateTo) {
		url.searchParams.set("dateTo", state.dateTo);
	}

	return `${url.pathname}${url.search}`;
}

function updateAddressBar(state, options = {}) {
	const mode = options.mode === "replace" ? "replace" : "push";
	const nextHref = buildSearchHref(state);
	const currentHref = `${window.location.pathname}${window.location.search}`;
	if (nextHref === currentHref) {
		return;
	}

	if (mode === "replace") {
		window.history.replaceState({}, "", nextHref);
		return;
	}

	window.history.pushState({}, "", nextHref);
}

function rankPosts(posts) {
	return [...posts].sort((a, b) => {
		const aTime = Date.parse(a.publishedAt || a.updatedAt || "");
		const bTime = Date.parse(b.publishedAt || b.updatedAt || "");
		return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
	});
}

function applyFilters(posts, state) {
	const dateFromTimestamp = toStartOfDayTimestamp(state.dateFrom);
	const dateToExclusiveTimestamp = toEndOfDayExclusiveTimestamp(state.dateTo);

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

		if (dateFromTimestamp !== null || dateToExclusiveTimestamp !== null) {
			const postTimestamp = Date.parse(post.publishedAt || post.updatedAt || "");
			if (Number.isNaN(postTimestamp)) {
				return false;
			}
			if (dateFromTimestamp !== null && postTimestamp < dateFromTimestamp) {
				return false;
			}
			if (
				dateToExclusiveTimestamp !== null &&
				postTimestamp >= dateToExclusiveTimestamp
			) {
				return false;
			}
		}

		return true;
	});
}

function fallbackKeywordSearch(posts, query) {
	const keyword = String(query ?? "").trim().toLowerCase();
	if (!keyword) {
		return posts;
	}

	return posts.filter((post) => {
		const tagNames = Array.isArray(post.tagNames) ? post.tagNames : [];
		const haystack = [
			post.title,
			post.excerpt,
			post.authorName,
			post.categoryName,
			...tagNames,
		]
			.map((item) => String(item ?? "").toLowerCase())
			.join(" ");
		return haystack.includes(keyword);
	});
}

let _pagefindModuleCache = null;
function loadPagefindModule() {
	if (!_pagefindModuleCache) {
		_pagefindModuleCache = import("/pagefind/pagefind.js").then(
			(imported) => imported?.default ?? imported,
		);
	}
	return _pagefindModuleCache;
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

async function performSearch(context, state) {
	const { metaData, resultsEl, summaryEl } = context;
	const hasCriteria = Boolean(
		state.query ||
			state.category ||
			state.tags.length > 0 ||
			state.dateFrom ||
			state.dateTo,
	);
	// 服务端在无查询参数时将结果区域渲染为 display:none，
	// 客户端 pushState 搜索时需要手动控制显隐。
	const sectionEl = document.querySelector("#search-results-section");
	let usingFallbackSearch = false;

	if (!hasCriteria) {
		resultsEl.innerHTML = "";
		updateSummary(summaryEl, "输入关键词或筛选条件后开始搜索");
		if (sectionEl) sectionEl.style.display = "none";
		return;
	}

	if (sectionEl) sectionEl.style.removeProperty("display");
	updateSummary(summaryEl, "正在搜索中...");
	let filteredPosts = applyFilters(metaData.posts, state);

	if (state.query) {
		try {
			const pagefind = await withTimeout(
				loadPagefindModule(),
				8000,
				"Pagefind 模块加载超时",
			);
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
			usingFallbackSearch = true;
			filteredPosts = rankPosts(fallbackKeywordSearch(filteredPosts, state.query));
		}
	} else {
		filteredPosts = rankPosts(filteredPosts);
	}

	const limited = filteredPosts.slice(0, 20);
	if (limited.length === 0) {
		resultsEl.innerHTML = '<div class="empty-state glass-panel"><p>没有找到符合当前条件的内容。</p></div>';
		updateSummary(
			summaryEl,
			usingFallbackSearch
				? "Pagefind 暂不可用，已回退基础搜索，但未找到符合当前条件的内容"
				: "没有找到符合当前条件的内容",
		);
		return;
	}

	resultsEl.innerHTML = limited.map((post) => createResultCard(post)).join("\n");
	updateSummary(
		summaryEl,
		usingFallbackSearch
			? `共找到 ${limited.length} 条结果（基础搜索回退）`
			: `共找到 ${limited.length} 条结果`,
	);
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
	if (metaData.posts.length === 0) {
		resultsEl.innerHTML =
			'<div class="empty-state glass-panel"><p>当前暂无可搜索文章；如果你确认已发布内容，请先重建远端搜索索引后再部署。</p></div>';
		updateSummary(summaryEl, "搜索索引为空");
		return;
	}

	// 后台预热 Pagefind WASM，避免首次搜索冷启动超时
	loadPagefindModule().then((mod) => mod.init?.()).catch(() => {});

	await performSearch(context, readSearchState(form));

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const state = readSearchState(form);
		updateAddressBar(state, { mode: "push" });
		await performSearch(context, state);
	});
}

document.addEventListener("astro:page-load", () => {
	void initPagefindSearch();
});
void initPagefindSearch();
