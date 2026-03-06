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
	publishedAt: string | null;
	viewCount: number | null;
	createdAt: string;
	categoryName: string | null;
}

export function postsListPage(posts: PostRow[], csrfToken: string): string {
	const content = `
		<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
			<h1 style="margin-bottom: 0;">文章</h1>
			<a href="/api/admin/posts/new" class="btn btn-primary">新建文章</a>
		</div>

		${
			posts.length > 0
				? `<table class="data-table">
				<thead>
					<tr>
						<th>标题</th>
						<th>分类</th>
						<th>状态</th>
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
						<td><a href="/api/admin/posts/${post.id}/edit">${escapeHtml(post.title)}</a></td>
						<td>${escapeHtml(post.categoryName || "-")}</td>
						<td><span class="badge badge-${normalizeDisplayStatus(post.status)}">${escapeHtml(getPostStatusLabel(post.status))}</span></td>
						<td>${post.viewCount ?? 0}</td>
						<td>${post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : new Date(post.createdAt).toLocaleDateString()}</td>
						<td>
							<a href="/api/admin/posts/${post.id}/edit" class="btn btn-sm">编辑</a>
							<a href="/blog/${encodeRouteParam(post.slug)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm">查看</a>
							<form method="post" action="/api/admin/posts/${post.id}/delete" style="display:inline;" data-confirm-message="${escapeAttribute("确认删除这篇文章吗？")}">
								<input type="hidden" name="_csrf" value="${escapeAttribute(csrfToken)}" />
								<button type="submit" class="btn btn-sm btn-danger">删除</button>
							</form>
						</td>
					</tr>`,
							)
							.join("")}
				</tbody>
			</table>`
				: '<p class="empty-state">当前还没有文章，<a href="/api/admin/posts/new">立即创建第一篇</a>。</p>'
		}
	`;

	return adminLayout("文章", content, { csrfToken });
}
