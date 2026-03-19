import type { Context } from "hono";
import { Hono } from "hono";
import { getDb } from "@/lib/db";
import {
	isOpenAICompatibleEndpointReady,
	type OpenAICompatibleMessage,
	requestOpenAICompatibleChatCompletion,
} from "@/lib/openai-compatible";
import { sanitizePlainText } from "@/lib/security";
import { getResolvedAiSettings } from "@/lib/site-appearance";
import type { AdminAppEnv } from "../middleware/auth";

const publicAiRoutes = new Hono<AdminAppEnv>();

const MAX_CHAT_BODY_LENGTH = 16_384;
const MAX_TERMINAL_BODY_LENGTH = 1_048_576;
const MAX_MESSAGE_LENGTH = 4_000;
const MAX_TERMINAL_CWD_LENGTH = 240;
const MAX_TERMINAL_HISTORY_MESSAGE_LENGTH = 16_000;
const MAX_TURNSTILE_TOKEN_LENGTH = 4_096;
const DEFAULT_RATE_LIMIT_PER_MINUTE = 12;
const DEFAULT_DAILY_LIMIT_PER_IP = 120;
type PublicAiMode = "chat" | "terminal-404";
const DEFAULT_PUBLIC_AI_SYSTEM_PROMPT =
	"你是站点内的公开助手。请使用简体中文回答，内容简洁、准确，避免输出敏感系统信息。";
const NOT_FOUND_TERMINAL_SYSTEM_PROMPT = `
你是网站 404 彩蛋页里的 shell 终端模拟器。
你会收到多轮消息，user 消息格式统一为两段信息：
- PWD=<当前路径>
- COMMAND=<用户输入命令>
assistant 消息是上一轮的终端输出结果。

请严格按 shell 风格返回“命令执行结果”，必须遵守：
1) 只输出纯文本，不要 Markdown、代码块、解释说明、前后缀礼貌语。
2) 输出内容只应是“执行结果本体”，不要重复打印命令本身。
3) 若命令无效，输出格式必须是：command not found: <命令名>
4) 若命令为 ls，按当前路径给出目录/文件列表（可合理模拟），一行一个条目。
5) 若命令为 pwd，直接输出 PWD 对应路径。
6) 若命令为 clear 或 cls，只返回：TERMINAL_CLEAR
7) 不要声称真的访问了服务器真实文件系统；这是模拟 shell。
`.trim();

interface TerminalHistoryMessage {
	role: "user" | "assistant";
	content: string;
}

interface PublicAiPayload {
	message: string;
	cwd: string | null;
	turnstileToken: string | null;
	history: TerminalHistoryMessage[];
}

interface TurnstileVerifyResponse {
	success?: boolean;
	"error-codes"?: string[];
}

function parseLimit(
	value: unknown,
	fallback: number,
	min: number,
	max: number,
): number {
	const parsed = Number.parseInt(String(value ?? ""), 10);
	if (!Number.isFinite(parsed)) {
		return fallback;
	}

	return Math.min(max, Math.max(min, parsed));
}

function getClientIp(c: Context<AdminAppEnv>): string {
	const directIp = sanitizePlainText(c.req.header("CF-Connecting-IP"), 64);
	if (directIp) {
		return directIp;
	}

	const forwarded = sanitizePlainText(c.req.header("x-forwarded-for"), 255);
	if (!forwarded) {
		return "unknown";
	}

	const first = forwarded
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean)[0];
	return sanitizePlainText(first, 64) || "unknown";
}

function isSameOriginRequest(c: Context<AdminAppEnv>): boolean {
	const origin = c.req.header("origin");
	if (!origin) {
		return true;
	}

	try {
		const requestUrl = new URL(c.req.url);
		return new URL(origin).origin === requestUrl.origin;
	} catch {
		return false;
	}
}

