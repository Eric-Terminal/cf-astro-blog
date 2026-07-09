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
		return `<p class="empty-state">${escapeHtml(emptyText)}</p>`;
	}

	return `
		<div class="table-card">
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
												<button type="submit" class="btn btn-sm btn-danger">删除</button>
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
	const content = `
		<div class="page-header">
			<div class="page-header-copy">
				<span class="page-kicker">Content</span>
				<h1 style="margin-bottom: 0;">文章</h1>
				<p class="form-help" style="margin: 0;">管理发布状态、置顶与分类标签。</p>
			</div>
			<div class="page-actions">
				<a href="/api/admin/posts/new" class="btn btn-primary">新建文章</a>
			</div>
		</div>

		${alert ? `<div class="alert alert-${escapeAttribute(alert.type)}">${escapeHtml(alert.message)}</div>` : ""}

		${
			posts.length > 0
				? `<div class="table-card"><table class="data-table">
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
							.map(
								(post) => `
					<tr>
						<td>
							<a href="/api/admin/posts/${post.id}/edit">${escapeHtml(post.title)}</a>
						</td>
						<td>${escapeHtml(post.categoryName || "-")}</td>
						<td><span class="badge badge-${normalizeDisplayStatus(post.status)}">${escapeHtml(getPostStatusLabel(post.status))}</span></td>
						<td>${post.isPinned ? `置顶 #${post.pinnedOrder}` : "-"}</td>
						<td>${post.viewCount ?? 0}</td>
						<td>${post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : new Date(post.createdAt).toLocaleDateString()}</td>
						<td class="table-actions">
							<a href="/api/admin/posts/${post.id}/edit" class="btn btn-sm">编辑</a>
							<a href="/blog/${encodeRouteParam(post.slug)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm">查看</a>
							${
								normalizeDisplayStatus(post.status) === "scheduled"
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
					</tr>`,
							)
							.join("")}
				</tbody>
			</table></div>`
				: '<p class="empty-state">当前还没有文章，<a href="/api/admin/posts/new">立即创建第一篇</a>。</p>'
		}

		<section class="section-block">
			<div class="section-heading">
				<div class="page-header-copy">
					<h2>历史分类管理</h2>
					<p class="form-help" style="margin: 0;">仅可删除未被文章使用的分类。</p>
				</div>
			</div>
			${renderTaxonomyRows({
				items: categories,
				emptyText: "还没有历史分类。",
				deleteActionBuilder: (id) => `/api/admin/posts/categories/${id}/delete`,
				csrfToken,
				inUseLabel: "有关联文章，无法删除",
			})}
		</section>

		<section class="section-block">
			<div class="section-heading">
				<div class="page-header-copy">
					<h2>历史标签管理</h2>
					<p class="form-help" style="margin: 0;">仅可删除未被文章使用的标签。</p>
				</div>
			</div>
			${renderTaxonomyRows({
				items: tags,
				emptyText: "还没有历史标签。",
				deleteActionBuilder: (id) => `/api/admin/posts/tags/${id}/delete`,
				csrfToken,
				inUseLabel: "有关联文章，无法删除",
			})}
		</section>
	`;

	return adminLayout("文章", content, { csrfToken });
}
