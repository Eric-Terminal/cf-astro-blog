import { encodeRouteParam, escapeAttribute, escapeHtml, escapeTextarea, getPostStatusLabel, normalizeDisplayStatus } from "@/lib/security";
import { adminLayout } from "./layout";

interface ShuoshuoEntry {
	id: number;
	content: string;
	status: string;
	createdAt: string;
	updatedAt: string;
}

interface ShuoshuoListPageOptions {
	entries: ShuoshuoEntry[];
	csrfToken: string;
	status?: string;
}

interface ShuoshuoEditorPageOptions {
	entry?: { id?: number; content: string; status: string };
	csrfToken: string;
	error?: string;
}

export function shuoshuoListPage(options: ShuoshuoListPageOptions): string {
	const content = `
		<h1>说说</h1>
		<p class="page-description">记录日常短句与轻量更新。你可以在这里通过后台快速发布或编辑说说。</p>
		<div class="page-actions">
			<a href="/api/admin/shuoshuo/new" class="btn btn-primary">发布说说</a>
		</div>
		${options.entries.length > 0 ? `<div class="table-card"><table class="data-table">
			<thead>
				<tr>
					<th>内容</th>
					<th>状态</th>
					<th>更新时间</th>
					<th>操作</th>
				</tr>
			</thead>
			<tbody>
				${options.entries
					.map(
						(entry) => `
						<tr>
							<td>${escapeHtml(entry.content.slice(0, 120))}${entry.content.length > 120 ? "..." : ""}</td>
							<td><span class="badge badge-${normalizeDisplayStatus(entry.status)}">${escapeHtml(getPostStatusLabel(entry.status))}</span></td>
							<td>${new Date(entry.updatedAt).toLocaleString()}</td>
							<td>
								<a href="/api/admin/shuoshuo/${encodeRouteParam(String(entry.id))}/edit" class="btn btn-sm">编辑</a>
								<form method="post" action="/api/admin/shuoshuo/${encodeRouteParam(String(entry.id))}/delete" class="inline-form" data-confirm-message="确认删除这条说说吗？">
									<input type="hidden" name="_csrf" value="${escapeAttribute(options.csrfToken)}" />
									<button type="submit" class="btn btn-sm btn-danger">删除</button>
								</form>
							</td>
						</tr>`,
				)
				.join("")}
			</tbody>
		</table></div>`
		: '<p class="empty-state">还没有说说，<a href="/api/admin/shuoshuo/new">发布第一条说说</a>。</p>'}
	`;

	return adminLayout("说说管理", content, { csrfToken: options.csrfToken });
}

export function shuoshuoEditorPage(options: ShuoshuoEditorPageOptions): string {
	const entry = options.entry ?? { content: "", status: "published" };
	const action = entry.id ? `/api/admin/shuoshuo/${encodeRouteParam(String(entry.id))}/update` : "/api/admin/shuoshuo";
	const heading = entry.id ? "编辑说说" : "发布说说";
	const errorBanner = options.error
		? `<div class="alert alert-error">${escapeHtml(options.error)}</div>`
		: "";

	const content = `
		<h1>${heading}</h1>
		${errorBanner}
		<form method="post" action="${action}" class="shuoshuo-editor-form">
			<input type="hidden" name="_csrf" value="${escapeAttribute(options.csrfToken)}" />
			<div class="form-field">
				<label for="content">内容</label>
				<textarea id="content" name="content" rows="8" required>${escapeTextarea(entry.content)}</textarea>
			</div>
			<div class="form-field">
				<label for="status">状态</label>
				<select id="status" name="status">
					<option value="published" ${entry.status === "published" ? "selected" : ""}>已发布</option>
					<option value="draft" ${entry.status === "draft" ? "selected" : ""}>草稿</option>
				</select>
			</div>
			<div class="form-actions">
				<button type="submit" class="btn btn-primary">保存</button>
				<a href="/api/admin/shuoshuo" class="btn">取消</a>
			</div>
		</form>
	`;

	return adminLayout("说说编辑", content, { csrfToken: options.csrfToken });
}
