import { desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { shuoshuoPosts } from "@/db/schema";
import { getDb } from "@/lib/db";
import { sanitizePlainText } from "@/lib/security";
import {
	AdminAppEnv,
	assertCsrfToken,
	getAuthenticatedSession,
	getBodyText,
	requireAuth,
} from "../middleware/auth";
import { shuoshuoListPage, shuoshuoEditorPage } from "../views/shuoshuo";

const shuoshuo = new Hono<AdminAppEnv>();

shuoshuo.use("*", requireAuth);

function parseShuoshuoInput(body: Record<string, unknown>) {
	const content = sanitizePlainText(getBodyText(body, "content"), 3000, {
		allowNewlines: true,
	});
	const rawStatus = getBodyText(body, "status");
	const status = rawStatus === "draft" ? "draft" : "published";

	return { content, status };
}

function validateCsrf(c: Parameters<typeof getAuthenticatedSession>[0], body: Record<string, unknown>): boolean {
	const session = getAuthenticatedSession(c);
	return assertCsrfToken(getBodyText(body, "_csrf"), session);
}

shuoshuo.get("/", async (c) => {
	const session = getAuthenticatedSession(c);
	const db = getDb(c.env.DB);
	const entries = await db
		.select({
			id: shuoshuoPosts.id,
			content: shuoshuoPosts.content,
			status: shuoshuoPosts.status,
			updatedAt: shuoshuoPosts.updatedAt,
		})
		.from(shuoshuoPosts)
		.orderBy(desc(shuoshuoPosts.updatedAt));

	return c.html(shuoshuoListPage({ entries, csrfToken: session.csrfToken }));
});

shuoshuo.get("/new", (c) => {
	const session = getAuthenticatedSession(c);
	return c.html(
		shuoshuoEditorPage({
			entry: { content: "", status: "published" },
			csrfToken: session.csrfToken,
		}),
	);
});

shuoshuo.post("/", async (c) => {
	const session = getAuthenticatedSession(c);
	const body = await c.req.parseBody();
	if (!validateCsrf(c, body)) {
		return c.text("CSRF 验证失败", 403);
	}

	const parsed = parseShuoshuoInput(body);
	if (!parsed.content.trim()) {
		return c.html(
			shuoshuoEditorPage({
				entry: parsed,
				csrfToken: session.csrfToken,
				error: "说说内容不能为空",
			}),
		);
	}

	const db = getDb(c.env.DB);
	await db.insert(shuoshuoPosts).values({
		content: parsed.content,
		status: parsed.status,
	});

	return c.redirect("/api/admin/shuoshuo");
});

shuoshuo.get("/:id/edit", async (c) => {
	const session = getAuthenticatedSession(c);
	const id = Number(c.req.param("id"));
	if (!Number.isInteger(id) || id <= 0) {
		return c.text("无效的说说 ID", 400);
	}

	const db = getDb(c.env.DB);
	const [entry] = await db
		.select({
			id: shuoshuoPosts.id,
			content: shuoshuoPosts.content,
			status: shuoshuoPosts.status,
		})
		.from(shuoshuoPosts)
		.where(eq(shuoshuoPosts.id, id));

	if (!entry) {
		return c.text("说说不存在", 404);
	}

	return c.html(
		shuoshuoEditorPage({
			entry,
			csrfToken: session.csrfToken,
		}),
	);
});

shuoshuo.post("/:id/update", async (c) => {
	const session = getAuthenticatedSession(c);
	const id = Number(c.req.param("id"));
	if (!Number.isInteger(id) || id <= 0) {
		return c.text("无效的说说 ID", 400);
	}

	const body = await c.req.parseBody();
	if (!validateCsrf(c, body)) {
		return c.text("CSRF 验证失败", 403);
	}

	const parsed = parseShuoshuoInput(body);
	if (!parsed.content.trim()) {
		return c.html(
			shuoshuoEditorPage({
				entry: { id, ...parsed },
				csrfToken: session.csrfToken,
				error: "说说内容不能为空",
			}),
		);
	}

	const db = getDb(c.env.DB);
	await db
		.update(shuoshuoPosts)
		.set({
			content: parsed.content,
			status: parsed.status,
			updatedAt: sql`(datetime('now'))`,
		})
		.where(eq(shuoshuoPosts.id, id));

	return c.redirect("/api/admin/shuoshuo");
});

shuoshuo.post("/:id/delete", async (c) => {
	const body = await c.req.parseBody();
	if (!validateCsrf(c, body)) {
		return c.text("CSRF 验证失败", 403);
	}

	const id = Number(c.req.param("id"));
	if (!Number.isInteger(id) || id <= 0) {
		return c.text("无效的说说 ID", 400);
	}

	const db = getDb(c.env.DB);
	await db.delete(shuoshuoPosts).where(eq(shuoshuoPosts.id, id));

	return c.redirect("/api/admin/shuoshuo");
});

export { shuoshuo as shuoshuoRoutes };
