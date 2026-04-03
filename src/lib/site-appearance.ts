import { eq } from "drizzle-orm";
import { siteAppearanceSettings } from "@/db/schema";
import type { Database } from "@/lib/db";
import {
	normalizeOpenAICompatibleBaseUrl,
	type OpenAICompatibleEndpointConfig,
} from "@/lib/openai-compatible";
import { sanitizeMediaKey, sanitizePlainText } from "@/lib/security";

export interface SiteNavLink {
	label: string;
	href: string;
}

const MAX_DYNAMIC_LINK_ITEMS = 16;

const DEFAULT_NAV_LINKS: SiteNavLink[] = [
	{ label: "首页", href: "/" },
	{ label: "归档", href: "/blog" },
	{ label: "搜索", href: "/search" },
];

const DEFAULT_HERO_ACTIONS: SiteNavLink[] = [
	{ label: "进入归档", href: "/blog" },
	{ label: "站内搜索", href: "/search" },
];

export interface SiteAppearance {
	backgroundImageKey: string | null;
	backgroundOpacity: number;
	backgroundBlur: number;
	backgroundScale: number;
	backgroundPositionX: number;
	backgroundPositionY: number;
	heroCardOpacity: number;
	heroCardBlur: number;
	postCardOpacity: number;
	postCardBlur: number;
	articlePanelOpacity: number;
	articlePanelBlur: number;
	headerSubtitle: string;
	navLinks: SiteNavLink[];
	navLink1Label: string;
	navLink1Href: string;
	navLink2Label: string;
	navLink2Href: string;
	navLink3Label: string;
	navLink3Href: string;
	heroKicker: string;
	heroTitle: string;
	heroIntro: string;
	heroMainImagePath: string | null;
	heroActions: SiteNavLink[];
	heroPrimaryLabel: string;
	heroPrimaryHref: string;
	heroSecondaryLabel: string;
	heroSecondaryHref: string;
	heroSignalLabel: string;
	heroSignalHeading: string;
	heroSignalCopy: string;
	heroSignalImagePath: string | null;
	heroSignalChip1: string;
	heroSignalChip2: string;
	heroSignalChip3: string;
	articleSidebarAvatarPath: string | null;
	articleSidebarName: string;
	articleSidebarBio: string;
	articleSidebarBadge: string;
	mcpEnabled: boolean;
}

export interface AiSettings {
	internal: OpenAICompatibleEndpointConfig;
	public: OpenAICompatibleEndpointConfig;
}

export type AiApiKeySource = "cloudflare-secret" | "web-config" | "empty";

export interface ResolvedAiSettings {
	settings: AiSettings;
	keySource: {
		internal: AiApiKeySource;
		public: AiApiKeySource;
	};
}

export type SiteAppearanceInput = Omit<
	Partial<SiteAppearance>,
	"mcpEnabled"
> & {
	navLinksJson?: unknown;
	heroActionsJson?: unknown;
	mcpEnabled?: unknown;
};

export type AiSettingsInput = {
	internal?: Partial<OpenAICompatibleEndpointConfig>;
	public?: Partial<OpenAICompatibleEndpointConfig>;
	aiInternalEnabled?: unknown;
	aiInternalBaseUrl?: unknown;
	aiInternalApiKey?: unknown;
	aiInternalModel?: unknown;
	aiPublicEnabled?: unknown;
	aiPublicBaseUrl?: unknown;
	aiPublicApiKey?: unknown;
	aiPublicModel?: unknown;
};

