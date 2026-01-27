<?php
namespace Bonusfinder\MiniGames\Controller;

use Bonusfinder\MiniGames\Roulette;
use Exception;
use Psr\Log\LoggerInterface;
use Smarty;
use wpdb;

/**
 * Handles roulette shortcode rendering and AJAX endpoints.
 */
class RouletteController {

	/**
	 * Allowed chip multipliers in credits.
	 *
	 * @var int[]
	 */
	private array $chip_multipliers = array( 1, 2, 5, 10, 20, 30, 50, 100, 200, 500 );

	/**
	 * Maximum number of tokens per field.
	 *
	 * @var int
	 */
	private int $max_tokens_per_field = 16;

	/**
	 * Allowed bet multipliers (x1, x2, x3, x4, x5).
	 *
	 * @var int[]
	 */
	private array $allowed_bet_multipliers = array( 1, 2, 3, 4, 5 );

	/**
	 * Number of history entries per page.
	 *
	 * @var int
	 */
	private int $history_per_page = 16;

	/**
	 * Betting payout definitions.
	 *
	 * @var array<string,int>
	 */
	private array $bet_payouts = array(
		'straight' => 35,
		'split'    => 17,
		'street'   => 11,
		'corner'   => 8,
		'line'     => 5,
		'basket'   => 6,
		'column'   => 2,
		'dozen'    => 2,
		'color'    => 1,
		'parity'   => 1,
		'range'    => 1,
		'sector'   => 35,
	);

	/**
	 * Red numbers on roulette wheel.
	 *
	 * @var string[]
	 */
	private array $red_numbers = array( '1', '3', '5', '7', '9', '12', '14', '16', '18', '19', '21', '23', '25', '27', '30', '32', '34', '36' );

	/**
	 * Allowed numbers including zero and double zero.
	 *
	 * @var string[]
	 */
	private array $allowed_numbers = array();

	/**
	 * Column definitions.
	 *
	 * @var array<string,string[]>
	 */
	private array $column_map = array(
		'col1' => array( '1', '4', '7', '10', '13', '16', '19', '22', '25', '28', '31', '34' ),
		'col2' => array( '2', '5', '8', '11', '14', '17', '20', '23', '26', '29', '32', '35' ),
		'col3' => array( '3', '6', '9', '12', '15', '18', '21', '24', '27', '30', '33', '36' ),
	);

	/**
	 * Dozen definitions.
	 *
	 * @var array<string,string[]>
	 */
	private array $dozen_map = array();

	/**
	 * Pool of wheel results (American wheel order).
	 *
	 * @var string[]
	 */
	private array $result_pool = array(
		'0',
		'28', '9', '26', '30', '11', '7', '20', '32', '17', '5', '22', '34', '15',
		'3', '24', '36', '13', '1', '00',
		'27', '10', '25', '29', '12', '8', '19', '31', '18', '6', '21', '33', '16',
		'4', '23', '35', '14', '2',
	);

	/**
	 * Smarty instance.
	 *
	 * @var Smarty
	 */
	private Smarty $smarty;

	/**
	 * Logger implementation.
	 *
	 * @var LoggerInterface
	 */
	private LoggerInterface $logger;

	/**
	 * WordPress database object.
	 *
	 * @var wpdb
	 */
	private wpdb $wpdb;

	/**
	 * Roulette model.
	 *
	 * @var Roulette
	 */
	private Roulette $roulette;

	/**
	 * Creates a RouletteController.
	 *
	 * @param Smarty          $smarty Smarty instance.
	 * @param wpdb            $wpdb   WordPress database.
	 * @param LoggerInterface $logger Logger instance.
	 */
	public function __construct( Smarty $smarty, wpdb $wpdb, LoggerInterface $logger ) {
		$this->smarty    = $smarty;
		$this->logger    = $logger;
		$this->wpdb      = $wpdb;
		$this->dozen_map = array(
			'1st12' => array_map( 'strval', range( 1, 12 ) ),
			'2nd12' => array_map( 'strval', range( 13, 24 ) ),
			'3rd12' => array_map( 'strval', range( 25, 36 ) ),
		);
		$this->roulette = new Roulette( $wpdb, $logger );
		$this->allowed_numbers = array_merge( array( '0', '00' ), array_map( 'strval', range( 1, 36 ) ) );

		add_shortcode( 'mini_game_roulete', array( $this, 'render_shortcode' ) );
	}

