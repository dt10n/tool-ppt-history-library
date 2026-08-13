CREATE TABLE `page_tags` (
	`page_id` text NOT NULL,
	`tag_path` text NOT NULL,
	PRIMARY KEY(`page_id`, `tag_path`)
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`episode_label` text DEFAULT '' NOT NULL,
	`page_number` integer,
	`source_group` text NOT NULL,
	`source_label` text NOT NULL,
	`image_key` text NOT NULL,
	`ocr_text` text DEFAULT '' NOT NULL,
	`search_text` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `taxonomy` (
	`path` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`parent_path` text DEFAULT '' NOT NULL,
	`depth` integer NOT NULL
);
