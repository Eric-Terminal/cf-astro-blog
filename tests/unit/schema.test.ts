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
});
