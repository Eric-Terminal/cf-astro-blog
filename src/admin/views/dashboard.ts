import {
	encodeRouteParam,
	escapeHtml,
	getPostStatusLabel,
	normalizeDisplayStatus,
} from "@/lib/security";
import { adminLayout } from "./layout";

interface DashboardData {
	posts: { total: number; published: number; drafts: number };
	sessions: number;
	events: number;
	recentPosts: Array<{
		id: number;
		title: string;
		slug: string;
		status: string;
		viewCount: number | null;
		createdAt: string;
	}>;
}

export function dashboardPage(data: DashboardData, csrfToken: string): string {
	const content = `
		<h1>控制台</h1>
		<div class="stats-grid">
			<div class="stat-card">
				<span class="stat-value">${data.posts.total}</span>
				<span class="stat-label">文章总数</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">${data.posts.published}</span>
				<span class="stat-label">已发布</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">${data.posts.drafts}</span>
				<span class="stat-label">草稿</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">${data.sessions}</span>
				<span class="stat-label">会话数</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">${data.events}</span>
				<span class="stat-label">事件数</span>
			</div>
		</div>

		<h2>最近文章</h2>
		${
			data.recentPosts.length > 0
				? `<table class="data-table">
				<thead>
					<tr>
						<th>标题</th>
						<th>状态</th>
						<th>浏览量</th>
						<th>创建时间</th>
						<th>操作</th>
					</tr>
				</thead>
				<tbody>
						${data.recentPosts
							.map(
								(post) => `
						<tr>
							<td><a href="/api/admin/posts/${post.id}/edit">${escapeHtml(post.title)}</a></td>
							<td><span class="badge badge-${normalizeDisplayStatus(post.status)}">${escapeHtml(getPostStatusLabel(post.status))}</span></td>
							<td>${post.viewCount ?? 0}</td>
							<td>${new Date(post.createdAt).toLocaleDateString()}</td>
							<td>
								<a href="/api/admin/posts/${post.id}/edit" class="btn btn-sm">编辑</a>
								<a href="/blog/${encodeRouteParam(post.slug)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm">查看</a>
							</td>
						</tr>`,
							)
							.join("")}
				</tbody>
			</table>`
				: '<p class="empty-state">当前还没有文章，<a href="/api/admin/posts/new">立即创建第一篇</a>。</p>'
		}

		<div style="margin-top: 1rem;">
			<a href="/api/admin/posts/new" class="btn btn-primary">新建文章</a>
		</div>
	`;

	return adminLayout("控制台", content, { csrfToken });
}