	/**
	 * Shortcode callback for roulette game.
	 *
	 * @return string
	 */
	public function render_shortcode(): string {
		if ( ! is_user_logged_in() ) {
			$demo_accounts = array(
				array(
					'email'    => 'gamesdemo@gdcgroup.com',
					'password' => 'ZCRpRy4bwOCMz$CGusEfE%7k',
				),
				array(
					'email'    => 'gamesdemo1@gdcgroup.com',
					'password' => 'Z3V6i7B%*u5&043Jq1C7KWuj',
				),
				array(
					'email'    => 'gamesdemo2@gdcgroup.com',
					'password' => 'ewSpcicD7VxR46HmHoDF9Fuu',
				),
			);

			$list_items = array_map(
				static function ( $account ) {
					return sprintf(
						'<li><span><b>e-mail:&#160;</b>%s</span>&#160;&#160;&#160;<span><b>Password:&#160;</b><span>%s</span></span></li>',
						esc_html( $account['email'] ),
						esc_html( $account['password'] )
					);
				},
				$demo_accounts
			);

			return sprintf(
				'<div class="bf-mini-game-login">
					<h2>%s</h2>
					<ul class="bf-mini-game-demo-accounts">%s</ul>
				</div>',
				esc_html__( 'You need to be logged in to play roulette.', 'bonusfinder-mini-games' ),
				implode( '', $list_items )
			);
		}

		ob_start();
		$this->display_public();
		return (string) ob_get_clean();
	}

	/**
	 * Displays the roulette template.
	 *
	 * @return void
	 */
	public function display_public(): void {
		try {
			$user_id = get_current_user_id();

			$credits = $this->roulette->get_user_credits( $user_id );

			$this->smarty->assign(
				'roulette_props',
				array(
					'credits'        => $credits,
					'ajax_url'       => admin_url( 'admin-ajax.php' ),
					'nonces'         => array(
						'addCredits' => wp_create_nonce( 'bonusfinder_mini_games_add_credits' ),
						'placeBet'   => wp_create_nonce( 'bonusfinder_mini_games_place_bet' ),
						'spin'       => wp_create_nonce( 'bonusfinder_mini_games_spin' ),
						'history'      => wp_create_nonce( 'bonusfinder_mini_games_history' ),
					),
					'chipMultipliers' => $this->chip_multipliers,
					'maxTokens'       => $this->max_tokens_per_field,
					'betTypes'        => array_keys( $this->bet_payouts ),
					'wheelOrder'      => $this->result_pool,
					'history'         => array(

						'perPage' => $this->history_per_page,
					),
				)
			);

			$this->smarty->display( WP_PLUGIN_DIR . '/bonusfinder-mini-games/template/roulette_public.tpl' );
		} catch ( Exception $e ) {
			$this->logger->error( __FUNCTION__ . ': ' . $e->getMessage() );
		}
	}

	/**
	 * AJAX: Add credits for logged-in user.
	 *
	 * @return void
	 */
	public function add_credits(): void {
		$this->ensure_logged_in();
		$this->verify_nonce( 'bonusfinder_mini_games_add_credits' );

		$amount = filter_input( INPUT_POST, 'amount', FILTER_VALIDATE_INT );
		if ( false === $amount || $amount <= 0 ) {
			wp_send_json_error( array( 'message' => __( 'Invalid credit amount.', 'bonusfinder-mini-games' ) ), 400 );
		}

		$user_id = get_current_user_id();
		$credits = $this->roulette->add_credits( $user_id, (float) $amount );
		$this->roulette->log_credit_topup( $user_id, (float) $amount );

		wp_send_json_success(
			array(
				'credits' => $credits,
			)
		);
	}

	/**
	 * AJAX: Validates bet payload before spinning.
	 *
	 * @return void
	 */
	public function place_bet(): void {
		$this->ensure_logged_in();
		$this->verify_nonce( 'bonusfinder_mini_games_place_bet' );

		try {
			$payload = $this->parse_bets_from_request();
			$user_id = get_current_user_id();
			$credits = $this->roulette->get_user_credits( $user_id );

			if ( $payload['total'] > $credits ) {
				wp_send_json_error(
					array(
						'message' => __( 'Not enough credits for this bet.', 'bonusfinder-mini-games' ),
						'credits' => $credits,
					),
					400
				);
			}

			wp_send_json_success(
				array(
					'bets'          => $payload['bets'],
					'total'         => $payload['total'],
					'credits'       => $credits,
					'maxTokens'     => $this->max_tokens_per_field,
					'chipMultipliers' => $this->chip_multipliers,
				)
			);
		} catch ( Exception $e ) {
			wp_send_json_error(
				array(
					'message' => $e->getMessage(),
				),
				400
			);
		}
	}

