<?php
/**
 * Plugin Name: Bonusfinder Mini Games
 * Plugin URI: https://www.gambling.com
 * Description: Provides mini games such as roulette for logged-in users.
 * Version: 1.0.0
 *
 * @package Bonusfinder\MiniGames
 */

use Bonusfinder\MiniGames\Controller\AdminMiniGames;

if ( ! defined( 'ABSPATH' ) ) {
	die();
}

if ( ! defined( 'BONUSFINDER_MINI_GAMES_FILE' ) ) {
	define( 'BONUSFINDER_MINI_GAMES_FILE', __FILE__ );
}

/**
 * Initialize Mini Games plugin..bf-mini-roulette
 *
 * @return void
 */
function bonusfinder_mini_games_init(): void {
	global $smarty, $bonusfinder_core, $wpdb;

	if ( ! isset( $bonusfinder_core ) ) {
		return;
	}

	$logger = $bonusfinder_core->get( 'logger' );

	new AdminMiniGames( $smarty, $wpdb, $logger );
}

if ( ! defined( 'WP_CLI' ) ) {
	add_action( 'plugins_loaded', 'bonusfinder_mini_games_init', 30 );
}

register_activation_hook( __FILE__, 'activate_bonusfinder_mini_games' );
register_uninstall_hook( __FILE__, 'uninstall_bonusfinder_mini_games' );

/**
 * Runs install SQL scripts.
 *
 * @return void
 */
function activate_bonusfinder_mini_games(): void {
	global $wpdb;

	require_once ABSPATH . 'wp-admin/includes/upgrade.php';

	$tables_sql = file_get_contents( __DIR__ . '/data/install_tables.sql' );
	if ( $tables_sql ) {
		$tables = explode( '/**/', $tables_sql );
		foreach ( $tables as $table ) {
			$trimmed = trim( $table );
			if ( strlen( $trimmed ) > 0 ) {
				$wpdb->query( $trimmed ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			}
		}
		dbDelta( $tables_sql );
	}

	$procedures_sql = file_get_contents( __DIR__ . '/data/install_procedures.sql' );
	if ( $procedures_sql ) {
		$procedures = explode( '/**/', $procedures_sql );
		foreach ( $procedures as $procedure ) {
			$trimmed = trim( $procedure );
			if ( strlen( $trimmed ) > 0 ) {
				$wpdb->query( $trimmed ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			}
		}
	}
}

/**
 * Runs uninstall SQL script.
 *
 * @return void
 */
function uninstall_bonusfinder_mini_games(): void {
	global $wpdb;

	$uninstall_sql = file_get_contents( __DIR__ . '/data/uninstall.sql' );
	if ( $uninstall_sql ) {
		$queries = explode( ';', $uninstall_sql );
		foreach ( $queries as $query ) {
			$trimmed = trim( $query );
			if ( strlen( $trimmed ) > 0 ) {
				$wpdb->query( $trimmed ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			}
		}
	}
}

