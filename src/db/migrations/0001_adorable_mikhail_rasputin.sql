DROP INDEX `versions_status_idx` ON `versions`;--> statement-breakpoint
ALTER TABLE `versions` DROP COLUMN `status`;--> statement-breakpoint
ALTER TABLE `versions` DROP COLUMN `published_at`;--> statement-breakpoint
ALTER TABLE `versions` DROP COLUMN `rolled_back_at`;