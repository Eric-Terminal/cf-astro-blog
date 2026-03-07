import { sql } from "drizzle-orm";
import {
	type AnySQLiteColumn,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
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
	heroTopicText: text("hero_topic_text")
		.notNull()
		.default("Cloudflare · 前端工程 · 架构细节"),
	heroWritingText: text("hero_writing_text")
		.notNull()
		.default("慢一点，但尽量长期有效。"),
	updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── 统计会话 ────────────────────────────────────────────────────────────────

export const analyticsSessions = sqliteTable("analytics_sessions", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	sessionId: text("session_id").notNull().unique(),
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

export type SiteAppearanceSetting = typeof siteAppearanceSettings.$inferSelect;
export type NewSiteAppearanceSetting =
	typeof siteAppearanceSettings.$inferInsert;

export type AnalyticsSession = typeof analyticsSessions.$inferSelect;
export type NewAnalyticsSession = typeof analyticsSessions.$inferInsert;

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;

export type LoginAttempt = typeof loginAttempts.$inferSelect;