export const DEFAULT_SITE_APPEARANCE: SiteAppearance = {
	backgroundImageKey: null,
	backgroundOpacity: 72,
	backgroundBlur: 24,
	backgroundScale: 112,
	backgroundPositionX: 50,
	backgroundPositionY: 50,
	heroCardOpacity: 14,
	heroCardBlur: 18,
	postCardOpacity: 14,
	postCardBlur: 18,
	articlePanelOpacity: 14,
	articlePanelBlur: 18,
	headerSubtitle: "流畅、克制、持续更新的技术写作",
	navLinks: [...DEFAULT_NAV_LINKS],
	navLink1Label: DEFAULT_NAV_LINKS[0].label,
	navLink1Href: DEFAULT_NAV_LINKS[0].href,
	navLink2Label: DEFAULT_NAV_LINKS[1].label,
	navLink2Href: DEFAULT_NAV_LINKS[1].href,
	navLink3Label: DEFAULT_NAV_LINKS[2].label,
	navLink3Href: DEFAULT_NAV_LINKS[2].href,
	heroKicker: "云端记录",
	heroTitle: "把工程判断写清楚，把技术细节写漂亮。",
	heroIntro:
		"这里记录 Cloudflare、前端工程、调试过程和系统设计里那些值得反复回看的瞬间。界面会继续打磨，但内容先要足够清晰、足够耐读。",
	heroMainImagePath: null,
	heroActions: [...DEFAULT_HERO_ACTIONS],
	heroPrimaryLabel: DEFAULT_HERO_ACTIONS[0].label,
	heroPrimaryHref: DEFAULT_HERO_ACTIONS[0].href,
	heroSecondaryLabel: DEFAULT_HERO_ACTIONS[1].label,
	heroSecondaryHref: DEFAULT_HERO_ACTIONS[1].href,
	heroSignalLabel: "Scene Depth",
	heroSignalHeading: "首页会跟着你的视线轻轻转一下",
	heroSignalCopy:
		"不是把页面做得很吵，而是只让首屏层次、信息胶囊和按钮反馈更有呼吸感。",
	heroSignalImagePath: null,
	heroSignalChip1: "Mouse Sync",
	heroSignalChip2: "Soft Orbit",
	heroSignalChip3: "Card Lift",
	articleSidebarAvatarPath: null,
	articleSidebarName: "Eric-Terminal",
	articleSidebarBio: "在比特海里未雨绸缪，身后养着一只叫晖的狐狸。",
	articleSidebarBadge: "文章作者",
	mcpEnabled: true,
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
	internal: {
		enabled: false,
		baseUrl: "https://api.openai.com/v1",
		apiKey: "",
		model: "gpt-4o-mini",
	},
	public: {
		enabled: false,
		baseUrl: "https://api.openai.com/v1",
		apiKey: "",
		model: "gpt-4o-mini",
	},
};

function clampInteger(
	value: unknown,
	min: number,
	max: number,
	fallback: number,
) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		return fallback;
	}

	return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeText(value: unknown, maxLength: number, fallback: string) {
	const normalized = sanitizePlainText(value, maxLength);
	return normalized || fallback;
}

function normalizeLongText(
	value: unknown,
	maxLength: number,
	fallback: string,
) {
	const normalized = sanitizePlainText(value, maxLength, {
		allowNewlines: true,
	});
	return normalized || fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
	if (typeof value === "boolean") {
		return value;
	}

	const normalized = sanitizePlainText(value, 12).toLowerCase();
	if (["1", "true", "on", "yes"].includes(normalized)) {
		return true;
	}
	if (["0", "false", "off", "no"].includes(normalized)) {
		return false;
	}

	return fallback;
}

function normalizeApiKey(value: unknown, fallback: string) {
	const normalized = sanitizePlainText(value, 400);
	return normalized || fallback;
}

function resolveApiKeyFromSecretOrWeb(options: {
	secretValue: unknown;
	webValue: string;
}): { apiKey: string; source: AiApiKeySource } {
	const secret = sanitizePlainText(options.secretValue, 400);
	if (secret) {
		return { apiKey: secret, source: "cloudflare-secret" };
	}

	const web = sanitizePlainText(options.webValue, 400);
	if (web) {
		return { apiKey: web, source: "web-config" };
	}

	return { apiKey: "", source: "empty" };
}

function normalizeModel(value: unknown, fallback: string) {
	const normalized = sanitizePlainText(value, 120);
	return normalized || fallback;
}

function normalizeOptionalLinkHref(value: unknown) {
	const normalized = sanitizePlainText(value, 240);
	if (!normalized) {
		return null;
	}

	if (normalized.startsWith("/")) {
		return normalized.startsWith("//") ? null : normalized;
	}

	try {
		const url = new URL(normalized);
		return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
	} catch {
		return null;
	}
}

function normalizeOptionalImagePath(value: unknown) {
	const normalized = sanitizePlainText(value, 320);
	if (!normalized) {
		return null;
	}

	if (normalized.startsWith("/")) {
		return normalized.startsWith("//") ? null : normalized;
	}

	const mediaKey = sanitizeMediaKey(normalized);
	if (mediaKey?.includes("/")) {
		return `/media/${mediaKey}`;
	}

	try {
		const url = new URL(normalized);
		return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
	} catch {
		return null;
	}
}

function normalizeLinkHref(value: unknown, fallback: string) {
	return normalizeOptionalLinkHref(value) ?? fallback;
}