function parsePayload(
	rawBody: string,
	mode: PublicAiMode,
): { data: PublicAiPayload } | { error: string } {
	const maxBodyLength =
		mode === "terminal-404" ? MAX_TERMINAL_BODY_LENGTH : MAX_CHAT_BODY_LENGTH;
	if (!rawBody || rawBody.length > maxBodyLength) {
		return { error: "请求体体积无效" };
	}

	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(rawBody) as Record<string, unknown>;
	} catch {
		return { error: "请求体不是合法 JSON" };
	}

	const message = sanitizePlainText(parsed.message, MAX_MESSAGE_LENGTH, {
		allowNewlines: true,
	});
	if (!message) {
		return { error: "message 不能为空" };
	}
	const cwdRaw = sanitizePlainText(parsed.cwd, MAX_TERMINAL_CWD_LENGTH);
	const cwd = normalizeTerminalCwd(cwdRaw);
	const history =
		mode === "terminal-404" ? normalizeTerminalHistory(parsed.history) : [];

	const turnstileToken =
		sanitizePlainText(parsed.turnstileToken, MAX_TURNSTILE_TOKEN_LENGTH) ||
		null;

	return {
		data: {
			message,
			cwd,
			turnstileToken,
			history,
		},
	};
}

function normalizeTerminalCwd(value: string): string | null {
	const raw = String(value ?? "").trim();
	if (!raw) {
		return null;
	}

	let normalized = raw;
	if (!normalized.startsWith("/")) {
		normalized = `/${normalized}`;
	}

	normalized = normalized.replaceAll(/\/+/g, "/");
	return normalized.slice(0, MAX_TERMINAL_CWD_LENGTH);
}

function normalizeTerminalHistory(value: unknown): TerminalHistoryMessage[] {
	if (!Array.isArray(value)) {
		return [];
	}

	const history: TerminalHistoryMessage[] = [];
	for (const item of value) {
		if (!item || typeof item !== "object") {
			continue;
		}

		const roleRaw = sanitizePlainText(
			(item as { role?: unknown }).role,
			16,
		).toLowerCase();
		if (roleRaw !== "user" && roleRaw !== "assistant") {
			continue;
		}

		const content = sanitizePlainText(
			(item as { content?: unknown }).content,
			MAX_TERMINAL_HISTORY_MESSAGE_LENGTH,
			{
				allowNewlines: true,
			},
		);
		if (!content) {
			continue;
		}

		history.push({
			role: roleRaw,
			content,
		});
	}

	return history;
}

function buildTerminalUserContent(cwd: string | null, command: string): string {
	return `PWD=${cwd || "/"}\nCOMMAND=${command}`;
}

interface PublicAiRequestOptions {
	maxTokens: number;
	requireTurnstile: boolean;
	systemPrompt: string;
	temperature: number;
	mode: PublicAiMode;
}

function getMinuteRateKey(ip: string): string {
	const currentMinute = Math.floor(Date.now() / 60_000);
	return `public-ai:minute:${ip}:${currentMinute}`;
}

function getDailyRateKey(ip: string): string {
	const day = new Date().toISOString().slice(0, 10);
	return `public-ai:day:${ip}:${day}`;
}

function secondsUntilTomorrowUtc(): number {
	const now = new Date();
	const next = new Date(now);
	next.setUTCHours(24, 0, 0, 0);
	const seconds = Math.ceil((next.getTime() - now.getTime()) / 1000);
	return Math.max(60, seconds);
}

async function incrementKvCounter(
	kv: KVNamespace,
	key: string,
	expirationTtl: number,
): Promise<number> {
	const currentRaw = await kv.get(key);
	const current = Number.parseInt(currentRaw ?? "0", 10);
	const next = (Number.isFinite(current) ? current : 0) + 1;
	await kv.put(key, String(next), {
		expirationTtl,
	});
	return next;
}

async function checkRateBudget(c: Context<AdminAppEnv>, ip: string) {
	const minuteLimit = parseLimit(
		c.env.PUBLIC_AI_RATE_LIMIT_PER_MINUTE,
		DEFAULT_RATE_LIMIT_PER_MINUTE,
		1,
		300,
	);
	const dailyLimit = parseLimit(
		c.env.PUBLIC_AI_DAILY_LIMIT_PER_IP,
		DEFAULT_DAILY_LIMIT_PER_IP,
		1,
		10_000,
	);

	const minuteCount = await incrementKvCounter(
		c.env.SESSION,
		getMinuteRateKey(ip),
		120,
	);
	if (minuteCount > minuteLimit) {
		return {
			ok: false as const,
			status: 429 as const,
			message: "请求过于频繁，请稍后再试",
		};
	}

	const dailyCount = await incrementKvCounter(
		c.env.SESSION,
		getDailyRateKey(ip),
		secondsUntilTomorrowUtc() + 300,
	);
	if (dailyCount > dailyLimit) {
		return {
			ok: false as const,
			status: 429 as const,
			message: "今日请求次数已达上限，请明天再试",
		};
	}

	return {
		ok: true as const,
		minuteLimit,
		dailyLimit,
	};
}

