CREATE TABLE `web_mentions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_url` text NOT NULL,
	`target_url` text NOT NULL,
	`source_title` text,
	`source_excerpt` text,
	`source_author` text,
	`source_published_at` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text,
	`reviewed_at` text,
	`last_checked_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `web_mentions_source_target_unique`
	ON `web_mentions` (`source_url`, `target_url`);
--> statement-breakpoint
CREATE INDEX `web_mentions_status_idx`
	ON `web_mentions` (`status`, `created_at`);
