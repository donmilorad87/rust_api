{assign var=roulette_props value=$roulette_props}

{literal}
	<script data-version="8716b0d3sssssss2642d783">
		class MiniRouletteGame extends HTMLElement {
			constructor() {
				super();
				this.attachShadow({ mode: 'open' });


				setTimeout(() => {
					const defaultWheel = ['0','28','9','26','30','11','7','20','32','17','5','22','34','15','3','24','36','13','1','00','27','10','25','29','12','8','19','31','18','6','21','33','16','4','23','35','14','2'];
					this.ajaxUrl = this.dataset.ajaxUrl;
					this.state = {
						credits: parseFloat(this.dataset.credits || '0'),
						placements: [],
						logs: []
					};
					this.maxTokens = parseInt(this.dataset.maxTokens || '16', 10);
					this.chipMultipliers = JSON.parse(this.dataset.chipMultipliers || '[1]');
					this.nonces = {
						add: this.dataset.nonceAdd,
						place: this.dataset.noncePlace,
						spin: this.dataset.nonceSpin,
						history: this.dataset.nonceHistory
					};

					this.actions = {
						add: this.dataset.actionAdd,
						place: this.dataset.actionPlace,
						spin: this.dataset.actionSpin,
						history: this.dataset.actionHistory
					};
					this.currentChipValue = this.chipMultipliers[0] || 1;
					this.isSpinning = false;
					this.wheelAnimating = false;
					this.betSpotElements = new Map();
					this.betSpotElements = new Map();
					this.boardStackRaf = null;
					this.recalcRaf = null;
					this.boardGeometry = { width: 0, height: 0 };
					this.pendingStacks = null;
					this.summary = {};

					this.redNumbers = ['1','3','5','7','9','12','14','16','18','19','21','23','25','27','30','32','34','36'];
					this.numberGrid = [
						['3','6','9','12','15','18','21','24','27','30','33','36'],
						['2','5','8','11','14','17','20','23','26','29','32','35'],
						['1','4','7','10','13','16','19','22','25','28','31','34']
					];
					this.wheelOrder = JSON.parse(this.dataset.wheelOrder || JSON.stringify(defaultWheel));
					// Wheel stays where it stopped // Current wheel rotation in radians
					this.history = {
						perPage: parseInt(this.dataset.historyPerPage || '16', 10),
						page: 1,
						totalPages: 1,
						busy: false
					};

					this.render();
					this.cacheElements();
					this.bindEvents();
					this.updateCredits();
					this.updateSummary();
					this.updateChipSelector();
					this.updateChipNotice();
					this.updateLogs();
					this.recalculateBoardGeometry();
					this.initGeometryObservers();
					this.handleResize = () => {
						this.recalculateBoardGeometry();
						this.renderCanvasWheel();
					};
					window.addEventListener('resize', this.handleResize);
				}, 0);






			}

			disconnectedCallback() {
				if (this.handleResize) {
					window.removeEventListener('resize', this.handleResize);
				}
				this.unlockPageScroll();
				if (this.themeObserver) {
					this.themeObserver.disconnect();
					this.themeObserver = null;
				}
				if (this.sizeObserver) {
					this.sizeObserver.disconnect();
					this.sizeObserver = null;
				}
				if (this.boardStackRaf) {
					cancelAnimationFrame(this.boardStackRaf);
					this.boardStackRaf = null;
				}
			}

			get template() {
				return `
			<style>
				* {box-sizing: border-box;}
				.loading-overlay {
					position: absolute;
					inset: 0;
					display: none;
					align-items: center;
					justify-content: center;
					background: rgba(15, 23, 42, 0.35);
					backdrop-filter: blur(6px);
					z-index: 20;
				}
				.loading-overlay.visible {
					display: flex;
				}
				.ripple {
					display: inline-block;
					position: relative;
					width: 80px;
					height: 80px;
				}
				.ripple div {
					position: absolute;
					border: 4px solid #5B2ABF;
					opacity: 1;
					border-radius: 50%;
					animation: ripple 1s cubic-bezier(0, 0.2, 0.8, 1) infinite;
				}
				.ripple div:nth-child(2) {
					animation-delay: -0.5s;
				}
				@keyframes ripple {
					0% {
						top: 36px;
						left: 36px;
						width: 0;
						height: 0;
						opacity: 0;
					}
					4.9% {
						top: 36px;
						left: 36px;
						width: 0;
						height: 0;
						opacity: 0;
					}
					5% {
						top: 36px;
						left: 36px;
						width: 0;
						height: 0;
						opacity: 1;
					}
					100% {
						top: 0px;
						left: 0px;
						width: 72px;
						height: 72px;
						opacity: 0;
					}
				}

				:host {
					display: block;
					--cell-width: clamp(30px, 5.2vw, 51.7px);
					--cell-height: clamp(38px, 4.5vw, 56px);
					--bf-bg: #ffffff;
					--bf-border: #e6eaf5;
					--bf-text: #16233D;
					--bf-notice: #c2410c;
					--chip-size-board: clamp(16px, calc(var(--cell-width) * 0.42), 24px);
					--chip-font-board: clamp(0.35rem, calc(var(--cell-width) * 0.02 + 0.2rem), 0.55rem);
				}
				:host(.dark) {
					--bf-bg: #242A38;
					--bf-border: #a56eff6e;
					--bf-text: #EEEFFB;
					--bf-notice: #5B2ABF;
				}
				.layout {
					display: flex;
					border-radius: 24px;
					box-shadow: 10px 10px 29px -10px rgba(15, 23, 42, 0.15);
					position: relative;
					overflow: hidden;
					border: 4px solid #fcd34d;
					background: linear-gradient(135deg, rgba(4, 47, 24, 0.95), rgba(6, 78, 59, 0.9));
    				flex-direction: column-reverse;
				}

				@media (min-width: 980px) {
					.layout {
						flex-direction: column-reverse;
						align-items: flex-start;
					}
				}
				.summary-row button {
					color: #5B2ABF;
				}
				.brand-svg svg {
					background: #3444c2;
					padding: 1rem;
					border-radius: 1rem;
					box-shadow: 0 4px 13px rgba(15, 23, 42, 0.35);
					border: 1px solid #5b2abf33;
				}
				.canvas-container {
					position: relative;
					width: 600px;
					height: auto;
					max-width: 100%;
					margin: auto;
				}
				.canvas-wheel {
					display: block;
					width: 100%;
					height: auto;
					background: radial-gradient(circle at center, #0f172a 0%, #020617 100%);
					border-radius: 50%;
					box-shadow: inset 0 0 30px rgba(0,0,0,0.75), 0 12px 30px rgba(0,0,0,0.5);
				}
					color: #5B2ABF;
					font-size: 2rem;
				}
				.summary-card{

					.notice{
						color: #16233D;
						font-size: 1.5rem;
						text-decoration: underline;
						text-decoration-color: #5B2ABF;
					}
				}
				.layout{

					.bet-totals{

						table{
							background: white;
						}
						 tr{
							border: 1px solid #414a7c29;
						}
						td{
							border-bottom: 1px solid #414a7c29;
						}
						thead tr{
							border: 1px solid #414a7c29;

						}
						tbody tr td:first-child, tfoot tr td:first-child, thead tr th:first-child{
							border-right: 1px solid #414a7c29;
						}
					}
				}
				.layout.dark{

					.chip-pill-count{
						color: #EEEFFB;
					}
					.bet-totals{
						color: #EEEFFB;

						table{
							background: #242A38;
						}
						 tr{
							border: 1px solid #414a7c;
						}
						td, th{
							border-bottom: 1px solid #414a7c;
						}

						tbody tr td:first-child, tfoot tr td:first-child, thead tr th:first-child{
							border-right: 1px solid #414a7c;
						}
					}
				}

				.layout.dark h3{
					color: #EEEFFB;
				}
				.layout.dark .controls button{
					background-color: #f6e8ff;
					color: #16233D;
				}
				.layout.dark .controls button.primary{
					background-color: #f6e8ff;
					font-size: 1rem;
					color: #eeeffb;
					margin-left:auto;
				}
				.layout .controls button.primary{
					margin-left:auto;
				}
				.layout.dark .summary-card{
					background: rgba(57, 64, 82, 0.8);
				}
				.layout.dark .summary-card h4{
					color: #EEEFFB;
				}
				.layout.dark .summary-card .notice{
					color: #EEEFFB;
					font-size: 1.5rem;
					text-decoration: underline;
					text-decoration-color: #5B2ABF;
				}
				.layout.dark .summary-row div,
				.layout.dark .summary-row small{
					color: #EEEFFB;
				}
				.layout.dark .history-header h4{
					color: #EEEFFB;
				}
				.controls .primary {
					color: #ffffff;
					animation: auraPulse 2.2s ease-out infinite;
					will-change: box-shadow;
					background: linear-gradient(135deg, rgba(4, 47, 24, 0.95), rgba(6, 78, 59, 0.9));
					outline: 1px solid #ffd70073;
				}
				@keyframes auraPulse {
					0% {
						box-shadow:
							0 0 0 0 rgba(61, 217, 140, 0.4),
							0 0 0 0 rgba(61, 217, 140, 0.2);
					}
					40% {
						box-shadow:
							0 0 0 10px rgba(61, 217, 140, 0.15),
							0 0 0 20px rgba(61, 217, 140, 0.05);
					}
					60% {
						box-shadow:
							0 0 0 10px rgba(61, 217, 140, 0),
							0 0 0 20px rgba(61, 217, 140, 0);
					}
					100% {
						box-shadow:
							0 0 0 0 rgba(61, 217, 140, 0.4),
							0 0 0 0 rgba(61, 217, 140, 0.2);
					}
				}
				.toast-container {
					position: fixed;
					top: 2.25rem;
					right: 1.25rem;
					display: flex;
					flex-direction: column;
					gap: 0.75rem;
					z-index: 9999;
					pointer-events: none;
				}
				.toast-message {
					min-width: 220px;
					background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(5,150,105,0.95));
					color: #f8fafc;
					padding: 0.85rem 1.2rem;
					border-radius: 14px;
					border: 1px solid rgba(94,234,212,0.35);
					box-shadow: 0 25px 45px rgba(15,23,42,0.35);
					font-size: 0.95rem;
					font-weight: 600;
					transform: translateX(120%);
					opacity: 0;
					pointer-events: auto;
					animation: toastIn 0.55s cubic-bezier(0.33, 1, 0.68, 1) forwards;
				}
				.toast-message.exit {
					animation: toastOut 0.45s cubic-bezier(0.8, 0, 1, 0.8) forwards;
				}
				@keyframes toastIn {
					from {
						transform: translateX(120%);
						opacity: 0;
					}
					to {
						transform: translateX(0%);
						opacity: 1;
					}
				}
				@keyframes toastOut {
					from {
						transform: translateX(0%);
						opacity: 1;
					}
					to {
						transform: translateX(120%);
						opacity: 0;
					}
				}
				h3, h4 {
					margin: 0;
					font-weight: 600;
					color: var(--bf-text);
				}
				.panel {
					display: flex;
					flex-direction: column;
					gap: 1rem;
					width: 100%;
					max-width: 100%;
					color: var(--bf-text);
				}
				.board-section {
					display:flex;
					flex-direction:column;
					gap: 1rem;
				}
				.brand-svg {
					display: flex;
					justify-content: center;
					align-items: center;
					margin-top: 1rem;
				}
				.brand-svg svg {
					max-width: 360px;
					width: 90%;
					height: auto;
				}

				.roulette-table {
					display: flex;
					flex-direction: column;
					gap: 0.85rem;
					color: #f8fafc;
				}
				.bet-spot {
					position: relative;
					border-radius: 8px;
					border: 2px solid rgba(15,23,42,0.25);
					background: rgba(2, 6, 23, 0.8);
					color: #f8fafc;
					font-weight: 600;
					display: flex;
					align-items: center;
					justify-content: center;
					cursor: pointer;
					text-transform: uppercase;
					box-shadow: inset 0 0 12px rgba(0,0,0,0.45);
				}
				.corner-spot ,bet-spot{
					box-shadow: 0 0 0 0 transparent;
					border:0px;
					}
				.bet-spot .label {
					pointer-events: none;
				}
				.bet-spot.red { background: #b91c1c; }
				.bet-spot.black { background: #0f172a; }
				.bet-spot.green { background: #0f5132; }
				.bet-spot.outside {
					background: rgba(5, 42, 10, 0.9);
					border-color: rgba(252,211,77,0.55);
				}



				#roulette {
					width: 100%;
					height: auto;
					display: flex;
				}

				.dozen-row {
					grid-template-columns: repeat(3, minmax(0, 1fr));
				}

				.chip-stack {
					position: absolute;
					top: 50%;
					left: 50%;
					transform: translate(-50%, -50%);
					display: flex;
					gap: 4px;
					align-items: center;
					justify-content: center;
					flex-wrap: wrap;
					width: auto;
				}
				.chip-stack .chip-token {
					position: relative;
					border-radius: 50%;
					border: none;
					background: var(--chip-color, #f97316);
					color: #fff;
					font-weight: 700;
					font-size: var(--chip-font-board);
					display: flex;
					align-items: center;
					justify-content: center;
					text-shadow: 0 2px 4px rgba(0,0,0,0.35);
					box-shadow: 0 6px 12px rgba(15,23,42,0.35), inset 0 3px 0 rgba(255,255,255,0.35);
					padding: 0;
				}
				.chip-stack .chip-token::before {
					content: '';
					position: absolute;
					inset: calc(var(--chip-size-board) * 0.18);
					border: 2px solid rgba(255,255,255,0.7);
					border-radius: 50%;
				}
				.chip-stack .chip-token::after {
					content: '';
					position: absolute;
					inset: calc(var(--chip-size-board) * 0.08);
					border-radius: 50%;
					border: 3px dashed rgba(0,0,0,0.35);
					opacity: 0.45;
				}

				.chip-stack .chip-token[data-chip="1"] { --chip-color: #f59e0b; }
				.chip-stack .chip-token[data-chip="2"] { --chip-color: #f97316; }
				.chip-stack .chip-token[data-chip="5"] { --chip-color: #dc2626; }
				.chip-stack .chip-token[data-chip="10"] { --chip-color: #16a34a; }
				.chip-stack .chip-token[data-chip="20"] { --chip-color: #2563eb; }
				.chip-stack .chip-token[data-chip="30"] { --chip-color: #7c3aed; }
				.chip-stack .chip-token[data-chip="50"] { --chip-color: #0891b2; }
				.chip-stack .chip-token[data-chip="100"] { --chip-color: #1f2937; }
				.chip-stack .chip-token[data-chip="200"] { --chip-color: #1d4ed8; }
				.chip-stack .chip-token[data-chip="500"] { --chip-color: #7e22ce; }
				.summary-card {
					border: 1px solid #a56eff;
					border-radius: 16px;
					padding: 1rem;
					display: flex;
					flex-direction: column;
					gap: 0.75rem;
					background: var(--bf-bg);
					width: 100%;
				}
				.summary-label-block {
				    display: flex;
					flex-direction: row-reverse;
					gap: 0.65rem;
					justify-content: center;
					align-items: center;
				}
				.summary-number-group {
					display: flex;
					flex-wrap: wrap;
					gap: 0.35rem;
    				align-items: center;
				}
				.summary-value-block {
					display: flex;
					flex-direction: column;
					align-items: flex-end;
					gap: 0.35rem;
				}
				.summary-token {
					display: inline-flex;
					align-items: center;
					justify-content: center;
					width: 36px;
					height: 36px;
					border-radius: 10px;
					font-weight: 700;
					font-size: 0.95rem;
					color: #fff;
					box-shadow: inset 0 2px 4px rgba(255,255,255,0.2), 0 6px 12px rgba(15,23,42,0.25);
				}
				.summary-token.red { background: #b91c1c; }
				.summary-token.black { background: #0f172a; }
				.summary-token.green { background: #0f5132; }
				.summary-label-text {
					font-weight: 600;
				}
				.summary-sector {
					display: flex;
					flex-direction: column;
					font-weight: 700;
					gap: 0.15rem;
				}
				.summary-sector small {
					font-weight: 500;
					font-size: 0.75rem;
					color: rgba(255,255,255,0.85);
				}
				.summary-chip-group {
					display: flex;
					flex-wrap: wrap;
					gap: 0.65rem;
					align-items: center;
				}
				.summary-total-credits {
					font-weight: 700;
					color: var(--bf-notice);
				}
				.chip-pill {
					display: inline-flex;
					align-items: center;
					gap: 0.65rem;
					color: var(--bf-text);
					font-weight: 600;
				}
				.bet-summary .summary-value-block .summary-total-credits { display:none; }
				.bet-summary .summary-chip-total { display:none; }
				.chip-pill-count {
					font-size: 0.9rem;
				}
				.chip-pill-value {
					display: inline-flex;
					align-items: center;
					justify-content: center;
				}
				.bet-totals {
					background: rgba(15,23,42,0.04);
					border-radius: 12px;
					padding: 0.75rem;
					font-size: 0.9rem;
					color: var(--bf-text);
					border: 1px dashed rgba(90,103,216,0.35);
				}
				.bet-totals table {
					width: 100%;
					border-collapse: collapse;
					font-size: 0.85rem;
				}
				.bet-totals th,
				.bet-totals td {
					padding: 0.25rem 0.35rem;
					text-align: left;
					border-bottom: 1px solid rgba(15,23,42,0.08);
				}
				.bet-totals td.chip-table-cell {
					text-align: center;
				}
				.bet-totals th {
					font-weight: 600;
					color: var(--color-accent);
				}
				.bet-totals tfoot td {
					border-top: 1px solid rgba(15,23,42,0.15);
					font-weight: 600;
				}
				.summary-row {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 0.5rem 0;
					border-bottom: 1px solid var(--bf-border);
				}
				.summary-row:last-child {
					border-bottom: none;
				}
				.summary-row button {
					border: none;
					background: transparent;
					cursor: pointer;
					font-weight: 900;
					font-size: 0.9rem;
				}
				.chip-face {
					--chip-color: #f97316;
					--chip-size: 70px;
					position: relative;
					width: var(--chip-size);
					height: var(--chip-size);
					border-radius: 50%;
					border: none;
					background: var(--chip-color);
					color: #fff;
					font-weight: 700;
					font-size: 1rem;
					letter-spacing: 0.04em;
					display: flex;
					align-items: center;
					justify-content: center;
					text-shadow: 0 2px 4px rgba(0,0,0,0.85);
					box-shadow: 0 10px 18px rgba(15,23,42,0.35), inset 0 -4px 4px rgba(255,255,255,0.35), inset 0 4px 4px rgba(255,255,255,0.35);
				}
				.chip-face {
					--chip-size: 44px;
					font-size: 0.8rem;
					cursor: default;
				}
				.chip-table-face {
					--chip-size: 40px;
					font-size: 0.75rem;
				}
				.chip-face::before {
					content: '';
					position: absolute;
					inset: calc(var(--chip-size) * 0.14);
					border: 2px solid rgba(255,255,255,0.7);
					border-radius: 50%;
				}
				.chip-face::after {
					content: '';
					position: absolute;
					inset: calc(var(--chip-size) * 0.09);
					border-radius: 50%;
					border: 4px dashed rgba(0,0,0,0.4);
					opacity: 0.4;
				}
				.chip-face[data-chip="1"] { --chip-color: #f59e0b; }
				.chip-face[data-chip="2"] { --chip-color: #f97316; }
				.chip-face[data-chip="5"] { --chip-color: #dc2626; }
				.chip-face[data-chip="10"] { --chip-color: #16a34a; }
				.chip-face[data-chip="20"] { --chip-color: #2563eb; }
				.chip-face[data-chip="30"] { --chip-color: #7c3aed; }
				.chip-face[data-chip="50"] { --chip-color: #0891b2; }
				.chip-face[data-chip="100"] { --chip-color: #1f2937; }
				.chip-face[data-chip="200"] { --chip-color: #1d4ed8; }
				.chip-face[data-chip="500"] { --chip-color: #7e22ce; }
				.chip-face > span {
					position: relative;
					z-index: 1;
				}
				.notice {
					font-size: 0.9rem;
					color:#a56eff;
				}
				.controls {
					display: flex;
					gap: 0.75rem;
					flex-wrap: wrap;
				}
				.controls button {
					border-radius: 999px;
					padding: 0.6rem 1.4rem;
					font-weight: 600;
					cursor: pointer;
					border: none;
				}.
				.controls .muted {
					background: rgba(15,23,42,0.06);
					color: #0f172a;
				}
				.controls .muted.loading {
					pointer-events: none;
					opacity: 0.7;
				}
				.controls .muted .btn-spinner {
					display: inline-block;
					width: 14px;
					height: 14px;
					border: 2px solid rgba(15,23,42,0.2);
					border-top-color: #0f172a;
					border-radius: 50%;
					animation: btn-spin 0.8s linear infinite;
					margin-right: 6px;
					vertical-align: middle;
				}
				@keyframes btn-spin {
					to { transform: rotate(360deg); }
				}
				.wheel-wrapper {
					position: relative;
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 1rem;
					width: 100%;
				}
				.logs-list {
					max-height: 320px;
					overflow-y: auto;
				}
				.logs-list table {
					width: 100%;
					border-collapse: collapse;
					font-size: 0.9rem;
				}
				.logs-list th,
				.logs-list td {
					padding: 0.45rem 0.25rem;
					text-align: left;
					border-bottom: 1px solid #a56eff;
				}
				.logs-list th {
					font-weight: 600;
					color: #cbd5f5;
				}
				.empty {
					color: #94a3b8;
					font-style: italic;
				}
				.disabled {
					pointer-events: none;
					opacity: 0.65;
				}
				.history-dialog {
					border: none;
					border-radius: 20px;
					padding: 0;
					width: min(680px, 92vw);
					background: #0f172a;
					color: #f8fafc;
					box-shadow: 0 30px 80px rgba(15,23,42,0.55);
				}
				.history-dialog::backdrop {
					background: rgba(15,23,42,0.65);
					backdrop-filter: blur(6px);
				}
				.history-card {
					padding: 1.5rem;
					display: flex;
					flex-direction: column;
					gap: 1rem;
				}
				.history-card table {
					width: 100%;
					border-collapse: collapse;
					font-size: 0.9rem;
				}
				.history-card th,
				.history-card td {
					padding: 0.45rem 0.25rem;
					text-align: left;
					border-bottom: 1px solid #a56eff;
				}
				.history-card th {
					font-weight: 600;
					color: #cbd5f5;
				}
				.history-loading {
					display: flex;
					align-items: center;
					justify-content: center;
					padding: 2rem 0;
				}
				.history-pagination {
					display: flex;
					justify-content: flex-end;
					gap: 0.5rem;
				}
				.history-pagination button {
					border: none;
					background: rgba(248,250,252,0.1);
					color: #f8fafc;
					padding: 0.4rem 0.9rem;
					border-radius: 999px;
					cursor: pointer;
				}
				.history-pagination button[disabled] {
					opacity: 0.4;
					cursor: default;
				}
				.history-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					color:#e0eaff;
				}
				.history-header h4{
				 	color:#f8fafc;
				}
				.history-header button {
					border: none;
					background: transparent;
					color: #f8fafc;
					font-size: 1.3rem;
					cursor: pointer;
				}

					font-size: 0.35rem;
				}

					margin-left:4px;
					width: 30px;
					height: 30px;
				}
				:host {
					--cell-width: calc((100% / 12) - 0.32rem)!important;
					--cell-height: clamp(27px, 5vw, 48px);
				}

				@media (min-width: 320px) {
					.chip-stack .chip-token {
						width: 12px;
						height: 12px;
					}

				}
				@media (min-width: 340px) {


				}
				@media (min-width: 360px) {


				}
				@media (min-width: 380px) {


					.bet-spot[data-shape="diamond"] {
						margin-left:5px;
						width: 36px;
					}
					.bet-spot.outside {
						font-size: 0.45rem;
					}

				}
				@media (min-width: 410px) {

				}
				@media (min-width: 420px) {


				}
				@media (min-width: 430px) {

				}
				@media (min-width: 440px) {
						font-size:10px;
						padding:7px;
					}
					.bet-spot[data-shape="diamond"] {
						margin-left:10px;
						width: 50px;
						height: 50px;
					}
				}
				@media (min-width: 460px) {

				}
				@media (min-width: 480px) {

				}
				@media (min-width: 500px) {

				}
				@media (min-width: 520px) {

				}
				@media (min-width: 540px) {

				}
				@media (min-width: 560px) {

				}
				@media (min-width: 580px) {
						font-size:13px;
						padding:8px;
					}
					.bet-spot[data-shape="diamond"] {
						margin-left:11px;
						width: 62px;
						height: 62px;
				}
				@media (min-width: 640px) {
				@media (min-width: 660px) {

				}
				@media (min-width: 680px) {

				}
				@media (min-width: 700px) {

					.bet-spot[data-shape="diamond"] {
						margin-left:14px;
						width: 70px;
						height: 70px;
					}
				}
				@media (min-width: 720px) {

				}
				@media (min-width: 740px) {

				}
				@media (min-width: 768px) {
					.chip-stack .chip-token {
						width: 20px;
						height: 20px;
					}
					.bet-spot.outside {
						font-size: 0.65rem;
					}

						width: 72px;
						height: 72px;
						margin-left:22px;
					}
				}
				@media (min-width: 780px) {

				}
				@media (min-width: 800px) {

				}
				@media (min-width: 820px) {
					.chip-stack .chip-token {
						width: 22px;
						height: 22px;
						font-size: 10px !important;
					}
				}
				@media (min-width: 840px) {

				}
				@media (min-width: 860px) { }
				@media (min-width: 900px) { }
				@media (min-width: 940px) { }
				@media (min-width: 1000px) { }


				@media (max-width: 640px) {

				}
			</style>
			<div class="layout">

					<div class="summary-card">
						<div style="display:flex;justify-content:space-between;align-items:center;">
							<h4>Placed chips</h4>
							<span class="notice" id="chipNotice"></span>
					</div>
						<div id="betSummary" class="bet-summary"></div>
						<div class="bet-totals" id="chipTotals"></div>
					</div>
					<div class="controls">
						<button type="button" class="muted" id="addCreditsBtn">Add 1000 credits</button>

						<button type="button" class="muted" id="historyBtn">History</button>
						<button type="button" class="muted" id="logsBtn">Logs</button>

						</div>
<div class="board-section">
						${this.buildBoardMarkup()}
					</div>
				</div>
				<dialog class="history-dialog" id="historyDialog">
					<div class="history-card">
						<div class="history-header">
							<h4>Game history</h4>
							<button type="button" id="historyClose" aria-label="Close history">&times;</button>
					</div>
						<div id="historyList" class="history-list">
							<p class="empty">No games logged yet.</p>
							</div>
						<div class="history-pagination" id="historyPagination"></div>
						</div>
				</dialog>
				<dialog class="history-dialog" id="logsDialog">
					<div class="history-card">
						<div class="history-header">
							<h4>Spin logs</h4>
							<button type="button" id="logsClose" aria-label="Close logs">&times;</button>
					</div>
						<div id="logsList" class="history-list logs-list">
							<p class="empty">No spins yet.</p>
						</div>
					</div>
				</dialog>
				<div class="loading-overlay" id="loadingDialogAiState" aria-hidden="true">
					<div class="ripple">
						<div></div>
						<div></div>
					</div>
				</div>
				<div class="toast-container" id="toastContainer"></div>
			</div>
</div>
`;
			}

			buildBoardMarkup() {
				return `
			<div class="panel wheel-wrapper">
				<div class="brand-svg" aria-hidden="true">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" height="67" viewBox="0 0 369 67" width="369" role="presentation">
						<path d="M15.3248 7.93164V25.2241C16.1538 24.1593 17.439 23.233 19.184 22.4453C20.929 21.6577 23.0468 21.2638 25.5267 21.2638C28.0066 21.2638 30.3055 21.6941 32.4197 22.5474C34.5339 23.4044 36.3513 24.6187 37.8682 26.1941C39.3851 27.7694 40.5689 29.6657 41.4197 31.8902C42.2705 34.111 42.694 36.5688 42.694 39.2528C42.694 41.9367 42.2669 44.369 41.4197 46.5461C40.5689 48.7231 39.3634 50.5975 37.7994 52.1729C36.2355 53.7482 34.3855 54.9626 32.2496 55.8195C30.1136 56.6765 27.7351 57.1031 25.114 57.1031C22.4929 57.1031 20.2194 56.6984 18.011 55.8888C15.8063 55.0792 13.8984 53.9087 12.2874 52.3807C10.6763 50.8528 9.40201 48.9784 8.46074 46.7539C7.51946 44.5331 7.04883 42.0315 7.04883 39.2528V7.93164H15.3212H15.3248ZM31.8405 31.613C30.1172 29.8079 27.8075 28.9036 24.9113 28.9036C22.015 28.9036 19.6944 29.8079 17.9459 31.613C16.2009 33.4181 15.3284 35.9416 15.3284 39.1835C15.3284 42.4254 16.2009 44.9488 17.9459 46.7539C19.6908 48.559 22.015 49.4634 24.9113 49.4634C27.8075 49.4634 30.1172 48.559 31.8405 46.7539C33.5637 44.9488 34.4253 42.4254 34.4253 39.1835C34.4253 35.9416 33.5637 33.4181 31.8405 31.613Z" fill="white"/>
						<path d="M79.9648 31.8575C79.114 29.6586 77.9085 27.7842 76.3445 26.2307C74.7805 24.6809 72.9089 23.4775 70.7258 22.6205C68.5428 21.7636 66.1172 21.3369 63.4527 21.3369C60.7882 21.3369 58.3517 21.7672 56.1434 22.6205C53.9386 23.4775 52.0525 24.6809 50.4885 26.2307C48.9246 27.7842 47.719 29.6586 46.8682 31.8575C46.0175 34.0564 45.5939 36.4997 45.5939 39.1836C45.5939 41.8676 46.0175 44.3218 46.8682 46.5462C47.0601 47.0495 47.2737 47.5345 47.5054 48.0049L42.9221 52.6216C41.4595 54.0948 41.4595 56.487 42.9221 57.9603C44.3847 59.4335 46.7596 59.4335 48.2222 57.9603L52.3312 53.8213C53.4716 54.6528 54.7423 55.342 56.1434 55.8853C58.3481 56.7423 60.7846 57.169 63.4527 57.169C66.1209 57.169 68.5428 56.7386 70.7258 55.8853C72.9089 55.0284 74.7805 53.814 76.3445 52.2387C77.9048 50.667 79.114 48.7671 79.9648 46.5426C80.8155 44.3218 81.2391 41.8676 81.2391 39.18C81.2391 36.4924 80.8119 34.0528 79.9648 31.8539V31.8575ZM70.3457 46.8234C68.5971 48.6285 66.2765 49.5329 63.3803 49.5329C60.4841 49.5329 58.1743 48.6285 56.4511 46.8234C54.7278 45.0183 53.8662 42.4948 53.8662 39.2529C53.8662 36.0111 54.7278 33.4876 56.4511 31.6825C58.1743 29.8774 60.4841 28.973 63.3803 28.973C66.2765 28.973 68.5971 29.8774 70.3457 31.6825C72.0907 33.4876 72.9668 36.0111 72.9668 39.2529C72.9668 42.4948 72.0943 45.0183 70.3457 46.8234Z" fill="#27E287"/>
						<path d="M100.271 21.1982C103.12 21.1982 105.546 21.6723 107.544 22.6204C109.542 23.5686 111.186 24.772 112.475 26.2306C113.76 27.6893 114.69 29.2756 115.266 30.9895C115.842 32.7034 116.128 34.3226 116.128 35.8505V56.5453H107.855V36.0584C107.855 34.8076 107.649 33.7427 107.236 32.8639C106.824 31.985 106.27 31.2448 105.582 30.6431C104.894 30.0414 104.087 29.6001 103.167 29.323C102.248 29.0458 101.281 28.9073 100.271 28.9073C99.2608 28.9073 98.2942 29.0458 97.3746 29.323C96.4551 29.6001 95.6514 30.0414 94.9599 30.6431C94.2721 31.2448 93.7182 31.985 93.3055 32.8639C92.8927 33.7427 92.6864 34.8076 92.6864 36.0584V56.5453H84.4141V35.8505C84.4141 34.3226 84.7001 32.7034 85.2757 30.9895C85.8513 29.2756 86.7817 27.6893 88.0669 26.2306C89.3521 24.772 90.9957 23.5686 92.9977 22.6204C94.9961 21.6723 97.4217 21.1982 100.271 21.1982Z" fill="white"/>
						<path d="M135.641 57.1722C132.792 57.1722 130.366 56.6982 128.368 55.75C126.369 54.8019 124.726 53.5985 123.437 52.1398C122.148 50.6812 121.218 49.0949 120.646 47.381C120.07 45.667 119.784 44.0479 119.784 42.52V21.8252H128.057V42.3121C128.057 43.5629 128.263 44.6277 128.676 45.5066C129.088 46.3854 129.642 47.1293 130.33 47.7274C131.018 48.3291 131.822 48.7667 132.745 49.0475C133.664 49.3246 134.627 49.4632 135.641 49.4632C136.655 49.4632 137.618 49.3246 138.537 49.0475C139.457 48.7703 140.26 48.3291 140.952 47.7274C141.643 47.1257 142.194 46.3854 142.606 45.5066C143.019 44.6277 143.225 43.5629 143.225 42.3121V21.8252H151.498V42.52C151.498 44.0479 151.212 45.6707 150.636 47.381C150.061 49.0949 149.13 50.6812 147.845 52.1398C146.556 53.5985 144.916 54.8019 142.914 55.75C140.916 56.6982 138.49 57.1722 135.641 57.1722Z" fill="white"/>
						<path d="M163.426 31.1974C163.426 32.0325 163.886 32.6779 164.806 33.1411C165.725 33.6042 166.884 34.0345 168.288 34.4247C169.689 34.8185 171.195 35.2342 172.803 35.6755C174.41 36.1167 175.916 36.7403 177.317 37.5499C178.718 38.3594 179.88 39.4388 180.8 40.7808C181.72 42.1228 182.179 43.8841 182.179 46.0575C182.179 47.8188 181.846 49.3796 181.18 50.7471C180.514 52.1146 179.584 53.2597 178.389 54.1859C177.194 55.1122 175.779 55.8087 174.15 56.2682C172.517 56.7313 170.714 56.961 168.737 56.961C166.898 56.961 165.233 56.775 163.738 56.4067C162.242 56.0384 160.91 55.5862 159.737 55.0538C158.564 54.5214 157.554 53.9416 156.703 53.318C155.853 52.6944 155.154 52.1474 154.6 51.6843L159.013 45.1568C160.483 46.5462 162.083 47.5891 163.806 48.282C165.53 48.9748 167.242 49.3249 168.944 49.3249C170.366 49.3249 171.55 49.0806 172.495 48.5956C173.436 48.1106 173.907 47.3557 173.907 46.3383C173.907 45.3209 173.447 44.5442 172.528 44.0117C171.608 43.4793 170.446 43.0162 169.045 42.6224C167.644 42.2285 166.138 41.8128 164.531 41.3716C162.919 40.9303 161.417 40.3177 160.016 39.53C158.615 38.7423 157.453 37.714 156.533 36.4376C155.614 35.165 155.154 33.462 155.154 31.3323C155.154 28.1378 156.269 25.6618 158.499 23.9004C160.729 22.1427 163.796 21.2603 167.702 21.2603C169.403 21.2603 170.964 21.4244 172.39 21.7453C173.813 22.0698 175.113 22.4746 176.286 22.9596C177.459 23.4446 178.526 24.0025 179.493 24.6261C180.46 25.2497 181.307 25.8879 182.045 26.537L177.632 32.9952C175.793 31.4672 174.012 30.4024 172.289 29.8007C170.565 29.199 168.991 28.8964 167.564 28.8964C166.232 28.8964 165.207 29.1042 164.498 29.5199C163.785 29.9356 163.43 30.4936 163.43 31.1865L163.426 31.1974Z" fill="white"/>
						<path d="M209.643 18.4377C211.022 17.0738 213.343 16.3883 216.608 16.3883V8.74854C210.906 8.74854 206.598 10.1379 203.68 12.9167C201.146 15.3271 199.716 18.7294 199.379 23.1273H192.819V30.767H199.3V57.8544H207.572V30.767H217.292V23.1273H207.691C207.945 21.0378 208.593 19.477 209.639 18.4377H209.643Z" fill="#27E287"/>
						<path d="M228.877 23.1235H220.605V57.8506H228.877V23.1235Z" fill="#27E287"/>
						<path d="M260.732 27.5363C259.443 26.0776 257.803 24.8742 255.801 23.9261C253.803 22.978 251.377 22.5039 248.528 22.5039C245.679 22.5039 243.253 22.978 241.255 23.9261C239.257 24.8742 237.613 26.0776 236.324 27.5363C235.035 28.995 234.105 30.5812 233.533 32.2952C232.957 34.0091 232.671 35.6282 232.671 37.1562V57.8509H240.944V37.364C240.944 36.1132 241.15 35.0484 241.563 34.1696C241.975 33.2907 242.529 32.5504 243.217 31.9487C243.905 31.347 244.709 30.9058 245.632 30.6287C246.552 30.3515 247.515 30.2129 248.528 30.2129C249.542 30.2129 250.505 30.3515 251.424 30.6287C252.344 30.9058 253.148 31.347 253.839 31.9487C254.527 32.5504 255.081 33.2907 255.494 34.1696C255.906 35.0484 256.113 36.1132 256.113 37.364V57.8509H264.385V37.1562C264.385 35.6282 264.099 34.0091 263.523 32.2952C262.948 30.5812 262.017 28.995 260.732 27.5363Z" fill="#27E287"/>
						<path d="M294.929 26.5258C294.1 25.461 292.815 24.5348 291.066 23.7471C289.318 22.9594 287.204 22.5656 284.724 22.5656C282.244 22.5656 279.941 22.9959 277.827 23.8492C275.713 24.7062 273.895 25.9205 272.379 27.4958C270.862 29.0712 269.678 30.9675 268.827 33.1919C267.976 35.4127 267.553 37.8706 267.553 40.5545C267.553 43.2385 267.976 45.6708 268.827 47.8478C269.678 50.0249 270.883 51.8993 272.447 53.4746C274.008 55.05 275.861 56.2643 277.997 57.1213C280.133 57.9782 282.512 58.4049 285.133 58.4049C287.754 58.4049 290.027 58.0001 292.236 57.1906C294.441 56.381 296.348 55.2104 297.959 53.6825C299.567 52.1545 300.845 50.2802 301.786 48.0557C302.727 45.8349 303.198 43.3333 303.198 40.5545V9.2334H294.926V26.5258H294.929ZM292.312 48.0557C290.563 49.8608 288.243 50.7652 285.346 50.7652C282.45 50.7652 280.14 49.8608 278.417 48.0557C276.694 46.2506 275.832 43.7271 275.832 40.4852C275.832 37.2434 276.694 34.7199 278.417 32.9148C280.14 31.1097 282.45 30.2053 285.346 30.2053C288.243 30.2053 290.563 31.1097 292.312 32.9148C294.057 34.7199 294.933 37.2434 294.933 40.4852C294.933 43.7271 294.06 46.2506 292.312 48.0557Z" fill="#27E287"/>
						<path d="M336.783 27.5359C335.219 25.9861 333.348 24.7827 331.165 23.9257C328.982 23.0687 326.556 22.6421 323.892 22.6421C321.227 22.6421 318.791 23.0724 316.582 23.9257C314.377 24.7827 312.491 25.9861 310.927 27.5359C309.363 29.0894 308.158 30.9638 307.307 33.1627C306.456 35.3616 306.033 37.8049 306.033 40.4888C306.033 43.1728 306.456 45.627 307.307 47.8514C308.158 50.0722 309.363 51.9721 310.927 53.5475C312.488 55.1229 314.374 56.3372 316.582 57.1942C318.791 58.0511 321.223 58.4778 323.892 58.4778C328.073 58.4778 331.624 57.4604 334.546 55.4219C337.464 53.3834 339.499 50.6083 340.65 47.0893H331.617C329.916 49.5909 327.32 50.838 323.826 50.838C321.343 50.838 319.297 50.178 317.69 48.8579C316.079 47.5378 315.047 45.6744 314.587 43.2676H341.548C341.591 42.8044 341.627 42.3523 341.653 41.9147C341.674 41.4734 341.685 40.9994 341.685 40.4925C341.685 37.8085 341.258 35.3653 340.411 33.1663C339.56 30.9674 338.355 29.093 336.791 27.5395L336.783 27.5359ZM315.203 35.6242C315.938 33.9103 317.042 32.5938 318.512 31.6639C319.982 30.7377 321.752 30.2745 323.819 30.2745C325.886 30.2745 327.667 30.7377 329.163 31.6639C330.658 32.5902 331.769 33.9103 332.508 35.6242H315.203Z" fill="#27E287"/>
						<path d="M349.469 26.4933C346.388 29.1554 344.849 33.1266 344.849 38.4033V57.8509H353.121V38.4033C353.121 35.6245 353.903 33.5532 355.467 32.1857C357.028 30.8219 359.189 30.1363 361.948 30.1363V22.4966C356.709 22.4966 352.546 23.8276 349.469 26.4897V26.4933Z" fill="#27E287"/>
						<path d="M224.739 8.74854C223.45 8.74854 222.371 9.20072 221.499 10.1014C220.627 11.0058 220.188 12.0816 220.188 13.3324C220.188 14.6744 220.627 15.7866 221.499 16.6654C222.371 17.5443 223.454 17.9855 224.739 17.9855C226.024 17.9855 227.107 17.5443 227.979 16.6654C228.852 15.7866 229.29 14.6744 229.29 13.3324C229.29 12.0816 228.852 11.0058 227.979 10.1014C227.107 9.19707 226.024 8.74854 224.739 8.74854Z" fill="#27E287"/>
					</svg>
				</div>
				<div class="canvas-container">
					<canvas id="wheelCanvas" class="canvas-wheel" width="600" height="600" aria-hidden="true"></canvas>
				</div>
			</div>
			<div class="roulette-table" id="rouletteBoard">
				<canvas id="roulette" width="2000" height="1640"></canvas>
			</div>
		`;
			}


			renderCanvasWheel() {
				if (!this.wheelCanvasCtx || !this.wheelOrder?.length) {
					return;
				}
				const canvas = this.wheelCanvas;
				const ctx = this.wheelCanvasCtx;
				const styleWidth = canvas.clientWidth || 600;
				const styleHeight = canvas.clientHeight || 600;
				const devicePixelRatio = window.devicePixelRatio || 1;
				canvas.width = styleWidth * devicePixelRatio;
				canvas.height = styleHeight * devicePixelRatio;
				ctx.scale(devicePixelRatio, devicePixelRatio);
				const { width, height } = { width: styleWidth, height: styleHeight };
				const centerX = width / 2;
				const centerY = height / 2;
				const outerRadius = Math.min(centerX, centerY) - 4;
				// Skip rendering if wheel is too small (prevents negative values)
				if (outerRadius < 50) return;
				const scaleFactor = outerRadius / 300; // Proportional scaling
				const rimRadius = outerRadius * 0.96;
				const bandOuter = rimRadius * 0.85;
				const bandInner = bandOuter * 0.84;
				const pocketOuter = bandInner * 0.98;
				const pocketInner = pocketOuter * 0.75;
				const accentOuter = pocketInner * 0.99;
				const hubRadius = accentOuter * 0.6;
				const indicatorRadius = hubRadius * 0.8;
				const slice = (Math.PI * 2) / this.wheelOrder.length;
				ctx.clearRect(0, 0, width, height);


				// Apply wheel rotation
				ctx.save();
				ctx.translate(centerX, centerY);
				ctx.rotate(this.wheelRotation || 0);
				ctx.translate(-centerX, -centerY);
				const drawCircle = ({
										radius,
										fill = '#000',
										stroke = null,
										strokeWidth = 1,
										shadowOptions = false,
									}) => {

					ctx.save();
					if (shadowOptions) {
						ctx.shadowColor = shadowOptions.shadowColor;
						ctx.shadowBlur = shadowOptions.shadowBlur;
						ctx.shadowOffsetX = shadowOptions.shadowOffsetX;
						ctx.shadowOffsetY = shadowOptions.shadowOffsetY;
					}

					ctx.beginPath();
					ctx.fillStyle = fill;
					ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
					ctx.fill();

					if (stroke) {
						ctx.strokeStyle = stroke;
						ctx.lineWidth = strokeWidth;
						ctx.stroke();
					}
					ctx.restore();
				};

				// Dynamic rim gradient - light source at top-right
				const wheelRot = this.wheelRotation || 0;
				const rimLightAngle = -Math.PI / 4; // Fixed light at top-right
				const rimHighlightX = centerX + Math.cos(rimLightAngle) * outerRadius * 0.3;
				const rimHighlightY = centerY + Math.sin(rimLightAngle) * outerRadius * 0.3;

				// Dynamic gold bar gradient - counter-rotate to appear fixed during wheel spin
				const goldBarLightAngle = rimLightAngle - wheelRot; // Counter-rotate based on wheel position
				const goldBarGradient = ctx.createConicGradient(goldBarLightAngle, centerX, centerY);

				// Color stops arranged so highlight faces the light source
				goldBarGradient.addColorStop(0, '#ffdb6a');    // Bright highlight (facing light)
				goldBarGradient.addColorStop(0.1, '#fccb3c');  // Light gold
				goldBarGradient.addColorStop(0.25, '#f7a700'); // Medium gold
				goldBarGradient.addColorStop(0.4, '#d59d00');  // Shadow (deep gold)
				goldBarGradient.addColorStop(0.5, '#b8860b');  // Darkest shadow (away from light)
				goldBarGradient.addColorStop(0.6, '#d59d00');  // Coming back to light
				goldBarGradient.addColorStop(0.75, '#e2b700'); // Warming up
				goldBarGradient.addColorStop(0.85, '#fccb3c');  // Light gold
				goldBarGradient.addColorStop(1, '#ffdb6a');    // Back to highlight


				// Dynamic golden borders gradient - counter-rotate for 3D effect during wheel spin
				const goldenBordersGradient = ctx.createConicGradient(goldBarLightAngle, centerX, centerY);

				// Color stops arranged for realistic 3D metallic effect - highlight faces light source

				goldenBordersGradient.addColorStop(0, '#d9b34d');    // Darker gold highlight (facing light)
				goldenBordersGradient.addColorStop(0.3, '#b57e2b');  // Darker gold (slightly deeper)
				goldenBordersGradient.addColorStop(0.7, '#9a6a2a');  // Warm, deeper gold (a bit shadowed)
				goldenBordersGradient.addColorStop(1, '#d9b34d');    // Darker gold highlight (slightly warmer)




				// Dynamic gold gradient - counter-rotate to appear fixed during wheel spin
				const goldGradient = ctx.createConicGradient(goldBarLightAngle, centerX, centerY);

				// Color stops for smooth 3D gold effect
				goldGradient.addColorStop(0, '#ffe082');    // Bright highlight (facing light)
				goldGradient.addColorStop(0.2, '#fccb3c');  // Light gold
				goldGradient.addColorStop(0.4, '#f6b400');  // Medium gold
				goldGradient.addColorStop(0.5, '#c99a2e');  // Shadow
				goldGradient.addColorStop(0.6, '#f6b400');  // Coming back
				goldGradient.addColorStop(0.8, '#fccb3c');  // Light gold
				goldGradient.addColorStop(1, '#ffe082');    // Back to highlight

				// Handle gradient - subtle gold with minimal rotation variation
				const handleGradient = ctx.createConicGradient(goldBarLightAngle, centerX, centerY);
				handleGradient.addColorStop(0, "#ffd54f");     // Warm gold
				handleGradient.addColorStop(0.15, "#ffca28");  // Medium gold
				handleGradient.addColorStop(0.3, "#ffc107");   // Rich gold
				handleGradient.addColorStop(0.5, "#e6a800");   // Slightly darker
				handleGradient.addColorStop(0.7, "#ffc107");   // Rich gold
				handleGradient.addColorStop(0.85, "#ffca28");  // Medium gold
				handleGradient.addColorStop(1, "#ffd54f");     // Warm gold

				// Dynamic wood gradient - conic with light reflection effect
				const woodLightAngle = rimLightAngle - wheelRot; // Counter-rotate to appear fixed
				const woodGradeinte = ctx.createConicGradient(woodLightAngle, centerX, centerY);
				woodGradeinte.addColorStop(0, '#8b2520');       // Highlight (facing light)
				woodGradeinte.addColorStop(0.25, '#6f1d1b');    // Base
				woodGradeinte.addColorStop(0.5, '#4a1210');     // Shadow (away from light)
				woodGradeinte.addColorStop(0.75, '#6f1d1b');    // Base
				woodGradeinte.addColorStop(1, '#8b2520');       // Highlight (back to start)
				drawCircle({ radius: outerRadius, fill: goldGradient });
				drawCircle({ radius: rimRadius, fill: woodGradeinte, shadowOptions: { shadowColor: 'rgba(0,0,0,0.9)', shadowBlur: 6, shadowOffsetX: 0, shadowOffsetY: 0 } });
				//drawCircle({ radius: bandOuter, fill: '#fcd34d' });

				// 1. Draw golden rim
				ctx.save();
				ctx.beginPath();
				ctx.arc(centerX, centerY, bandOuter * 0.96, 0, Math.PI * 2);
				ctx.lineWidth = 15 * scaleFactor;
				ctx.strokeStyle = goldBarGradient;
				ctx.stroke();
				ctx.restore();


// 2. Add inset shadow INSIDE the ring
				ctx.save();

// Create a RING-shaped clip region (outer arc + inner arc reversed)
				ctx.beginPath();
				ctx.arc(centerX, centerY, bandOuter * 0.96, 0, Math.PI * 2);      // outer edge
				ctx.arc(centerX, centerY, bandOuter * 0.96 - (13 * scaleFactor), 0, Math.PI * 2, true); // inner edge (reverse)
				ctx.clip();


// Draw a large invisible circle to cast shadow inward
				ctx.beginPath();
				ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
				ctx.shadowBlur = 30 * scaleFactor;
				ctx.shadowOffsetX = 0;
				ctx.shadowOffsetY = 0;

				ctx.arc(centerX, centerY, bandOuter * 1.5, 0, Math.PI * 2);

				// Fill nothing: only the shadow matters
				ctx.fillStyle = "rgba(0,0,0,0)";
				ctx.fill();

				ctx.restore();

				drawCircle({ radius: bandInner, fill: woodGradeinte });
				// 8 diamonds
				for (let i = 0; i < 8; i += 1) {
					const angle = (Math.PI / 4) * i;
					const markerRadius = rimRadius * 0.910;
					const widthMarker = outerRadius * 0.05;
					const heightMarker = widthMarker * 2.2;
					const x = centerX + Math.cos(angle) * markerRadius;
					const y = centerY + Math.sin(angle) * markerRadius;

					ctx.save();
					ctx.translate(x, y);
					ctx.rotate(angle);

					// Dynamic shadow - light from top-right
					const wheelAngle = this.wheelRotation || 0;
					const lightAngle = -Math.PI / 4;
					const shadowAngle = lightAngle + Math.PI - wheelAngle - angle;
					const shadowDist = 3 * scaleFactor;
					ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
					ctx.shadowBlur = 4 * scaleFactor;
					ctx.shadowOffsetX = Math.cos(shadowAngle) * shadowDist;
					ctx.shadowOffsetY = Math.sin(shadowAngle) * shadowDist;

					// Create conic gradient for gem-like effect
					// Dynamic conic gradient - rotate based on wheel position relative to light
					// The brightest part should face the light source (top-right)
					const localLightDir = lightAngle - wheelAngle - angle;
					const conicGrad = ctx.createConicGradient(localLightDir + Math.PI / 2, 0, 0);
					conicGrad.addColorStop(0, '#fff9c4');      // Light yellow
					conicGrad.addColorStop(0.15, '#ffeb3b');   // Yellow
					conicGrad.addColorStop(0.3, '#ffc107');    // Amber
					conicGrad.addColorStop(0.5, '#ff8f00');    // Dark amber
					conicGrad.addColorStop(0.65, '#ffc107');   // Amber
					conicGrad.addColorStop(0.8, '#ffeb3b');    // Yellow
					conicGrad.addColorStop(1, '#fff9c4');      // Light yellow

					// Draw full diamond with conic gradient
					ctx.beginPath();
					ctx.moveTo(-widthMarker / 2, 0);
					ctx.lineTo(0, -heightMarker / 2);
					ctx.lineTo(widthMarker / 2, 0);
					ctx.lineTo(0, heightMarker / 2);
					ctx.closePath();
					ctx.fillStyle = conicGrad;
					ctx.fill();

					// Center highlight for extra sparkle
					ctx.shadowColor = "transparent";
					ctx.beginPath();
					ctx.moveTo(-widthMarker / 5, 0);
					ctx.lineTo(0, -heightMarker / 5);
					ctx.lineTo(widthMarker / 5, 0);
					ctx.closePath();
					ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
					ctx.fill();

					// Outline
					ctx.beginPath();
					ctx.moveTo(-widthMarker / 2, 0);
					ctx.lineTo(0, -heightMarker / 2);
					ctx.lineTo(widthMarker / 2, 0);
					ctx.lineTo(0, heightMarker / 2);
					ctx.closePath();
					ctx.strokeStyle = '#b8860b';
					ctx.stroke();

					ctx.restore();
				}

				// Fixed light source at top-right (in world space)
				const lightSourceAngle = -Math.PI / 4; // Top-right
				const wheelRotation = this.wheelRotation || 0;

				// First pass: Draw all segment fills with dynamic gradients
				this.wheelOrder.forEach((value, index) => {
					const startAngle = index * slice - Math.PI / 2;
					const endAngle = startAngle + slice;
					const midAngle = (startAngle + endAngle) / 2;
					const isGreen = value === '0' || value === '00';
					const isRed = this.redNumbers.includes(String(value));
					const isBlack = !isGreen && !isRed;

					// Calculate world-space angle of this segment (accounting for wheel rotation)
					const worldAngle = midAngle + wheelRotation;

					// Calculate how "lit" this segment is (0 = dark side, 1 = bright side)
					// Cosine of angle difference gives smooth falloff
					let angleDiff = worldAngle - lightSourceAngle;
					// Normalize to -PI to PI
					while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
					while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

					// Brightness: 1 when facing light, 0 when facing away
					const brightness = (Math.cos(angleDiff) + 1) / 2; // 0 to 1
					const shadowIntensity = 1 - brightness; // Inverse for shadow side

					ctx.beginPath();

					// Check if this pocket should be highlighted (opening effect)
					if (this.highlightedPocket === index && this.pocketAnimActive && this.pocketOpenProgress !== undefined) {
						const progress = this.pocketOpenProgress;

						const gradientInnerRadius = pocketInner - (10 * scaleFactor);
						const gradientOuterRadius = pocketOuter + (25 * scaleFactor);

						const gradient = ctx.createRadialGradient(
							centerX, centerY, gradientInnerRadius,
							centerX, centerY, gradientOuterRadius
						);

						// Pocket opening effect - shadow on INNER edge (facing center)
						// Simulates pocket tilting down toward center as ball enters
						const shadowIntensity = progress; // 0 = closed, 1 = fully open

						// Calculate base colors from dynamic gradient (same as normal segment)
						// This ensures closing animation ends with same gradient as field
						const baseHighlight = Math.floor(20 + brightness * 30);
						const baseMid = Math.floor(10 + brightness * 15);
						const baseVal = Math.floor(8 + brightness * 8);
						const baseDark = Math.floor(3 + brightness * 5);

						if (isBlack) {
							// Black pocket - VISIBLE GRAY shadow with MORE SPREAD
							const shadowDepth = 0.12 + (shadowIntensity * 0.18); // More spread: 12% to 30%
							const grayVal = Math.floor(55 + shadowIntensity * 35); // Brighter gray (55-90)

							// Inner shadow colors
							gradient.addColorStop(0, `rgb(${grayVal}, ${grayVal}, ${grayVal})`);
							gradient.addColorStop(shadowDepth * 0.3, `rgb(${grayVal - 15}, ${grayVal - 15}, ${grayVal - 15})`);
							gradient.addColorStop(shadowDepth * 0.6, `rgb(${grayVal - 30}, ${grayVal - 30}, ${grayVal - 30})`);
							gradient.addColorStop(shadowDepth, `rgb(${Math.floor(15 + shadowIntensity * 10)}, ${Math.floor(15 + shadowIntensity * 10)}, ${Math.floor(15 + shadowIntensity * 10)})`);
							// Transition to normal gradient colors
							gradient.addColorStop(Math.min(shadowDepth + 0.15, 0.5), `rgb(${baseMid}, ${baseMid}, ${baseMid})`);
							gradient.addColorStop(Math.min(shadowDepth + 0.3, 0.7), `rgb(${baseVal}, ${baseVal}, ${baseVal})`);
							gradient.addColorStop(1, `rgb(${baseDark}, ${baseDark}, ${baseDark})`);
						} else if (isGreen) {
							// Green pocket - shadow blends to normal green gradient
							const shadowDepth = 0.15 + (shadowIntensity * 0.15);
							const shadowVal = Math.floor(5 + (shadowIntensity * 10));
							const gHighlight = Math.floor(50 + brightness * 30);
							const gMid = Math.floor(140 + brightness * 20);
							const gDark = Math.floor(70 + brightness * 20);

							gradient.addColorStop(0, `rgb(${shadowVal-3}, ${shadowVal}, ${shadowVal-3})`);
							gradient.addColorStop(shadowDepth * 0.5, '#050a05');
							gradient.addColorStop(shadowDepth, '#0a150a');
							gradient.addColorStop(Math.min(shadowDepth + 0.12, 0.5), `rgb(26, 69, 32)`);
							gradient.addColorStop(Math.min(shadowDepth + 0.25, 0.7), `rgb(38, 112, 53)`);
							gradient.addColorStop(1, `rgb(${Math.floor(20 + brightness * 10)}, ${gDark}, ${Math.floor(30 + brightness * 10)})`);
						} else {
							// Red pocket - shadow blends to normal red gradient
							const shadowDepth = 0.10 + (shadowIntensity * 0.15);
							const shadowVal = Math.floor(15 + (shadowIntensity * 25));
							const rHighlight = Math.floor(200 + brightness * 55);
							const rDark = Math.floor(100 + brightness * 30);

							gradient.addColorStop(0, `rgb(${shadowVal + 10}, ${shadowVal - 5}, ${shadowVal - 5})`);
							gradient.addColorStop(shadowDepth * 0.3, `rgb(${shadowVal}, ${shadowVal - 10}, ${shadowVal - 10})`);
							gradient.addColorStop(shadowDepth * 0.6, '#1a0808');
							gradient.addColorStop(shadowDepth, '#280c0c');
							gradient.addColorStop(Math.min(shadowDepth + 0.1, 0.45), `rgb(96, 24, 24)`);
							gradient.addColorStop(Math.min(shadowDepth + 0.2, 0.6), `rgb(176, 16, 16)`);
							gradient.addColorStop(1, `rgb(${rDark}, ${Math.floor(5 + brightness * 10)}, ${Math.floor(5 + brightness * 10)})`);
						}
						ctx.fillStyle = gradient;
					} else {
						const segmentMidRadius = (pocketInner - (10 * scaleFactor) + pocketOuter + (25 * scaleFactor)) / 2;

						// Light comes from fixed world position, but we're in rotated space
						// So offset the local light position by negative rotation
						const localLightAngle = lightSourceAngle - wheelRotation;
						const lightX = centerX + Math.cos(localLightAngle) * segmentMidRadius * 0.8;
						const lightY = centerY + Math.sin(localLightAngle) * segmentMidRadius * 0.8;

						const gradient = ctx.createRadialGradient(
							lightX, lightY, 0,
							centerX, centerY, segmentMidRadius * 2
						);

						// Dynamic color stops based on brightness
						if (isBlack) {
							// Beautiful black with subtle blue/purple tint and metallic shine
							const shine = Math.floor(45 + brightness * 60); // Brighter highlight
							const midShine = Math.floor(25 + brightness * 35);
							const base = Math.floor(12 + brightness * 18);
							const dark = Math.floor(5 + brightness * 8);
							// Add subtle cool tint for depth
							const blueTint = Math.floor(brightness * 12);
							gradient.addColorStop(0, `rgb(${shine}, ${shine + blueTint}, ${shine + blueTint * 2})`);
							gradient.addColorStop(0.15, `rgb(${midShine}, ${midShine + 3}, ${midShine + 8})`);
							gradient.addColorStop(0.4, `rgb(${base + 2}, ${base + 4}, ${base + 8})`);
							gradient.addColorStop(0.7, `rgb(${base}, ${base}, ${base + 3})`);
							gradient.addColorStop(1, `rgb(${dark}, ${dark}, ${dark + 2})`);
						} else if (isGreen) {
							// Rich emerald green with golden highlights
							const hR = Math.floor(70 + brightness * 80); // More yellow in highlight
							const hG = Math.floor(200 + brightness * 55); // Brighter green
							const hB = Math.floor(60 + brightness * 40);
							const mG = Math.floor(150 + brightness * 30);
							const dR = Math.floor(15 + brightness * 15);
							const dG = Math.floor(80 + brightness * 30);
							const dB = Math.floor(25 + brightness * 15);
							gradient.addColorStop(0, `rgb(${hR}, ${hG}, ${hB})`);
							gradient.addColorStop(0.12, `rgb(${Math.floor(55 + brightness * 25)}, ${Math.floor(175 + brightness * 35)}, ${Math.floor(70 + brightness * 20)})`);
							gradient.addColorStop(0.35, `rgb(40, ${mG}, 55)`);
							gradient.addColorStop(0.6, `rgb(30, 120, 45)`);
							gradient.addColorStop(0.85, `rgb(${dR + 5}, ${dG + 10}, ${dB})`);
							gradient.addColorStop(1, `rgb(${dR}, ${dG}, ${dB})`);
						} else {
							// Rich ruby red with warm orange highlights
							const hR = Math.floor(255); // Pure bright red highlight
							const hG = Math.floor(80 + brightness * 70); // Orange tint in highlight
							const hB = Math.floor(60 + brightness * 50);
							const mR = Math.floor(200 + brightness * 30);
							const dR = Math.floor(120 + brightness * 40);
							const dG = Math.floor(8 + brightness * 15);
							const dB = Math.floor(8 + brightness * 15);
							gradient.addColorStop(0, `rgb(${hR}, ${hG}, ${hB})`);
							gradient.addColorStop(0.12, `rgb(${Math.floor(240 + brightness * 15)}, ${Math.floor(50 + brightness * 30)}, ${Math.floor(40 + brightness * 20)})`);
							gradient.addColorStop(0.35, `rgb(${mR}, 25, 25)`);
							gradient.addColorStop(0.6, `rgb(180, 15, 15)`);
							gradient.addColorStop(0.85, `rgb(${dR + 20}, ${dG}, ${dB})`);
							gradient.addColorStop(1, `rgb(${dR}, ${dG}, ${dB})`);
						}
						ctx.fillStyle = gradient;
					}

					ctx.arc(centerX, centerY, pocketOuter + (25 * scaleFactor), startAngle, endAngle);
					ctx.arc(centerX, centerY, pocketInner - (10 * scaleFactor), endAngle, startAngle, true);
					ctx.closePath();
					ctx.fill();

					// Dynamic shine overlay based on light position
					if (!(this.highlightedPocket === index && this.pocketAnimActive)) {
						// Only show shine on segments facing the light
						if (brightness > 0.5) {
							ctx.save();
							ctx.beginPath();
							ctx.arc(centerX, centerY, pocketOuter + (25 * scaleFactor), startAngle, endAngle);
							ctx.arc(centerX, centerY, pocketInner - (10 * scaleFactor), endAngle, startAngle, true);
							ctx.closePath();
							ctx.clip();

							const localLightAngle = lightSourceAngle - wheelRotation;
							const shineX = centerX + Math.cos(localLightAngle) * (pocketOuter - 10);
							const shineY = centerY + Math.sin(localLightAngle) * (pocketOuter - 10);
							const shineGradient = ctx.createRadialGradient(
								shineX, shineY, 0,
								shineX, shineY, (pocketOuter - pocketInner) * 1.2
							);

							const shineIntensity = (brightness - 0.5) * 2; // 0-1 for bright half
							if (isBlack) {
								shineGradient.addColorStop(0, `rgba(255, 250, 220, ${0.12 * shineIntensity})`);
							} else if (isGreen) {
								shineGradient.addColorStop(0, `rgba(200, 255, 200, ${0.18 * shineIntensity})`);
							} else {
								shineGradient.addColorStop(0, `rgba(255, 200, 200, ${0.18 * shineIntensity})`);
							}
							shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

							ctx.fillStyle = shineGradient;
							ctx.fill();
							ctx.restore();
						}
					}

					// Add inner shadow effect for highlighted pocket
					if (this.highlightedPocket === index && this.pocketAnimActive) {
						const progress = this.pocketOpenProgress;

						ctx.save();
						ctx.beginPath();
						ctx.arc(centerX, centerY, pocketInner + 5, startAngle, endAngle);
						ctx.arc(centerX, centerY, pocketInner - (10 * scaleFactor), endAngle, startAngle, true);
						ctx.closePath();
						ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * progress})`;
						ctx.fill();
						ctx.restore();
					}
				});
				// Second pass: Draw divider lines separately (one line per boundary)
				ctx.strokeStyle = goldBarGradient;
				ctx.lineWidth = 4;
				for (let i = 0; i < this.wheelOrder.length; i++) {
					const angle = i * slice - Math.PI / 2;
					const innerX = centerX + Math.cos(angle) * (pocketInner );
					const innerY = centerY + Math.sin(angle) * (pocketInner );
					const outerX = centerX + Math.cos(angle) * (pocketOuter + (25 * scaleFactor));
					const outerY = centerY + Math.sin(angle) * (pocketOuter + (25 * scaleFactor));

					ctx.beginPath();
					ctx.moveTo(innerX, innerY);
					ctx.lineTo(outerX, outerY);
					ctx.stroke();
				}

				// Third pass: Draw numbers
				this.wheelOrder.forEach((value, index) => {
					const startAngle = index * slice - Math.PI / 2;
					const isGreen = value === '0' || value === '00';

					const textAngle = startAngle + slice / 2;
					const numberRadius = pocketOuter + (8 * scaleFactor);
					const labelX = centerX + Math.cos(textAngle) * numberRadius;
					const labelY = centerY + Math.sin(textAngle) * numberRadius;

					ctx.save();
					ctx.translate(labelX, labelY);
					ctx.rotate(textAngle + Math.PI / 2);
					ctx.font = `800 ${Math.max(11, pocketOuter * 0.08)}px "Inter", "Segoe UI", sans-serif`;
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					const numberFill = isGreen ? '#0c1712' : '#fffef2';
					ctx.fillStyle = numberFill;
					ctx.shadowColor = 'rgba(0,0,0,0.45)';
					ctx.shadowBlur = 4 * scaleFactor;
					ctx.lineWidth = 2;
					ctx.strokeStyle = numberFill === '#fffef2' ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.5)';
					ctx.strokeText(value, 0, 0);
					ctx.fillText(value, 0, 0);
					ctx.restore();
				});

				ctx.save();
				ctx.strokeStyle = goldBarGradient;
				ctx.lineWidth = 4;
				ctx.beginPath();
				ctx.arc(centerX, centerY, pocketOuter - (6 * scaleFactor), 0, Math.PI * 2);
				ctx.stroke();
				ctx.restore();

				ctx.stroke();
				ctx.beginPath();
				ctx.arc(centerX, centerY, pocketInner + (2 * scaleFactor) , 0, Math.PI * 2);
				ctx.stroke();
				ctx.restore();


				ctx.save();
				ctx.strokeStyle = goldenBordersGradient;
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.arc(centerX, centerY, pocketOuter - (4 * scaleFactor), 0, Math.PI * 2);
				ctx.stroke();
				ctx.restore();

				ctx.save();
				ctx.strokeStyle = goldenBordersGradient;
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.arc(centerX, centerY, pocketOuter - (4 * scaleFactor), 0, Math.PI * 2);
				ctx.stroke();
				ctx.restore();

				ctx.save();
				ctx.strokeStyle = goldenBordersGradient;
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.arc(centerX, centerY, pocketOuter + (25 * scaleFactor), 0, Math.PI * 2);
				ctx.stroke();
				ctx.restore();



				ctx.restore();
				// Draw ball if visible (on top of wheel, after rotation restore)
				const ballOpacity = this.ballOpacity !== undefined ? this.ballOpacity : 1;
				if (this.ballVisible) {
					ctx.save();
					ctx.globalAlpha = ballOpacity;
					const ballScale = this.ballScale !== undefined ? this.ballScale : 1;
					const ballRadius = Math.max(4, outerRadius * 0.033) * ballScale; // Scale ball with wheel size
					const ballTrajectoryRadius = (this.ballRadiusRatio || 0) * outerRadius;
					const ballX = centerX + Math.cos(this.ballAngle) * ballTrajectoryRadius;
					const ballY = centerY + Math.sin(this.ballAngle) * ballTrajectoryRadius;

					// Ball shadow
					ctx.beginPath();
					ctx.arc(ballX + ballRadius * 0.3, ballY + ballRadius * 0.3, ballRadius, 0, Math.PI * 2);
					ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
					ctx.fill();

					// Ball gradient
					const ballGradient = ctx.createRadialGradient(
							ballX - ballRadius * 0.3, ballY - ballRadius * 0.3, 0,
							ballX, ballY, ballRadius
					);
					ballGradient.addColorStop(0, '#ffffff');
					ballGradient.addColorStop(0.3, '#f0f0f0');
					ballGradient.addColorStop(0.7, '#c0c0c0');
					ballGradient.addColorStop(1, '#808080');

					ctx.beginPath();
					ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
					ctx.fillStyle = ballGradient;
					ctx.fill();

					// Ball highlight
					ctx.beginPath();
					ctx.arc(ballX - ballRadius * 0.3, ballY - ballRadius * 0.3, ballRadius * 0.4, 0, Math.PI * 2);
					ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
					ctx.fill();

					// Ball outline
					ctx.beginPath();
					ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
					ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
					ctx.lineWidth = 1;
					ctx.stroke();
					ctx.restore(); // Restore globalAlpha after ball drawing
				}
				// Dynamic red gradient - rotate opposite to wheel to appear fixed
				const redGradientAngle = -(this.wheelRotation || 0); // Counter-rotate to appear static
				const redGradient = ctx.createConicGradient(redGradientAngle - Math.PI / 4, centerX, centerY);

// Define color stops for the conical gradient
				redGradient.addColorStop(0.1, '#7e0914');       // Starting point (base color)
				redGradient.addColorStop(0.4, '#5b0610');     // Midway (darker shade of red)
				redGradient.addColorStop(0.8, '#7e0914');

				// Draw accent RING on top of ball (donut shape - only covers ball area)
				const accentOuterTop = pocketInner * 0.99;
				const accentInnerTop = accentOuterTop * 0.75; // Inner edge - hub shows through
				ctx.save();
				ctx.translate(centerX, centerY);
				ctx.rotate(this.wheelRotation || 0);
				ctx.translate(-centerX, -centerY);
				// Draw ring (annulus) - outer circle minus inner circle
				ctx.beginPath();
				ctx.arc(centerX, centerY, accentOuterTop* 1.02 , 0, Math.PI * 2);

				ctx.fillStyle = woodGradeinte;
				ctx.fill();
				ctx.restore();

				// Draw pocket divider lines ON TOP (higher z-index than ball)
				ctx.save();
				ctx.translate(centerX, centerY);
				ctx.rotate(this.wheelRotation || 0);
				ctx.translate(-centerX, -centerY);
				ctx.beginPath();
				ctx.strokeStyle = "rgba(255,255,255,0.35)";
				ctx.lineWidth = 1.8;
				// Draw 8 lines at same angles as handles (every 45 degrees)
				for (let i = 0; i < 8; i += 1) {
					const angle = (Math.PI / 4) * i; // Same angles as handles
					ctx.moveTo(centerX + Math.cos(angle) * pocketInner, centerY + Math.sin(angle) * pocketInner);
					ctx.lineTo(centerX + Math.cos(angle) * 70, centerY + Math.sin(angle) * 70); // Stop 80px before center
				}
				ctx.stroke();
				ctx.restore();


				// Draw hub circles ON TOP
				ctx.save();
				ctx.translate(centerX, centerY);
				ctx.rotate(this.wheelRotation || 0);
				ctx.translate(-centerX, -centerY);
				ctx.beginPath();
				ctx.arc(centerX, centerY, 40 * scaleFactor, 0, Math.PI * 2);
				ctx.fillStyle = goldGradient;
				ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
				ctx.shadowBlur = 15 * scaleFactor;
				ctx.shadowOffsetX = 0;
				ctx.shadowOffsetY = 0;
				ctx.fill();

				ctx.save();
				ctx.translate(centerX, centerY);
				ctx.rotate(this.wheelRotation || 0);
				ctx.translate(-centerX, -centerY);
				// Draw 4 LONGER handles first (even indices: 0, 2, 4, 6)
				for (let i = 0; i < 8; i += 2) {
					const angle = (Math.PI / 4) * i;

					// Calculate brightness based on handle's world position relative to light
					const worldAngle = angle + (this.wheelRotation || 0);
					let angleDiff = worldAngle - rimLightAngle;
					while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
					while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
					const brightness = (Math.cos(angleDiff) + 1) / 2; // 0 to 1

					// Scale sizes based on outerRadius for responsive design
					const outerReach = hubRadius * 0.95;
					const lineThickness = Math.max(3, outerRadius * 0.018);
					const pillLength = outerRadius * 0.18;
					const pillWidth = outerRadius * 0.035;
					const cornerRadiusX = pillLength * 0.33;
					const cornerRadiusY = pillWidth * 0.84;

					const innerX = centerX + Math.cos(angle) * hubRadius * 0.25;
					const innerY = centerY + Math.sin(angle) * hubRadius * 0.25;
					const outerX = centerX + Math.cos(angle) * outerReach;
					const outerY = centerY + Math.sin(angle) * outerReach;


					const lineGradient = ctx.createLinearGradient(innerX, innerY, outerX, outerY);
					const shine = brightness * 0.25 + 0.75; // 0.75-1.0 (brighter)
					lineGradient.addColorStop(0, `rgb(${Math.floor(200 * shine)}, ${Math.floor(160 * shine)}, ${Math.floor(50 * shine)})`);
					lineGradient.addColorStop(0.15, `rgb(${Math.floor(255 * shine)}, ${Math.floor(210 * shine)}, ${Math.floor(80 * shine)})`);
					lineGradient.addColorStop(0.5, `rgb(${Math.floor(255 * shine)}, ${Math.floor(220 * shine)}, ${Math.floor(100 * shine)})`);
					lineGradient.addColorStop(0.85, `rgb(${Math.floor(255 * shine)}, ${Math.floor(200 * shine)}, ${Math.floor(70 * shine)})`);
					lineGradient.addColorStop(1, `rgb(${Math.floor(180 * shine)}, ${Math.floor(140 * shine)}, ${Math.floor(40 * shine)})`);

					// Draw the spoke line
					ctx.save();
					ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
					ctx.shadowBlur = Math.max(2, outerRadius * 0.01);
					ctx.shadowOffsetX = 0;
					ctx.shadowOffsetY = 0;
					ctx.beginPath();
					ctx.strokeStyle = handleGradient;
					ctx.lineWidth = lineThickness;
					ctx.lineCap = "round";
					ctx.moveTo(innerX, innerY);
					ctx.lineTo(outerX, outerY);
					ctx.stroke();
					ctx.restore();

					// Draw rounded rectangle with elliptical corners (pill shape)
					ctx.save();
					ctx.translate(outerX, outerY);
					ctx.rotate(angle);

					// Dynamic ELLIPSE gradient - 3D metallic effect
					const halfW = pillLength / 2;
					const halfH = pillWidth / 2;
					const rx = Math.max(0.1, Math.min((cornerRadiusX - (4 * scaleFactor)), (halfW - (11 * scaleFactor))));
					const ry = Math.max(0.1, Math.min(cornerRadiusY, halfH));


					// Create gradient perpendicular to pill - polished golden 3D metallic
					const pillGradient = ctx.createLinearGradient(0, -halfH * 1.5, 0, halfH * 1.5);
					const glow = brightness * 0.2 + 0.8; // 0.8-1.0 (brighter)
					// Top edge highlight (bright gold/white)
					pillGradient.addColorStop(0, `rgb(${Math.floor(255 * glow)}, ${Math.floor(255 * glow)}, ${Math.floor(240 * glow)})`);
					pillGradient.addColorStop(0.1, `rgb(${Math.floor(255 * glow)}, ${Math.floor(250 * glow)}, ${Math.floor(200 * glow)})`);
					// Upper surface (bright gold)
					pillGradient.addColorStop(0.25, `rgb(${Math.floor(255 * glow)}, ${Math.floor(235 * glow)}, ${Math.floor(150 * glow)})`);
					// Center shadow (darker gold)
					pillGradient.addColorStop(0.5, `rgb(${Math.floor(220 * glow)}, ${Math.floor(180 * glow)}, ${Math.floor(80 * glow)})`);
					// Lower surface (medium gold)
					pillGradient.addColorStop(0.75, `rgb(${Math.floor(255 * glow)}, ${Math.floor(230 * glow)}, ${Math.floor(140 * glow)})`);
					// Bottom edge highlight (bright gold)
					pillGradient.addColorStop(0.9, `rgb(${Math.floor(255 * glow)}, ${Math.floor(250 * glow)}, ${Math.floor(190 * glow)})`);
					pillGradient.addColorStop(1, `rgb(${Math.floor(255 * glow)}, ${Math.floor(245 * glow)}, ${Math.floor(180 * glow)})`);

					ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
					ctx.shadowBlur = Math.max(2, outerRadius * 0.015);
					ctx.shadowOffsetX = 0;
					ctx.shadowOffsetY = 0;

					ctx.beginPath();
					ctx.fillStyle = handleGradient;

					// Draw rounded rectangle with elliptical corners
					ctx.moveTo(-halfW + rx, -halfH);
					ctx.lineTo(halfW - rx, -halfH);
					ctx.ellipse(halfW - rx, -halfH + ry, rx, ry, 0, -Math.PI/2, 0);
					ctx.lineTo(halfW, halfH - ry);
					ctx.ellipse(halfW - rx, halfH - ry, rx, ry, 0, 0, Math.PI/2);
					ctx.lineTo(-halfW + rx, halfH);
					ctx.ellipse(-halfW + rx, halfH - ry, rx, ry, 0, Math.PI/2, Math.PI);
					ctx.lineTo(-halfW, -halfH + ry);
					ctx.ellipse(-halfW + rx, -halfH + ry, rx, ry, 0, Math.PI, Math.PI * 1.5);
					ctx.closePath();
					ctx.fill();
					ctx.restore();
				}

				// Hub center circle
				ctx.beginPath();
				ctx.arc(centerX, centerY, Math.max(15, outerRadius * 0.1), 0, Math.PI * 2);
				ctx.fillStyle = goldBarGradient;
				ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
				ctx.shadowBlur = Math.max(8, outerRadius * 0.05);
				ctx.shadowOffsetX = 0;
				ctx.shadowOffsetY = 0;
				ctx.fill();
				ctx.restore();


				// Draw hub spokes ON TOP (higher z-index than ball)
				ctx.save();
				ctx.translate(centerX, centerY);
				ctx.rotate(this.wheelRotation || 0);
				ctx.translate(-centerX, -centerY);

				// Draw 4 SHORTER handles (odd indices: 1, 3, 5, 7) - MUCH shorter
				for (let i = 1; i < 8; i += 2) {
					const angle = (Math.PI / 4) * i;

					// Calculate brightness based on handle's world position relative to light
					const worldAngle = angle + (this.wheelRotation || 0);
					let angleDiff = worldAngle - rimLightAngle;
					while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
					while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
					const brightness = (Math.cos(angleDiff) + 1) / 2; // 0 to 1

					// Scale sizes - MUCH SHORTER handles
					const outerReach = hubRadius * 0.55 + 10;
					const lineThickness = Math.max(2, outerRadius * 0.010);
					const pillLength = outerRadius * 0.12;
					const pillWidth = outerRadius * 0.020;
					const cornerRadiusX = pillLength * 0.33;
					const cornerRadiusY = pillWidth * 0.84;

					const innerX = centerX + Math.cos(angle) * hubRadius * 0.25;
					const innerY = centerY + Math.sin(angle) * hubRadius * 0.25;
					const outerX = centerX + Math.cos(angle) * outerReach;
					const outerY = centerY + Math.sin(angle) * outerReach;


					// Dynamic LINE gradient - polished golden metallic
					const lineGradient = ctx.createLinearGradient(innerX, innerY, outerX, outerY);
					const shine = brightness * 0.25 + 0.75; // 0.75-1.0 (brighter)
					lineGradient.addColorStop(0, `rgb(${Math.floor(200 * shine)}, ${Math.floor(160 * shine)}, ${Math.floor(50 * shine)})`);
					lineGradient.addColorStop(0.15, `rgb(${Math.floor(255 * shine)}, ${Math.floor(210 * shine)}, ${Math.floor(80 * shine)})`);
					lineGradient.addColorStop(0.5, `rgb(${Math.floor(255 * shine)}, ${Math.floor(220 * shine)}, ${Math.floor(100 * shine)})`);
					lineGradient.addColorStop(0.85, `rgb(${Math.floor(255 * shine)}, ${Math.floor(200 * shine)}, ${Math.floor(70 * shine)})`);
					lineGradient.addColorStop(1, `rgb(${Math.floor(180 * shine)}, ${Math.floor(140 * shine)}, ${Math.floor(40 * shine)})`);

					// Draw the spoke line
					ctx.save();
					ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
					ctx.shadowBlur = Math.max(2, outerRadius * 0.006);
					ctx.shadowOffsetX = 0;
					ctx.shadowOffsetY = 0;
					ctx.beginPath();
					ctx.strokeStyle = handleGradient;
					ctx.lineWidth = lineThickness;
					ctx.lineCap = "round";
					ctx.moveTo(innerX, innerY);
					ctx.lineTo(outerX, outerY);
					ctx.stroke();
					ctx.restore();

					// Draw rounded rectangle with elliptical corners (pill shape)
					ctx.save();
					ctx.translate(outerX, outerY);
					ctx.rotate(angle);

					// Dynamic ELLIPSE gradient for shorter handles
					const halfW = pillLength / 2;
					const halfH = pillWidth / 2;
					const rx = Math.max(0.1, Math.min(cornerRadiusX, halfW));
					const ry = Math.max(0.1, Math.min(cornerRadiusY, halfH));

					// Create gradient - polished golden 3D metallic
					const pillGradient = ctx.createLinearGradient(0, -halfH * 1.5, 0, halfH * 1.5);
					const glow = brightness * 0.35 + 0.65;
					pillGradient.addColorStop(0, `rgb(${Math.floor(255 * glow)}, ${Math.floor(255 * glow)}, ${Math.floor(240 * glow)})`);
					pillGradient.addColorStop(0.1, `rgb(${Math.floor(255 * glow)}, ${Math.floor(250 * glow)}, ${Math.floor(200 * glow)})`);
					pillGradient.addColorStop(0.25, `rgb(${Math.floor(255 * glow)}, ${Math.floor(235 * glow)}, ${Math.floor(150 * glow)})`);
					pillGradient.addColorStop(0.5, `rgb(${Math.floor(220 * glow)}, ${Math.floor(180 * glow)}, ${Math.floor(80 * glow)})`);
					pillGradient.addColorStop(0.75, `rgb(${Math.floor(255 * glow)}, ${Math.floor(230 * glow)}, ${Math.floor(140 * glow)})`);
					pillGradient.addColorStop(0.9, `rgb(${Math.floor(255 * glow)}, ${Math.floor(250 * glow)}, ${Math.floor(190 * glow)})`);
					pillGradient.addColorStop(1, `rgb(${Math.floor(255 * glow)}, ${Math.floor(245 * glow)}, ${Math.floor(180 * glow)})`);

					ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
					ctx.shadowBlur = Math.max(2, outerRadius * 0.008);
					ctx.shadowOffsetX = 0;
					ctx.shadowOffsetY = 0;

					ctx.beginPath();
					ctx.fillStyle = handleGradient;

					// Draw rounded rectangle with elliptical corners
					ctx.moveTo(-halfW + rx, -halfH);
					ctx.lineTo(halfW - rx, -halfH);
					ctx.ellipse(halfW - rx, -halfH + ry, rx, ry, 0, -Math.PI/2, 0);
					ctx.lineTo(halfW, halfH - ry);
					ctx.ellipse(halfW - rx, halfH - ry, rx, ry, 0, 0, Math.PI/2);
					ctx.lineTo(-halfW + rx, halfH);
					ctx.ellipse(-halfW + rx, halfH - ry, rx, ry, 0, Math.PI/2, Math.PI);
					ctx.lineTo(-halfW, -halfH + ry);
					ctx.ellipse(-halfW + rx, -halfH + ry, rx, ry, 0, Math.PI, Math.PI * 1.5);
					ctx.closePath();
					ctx.fill();
					ctx.restore();

				}


				ctx.restore();
				ctx.restore();

								// Draw five arcs with DYNAMIC 3D gradients
				// Light source fixed at top-right
				const fixedLightAngle = -Math.PI / 4;

				// Shadow direction - counter-rotates to stay fixed in world space
				const shadowAngle = (fixedLightAngle + Math.PI) - wheelRot;
				const shadowX = Math.cos(shadowAngle);
				const shadowY = Math.sin(shadowAngle);

				// Gradient direction - counter-rotates to always face light
				const gradAngle = fixedLightAngle - wheelRot;
				const glowX = Math.cos(gradAngle);
				const glowY = Math.sin(gradAngle);

				// First arc - radius 25 with conic gradient
				ctx.save();
				ctx.translate(centerX, centerY);
				ctx.rotate(wheelRot);
				ctx.translate(-centerX, -centerY);

				const arc1Grad = ctx.createConicGradient(gradAngle, centerX, centerY);
				arc1Grad.addColorStop(0, '#fffef5');
				arc1Grad.addColorStop(0.12, '#ffe082');
				arc1Grad.addColorStop(0.25, '#c9a000');
				arc1Grad.addColorStop(0.38, '#8b6914');
				arc1Grad.addColorStop(0.5, '#5a4500');
				arc1Grad.addColorStop(0.62, '#8b6914');
				arc1Grad.addColorStop(0.75, '#c9a000');
				arc1Grad.addColorStop(0.88, '#ffe082');
				arc1Grad.addColorStop(1, '#fffef5');

				ctx.beginPath();
				ctx.arc(centerX, centerY, 25 * scaleFactor, 0, Math.PI * 2);
				ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
				ctx.shadowBlur = 5 * scaleFactor;
				ctx.shadowOffsetX = 0;
				ctx.shadowOffsetY = 0;
				ctx.fillStyle = arc1Grad;
				ctx.fill();
				ctx.shadowColor = 'transparent';
				ctx.restore();

				// Second arc - radius 20 with conic gradient
				ctx.save();
				ctx.translate(centerX, centerY);
				ctx.rotate(wheelRot);
				ctx.translate(-centerX, -centerY);

				const arc2Grad = ctx.createConicGradient(gradAngle + Math.PI * 0.05, centerX, centerY);
				arc2Grad.addColorStop(0, '#fff8dc');
				arc2Grad.addColorStop(0.12, '#ffd54f');
				arc2Grad.addColorStop(0.25, '#b8860b');
				arc2Grad.addColorStop(0.38, '#7a5a10');
				arc2Grad.addColorStop(0.5, '#4a3500');
				arc2Grad.addColorStop(0.62, '#7a5a10');
				arc2Grad.addColorStop(0.75, '#b8860b');
				arc2Grad.addColorStop(0.88, '#ffd54f');
				arc2Grad.addColorStop(1, '#fff8dc');

				ctx.beginPath();
				ctx.arc(centerX, centerY, 20 * scaleFactor, 0, Math.PI * 2);
				ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
				ctx.shadowBlur = 4 * scaleFactor;
				ctx.shadowOffsetX = 0;
				ctx.shadowOffsetY = 0;
				ctx.fillStyle = arc2Grad;
				ctx.fill();
				ctx.shadowColor = 'transparent';
				ctx.restore();

				// Third arc - radius 10 with conic gradient
				ctx.save();
				ctx.translate(centerX, centerY);
				ctx.rotate(wheelRot);
				ctx.translate(-centerX, -centerY);

				const arc3Grad = ctx.createConicGradient(gradAngle + Math.PI * 0.1, centerX, centerY);
				arc3Grad.addColorStop(0, '#ffffff');
				arc3Grad.addColorStop(0.12, '#ffeb3b');
				arc3Grad.addColorStop(0.25, '#daa520');
				arc3Grad.addColorStop(0.38, '#8b6914');
				arc3Grad.addColorStop(0.5, '#5a4000');
				arc3Grad.addColorStop(0.62, '#8b6914');
				arc3Grad.addColorStop(0.75, '#daa520');
				arc3Grad.addColorStop(0.88, '#ffeb3b');
				arc3Grad.addColorStop(1, '#ffffff');

				ctx.beginPath();
				ctx.arc(centerX, centerY, 10 * scaleFactor, 0, Math.PI * 2);
				ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
				ctx.shadowBlur = 3 * scaleFactor;
				ctx.shadowOffsetX = 0;
				ctx.shadowOffsetY = 0;
				ctx.fillStyle = arc3Grad;
				ctx.fill();
				ctx.shadowColor = 'transparent';
				ctx.restore();

				// Fourth arc - radius 7.5 with conic gradient
				ctx.save();
				ctx.translate(centerX, centerY);
				ctx.rotate(wheelRot);
				ctx.translate(-centerX, -centerY);

				const arc4Grad = ctx.createConicGradient(gradAngle + Math.PI * 0.15, centerX, centerY);
				arc4Grad.addColorStop(0, '#fffef5');
				arc4Grad.addColorStop(0.12, '#ffe082');
				arc4Grad.addColorStop(0.25, '#cd9700');
				arc4Grad.addColorStop(0.38, '#8a6508');
				arc4Grad.addColorStop(0.5, '#5a4500');
				arc4Grad.addColorStop(0.62, '#8a6508');
				arc4Grad.addColorStop(0.75, '#cd9700');
				arc4Grad.addColorStop(0.88, '#ffe082');
				arc4Grad.addColorStop(1, '#fffef5');

				ctx.beginPath();
				ctx.arc(centerX, centerY, 7.5 * scaleFactor, 0, Math.PI * 2);
				ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
				ctx.shadowBlur = 2.5 * scaleFactor;
				ctx.shadowOffsetX = 0;
				ctx.shadowOffsetY = 0;
				ctx.fillStyle = arc4Grad;
				ctx.fill();
				ctx.shadowColor = 'transparent';
				ctx.restore();

				// Fifth arc - radius 4.5 with conic gradient
				ctx.save();
				ctx.translate(centerX, centerY);
				ctx.rotate(wheelRot);
				ctx.translate(-centerX, -centerY);

				const arc5Grad = ctx.createConicGradient(gradAngle + Math.PI * 0.2, centerX, centerY);
				arc5Grad.addColorStop(0, '#ffffff');
				arc5Grad.addColorStop(0.12, '#fff8dc');
				arc5Grad.addColorStop(0.25, '#ffc107');
				arc5Grad.addColorStop(0.38, '#9a7b00');
				arc5Grad.addColorStop(0.5, '#6a5000');
				arc5Grad.addColorStop(0.62, '#9a7b00');
				arc5Grad.addColorStop(0.75, '#ffc107');
				arc5Grad.addColorStop(0.88, '#fff8dc');
				arc5Grad.addColorStop(1, '#ffffff');

				ctx.beginPath();
				ctx.arc(centerX, centerY, 4.5 * scaleFactor, 0, Math.PI * 2);
				ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
				ctx.shadowBlur = 2 * scaleFactor;
				ctx.shadowOffsetX = shadowX * (1 * scaleFactor);
				ctx.shadowOffsetY = shadowY * (1 * scaleFactor);
				ctx.fillStyle = arc5Grad;
				ctx.fill();
				ctx.shadowColor = 'transparent';
				ctx.restore();


				// Outer ring with dynamic gradient
				ctx.save();
				const ringGrad = ctx.createRadialGradient(
					centerX + glowX * (outerRadius * 0.08), centerY + glowY * (outerRadius * 0.08), outerRadius * 0.88,
					centerX, centerY, outerRadius
				);
				ringGrad.addColorStop(0, '#ffe082');
				ringGrad.addColorStop(0.35, '#ffc107');
				ringGrad.addColorStop(0.65, '#c99a2e');
				ringGrad.addColorStop(1, '#7a5a10');

				ctx.beginPath();
				ctx.arc(centerX, centerY, outerRadius * 0.97, 0, Math.PI * 2);
				ctx.strokeStyle = ringGrad;
				ctx.lineWidth = Math.max(4, outerRadius * 0.05);
				ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
				ctx.shadowBlur = Math.max(3, outerRadius * 0.03);
				ctx.shadowOffsetX = shadowX * Math.max(2, outerRadius * 0.015);
				ctx.shadowOffsetY = shadowY * Math.max(2, outerRadius * 0.015);
				ctx.stroke();
				ctx.restore();
			}
			// Ball rendering - sets ball position (ball is drawn in renderCanvasWheel)
			renderBall(angle, radius) {
				this.ballVisible = true;
				this.ballAngle = angle;
				// Store as ratio for resize compatibility
				const canvas = this.wheelCanvas;
				const styleWidth = canvas?.clientWidth || 600;
				const styleHeight = canvas?.clientHeight || 600;
				const outerRadius = Math.min(styleWidth, styleHeight) / 2 - 4;
				this.ballRadiusRatio = radius / outerRadius;
				// Redraw wheel which includes the ball
				this.renderCanvasWheel();
			}


			clearBall() {
				this.ballVisible = false;
				this.highlightedPocket = -1;
				this.pocketOpenProgress = 0;
				this.pocketAnimStartTime = null;
				this.ballStartRadiusForAnim = 0;
				this.ballScale = 1;
				this.ballOpacity = 1;
				this.pocketAnimActive = false;
				this.renderCanvasWheel();
			}
			async animateBall(targetSlotIndex, ballLandTime, unused) {
				if (!this.wheelCanvas || !this.wheelCanvasCtx) return;

				const canvas = this.wheelCanvas;
				const styleWidth = canvas.clientWidth || 600;
				const styleHeight = canvas.clientHeight || 600;
				const centerX = styleWidth / 2;
				const centerY = styleHeight / 2;

				// Match wheel dimensions exactly from renderCanvasWheel
				const outerRadius = Math.min(centerX, centerY) - 4;
				// Skip rendering if wheel is too small (prevents negative values)
				if (outerRadius < 50) return;
				const scaleFactor = outerRadius / 300; // Proportional scaling
				const rimRadius = outerRadius * 0.96;
				const bandOuter = rimRadius * 0.85;
				const bandInner = bandOuter * 0.84;
				const pocketOuter = bandInner * 0.98;
				const numberRadius = pocketOuter + (3 * scaleFactor);

				// Ball starts ON rimRadius, ends at numberRadius - 15
				const startRadius = rimRadius;
				const finalRadius = numberRadius - (65 * scaleFactor);

				const slice = (Math.PI * 2) / this.wheelOrder.length;

				// Ball spins opposite to wheel direction
				const ballSpins = 12 + Math.floor(Math.random() * 5);
				const totalBallRotation = ballSpins * Math.PI * 2;

				const startTime = performance.now();
				const ballAnimationMs = ballLandTime;

				// Ball ends at position relative to wheel (will be synced when landed)
				const targetSlotAngle = (targetSlotIndex * slice) - Math.PI / 2 + slice / 2;
				const startAngle = targetSlotAngle + totalBallRotation;

				this.wheelAnimating = true;
				return new Promise((resolve) => {
					const animate = (currentTime) => {
						const elapsed = currentTime - startTime;
						const progress = Math.min(elapsed / ballAnimationMs, 1);

						// Smooth easing for ball slowdown
						const easeOut = 1 - Math.pow(1 - progress, 3);

						// Ball angle relative to wheel
						const relativeAngle = startAngle - (totalBallRotation * easeOut);

						// Ball position = wheel rotation + relative angle
						const currentAngle = this.wheelRotation + relativeAngle;

						// Ball radius - stays on rimRadius first, then drops
						let currentRadius;
						if (progress < 0.65) {
							currentRadius = startRadius;
						} else {
							const dropProgress = (progress - 0.65) / 0.35;
							const dropEase = dropProgress * dropProgress;
							currentRadius = startRadius - (startRadius - finalRadius) * dropEase;
						}

						// Update ball position
						this.ballVisible = true;
						this.ballAngle = currentAngle;
						this.ballRadiusRatio = currentRadius / outerRadius;

						if (progress < 1) {
							this.ballLanded = false;
							requestAnimationFrame(animate);
						} else {
							// Ball landed - store offset from wheel
							this.ballLanded = true;
							this.ballAngleOffset = targetSlotAngle;
							this.ballRadiusRatio = finalRadius / outerRadius;
							resolve();
						}
					};

					requestAnimationFrame(animate);
				});
			}


			initRouletteCanvas() {
				if (!this.rouletteCanvas || !this.rouletteCtx) {
					return;
				}
				this.rouletteTopNumbers = ['25', '29', '12', '8', '19', '31', '18', '6', '21', '33', '16', '4', '23', '35'];
				this.rouletteBottomNumbers = ['36', '24', '3', '15', '34', '22', '5', '17', '32', '20', '7', '11', '30', '26'];
				this.rouletteLeftSectorNums = ['13', '1', '00', '27', '10'];
				this.rouletteRightSectorNums = ['14', '2', '0', '28', '9'];
				this.rouletteRedNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

				// Undo/Redo state
				this.undoStack = [];
				this.redoStack = [];
				this.lastBet = null;
				this.hoveredButton = null;

				// Global bet multiplier (x1, x2, x3, x4, x5) - does not change chips
				this.activeMultiplier = 'x1';
				this.betMultiplier = 1;

				// Remove mode for mobile users (left click removes chips)
				this.removeMode = false;

				// Animation state
				this.pulseAnimationRunning = false;

				// Winning number tracking
				this.winningHistory = [];
				this.lastWinningNumber = null;
				this.winningDisplayState = "welcome"; // "welcome", "spinning", "result"
				this.lastWonCredits = 0;
				// Pocket highlight effect
				this.highlightedPocket = -1;
				this.pocketOpenProgress = 0;
				this.pocketAnimStartTime = null;
				this.ballStartRadiusForAnim = 0;
				this.ballScale = 1;
				this.ballOpacity = 1;
				this.pocketAnimActive = false;

				// Load wood texture for button panel
				this.woodTexture = new Image();
				this.woodTextureLoaded = false;
				this.woodTexture.crossOrigin = 'anonymous';
				this.woodTexture.onload = () => {
					this.woodTextureLoaded = true;
					this.drawRouletteCanvas();
				};
				this.woodTexture.src = 'https://images.unsplash.com/photo-1541123603104-512919d6a96c?w=800&q=80';

				this.rouletteCanvas.addEventListener('mousemove', (e) => {
					this.handleRouletteMouseMove(e);
					// Update cursor for chip selector and buttons
					const rect = this.rouletteCanvas.getBoundingClientRect();
					const scaleX = this.rouletteCanvas.width / rect.width;
					const scaleY = this.rouletteCanvas.height / rect.height;
					const x = (e.clientX - rect.left) * scaleX;
					const y = (e.clientY - rect.top) * scaleY;

					const hoveredChip = this.getClickedChip(x, y);
					const hoveredBtn = this.getClickedButton(x, y);

					// Update hovered button state
					if (hoveredBtn !== this.hoveredButton) {
						this.hoveredButton = hoveredBtn;
						this.drawRouletteCanvas();
					}

					this.rouletteCanvas.style.cursor = (hoveredChip || hoveredBtn) ? 'pointer' : 'default';
				});
				this.rouletteCanvas.addEventListener('mouseleave', () => this.handleRouletteMouseLeave());
				this.rouletteCanvas.addEventListener('click', (e) => this.handleRouletteClick(e));
				this.rouletteCanvas.addEventListener('contextmenu', (e) => this.handleRouletteRightClick(e));

				this.drawRouletteCanvas();
			}

			getRouletteColor(num) {
				if (num === '0' || num === '00') return '#0a8a0a';
				if (this.rouletteRedNumbers.includes(parseInt(num))) return '#c41e3a';
				return '#1a1a1a';
			}

			isInRouletteLeftCurve(x, y) {
				const startX = 300; // Track straight portion start
				const boardOffsetY = 80; // Race track starts at 80px from top + topBarHeight (140)
				const centerY = 300 + boardOffsetY;
				const outerRadius = 160;
				const cellWidth = (1700 - 300) / 14; // Track width / 14 cells = 100px
				const topY = 140 + boardOffsetY;
				const midTopY = 240 + boardOffsetY;
				const midBotY = 360 + boardOffsetY;
				const botY = 460 + boardOffsetY;

				const dx = x - startX;
				const dy = y - centerY;
				const dist = Math.sqrt(dx * dx + dy * dy);

				// Left curved section
				if (x < startX && dist <= outerRadius) return true;

				// First column trapezoid (top part)
				if (x >= startX && x <= startX + cellWidth && y >= topY && y <= midTopY) return true;
				// First column trapezoid (diagonal middle)
				if (y > midTopY && y < midBotY) {
					const leftBoundary = startX + cellWidth - (cellWidth * (y - midTopY) / 120);
					if (x >= startX && x < leftBoundary) return true;
				}

				// Top row columns 1-3 (indices 1,2,3 = cells at 29,12,8)
				if (x >= startX + cellWidth && x <= startX + 4 * cellWidth && y >= topY && y <= midTopY) return true;

				// Bottom row columns 0-1 (indices 0,1 = cells at 36,24)
				if (x >= startX && x <= startX + 2 * cellWidth && y >= midBotY && y <= botY) return true;

				// Middle section - trapezoid shape
				// The diagonal goes from (2*cellWidth, midBotY) to (4*cellWidth, midTopY)
				if (y > midTopY && y < midBotY) {
					// Calculate the diagonal right boundary
					// At midTopY (y=240+offset), x boundary is at 4*cellWidth
					// At midBotY (y=360+offset), x boundary is at 2*cellWidth
					const t = (y - midTopY) / (midBotY - midTopY); // 0 at top, 1 at bottom
					const rightBoundary = startX + 4 * cellWidth - t * 2 * cellWidth;
					const leftBoundary = startX + cellWidth - (cellWidth * (y - midTopY) / 120);
					if (x >= leftBoundary && x <= rightBoundary) return true;
				}

				return false;
			}

			isInRouletteRightCurve(x, y) {
				const endX = 1700; // Track straight portion end
				const startX = 300; // Track straight portion start
				const boardOffsetY = 80; // Race track starts at 80px from top + topBarHeight (140)
				const centerY = 300 + boardOffsetY;
				const outerRadius = 160;
				const cellWidth = (1700 - 300) / 14; // Track width / 14 cells = 100px
				const topY = 140 + boardOffsetY;
				const midTopY = 240 + boardOffsetY;
				const midBotY = 360 + boardOffsetY;
				const botY = 460 + boardOffsetY;

				const dx = x - endX;
				const dy = y - centerY;
				const dist = Math.sqrt(dx * dx + dy * dy);

				// Right curved section
				if (x > endX && dist <= outerRadius) return true;

				// Top row columns 12-13 (indices 12,13 = cells at 23,35)
				if (x >= startX + 12 * cellWidth && x <= endX && y >= topY && y <= midTopY) return true;

				// Bottom row column 13 (index 13 = cell at 26)
				if (x >= startX + 13 * cellWidth && x <= endX && y >= midBotY && y <= botY) return true;

				// Middle section - includes diagonal from angel eyes
				// Diagonal goes from (12*cellWidth, midTopY) to (13*cellWidth, midBotY)
				if (y > midTopY && y < midBotY) {
					const t = (y - midTopY) / (midBotY - midTopY);
					const leftBoundary = startX + 12 * cellWidth + t * cellWidth;
					if (x >= leftBoundary && x <= endX) return true;
				}

				return false;
			}

			isInRouletteZone2(x, y) {
				// Siluette zone: top[4-6] + bottom[2-6] - trapezoid shape
				const startX = 300; // Track straight portion start
				const cellWidth = (1700 - 300) / 14; // Track width / 14 cells = 100px
				const boardOffsetY = 80; // Race track starts at 80px from top + topBarHeight (140)
				const topY = 140 + boardOffsetY;
				const midTopY = 240 + boardOffsetY;
				const midBotY = 360 + boardOffsetY;
				const botY = 460 + boardOffsetY;

				// Top row columns 4-6 (indices 4,5,6 = cells at 19,31,18)
				if (x >= startX + 4 * cellWidth && x <= startX + 7 * cellWidth && y >= topY && y <= midTopY) return true;

				// Bottom row columns 2-6 (indices 2,3,4,5,6 = cells at 3,15,34,22,5)
				if (x >= startX + 2 * cellWidth && x <= startX + 7 * cellWidth && y >= midBotY && y <= botY) return true;

				// Middle section - trapezoid
				// Left boundary: diagonal from (2*cellWidth, midBotY) to (4*cellWidth, midTopY)
				// Right boundary: straight line at 7*cellWidth
				if (y > midTopY && y < midBotY) {
					const t = (y - midTopY) / (midBotY - midTopY);
					const leftBoundary = startX + 4 * cellWidth - t * 2 * cellWidth;
					const rightBoundary = startX + 7 * cellWidth;
					if (x > leftBoundary && x <= rightBoundary) return true;
				}

				return false;
			}

			isInRouletteZone3(x, y) {
				// Angel Eyes zone: top[7-11] + bottom[7-12] - trapezoid shape
				const startX = 300; // Track straight portion start
				const cellWidth = (1700 - 300) / 14; // Track width / 14 cells = 100px
				const boardOffsetY = 80; // Race track starts at 80px from top + topBarHeight (140)
				const topY = 140 + boardOffsetY;
				const midTopY = 240 + boardOffsetY;
				const midBotY = 360 + boardOffsetY;
				const botY = 460 + boardOffsetY;

				// Top row columns 7-11 (indices 7,8,9,10,11 = cells at 6,21,33,16,4)
				if (x >= startX + 7 * cellWidth && x <= startX + 12 * cellWidth && y >= topY && y <= midTopY) return true;

				// Bottom row columns 7-12 (indices 7,8,9,10,11,12 = cells at 17,32,20,7,11,30)
				if (x >= startX + 7 * cellWidth && x <= startX + 13 * cellWidth && y >= midBotY && y <= botY) return true;

				// Middle section - trapezoid
				// Left boundary: straight line at 7*cellWidth
				// Right boundary: diagonal from (12*cellWidth, midTopY) to (13*cellWidth, midBotY)
				if (y > midTopY && y < midBotY) {
					const t = (y - midTopY) / (midBotY - midTopY);
					const leftBoundary = startX + 7 * cellWidth;
					const rightBoundary = startX + 12 * cellWidth + t * cellWidth;
					if (x >= leftBoundary && x < rightBoundary) return true;
				}

				return false;
			}

			getRouletteZone(x, y) {
				// Check outside bets first (bottom row with gaps)
				const startX = 300; // Track straight portion start
				const endX = 1700; // Track straight portion end
				const outerRadius = 160;
				const lineLength = endX - startX;
				const boardAlignStartX = 140; // Board alignment (track - outerRadius)
				const boardAlignEndX = 1860; // Board alignment (track + outerRadius)
				const outsideGap = 20;
				const totalGaps = 5 * outsideGap;
				const outsideStartX = boardAlignStartX; // Align with board numbers (140)
				const outsideFullWidth = boardAlignEndX - boardAlignStartX; // Match board number grid width (1720)
				const outsideWidth = (outsideFullWidth - totalGaps) / 6;
				const boardOffsetY = 80; // Race track starts at 80px from top + topBarHeight (140)
				const outsideY = 1205; // dozenY + dozenHeight + dozenGap // dozenY + dozenHeight + dozenGap // Below dozen row // Below dozen bets
				const outsideHeight = 90; // Extra height for diamond padding

				// Check dozen bets (row above outside bets)
				const dozenY = 1120; // 80px below board // 80px below board // 50px below chip selector
				const dozenHeight = 65; // Increased height
				const dozenGap = 20;
				const totalDozenGaps = 2 * dozenGap;
				const fullTrackWidth = boardAlignEndX - boardAlignStartX; // Match board number grid width (1860 - 140 = 1720)
				const dozenStartX = boardAlignStartX; // Align with board numbers (140)
				const dozenWidth = (fullTrackWidth - totalDozenGaps) / 3;

				if (y >= dozenY && y <= dozenY + dozenHeight && x >= dozenStartX && x <= dozenStartX + fullTrackWidth) {
					const dozenKeys = ['1st12', '2nd12', '3rd12'];
					for (let i = 0; i < 3; i++) {
						const cellX = dozenStartX + i * (dozenWidth + dozenGap);
						if (x >= cellX && x <= cellX + dozenWidth) {
							return dozenKeys[i];
						}
					}
				}

				const redBlackExtraHeight = 40; // Extra height for red/black to include label

				// Check red and black with extended height first
				const redIndex = 2;
				const blackIndex = 3;
				const redX = outsideStartX + redIndex * (outsideWidth + outsideGap);
				const blackX = outsideStartX + blackIndex * (outsideWidth + outsideGap);

				if (y >= outsideY - 10 && y <= outsideY + outsideHeight + redBlackExtraHeight) {
					if (x >= redX && x <= redX + outsideWidth) {
						return 'red';
					}
					if (x >= blackX && x <= blackX + outsideWidth) {
						return 'black';
					}
				}

				// Check other outside bets with normal height
				if (y >= outsideY && y <= outsideY + outsideHeight && x >= outsideStartX) {
					const outsideKeys = ['low', 'even', 'red', 'black', 'odd', 'high'];
					for (let i = 0; i < 6; i++) {
						if (i === redIndex || i === blackIndex) continue; // Already handled above
						const cellX = outsideStartX + i * (outsideWidth + outsideGap);
						if (x >= cellX && x <= cellX + outsideWidth) {
							return outsideKeys[i];
						}
					}
				}

				if (this.isInRouletteLeftCurve(x, y)) return 'doubleZero';
				if (this.isInRouletteRightCurve(x, y)) return 'zeroZone';
				if (this.isInRouletteZone2(x, y)) return 'siluette';
				if (this.isInRouletteZone3(x, y)) return 'angelEyes';
				return null;
			}

			getBoardCell(x, y) {
				if (!this.boardDimensions) return null;

				const bd = this.boardDimensions;
				const boardY = bd.y;
				const boardGap = bd.gap;
				const boardCellWidth = bd.cellWidth;
				const boardCellHeight = bd.cellHeight;
				const boardZeroWidth = bd.zeroWidth;
				const boardColRailWidth = bd.colRailWidth;
				const boardStartX = bd.startX;
				const boardNumbersStartX = bd.numbersStartX;
				const boardEndX = bd.endX;
				const boardTotalHeight = bd.totalHeight;
				const colRailX = boardEndX + boardGap;

				const boardNumbers = [
					[3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
					[2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
					[1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]
				];

				// Check if outside board area
				if (y < boardY - 10 || y > boardY + boardTotalHeight + 30) return null;
				if (x < boardStartX - 10 || x > colRailX + boardColRailWidth + 10) return null;

				// Check street bets (below the grid)
				// Check "Top Line" bet (0, 00, 1, 2, 3) - at bottom left edge
				if (y >= boardY + boardTotalHeight && y <= boardY + boardTotalHeight + 30) {
					const topLineX = boardNumbersStartX - boardGap / 2;
					if (Math.abs(x - topLineX) < 25) {
						return {
							type: 'line',
							key: 'line-0-00-1-2-3',
							label: 'Top Line 0-00-1-2-3',
							targets: ['0', '00', '1', '2', '3']
						};
					}
				}

				if (y >= boardY + boardTotalHeight && y <= boardY + boardTotalHeight + 30) {
					for (let col = 0; col < 12; col++) {
						const spotX = boardNumbersStartX + col * (boardCellWidth + boardGap);
						const spotCenterX = spotX + boardCellWidth / 2;

						// Check line bets (between streets)
						if (col < 11) {
							const lineSpotX = boardNumbersStartX + (col + 1) * (boardCellWidth + boardGap) - boardGap / 2;
							if (Math.abs(x - lineSpotX) < 15) {
								const nums = [
									boardNumbers[0][col], boardNumbers[1][col], boardNumbers[2][col],
									boardNumbers[0][col + 1], boardNumbers[1][col + 1], boardNumbers[2][col + 1]
								].sort((a, b) => a - b);
								return {
									type: 'line',
									key: `line-${nums[0]}-${nums[5]}`,
									label: `Line ${nums[0]}-${nums[5]}`,
									targets: nums.map(String)
								};
							}
						}

						// Check street bet
						if (Math.abs(x - spotCenterX) < 20) {
							const nums = [boardNumbers[0][col], boardNumbers[1][col], boardNumbers[2][col]].sort((a, b) => a - b);
							return {
								type: 'street',
								key: `street-${nums.join('-')}`,
								label: `Street ${nums[0]}-${nums[2]}`,
								targets: nums.map(String)
							};
						}
					}
				}

				// Check 0 cell
				const zeroH = boardCellHeight * 1.5 + boardGap * 0.5;
				if (x >= boardStartX && x <= boardStartX + boardZeroWidth && y >= boardY && y <= boardY + zeroH) {
					return { type: 'straight', value: '0', key: 'straight-0', label: '0', targets: ['0'] };
				}

				// Check 00 cell
				const doubleZeroY = boardY + zeroH + boardGap;
				const doubleZeroH = boardTotalHeight - zeroH - boardGap;
				if (x >= boardStartX && x <= boardStartX + boardZeroWidth && y >= doubleZeroY && y <= doubleZeroY + doubleZeroH) {
					return { type: 'straight', value: '00', key: 'straight-00', label: '00', targets: ['00'] };
				}

				// Check zero layer splits (between 0/00 and numbers)
				const zeroSplitX = boardNumbersStartX - boardGap / 2;
				const zeroBorderY = boardY + zeroH; // Border between 0 and 00
				const hitRadius = 25; // Hit detection radius

				// Row Y positions
				const row0CenterY = boardY + boardCellHeight / 2; // Center of row with 3
				const row0BottomY = boardY + boardCellHeight; // Bottom of row with 3
				const row1TopY = boardY + boardCellHeight + boardGap; // Top of row with 2
				const row1CenterY = boardY + boardCellHeight + boardGap + boardCellHeight / 2; // Center of row with 2
				const row1BottomY = boardY + 2 * boardCellHeight + boardGap; // Bottom of row with 2
				const row2TopY = boardY + 2 * (boardCellHeight + boardGap); // Top of row with 1
				const row2CenterY = row2TopY + boardCellHeight / 2; // Center of row with 1
				const row2BottomY = boardY + boardTotalHeight; // Bottom of row with 1

				// 1. 0-00 split (centered in zero area at the border)
				if (x >= boardStartX && x <= boardStartX + boardZeroWidth) {
					if (Math.abs(y - (boardY + boardTotalHeight / 2)) < hitRadius) { // Centered
						return { type: 'split', key: 'split-0-00', label: 'Split 0-00', targets: ['0', '00'] };
					}
				}

				// Check spots on the edge between zero area and numbers
				if (Math.abs(x - zeroSplitX) < hitRadius) {
					// 0-3 split (in middle of 3, half on 0)
					if (Math.abs(y - row0CenterY) < hitRadius) {
						return { type: 'split', key: 'split-0-3', label: 'Split 0-3', targets: ['0', '3'] };
					}
					// 0-2 split (between 0 and 2, at top of row 1 - not crossing to 3)
					if (Math.abs(y - (row1TopY + 15)) < hitRadius) { // 0-2 moved down
						return { type: 'split', key: 'split-0-2', label: 'Split 0-2', targets: ['0', '2'] };
					}
					// 0-00-2 basket/trio (in middle of 2, crossing 0 and 00)
					if (Math.abs(y - row1CenterY) < hitRadius) {
						return { type: 'street', key: 'street-0-00-2', label: 'Basket 0-00-2', targets: ['0', '00', '2'] };
					}
					// 00-2 split (at bottom of row 1, crossing with 00)
					if (Math.abs(y - (row1BottomY - 15)) < hitRadius) { // 00-2 moved up
						return { type: 'split', key: 'split-00-2', label: 'Split 00-2', targets: ['00', '2'] };
					}
					// 00-1 split (in middle of 1, half on 00)
					if (Math.abs(y - row2CenterY) < hitRadius) {
						return { type: 'split', key: 'split-00-1', label: 'Split 00-1', targets: ['00', '1'] };
					}
				}
				// Check 2:1 column buttons
				if (x >= colRailX && x <= colRailX + boardColRailWidth) {
					const columnValues = ['col3', 'col2', 'col1'];
					const columnTargets = {
						'col1': ['1','4','7','10','13','16','19','22','25','28','31','34'],
						'col2': ['2','5','8','11','14','17','20','23','26','29','32','35'],
						'col3': ['3','6','9','12','15','18','21','24','27','30','33','36']
					};
					for (let row = 0; row < 3; row++) {
						const cellY = boardY + row * (boardCellHeight + boardGap);
						if (y >= cellY && y <= cellY + boardCellHeight) {
							const value = columnValues[row];
							return {
								type: 'column',
								value: value,
								key: `column-${value}`,
								label: '2 to 1',
								targets: columnTargets[value]
							};
						}
					}
				}

				// Check number cells and corner/split bets
				// PRIORITY: corners > splits > straight numbers
				if (x >= boardNumbersStartX && x <= boardEndX && y >= boardY && y <= boardY + boardTotalHeight) {
					const relX = x - boardNumbersStartX;
					const relY = y - boardY;

					// Calculate cell and gap positions
					const cellPlusGap = boardCellWidth + boardGap;
					const rowPlusGap = boardCellHeight + boardGap;

					// Find which column gap we might be near (for vertical splits)
					for (let gapCol = 0; gapCol < 11; gapCol++) {
						const gapCenterX = (gapCol + 1) * cellPlusGap - boardGap / 2;

						// Check for corner bets first (highest priority)
						for (let gapRow = 0; gapRow < 2; gapRow++) {
							const gapCenterY = (gapRow + 1) * rowPlusGap - boardGap / 2;
							const distX = Math.abs(relX - gapCenterX);
							const distY = Math.abs(relY - gapCenterY);

							// Corner detection - circular area at gap intersection
							if (distX < 30 && distY < 30) {
								const nums = [
									boardNumbers[gapRow][gapCol], boardNumbers[gapRow][gapCol + 1],
									boardNumbers[gapRow + 1][gapCol], boardNumbers[gapRow + 1][gapCol + 1]
								].sort((a, b) => a - b);
								return {
									type: 'corner',
									key: `corner-${nums.join('-')}`,
									label: `Corner ${nums.join('-')}`,
									targets: nums.map(String)
								};
							}
						}

						// Vertical split detection (between columns)
						if (Math.abs(relX - gapCenterX) < 25) {
							const row = Math.floor(relY / rowPlusGap);
							if (row >= 0 && row < 3) {
								const leftNum = boardNumbers[row][gapCol];
								const rightNum = boardNumbers[row][gapCol + 1];
								const nums = [leftNum, rightNum].sort((a, b) => a - b);
								return {
									type: 'split',
									key: `split-${nums[0]}-${nums[1]}`,
									label: `Split ${nums[0]}-${nums[1]}`,
									targets: nums.map(String)
								};
							}
						}
					}

					// Horizontal split detection (between rows)
					for (let gapRow = 0; gapRow < 2; gapRow++) {
						const gapCenterY = (gapRow + 1) * rowPlusGap - boardGap / 2;
						if (Math.abs(relY - gapCenterY) < 25) {
							const col = Math.floor(relX / cellPlusGap);
							if (col >= 0 && col < 12) {
								const topNum = boardNumbers[gapRow][col];
								const bottomNum = boardNumbers[gapRow + 1][col];
								const nums = [topNum, bottomNum].sort((a, b) => a - b);
								return {
									type: 'split',
									key: `split-${nums[0]}-${nums[1]}`,
									label: `Split ${nums[0]}-${nums[1]}`,
									targets: nums.map(String)
								};
							}
						}
					}

					// Straight number bet (lowest priority - only if not in a gap area)
					const col = Math.floor(relX / cellPlusGap);
					const row = Math.floor(relY / rowPlusGap);
					if (col >= 0 && col < 12 && row >= 0 && row < 3) {
						const num = boardNumbers[row][col];
						return {
							type: 'straight',
							value: String(num),
							key: `straight-${num}`,
							label: String(num),
							targets: [String(num)]
						};
					}
				}

				return null;
			}

			handleRouletteMouseMove(e) {
				const rect = this.rouletteCanvas.getBoundingClientRect();
				const scaleX = this.rouletteCanvas.width / rect.width;
				const scaleY = this.rouletteCanvas.height / rect.height;
				const x = (e.clientX - rect.left) * scaleX;
				const y = (e.clientY - rect.top) * scaleY;

				// Check for chip hover
				const hoveredChip = this.getClickedChip(x, y);
				if (hoveredChip !== this.hoveredChipValue) {
					this.hoveredChipValue = hoveredChip;
					this.drawRouletteCanvas();
				}

				const newZone = this.getRouletteZone(x, y);
				const newBoardCell = this.getBoardCell(x, y);

				if (newZone !== this.rouletteHoveredZone || JSON.stringify(newBoardCell) !== JSON.stringify(this.hoveredBoardCell)) {
					this.rouletteHoveredZone = newZone;
					this.hoveredBoardCell = newBoardCell;
					this.rouletteCanvas.style.cursor = (newZone || newBoardCell) ? 'pointer' : 'default';
					this.drawRouletteCanvas();
				}
			}
			handleRouletteMouseLeave() {
				this.rouletteHoveredZone = null;
				this.hoveredBoardCell = null;
				this.hoveredChipValue = null;
				this.drawRouletteCanvas();
			}

			handleRouletteClick(e) {
				const rect = this.rouletteCanvas.getBoundingClientRect();
				const scaleX = this.rouletteCanvas.width / rect.width;
				const scaleY = this.rouletteCanvas.height / rect.height;
				const x = (e.clientX - rect.left) * scaleX;
				const y = (e.clientY - rect.top) * scaleY;

				// Check if clicking on control buttons
				const clickedButton = this.getClickedButton(x, y);
				if (clickedButton) {
					this.handleButtonClick(clickedButton);
					return;
				}

				// Check if clicking on chip selector first
				const selectedChip = this.getClickedChip(x, y);
				if (selectedChip) {
					this.currentChipValue = selectedChip;
					this.drawRouletteCanvas();
					return;
				}


				// Check if clicking on board cell
				const boardCell = this.getBoardCell(x, y);
				if (boardCell) {
					if (this.removeMode) {
						this.removeLastChipFromSpot(boardCell.key);
						return;
					}
					this.placeBoardBet(boardCell);
					return;
				}

				const zone = this.getRouletteZone(x, y);
				if (zone) {
					if (this.removeMode) {
						this.removeChipFromZone(zone);
						return;
					}
					this.placeRouletteBet(zone);
				}
			}

			getClickedButton(x, y) {
				if (!this.controlButtons) return null;

				for (const btn of this.controlButtons) {
					if (x >= btn.x && x <= btn.x + btn.width &&
							y >= btn.y && y <= btn.y + 70 && btn.enabled) {
						return btn.key;
					}
				}
				return null;
			}

			handleButtonClick(buttonKey) {
				switch (buttonKey) {
					case 'undo':
						this.undoBet();
						break;
					case 'redo':
						this.redoBet();
						break;
					case 'rebet':
						this.reBet();
						break;
					case 'spin':
						this.handleSpin();
						break;
					case 'x1':
						this.trySetMultiplier(1, 'x1');
						break;
					case 'x2':
						this.trySetMultiplier(2, 'x2');
						break;
					case 'x3':
						this.trySetMultiplier(3, 'x3');
						break;
					case 'x4':
						this.trySetMultiplier(4, 'x4');
						break;
					case 'x5':
						this.trySetMultiplier(5, 'x5');
						break;
					case 'clear':
						this.clearPlacements();
						break;
					case 'remove':
						this.removeMode = !this.removeMode;
						this.drawRouletteCanvas();
						break;
				}
			}

			// multiplyBets removed - now using global betMultiplier that doesn't change chips

			undoBet() {
				if (this.undoStack.length === 0 || this.isSpinning) return;

				const lastAction = this.undoStack.pop();

				// Save current state to redo stack
				this.redoStack.push({
					placements: JSON.parse(JSON.stringify(this.state.placements)),
					activeMultiplier: this.activeMultiplier,
					betMultiplier: this.betMultiplier
				});

				// Restore previous state
				if (lastAction.placements !== undefined) {
					// New format with multiplier
					this.state.placements = lastAction.placements;
					this.activeMultiplier = lastAction.activeMultiplier || 'x1';
					this.betMultiplier = lastAction.betMultiplier || 1;
				} else {
					// Old format (backwards compatibility)
					this.state.placements = lastAction;
				}

				this.updateSummary();
				this.updateBoardStacks();
				this.drawRouletteCanvas();
			}

			redoBet() {
				if (this.redoStack.length === 0 || this.isSpinning) return;

				const nextAction = this.redoStack.pop();

				// Save current state to undo stack
				this.undoStack.push({
					placements: JSON.parse(JSON.stringify(this.state.placements)),
					activeMultiplier: this.activeMultiplier,
					betMultiplier: this.betMultiplier
				});

				// Restore next state
				if (nextAction.placements !== undefined) {
					// New format with multiplier
					this.state.placements = nextAction.placements;
					this.activeMultiplier = nextAction.activeMultiplier || 'x1';
					this.betMultiplier = nextAction.betMultiplier || 1;
				} else {
					// Old format (backwards compatibility)
					this.state.placements = nextAction;
				}

				this.updateSummary();
				this.updateBoardStacks();
				this.drawRouletteCanvas();
			}

			reBet() {
				if (!this.lastBet || this.lastBet.length === 0 || this.isSpinning) return;

				// Check if current placements already match lastBet (avoid duplicate undo states)
				const currentJson = JSON.stringify(this.state.placements);
				const lastBetJson = JSON.stringify(this.lastBet);
				if (currentJson === lastBetJson) return;

				// Save current state for undo (only if different)
				this.undoStack.push({ placements: JSON.parse(JSON.stringify(this.state.placements)), activeMultiplier: this.activeMultiplier, betMultiplier: this.betMultiplier });
				this.redoStack = [];

				// Restore last bet
				this.state.placements = JSON.parse(JSON.stringify(this.lastBet));

				this.updateSummary();
				this.updateBoardStacks();
				this.drawRouletteCanvas();
			}

			handleRouletteRightClick(e) {
				e.preventDefault(); // Prevent context menu

				if (this.isSpinning) return;

				const rect = this.rouletteCanvas.getBoundingClientRect();
				const scaleX = this.rouletteCanvas.width / rect.width;
				const scaleY = this.rouletteCanvas.height / rect.height;
				const x = (e.clientX - rect.left) * scaleX;
				const y = (e.clientY - rect.top) * scaleY;

				const zone = this.getRouletteZone(x, y);
				if (!zone) return;

				// Determine the bet key for this zone
				const isOutsideBet = ['low', 'high', 'even', 'odd', 'red', 'black', '1st12', '2nd12', '3rd12'].includes(zone);
				let zoneKey;

				if (isOutsideBet) {
					const betTypeMap = {
						'low': 'range-low',
						'high': 'range-high',
						'even': 'parity-even',
						'odd': 'parity-odd',
						'red': 'color-red',
						'black': 'color-black',
						'1st12': 'dozen-1st12',
						'2nd12': 'dozen-2nd12',
						'3rd12': 'dozen-3rd12'
					};
					zoneKey = betTypeMap[zone];
				} else {
					zoneKey = `sector-${zone}`;
				}

				// Find the last placement with this key and remove it
				const placementIndex = this.state.placements.map(p => p.key).lastIndexOf(zoneKey);

				if (placementIndex !== -1) {
					// Save current state to undo stack
					this.undoStack.push({ placements: JSON.parse(JSON.stringify(this.state.placements)), activeMultiplier: this.activeMultiplier, betMultiplier: this.betMultiplier });
					this.redoStack = [];

					this.state.placements.splice(placementIndex, 1);
					this.updateSummary();
					this.updateBoardStacks();
					this.drawRouletteCanvas();
				}
			}

			removeChipFromZone(zone) {
				if (this.isSpinning) return;

				// Determine the bet key for this zone
				const isOutsideBet = ['low', 'high', 'even', 'odd', 'red', 'black', '1st12', '2nd12', '3rd12'].includes(zone);
				let zoneKey;

				if (isOutsideBet) {
					const betTypeMap = {
						'low': 'range-low',
						'high': 'range-high',
						'even': 'parity-even',
						'odd': 'parity-odd',
						'red': 'color-red',
						'black': 'color-black',
						'1st12': 'dozen-1st12',
						'2nd12': 'dozen-2nd12',
						'3rd12': 'dozen-3rd12',
						'1st12': 'dozen-1st12',
						'2nd12': 'dozen-2nd12',
						'3rd12': 'dozen-3rd12'
					};
					zoneKey = betTypeMap[zone];
				} else {
					zoneKey = `sector-${zone}`;
				}

				// Find the last placement with this key and remove it
				const placementIndex = this.state.placements.map(p => p.key).lastIndexOf(zoneKey);

				if (placementIndex !== -1) {
					// Save current state to undo stack
					this.undoStack.push({ placements: JSON.parse(JSON.stringify(this.state.placements)), activeMultiplier: this.activeMultiplier, betMultiplier: this.betMultiplier });
					this.redoStack = [];

					this.state.placements.splice(placementIndex, 1);
					this.updateSummary();
					this.updateBoardStacks();
					this.drawRouletteCanvas();
				}
			}

			getClickedChip(x, y) {
				// Chip selector - premium casino chips spanning full width
				const chipRowY = 1445; // 10px more top padding // Centered in chip bar // 80px below outside bets // Centered in chip bar // Below outside bets, above button bar
				const chipSize = 80; // Match pickerChipSize
				const chipRadius = chipSize / 2;
				const canvasWidth = 2000;
				const sidePadding = 80;

				const chipValues = [1, 2, 5, 10, 20, 30, 50, 100, 200, 500];
				const chipCount = chipValues.length;

				// Calculate gap to spread chips across full width (bigger gaps)
				const availableWidth = canvasWidth - (2 * sidePadding) - chipSize;
				const chipGapX = availableWidth / (chipCount - 1);
				const chipStartX = sidePadding + chipRadius;

				for (let index = 0; index < chipValues.length; index++) {
					const cx = chipStartX + index * chipGapX;
					const cy = chipRowY;
					const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
					if (dist <= chipRadius + 5) {
						return chipValues[index];
					}
				}
				return null;
			}


			placeBoardBet(boardCell) {
				if (this.isSpinning) return;

				// Check if user has enough credits
				const newBetAmount = this.currentChipValue * (this.betMultiplier || 1);
				const totalAfterBet = this.getTotalStake() + newBetAmount;
				if (totalAfterBet > this.state.credits) {
					this.showToast('Not enough credits to place this bet.');
					return;
				}

				const placement = {
					type: boardCell.type,
					value: boardCell.value || boardCell.key,
					targets: boardCell.targets || [boardCell.value],
					label: boardCell.label,
					key: boardCell.key,
					tokens: 1,
					multiplier: this.currentChipValue
				};

				// Count existing chips on this spot
				const existingChips = this.state.placements.filter(p => p.key === placement.key).length;
				if (existingChips >= this.maxTokens) {
					this.showToast(`Maximum ${this.maxTokens} chips allowed on ${placement.label}.`);
					return;
				}

				// Save current state to undo stack
				this.undoStack.push({
					placements: JSON.parse(JSON.stringify(this.state.placements)),
					activeMultiplier: this.activeMultiplier,
					betMultiplier: this.betMultiplier
				});
				this.redoStack = [];

				this.state.placements.push(placement);
				this.dismissToastByReason('chips-required');
				this.updateSummary();
				this.updateBoardStacks();
				this.drawRouletteCanvas();
			}
			placeRouletteBet(zone) {
				if (this.isSpinning) return;

				// Check if user has enough credits
				const newBetAmount = this.currentChipValue * (this.betMultiplier || 1);
				const totalAfterBet = this.getTotalStake() + newBetAmount;
				if (totalAfterBet > this.state.credits) {
					this.showToast('Not enough credits to place this bet.');
					return;
				}

				// Generate number ranges for outside bets
				const lowNumbers = Array.from({length: 18}, (_, i) => String(i + 1));
				const highNumbers = Array.from({length: 18}, (_, i) => String(i + 19));
				const evenNumbers = Array.from({length: 36}, (_, i) => i + 1).filter(n => n % 2 === 0).map(String);
				const oddNumbers = Array.from({length: 36}, (_, i) => i + 1).filter(n => n % 2 !== 0).map(String);
				const redNumbersList = this.redNumbers.map(String);
				const blackNumbers = Array.from({length: 36}, (_, i) => String(i + 1)).filter(n => !this.redNumbers.includes(n));

				const zoneConfig = {
					doubleZero: {
						label: 'Double Zero',
						numbers: [...this.rouletteLeftSectorNums, ...this.rouletteTopNumbers.slice(0, 4), ...this.rouletteBottomNumbers.slice(0, 2)],
						type: 'sector'
					},
					siluette: {
						label: 'Siluette',
						numbers: this.rouletteTopNumbers.slice(4, 7).concat(this.rouletteBottomNumbers.slice(2, 7)),
						type: 'sector'
					},
					angelEyes: {
						label: 'Angel Eyes',
						numbers: this.rouletteTopNumbers.slice(7, 12).concat(this.rouletteBottomNumbers.slice(7, 13)),
						type: 'sector'
					},
					zeroZone: {
						label: 'Zero Zone',
						numbers: [...this.rouletteRightSectorNums, ...this.rouletteTopNumbers.slice(12), ...this.rouletteBottomNumbers.slice(13)],
						type: 'sector'
					},
					low: {
						label: '1 to 18',
						numbers: lowNumbers,
						type: 'range',
						betType: 'range',
						betValue: 'low'
					},
					high: {
						label: '19 to 36',
						numbers: highNumbers,
						type: 'range',
						betType: 'range',
						betValue: 'high'
					},
					even: {
						label: 'EVEN',
						numbers: evenNumbers,
						type: 'parity',
						betType: 'parity',
						betValue: 'even'
					},
					odd: {
						label: 'ODD',
						numbers: oddNumbers,
						type: 'parity',
						betType: 'parity',
						betValue: 'odd'
					},
					red: {
						label: 'RED',
						numbers: redNumbersList,
						type: 'color',
						betType: 'color',
						betValue: 'red'
					},
					black: {
						label: 'BLACK',
						numbers: blackNumbers,
						type: 'color',
						betType: 'color',
						betValue: 'black'
					},
					'1st12': {
						label: '1ST 12',
						numbers: Array.from({length: 12}, (_, i) => String(i + 1)),
						type: 'dozen',
						betType: 'dozen',
						betValue: '1st12'
					},
					'2nd12': {
						label: '2ND 12',
						numbers: Array.from({length: 12}, (_, i) => String(i + 13)),
						type: 'dozen',
						betType: 'dozen',
						betValue: '2nd12'
					},
					'3rd12': {
						label: '3RD 12',
						numbers: Array.from({length: 12}, (_, i) => String(i + 25)),
						type: 'dozen',
						betType: 'dozen',
						betValue: '3rd12'
					}
				};

				const config = zoneConfig[zone];
				if (!config) return;

				// Determine bet key based on type
				const isOutsideBet = ['low', 'high', 'even', 'odd', 'red', 'black', '1st12', '2nd12', '3rd12'].includes(zone);
				const zoneKey = isOutsideBet ? `${config.betType}-${config.betValue}` : `sector-${zone}`;

				// Count clicks (each click = 1 token for the zone), max 16 clicks allowed
				const existingClicks = this.state.placements
						.filter((entry) => entry.key === zoneKey)
						.length;

				if (existingClicks >= this.maxTokens) {
					this.showToast(`Maximum chips reached for ${config.label}.`);
					return;
				}

				// Add the placement (1 token per click, but covers all numbers)
				const placement = {
					type: isOutsideBet ? config.betType : 'sector',
					value: isOutsideBet ? config.betValue : zone,
					sectorKey: zone,
					sectorSize: config.numbers.length,
					targets: config.numbers,
					label: config.label,
					key: zoneKey,
					tokens: 1,
					multiplier: this.currentChipValue,
				};

				// Save current state to undo stack
				this.undoStack.push({ placements: JSON.parse(JSON.stringify(this.state.placements)), activeMultiplier: this.activeMultiplier, betMultiplier: this.betMultiplier });
				this.redoStack = []; // Clear redo stack on new action

				this.state.placements.push(placement);
				this.dismissToastByReason('chips-required');
				this.updateSummary();
				this.updateBoardStacks();
				this.drawRouletteCanvas();
			}

			calculateTotalBet() {
				const multiplier = this.betMultiplier || 1;
				if (!this.state?.placements) return 0;
				let total = 0;
				this.state.placements.forEach(p => {
					if (p.breakdown) {
						p.breakdown.forEach(b => total += b.multiplier * b.count);
					} else {
						total += p.multiplier || 0;
					}
				});
				return total * multiplier;
			}

			// Get base bet amount without multiplier
			getBaseBet() {
				if (!this.state?.placements) return 0;
				let total = 0;
				this.state.placements.forEach(p => {
					if (p.breakdown) {
						p.breakdown.forEach(b => total += b.multiplier * b.count);
					} else {
						total += p.multiplier || 0;
					}
				});
				return total;
			}

			// Try to set multiplier - validates against available credits
			trySetMultiplier(newMultiplier, multiplierKey) {
				const baseBet = this.getBaseBet();
				const totalWithNewMultiplier = baseBet * newMultiplier;
				const availableCredits = this.state?.credits ?? 0;

				// Check if user has enough credits for the multiplied bet
				if (totalWithNewMultiplier > availableCredits && baseBet > 0) {
					this.showToast(`Not enough credits for x${newMultiplier} multiplier. Need ${totalWithNewMultiplier}, have ${availableCredits}.`);
					return false;
				}

				// Save state for undo
				if (this.activeMultiplier !== multiplierKey) {
					this.undoStack.push({
						placements: JSON.parse(JSON.stringify(this.state.placements)),
						activeMultiplier: this.activeMultiplier,
						betMultiplier: this.betMultiplier
					});
					this.redoStack = [];
				}

				// Apply multiplier
				this.activeMultiplier = multiplierKey;
				this.betMultiplier = newMultiplier;
				this.updateSummary();
				this.drawRouletteCanvas();
				return true;
			}

			drawRouletteCanvas() {
				if (!this.rouletteCanvas || !this.rouletteCtx) return;

				const ctx = this.rouletteCtx;

				// Top bar height
				const topBarHeight = 140;

				// Track drawing coordinates (straight portion)
				const trackStartX = 300;
				const trackEndX = 1700;
				const startX = trackStartX; // For track drawing
				const endX = trackEndX; // For track drawing
				const lineLength = endX - startX;
				const cellWidth = lineLength / 14;
				const cellHeight = 100;
				const boardOffsetY = -60 + topBarHeight; // Race track starts at 80px from top + top bar
				const centerY = 300 + boardOffsetY;
				const innerRadius = 60;
				const outerRadius = 160;
				// Board alignment coordinates (including curves)
				const boardAlignStartX = trackStartX - outerRadius; // 140
				const boardAlignEndX = trackEndX + outerRadius; // 1860

				// Background
				ctx.fillStyle = '#0a3d0a';
				ctx.fillRect(0, 0, 2000, 1640);

				// ========== TOP BAR ==========
				// Top bar background (dark gradient like bottom bar)
				const topBarGradient = ctx.createLinearGradient(0, 0, 0, topBarHeight);
				topBarGradient.addColorStop(0, '#1a1a2e');
				topBarGradient.addColorStop(1, '#16213e');
				ctx.fillStyle = topBarGradient;
				ctx.fillRect(0, 0, 2000, topBarHeight);

				// === TOP BORDER with shadow ===
				// Shadow below top border
				const topShadowGradient = ctx.createLinearGradient(0, 0, 0, 20);
				topShadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
				topShadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
				ctx.fillStyle = topShadowGradient;
				ctx.fillRect(0, 4, 2000, 20);

				// Top golden border with glow
				ctx.shadowColor = '#d4af37';
				ctx.shadowBlur = 8;
				ctx.shadowOffsetY = 2;
				ctx.beginPath();
				ctx.moveTo(0, 2);
				ctx.lineTo(2000, 2);
				ctx.strokeStyle = '#d4af37';
				ctx.lineWidth = 4;
				ctx.stroke();
				ctx.shadowColor = 'transparent';
				ctx.shadowBlur = 0;
				ctx.shadowOffsetY = 0;

				// Inner gold line at top
				ctx.beginPath();
				ctx.moveTo(0, 7);
				ctx.lineTo(2000, 7);
				ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
				ctx.lineWidth = 1;
				ctx.stroke();

				// === BOTTOM BORDER with shadow ===
				// Shadow above bottom border
				const bottomShadowGradient = ctx.createLinearGradient(0, topBarHeight - 20, 0, topBarHeight);
				bottomShadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
				bottomShadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
				ctx.fillStyle = bottomShadowGradient;
				ctx.fillRect(0, topBarHeight - 20, 2000, 20);

				// Bottom golden border with glow
				ctx.shadowColor = '#d4af37';
				ctx.shadowBlur = 8;
				ctx.shadowOffsetY = -2;
				ctx.beginPath();
				ctx.moveTo(0, topBarHeight - 2);
				ctx.lineTo(2000, topBarHeight - 2);
				ctx.strokeStyle = '#d4af37';
				ctx.lineWidth = 4;
				ctx.stroke();
				ctx.shadowColor = 'transparent';
				ctx.shadowBlur = 0;
				ctx.shadowOffsetY = 0;

				// Inner gold line at bottom
				ctx.beginPath();
				ctx.moveTo(0, topBarHeight - 7);
				ctx.lineTo(2000, topBarHeight - 7);
				ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
				ctx.lineWidth = 1;
				ctx.stroke();

				// === HISTORY ROW SEPARATOR BORDER ===
				const historyBorderY = 85;
				ctx.beginPath();
				ctx.moveTo(0, historyBorderY);
				ctx.lineTo(2000, historyBorderY);
				ctx.strokeStyle = '#d4af37';
				ctx.lineWidth = 2;
				ctx.stroke();

				// === ROW 1-2: Coins/Bet on left, Winning number on right ===
				const row1Y = 28;
				const row2Y = 55;

				// Coins display (left side, row 1) - shows available coins (total - bets on table)
				ctx.fillStyle = '#ffd700';
				ctx.font = 'bold 28px Arial';
				ctx.textAlign = 'left';
				ctx.textBaseline = 'middle';
				const totalCredits = this.state?.credits ?? 0;
				const betsOnTable = this.calculateTotalBet ? this.calculateTotalBet() : 0;
				const availableCoins = Math.max(0, totalCredits - betsOnTable);
				ctx.fillText('Coins:', 40, row1Y);
				ctx.fillStyle = '#ffffff';
				ctx.font = 'bold 34px Arial';
				ctx.fillText(String(availableCoins), 150, row1Y);

				// Horizontal line between Coins and Actual bet
				const horizontalLineY = 42;
				ctx.beginPath();
				ctx.moveTo(0, horizontalLineY);
				ctx.lineTo(380, horizontalLineY);
				ctx.strokeStyle = '#d4af37';
				ctx.lineWidth = 2;
				ctx.stroke();


				// Actual bet display (left side, row 2) with multiplier indicator
				ctx.fillStyle = '#ffd700';
				ctx.font = 'bold 28px Arial';
				ctx.fillText('Actual bet:', 40, row2Y);
				ctx.fillStyle = '#ffffff';
				const totalBet = this.calculateTotalBet ? this.calculateTotalBet() : 0;
				ctx.font = 'bold 34px Arial';
				ctx.fillText(String(totalBet), 210, row2Y);

				// Show current multiplier if > 1
				const currentMult = this.betMultiplier || 1;
				if (currentMult > 1) {
					ctx.fillStyle = '#ffd700';
					ctx.font = 'bold 24px Arial';
					ctx.fillText('(x' + currentMult + ')', 280, row2Y);
				}

				// Winning number display (center-right, spans both rows)
				// Determine what to display based on state
				let displayText = '';
				let displayColor = '#1a5a2a'; // Default green for welcome/spinning
				const winLabelX = 400;
				const winRowY = 42;
				const wnBoxX = 700;
				const wnBoxY = 15;
				const wnBoxSize = 55;

				if (this.winningDisplayState === 'welcome') {
					displayText = 'Welcome';
					displayColor = '#1a5a2a'; // Green
				} else if (this.winningDisplayState === 'spinning') {
					displayText = 'Spinning...';
					displayColor = '#2a4a8a'; // Blue
				} else if (this.winningDisplayState === 'result' && this.lastWinningNumber !== null) {
					displayText = String(this.lastWinningNumber);
					displayColor = this.getRouletteColor(String(this.lastWinningNumber));
				} else {
					displayText = '--';
					displayColor = '#333333';
				}

				// "Winning number:" label
				ctx.fillStyle = '#ffd700';
				ctx.font = 'bold 38px Arial';
				ctx.textAlign = 'left';
				ctx.textBaseline = 'middle';
				ctx.fillText('Winning number:', winLabelX, winRowY);

				// Winning number box
				ctx.fillStyle = displayColor;
				ctx.fillRect(wnBoxX, wnBoxY, wnBoxSize, wnBoxSize);
				ctx.strokeStyle = '#ffd700';
				ctx.lineWidth = 3;
				ctx.strokeRect(wnBoxX, wnBoxY, wnBoxSize, wnBoxSize);

				// Display text (number or message)
				ctx.fillStyle = '#ffffff';
				if (displayText === 'Welcome' || displayText === 'Spinning...') {
					ctx.font = 'bold 16px Arial';
				} else {
					ctx.font = 'bold 38px Arial';
				}
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(displayText, wnBoxX + wnBoxSize / 2, wnBoxY + wnBoxSize / 2);

				// Additional winning info (color, odd/even, won credits) - only show for result state
				ctx.font = 'bold 28px Arial';
				ctx.textAlign = 'left';
				let infoX = wnBoxX + wnBoxSize + 40;
				const winningNumber = this.lastWinningNumber;

				if (this.winningDisplayState === 'result' && winningNumber !== null) {
					const num = parseInt(winningNumber);
					let colorName = 'GREEN';
					if (this.redNumbers.includes(String(num))) colorName = 'RED';
					else if (num !== 0 && String(num) !== '00') colorName = 'BLACK';

					const oddEven = (num === 0 || String(winningNumber) === '00') ? '' : (num % 2 === 0 ? 'Even' : 'Odd');

					// Bullet and color
					ctx.fillStyle = '#ffffff';
					ctx.fillText('•', infoX, winRowY);
					infoX += 25;
					ctx.fillStyle = displayColor === '#000000' ? '#888888' : displayColor;
					ctx.fillText(colorName, infoX, winRowY);
					infoX += ctx.measureText(colorName).width + 20;

					// Bullet and odd/even
					if (oddEven) {
						ctx.fillStyle = '#ffffff';
						ctx.fillText('•', infoX, winRowY);
						infoX += 25;
						ctx.fillText(oddEven, infoX, winRowY);
						infoX += ctx.measureText(oddEven).width + 20;
					}

					// Bullet and won credits
					ctx.fillStyle = '#ffffff';
					ctx.fillText('•', infoX, winRowY);
					infoX += 25;
					const wonCredits = this.lastWonCredits ?? 0;
					ctx.fillText(`Won ${wonCredits} credits`, infoX, winRowY);
				}

				// === ROW 3: Winning number history ===
				const historyRowY = 115;

				ctx.fillStyle = '#ffd700';
				ctx.font = 'bold 30px Arial';
				ctx.textAlign = 'left';
				ctx.textBaseline = 'middle';
				ctx.fillText('Winning number history:', 40, historyRowY);

				// Vertical separator line after history label (full height)
				const verticalLineX = 380;
				ctx.beginPath();
				ctx.moveTo(verticalLineX, 0);
				ctx.lineTo(verticalLineX, topBarHeight);
				ctx.strokeStyle = '#d4af37';
				ctx.lineWidth = 2;
				ctx.stroke();

				// History numbers
				const history = this.winningHistory || [];
				const historyStartX = 400;
				const historyBoxSize = 32;
				const historyGap = 4;

				for (let i = 0; i < Math.min(history.length, 25); i++) {
					const num = history[i];
					const hx = historyStartX + i * (historyBoxSize + historyGap);
					const hy = historyRowY - historyBoxSize / 2;

					// Box background
					ctx.fillStyle = this.getRouletteColor(String(num));
					ctx.fillRect(hx, hy, historyBoxSize, historyBoxSize);
					ctx.strokeStyle = '#ffd700';
					ctx.lineWidth = 1;
					ctx.strokeRect(hx, hy, historyBoxSize, historyBoxSize);

					// Number
					ctx.fillStyle = '#ffffff';
					ctx.font = 'bold 14px Arial';
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					ctx.fillText(String(num), hx + historyBoxSize / 2, hy + historyBoxSize / 2);
				}
				// ========== END TOP BAR ==========

				ctx.strokeStyle = '#d4af37';
				ctx.lineWidth = 2;
				ctx.lineWidth = 2;

				// Top row cells (with light reflection gradients for all colors)
				for (let i = 0; i < 14; i++) {
					const num = this.rouletteTopNumbers[i];
					const color = this.getRouletteColor(num);
					const cellX = startX + i * cellWidth;
					const cellY = 140 + boardOffsetY;

					const isBlack = color === '#1a1a1a';
					const isRed = color === '#c41e3a';
					const isGreen = color === '#0a8a0a';

					// Create gradient based on color
					const gradient = ctx.createLinearGradient(cellX, cellY, cellX + cellWidth, cellY + cellHeight);

					if (isBlack) {
						gradient.addColorStop(0, '#2a2a2a');
						gradient.addColorStop(0.3, '#1a1a1a');
						gradient.addColorStop(0.7, '#1a1a1a');
						gradient.addColorStop(1, '#0a0a0a');
					} else if (isRed) {
						gradient.addColorStop(0, '#e63e5c'); // Lighter red at top-left
						gradient.addColorStop(0.3, '#c41e3a');
						gradient.addColorStop(0.7, '#c41e3a');
						gradient.addColorStop(1, '#8a1528'); // Darker red at bottom-right
					} else if (isGreen) {
						gradient.addColorStop(0, '#0cb010'); // Lighter green at top-left
						gradient.addColorStop(0.3, '#0a8a0a');
						gradient.addColorStop(0.7, '#0a8a0a');
						gradient.addColorStop(1, '#065a06'); // Darker green at bottom-right
					} else {
						ctx.fillStyle = color;
						ctx.fillRect(cellX, cellY, cellWidth, cellHeight);
						continue;
					}

					ctx.fillStyle = gradient;
					ctx.fillRect(cellX, cellY, cellWidth, cellHeight);

					// Add subtle light reflection shine
					const shineGradient = ctx.createLinearGradient(cellX, cellY, cellX + cellWidth * 0.5, cellY + cellHeight * 0.3);
					if (isBlack) {
						shineGradient.addColorStop(0, 'rgba(255, 250, 220, 0.08)');
					} else if (isRed) {
						shineGradient.addColorStop(0, 'rgba(255, 200, 200, 0.15)');
					} else if (isGreen) {
						shineGradient.addColorStop(0, 'rgba(200, 255, 200, 0.12)');
					}
					shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
					ctx.fillStyle = shineGradient;
					ctx.fillRect(cellX, cellY, cellWidth, cellHeight);
				}

				// Bottom row cells (with light reflection gradients for all colors)
				for (let i = 0; i < 14; i++) {
					const num = this.rouletteBottomNumbers[i];
					const color = this.getRouletteColor(num);
					const cellX = startX + i * cellWidth;
					const cellY = 360 + boardOffsetY;

					const isBlack = color === '#1a1a1a';
					const isRed = color === '#c41e3a';
					const isGreen = color === '#0a8a0a';

					// Create gradient based on color
					const gradient = ctx.createLinearGradient(cellX, cellY, cellX + cellWidth, cellY + cellHeight);

					if (isBlack) {
						gradient.addColorStop(0, '#2a2a2a');
						gradient.addColorStop(0.3, '#1a1a1a');
						gradient.addColorStop(0.7, '#1a1a1a');
						gradient.addColorStop(1, '#0a0a0a');
					} else if (isRed) {
						gradient.addColorStop(0, '#e63e5c'); // Lighter red at top-left
						gradient.addColorStop(0.3, '#c41e3a');
						gradient.addColorStop(0.7, '#c41e3a');
						gradient.addColorStop(1, '#8a1528'); // Darker red at bottom-right
					} else if (isGreen) {
						gradient.addColorStop(0, '#0cb010'); // Lighter green at top-left
						gradient.addColorStop(0.3, '#0a8a0a');
						gradient.addColorStop(0.7, '#0a8a0a');
						gradient.addColorStop(1, '#065a06'); // Darker green at bottom-right
					} else {
						ctx.fillStyle = color;
						ctx.fillRect(cellX, cellY, cellWidth, cellHeight);
						continue;
					}

					ctx.fillStyle = gradient;
					ctx.fillRect(cellX, cellY, cellWidth, cellHeight);

					// Add subtle light reflection shine
					const shineGradient = ctx.createLinearGradient(cellX, cellY, cellX + cellWidth * 0.5, cellY + cellHeight * 0.3);
					if (isBlack) {
						shineGradient.addColorStop(0, 'rgba(255, 250, 220, 0.08)');
					} else if (isRed) {
						shineGradient.addColorStop(0, 'rgba(255, 200, 200, 0.15)');
					} else if (isGreen) {
						shineGradient.addColorStop(0, 'rgba(200, 255, 200, 0.12)');
					}
					shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
					ctx.fillStyle = shineGradient;
					ctx.fillRect(cellX, cellY, cellWidth, cellHeight);
				}
				// Horizontal lines
				ctx.strokeStyle = '#d4af37';
				ctx.beginPath();
				ctx.moveTo(startX, 140 + boardOffsetY); ctx.lineTo(endX, 140 + boardOffsetY);
				ctx.moveTo(startX, 240 + boardOffsetY); ctx.lineTo(endX, 240 + boardOffsetY);
				ctx.moveTo(startX, 360 + boardOffsetY); ctx.lineTo(endX, 360 + boardOffsetY);
				ctx.moveTo(startX, 460 + boardOffsetY); ctx.lineTo(endX, 460 + boardOffsetY);
				ctx.stroke();

				// Vertical lines for top cells
				for (let i = 1; i < 14; i++) {
					ctx.beginPath();
					ctx.moveTo(startX + i * cellWidth, 140 + boardOffsetY);
					ctx.lineTo(startX + i * cellWidth, 240 + boardOffsetY);
					ctx.stroke();
				}

				// Vertical lines for bottom cells
				for (let i = 1; i < 14; i++) {
					ctx.beginPath();
					ctx.moveTo(startX + i * cellWidth, 360 + boardOffsetY);
					ctx.lineTo(startX + i * cellWidth, 460 + boardOffsetY);
					ctx.stroke();
				}


				// Diagonal zone separator lines
				ctx.strokeStyle = '#d4af37';
				ctx.lineWidth = 2;

				// Diagonal line 1: from right of 24 (bottom) to right of 8 (top)
				// 24 is at bottom index 1, right edge at 2*cellWidth
				// 8 is at top index 3, right edge at 4*cellWidth
				ctx.beginPath();
				ctx.moveTo(startX + 2 * cellWidth, 360 + boardOffsetY);
				ctx.lineTo(startX + 4 * cellWidth, 240 + boardOffsetY);
				ctx.stroke();

				// Diagonal line 2: from bottom right of 4 (top) to upper right of 30 (bottom)
				// 4 is at top index 11, right edge at 12*cellWidth
				// 30 is at bottom index 12, right edge at 13*cellWidth
				ctx.beginPath();
				ctx.moveTo(startX + 12 * cellWidth, 240 + boardOffsetY);
				ctx.lineTo(startX + 13 * cellWidth, 360 + boardOffsetY);
				ctx.stroke();
				// Left sector (curved) with gradients
				const leftSectorColors = this.rouletteLeftSectorNums.map(n => this.getRouletteColor(n));
				for (let i = 0; i < 5; i++) {
					const startAngle = Math.PI / 2 + i * (Math.PI / 5);
					const endAngle = Math.PI / 2 + (i + 1) * (Math.PI / 5);
					const midAngle = (startAngle + endAngle) / 2;

					ctx.beginPath();
					ctx.arc(startX, centerY, outerRadius, startAngle, endAngle);
					ctx.arc(startX, centerY, innerRadius, endAngle, startAngle, true);
					ctx.closePath();

					const color = leftSectorColors[i];
					const isBlack = color === '#1a1a1a';
					const isRed = color === '#c41e3a';
					const isGreen = color === '#0a8a0a';

					// Create radial gradient for curved sectors
					const gradientCenterX = startX + Math.cos(midAngle) * ((innerRadius + outerRadius) / 2);
					const gradientCenterY = centerY + Math.sin(midAngle) * ((innerRadius + outerRadius) / 2);
					const gradient = ctx.createRadialGradient(
						gradientCenterX - 20, gradientCenterY - 20, 0,
						gradientCenterX, gradientCenterY, outerRadius - innerRadius
					);

					if (isBlack) {
						gradient.addColorStop(0, '#2a2a2a');
						gradient.addColorStop(0.5, '#1a1a1a');
						gradient.addColorStop(1, '#0a0a0a');
					} else if (isRed) {
						gradient.addColorStop(0, '#e63e5c');
						gradient.addColorStop(0.5, '#c41e3a');
						gradient.addColorStop(1, '#8a1528');
					} else if (isGreen) {
						gradient.addColorStop(0, '#12c012');
						gradient.addColorStop(0.4, '#0a8a0a');
						gradient.addColorStop(1, '#045a04');
					} else {
						ctx.fillStyle = color;
						ctx.fill();
						ctx.stroke();
						continue;
					}

					ctx.fillStyle = gradient;
					ctx.fill();
					ctx.stroke();

					// Add shine overlay
					ctx.save();
					ctx.beginPath();
					ctx.arc(startX, centerY, outerRadius, startAngle, endAngle);
					ctx.arc(startX, centerY, innerRadius, endAngle, startAngle, true);
					ctx.closePath();
					ctx.clip();

					const shineGradient = ctx.createRadialGradient(
						gradientCenterX - 30, gradientCenterY - 30, 0,
						gradientCenterX, gradientCenterY, outerRadius
					);
					if (isGreen) {
						shineGradient.addColorStop(0, 'rgba(200, 255, 200, 0.2)');
						shineGradient.addColorStop(0.5, 'rgba(200, 255, 200, 0.05)');
					} else if (isRed) {
						shineGradient.addColorStop(0, 'rgba(255, 200, 200, 0.15)');
						shineGradient.addColorStop(0.5, 'rgba(255, 200, 200, 0.03)');
					} else {
						shineGradient.addColorStop(0, 'rgba(255, 250, 220, 0.1)');
						shineGradient.addColorStop(0.5, 'rgba(255, 250, 220, 0.02)');
					}
					shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
					ctx.fillStyle = shineGradient;
					ctx.fill();
					ctx.restore();
				}

				// Right sector (curved) with gradients
				const rightSectorColors = this.rouletteRightSectorNums.map(n => this.getRouletteColor(n));
				for (let i = 0; i < 5; i++) {
					const startAngle = -Math.PI / 2 + i * (Math.PI / 5);
					const endAngle = -Math.PI / 2 + (i + 1) * (Math.PI / 5);
					const midAngle = (startAngle + endAngle) / 2;

					ctx.beginPath();
					ctx.arc(endX, centerY, outerRadius, startAngle, endAngle);
					ctx.arc(endX, centerY, innerRadius, endAngle, startAngle, true);
					ctx.closePath();

					const color = rightSectorColors[i];
					const isBlack = color === '#1a1a1a';
					const isRed = color === '#c41e3a';
					const isGreen = color === '#0a8a0a';

					// Create radial gradient for curved sectors
					const gradientCenterX = endX + Math.cos(midAngle) * ((innerRadius + outerRadius) / 2);
					const gradientCenterY = centerY + Math.sin(midAngle) * ((innerRadius + outerRadius) / 2);
					const gradient = ctx.createRadialGradient(
						gradientCenterX + 20, gradientCenterY - 20, 0,
						gradientCenterX, gradientCenterY, outerRadius - innerRadius
					);

					if (isBlack) {
						gradient.addColorStop(0, '#2a2a2a');
						gradient.addColorStop(0.5, '#1a1a1a');
						gradient.addColorStop(1, '#0a0a0a');
					} else if (isRed) {
						gradient.addColorStop(0, '#e63e5c');
						gradient.addColorStop(0.5, '#c41e3a');
						gradient.addColorStop(1, '#8a1528');
					} else if (isGreen) {
						gradient.addColorStop(0, '#12c012');
						gradient.addColorStop(0.4, '#0a8a0a');
						gradient.addColorStop(1, '#045a04');
					} else {
						ctx.fillStyle = color;
						ctx.fill();
						ctx.stroke();
						continue;
					}

					ctx.fillStyle = gradient;
					ctx.fill();
					ctx.stroke();

					// Add shine overlay
					ctx.save();
					ctx.beginPath();
					ctx.arc(endX, centerY, outerRadius, startAngle, endAngle);
					ctx.arc(endX, centerY, innerRadius, endAngle, startAngle, true);
					ctx.closePath();
					ctx.clip();

					const shineGradient = ctx.createRadialGradient(
						gradientCenterX + 30, gradientCenterY - 30, 0,
						gradientCenterX, gradientCenterY, outerRadius
					);
					if (isGreen) {
						shineGradient.addColorStop(0, 'rgba(200, 255, 200, 0.2)');
						shineGradient.addColorStop(0.5, 'rgba(200, 255, 200, 0.05)');
					} else if (isRed) {
						shineGradient.addColorStop(0, 'rgba(255, 200, 200, 0.15)');
						shineGradient.addColorStop(0.5, 'rgba(255, 200, 200, 0.03)');
					} else {
						shineGradient.addColorStop(0, 'rgba(255, 250, 220, 0.1)');
						shineGradient.addColorStop(0.5, 'rgba(255, 250, 220, 0.02)');
					}
					shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
					ctx.fillStyle = shineGradient;
					ctx.fill();
					ctx.restore();
				}
				// Arc borders
				ctx.strokeStyle = '#d4af37';
				ctx.beginPath(); ctx.arc(startX, centerY, innerRadius, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
				ctx.beginPath(); ctx.arc(startX, centerY, outerRadius, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
				ctx.beginPath(); ctx.arc(endX, centerY, innerRadius, -Math.PI / 2, Math.PI / 2); ctx.stroke();
				ctx.beginPath(); ctx.arc(endX, centerY, outerRadius, -Math.PI / 2, Math.PI / 2); ctx.stroke();

				// Left sector dividers
				for (let i = 0; i <= 5; i++) {
					const angle = Math.PI / 2 + i * (Math.PI / 5);
					ctx.beginPath();
					ctx.moveTo(startX + innerRadius * Math.cos(angle), centerY + innerRadius * Math.sin(angle));
					ctx.lineTo(startX + outerRadius * Math.cos(angle), centerY + outerRadius * Math.sin(angle));
					ctx.stroke();
				}

				// Right sector dividers
				for (let i = 0; i <= 5; i++) {
					const angle = -Math.PI / 2 + i * (Math.PI / 5);
					ctx.beginPath();
					ctx.moveTo(endX + innerRadius * Math.cos(angle), centerY + innerRadius * Math.sin(angle));
					ctx.lineTo(endX + outerRadius * Math.cos(angle), centerY + outerRadius * Math.sin(angle));
					ctx.stroke();
				}

				// Zone divider lines (only middle line between siluette and angel eyes)
				ctx.beginPath();
				ctx.moveTo(startX + 7 * cellWidth, 240 + boardOffsetY);
				ctx.lineTo(startX + 7 * cellWidth, 360 + boardOffsetY);
				ctx.stroke();
				// Number labels
				ctx.font = 'bold 34px Arial';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';

				for (let i = 0; i < 14; i++) {
					const x = startX + i * cellWidth + cellWidth / 2;
					const y = 190 + boardOffsetY;
					// Black text shadow
					ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
					ctx.lineWidth = 4;
					ctx.strokeText(this.rouletteTopNumbers[i], x, y);
					ctx.fillStyle = 'white';
					ctx.fillText(this.rouletteTopNumbers[i], x, y);
				}

				for (let i = 0; i < 14; i++) {
					const x = startX + i * cellWidth + cellWidth / 2;
					const y = 410 + boardOffsetY;
					// Black text shadow
					ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
					ctx.lineWidth = 4;
					ctx.strokeText(this.rouletteBottomNumbers[i], x, y);
					ctx.fillStyle = 'white';
					ctx.fillText(this.rouletteBottomNumbers[i], x, y);
				}

				// Left sector numbers
				for (let i = 0; i < 5; i++) {
					const angle = Math.PI / 2 + (i + 0.5) * (Math.PI / 5);
					const r = (innerRadius + outerRadius) / 2;
					const x = startX + r * Math.cos(angle);
					const y = centerY + r * Math.sin(angle);
					// Black text shadow
					ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
					ctx.lineWidth = 4;
					ctx.strokeText(this.rouletteLeftSectorNums[i], x, y);
					ctx.fillStyle = 'white';
					ctx.fillText(this.rouletteLeftSectorNums[i], x, y);
				}

				// Right sector numbers
				for (let i = 0; i < 5; i++) {
					const angle = -Math.PI / 2 + (i + 0.5) * (Math.PI / 5);
					const r = (innerRadius + outerRadius) / 2;
					const x = endX + r * Math.cos(angle);
					const y = centerY + r * Math.sin(angle);
					// Black text shadow
					ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
					ctx.lineWidth = 4;
					ctx.strokeText(this.rouletteRightSectorNums[i], x, y);
					ctx.fillStyle = 'white';
					ctx.fillText(this.rouletteRightSectorNums[i], x, y);
				}

				// Zone labels
				ctx.fillStyle = 'white';
				ctx.font = 'bold 25px Arial';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';

				// DOUBLE ZERO text (horizontal, single line, moved right)
				ctx.save();
				ctx.shadowColor = '#d4af37';
				ctx.shadowBlur = 8;
				ctx.strokeStyle = 'black';
				ctx.lineWidth = 3;
				ctx.strokeText('DOUBLE ZERO', startX + 75, centerY);
				ctx.fillStyle = 'white';
				ctx.fillText('DOUBLE ZERO', startX + 75, centerY);
				ctx.restore();

				// SILUETTE and ANGEL EYES
				ctx.font = 'bold 25px Arial';
				ctx.textAlign = 'center';
				ctx.shadowColor = '#d4af37';
				ctx.shadowBlur = 8;
				ctx.strokeStyle = 'black';
				ctx.lineWidth = 3;
				ctx.strokeText('SILUETTE', startX + 5.5 * cellWidth - 30, centerY);
				ctx.fillStyle = 'white';
				ctx.fillText('SILUETTE', startX + 5.5 * cellWidth - 30, centerY);

				ctx.strokeText('ANGEL EYES', startX + 9.5 * cellWidth + 30, centerY);
				ctx.fillText('ANGEL EYES', startX + 9.5 * cellWidth + 30, centerY);

				// ZERO ZONE text (horizontal, single line, moved left)
				ctx.font = 'bold 25px Arial';
				ctx.save();
				ctx.shadowColor = '#d4af37';
				ctx.shadowBlur = 8;
				ctx.strokeStyle = 'black';
				ctx.lineWidth = 3;
				ctx.strokeText('ZERO ZONE', endX - 45, centerY);
				ctx.fillStyle = 'white';
				ctx.fillText('ZERO ZONE', endX - 45, centerY);
				ctx.restore();

				ctx.shadowColor = 'transparent';
				ctx.shadowBlur = 0;
				// Hover highlights
				if (this.rouletteHoveredZone === 'doubleZero') {
					ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
					// Left curved section
					ctx.beginPath();
					ctx.arc(startX, centerY, outerRadius, Math.PI / 2, Math.PI * 1.5);
					ctx.closePath();
					ctx.fill();
					// First column top
					ctx.fillRect(startX, 140 + boardOffsetY, cellWidth, cellHeight);
					// First column trapezoid in middle
					ctx.beginPath();
					ctx.moveTo(startX, 240 + boardOffsetY);
					ctx.lineTo(startX + cellWidth, 240 + boardOffsetY);
					ctx.lineTo(startX, 360 + boardOffsetY);
					ctx.closePath();
					ctx.fill();
					// Columns 1-3 top row (29, 12, 8)
					ctx.fillRect(startX + cellWidth, 140 + boardOffsetY, 3 * cellWidth, cellHeight);
					// Columns 0-1 bottom row (36, 24)
					ctx.fillRect(startX, 360 + boardOffsetY, 2 * cellWidth, cellHeight);
					// Middle section - trapezoid from (2*cellWidth, bottom) to (4*cellWidth, top)
					ctx.beginPath();
					ctx.moveTo(startX + cellWidth, 240 + boardOffsetY);
					ctx.lineTo(startX + 4 * cellWidth, 240 + boardOffsetY);
					ctx.lineTo(startX + 2 * cellWidth, 360 + boardOffsetY);
					ctx.lineTo(startX, 360 + boardOffsetY);
					ctx.closePath();
					ctx.fill();
				}

				if (this.rouletteHoveredZone === 'siluette') {
					ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
					// Top row columns 4-6 (19, 31, 18)
					ctx.fillRect(startX + 4 * cellWidth, 140 + boardOffsetY, 3 * cellWidth, cellHeight);
					// Bottom row columns 2-6 (3, 15, 34, 22, 5)
					ctx.fillRect(startX + 2 * cellWidth, 360 + boardOffsetY, 5 * cellWidth, cellHeight);
					// Middle section - trapezoid
					ctx.beginPath();
					ctx.moveTo(startX + 4 * cellWidth, 240 + boardOffsetY);
					ctx.lineTo(startX + 7 * cellWidth, 240 + boardOffsetY);
					ctx.lineTo(startX + 7 * cellWidth, 360 + boardOffsetY);
					ctx.lineTo(startX + 2 * cellWidth, 360 + boardOffsetY);
					ctx.closePath();
					ctx.fill();
				}

				if (this.rouletteHoveredZone === 'angelEyes') {
					ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
					// Top row columns 7-11 (6, 21, 33, 16, 4)
					ctx.fillRect(startX + 7 * cellWidth, 140 + boardOffsetY, 5 * cellWidth, cellHeight);
					// Bottom row columns 7-12 (17, 32, 20, 7, 11, 30)
					ctx.fillRect(startX + 7 * cellWidth, 360 + boardOffsetY, 6 * cellWidth, cellHeight);
					// Middle section - trapezoid from (12*cellWidth, top) to (13*cellWidth, bottom)
					ctx.beginPath();
					ctx.moveTo(startX + 7 * cellWidth, 240 + boardOffsetY);
					ctx.lineTo(startX + 12 * cellWidth, 240 + boardOffsetY);
					ctx.lineTo(startX + 13 * cellWidth, 360 + boardOffsetY);
					ctx.lineTo(startX + 7 * cellWidth, 360 + boardOffsetY);
					ctx.closePath();
					ctx.fill();
				}

				if (this.rouletteHoveredZone === 'zeroZone') {
					ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
					// Right curved section
					ctx.beginPath();
					ctx.arc(endX, centerY, outerRadius, -Math.PI / 2, Math.PI / 2);
					ctx.closePath();
					ctx.fill();
					// Top row columns 12-13 (23, 35)
					ctx.fillRect(startX + 12 * cellWidth, 140 + boardOffsetY, 2 * cellWidth, cellHeight);
					// Bottom row column 13 (26)
					ctx.fillRect(startX + 13 * cellWidth, 360 + boardOffsetY, cellWidth, cellHeight);
					// Middle section - trapezoid
					ctx.beginPath();
					ctx.moveTo(startX + 12 * cellWidth, 240 + boardOffsetY);
					ctx.lineTo(endX, 240 + boardOffsetY);
					ctx.lineTo(endX, 360 + boardOffsetY);
					ctx.lineTo(startX + 13 * cellWidth, 360 + boardOffsetY);
					ctx.closePath();
					ctx.fill();
				}
				const sectorChipColors = {
					1: '#f59e0b',    // Amber/Gold
					2: '#f97316',    // Orange
					5: '#dc2626',    // Red
					10: '#16a34a',   // Green
					20: '#2563eb',   // Blue
					30: '#7c3aed',   // Purple
					50: '#0891b2',   // Cyan
					100: '#1f2937',  // Dark gray/black
					200: '#1d4ed8',  // Royal blue
					500: '#7e22ce'   // Deep purple
				};

				// Helper to get chip position for a number
				const getNumberChipPosition = (num) => {
					const topIdx = this.rouletteTopNumbers.indexOf(num);
					const bottomIdx = this.rouletteBottomNumbers.indexOf(num);
					const leftIdx = this.rouletteLeftSectorNums.indexOf(num);
					const rightIdx = this.rouletteRightSectorNums.indexOf(num);

					if (topIdx !== -1) {
						return { x: startX + topIdx * cellWidth + cellWidth / 2, y: 190 + boardOffsetY };
					}
					if (bottomIdx !== -1) {
						return { x: startX + bottomIdx * cellWidth + cellWidth / 2, y: 410 + boardOffsetY };
					}
					if (leftIdx !== -1) {
						const angle = Math.PI / 2 + (leftIdx + 0.5) * (Math.PI / 5);
						const r = (innerRadius + outerRadius) / 2;
						return { x: startX + r * Math.cos(angle), y: centerY + r * Math.sin(angle) };
					}
					if (rightIdx !== -1) {
						const angle = -Math.PI / 2 + (rightIdx + 0.5) * (Math.PI / 5);
						const r = (innerRadius + outerRadius) / 2;
						return { x: endX + r * Math.cos(angle), y: centerY + r * Math.sin(angle) };
					}
					return null;
				};

				// Draw premium casino chip (small version for board)
				const drawSmallChip = (x, y, color, value, size = 50) => {
					const chipR = size / 2;

					ctx.save();

					// Drop shadow
					ctx.beginPath();
					ctx.arc(x + 2, y + 3, chipR, 0, Math.PI * 2);
					ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
					ctx.fill();

					// === OUTER CHIP BASE (main color) ===
					ctx.beginPath();
					ctx.arc(x, y, chipR, 0, Math.PI * 2);
					ctx.fillStyle = color;
					ctx.fill();

					// === EDGE STRIPE PATTERN (8 black/white rectangles) ===
					const stripeCount = 8;
					for (let i = 0; i < stripeCount; i++) {
						const angle = (i / stripeCount) * Math.PI * 2 - Math.PI / 2;
						ctx.save();
						ctx.translate(x, y);
						ctx.rotate(angle);
						// Black outer stripe
						ctx.fillStyle = '#1a1a1a';
						const stripeDepth = chipR * 0.22;
						const stripeWidth = chipR * 0.28;
						ctx.fillRect(chipR - stripeDepth, -stripeWidth/2, stripeDepth, stripeWidth);
						// White inner stripe
						ctx.fillStyle = '#ffffff';
						ctx.fillRect(chipR - stripeDepth + 2, -stripeWidth/2 + 2, stripeDepth - 4, stripeWidth - 4);
						ctx.restore();
					}

					// === OUTER DARK RING ===
					ctx.beginPath();
					ctx.arc(x, y, chipR - 1, 0, Math.PI * 2);
					ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
					ctx.lineWidth = 1;
					ctx.stroke();

					// === WHITE DECORATIVE RING (with pattern) ===
					ctx.beginPath();
					ctx.arc(x, y, chipR * 0.75, 0, Math.PI * 2);
					ctx.strokeStyle = '#ffffff';
					ctx.lineWidth = chipR * 0.12;
					ctx.stroke();

					// === SMALL STARS/DOTS ON WHITE RING ===
					const starCount = 8;
					const starRadius = chipR * 0.75;
					for (let i = 0; i < starCount; i++) {
						const angle = (i / starCount) * Math.PI * 2 + Math.PI / 8;
						const sx = x + Math.cos(angle) * starRadius;
						const sy = y + Math.sin(angle) * starRadius;
						// Draw small star
						ctx.beginPath();
						ctx.fillStyle = color;
						const starSize = chipR * 0.06;
						for (let j = 0; j < 5; j++) {
							const starAngle = (j / 5) * Math.PI * 2 - Math.PI / 2;
							const px = sx + Math.cos(starAngle) * starSize;
							const py = sy + Math.sin(starAngle) * starSize;
							if (j === 0) ctx.moveTo(px, py);
							else ctx.lineTo(px, py);
						}
						ctx.closePath();
						ctx.fill();
					}

					// === INNER COLORED RING ===
					ctx.beginPath();
					ctx.arc(x, y, chipR * 0.62, 0, Math.PI * 2);
					ctx.strokeStyle = color;
					ctx.lineWidth = chipR * 0.08;
					ctx.stroke();

					// === INNER DARK CENTER CIRCLE ===
					ctx.beginPath();
					ctx.arc(x, y, chipR * 0.52, 0, Math.PI * 2);
					ctx.fillStyle = '#2a2a3a';
					ctx.fill();

					// Inner gradient for depth
					const innerGrad = ctx.createRadialGradient(x - chipR * 0.1, y - chipR * 0.1, 0, x, y, chipR * 0.52);
					innerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
					innerGrad.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
					ctx.fillStyle = innerGrad;
					ctx.fill();

					// === 4 WHITE DOTS at cardinal positions ===
					const dotPositions = [0, Math.PI/2, Math.PI, Math.PI * 1.5];
					const dotRadius = chipR * 0.88;
					dotPositions.forEach(angle => {
						const dx = x + Math.cos(angle) * dotRadius;
						const dy = y + Math.sin(angle) * dotRadius;
						ctx.beginPath();
						ctx.arc(dx, dy, chipR * 0.05, 0, Math.PI * 2);
						ctx.fillStyle = '#ffffff';
						ctx.fill();
					});

					// === SPECULAR HIGHLIGHT ===
					const gradient = ctx.createRadialGradient(
							x - chipR * 0.3, y - chipR * 0.3, 0,
							x - chipR * 0.3, y - chipR * 0.3, chipR * 0.4
					);
					gradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
					gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
					ctx.beginPath();
					ctx.arc(x - chipR * 0.2, y - chipR * 0.2, chipR * 0.35, 0, Math.PI * 2);
					ctx.fillStyle = gradient;
					ctx.fill();

					// === VALUE TEXT ===
					const fontSize = Math.max(12, Math.floor(size * 0.4));
					ctx.font = 'bold ' + fontSize + 'px Arial';
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
					ctx.fillText(String(value), x + 1, y + 1);
					ctx.fillStyle = '#ffffff';
					ctx.fillText(String(value), x, y);

					ctx.restore();
				};
// 			Object.entries(this.summary).forEach(([key, info]) => {
// 				// Only process sector bets
// 				if (key.startsWith('sector-') && info.targets && info.chips > 0) {
// 					const chipColor = sectorChipColors[info.lastMultiplier] || '#475569';
// 					const valuePerChip = info.lastMultiplier;
//
// 					// Draw a chip on each target number
// 					info.targets.forEach((num) => {
// 						const pos = getNumberChipPosition(String(num));
// 						if (pos) {
// 							drawSmallChip(pos.x, pos.y, chipColor, valuePerChip);
// 						}
// 					});
// 				}
// 			});
// 		}


				// ============================================
				// BETTING BOARD (Main number grid)
				// ============================================
				const boardY = 620; // 80px padding after race track // Start Y position for board
				const boardGap = 15; // Increased spacing between cells // Increased gap between cells // Gap between cells
				const boardRadius = 8; // Border radius
				const boardZeroWidth = 100; // Width for 0/00 cells
				const boardColRailWidth = 90; // Width for 2:1 cells
				const boardStartX = 34; // Aligned with track left curve extent
				const boardNumbersStartX = 149; // boardStartX + boardZeroWidth + boardGap // startX - outerRadius (300 - 160)
				const boardEndX = 1860; // endX + outerRadius (1700 + 160)
				const boardCellWidth = (boardEndX - boardNumbersStartX - 11 * boardGap) / 12; // Dynamic width
				const boardCellHeight = boardCellWidth; // Same as width for square cells
				const boardTotalHeight = 3 * boardCellHeight + 2 * boardGap;
				const boardChipSize = 50; // Increased size // Chip size on board

				// Store board dimensions for hit detection
				this.boardDimensions = {
					y: boardY,
					gap: boardGap,
					radius: boardRadius,
					cellWidth: boardCellWidth,
					cellHeight: boardCellHeight,
					zeroWidth: boardZeroWidth,
					colRailWidth: boardColRailWidth,
					startX: boardStartX,
					numbersStartX: boardNumbersStartX,
					endX: boardEndX,
					totalHeight: boardTotalHeight
				};

				const boardNumbers = [
					[3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
					[2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
					[1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]
				];

				// Helper function to draw rounded rect with inset shadow
				const drawBoardCell = (x, y, w, h, color, isHovered = false) => {
					ctx.save();

					// Draw rounded rectangle
					ctx.beginPath();
					ctx.roundRect(x, y, w, h, boardRadius);
					ctx.fillStyle = color;
					ctx.fill();

					// Inset shadow (top-left darker)
					const insetGradient = ctx.createLinearGradient(x, y, x + w, y + h);
					insetGradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
					insetGradient.addColorStop(0.1, 'rgba(0, 0, 0, 0.2)');
					insetGradient.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
					insetGradient.addColorStop(0.9, 'rgba(255, 255, 255, 0.1)');
					insetGradient.addColorStop(1, 'rgba(255, 255, 255, 0.15)');
					ctx.fillStyle = insetGradient;
					ctx.fill();

					// Border
					ctx.strokeStyle = '#d4af37';
					ctx.lineWidth = 2;
					ctx.stroke();

					// Hover highlight
					if (isHovered) {
						ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
						ctx.fill();
					}

					ctx.restore();
				};

				// Draw 0 cell (spans top 1.5 rows)
				const zeroX = boardStartX;
				const zeroY = boardY;
				const zeroH = boardCellHeight * 1.5 + boardGap * 0.5;
				const isZeroHovered = this.hoveredBoardCell && this.hoveredBoardCell.key === 'straight-0';
				drawBoardCell(zeroX, zeroY, boardZeroWidth, zeroH, '#0a6b0a', isZeroHovered);

				// 0 text
				ctx.save();
				ctx.font = 'bold 40px Arial';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillStyle = 'white';
				ctx.shadowColor = 'rgba(0,0,0,0.5)';
				ctx.shadowBlur = 4;
				ctx.fillText('0', zeroX + boardZeroWidth / 2, zeroY + zeroH / 2);
				ctx.restore();

				// Draw 00 cell (spans bottom 1.5 rows)
				const doubleZeroY = boardY + zeroH + boardGap;
				const doubleZeroH = boardTotalHeight - zeroH - boardGap;
				const isDoubleZeroHovered = this.hoveredBoardCell && this.hoveredBoardCell.key === 'straight-00';
				drawBoardCell(zeroX, doubleZeroY, boardZeroWidth, doubleZeroH, '#0a6b0a', isDoubleZeroHovered);

				// 00 text
				ctx.save();
				ctx.font = 'bold 40px Arial';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillStyle = 'white';
				ctx.shadowColor = 'rgba(0,0,0,0.5)';
				ctx.shadowBlur = 4;
				ctx.fillText('00', zeroX + boardZeroWidth / 2, doubleZeroY + doubleZeroH / 2);
				ctx.restore();

				// Draw number cells (1-36)
				for (let row = 0; row < 3; row++) {
					for (let col = 0; col < 12; col++) {
						const num = boardNumbers[row][col];
						const cellX = boardNumbersStartX + col * (boardCellWidth + boardGap);
						const cellY = boardY + row * (boardCellHeight + boardGap);
						const cellColor = this.getRouletteColor(String(num));
						const isHovered = this.hoveredBoardCell && this.hoveredBoardCell.key === `straight-${num}`;

						drawBoardCell(cellX, cellY, boardCellWidth, boardCellHeight, cellColor, isHovered);

						// Number text
						ctx.save();
						ctx.font = 'bold 36px Arial';
						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';
						ctx.fillStyle = 'white';
						ctx.shadowColor = 'rgba(0,0,0,0.5)';
						ctx.shadowBlur = 4;
						ctx.fillText(String(num), cellX + boardCellWidth / 2, cellY + boardCellHeight / 2);
						ctx.restore();
					}
				}

				// Draw 2:1 column buttons
				const colRailX = boardEndX + boardGap;
				const columnValues = ['col3', 'col2', 'col1']; // Top to bottom: col3, col2, col1
				for (let row = 0; row < 3; row++) {
					const cellY = boardY + row * (boardCellHeight + boardGap);
					const isHovered = this.hoveredBoardCell && this.hoveredBoardCell.key === `column-${columnValues[row]}`;

					drawBoardCell(colRailX, cellY, boardColRailWidth, boardCellHeight, '#0a5c0a', isHovered);

					// 2:1 text (rotated)
					ctx.save();
					ctx.translate(colRailX + boardColRailWidth / 2, cellY + boardCellHeight / 2);
					ctx.rotate(-Math.PI / 2);
					ctx.font = 'bold 28px Arial';
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					ctx.fillStyle = 'white';
					ctx.shadowColor = 'rgba(0,0,0,0.5)';
					ctx.shadowBlur = 4;
					ctx.fillText('2 to 1', 0, 0);
					ctx.restore();
				}

				// ============================================
				// SPLIT BET SPOTS (between 2 numbers)
				// ============================================
				// Horizontal splits (between rows)
				for (let row = 0; row < 2; row++) {
					for (let col = 0; col < 12; col++) {
						const topNum = boardNumbers[row][col];
						const bottomNum = boardNumbers[row + 1][col];
						const spotCX = boardNumbersStartX + col * (boardCellWidth + boardGap) + boardCellWidth / 2;
						const spotCY = boardY + (row + 1) * (boardCellHeight + boardGap) - boardGap / 2;
						const spotRadius = boardChipSize / 2;
						const splitKey = `split-${Math.min(topNum, bottomNum)}-${Math.max(topNum, bottomNum)}`;
						const isHovered = this.hoveredBoardCell && this.hoveredBoardCell.key === splitKey;

						if (isHovered) {
							ctx.save();
							ctx.beginPath();
							ctx.arc(spotCX, spotCY, spotRadius, 0, Math.PI * 2);
							ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
							ctx.fill();
							ctx.restore();
						}
					}
				}

				// Vertical splits (between columns)
				for (let row = 0; row < 3; row++) {
					for (let col = 0; col < 11; col++) {
						const leftNum = boardNumbers[row][col];
						const rightNum = boardNumbers[row][col + 1];
						const spotCX = boardNumbersStartX + (col + 1) * (boardCellWidth + boardGap) - boardGap / 2;
						const spotCY = boardY + row * (boardCellHeight + boardGap) + boardCellHeight / 2;
						const spotRadius = boardChipSize / 2;
						const splitKey = `split-${Math.min(leftNum, rightNum)}-${Math.max(leftNum, rightNum)}`;
						const isHovered = this.hoveredBoardCell && this.hoveredBoardCell.key === splitKey;

						if (isHovered) {
							ctx.save();
							ctx.beginPath();
							ctx.arc(spotCX, spotCY, spotRadius, 0, Math.PI * 2);
							ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
							ctx.fill();
							ctx.restore();
						}
					}
				}

				// ============================================
				// CORNER BET SPOTS (between 4 numbers)
				// ============================================
				for (let row = 0; row < 2; row++) {
					for (let col = 0; col < 11; col++) {
						const nums = [
							boardNumbers[row][col],
							boardNumbers[row][col + 1],
							boardNumbers[row + 1][col],
							boardNumbers[row + 1][col + 1]
						].sort((a, b) => a - b);
						const cornerKey = `corner-${nums.join('-')}`;
						const spotCX = boardNumbersStartX + (col + 1) * (boardCellWidth + boardGap) - boardGap / 2;
						const spotCY = boardY + (row + 1) * (boardCellHeight + boardGap) - boardGap / 2;
						const spotRadius = boardChipSize / 2;
						const isHovered = this.hoveredBoardCell && this.hoveredBoardCell.key === cornerKey;

						if (isHovered) {
							ctx.save();
							ctx.beginPath();
							ctx.arc(spotCX, spotCY, spotRadius, 0, Math.PI * 2);
							ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
							ctx.fill();
							ctx.restore();
						}
					}
				}

				// ============================================
				// STREET BET SPOTS (3 numbers in a row)
				// ============================================
				for (let col = 0; col < 12; col++) {
					const nums = [boardNumbers[0][col], boardNumbers[1][col], boardNumbers[2][col]].sort((a, b) => a - b);
					const streetKey = `street-${nums.join('-')}`;
					// Position at bottom edge of row 2 (half on number, half on green)
					const spotCX = boardNumbersStartX + col * (boardCellWidth + boardGap) + boardCellWidth / 2;
					const spotCY = boardY + boardTotalHeight; // At the bottom edge
					const spotRadius = boardChipSize / 2;
					const isHovered = this.hoveredBoardCell && this.hoveredBoardCell.key === streetKey;

					if (isHovered) {
						ctx.save();
						ctx.beginPath();
						ctx.arc(spotCX, spotCY, spotRadius, 0, Math.PI * 2);
						ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
						ctx.fill();
						ctx.restore();
					}
				}

				// ============================================
				// LINE BET SPOTS (6 numbers - 2 streets)
				// ============================================
				for (let col = 0; col < 11; col++) {
					const nums = [
						boardNumbers[0][col], boardNumbers[1][col], boardNumbers[2][col],
						boardNumbers[0][col + 1], boardNumbers[1][col + 1], boardNumbers[2][col + 1]
					].sort((a, b) => a - b);
					const lineKey = `line-${nums[0]}-${nums[5]}`;
					// Position at bottom edge between two columns (half on number, half on green)
					const spotCX = boardNumbersStartX + (col + 1) * (boardCellWidth + boardGap) - boardGap / 2;
					const spotCY = boardY + boardTotalHeight; // At the bottom edge
					const spotRadius = boardChipSize / 2;
					const isHovered = this.hoveredBoardCell && this.hoveredBoardCell.key === lineKey;

					if (isHovered) {
						ctx.save();
						ctx.beginPath();
						ctx.arc(spotCX, spotCY, spotRadius, 0, Math.PI * 2);
						ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
						ctx.fill();
						ctx.restore();
					}
				}


				// ============================================
				// TOP LINE BET SPOT (0, 00, 1, 2, 3)
				// ============================================
				const topLineKey = 'line-0-00-1-2-3';
				const topLineSpotCX = boardNumbersStartX - boardGap / 2; // At edge between 0/00 and numbers
				const topLineSpotCY = boardY + boardTotalHeight; // At the bottom edge (same as other line bets)
				const topLineIsHovered = this.hoveredBoardCell && this.hoveredBoardCell.key === topLineKey;

				if (topLineIsHovered) {
					ctx.save();
					ctx.beginPath();
					ctx.arc(topLineSpotCX, topLineSpotCY, boardChipSize / 2, 0, Math.PI * 2);
					ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
					ctx.fill();
					ctx.restore();
				}
				// ============================================
				// ZERO LAYER BET SPOTS (splits with 0/00)
				// ============================================
				const zeroSpotRadius = boardChipSize / 2;

				// Edge X position (between 0/00 and numbers)
				const zeroEdgeX = boardNumbersStartX - boardGap / 2;

				// Row Y positions for the number cells
				const row0TopY = boardY; // Top of row with 3
				const row0CenterY = boardY + boardCellHeight / 2; // Center of row with 3
				const row0BottomY = boardY + boardCellHeight; // Bottom of row with 3
				const row1TopY = boardY + boardCellHeight + boardGap; // Top of row with 2
				const row1BottomY = boardY + 2 * boardCellHeight + boardGap; // Bottom of row with 2
				const row2TopY = boardY + 2 * (boardCellHeight + boardGap); // Top of row with 1
				const row2CenterY = row2TopY + boardCellHeight / 2; // Center of row with 1
				const row2BottomY = boardY + boardTotalHeight; // Bottom of row with 1

				// Zero cell boundaries
				const zeroBorderY = boardY + zeroH; // Border between 0 and 00

				// Bet spot positions:
				// Row center Y for 2 (for basket bet)
				const row1CenterY = row1TopY + boardCellHeight / 2;

				// 0-3: At the edge where 0 meets 3 (bottom of row 0)
				const zero3CX = zeroEdgeX;
				const zero3CY = boardY + boardCellHeight / 2; // Center of row 0 (middle of 3)

				// 0-2: At the edge where 0 meets 2 (top of row 1)
				const zero2CX = zeroEdgeX;
				const zero2CY = row1TopY + 15; // Moved down to not cross number 3

				// 0-00: Between 0 and 00 - centered in zero area
				const zero00CX = boardStartX + boardZeroWidth / 2;
				const zero00CY = boardY + boardTotalHeight / 2; // Centered between 0 and 00

				// 0-00-2: In the middle of 2, crossing 0 and 00 (basket bet)
				const basketCX = zeroEdgeX;
				const basketCY = row1CenterY;

				// 00-2: At the bottom of 2, crossing with 00
				const split002CX = zeroEdgeX;
				const split002CY = row1BottomY - 15; // Moved up to not cross number 1

				// 00-1: At the edge where 00 meets 1
				const split001CX = zeroEdgeX;
				const split001CY = row2TopY + boardCellHeight / 2; // Center of row 2 (middle of 1)

				// 1. 0-3 split hover (between 0 and 3)
				if (this.hoveredBoardCell && this.hoveredBoardCell.key === 'split-0-3') {
					ctx.save();
					ctx.beginPath();
					ctx.arc(zero3CX, zero3CY, zeroSpotRadius, 0, Math.PI * 2);
					ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
					ctx.fill();
					ctx.restore();
				}

				// 2. 0-2 split hover (between 0 and 2, top of 2)
				if (this.hoveredBoardCell && this.hoveredBoardCell.key === 'split-0-2') {
					ctx.save();
					ctx.beginPath();
					ctx.arc(zero2CX, zero2CY, zeroSpotRadius, 0, Math.PI * 2);
					ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
					ctx.fill();
					ctx.restore();
				}

				// 3. 0-00-2 basket hover (in middle of 2)
				if (this.hoveredBoardCell && this.hoveredBoardCell.key === 'street-0-00-2') {
					ctx.save();
					ctx.beginPath();
					ctx.arc(basketCX, basketCY, zeroSpotRadius, 0, Math.PI * 2);
					ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
					ctx.fill();
					ctx.restore();
				}

				// 4. 0-00 split hover (between 0 and 00)
				if (this.hoveredBoardCell && this.hoveredBoardCell.key === 'split-0-00') {
					ctx.save();
					ctx.beginPath();
					ctx.arc(zero00CX, zero00CY, zeroSpotRadius, 0, Math.PI * 2);
					ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
					ctx.fill();
					ctx.restore();
				}

				// 5. 00-2 split hover (bottom of 2, crossing 00)
				if (this.hoveredBoardCell && this.hoveredBoardCell.key === 'split-00-2') {
					ctx.save();
					ctx.beginPath();
					ctx.arc(split002CX, split002CY, zeroSpotRadius, 0, Math.PI * 2);
					ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
					ctx.fill();
					ctx.restore();
				}

				// 6. 00-1 split hover (between 00 and 1)
				if (this.hoveredBoardCell && this.hoveredBoardCell.key === 'split-00-1') {
					ctx.save();
					ctx.beginPath();
					ctx.arc(split001CX, split001CY, zeroSpotRadius, 0, Math.PI * 2);
					ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
					ctx.fill();
					ctx.restore();
				}

				// ============================================
				// DRAW CHIPS ON BOARD
				// ============================================
				// Build chip info per number from all placements (including grouped bets)
				const boardChipInfo = new Map();

				this.state.placements.forEach((placement) => {
					const targets = placement.targets || [];
					const multiplier = placement.multiplier;
					const betType = placement.type;

					// These bet types show chips on individual numbers
					const showOnBoard = betType === 'sector' || betType === 'straight'; // Only race track zones and straight bets show on board


					if (showOnBoard && targets.length > 0) {
						targets.forEach((num) => {
							const numKey = String(num);
							if (!boardChipInfo.has(numKey)) {
								boardChipInfo.set(numKey, { totalValue: 0, lastMultiplier: multiplier, chips: 0 });
							}
							const existing = boardChipInfo.get(numKey);
							existing.totalValue += multiplier;
							existing.lastMultiplier = multiplier;
							existing.chips += 1;
						});
					}
				});


				// Draw chips on number cells (1-36) from all bets
				for (let row = 0; row < 3; row++) {
					for (let col = 0; col < 12; col++) {
						const num = boardNumbers[row][col];
						const numKey = String(num);
						const info = boardChipInfo.get(numKey);
						if (info && info.chips > 0) {
							const cellX = boardNumbersStartX + col * (boardCellWidth + boardGap) + boardCellWidth / 2;
							const cellY = boardY + row * (boardCellHeight + boardGap) + boardCellHeight / 2;
							const chipColor = this.getChipColor(info.lastMultiplier);

							ctx.save();
							ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
							ctx.shadowBlur = 4;
							ctx.shadowOffsetX = 0;
							ctx.shadowOffsetY = 0;
							drawSmallChip(cellX, cellY, chipColor, Math.round(info.totalValue), boardChipSize);
							ctx.restore();
						}
					}
				}

				// Draw chips on 0
				const zeroInfo = boardChipInfo.get('0');
				if (zeroInfo && zeroInfo.chips > 0) {
					const zeroH = boardCellHeight * 1.5 + boardGap * 0.5;
					const chipX = boardStartX + boardZeroWidth / 2;
					const chipY = boardY + zeroH / 2;
					const chipColor = this.getChipColor(zeroInfo.lastMultiplier);
					ctx.save();
					ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
					ctx.shadowBlur = 4;
					drawSmallChip(chipX, chipY, chipColor, Math.round(zeroInfo.totalValue), boardChipSize);
					ctx.restore();
				}

				// Draw chips on 00
				const doubleZeroInfo = boardChipInfo.get('00');
				if (doubleZeroInfo && doubleZeroInfo.chips > 0) {
					const zeroH = boardCellHeight * 1.5 + boardGap * 0.5;
					const doubleZeroY = boardY + zeroH + boardGap;
					const doubleZeroH = boardTotalHeight - zeroH - boardGap;
					const chipX = boardStartX + boardZeroWidth / 2;
					const chipY = doubleZeroY + doubleZeroH / 2;
					const chipColor = this.getChipColor(doubleZeroInfo.lastMultiplier);
					ctx.save();
					ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
					ctx.shadowBlur = 4;
					drawSmallChip(chipX, chipY, chipColor, Math.round(doubleZeroInfo.totalValue), boardChipSize);
					ctx.restore();
				}

				// Draw chips on 2:1 column bets (from summary, not per-number)
				if (this.summary) {
					const columnKeys = ['column-col3', 'column-col2', 'column-col1'];
					const colRailX = boardEndX + boardGap;
					for (let row = 0; row < 3; row++) {
						const info = this.summary[columnKeys[row]];
						if (info && info.chips > 0) {
							const chipX = colRailX + boardColRailWidth / 2;
							const chipY = boardY + row * (boardCellHeight + boardGap) + boardCellHeight / 2;
							const chipColor = this.getChipColor(info.lastMultiplier);
							ctx.save();
							ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
							ctx.shadowBlur = 4;
							drawSmallChip(chipX, chipY, chipColor, Math.round(info.totalValue), boardChipSize);
							ctx.restore();
						}
					}
				}
				if (this.summary) {
					// Draw chips on split bets
					Object.entries(this.summary).forEach(([key, info]) => {
						if (key.startsWith('split-') && info.chips > 0) {
							const parts = key.replace('split-', '').split('-');
							const nums = parts.map(n => isNaN(n) ? n : parseInt(n));
							let chipX, chipY;

							// Handle 0/00 splits
							if (parts.includes('0') || parts.includes('00')) {
								// Zero layer splits - use same positions as hover zones
								const zeroH = boardCellHeight * 1.5 + boardGap * 0.5;
								const zeroEdgeX = boardNumbersStartX - boardGap / 2;
								const zeroBorderY = boardY + zeroH;

								if (key === 'split-0-00') {
									chipX = boardStartX + boardZeroWidth / 2;
									chipY = boardY + boardTotalHeight / 2; // Centered between 0 and 00
								} else if (key === 'split-0-2') {
									chipX = zeroEdgeX;
									chipY = boardY + boardCellHeight + boardGap + 15; // Top of row 2 + offset (not crossing 3)
								} else if (key === 'split-0-3') {
									chipX = zeroEdgeX;
									chipY = boardY + boardCellHeight / 2; // Center of row 0 (middle of 3)
								} else if (key === 'split-00-2') {
									chipX = zeroEdgeX;
									chipY = row1BottomY - 15; // Bottom of row 2 - offset (not crossing 1)
								} else if (key === 'split-00-1') {
									chipX = zeroEdgeX;
									chipY = boardY + 2 * (boardCellHeight + boardGap) + boardCellHeight / 2; // Center of row 2
								}
							} else {
								// Regular splits between numbers
								const num1 = nums[0];
								const num2 = nums[1];
								const diff = Math.abs(num1 - num2);

								// Find positions of both numbers
								let row1, col1, row2, col2;
								for (let r = 0; r < 3; r++) {
									for (let c = 0; c < 12; c++) {
										if (boardNumbers[r][c] === num1) {
											row1 = r;
											col1 = c;
										}
										if (boardNumbers[r][c] === num2) {
											row2 = r;
											col2 = c;
										}
									}
								}

								if (row1 !== undefined && col1 !== undefined && row2 !== undefined && col2 !== undefined) {
									if (diff === 3) {
										// Vertical split (same row, adjacent columns) - diff of 3
										const minCol = Math.min(col1, col2);
										const row = row1;
										chipX = boardNumbersStartX + (minCol + 1) * (boardCellWidth + boardGap) - boardGap / 2;
										chipY = boardY + row * (boardCellHeight + boardGap) + boardCellHeight / 2;
									} else if (diff === 1) {
										// Horizontal split (same column, adjacent rows) - diff of 1
										const minRow = Math.min(row1, row2);
										const col = col1;
										chipX = boardNumbersStartX + col * (boardCellWidth + boardGap) + boardCellWidth / 2;
										chipY = boardY + (minRow + 1) * (boardCellHeight + boardGap) - boardGap / 2;
									}
								}
							}
							if (chipX && chipY) {
								const chipColor = this.getChipColor(info.lastMultiplier);
								ctx.save();
								ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
								ctx.shadowBlur = 4;
								drawSmallChip(chipX, chipY, chipColor, Math.round(info.totalValue), boardChipSize);
								ctx.restore();
							}
						}
					});

					// Draw chips on corner bets
					Object.entries(this.summary).forEach(([key, info]) => {
						if (key.startsWith('corner-') && info.chips > 0) {
							const nums = key.replace('corner-', '').split('-').map(Number).sort((a, b) => a - b);

							for (let row = 0; row < 2; row++) {
								for (let col = 0; col < 11; col++) {
									const cornerNums = [
										boardNumbers[row][col], boardNumbers[row][col + 1],
										boardNumbers[row + 1][col], boardNumbers[row + 1][col + 1]
									].sort((a, b) => a - b);

									if (cornerNums.join('-') === nums.join('-')) {
										const chipX = boardNumbersStartX + (col + 1) * (boardCellWidth + boardGap) - boardGap / 2;
										const chipY = boardY + (row + 1) * (boardCellHeight + boardGap) - boardGap / 2;
										const chipColor = this.getChipColor(info.lastMultiplier);
										ctx.save();
										ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
										ctx.shadowBlur = 4;
										drawSmallChip(chipX, chipY, chipColor, Math.round(info.totalValue), boardChipSize);
										ctx.restore();
									}
								}
							}
						}
					});

					// Draw chips on street bets
					Object.entries(this.summary).forEach(([key, info]) => {
						if (key.startsWith('street-') && info.chips > 0 && !key.includes('00')) {
							const nums = key.replace('street-', '').split('-').map(n => parseInt(n)).filter(n => !isNaN(n));
							if (nums.length === 3) {
								const maxNum = Math.max(...nums);
								const col = boardNumbers[0].indexOf(maxNum);
								if (col >= 0) {
									const chipX = boardNumbersStartX + col * (boardCellWidth + boardGap) + boardCellWidth / 2;
									const chipY = boardY + boardTotalHeight;
									const chipColor = this.getChipColor(info.lastMultiplier);
									ctx.save();
									ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
									ctx.shadowBlur = 4;
									drawSmallChip(chipX, chipY, chipColor, Math.round(info.totalValue), boardChipSize);
									ctx.restore();
								}
							}
						}
					});

					// Draw chips on line bets
					Object.entries(this.summary).forEach(([key, info]) => {
						if (key.startsWith('line-') && info.chips > 0) {
							const parts = key.replace('line-', '').split('-');
							const firstNum = parseInt(parts[0]);
							const col = boardNumbers[2].indexOf(firstNum);
							if (col >= 0) {
								const chipX = boardNumbersStartX + (col + 1) * (boardCellWidth + boardGap) - boardGap / 2;
								const chipY = boardY + boardTotalHeight;
								const chipColor = this.getChipColor(info.lastMultiplier);
								ctx.save();
								ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
								ctx.shadowBlur = 4;
								drawSmallChip(chipX, chipY, chipColor, Math.round(info.totalValue), boardChipSize);
								ctx.restore();
							}
						}
					});


					// Draw chip on top line (0, 00, 1, 2, 3) bet
					const topLineInfo = this.summary['line-0-00-1-2-3'];
					if (topLineInfo && topLineInfo.chips > 0) {
						const topLineChipX = boardNumbersStartX - boardGap / 2;
						const topLineChipY = boardY + boardTotalHeight;
						const chipColor = this.getChipColor(topLineInfo.lastMultiplier);
						ctx.save();
						ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
						ctx.shadowBlur = 4;
						drawSmallChip(topLineChipX, topLineChipY, chipColor, Math.round(topLineInfo.totalValue), boardChipSize);
						ctx.restore();
					}
					// Draw chip on basket (0-00-2) if bet
					const basketInfo = this.summary['street-0-00-2'];
					if (basketInfo && basketInfo.chips > 0) {
						const zeroH = boardCellHeight * 1.5 + boardGap * 0.5;
						const zeroEdgeX = boardNumbersStartX - boardGap / 2;
						const zeroBorderY = boardY + zeroH;
						const chipColor = this.getChipColor(basketInfo.lastMultiplier);
						ctx.save();
						ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
						ctx.shadowBlur = 4;
						const row1CenterY = boardY + boardCellHeight + boardGap + boardCellHeight / 2;
						drawSmallChip(zeroEdgeX, row1CenterY, chipColor, Math.round(basketInfo.totalValue), boardChipSize);
						ctx.restore();
					}
				}

				// END BETTING BOARD
				// ============================================

				// Dozen bets row (1st 12, 2nd 12, 3rd 12) - above outside bets
				const dozenY = 1120; // 80px below board // 80px below board // 50px below chip selector
				const dozenHeight = 65; // Increased height
				const dozenGap = 20;
				const totalDozenGaps = 2 * dozenGap;
				const fullTrackWidth = boardAlignEndX - boardAlignStartX; // Match board number grid width (1860 - 140 = 1720)
				const dozenStartX = boardAlignStartX; // Align with board numbers (140)
				const dozenWidth = (fullTrackWidth - totalDozenGaps) / 3;
				const dozenBets = [
					{ key: '1st12', label: '1ST 12', numbers: [1,2,3,4,5,6,7,8,9,10,11,12] },
					{ key: '2nd12', label: '2ND 12', numbers: [13,14,15,16,17,18,19,20,21,22,23,24] },
					{ key: '3rd12', label: '3RD 12', numbers: [25,26,27,28,29,30,31,32,33,34,35,36] }
				];

				for (let i = 0; i < 3; i++) {
					const bet = dozenBets[i];
					const x = dozenStartX + i * (dozenWidth + dozenGap);

					// Draw outer shadow (3D effect)
					ctx.save();
					ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
					ctx.shadowBlur = Math.max(3, outerRadius * 0.03);
					ctx.shadowOffsetX = 3;
					ctx.shadowOffsetY = 3;

					// Main background with nicer gradient
					const bgGradient = ctx.createLinearGradient(x, dozenY, x, dozenY + dozenHeight);
					bgGradient.addColorStop(0, '#3d5a80');
					bgGradient.addColorStop(0.3, '#2c4a6e');
					bgGradient.addColorStop(0.7, '#1e3a5f');
					bgGradient.addColorStop(1, '#152a45');
					ctx.fillStyle = bgGradient;
					ctx.fillRect(x, dozenY, dozenWidth, dozenHeight);
					ctx.restore();

					// Draw copper/gold inset shadow at top
					ctx.save();
					ctx.beginPath();
					ctx.rect(x, dozenY, dozenWidth, dozenHeight);
					ctx.clip();
					const topInset = ctx.createLinearGradient(x, dozenY, x, dozenY + 10);
					topInset.addColorStop(0, 'rgba(184, 134, 80, 0.35)');
					topInset.addColorStop(1, 'rgba(184, 134, 80, 0)');
					ctx.fillStyle = topInset;
					ctx.fillRect(x, dozenY, dozenWidth, 10);
					ctx.restore();

					// Draw copper/gold inset shadow at bottom
					ctx.save();
					ctx.beginPath();
					ctx.rect(x, dozenY, dozenWidth, dozenHeight);
					ctx.clip();
					const bottomInset = ctx.createLinearGradient(x, dozenY + dozenHeight - 12, x, dozenY + dozenHeight);
					bottomInset.addColorStop(0, 'rgba(0, 0, 0, 0)');
					bottomInset.addColorStop(1, 'rgba(139, 90, 43, 0.4)');
					ctx.fillStyle = bottomInset;
					ctx.fillRect(x, dozenY + dozenHeight - 12, dozenWidth, 12);
					ctx.restore();

					// Draw border (2px gold)
					ctx.strokeStyle = '#d4af37';
					ctx.lineWidth = 2;
					ctx.strokeRect(x, dozenY, dozenWidth, dozenHeight);

					// Label in center
					ctx.font = 'bold 38px Arial';
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					ctx.fillStyle = 'white';
					ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
					ctx.shadowBlur = 4;
					ctx.shadowOffsetX = 1;
					ctx.shadowOffsetY = 1;
					ctx.fillText(bet.label, x + dozenWidth / 2, dozenY + dozenHeight / 2);
					ctx.shadowColor = 'transparent';
					ctx.shadowBlur = 0;
				}

				// Dozen hover highlights
				const dozenHoverKeys = ['1st12', '2nd12', '3rd12'];
				const hoveredDozenIndex = dozenHoverKeys.indexOf(this.rouletteHoveredZone);
				if (hoveredDozenIndex !== -1) {
					ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
					const hoverX = dozenStartX + hoveredDozenIndex * (dozenWidth + dozenGap);
					ctx.fillRect(hoverX, dozenY, dozenWidth, dozenHeight);
				}

				// Draw chips on dozen bets
				const dozenBetTypes = {
					'dozen-1st12': 0,
					'dozen-2nd12': 1,
					'dozen-3rd12': 2
				};

				if (this.summary) {
					Object.entries(this.summary).forEach(([key, info]) => {
						const slotIndex = dozenBetTypes[key];
						if (slotIndex !== undefined && info.chips > 0) {
							const chipX = dozenStartX + slotIndex * (dozenWidth + dozenGap) + dozenWidth / 2;
							const chipY = dozenY + dozenHeight / 2;
							const chipSize = 42;
							const chipColor = this.getChipColor(info.lastMultiplier);
							drawSmallChip(chipX, chipY, chipColor, Math.round(info.totalValue), chipSize);
						}
					});
				}

				// Outside bets row with gaps
				const outsideY = 1205; // dozenY + dozenHeight + dozenGap // dozenY + dozenHeight + dozenGap // Below dozen row // Below dozen bets
				const outsideHeight = 90; // Extra height for diamond padding
				const outsideGap = 20;
				const totalGaps = 5 * outsideGap;
				const outsideStartX = boardAlignStartX; // Align with board numbers (140)
				const outsideFullWidth = boardAlignEndX - boardAlignStartX; // Match board number grid width (1720)
				const outsideWidth = (outsideFullWidth - totalGaps) / 6;
				const outsideBets = [
					{ key: 'low', label: '1 to 18', hasBg: true },
					{ key: 'even', label: 'EVEN', hasBg: true },
					{ key: 'red', label: 'RED', hasBg: false },
					{ key: 'black', label: 'BLACK', hasBg: false },
					{ key: 'odd', label: 'ODD', hasBg: true },
					{ key: 'high', label: '19 to 36', hasBg: true }
				];

				for (let i = 0; i < 6; i++) {
					const bet = outsideBets[i];
					const x = outsideStartX + i * (outsideWidth + outsideGap);

					if (bet.hasBg) {
						// Draw outer shadow (3D effect)
						ctx.save();
						ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
						ctx.shadowBlur = Math.max(3, outerRadius * 0.03);
						ctx.shadowOffsetX = 3;
						ctx.shadowOffsetY = 3;

						// Main background with nicer gradient
						const bgGradient = ctx.createLinearGradient(x, outsideY, x, outsideY + outsideHeight);
						bgGradient.addColorStop(0, '#3d5a80');
						bgGradient.addColorStop(0.3, '#2c4a6e');
						bgGradient.addColorStop(0.7, '#1e3a5f');
						bgGradient.addColorStop(1, '#152a45');
						ctx.fillStyle = bgGradient;
						ctx.fillRect(x, outsideY, outsideWidth, outsideHeight);
						ctx.restore();

						// Draw copper/gold inset shadow at top
						ctx.save();
						ctx.beginPath();
						ctx.rect(x, outsideY, outsideWidth, outsideHeight);
						ctx.clip();
						const topInset = ctx.createLinearGradient(x, outsideY, x, outsideY + 10);
						topInset.addColorStop(0, 'rgba(184, 134, 80, 0.35)');
						topInset.addColorStop(1, 'rgba(184, 134, 80, 0)');
						ctx.fillStyle = topInset;
						ctx.fillRect(x, outsideY, outsideWidth, 10);
						ctx.restore();

						// Draw copper/gold inset shadow at bottom
						ctx.save();
						ctx.beginPath();
						ctx.rect(x, outsideY, outsideWidth, outsideHeight);
						ctx.clip();
						const bottomInset = ctx.createLinearGradient(x, outsideY + outsideHeight - 12, x, outsideY + outsideHeight);
						bottomInset.addColorStop(0, 'rgba(0, 0, 0, 0)');
						bottomInset.addColorStop(1, 'rgba(139, 90, 43, 0.4)');
						ctx.fillStyle = bottomInset;
						ctx.fillRect(x, outsideY + outsideHeight - 12, outsideWidth, 12);
						ctx.restore();

						// Draw border (2px gold)
						ctx.strokeStyle = '#d4af37';
						ctx.lineWidth = 2;
						ctx.strokeRect(x, outsideY, outsideWidth, outsideHeight);

						// Label in center
						ctx.font = 'bold 38px Arial';
						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';
						ctx.fillStyle = 'white';
						ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
						ctx.shadowBlur = 4;
						ctx.shadowOffsetX = 1;
						ctx.shadowOffsetY = 1;
						ctx.fillText(bet.label, x + outsideWidth / 2, outsideY + outsideHeight / 2);
						ctx.shadowColor = 'transparent';
						ctx.shadowBlur = 0;
					} else {
						// RED and BLACK - no background, just diamond stretched horizontally
						const diamondWidth = 50;
						const diamondHeight = 35;
						const cx = x + outsideWidth / 2;
						const cy = outsideY + outsideHeight / 2 - 2;

						ctx.fillStyle = bet.key === 'red' ? '#c41e3a' : '#1a1a1a';
						ctx.beginPath();
						ctx.moveTo(cx, cy - diamondHeight);
						ctx.lineTo(cx + diamondWidth, cy);
						ctx.lineTo(cx, cy + diamondHeight);
						ctx.lineTo(cx - diamondWidth, cy);
						ctx.closePath();
						ctx.fill();
						ctx.strokeStyle = '#d4af37';
						ctx.lineWidth = 2;
						ctx.stroke();

					}
				}

				// Outside bets hover highlights
				const outsideHoverKeys = ['low', 'even', 'red', 'black', 'odd', 'high'];
				const hoveredOutsideIndex = outsideHoverKeys.indexOf(this.rouletteHoveredZone);
				if (hoveredOutsideIndex !== -1) {
					const hoverX = outsideStartX + hoveredOutsideIndex * (outsideWidth + outsideGap);
					const bet = outsideBets[hoveredOutsideIndex];

					if (bet.hasBg) {
						ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
						ctx.fillRect(hoverX, outsideY, outsideWidth, outsideHeight);
					} else {
						// Highlight diamond
						const diamondWidth = 50;
						const diamondHeight = 35;
						const cx = hoverX + outsideWidth / 2;
						const cy = outsideY + outsideHeight / 2 - 2;
						ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
						ctx.beginPath();
						ctx.moveTo(cx, cy - diamondHeight - 3);
						ctx.lineTo(cx + diamondWidth + 3, cy);
						ctx.lineTo(cx, cy + diamondHeight + 3);
						ctx.lineTo(cx - diamondWidth - 3, cy);
						ctx.closePath();
						ctx.fill();
					}
				}

				// Draw chips on outside bets (using premium casino style)
				const outsideBetTypes = {
					'range-low': 0,
					'parity-even': 1,
					'color-red': 2,
					'color-black': 3,
					'parity-odd': 4,
					'range-high': 5
				};

				// Chip colors for outside bets
				const outsideChipColors = {
					1: '#f59e0b',
					2: '#f97316',
					5: '#dc2626',
					10: '#16a34a',
					20: '#2563eb',
					30: '#7c3aed',
					50: '#0891b2',
					100: '#1f2937',
					200: '#1d4ed8',
					500: '#7e22ce'
				};
				if (this.summary) {
					Object.entries(this.summary).forEach(([key, info]) => {
						const slotIndex = outsideBetTypes[key];
						if (slotIndex !== undefined && info.chips > 0) {
							const chipX = outsideStartX + slotIndex * (outsideWidth + outsideGap) + outsideWidth / 2;
							const chipY = outsideY + outsideHeight / 2;
							const chipSize = 56;
							const chipColor = outsideChipColors[info.lastMultiplier] || '#475569';
							// Use drawSmallChip for premium casino style
							drawSmallChip(chipX, chipY, chipColor, Math.round(info.totalValue), chipSize);
						}
					});
				}
				// === CHIP SELECTOR AREA ===
				const chipRowY = 1445; // 10px more top padding // Centered in chip bar // 80px below outside bets // Centered in chip bar // Below outside bets, above button bar
				const pickerChipSize = 80; // Smaller chips for compact bar // Smaller chips
				const chipRadius = pickerChipSize / 2;
				const canvasWidth = 2000;
				const sidePadding = 60;
				const chipAreaHeight = 120; // chip(80) + 20 top + 20 bottom padding // Reduced height: chip(80) + 10 top + 10 bottom
				const chipAreaY = chipRowY - chipAreaHeight / 2; // Center chips vertically in bar // 20px top padding // Chip centered with 10px padding // 20px more top padding

				// === GREEN GRADIENT BACKGROUND FOR CHIP SELECTOR ===
				const chipBgGradient = ctx.createLinearGradient(0, chipAreaY, 0, chipAreaY + chipAreaHeight);
				chipBgGradient.addColorStop(0, '#0d3d0d');
				chipBgGradient.addColorStop(0.3, '#0a5a0a');
				chipBgGradient.addColorStop(0.5, '#0d6b0d');
				chipBgGradient.addColorStop(0.7, '#0a5a0a');
				chipBgGradient.addColorStop(1, '#073d07');
				ctx.fillStyle = chipBgGradient;
				ctx.fillRect(0, chipAreaY, canvasWidth, chipAreaHeight);

				// Shadow at top (pointing toward board)
				const chipShadowGradient = ctx.createLinearGradient(0, chipAreaY - 20, 0, chipAreaY);
				chipShadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
				chipShadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
				ctx.fillStyle = chipShadowGradient;
				ctx.fillRect(0, chipAreaY - 20, canvasWidth, 20);

				// Top golden border with glow
				ctx.shadowColor = '#d4af37';
				ctx.shadowBlur = 8;
				ctx.shadowOffsetY = -2;
				ctx.beginPath();
				ctx.moveTo(0, chipAreaY);
				ctx.lineTo(canvasWidth, chipAreaY);
				ctx.strokeStyle = '#d4af37';
				ctx.lineWidth = 4;
				ctx.stroke();
				ctx.shadowColor = 'transparent';
				ctx.shadowBlur = 0;
				ctx.shadowOffsetY = 0;

				// Inner gold line
				ctx.beginPath();
				ctx.moveTo(0, chipAreaY + 5);
				ctx.lineTo(canvasWidth, chipAreaY + 5);
				ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
				ctx.lineWidth = 2;
				ctx.stroke();
				const chipValues = [1, 2, 5, 10, 20, 30, 50, 100, 200, 500];
				const chipCount = chipValues.length;

				// Calculate gap to spread chips across full width
				const availableWidth = canvasWidth - (2 * sidePadding) - pickerChipSize;
				const chipGapX = availableWidth / (chipCount - 1);
				const chipStartX = sidePadding + chipRadius;

				const chipColors = {
					1: '#f59e0b',    // Amber/Gold
					2: '#f97316',    // Orange
					5: '#dc2626',    // Red
					10: '#16a34a',   // Green
					20: '#2563eb',   // Blue
					30: '#7c3aed',   // Purple
					50: '#0891b2',   // Cyan
					100: '#1f2937',  // Dark gray/black
					200: '#1d4ed8',  // Royal blue
					500: '#7e22ce'   // Deep purple
				};

				chipValues.forEach((value, index) => {
					const cx = chipStartX + index * chipGapX;
					const isSelected = this.currentChipValue === value;
					const isHovered = this.hoveredChipValue === value;
					const cy = chipRowY;
					const chipColor = chipColors[value] || '#475569';

					ctx.save();

					// === OUTER CHIP BASE (main color) ===
					ctx.beginPath();
					ctx.arc(cx, cy, chipRadius, 0, Math.PI * 2);
					ctx.fillStyle = chipColor;
					ctx.fill();

					// === EDGE STRIPE PATTERN (8 black/white rectangles) ===
					const stripeCount = 8;
					for (let i = 0; i < stripeCount; i++) {
						const angle = (i / stripeCount) * Math.PI * 2 - Math.PI / 2;
						ctx.save();
						ctx.translate(cx, cy);
						ctx.rotate(angle);
						// Black outer stripe
						ctx.fillStyle = '#1a1a1a';
						const stripeDepth = chipRadius * 0.22;
						const stripeWidth = chipRadius * 0.28;
						ctx.fillRect(chipRadius - stripeDepth, -stripeWidth/2, stripeDepth, stripeWidth);
						// White inner stripe
						ctx.fillStyle = '#ffffff';
						ctx.fillRect(chipRadius - stripeDepth + 2, -stripeWidth/2 + 2, stripeDepth - 4, stripeWidth - 4);
						ctx.restore();
					}

					// === OUTER DARK RING ===
					ctx.beginPath();
					ctx.arc(cx, cy, chipRadius - 1, 0, Math.PI * 2);
					ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
					ctx.lineWidth = 1;
					ctx.stroke();

					// === WHITE DECORATIVE RING (with pattern) ===
					ctx.beginPath();
					ctx.arc(cx, cy, chipRadius * 0.75, 0, Math.PI * 2);
					ctx.strokeStyle = '#ffffff';
					ctx.lineWidth = chipRadius * 0.12;
					ctx.stroke();

					// === SMALL STARS ON WHITE RING ===
					const starCount = 8;
					const starRingRadius = chipRadius * 0.75;
					for (let i = 0; i < starCount; i++) {
						const angle = (i / starCount) * Math.PI * 2 + Math.PI / 8;
						const sx = cx + Math.cos(angle) * starRingRadius;
						const sy = cy + Math.sin(angle) * starRingRadius;
						ctx.beginPath();
						ctx.fillStyle = chipColor;
						const starSize = chipRadius * 0.06;
						for (let j = 0; j < 5; j++) {
							const starAngle = (j / 5) * Math.PI * 2 - Math.PI / 2;
							const px = sx + Math.cos(starAngle) * starSize;
							const py = sy + Math.sin(starAngle) * starSize;
							if (j === 0) ctx.moveTo(px, py);
							else ctx.lineTo(px, py);
						}
						ctx.closePath();
						ctx.fill();
					}

					// === INNER COLORED RING ===
					ctx.beginPath();
					ctx.arc(cx, cy, chipRadius * 0.62, 0, Math.PI * 2);
					ctx.strokeStyle = chipColor;
					ctx.lineWidth = chipRadius * 0.08;
					ctx.stroke();

					// === INNER DARK CENTER CIRCLE ===
					ctx.beginPath();
					ctx.arc(cx, cy, chipRadius * 0.52, 0, Math.PI * 2);
					ctx.fillStyle = '#2a2a3a';
					ctx.fill();

					// Inner gradient for depth
					const innerGrad = ctx.createRadialGradient(cx - chipRadius * 0.1, cy - chipRadius * 0.1, 0, cx, cy, chipRadius * 0.52);
					innerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
					innerGrad.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
					ctx.fillStyle = innerGrad;
					ctx.fill();

					// === 4 WHITE DOTS at cardinal positions ===
					const dotPositions = [0, Math.PI/2, Math.PI, Math.PI * 1.5];
					const dotRingRadius = chipRadius * 0.88;
					dotPositions.forEach(angle => {
						const dx = cx + Math.cos(angle) * dotRingRadius;
						const dy = cy + Math.sin(angle) * dotRingRadius;
						ctx.beginPath();
						ctx.arc(dx, dy, chipRadius * 0.05, 0, Math.PI * 2);
						ctx.fillStyle = '#ffffff';
						ctx.fill();
					});

					// === SPECULAR HIGHLIGHT ===
					const gradient = ctx.createRadialGradient(
							cx - chipRadius * 0.3, cy - chipRadius * 0.3, 0,
							cx - chipRadius * 0.3, cy - chipRadius * 0.3, chipRadius * 0.4
					);
					gradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
					gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
					ctx.beginPath();
					ctx.arc(cx - chipRadius * 0.2, cy - chipRadius * 0.2, chipRadius * 0.35, 0, Math.PI * 2);
					ctx.fillStyle = gradient;
					ctx.fill();

					// === CHIP VALUE TEXT ===
					ctx.font = 'bold 38px Arial';
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
					ctx.fillText(String(value), cx + 1, cy + 1);
					ctx.fillStyle = '#ffffff';
					ctx.fillText(String(value), cx, cy);

					// === SELECTION/HOVER GLOW (white border) ===
					if (isSelected || isHovered) {
						ctx.beginPath();
						ctx.arc(cx, cy, chipRadius + 4, 0, Math.PI * 2);
						ctx.strokeStyle = '#ffffff';
						ctx.lineWidth = 4;
						ctx.stroke();
						ctx.beginPath();
						ctx.arc(cx, cy, chipRadius + 8, 0, Math.PI * 2);
						ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
						ctx.lineWidth = 2;
						ctx.stroke();
					}

					ctx.restore();
				});
				const panelY = 1515; // At bottom of canvas // After chip bar // After chip bar // Right after chip bar // Button bar at bottom
				const panelHeight = 115;
				const buttonHeight = 60;
				const buttonGap = 15;
				const buttonTopPadding = (panelHeight - buttonHeight) / 2;

				// Right side buttons
				const rightButtons = [
					{ key: 'undo', label: 'UNDO', width: 110, enabled: this.undoStack.length > 0 },
					{ key: 'redo', label: 'REDO', width: 110, enabled: this.redoStack.length > 0 },
					{ key: 'rebet', label: 'RE-BET', width: 130, enabled: this.lastBet && this.lastBet.length > 0 },
					{ key: 'spin', label: 'SPIN', width: 160, enabled: !this.isSpinning && !this.wheelAnimating && this.state.placements.length > 0 }
				];

				// Left side buttons (multipliers + clear)
				const leftButtonGap = 12;
				const leftButtons = [
					{ key: 'x1', label: 'x1', width: 60, enabled: true },
					{ key: 'x2', label: 'x2', width: 60, enabled: true },
					{ key: 'x3', label: 'x3', width: 60, enabled: true },
					{ key: 'x4', label: 'x4', width: 60, enabled: true },
					{ key: 'x5', label: 'x5', width: 60, enabled: true },
					{ key: 'clear', label: 'CLEAR', width: 120, enabled: this.state.placements.length > 0 },
					{ key: 'remove', label: this.removeMode ? 'DEACTIVATE REMOVE' : 'REMOVE', width: this.removeMode ? 280 : 150, enabled: true }
				];

				// Calculate right button positions (from right)
				let rightX = 1930;
				const buttonPositions = [];

				for (let i = rightButtons.length - 1; i >= 0; i--) {
					const btn = rightButtons[i];
					rightX -= btn.width;
					buttonPositions.push({ ...btn, x: rightX, y: panelY + buttonTopPadding });
					rightX -= buttonGap;
				}

				// Calculate left button positions (from left)
				let leftX = 70;
				for (let i = 0; i < leftButtons.length; i++) {
					const btn = leftButtons[i];
					buttonPositions.push({ ...btn, x: leftX, y: panelY + buttonTopPadding });
					leftX += btn.width + leftButtonGap;
				}

				// Store for click detection
				this.controlButtons = buttonPositions;

				// === GREEN ROULETTE GRADIENT BACKGROUND ===
				const greenGradient = ctx.createLinearGradient(0, panelY, 0, panelY + panelHeight);
				greenGradient.addColorStop(0, '#0d3d0d');
				greenGradient.addColorStop(0.3, '#0a5a0a');
				greenGradient.addColorStop(0.5, '#0d6b0d');
				greenGradient.addColorStop(0.7, '#0a5a0a');
				greenGradient.addColorStop(1, '#073d07');
				ctx.fillStyle = greenGradient;
				ctx.fillRect(0, panelY, 2000, panelHeight);

				// Shadow at top (pointing toward board)
				const shadowGradient = ctx.createLinearGradient(0, panelY - 20, 0, panelY);
				shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
				shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
				ctx.fillStyle = shadowGradient;
				ctx.fillRect(0, panelY - 20, 2000, 20);

				// Top golden border with glow
				ctx.shadowColor = '#d4af37';
				ctx.shadowBlur = 8;
				ctx.shadowOffsetY = -2;
				ctx.beginPath();
				ctx.moveTo(0, panelY);
				ctx.lineTo(2000, panelY);
				ctx.strokeStyle = '#d4af37';
				ctx.lineWidth = 4;
				ctx.stroke();
				ctx.shadowColor = 'transparent';
				ctx.shadowBlur = 0;
				ctx.shadowOffsetY = 0;

				// Inner gold line
				ctx.beginPath();
				ctx.moveTo(0, panelY + 5);
				ctx.lineTo(2000, panelY + 5);
				ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
				ctx.lineWidth = 2;
				ctx.stroke();

				// === DRAW BUTTONS ===
				buttonPositions.forEach(btn => {
					const isHovered = this.hoveredButton === btn.key;
					const isEnabled = btn.enabled;
					const btnCenterX = btn.x + btn.width / 2;
					const btnCenterY = btn.y + buttonHeight / 2;
					const isMultiplier = ['x1', 'x2', 'x3', 'x4', 'x5'].includes(btn.key);
					const isClear = btn.key === 'clear';
					const isRemove = btn.key === 'remove';
					const isActive = (isMultiplier && this.activeMultiplier === btn.key) || (isRemove && this.removeMode);

					if (btn.key === 'spin') {
						// === SPIN BUTTON with pulse animation ===
						const pulseTime = Date.now() * 0.003;
						const pulseGlow = isEnabled ? Math.abs(Math.sin(pulseTime)) * 0.5 + 0.5 : 0;

						// Outer glow pulse
						if (isEnabled) {
							for (let g = 3; g >= 0; g--) {
								ctx.beginPath();
								ctx.roundRect(btn.x - g * 4, btn.y - g * 4, btn.width + g * 8, buttonHeight + g * 8, 14 + g * 2);
								ctx.fillStyle = `rgba(255, 215, 0, ${pulseGlow * 0.08 * (4 - g)})`;
								ctx.fill();
							}
						}

						// Drop shadow
						ctx.save();
						ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
						ctx.shadowBlur = Math.max(3, outerRadius * 0.03);
						ctx.shadowOffsetX = 3;
						ctx.shadowOffsetY = 3;

						ctx.beginPath();
						ctx.roundRect(btn.x, btn.y, btn.width, buttonHeight, 10);

						const spinGrad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + buttonHeight);
						if (isEnabled) {
							spinGrad.addColorStop(0, isHovered ? '#ffd700' : '#f59e0b');
							spinGrad.addColorStop(0.5, isHovered ? '#ffb300' : '#d97706');
							spinGrad.addColorStop(1, isHovered ? '#ff8c00' : '#b45309');
						} else {
							spinGrad.addColorStop(0, '#4b5563');
							spinGrad.addColorStop(1, '#374151');
						}
						ctx.fillStyle = spinGrad;
						ctx.fill();
						ctx.restore();

						// Gold border
						ctx.strokeStyle = isEnabled ? '#ffd700' : '#4b5563';
						ctx.lineWidth = 3;
						ctx.stroke();

						// Inner shadow (top dark, bottom light)
						ctx.beginPath();
						ctx.roundRect(btn.x + 2, btn.y + 2, btn.width - 4, buttonHeight - 4, 8);
						ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
						ctx.lineWidth = 2;
						ctx.stroke();

						// Inner highlight
						if (isEnabled) {
							ctx.beginPath();
							ctx.roundRect(btn.x + 4, btn.y + 4, btn.width - 8, buttonHeight / 2 - 6, 6);
							ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
							ctx.fill();
						}

						ctx.font = 'bold 40px Arial';
						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';
						ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
						ctx.fillText(btn.label, btnCenterX + 2, btnCenterY + 2);
						ctx.fillStyle = isEnabled ? '#1a1a1a' : '#6b7280';
						ctx.fillText(btn.label, btnCenterX, btnCenterY);

					} else if (isMultiplier) {
						// === MULTIPLIER BUTTONS (x1, x2, x3, x4, x5) ===

						// Drop shadow
						ctx.save();
						ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
						ctx.shadowBlur = 8;
						ctx.shadowOffsetX = 2;
						ctx.shadowOffsetY = 3;

						ctx.beginPath();
						ctx.roundRect(btn.x, btn.y, btn.width, buttonHeight, 8);

						const multGrad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + buttonHeight);
						if (isActive) {
							// Active state - bright gold
							multGrad.addColorStop(0, '#ffd700');
							multGrad.addColorStop(0.5, '#f5a623');
							multGrad.addColorStop(1, '#d4880f');
						} else if (isHovered) {
							multGrad.addColorStop(0, '#3a5a7a');
							multGrad.addColorStop(0.5, '#2a4a6a');
							multGrad.addColorStop(1, '#1a3a5a');
						} else {
							multGrad.addColorStop(0, '#2a4a6a');
							multGrad.addColorStop(0.5, '#1e3a5a');
							multGrad.addColorStop(1, '#152a45');
						}
						ctx.fillStyle = multGrad;
						ctx.fill();
						ctx.restore();

						// Gold border
						ctx.strokeStyle = isActive ? '#ffd700' : (isHovered ? '#d4af37' : '#8b7355');
						ctx.lineWidth = isActive ? 3 : 2;
						ctx.stroke();

						// Inner shadow
						ctx.beginPath();
						ctx.roundRect(btn.x + 2, btn.y + 2, btn.width - 4, buttonHeight - 4, 6);
						ctx.strokeStyle = isActive ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.3)';
						ctx.lineWidth = 2;
						ctx.stroke();

						// Inner highlight
						ctx.beginPath();
						ctx.roundRect(btn.x + 3, btn.y + 3, btn.width - 6, buttonHeight / 2 - 4, 5);
						ctx.fillStyle = isActive ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)';
						ctx.fill();

						ctx.font = 'bold 28px Arial';
						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';
						ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
						ctx.fillText(btn.label, btnCenterX + 1, btnCenterY + 1);
						ctx.fillStyle = isActive ? '#1a1a1a' : '#ffffff';
						ctx.fillText(btn.label, btnCenterX, btnCenterY);

					} else if (isClear) {
						// === CLEAR BUTTON - Red style ===
						ctx.save();
						ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
						ctx.shadowBlur = 8;
						ctx.shadowOffsetX = 2;
						ctx.shadowOffsetY = 3;

						ctx.beginPath();
						ctx.roundRect(btn.x, btn.y, btn.width, buttonHeight, 8);

						const clearGrad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + buttonHeight);
						if (isEnabled) {
							clearGrad.addColorStop(0, isHovered ? '#dc2626' : '#b91c1c');
							clearGrad.addColorStop(0.5, isHovered ? '#b91c1c' : '#991b1b');
							clearGrad.addColorStop(1, isHovered ? '#991b1b' : '#7f1d1d');
						} else {
							clearGrad.addColorStop(0, '#2a2a2a');
							clearGrad.addColorStop(1, '#1a1a1a');
						}
						ctx.fillStyle = clearGrad;
						ctx.fill();
						ctx.restore();

						// Gold border
						ctx.strokeStyle = isEnabled ? (isHovered ? '#f87171' : '#d4af37') : '#3a3a3a';
						ctx.lineWidth = 2;
						ctx.stroke();

						// Inner shadow
						ctx.beginPath();
						ctx.roundRect(btn.x + 2, btn.y + 2, btn.width - 4, buttonHeight - 4, 6);
						ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
						ctx.lineWidth = 2;
						ctx.stroke();

						// Inner highlight
						if (isEnabled) {
							ctx.beginPath();
							ctx.roundRect(btn.x + 3, btn.y + 3, btn.width - 6, buttonHeight / 2 - 4, 5);
							ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
							ctx.fill();
						}

						ctx.font = 'bold 38px Arial';
						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';
						ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
						ctx.fillText(btn.label, btnCenterX + 1, btnCenterY + 1);
						ctx.fillStyle = isEnabled ? '#ffffff' : '#5a5a5a';
						ctx.fillText(btn.label, btnCenterX, btnCenterY);

					} else if (isRemove) {
						// === REMOVE BUTTON - Special styling when active ===
						ctx.save();
						ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
						ctx.shadowBlur = 8;
						ctx.shadowOffsetX = 2;
						ctx.shadowOffsetY = 3;

						ctx.beginPath();
						ctx.roundRect(btn.x, btn.y, btn.width, buttonHeight, 8);

						const removeGrad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + buttonHeight);
						if (isActive) {
							// Active state - bright red/orange
							removeGrad.addColorStop(0, '#ff6b35');
							removeGrad.addColorStop(0.5, '#e63946');
							removeGrad.addColorStop(1, '#c1121f');
						} else if (isHovered) {
							removeGrad.addColorStop(0, '#4a3a3a');
							removeGrad.addColorStop(0.5, '#3a2a2a');
							removeGrad.addColorStop(1, '#2a1a1a');
						} else {
							removeGrad.addColorStop(0, '#3a3a4a');
							removeGrad.addColorStop(0.5, '#2a2a3a');
							removeGrad.addColorStop(1, '#1a1a2a');
						}
						ctx.fillStyle = removeGrad;
						ctx.fill();
						ctx.restore();

						// Border
						ctx.strokeStyle = isActive ? '#ff4500' : (isHovered ? '#8b5a5a' : '#6b5555');
						ctx.lineWidth = isActive ? 3 : 2;
						ctx.stroke();

						// Inner shadow
						ctx.beginPath();
						ctx.roundRect(btn.x + 2, btn.y + 2, btn.width - 4, buttonHeight - 4, 6);
						ctx.strokeStyle = isActive ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.3)';
						ctx.lineWidth = 2;
						ctx.stroke();

						// Inner highlight
						ctx.beginPath();
						ctx.roundRect(btn.x + 3, btn.y + 3, btn.width - 6, buttonHeight / 2 - 4, 5);
						ctx.fillStyle = isActive ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)';
						ctx.fill();

						// Adjust font size for longer text when active
						ctx.font = isActive ? 'bold 18px Arial' : 'bold 24px Arial';
						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';
						ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
						ctx.fillText(btn.label, btnCenterX + 1, btnCenterY + 1);
						ctx.fillStyle = '#ffffff';
						ctx.fillText(btn.label, btnCenterX, btnCenterY);

					} else {
						// === OTHER BUTTONS (undo, redo, rebet) ===
						ctx.save();
						ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
						ctx.shadowBlur = 8;
						ctx.shadowOffsetX = 2;
						ctx.shadowOffsetY = 3;

						ctx.beginPath();
						ctx.roundRect(btn.x, btn.y, btn.width, buttonHeight, 8);

						const btnGrad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + buttonHeight);
						if (isEnabled) {
							btnGrad.addColorStop(0, isHovered ? '#3a5a7a' : '#2a4a6a');
							btnGrad.addColorStop(0.5, isHovered ? '#2a4a6a' : '#1e3a5a');
							btnGrad.addColorStop(1, isHovered ? '#1a3a5a' : '#152a45');
						} else {
							btnGrad.addColorStop(0, '#2a2a2a');
							btnGrad.addColorStop(1, '#1a1a1a');
						}
						ctx.fillStyle = btnGrad;
						ctx.fill();
						ctx.restore();

						// Gold border
						ctx.strokeStyle = isEnabled ? (isHovered ? '#d4af37' : '#8b7355') : '#3a3a3a';
						ctx.lineWidth = 2;
						ctx.stroke();

						// Inner shadow
						ctx.beginPath();
						ctx.roundRect(btn.x + 2, btn.y + 2, btn.width - 4, buttonHeight - 4, 6);
						ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
						ctx.lineWidth = 2;
						ctx.stroke();

						// Inner highlight
						if (isEnabled) {
							ctx.beginPath();
							ctx.roundRect(btn.x + 3, btn.y + 3, btn.width - 6, buttonHeight / 2 - 4, 5);
							ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
							ctx.fill();
						}

						ctx.font = 'bold 38px Arial';
						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';
						ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
						ctx.fillText(btn.label, btnCenterX + 1, btnCenterY + 1);
						ctx.fillStyle = isEnabled ? '#ffffff' : '#5a5a5a';
						ctx.fillText(btn.label, btnCenterX, btnCenterY);
					}
				});

				// Request animation frame for spin button pulse
				if (!this.isSpinning && this.state.placements.length > 0) {
					if (!this.pulseAnimationRunning) {
						this.pulseAnimationRunning = true;
						const animate = () => {
							if (this.state.placements.length > 0 && !this.isSpinning) {
								this.drawRouletteCanvas();
								requestAnimationFrame(animate);
							} else {
								this.pulseAnimationRunning = false;

							}
						};
						requestAnimationFrame(animate);
					}
				}
			}

			collectWheelSlice(start, length) {
				const result = [];
				if (!Array.isArray(this.wheelOrder) || !this.wheelOrder.length || length <= 0) {
					return result;
				}
				for (let i = 0; i < length; i += 1) {
					const index = (start + i) % this.wheelOrder.length;
					const value = this.wheelOrder[index];
					if (typeof value !== 'undefined') {
						result.push(String(value));
					}
				}
				return result;
			}

			getNumberColorClass(value) {
				if (value === '0' || value === '00') {
					return 'green';
				}
				return this.redNumbers.includes(String(value)) ? 'red' : 'black';
			}

			render() {
				this.shadowRoot.innerHTML = this.template;
			}

			cacheElements() {
				this.board = this.shadowRoot.getElementById('rouletteBoard');
				this.summaryContainer = this.shadowRoot.getElementById('betSummary');
				this.chipTotals = this.shadowRoot.getElementById('chipTotals');
				this.chipNotice = this.shadowRoot.getElementById('chipNotice');
				this.layout = this.shadowRoot.querySelector('.layout');
				this.toastContainer = this.shadowRoot.getElementById('toastContainer');
				this.wheelCanvas = this.shadowRoot.getElementById('wheelCanvas');
				this.wheelCanvasCtx = this.wheelCanvas?.getContext('2d') || null;
				this.wheelElement = this.wheelCanvas;
				this.rouletteCanvas = this.shadowRoot.getElementById('roulette');
				this.rouletteCtx = this.rouletteCanvas?.getContext('2d') || null;
				this.rouletteHoveredZone = null;
				this.hoveredBoardCell = null;
				this.historyDialog = this.shadowRoot.getElementById('historyDialog');
				this.historyList = this.shadowRoot.getElementById('historyList');
				this.historyPagination = this.shadowRoot.getElementById('historyPagination');
				this.historyButton = this.shadowRoot.getElementById('historyBtn');
				this.historyClose = this.shadowRoot.getElementById('historyClose');
				this.logsButton = this.shadowRoot.getElementById('logsBtn');
				this.logsDialog = this.shadowRoot.getElementById('logsDialog');
				this.logsClose = this.shadowRoot.getElementById('logsClose');
				this.logsList = this.shadowRoot.getElementById('logsList');
				this.loadingDialog = this.shadowRoot.getElementById('loadingDialogAiState');
				this.observeTheme();
				this.initGeometryObservers();

				this.refreshBetSpotElements();
				this.renderCanvasWheel();
				this.initRouletteCanvas();
			}

			refreshBetSpotElements() {
				this.betSpotElements.clear();
				this.shadowRoot.querySelectorAll('.bet-spot').forEach((spot) => {
					this.betSpotElements.set(spot.dataset.betKey, spot);
				});
			}



			getNumberButtonMap() {
				const map = new Map();
				this.shadowRoot.querySelectorAll('[data-number-cell="true"]').forEach((button) => {
					if (button?.dataset?.number) {
						map.set(button.dataset.number, button);
					}
				});
				return map;
			}





			bindEvents() {
				this.board.addEventListener('click', (event) => this.handleBoardClick(event));
				// clearBetsBtn moved to canvas
				this.shadowRoot.getElementById('addCreditsBtn').addEventListener('click', () => this.handleAddCredits());
				// spinBtn moved to canvas
				if (this.historyButton) {
					this.historyButton.addEventListener('click', () => this.openHistoryDialog());
				}
				if (this.historyClose) {
					this.historyClose.addEventListener('click', () => this.closeHistoryDialog());
				}
				if (this.logsButton) {
					this.logsButton.addEventListener('click', () => this.openLogsDialog());
				}
				if (this.logsClose) {
					this.logsClose.addEventListener('click', () => this.closeLogsDialog());
				}
				if (this.historyDialog) {
					this.historyDialog.addEventListener('cancel', (event) => {
						event.preventDefault();
						this.closeHistoryDialog();
					});
					this.attachDialogBackdropClose(this.historyDialog, () => this.closeHistoryDialog());
				}
				if (this.logsDialog) {
					this.logsDialog.addEventListener('cancel', (event) => {
						event.preventDefault();
						this.closeLogsDialog();
					});
					this.attachDialogBackdropClose(this.logsDialog, () => this.closeLogsDialog());
				}
				if (this.historyPagination) {
					this.historyPagination.addEventListener('click', (event) => this.handleHistoryPagination(event));
				}

			}

			handleBoardClick(event) {
				if (this.isSpinning) {
					return;
				}
				const spot = event.target.closest('.bet-spot');
				if (!spot) {
					return;
				}

				// If remove mode is active, remove the last chip from this spot
				if (this.removeMode) {
					this.removeLastChipFromSpot(spot.dataset.betKey);
					return;
				}

				const placement = {
					type: spot.dataset.type,
					value: spot.dataset.value || null,
					targets: spot.dataset.targets ? JSON.parse(spot.dataset.targets) : [],
					label: spot.dataset.label || '',
					key: spot.dataset.betKey,
					tokens: 1,
					multiplier: this.currentChipValue
				};

				const chipsOnField = this.state.placements.filter((entry) => entry.key === placement.key).length;
				if (chipsOnField >= this.maxTokens) {
					this.pushLog(`Maximum ${this.maxTokens} chips allowed on ${placement.label}.`);
					return;
				}

				// Save current state to undo stack
				this.undoStack.push({ placements: JSON.parse(JSON.stringify(this.state.placements)), activeMultiplier: this.activeMultiplier, betMultiplier: this.betMultiplier });
				this.redoStack = []; // Clear redo stack on new action

				this.state.placements.push(placement);
				this.dismissToastByReason('chips-required');
				this.updateSummary();
				this.updateBoardStacks();
				this.drawRouletteCanvas();
			}

			removeLastChipFromSpot(betKey) {
				// Find all placements that affect this spot
				// For straight bets: exact key match
				// For grouped bets: check if targets include this number
				const targetNumber = betKey.replace('straight-', '');

				let lastPlacementIndex = -1;
				let lastPlacement = null;

				// Find the last placement that affects this number
				for (let i = this.state.placements.length - 1; i >= 0; i--) {
					const p = this.state.placements[i];
					// Check if this placement affects the target number
					if (p.key === betKey ||
							(p.targets && p.targets.includes(targetNumber))) {
						lastPlacementIndex = i;
						lastPlacement = p;
						break;
					}
				}

				if (lastPlacementIndex !== -1 && lastPlacement) {
					// Save current state to undo stack
					this.undoStack.push({
						placements: JSON.parse(JSON.stringify(this.state.placements)),
						activeMultiplier: this.activeMultiplier,
						betMultiplier: this.betMultiplier
					});
					this.redoStack = [];

					// Check if this is a grouped bet that shows chips on board (sector, outside, dozen, column)
					const betType = lastPlacement.type;
					const isGroupedBoardBet = (betType === 'sector' || betType === 'range' || betType === 'parity' || betType === 'color' || betType === 'dozen' || betType === 'column')
							&& lastPlacement.targets && lastPlacement.targets.length > 1;

					if (isGroupedBoardBet) {
						// Break the grouped bet: keep chips on remaining numbers as individual straight bets
						const remainingNumbers = lastPlacement.targets.filter(num => num !== targetNumber);
						const chipValue = lastPlacement.multiplier;

						// Remove the grouped bet
						this.state.placements.splice(lastPlacementIndex, 1);

						// Add individual straight bets for remaining numbers
						remainingNumbers.forEach(num => {
							this.state.placements.push({
								type: 'straight',
								value: num,
								targets: [num],
								label: num,
								key: `straight-${num}`,
								tokens: 1,
								multiplier: chipValue
							});
						});
					} else {
						// Not a grouped board bet, just remove the placement
						this.state.placements.splice(lastPlacementIndex, 1);
					}

					this.updateSummary();
					this.updateBoardStacks();
					this.drawRouletteCanvas();
				}
			}
			handleAddCredits() {
				const btn = this.shadowRoot.getElementById('addCreditsBtn');
				const originalText = btn.innerHTML;

				// Show spinner in button
				btn.innerHTML = '<span class="btn-spinner"></span>Adding...';
				btn.classList.add('loading');
				btn.disabled = true;

				this.postRequest(this.actions.add, this.nonces.add, { amount: 1000 })
						.then((response) => {
							this.state.credits = response.data.credits;
							this.updateCredits();
							this.pushLog('Added 1000 credits.');
							this.showToast('1000 credits added!', 'success');
						})
						.catch((error) => {
							this.pushLog(error);
							this.showToast('Failed to add credits', 'error');
						})
						.finally(() => {
							// Restore button
							btn.innerHTML = originalText;
							btn.classList.remove('loading');
							btn.disabled = false;
						});
			}

			openHistoryDialog() {
				if (!this.historyDialog) {
					return;
				}
				this.historyDialog.showModal();
				this.lockPageScroll();
				if (this.historyList) {
					this.historyList.innerHTML = '<div class="history-loading"><div class="ripple"><div></div><div></div></div></div>';
				}
				this.fetchHistory(1);
			}

			closeHistoryDialog() {
				if (this.historyDialog?.open) {
					this.historyDialog.close();
				}
				this.unlockPageScroll();
			}

			openLogsDialog() {
				if (!this.logsDialog) {
					return;
				}
				this.logsDialog.showModal();
				this.lockPageScroll();
			}

			closeLogsDialog() {
				if (this.logsDialog?.open) {
					this.logsDialog.close();
				}
				this.unlockPageScroll();
			}

			handleHistoryPagination(event) {
				const target = event.target.closest('button[data-page]');
				if (!target || target.disabled) {
					return;
				}
				const page = parseInt(target.dataset.page, 10);
				if (page > 0) {
					this.fetchHistory(page);
				}
			}

			async fetchHistory(page = 1) {
				if (!this.actions.history || this.history?.busy) {
					return;
				}
				this.history.busy = true;
				try {
					this.scrollWheelIntoView();
					const response = await this.postRequest(this.actions.history, this.nonces.history, { page });
					this.renderHistory(response.data);
				} catch (error) {
					this.pushLog(error);
				} finally {
					this.history.busy = false;
				}
			}

			renderHistory(data) {
				if (!this.historyList) {
					return;
				}
				const rows = data?.rows || [];
				if (!rows.length) {
					this.historyList.innerHTML = '<p class="empty">No history logged yet.</p>';
				} else {
					this.historyList.innerHTML = `
				<table>
					<thead>
						<tr>
							<th>Type</th>
							<th>Details</th>
							<th>Stake</th>
							<th>Payout</th>
							<th>Date</th>
						</tr>
					</thead>
					<tbody>
						${rows.map((row) => this.renderHistoryRowMarkup(row)).join('')}
					</tbody>
				</table>
			`;
				}
				this.renderHistoryPagination(data.page || 1, data.total_pages || 1);
			}

			parseHistoryPayload(row) {
				let parsed = { bets: [], meta: {} };
				try {
					this.scrollWheelIntoView();
					const extracted = JSON.parse(row.bets_json || '{}');
					parsed.bets = extracted?.bets || [];
					parsed.meta = extracted?.meta || {};
				} catch (e) {}
				return parsed;
			}

			renderHistoryRowMarkup(row) {
				const eventType = row.event_type || 'game';
				const payload = this.parseHistoryPayload(row);
				const date = new Date(row.created_at);

				if (eventType === 'credit') {
					const amount = Number(payload.meta.amount ?? row.payout ?? 0);
					return `<tr class="history-row history-row-credit">
				<td>Credit</td>
				<td>Credits added</td>
				<td>--</td>
				<td>${this.formatCurrency(amount)}</td>
				<td>${date.toLocaleString()}</td>
			</tr>`;
				}

				const summary = payload.bets
						.slice(0, 2)
						.map((bet) => bet.label || bet.targets?.join('/') || bet.value || bet.type)
						.join(', ');

				return `<tr class="history-row history-row-game">
			<td>Game</td>
			<td>#${row.result_number} <small>${summary || ''}</small></td>
			<td>${this.formatCurrency(row.total_stake || 0)}</td>
			<td>${this.formatCurrency(row.payout || 0)}</td>
			<td>${date.toLocaleString()}</td>
		</tr>`;
			}

			renderHistoryPagination(page, totalPages) {
				if (!this.historyPagination) {
					return;
				}
				const prevPage = Math.max(1, page - 1);
				const nextPage = Math.min(totalPages, page + 1);
				this.historyPagination.innerHTML = `
			<button type="button" data-page="${prevPage}" ${page <= 1 ? 'disabled' : ''}>Prev</button>
			<span>Page ${page} / ${totalPages}</span>
			<button type="button" data-page="${nextPage}" ${page >= totalPages ? 'disabled' : ''}>Next</button>
		`;
			}

			async handleSpin() {
				if (this.isSpinning) {
					return;
				}
				if (!this.state.placements.length) {
					const toast = this.showToast('You need to add at least one chip to board if you want to play.', { reason: 'chips-required' });
					this.pushLog('Place at least one chip on the board.');
					return;
				}

				// Save current bet for re-bet functionality
				this.lastBet = JSON.parse(JSON.stringify(this.state.placements));

				// Clear undo/redo history on spin
				this.undoStack = [];
				this.redoStack = [];

				const totalStake = this.getTotalStake();
				if (totalStake > this.state.credits) {
					this.showToast(`Not enough credits. Stake ${this.formatCurrency(totalStake)} exceeds your ${this.formatCurrency(this.state.credits)} balance.`);
					return;
				}

				const payload = { bets: JSON.stringify(this.state.placements), betMultiplier: this.betMultiplier || 1 };
				this.setSpinning(true);
				this.winningDisplayState = "spinning";
				this.drawRouletteCanvas();

				try {
					this.scrollWheelIntoView();
					await this.postRequest(this.actions.place, this.nonces.place, payload);
				} catch (error) {
					this.pushLog(error);
					this.showToast(error?.message || 'Unable to place bet.');
					this.setSpinning(false);
					return;
				}


				try {
					this.scrollWheelIntoView();
					const response = await this.postRequest(this.actions.spin, this.nonces.spin, payload);
					const { number, color, parity, winnings, credits } = response.data;

					await this.animateWheel(number);

					// Update winning number tracking for top bar
					this.lastWinningNumber = number;
					this.lastWonCredits = winnings;
					this.winningDisplayState = 'result'; // Show the winning number
					this.winningHistory.unshift(number);
					if (this.winningHistory.length > 20) this.winningHistory.pop();
					this.drawRouletteCanvas(); // Redraw to show updated top bar

					this.state.credits = credits;
					this.updateCredits();
					this.pushLog(`Result ${number} (${color}), winnings ${this.formatCurrency(winnings)}`);
					this.clearPlacements();
				} catch (error) {
					this.pushLog(error);
					this.showToast(error?.message || 'Spin failed. Please try again.');
				} finally {

					this.setSpinning(false);

				}
			}
			scrollWheelIntoView() {
				if (!this.wheelElement) {
					return;
				}
				this.wheelElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}

			openLoadingDialog() {
				if (!this.loadingDialog) {
					return;
				}
				this.loadingDialog.classList.add('visible');
				this.loadingDialog.setAttribute('aria-hidden', 'false');
			}

			closeLoadingDialog() {
				if (!this.loadingDialog) {
					return;
				}
				this.loadingDialog.classList.remove('visible');
				this.loadingDialog.setAttribute('aria-hidden', 'true');
			}

			lockPageScroll() {
				if (!document || !document.body) {
					return;
				}
				if (!this.bodyOverflowBackup) {
					this.bodyOverflowBackup = document.body.style.overflow || '';
				}
				document.body.style.overflow = 'hidden';
			}

			unlockPageScroll() {
				if (!document || !document.body) {
					return;
				}
				if (this.bodyOverflowBackup !== undefined) {
					document.body.style.overflow = this.bodyOverflowBackup;
					this.bodyOverflowBackup = undefined;
				} else {
					document.body.style.overflow = '';
				}
			}

			recalculateBoardGeometry(force = false) {
				// Board is now on canvas, just update stacks
				this.updateBoardStacks();
			}

			initGeometryObservers() {
				// Board is now on canvas, no DOM observers needed
			}

			observeTheme() {
				const applyTheme = () => {
					const hasThemeLink = !!document.head.querySelector('link#theme-style');
					if (hasThemeLink) {
						this.layout?.classList.add('dark');
					} else {
						this.layout?.classList.remove('dark');
					}
				};
				applyTheme();
				if (!this.themeObserver) {
					this.themeObserver = new MutationObserver(applyTheme);
					this.themeObserver.observe(document.head, { childList: true, subtree: true });
				}
			}

			attachDialogBackdropClose(dialog, callback) {
				if (!dialog || typeof callback !== 'function') {
					return;
				}
				dialog.addEventListener('click', (event) => {
					if (event.target === dialog) {
						callback();
					}
				});
			}

			setSpinning(isSpinning) {
				this.isSpinning = isSpinning;
				if (isSpinning) {
					this.swapDisabledState(true);
				} else {
					this.swapDisabledState(false);
				}
			}

			swapDisabledState(state) {
				if (state) {
					this.board.classList.add('disabled');
				} else {
					this.board.classList.remove('disabled');
				}
				// Redraw canvas to update spin button state
				this.drawRouletteCanvas();
			}

			updateCredits() {
				this.maybeShowNoCreditsToast();
				this.drawRouletteCanvas(); // Update info panel with new credits
			}

			updateChipSelector() {
				// Chip selector is now on canvas, redraw to update selection
				this.drawRouletteCanvas();
			}

			updateSummary() {
				const summary = {};
				this.state.placements.forEach((placement) => {
					if (!summary[placement.key]) {
						summary[placement.key] = {
							label: placement.label,
							type: placement.type,
							value: placement.value,
							targets: placement.targets,
							sectorSize: placement.sectorSize || (placement.targets ? placement.targets.length : 0),
							sectorKey: placement.sectorKey || null,
							chips: 0,
							amount: 0,
							totalValue: 0,
							lastMultiplier: placement.multiplier,
							breakdown: {},
						};
					}
					const current = summary[placement.key];
					current.chips += placement.tokens;
					// For sector bets (doubleZero, siluette, etc.), multiply by sectorSize
					// For outside bets (range, parity, color), stake is just tokens × multiplier
					const isSectorBet = placement.type === 'sector';
					const sectorMultiplier = isSectorBet ? (placement.sectorSize || 1) : 1;
					current.amount += placement.tokens * placement.multiplier * sectorMultiplier;
					current.totalValue += placement.tokens * placement.multiplier * sectorMultiplier;
					current.lastMultiplier = placement.multiplier;
					current.type = placement.type || current.type;
					current.value = placement.value ?? current.value;
					current.targets = placement.targets || current.targets;
					if (placement.sectorSize) {
						current.sectorSize = placement.sectorSize;
						current.sectorKey = placement.sectorKey || current.sectorKey;
					}
					current.breakdown[placement.multiplier] = (current.breakdown[placement.multiplier] || 0) + placement.tokens;
				});
				this.summary = summary;

				const entries = Object.entries(summary);
				if (!entries.length) {
					this.summaryContainer.innerHTML = '<div class="empty">No chips placed.</div>';
					if (this.chipTotals) {
						this.chipTotals.textContent = 'No chip totals yet.';
					}
				} else {
					this.summaryContainer.innerHTML = entries.map(([key, item]) => `
				<div class="summary-row">
					<div class="summary-label-block">
						${this.renderSummaryLabel(item)}
						${this.renderChipBreakdown(item)}
					</div>
					<div class="summary-value-block">
						<span class="summary-total-credits">${Math.round(item.totalValue)} credits</span>
						<button type="button" data-key="${key}" aria-label="Remove bet">✕</button>
					</div>
				</div>
			`).join('');

					this.summaryContainer.querySelectorAll('button[data-key]').forEach((btn) => {
						btn.addEventListener('click', () => this.removePlacement(btn.dataset.key));
					});
					this.updateChipTotals(entries);
				}

				this.updateChipNotice();
				this.updateBoardStacks();
			}

			updateChipTotals(entries) {
				if (!this.chipTotals) {
					return;
				}
				if (!entries.length) {
					this.chipTotals.textContent = 'No chip totals yet.';
					return;
				}

				// Build chipsByMultiplier using the breakdown for accurate counting
				const chipsByMultiplier = {};
				entries.forEach(([key, item]) => {
					const breakdown = item.breakdown || {};
					const isSector = key.startsWith('sector-') && item.sectorSize;
					const multiplier = isSector ? item.sectorSize : 1;

					Object.entries(breakdown).forEach(([chipValue, tokenCount]) => {
						// For sector bets, each token covers sectorSize numbers
						const actualChipCount = tokenCount * multiplier;
						chipsByMultiplier[chipValue] = (chipsByMultiplier[chipValue] || 0) + actualChipCount;
					});
				});

				const baseValue = entries.reduce((sum, [, item]) => sum + item.totalValue, 0);
				const totalValue = baseValue * (this.betMultiplier || 1);
				const multiplierLabel = this.betMultiplier > 1 ? ` (${this.activeMultiplier})` : '';

				const rows = Object.entries(chipsByMultiplier)
						.sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
						.map(([multiplier, count]) => {
							const chipColor = this.getChipColor(multiplier);
							return `<tr>
					<td>${count} ${count === 1 ? 'chip' : 'chips'}</td>
					<td class="chip-table-cell">
						<span class="chip-table-face chip-face" data-chip="${multiplier}" style="--chip-color:${chipColor}">
							<span>${multiplier}x</span>
						</span>
					</td>
				</tr>`;
						})
						.join('');

				this.chipTotals.innerHTML = `
			<table>
				<thead><tr><th>Quantity</th><th>Multiplier</th></tr></thead>
				<tbody>${rows}</tbody>
				<tfoot><tr><td>Total stake${multiplierLabel}:</td><td id="totalStakeValue">${Math.round(totalValue)}</td></tr></tfoot>
			</table>
		`;
			}

			renderSummaryLabel(item = {}) {
				if (item?.type === 'sector') {
					const size = item?.sectorSize || item?.targets?.length || 0;
					const targets = item?.targets || [];

					// Build number tokens with colors
					const numberTokens = targets.map((value) => {
						let colorClass = 'black';
						if (value === '0' || value === '00') {
							colorClass = 'green';
						} else if (this.redNumbers.includes(String(value))) {
							colorClass = 'red';
						}
						return `<span class="summary-token ${colorClass}">${value}</span>`;
					}).join('');

					return `<span class="summary-sector">${this.escapeHtml(item.label || 'Sector')}<small>${size} numbers</small></span><div class="summary-number-group">${numberTokens}</div>`;
				}

				const normalized = String(item?.label ?? '').trim();
				if (!normalized) {
					return '<span class="summary-label-text">Bet</span>';
				}

				const parts = normalized.split('/').map((part) => part.trim()).filter(Boolean);
				const numberPattern = /^(0|00|[1-9]\d?)$/;
				const allNumbers = parts.length > 0 && parts.every((part) => numberPattern.test(part));

				if (allNumbers) {
					const tokens = parts.map((value) => {
						let colorClass = 'black';
						if (value === '0' || value === '00') {
							colorClass = 'green';
						} else if (this.redNumbers.includes(value)) {
							colorClass = 'red';
						}
						return `<span class="summary-token ${colorClass}">${value}</span>`;
					}).join('');

					if (parts.length > 1) {
						return `<div class="summary-number-group">${tokens}</div>`;
					}

					return tokens;
				}

				return `<span class="summary-label-text">${this.escapeHtml(normalized || 'Bet')}</span>`;
			}

			renderChipBreakdown(item) {
				const breakdown = item?.breakdown || {};
				const entries = Object.entries(breakdown);
				const totalCredits = Math.round(item?.totalValue || 0);

				if (!entries.length) {
					return `<div class="summary-chip-group"><span class="summary-chip-total">${totalCredits} credits</span></div>`;
				}

				const chips = entries
						.sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
						.map(([multiplier, count]) => {
							const chipColor = this.getChipColor(multiplier);
							return `<span class="chip-pill" aria-label="${count} chips at ${multiplier}x">
					<span class="chip-pill-count">${count}×</span>
					<span class="chip-pill-value chip-face" data-chip="${multiplier}" style="--chip-color:${chipColor}">
						<span>${multiplier}x</span>
					</span>
				</span>`;
						})
						.join('');

				return `<div class="summary-chip-group">
			${chips}
			<span class="summary-chip-total">${totalCredits} credits</span>
		</div>`;
			}

			getChipColor(multiplier) {
				const palette = {
					1: '#f59e0b',    // Amber/Gold
					2: '#f97316',    // Orange
					5: '#dc2626',    // Red
					10: '#16a34a',   // Green
					20: '#2563eb',   // Blue
					30: '#7c3aed',   // Purple
					50: '#0891b2',   // Cyan
					100: '#1f2937',  // Dark gray/black
					200: '#1d4ed8',  // Royal blue
					500: '#7e22ce'   // Deep purple,
				};
				return palette[multiplier] || palette[String(multiplier)] || '#475569';
			}

			updateChipNotice() {
				this.chipNotice.textContent = `Total chips: ${this.state.placements.length} (max ${this.maxTokens} per field)`;
			}

			getTotalStake() {
				const baseStake = this.state.placements.reduce((sum, placement) => {
					return sum + (placement.tokens * placement.multiplier);
				}, 0);
				return baseStake * (this.betMultiplier || 1);
			}
			maybeShowNoCreditsToast() {
				const credits = Number(this.state?.credits || 0);
				if (credits <= 0) {
					if (!this.noCreditReminderShown) {
						this.showToast('Please add credits to play.');
						this.noCreditReminderShown = true;
					}
				} else {
					this.noCreditReminderShown = false;
				}
			}
			showToast(message = 'Not enough credits for this bet.', options = {}) {
				const container = this.toastContainer ?? this.createToastContainer();
				const toast = document.createElement('div');
				toast.className = 'toast-message';
				toast.textContent = message;
				if (options.reason) {
					toast.dataset.reason = options.reason;
				}
				container.appendChild(toast);

				const removeToast = () => {
					toast.classList.add('exit');
					const handleAnimationEnd = (event) => {
						if (event.animationName === 'toastOut') {
							toast.removeEventListener('animationend', handleAnimationEnd);
							toast.remove();
						}
					};
					toast.addEventListener('animationend', handleAnimationEnd);
				};

				if (options.persist) {
					toast.removeTimeout = setTimeout(removeToast, options.persist);
				} else {
					toast.removeTimeout = setTimeout(removeToast, 6000);
				}
				toast.dismiss = removeToast;
				return toast;
			}

			dismissToastByReason(reason) {
				if (!this.toastContainer || !reason) {
					return;
				}
				this.toastContainer.querySelectorAll(`.toast-message[data-reason="${reason}"]`).forEach((toast) => {
					if (toast.removeTimeout) {
						clearTimeout(toast.removeTimeout);
					}
					if (typeof toast.dismiss === 'function') {
						toast.dismiss();
					} else {
						toast.classList.add('exit');
						setTimeout(() => toast.remove(), 300);
					}
				});
			}

			createToastContainer() {
				const container = document.createElement('div');
				container.className = 'toast-container';
				this.shadowRoot.appendChild(container);
				this.toastContainer = container;
				return container;
			}

			updateBoardStacks() {
				const snapshot = JSON.parse(JSON.stringify(this.summary || {}));
				this.pendingStacks = snapshot;
				if (this.boardStackRaf) {
					cancelAnimationFrame(this.boardStackRaf);
				}
				this.boardStackRaf = requestAnimationFrame(() => {
					this.boardStackRaf = null;
					this.applyBoardStacks(snapshot);
				});
			}

			applyBoardStacks(snapshot = null) {
				const activeSummary = snapshot || this.pendingStacks || this.summary || {};

				// Build a map of number -> chip info by processing placements in order
				// This ensures we track the actual last chip placed on each number
				const chipInfoByNumber = new Map();

				// Process all placements in order to track values and last multiplier per number
				// Sector bets, outside bets, dozen bets, and column bets show chips on individual numbers
				// Other bets (split, corner, street, line) show chips only on their specific bet spot
				this.state.placements.forEach((placement) => {
					const targets = placement.targets || [];
					const multiplier = placement.multiplier;
					const betType = placement.type;

					// These bet types show chips on individual numbers on the board
					const showOnBoard = betType === 'sector'; // Only race track zones show chips on board numbers

					if (showOnBoard && targets.length > 0) {
						const valuePerNumber = multiplier;
						targets.forEach((num) => {
							const numKey = `straight-${num}`;
							if (!chipInfoByNumber.has(numKey)) {
								chipInfoByNumber.set(numKey, { totalValue: 0, lastMultiplier: multiplier, chips: 0 });
							}
							const existing = chipInfoByNumber.get(numKey);
							existing.totalValue += valuePerNumber;
							existing.lastMultiplier = multiplier;
							existing.chips += 1;
						});
					}
				});
				this.betSpotElements.forEach((spot, key) => {
					const chip = spot.querySelector('.chip-stack');
					if (!chip) {
						return;
					}

					// Get direct bet info from summary
					const directInfo = activeSummary[key];
					// Get number-based chip info (populated for grouped board bets)
					const numberInfo = chipInfoByNumber.get(key);

					// This check is no longer used for excluding chips - grouped bets now show on buttons
					const isGroupedBetSpot = key.startsWith('column-') || key.startsWith('dozen-') ||
							key.startsWith('range-') || key.startsWith('parity-') || key.startsWith('color-');

					let combinedChips = 0;
					let combinedValue = 0;
					let lastMultiplier = 1;

					// For straight bets on numbers affected by grouped bets, use the tracked info
					if (numberInfo) {
						combinedChips = numberInfo.chips;
						combinedValue = numberInfo.totalValue;
						lastMultiplier = numberInfo.lastMultiplier;
					} else if (directInfo) {
						// For all bet types including grouped bets (they now show chips on their buttons)
						combinedChips = directInfo.chips;
						combinedValue = directInfo.totalValue;
						lastMultiplier = directInfo.lastMultiplier;
					}

					if (combinedChips > 0) {
						const html = `<span class="chip-token" data-chip="${lastMultiplier}" title="${combinedChips} chip(s)">${Math.round(combinedValue)}</span>`;
						chip.innerHTML = html;
						chip.hidden = false;
					} else {
						chip.innerHTML = '';
						chip.hidden = true;
					}
				});
				this.pendingStacks = null;

				// Redraw canvas to show chips on outside bets
				this.drawRouletteCanvas();
			}

			removePlacement(key) {
				this.state.placements = this.state.placements.filter((placement) => placement.key !== key);
				this.updateSummary();
			}

			clearPlacements() {
				this.state.placements = [];
				this.updateSummary();
			}

			updateLogs() {
				if (!this.logsList) {
					return;
				}
				if (!this.state.logs.length) {
					this.logsList.innerHTML = '<p class="empty">No spins yet.</p>';
					return;
				}

				this.logsList.innerHTML = `
			<table>
				<thead>
					<tr>
						<th>#</th>
						<th>Message</th>
						<th>Time</th>
					</tr>
				</thead>
				<tbody>
					${this.state.logs.map((entry, index) => {
					const date = new Date(entry.timestamp || Date.now());
					return `<tr>
							<td>${index + 1}</td>
							<td>${this.escapeHtml(entry.message)}</td>
							<td>${date.toLocaleString()}</td>
						</tr>`;
				}).join('')}
				</tbody>
			</table>
		`;
			}

			pushLog(message) {
				const normalized = this.normalizeLogMessage(message);
				this.state.logs.unshift({
					message: normalized,
					timestamp: Date.now(),
				});
				this.state.logs = this.state.logs.slice(0, 20);
				this.updateLogs();
			}

			normalizeLogMessage(message) {
				if (typeof message === 'string') {
					return message;
				}
				if (message instanceof Error && message.message) {
					return message.message;
				}
				if (message && typeof message === 'object' && message.message) {
					return String(message.message);
				}
				if (message && typeof message === 'object') {
					try {
					this.scrollWheelIntoView();
						return JSON.stringify(message);
					} catch (error) {
						return String(message);
					}
				}
				return String(message ?? '');
			}

			escapeHtml(value) {
				return String(value)
						.replace(/&/g, '&amp;')
						.replace(/</g, '&lt;')
						.replace(/>/g, '&gt;')
						.replace(/"/g, '&quot;')
						.replace(/'/g, '&#039;');
			}

			async animateWheel(result) {
				if (!this.wheelCanvas || !this.wheelCanvasCtx) {
					return;
				}
				const resultValue = String(result);
				const winningSlotIndex = this.wheelOrder.indexOf(resultValue);
				if (winningSlotIndex === -1) {
					return;
				}

				// Clear any previous ball
				this.clearBall();
				this.ballLanded = false;

				// Ball dimensions
				const canvas = this.wheelCanvas;
				const styleWidth = canvas.clientWidth || 600;
				const styleHeight = canvas.clientHeight || 600;
				const centerX = styleWidth / 2;
				const centerY = styleHeight / 2;
				const outerRadius = Math.min(centerX, centerY) - 4;
				// Skip rendering if wheel is too small (prevents negative values)
				if (outerRadius < 50) return;
				const scaleFactor = outerRadius / 300; // Proportional scaling
				const rimRadius = outerRadius * 0.96;
				const bandOuter = rimRadius * 0.85;
				const bandInner = bandOuter * 0.84;
				const pocketOuter = bandInner * 0.98;

				const ballStartRadius = rimRadius * 0.98; // Proportional start
				const ballFinalRadius = pocketOuter * 0.96; // Proportional landing

				// Wheel parameters
				const totalSlots = this.wheelOrder.length;
				const slice = (Math.PI * 2) / totalSlots;
				// Add random offset so handles don't always land in same position
				const randomOffset = Math.random() * Math.PI * 2; // Random 0-360 degrees
				const startWheelAngle = (this.wheelRotation || 0) + randomOffset;

				// Timing
				const ballAppearTime = 3000;
				const showResultDelay = 5000;
				const wheelStopDelay = 10000;

				// Physics
				const wheelInitialSpeed = Math.PI * 1.9;
				const wheelDeceleration = 0.09;
				const ballInitialSpeed = Math.PI * 3.5;
				const ballDeceleration = 0.33;
				const ballCanLandSpeed = 0.95; // Ball can start looking for number when this slow

				const startTime = performance.now();
				let ballStartTime = null;
				let ballLandedTime = null;
				let resultShown = false;
				let animationComplete = false;

				// Ball state
				let ballAngle = 0;
				let ballSpeed = ballInitialSpeed;
				let ballRadius = ballStartRadius;

				// Function to get slot index under the ball
				const getSlotUnderBall = (ballAng, wheelAng) => {
					// Ball angle in wheel's coordinate system
					let relativeAngle = ballAng - wheelAng + Math.PI / 2 + (3.75 * Math.PI / 180);
					// Normalize to 0-2PI
					relativeAngle = ((relativeAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
					// Get slot index
					const slot = Math.floor(relativeAngle / slice);
					return slot % totalSlots;
				};

				this.wheelAnimating = true;
				return new Promise((resolve) => {
					const animate = (currentTime) => {
						if (animationComplete) return;

						const elapsed = currentTime - startTime;
						const elapsedSec = elapsed / 1000;

						// Wheel physics - exponential decay
						const wheelSpeed = wheelInitialSpeed * Math.exp(-wheelDeceleration * elapsedSec);
						const wheelAngle = startWheelAngle + (wheelInitialSpeed / wheelDeceleration) * (1 - Math.exp(-wheelDeceleration * elapsedSec));
						this.wheelRotation = wheelAngle;

						// Ball appears after 3 seconds
						if (elapsed >= ballAppearTime && !this.ballLanded) {
							if (ballStartTime === null) {
								ballStartTime = currentTime;
								ballAngle = Math.random() * Math.PI * 2;
								ballSpeed = ballInitialSpeed;
								this.ballVisible = true;
							}

							const ballElapsedSec = (currentTime - ballStartTime) / 1000;

							// Ball speed with faster decay
							ballSpeed = ballInitialSpeed * Math.exp(-ballDeceleration * ballElapsedSec);

							// Ball rotates opposite to wheel
							ballAngle -= ballSpeed * 0.04;

							// Ball radius decreases as speed decreases
							const speedRatio = ballSpeed / ballInitialSpeed;
							if (speedRatio < 0.4) {
								const dropProgress = (0.4 - speedRatio) / 0.4;
								ballRadius = ballStartRadius - (ballStartRadius - ballFinalRadius) * (dropProgress * dropProgress);
							}

							// When ball is slow enough, start scanning for winning number
							if (ballSpeed < ballCanLandSpeed && ballRadius <= ballFinalRadius + (10 * scaleFactor)) {
								const currentSlot = getSlotUnderBall(ballAngle, wheelAngle);

								// Check if ball is over the winning number
								if (currentSlot === winningSlotIndex) {
									// Ball lands here!
									this.ballLanded = true;
									ballLandedTime = currentTime;
									ballRadius = ballFinalRadius;

									// Store offset so ball rotates with wheel
									this.ballAngleOffset = ballAngle - wheelAngle;
								}
							}

							this.ballAngle = ballAngle;
							this.ballRadiusRatio = ballRadius / outerRadius;
						}

						// After ball lands
						if (this.ballLanded && ballLandedTime) {
							const timeSinceLand = currentTime - ballLandedTime;

							// Ball rotates with wheel and settles into pocket
							this.ballAngle = this.wheelRotation + this.ballAngleOffset;
							// Bounce animation - settle into pocket
							const settleTime = 800; // Total settle animation time
							const dropAmount = 25 * scaleFactor;
							let radiusOffset = 0;

							if (timeSinceLand < settleTime) {
								const t = timeSinceLand / settleTime;
								// Drop phase (0-40%)
								if (t < 0.4) {
									radiusOffset = (t / 0.4) * dropAmount;
								}
								// First bounce up 5px (40-55%)
								else if (t < 0.55) {
									const bt = (t - 0.4) / 0.15;
									radiusOffset = dropAmount - ((5 * scaleFactor) * Math.sin(bt * Math.PI));
								}
								// Back to 30 (55-70%)
								else if (t < 0.70) {
									radiusOffset = dropAmount;
								}
								// Second bounce up 3px (70-85%)
								else if (t < 0.85) {
									const bt = (t - 0.70) / 0.15;
									radiusOffset = dropAmount - ((3 * scaleFactor) * Math.sin(bt * Math.PI));
								}
								// Final settle (85-100%)
								else {
									radiusOffset = dropAmount;
								}
							} else {
								radiusOffset = dropAmount;
							}
							this.ballRadiusRatio = (ballFinalRadius - radiusOffset) / outerRadius;

							// After 5 seconds - show result
							if (timeSinceLand >= showResultDelay && !resultShown) {
								resultShown = true;
								resolve();
							}

							// After 10 seconds - ball rolls into pocket
							if (timeSinceLand >= wheelStopDelay) {
								// Start animation only ONCE using timestamp
								if (this.pocketAnimStartTime === null) {
									// Capture current ball position for smooth animation
									this.ballStartRadiusForAnim = this.ballRadiusRatio * outerRadius;
									this.pocketAnimStartTime = currentTime;
									this.pocketAnimActive = true;
									this.highlightedPocket = winningSlotIndex;
								}

								const animElapsed = currentTime - this.pocketAnimStartTime;
								const openDuration = 400;   // Phase 1: Pocket opens
								const ballRollDuration = 1500; // Phase 2: Ball rolls to center
								const closeDuration = 400;  // Phase 3: Pocket closes
								const phase2Start = openDuration;
								const phase3Start = openDuration + ballRollDuration;
								const totalAnimDuration = openDuration + ballRollDuration + closeDuration;

								if (animElapsed <= openDuration) {
									// Phase 1: Pocket opens, ball stays in place
									const openProgress = Math.min(animElapsed / openDuration, 1);
									this.pocketOpenProgress = 1 - Math.pow(1 - openProgress, 2); // Ease out
									// Ball stays at current position
									this.ballRadiusRatio = this.ballStartRadiusForAnim / outerRadius;
									this.ballScale = 1;
									this.ballOpacity = 1;

								} else if (animElapsed <= phase3Start) {
									// Phase 2: Ball rolls to center while pocket stays open
									this.pocketOpenProgress = 1; // Pocket fully open
									const ballProgress = Math.min((animElapsed - phase2Start) / ballRollDuration, 1);
									// Smooth ease-in-out for gradual movement
									const easedBall = ballProgress < 0.5 ? 2 * ballProgress * ballProgress : 1 - Math.pow(-2 * ballProgress + 2, 2) / 2; // Ease out cubic
									const startRadius = this.ballStartRadiusForAnim;
									const endRadius = ballFinalRadius * 0.1;
									this.ballRadiusRatio = (startRadius - (startRadius - endRadius) * easedBall) / outerRadius;

									// Ball shrinks and fades as it rolls into pocket
									this.ballScale = 1 - (easedBall * 0.7); // Shrink to 30% size
									this.ballOpacity = 1 - (easedBall * 0.9); // Fade to 10% opacity

									// Hide ball at very end
									if (ballProgress >= 0.99) {
										this.ballVisible = false;
									}

								} else if (animElapsed <= totalAnimDuration) {
									// Phase 3: Pocket closes
									this.ballVisible = false;
									const closeProgress = Math.min((animElapsed - phase3Start) / closeDuration, 1);
									const easedClose = 1 - Math.pow(1 - closeProgress, 2); // Ease out
									this.pocketOpenProgress = 1 - easedClose;
								} else if (this.pocketAnimActive) {
									// Animation complete - only run once
									this.pocketOpenProgress = 0;
									this.highlightedPocket = -1;
									this.pocketAnimActive = false;
									this.ballScale = 1;
									this.ballOpacity = 1;
								}

								// Capture wheel state when ball disappears
								if (!this.ballVisible && !this.wheelSlowdownStart) {
									this.wheelSlowdownStart = currentTime;
									this.wheelSpeedAtBallGone = wheelSpeed;
									this.wheelAngleAtBallGone = wheelAngle;
								}
							}

						}
						// Gradual wheel slowdown after ball disappears - decrease speed until 0
						if (this.wheelSlowdownStart) {
							const slowdownElapsed = (currentTime - this.wheelSlowdownStart) / 1000; // in seconds
							const slowdownRate = 2; // Controls how fast wheel slows down

							// Exponential decay - speed gradually decreases to 0
							const currentSpeed = this.wheelSpeedAtBallGone * Math.exp(-slowdownRate * slowdownElapsed);

							// Calculate wheel angle with diminishing speed (smooth rotation)
							const additionalRotation = (this.wheelSpeedAtBallGone / slowdownRate) * (1 - Math.exp(-slowdownRate * slowdownElapsed));
							this.wheelRotation = this.wheelAngleAtBallGone + additionalRotation;

							// When speed reaches 0 (or very close), stop and enable spin
							if (currentSpeed < 0.01) {
								// Wheel has stopped - animation complete
								this.wheelSlowdownStart = null;
								animationComplete = true;
								this.wheelAnimating = false;
								this.renderCanvasWheel();
								resolve();
								return;
							}
						}

						this.renderCanvasWheel();
						requestAnimationFrame(animate);
					};
					requestAnimationFrame(animate);
				});
			}


			formatCurrency(value) {
				return `${Number(value).toFixed(2)} credits`;
			}

			async postRequest(action, nonce, extra = {}) {
				const body = new URLSearchParams({
					action,
					nonce,
					...extra
				});

				const response = await fetch(this.ajaxUrl, {
					method: 'POST',
					body
				});

				const data = await response.json();
				if (!data.success) {
					const message = data?.data?.message || 'Something went wrong.';
					throw message;
				}
				return data;
			}
		}

		customElements.define('mini-roulette', MiniRouletteGame);
	</script>
{/literal}
<div>
	<div class="bf-mini-roulette">
		<mini-roulette
				data-ajax-url="{$roulette_props.ajax_url|escape:'html'}"
				data-credits="{$roulette_props.credits|escape:'html'}"
				data-max-tokens="{$roulette_props.maxTokens|escape:'html'}"
				data-chip-multipliers="{$roulette_props.chipMultipliers|@json_encode|escape:'html'}"
				data-wheel-order="{$roulette_props.wheelOrder|@json_encode|escape:'html'}"
				data-history-per-page="{$roulette_props.history.perPage|escape:'html'}"
				data-nonce-history="{$roulette_props.nonces.history|escape:'html'}"
				data-action-history="bonusfinder_mini_games_history"
				data-nonce-add="{$roulette_props.nonces.addCredits|escape:'html'}"
				data-nonce-place="{$roulette_props.nonces.placeBet|escape:'html'}"
				data-nonce-spin="{$roulette_props.nonces.spin|escape:'html'}"
				data-action-add="bonusfinder_mini_games_add_credits"
				data-action-place="bonusfinder_mini_games_place_bet"
				data-action-spin="bonusfinder_mini_games_spin"
		></mini-roulette>
	</div>
</div>

