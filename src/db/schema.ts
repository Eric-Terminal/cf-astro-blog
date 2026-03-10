import { sql } from "drizzle-orm";
import {
	type AnySQLiteColumn,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ─── 文章分类 ────────────────────────────────────────────────────────────────

export const blogCategories = sqliteTable("blog_categories", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	description: text("description"),
	parentId: integer("parent_id").references(
		(): AnySQLiteColumn => blogCategories.id,
	),
	createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
	updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── 文章标签 ────────────────────────────────────────────────────────────────

export const blogTags = sqliteTable("blog_tags", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── 文章内容 ────────────────────────────────────────────────────────────────

export const blogPosts = sqliteTable(
	"blog_posts",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		title: text("title").notNull(),
		slug: text("slug").notNull().unique(),
		content: text("content").notNull(),
		excerpt: text("excerpt"),
		status: text("status").notNull().default("draft"),
		publishAt: text("publish_at"),
		publishedAt: text("published_at"),
		featuredImageKey: text("featured_image_key"),
		featuredImageAlt: text("featured_image_alt"),
		isPinned: integer("is_pinned", { mode: "boolean" })
			.notNull()
			.default(false),
		pinnedOrder: integer("pinned_order").notNull().default(100),
		metaTitle: text("meta_title"),
		metaDescription: text("meta_description"),
		metaKeywords: text("meta_keywords"),
		canonicalUrl: text("canonical_url"),
		categoryId: integer("category_id").references(() => blogCategories.id),
		authorName: text("author_name").default("Admin"),
		viewCount: integer("view_count").default(0),
		createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
		updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
	},
	(table) => [
		index("posts_slug_idx").on(table.slug),
		index("posts_status_publish_idx").on(table.status, table.publishAt),
		index("posts_pinned_order_idx").on(
			table.isPinned,
			table.pinnedOrder,
			table.publishedAt,
		),
	],
);

// ─── 文章标签关联 ────────────────────────────────────────────────────────────

export const blogPostTags = sqliteTable(
	"blog_post_tags",
	{
		postId: integer("post_id")
			.notNull()
			.references(() => blogPosts.id, { onDelete: "cascade" }),
		tagId: integer("tag_id")
			.notNull()
			.references(() => blogTags.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.postId, table.tagId] })],
);

// ─── 友链申请与展示 ───────────────────────────────────────────────────────────

export const friendLinks = sqliteTable(
	"friend_links",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		name: text("name").notNull(),
		siteUrl: text("site_url").notNull().unique(),
		avatarUrl: text("avatar_url"),
		description: text("description").notNull(),
		contact: text("contact").notNull(),
		note: text("note"),
		status: text("status").notNull().default("pending"),
		reviewNote: text("review_note"),
		reviewedAt: text("reviewed_at"),
		createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
		updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
	},
	(table) => [index("friend_links_status_idx").on(table.status)],
);

// ─── Webmention 提及与审核 ──────────────────────────────────────────────────

export const webMentions = sqliteTable(
	"web_mentions",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		sourceUrl: text("source_url").notNull(),
		targetUrl: text("target_url").notNull(),
		sourceTitle: text("source_title"),
		sourceExcerpt: text("source_excerpt"),
		sourceAuthor: text("source_author"),
		sourcePublishedAt: text("source_published_at"),
		status: text("status").notNull().default("pending"),
		reviewNote: text("review_note"),
		reviewedAt: text("reviewed_at"),
		lastCheckedAt: text("last_checked_at"),
		createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
		updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
	},
	(table) => [
		index("web_mentions_status_idx").on(table.status, table.createdAt),
		uniqueIndex("web_mentions_source_target_unique").on(
			table.sourceUrl,
			table.targetUrl,
		),
	],
);

// ─── 站点外观设置 ────────────────────────────────────────────────────────────

