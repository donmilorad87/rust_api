(function(){"use strict";class Pe extends HTMLElement{constructor(){super(),this.attachShadow({mode:"open"}),setTimeout(()=>{const t=["0","28","9","26","30","11","7","20","32","17","5","22","34","15","3","24","36","13","1","00","27","10","25","29","12","8","19","31","18","6","21","33","16","4","23","35","14","2"];this.endpoints={spin:this.dataset.endpointSpin||"/api/v1/roulette/spin",history:this.dataset.endpointHistory||"/api/v1/roulette/history"},this.csrfToken=document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")||"",this.state={credits:parseFloat(this.dataset.credits||"0"),placements:[],logs:[]},this.maxTokens=parseInt(this.dataset.maxTokens||"16",10),this.chipMultipliers=JSON.parse(this.dataset.chipMultipliers||"[1]"),this.currentChipValue=this.chipMultipliers[0]||1,this.isSpinning=!1,this.wheelAnimating=!1,this.betSpotElements=new Map,this.betSpotElements=new Map,this.boardStackRaf=null,this.recalcRaf=null,this.boardGeometry={width:0,height:0},this.pendingStacks=null,this.summary={},this.redNumbers=["1","3","5","7","9","12","14","16","18","19","21","23","25","27","30","32","34","36"],this.numberGrid=[["3","6","9","12","15","18","21","24","27","30","33","36"],["2","5","8","11","14","17","20","23","26","29","32","35"],["1","4","7","10","13","16","19","22","25","28","31","34"]],this.wheelOrder=JSON.parse(this.dataset.wheelOrder||JSON.stringify(t)),this.history={perPage:parseInt(this.dataset.historyPerPage||"16",10),page:1,totalPages:1,busy:!1},this.wsState={connected:!1,authenticated:!1,secondsRemaining:120,spinId:null,blockBets:!1,phase:"betting"},this.ws=null,this.wsReconnectAttempts=0,this.maxWsReconnectAttempts=5,this.betsBroadcasted=!1,this.initWebSocket(),this.render(),this.cacheElements(),this.bindEvents(),this.swapDisabledState(!0),this.updateCredits(),this.updateSummary(),this.updateChipSelector(),this.updateChipNotice(),this.updateLogs(),this.recalculateBoardGeometry(),this.initGeometryObservers(),this.handleResize=()=>{this.recalculateBoardGeometry(),this.renderCanvasWheel()},window.addEventListener("resize",this.handleResize)},0)}disconnectedCallback(){this.handleResize&&window.removeEventListener("resize",this.handleResize),this.unlockPageScroll(),this.themeObserver&&(this.themeObserver.disconnect(),this.themeObserver=null),this.sizeObserver&&(this.sizeObserver.disconnect(),this.sizeObserver=null),this.boardStackRaf&&(cancelAnimationFrame(this.boardStackRaf),this.boardStackRaf=null)}get template(){return`
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
`}buildBoardMarkup(){return`
			<div class="panel wheel-wrapper">
				<div class="canvas-container">
					<canvas id="wheelCanvas" class="canvas-wheel" width="600" height="600" aria-hidden="true"></canvas>
				</div>
			</div>
			<div class="roulette-table" id="rouletteBoard">
				<canvas id="roulette" width="2000" height="1640"></canvas>
			</div>
		`}renderCanvasWheel(){if(!this.wheelCanvasCtx||!this.wheelOrder?.length)return;const t=this.wheelCanvas,e=this.wheelCanvasCtx,l=t.clientWidth||600,d=t.clientHeight||600,i=window.devicePixelRatio||1;t.width=l*i,t.height=d*i,e.scale(i,i);const{width:u,height:S}={width:l,height:d},s=u/2,n=S/2,c=Math.min(s,n)-4;if(c<50)return;const f=c/300,I=c*.96,M=I*.85,dt=M*.84,B=dt*.98,P=B*.75,Bt=P*.99*.6,It=Math.PI*2/this.wheelOrder.length;e.clearRect(0,0,u,S),e.save(),e.translate(s,n),e.rotate(this.wheelRotation||0),e.translate(-s,-n);const St=({radius:T,fill:k="#000",stroke:q=null,strokeWidth:C=1,shadowOptions:z=!1})=>{e.save(),z&&(e.shadowColor=z.shadowColor,e.shadowBlur=z.shadowBlur,e.shadowOffsetX=z.shadowOffsetX,e.shadowOffsetY=z.shadowOffsetY),e.beginPath(),e.fillStyle=k,e.arc(s,n,T,0,Math.PI*2),e.fill(),q&&(e.strokeStyle=q,e.lineWidth=C,e.stroke()),e.restore()},yt=this.wheelRotation||0,Ot=-Math.PI/4,Tt=Ot-yt,rt=e.createConicGradient(Tt,s,n);rt.addColorStop(0,"#ffdb6a"),rt.addColorStop(.1,"#fccb3c"),rt.addColorStop(.25,"#f7a700"),rt.addColorStop(.4,"#d59d00"),rt.addColorStop(.5,"#b8860b"),rt.addColorStop(.6,"#d59d00"),rt.addColorStop(.75,"#e2b700"),rt.addColorStop(.85,"#fccb3c"),rt.addColorStop(1,"#ffdb6a");const et=e.createConicGradient(Tt,s,n);et.addColorStop(0,"#d9b34d"),et.addColorStop(.3,"#b57e2b"),et.addColorStop(.7,"#9a6a2a"),et.addColorStop(1,"#d9b34d");const st=e.createConicGradient(Tt,s,n);st.addColorStop(0,"#ffe082"),st.addColorStop(.2,"#fccb3c"),st.addColorStop(.4,"#f6b400"),st.addColorStop(.5,"#c99a2e"),st.addColorStop(.6,"#f6b400"),st.addColorStop(.8,"#fccb3c"),st.addColorStop(1,"#ffe082");const N=e.createConicGradient(Tt,s,n);N.addColorStop(0,"#ffd54f"),N.addColorStop(.15,"#ffca28"),N.addColorStop(.3,"#ffc107"),N.addColorStop(.5,"#e6a800"),N.addColorStop(.7,"#ffc107"),N.addColorStop(.85,"#ffca28"),N.addColorStop(1,"#ffd54f");const Ct=Ot-yt,F=e.createConicGradient(Ct,s,n);F.addColorStop(0,"#8b2520"),F.addColorStop(.25,"#6f1d1b"),F.addColorStop(.5,"#4a1210"),F.addColorStop(.75,"#6f1d1b"),F.addColorStop(1,"#8b2520"),St({radius:c,fill:st}),St({radius:I,fill:F,shadowOptions:{shadowColor:"rgba(0,0,0,0.9)",shadowBlur:6,shadowOffsetX:0,shadowOffsetY:0}}),e.save(),e.beginPath(),e.arc(s,n,M*.96,0,Math.PI*2),e.lineWidth=15*f,e.strokeStyle=rt,e.stroke(),e.restore(),e.save(),e.beginPath(),e.arc(s,n,M*.96,0,Math.PI*2),e.arc(s,n,M*.96-13*f,0,Math.PI*2,!0),e.clip(),e.beginPath(),e.shadowColor="rgba(0, 0, 0, 0.45)",e.shadowBlur=30*f,e.shadowOffsetX=0,e.shadowOffsetY=0,e.arc(s,n,M*1.5,0,Math.PI*2),e.fillStyle="rgba(0,0,0,0)",e.fill(),e.restore(),St({radius:dt,fill:F});for(let T=0;T<8;T+=1){const k=Math.PI/4*T,q=I*.91,C=c*.05,z=C*2.2,Y=s+Math.cos(k)*q,x=n+Math.sin(k)*q;e.save(),e.translate(Y,x),e.rotate(k);const tt=this.wheelRotation||0,U=-Math.PI/4,G=U+Math.PI-tt-k,W=3*f;e.shadowColor="rgba(0, 0, 0, 0.5)",e.shadowBlur=4*f,e.shadowOffsetX=Math.cos(G)*W,e.shadowOffsetY=Math.sin(G)*W;const bt=U-tt-k,ct=e.createConicGradient(bt+Math.PI/2,0,0);ct.addColorStop(0,"#fff9c4"),ct.addColorStop(.15,"#ffeb3b"),ct.addColorStop(.3,"#ffc107"),ct.addColorStop(.5,"#ff8f00"),ct.addColorStop(.65,"#ffc107"),ct.addColorStop(.8,"#ffeb3b"),ct.addColorStop(1,"#fff9c4"),e.beginPath(),e.moveTo(-C/2,0),e.lineTo(0,-z/2),e.lineTo(C/2,0),e.lineTo(0,z/2),e.closePath(),e.fillStyle=ct,e.fill(),e.shadowColor="transparent",e.beginPath(),e.moveTo(-C/5,0),e.lineTo(0,-z/5),e.lineTo(C/5,0),e.closePath(),e.fillStyle="rgba(255, 255, 255, 0.7)",e.fill(),e.beginPath(),e.moveTo(-C/2,0),e.lineTo(0,-z/2),e.lineTo(C/2,0),e.lineTo(0,z/2),e.closePath(),e.strokeStyle="#b8860b",e.stroke(),e.restore()}const nt=-Math.PI/4,Q=this.wheelRotation||0;this.wheelOrder.forEach((T,k)=>{const q=k*It-Math.PI/2,C=q+It,z=(q+C)/2,Y=T==="0"||T==="00",x=this.redNumbers.includes(String(T)),tt=!Y&&!x;let G=z+Q-nt;for(;G>Math.PI;)G-=2*Math.PI;for(;G<-Math.PI;)G+=2*Math.PI;const W=(Math.cos(G)+1)/2;if(e.beginPath(),this.highlightedPocket===k&&this.pocketAnimActive&&this.pocketOpenProgress!==void 0){const bt=this.pocketOpenProgress,ct=P-10*f,xt=B+25*f,D=e.createRadialGradient(s,n,ct,s,n,xt),E=bt,X=Math.floor(10+W*15),j=Math.floor(8+W*8),L=Math.floor(3+W*5);if(tt){const O=.12+E*.18,R=Math.floor(55+E*35);D.addColorStop(0,`rgb(${R}, ${R}, ${R})`),D.addColorStop(O*.3,`rgb(${R-15}, ${R-15}, ${R-15})`),D.addColorStop(O*.6,`rgb(${R-30}, ${R-30}, ${R-30})`),D.addColorStop(O,`rgb(${Math.floor(15+E*10)}, ${Math.floor(15+E*10)}, ${Math.floor(15+E*10)})`),D.addColorStop(Math.min(O+.15,.5),`rgb(${X}, ${X}, ${X})`),D.addColorStop(Math.min(O+.3,.7),`rgb(${j}, ${j}, ${j})`),D.addColorStop(1,`rgb(${L}, ${L}, ${L})`)}else if(Y){const O=.15+E*.15,R=Math.floor(5+E*10),it=Math.floor(70+W*20);D.addColorStop(0,`rgb(${R-3}, ${R}, ${R-3})`),D.addColorStop(O*.5,"#050a05"),D.addColorStop(O,"#0a150a"),D.addColorStop(Math.min(O+.12,.5),"rgb(26, 69, 32)"),D.addColorStop(Math.min(O+.25,.7),"rgb(38, 112, 53)"),D.addColorStop(1,`rgb(${Math.floor(20+W*10)}, ${it}, ${Math.floor(30+W*10)})`)}else{const O=.1+E*.15,R=Math.floor(15+E*25),it=Math.floor(100+W*30);D.addColorStop(0,`rgb(${R+10}, ${R-5}, ${R-5})`),D.addColorStop(O*.3,`rgb(${R}, ${R-10}, ${R-10})`),D.addColorStop(O*.6,"#1a0808"),D.addColorStop(O,"#280c0c"),D.addColorStop(Math.min(O+.1,.45),"rgb(96, 24, 24)"),D.addColorStop(Math.min(O+.2,.6),"rgb(176, 16, 16)"),D.addColorStop(1,`rgb(${it}, ${Math.floor(5+W*10)}, ${Math.floor(5+W*10)})`)}e.fillStyle=D}else{const bt=(P-10*f+B+25*f)/2,ct=nt-Q,xt=s+Math.cos(ct)*bt*.8,D=n+Math.sin(ct)*bt*.8,E=e.createRadialGradient(xt,D,0,s,n,bt*2);if(tt){const X=Math.floor(45+W*60),j=Math.floor(25+W*35),L=Math.floor(12+W*18),O=Math.floor(5+W*8),R=Math.floor(W*12);E.addColorStop(0,`rgb(${X}, ${X+R}, ${X+R*2})`),E.addColorStop(.15,`rgb(${j}, ${j+3}, ${j+8})`),E.addColorStop(.4,`rgb(${L+2}, ${L+4}, ${L+8})`),E.addColorStop(.7,`rgb(${L}, ${L}, ${L+3})`),E.addColorStop(1,`rgb(${O}, ${O}, ${O+2})`)}else if(Y){const X=Math.floor(70+W*80),j=Math.floor(200+W*55),L=Math.floor(60+W*40),O=Math.floor(150+W*30),R=Math.floor(15+W*15),it=Math.floor(80+W*30),$=Math.floor(25+W*15);E.addColorStop(0,`rgb(${X}, ${j}, ${L})`),E.addColorStop(.12,`rgb(${Math.floor(55+W*25)}, ${Math.floor(175+W*35)}, ${Math.floor(70+W*20)})`),E.addColorStop(.35,`rgb(40, ${O}, 55)`),E.addColorStop(.6,"rgb(30, 120, 45)"),E.addColorStop(.85,`rgb(${R+5}, ${it+10}, ${$})`),E.addColorStop(1,`rgb(${R}, ${it}, ${$})`)}else{const X=Math.floor(255),j=Math.floor(80+W*70),L=Math.floor(60+W*50),O=Math.floor(200+W*30),R=Math.floor(120+W*40),it=Math.floor(8+W*15),$=Math.floor(8+W*15);E.addColorStop(0,`rgb(${X}, ${j}, ${L})`),E.addColorStop(.12,`rgb(${Math.floor(240+W*15)}, ${Math.floor(50+W*30)}, ${Math.floor(40+W*20)})`),E.addColorStop(.35,`rgb(${O}, 25, 25)`),E.addColorStop(.6,"rgb(180, 15, 15)"),E.addColorStop(.85,`rgb(${R+20}, ${it}, ${$})`),E.addColorStop(1,`rgb(${R}, ${it}, ${$})`)}e.fillStyle=E}if(e.arc(s,n,B+25*f,q,C),e.arc(s,n,P-10*f,C,q,!0),e.closePath(),e.fill(),!(this.highlightedPocket===k&&this.pocketAnimActive)&&W>.5){e.save(),e.beginPath(),e.arc(s,n,B+25*f,q,C),e.arc(s,n,P-10*f,C,q,!0),e.closePath(),e.clip();const bt=nt-Q,ct=s+Math.cos(bt)*(B-10),xt=n+Math.sin(bt)*(B-10),D=e.createRadialGradient(ct,xt,0,ct,xt,(B-P)*1.2),E=(W-.5)*2;tt?D.addColorStop(0,`rgba(255, 250, 220, ${.12*E})`):Y?D.addColorStop(0,`rgba(200, 255, 200, ${.18*E})`):D.addColorStop(0,`rgba(255, 200, 200, ${.18*E})`),D.addColorStop(1,"rgba(255, 255, 255, 0)"),e.fillStyle=D,e.fill(),e.restore()}if(this.highlightedPocket===k&&this.pocketAnimActive){const bt=this.pocketOpenProgress;e.save(),e.beginPath(),e.arc(s,n,P+5,q,C),e.arc(s,n,P-10*f,C,q,!0),e.closePath(),e.fillStyle=`rgba(0, 0, 0, ${.7*bt})`,e.fill(),e.restore()}}),e.strokeStyle=rt,e.lineWidth=4;for(let T=0;T<this.wheelOrder.length;T++){const k=T*It-Math.PI/2,q=s+Math.cos(k)*P,C=n+Math.sin(k)*P,z=s+Math.cos(k)*(B+25*f),Y=n+Math.sin(k)*(B+25*f);e.beginPath(),e.moveTo(q,C),e.lineTo(z,Y),e.stroke()}this.wheelOrder.forEach((T,k)=>{const q=k*It-Math.PI/2,C=T==="0"||T==="00",z=q+It/2,Y=B+8*f,x=s+Math.cos(z)*Y,tt=n+Math.sin(z)*Y;e.save(),e.translate(x,tt),e.rotate(z+Math.PI/2),e.font=`800 ${Math.max(11,B*.08)}px "Inter", "Segoe UI", sans-serif`,e.textAlign="center",e.textBaseline="middle";const U=C?"#0c1712":"#fffef2";e.fillStyle=U,e.shadowColor="rgba(0,0,0,0.45)",e.shadowBlur=4*f,e.lineWidth=2,e.strokeStyle=U==="#fffef2"?"rgba(0,0,0,0.75)":"rgba(255,255,255,0.5)",e.strokeText(T,0,0),e.fillText(T,0,0),e.restore()}),e.save(),e.strokeStyle=rt,e.lineWidth=4,e.beginPath(),e.arc(s,n,B-6*f,0,Math.PI*2),e.stroke(),e.restore(),e.stroke(),e.beginPath(),e.arc(s,n,P+2*f,0,Math.PI*2),e.stroke(),e.restore(),e.save(),e.strokeStyle=et,e.lineWidth=1,e.beginPath(),e.arc(s,n,B-4*f,0,Math.PI*2),e.stroke(),e.restore(),e.save(),e.strokeStyle=et,e.lineWidth=1,e.beginPath(),e.arc(s,n,B-4*f,0,Math.PI*2),e.stroke(),e.restore(),e.save(),e.strokeStyle=et,e.lineWidth=1,e.beginPath(),e.arc(s,n,B+25*f,0,Math.PI*2),e.stroke(),e.restore(),e.restore();const kt=this.ballOpacity!==void 0?this.ballOpacity:1;if(this.ballVisible){e.save(),e.globalAlpha=kt;const T=this.ballScale!==void 0?this.ballScale:1,k=Math.max(4,c*.033)*T,q=(this.ballRadiusRatio||0)*c,C=s+Math.cos(this.ballAngle)*q,z=n+Math.sin(this.ballAngle)*q;e.beginPath(),e.arc(C+k*.3,z+k*.3,k,0,Math.PI*2),e.fillStyle="rgba(0, 0, 0, 0.4)",e.fill();const Y=e.createRadialGradient(C-k*.3,z-k*.3,0,C,z,k);Y.addColorStop(0,"#ffffff"),Y.addColorStop(.3,"#f0f0f0"),Y.addColorStop(.7,"#c0c0c0"),Y.addColorStop(1,"#808080"),e.beginPath(),e.arc(C,z,k,0,Math.PI*2),e.fillStyle=Y,e.fill(),e.beginPath(),e.arc(C-k*.3,z-k*.3,k*.4,0,Math.PI*2),e.fillStyle="rgba(255, 255, 255, 0.8)",e.fill(),e.beginPath(),e.arc(C,z,k,0,Math.PI*2),e.strokeStyle="rgba(100, 100, 100, 0.5)",e.lineWidth=1,e.stroke(),e.restore()}const H=-(this.wheelRotation||0),ht=e.createConicGradient(H-Math.PI/4,s,n);ht.addColorStop(.1,"#7e0914"),ht.addColorStop(.4,"#5b0610"),ht.addColorStop(.8,"#7e0914");const V=P*.99;e.save(),e.translate(s,n),e.rotate(this.wheelRotation||0),e.translate(-s,-n),e.beginPath(),e.arc(s,n,V*1.02,0,Math.PI*2),e.fillStyle=F,e.fill(),e.restore(),e.save(),e.translate(s,n),e.rotate(this.wheelRotation||0),e.translate(-s,-n),e.beginPath(),e.strokeStyle="rgba(255,255,255,0.35)",e.lineWidth=1.8;for(let T=0;T<8;T+=1){const k=Math.PI/4*T;e.moveTo(s+Math.cos(k)*P,n+Math.sin(k)*P),e.lineTo(s+Math.cos(k)*70,n+Math.sin(k)*70)}e.stroke(),e.restore(),e.save(),e.translate(s,n),e.rotate(this.wheelRotation||0),e.translate(-s,-n),e.beginPath(),e.arc(s,n,40*f,0,Math.PI*2),e.fillStyle=st,e.shadowColor="rgba(0, 0, 0, 0.55)",e.shadowBlur=15*f,e.shadowOffsetX=0,e.shadowOffsetY=0,e.fill(),e.save(),e.translate(s,n),e.rotate(this.wheelRotation||0),e.translate(-s,-n);for(let T=0;T<8;T+=2){const k=Math.PI/4*T;let C=k+(this.wheelRotation||0)-Ot;for(;C>Math.PI;)C-=2*Math.PI;for(;C<-Math.PI;)C+=2*Math.PI;const z=(Math.cos(C)+1)/2,Y=Bt*.95,x=Math.max(3,c*.018),tt=c*.18,U=c*.035,G=tt*.33,W=U*.84,bt=s+Math.cos(k)*Bt*.25,ct=n+Math.sin(k)*Bt*.25,xt=s+Math.cos(k)*Y,D=n+Math.sin(k)*Y,E=e.createLinearGradient(bt,ct,xt,D),X=z*.25+.75;E.addColorStop(0,`rgb(${Math.floor(200*X)}, ${Math.floor(160*X)}, ${Math.floor(50*X)})`),E.addColorStop(.15,`rgb(${Math.floor(255*X)}, ${Math.floor(210*X)}, ${Math.floor(80*X)})`),E.addColorStop(.5,`rgb(${Math.floor(255*X)}, ${Math.floor(220*X)}, ${Math.floor(100*X)})`),E.addColorStop(.85,`rgb(${Math.floor(255*X)}, ${Math.floor(200*X)}, ${Math.floor(70*X)})`),E.addColorStop(1,`rgb(${Math.floor(180*X)}, ${Math.floor(140*X)}, ${Math.floor(40*X)})`),e.save(),e.shadowColor="rgba(0, 0, 0, 0.5)",e.shadowBlur=Math.max(2,c*.01),e.shadowOffsetX=0,e.shadowOffsetY=0,e.beginPath(),e.strokeStyle=N,e.lineWidth=x,e.lineCap="round",e.moveTo(bt,ct),e.lineTo(xt,D),e.stroke(),e.restore(),e.save(),e.translate(xt,D),e.rotate(k);const j=tt/2,L=U/2,O=Math.max(.1,Math.min(G-4*f,j-11*f)),R=Math.max(.1,Math.min(W,L)),it=e.createLinearGradient(0,-L*1.5,0,L*1.5),$=z*.2+.8;it.addColorStop(0,`rgb(${Math.floor(255*$)}, ${Math.floor(255*$)}, ${Math.floor(240*$)})`),it.addColorStop(.1,`rgb(${Math.floor(255*$)}, ${Math.floor(250*$)}, ${Math.floor(200*$)})`),it.addColorStop(.25,`rgb(${Math.floor(255*$)}, ${Math.floor(235*$)}, ${Math.floor(150*$)})`),it.addColorStop(.5,`rgb(${Math.floor(220*$)}, ${Math.floor(180*$)}, ${Math.floor(80*$)})`),it.addColorStop(.75,`rgb(${Math.floor(255*$)}, ${Math.floor(230*$)}, ${Math.floor(140*$)})`),it.addColorStop(.9,`rgb(${Math.floor(255*$)}, ${Math.floor(250*$)}, ${Math.floor(190*$)})`),it.addColorStop(1,`rgb(${Math.floor(255*$)}, ${Math.floor(245*$)}, ${Math.floor(180*$)})`),e.shadowColor="rgba(0, 0, 0, 0.5)",e.shadowBlur=Math.max(2,c*.015),e.shadowOffsetX=0,e.shadowOffsetY=0,e.beginPath(),e.fillStyle=N,e.moveTo(-j+O,-L),e.lineTo(j-O,-L),e.ellipse(j-O,-L+R,O,R,0,-Math.PI/2,0),e.lineTo(j,L-R),e.ellipse(j-O,L-R,O,R,0,0,Math.PI/2),e.lineTo(-j+O,L),e.ellipse(-j+O,L-R,O,R,0,Math.PI/2,Math.PI),e.lineTo(-j,-L+R),e.ellipse(-j+O,-L+R,O,R,0,Math.PI,Math.PI*1.5),e.closePath(),e.fill(),e.restore()}e.beginPath(),e.arc(s,n,Math.max(15,c*.1),0,Math.PI*2),e.fillStyle=rt,e.shadowColor="rgba(0, 0, 0, 0.55)",e.shadowBlur=Math.max(8,c*.05),e.shadowOffsetX=0,e.shadowOffsetY=0,e.fill(),e.restore(),e.save(),e.translate(s,n),e.rotate(this.wheelRotation||0),e.translate(-s,-n);for(let T=1;T<8;T+=2){const k=Math.PI/4*T;let C=k+(this.wheelRotation||0)-Ot;for(;C>Math.PI;)C-=2*Math.PI;for(;C<-Math.PI;)C+=2*Math.PI;const z=(Math.cos(C)+1)/2,Y=Bt*.55+10,x=Math.max(2,c*.01),tt=c*.12,U=c*.02,G=tt*.33,W=U*.84,bt=s+Math.cos(k)*Bt*.25,ct=n+Math.sin(k)*Bt*.25,xt=s+Math.cos(k)*Y,D=n+Math.sin(k)*Y,E=e.createLinearGradient(bt,ct,xt,D),X=z*.25+.75;E.addColorStop(0,`rgb(${Math.floor(200*X)}, ${Math.floor(160*X)}, ${Math.floor(50*X)})`),E.addColorStop(.15,`rgb(${Math.floor(255*X)}, ${Math.floor(210*X)}, ${Math.floor(80*X)})`),E.addColorStop(.5,`rgb(${Math.floor(255*X)}, ${Math.floor(220*X)}, ${Math.floor(100*X)})`),E.addColorStop(.85,`rgb(${Math.floor(255*X)}, ${Math.floor(200*X)}, ${Math.floor(70*X)})`),E.addColorStop(1,`rgb(${Math.floor(180*X)}, ${Math.floor(140*X)}, ${Math.floor(40*X)})`),e.save(),e.shadowColor="rgba(0, 0, 0, 0.5)",e.shadowBlur=Math.max(2,c*.006),e.shadowOffsetX=0,e.shadowOffsetY=0,e.beginPath(),e.strokeStyle=N,e.lineWidth=x,e.lineCap="round",e.moveTo(bt,ct),e.lineTo(xt,D),e.stroke(),e.restore(),e.save(),e.translate(xt,D),e.rotate(k);const j=tt/2,L=U/2,O=Math.max(.1,Math.min(G,j)),R=Math.max(.1,Math.min(W,L)),it=e.createLinearGradient(0,-L*1.5,0,L*1.5),$=z*.35+.65;it.addColorStop(0,`rgb(${Math.floor(255*$)}, ${Math.floor(255*$)}, ${Math.floor(240*$)})`),it.addColorStop(.1,`rgb(${Math.floor(255*$)}, ${Math.floor(250*$)}, ${Math.floor(200*$)})`),it.addColorStop(.25,`rgb(${Math.floor(255*$)}, ${Math.floor(235*$)}, ${Math.floor(150*$)})`),it.addColorStop(.5,`rgb(${Math.floor(220*$)}, ${Math.floor(180*$)}, ${Math.floor(80*$)})`),it.addColorStop(.75,`rgb(${Math.floor(255*$)}, ${Math.floor(230*$)}, ${Math.floor(140*$)})`),it.addColorStop(.9,`rgb(${Math.floor(255*$)}, ${Math.floor(250*$)}, ${Math.floor(190*$)})`),it.addColorStop(1,`rgb(${Math.floor(255*$)}, ${Math.floor(245*$)}, ${Math.floor(180*$)})`),e.shadowColor="rgba(0, 0, 0, 0.5)",e.shadowBlur=Math.max(2,c*.008),e.shadowOffsetX=0,e.shadowOffsetY=0,e.beginPath(),e.fillStyle=N,e.moveTo(-j+O,-L),e.lineTo(j-O,-L),e.ellipse(j-O,-L+R,O,R,0,-Math.PI/2,0),e.lineTo(j,L-R),e.ellipse(j-O,L-R,O,R,0,0,Math.PI/2),e.lineTo(-j+O,L),e.ellipse(-j+O,L-R,O,R,0,Math.PI/2,Math.PI),e.lineTo(-j,-L+R),e.ellipse(-j+O,-L+R,O,R,0,Math.PI,Math.PI*1.5),e.closePath(),e.fill(),e.restore()}e.restore(),e.restore();const Wt=-Math.PI/4,$t=Wt+Math.PI-yt,ft=Math.cos($t),at=Math.sin($t),vt=Wt-yt,At=Math.cos(vt),Jt=Math.sin(vt);e.save(),e.translate(s,n),e.rotate(yt),e.translate(-s,-n);const Pt=e.createConicGradient(vt,s,n);Pt.addColorStop(0,"#fffef5"),Pt.addColorStop(.12,"#ffe082"),Pt.addColorStop(.25,"#c9a000"),Pt.addColorStop(.38,"#8b6914"),Pt.addColorStop(.5,"#5a4500"),Pt.addColorStop(.62,"#8b6914"),Pt.addColorStop(.75,"#c9a000"),Pt.addColorStop(.88,"#ffe082"),Pt.addColorStop(1,"#fffef5"),e.beginPath(),e.arc(s,n,25*f,0,Math.PI*2),e.shadowColor="rgba(0, 0, 0, 0.5)",e.shadowBlur=5*f,e.shadowOffsetX=0,e.shadowOffsetY=0,e.fillStyle=Pt,e.fill(),e.shadowColor="transparent",e.restore(),e.save(),e.translate(s,n),e.rotate(yt),e.translate(-s,-n);const wt=e.createConicGradient(vt+Math.PI*.05,s,n);wt.addColorStop(0,"#fff8dc"),wt.addColorStop(.12,"#ffd54f"),wt.addColorStop(.25,"#b8860b"),wt.addColorStop(.38,"#7a5a10"),wt.addColorStop(.5,"#4a3500"),wt.addColorStop(.62,"#7a5a10"),wt.addColorStop(.75,"#b8860b"),wt.addColorStop(.88,"#ffd54f"),wt.addColorStop(1,"#fff8dc"),e.beginPath(),e.arc(s,n,20*f,0,Math.PI*2),e.shadowColor="rgba(0, 0, 0, 0.45)",e.shadowBlur=4*f,e.shadowOffsetX=0,e.shadowOffsetY=0,e.fillStyle=wt,e.fill(),e.shadowColor="transparent",e.restore(),e.save(),e.translate(s,n),e.rotate(yt),e.translate(-s,-n);const K=e.createConicGradient(vt+Math.PI*.1,s,n);K.addColorStop(0,"#ffffff"),K.addColorStop(.12,"#ffeb3b"),K.addColorStop(.25,"#daa520"),K.addColorStop(.38,"#8b6914"),K.addColorStop(.5,"#5a4000"),K.addColorStop(.62,"#8b6914"),K.addColorStop(.75,"#daa520"),K.addColorStop(.88,"#ffeb3b"),K.addColorStop(1,"#ffffff"),e.beginPath(),e.arc(s,n,10*f,0,Math.PI*2),e.shadowColor="rgba(0, 0, 0, 0.4)",e.shadowBlur=3*f,e.shadowOffsetX=0,e.shadowOffsetY=0,e.fillStyle=K,e.fill(),e.shadowColor="transparent",e.restore(),e.save(),e.translate(s,n),e.rotate(yt),e.translate(-s,-n);const v=e.createConicGradient(vt+Math.PI*.15,s,n);v.addColorStop(0,"#fffef5"),v.addColorStop(.12,"#ffe082"),v.addColorStop(.25,"#cd9700"),v.addColorStop(.38,"#8a6508"),v.addColorStop(.5,"#5a4500"),v.addColorStop(.62,"#8a6508"),v.addColorStop(.75,"#cd9700"),v.addColorStop(.88,"#ffe082"),v.addColorStop(1,"#fffef5"),e.beginPath(),e.arc(s,n,7.5*f,0,Math.PI*2),e.shadowColor="rgba(0, 0, 0, 0.35)",e.shadowBlur=2.5*f,e.shadowOffsetX=0,e.shadowOffsetY=0,e.fillStyle=v,e.fill(),e.shadowColor="transparent",e.restore(),e.save(),e.translate(s,n),e.rotate(yt),e.translate(-s,-n);const w=e.createConicGradient(vt+Math.PI*.2,s,n);w.addColorStop(0,"#ffffff"),w.addColorStop(.12,"#fff8dc"),w.addColorStop(.25,"#ffc107"),w.addColorStop(.38,"#9a7b00"),w.addColorStop(.5,"#6a5000"),w.addColorStop(.62,"#9a7b00"),w.addColorStop(.75,"#ffc107"),w.addColorStop(.88,"#fff8dc"),w.addColorStop(1,"#ffffff"),e.beginPath(),e.arc(s,n,4.5*f,0,Math.PI*2),e.shadowColor="rgba(0, 0, 0, 0.3)",e.shadowBlur=2*f,e.shadowOffsetX=ft*(1*f),e.shadowOffsetY=at*(1*f),e.fillStyle=w,e.fill(),e.shadowColor="transparent",e.restore(),e.save();const gt=e.createRadialGradient(s+At*(c*.08),n+Jt*(c*.08),c*.88,s,n,c);gt.addColorStop(0,"#ffe082"),gt.addColorStop(.35,"#ffc107"),gt.addColorStop(.65,"#c99a2e"),gt.addColorStop(1,"#7a5a10"),e.beginPath(),e.arc(s,n,c*.97,0,Math.PI*2),e.strokeStyle=gt,e.lineWidth=Math.max(4,c*.05),e.shadowColor="rgba(0, 0, 0, 0.65)",e.shadowBlur=Math.max(3,c*.03),e.shadowOffsetX=ft*Math.max(2,c*.015),e.shadowOffsetY=at*Math.max(2,c*.015),e.stroke(),e.restore()}renderBall(t,e){this.ballVisible=!0,this.ballAngle=t;const l=this.wheelCanvas,d=l?.clientWidth||600,i=l?.clientHeight||600,u=Math.min(d,i)/2-4;this.ballRadiusRatio=e/u,this.renderCanvasWheel()}clearBall(){this.ballVisible=!1,this.highlightedPocket=-1,this.pocketOpenProgress=0,this.pocketAnimStartTime=null,this.ballStartRadiusForAnim=0,this.ballScale=1,this.ballOpacity=1,this.pocketAnimActive=!1,this.renderCanvasWheel()}async animateBall(t,e,l){if(!this.wheelCanvas||!this.wheelCanvasCtx)return;const d=this.wheelCanvas,i=d.clientWidth||600,u=d.clientHeight||600,S=i/2,s=u/2,n=Math.min(S,s)-4;if(n<50)return;const c=n/300,f=n*.96,B=f*.85*.84*.98+3*c,P=f,_=B-65*c,Bt=Math.PI*2/this.wheelOrder.length,St=(12+Math.floor(Math.random()*5))*Math.PI*2,yt=performance.now(),Ot=e,Tt=t*Bt-Math.PI/2+Bt/2,rt=Tt+St;return this.wheelAnimating=!0,new Promise(et=>{const st=N=>{const Ct=N-yt,F=Math.min(Ct/Ot,1),nt=1-Math.pow(1-F,3),Q=rt-St*nt,kt=this.wheelRotation+Q;let H;if(F<.65)H=P;else{const ht=(F-.65)/.35,V=ht*ht;H=P-(P-_)*V}this.ballVisible=!0,this.ballAngle=kt,this.ballRadiusRatio=H/n,F<1?(this.ballLanded=!1,requestAnimationFrame(st)):(this.ballLanded=!0,this.ballAngleOffset=Tt,this.ballRadiusRatio=_/n,et())};requestAnimationFrame(st)})}initRouletteCanvas(){!this.rouletteCanvas||!this.rouletteCtx||(this.rouletteTopNumbers=["25","29","12","8","19","31","18","6","21","33","16","4","23","35"],this.rouletteBottomNumbers=["36","24","3","15","34","22","5","17","32","20","7","11","30","26"],this.rouletteLeftSectorNums=["13","1","00","27","10"],this.rouletteRightSectorNums=["14","2","0","28","9"],this.rouletteRedNumbers=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36],this.undoStack=[],this.redoStack=[],this.lastBet=null,this.hoveredButton=null,this.activeMultiplier="x1",this.betMultiplier=1,this.removeMode=!1,this.pulseAnimationRunning=!1,this.winningHistory=[],this.lastWinningNumber=null,this.winningDisplayState="welcome",this.lastWonCredits=0,this.highlightedPocket=-1,this.pocketOpenProgress=0,this.pocketAnimStartTime=null,this.ballStartRadiusForAnim=0,this.ballScale=1,this.ballOpacity=1,this.pocketAnimActive=!1,this.woodTexture=new Image,this.woodTextureLoaded=!1,this.woodTexture.crossOrigin="anonymous",this.woodTexture.onload=()=>{this.woodTextureLoaded=!0,this.drawRouletteCanvas()},this.woodTexture.src="https://images.unsplash.com/photo-1541123603104-512919d6a96c?w=800&q=80",this.rouletteCanvas.addEventListener("mousemove",t=>{this.handleRouletteMouseMove(t);const e=this.rouletteCanvas.getBoundingClientRect(),l=this.rouletteCanvas.width/e.width,d=this.rouletteCanvas.height/e.height,i=(t.clientX-e.left)*l,u=(t.clientY-e.top)*d,S=this.getClickedChip(i,u),s=this.getClickedButton(i,u);s!==this.hoveredButton&&(this.hoveredButton=s,this.drawRouletteCanvas()),this.rouletteCanvas.style.cursor=S||s?"pointer":"default"}),this.rouletteCanvas.addEventListener("mouseleave",()=>this.handleRouletteMouseLeave()),this.rouletteCanvas.addEventListener("click",t=>this.handleRouletteClick(t)),this.rouletteCanvas.addEventListener("contextmenu",t=>this.handleRouletteRightClick(t)),this.drawRouletteCanvas())}getRouletteColor(t){return t==="0"||t==="00"?"#0a8a0a":this.rouletteRedNumbers.includes(parseInt(t))?"#c41e3a":"#1a1a1a"}isInRouletteLeftCurve(t,e){const I=t-300,M=e-380,dt=Math.sqrt(I*I+M*M);if(t<300&&dt<=160||t>=300&&t<=400&&e>=220&&e<=320)return!0;if(e>320&&e<440){const B=400-100*(e-320)/120;if(t>=300&&t<B)return!0}if(t>=400&&t<=700&&e>=220&&e<=320||t>=300&&t<=500&&e>=440&&e<=540)return!0;if(e>320&&e<440){const P=700-(e-320)/120*2*100,_=400-100*(e-320)/120;if(t>=_&&t<=P)return!0}return!1}isInRouletteRightCurve(t,e){const M=t-1700,dt=e-380,B=Math.sqrt(M*M+dt*dt);if(t>1700&&B<=160||t>=1500&&t<=1700&&e>=220&&e<=320||t>=1600&&t<=1700&&e>=440&&e<=540)return!0;if(e>320&&e<440){const _=1500+(e-320)/120*100;if(t>=_&&t<=1700)return!0}return!1}isInRouletteZone2(t,e){if(t>=700&&t<=1e3&&e>=220&&e<=320||t>=500&&t<=1e3&&e>=440&&e<=540)return!0;if(e>320&&e<440){const f=700-(e-320)/120*2*100;if(t>f&&t<=1e3)return!0}return!1}isInRouletteZone3(t,e){if(t>=1e3&&t<=1500&&e>=220&&e<=320||t>=1e3&&t<=1600&&e>=440&&e<=540)return!0;if(e>320&&e<440){const c=(e-320)/120,f=1e3,I=1500+c*100;if(t>=f&&t<I)return!0}return!1}getRouletteZone(t,e){if(e>=1120&&e<=1185&&t>=140&&t<=1860){const rt=["1st12","2nd12","3rd12"];for(let et=0;et<3;et++){const st=140+et*580;if(t>=st&&t<=st+560)return rt[et]}}const It=40,St=2,yt=3,Ot=140+St*290,Tt=140+yt*290;if(e>=1195&&e<=1295+It){if(t>=Ot&&t<=Ot+270)return"red";if(t>=Tt&&t<=Tt+270)return"black"}if(e>=1205&&e<=1295&&t>=140){const rt=["low","even","red","black","odd","high"];for(let et=0;et<6;et++){if(et===St||et===yt)continue;const st=140+et*290;if(t>=st&&t<=st+270)return rt[et]}}return this.isInRouletteLeftCurve(t,e)?"doubleZero":this.isInRouletteRightCurve(t,e)?"zeroZone":this.isInRouletteZone2(t,e)?"siluette":this.isInRouletteZone3(t,e)?"angelEyes":null}getBoardCell(t,e){if(!this.boardDimensions)return null;const l=this.boardDimensions,d=l.y,i=l.gap,u=l.cellWidth,S=l.cellHeight,s=l.zeroWidth,n=l.colRailWidth,c=l.startX,f=l.numbersStartX,I=l.endX,M=l.totalHeight,dt=I+i,B=[[3,6,9,12,15,18,21,24,27,30,33,36],[2,5,8,11,14,17,20,23,26,29,32,35],[1,4,7,10,13,16,19,22,25,28,31,34]];if(e<d-10||e>d+M+30||t<c-10||t>dt+n+10)return null;if(e>=d+M&&e<=d+M+30){const N=f-i/2;if(Math.abs(t-N)<25)return{type:"line",key:"line-0-00-1-2-3",label:"Top Line 0-00-1-2-3",targets:["0","00","1","2","3"]}}if(e>=d+M&&e<=d+M+30)for(let N=0;N<12;N++){const F=f+N*(u+i)+u/2;if(N<11){const nt=f+(N+1)*(u+i)-i/2;if(Math.abs(t-nt)<15){const Q=[B[0][N],B[1][N],B[2][N],B[0][N+1],B[1][N+1],B[2][N+1]].sort((kt,H)=>kt-H);return{type:"line",key:`line-${Q[0]}-${Q[5]}`,label:`Line ${Q[0]}-${Q[5]}`,targets:Q.map(String)}}}if(Math.abs(t-F)<20){const nt=[B[0][N],B[1][N],B[2][N]].sort((Q,kt)=>Q-kt);return{type:"street",key:`street-${nt.join("-")}`,label:`Street ${nt[0]}-${nt[2]}`,targets:nt.map(String)}}}const P=S*1.5+i*.5;if(t>=c&&t<=c+s&&e>=d&&e<=d+P)return{type:"straight",value:"0",key:"straight-0",label:"0",targets:["0"]};const _=d+P+i,Bt=M-P-i;if(t>=c&&t<=c+s&&e>=_&&e<=_+Bt)return{type:"straight",value:"00",key:"straight-00",label:"00",targets:["00"]};const It=f-i/2,St=25,yt=d+S/2,Ot=d+S+i,Tt=d+S+i+S/2,rt=d+2*S+i,st=d+2*(S+i)+S/2;if(t>=c&&t<=c+s&&Math.abs(e-(d+M/2))<St)return{type:"split",key:"split-0-00",label:"Split 0-00",targets:["0","00"]};if(Math.abs(t-It)<St){if(Math.abs(e-yt)<St)return{type:"split",key:"split-0-3",label:"Split 0-3",targets:["0","3"]};if(Math.abs(e-(Ot+15))<St)return{type:"split",key:"split-0-2",label:"Split 0-2",targets:["0","2"]};if(Math.abs(e-Tt)<St)return{type:"street",key:"street-0-00-2",label:"Basket 0-00-2",targets:["0","00","2"]};if(Math.abs(e-(rt-15))<St)return{type:"split",key:"split-00-2",label:"Split 00-2",targets:["00","2"]};if(Math.abs(e-st)<St)return{type:"split",key:"split-00-1",label:"Split 00-1",targets:["00","1"]}}if(t>=dt&&t<=dt+n){const N=["col3","col2","col1"],Ct={col1:["1","4","7","10","13","16","19","22","25","28","31","34"],col2:["2","5","8","11","14","17","20","23","26","29","32","35"],col3:["3","6","9","12","15","18","21","24","27","30","33","36"]};for(let F=0;F<3;F++){const nt=d+F*(S+i);if(e>=nt&&e<=nt+S){const Q=N[F];return{type:"column",value:Q,key:`column-${Q}`,label:"2 to 1",targets:Ct[Q]}}}}if(t>=f&&t<=I&&e>=d&&e<=d+M){const N=t-f,Ct=e-d,F=u+i,nt=S+i;for(let H=0;H<11;H++){const ht=(H+1)*F-i/2;for(let V=0;V<2;V++){const Wt=(V+1)*nt-i/2,$t=Math.abs(N-ht),ft=Math.abs(Ct-Wt);if($t<30&&ft<30){const at=[B[V][H],B[V][H+1],B[V+1][H],B[V+1][H+1]].sort((vt,At)=>vt-At);return{type:"corner",key:`corner-${at.join("-")}`,label:`Corner ${at.join("-")}`,targets:at.map(String)}}}if(Math.abs(N-ht)<25){const V=Math.floor(Ct/nt);if(V>=0&&V<3){const Wt=B[V][H],$t=B[V][H+1],ft=[Wt,$t].sort((at,vt)=>at-vt);return{type:"split",key:`split-${ft[0]}-${ft[1]}`,label:`Split ${ft[0]}-${ft[1]}`,targets:ft.map(String)}}}}for(let H=0;H<2;H++){const ht=(H+1)*nt-i/2;if(Math.abs(Ct-ht)<25){const V=Math.floor(N/F);if(V>=0&&V<12){const Wt=B[H][V],$t=B[H+1][V],ft=[Wt,$t].sort((at,vt)=>at-vt);return{type:"split",key:`split-${ft[0]}-${ft[1]}`,label:`Split ${ft[0]}-${ft[1]}`,targets:ft.map(String)}}}}const Q=Math.floor(N/F),kt=Math.floor(Ct/nt);if(Q>=0&&Q<12&&kt>=0&&kt<3){const H=B[kt][Q];return{type:"straight",value:String(H),key:`straight-${H}`,label:String(H),targets:[String(H)]}}}return null}handleRouletteMouseMove(t){const e=this.rouletteCanvas.getBoundingClientRect(),l=this.rouletteCanvas.width/e.width,d=this.rouletteCanvas.height/e.height,i=(t.clientX-e.left)*l,u=(t.clientY-e.top)*d,S=this.getClickedChip(i,u);S!==this.hoveredChipValue&&(this.hoveredChipValue=S,this.drawRouletteCanvas());const s=this.getRouletteZone(i,u),n=this.getBoardCell(i,u);(s!==this.rouletteHoveredZone||JSON.stringify(n)!==JSON.stringify(this.hoveredBoardCell))&&(this.rouletteHoveredZone=s,this.hoveredBoardCell=n,this.rouletteCanvas.style.cursor=s||n?"pointer":"default",this.drawRouletteCanvas())}handleRouletteMouseLeave(){this.rouletteHoveredZone=null,this.hoveredBoardCell=null,this.hoveredChipValue=null,this.drawRouletteCanvas()}handleRouletteClick(t){const e=this.rouletteCanvas.getBoundingClientRect(),l=this.rouletteCanvas.width/e.width,d=this.rouletteCanvas.height/e.height,i=(t.clientX-e.left)*l,u=(t.clientY-e.top)*d,S=this.getClickedButton(i,u);if(S){this.handleButtonClick(S);return}const s=this.getClickedChip(i,u);if(s){this.currentChipValue=s,this.drawRouletteCanvas();return}const n=this.getBoardCell(i,u);if(n){if(this.removeMode){this.removeLastChipFromSpot(n.key);return}this.placeBoardBet(n);return}const c=this.getRouletteZone(i,u);if(c){if(this.removeMode){this.removeChipFromZone(c);return}this.placeRouletteBet(c)}}getClickedButton(t,e){if(!this.controlButtons)return null;for(const l of this.controlButtons)if(t>=l.x&&t<=l.x+l.width&&e>=l.y&&e<=l.y+70&&l.enabled)return l.key;return null}handleButtonClick(t){switch(t){case"undo":this.undoBet();break;case"redo":this.redoBet();break;case"rebet":this.reBet();break;case"spin":this.handleSpin();break;case"x1":this.trySetMultiplier(1,"x1");break;case"x2":this.trySetMultiplier(2,"x2");break;case"x3":this.trySetMultiplier(3,"x3");break;case"x4":this.trySetMultiplier(4,"x4");break;case"x5":this.trySetMultiplier(5,"x5");break;case"clear":this.clearPlacements();break;case"remove":this.removeMode=!this.removeMode,this.drawRouletteCanvas();break}}undoBet(){if(this.undoStack.length===0||this.isSpinning)return;const t=this.undoStack.pop();this.redoStack.push({placements:JSON.parse(JSON.stringify(this.state.placements)),activeMultiplier:this.activeMultiplier,betMultiplier:this.betMultiplier}),t.placements!==void 0?(this.state.placements=t.placements,this.activeMultiplier=t.activeMultiplier||"x1",this.betMultiplier=t.betMultiplier||1):this.state.placements=t,this.updateSummary(),this.updateBoardStacks(),this.drawRouletteCanvas()}redoBet(){if(this.redoStack.length===0||this.isSpinning)return;const t=this.redoStack.pop();this.undoStack.push({placements:JSON.parse(JSON.stringify(this.state.placements)),activeMultiplier:this.activeMultiplier,betMultiplier:this.betMultiplier}),t.placements!==void 0?(this.state.placements=t.placements,this.activeMultiplier=t.activeMultiplier||"x1",this.betMultiplier=t.betMultiplier||1):this.state.placements=t,this.updateSummary(),this.updateBoardStacks(),this.drawRouletteCanvas()}reBet(){if(!this.lastBet||this.lastBet.length===0||this.isSpinning)return;const t=JSON.stringify(this.state.placements),e=JSON.stringify(this.lastBet);t!==e&&(this.undoStack.push({placements:JSON.parse(JSON.stringify(this.state.placements)),activeMultiplier:this.activeMultiplier,betMultiplier:this.betMultiplier}),this.redoStack=[],this.state.placements=JSON.parse(JSON.stringify(this.lastBet)),this.updateSummary(),this.updateBoardStacks(),this.drawRouletteCanvas())}handleRouletteRightClick(t){if(t.preventDefault(),this.isSpinning)return;const e=this.rouletteCanvas.getBoundingClientRect(),l=this.rouletteCanvas.width/e.width,d=this.rouletteCanvas.height/e.height,i=(t.clientX-e.left)*l,u=(t.clientY-e.top)*d,S=this.getRouletteZone(i,u);if(!S)return;const s=["low","high","even","odd","red","black","1st12","2nd12","3rd12"].includes(S);let n;s?n={low:"range-low",high:"range-high",even:"parity-even",odd:"parity-odd",red:"color-red",black:"color-black","1st12":"dozen-1st12","2nd12":"dozen-2nd12","3rd12":"dozen-3rd12"}[S]:n=`sector-${S}`;const c=this.state.placements.map(f=>f.key).lastIndexOf(n);c!==-1&&(this.undoStack.push({placements:JSON.parse(JSON.stringify(this.state.placements)),activeMultiplier:this.activeMultiplier,betMultiplier:this.betMultiplier}),this.redoStack=[],this.state.placements.splice(c,1),this.updateSummary(),this.updateBoardStacks(),this.drawRouletteCanvas())}removeChipFromZone(t){if(this.isSpinning)return;const e=["low","high","even","odd","red","black","1st12","2nd12","3rd12"].includes(t);let l;e?l={low:"range-low",high:"range-high",even:"parity-even",odd:"parity-odd",red:"color-red",black:"color-black","1st12":"dozen-1st12","2nd12":"dozen-2nd12","3rd12":"dozen-3rd12","1st12":"dozen-1st12","2nd12":"dozen-2nd12","3rd12":"dozen-3rd12"}[t]:l=`sector-${t}`;const d=this.state.placements.map(i=>i.key).lastIndexOf(l);d!==-1&&(this.undoStack.push({placements:JSON.parse(JSON.stringify(this.state.placements)),activeMultiplier:this.activeMultiplier,betMultiplier:this.betMultiplier}),this.redoStack=[],this.state.placements.splice(d,1),this.updateSummary(),this.updateBoardStacks(),this.drawRouletteCanvas())}getClickedChip(t,e){const s=[1,2,5,10,20,30,50,100,200,500],f=1760/(s.length-1),I=120;for(let M=0;M<s.length;M++){const dt=I+M*f;if(Math.sqrt((t-dt)**2+(e-1445)**2)<=45)return s[M]}return null}placeBoardBet(t){if(this.isSpinning)return;const e=this.currentChipValue*(this.betMultiplier||1);if(this.getTotalStake()+e>this.state.credits){this.showToast("Not enough credits to place this bet.");return}const d={type:t.type,value:t.value||t.key,targets:t.targets||[t.value],label:t.label,key:t.key,tokens:1,multiplier:this.currentChipValue};if(this.state.placements.filter(u=>u.key===d.key).length>=this.maxTokens){this.showToast(`Maximum ${this.maxTokens} chips allowed on ${d.label}.`);return}this.undoStack.push({placements:JSON.parse(JSON.stringify(this.state.placements)),activeMultiplier:this.activeMultiplier,betMultiplier:this.betMultiplier}),this.redoStack=[],this.state.placements.push(d),this.dismissToastByReason("chips-required"),this.updateSummary(),this.updateBoardStacks(),this.drawRouletteCanvas()}placeRouletteBet(t){if(this.isSpinning)return;const e=this.currentChipValue*(this.betMultiplier||1);if(this.getTotalStake()+e>this.state.credits){this.showToast("Not enough credits to place this bet.");return}const d=Array.from({length:18},(P,_)=>String(_+1)),i=Array.from({length:18},(P,_)=>String(_+19)),u=Array.from({length:36},(P,_)=>_+1).filter(P=>P%2===0).map(String),S=Array.from({length:36},(P,_)=>_+1).filter(P=>P%2!==0).map(String),s=this.redNumbers.map(String),n=Array.from({length:36},(P,_)=>String(_+1)).filter(P=>!this.redNumbers.includes(P)),f={doubleZero:{label:"Double Zero",numbers:[...this.rouletteLeftSectorNums,...this.rouletteTopNumbers.slice(0,4),...this.rouletteBottomNumbers.slice(0,2)],type:"sector"},siluette:{label:"Siluette",numbers:this.rouletteTopNumbers.slice(4,7).concat(this.rouletteBottomNumbers.slice(2,7)),type:"sector"},angelEyes:{label:"Angel Eyes",numbers:this.rouletteTopNumbers.slice(7,12).concat(this.rouletteBottomNumbers.slice(7,13)),type:"sector"},zeroZone:{label:"Zero Zone",numbers:[...this.rouletteRightSectorNums,...this.rouletteTopNumbers.slice(12),...this.rouletteBottomNumbers.slice(13)],type:"sector"},low:{label:"1 to 18",numbers:d,type:"range",betType:"range",betValue:"low"},high:{label:"19 to 36",numbers:i,type:"range",betType:"range",betValue:"high"},even:{label:"EVEN",numbers:u,type:"parity",betType:"parity",betValue:"even"},odd:{label:"ODD",numbers:S,type:"parity",betType:"parity",betValue:"odd"},red:{label:"RED",numbers:s,type:"color",betType:"color",betValue:"red"},black:{label:"BLACK",numbers:n,type:"color",betType:"color",betValue:"black"},"1st12":{label:"1ST 12",numbers:Array.from({length:12},(P,_)=>String(_+1)),type:"dozen",betType:"dozen",betValue:"1st12"},"2nd12":{label:"2ND 12",numbers:Array.from({length:12},(P,_)=>String(_+13)),type:"dozen",betType:"dozen",betValue:"2nd12"},"3rd12":{label:"3RD 12",numbers:Array.from({length:12},(P,_)=>String(_+25)),type:"dozen",betType:"dozen",betValue:"3rd12"}}[t];if(!f)return;const I=["low","high","even","odd","red","black","1st12","2nd12","3rd12"].includes(t),M=I?`${f.betType}-${f.betValue}`:`sector-${t}`;if(this.state.placements.filter(P=>P.key===M).length>=this.maxTokens){this.showToast(`Maximum chips reached for ${f.label}.`);return}const B={type:I?f.betType:"sector",value:I?f.betValue:t,sectorKey:t,sectorSize:f.numbers.length,targets:f.numbers,label:f.label,key:M,tokens:1,multiplier:this.currentChipValue};this.undoStack.push({placements:JSON.parse(JSON.stringify(this.state.placements)),activeMultiplier:this.activeMultiplier,betMultiplier:this.betMultiplier}),this.redoStack=[],this.state.placements.push(B),this.dismissToastByReason("chips-required"),this.updateSummary(),this.updateBoardStacks(),this.drawRouletteCanvas()}calculateTotalBet(){const t=this.betMultiplier||1;if(!this.state?.placements)return 0;let e=0;return this.state.placements.forEach(l=>{l.breakdown?l.breakdown.forEach(d=>e+=d.multiplier*d.count):e+=l.multiplier||0}),e*t}getBaseBet(){if(!this.state?.placements)return 0;let t=0;return this.state.placements.forEach(e=>{e.breakdown?e.breakdown.forEach(l=>t+=l.multiplier*l.count):t+=e.multiplier||0}),t}trySetMultiplier(t,e){const l=this.getBaseBet(),d=l*t,i=this.state?.credits??0;return d>i&&l>0?(this.showToast(`Not enough credits for x${t} multiplier. Need ${d}, have ${i}.`),!1):(this.activeMultiplier!==e&&(this.undoStack.push({placements:JSON.parse(JSON.stringify(this.state.placements)),activeMultiplier:this.activeMultiplier,betMultiplier:this.betMultiplier}),this.redoStack=[]),this.activeMultiplier=e,this.betMultiplier=t,this.updateSummary(),this.drawRouletteCanvas(),!0)}drawRouletteCanvas(){if(!this.rouletteCanvas||!this.rouletteCtx)return;const t=this.rouletteCtx,e=140,l=300,d=1700,i=l,u=d,s=(u-i)/14,n=100,c=-60+e,f=300+c,I=60,M=160,dt=l-M,B=d+M;t.fillStyle="#0a3d0a",t.fillRect(0,0,2e3,1640);const P=t.createLinearGradient(0,0,0,e);P.addColorStop(0,"#1a1a2e"),P.addColorStop(1,"#16213e"),t.fillStyle=P,t.fillRect(0,0,2e3,e);const _=t.createLinearGradient(0,0,0,20);_.addColorStop(0,"rgba(0, 0, 0, 0.4)"),_.addColorStop(1,"rgba(0, 0, 0, 0)"),t.fillStyle=_,t.fillRect(0,4,2e3,20),t.shadowColor="#d4af37",t.shadowBlur=8,t.shadowOffsetY=2,t.beginPath(),t.moveTo(0,2),t.lineTo(2e3,2),t.strokeStyle="#d4af37",t.lineWidth=4,t.stroke(),t.shadowColor="transparent",t.shadowBlur=0,t.shadowOffsetY=0,t.beginPath(),t.moveTo(0,7),t.lineTo(2e3,7),t.strokeStyle="rgba(212, 175, 55, 0.5)",t.lineWidth=1,t.stroke();const Bt=t.createLinearGradient(0,e-20,0,e);Bt.addColorStop(0,"rgba(0, 0, 0, 0)"),Bt.addColorStop(1,"rgba(0, 0, 0, 0.4)"),t.fillStyle=Bt,t.fillRect(0,e-20,2e3,20),t.shadowColor="#d4af37",t.shadowBlur=8,t.shadowOffsetY=-2,t.beginPath(),t.moveTo(0,e-2),t.lineTo(2e3,e-2),t.strokeStyle="#d4af37",t.lineWidth=4,t.stroke(),t.shadowColor="transparent",t.shadowBlur=0,t.shadowOffsetY=0,t.beginPath(),t.moveTo(0,e-7),t.lineTo(2e3,e-7),t.strokeStyle="rgba(212, 175, 55, 0.5)",t.lineWidth=1,t.stroke();const It=85;t.beginPath(),t.moveTo(0,It),t.lineTo(2e3,It),t.strokeStyle="#d4af37",t.lineWidth=2,t.stroke();const St=28,yt=55;t.fillStyle="#ffd700",t.font="bold 28px Arial",t.textAlign="left",t.textBaseline="middle";const Ot=this.state?.credits??0,Tt=this.calculateTotalBet?this.calculateTotalBet():0,rt=Math.max(0,Ot-Tt);t.fillText("Coins:",40,St),t.fillStyle="#ffffff",t.font="bold 34px Arial",t.fillText(String(rt),150,St);const et=42;t.beginPath(),t.moveTo(0,et),t.lineTo(380,et),t.strokeStyle="#d4af37",t.lineWidth=2,t.stroke(),t.fillStyle="#ffd700",t.font="bold 28px Arial",t.fillText("Actual bet:",40,yt),t.fillStyle="#ffffff";const st=this.calculateTotalBet?this.calculateTotalBet():0;t.font="bold 34px Arial",t.fillText(String(st),210,yt);const N=this.betMultiplier||1;N>1&&(t.fillStyle="#ffd700",t.font="bold 24px Arial",t.fillText("(x"+N+")",280,yt));let Ct="",F="#1a5a2a";const nt=400,Q=42,kt=700,H=15,ht=55;this.winningDisplayState==="welcome"?(Ct="Welcome",F="#1a5a2a"):this.winningDisplayState==="spinning"?(Ct="Spinning...",F="#2a4a8a"):this.winningDisplayState==="result"&&this.lastWinningNumber!==null?(Ct=String(this.lastWinningNumber),F=this.getRouletteColor(String(this.lastWinningNumber))):(Ct="--",F="#333333"),t.fillStyle="#ffd700",t.font="bold 38px Arial",t.textAlign="left",t.textBaseline="middle",t.fillText("Winning number:",nt,Q),t.fillStyle=F,t.fillRect(kt,H,ht,ht),t.strokeStyle="#ffd700",t.lineWidth=3,t.strokeRect(kt,H,ht,ht),t.fillStyle="#ffffff",Ct==="Welcome"||Ct==="Spinning..."?t.font="bold 16px Arial":t.font="bold 38px Arial",t.textAlign="center",t.textBaseline="middle",t.fillText(Ct,kt+ht/2,H+ht/2),t.font="bold 28px Arial",t.textAlign="left";let V=kt+ht+40;const Wt=this.lastWinningNumber;if(this.winningDisplayState==="result"&&Wt!==null){const o=parseInt(Wt);let r="GREEN";this.redNumbers.includes(String(o))?r="RED":o!==0&&String(o)!=="00"&&(r="BLACK");const a=o===0||String(Wt)==="00"?"":o%2===0?"Even":"Odd";t.fillStyle="#ffffff",t.fillText("•",V,Q),V+=25,t.fillStyle=F==="#000000"?"#888888":F,t.fillText(r,V,Q),V+=t.measureText(r).width+20,a&&(t.fillStyle="#ffffff",t.fillText("•",V,Q),V+=25,t.fillText(a,V,Q),V+=t.measureText(a).width+20),t.fillStyle="#ffffff",t.fillText("•",V,Q),V+=25;const p=this.lastWonCredits??0;t.fillText(`Won ${p} credits`,V,Q)}if(this.wsState&&this.wsState.connected){this.wsState.secondsRemaining;const r=this.getCountdownColor(),a=this.getCountdownText();t.fillStyle="rgba(0, 0, 0, 0.5)",t.beginPath(),t.roundRect(1690,12,280,60,10),t.fill(),t.strokeStyle=r,t.lineWidth=3,t.beginPath(),t.roundRect(1690,12,280,60,10),t.stroke(),t.fillStyle="#ffd700",t.font="bold 22px Arial",t.textAlign="left",t.textBaseline="middle",t.fillText("Next spin:",1700,32),t.fillStyle=r,t.font="bold 36px Arial",t.textAlign="center",t.fillText(a,1840,52),t.fillStyle="#22c55e",t.beginPath(),t.arc(1960,42,8,0,Math.PI*2),t.fill()}else this.wsState&&(t.fillStyle="rgba(0, 0, 0, 0.5)",t.beginPath(),t.roundRect(1690,12,280,60,10),t.fill(),t.strokeStyle="#ef4444",t.lineWidth=3,t.beginPath(),t.roundRect(1690,12,280,60,10),t.stroke(),t.fillStyle="#ef4444",t.font="bold 24px Arial",t.textAlign="center",t.textBaseline="middle",t.fillText("CONNECTING...",1830,42));const $t=115;t.fillStyle="#ffd700",t.font="bold 30px Arial",t.textAlign="left",t.textBaseline="middle",t.fillText("Winning number history:",40,$t);const ft=380;t.beginPath(),t.moveTo(ft,0),t.lineTo(ft,e),t.strokeStyle="#d4af37",t.lineWidth=2,t.stroke();const at=this.winningHistory||[],vt=400,At=32,Jt=4;for(let o=0;o<Math.min(at.length,25);o++){const r=at[o],a=vt+o*(At+Jt),p=$t-At/2;t.fillStyle=this.getRouletteColor(String(r)),t.fillRect(a,p,At,At),t.strokeStyle="#ffd700",t.lineWidth=1,t.strokeRect(a,p,At,At),t.fillStyle="#ffffff",t.font="bold 14px Arial",t.textAlign="center",t.textBaseline="middle",t.fillText(String(r),a+At/2,p+At/2)}t.strokeStyle="#d4af37",t.lineWidth=2,t.lineWidth=2;for(let o=0;o<14;o++){const r=this.rouletteTopNumbers[o],a=this.getRouletteColor(r),p=i+o*s,g=140+c,h=a==="#1a1a1a",m=a==="#c41e3a",A=a==="#0a8a0a",b=t.createLinearGradient(p,g,p+s,g+n);if(h)b.addColorStop(0,"#2a2a2a"),b.addColorStop(.3,"#1a1a1a"),b.addColorStop(.7,"#1a1a1a"),b.addColorStop(1,"#0a0a0a");else if(m)b.addColorStop(0,"#e63e5c"),b.addColorStop(.3,"#c41e3a"),b.addColorStop(.7,"#c41e3a"),b.addColorStop(1,"#8a1528");else if(A)b.addColorStop(0,"#0cb010"),b.addColorStop(.3,"#0a8a0a"),b.addColorStop(.7,"#0a8a0a"),b.addColorStop(1,"#065a06");else{t.fillStyle=a,t.fillRect(p,g,s,n);continue}t.fillStyle=b,t.fillRect(p,g,s,n);const y=t.createLinearGradient(p,g,p+s*.5,g+n*.3);h?y.addColorStop(0,"rgba(255, 250, 220, 0.08)"):m?y.addColorStop(0,"rgba(255, 200, 200, 0.15)"):A&&y.addColorStop(0,"rgba(200, 255, 200, 0.12)"),y.addColorStop(1,"rgba(255, 255, 255, 0)"),t.fillStyle=y,t.fillRect(p,g,s,n)}for(let o=0;o<14;o++){const r=this.rouletteBottomNumbers[o],a=this.getRouletteColor(r),p=i+o*s,g=360+c,h=a==="#1a1a1a",m=a==="#c41e3a",A=a==="#0a8a0a",b=t.createLinearGradient(p,g,p+s,g+n);if(h)b.addColorStop(0,"#2a2a2a"),b.addColorStop(.3,"#1a1a1a"),b.addColorStop(.7,"#1a1a1a"),b.addColorStop(1,"#0a0a0a");else if(m)b.addColorStop(0,"#e63e5c"),b.addColorStop(.3,"#c41e3a"),b.addColorStop(.7,"#c41e3a"),b.addColorStop(1,"#8a1528");else if(A)b.addColorStop(0,"#0cb010"),b.addColorStop(.3,"#0a8a0a"),b.addColorStop(.7,"#0a8a0a"),b.addColorStop(1,"#065a06");else{t.fillStyle=a,t.fillRect(p,g,s,n);continue}t.fillStyle=b,t.fillRect(p,g,s,n);const y=t.createLinearGradient(p,g,p+s*.5,g+n*.3);h?y.addColorStop(0,"rgba(255, 250, 220, 0.08)"):m?y.addColorStop(0,"rgba(255, 200, 200, 0.15)"):A&&y.addColorStop(0,"rgba(200, 255, 200, 0.12)"),y.addColorStop(1,"rgba(255, 255, 255, 0)"),t.fillStyle=y,t.fillRect(p,g,s,n)}t.strokeStyle="#d4af37",t.beginPath(),t.moveTo(i,140+c),t.lineTo(u,140+c),t.moveTo(i,240+c),t.lineTo(u,240+c),t.moveTo(i,360+c),t.lineTo(u,360+c),t.moveTo(i,460+c),t.lineTo(u,460+c),t.stroke();for(let o=1;o<14;o++)t.beginPath(),t.moveTo(i+o*s,140+c),t.lineTo(i+o*s,240+c),t.stroke();for(let o=1;o<14;o++)t.beginPath(),t.moveTo(i+o*s,360+c),t.lineTo(i+o*s,460+c),t.stroke();t.strokeStyle="#d4af37",t.lineWidth=2,t.beginPath(),t.moveTo(i+2*s,360+c),t.lineTo(i+4*s,240+c),t.stroke(),t.beginPath(),t.moveTo(i+12*s,240+c),t.lineTo(i+13*s,360+c),t.stroke();const Pt=this.rouletteLeftSectorNums.map(o=>this.getRouletteColor(o));for(let o=0;o<5;o++){const r=Math.PI/2+o*(Math.PI/5),a=Math.PI/2+(o+1)*(Math.PI/5),p=(r+a)/2;t.beginPath(),t.arc(i,f,M,r,a),t.arc(i,f,I,a,r,!0),t.closePath();const g=Pt[o],h=g==="#1a1a1a",m=g==="#c41e3a",A=g==="#0a8a0a",b=i+Math.cos(p)*((I+M)/2),y=f+Math.sin(p)*((I+M)/2),Z=t.createRadialGradient(b-20,y-20,0,b,y,M-I);if(h)Z.addColorStop(0,"#2a2a2a"),Z.addColorStop(.5,"#1a1a1a"),Z.addColorStop(1,"#0a0a0a");else if(m)Z.addColorStop(0,"#e63e5c"),Z.addColorStop(.5,"#c41e3a"),Z.addColorStop(1,"#8a1528");else if(A)Z.addColorStop(0,"#12c012"),Z.addColorStop(.4,"#0a8a0a"),Z.addColorStop(1,"#045a04");else{t.fillStyle=g,t.fill(),t.stroke();continue}t.fillStyle=Z,t.fill(),t.stroke(),t.save(),t.beginPath(),t.arc(i,f,M,r,a),t.arc(i,f,I,a,r,!0),t.closePath(),t.clip();const J=t.createRadialGradient(b-30,y-30,0,b,y,M);A?(J.addColorStop(0,"rgba(200, 255, 200, 0.2)"),J.addColorStop(.5,"rgba(200, 255, 200, 0.05)")):m?(J.addColorStop(0,"rgba(255, 200, 200, 0.15)"),J.addColorStop(.5,"rgba(255, 200, 200, 0.03)")):(J.addColorStop(0,"rgba(255, 250, 220, 0.1)"),J.addColorStop(.5,"rgba(255, 250, 220, 0.02)")),J.addColorStop(1,"rgba(255, 255, 255, 0)"),t.fillStyle=J,t.fill(),t.restore()}const wt=this.rouletteRightSectorNums.map(o=>this.getRouletteColor(o));for(let o=0;o<5;o++){const r=-Math.PI/2+o*(Math.PI/5),a=-Math.PI/2+(o+1)*(Math.PI/5),p=(r+a)/2;t.beginPath(),t.arc(u,f,M,r,a),t.arc(u,f,I,a,r,!0),t.closePath();const g=wt[o],h=g==="#1a1a1a",m=g==="#c41e3a",A=g==="#0a8a0a",b=u+Math.cos(p)*((I+M)/2),y=f+Math.sin(p)*((I+M)/2),Z=t.createRadialGradient(b+20,y-20,0,b,y,M-I);if(h)Z.addColorStop(0,"#2a2a2a"),Z.addColorStop(.5,"#1a1a1a"),Z.addColorStop(1,"#0a0a0a");else if(m)Z.addColorStop(0,"#e63e5c"),Z.addColorStop(.5,"#c41e3a"),Z.addColorStop(1,"#8a1528");else if(A)Z.addColorStop(0,"#12c012"),Z.addColorStop(.4,"#0a8a0a"),Z.addColorStop(1,"#045a04");else{t.fillStyle=g,t.fill(),t.stroke();continue}t.fillStyle=Z,t.fill(),t.stroke(),t.save(),t.beginPath(),t.arc(u,f,M,r,a),t.arc(u,f,I,a,r,!0),t.closePath(),t.clip();const J=t.createRadialGradient(b+30,y-30,0,b,y,M);A?(J.addColorStop(0,"rgba(200, 255, 200, 0.2)"),J.addColorStop(.5,"rgba(200, 255, 200, 0.05)")):m?(J.addColorStop(0,"rgba(255, 200, 200, 0.15)"),J.addColorStop(.5,"rgba(255, 200, 200, 0.03)")):(J.addColorStop(0,"rgba(255, 250, 220, 0.1)"),J.addColorStop(.5,"rgba(255, 250, 220, 0.02)")),J.addColorStop(1,"rgba(255, 255, 255, 0)"),t.fillStyle=J,t.fill(),t.restore()}t.strokeStyle="#d4af37",t.beginPath(),t.arc(i,f,I,Math.PI/2,Math.PI*1.5),t.stroke(),t.beginPath(),t.arc(i,f,M,Math.PI/2,Math.PI*1.5),t.stroke(),t.beginPath(),t.arc(u,f,I,-Math.PI/2,Math.PI/2),t.stroke(),t.beginPath(),t.arc(u,f,M,-Math.PI/2,Math.PI/2),t.stroke();for(let o=0;o<=5;o++){const r=Math.PI/2+o*(Math.PI/5);t.beginPath(),t.moveTo(i+I*Math.cos(r),f+I*Math.sin(r)),t.lineTo(i+M*Math.cos(r),f+M*Math.sin(r)),t.stroke()}for(let o=0;o<=5;o++){const r=-Math.PI/2+o*(Math.PI/5);t.beginPath(),t.moveTo(u+I*Math.cos(r),f+I*Math.sin(r)),t.lineTo(u+M*Math.cos(r),f+M*Math.sin(r)),t.stroke()}t.beginPath(),t.moveTo(i+7*s,240+c),t.lineTo(i+7*s,360+c),t.stroke(),t.font="bold 34px Arial",t.textAlign="center",t.textBaseline="middle";for(let o=0;o<14;o++){const r=i+o*s+s/2,a=190+c;t.strokeStyle="rgba(0, 0, 0, 0.7)",t.lineWidth=4,t.strokeText(this.rouletteTopNumbers[o],r,a),t.fillStyle="white",t.fillText(this.rouletteTopNumbers[o],r,a)}for(let o=0;o<14;o++){const r=i+o*s+s/2,a=410+c;t.strokeStyle="rgba(0, 0, 0, 0.7)",t.lineWidth=4,t.strokeText(this.rouletteBottomNumbers[o],r,a),t.fillStyle="white",t.fillText(this.rouletteBottomNumbers[o],r,a)}for(let o=0;o<5;o++){const r=Math.PI/2+(o+.5)*(Math.PI/5),a=(I+M)/2,p=i+a*Math.cos(r),g=f+a*Math.sin(r);t.strokeStyle="rgba(0, 0, 0, 0.7)",t.lineWidth=4,t.strokeText(this.rouletteLeftSectorNums[o],p,g),t.fillStyle="white",t.fillText(this.rouletteLeftSectorNums[o],p,g)}for(let o=0;o<5;o++){const r=-Math.PI/2+(o+.5)*(Math.PI/5),a=(I+M)/2,p=u+a*Math.cos(r),g=f+a*Math.sin(r);t.strokeStyle="rgba(0, 0, 0, 0.7)",t.lineWidth=4,t.strokeText(this.rouletteRightSectorNums[o],p,g),t.fillStyle="white",t.fillText(this.rouletteRightSectorNums[o],p,g)}t.fillStyle="white",t.font="bold 25px Arial",t.textAlign="center",t.textBaseline="middle",t.save(),t.shadowColor="#d4af37",t.shadowBlur=8,t.strokeStyle="black",t.lineWidth=3,t.strokeText("DOUBLE ZERO",i+75,f),t.fillStyle="white",t.fillText("DOUBLE ZERO",i+75,f),t.restore(),t.font="bold 25px Arial",t.textAlign="center",t.shadowColor="#d4af37",t.shadowBlur=8,t.strokeStyle="black",t.lineWidth=3,t.strokeText("SILUETTE",i+5.5*s-30,f),t.fillStyle="white",t.fillText("SILUETTE",i+5.5*s-30,f),t.strokeText("ANGEL EYES",i+9.5*s+30,f),t.fillText("ANGEL EYES",i+9.5*s+30,f),t.font="bold 25px Arial",t.save(),t.shadowColor="#d4af37",t.shadowBlur=8,t.strokeStyle="black",t.lineWidth=3,t.strokeText("ZERO ZONE",u-45,f),t.fillStyle="white",t.fillText("ZERO ZONE",u-45,f),t.restore(),t.shadowColor="transparent",t.shadowBlur=0,this.rouletteHoveredZone==="doubleZero"&&(t.fillStyle="rgba(255, 255, 255, 0.3)",t.beginPath(),t.arc(i,f,M,Math.PI/2,Math.PI*1.5),t.closePath(),t.fill(),t.fillRect(i,140+c,s,n),t.beginPath(),t.moveTo(i,240+c),t.lineTo(i+s,240+c),t.lineTo(i,360+c),t.closePath(),t.fill(),t.fillRect(i+s,140+c,3*s,n),t.fillRect(i,360+c,2*s,n),t.beginPath(),t.moveTo(i+s,240+c),t.lineTo(i+4*s,240+c),t.lineTo(i+2*s,360+c),t.lineTo(i,360+c),t.closePath(),t.fill()),this.rouletteHoveredZone==="siluette"&&(t.fillStyle="rgba(255, 255, 255, 0.3)",t.fillRect(i+4*s,140+c,3*s,n),t.fillRect(i+2*s,360+c,5*s,n),t.beginPath(),t.moveTo(i+4*s,240+c),t.lineTo(i+7*s,240+c),t.lineTo(i+7*s,360+c),t.lineTo(i+2*s,360+c),t.closePath(),t.fill()),this.rouletteHoveredZone==="angelEyes"&&(t.fillStyle="rgba(255, 255, 255, 0.3)",t.fillRect(i+7*s,140+c,5*s,n),t.fillRect(i+7*s,360+c,6*s,n),t.beginPath(),t.moveTo(i+7*s,240+c),t.lineTo(i+12*s,240+c),t.lineTo(i+13*s,360+c),t.lineTo(i+7*s,360+c),t.closePath(),t.fill()),this.rouletteHoveredZone==="zeroZone"&&(t.fillStyle="rgba(255, 255, 255, 0.3)",t.beginPath(),t.arc(u,f,M,-Math.PI/2,Math.PI/2),t.closePath(),t.fill(),t.fillRect(i+12*s,140+c,2*s,n),t.fillRect(i+13*s,360+c,s,n),t.beginPath(),t.moveTo(i+12*s,240+c),t.lineTo(u,240+c),t.lineTo(u,360+c),t.lineTo(i+13*s,360+c),t.closePath(),t.fill());const K=(o,r,a,p,g=50)=>{const h=g/2;t.save(),t.beginPath(),t.arc(o+2,r+3,h,0,Math.PI*2),t.fillStyle="rgba(0, 0, 0, 0.3)",t.fill(),t.beginPath(),t.arc(o,r,h,0,Math.PI*2),t.fillStyle=a,t.fill();const m=8;for(let pt=0;pt<m;pt++){const ut=pt/m*Math.PI*2-Math.PI/2;t.save(),t.translate(o,r),t.rotate(ut),t.fillStyle="#1a1a1a";const lt=h*.22,Lt=h*.28;t.fillRect(h-lt,-Lt/2,lt,Lt),t.fillStyle="#ffffff",t.fillRect(h-lt+2,-Lt/2+2,lt-4,Lt-4),t.restore()}t.beginPath(),t.arc(o,r,h-1,0,Math.PI*2),t.strokeStyle="rgba(0, 0, 0, 0.2)",t.lineWidth=1,t.stroke(),t.beginPath(),t.arc(o,r,h*.75,0,Math.PI*2),t.strokeStyle="#ffffff",t.lineWidth=h*.12,t.stroke();const A=8,b=h*.75;for(let pt=0;pt<A;pt++){const ut=pt/A*Math.PI*2+Math.PI/8,lt=o+Math.cos(ut)*b,Lt=r+Math.sin(ut)*b;t.beginPath(),t.fillStyle=a;const Ut=h*.06;for(let Vt=0;Vt<5;Vt++){const Qt=Vt/5*Math.PI*2-Math.PI/2,te=lt+Math.cos(Qt)*Ut,ee=Lt+Math.sin(Qt)*Ut;Vt===0?t.moveTo(te,ee):t.lineTo(te,ee)}t.closePath(),t.fill()}t.beginPath(),t.arc(o,r,h*.62,0,Math.PI*2),t.strokeStyle=a,t.lineWidth=h*.08,t.stroke(),t.beginPath(),t.arc(o,r,h*.52,0,Math.PI*2),t.fillStyle="#2a2a3a",t.fill();const y=t.createRadialGradient(o-h*.1,r-h*.1,0,o,r,h*.52);y.addColorStop(0,"rgba(255, 255, 255, 0.1)"),y.addColorStop(1,"rgba(0, 0, 0, 0.2)"),t.fillStyle=y,t.fill();const Z=[0,Math.PI/2,Math.PI,Math.PI*1.5],J=h*.88;Z.forEach(pt=>{const ut=o+Math.cos(pt)*J,lt=r+Math.sin(pt)*J;t.beginPath(),t.arc(ut,lt,h*.05,0,Math.PI*2),t.fillStyle="#ffffff",t.fill()});const Mt=t.createRadialGradient(o-h*.3,r-h*.3,0,o-h*.3,r-h*.3,h*.4);Mt.addColorStop(0,"rgba(255, 255, 255, 0.25)"),Mt.addColorStop(1,"rgba(255, 255, 255, 0)"),t.beginPath(),t.arc(o-h*.2,r-h*.2,h*.35,0,Math.PI*2),t.fillStyle=Mt,t.fill();const Ht=Math.max(12,Math.floor(g*.4));t.font="bold "+Ht+"px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="rgba(0, 0, 0, 0.4)",t.fillText(String(p),o+1,r+1),t.fillStyle="#ffffff",t.fillText(String(p),o,r),t.restore()},v=620,w=15,gt=8,T=100,k=90,q=34,C=149,z=1860,Y=(z-C-11*w)/12,x=Y,tt=3*x+2*w,U=50;this.boardDimensions={y:v,gap:w,radius:gt,cellWidth:Y,cellHeight:x,zeroWidth:T,colRailWidth:k,startX:q,numbersStartX:C,endX:z,totalHeight:tt};const G=[[3,6,9,12,15,18,21,24,27,30,33,36],[2,5,8,11,14,17,20,23,26,29,32,35],[1,4,7,10,13,16,19,22,25,28,31,34]],W=(o,r,a,p,g,h=!1)=>{t.save(),t.beginPath(),t.roundRect(o,r,a,p,gt),t.fillStyle=g,t.fill();const m=t.createLinearGradient(o,r,o+a,r+p);m.addColorStop(0,"rgba(0, 0, 0, 0.4)"),m.addColorStop(.1,"rgba(0, 0, 0, 0.2)"),m.addColorStop(.5,"rgba(0, 0, 0, 0)"),m.addColorStop(.9,"rgba(255, 255, 255, 0.1)"),m.addColorStop(1,"rgba(255, 255, 255, 0.15)"),t.fillStyle=m,t.fill(),t.strokeStyle="#d4af37",t.lineWidth=2,t.stroke(),h&&(t.fillStyle="rgba(255, 255, 255, 0.3)",t.fill()),t.restore()},bt=q,ct=v,xt=x*1.5+w*.5,D=this.hoveredBoardCell&&this.hoveredBoardCell.key==="straight-0";W(bt,ct,T,xt,"#0a6b0a",D),t.save(),t.font="bold 40px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="white",t.shadowColor="rgba(0,0,0,0.5)",t.shadowBlur=4,t.fillText("0",bt+T/2,ct+xt/2),t.restore();const E=v+xt+w,X=tt-xt-w,j=this.hoveredBoardCell&&this.hoveredBoardCell.key==="straight-00";W(bt,E,T,X,"#0a6b0a",j),t.save(),t.font="bold 40px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="white",t.shadowColor="rgba(0,0,0,0.5)",t.shadowBlur=4,t.fillText("00",bt+T/2,E+X/2),t.restore();for(let o=0;o<3;o++)for(let r=0;r<12;r++){const a=G[o][r],p=C+r*(Y+w),g=v+o*(x+w),h=this.getRouletteColor(String(a)),m=this.hoveredBoardCell&&this.hoveredBoardCell.key===`straight-${a}`;W(p,g,Y,x,h,m),t.save(),t.font="bold 36px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="white",t.shadowColor="rgba(0,0,0,0.5)",t.shadowBlur=4,t.fillText(String(a),p+Y/2,g+x/2),t.restore()}const L=z+w,O=["col3","col2","col1"];for(let o=0;o<3;o++){const r=v+o*(x+w),a=this.hoveredBoardCell&&this.hoveredBoardCell.key===`column-${O[o]}`;W(L,r,k,x,"#0a5c0a",a),t.save(),t.translate(L+k/2,r+x/2),t.rotate(-Math.PI/2),t.font="bold 28px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="white",t.shadowColor="rgba(0,0,0,0.5)",t.shadowBlur=4,t.fillText("2 to 1",0,0),t.restore()}for(let o=0;o<2;o++)for(let r=0;r<12;r++){const a=G[o][r],p=G[o+1][r],g=C+r*(Y+w)+Y/2,h=v+(o+1)*(x+w)-w/2,m=U/2,A=`split-${Math.min(a,p)}-${Math.max(a,p)}`;this.hoveredBoardCell&&this.hoveredBoardCell.key===A&&(t.save(),t.beginPath(),t.arc(g,h,m,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore())}for(let o=0;o<3;o++)for(let r=0;r<11;r++){const a=G[o][r],p=G[o][r+1],g=C+(r+1)*(Y+w)-w/2,h=v+o*(x+w)+x/2,m=U/2,A=`split-${Math.min(a,p)}-${Math.max(a,p)}`;this.hoveredBoardCell&&this.hoveredBoardCell.key===A&&(t.save(),t.beginPath(),t.arc(g,h,m,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore())}for(let o=0;o<2;o++)for(let r=0;r<11;r++){const p=`corner-${[G[o][r],G[o][r+1],G[o+1][r],G[o+1][r+1]].sort((b,y)=>b-y).join("-")}`,g=C+(r+1)*(Y+w)-w/2,h=v+(o+1)*(x+w)-w/2,m=U/2;this.hoveredBoardCell&&this.hoveredBoardCell.key===p&&(t.save(),t.beginPath(),t.arc(g,h,m,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore())}for(let o=0;o<12;o++){const a=`street-${[G[0][o],G[1][o],G[2][o]].sort((A,b)=>A-b).join("-")}`,p=C+o*(Y+w)+Y/2,g=v+tt,h=U/2;this.hoveredBoardCell&&this.hoveredBoardCell.key===a&&(t.save(),t.beginPath(),t.arc(p,g,h,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore())}for(let o=0;o<11;o++){const r=[G[0][o],G[1][o],G[2][o],G[0][o+1],G[1][o+1],G[2][o+1]].sort((A,b)=>A-b),a=`line-${r[0]}-${r[5]}`,p=C+(o+1)*(Y+w)-w/2,g=v+tt,h=U/2;this.hoveredBoardCell&&this.hoveredBoardCell.key===a&&(t.save(),t.beginPath(),t.arc(p,g,h,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore())}const R="line-0-00-1-2-3",it=C-w/2,$=v+tt;this.hoveredBoardCell&&this.hoveredBoardCell.key===R&&(t.save(),t.beginPath(),t.arc(it,$,U/2,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore());const Ft=U/2,Kt=C-w/2,ge=v+x+w,be=v+2*x+w,Re=v+2*(x+w),Te=ge+x/2,$e=Kt,Ie=v+x/2,Oe=Kt,Ae=ge+15,Ye=q+T/2,We=v+tt/2,Ee=Kt,Xe=Te,Le=Kt,Ne=be-15,Ge=Kt,ze=Re+x/2;this.hoveredBoardCell&&this.hoveredBoardCell.key==="split-0-3"&&(t.save(),t.beginPath(),t.arc($e,Ie,Ft,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore()),this.hoveredBoardCell&&this.hoveredBoardCell.key==="split-0-2"&&(t.save(),t.beginPath(),t.arc(Oe,Ae,Ft,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore()),this.hoveredBoardCell&&this.hoveredBoardCell.key==="street-0-00-2"&&(t.save(),t.beginPath(),t.arc(Ee,Xe,Ft,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore()),this.hoveredBoardCell&&this.hoveredBoardCell.key==="split-0-00"&&(t.save(),t.beginPath(),t.arc(Ye,We,Ft,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore()),this.hoveredBoardCell&&this.hoveredBoardCell.key==="split-00-2"&&(t.save(),t.beginPath(),t.arc(Le,Ne,Ft,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore()),this.hoveredBoardCell&&this.hoveredBoardCell.key==="split-00-1"&&(t.save(),t.beginPath(),t.arc(Ge,ze,Ft,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore());const jt=new Map;this.state.placements.forEach(o=>{const r=o.targets||[],a=o.multiplier,p=o.type;(p==="sector"||p==="straight")&&r.length>0&&r.forEach(h=>{const m=String(h);jt.has(m)||jt.set(m,{totalValue:0,lastMultiplier:a,chips:0});const A=jt.get(m);A.totalValue+=a,A.lastMultiplier=a,A.chips+=1})});for(let o=0;o<3;o++)for(let r=0;r<12;r++){const a=G[o][r],p=String(a),g=jt.get(p);if(g&&g.chips>0){const h=C+r*(Y+w)+Y/2,m=v+o*(x+w)+x/2,A=this.getChipColor(g.lastMultiplier);t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,t.shadowOffsetX=0,t.shadowOffsetY=0,K(h,m,A,Math.round(g.totalValue),U),t.restore()}}const oe=jt.get("0");if(oe&&oe.chips>0){const o=x*1.5+w*.5,r=q+T/2,a=v+o/2,p=this.getChipColor(oe.lastMultiplier);t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,K(r,a,p,Math.round(oe.totalValue),U),t.restore()}const se=jt.get("00");if(se&&se.chips>0){const o=x*1.5+w*.5,r=v+o+w,a=tt-o-w,p=q+T/2,g=r+a/2,h=this.getChipColor(se.lastMultiplier);t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,K(p,g,h,Math.round(se.totalValue),U),t.restore()}if(this.summary){const o=["column-col3","column-col2","column-col1"],r=z+w;for(let a=0;a<3;a++){const p=this.summary[o[a]];if(p&&p.chips>0){const g=r+k/2,h=v+a*(x+w)+x/2,m=this.getChipColor(p.lastMultiplier);t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,K(g,h,m,Math.round(p.totalValue),U),t.restore()}}}if(this.summary){Object.entries(this.summary).forEach(([a,p])=>{if(a.startsWith("split-")&&p.chips>0){const g=a.replace("split-","").split("-"),h=g.map(b=>isNaN(b)?b:parseInt(b));let m,A;if(g.includes("0")||g.includes("00")){const b=C-w/2;a==="split-0-00"?(m=q+T/2,A=v+tt/2):a==="split-0-2"?(m=b,A=v+x+w+15):a==="split-0-3"?(m=b,A=v+x/2):a==="split-00-2"?(m=b,A=be-15):a==="split-00-1"&&(m=b,A=v+2*(x+w)+x/2)}else{const b=h[0],y=h[1],Z=Math.abs(b-y);let J,Mt,Ht,pt;for(let ut=0;ut<3;ut++)for(let lt=0;lt<12;lt++)G[ut][lt]===b&&(J=ut,Mt=lt),G[ut][lt]===y&&(Ht=ut,pt=lt);if(J!==void 0&&Mt!==void 0&&Ht!==void 0&&pt!==void 0){if(Z===3){const ut=Math.min(Mt,pt),lt=J;m=C+(ut+1)*(Y+w)-w/2,A=v+lt*(x+w)+x/2}else if(Z===1){const ut=Math.min(J,Ht);m=C+Mt*(Y+w)+Y/2,A=v+(ut+1)*(x+w)-w/2}}}if(m&&A){const b=this.getChipColor(p.lastMultiplier);t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,K(m,A,b,Math.round(p.totalValue),U),t.restore()}}}),Object.entries(this.summary).forEach(([a,p])=>{if(a.startsWith("corner-")&&p.chips>0){const g=a.replace("corner-","").split("-").map(Number).sort((h,m)=>h-m);for(let h=0;h<2;h++)for(let m=0;m<11;m++)if([G[h][m],G[h][m+1],G[h+1][m],G[h+1][m+1]].sort((b,y)=>b-y).join("-")===g.join("-")){const b=C+(m+1)*(Y+w)-w/2,y=v+(h+1)*(x+w)-w/2,Z=this.getChipColor(p.lastMultiplier);t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,K(b,y,Z,Math.round(p.totalValue),U),t.restore()}}}),Object.entries(this.summary).forEach(([a,p])=>{if(a.startsWith("street-")&&p.chips>0&&!a.includes("00")){const g=a.replace("street-","").split("-").map(h=>parseInt(h)).filter(h=>!isNaN(h));if(g.length===3){const h=Math.max(...g),m=G[0].indexOf(h);if(m>=0){const A=C+m*(Y+w)+Y/2,b=v+tt,y=this.getChipColor(p.lastMultiplier);t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,K(A,b,y,Math.round(p.totalValue),U),t.restore()}}}}),Object.entries(this.summary).forEach(([a,p])=>{if(a.startsWith("line-")&&p.chips>0){const g=a.replace("line-","").split("-"),h=parseInt(g[0]),m=G[2].indexOf(h);if(m>=0){const A=C+(m+1)*(Y+w)-w/2,b=v+tt,y=this.getChipColor(p.lastMultiplier);t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,K(A,b,y,Math.round(p.totalValue),U),t.restore()}}});const o=this.summary["line-0-00-1-2-3"];if(o&&o.chips>0){const a=C-w/2,p=v+tt,g=this.getChipColor(o.lastMultiplier);t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,K(a,p,g,Math.round(o.totalValue),U),t.restore()}const r=this.summary["street-0-00-2"];if(r&&r.chips>0){const a=C-w/2,p=this.getChipColor(r.lastMultiplier);t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4;const g=v+x+w+x/2;K(a,g,p,Math.round(r.totalValue),U),t.restore()}}const Yt=1120,zt=65,ae=20,De=2*ae,He=B-dt,re=dt,Nt=(He-De)/3,Ve=[{key:"1st12",label:"1ST 12",numbers:[1,2,3,4,5,6,7,8,9,10,11,12]},{key:"2nd12",label:"2ND 12",numbers:[13,14,15,16,17,18,19,20,21,22,23,24]},{key:"3rd12",label:"3RD 12",numbers:[25,26,27,28,29,30,31,32,33,34,35,36]}];for(let o=0;o<3;o++){const r=Ve[o],a=re+o*(Nt+ae);t.save(),t.shadowColor="rgba(0, 0, 0, 0.6)",t.shadowBlur=Math.max(3,M*.03),t.shadowOffsetX=3,t.shadowOffsetY=3;const p=t.createLinearGradient(a,Yt,a,Yt+zt);p.addColorStop(0,"#3d5a80"),p.addColorStop(.3,"#2c4a6e"),p.addColorStop(.7,"#1e3a5f"),p.addColorStop(1,"#152a45"),t.fillStyle=p,t.fillRect(a,Yt,Nt,zt),t.restore(),t.save(),t.beginPath(),t.rect(a,Yt,Nt,zt),t.clip();const g=t.createLinearGradient(a,Yt,a,Yt+10);g.addColorStop(0,"rgba(184, 134, 80, 0.35)"),g.addColorStop(1,"rgba(184, 134, 80, 0)"),t.fillStyle=g,t.fillRect(a,Yt,Nt,10),t.restore(),t.save(),t.beginPath(),t.rect(a,Yt,Nt,zt),t.clip();const h=t.createLinearGradient(a,Yt+zt-12,a,Yt+zt);h.addColorStop(0,"rgba(0, 0, 0, 0)"),h.addColorStop(1,"rgba(139, 90, 43, 0.4)"),t.fillStyle=h,t.fillRect(a,Yt+zt-12,Nt,12),t.restore(),t.strokeStyle="#d4af37",t.lineWidth=2,t.strokeRect(a,Yt,Nt,zt),t.font="bold 38px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="white",t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,t.shadowOffsetX=1,t.shadowOffsetY=1,t.fillText(r.label,a+Nt/2,Yt+zt/2),t.shadowColor="transparent",t.shadowBlur=0}const me=["1st12","2nd12","3rd12"].indexOf(this.rouletteHoveredZone);if(me!==-1){t.fillStyle="rgba(255, 255, 255, 0.2)";const o=re+me*(Nt+ae);t.fillRect(o,Yt,Nt,zt)}const Fe={"dozen-1st12":0,"dozen-2nd12":1,"dozen-3rd12":2};this.summary&&Object.entries(this.summary).forEach(([o,r])=>{const a=Fe[o];if(a!==void 0&&r.chips>0){const p=re+a*(Nt+ae)+Nt/2,g=Yt+zt/2,h=42,m=this.getChipColor(r.lastMultiplier);K(p,g,m,Math.round(r.totalValue),h)}});const Rt=1205,Xt=90,ie=20,je=5*ie,ne=dt,Et=(B-dt-je)/6,Se=[{key:"low",label:"1 to 18",hasBg:!0},{key:"even",label:"EVEN",hasBg:!0},{key:"red",label:"RED",hasBg:!1},{key:"black",label:"BLACK",hasBg:!1},{key:"odd",label:"ODD",hasBg:!0},{key:"high",label:"19 to 36",hasBg:!0}];for(let o=0;o<6;o++){const r=Se[o],a=ne+o*(Et+ie);if(r.hasBg){t.save(),t.shadowColor="rgba(0, 0, 0, 0.6)",t.shadowBlur=Math.max(3,M*.03),t.shadowOffsetX=3,t.shadowOffsetY=3;const p=t.createLinearGradient(a,Rt,a,Rt+Xt);p.addColorStop(0,"#3d5a80"),p.addColorStop(.3,"#2c4a6e"),p.addColorStop(.7,"#1e3a5f"),p.addColorStop(1,"#152a45"),t.fillStyle=p,t.fillRect(a,Rt,Et,Xt),t.restore(),t.save(),t.beginPath(),t.rect(a,Rt,Et,Xt),t.clip();const g=t.createLinearGradient(a,Rt,a,Rt+10);g.addColorStop(0,"rgba(184, 134, 80, 0.35)"),g.addColorStop(1,"rgba(184, 134, 80, 0)"),t.fillStyle=g,t.fillRect(a,Rt,Et,10),t.restore(),t.save(),t.beginPath(),t.rect(a,Rt,Et,Xt),t.clip();const h=t.createLinearGradient(a,Rt+Xt-12,a,Rt+Xt);h.addColorStop(0,"rgba(0, 0, 0, 0)"),h.addColorStop(1,"rgba(139, 90, 43, 0.4)"),t.fillStyle=h,t.fillRect(a,Rt+Xt-12,Et,12),t.restore(),t.strokeStyle="#d4af37",t.lineWidth=2,t.strokeRect(a,Rt,Et,Xt),t.font="bold 38px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="white",t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,t.shadowOffsetX=1,t.shadowOffsetY=1,t.fillText(r.label,a+Et/2,Rt+Xt/2),t.shadowColor="transparent",t.shadowBlur=0}else{const h=a+Et/2,m=Rt+Xt/2-2;t.fillStyle=r.key==="red"?"#c41e3a":"#1a1a1a",t.beginPath(),t.moveTo(h,m-35),t.lineTo(h+50,m),t.lineTo(h,m+35),t.lineTo(h-50,m),t.closePath(),t.fill(),t.strokeStyle="#d4af37",t.lineWidth=2,t.stroke()}}const de=["low","even","red","black","odd","high"].indexOf(this.rouletteHoveredZone);if(de!==-1){const o=ne+de*(Et+ie);if(Se[de].hasBg)t.fillStyle="rgba(255, 255, 255, 0.2)",t.fillRect(o,Rt,Et,Xt);else{const g=o+Et/2,h=Rt+Xt/2-2;t.fillStyle="rgba(255, 255, 255, 0.25)",t.beginPath(),t.moveTo(g,h-35-3),t.lineTo(g+50+3,h),t.lineTo(g,h+35+3),t.lineTo(g-50-3,h),t.closePath(),t.fill()}}const _e={"range-low":0,"parity-even":1,"color-red":2,"color-black":3,"parity-odd":4,"range-high":5},Ze={1:"#f59e0b",2:"#f97316",5:"#dc2626",10:"#16a34a",20:"#2563eb",30:"#7c3aed",50:"#0891b2",100:"#1f2937",200:"#1d4ed8",500:"#7e22ce"};this.summary&&Object.entries(this.summary).forEach(([o,r])=>{const a=_e[o];if(a!==void 0&&r.chips>0){const p=ne+a*(Et+ie)+Et/2,g=Rt+Xt/2,h=56,m=Ze[r.lastMultiplier]||"#475569";K(p,g,m,Math.round(r.totalValue),h)}});const ye=1445,we=80,ot=we/2,qt=2e3,Ce=60,he=120,Dt=ye-he/2,_t=t.createLinearGradient(0,Dt,0,Dt+he);_t.addColorStop(0,"#0d3d0d"),_t.addColorStop(.3,"#0a5a0a"),_t.addColorStop(.5,"#0d6b0d"),_t.addColorStop(.7,"#0a5a0a"),_t.addColorStop(1,"#073d07"),t.fillStyle=_t,t.fillRect(0,Dt,qt,he);const ce=t.createLinearGradient(0,Dt-20,0,Dt);ce.addColorStop(0,"rgba(0, 0, 0, 0)"),ce.addColorStop(1,"rgba(0, 0, 0, 0.4)"),t.fillStyle=ce,t.fillRect(0,Dt-20,qt,20),t.shadowColor="#d4af37",t.shadowBlur=8,t.shadowOffsetY=-2,t.beginPath(),t.moveTo(0,Dt),t.lineTo(qt,Dt),t.strokeStyle="#d4af37",t.lineWidth=4,t.stroke(),t.shadowColor="transparent",t.shadowBlur=0,t.shadowOffsetY=0,t.beginPath(),t.moveTo(0,Dt+5),t.lineTo(qt,Dt+5),t.strokeStyle="rgba(212, 175, 55, 0.3)",t.lineWidth=2,t.stroke();const Me=[1,2,5,10,20,30,50,100,200,500],Je=Me.length,Ke=(qt-2*Ce-we)/(Je-1),qe=Ce+ot,Ue={1:"#f59e0b",2:"#f97316",5:"#dc2626",10:"#16a34a",20:"#2563eb",30:"#7c3aed",50:"#0891b2",100:"#1f2937",200:"#1d4ed8",500:"#7e22ce"};Me.forEach((o,r)=>{const a=qe+r*Ke,p=this.currentChipValue===o,g=this.hoveredChipValue===o,h=ye,m=Ue[o]||"#475569";t.save(),t.beginPath(),t.arc(a,h,ot,0,Math.PI*2),t.fillStyle=m,t.fill();const A=8;for(let pt=0;pt<A;pt++){const ut=pt/A*Math.PI*2-Math.PI/2;t.save(),t.translate(a,h),t.rotate(ut),t.fillStyle="#1a1a1a";const lt=ot*.22,Lt=ot*.28;t.fillRect(ot-lt,-Lt/2,lt,Lt),t.fillStyle="#ffffff",t.fillRect(ot-lt+2,-Lt/2+2,lt-4,Lt-4),t.restore()}t.beginPath(),t.arc(a,h,ot-1,0,Math.PI*2),t.strokeStyle="rgba(0, 0, 0, 0.2)",t.lineWidth=1,t.stroke(),t.beginPath(),t.arc(a,h,ot*.75,0,Math.PI*2),t.strokeStyle="#ffffff",t.lineWidth=ot*.12,t.stroke();const b=8,y=ot*.75;for(let pt=0;pt<b;pt++){const ut=pt/b*Math.PI*2+Math.PI/8,lt=a+Math.cos(ut)*y,Lt=h+Math.sin(ut)*y;t.beginPath(),t.fillStyle=m;const Ut=ot*.06;for(let Vt=0;Vt<5;Vt++){const Qt=Vt/5*Math.PI*2-Math.PI/2,te=lt+Math.cos(Qt)*Ut,ee=Lt+Math.sin(Qt)*Ut;Vt===0?t.moveTo(te,ee):t.lineTo(te,ee)}t.closePath(),t.fill()}t.beginPath(),t.arc(a,h,ot*.62,0,Math.PI*2),t.strokeStyle=m,t.lineWidth=ot*.08,t.stroke(),t.beginPath(),t.arc(a,h,ot*.52,0,Math.PI*2),t.fillStyle="#2a2a3a",t.fill();const Z=t.createRadialGradient(a-ot*.1,h-ot*.1,0,a,h,ot*.52);Z.addColorStop(0,"rgba(255, 255, 255, 0.1)"),Z.addColorStop(1,"rgba(0, 0, 0, 0.2)"),t.fillStyle=Z,t.fill();const J=[0,Math.PI/2,Math.PI,Math.PI*1.5],Mt=ot*.88;J.forEach(pt=>{const ut=a+Math.cos(pt)*Mt,lt=h+Math.sin(pt)*Mt;t.beginPath(),t.arc(ut,lt,ot*.05,0,Math.PI*2),t.fillStyle="#ffffff",t.fill()});const Ht=t.createRadialGradient(a-ot*.3,h-ot*.3,0,a-ot*.3,h-ot*.3,ot*.4);Ht.addColorStop(0,"rgba(255, 255, 255, 0.25)"),Ht.addColorStop(1,"rgba(255, 255, 255, 0)"),t.beginPath(),t.arc(a-ot*.2,h-ot*.2,ot*.35,0,Math.PI*2),t.fillStyle=Ht,t.fill(),t.font="bold 38px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="rgba(0, 0, 0, 0.4)",t.fillText(String(o),a+1,h+1),t.fillStyle="#ffffff",t.fillText(String(o),a,h),(p||g)&&(t.beginPath(),t.arc(a,h,ot+4,0,Math.PI*2),t.strokeStyle="#ffffff",t.lineWidth=4,t.stroke(),t.beginPath(),t.arc(a,h,ot+8,0,Math.PI*2),t.strokeStyle="rgba(255, 255, 255, 0.3)",t.lineWidth=2,t.stroke()),t.restore()});const Gt=1515,pe=115,mt=60,Qe=15,ke=(pe-mt)/2,ve=[{key:"undo",label:"UNDO",width:110,enabled:this.undoStack.length>0},{key:"redo",label:"REDO",width:110,enabled:this.redoStack.length>0},{key:"rebet",label:"RE-BET",width:130,enabled:this.lastBet&&this.lastBet.length>0}],to=12,xe=[{key:"x1",label:"x1",width:60,enabled:!0},{key:"x2",label:"x2",width:60,enabled:!0},{key:"x3",label:"x3",width:60,enabled:!0},{key:"x4",label:"x4",width:60,enabled:!0},{key:"x5",label:"x5",width:60,enabled:!0},{key:"clear",label:"CLEAR",width:120,enabled:this.state.placements.length>0},{key:"remove",label:this.removeMode?"DEACTIVATE REMOVE":"REMOVE",width:this.removeMode?280:150,enabled:!0}];let fe=1930;const le=[];for(let o=ve.length-1;o>=0;o--){const r=ve[o];fe-=r.width,le.push({...r,x:fe,y:Gt+ke}),fe-=Qe}let Be=70;for(let o=0;o<xe.length;o++){const r=xe[o];le.push({...r,x:Be,y:Gt+ke}),Be+=r.width+to}this.controlButtons=le;const Zt=t.createLinearGradient(0,Gt,0,Gt+pe);Zt.addColorStop(0,"#0d3d0d"),Zt.addColorStop(.3,"#0a5a0a"),Zt.addColorStop(.5,"#0d6b0d"),Zt.addColorStop(.7,"#0a5a0a"),Zt.addColorStop(1,"#073d07"),t.fillStyle=Zt,t.fillRect(0,Gt,2e3,pe);const ue=t.createLinearGradient(0,Gt-20,0,Gt);if(ue.addColorStop(0,"rgba(0, 0, 0, 0)"),ue.addColorStop(1,"rgba(0, 0, 0, 0.4)"),t.fillStyle=ue,t.fillRect(0,Gt-20,2e3,20),t.shadowColor="#d4af37",t.shadowBlur=8,t.shadowOffsetY=-2,t.beginPath(),t.moveTo(0,Gt),t.lineTo(2e3,Gt),t.strokeStyle="#d4af37",t.lineWidth=4,t.stroke(),t.shadowColor="transparent",t.shadowBlur=0,t.shadowOffsetY=0,t.beginPath(),t.moveTo(0,Gt+5),t.lineTo(2e3,Gt+5),t.strokeStyle="rgba(212, 175, 55, 0.3)",t.lineWidth=2,t.stroke(),le.forEach(o=>{const r=this.hoveredButton===o.key,a=o.enabled,p=o.x+o.width/2,g=o.y+mt/2,h=["x1","x2","x3","x4","x5"].includes(o.key),m=o.key==="clear",A=o.key==="remove",b=h&&this.activeMultiplier===o.key||A&&this.removeMode;if(o.key==="spin"){const y=Date.now()*.003,Z=a?Math.abs(Math.sin(y))*.5+.5:0;if(a)for(let Mt=3;Mt>=0;Mt--)t.beginPath(),t.roundRect(o.x-Mt*4,o.y-Mt*4,o.width+Mt*8,mt+Mt*8,14+Mt*2),t.fillStyle=`rgba(255, 215, 0, ${Z*.08*(4-Mt)})`,t.fill();t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=Math.max(3,M*.03),t.shadowOffsetX=3,t.shadowOffsetY=3,t.beginPath(),t.roundRect(o.x,o.y,o.width,mt,10);const J=t.createLinearGradient(o.x,o.y,o.x,o.y+mt);a?(J.addColorStop(0,r?"#ffd700":"#f59e0b"),J.addColorStop(.5,r?"#ffb300":"#d97706"),J.addColorStop(1,r?"#ff8c00":"#b45309")):(J.addColorStop(0,"#4b5563"),J.addColorStop(1,"#374151")),t.fillStyle=J,t.fill(),t.restore(),t.strokeStyle=a?"#ffd700":"#4b5563",t.lineWidth=3,t.stroke(),t.beginPath(),t.roundRect(o.x+2,o.y+2,o.width-4,mt-4,8),t.strokeStyle="rgba(0, 0, 0, 0.3)",t.lineWidth=2,t.stroke(),a&&(t.beginPath(),t.roundRect(o.x+4,o.y+4,o.width-8,mt/2-6,6),t.fillStyle="rgba(255, 255, 255, 0.25)",t.fill()),t.font="bold 40px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="rgba(0, 0, 0, 0.4)",t.fillText(o.label,p+2,g+2),t.fillStyle=a?"#1a1a1a":"#6b7280",t.fillText(o.label,p,g)}else if(h){t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=8,t.shadowOffsetX=2,t.shadowOffsetY=3,t.beginPath(),t.roundRect(o.x,o.y,o.width,mt,8);const y=t.createLinearGradient(o.x,o.y,o.x,o.y+mt);b?(y.addColorStop(0,"#ffd700"),y.addColorStop(.5,"#f5a623"),y.addColorStop(1,"#d4880f")):r?(y.addColorStop(0,"#3a5a7a"),y.addColorStop(.5,"#2a4a6a"),y.addColorStop(1,"#1a3a5a")):(y.addColorStop(0,"#2a4a6a"),y.addColorStop(.5,"#1e3a5a"),y.addColorStop(1,"#152a45")),t.fillStyle=y,t.fill(),t.restore(),t.strokeStyle=b?"#ffd700":r?"#d4af37":"#8b7355",t.lineWidth=b?3:2,t.stroke(),t.beginPath(),t.roundRect(o.x+2,o.y+2,o.width-4,mt-4,6),t.strokeStyle=b?"rgba(0, 0, 0, 0.2)":"rgba(0, 0, 0, 0.3)",t.lineWidth=2,t.stroke(),t.beginPath(),t.roundRect(o.x+3,o.y+3,o.width-6,mt/2-4,5),t.fillStyle=b?"rgba(255, 255, 255, 0.3)":"rgba(255, 255, 255, 0.1)",t.fill(),t.font="bold 28px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="rgba(0, 0, 0, 0.4)",t.fillText(o.label,p+1,g+1),t.fillStyle=b?"#1a1a1a":"#ffffff",t.fillText(o.label,p,g)}else if(m){t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=8,t.shadowOffsetX=2,t.shadowOffsetY=3,t.beginPath(),t.roundRect(o.x,o.y,o.width,mt,8);const y=t.createLinearGradient(o.x,o.y,o.x,o.y+mt);a?(y.addColorStop(0,r?"#dc2626":"#b91c1c"),y.addColorStop(.5,r?"#b91c1c":"#991b1b"),y.addColorStop(1,r?"#991b1b":"#7f1d1d")):(y.addColorStop(0,"#2a2a2a"),y.addColorStop(1,"#1a1a1a")),t.fillStyle=y,t.fill(),t.restore(),t.strokeStyle=a?r?"#f87171":"#d4af37":"#3a3a3a",t.lineWidth=2,t.stroke(),t.beginPath(),t.roundRect(o.x+2,o.y+2,o.width-4,mt-4,6),t.strokeStyle="rgba(0, 0, 0, 0.3)",t.lineWidth=2,t.stroke(),a&&(t.beginPath(),t.roundRect(o.x+3,o.y+3,o.width-6,mt/2-4,5),t.fillStyle="rgba(255, 255, 255, 0.1)",t.fill()),t.font="bold 38px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="rgba(0, 0, 0, 0.4)",t.fillText(o.label,p+1,g+1),t.fillStyle=a?"#ffffff":"#5a5a5a",t.fillText(o.label,p,g)}else if(A){t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=8,t.shadowOffsetX=2,t.shadowOffsetY=3,t.beginPath(),t.roundRect(o.x,o.y,o.width,mt,8);const y=t.createLinearGradient(o.x,o.y,o.x,o.y+mt);b?(y.addColorStop(0,"#ff6b35"),y.addColorStop(.5,"#e63946"),y.addColorStop(1,"#c1121f")):r?(y.addColorStop(0,"#4a3a3a"),y.addColorStop(.5,"#3a2a2a"),y.addColorStop(1,"#2a1a1a")):(y.addColorStop(0,"#3a3a4a"),y.addColorStop(.5,"#2a2a3a"),y.addColorStop(1,"#1a1a2a")),t.fillStyle=y,t.fill(),t.restore(),t.strokeStyle=b?"#ff4500":r?"#8b5a5a":"#6b5555",t.lineWidth=b?3:2,t.stroke(),t.beginPath(),t.roundRect(o.x+2,o.y+2,o.width-4,mt-4,6),t.strokeStyle=b?"rgba(0, 0, 0, 0.2)":"rgba(0, 0, 0, 0.3)",t.lineWidth=2,t.stroke(),t.beginPath(),t.roundRect(o.x+3,o.y+3,o.width-6,mt/2-4,5),t.fillStyle=b?"rgba(255, 255, 255, 0.3)":"rgba(255, 255, 255, 0.1)",t.fill(),t.font=b?"bold 18px Arial":"bold 24px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="rgba(0, 0, 0, 0.4)",t.fillText(o.label,p+1,g+1),t.fillStyle="#ffffff",t.fillText(o.label,p,g)}else{t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=8,t.shadowOffsetX=2,t.shadowOffsetY=3,t.beginPath(),t.roundRect(o.x,o.y,o.width,mt,8);const y=t.createLinearGradient(o.x,o.y,o.x,o.y+mt);a?(y.addColorStop(0,r?"#3a5a7a":"#2a4a6a"),y.addColorStop(.5,r?"#2a4a6a":"#1e3a5a"),y.addColorStop(1,r?"#1a3a5a":"#152a45")):(y.addColorStop(0,"#2a2a2a"),y.addColorStop(1,"#1a1a1a")),t.fillStyle=y,t.fill(),t.restore(),t.strokeStyle=a?r?"#d4af37":"#8b7355":"#3a3a3a",t.lineWidth=2,t.stroke(),t.beginPath(),t.roundRect(o.x+2,o.y+2,o.width-4,mt-4,6),t.strokeStyle="rgba(0, 0, 0, 0.3)",t.lineWidth=2,t.stroke(),a&&(t.beginPath(),t.roundRect(o.x+3,o.y+3,o.width-6,mt/2-4,5),t.fillStyle="rgba(255, 255, 255, 0.1)",t.fill()),t.font="bold 38px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="rgba(0, 0, 0, 0.4)",t.fillText(o.label,p+1,g+1),t.fillStyle=a?"#ffffff":"#5a5a5a",t.fillText(o.label,p,g)}}),!this.isSpinning&&this.state.placements.length>0&&!this.pulseAnimationRunning){this.pulseAnimationRunning=!0;const o=()=>{this.state.placements.length>0&&!this.isSpinning?(this.drawRouletteCanvas(),requestAnimationFrame(o)):this.pulseAnimationRunning=!1};requestAnimationFrame(o)}}collectWheelSlice(t,e){const l=[];if(!Array.isArray(this.wheelOrder)||!this.wheelOrder.length||e<=0)return l;for(let d=0;d<e;d+=1){const i=(t+d)%this.wheelOrder.length,u=this.wheelOrder[i];typeof u<"u"&&l.push(String(u))}return l}getNumberColorClass(t){return t==="0"||t==="00"?"green":this.redNumbers.includes(String(t))?"red":"black"}render(){this.shadowRoot.innerHTML=this.template}cacheElements(){this.board=this.shadowRoot.getElementById("rouletteBoard"),this.summaryContainer=this.shadowRoot.getElementById("betSummary"),this.chipTotals=this.shadowRoot.getElementById("chipTotals"),this.chipNotice=this.shadowRoot.getElementById("chipNotice"),this.layout=this.shadowRoot.querySelector(".layout"),this.toastContainer=this.shadowRoot.getElementById("toastContainer"),this.wheelCanvas=this.shadowRoot.getElementById("wheelCanvas"),this.wheelCanvasCtx=this.wheelCanvas?.getContext("2d")||null,this.wheelElement=this.wheelCanvas,this.rouletteCanvas=this.shadowRoot.getElementById("roulette"),this.rouletteCtx=this.rouletteCanvas?.getContext("2d")||null,this.rouletteHoveredZone=null,this.hoveredBoardCell=null,this.historyDialog=this.shadowRoot.getElementById("historyDialog"),this.historyList=this.shadowRoot.getElementById("historyList"),this.historyPagination=this.shadowRoot.getElementById("historyPagination"),this.historyButton=this.shadowRoot.getElementById("historyBtn"),this.historyClose=this.shadowRoot.getElementById("historyClose"),this.logsButton=this.shadowRoot.getElementById("logsBtn"),this.logsDialog=this.shadowRoot.getElementById("logsDialog"),this.logsClose=this.shadowRoot.getElementById("logsClose"),this.logsList=this.shadowRoot.getElementById("logsList"),this.loadingDialog=this.shadowRoot.getElementById("loadingDialogAiState"),this.observeTheme(),this.initGeometryObservers(),this.refreshBetSpotElements(),this.renderCanvasWheel(),this.initRouletteCanvas()}refreshBetSpotElements(){this.betSpotElements.clear(),this.shadowRoot.querySelectorAll(".bet-spot").forEach(t=>{this.betSpotElements.set(t.dataset.betKey,t)})}getNumberButtonMap(){const t=new Map;return this.shadowRoot.querySelectorAll('[data-number-cell="true"]').forEach(e=>{e?.dataset?.number&&t.set(e.dataset.number,e)}),t}bindEvents(){this.board.addEventListener("click",t=>this.handleBoardClick(t)),this.historyButton&&this.historyButton.addEventListener("click",()=>this.openHistoryDialog()),this.historyClose&&this.historyClose.addEventListener("click",()=>this.closeHistoryDialog()),this.logsButton&&this.logsButton.addEventListener("click",()=>this.openLogsDialog()),this.logsClose&&this.logsClose.addEventListener("click",()=>this.closeLogsDialog()),this.historyDialog&&(this.historyDialog.addEventListener("cancel",t=>{t.preventDefault(),this.closeHistoryDialog()}),this.attachDialogBackdropClose(this.historyDialog,()=>this.closeHistoryDialog())),this.logsDialog&&(this.logsDialog.addEventListener("cancel",t=>{t.preventDefault(),this.closeLogsDialog()}),this.attachDialogBackdropClose(this.logsDialog,()=>this.closeLogsDialog())),this.historyPagination&&this.historyPagination.addEventListener("click",t=>this.handleHistoryPagination(t))}handleBoardClick(t){if(this.isSpinning)return;const e=t.target.closest(".bet-spot");if(!e)return;if(this.removeMode){this.removeLastChipFromSpot(e.dataset.betKey);return}const l={type:e.dataset.type,value:e.dataset.value||null,targets:e.dataset.targets?JSON.parse(e.dataset.targets):[],label:e.dataset.label||"",key:e.dataset.betKey,tokens:1,multiplier:this.currentChipValue};if(this.state.placements.filter(i=>i.key===l.key).length>=this.maxTokens){this.pushLog(`Maximum ${this.maxTokens} chips allowed on ${l.label}.`);return}this.undoStack.push({placements:JSON.parse(JSON.stringify(this.state.placements)),activeMultiplier:this.activeMultiplier,betMultiplier:this.betMultiplier}),this.redoStack=[],this.state.placements.push(l),this.dismissToastByReason("chips-required"),this.updateSummary(),this.updateBoardStacks(),this.drawRouletteCanvas()}removeLastChipFromSpot(t){const e=t.replace("straight-","");let l=-1,d=null;for(let i=this.state.placements.length-1;i>=0;i--){const u=this.state.placements[i];if(u.key===t||u.targets&&u.targets.includes(e)){l=i,d=u;break}}if(l!==-1&&d){this.undoStack.push({placements:JSON.parse(JSON.stringify(this.state.placements)),activeMultiplier:this.activeMultiplier,betMultiplier:this.betMultiplier}),this.redoStack=[];const i=d.type;if((i==="sector"||i==="range"||i==="parity"||i==="color"||i==="dozen"||i==="column")&&d.targets&&d.targets.length>1){const S=d.targets.filter(n=>n!==e),s=d.multiplier;this.state.placements.splice(l,1),S.forEach(n=>{this.state.placements.push({type:"straight",value:n,targets:[n],label:n,key:`straight-${n}`,tokens:1,multiplier:s})})}else this.state.placements.splice(l,1);this.updateSummary(),this.updateBoardStacks(),this.drawRouletteCanvas()}}openHistoryDialog(){this.historyDialog&&(this.historyDialog.showModal(),this.lockPageScroll(),this.historyList&&(this.historyList.innerHTML='<div class="history-loading"><div class="ripple"><div></div><div></div></div></div>'),this.fetchHistory(1))}closeHistoryDialog(){this.historyDialog?.open&&this.historyDialog.close(),this.unlockPageScroll()}openLogsDialog(){this.logsDialog&&(this.logsDialog.showModal(),this.lockPageScroll())}closeLogsDialog(){this.logsDialog?.open&&this.logsDialog.close(),this.unlockPageScroll()}handleHistoryPagination(t){const e=t.target.closest("button[data-page]");if(!e||e.disabled)return;const l=parseInt(e.dataset.page,10);l>0&&this.fetchHistory(l)}async fetchHistory(t=1){if(!this.history?.busy){this.history.busy=!0;try{this.scrollWheelIntoView();const e=await this.getRequest(this.endpoints.history,{page:t});this.renderHistory(e.data)}catch(e){this.pushLog(e)}finally{this.history.busy=!1}}}renderHistory(t){if(!this.historyList)return;const e=t?.history||[];e.length?this.historyList.innerHTML=`
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
						${e.map(l=>this.renderHistoryRowMarkup(l)).join("")}
					</tbody>
				</table>
			`:this.historyList.innerHTML='<p class="empty">No history logged yet.</p>',this.renderHistoryPagination(t.page||1,t.total_pages||1)}parseHistoryPayload(t){let e={bets:[],meta:{}};try{this.scrollWheelIntoView();const l=JSON.parse(t.bets_json||"{}");e.bets=l?.bets||[],e.meta=l?.meta||{}}catch{}return e}renderHistoryRowMarkup(t){const e=t.event_type||"game",l=this.parseHistoryPayload(t),d=new Date(t.created_at);if(e==="credit"){const u=Number(l.meta.amount??t.payout??0);return`<tr class="history-row history-row-credit">
				<td>Credit</td>
				<td>Credits added</td>
				<td>--</td>
				<td>${this.formatCurrency(u)}</td>
				<td>${d.toLocaleString()}</td>
			</tr>`}const i=l.bets.slice(0,2).map(u=>u.label||u.targets?.join("/")||u.value||u.type).join(", ");return`<tr class="history-row history-row-game">
			<td>Game</td>
			<td>#${t.result_number} <small>${i||""}</small></td>
			<td>${this.formatCurrency(t.total_stake||0)}</td>
			<td>${this.formatCurrency(t.payout||0)}</td>
			<td>${d.toLocaleString()}</td>
		</tr>`}renderHistoryPagination(t,e){if(!this.historyPagination)return;const l=Math.max(1,t-1),d=Math.min(e,t+1);this.historyPagination.innerHTML=`
			<button type="button" data-page="${l}" ${t<=1?"disabled":""}>Prev</button>
			<span>Page ${t} / ${e}</span>
			<button type="button" data-page="${d}" ${t>=e?"disabled":""}>Next</button>
		`}async handleSpin(){if(this.isSpinning)return;if(!this.state.placements.length){this.showToast("You need to add at least one chip to board if you want to play.",{reason:"chips-required"}),this.pushLog("Place at least one chip on the board.");return}this.lastBet=JSON.parse(JSON.stringify(this.state.placements)),this.undoStack=[],this.redoStack=[];const t=this.getTotalStake();if(t>this.state.credits){this.showToast(`Not enough credits. Stake ${this.formatCurrency(t)} exceeds your ${this.formatCurrency(this.state.credits)} balance.`);return}const e={bets:this.state.placements,bet_multiplier:this.betMultiplier||1};this.setSpinning(!0),this.winningDisplayState="spinning",this.drawRouletteCanvas();try{this.scrollWheelIntoView();const l=await this.postRequest(this.endpoints.spin,e),{number:d,color:i,parity:u,winnings:S,credits:s}=l.data;await this.animateWheel(d),this.lastWinningNumber=d,this.lastWonCredits=S,this.winningDisplayState="result",this.winningHistory.unshift(d),this.winningHistory.length>30&&this.winningHistory.pop(),this.drawRouletteCanvas(),this.state.credits=s,this.updateCredits(),this.pushLog(`Result ${d} (${i}), winnings ${this.formatCurrency(S)}`),this.clearPlacements()}catch(l){this.pushLog(l),this.showToast(l?.message||"Spin failed. Please try again.")}finally{this.setSpinning(!1)}}scrollWheelIntoView(){this.wheelElement&&this.wheelElement.scrollIntoView({behavior:"smooth",block:"center"})}openLoadingDialog(){this.loadingDialog&&(this.loadingDialog.classList.add("visible"),this.loadingDialog.setAttribute("aria-hidden","false"))}closeLoadingDialog(){this.loadingDialog&&(this.loadingDialog.classList.remove("visible"),this.loadingDialog.setAttribute("aria-hidden","true"))}lockPageScroll(){!document||!document.body||(this.bodyOverflowBackup||(this.bodyOverflowBackup=document.body.style.overflow||""),document.body.style.overflow="hidden")}unlockPageScroll(){!document||!document.body||(this.bodyOverflowBackup!==void 0?(document.body.style.overflow=this.bodyOverflowBackup,this.bodyOverflowBackup=void 0):document.body.style.overflow="")}recalculateBoardGeometry(t=!1){this.updateBoardStacks()}initGeometryObservers(){}observeTheme(){const t=()=>{!!document.head.querySelector("link#theme-style")?this.layout?.classList.add("dark"):this.layout?.classList.remove("dark")};t(),this.themeObserver||(this.themeObserver=new MutationObserver(t),this.themeObserver.observe(document.head,{childList:!0,subtree:!0}))}attachDialogBackdropClose(t,e){!t||typeof e!="function"||t.addEventListener("click",l=>{l.target===t&&e()})}setSpinning(t){this.isSpinning=t,t?this.swapDisabledState(!0):this.swapDisabledState(!1)}swapDisabledState(t){t?this.board.classList.add("disabled"):this.board.classList.remove("disabled"),this.drawRouletteCanvas()}updateCredits(){this.maybeShowNoCreditsToast(),this.drawRouletteCanvas()}updateChipSelector(){this.drawRouletteCanvas()}updateSummary(){const t={};this.state.placements.forEach(l=>{t[l.key]||(t[l.key]={label:l.label,type:l.type,value:l.value,targets:l.targets,sectorSize:l.sectorSize||(l.targets?l.targets.length:0),sectorKey:l.sectorKey||null,chips:0,amount:0,totalValue:0,lastMultiplier:l.multiplier,breakdown:{}});const d=t[l.key];d.chips+=l.tokens;const u=l.type==="sector"&&l.sectorSize||1;d.amount+=l.tokens*l.multiplier*u,d.totalValue+=l.tokens*l.multiplier*u,d.lastMultiplier=l.multiplier,d.type=l.type||d.type,d.value=l.value??d.value,d.targets=l.targets||d.targets,l.sectorSize&&(d.sectorSize=l.sectorSize,d.sectorKey=l.sectorKey||d.sectorKey),d.breakdown[l.multiplier]=(d.breakdown[l.multiplier]||0)+l.tokens}),this.summary=t;const e=Object.entries(t);e.length?(this.summaryContainer.innerHTML=e.map(([l,d])=>`
				<div class="summary-row">
					<div class="summary-label-block">
						${this.renderSummaryLabel(d)}
						${this.renderChipBreakdown(d)}
					</div>
					<div class="summary-value-block">
						<span class="summary-total-credits">${Math.round(d.totalValue)} credits</span>
						<button type="button" data-key="${l}" aria-label="Remove bet">✕</button>
					</div>
				</div>
			`).join(""),this.summaryContainer.querySelectorAll("button[data-key]").forEach(l=>{l.addEventListener("click",()=>this.removePlacement(l.dataset.key))}),this.updateChipTotals(e)):(this.summaryContainer.innerHTML='<div class="empty">No chips placed.</div>',this.chipTotals&&(this.chipTotals.textContent="No chip totals yet.")),this.updateChipNotice(),this.updateBoardStacks()}updateChipTotals(t){if(!this.chipTotals)return;if(!t.length){this.chipTotals.textContent="No chip totals yet.";return}const e={};t.forEach(([S,s])=>{const n=s.breakdown||{},f=S.startsWith("sector-")&&s.sectorSize?s.sectorSize:1;Object.entries(n).forEach(([I,M])=>{const dt=M*f;e[I]=(e[I]||0)+dt})});const d=t.reduce((S,[,s])=>S+s.totalValue,0)*(this.betMultiplier||1),i=this.betMultiplier>1?` (${this.activeMultiplier})`:"",u=Object.entries(e).sort((S,s)=>parseInt(S[0],10)-parseInt(s[0],10)).map(([S,s])=>{const n=this.getChipColor(S);return`<tr>
					<td>${s} ${s===1?"chip":"chips"}</td>
					<td class="chip-table-cell">
						<span class="chip-table-face chip-face" data-chip="${S}" style="--chip-color:${n}">
							<span>${S}x</span>
						</span>
					</td>
				</tr>`}).join("");this.chipTotals.innerHTML=`
			<table>
				<thead><tr><th>Quantity</th><th>Multiplier</th></tr></thead>
				<tbody>${u}</tbody>
				<tfoot><tr><td>Total stake${i}:</td><td id="totalStakeValue">${Math.round(d)}</td></tr></tfoot>
			</table>
		`}renderSummaryLabel(t={}){if(t?.type==="sector"){const u=t?.sectorSize||t?.targets?.length||0,s=(t?.targets||[]).map(n=>{let c="black";return n==="0"||n==="00"?c="green":this.redNumbers.includes(String(n))&&(c="red"),`<span class="summary-token ${c}">${n}</span>`}).join("");return`<span class="summary-sector">${this.escapeHtml(t.label||"Sector")}<small>${u} numbers</small></span><div class="summary-number-group">${s}</div>`}const e=String(t?.label??"").trim();if(!e)return'<span class="summary-label-text">Bet</span>';const l=e.split("/").map(u=>u.trim()).filter(Boolean),d=/^(0|00|[1-9]\d?)$/;if(l.length>0&&l.every(u=>d.test(u))){const u=l.map(S=>{let s="black";return S==="0"||S==="00"?s="green":this.redNumbers.includes(S)&&(s="red"),`<span class="summary-token ${s}">${S}</span>`}).join("");return l.length>1?`<div class="summary-number-group">${u}</div>`:u}return`<span class="summary-label-text">${this.escapeHtml(e||"Bet")}</span>`}renderChipBreakdown(t){const e=t?.breakdown||{},l=Object.entries(e),d=Math.round(t?.totalValue||0);return l.length?`<div class="summary-chip-group">
			${l.sort((u,S)=>parseInt(u[0],10)-parseInt(S[0],10)).map(([u,S])=>{const s=this.getChipColor(u);return`<span class="chip-pill" aria-label="${S} chips at ${u}x">
					<span class="chip-pill-count">${S}×</span>
					<span class="chip-pill-value chip-face" data-chip="${u}" style="--chip-color:${s}">
						<span>${u}x</span>
					</span>
				</span>`}).join("")}
			<span class="summary-chip-total">${d} credits</span>
		</div>`:`<div class="summary-chip-group"><span class="summary-chip-total">${d} credits</span></div>`}getChipColor(t){const e={1:"#f59e0b",2:"#f97316",5:"#dc2626",10:"#16a34a",20:"#2563eb",30:"#7c3aed",50:"#0891b2",100:"#1f2937",200:"#1d4ed8",500:"#7e22ce"};return e[t]||e[String(t)]||"#475569"}updateChipNotice(){this.chipNotice.textContent=`Total chips: ${this.state.placements.length} (max ${this.maxTokens} per field)`}getTotalStake(){return this.state.placements.reduce((e,l)=>e+l.tokens*l.multiplier,0)*(this.betMultiplier||1)}maybeShowNoCreditsToast(){Number(this.state?.credits||0)<=0?this.noCreditReminderShown||(this.showToast("Please add credits to play."),this.noCreditReminderShown=!0):this.noCreditReminderShown=!1}showToast(t="Not enough credits for this bet.",e={}){const l=this.toastContainer??this.createToastContainer(),d=document.createElement("div");d.className="toast-message",d.textContent=t,e.reason&&(d.dataset.reason=e.reason),l.appendChild(d);const i=()=>{d.classList.add("exit");const u=S=>{S.animationName==="toastOut"&&(d.removeEventListener("animationend",u),d.remove())};d.addEventListener("animationend",u)};return e.persist?d.removeTimeout=setTimeout(i,e.persist):d.removeTimeout=setTimeout(i,6e3),d.dismiss=i,d}dismissToastByReason(t){!this.toastContainer||!t||this.toastContainer.querySelectorAll(`.toast-message[data-reason="${t}"]`).forEach(e=>{e.removeTimeout&&clearTimeout(e.removeTimeout),typeof e.dismiss=="function"?e.dismiss():(e.classList.add("exit"),setTimeout(()=>e.remove(),300))})}createToastContainer(){const t=document.createElement("div");return t.className="toast-container",this.shadowRoot.appendChild(t),this.toastContainer=t,t}updateBoardStacks(){const t=JSON.parse(JSON.stringify(this.summary||{}));this.pendingStacks=t,this.boardStackRaf&&cancelAnimationFrame(this.boardStackRaf),this.boardStackRaf=requestAnimationFrame(()=>{this.boardStackRaf=null,this.applyBoardStacks(t)})}applyBoardStacks(t=null){const e=t||this.pendingStacks||this.summary||{},l=new Map;this.state.placements.forEach(d=>{const i=d.targets||[],u=d.multiplier;if(d.type==="sector"&&i.length>0){const n=u;i.forEach(c=>{const f=`straight-${c}`;l.has(f)||l.set(f,{totalValue:0,lastMultiplier:u,chips:0});const I=l.get(f);I.totalValue+=n,I.lastMultiplier=u,I.chips+=1})}}),this.betSpotElements.forEach((d,i)=>{const u=d.querySelector(".chip-stack");if(!u)return;const S=e[i],s=l.get(i);i.startsWith("column-")||i.startsWith("dozen-")||i.startsWith("range-")||i.startsWith("parity-")||i.startsWith("color-");let n=0,c=0,f=1;if(s?(n=s.chips,c=s.totalValue,f=s.lastMultiplier):S&&(n=S.chips,c=S.totalValue,f=S.lastMultiplier),n>0){const I=`<span class="chip-token" data-chip="${f}" title="${n} chip(s)">${Math.round(c)}</span>`;u.innerHTML=I,u.hidden=!1}else u.innerHTML="",u.hidden=!0}),this.pendingStacks=null,this.drawRouletteCanvas()}removePlacement(t){this.state.placements=this.state.placements.filter(e=>e.key!==t),this.updateSummary()}clearPlacements(){this.state.placements=[],this.updateSummary()}updateLogs(){if(this.logsList){if(!this.state.logs.length){this.logsList.innerHTML='<p class="empty">No spins yet.</p>';return}this.logsList.innerHTML=`
			<table>
				<thead>
					<tr>
						<th>#</th>
						<th>Message</th>
						<th>Time</th>
					</tr>
				</thead>
				<tbody>
					${this.state.logs.map((t,e)=>{const l=new Date(t.timestamp||Date.now());return`<tr>
							<td>${e+1}</td>
							<td>${this.escapeHtml(t.message)}</td>
							<td>${l.toLocaleString()}</td>
						</tr>`}).join("")}
				</tbody>
			</table>
		`}}pushLog(t){const e=this.normalizeLogMessage(t);this.state.logs.unshift({message:e,timestamp:Date.now()}),this.state.logs=this.state.logs.slice(0,20),this.updateLogs()}normalizeLogMessage(t){if(typeof t=="string")return t;if(t instanceof Error&&t.message)return t.message;if(t&&typeof t=="object"&&t.message)return String(t.message);if(t&&typeof t=="object")try{return this.scrollWheelIntoView(),JSON.stringify(t)}catch{return String(t)}return String(t??"")}escapeHtml(t){return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}async animateWheel(t){if(!this.wheelCanvas||!this.wheelCanvasCtx)return;const e=String(t),l=this.wheelOrder.indexOf(e);if(l===-1)return;this.clearBall(),this.ballLanded=!1;const d=this.wheelCanvas,i=d.clientWidth||600,u=d.clientHeight||600,S=i/2,s=u/2,n=Math.min(S,s)-4;if(n<50)return;const c=n/300,f=n*.96,dt=f*.85*.84*.98,B=f*.98,P=dt*.96,_=this.wheelOrder.length,Bt=Math.PI*2/_,It=Math.random()*Math.PI*2,St=(this.wheelRotation||0)+It,yt=3e3,Ot=5e3,Tt=1e4,rt=Math.PI*1.9,et=.09,st=Math.PI*3.5,N=.95,Ct=performance.now();let F=null,nt=null,Q=!1,kt=!1,H=0,ht=st,V=B;const Wt=($t,ft)=>{let at=$t-ft+Math.PI/2+3.75*Math.PI/180;return at=(at%(Math.PI*2)+Math.PI*2)%(Math.PI*2),Math.floor(at/Bt)%_};return this.wheelAnimating=!0,new Promise($t=>{const ft=at=>{if(kt)return;const vt=at-Ct,At=vt/1e3,Jt=rt*Math.exp(-et*At),Pt=St+rt/et*(1-Math.exp(-et*At));if(this.wheelRotation=Pt,vt>=yt&&!this.ballLanded){F===null&&(F=at,H=Math.random()*Math.PI*2,ht=st,this.ballVisible=!0);const wt=(at-F)/1e3;ht=st*Math.exp(-.33*wt),H-=ht*.04;const K=ht/st;if(K<.4){const v=(.4-K)/.4;V=B-(B-P)*(v*v)}ht<N&&V<=P+10*c&&Wt(H,Pt)===l&&(this.ballLanded=!0,nt=at,V=P,this.ballAngleOffset=H-Pt),this.ballAngle=H,this.ballRadiusRatio=V/n}if(this.ballLanded&&nt){const wt=at-nt;this.ballAngle=this.wheelRotation+this.ballAngleOffset;const K=800,v=25*c;let w=0;if(wt<K){const gt=wt/K;if(gt<.4)w=gt/.4*v;else if(gt<.55){const T=(gt-.4)/.15;w=v-5*c*Math.sin(T*Math.PI)}else if(gt<.7)w=v;else if(gt<.85){const T=(gt-.7)/.15;w=v-3*c*Math.sin(T*Math.PI)}else w=v}else w=v;if(this.ballRadiusRatio=(P-w)/n,wt>=Ot&&!Q&&(Q=!0,$t()),wt>=Tt){this.pocketAnimStartTime===null&&(this.ballStartRadiusForAnim=this.ballRadiusRatio*n,this.pocketAnimStartTime=at,this.pocketAnimActive=!0,this.highlightedPocket=l);const gt=at-this.pocketAnimStartTime,T=400,k=1500,q=400,C=T,z=T+k,Y=T+k+q;if(gt<=T){const x=Math.min(gt/T,1);this.pocketOpenProgress=1-Math.pow(1-x,2),this.ballRadiusRatio=this.ballStartRadiusForAnim/n,this.ballScale=1,this.ballOpacity=1}else if(gt<=z){this.pocketOpenProgress=1;const x=Math.min((gt-C)/k,1),tt=x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2,U=this.ballStartRadiusForAnim,G=P*.1;this.ballRadiusRatio=(U-(U-G)*tt)/n,this.ballScale=1-tt*.7,this.ballOpacity=1-tt*.9,x>=.99&&(this.ballVisible=!1)}else if(gt<=Y){this.ballVisible=!1;const x=Math.min((gt-z)/q,1),tt=1-Math.pow(1-x,2);this.pocketOpenProgress=1-tt}else this.pocketAnimActive&&(this.pocketOpenProgress=0,this.highlightedPocket=-1,this.pocketAnimActive=!1,this.ballScale=1,this.ballOpacity=1);!this.ballVisible&&!this.wheelSlowdownStart&&(this.wheelSlowdownStart=at,this.wheelSpeedAtBallGone=Jt,this.wheelAngleAtBallGone=Pt)}}if(this.wheelSlowdownStart){const wt=(at-this.wheelSlowdownStart)/1e3,K=2,v=this.wheelSpeedAtBallGone*Math.exp(-K*wt),w=this.wheelSpeedAtBallGone/K*(1-Math.exp(-K*wt));if(this.wheelRotation=this.wheelAngleAtBallGone+w,v<.01){this.wheelSlowdownStart=null,kt=!0,this.wheelAnimating=!1,this.renderCanvasWheel(),$t();return}}this.renderCanvasWheel(),requestAnimationFrame(ft)};requestAnimationFrame(ft)})}formatCurrency(t){return`${Number(t).toFixed(2)} credits`}async postRequest(t,e={}){const l={"Content-Type":"application/json"};this.csrfToken&&(l["X-CSRF-TOKEN"]=this.csrfToken);const i=await(await fetch(t,{method:"POST",headers:l,body:JSON.stringify(e)})).json();if(!i.success){const u=i?.message||i?.data?.message||"Something went wrong.";throw new Error(u)}return i}async getRequest(t,e={}){const l=new URLSearchParams(e).toString(),d=l?`${t}?${l}`:t,i={};this.csrfToken&&(i["X-CSRF-TOKEN"]=this.csrfToken);const S=await(await fetch(d,{method:"GET",headers:i})).json();if(!S.success){const s=S?.message||S?.data?.message||"Something went wrong.";throw new Error(s)}return S}initWebSocket(){const t=window.location.protocol==="https:"?"wss:":"ws:";this.wsToken=localStorage.getItem("jwt_token")||sessionStorage.getItem("jwt_token")||window.JWT_TOKEN||"";const e=`${t}//${window.location.host}/ws`;console.log("[ROULETTE] Connecting to WebSocket:",e),this.ws=new WebSocket(e),this.ws.onopen=()=>{console.log("[ROULETTE] WebSocket connected, authenticating..."),this.wsState.connected=!0,this.wsReconnectAttempts=0,this.wsSend({type:"system.authenticate",token:this.wsToken})},this.ws.onmessage=l=>{try{const d=JSON.parse(l.data);this.handleWsMessage(d)}catch(d){console.error("[ROULETTE] Failed to parse WebSocket message:",d)}},this.ws.onclose=()=>{console.log("[ROULETTE] WebSocket disconnected"),this.wsState.connected=!1,this.attemptWsReconnect()},this.ws.onerror=l=>{console.error("[ROULETTE] WebSocket error:",l)}}attemptWsReconnect(){if(this.wsReconnectAttempts<this.maxWsReconnectAttempts){this.wsReconnectAttempts++;const t=Math.min(1e3*Math.pow(2,this.wsReconnectAttempts),3e4);console.log(`[ROULETTE] Reconnecting in ${t}ms (attempt ${this.wsReconnectAttempts})`),setTimeout(()=>this.initWebSocket(),t)}else this.showToast("Connection lost. Please refresh the page.")}wsSend(t){this.ws&&this.ws.readyState===WebSocket.OPEN&&this.ws.send(JSON.stringify(t))}handleWsMessage(t){const e=t.type||t.event_type;switch(console.log("[ROULETTE] Received:",e,t),e){case"system.welcome":console.log("[ROULETTE] Welcome received, connection_id:",t.connection_id);break;case"system.authenticated":console.log("[ROULETTE] Authenticated as:",t.username),this.wsState.authenticated=!0,this.wsSend({type:"roulette.join"});break;case"system.error":console.error("[ROULETTE] System error:",t.message),t.code==="not_authenticated"&&this.showToast("Please log in to play roulette");break;case"roulette.event.tick":case"roulette.tick":this.handleTick(t);break;case"roulette.event.state":case"roulette.state":this.handleStateUpdate(t);break;case"roulette.event.spin_result":case"roulette.spin_result":this.handleSpinResult(t);break;case"roulette.event.payout":case"roulette.payout":this.handlePayout(t);break;case"roulette.event.bet_confirmed":case"roulette.bet_confirmed":this.handleBetConfirmed(t);break;case"roulette.bet_rejected":this.handleBetRejected(t);break;case"roulette.event.error":case"roulette.error":this.showToast(t.message||"An error occurred");break}}handleTick(t){const e=this.wsState.spinId&&this.wsState.spinId!==t.spin_id;e&&(this.wsState.blockBets=!1,this.wsState.phase="betting",this.betsBroadcasted=!1,this.swapDisabledState(!1),this.pushLog("New round started! Place your bets."),console.log("[ROULETTE] New spin cycle started:",t.spin_id)),this.wsState.secondsRemaining=t.seconds_remaining,this.wsState.spinId=t.spin_id,e||(this.wsState.phase=t.phase||"betting"),t.block_bets&&!this.wsState.blockBets&&(this.wsState.blockBets=!0,this.wsState.phase="blocked",this.broadcastBets(),this.swapDisabledState(!0),this.pushLog("Bets closed! Waiting for spin...")),!t.block_bets&&this.wsState.blockBets&&(this.wsState.blockBets=!1,this.wsState.phase="betting",this.betsBroadcasted=!1,this.swapDisabledState(!1),this.pushLog("Betting open! Place your bets.")),this.updateCountdownDisplay(),this.drawRouletteCanvas()}handleStateUpdate(t){this.wsState.secondsRemaining=t.seconds_remaining,this.wsState.spinId=t.spin_id,this.wsState.blockBets=t.block_bets,this.wsState.phase=t.phase||"betting",t.balance!==void 0&&(this.state.credits=Math.floor(t.balance/100),this.updateCredits()),t.history&&Array.isArray(t.history)&&(this.winningHistory=t.history.map(e=>String(e.winning_number))),!t.block_bets&&t.phase==="betting"?(this.swapDisabledState(!1),this.betsBroadcasted=!1):this.swapDisabledState(!0),this.updateCountdownDisplay(),this.drawRouletteCanvas()}handleSpinResult(t){const{winning_number:e,winning_color:l,spin_id:d}=t;this.wsState.phase="spinning",this.scrollWheelIntoView(),this.setSpinning(!0),this.winningDisplayState="spinning",this.drawRouletteCanvas(),this.animateWheel(e).then(()=>{this.lastWinningNumber=e,this.winningDisplayState="result",this.winningHistory.unshift(String(e)),this.winningHistory.length>30&&this.winningHistory.pop(),this.setSpinning(!1),this.wsState.phase="betting",this.clearPlacements(),this.wsState.blockBets=!1,this.betsBroadcasted=!1,this.swapDisabledState(!1),this.drawRouletteCanvas()})}handlePayout(t){const{payout_amount:e,new_balance:l}=t;this.state.credits=Math.floor(l/100),this.updateCredits();const d=Math.floor(e/100);this.lastWonCredits=d,d>0&&(this.pushLog(`You won ${d} coins!`),this.showToast(`You won ${d} coins!`))}handleBetConfirmed(t){this.pushLog("Bets confirmed!"),t.new_balance!==void 0&&(this.state.credits=Math.floor(t.new_balance/100),this.updateCredits())}handleBetRejected(t){this.showToast(`Bet rejected: ${t.reason||"Unknown error"}`),this.pushLog(`Bet rejected: ${t.reason||"Unknown error"}`)}broadcastBets(){if(this.betsBroadcasted)return;if(!this.state.placements.length){console.log("[ROULETTE] No bets to broadcast");return}const t=this.state.placements.map(e=>({bet_type:e.type||"straight",numbers:e.numbers||[e.number],amount:e.amount*100}));this.wsSend({type:"roulette.broadcast_bets",spin_id:this.wsState.spinId,bets:t}),this.betsBroadcasted=!0,this.pushLog(`Bets placed: ${this.state.placements.length} bet(s)`)}updateCountdownDisplay(){}getCountdownColor(){const t=this.wsState.secondsRemaining;return t<=5?"#ef4444":t<=15?"#f59e0b":"#22c55e"}getCountdownText(){const t=this.wsState.secondsRemaining;return this.wsState.blockBets?"NO MORE BETS":t<=0?"SPINNING...":`${t}s`}}customElements.get("mini-roulette")||customElements.define("mini-roulette",Pe),console.log("[ROULETTE] Web component registered")})();