	/**
	 * AJAX: Performs roulette spin and resolves winnings.
	 *
	 * @return void
	 */
	public function spin_roulette(): void {
		$this->ensure_logged_in();
		$this->verify_nonce( 'bonusfinder_mini_games_spin' );

		try {
			$user_id = get_current_user_id();
			$payload = $this->parse_bets_from_request();

			$current_credits = $this->roulette->get_user_credits( $user_id );
			if ( $payload['total'] > $current_credits ) {
				wp_send_json_error(
					array(
						'message' => __( 'Not enough credits to spin.', 'bonusfinder-mini-games' ),
						'credits' => $current_credits,
					),
					400
				);
			}

			$after_deduction = $this->roulette->deduct_credits( $user_id, $payload['total'] );

			$result_number = $this->get_random_result();
			$result_color  = $this->determine_color( $result_number );
			$result_parity = $this->determine_parity( $result_number );

			// Calculate base winnings and apply bet multiplier
			$base_winnings = $this->calculate_winnings( $payload['bets'], $result_number );
			$bet_multiplier = $payload['bet_multiplier'] ?? 1;
			$winnings = $base_winnings * $bet_multiplier;

			$final_credits = $this->roulette->add_credits( $user_id, $winnings );

			$this->roulette->log_history(
				$user_id,
				array(
					'type'           => 'game',
					'result_number'  => $result_number,
					'result_color'   => $result_color,
					'result_parity'  => $result_parity,
					'stake'          => $payload['total'],
					'payout'         => $winnings,
					'bets'           => $payload['bets'],
					'bet_multiplier' => $bet_multiplier,
				)
			);

			wp_send_json_success(
				array(
					'number'         => $result_number,
					'color'          => $result_color,
					'parity'         => $result_parity,
					'winnings'       => $winnings,
					'credits'        => $final_credits,
					'bets'           => $payload['bets'],
					'afterDeduct'    => $after_deduction,
					'bet_multiplier' => $bet_multiplier,
				)
			);
		} catch ( Exception $e ) {
			$this->logger->error( __FUNCTION__ . ': ' . $e->getMessage() );
			wp_send_json_error(
				array(
					'message' => $e->getMessage(),
				),
				400
			);
		}
	}

	/**
	 * AJAX: Returns paginated game history for current user.
	 *
	 * @return void
	 */
	public function fetch_history(): void {
		$this->ensure_logged_in();
		$this->verify_nonce( 'bonusfinder_mini_games_history' );

		$page = filter_input( INPUT_POST, 'page', FILTER_VALIDATE_INT );
		$page = $page && $page > 0 ? $page : 1;

		$user_id = get_current_user_id();
		$history = $this->roulette->get_history( $user_id, $page, $this->history_per_page );
		$total_pages = ( $history['total'] > 0 ) ? (int) ceil( $history['total'] / $this->history_per_page ) : 1;

		wp_send_json_success(
			array(
				'rows'        => $history['rows'],
				'total'       => $history['total'],
				'page'        => $page,
				'total_pages' => max( 1, $total_pages ),
			)
		);
	}

	/**
	 * Ensures user is logged in.
	 *
	 * @return void
	 */
	private function ensure_logged_in(): void {
		if ( ! is_user_logged_in() ) {
			wp_send_json_error(
				array(
					'message' => __( 'Authentication required.', 'bonusfinder-mini-games' ),
				),
				403
			);
		}
	}

