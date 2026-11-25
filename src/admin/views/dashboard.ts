import {
	encodeRouteParam,
	escapeAttribute,
	escapeHtml,
	getPostStatusLabel,
	normalizeDisplayStatus,
} from "@/lib/security";
import { adminLayout } from "./layout";

interface DashboardData {
	posts: {
		total: number;
		published: number;
		drafts: number;
		scheduled?: number;
	};
	friends?: {
		approved: number;
		pending: number;
	};
	mentions?: {
		pending: number;
	};
	system?: {
		mcpEnabled: boolean;
		aiEnabled: boolean;
	};
	sessions: number;
	events: number;
	recentPosts: Array<{
		id: number;
		title: string;
		slug: string;
		status: string;
		isPinned?: boolean;
		viewCount: number | null;
		createdAt: string;
	}>;
}

function renderLocalTime(raw: string): string {
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

export function dashboardPage(data: DashboardData, csrfToken: string): string {
	const scheduledCount = data.posts.scheduled ?? 0;
	const pendingFriends = data.friends?.pending ?? 0;
	const approvedFriends = data.friends?.approved ?? 0;
	const pendingMentions = data.mentions?.pending ?? 0;
	const mcpEnabled = data.system?.mcpEnabled ?? false;
	const aiEnabled = data.system?.aiEnabled ?? false;

	const content = `
		<div class="page-header">
			<div class="page-header-copy">
				<span class="page-kicker">Overview</span>
				<h1 style="margin-bottom: 0;">控制台</h1>
				<p class="form-help" style="margin: 0;">内容发布、社区互动审核与站点运行状态总览。</p>
			</div>
			<div class="page-actions">
				<a href="/api/admin/posts/new" class="btn btn-primary">新建文章</a>
				<a href="/api/admin/appearance" class="btn btn-sm">外观设置</a>
			</div>
		</div>

		<div class="dashboard-status-strip">
			<a href="/api/admin/friends?filter=pending" class="dashboard-status-pill${pendingFriends > 0 ? " is-attention" : ""}">
				<span class="dashboard-status-dot ${pendingFriends > 0 ? "is-warn" : "is-ok"}"></span>
				待审友链 ${pendingFriends}
			</a>
			<a href="/api/admin/mentions?filter=pending" class="dashboard-status-pill${pendingMentions > 0 ? " is-attention" : ""}">
				<span class="dashboard-status-dot ${pendingMentions > 0 ? "is-warn" : "is-ok"}"></span>
				待审提及 ${pendingMentions}
			</a>
			<a href="/api/admin/appearance" class="dashboard-status-pill">
				<span class="dashboard-status-dot ${mcpEnabled ? "is-ok" : ""}"></span>
				MCP 接口：${mcpEnabled ? "已开启" : "已关闭"}
			</a>
			<a href="/api/admin/appearance" class="dashboard-status-pill">
				<span class="dashboard-status-dot ${aiEnabled ? "is-ok" : ""}"></span>
				AI 摘要：${aiEnabled ? "已就绪" : "未启用"}
			</a>
		</div>

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
				<span class="stat-value">${data.posts.drafts}${scheduledCount > 0 ? ` / ${scheduledCount}` : ""}</span>
				<span class="stat-label">${scheduledCount > 0 ? "草稿 / 定时" : "草稿"}</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">${approvedFriends}</span>
				<span class="stat-label">已上架友链</span>
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

		<div class="dashboard-quick-grid">
			<a href="/api/admin/posts/new" class="dashboard-quick-card">
				<span class="dashboard-quick-kicker">Compose</span>
				<strong class="dashboard-quick-title">撰写新文章</strong>
				<span class="dashboard-quick-desc">双栏实时预览、剪贴板粘贴传图与一键 AI 生成摘要。</span>
			</a>
			<a href="/api/admin/appearance" class="dashboard-quick-card">
				<span class="dashboard-quick-kicker">Studio</span>
				<strong class="dashboard-quick-title">定制站点外观</strong>
				<span class="dashboard-quick-desc">实时调节全局壁纸、毛玻璃透明度、首屏名片与导航。</span>
			</a>
			<a href="/api/admin/media" class="dashboard-quick-card">
				<span class="dashboard-quick-kicker">Assets</span>
				<strong class="dashboard-quick-title">管理媒体图床</strong>
				<span class="dashboard-quick-desc">R2 自动哈希去重存储，一键复制图片 URL 与 Markdown。</span>
			</a>
			<a href="/api/admin/friends" class="dashboard-quick-card">
				<span class="dashboard-quick-kicker">Community</span>
				<strong class="dashboard-quick-title">友链与跨站提及</strong>
				<span class="dashboard-quick-desc">处理友链互换申请、后台手动直录友链及申请须知。</span>
			</a>
		</div>

		<div class="section-heading">
			<h2>最近文章</h2>
			<a href="/api/admin/posts" class="btn btn-sm">全部文章</a>
		</div>
		${
			data.recentPosts.length > 0
				? `<div class="table-card"><table class="data-table">
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
							<td>
								<div class="post-row-title-wrap">
									<a href="/api/admin/posts/${post.id}/edit">${escapeHtml(post.title)}${post.isPinned ? ` <span class="badge badge-scheduled" style="margin-left: 0.35rem;">置顶</span>` : ""}</a>
									<span class="post-row-slug">/blog/${escapeHtml(post.slug)}</span>
								</div>
							</td>
							<td><span class="badge badge-${normalizeDisplayStatus(post.status)}">${escapeHtml(getPostStatusLabel(post.status))}</span></td>
							<td>${post.viewCount ?? 0}</td>
							<td>${renderLocalTime(post.createdAt)}</td>
							<td class="table-actions">
								<a href="/api/admin/posts/${post.id}/edit" class="btn btn-sm">编辑</a>
								<a href="/blog/${encodeRouteParam(post.slug)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm">查看</a>
							</td>
						</tr>`,
							)
							.join("")}
				</tbody>
			</table></div>`
				: '<p class="empty-state">当前还没有文章，<a href="/api/admin/posts/new">立即创建第一篇</a>。</p>'
		}
	`;

	return adminLayout("控制台", content, { csrfToken });
}