async function verifyTurnstileToken(
	c: Context<AdminAppEnv>,
	token: string | null,
) {
	const secret = String(c.env.TURNSTILE_SECRET_KEY || "").trim();
	if (!secret) {
		return { success: true, skipped: true } as const;
	}

	if (!token) {
		return { success: false, reason: "missing-token" } as const;
	}

	const formData = new URLSearchParams();
	formData.set("secret", secret);
	formData.set("response", token);
	const remoteIp = getClientIp(c);
	if (remoteIp && remoteIp !== "unknown") {
		formData.set("remoteip", remoteIp);
	}

	try {
		const response = await fetch(
			"https://challenges.cloudflare.com/turnstile/v0/siteverify",
			{
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: formData.toString(),
			},
		);
		if (!response.ok) {
			return { success: false, reason: "verify-request-failed" } as const;
		}

		const payload = (await response.json()) as TurnstileVerifyResponse;
		if (!payload.success) {
			return { success: false, reason: "verify-failed" } as const;
		}

		return { success: true, skipped: false } as const;
	} catch {
		return { success: false, reason: "verify-exception" } as const;
	}
}

async function handlePublicAiRequest(
	c: Context<AdminAppEnv>,
	options: PublicAiRequestOptions,
) {
	if (!isSameOriginRequest(c)) {
		return c.json({ error: "非法来源请求" }, 403);
	}

	const rawBody = await c.req.text();
	const parsed = parsePayload(rawBody, options.mode);
	if ("error" in parsed) {
		return c.json({ error: parsed.error }, 400);
	}

	if (options.requireTurnstile) {
		const turnstile = await verifyTurnstileToken(c, parsed.data.turnstileToken);
		if (!turnstile.success) {
			return c.json({ error: "人机校验失败，请刷新后重试" }, 403);
		}
	}

	const ip = getClientIp(c);
	const budget = await checkRateBudget(c, ip).catch(() => null);
	if (!budget) {
		return c.json({ error: "限流服务暂时不可用，请稍后再试" }, 503);
	}
	if (!budget.ok) {
		return c.json({ error: budget.message }, budget.status);
	}

	const resolvedAi = await getResolvedAiSettings(getDb(c.env.DB), c.env).catch(
		() => null,
	);
	if (!resolvedAi) {
		return c.json({ error: "公开 AI 接口暂时不可用" }, 503);
	}
	const publicEndpoint = resolvedAi.settings.public;

	if (!isOpenAICompatibleEndpointReady(publicEndpoint)) {
		return c.json({ error: "公开 AI 接口尚未配置完成" }, 503);
	}

	try {
		const messages: OpenAICompatibleMessage[] = [
			{
				role: "system",
				content: options.systemPrompt,
			},
		];
		if (options.mode === "terminal-404") {
			messages.push(...parsed.data.history);
			messages.push({
				role: "user",
				content: buildTerminalUserContent(parsed.data.cwd, parsed.data.message),
			});
		} else {
			messages.push({
				role: "user",
				content: parsed.data.message,
			});
		}

		const reply = await requestOpenAICompatibleChatCompletion(
			publicEndpoint,
			messages,
			{
				temperature: options.temperature,
				maxTokens: options.maxTokens,
				timeoutMs: 20_000,
				jsonMode: false,
			},
		);

		return c.json({
			reply,
			meta: {
				mode: options.mode,
				rateLimitPerMinute: budget.minuteLimit,
				dailyLimitPerIp: budget.dailyLimit,
			},
		});
	} catch (error) {
		console.error("public_ai_chat_failed", error);
		return c.json({ error: "公开 AI 服务暂时不可用" }, 503);
	}
}

publicAiRoutes.post("/chat", async (c) =>
	handlePublicAiRequest(c, {
		requireTurnstile: true,
		systemPrompt: DEFAULT_PUBLIC_AI_SYSTEM_PROMPT,
		temperature: 0.4,
		maxTokens: 700,
		mode: "chat",
	}),
);

publicAiRoutes.post("/terminal-404", async (c) =>
	handlePublicAiRequest(c, {
		requireTurnstile: false,
		systemPrompt: NOT_FOUND_TERMINAL_SYSTEM_PROMPT,
		temperature: 0.35,
		maxTokens: 500,
		mode: "terminal-404",
	}),
);

export { publicAiRoutes };
