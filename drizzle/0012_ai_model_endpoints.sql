ALTER TABLE `site_appearance_settings` ADD `ai_internal_enabled` integer DEFAULT 0 NOT NULL;
ALTER TABLE `site_appearance_settings` ADD `ai_internal_base_url` text DEFAULT 'https://api.openai.com/v1' NOT NULL;
ALTER TABLE `site_appearance_settings` ADD `ai_internal_api_key` text DEFAULT '' NOT NULL;
ALTER TABLE `site_appearance_settings` ADD `ai_internal_model` text DEFAULT 'gpt-4o-mini' NOT NULL;
ALTER TABLE `site_appearance_settings` ADD `ai_public_enabled` integer DEFAULT 0 NOT NULL;
ALTER TABLE `site_appearance_settings` ADD `ai_public_base_url` text DEFAULT 'https://api.openai.com/v1' NOT NULL;
ALTER TABLE `site_appearance_settings` ADD `ai_public_api_key` text DEFAULT '' NOT NULL;
ALTER TABLE `site_appearance_settings` ADD `ai_public_model` text DEFAULT 'gpt-4o-mini' NOT NULL;