	/**
	 * Verifies nonce for current request.
	 *
	 * @param string $action Action name.
	 *
	 * @return void
	 */
	private function verify_nonce( string $action ): void {
		$nonce = filter_input( INPUT_POST, 'nonce', FILTER_SANITIZE_FULL_SPECIAL_CHARS );
		if ( empty( $nonce ) || ! wp_verify_nonce( $nonce, $action ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'Security check failed.', 'bonusfinder-mini-games' ),
				),
			 403
			);
		}
	}

	/**
	 * Parses bets payload from request.
	 *
	 * @throws Exception When validation fails.
	 *
	 * @return array<string,mixed>
	 */
	private function parse_bets_from_request(): array {
		$bets_payload = filter_input( INPUT_POST, 'bets', FILTER_UNSAFE_RAW );
		if ( empty( $bets_payload ) ) {
			throw new Exception( __( 'Bets payload is required.', 'bonusfinder-mini-games' ) );
		}

		// Parse bet multiplier (x1, x2, x3, x4, x5)
		$bet_multiplier = filter_input( INPUT_POST, 'betMultiplier', FILTER_VALIDATE_INT );
		if ( false === $bet_multiplier || ! in_array( $bet_multiplier, $this->allowed_bet_multipliers, true ) ) {
			$bet_multiplier = 1; // Default to 1x if invalid
		}

		$bets_data = json_decode( wp_unslash( $bets_payload ), true );

		if ( ! is_array( $bets_data ) ) {
			throw new Exception( __( 'Invalid bets payload.', 'bonusfinder-mini-games' ) );
		}

		$field_counts = array();
		$total_cost   = 0;
		$sanitized    = array();

		foreach ( $bets_data as $bet ) {
			$type       = isset( $bet['type'] ) ? sanitize_key( $bet['type'] ) : '';
			$tokens     = isset( $bet['tokens'] ) ? intval( $bet['tokens'] ) : 0;
			$multiplier = isset( $bet['multiplier'] ) ? intval( $bet['multiplier'] ) : 0;
			$value      = isset( $bet['value'] ) ? sanitize_key( $bet['value'] ) : null;
			$key        = isset( $bet['key'] ) ? sanitize_key( $bet['key'] ) : '';
			$targets    = array();

			if ( empty( $type ) || 0 === $tokens || 0 === $multiplier ) {
				throw new Exception( __( 'Bet is missing required fields.', 'bonusfinder-mini-games' ) );
			}

			if ( empty( $key ) ) {
				throw new Exception( __( 'Invalid bet key received.', 'bonusfinder-mini-games' ) );
			}

			if ( ! array_key_exists( $type, $this->bet_payouts ) ) {
				throw new Exception( __( 'Unsupported bet type.', 'bonusfinder-mini-games' ) );
			}

			if ( ! in_array( $multiplier, $this->chip_multipliers, true ) ) {
				throw new Exception( __( 'Invalid multiplier selected.', 'bonusfinder-mini-games' ) );
			}

			if ( $tokens <= 0 ) {
				throw new Exception( __( 'Tokens must be at least 1.', 'bonusfinder-mini-games' ) );
			}

			$field_counts[ $key ] = ( $field_counts[ $key ] ?? 0 ) + $tokens;
			if ( $field_counts[ $key ] > $this->max_tokens_per_field ) {
				throw new Exception( __( 'Maximum chips reached for one field.', 'bonusfinder-mini-games' ) );
			}

			if ( isset( $bet['targets'] ) ) {
				if ( ! is_array( $bet['targets'] ) ) {
					throw new Exception( __( 'Targets must be an array.', 'bonusfinder-mini-games' ) );
				}
				foreach ( $bet['targets'] as $target ) {
					$target = (string) $target;
					if ( ! in_array( $target, $this->allowed_numbers, true ) ) {
						throw new Exception( __( 'Invalid target number selected.', 'bonusfinder-mini-games' ) );
					}
					$targets[] = $target;
				}
			}

			switch ( $type ) {
				case 'straight':
					if ( count( $targets ) !== 1 ) {
						throw new Exception( __( 'Straight bets require exactly one number.', 'bonusfinder-mini-games' ) );
					}
					break;
				case 'split':
					if ( count( $targets ) !== 2 ) {
						throw new Exception( __( 'Split bets require exactly two numbers.', 'bonusfinder-mini-games' ) );
					}
					break;
				case 'street':
					if ( count( $targets ) !== 3 ) {
						throw new Exception( __( 'Street bets require three numbers.', 'bonusfinder-mini-games' ) );
					}
					break;
				case 'corner':
					if ( count( $targets ) !== 4 ) {
						throw new Exception( __( 'Corner bets require exactly four numbers.', 'bonusfinder-mini-games' ) );
					}
					break;
				case 'line':
					if ( count( $targets ) !== 6 ) {
						throw new Exception( __( 'Line bets require six numbers.', 'bonusfinder-mini-games' ) );
			}
					break;
				case 'basket':
					$expected = array( '0', '00', '1', '2', '3' );
					sort( $expected );
					$sorted_targets = $targets;
					sort( $sorted_targets );
					if ( $sorted_targets !== $expected ) {
						throw new Exception( __( 'Basket bet must include 0, 00, 1, 2, 3.', 'bonusfinder-mini-games' ) );
					}
					break;
				case 'column':
					if ( ! isset( $this->column_map[ $value ] ) ) {
						throw new Exception( __( 'Invalid column selection.', 'bonusfinder-mini-games' ) );
					}
					break;
				case 'dozen':
					if ( ! isset( $this->dozen_map[ $value ] ) ) {
						throw new Exception( __( 'Invalid dozen selection.', 'bonusfinder-mini-games' ) );
					}
					break;
				case 'color':
					if ( ! in_array( $value, array( 'red', 'black' ), true ) ) {
						throw new Exception( __( 'Invalid color selection.', 'bonusfinder-mini-games' ) );
					}
					break;
				case 'parity':
					if ( ! in_array( $value, array( 'odd', 'even' ), true ) ) {
						throw new Exception( __( 'Invalid parity selection.', 'bonusfinder-mini-games' ) );
					}
					break;
				case 'range':
					if ( ! in_array( $value, array( 'low', 'high' ), true ) ) {
						throw new Exception( __( 'Invalid range selection.', 'bonusfinder-mini-games' ) );
					}
					break;
			}

			$stake = $tokens * $multiplier;
			$total_cost += $stake;

			$sanitized[] = array(
				'type'       => $type,
				'targets'    => $targets,
				'value'      => $value,
				'tokens'     => $tokens,
				'multiplier' => $multiplier,
				'stake'      => $stake,
				'key'        => $key,
			);
		}

		if ( empty( $sanitized ) ) {
			throw new Exception( __( 'At least one bet is required.', 'bonusfinder-mini-games' ) );
		}

		// Apply bet multiplier to total cost
		$total_with_multiplier = $total_cost * $bet_multiplier;

		return array(
			'bets'          => $sanitized,
			'total'         => $total_with_multiplier,
			'base_total'    => $total_cost,
			'bet_multiplier' => $bet_multiplier,
		);
	}

	/**
	 * Determines wheel color.
	 *
	 * @param string $number Roulette result.
	 *
	 * @return string
	 */
	private function determine_color( string $number ): string {
		if ( in_array( $number, array( '0', '00' ), true ) ) {
			return 'green';
		}

		return in_array( $number, $this->red_numbers, true ) ? 'red' : 'black';
	}

	/**
	 * Determines result parity.
	 *
	 * @param string $number Number.
	 *
	 * @return string
	 */
	private function determine_parity( string $number ): string {
		if ( in_array( $number, array( '0', '00' ), true ) ) {
			return 'zero';
		}

		$numeric = (int) $number;
		return 0 === $numeric % 2 ? 'even' : 'odd';
	}

	/**
	 * Calculates net winnings for bets.
	 *
	 * @param array<int,array<string,mixed>> $bets    Sanitized bets.
	 * @param string                         $number  Result number.
	 *
	 * @return float
	 */
	private function calculate_winnings( array $bets, string $number ): float {
		$winnings       = 0.0;
		$numeric_result = in_array( $number, array( '0', '00' ), true ) ? null : (int) $number;

		foreach ( $bets as $bet ) {
			$stake     = (float) $bet['stake'];
			$type      = $bet['type'];
			$is_winner = false;
			$targets   = $bet['targets'] ?? array();
			$tokens    = isset( $bet['tokens'] ) ? (int) $bet['tokens'] : 0;
			$payout_stake = $stake;
			if ( 'sector' === $type && $tokens > 0 ) {
				$payout_stake = $stake / $tokens;
			}

			switch ( $type ) {
				case 'straight':
				case 'split':
				case 'street':
				case 'corner':
				case 'line':
				case 'basket':
				case 'sector':
					$is_winner = in_array( $number, $targets, true );
					break;
				case 'column':
					if ( null !== $numeric_result && isset( $this->column_map[ $bet['value'] ] ) ) {
						$is_winner = in_array( (string) $numeric_result, $this->column_map[ $bet['value'] ], true );
				}
					break;
				case 'dozen':
					if ( null !== $numeric_result && isset( $this->dozen_map[ $bet['value'] ] ) ) {
						$is_winner = in_array( (string) $numeric_result, $this->dozen_map[ $bet['value'] ], true );
					}
					break;
				case 'color':
					$is_winner = $bet['value'] === $this->determine_color( $number );
					break;
				case 'parity':
					$is_winner = $bet['value'] === $this->determine_parity( $number );
					break;
				case 'range':
					if ( null !== $numeric_result ) {
						$is_winner = ( 'low' === $bet['value'] && $numeric_result >= 1 && $numeric_result <= 18 ) ||
							( 'high' === $bet['value'] && $numeric_result >= 19 && $numeric_result <= 36 );
					}
					break;
			}

			if ( $is_winner && isset( $this->bet_payouts[ $type ] ) ) {
				$winnings += $payout_stake * ( $this->bet_payouts[ $type ] + 1 );
			}
		}

		return round( $winnings, 2 );
	}

	/**
	 * Returns a random wheel result.
	 *
	 * @return string
	 */
	private function get_random_result(): string {
		return $this->result_pool[ array_rand( $this->result_pool ) ];
	}
}

