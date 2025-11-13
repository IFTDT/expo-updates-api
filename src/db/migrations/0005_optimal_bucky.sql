ALTER TABLE `apps` ADD `current_version_id` text;--> statement-breakpoint
CREATE INDEX `apps_current_version_id_idx` ON `apps` (`current_version_id`);