export const siteAppearanceSettings = sqliteTable("site_appearance_settings", {
	id: integer("id").primaryKey(),
	backgroundImageKey: text("background_image_key"),
	backgroundBlur: integer("background_blur").notNull().default(24),
	backgroundScale: integer("background_scale").notNull().default(112),
	backgroundPositionX: integer("background_position_x").notNull().default(50),
	backgroundPositionY: integer("background_position_y").notNull().default(50),
	heroCardOpacity: integer("hero_card_opacity").notNull().default(14),
	heroCardBlur: integer("hero_card_blur").notNull().default(18),
	postCardOpacity: integer("post_card_opacity").notNull().default(14),
	postCardBlur: integer("post_card_blur").notNull().default(18),
	headerSubtitle: text("header_subtitle")
		.notNull()
		.default("流畅、克制、持续更新的技术写作"),
	navLink1Label: text("nav_link_1_label").notNull().default("首页"),
	navLink1Href: text("nav_link_1_href").notNull().default("/"),
	navLink2Label: text("nav_link_2_label").notNull().default("归档"),
	navLink2Href: text("nav_link_2_href").notNull().default("/blog"),
	navLink3Label: text("nav_link_3_label").notNull().default("搜索"),
	navLink3Href: text("nav_link_3_href").notNull().default("/search"),
	navLinksJson: text("nav_links_json"),
	heroKicker: text("hero_kicker").notNull().default("云端记录"),
	heroTitle: text("hero_title")
		.notNull()
		.default("把工程判断写清楚，把技术细节写漂亮。"),
	heroIntro: text("hero_intro")
		.notNull()
		.default(
			"这里记录 Cloudflare、前端工程、调试过程和系统设计里那些值得反复回看的瞬间。界面会继续打磨，但内容先要足够清晰、足够耐读。",
		),
	heroMainImagePath: text("hero_main_image_path"),
	heroPrimaryLabel: text("hero_primary_label").notNull().default("进入归档"),
	heroPrimaryHref: text("hero_primary_href").notNull().default("/blog"),
	heroSecondaryLabel: text("hero_secondary_label")
		.notNull()
		.default("站内搜索"),
	heroSecondaryHref: text("hero_secondary_href").notNull().default("/search"),
	heroActionsJson: text("hero_actions_json"),
	heroSignalLabel: text("hero_signal_label").notNull().default("Scene Depth"),
	heroSignalHeading: text("hero_signal_heading")
		.notNull()
		.default("首页会跟着你的视线轻轻转一下"),
	heroSignalCopy: text("hero_signal_copy")
		.notNull()
		.default(
			"不是把页面做得很吵，而是只让首屏层次、信息胶囊和按钮反馈更有呼吸感。",
		),
	heroSignalImagePath: text("hero_signal_image_path"),
	heroSignalChip1: text("hero_signal_chip_1").notNull().default("Mouse Sync"),
	heroSignalChip2: text("hero_signal_chip_2").notNull().default("Soft Orbit"),
	heroSignalChip3: text("hero_signal_chip_3").notNull().default("Card Lift"),
	articleSidebarAvatarPath: text("article_sidebar_avatar_path"),
	articleSidebarName: text("article_sidebar_name")
		.notNull()
		.default("Eric-Terminal"),
	articleSidebarBio: text("article_sidebar_bio")
		.notNull()
		.default("在比特海里未雨绸缪，身后养着一只叫晖的狐狸。"),
	articleSidebarBadge: text("article_sidebar_badge")
		.notNull()
		.default("文章作者"),
	updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── 统计会话 ────────────────────────────────────────────────────────────────

export const analyticsSessions = sqliteTable("analytics_sessions", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	sessionId: text("session_id").notNull().unique(),
	ipAddress: text("ip_address"),
	ipHash: text("ip_hash"),
	country: text("country"),
	region: text("region"),
	city: text("city"),
	userAgent: text("user_agent"),
	browser: text("browser"),
	os: text("os"),
	deviceType: text("device_type"),
	referrer: text("referrer"),
	utmSource: text("utm_source"),
	utmMedium: text("utm_medium"),
	utmCampaign: text("utm_campaign"),
	landingPage: text("landing_page"),
	startedAt: text("started_at").notNull().default(sql`(datetime('now'))`),
	lastSeenAt: text("last_seen_at").notNull().default(sql`(datetime('now'))`),
});

// ─── 统计事件 ────────────────────────────────────────────────────────────────

export const analyticsEvents = sqliteTable("analytics_events", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	sessionId: text("session_id").notNull(),
	eventType: text("event_type").notNull(),
	eventName: text("event_name"),
	pageUrl: text("page_url"),
	pageTitle: text("page_title"),
	eventData: text("event_data"),
	scrollDepth: integer("scroll_depth"),
	timeOnPageSeconds: integer("time_on_page_seconds"),
	timestamp: text("timestamp").notNull().default(sql`(datetime('now'))`),
});

// ─── 登录尝试记录 ────────────────────────────────────────────────────────────

export const loginAttempts = sqliteTable("login_attempts", {
	ipAddress: text("ip_address").primaryKey(),
	attempts: integer("attempts").notNull().default(0),
	lockedUntil: text("locked_until"),
	lastAttempt: text("last_attempt"),
});

// ─── 类型导出 ────────────────────────────────────────────────────────────────

export type BlogCategory = typeof blogCategories.$inferSelect;
export type NewBlogCategory = typeof blogCategories.$inferInsert;

export type BlogTag = typeof blogTags.$inferSelect;
export type NewBlogTag = typeof blogTags.$inferInsert;

export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;

export type FriendLink = typeof friendLinks.$inferSelect;
export type NewFriendLink = typeof friendLinks.$inferInsert;

export type WebMention = typeof webMentions.$inferSelect;
export type NewWebMention = typeof webMentions.$inferInsert;

export type SiteAppearanceSetting = typeof siteAppearanceSettings.$inferSelect;
export type NewSiteAppearanceSetting =
	typeof siteAppearanceSettings.$inferInsert;

export type AnalyticsSession = typeof analyticsSessions.$inferSelect;
export type NewAnalyticsSession = typeof analyticsSessions.$inferInsert;

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;

export type LoginAttempt = typeof loginAttempts.$inferSelect;
