import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { webMentions } from "@/db/schema";
import { getDb } from "@/lib/db";
import {
	escapeAttribute,
	escapeHtml,
	parseOptionalPositiveInt,
	sanitizePlainText,
} from "@/lib/security";
import {
	type AdminAppEnv,
	assertCsrfToken,
	getAuthenticatedSession,
	getBodyText,
	requireAuth,
} from "../middleware/auth";
import { adminLayout } from "../views/layout";

const mentionsRoutes = new Hono<AdminAppEnv>();

const WEBMENTION_STATUS_VALUES = [
	"pending",
	"approved",
	"rejected",
	"spam",
] as const;

type WebMentionStatus = (typeof WEBMENTION_STATUS_VALUES)[number];
type WebMentionFilter = "all" | WebMentionStatus;

interface WebMentionRow {
	id: number;
	sourceUrl: string;
	targetUrl: string;
	sourceTitle: string | null;
	sourceExcerpt: string | null;
	sourceAuthor: string | null;
	sourcePublishedAt: string | null;
	status: string;
	reviewNote: string | null;
	reviewedAt: string | null;
	lastCheckedAt: string | null;
	createdAt: string;
}

function normalizeWebMentionStatus(value: unknown): WebMentionStatus | null {
	const normalized = String(value ?? "").trim();
	return WEBMENTION_STATUS_VALUES.includes(normalized as WebMentionStatus)
		? (normalized as WebMentionStatus)
		: null;
}

function normalizeWebMentionFilter(value: unknown): WebMentionFilter {
	const normalized = String(value ?? "").trim();
	if (normalized === "all" || !normalized) {
		return "all";
	}

	return normalizeWebMentionStatus(normalized) ?? "all";
}

function getStatusLabel(status: string) {
	switch (normalizeWebMentionStatus(status)) {
		case "approved":
			return "已通过";
		case "rejected":
			return "已拒绝";
		case "spam":
			return "垃圾";
		default:
			return "待审核";
	}
}

function getStatusBadgeClass(status: string) {
	switch (normalizeWebMentionStatus(status)) {
		case "approved":
			return "published";
		case "pending":
			return "scheduled";
		default:
			return "draft";
	}
}

function buildMentionsRedirect(options: {
	status: string;
	filter?: WebMentionFilter;
}) {
	const params = new URLSearchParams();
	params.set("status", options.status);
	if (options.filter && options.filter !== "all") {
		params.set("filter", options.filter);
	}
	return `/api/admin/mentions?${params.toString()}`;
}

function resolveAlert(
	status: string | null,
): { type: "success" | "error"; message: string } | undefined {
	switch (status) {
		case "updated":
			return { type: "success", message: "提及审核状态已更新" };
		case "deleted":
			return { type: "success", message: "提及记录已删除" };
		case "invalid-id":
			return { type: "error", message: "提及 ID 不合法" };
		case "invalid-status":
			return { type: "error", message: "审核状态不合法" };
		case "csrf-failed":
			return { type: "error", message: "CSRF 校验失败，请刷新后重试" };
		default:
			return undefined;
	}
}

