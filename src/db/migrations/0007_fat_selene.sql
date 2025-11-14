ALTER TABLE `app_users` RENAME COLUMN "current_version" TO "current_version_id";--> statement-breakpoint
CREATE INDEX `app_users_current_version_id_idx` ON `app_users` (`current_version_id`);--> statement-breakpoint
ALTER TABLE `app_users` ALTER COLUMN "current_version_id" TO "current_version_id" text REFERENCES versions(id) ON DELETE set null ON UPDATE no action;