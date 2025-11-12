DROP INDEX `versions_app_id_idx`;--> statement-breakpoint
DROP INDEX `versions_status_idx`;--> statement-breakpoint
DROP INDEX `versions_version_idx`;--> statement-breakpoint
DROP INDEX `versions_app_version_unique`;--> statement-breakpoint
ALTER TABLE `versions` ADD `build` text NOT NULL;--> statement-breakpoint
ALTER TABLE `versions` ADD `runtime_version` text NOT NULL;