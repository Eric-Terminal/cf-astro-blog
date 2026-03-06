import { and, eq, like, or } from "drizzle-orm";
import { blogPosts } from "@/db/schema";

export const PUBLIC_POST_STATUS = "published";

export function getPublicPostVisibilityCondition() {
	return eq(blogPosts.status, PUBLIC_POST_STATUS);
}

export function getPublicPostBySlugCondition(slug: string) {
	return and(eq(blogPosts.slug, slug), getPublicPostVisibilityCondition());
}

export function getPublicPostSearchCondition(pattern: string) {
	return and(
		getPublicPostVisibilityCondition(),
		or(
			like(blogPosts.title, pattern),
			like(blogPosts.content, pattern),
			like(blogPosts.excerpt, pattern),
		),
	);
}