function normalizeLinkItems(
	source: unknown,
	fallbackItems: SiteNavLink[],
): SiteNavLink[] {
	let rawItems: unknown[] = [];

	if (Array.isArray(source)) {
		rawItems = source;
	} else if (typeof source === "string" && source.trim()) {
		try {
			const parsed = JSON.parse(source);
			if (Array.isArray(parsed)) {
				rawItems = parsed;
			}
		} catch {
			rawItems = [];
		}
	}

	const normalizedItems: SiteNavLink[] = [];
	for (const rawItem of rawItems.slice(0, MAX_DYNAMIC_LINK_ITEMS)) {
		if (!rawItem || typeof rawItem !== "object") {
			continue;
		}

		const label = sanitizePlainText(
			(rawItem as Record<string, unknown>).label,
			24,
		);
		const href = normalizeOptionalLinkHref(
			(rawItem as Record<string, unknown>).href,
		);

		if (!label || !href) {
			continue;
		}

		normalizedItems.push({ label, href });
	}

	if (normalizedItems.length === 0) {
		return fallbackItems.map((item) => ({ ...item }));
	}

	return normalizedItems;
}

function ensureFriendNavLink(items: SiteNavLink[]): SiteNavLink[] {
	const hasFriend = items.some((item) => item.href === "/friends");
	if (hasFriend) {
		return items;
	}

	const nextItems = [...items];
	const insertIndex = nextItems.findIndex((item) => item.href === "/search");
	if (insertIndex >= 0) {
		nextItems.splice(insertIndex, 0, { label: "友链", href: "/friends" });
	} else {
		nextItems.push({ label: "友链", href: "/friends" });
	}

	return nextItems.slice(0, MAX_DYNAMIC_LINK_ITEMS);
}

export function normalizeAiSettingsInput(input: AiSettingsInput): AiSettings {
	const rawInternal = input.internal ?? {};
	const rawPublic = input.public ?? {};

	return {
		internal: {
			enabled: normalizeBoolean(
				rawInternal.enabled ?? input.aiInternalEnabled,
				DEFAULT_AI_SETTINGS.internal.enabled,
			),
			baseUrl: normalizeOpenAICompatibleBaseUrl(
				rawInternal.baseUrl ?? input.aiInternalBaseUrl,
				DEFAULT_AI_SETTINGS.internal.baseUrl,
			),
			apiKey: normalizeApiKey(
				rawInternal.apiKey ?? input.aiInternalApiKey,
				DEFAULT_AI_SETTINGS.internal.apiKey,
			),
			model: normalizeModel(
				rawInternal.model ?? input.aiInternalModel,
				DEFAULT_AI_SETTINGS.internal.model,
			),
		},
		public: {
			enabled: normalizeBoolean(
				rawPublic.enabled ?? input.aiPublicEnabled,
				DEFAULT_AI_SETTINGS.public.enabled,
			),
			baseUrl: normalizeOpenAICompatibleBaseUrl(
				rawPublic.baseUrl ?? input.aiPublicBaseUrl,
				DEFAULT_AI_SETTINGS.public.baseUrl,
			),
			apiKey: normalizeApiKey(
				rawPublic.apiKey ?? input.aiPublicApiKey,
				DEFAULT_AI_SETTINGS.public.apiKey,
			),
			model: normalizeModel(
				rawPublic.model ?? input.aiPublicModel,
				DEFAULT_AI_SETTINGS.public.model,
			),
		},
	};
}

export function resolveAiSettingsWithSecrets(
	aiSettings: AiSettings,
	env: Partial<Pick<Env, "AI_INTERNAL_API_KEY" | "AI_PUBLIC_API_KEY">>,
): ResolvedAiSettings {
	const internal = resolveApiKeyFromSecretOrWeb({
		secretValue: env.AI_INTERNAL_API_KEY,
		webValue: aiSettings.internal.apiKey,
	});
	const publicEndpoint = resolveApiKeyFromSecretOrWeb({
		secretValue: env.AI_PUBLIC_API_KEY,
		webValue: aiSettings.public.apiKey,
	});

	return {
		settings: {
			internal: {
				...aiSettings.internal,
				apiKey: internal.apiKey,
			},
			public: {
				...aiSettings.public,
				apiKey: publicEndpoint.apiKey,
			},
		},
		keySource: {
			internal: internal.source,
			public: publicEndpoint.source,
		},
	};
}

