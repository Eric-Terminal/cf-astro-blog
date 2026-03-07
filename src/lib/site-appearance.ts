import { eq } from "drizzle-orm";
import { siteAppearanceSettings } from "@/db/schema";
import type { Database } from "@/lib/db";
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
	backgroundBlur: number;
	backgroundScale: number;
	backgroundPositionX: number;
	backgroundPositionY: number;
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
	heroActions: SiteNavLink[];
	heroPrimaryLabel: string;
	heroPrimaryHref: string;
	heroSecondaryLabel: string;
	heroSecondaryHref: string;
	heroSignalLabel: string;
	heroSignalHeading: string;
	heroSignalCopy: string;
	heroTopicText: string;
	heroWritingText: string;
}

export type SiteAppearanceInput = Partial<SiteAppearance> & {
	navLinksJson?: unknown;
	heroActionsJson?: unknown;
};

export const DEFAULT_SITE_APPEARANCE: SiteAppearance = {
	backgroundImageKey: null,
	backgroundBlur: 24,
	backgroundScale: 112,
	backgroundPositionX: 50,
	backgroundPositionY: 50,
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
	heroActions: [...DEFAULT_HERO_ACTIONS],
	heroPrimaryLabel: DEFAULT_HERO_ACTIONS[0].label,
	heroPrimaryHref: DEFAULT_HERO_ACTIONS[0].href,
	heroSecondaryLabel: DEFAULT_HERO_ACTIONS[1].label,
	heroSecondaryHref: DEFAULT_HERO_ACTIONS[1].href,
	heroSignalLabel: "Scene Depth",
	heroSignalHeading: "首页会跟着你的视线轻轻转一下",
	heroSignalCopy:
		"不是把页面做得很吵，而是只让首屏层次、信息胶囊和按钮反馈更有呼吸感。",
	heroTopicText: "Cloudflare · 前端工程 · 架构细节",
	heroWritingText: "慢一点，但尽量长期有效。",
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

	const navLinks = normalizeLinkItems(
		input.navLinks ?? input.navLinksJson,
		fallbackNavLinks,
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
		heroTopicText: normalizeText(
			input.heroTopicText,
			120,
			DEFAULT_SITE_APPEARANCE.heroTopicText,
		),
		heroWritingText: normalizeText(
			input.heroWritingText,
			120,
			DEFAULT_SITE_APPEARANCE.heroWritingText,
		),
	};
}

export function buildSiteNavLinks(appearance: SiteAppearance): SiteNavLink[] {
	return normalizeLinkItems(appearance.navLinks, DEFAULT_NAV_LINKS);
}

export function buildHeroActionLinks(
	appearance: SiteAppearance,
): SiteNavLink[] {
	return normalizeLinkItems(appearance.heroActions, DEFAULT_HERO_ACTIONS);
}

export async function getSiteAppearance(db: Database): Promise<SiteAppearance> {
	const [row] = await db
		.select({
			backgroundImageKey: siteAppearanceSettings.backgroundImageKey,
			backgroundBlur: siteAppearanceSettings.backgroundBlur,
			backgroundScale: siteAppearanceSettings.backgroundScale,
			backgroundPositionX: siteAppearanceSettings.backgroundPositionX,
			backgroundPositionY: siteAppearanceSettings.backgroundPositionY,
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
			heroPrimaryLabel: siteAppearanceSettings.heroPrimaryLabel,
			heroPrimaryHref: siteAppearanceSettings.heroPrimaryHref,
			heroSecondaryLabel: siteAppearanceSettings.heroSecondaryLabel,
			heroSecondaryHref: siteAppearanceSettings.heroSecondaryHref,
			heroActionsJson: siteAppearanceSettings.heroActionsJson,
			heroSignalLabel: siteAppearanceSettings.heroSignalLabel,
			heroSignalHeading: siteAppearanceSettings.heroSignalHeading,
			heroSignalCopy: siteAppearanceSettings.heroSignalCopy,
			heroTopicText: siteAppearanceSettings.heroTopicText,
			heroWritingText: siteAppearanceSettings.heroWritingText,
		})
		.from(siteAppearanceSettings)
		.where(eq(siteAppearanceSettings.id, 1))
		.limit(1);

	if (!row) {
		return DEFAULT_SITE_APPEARANCE;
	}

	return normalizeSiteAppearanceInput(row);
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
			backgroundBlur: normalized.backgroundBlur,
			backgroundScale: normalized.backgroundScale,
			backgroundPositionX: normalized.backgroundPositionX,
			backgroundPositionY: normalized.backgroundPositionY,
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
			heroPrimaryLabel: normalized.heroPrimaryLabel,
			heroPrimaryHref: normalized.heroPrimaryHref,
			heroSecondaryLabel: normalized.heroSecondaryLabel,
			heroSecondaryHref: normalized.heroSecondaryHref,
			heroActionsJson,
			heroSignalLabel: normalized.heroSignalLabel,
			heroSignalHeading: normalized.heroSignalHeading,
			heroSignalCopy: normalized.heroSignalCopy,
			heroTopicText: normalized.heroTopicText,
			heroWritingText: normalized.heroWritingText,
		})
		.onConflictDoUpdate({
			target: siteAppearanceSettings.id,
			set: {
				backgroundImageKey: normalized.backgroundImageKey,
				backgroundBlur: normalized.backgroundBlur,
				backgroundScale: normalized.backgroundScale,
				backgroundPositionX: normalized.backgroundPositionX,
				backgroundPositionY: normalized.backgroundPositionY,
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
				heroPrimaryLabel: normalized.heroPrimaryLabel,
				heroPrimaryHref: normalized.heroPrimaryHref,
				heroSecondaryLabel: normalized.heroSecondaryLabel,
				heroSecondaryHref: normalized.heroSecondaryHref,
				heroActionsJson,
				heroSignalLabel: normalized.heroSignalLabel,
				heroSignalHeading: normalized.heroSignalHeading,
				heroSignalCopy: normalized.heroSignalCopy,
				heroTopicText: normalized.heroTopicText,
				heroWritingText: normalized.heroWritingText,
			},
		});

	return normalized;
}

export function buildBackgroundImageUrl(key: string | null) {
	return key ? `/media/${key}` : null;
}
