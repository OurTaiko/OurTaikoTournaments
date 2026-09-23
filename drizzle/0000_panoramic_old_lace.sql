CREATE TABLE `admins` (
	`username` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`issuer` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`body` text NOT NULL
);