export function normalizeSiteAppearanceInput(
	input: SiteAppearanceInput,
): SiteAppearance {
	const legacyNavLink1Label = normalizeText(
		input.navLink1Label,
		24,
		DEFAULT_SITE_APPEARANCE.navLink1Label,
	);
	const legacyNavLink1Href = normalizeLinkHref(
		input.navLink1Href,
		DEFAULT_SITE_APPEARANCE.navLink1Href,
	);
	const legacyNavLink2Label = normalizeText(
		input.navLink2Label,
		24,
		DEFAULT_SITE_APPEARANCE.navLink2Label,
	);
	const legacyNavLink2Href = normalizeLinkHref(
		input.navLink2Href,
		DEFAULT_SITE_APPEARANCE.navLink2Href,
	);
	const legacyNavLink3Label = normalizeText(
		input.navLink3Label,
		24,
		DEFAULT_SITE_APPEARANCE.navLink3Label,
	);
	const legacyNavLink3Href = normalizeLinkHref(
		input.navLink3Href,
		DEFAULT_SITE_APPEARANCE.navLink3Href,
	);
	const fallbackNavLinks: SiteNavLink[] = [
		{ label: legacyNavLink1Label, href: legacyNavLink1Href },
		{ label: legacyNavLink2Label, href: legacyNavLink2Href },
		{ label: legacyNavLink3Label, href: legacyNavLink3Href },
	];

	const legacyHeroPrimaryLabel = normalizeText(
		input.heroPrimaryLabel,
		24,
		DEFAULT_SITE_APPEARANCE.heroPrimaryLabel,
	);
	const legacyHeroPrimaryHref = normalizeLinkHref(
		input.heroPrimaryHref,
		DEFAULT_SITE_APPEARANCE.heroPrimaryHref,
	);
	const legacyHeroSecondaryLabel = normalizeText(
		input.heroSecondaryLabel,
		24,
		DEFAULT_SITE_APPEARANCE.heroSecondaryLabel,
	);
	const legacyHeroSecondaryHref = normalizeLinkHref(
		input.heroSecondaryHref,
		DEFAULT_SITE_APPEARANCE.heroSecondaryHref,
	);
	const fallbackHeroActions: SiteNavLink[] = [
		{ label: legacyHeroPrimaryLabel, href: legacyHeroPrimaryHref },
		{ label: legacyHeroSecondaryLabel, href: legacyHeroSecondaryHref },
	];

	const navLinks = ensureFriendNavLink(
		normalizeLinkItems(input.navLinks ?? input.navLinksJson, fallbackNavLinks),
	);
	const heroActions = normalizeLinkItems(
		input.heroActions ?? input.heroActionsJson,
		fallbackHeroActions,
	);
	const normalizedNavLink1 = navLinks[0] ?? DEFAULT_NAV_LINKS[0];
	const normalizedNavLink2 = navLinks[1] ?? DEFAULT_NAV_LINKS[1];
	const normalizedNavLink3 = navLinks[2] ?? DEFAULT_NAV_LINKS[2];
	const normalizedHeroPrimary = heroActions[0] ?? DEFAULT_HERO_ACTIONS[0];
	const normalizedHeroSecondary = heroActions[1] ?? DEFAULT_HERO_ACTIONS[1];

	return {
		backgroundImageKey: input.backgroundImageKey
			? sanitizeMediaKey(input.backgroundImageKey)
			: null,
		backgroundOpacity: clampInteger(
			input.backgroundOpacity,
			0,
			100,
			DEFAULT_SITE_APPEARANCE.backgroundOpacity,
		),
		backgroundBlur: clampInteger(
			input.backgroundBlur,
			0,
			60,
			DEFAULT_SITE_APPEARANCE.backgroundBlur,
		),
		backgroundScale: clampInteger(
			input.backgroundScale,
			100,
			180,
			DEFAULT_SITE_APPEARANCE.backgroundScale,
		),
		backgroundPositionX: clampInteger(
			input.backgroundPositionX,
			0,
			100,
			DEFAULT_SITE_APPEARANCE.backgroundPositionX,
		),
		backgroundPositionY: clampInteger(
			input.backgroundPositionY,
			0,
			100,
			DEFAULT_SITE_APPEARANCE.backgroundPositionY,
		),
		heroCardOpacity: clampInteger(
			input.heroCardOpacity,
			0,
			100,
			DEFAULT_SITE_APPEARANCE.heroCardOpacity,
		),
		heroCardBlur: clampInteger(
			input.heroCardBlur,
			0,
			48,
			DEFAULT_SITE_APPEARANCE.heroCardBlur,
		),
		postCardOpacity: clampInteger(
			input.postCardOpacity,
			0,
			100,
			DEFAULT_SITE_APPEARANCE.postCardOpacity,
		),
		postCardBlur: clampInteger(
			input.postCardBlur,
			0,
			48,
			DEFAULT_SITE_APPEARANCE.postCardBlur,
		),
		articlePanelOpacity: clampInteger(
			input.articlePanelOpacity,
			0,
			100,
			DEFAULT_SITE_APPEARANCE.articlePanelOpacity,
		),
		articlePanelBlur: clampInteger(
			input.articlePanelBlur,
			0,
			48,
			DEFAULT_SITE_APPEARANCE.articlePanelBlur,
		),
		headerSubtitle: normalizeText(
			input.headerSubtitle,
			120,
			DEFAULT_SITE_APPEARANCE.headerSubtitle,
		),
		navLinks,
		navLink1Label: normalizedNavLink1.label,
		navLink1Href: normalizedNavLink1.href,
		navLink2Label: normalizedNavLink2.label,
		navLink2Href: normalizedNavLink2.href,
		navLink3Label: normalizedNavLink3.label,
		navLink3Href: normalizedNavLink3.href,
		heroKicker: normalizeText(
			input.heroKicker,
			24,
			DEFAULT_SITE_APPEARANCE.heroKicker,
		),
		heroTitle: normalizeText(
			input.heroTitle,
			120,
			DEFAULT_SITE_APPEARANCE.heroTitle,
		),
		heroIntro: normalizeLongText(
			input.heroIntro,
			600,
			DEFAULT_SITE_APPEARANCE.heroIntro,
		),
		heroMainImagePath:
			normalizeOptionalImagePath(input.heroMainImagePath) ??
			DEFAULT_SITE_APPEARANCE.heroMainImagePath,
		heroActions,
		heroPrimaryLabel: normalizedHeroPrimary.label,
		heroPrimaryHref: normalizedHeroPrimary.href,
		heroSecondaryLabel: normalizedHeroSecondary.label,
		heroSecondaryHref: normalizedHeroSecondary.href,
		heroSignalLabel: normalizeText(
			input.heroSignalLabel,
			30,
			DEFAULT_SITE_APPEARANCE.heroSignalLabel,
		),
		heroSignalHeading: normalizeText(
			input.heroSignalHeading,
			120,
			DEFAULT_SITE_APPEARANCE.heroSignalHeading,
		),
		heroSignalCopy: normalizeLongText(
			input.heroSignalCopy,
			300,
			DEFAULT_SITE_APPEARANCE.heroSignalCopy,
		),
		heroSignalImagePath:
			normalizeOptionalImagePath(input.heroSignalImagePath) ??
			DEFAULT_SITE_APPEARANCE.heroSignalImagePath,
		heroSignalChip1: normalizeText(
			input.heroSignalChip1,
			24,
			DEFAULT_SITE_APPEARANCE.heroSignalChip1,
		),
		heroSignalChip2: normalizeText(
			input.heroSignalChip2,
			24,
			DEFAULT_SITE_APPEARANCE.heroSignalChip2,
		),
		heroSignalChip3: normalizeText(
			input.heroSignalChip3,
			24,
			DEFAULT_SITE_APPEARANCE.heroSignalChip3,
		),
		articleSidebarAvatarPath:
			normalizeOptionalImagePath(input.articleSidebarAvatarPath) ??
			DEFAULT_SITE_APPEARANCE.articleSidebarAvatarPath,
		articleSidebarName: normalizeText(
			input.articleSidebarName,
			36,
			DEFAULT_SITE_APPEARANCE.articleSidebarName,
		),
		articleSidebarBio: normalizeLongText(
			input.articleSidebarBio,
			320,
			DEFAULT_SITE_APPEARANCE.articleSidebarBio,
		),
		articleSidebarBadge: normalizeText(
			input.articleSidebarBadge,
			24,
			DEFAULT_SITE_APPEARANCE.articleSidebarBadge,
		),
		mcpEnabled: normalizeBoolean(
			input.mcpEnabled,
			DEFAULT_SITE_APPEARANCE.mcpEnabled,
		),
	};
}

