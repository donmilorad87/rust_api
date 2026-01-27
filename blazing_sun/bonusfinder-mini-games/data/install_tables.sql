CREATE TABLE IF NOT EXISTS `bonusfinder_mini_games__user_credits` (
	`id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
	`user_id` BIGINT(20) UNSIGNED NOT NULL,
	`credits` DECIMAL(12,2) NOT NULL DEFAULT 1000.00,
	`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`),
	UNIQUE KEY `uniq_user` (`user_id`),
	CONSTRAINT `fk_bonusfinder_minigames_user`
		FOREIGN KEY (`user_id`) REFERENCES `bf_users` (`ID`) ON DELETE CASCADE
);
/**/
CREATE TABLE IF NOT EXISTS `bonusfinder_mini_games__history` (
	`id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
	`user_id` BIGINT(20) UNSIGNED NOT NULL,
	`event_type` VARCHAR(20) NOT NULL DEFAULT 'game',
	`result_number` VARCHAR(3) NOT NULL,
	`result_color` VARCHAR(10) NOT NULL,
	`result_parity` VARCHAR(10) NOT NULL,
	`total_stake` DECIMAL(12,2) NOT NULL DEFAULT 0,
	`payout` DECIMAL(12,2) NOT NULL DEFAULT 0,
	`bets_json` JSON NOT NULL,
	`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`),
	KEY `idx_history_user_created` (`user_id`, `created_at`),
	CONSTRAINT `fk_minigames_history_user`
		FOREIGN KEY (`user_id`) REFERENCES `bf_users` (`ID`) ON DELETE CASCADE
);

