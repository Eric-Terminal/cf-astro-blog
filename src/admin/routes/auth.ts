import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import {
	isLegacyPasswordHash,
	timingSafeEqualText,
	verifyPassword,
} from "@/lib/password";
import { sanitizePlainText } from "@/lib/security";
import {
	type AdminAppEnv,
	assertCsrfToken,
	createSession,
	createToken,
	destroySession,
	getAuthenticatedSession,
	getSessionCookieOptions,
	requireAuth,
} from "../middleware/auth";
import {
	clearAttempts,
	rateLimit,
	recordFailedAttempt,
} from "../middleware/rate-limit";
import { loginPage } from "../views/login";

const auth = new Hono<AdminAppEnv>();

function getTurnstileSiteKey(env: Env): string | undefined {
	const siteKey = env.TURNSTILE_SITE_KEY?.trim();
	return siteKey ? siteKey : undefined;
}

async function verifyTurnstile(
	env: Env,
	responseToken: string,
	ipAddress: string,
): Promise<boolean> {
	const siteKey = getTurnstileSiteKey(env);
	const secret = env.TURNSTILE_SECRET_KEY?.trim();

	if (!siteKey && !secret) {
		return true;
	}

	if (!siteKey || !secret) {
		return false;
	}

	if (!responseToken) {
		return false;
	}

	const body = new URLSearchParams({
		secret,
		response: responseToken,
		remoteip: ipAddress,
	});

	try {
		const response = await fetch(
			"https://challenges.cloudflare.com/turnstile/v0/siteverify",
			{
				method: "POST",
				body,
			},
		);

		if (!response.ok) {
			return false;
		}

		const result = (await response.json()) as { success?: boolean };
		return Boolean(result.success);
	} catch {
		return false;
	}
}

auth.get("/login", (c) => {
	return c.html(
		loginPage({
			turnstileSiteKey: getTurnstileSiteKey(c.env),
		}),
	);
});

auth.post("/login", rateLimit, async (c) => {
	const body = await c.req.parseBody();
	const username = sanitizePlainText(body.username, 80);
	const password = String(body.password || "");
	const turnstileResponse = String(body["cf-turnstile-response"] || "");
	const ip = c.req.header("cf-connecting-ip") || "unknown";
	const loginOptions = {
		turnstileSiteKey: getTurnstileSiteKey(c.env),
	};

	if (!username || !password) {
		return c.html(
			loginPage({
				...loginOptions,
				error: "用户名和密码不能为空喵",
			}),
			400,
		);
	}

	const turnstileVerified = await verifyTurnstile(c.env, turnstileResponse, ip);

	if (!turnstileVerified) {
		return c.html(
			loginPage({
				...loginOptions,
				error: "人机验证未通过喵",
			}),
			400,
		);
	}

	const usernameMatches = timingSafeEqualText(username, c.env.ADMIN_USERNAME);
	const passwordMatches = await verifyPassword(
		password,
		c.env.ADMIN_PASSWORD_HASH,
	);

	if (!usernameMatches || !passwordMatches) {
		try {
			await recordFailedAttempt(c.env, ip);
		} catch {
			return c.html(
				loginPage({
					...loginOptions,
					error: "登录保护暂时不可用，请稍后再试喵",
				}),
				503,
			);
		}

		return c.html(
			loginPage({
				...loginOptions,
				error: "用户名或密码错误喵",
			}),
			401,
		);
	}

	const session = await createSession(c.env);
	const token = await createToken(c.env, session.id);
	setCookie(c, "admin_session", token, {
		...getSessionCookieOptions(c.req.url),
	});

	await clearAttempts(c.env, ip).catch(() => undefined);
	return c.redirect("/api/admin");
});

auth.get("/logout", (c) => {
	return c.text("不支持当前请求方法喵", 405);
});

auth.post("/logout", requireAuth, async (c) => {
	const body = await c.req.parseBody();
	const session = getAuthenticatedSession(c);

	if (!assertCsrfToken(body._csrf, session)) {
		return c.text("CSRF 校验失败喵", 403);
	}

	await destroySession(c.env, session.id);
	deleteCookie(c, "admin_session", { path: "/" });
	return c.redirect("/api/auth/login");
});

auth.get("/verify", requireAuth, async (c) => {
	const session = getAuthenticatedSession(c);
	return c.json(
		{
			authenticated: true,
			csrfToken: session.csrfToken,
			passwordHashFormat: isLegacyPasswordHash(c.env.ADMIN_PASSWORD_HASH)
				? "legacy-sha256"
				: "pbkdf2-sha256",
		},
		200,
	);
});

export { auth as authRoutes };