export function buildSiteNavLinks(appearance: SiteAppearance): SiteNavLink[] {
	return ensureFriendNavLink(
		normalizeLinkItems(appearance.navLinks, DEFAULT_NAV_LINKS),
	);
}

export function buildHeroActionLinks(
	appearance: SiteAppearance,
): SiteNavLink[] {
	return normalizeLinkItems(appearance.heroActions, DEFAULT_HERO_ACTIONS);
}

export function resolveSiteDescriptionFromAppearance(
	appearance: Pick<SiteAppearance, "heroIntro" | "headerSubtitle">,
	fallbackDescription: string,
): string {
	const heroIntro = sanitizePlainText(appearance.heroIntro, 600, {
		allowNewlines: true,
	})
		.replace(/\s+/g, " ")
		.trim();
	if (heroIntro) {
		return heroIntro;
	}

	const headerSubtitle = sanitizePlainText(appearance.headerSubtitle, 120)
		.replace(/\s+/g, " ")
		.trim();
	if (headerSubtitle) {
		return headerSubtitle;
	}

	return fallbackDescription;
}

// 进程内缓存：在同一 Worker isolate 的多次调用中复用查询结果，
// 消除同一请求内（如 [slug].astro + Base.astro 各自调用一次）的重复 D1 往返，
// 并在低流量时跨请求复用热数据，降低 D1 冷查询频率。
const SITE_APPEARANCE_CACHE_TTL_MS = 30 * 1000; // 30 秒

