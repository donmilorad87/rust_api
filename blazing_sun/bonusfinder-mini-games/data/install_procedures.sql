CREATE PROCEDURE IF NOT EXISTS `bonusfinder_mini_games__get_user_credits`(
	IN `pUserId` BIGINT(20) UNSIGNED
)
BEGIN
	INSERT INTO `bonusfinder_mini_games__user_credits` (`user_id`, `credits`)
	VALUES (`pUserId`, 1000.00)
	ON DUPLICATE KEY UPDATE `credits` = `credits`;

	SELECT `credits`
	FROM `bonusfinder_mini_games__user_credits`
	WHERE `user_id` = `pUserId`
	LIMIT 1;
END;
/**/

CREATE PROCEDURE IF NOT EXISTS `bonusfinder_mini_games__set_user_credits`(
	IN `pUserId` BIGINT(20) UNSIGNED,
	IN `pCredits` DECIMAL(12,2)
)
BEGIN
	INSERT INTO `bonusfinder_mini_games__user_credits` (`user_id`, `credits`)
	VALUES (`pUserId`, `pCredits`)
	ON DUPLICATE KEY UPDATE `credits` = `pCredits`;
END;
/**/

CREATE PROCEDURE IF NOT EXISTS `bonusfinder_mini_games__add_user_credits`(
	IN `pUserId` BIGINT(20) UNSIGNED,
	IN `pAmount` DECIMAL(12,2)
)
BEGIN
	INSERT INTO `bonusfinder_mini_games__user_credits` (`user_id`, `credits`)
	VALUES (`pUserId`, 1000.00)
	ON DUPLICATE KEY UPDATE `credits` = `credits`;

	UPDATE `bonusfinder_mini_games__user_credits`
	SET `credits` = `credits` + `pAmount`
	WHERE `user_id` = `pUserId`;
END;
/**/

CREATE PROCEDURE IF NOT EXISTS `bonusfinder_mini_games__deduct_user_credits`(
	IN `pUserId` BIGINT(20) UNSIGNED,
	IN `pAmount` DECIMAL(12,2)
)
BEGIN
	INSERT INTO `bonusfinder_mini_games__user_credits` (`user_id`, `credits`)
	VALUES (`pUserId`, 1000.00)
	ON DUPLICATE KEY UPDATE `credits` = `credits`;

	UPDATE `bonusfinder_mini_games__user_credits`
	SET `credits` = GREATEST(`credits` - `pAmount`, 0)
	WHERE `user_id` = `pUserId`;
END;
/**/

CREATE PROCEDURE IF NOT EXISTS `bonusfinder_mini_games__insert_history`(
	IN `pUserId` BIGINT(20) UNSIGNED,
	IN `pEventType` VARCHAR(20),
	IN `pResultNumber` VARCHAR(3),
	IN `pResultColor` VARCHAR(10),
	IN `pResultParity` VARCHAR(10),
	IN `pTotalStake` DECIMAL(12,2),
	IN `pPayout` DECIMAL(12,2),
	IN `pBetsJson` LONGTEXT
)
BEGIN
	INSERT INTO `bonusfinder_mini_games__history`
	(`user_id`,`event_type`,`result_number`,`result_color`,`result_parity`,`total_stake`,`payout`,`bets_json`)
	VALUES (`pUserId`, COALESCE(`pEventType`, 'game'), `pResultNumber`,`pResultColor`,`pResultParity`,`pTotalStake`,`pPayout`,JSON_EXTRACT(`pBetsJson`, '$'));
END;
/**/

CREATE PROCEDURE IF NOT EXISTS `bonusfinder_mini_games__get_history`(
	IN `pUserId` BIGINT(20) UNSIGNED,
	IN `pOffset` INT,
	IN `pLimit` INT
)
BEGIN
	SELECT h.*,
		(
			SELECT COUNT(*)
			FROM `bonusfinder_mini_games__history`
			WHERE `user_id` = `pUserId`
		) AS `total_rows`
	FROM `bonusfinder_mini_games__history` AS h
	WHERE h.`user_id` = `pUserId`
	ORDER BY h.`created_at` DESC, h.`id` DESC
	LIMIT `pOffset`, `pLimit`;
END;

