import type { Context, Next } from "hono";
import { loginPage } from "../views/login";
import type { AdminAppEnv } from "./auth";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const ATTEMPT_TTL_SECONDS = 24 * 60 * 60;

interface LoginAttemptState {
	attempts: number;
	lockedUntil: string | null;
	lastAttempt: string;
}

function getAttemptKey(ip: string): string {
	return `login-rate:${ip}`;
}

function getTurnstileSiteKey(env: Env): string | undefined {
	const siteKey = env.TURNSTILE_SITE_KEY?.trim();
	return siteKey ? siteKey : undefined;
}

async function readAttemptState(
	env: Env,
	ip: string,
): Promise<LoginAttemptState | null> {
	const raw = await env.SESSION.get(getAttemptKey(ip));
	if (!raw) {
		return null;
	}

	return JSON.parse(raw) as LoginAttemptState;
}

export async function rateLimit(c: Context<AdminAppEnv>, next: Next) {
	const ip = c.req.header("cf-connecting-ip") || "unknown";

	try {
		const state = await readAttemptState(c.env, ip);
		if (state?.lockedUntil) {
			const lockExpiry = new Date(state.lockedUntil);
			if (lockExpiry.getTime() > Date.now()) {
				const remainingSeconds = Math.ceil(
					(lockExpiry.getTime() - Date.now()) / 1000,
				);
				return c.html(
					loginPage({
						error: `登录尝试过多，请 ${remainingSeconds} 秒后再试喵`,
						turnstileSiteKey: getTurnstileSiteKey(c.env),
					}),
					429,
				);
			}

			await c.env.SESSION.delete(getAttemptKey(ip));
		}
	} catch {
		return c.html(
			loginPage({
				error: "登录保护暂时不可用，请稍后再试喵",
				turnstileSiteKey: getTurnstileSiteKey(c.env),
			}),
			503,
		);
	}

	await next();
}

export async function recordFailedAttempt(env: Env, ip: string): Promise<void> {
	const state = await readAttemptState(env, ip);
	const now = new Date().toISOString();
	const attempts = (state?.attempts ?? 0) + 1;
	const lockedUntil =
		attempts >= MAX_ATTEMPTS
			? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
			: null;

	await env.SESSION.put(
		getAttemptKey(ip),
		JSON.stringify({
			attempts,
			lockedUntil,
			lastAttempt: now,
		} satisfies LoginAttemptState),
		{
			expirationTtl: ATTEMPT_TTL_SECONDS,
		},
	);
}

export async function clearAttempts(env: Env, ip: string): Promise<void> {
	await env.SESSION.delete(getAttemptKey(ip));
}