interface SiteAppearanceCacheEntry {
	value: SiteAppearance;
	expiresAt: number;
}

let _siteAppearanceCache: SiteAppearanceCacheEntry | null = null;
// 飞行中请求去重：当有并发调用时共享同一个 Promise
let _siteAppearancePending: Promise<SiteAppearance> | null = null;

async function fetchSiteAppearance(db: Database): Promise<SiteAppearance> {
	const [row] = await db
		.select({
			backgroundImageKey: siteAppearanceSettings.backgroundImageKey,
			backgroundOpacity: siteAppearanceSettings.backgroundOpacity,
			backgroundBlur: siteAppearanceSettings.backgroundBlur,
			backgroundScale: siteAppearanceSettings.backgroundScale,
			backgroundPositionX: siteAppearanceSettings.backgroundPositionX,
			backgroundPositionY: siteAppearanceSettings.backgroundPositionY,
			heroCardOpacity: siteAppearanceSettings.heroCardOpacity,
			heroCardBlur: siteAppearanceSettings.heroCardBlur,
			postCardOpacity: siteAppearanceSettings.postCardOpacity,
			postCardBlur: siteAppearanceSettings.postCardBlur,
			articlePanelOpacity: siteAppearanceSettings.articlePanelOpacity,
			articlePanelBlur: siteAppearanceSettings.articlePanelBlur,
			headerSubtitle: siteAppearanceSettings.headerSubtitle,
			navLink1Label: siteAppearanceSettings.navLink1Label,
			navLink1Href: siteAppearanceSettings.navLink1Href,
			navLink2Label: siteAppearanceSettings.navLink2Label,
			navLink2Href: siteAppearanceSettings.navLink2Href,
			navLink3Label: siteAppearanceSettings.navLink3Label,
			navLink3Href: siteAppearanceSettings.navLink3Href,
			navLinksJson: siteAppearanceSettings.navLinksJson,
			heroKicker: siteAppearanceSettings.heroKicker,
			heroTitle: siteAppearanceSettings.heroTitle,
			heroIntro: siteAppearanceSettings.heroIntro,
			heroMainImagePath: siteAppearanceSettings.heroMainImagePath,
			heroPrimaryLabel: siteAppearanceSettings.heroPrimaryLabel,
			heroPrimaryHref: siteAppearanceSettings.heroPrimaryHref,
			heroSecondaryLabel: siteAppearanceSettings.heroSecondaryLabel,
			heroSecondaryHref: siteAppearanceSettings.heroSecondaryHref,
			heroActionsJson: siteAppearanceSettings.heroActionsJson,
			heroSignalLabel: siteAppearanceSettings.heroSignalLabel,
			heroSignalHeading: siteAppearanceSettings.heroSignalHeading,
			heroSignalCopy: siteAppearanceSettings.heroSignalCopy,
			heroSignalImagePath: siteAppearanceSettings.heroSignalImagePath,
			heroSignalChip1: siteAppearanceSettings.heroSignalChip1,
			heroSignalChip2: siteAppearanceSettings.heroSignalChip2,
			heroSignalChip3: siteAppearanceSettings.heroSignalChip3,
			articleSidebarAvatarPath: siteAppearanceSettings.articleSidebarAvatarPath,
			articleSidebarName: siteAppearanceSettings.articleSidebarName,
			articleSidebarBio: siteAppearanceSettings.articleSidebarBio,
			articleSidebarBadge: siteAppearanceSettings.articleSidebarBadge,
			mcpEnabled: siteAppearanceSettings.mcpEnabled,
		})
		.from(siteAppearanceSettings)
		.where(eq(siteAppearanceSettings.id, 1))
		.limit(1);

	if (!row) {
		return DEFAULT_SITE_APPEARANCE;
	}

	return normalizeSiteAppearanceInput(row);
}

