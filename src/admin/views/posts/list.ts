import {
	encodeRouteParam,
	escapeAttribute,
	escapeHtml,
	getPostStatusLabel,
	normalizeDisplayStatus,
} from "@/lib/security";
import { adminLayout } from "../layout";

interface PostRow {
	id: number;
	title: string;
	slug: string;
	status: string;
	isPinned: boolean;
	pinnedOrder: number;
	publishedAt: string | null;
	viewCount: number | null;
	createdAt: string;
	categoryName: string | null;
}

interface TaxonomyRow {
	id: number;
	name: string;
	slug: string;
	postCount: number;
}

interface PostsListAlert {
	type: "success" | "error";
	message: string;
}

function renderLocalTime(raw: string | null | undefined): string {
	if (!raw) {
		return "-";
	}
	const parsed = new Date(raw);
	if (Number.isNaN(parsed.getTime())) {
		return escapeHtml(raw);
	}
	const iso = parsed.toISOString();
	return `<time data-admin-local-time="utc" data-admin-time-value="${escapeAttribute(iso)}">${escapeHtml(parsed.toLocaleDateString("zh-CN"))}</time>`;
}

function renderTaxonomyRows(options: {
	items: TaxonomyRow[];
	emptyText: string;
	deleteActionBuilder: (id: number) => string;
	csrfToken: string;
	inUseLabel: string;
}) {
	const { items, emptyText, deleteActionBuilder, csrfToken, inUseLabel } =
		options;

	if (items.length === 0) {
		return `<p class="empty-state" style="margin-top: 0.75rem; margin-bottom: 0;">${escapeHtml(emptyText)}</p>`;
	}

	return `
		<div class="table-card" style="margin-top: 0.75rem; margin-bottom: 0;">
			<table class="data-table">
				<thead>
					<tr>
						<th>名称</th>
						<th>Slug</th>
						<th>关联文章</th>
						<th>操作</th>
					</tr>
				</thead>
				<tbody>
					${items
						.map(
							(item) => `
						<tr>
							<td>${escapeHtml(item.name)}</td>
							<td><code>${escapeHtml(item.slug)}</code></td>
							<td>${item.postCount}</td>
							<td>
								${
									item.postCount > 0
										? `<span class="form-help">${escapeHtml(inUseLabel)}</span>`
										: `<form method="post" action="${escapeAttribute(deleteActionBuilder(item.id))}" data-confirm-message="${escapeAttribute("确认删除这条历史记录吗？")}">
												<input type="hidden" name="_csrf" value="${escapeAttribute(csrfToken)}" />
												<button type="submit" class="btn btn-xs btn-danger">删除</button>
										</form>`
								}
							</td>
						</tr>`,
						)
						.join("")}
				</tbody>
			</table>
		</div>
	`;
}

