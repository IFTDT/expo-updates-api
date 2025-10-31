CREATE TABLE `app_users` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`device_id` text NOT NULL,
	`user_id` text,
	`current_version` text,
	`last_update_at` integer,
	`device_info` text,
	`status` text DEFAULT 'online' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `app_users_app_id_idx` ON `app_users` (`app_id`);--> statement-breakpoint
CREATE INDEX `app_users_device_id_idx` ON `app_users` (`device_id`);--> statement-breakpoint
CREATE INDEX `app_users_status_idx` ON `app_users` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_app_device_unique` ON `app_users` (`app_id`,`device_id`);--> statement-breakpoint
CREATE TABLE `apps` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`app_id` text NOT NULL,
	`icon` text,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`current_version` text,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `apps_appId_unique` ON `apps` (`app_id`);--> statement-breakpoint
CREATE INDEX `apps_app_id_idx` ON `apps` (`app_id`);--> statement-breakpoint
CREATE INDEX `apps_owner_id_idx` ON `apps` (`owner_id`);--> statement-breakpoint
CREATE INDEX `apps_status_idx` ON `apps` (`status`);--> statement-breakpoint
CREATE TABLE `operation_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text,
	`type` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text,
	`target_type` text,
	`status` text DEFAULT 'success' NOT NULL,
	`details` text,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `operation_logs_app_id_idx` ON `operation_logs` (`app_id`);--> statement-breakpoint
CREATE INDEX `operation_logs_user_id_idx` ON `operation_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `operation_logs_type_idx` ON `operation_logs` (`type`);--> statement-breakpoint
CREATE INDEX `operation_logs_status_idx` ON `operation_logs` (`status`);--> statement-breakpoint
CREATE INDEX `operation_logs_created_at_idx` ON `operation_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `update_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`version_id` text NOT NULL,
	`type` text DEFAULT 'full' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`scheduled_at` integer,
	`started_at` integer,
	`completed_at` integer,
	`success_count` integer DEFAULT 0,
	`failure_count` integer DEFAULT 0,
	`progress` integer DEFAULT 0,
	`target_user_ids` text,
	`target_group_ids` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`version_id`) REFERENCES `versions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `update_tasks_app_id_idx` ON `update_tasks` (`app_id`);--> statement-breakpoint
CREATE INDEX `update_tasks_version_id_idx` ON `update_tasks` (`version_id`);--> statement-breakpoint
CREATE INDEX `update_tasks_status_idx` ON `update_tasks` (`status`);--> statement-breakpoint
CREATE INDEX `update_tasks_created_by_idx` ON `update_tasks` (`created_by`);--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text,
	`file_url` text NOT NULL,
	`file_size` integer NOT NULL,
	`checksum` text NOT NULL,
	`status` text DEFAULT 'uploading' NOT NULL,
	`progress` integer DEFAULT 0,
	`uploaded_bytes` integer DEFAULT 0,
	`total_bytes` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `uploads_app_id_idx` ON `uploads` (`app_id`);--> statement-breakpoint
CREATE INDEX `uploads_status_idx` ON `uploads` (`status`);--> statement-breakpoint
CREATE INDEX `uploads_uploaded_by_idx` ON `uploads` (`uploaded_by`);--> statement-breakpoint
CREATE TABLE `user_apps` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`app_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_apps_user_id_idx` ON `user_apps` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_apps_app_id_idx` ON `user_apps` (`app_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_apps_user_app_unique` ON `user_apps` (`user_id`,`app_id`);--> statement-breakpoint
CREATE TABLE `user_group_members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`app_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `user_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`app_user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_group_members_group_id_idx` ON `user_group_members` (`group_id`);--> statement-breakpoint
CREATE INDEX `user_group_members_app_user_id_idx` ON `user_group_members` (`app_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_group_members_group_user_unique` ON `user_group_members` (`group_id`,`app_user_id`);--> statement-breakpoint
CREATE TABLE `user_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_groups_app_id_idx` ON `user_groups` (`app_id`);--> statement-breakpoint
CREATE INDEX `user_groups_name_idx` ON `user_groups` (`name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` text DEFAULT 'app_manager' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`avatar` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `versions` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`version` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`file_url` text NOT NULL,
	`file_size` integer NOT NULL,
	`checksum` text NOT NULL,
	`is_mandatory` integer DEFAULT false NOT NULL,
	`published_at` integer,
	`rolled_back_at` integer,
	`published_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`published_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `versions_app_id_idx` ON `versions` (`app_id`);--> statement-breakpoint
CREATE INDEX `versions_status_idx` ON `versions` (`status`);--> statement-breakpoint
CREATE INDEX `versions_version_idx` ON `versions` (`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `versions_app_version_unique` ON `versions` (`app_id`,`version`);