import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import * as jose from "jose";
import { fingerprintPasswordHash, timingSafeEqualText } from "@/lib/password";

const SESSION_TTL_SECONDS = 12 * 60 * 60;
const SESSION_PREFIX = "admin-session:";
const SESSION_ISSUER = "cf-astro-blog-starter-admin";
const SESSION_AUDIENCE = "admin";

export interface AdminSession {
	id: string;
	username: string;
	csrfToken: string;
	createdAt: string;
	expiresAt: string;
}

export interface AdminAppEnv {
	Bindings: Env;
	Variables: {
		session: AdminSession;
	};
}

interface SessionTokenPayload extends jose.JWTPayload {
	pwdv?: string;
}

function getSessionStorageKey(sessionId: string): string {
	return `${SESSION_PREFIX}${sessionId}`;
}

function getJwtSecret(jwtSecret: string): Uint8Array {
	return new TextEncoder().encode(jwtSecret);
}

export function getSessionCookieOptions(requestUrl?: string) {
	const secure =
		requestUrl === undefined
			? true
			: !["localhost", "127.0.0.1"].includes(new URL(requestUrl).hostname);

	return {
		httpOnly: true,
		secure,
		sameSite: "Strict" as const,
		path: "/",
		maxAge: SESSION_TTL_SECONDS,
	};
}

export async function createSession(env: Env): Promise<AdminSession> {
	const createdAt = new Date().toISOString();
	const expiresAt = new Date(
		Date.now() + SESSION_TTL_SECONDS * 1000,
	).toISOString();
	const session: AdminSession = {
		id: crypto.randomUUID(),
		username: env.ADMIN_USERNAME,
		csrfToken: crypto.randomUUID(),
		createdAt,
		expiresAt,
	};

	await env.SESSION.put(
		getSessionStorageKey(session.id),
		JSON.stringify(session),
		{
			expirationTtl: SESSION_TTL_SECONDS,
		},
	);

	return session;
}

export async function destroySession(
	env: Env,
	sessionId: string,
): Promise<void> {
	await env.SESSION.delete(getSessionStorageKey(sessionId));
}

async function readSession(
	env: Env,
	sessionId: string,
): Promise<AdminSession | null> {
	const raw = await env.SESSION.get(getSessionStorageKey(sessionId));
	if (!raw) {
		return null;
	}

	try {
		const parsed = JSON.parse(raw) as AdminSession;
		if (
			!parsed?.id ||
			!parsed.username ||
			!parsed.csrfToken ||
			!parsed.expiresAt
		) {
			await destroySession(env, sessionId);
			return null;
		}

		if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
			await destroySession(env, sessionId);
			return null;
		}

		return parsed;
	} catch {
		await destroySession(env, sessionId);
		return null;
	}
}

export async function createToken(
	env: Env,
	sessionId: string,
): Promise<string> {
	const passwordFingerprint = await fingerprintPasswordHash(
		env.ADMIN_PASSWORD_HASH,
	);

	return await new jose.SignJWT({
		role: "admin",
		pwdv: passwordFingerprint,
	})
		.setProtectedHeader({ alg: "HS256" })
		.setSubject(env.ADMIN_USERNAME)
		.setJti(sessionId)
		.setIssuer(SESSION_ISSUER)
		.setAudience(SESSION_AUDIENCE)
		.setIssuedAt()
		.setExpirationTime(`${SESSION_TTL_SECONDS}s`)
		.sign(getJwtSecret(env.JWT_SECRET));
}

export async function verifyToken(
	env: Env,
	token: string,
): Promise<{ sessionId: string } | null> {
	try {
		const { payload } = await jose.jwtVerify<SessionTokenPayload>(
			token,
			getJwtSecret(env.JWT_SECRET),
			{
				issuer: SESSION_ISSUER,
				audience: SESSION_AUDIENCE,
			},
		);

		if (
			typeof payload.jti !== "string" ||
			typeof payload.sub !== "string" ||
			typeof payload.pwdv !== "string" ||
			payload.role !== "admin"
		) {
			return null;
		}

		if (!timingSafeEqualText(payload.sub, env.ADMIN_USERNAME)) {
			return null;
		}

		const expectedPasswordFingerprint = await fingerprintPasswordHash(
			env.ADMIN_PASSWORD_HASH,
		);

		if (!timingSafeEqualText(payload.pwdv, expectedPasswordFingerprint)) {
			return null;
		}

		return { sessionId: payload.jti };
	} catch {
		return null;
	}
}

export async function getSessionFromToken(
	env: Env,
	token: string,
): Promise<AdminSession | null> {
	const payload = await verifyToken(env, token);
	if (!payload) {
		return null;
	}

	const session = await readSession(env, payload.sessionId);
	if (!session) {
		return null;
	}

	if (!timingSafeEqualText(session.username, env.ADMIN_USERNAME)) {
		await destroySession(env, session.id);
		return null;
	}

	return session;
}

export function getAuthenticatedSession(c: Context<AdminAppEnv>): AdminSession {
	return c.get("session");
}

export function assertCsrfToken(
	providedToken: unknown,
	session: AdminSession,
): boolean {
	return timingSafeEqualText(String(providedToken ?? ""), session.csrfToken);
}

export async function requireAuth(c: Context<AdminAppEnv>, next: Next) {
	const token = getCookie(c, "admin_session");

	if (!token) {
		return c.redirect("/api/auth/login");
	}

	let session: AdminSession | null = null;
	try {
		session = await getSessionFromToken(c.env, token);
	} catch {
		return c.text("登录会话暂时不可用喵", 503);
	}

	if (!session) {
		return c.redirect("/api/auth/login");
	}

	c.set("session", session);
	await next();
}