export function postsListPage(
	posts: PostRow[],
	categories: TaxonomyRow[],
	tags: TaxonomyRow[],
	csrfToken: string,
	alert?: PostsListAlert,
): string {
	const counts = {
		all: posts.length,
		published: posts.filter(
			(p) => normalizeDisplayStatus(p.status) === "published",
		).length,
		draft: posts.filter((p) => normalizeDisplayStatus(p.status) === "draft")
			.length,
		scheduled: posts.filter(
			(p) => normalizeDisplayStatus(p.status) === "scheduled",
		).length,
		pinned: posts.filter((p) => p.isPinned).length,
	};
	const unusedCategories = categories.filter((c) => c.postCount === 0).length;
	const unusedTags = tags.filter((t) => t.postCount === 0).length;

	const content = `
		<div class="page-header">
			<div class="page-header-copy">
				<span class="page-kicker">Content</span>
				<h1 style="margin-bottom: 0;">文章</h1>
				<p class="form-help" style="margin: 0;">按状态、分类或关键词快速检索文章，并清理未使用的历史分类与标签。</p>
			</div>
			<div class="page-actions">
				<a href="/api/admin/posts/new" class="btn btn-primary">新建文章</a>
			</div>
		</div>

		${alert ? `<div class="alert alert-${escapeAttribute(alert.type)}">${escapeHtml(alert.message)}</div>` : ""}

		${
			posts.length > 0
				? `<div class="admin-filter-bar" data-posts-filter-root>
					<div class="filter-tabs" role="tablist" aria-label="文章状态筛选">
						<button type="button" class="filter-tab is-active" data-post-status-tab="all">全部<span class="filter-tab-count">${counts.all}</span></button>
						<button type="button" class="filter-tab" data-post-status-tab="published">已发布<span class="filter-tab-count">${counts.published}</span></button>
						<button type="button" class="filter-tab" data-post-status-tab="draft">草稿<span class="filter-tab-count">${counts.draft}</span></button>
						<button type="button" class="filter-tab" data-post-status-tab="scheduled">定时<span class="filter-tab-count">${counts.scheduled}</span></button>
						<button type="button" class="filter-tab" data-post-status-tab="pinned">置顶<span class="filter-tab-count">${counts.pinned}</span></button>
					</div>
					<div class="admin-filter-controls">
						<select class="form-select admin-filter-select" data-post-category-filter aria-label="按分类筛选">
							<option value="">全部分类</option>
							${categories.map((cat) => `<option value="${escapeAttribute(cat.name)}">${escapeHtml(cat.name)} (${cat.postCount})</option>`).join("")}
						</select>
						<input type="search" class="admin-search-input" data-post-search-input placeholder="搜索标题、路径别名或分类…" aria-label="搜索文章" />
					</div>
				</div>

				<div class="table-card"><table class="data-table">
				<thead>
					<tr>
						<th>标题</th>
						<th>分类</th>
						<th>状态</th>
						<th>置顶</th>
						<th>浏览量</th>
						<th>日期</th>
						<th>操作</th>
					</tr>
				</thead>
				<tbody>
						${posts
							.map((post) => {
								const displayStatus = normalizeDisplayStatus(post.status);
								const searchBlob = `${post.title} ${post.slug} ${post.categoryName || ""}`;
								return `
					<tr
						data-post-row
						data-post-status="${escapeAttribute(displayStatus)}"
						data-post-pinned="${post.isPinned ? "true" : "false"}"
						data-post-category="${escapeAttribute(post.categoryName || "")}"
						data-post-search="${escapeAttribute(searchBlob)}"
					>
						<td>
							<div class="post-row-title-wrap">
								<a href="/api/admin/posts/${post.id}/edit">${escapeHtml(post.title)}</a>
								<span class="post-row-slug">/blog/${escapeHtml(post.slug)}</span>
							</div>
						</td>
						<td>${escapeHtml(post.categoryName || "-")}</td>
						<td><span class="badge badge-${displayStatus}">${escapeHtml(getPostStatusLabel(post.status))}</span></td>
						<td>${post.isPinned ? `<span class="badge badge-scheduled">置顶 #${post.pinnedOrder}</span>` : "-"}</td>
						<td>${post.viewCount ?? 0}</td>
						<td>${renderLocalTime(post.publishedAt || post.createdAt)}</td>
						<td class="table-actions">
							<a href="/api/admin/posts/${post.id}/edit" class="btn btn-sm">编辑</a>
							<a href="/blog/${encodeRouteParam(post.slug)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm">查看</a>
							${
								displayStatus === "scheduled"
									? `<form method="post" action="/api/admin/posts/${post.id}/cancel-schedule" data-confirm-message="${escapeAttribute("确认取消这篇文章的定时发布吗？")}">
										<input type="hidden" name="_csrf" value="${escapeAttribute(csrfToken)}" />
										<button type="submit" class="btn btn-sm">取消定时</button>
								</form>`
									: ""
							}
							<form method="post" action="/api/admin/posts/${post.id}/delete" data-confirm-message="${escapeAttribute("确认删除这篇文章吗？")}">
								<input type="hidden" name="_csrf" value="${escapeAttribute(csrfToken)}" />
								<button type="submit" class="btn btn-sm btn-danger">删除</button>
							</form>
						</td>
					</tr>`;
							})
							.join("")}
				</tbody>
			</table></div>
			<p class="empty-state" data-posts-filter-empty hidden>没有匹配当前筛选条件的文章。</p>`
				: '<p class="empty-state">当前还没有文章，<a href="/api/admin/posts/new">立即创建第一篇</a>。</p>'
		}

		<div class="taxonomy-drawer-grid">
			<details class="appearance-panel admin-secondary-panel">
				<summary>
					<span>历史分类管理（共 ${categories.length} 个${unusedCategories > 0 ? ` · ${unusedCategories} 个可清理` : ""}）</span>
				</summary>
				<div class="admin-secondary-panel-body">
					<p class="form-help" style="margin: 0.65rem 0 0;">仅可删除未被文章使用的分类。</p>
					${renderTaxonomyRows({
						items: categories,
						emptyText: "还没有历史分类。",
						deleteActionBuilder: (id) =>
							`/api/admin/posts/categories/${id}/delete`,
						csrfToken,
						inUseLabel: "使用中",
					})}
				</div>
			</details>

			<details class="appearance-panel admin-secondary-panel">
				<summary>
					<span>历史标签管理（共 ${tags.length} 个${unusedTags > 0 ? ` · ${unusedTags} 个可清理` : ""}）</span>
				</summary>
				<div class="admin-secondary-panel-body">
					<p class="form-help" style="margin: 0.65rem 0 0;">仅可删除未被文章使用的标签。</p>
					${renderTaxonomyRows({
						items: tags,
						emptyText: "还没有历史标签。",
						deleteActionBuilder: (id) => `/api/admin/posts/tags/${id}/delete`,
						csrfToken,
						inUseLabel: "使用中",
					})}
				</div>
			</details>
		</div>
	`;

	return adminLayout("文章", content, { csrfToken });
}
