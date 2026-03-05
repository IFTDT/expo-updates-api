CREATE TABLE `app_users` (
	`id` varchar(36) NOT NULL,
	`app_id` varchar(36) NOT NULL,
	`device_id` varchar(255) NOT NULL,
	`user_id` varchar(36),
	`platform` varchar(50),
	`current_version_id` varchar(36),
	`target_version_id` varchar(36),
	`last_update_at` datetime,
	`device_info` text,
	`status` varchar(50) NOT NULL DEFAULT 'online',
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_users_app_device_unique` UNIQUE(`app_id`,`device_id`)
);
--> statement-breakpoint
CREATE TABLE `apps` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`app_id` varchar(255) NOT NULL,
	`icon` text,
	`description` text,
	`status` varchar(50) NOT NULL DEFAULT 'active',
	`current_version` varchar(50),
	`current_version_id` varchar(36),
	`owner_id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `apps_id` PRIMARY KEY(`id`),
	CONSTRAINT `apps_app_id_unique` UNIQUE(`app_id`)
);
--> statement-breakpoint
CREATE TABLE `operation_logs` (
	`id` varchar(36) NOT NULL,
	`app_id` varchar(36),
	`type` varchar(50) NOT NULL,
	`action` varchar(255) NOT NULL,
	`target_id` varchar(36),
	`target_type` varchar(50),
	`status` varchar(50) NOT NULL DEFAULT 'success',
	`details` text,
	`user_id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `operation_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(500) NOT NULL,
	`done` boolean NOT NULL DEFAULT false,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `update_tasks` (
	`id` varchar(36) NOT NULL,
	`app_id` varchar(36) NOT NULL,
	`version_id` varchar(36) NOT NULL,
	`type` varchar(50) NOT NULL DEFAULT 'full',
	`status` varchar(50) NOT NULL DEFAULT 'pending',
	`scheduled_at` datetime,
	`started_at` datetime,
	`completed_at` datetime,
	`success_count` int DEFAULT 0,
	`failure_count` int DEFAULT 0,
	`progress` int DEFAULT 0,
	`target_user_ids` text,
	`target_group_ids` text,
	`success_user_ids` text,
	`failure_user_ids` text,
	`created_by` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `update_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` varchar(36) NOT NULL,
	`app_id` varchar(36),
	`file_url` text NOT NULL,
	`file_size` int NOT NULL,
	`checksum` varchar(255) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'uploading',
	`progress` int DEFAULT 0,
	`uploaded_bytes` int DEFAULT 0,
	`total_bytes` int NOT NULL,
	`uploaded_by` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `uploads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_apps` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`app_id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `user_apps_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_apps_user_app_unique` UNIQUE(`user_id`,`app_id`)
);
--> statement-breakpoint
CREATE TABLE `user_group_members` (
	`id` varchar(36) NOT NULL,
	`group_id` varchar(36) NOT NULL,
	`app_user_id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `user_group_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_group_members_group_user_unique` UNIQUE(`group_id`,`app_user_id`)
);
--> statement-breakpoint
CREATE TABLE `user_groups` (
	`id` varchar(36) NOT NULL,
	`app_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`target_version_id` varchar(36),
	`created_by` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password` varchar(255) NOT NULL,
	`role` varchar(50) NOT NULL DEFAULT 'app_manager',
	`status` varchar(50) NOT NULL DEFAULT 'active',
	`avatar` text,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`last_login_at` datetime,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `versions` (
	`id` varchar(36) NOT NULL,
	`app_id` varchar(36) NOT NULL,
	`version` varchar(50) NOT NULL,
	`build` varchar(50) NOT NULL,
	`runtime_version` varchar(50) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`status` varchar(50) NOT NULL DEFAULT 'draft',
	`file_url` text NOT NULL,
	`file_size` int NOT NULL,
	`checksum` varchar(255) NOT NULL,
	`is_mandatory` boolean NOT NULL DEFAULT false,
	`published_at` datetime,
	`rolled_back_at` datetime,
	`published_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `versions_app_build_unique` UNIQUE(`app_id`,`build`)
);
--> statement-breakpoint
ALTER TABLE `app_users` ADD CONSTRAINT `app_users_app_id_apps_id_fk` FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `app_users` ADD CONSTRAINT `app_users_current_version_id_versions_id_fk` FOREIGN KEY (`current_version_id`) REFERENCES `versions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `app_users` ADD CONSTRAINT `app_users_target_version_id_versions_id_fk` FOREIGN KEY (`target_version_id`) REFERENCES `versions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `apps` ADD CONSTRAINT `apps_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operation_logs` ADD CONSTRAINT `operation_logs_app_id_apps_id_fk` FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operation_logs` ADD CONSTRAINT `operation_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `update_tasks` ADD CONSTRAINT `update_tasks_app_id_apps_id_fk` FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `update_tasks` ADD CONSTRAINT `update_tasks_version_id_versions_id_fk` FOREIGN KEY (`version_id`) REFERENCES `versions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `update_tasks` ADD CONSTRAINT `update_tasks_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `uploads` ADD CONSTRAINT `uploads_app_id_apps_id_fk` FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `uploads` ADD CONSTRAINT `uploads_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_apps` ADD CONSTRAINT `user_apps_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_apps` ADD CONSTRAINT `user_apps_app_id_apps_id_fk` FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_group_members` ADD CONSTRAINT `user_group_members_group_id_user_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `user_groups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_group_members` ADD CONSTRAINT `user_group_members_app_user_id_app_users_id_fk` FOREIGN KEY (`app_user_id`) REFERENCES `app_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_groups` ADD CONSTRAINT `user_groups_app_id_apps_id_fk` FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_groups` ADD CONSTRAINT `user_groups_target_version_id_versions_id_fk` FOREIGN KEY (`target_version_id`) REFERENCES `versions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_groups` ADD CONSTRAINT `user_groups_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `versions` ADD CONSTRAINT `versions_app_id_apps_id_fk` FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `versions` ADD CONSTRAINT `versions_published_by_users_id_fk` FOREIGN KEY (`published_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `app_users_app_id_idx` ON `app_users` (`app_id`);--> statement-breakpoint
CREATE INDEX `app_users_device_id_idx` ON `app_users` (`device_id`);--> statement-breakpoint
CREATE INDEX `app_users_status_idx` ON `app_users` (`status`);--> statement-breakpoint
CREATE INDEX `app_users_current_version_id_idx` ON `app_users` (`current_version_id`);--> statement-breakpoint
CREATE INDEX `app_users_target_version_id_idx` ON `app_users` (`target_version_id`);--> statement-breakpoint
CREATE INDEX `apps_app_id_idx` ON `apps` (`app_id`);--> statement-breakpoint
CREATE INDEX `apps_owner_id_idx` ON `apps` (`owner_id`);--> statement-breakpoint
CREATE INDEX `apps_status_idx` ON `apps` (`status`);--> statement-breakpoint
CREATE INDEX `apps_current_version_id_idx` ON `apps` (`current_version_id`);--> statement-breakpoint
CREATE INDEX `operation_logs_app_id_idx` ON `operation_logs` (`app_id`);--> statement-breakpoint
CREATE INDEX `operation_logs_user_id_idx` ON `operation_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `operation_logs_type_idx` ON `operation_logs` (`type`);--> statement-breakpoint
CREATE INDEX `operation_logs_status_idx` ON `operation_logs` (`status`);--> statement-breakpoint
CREATE INDEX `operation_logs_created_at_idx` ON `operation_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `update_tasks_app_id_idx` ON `update_tasks` (`app_id`);--> statement-breakpoint
CREATE INDEX `update_tasks_version_id_idx` ON `update_tasks` (`version_id`);--> statement-breakpoint
CREATE INDEX `update_tasks_status_idx` ON `update_tasks` (`status`);--> statement-breakpoint
CREATE INDEX `update_tasks_created_by_idx` ON `update_tasks` (`created_by`);--> statement-breakpoint
CREATE INDEX `uploads_app_id_idx` ON `uploads` (`app_id`);--> statement-breakpoint
CREATE INDEX `uploads_status_idx` ON `uploads` (`status`);--> statement-breakpoint
CREATE INDEX `uploads_uploaded_by_idx` ON `uploads` (`uploaded_by`);--> statement-breakpoint
CREATE INDEX `user_apps_user_id_idx` ON `user_apps` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_apps_app_id_idx` ON `user_apps` (`app_id`);--> statement-breakpoint
CREATE INDEX `user_group_members_group_id_idx` ON `user_group_members` (`group_id`);--> statement-breakpoint
CREATE INDEX `user_group_members_app_user_id_idx` ON `user_group_members` (`app_user_id`);--> statement-breakpoint
CREATE INDEX `user_groups_app_id_idx` ON `user_groups` (`app_id`);--> statement-breakpoint
CREATE INDEX `user_groups_name_idx` ON `user_groups` (`name`);--> statement-breakpoint
CREATE INDEX `user_groups_target_version_id_idx` ON `user_groups` (`target_version_id`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `versions_app_id_idx` ON `versions` (`app_id`);--> statement-breakpoint
CREATE INDEX `versions_status_idx` ON `versions` (`status`);--> statement-breakpoint
CREATE INDEX `versions_version_idx` ON `versions` (`version`);--> statement-breakpoint
CREATE INDEX `versions_build_idx` ON `versions` (`build`);