function formatDateTime(value: string | null | undefined): string {
	if (!value) {
		return "-";
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleString("zh-CN", { hour12: false });
}

function renderStatusActionButton(options: {
	id: number;
	csrfToken: string;
	status: WebMentionStatus;
	label: string;
	className: string;
	filter: WebMentionFilter;
}) {
	const { id, csrfToken, status, label, className, filter } = options;
	return `
		<form method="post" action="/api/admin/mentions/${id}/review">
			<input type="hidden" name="_csrf" value="${escapeAttribute(csrfToken)}" />
			<input type="hidden" name="status" value="${escapeAttribute(status)}" />
			<input type="hidden" name="filter" value="${escapeAttribute(filter)}" />
			<button type="submit" class="btn btn-xs ${className}">${escapeHtml(label)}</button>
		</form>
	`;
}

function renderQuickActions(
	item: WebMentionRow,
	csrfToken: string,
	filter: WebMentionFilter,
) {
	const status = normalizeWebMentionStatus(item.status) ?? "pending";
	const buttons: string[] = [];

	if (status !== "approved") {
		buttons.push(
			renderStatusActionButton({
				id: item.id,
				csrfToken,
				status: "approved",
				label: "通过",
				className: "btn-success-solid",
				filter,
			}),
		);
	}

	if (status !== "rejected") {
		buttons.push(
			renderStatusActionButton({
				id: item.id,
				csrfToken,
				status: "rejected",
				label: "拒绝",
				className: "btn-danger",
				filter,
			}),
		);
	}

	if (status !== "spam") {
		buttons.push(
			renderStatusActionButton({
				id: item.id,
				csrfToken,
				status: "spam",
				label: "垃圾",
				className: "btn-danger",
				filter,
			}),
		);
	}

	if (status !== "pending") {
		buttons.push(
			renderStatusActionButton({
				id: item.id,
				csrfToken,
				status: "pending",
				label: "待审",
				className: "",
				filter,
			}),
		);
	}

	buttons.push(`
		<form method="post" action="/api/admin/mentions/${item.id}/delete" data-confirm-message="${escapeAttribute("确认删除这条提及记录吗？")}">
			<input type="hidden" name="_csrf" value="${escapeAttribute(csrfToken)}" />
			<input type="hidden" name="filter" value="${escapeAttribute(filter)}" />
			<button type="submit" class="btn btn-xs btn-danger">删除</button>
		</form>
	`);

	return `<div class="quick-actions">${buttons.join("")}</div>`;
}

function renderRows(
	rows: WebMentionRow[],
	csrfToken: string,
	filter: WebMentionFilter,
) {
	if (rows.length === 0) {
		return '<p class="empty-state">当前筛选下没有记录。</p>';
	}

	return `<div class="review-queue">${rows
		.map(
			(item) => `
				<article class="appearance-panel review-card mention-queue-item">
					<div class="review-card-header" style="margin-bottom: 0.55rem;">
						<div>
							<h3 class="review-card-title" style="font-size: 1.05rem;">${escapeHtml(item.sourceTitle || "未解析标题")}</h3>
							<p class="form-help review-card-meta" style="margin-top: 0.2rem;">
								提交 ${escapeHtml(formatDateTime(item.createdAt))}${item.lastCheckedAt ? ` · 校验 ${escapeHtml(formatDateTime(item.lastCheckedAt))}` : ""}
							</p>
						</div>
						<span class="badge badge-${escapeAttribute(getStatusBadgeClass(item.status))}">${escapeHtml(getStatusLabel(item.status))}</span>
					</div>

					<div class="review-card-body" style="margin-bottom: 0;">
						<div class="review-item">
							<span class="review-item-label">来源</span>
							<span class="review-item-value"><a href="${escapeAttribute(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.sourceUrl)}</a></span>
						</div>
						<div class="review-item">
							<span class="review-item-label">目标</span>
							<span class="review-item-value"><a href="${escapeAttribute(item.targetUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.targetUrl)}</a></span>
						</div>
						${
							item.sourceAuthor
								? `<div class="review-item">
							<span class="review-item-label">作者</span>
							<span class="review-item-value">${escapeHtml(item.sourceAuthor)}</span>
						</div>`
								: ""
						}
						${
							item.sourcePublishedAt
								? `<div class="review-item">
							<span class="review-item-label">来源时间</span>
							<span class="review-item-value">${escapeHtml(formatDateTime(item.sourcePublishedAt))}</span>
						</div>`
								: ""
						}
						${
							item.sourceExcerpt
								? `<div class="review-item review-item-span-2">
							<span class="review-item-label">摘要</span>
							<span class="review-item-value">${escapeHtml(item.sourceExcerpt)}</span>
						</div>`
								: ""
						}
					</div>

					<div class="mention-queue-actions">
						${renderQuickActions(item, csrfToken, filter)}
						<details class="friend-queue-edit" style="border-top: 0; margin-left: auto;">
							<summary style="padding: 0.38rem 0.7rem; border: 1px solid var(--border); border-radius: 999px; background: var(--bg-tertiary);">备注 / 高级</summary>
							<div class="friend-queue-edit-body" style="margin-top: 0.55rem; border: 1px solid var(--border); border-radius: var(--radius);">
								<form method="post" action="/api/admin/mentions/${item.id}/review" class="review-review-form">
									<input type="hidden" name="_csrf" value="${escapeAttribute(csrfToken)}" />
									<input type="hidden" name="filter" value="${escapeAttribute(filter)}" />
									<div class="appearance-inline-grid">
										<div class="form-group form-group-tight">
											<label for="status-${item.id}">审核状态</label>
											<select id="status-${item.id}" name="status" class="form-select">
												${WEBMENTION_STATUS_VALUES.map(
													(value) =>
														`<option value="${value}" ${item.status === value ? "selected" : ""}>${escapeHtml(getStatusLabel(value))}</option>`,
												).join("")}
											</select>
										</div>
										<div class="form-group form-group-tight">
											<label for="reviewNote-${item.id}">审核备注</label>
											<input id="reviewNote-${item.id}" name="reviewNote" class="form-input" maxlength="320" value="${escapeAttribute(item.reviewNote || "")}" placeholder="可选" />
										</div>
									</div>
									<div class="form-actions" style="margin-top: 0.85rem;">
										<button type="submit" class="btn btn-primary btn-sm">保存审核</button>
									</div>
								</form>
							</div>
						</details>
					</div>
				</article>
			`,
		)
		.join("")}</div>`;
}

function renderFilterTabs(
	counts: Record<WebMentionFilter, number>,
	activeFilter: WebMentionFilter,
) {
	const tabs: Array<{ key: WebMentionFilter; label: string }> = [
		{ key: "all", label: "全部" },
		{ key: "pending", label: "待审核" },
		{ key: "approved", label: "已通过" },
		{ key: "rejected", label: "已拒绝" },
		{ key: "spam", label: "垃圾" },
	];

	return `
		<nav class="filter-tabs" aria-label="提及状态筛选">
			${tabs
				.map((tab) => {
					const href =
						tab.key === "all"
							? "/api/admin/mentions"
							: `/api/admin/mentions?filter=${tab.key}`;
					const activeClass = activeFilter === tab.key ? " is-active" : "";
					return `<a href="${href}" class="filter-tab${activeClass}">${escapeHtml(tab.label)}<span class="filter-tab-count">${counts[tab.key]}</span></a>`;
				})
				.join("")}
		</nav>
	`;
}

function sortMentionRows(rows: WebMentionRow[]): WebMentionRow[] {
	const rank = (status: string) => {
		switch (status) {
			case "pending":
				return 0;
			case "approved":
				return 1;
			case "rejected":
				return 2;
			default:
				return 3;
		}
	};

	return [...rows].sort((a, b) => {
		const rankDiff = rank(a.status) - rank(b.status);
		if (rankDiff !== 0) {
			return rankDiff;
		}

		return b.createdAt.localeCompare(a.createdAt);
	});
}

function renderMentionsPage(options: {
	rows: WebMentionRow[];
	csrfToken: string;
	filter: WebMentionFilter;
	alert?: { type: "success" | "error"; message: string };
}) {
	const { rows, csrfToken, filter, alert } = options;
	const counts: Record<WebMentionFilter, number> = {
		all: rows.length,
		pending: rows.filter((item) => item.status === "pending").length,
		approved: rows.filter((item) => item.status === "approved").length,
		rejected: rows.filter((item) => item.status === "rejected").length,
		spam: rows.filter((item) => item.status === "spam").length,
	};

	const filteredRows =
		filter === "all"
			? sortMentionRows(rows)
			: sortMentionRows(rows.filter((item) => item.status === filter));

	const hint =
		counts.pending > 0 && filter === "all"
			? "待审核条目已置顶，可直接点「通过 / 拒绝 / 垃圾」。"
			: "可直接点「通过 / 拒绝 / 垃圾」，无需改下拉再保存。";

	return adminLayout(
		"提及管理",
		`
			<div class="page-header">
				<div class="page-header-copy">
					<span class="page-kicker">Mentions</span>
					<h1 style="margin-bottom: 0;">提及管理</h1>
					<p class="form-help" style="margin: 0;">${escapeHtml(hint)}</p>
				</div>
			</div>
			${alert ? `<div class="alert alert-${escapeAttribute(alert.type)}">${escapeHtml(alert.message)}</div>` : ""}
			${renderFilterTabs(counts, filter)}
			<section>
				${renderRows(filteredRows, csrfToken, filter)}
			</section>
		`,
		{ csrfToken },
	);
}

mentionsRoutes.use("*", requireAuth);

mentionsRoutes.get("/", async (c) => {
	const session = getAuthenticatedSession(c);
	const db = getDb(c.env.DB);
	const status = c.req.query("status") || null;
	const filter = normalizeWebMentionFilter(c.req.query("filter"));

	const rows = await db
		.select()
		.from(webMentions)
		.orderBy(desc(webMentions.createdAt));

	return c.html(
		renderMentionsPage({
			rows,
			csrfToken: session.csrfToken,
			filter,
			alert: resolveAlert(status),
		}),
	);
});

mentionsRoutes.post("/:id/review", async (c) => {
	const session = getAuthenticatedSession(c);
	const body = await c.req.parseBody();
	const filter = normalizeWebMentionFilter(getBodyText(body, "filter"));

	if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
		return c.redirect(buildMentionsRedirect({ status: "csrf-failed", filter }));
	}

	const id = parseOptionalPositiveInt(c.req.param("id"));
	if (!id) {
		return c.redirect(buildMentionsRedirect({ status: "invalid-id", filter }));
	}

	const nextStatus = normalizeWebMentionStatus(getBodyText(body, "status"));
	if (!nextStatus) {
		return c.redirect(
			buildMentionsRedirect({ status: "invalid-status", filter }),
		);
	}

	const reviewNote =
		sanitizePlainText(getBodyText(body, "reviewNote"), 320, {
			allowNewlines: true,
		}) || null;
	const now = new Date().toISOString();
	const db = getDb(c.env.DB);

	// 快捷按钮只传 status 时，保留已有备注
	const [existing] = await db
		.select({ reviewNote: webMentions.reviewNote })
		.from(webMentions)
		.where(eq(webMentions.id, id))
		.limit(1);

	const hasReviewNoteField = Object.hasOwn(body, "reviewNote");
	const nextReviewNote = hasReviewNoteField
		? reviewNote
		: (existing?.reviewNote ?? null);

	await db
		.update(webMentions)
		.set({
			status: nextStatus,
			reviewNote: nextReviewNote,
			reviewedAt: nextStatus === "pending" ? null : now,
			updatedAt: now,
		})
		.where(eq(webMentions.id, id));

	return c.redirect(buildMentionsRedirect({ status: "updated", filter }));
});

mentionsRoutes.post("/:id/delete", async (c) => {
	const session = getAuthenticatedSession(c);
	const body = await c.req.parseBody();
	const filter = normalizeWebMentionFilter(getBodyText(body, "filter"));

	if (!assertCsrfToken(getBodyText(body, "_csrf"), session)) {
		return c.redirect(buildMentionsRedirect({ status: "csrf-failed", filter }));
	}

	const id = parseOptionalPositiveInt(c.req.param("id"));
	if (!id) {
		return c.redirect(buildMentionsRedirect({ status: "invalid-id", filter }));
	}

	const db = getDb(c.env.DB);
	await db.delete(webMentions).where(eq(webMentions.id, id));
	return c.redirect(buildMentionsRedirect({ status: "deleted", filter }));
});

export { mentionsRoutes };
