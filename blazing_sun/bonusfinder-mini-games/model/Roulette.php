<?php
namespace Bonusfinder\MiniGames;

use Psr\Log\LoggerInterface;
use wpdb;

/**
 * Data access for roulette user credits.
 */
class Roulette {

	/**
	 * WordPress database object.
	 *
	 * @var wpdb
	 */
	private wpdb $wpdb;

	/**
	 * Logger implementation.
	 *
	 * @var LoggerInterface
	 */
	private LoggerInterface $logger;

	/**
	 * Creates a Roulette model instance.
	 *
	 * @param wpdb            $wpdb   WordPress database object.
	 * @param LoggerInterface $logger Logger implementation.
	 */
	public function __construct( wpdb $wpdb, LoggerInterface $logger ) {
		$this->wpdb   = $wpdb;
		$this->logger = $logger;
	}

	/**
	 * Returns credits for given user, automatically creating row if missing.
	 *
	 * @param int $user_id User ID.
	 *
	 * @return float
	 */
	public function get_user_credits( int $user_id ): float {
		$sql = $this->wpdb->prepare( 'CALL bonusfinder_mini_games__get_user_credits(%d)', $user_id );
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- prepared above.
		$result = $this->wpdb->get_var( $sql );

		if ( null === $result ) {
			return 0.0;
		}

		return round( (float) $result, 2 );
	}

	/**
	 * Adds credits to user balance.
	 *
	 * @param int   $user_id User ID.
	 * @param float $amount  Amount to add.
	 *
	 * @return float Updated balance.
	 */
	public function add_credits( int $user_id, float $amount ): float {
		$amount = $this->sanitize_amount( $amount );
		if ( $amount <= 0 ) {
			return $this->get_user_credits( $user_id );
		}

		$sql = $this->wpdb->prepare(
			'CALL bonusfinder_mini_games__add_user_credits(%d, %f)',
			$user_id,
			$amount
		);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- prepared above.
		$this->wpdb->query( $sql );

		return $this->get_user_credits( $user_id );
	}

	/**
	 * Deducts credits from user balance and returns remaining credits.
	 *
	 * @param int   $user_id User ID.
	 * @param float $amount  Amount to deduct.
	 *
	 * @return float Updated balance.
	 */
	public function deduct_credits( int $user_id, float $amount ): float {
		$amount = $this->sanitize_amount( $amount );
		if ( $amount <= 0 ) {
			return $this->get_user_credits( $user_id );
		}

		$sql = $this->wpdb->prepare(
			'CALL bonusfinder_mini_games__deduct_user_credits(%d, %f)',
			$user_id,
			$amount
		);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- prepared above.
		$this->wpdb->query( $sql );

		return $this->get_user_credits( $user_id );
	}

	/**
	 * Sets user credits to explicit value.
	 *
	 * @param int   $user_id User ID.
	 * @param float $amount  Credits to set.
	 *
	 * @return float Updated balance.
	 */
	public function set_credits( int $user_id, float $amount ): float {
		$amount = max( 0, round( $amount, 2 ) );

		$sql = $this->wpdb->prepare(
			'CALL bonusfinder_mini_games__set_user_credits(%d, %f)',
			$user_id,
			$amount
		);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- prepared above.
		$this->wpdb->query( $sql );

		return $this->get_user_credits( $user_id );
	}

	/**
	 * Stores a completed game in history.
	 *
	 * @param int   $user_id User ID.
	 * @param array $payload History payload.
	 *
	 * @return void
	 */
	public function log_history( int $user_id, array $payload ): void {
		try {
			$record    = array(
				'bets' => $payload['bets'] ?? array(),
				'meta' => $payload['meta'] ?? array(),
			);
			$bets_json = wp_json_encode( $record );

			$sql = $this->wpdb->prepare(
				'CALL bonusfinder_mini_games__insert_history(%d, %s, %s, %s, %s, %f, %f, %s)',
				$user_id,
				$payload['type'] ?? 'game',
				$payload['result_number'] ?? '',
				$payload['result_color'] ?? '',
				$payload['result_parity'] ?? '',
				(float) $payload['stake'],
				(float) $payload['payout'],
				$bets_json
			);
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- prepared above.
			$this->wpdb->query( $sql );
		} catch ( \Exception $e ) {
			$this->logger->error( 'Failed to log mini-games history: ' . $e->getMessage() );
		}
	}

	/**
	 * Logs a credit top-up entry.
	 *
	 * @param int   $user_id User ID.
	 * @param float $amount  Amount added.
	 *
	 * @return void
	 */
	public function log_credit_topup( int $user_id, float $amount ): void {
		if ( $amount <= 0 ) {
			return;
		}

		$this->log_history(
			$user_id,
			array(
				'type'          => 'credit',
				'result_number' => 'credit',
				'result_color'  => 'credit',
				'result_parity' => 'credit',
				'stake'         => 0,
				'payout'        => $amount,
				'bets'          => array(),
				'meta'          => array(
					'amount' => round( $amount, 2 ),
				),
			)
		);
	}

	/**
	 * Returns paginated history for user.
	 *
	 * @param int $user_id User ID.
	 * @param int $page    Page number.
	 * @param int $per_page Items per page.
	 *
	 * @return array{rows: array<int,array<string,mixed>>, total:int}
	 */
	public function get_history( int $user_id, int $page = 1, int $per_page = 16 ): array {
		$page     = max( 1, $page );
		$per_page = max( 1, $per_page );
		$offset   = ( $page - 1 ) * $per_page;

		$sql = $this->wpdb->prepare(
			'CALL bonusfinder_mini_games__get_history(%d, %d, %d)',
			$user_id,
			$offset,
			$per_page
		);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- prepared above.
		$rows = $this->wpdb->get_results( $sql, ARRAY_A );

		$total = 0;
		if ( ! empty( $rows ) && isset( $rows[0]['total_rows'] ) ) {
			$total = (int) $rows[0]['total_rows'];
		}

		return array(
			'rows'  => array_map(
				static function ( $row ) {
					unset( $row['total_rows'] );
					return $row;
				},
				$rows
			),
			'total' => $total,
		);
	}

	/**
	 * Sanitizes credit amount.
	 *
	 * @param float $amount Amount.
	 *
	 * @return float
	 */
	private function sanitize_amount( float $amount ): float {
		return round( max( 0, $amount ), 2 );
	}
}