export async function getSiteAppearance(db: Database): Promise<SiteAppearance> {
	const now = Date.now();

	// 缓存命中：直接返回，跳过 D1 查询
	if (_siteAppearanceCache && _siteAppearanceCache.expiresAt > now) {
		return _siteAppearanceCache.value;
	}

	// 飞行中请求去重：有进行中的查询时，等待其结果而非重复发起
	if (_siteAppearancePending) {
		return _siteAppearancePending;
	}

	_siteAppearancePending = fetchSiteAppearance(db).then((value) => {
		_siteAppearanceCache = { value, expiresAt: Date.now() + SITE_APPEARANCE_CACHE_TTL_MS };
		return value;
	}).finally(() => {
		_siteAppearancePending = null;
	});

	return _siteAppearancePending;
}

// 管理员更新网站外观后调用，立即使进程内缓存失效
export function invalidateSiteAppearanceCache(): void {
	_siteAppearanceCache = null;
	_siteAppearancePending = null;
}

export async function getAiSettings(db: Database): Promise<AiSettings> {
	const [row] = await db
		.select({
			aiInternalEnabled: siteAppearanceSettings.aiInternalEnabled,
			aiInternalBaseUrl: siteAppearanceSettings.aiInternalBaseUrl,
			aiInternalApiKey: siteAppearanceSettings.aiInternalApiKey,
			aiInternalModel: siteAppearanceSettings.aiInternalModel,
			aiPublicEnabled: siteAppearanceSettings.aiPublicEnabled,
			aiPublicBaseUrl: siteAppearanceSettings.aiPublicBaseUrl,
			aiPublicApiKey: siteAppearanceSettings.aiPublicApiKey,
			aiPublicModel: siteAppearanceSettings.aiPublicModel,
		})
		.from(siteAppearanceSettings)
		.where(eq(siteAppearanceSettings.id, 1))
		.limit(1);

	if (!row) {
		return DEFAULT_AI_SETTINGS;
	}

	return normalizeAiSettingsInput(row);
}

export async function getResolvedAiSettings(
	db: Database,
	env: Partial<Pick<Env, "AI_INTERNAL_API_KEY" | "AI_PUBLIC_API_KEY">>,
): Promise<ResolvedAiSettings> {
	const aiSettings = await getAiSettings(db);
	return resolveAiSettingsWithSecrets(aiSettings, env);
}

export async function saveAiSettings(db: Database, input: AiSettingsInput) {
	const normalized = normalizeAiSettingsInput(input);

	await db
		.insert(siteAppearanceSettings)
		.values({
			id: 1,
			aiInternalEnabled: normalized.internal.enabled,
			aiInternalBaseUrl: normalized.internal.baseUrl,
			aiInternalApiKey: normalized.internal.apiKey,
			aiInternalModel: normalized.internal.model,
			aiPublicEnabled: normalized.public.enabled,
			aiPublicBaseUrl: normalized.public.baseUrl,
			aiPublicApiKey: normalized.public.apiKey,
			aiPublicModel: normalized.public.model,
		})
		.onConflictDoUpdate({
			target: siteAppearanceSettings.id,
			set: {
				aiInternalEnabled: normalized.internal.enabled,
				aiInternalBaseUrl: normalized.internal.baseUrl,
				aiInternalApiKey: normalized.internal.apiKey,
				aiInternalModel: normalized.internal.model,
				aiPublicEnabled: normalized.public.enabled,
				aiPublicBaseUrl: normalized.public.baseUrl,
				aiPublicApiKey: normalized.public.apiKey,
				aiPublicModel: normalized.public.model,
			},
		});

	return normalized;
}

