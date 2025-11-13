ALTER TABLE `app_users` ADD `target_version_id` text REFERENCES versions(id);--> statement-breakpoint
CREATE INDEX `app_users_target_version_id_idx` ON `app_users` (`target_version_id`);--> statement-breakpoint
ALTER TABLE `apps` ADD `current_version_id` text REFERENCES versions(id);--> statement-breakpoint
CREATE INDEX `apps_current_version_id_idx` ON `apps` (`current_version_id`);--> statement-breakpoint
ALTER TABLE `user_groups` ADD `target_version_id` text REFERENCES versions(id);--> statement-breakpoint
CREATE INDEX `user_groups_target_version_id_idx` ON `user_groups` (`target_version_id`);--> statement-breakpoint
CREATE INDEX `versions_app_id_idx` ON `versions` (`app_id`);--> statement-breakpoint
CREATE INDEX `versions_status_idx` ON `versions` (`status`);--> statement-breakpoint
CREATE INDEX `versions_version_idx` ON `versions` (`version`);--> statement-breakpoint
CREATE INDEX `versions_build_idx` ON `versions` (`build`);--> statement-breakpoint
CREATE UNIQUE INDEX `versions_app_build_unique` ON `versions` (`app_id`,`build`);