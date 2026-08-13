CREATE INDEX `idx_page_tags_path_page` ON `page_tags` (`tag_path`,`page_id`);--> statement-breakpoint
CREATE INDEX `idx_pages_episode_page` ON `pages` (`episode_label`,`page_number`);--> statement-breakpoint
CREATE INDEX `idx_taxonomy_parent` ON `taxonomy` (`parent_path`);