export async function saveSiteAppearance(
	db: Database,
	input: SiteAppearanceInput,
) {
	const normalized = normalizeSiteAppearanceInput(input);
	const navLinksJson = JSON.stringify(normalized.navLinks);
	const heroActionsJson = JSON.stringify(normalized.heroActions);

	await db
		.insert(siteAppearanceSettings)
		.values({
			id: 1,
			backgroundImageKey: normalized.backgroundImageKey,
			backgroundOpacity: normalized.backgroundOpacity,
			backgroundBlur: normalized.backgroundBlur,
			backgroundScale: normalized.backgroundScale,
			backgroundPositionX: normalized.backgroundPositionX,
			backgroundPositionY: normalized.backgroundPositionY,
			heroCardOpacity: normalized.heroCardOpacity,
			heroCardBlur: normalized.heroCardBlur,
			postCardOpacity: normalized.postCardOpacity,
			postCardBlur: normalized.postCardBlur,
			articlePanelOpacity: normalized.articlePanelOpacity,
			articlePanelBlur: normalized.articlePanelBlur,
			headerSubtitle: normalized.headerSubtitle,
			navLink1Label: normalized.navLink1Label,
			navLink1Href: normalized.navLink1Href,
			navLink2Label: normalized.navLink2Label,
			navLink2Href: normalized.navLink2Href,
			navLink3Label: normalized.navLink3Label,
			navLink3Href: normalized.navLink3Href,
			navLinksJson,
			heroKicker: normalized.heroKicker,
			heroTitle: normalized.heroTitle,
			heroIntro: normalized.heroIntro,
			heroMainImagePath: normalized.heroMainImagePath,
			heroPrimaryLabel: normalized.heroPrimaryLabel,
			heroPrimaryHref: normalized.heroPrimaryHref,
			heroSecondaryLabel: normalized.heroSecondaryLabel,
			heroSecondaryHref: normalized.heroSecondaryHref,
			heroActionsJson,
			heroSignalLabel: normalized.heroSignalLabel,
			heroSignalHeading: normalized.heroSignalHeading,
			heroSignalCopy: normalized.heroSignalCopy,
			heroSignalImagePath: normalized.heroSignalImagePath,
			heroSignalChip1: normalized.heroSignalChip1,
			heroSignalChip2: normalized.heroSignalChip2,
			heroSignalChip3: normalized.heroSignalChip3,
			articleSidebarAvatarPath: normalized.articleSidebarAvatarPath,
			articleSidebarName: normalized.articleSidebarName,
			articleSidebarBio: normalized.articleSidebarBio,
			articleSidebarBadge: normalized.articleSidebarBadge,
			mcpEnabled: normalized.mcpEnabled,
		})
		.onConflictDoUpdate({
			target: siteAppearanceSettings.id,
			set: {
				backgroundImageKey: normalized.backgroundImageKey,
				backgroundOpacity: normalized.backgroundOpacity,
				backgroundBlur: normalized.backgroundBlur,
				backgroundScale: normalized.backgroundScale,
				backgroundPositionX: normalized.backgroundPositionX,
				backgroundPositionY: normalized.backgroundPositionY,
				heroCardOpacity: normalized.heroCardOpacity,
				heroCardBlur: normalized.heroCardBlur,
				postCardOpacity: normalized.postCardOpacity,
				postCardBlur: normalized.postCardBlur,
				articlePanelOpacity: normalized.articlePanelOpacity,
				articlePanelBlur: normalized.articlePanelBlur,
				headerSubtitle: normalized.headerSubtitle,
				navLink1Label: normalized.navLink1Label,
				navLink1Href: normalized.navLink1Href,
				navLink2Label: normalized.navLink2Label,
				navLink2Href: normalized.navLink2Href,
				navLink3Label: normalized.navLink3Label,
				navLink3Href: normalized.navLink3Href,
				navLinksJson,
				heroKicker: normalized.heroKicker,
				heroTitle: normalized.heroTitle,
				heroIntro: normalized.heroIntro,
				heroMainImagePath: normalized.heroMainImagePath,
				heroPrimaryLabel: normalized.heroPrimaryLabel,
				heroPrimaryHref: normalized.heroPrimaryHref,
				heroSecondaryLabel: normalized.heroSecondaryLabel,
				heroSecondaryHref: normalized.heroSecondaryHref,
				heroActionsJson,
				heroSignalLabel: normalized.heroSignalLabel,
				heroSignalHeading: normalized.heroSignalHeading,
				heroSignalCopy: normalized.heroSignalCopy,
				heroSignalImagePath: normalized.heroSignalImagePath,
				heroSignalChip1: normalized.heroSignalChip1,
				heroSignalChip2: normalized.heroSignalChip2,
				heroSignalChip3: normalized.heroSignalChip3,
				articleSidebarAvatarPath: normalized.articleSidebarAvatarPath,
				articleSidebarName: normalized.articleSidebarName,
				articleSidebarBio: normalized.articleSidebarBio,
				articleSidebarBadge: normalized.articleSidebarBadge,
				mcpEnabled: normalized.mcpEnabled,
			},
		});

	return normalized;
}

export function buildBackgroundImageUrl(key: string | null) {
	return key ? `/media/${key}` : null;
}
