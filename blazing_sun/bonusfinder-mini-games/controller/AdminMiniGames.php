<?php
namespace Bonusfinder\MiniGames\Controller;

use Psr\Log\LoggerInterface;
use Smarty;
use wpdb;

/**
 * Bootstraps Bonusfinder Mini Games controllers and assets.
 */
class AdminMiniGames {

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
	 * Absolute plugin directory path.
	 *
	 * @var string
	 */
	private string $plugin_path;

	/**
	 * Plugin URL.
	 *
	 * @var string
	 */
	private string $plugin_url;

	/**
	 * Roulette controller.
	 *
	 * @var RouletteController
	 */
	public RouletteController $roulette;

	/**
	 * Creates an AdminMiniGames instance.
	 *
	 * @param Smarty          $smarty Smarty instance.
	 * @param wpdb            $wpdb   WordPress database object.
	 * @param LoggerInterface $logger Logger implementation.
	 */
	public function __construct( Smarty $smarty, wpdb $wpdb, LoggerInterface $logger ) {
		$this->smarty      = $smarty;
		$this->logger      = $logger;
		$this->wpdb        = $wpdb;
		$this->plugin_path = dirname( BONUSFINDER_MINI_GAMES_FILE );
		$this->plugin_url  = plugin_dir_url( BONUSFINDER_MINI_GAMES_FILE );

		$this->roulette = new RouletteController( $this->smarty, $this->wpdb, $this->logger );

		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );

		$this->register_ajax_actions();
	}

	/**
	 * Registers AJAX actions for logged-in and guest users.
	 *
	 * @return void
	 */
	private function register_ajax_actions(): void {
		$actions = array(
			'bonusfinder_mini_games_add_credits' => 'add_credits',
			'bonusfinder_mini_games_place_bet'   => 'place_bet',
			'bonusfinder_mini_games_spin'        => 'spin_roulette',
			'bonusfinder_mini_games_history'     => 'fetch_history',
		);

		foreach ( $actions as $action => $method ) {
			add_action( "wp_ajax_{$action}", array( $this->roulette, $method ) );
			add_action( "wp_ajax_nopriv_{$action}", array( $this, 'reject_guest_access' ) );
		}
	}

	/**
	 * Rejects guest AJAX requests.
	 *
	 * @return void
	 */
	public function reject_guest_access(): void {
		wp_send_json_error(
			array(
				'message' => __( 'You must be logged in to play roulette.', 'bonusfinder-mini-games' ),
			),
			403
		);
	}

	/**
	 * Enqueues shared plugin assets.
	 *
	 * @return void
	 */
	public function enqueue_assets(): void {
		$style_path = $this->plugin_path . '/css/style.css';
		$style_url  = $this->plugin_url . 'css/style.css';

		if ( file_exists( $style_path ) ) {
			$version = filemtime( $style_path );
			wp_enqueue_style(
				'bonusfinder-mini-games-style',
				$style_url,
				array(),
				$version
			);
		}
	}
}

