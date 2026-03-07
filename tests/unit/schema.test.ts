import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	analyticsEvents,
	analyticsSessions,
	blogCategories,
	blogPosts,
	blogPostTags,
	blogTags,
	loginAttempts,
	siteAppearanceSettings,
} from "../../src/db/schema";

describe("数据库结构喵", () => {
	test("blogPosts 表包含必要字段喵", () => {
		const columns = Object.keys(blogPosts);
		assert.ok(columns.includes("id"));
		assert.ok(columns.includes("title"));
		assert.ok(columns.includes("slug"));
		assert.ok(columns.includes("content"));
		assert.ok(columns.includes("status"));
		assert.ok(columns.includes("excerpt"));
		assert.ok(columns.includes("publishedAt"));
		assert.ok(columns.includes("featuredImageKey"));
		assert.ok(columns.includes("metaTitle"));
		assert.ok(columns.includes("metaDescription"));
		assert.ok(columns.includes("categoryId"));
		assert.ok(columns.includes("authorName"));
		assert.ok(columns.includes("viewCount"));
		assert.ok(columns.includes("createdAt"));
		assert.ok(columns.includes("updatedAt"));
	});

	test("blogCategories 表包含必要字段喵", () => {
		const columns = Object.keys(blogCategories);
		assert.ok(columns.includes("id"));
		assert.ok(columns.includes("name"));
		assert.ok(columns.includes("slug"));
		assert.ok(columns.includes("description"));
		assert.ok(columns.includes("parentId"));
	});

	test("blogTags 表包含必要字段喵", () => {
		const columns = Object.keys(blogTags);
		assert.ok(columns.includes("id"));
		assert.ok(columns.includes("name"));
		assert.ok(columns.includes("slug"));
	});

	test("blogPostTags 关联表包含必要字段喵", () => {
		const columns = Object.keys(blogPostTags);
		assert.ok(columns.includes("postId"));
		assert.ok(columns.includes("tagId"));
	});

	test("analyticsSessions 表包含必要字段喵", () => {
		const columns = Object.keys(analyticsSessions);
		assert.ok(columns.includes("sessionId"));
		assert.ok(columns.includes("ipHash"));
		assert.ok(columns.includes("country"));
		assert.ok(columns.includes("browser"));
		assert.ok(columns.includes("deviceType"));
		assert.ok(columns.includes("referrer"));
		assert.ok(columns.includes("utmSource"));
	});

	test("analyticsEvents 表包含必要字段喵", () => {
		const columns = Object.keys(analyticsEvents);
		assert.ok(columns.includes("sessionId"));
		assert.ok(columns.includes("eventType"));
		assert.ok(columns.includes("pageUrl"));
		assert.ok(columns.includes("eventData"));
		assert.ok(columns.includes("scrollDepth"));
	});

	test("loginAttempts 表包含必要字段喵", () => {
		const columns = Object.keys(loginAttempts);
		assert.ok(columns.includes("ipAddress"));
		assert.ok(columns.includes("attempts"));
		assert.ok(columns.includes("lockedUntil"));
	});

	test("siteAppearanceSettings 表包含必要字段喵", () => {
		const columns = Object.keys(siteAppearanceSettings);
		assert.ok(columns.includes("backgroundImageKey"));
		assert.ok(columns.includes("backgroundBlur"));
		assert.ok(columns.includes("backgroundScale"));
		assert.ok(columns.includes("backgroundPositionX"));
		assert.ok(columns.includes("backgroundPositionY"));
		assert.ok(columns.includes("headerSubtitle"));
		assert.ok(columns.includes("navLink1Label"));
		assert.ok(columns.includes("navLink1Href"));
		assert.ok(columns.includes("navLink2Label"));
		assert.ok(columns.includes("navLink2Href"));
		assert.ok(columns.includes("navLink3Label"));
		assert.ok(columns.includes("navLink3Href"));
		assert.ok(columns.includes("navLinksJson"));
		assert.ok(columns.includes("heroKicker"));
		assert.ok(columns.includes("heroTitle"));
		assert.ok(columns.includes("heroIntro"));
		assert.ok(columns.includes("heroLandscapeImagePath"));
		assert.ok(columns.includes("heroPortraitImagePath"));
		assert.ok(columns.includes("heroPrimaryLabel"));
		assert.ok(columns.includes("heroPrimaryHref"));
		assert.ok(columns.includes("heroSecondaryLabel"));
		assert.ok(columns.includes("heroSecondaryHref"));
		assert.ok(columns.includes("heroActionsJson"));
		assert.ok(columns.includes("heroSignalLabel"));
		assert.ok(columns.includes("heroSignalHeading"));
		assert.ok(columns.includes("heroSignalCopy"));
		assert.ok(columns.includes("heroTopicText"));
		assert.ok(columns.includes("heroWritingText"));
	});
});
