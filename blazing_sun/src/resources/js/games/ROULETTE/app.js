(function(){"use strict";class Be extends HTMLElement{constructor(){super(),this.attachShadow({mode:"open"}),setTimeout(()=>{const t=["0","28","9","26","30","11","7","20","32","17","5","22","34","15","3","24","36","13","1","00","27","10","25","29","12","8","19","31","18","6","21","33","16","4","23","35","14","2"];this.endpoints={spin:this.dataset.endpointSpin||"/api/v1/roulette/spin",history:this.dataset.endpointHistory||"/api/v1/roulette/history"},this.csrfToken=document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")||"",this.state={credits:parseFloat(this.dataset.credits||"0"),placements:[],logs:[]},this.maxTokens=parseInt(this.dataset.maxTokens||"16",10),this.chipMultipliers=JSON.parse(this.dataset.chipMultipliers||"[1]"),this.currentChipValue=this.chipMultipliers[0]||1,this.isSpinning=!1,this.wheelAnimating=!1,this.betSpotElements=new Map,this.betSpotElements=new Map,this.boardStackRaf=null,this.recalcRaf=null,this.boardGeometry={width:0,height:0},this.pendingStacks=null,this.summary={},this.redNumbers=["1","3","5","7","9","12","14","16","18","19","21","23","25","27","30","32","34","36"],this.numberGrid=[["3","6","9","12","15","18","21","24","27","30","33","36"],["2","5","8","11","14","17","20","23","26","29","32","35"],["1","4","7","10","13","16","19","22","25","28","31","34"]],this.wheelOrder=JSON.parse(this.dataset.wheelOrder||JSON.stringify(t)),this.history={perPage:parseInt(this.dataset.historyPerPage||"16",10),page:1,totalPages:1,busy:!1},this.render(),this.cacheElements(),this.bindEvents(),this.updateCredits(),this.updateSummary(),this.updateChipSelector(),this.updateChipNotice(),this.updateLogs(),this.recalculateBoardGeometry(),this.initGeometryObservers(),this.handleResize=()=>{this.recalculateBoardGeometry(),this.renderCanvasWheel()},window.addEventListener("resize",this.handleResize)},0)}disconnectedCallback(){this.handleResize&&window.removeEventListener("resize",this.handleResize),this.unlockPageScroll(),this.themeObserver&&(this.themeObserver.disconnect(),this.themeObserver=null),this.sizeObserver&&(this.sizeObserver.disconnect(),this.sizeObserver=null),this.boardStackRaf&&(cancelAnimationFrame(this.boardStackRaf),this.boardStackRaf=null)}get template(){return`
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
		`}renderCanvasWheel(){if(!this.wheelCanvasCtx||!this.wheelOrder?.length)return;const t=this.wheelCanvas,e=this.wheelCanvasCtx,l=t.clientWidth||600,d=t.clientHeight||600,s=window.devicePixelRatio||1;t.width=l*s,t.height=d*s,e.scale(s,s);const{width:u,height:C}={width:l,height:d},a=u/2,r=C/2,c=Math.min(a,r)-4;if(c<50)return;const f=c/300,I=c*.96,M=I*.85,dt=M*.84,P=dt*.98,B=P*.75,Pt=B*.99*.6,It=Math.PI*2/this.wheelOrder.length;e.clearRect(0,0,u,C),e.save(),e.translate(a,r),e.rotate(this.wheelRotation||0),e.translate(-a,-r);const Ct=({radius:T,fill:v="#000",stroke:_=null,strokeWidth:w=1,shadowOptions:G=!1})=>{e.save(),G&&(e.shadowColor=G.shadowColor,e.shadowBlur=G.shadowBlur,e.shadowOffsetX=G.shadowOffsetX,e.shadowOffsetY=G.shadowOffsetY),e.beginPath(),e.fillStyle=v,e.arc(a,r,T,0,Math.PI*2),e.fill(),_&&(e.strokeStyle=_,e.lineWidth=w,e.stroke()),e.restore()},St=this.wheelRotation||0,Ot=-Math.PI/4,Tt=Ot-St,rt=e.createConicGradient(Tt,a,r);rt.addColorStop(0,"#ffdb6a"),rt.addColorStop(.1,"#fccb3c"),rt.addColorStop(.25,"#f7a700"),rt.addColorStop(.4,"#d59d00"),rt.addColorStop(.5,"#b8860b"),rt.addColorStop(.6,"#d59d00"),rt.addColorStop(.75,"#e2b700"),rt.addColorStop(.85,"#fccb3c"),rt.addColorStop(1,"#ffdb6a");const et=e.createConicGradient(Tt,a,r);et.addColorStop(0,"#d9b34d"),et.addColorStop(.3,"#b57e2b"),et.addColorStop(.7,"#9a6a2a"),et.addColorStop(1,"#d9b34d");const at=e.createConicGradient(Tt,a,r);at.addColorStop(0,"#ffe082"),at.addColorStop(.2,"#fccb3c"),at.addColorStop(.4,"#f6b400"),at.addColorStop(.5,"#c99a2e"),at.addColorStop(.6,"#f6b400"),at.addColorStop(.8,"#fccb3c"),at.addColorStop(1,"#ffe082");const N=e.createConicGradient(Tt,a,r);N.addColorStop(0,"#ffd54f"),N.addColorStop(.15,"#ffca28"),N.addColorStop(.3,"#ffc107"),N.addColorStop(.5,"#e6a800"),N.addColorStop(.7,"#ffc107"),N.addColorStop(.85,"#ffca28"),N.addColorStop(1,"#ffd54f");const wt=Ot-St,Z=e.createConicGradient(wt,a,r);Z.addColorStop(0,"#8b2520"),Z.addColorStop(.25,"#6f1d1b"),Z.addColorStop(.5,"#4a1210"),Z.addColorStop(.75,"#6f1d1b"),Z.addColorStop(1,"#8b2520"),Ct({radius:c,fill:at}),Ct({radius:I,fill:Z,shadowOptions:{shadowColor:"rgba(0,0,0,0.9)",shadowBlur:6,shadowOffsetX:0,shadowOffsetY:0}}),e.save(),e.beginPath(),e.arc(a,r,M*.96,0,Math.PI*2),e.lineWidth=15*f,e.strokeStyle=rt,e.stroke(),e.restore(),e.save(),e.beginPath(),e.arc(a,r,M*.96,0,Math.PI*2),e.arc(a,r,M*.96-13*f,0,Math.PI*2,!0),e.clip(),e.beginPath(),e.shadowColor="rgba(0, 0, 0, 0.45)",e.shadowBlur=30*f,e.shadowOffsetX=0,e.shadowOffsetY=0,e.arc(a,r,M*1.5,0,Math.PI*2),e.fillStyle="rgba(0,0,0,0)",e.fill(),e.restore(),Ct({radius:dt,fill:Z});for(let T=0;T<8;T+=1){const v=Math.PI/4*T,_=I*.91,w=c*.05,G=w*2.2,A=a+Math.cos(v)*_,x=r+Math.sin(v)*_;e.save(),e.translate(A,x),e.rotate(v);const tt=this.wheelRotation||0,U=-Math.PI/4,z=U+Math.PI-tt-v,X=3*f;e.shadowColor="rgba(0, 0, 0, 0.5)",e.shadowBlur=4*f,e.shadowOffsetX=Math.cos(z)*X,e.shadowOffsetY=Math.sin(z)*X;const bt=U-tt-v,ct=e.createConicGradient(bt+Math.PI/2,0,0);ct.addColorStop(0,"#fff9c4"),ct.addColorStop(.15,"#ffeb3b"),ct.addColorStop(.3,"#ffc107"),ct.addColorStop(.5,"#ff8f00"),ct.addColorStop(.65,"#ffc107"),ct.addColorStop(.8,"#ffeb3b"),ct.addColorStop(1,"#fff9c4"),e.beginPath(),e.moveTo(-w/2,0),e.lineTo(0,-G/2),e.lineTo(w/2,0),e.lineTo(0,G/2),e.closePath(),e.fillStyle=ct,e.fill(),e.shadowColor="transparent",e.beginPath(),e.moveTo(-w/5,0),e.lineTo(0,-G/5),e.lineTo(w/5,0),e.closePath(),e.fillStyle="rgba(255, 255, 255, 0.7)",e.fill(),e.beginPath(),e.moveTo(-w/2,0),e.lineTo(0,-G/2),e.lineTo(w/2,0),e.lineTo(0,G/2),e.closePath(),e.strokeStyle="#b8860b",e.stroke(),e.restore()}const nt=-Math.PI/4,Q=this.wheelRotation||0;this.wheelOrder.forEach((T,v)=>{const _=v*It-Math.PI/2,w=_+It,G=(_+w)/2,A=T==="0"||T==="00",x=this.redNumbers.includes(String(T)),tt=!A&&!x;let z=G+Q-nt;for(;z>Math.PI;)z-=2*Math.PI;for(;z<-Math.PI;)z+=2*Math.PI;const X=(Math.cos(z)+1)/2;if(e.beginPath(),this.highlightedPocket===v&&this.pocketAnimActive&&this.pocketOpenProgress!==void 0){const bt=this.pocketOpenProgress,ct=B-10*f,xt=P+25*f,H=e.createRadialGradient(a,r,ct,a,r,xt),W=bt,E=Math.floor(10+X*15),F=Math.floor(8+X*8),L=Math.floor(3+X*5);if(tt){const O=.12+W*.18,R=Math.floor(55+W*35);H.addColorStop(0,`rgb(${R}, ${R}, ${R})`),H.addColorStop(O*.3,`rgb(${R-15}, ${R-15}, ${R-15})`),H.addColorStop(O*.6,`rgb(${R-30}, ${R-30}, ${R-30})`),H.addColorStop(O,`rgb(${Math.floor(15+W*10)}, ${Math.floor(15+W*10)}, ${Math.floor(15+W*10)})`),H.addColorStop(Math.min(O+.15,.5),`rgb(${E}, ${E}, ${E})`),H.addColorStop(Math.min(O+.3,.7),`rgb(${F}, ${F}, ${F})`),H.addColorStop(1,`rgb(${L}, ${L}, ${L})`)}else if(A){const O=.15+W*.15,R=Math.floor(5+W*10),st=Math.floor(70+X*20);H.addColorStop(0,`rgb(${R-3}, ${R}, ${R-3})`),H.addColorStop(O*.5,"#050a05"),H.addColorStop(O,"#0a150a"),H.addColorStop(Math.min(O+.12,.5),"rgb(26, 69, 32)"),H.addColorStop(Math.min(O+.25,.7),"rgb(38, 112, 53)"),H.addColorStop(1,`rgb(${Math.floor(20+X*10)}, ${st}, ${Math.floor(30+X*10)})`)}else{const O=.1+W*.15,R=Math.floor(15+W*25),st=Math.floor(100+X*30);H.addColorStop(0,`rgb(${R+10}, ${R-5}, ${R-5})`),H.addColorStop(O*.3,`rgb(${R}, ${R-10}, ${R-10})`),H.addColorStop(O*.6,"#1a0808"),H.addColorStop(O,"#280c0c"),H.addColorStop(Math.min(O+.1,.45),"rgb(96, 24, 24)"),H.addColorStop(Math.min(O+.2,.6),"rgb(176, 16, 16)"),H.addColorStop(1,`rgb(${st}, ${Math.floor(5+X*10)}, ${Math.floor(5+X*10)})`)}e.fillStyle=H}else{const bt=(B-10*f+P+25*f)/2,ct=nt-Q,xt=a+Math.cos(ct)*bt*.8,H=r+Math.sin(ct)*bt*.8,W=e.createRadialGradient(xt,H,0,a,r,bt*2);if(tt){const E=Math.floor(45+X*60),F=Math.floor(25+X*35),L=Math.floor(12+X*18),O=Math.floor(5+X*8),R=Math.floor(X*12);W.addColorStop(0,`rgb(${E}, ${E+R}, ${E+R*2})`),W.addColorStop(.15,`rgb(${F}, ${F+3}, ${F+8})`),W.addColorStop(.4,`rgb(${L+2}, ${L+4}, ${L+8})`),W.addColorStop(.7,`rgb(${L}, ${L}, ${L+3})`),W.addColorStop(1,`rgb(${O}, ${O}, ${O+2})`)}else if(A){const E=Math.floor(70+X*80),F=Math.floor(200+X*55),L=Math.floor(60+X*40),O=Math.floor(150+X*30),R=Math.floor(15+X*15),st=Math.floor(80+X*30),$=Math.floor(25+X*15);W.addColorStop(0,`rgb(${E}, ${F}, ${L})`),W.addColorStop(.12,`rgb(${Math.floor(55+X*25)}, ${Math.floor(175+X*35)}, ${Math.floor(70+X*20)})`),W.addColorStop(.35,`rgb(40, ${O}, 55)`),W.addColorStop(.6,"rgb(30, 120, 45)"),W.addColorStop(.85,`rgb(${R+5}, ${st+10}, ${$})`),W.addColorStop(1,`rgb(${R}, ${st}, ${$})`)}else{const E=Math.floor(255),F=Math.floor(80+X*70),L=Math.floor(60+X*50),O=Math.floor(200+X*30),R=Math.floor(120+X*40),st=Math.floor(8+X*15),$=Math.floor(8+X*15);W.addColorStop(0,`rgb(${E}, ${F}, ${L})`),W.addColorStop(.12,`rgb(${Math.floor(240+X*15)}, ${Math.floor(50+X*30)}, ${Math.floor(40+X*20)})`),W.addColorStop(.35,`rgb(${O}, 25, 25)`),W.addColorStop(.6,"rgb(180, 15, 15)"),W.addColorStop(.85,`rgb(${R+20}, ${st}, ${$})`),W.addColorStop(1,`rgb(${R}, ${st}, ${$})`)}e.fillStyle=W}if(e.arc(a,r,P+25*f,_,w),e.arc(a,r,B-10*f,w,_,!0),e.closePath(),e.fill(),!(this.highlightedPocket===v&&this.pocketAnimActive)&&X>.5){e.save(),e.beginPath(),e.arc(a,r,P+25*f,_,w),e.arc(a,r,B-10*f,w,_,!0),e.closePath(),e.clip();const bt=nt-Q,ct=a+Math.cos(bt)*(P-10),xt=r+Math.sin(bt)*(P-10),H=e.createRadialGradient(ct,xt,0,ct,xt,(P-B)*1.2),W=(X-.5)*2;tt?H.addColorStop(0,`rgba(255, 250, 220, ${.12*W})`):A?H.addColorStop(0,`rgba(200, 255, 200, ${.18*W})`):H.addColorStop(0,`rgba(255, 200, 200, ${.18*W})`),H.addColorStop(1,"rgba(255, 255, 255, 0)"),e.fillStyle=H,e.fill(),e.restore()}if(this.highlightedPocket===v&&this.pocketAnimActive){const bt=this.pocketOpenProgress;e.save(),e.beginPath(),e.arc(a,r,B+5,_,w),e.arc(a,r,B-10*f,w,_,!0),e.closePath(),e.fillStyle=`rgba(0, 0, 0, ${.7*bt})`,e.fill(),e.restore()}}),e.strokeStyle=rt,e.lineWidth=4;for(let T=0;T<this.wheelOrder.length;T++){const v=T*It-Math.PI/2,_=a+Math.cos(v)*B,w=r+Math.sin(v)*B,G=a+Math.cos(v)*(P+25*f),A=r+Math.sin(v)*(P+25*f);e.beginPath(),e.moveTo(_,w),e.lineTo(G,A),e.stroke()}this.wheelOrder.forEach((T,v)=>{const _=v*It-Math.PI/2,w=T==="0"||T==="00",G=_+It/2,A=P+8*f,x=a+Math.cos(G)*A,tt=r+Math.sin(G)*A;e.save(),e.translate(x,tt),e.rotate(G+Math.PI/2),e.font=`800 ${Math.max(11,P*.08)}px "Inter", "Segoe UI", sans-serif`,e.textAlign="center",e.textBaseline="middle";const U=w?"#0c1712":"#fffef2";e.fillStyle=U,e.shadowColor="rgba(0,0,0,0.45)",e.shadowBlur=4*f,e.lineWidth=2,e.strokeStyle=U==="#fffef2"?"rgba(0,0,0,0.75)":"rgba(255,255,255,0.5)",e.strokeText(T,0,0),e.fillText(T,0,0),e.restore()}),e.save(),e.strokeStyle=rt,e.lineWidth=4,e.beginPath(),e.arc(a,r,P-6*f,0,Math.PI*2),e.stroke(),e.restore(),e.stroke(),e.beginPath(),e.arc(a,r,B+2*f,0,Math.PI*2),e.stroke(),e.restore(),e.save(),e.strokeStyle=et,e.lineWidth=1,e.beginPath(),e.arc(a,r,P-4*f,0,Math.PI*2),e.stroke(),e.restore(),e.save(),e.strokeStyle=et,e.lineWidth=1,e.beginPath(),e.arc(a,r,P-4*f,0,Math.PI*2),e.stroke(),e.restore(),e.save(),e.strokeStyle=et,e.lineWidth=1,e.beginPath(),e.arc(a,r,P+25*f,0,Math.PI*2),e.stroke(),e.restore(),e.restore();const vt=this.ballOpacity!==void 0?this.ballOpacity:1;if(this.ballVisible){e.save(),e.globalAlpha=vt;const T=this.ballScale!==void 0?this.ballScale:1,v=Math.max(4,c*.033)*T,_=(this.ballRadiusRatio||0)*c,w=a+Math.cos(this.ballAngle)*_,G=r+Math.sin(this.ballAngle)*_;e.beginPath(),e.arc(w+v*.3,G+v*.3,v,0,Math.PI*2),e.fillStyle="rgba(0, 0, 0, 0.4)",e.fill();const A=e.createRadialGradient(w-v*.3,G-v*.3,0,w,G,v);A.addColorStop(0,"#ffffff"),A.addColorStop(.3,"#f0f0f0"),A.addColorStop(.7,"#c0c0c0"),A.addColorStop(1,"#808080"),e.beginPath(),e.arc(w,G,v,0,Math.PI*2),e.fillStyle=A,e.fill(),e.beginPath(),e.arc(w-v*.3,G-v*.3,v*.4,0,Math.PI*2),e.fillStyle="rgba(255, 255, 255, 0.8)",e.fill(),e.beginPath(),e.arc(w,G,v,0,Math.PI*2),e.strokeStyle="rgba(100, 100, 100, 0.5)",e.lineWidth=1,e.stroke(),e.restore()}const D=-(this.wheelRotation||0),ht=e.createConicGradient(D-Math.PI/4,a,r);ht.addColorStop(.1,"#7e0914"),ht.addColorStop(.4,"#5b0610"),ht.addColorStop(.8,"#7e0914");const V=B*.99;e.save(),e.translate(a,r),e.rotate(this.wheelRotation||0),e.translate(-a,-r),e.beginPath(),e.arc(a,r,V*1.02,0,Math.PI*2),e.fillStyle=Z,e.fill(),e.restore(),e.save(),e.translate(a,r),e.rotate(this.wheelRotation||0),e.translate(-a,-r),e.beginPath(),e.strokeStyle="rgba(255,255,255,0.35)",e.lineWidth=1.8;for(let T=0;T<8;T+=1){const v=Math.PI/4*T;e.moveTo(a+Math.cos(v)*B,r+Math.sin(v)*B),e.lineTo(a+Math.cos(v)*70,r+Math.sin(v)*70)}e.stroke(),e.restore(),e.save(),e.translate(a,r),e.rotate(this.wheelRotation||0),e.translate(-a,-r),e.beginPath(),e.arc(a,r,40*f,0,Math.PI*2),e.fillStyle=at,e.shadowColor="rgba(0, 0, 0, 0.55)",e.shadowBlur=15*f,e.shadowOffsetX=0,e.shadowOffsetY=0,e.fill(),e.save(),e.translate(a,r),e.rotate(this.wheelRotation||0),e.translate(-a,-r);for(let T=0;T<8;T+=2){const v=Math.PI/4*T;let w=v+(this.wheelRotation||0)-Ot;for(;w>Math.PI;)w-=2*Math.PI;for(;w<-Math.PI;)w+=2*Math.PI;const G=(Math.cos(w)+1)/2,A=Pt*.95,x=Math.max(3,c*.018),tt=c*.18,U=c*.035,z=tt*.33,X=U*.84,bt=a+Math.cos(v)*Pt*.25,ct=r+Math.sin(v)*Pt*.25,xt=a+Math.cos(v)*A,H=r+Math.sin(v)*A,W=e.createLinearGradient(bt,ct,xt,H),E=G*.25+.75;W.addColorStop(0,`rgb(${Math.floor(200*E)}, ${Math.floor(160*E)}, ${Math.floor(50*E)})`),W.addColorStop(.15,`rgb(${Math.floor(255*E)}, ${Math.floor(210*E)}, ${Math.floor(80*E)})`),W.addColorStop(.5,`rgb(${Math.floor(255*E)}, ${Math.floor(220*E)}, ${Math.floor(100*E)})`),W.addColorStop(.85,`rgb(${Math.floor(255*E)}, ${Math.floor(200*E)}, ${Math.floor(70*E)})`),W.addColorStop(1,`rgb(${Math.floor(180*E)}, ${Math.floor(140*E)}, ${Math.floor(40*E)})`),e.save(),e.shadowColor="rgba(0, 0, 0, 0.5)",e.shadowBlur=Math.max(2,c*.01),e.shadowOffsetX=0,e.shadowOffsetY=0,e.beginPath(),e.strokeStyle=N,e.lineWidth=x,e.lineCap="round",e.moveTo(bt,ct),e.lineTo(xt,H),e.stroke(),e.restore(),e.save(),e.translate(xt,H),e.rotate(v);const F=tt/2,L=U/2,O=Math.max(.1,Math.min(z-4*f,F-11*f)),R=Math.max(.1,Math.min(X,L)),st=e.createLinearGradient(0,-L*1.5,0,L*1.5),$=G*.2+.8;st.addColorStop(0,`rgb(${Math.floor(255*$)}, ${Math.floor(255*$)}, ${Math.floor(240*$)})`),st.addColorStop(.1,`rgb(${Math.floor(255*$)}, ${Math.floor(250*$)}, ${Math.floor(200*$)})`),st.addColorStop(.25,`rgb(${Math.floor(255*$)}, ${Math.floor(235*$)}, ${Math.floor(150*$)})`),st.addColorStop(.5,`rgb(${Math.floor(220*$)}, ${Math.floor(180*$)}, ${Math.floor(80*$)})`),st.addColorStop(.75,`rgb(${Math.floor(255*$)}, ${Math.floor(230*$)}, ${Math.floor(140*$)})`),st.addColorStop(.9,`rgb(${Math.floor(255*$)}, ${Math.floor(250*$)}, ${Math.floor(190*$)})`),st.addColorStop(1,`rgb(${Math.floor(255*$)}, ${Math.floor(245*$)}, ${Math.floor(180*$)})`),e.shadowColor="rgba(0, 0, 0, 0.5)",e.shadowBlur=Math.max(2,c*.015),e.shadowOffsetX=0,e.shadowOffsetY=0,e.beginPath(),e.fillStyle=N,e.moveTo(-F+O,-L),e.lineTo(F-O,-L),e.ellipse(F-O,-L+R,O,R,0,-Math.PI/2,0),e.lineTo(F,L-R),e.ellipse(F-O,L-R,O,R,0,0,Math.PI/2),e.lineTo(-F+O,L),e.ellipse(-F+O,L-R,O,R,0,Math.PI/2,Math.PI),e.lineTo(-F,-L+R),e.ellipse(-F+O,-L+R,O,R,0,Math.PI,Math.PI*1.5),e.closePath(),e.fill(),e.restore()}e.beginPath(),e.arc(a,r,Math.max(15,c*.1),0,Math.PI*2),e.fillStyle=rt,e.shadowColor="rgba(0, 0, 0, 0.55)",e.shadowBlur=Math.max(8,c*.05),e.shadowOffsetX=0,e.shadowOffsetY=0,e.fill(),e.restore(),e.save(),e.translate(a,r),e.rotate(this.wheelRotation||0),e.translate(-a,-r);for(let T=1;T<8;T+=2){const v=Math.PI/4*T;let w=v+(this.wheelRotation||0)-Ot;for(;w>Math.PI;)w-=2*Math.PI;for(;w<-Math.PI;)w+=2*Math.PI;const G=(Math.cos(w)+1)/2,A=Pt*.55+10,x=Math.max(2,c*.01),tt=c*.12,U=c*.02,z=tt*.33,X=U*.84,bt=a+Math.cos(v)*Pt*.25,ct=r+Math.sin(v)*Pt*.25,xt=a+Math.cos(v)*A,H=r+Math.sin(v)*A,W=e.createLinearGradient(bt,ct,xt,H),E=G*.25+.75;W.addColorStop(0,`rgb(${Math.floor(200*E)}, ${Math.floor(160*E)}, ${Math.floor(50*E)})`),W.addColorStop(.15,`rgb(${Math.floor(255*E)}, ${Math.floor(210*E)}, ${Math.floor(80*E)})`),W.addColorStop(.5,`rgb(${Math.floor(255*E)}, ${Math.floor(220*E)}, ${Math.floor(100*E)})`),W.addColorStop(.85,`rgb(${Math.floor(255*E)}, ${Math.floor(200*E)}, ${Math.floor(70*E)})`),W.addColorStop(1,`rgb(${Math.floor(180*E)}, ${Math.floor(140*E)}, ${Math.floor(40*E)})`),e.save(),e.shadowColor="rgba(0, 0, 0, 0.5)",e.shadowBlur=Math.max(2,c*.006),e.shadowOffsetX=0,e.shadowOffsetY=0,e.beginPath(),e.strokeStyle=N,e.lineWidth=x,e.lineCap="round",e.moveTo(bt,ct),e.lineTo(xt,H),e.stroke(),e.restore(),e.save(),e.translate(xt,H),e.rotate(v);const F=tt/2,L=U/2,O=Math.max(.1,Math.min(z,F)),R=Math.max(.1,Math.min(X,L)),st=e.createLinearGradient(0,-L*1.5,0,L*1.5),$=G*.35+.65;st.addColorStop(0,`rgb(${Math.floor(255*$)}, ${Math.floor(255*$)}, ${Math.floor(240*$)})`),st.addColorStop(.1,`rgb(${Math.floor(255*$)}, ${Math.floor(250*$)}, ${Math.floor(200*$)})`),st.addColorStop(.25,`rgb(${Math.floor(255*$)}, ${Math.floor(235*$)}, ${Math.floor(150*$)})`),st.addColorStop(.5,`rgb(${Math.floor(220*$)}, ${Math.floor(180*$)}, ${Math.floor(80*$)})`),st.addColorStop(.75,`rgb(${Math.floor(255*$)}, ${Math.floor(230*$)}, ${Math.floor(140*$)})`),st.addColorStop(.9,`rgb(${Math.floor(255*$)}, ${Math.floor(250*$)}, ${Math.floor(190*$)})`),st.addColorStop(1,`rgb(${Math.floor(255*$)}, ${Math.floor(245*$)}, ${Math.floor(180*$)})`),e.shadowColor="rgba(0, 0, 0, 0.5)",e.shadowBlur=Math.max(2,c*.008),e.shadowOffsetX=0,e.shadowOffsetY=0,e.beginPath(),e.fillStyle=N,e.moveTo(-F+O,-L),e.lineTo(F-O,-L),e.ellipse(F-O,-L+R,O,R,0,-Math.PI/2,0),e.lineTo(F,L-R),e.ellipse(F-O,L-R,O,R,0,0,Math.PI/2),e.lineTo(-F+O,L),e.ellipse(-F+O,L-R,O,R,0,Math.PI/2,Math.PI),e.lineTo(-F,-L+R),e.ellipse(-F+O,-L+R,O,R,0,Math.PI,Math.PI*1.5),e.closePath(),e.fill(),e.restore()}e.restore(),e.restore();const Xt=-Math.PI/4,$t=Xt+Math.PI-St,ft=Math.cos($t),it=Math.sin($t),kt=Xt-St,Yt=Math.cos(kt),Kt=Math.sin(kt);e.save(),e.translate(a,r),e.rotate(St),e.translate(-a,-r);const Bt=e.createConicGradient(kt,a,r);Bt.addColorStop(0,"#fffef5"),Bt.addColorStop(.12,"#ffe082"),Bt.addColorStop(.25,"#c9a000"),Bt.addColorStop(.38,"#8b6914"),Bt.addColorStop(.5,"#5a4500"),Bt.addColorStop(.62,"#8b6914"),Bt.addColorStop(.75,"#c9a000"),Bt.addColorStop(.88,"#ffe082"),Bt.addColorStop(1,"#fffef5"),e.beginPath(),e.arc(a,r,25*f,0,Math.PI*2),e.shadowColor="rgba(0, 0, 0, 0.5)",e.shadowBlur=5*f,e.shadowOffsetX=0,e.shadowOffsetY=0,e.fillStyle=Bt,e.fill(),e.shadowColor="transparent",e.restore(),e.save(),e.translate(a,r),e.rotate(St),e.translate(-a,-r);const yt=e.createConicGradient(kt+Math.PI*.05,a,r);yt.addColorStop(0,"#fff8dc"),yt.addColorStop(.12,"#ffd54f"),yt.addColorStop(.25,"#b8860b"),yt.addColorStop(.38,"#7a5a10"),yt.addColorStop(.5,"#4a3500"),yt.addColorStop(.62,"#7a5a10"),yt.addColorStop(.75,"#b8860b"),yt.addColorStop(.88,"#ffd54f"),yt.addColorStop(1,"#fff8dc"),e.beginPath(),e.arc(a,r,20*f,0,Math.PI*2),e.shadowColor="rgba(0, 0, 0, 0.45)",e.shadowBlur=4*f,e.shadowOffsetX=0,e.shadowOffsetY=0,e.fillStyle=yt,e.fill(),e.shadowColor="transparent",e.restore(),e.save(),e.translate(a,r),e.rotate(St),e.translate(-a,-r);const q=e.createConicGradient(kt+Math.PI*.1,a,r);q.addColorStop(0,"#ffffff"),q.addColorStop(.12,"#ffeb3b"),q.addColorStop(.25,"#daa520"),q.addColorStop(.38,"#8b6914"),q.addColorStop(.5,"#5a4000"),q.addColorStop(.62,"#8b6914"),q.addColorStop(.75,"#daa520"),q.addColorStop(.88,"#ffeb3b"),q.addColorStop(1,"#ffffff"),e.beginPath(),e.arc(a,r,10*f,0,Math.PI*2),e.shadowColor="rgba(0, 0, 0, 0.4)",e.shadowBlur=3*f,e.shadowOffsetX=0,e.shadowOffsetY=0,e.fillStyle=q,e.fill(),e.shadowColor="transparent",e.restore(),e.save(),e.translate(a,r),e.rotate(St),e.translate(-a,-r);const k=e.createConicGradient(kt+Math.PI*.15,a,r);k.addColorStop(0,"#fffef5"),k.addColorStop(.12,"#ffe082"),k.addColorStop(.25,"#cd9700"),k.addColorStop(.38,"#8a6508"),k.addColorStop(.5,"#5a4500"),k.addColorStop(.62,"#8a6508"),k.addColorStop(.75,"#cd9700"),k.addColorStop(.88,"#ffe082"),k.addColorStop(1,"#fffef5"),e.beginPath(),e.arc(a,r,7.5*f,0,Math.PI*2),e.shadowColor="rgba(0, 0, 0, 0.35)",e.shadowBlur=2.5*f,e.shadowOffsetX=0,e.shadowOffsetY=0,e.fillStyle=k,e.fill(),e.shadowColor="transparent",e.restore(),e.save(),e.translate(a,r),e.rotate(St),e.translate(-a,-r);const y=e.createConicGradient(kt+Math.PI*.2,a,r);y.addColorStop(0,"#ffffff"),y.addColorStop(.12,"#fff8dc"),y.addColorStop(.25,"#ffc107"),y.addColorStop(.38,"#9a7b00"),y.addColorStop(.5,"#6a5000"),y.addColorStop(.62,"#9a7b00"),y.addColorStop(.75,"#ffc107"),y.addColorStop(.88,"#fff8dc"),y.addColorStop(1,"#ffffff"),e.beginPath(),e.arc(a,r,4.5*f,0,Math.PI*2),e.shadowColor="rgba(0, 0, 0, 0.3)",e.shadowBlur=2*f,e.shadowOffsetX=ft*(1*f),e.shadowOffsetY=it*(1*f),e.fillStyle=y,e.fill(),e.shadowColor="transparent",e.restore(),e.save();const gt=e.createRadialGradient(a+Yt*(c*.08),r+Kt*(c*.08),c*.88,a,r,c);gt.addColorStop(0,"#ffe082"),gt.addColorStop(.35,"#ffc107"),gt.addColorStop(.65,"#c99a2e"),gt.addColorStop(1,"#7a5a10"),e.beginPath(),e.arc(a,r,c*.97,0,Math.PI*2),e.strokeStyle=gt,e.lineWidth=Math.max(4,c*.05),e.shadowColor="rgba(0, 0, 0, 0.65)",e.shadowBlur=Math.max(3,c*.03),e.shadowOffsetX=ft*Math.max(2,c*.015),e.shadowOffsetY=it*Math.max(2,c*.015),e.stroke(),e.restore()}renderBall(t,e){this.ballVisible=!0,this.ballAngle=t;const l=this.wheelCanvas,d=l?.clientWidth||600,s=l?.clientHeight||600,u=Math.min(d,s)/2-4;this.ballRadiusRatio=e/u,this.renderCanvasWheel()}clearBall(){this.ballVisible=!1,this.highlightedPocket=-1,this.pocketOpenProgress=0,this.pocketAnimStartTime=null,this.ballStartRadiusForAnim=0,this.ballScale=1,this.ballOpacity=1,this.pocketAnimActive=!1,this.renderCanvasWheel()}async animateBall(t,e,l){if(!this.wheelCanvas||!this.wheelCanvasCtx)return;const d=this.wheelCanvas,s=d.clientWidth||600,u=d.clientHeight||600,C=s/2,a=u/2,r=Math.min(C,a)-4;if(r<50)return;const c=r/300,f=r*.96,P=f*.85*.84*.98+3*c,B=f,j=P-65*c,Pt=Math.PI*2/this.wheelOrder.length,Ct=(12+Math.floor(Math.random()*5))*Math.PI*2,St=performance.now(),Ot=e,Tt=t*Pt-Math.PI/2+Pt/2,rt=Tt+Ct;return this.wheelAnimating=!0,new Promise(et=>{const at=N=>{const wt=N-St,Z=Math.min(wt/Ot,1),nt=1-Math.pow(1-Z,3),Q=rt-Ct*nt,vt=this.wheelRotation+Q;let D;if(Z<.65)D=B;else{const ht=(Z-.65)/.35,V=ht*ht;D=B-(B-j)*V}this.ballVisible=!0,this.ballAngle=vt,this.ballRadiusRatio=D/r,Z<1?(this.ballLanded=!1,requestAnimationFrame(at)):(this.ballLanded=!0,this.ballAngleOffset=Tt,this.ballRadiusRatio=j/r,et())};requestAnimationFrame(at)})}initRouletteCanvas(){!this.rouletteCanvas||!this.rouletteCtx||(this.rouletteTopNumbers=["25","29","12","8","19","31","18","6","21","33","16","4","23","35"],this.rouletteBottomNumbers=["36","24","3","15","34","22","5","17","32","20","7","11","30","26"],this.rouletteLeftSectorNums=["13","1","00","27","10"],this.rouletteRightSectorNums=["14","2","0","28","9"],this.rouletteRedNumbers=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36],this.undoStack=[],this.redoStack=[],this.lastBet=null,this.hoveredButton=null,this.activeMultiplier="x1",this.betMultiplier=1,this.removeMode=!1,this.pulseAnimationRunning=!1,this.winningHistory=[],this.lastWinningNumber=null,this.winningDisplayState="welcome",this.lastWonCredits=0,this.highlightedPocket=-1,this.pocketOpenProgress=0,this.pocketAnimStartTime=null,this.ballStartRadiusForAnim=0,this.ballScale=1,this.ballOpacity=1,this.pocketAnimActive=!1,this.woodTexture=new Image,this.woodTextureLoaded=!1,this.woodTexture.crossOrigin="anonymous",this.woodTexture.onload=()=>{this.woodTextureLoaded=!0,this.drawRouletteCanvas()},this.woodTexture.src="https://images.unsplash.com/photo-1541123603104-512919d6a96c?w=800&q=80",this.rouletteCanvas.addEventListener("mousemove",t=>{this.handleRouletteMouseMove(t);const e=this.rouletteCanvas.getBoundingClientRect(),l=this.rouletteCanvas.width/e.width,d=this.rouletteCanvas.height/e.height,s=(t.clientX-e.left)*l,u=(t.clientY-e.top)*d,C=this.getClickedChip(s,u),a=this.getClickedButton(s,u);a!==this.hoveredButton&&(this.hoveredButton=a,this.drawRouletteCanvas()),this.rouletteCanvas.style.cursor=C||a?"pointer":"default"}),this.rouletteCanvas.addEventListener("mouseleave",()=>this.handleRouletteMouseLeave()),this.rouletteCanvas.addEventListener("click",t=>this.handleRouletteClick(t)),this.rouletteCanvas.addEventListener("contextmenu",t=>this.handleRouletteRightClick(t)),this.drawRouletteCanvas())}getRouletteColor(t){return t==="0"||t==="00"?"#0a8a0a":this.rouletteRedNumbers.includes(parseInt(t))?"#c41e3a":"#1a1a1a"}isInRouletteLeftCurve(t,e){const I=t-300,M=e-380,dt=Math.sqrt(I*I+M*M);if(t<300&&dt<=160||t>=300&&t<=400&&e>=220&&e<=320)return!0;if(e>320&&e<440){const P=400-100*(e-320)/120;if(t>=300&&t<P)return!0}if(t>=400&&t<=700&&e>=220&&e<=320||t>=300&&t<=500&&e>=440&&e<=540)return!0;if(e>320&&e<440){const B=700-(e-320)/120*2*100,j=400-100*(e-320)/120;if(t>=j&&t<=B)return!0}return!1}isInRouletteRightCurve(t,e){const M=t-1700,dt=e-380,P=Math.sqrt(M*M+dt*dt);if(t>1700&&P<=160||t>=1500&&t<=1700&&e>=220&&e<=320||t>=1600&&t<=1700&&e>=440&&e<=540)return!0;if(e>320&&e<440){const j=1500+(e-320)/120*100;if(t>=j&&t<=1700)return!0}return!1}isInRouletteZone2(t,e){if(t>=700&&t<=1e3&&e>=220&&e<=320||t>=500&&t<=1e3&&e>=440&&e<=540)return!0;if(e>320&&e<440){const f=700-(e-320)/120*2*100;if(t>f&&t<=1e3)return!0}return!1}isInRouletteZone3(t,e){if(t>=1e3&&t<=1500&&e>=220&&e<=320||t>=1e3&&t<=1600&&e>=440&&e<=540)return!0;if(e>320&&e<440){const c=(e-320)/120,f=1e3,I=1500+c*100;if(t>=f&&t<I)return!0}return!1}getRouletteZone(t,e){if(e>=1120&&e<=1185&&t>=140&&t<=1860){const rt=["1st12","2nd12","3rd12"];for(let et=0;et<3;et++){const at=140+et*580;if(t>=at&&t<=at+560)return rt[et]}}const It=40,Ct=2,St=3,Ot=140+Ct*290,Tt=140+St*290;if(e>=1195&&e<=1295+It){if(t>=Ot&&t<=Ot+270)return"red";if(t>=Tt&&t<=Tt+270)return"black"}if(e>=1205&&e<=1295&&t>=140){const rt=["low","even","red","black","odd","high"];for(let et=0;et<6;et++){if(et===Ct||et===St)continue;const at=140+et*290;if(t>=at&&t<=at+270)return rt[et]}}return this.isInRouletteLeftCurve(t,e)?"doubleZero":this.isInRouletteRightCurve(t,e)?"zeroZone":this.isInRouletteZone2(t,e)?"siluette":this.isInRouletteZone3(t,e)?"angelEyes":null}getBoardCell(t,e){if(!this.boardDimensions)return null;const l=this.boardDimensions,d=l.y,s=l.gap,u=l.cellWidth,C=l.cellHeight,a=l.zeroWidth,r=l.colRailWidth,c=l.startX,f=l.numbersStartX,I=l.endX,M=l.totalHeight,dt=I+s,P=[[3,6,9,12,15,18,21,24,27,30,33,36],[2,5,8,11,14,17,20,23,26,29,32,35],[1,4,7,10,13,16,19,22,25,28,31,34]];if(e<d-10||e>d+M+30||t<c-10||t>dt+r+10)return null;if(e>=d+M&&e<=d+M+30){const N=f-s/2;if(Math.abs(t-N)<25)return{type:"line",key:"line-0-00-1-2-3",label:"Top Line 0-00-1-2-3",targets:["0","00","1","2","3"]}}if(e>=d+M&&e<=d+M+30)for(let N=0;N<12;N++){const Z=f+N*(u+s)+u/2;if(N<11){const nt=f+(N+1)*(u+s)-s/2;if(Math.abs(t-nt)<15){const Q=[P[0][N],P[1][N],P[2][N],P[0][N+1],P[1][N+1],P[2][N+1]].sort((vt,D)=>vt-D);return{type:"line",key:`line-${Q[0]}-${Q[5]}`,label:`Line ${Q[0]}-${Q[5]}`,targets:Q.map(String)}}}if(Math.abs(t-Z)<20){const nt=[P[0][N],P[1][N],P[2][N]].sort((Q,vt)=>Q-vt);return{type:"street",key:`street-${nt.join("-")}`,label:`Street ${nt[0]}-${nt[2]}`,targets:nt.map(String)}}}const B=C*1.5+s*.5;if(t>=c&&t<=c+a&&e>=d&&e<=d+B)return{type:"straight",value:"0",key:"straight-0",label:"0",targets:["0"]};const j=d+B+s,Pt=M-B-s;if(t>=c&&t<=c+a&&e>=j&&e<=j+Pt)return{type:"straight",value:"00",key:"straight-00",label:"00",targets:["00"]};const It=f-s/2,Ct=25,St=d+C/2,Ot=d+C+s,Tt=d+C+s+C/2,rt=d+2*C+s,at=d+2*(C+s)+C/2;if(t>=c&&t<=c+a&&Math.abs(e-(d+M/2))<Ct)return{type:"split",key:"split-0-00",label:"Split 0-00",targets:["0","00"]};if(Math.abs(t-It)<Ct){if(Math.abs(e-St)<Ct)return{type:"split",key:"split-0-3",label:"Split 0-3",targets:["0","3"]};if(Math.abs(e-(Ot+15))<Ct)return{type:"split",key:"split-0-2",label:"Split 0-2",targets:["0","2"]};if(Math.abs(e-Tt)<Ct)return{type:"street",key:"street-0-00-2",label:"Basket 0-00-2",targets:["0","00","2"]};if(Math.abs(e-(rt-15))<Ct)return{type:"split",key:"split-00-2",label:"Split 00-2",targets:["00","2"]};if(Math.abs(e-at)<Ct)return{type:"split",key:"split-00-1",label:"Split 00-1",targets:["00","1"]}}if(t>=dt&&t<=dt+r){const N=["col3","col2","col1"],wt={col1:["1","4","7","10","13","16","19","22","25","28","31","34"],col2:["2","5","8","11","14","17","20","23","26","29","32","35"],col3:["3","6","9","12","15","18","21","24","27","30","33","36"]};for(let Z=0;Z<3;Z++){const nt=d+Z*(C+s);if(e>=nt&&e<=nt+C){const Q=N[Z];return{type:"column",value:Q,key:`column-${Q}`,label:"2 to 1",targets:wt[Q]}}}}if(t>=f&&t<=I&&e>=d&&e<=d+M){const N=t-f,wt=e-d,Z=u+s,nt=C+s;for(let D=0;D<11;D++){const ht=(D+1)*Z-s/2;for(let V=0;V<2;V++){const Xt=(V+1)*nt-s/2,$t=Math.abs(N-ht),ft=Math.abs(wt-Xt);if($t<30&&ft<30){const it=[P[V][D],P[V][D+1],P[V+1][D],P[V+1][D+1]].sort((kt,Yt)=>kt-Yt);return{type:"corner",key:`corner-${it.join("-")}`,label:`Corner ${it.join("-")}`,targets:it.map(String)}}}if(Math.abs(N-ht)<25){const V=Math.floor(wt/nt);if(V>=0&&V<3){const Xt=P[V][D],$t=P[V][D+1],ft=[Xt,$t].sort((it,kt)=>it-kt);return{type:"split",key:`split-${ft[0]}-${ft[1]}`,label:`Split ${ft[0]}-${ft[1]}`,targets:ft.map(String)}}}}for(let D=0;D<2;D++){const ht=(D+1)*nt-s/2;if(Math.abs(wt-ht)<25){const V=Math.floor(N/Z);if(V>=0&&V<12){const Xt=P[D][V],$t=P[D+1][V],ft=[Xt,$t].sort((it,kt)=>it-kt);return{type:"split",key:`split-${ft[0]}-${ft[1]}`,label:`Split ${ft[0]}-${ft[1]}`,targets:ft.map(String)}}}}const Q=Math.floor(N/Z),vt=Math.floor(wt/nt);if(Q>=0&&Q<12&&vt>=0&&vt<3){const D=P[vt][Q];return{type:"straight",value:String(D),key:`straight-${D}`,label:String(D),targets:[String(D)]}}}return null}handleRouletteMouseMove(t){const e=this.rouletteCanvas.getBoundingClientRect(),l=this.rouletteCanvas.width/e.width,d=this.rouletteCanvas.height/e.height,s=(t.clientX-e.left)*l,u=(t.clientY-e.top)*d,C=this.getClickedChip(s,u);C!==this.hoveredChipValue&&(this.hoveredChipValue=C,this.drawRouletteCanvas());const a=this.getRouletteZone(s,u),r=this.getBoardCell(s,u);(a!==this.rouletteHoveredZone||JSON.stringify(r)!==JSON.stringify(this.hoveredBoardCell))&&(this.rouletteHoveredZone=a,this.hoveredBoardCell=r,this.rouletteCanvas.style.cursor=a||r?"pointer":"default",this.drawRouletteCanvas())}handleRouletteMouseLeave(){this.rouletteHoveredZone=null,this.hoveredBoardCell=null,this.hoveredChipValue=null,this.drawRouletteCanvas()}handleRouletteClick(t){const e=this.rouletteCanvas.getBoundingClientRect(),l=this.rouletteCanvas.width/e.width,d=this.rouletteCanvas.height/e.height,s=(t.clientX-e.left)*l,u=(t.clientY-e.top)*d,C=this.getClickedButton(s,u);if(C){this.handleButtonClick(C);return}const a=this.getClickedChip(s,u);if(a){this.currentChipValue=a,this.drawRouletteCanvas();return}const r=this.getBoardCell(s,u);if(r){if(this.removeMode){this.removeLastChipFromSpot(r.key);return}this.placeBoardBet(r);return}const c=this.getRouletteZone(s,u);if(c){if(this.removeMode){this.removeChipFromZone(c);return}this.placeRouletteBet(c)}}getClickedButton(t,e){if(!this.controlButtons)return null;for(const l of this.controlButtons)if(t>=l.x&&t<=l.x+l.width&&e>=l.y&&e<=l.y+70&&l.enabled)return l.key;return null}handleButtonClick(t){switch(t){case"undo":this.undoBet();break;case"redo":this.redoBet();break;case"rebet":this.reBet();break;case"spin":this.handleSpin();break;case"x1":this.trySetMultiplier(1,"x1");break;case"x2":this.trySetMultiplier(2,"x2");break;case"x3":this.trySetMultiplier(3,"x3");break;case"x4":this.trySetMultiplier(4,"x4");break;case"x5":this.trySetMultiplier(5,"x5");break;case"clear":this.clearPlacements();break;case"remove":this.removeMode=!this.removeMode,this.drawRouletteCanvas();break}}undoBet(){if(this.undoStack.length===0||this.isSpinning)return;const t=this.undoStack.pop();this.redoStack.push({placements:JSON.parse(JSON.stringify(this.state.placements)),activeMultiplier:this.activeMultiplier,betMultiplier:this.betMultiplier}),t.placements!==void 0?(this.state.placements=t.placements,this.activeMultiplier=t.activeMultiplier||"x1",this.betMultiplier=t.betMultiplier||1):this.state.placements=t,this.updateSummary(),this.updateBoardStacks(),this.drawRouletteCanvas()}redoBet(){if(this.redoStack.length===0||this.isSpinning)return;const t=this.redoStack.pop();this.undoStack.push({placements:JSON.parse(JSON.stringify(this.state.placements)),activeMultiplier:this.activeMultiplier,betMultiplier:this.betMultiplier}),t.placements!==void 0?(this.state.placements=t.placements,this.activeMultiplier=t.activeMultiplier||"x1",this.betMultiplier=t.betMultiplier||1):this.state.placements=t,this.updateSummary(),this.updateBoardStacks(),this.drawRouletteCanvas()}reBet(){if(!this.lastBet||this.lastBet.length===0||this.isSpinning)return;const t=JSON.stringify(this.state.placements),e=JSON.stringify(this.lastBet);t!==e&&(this.undoStack.push({placements:JSON.parse(JSON.stringify(this.state.placements)),activeMultiplier:this.activeMultiplier,betMultiplier:this.betMultiplier}),this.redoStack=[],this.state.placements=JSON.parse(JSON.stringify(this.lastBet)),this.updateSummary(),this.updateBoardStacks(),this.drawRouletteCanvas())}handleRouletteRightClick(t){if(t.preventDefault(),this.isSpinning)return;const e=this.rouletteCanvas.getBoundingClientRect(),l=this.rouletteCanvas.width/e.width,d=this.rouletteCanvas.height/e.height,s=(t.clientX-e.left)*l,u=(t.clientY-e.top)*d,C=this.getRouletteZone(s,u);if(!C)return;const a=["low","high","even","odd","red","black","1st12","2nd12","3rd12"].includes(C);let r;a?r={low:"range-low",high:"range-high",even:"parity-even",odd:"parity-odd",red:"color-red",black:"color-black","1st12":"dozen-1st12","2nd12":"dozen-2nd12","3rd12":"dozen-3rd12"}[C]:r=`sector-${C}`;const c=this.state.placements.map(f=>f.key).lastIndexOf(r);c!==-1&&(this.undoStack.push({placements:JSON.parse(JSON.stringify(this.state.placements)),activeMultiplier:this.activeMultiplier,betMultiplier:this.betMultiplier}),this.redoStack=[],this.state.placements.splice(c,1),this.updateSummary(),this.updateBoardStacks(),this.drawRouletteCanvas())}removeChipFromZone(t){if(this.isSpinning)return;const e=["low","high","even","odd","red","black","1st12","2nd12","3rd12"].includes(t);let l;e?l={low:"range-low",high:"range-high",even:"parity-even",odd:"parity-odd",red:"color-red",black:"color-black","1st12":"dozen-1st12","2nd12":"dozen-2nd12","3rd12":"dozen-3rd12","1st12":"dozen-1st12","2nd12":"dozen-2nd12","3rd12":"dozen-3rd12"}[t]:l=`sector-${t}`;const d=this.state.placements.map(s=>s.key).lastIndexOf(l);d!==-1&&(this.undoStack.push({placements:JSON.parse(JSON.stringify(this.state.placements)),activeMultiplier:this.activeMultiplier,betMultiplier:this.betMultiplier}),this.redoStack=[],this.state.placements.splice(d,1),this.updateSummary(),this.updateBoardStacks(),this.drawRouletteCanvas())}getClickedChip(t,e){const a=[1,2,5,10,20,30,50,100,200,500],f=1760/(a.length-1),I=120;for(let M=0;M<a.length;M++){const dt=I+M*f;if(Math.sqrt((t-dt)**2+(e-1445)**2)<=45)return a[M]}return null}placeBoardBet(t){if(this.isSpinning)return;const e=this.currentChipValue*(this.betMultiplier||1);if(this.getTotalStake()+e>this.state.credits){this.showToast("Not enough credits to place this bet.");return}const d={type:t.type,value:t.value||t.key,targets:t.targets||[t.value],label:t.label,key:t.key,tokens:1,multiplier:this.currentChipValue};if(this.state.placements.filter(u=>u.key===d.key).length>=this.maxTokens){this.showToast(`Maximum ${this.maxTokens} chips allowed on ${d.label}.`);return}this.undoStack.push({placements:JSON.parse(JSON.stringify(this.state.placements)),activeMultiplier:this.activeMultiplier,betMultiplier:this.betMultiplier}),this.redoStack=[],this.state.placements.push(d),this.dismissToastByReason("chips-required"),this.updateSummary(),this.updateBoardStacks(),this.drawRouletteCanvas()}placeRouletteBet(t){if(this.isSpinning)return;const e=this.currentChipValue*(this.betMultiplier||1);if(this.getTotalStake()+e>this.state.credits){this.showToast("Not enough credits to place this bet.");return}const d=Array.from({length:18},(B,j)=>String(j+1)),s=Array.from({length:18},(B,j)=>String(j+19)),u=Array.from({length:36},(B,j)=>j+1).filter(B=>B%2===0).map(String),C=Array.from({length:36},(B,j)=>j+1).filter(B=>B%2!==0).map(String),a=this.redNumbers.map(String),r=Array.from({length:36},(B,j)=>String(j+1)).filter(B=>!this.redNumbers.includes(B)),f={doubleZero:{label:"Double Zero",numbers:[...this.rouletteLeftSectorNums,...this.rouletteTopNumbers.slice(0,4),...this.rouletteBottomNumbers.slice(0,2)],type:"sector"},siluette:{label:"Siluette",numbers:this.rouletteTopNumbers.slice(4,7).concat(this.rouletteBottomNumbers.slice(2,7)),type:"sector"},angelEyes:{label:"Angel Eyes",numbers:this.rouletteTopNumbers.slice(7,12).concat(this.rouletteBottomNumbers.slice(7,13)),type:"sector"},zeroZone:{label:"Zero Zone",numbers:[...this.rouletteRightSectorNums,...this.rouletteTopNumbers.slice(12),...this.rouletteBottomNumbers.slice(13)],type:"sector"},low:{label:"1 to 18",numbers:d,type:"range",betType:"range",betValue:"low"},high:{label:"19 to 36",numbers:s,type:"range",betType:"range",betValue:"high"},even:{label:"EVEN",numbers:u,type:"parity",betType:"parity",betValue:"even"},odd:{label:"ODD",numbers:C,type:"parity",betType:"parity",betValue:"odd"},red:{label:"RED",numbers:a,type:"color",betType:"color",betValue:"red"},black:{label:"BLACK",numbers:r,type:"color",betType:"color",betValue:"black"},"1st12":{label:"1ST 12",numbers:Array.from({length:12},(B,j)=>String(j+1)),type:"dozen",betType:"dozen",betValue:"1st12"},"2nd12":{label:"2ND 12",numbers:Array.from({length:12},(B,j)=>String(j+13)),type:"dozen",betType:"dozen",betValue:"2nd12"},"3rd12":{label:"3RD 12",numbers:Array.from({length:12},(B,j)=>String(j+25)),type:"dozen",betType:"dozen",betValue:"3rd12"}}[t];if(!f)return;const I=["low","high","even","odd","red","black","1st12","2nd12","3rd12"].includes(t),M=I?`${f.betType}-${f.betValue}`:`sector-${t}`;if(this.state.placements.filter(B=>B.key===M).length>=this.maxTokens){this.showToast(`Maximum chips reached for ${f.label}.`);return}const P={type:I?f.betType:"sector",value:I?f.betValue:t,sectorKey:t,sectorSize:f.numbers.length,targets:f.numbers,label:f.label,key:M,tokens:1,multiplier:this.currentChipValue};this.undoStack.push({placements:JSON.parse(JSON.stringify(this.state.placements)),activeMultiplier:this.activeMultiplier,betMultiplier:this.betMultiplier}),this.redoStack=[],this.state.placements.push(P),this.dismissToastByReason("chips-required"),this.updateSummary(),this.updateBoardStacks(),this.drawRouletteCanvas()}calculateTotalBet(){const t=this.betMultiplier||1;if(!this.state?.placements)return 0;let e=0;return this.state.placements.forEach(l=>{l.breakdown?l.breakdown.forEach(d=>e+=d.multiplier*d.count):e+=l.multiplier||0}),e*t}getBaseBet(){if(!this.state?.placements)return 0;let t=0;return this.state.placements.forEach(e=>{e.breakdown?e.breakdown.forEach(l=>t+=l.multiplier*l.count):t+=e.multiplier||0}),t}trySetMultiplier(t,e){const l=this.getBaseBet(),d=l*t,s=this.state?.credits??0;return d>s&&l>0?(this.showToast(`Not enough credits for x${t} multiplier. Need ${d}, have ${s}.`),!1):(this.activeMultiplier!==e&&(this.undoStack.push({placements:JSON.parse(JSON.stringify(this.state.placements)),activeMultiplier:this.activeMultiplier,betMultiplier:this.betMultiplier}),this.redoStack=[]),this.activeMultiplier=e,this.betMultiplier=t,this.updateSummary(),this.drawRouletteCanvas(),!0)}drawRouletteCanvas(){if(!this.rouletteCanvas||!this.rouletteCtx)return;const t=this.rouletteCtx,e=140,l=300,d=1700,s=l,u=d,a=(u-s)/14,r=100,c=-60+e,f=300+c,I=60,M=160,dt=l-M,P=d+M;t.fillStyle="#0a3d0a",t.fillRect(0,0,2e3,1640);const B=t.createLinearGradient(0,0,0,e);B.addColorStop(0,"#1a1a2e"),B.addColorStop(1,"#16213e"),t.fillStyle=B,t.fillRect(0,0,2e3,e);const j=t.createLinearGradient(0,0,0,20);j.addColorStop(0,"rgba(0, 0, 0, 0.4)"),j.addColorStop(1,"rgba(0, 0, 0, 0)"),t.fillStyle=j,t.fillRect(0,4,2e3,20),t.shadowColor="#d4af37",t.shadowBlur=8,t.shadowOffsetY=2,t.beginPath(),t.moveTo(0,2),t.lineTo(2e3,2),t.strokeStyle="#d4af37",t.lineWidth=4,t.stroke(),t.shadowColor="transparent",t.shadowBlur=0,t.shadowOffsetY=0,t.beginPath(),t.moveTo(0,7),t.lineTo(2e3,7),t.strokeStyle="rgba(212, 175, 55, 0.5)",t.lineWidth=1,t.stroke();const Pt=t.createLinearGradient(0,e-20,0,e);Pt.addColorStop(0,"rgba(0, 0, 0, 0)"),Pt.addColorStop(1,"rgba(0, 0, 0, 0.4)"),t.fillStyle=Pt,t.fillRect(0,e-20,2e3,20),t.shadowColor="#d4af37",t.shadowBlur=8,t.shadowOffsetY=-2,t.beginPath(),t.moveTo(0,e-2),t.lineTo(2e3,e-2),t.strokeStyle="#d4af37",t.lineWidth=4,t.stroke(),t.shadowColor="transparent",t.shadowBlur=0,t.shadowOffsetY=0,t.beginPath(),t.moveTo(0,e-7),t.lineTo(2e3,e-7),t.strokeStyle="rgba(212, 175, 55, 0.5)",t.lineWidth=1,t.stroke();const It=85;t.beginPath(),t.moveTo(0,It),t.lineTo(2e3,It),t.strokeStyle="#d4af37",t.lineWidth=2,t.stroke();const Ct=28,St=55;t.fillStyle="#ffd700",t.font="bold 28px Arial",t.textAlign="left",t.textBaseline="middle";const Ot=this.state?.credits??0,Tt=this.calculateTotalBet?this.calculateTotalBet():0,rt=Math.max(0,Ot-Tt);t.fillText("Coins:",40,Ct),t.fillStyle="#ffffff",t.font="bold 34px Arial",t.fillText(String(rt),150,Ct);const et=42;t.beginPath(),t.moveTo(0,et),t.lineTo(380,et),t.strokeStyle="#d4af37",t.lineWidth=2,t.stroke(),t.fillStyle="#ffd700",t.font="bold 28px Arial",t.fillText("Actual bet:",40,St),t.fillStyle="#ffffff";const at=this.calculateTotalBet?this.calculateTotalBet():0;t.font="bold 34px Arial",t.fillText(String(at),210,St);const N=this.betMultiplier||1;N>1&&(t.fillStyle="#ffd700",t.font="bold 24px Arial",t.fillText("(x"+N+")",280,St));let wt="",Z="#1a5a2a";const nt=400,Q=42,vt=700,D=15,ht=55;this.winningDisplayState==="welcome"?(wt="Welcome",Z="#1a5a2a"):this.winningDisplayState==="spinning"?(wt="Spinning...",Z="#2a4a8a"):this.winningDisplayState==="result"&&this.lastWinningNumber!==null?(wt=String(this.lastWinningNumber),Z=this.getRouletteColor(String(this.lastWinningNumber))):(wt="--",Z="#333333"),t.fillStyle="#ffd700",t.font="bold 38px Arial",t.textAlign="left",t.textBaseline="middle",t.fillText("Winning number:",nt,Q),t.fillStyle=Z,t.fillRect(vt,D,ht,ht),t.strokeStyle="#ffd700",t.lineWidth=3,t.strokeRect(vt,D,ht,ht),t.fillStyle="#ffffff",wt==="Welcome"||wt==="Spinning..."?t.font="bold 16px Arial":t.font="bold 38px Arial",t.textAlign="center",t.textBaseline="middle",t.fillText(wt,vt+ht/2,D+ht/2),t.font="bold 28px Arial",t.textAlign="left";let V=vt+ht+40;const Xt=this.lastWinningNumber;if(this.winningDisplayState==="result"&&Xt!==null){const o=parseInt(Xt);let n="GREEN";this.redNumbers.includes(String(o))?n="RED":o!==0&&String(o)!=="00"&&(n="BLACK");const i=o===0||String(Xt)==="00"?"":o%2===0?"Even":"Odd";t.fillStyle="#ffffff",t.fillText("•",V,Q),V+=25,t.fillStyle=Z==="#000000"?"#888888":Z,t.fillText(n,V,Q),V+=t.measureText(n).width+20,i&&(t.fillStyle="#ffffff",t.fillText("•",V,Q),V+=25,t.fillText(i,V,Q),V+=t.measureText(i).width+20),t.fillStyle="#ffffff",t.fillText("•",V,Q),V+=25;const p=this.lastWonCredits??0;t.fillText(`Won ${p} credits`,V,Q)}const $t=115;t.fillStyle="#ffd700",t.font="bold 30px Arial",t.textAlign="left",t.textBaseline="middle",t.fillText("Winning number history:",40,$t);const ft=380;t.beginPath(),t.moveTo(ft,0),t.lineTo(ft,e),t.strokeStyle="#d4af37",t.lineWidth=2,t.stroke();const it=this.winningHistory||[],kt=400,Yt=32,Kt=4;for(let o=0;o<Math.min(it.length,25);o++){const n=it[o],i=kt+o*(Yt+Kt),p=$t-Yt/2;t.fillStyle=this.getRouletteColor(String(n)),t.fillRect(i,p,Yt,Yt),t.strokeStyle="#ffd700",t.lineWidth=1,t.strokeRect(i,p,Yt,Yt),t.fillStyle="#ffffff",t.font="bold 14px Arial",t.textAlign="center",t.textBaseline="middle",t.fillText(String(n),i+Yt/2,p+Yt/2)}t.strokeStyle="#d4af37",t.lineWidth=2,t.lineWidth=2;for(let o=0;o<14;o++){const n=this.rouletteTopNumbers[o],i=this.getRouletteColor(n),p=s+o*a,g=140+c,h=i==="#1a1a1a",m=i==="#c41e3a",Y=i==="#0a8a0a",b=t.createLinearGradient(p,g,p+a,g+r);if(h)b.addColorStop(0,"#2a2a2a"),b.addColorStop(.3,"#1a1a1a"),b.addColorStop(.7,"#1a1a1a"),b.addColorStop(1,"#0a0a0a");else if(m)b.addColorStop(0,"#e63e5c"),b.addColorStop(.3,"#c41e3a"),b.addColorStop(.7,"#c41e3a"),b.addColorStop(1,"#8a1528");else if(Y)b.addColorStop(0,"#0cb010"),b.addColorStop(.3,"#0a8a0a"),b.addColorStop(.7,"#0a8a0a"),b.addColorStop(1,"#065a06");else{t.fillStyle=i,t.fillRect(p,g,a,r);continue}t.fillStyle=b,t.fillRect(p,g,a,r);const S=t.createLinearGradient(p,g,p+a*.5,g+r*.3);h?S.addColorStop(0,"rgba(255, 250, 220, 0.08)"):m?S.addColorStop(0,"rgba(255, 200, 200, 0.15)"):Y&&S.addColorStop(0,"rgba(200, 255, 200, 0.12)"),S.addColorStop(1,"rgba(255, 255, 255, 0)"),t.fillStyle=S,t.fillRect(p,g,a,r)}for(let o=0;o<14;o++){const n=this.rouletteBottomNumbers[o],i=this.getRouletteColor(n),p=s+o*a,g=360+c,h=i==="#1a1a1a",m=i==="#c41e3a",Y=i==="#0a8a0a",b=t.createLinearGradient(p,g,p+a,g+r);if(h)b.addColorStop(0,"#2a2a2a"),b.addColorStop(.3,"#1a1a1a"),b.addColorStop(.7,"#1a1a1a"),b.addColorStop(1,"#0a0a0a");else if(m)b.addColorStop(0,"#e63e5c"),b.addColorStop(.3,"#c41e3a"),b.addColorStop(.7,"#c41e3a"),b.addColorStop(1,"#8a1528");else if(Y)b.addColorStop(0,"#0cb010"),b.addColorStop(.3,"#0a8a0a"),b.addColorStop(.7,"#0a8a0a"),b.addColorStop(1,"#065a06");else{t.fillStyle=i,t.fillRect(p,g,a,r);continue}t.fillStyle=b,t.fillRect(p,g,a,r);const S=t.createLinearGradient(p,g,p+a*.5,g+r*.3);h?S.addColorStop(0,"rgba(255, 250, 220, 0.08)"):m?S.addColorStop(0,"rgba(255, 200, 200, 0.15)"):Y&&S.addColorStop(0,"rgba(200, 255, 200, 0.12)"),S.addColorStop(1,"rgba(255, 255, 255, 0)"),t.fillStyle=S,t.fillRect(p,g,a,r)}t.strokeStyle="#d4af37",t.beginPath(),t.moveTo(s,140+c),t.lineTo(u,140+c),t.moveTo(s,240+c),t.lineTo(u,240+c),t.moveTo(s,360+c),t.lineTo(u,360+c),t.moveTo(s,460+c),t.lineTo(u,460+c),t.stroke();for(let o=1;o<14;o++)t.beginPath(),t.moveTo(s+o*a,140+c),t.lineTo(s+o*a,240+c),t.stroke();for(let o=1;o<14;o++)t.beginPath(),t.moveTo(s+o*a,360+c),t.lineTo(s+o*a,460+c),t.stroke();t.strokeStyle="#d4af37",t.lineWidth=2,t.beginPath(),t.moveTo(s+2*a,360+c),t.lineTo(s+4*a,240+c),t.stroke(),t.beginPath(),t.moveTo(s+12*a,240+c),t.lineTo(s+13*a,360+c),t.stroke();const Bt=this.rouletteLeftSectorNums.map(o=>this.getRouletteColor(o));for(let o=0;o<5;o++){const n=Math.PI/2+o*(Math.PI/5),i=Math.PI/2+(o+1)*(Math.PI/5),p=(n+i)/2;t.beginPath(),t.arc(s,f,M,n,i),t.arc(s,f,I,i,n,!0),t.closePath();const g=Bt[o],h=g==="#1a1a1a",m=g==="#c41e3a",Y=g==="#0a8a0a",b=s+Math.cos(p)*((I+M)/2),S=f+Math.sin(p)*((I+M)/2),J=t.createRadialGradient(b-20,S-20,0,b,S,M-I);if(h)J.addColorStop(0,"#2a2a2a"),J.addColorStop(.5,"#1a1a1a"),J.addColorStop(1,"#0a0a0a");else if(m)J.addColorStop(0,"#e63e5c"),J.addColorStop(.5,"#c41e3a"),J.addColorStop(1,"#8a1528");else if(Y)J.addColorStop(0,"#12c012"),J.addColorStop(.4,"#0a8a0a"),J.addColorStop(1,"#045a04");else{t.fillStyle=g,t.fill(),t.stroke();continue}t.fillStyle=J,t.fill(),t.stroke(),t.save(),t.beginPath(),t.arc(s,f,M,n,i),t.arc(s,f,I,i,n,!0),t.closePath(),t.clip();const K=t.createRadialGradient(b-30,S-30,0,b,S,M);Y?(K.addColorStop(0,"rgba(200, 255, 200, 0.2)"),K.addColorStop(.5,"rgba(200, 255, 200, 0.05)")):m?(K.addColorStop(0,"rgba(255, 200, 200, 0.15)"),K.addColorStop(.5,"rgba(255, 200, 200, 0.03)")):(K.addColorStop(0,"rgba(255, 250, 220, 0.1)"),K.addColorStop(.5,"rgba(255, 250, 220, 0.02)")),K.addColorStop(1,"rgba(255, 255, 255, 0)"),t.fillStyle=K,t.fill(),t.restore()}const yt=this.rouletteRightSectorNums.map(o=>this.getRouletteColor(o));for(let o=0;o<5;o++){const n=-Math.PI/2+o*(Math.PI/5),i=-Math.PI/2+(o+1)*(Math.PI/5),p=(n+i)/2;t.beginPath(),t.arc(u,f,M,n,i),t.arc(u,f,I,i,n,!0),t.closePath();const g=yt[o],h=g==="#1a1a1a",m=g==="#c41e3a",Y=g==="#0a8a0a",b=u+Math.cos(p)*((I+M)/2),S=f+Math.sin(p)*((I+M)/2),J=t.createRadialGradient(b+20,S-20,0,b,S,M-I);if(h)J.addColorStop(0,"#2a2a2a"),J.addColorStop(.5,"#1a1a1a"),J.addColorStop(1,"#0a0a0a");else if(m)J.addColorStop(0,"#e63e5c"),J.addColorStop(.5,"#c41e3a"),J.addColorStop(1,"#8a1528");else if(Y)J.addColorStop(0,"#12c012"),J.addColorStop(.4,"#0a8a0a"),J.addColorStop(1,"#045a04");else{t.fillStyle=g,t.fill(),t.stroke();continue}t.fillStyle=J,t.fill(),t.stroke(),t.save(),t.beginPath(),t.arc(u,f,M,n,i),t.arc(u,f,I,i,n,!0),t.closePath(),t.clip();const K=t.createRadialGradient(b+30,S-30,0,b,S,M);Y?(K.addColorStop(0,"rgba(200, 255, 200, 0.2)"),K.addColorStop(.5,"rgba(200, 255, 200, 0.05)")):m?(K.addColorStop(0,"rgba(255, 200, 200, 0.15)"),K.addColorStop(.5,"rgba(255, 200, 200, 0.03)")):(K.addColorStop(0,"rgba(255, 250, 220, 0.1)"),K.addColorStop(.5,"rgba(255, 250, 220, 0.02)")),K.addColorStop(1,"rgba(255, 255, 255, 0)"),t.fillStyle=K,t.fill(),t.restore()}t.strokeStyle="#d4af37",t.beginPath(),t.arc(s,f,I,Math.PI/2,Math.PI*1.5),t.stroke(),t.beginPath(),t.arc(s,f,M,Math.PI/2,Math.PI*1.5),t.stroke(),t.beginPath(),t.arc(u,f,I,-Math.PI/2,Math.PI/2),t.stroke(),t.beginPath(),t.arc(u,f,M,-Math.PI/2,Math.PI/2),t.stroke();for(let o=0;o<=5;o++){const n=Math.PI/2+o*(Math.PI/5);t.beginPath(),t.moveTo(s+I*Math.cos(n),f+I*Math.sin(n)),t.lineTo(s+M*Math.cos(n),f+M*Math.sin(n)),t.stroke()}for(let o=0;o<=5;o++){const n=-Math.PI/2+o*(Math.PI/5);t.beginPath(),t.moveTo(u+I*Math.cos(n),f+I*Math.sin(n)),t.lineTo(u+M*Math.cos(n),f+M*Math.sin(n)),t.stroke()}t.beginPath(),t.moveTo(s+7*a,240+c),t.lineTo(s+7*a,360+c),t.stroke(),t.font="bold 34px Arial",t.textAlign="center",t.textBaseline="middle";for(let o=0;o<14;o++){const n=s+o*a+a/2,i=190+c;t.strokeStyle="rgba(0, 0, 0, 0.7)",t.lineWidth=4,t.strokeText(this.rouletteTopNumbers[o],n,i),t.fillStyle="white",t.fillText(this.rouletteTopNumbers[o],n,i)}for(let o=0;o<14;o++){const n=s+o*a+a/2,i=410+c;t.strokeStyle="rgba(0, 0, 0, 0.7)",t.lineWidth=4,t.strokeText(this.rouletteBottomNumbers[o],n,i),t.fillStyle="white",t.fillText(this.rouletteBottomNumbers[o],n,i)}for(let o=0;o<5;o++){const n=Math.PI/2+(o+.5)*(Math.PI/5),i=(I+M)/2,p=s+i*Math.cos(n),g=f+i*Math.sin(n);t.strokeStyle="rgba(0, 0, 0, 0.7)",t.lineWidth=4,t.strokeText(this.rouletteLeftSectorNums[o],p,g),t.fillStyle="white",t.fillText(this.rouletteLeftSectorNums[o],p,g)}for(let o=0;o<5;o++){const n=-Math.PI/2+(o+.5)*(Math.PI/5),i=(I+M)/2,p=u+i*Math.cos(n),g=f+i*Math.sin(n);t.strokeStyle="rgba(0, 0, 0, 0.7)",t.lineWidth=4,t.strokeText(this.rouletteRightSectorNums[o],p,g),t.fillStyle="white",t.fillText(this.rouletteRightSectorNums[o],p,g)}t.fillStyle="white",t.font="bold 25px Arial",t.textAlign="center",t.textBaseline="middle",t.save(),t.shadowColor="#d4af37",t.shadowBlur=8,t.strokeStyle="black",t.lineWidth=3,t.strokeText("DOUBLE ZERO",s+75,f),t.fillStyle="white",t.fillText("DOUBLE ZERO",s+75,f),t.restore(),t.font="bold 25px Arial",t.textAlign="center",t.shadowColor="#d4af37",t.shadowBlur=8,t.strokeStyle="black",t.lineWidth=3,t.strokeText("SILUETTE",s+5.5*a-30,f),t.fillStyle="white",t.fillText("SILUETTE",s+5.5*a-30,f),t.strokeText("ANGEL EYES",s+9.5*a+30,f),t.fillText("ANGEL EYES",s+9.5*a+30,f),t.font="bold 25px Arial",t.save(),t.shadowColor="#d4af37",t.shadowBlur=8,t.strokeStyle="black",t.lineWidth=3,t.strokeText("ZERO ZONE",u-45,f),t.fillStyle="white",t.fillText("ZERO ZONE",u-45,f),t.restore(),t.shadowColor="transparent",t.shadowBlur=0,this.rouletteHoveredZone==="doubleZero"&&(t.fillStyle="rgba(255, 255, 255, 0.3)",t.beginPath(),t.arc(s,f,M,Math.PI/2,Math.PI*1.5),t.closePath(),t.fill(),t.fillRect(s,140+c,a,r),t.beginPath(),t.moveTo(s,240+c),t.lineTo(s+a,240+c),t.lineTo(s,360+c),t.closePath(),t.fill(),t.fillRect(s+a,140+c,3*a,r),t.fillRect(s,360+c,2*a,r),t.beginPath(),t.moveTo(s+a,240+c),t.lineTo(s+4*a,240+c),t.lineTo(s+2*a,360+c),t.lineTo(s,360+c),t.closePath(),t.fill()),this.rouletteHoveredZone==="siluette"&&(t.fillStyle="rgba(255, 255, 255, 0.3)",t.fillRect(s+4*a,140+c,3*a,r),t.fillRect(s+2*a,360+c,5*a,r),t.beginPath(),t.moveTo(s+4*a,240+c),t.lineTo(s+7*a,240+c),t.lineTo(s+7*a,360+c),t.lineTo(s+2*a,360+c),t.closePath(),t.fill()),this.rouletteHoveredZone==="angelEyes"&&(t.fillStyle="rgba(255, 255, 255, 0.3)",t.fillRect(s+7*a,140+c,5*a,r),t.fillRect(s+7*a,360+c,6*a,r),t.beginPath(),t.moveTo(s+7*a,240+c),t.lineTo(s+12*a,240+c),t.lineTo(s+13*a,360+c),t.lineTo(s+7*a,360+c),t.closePath(),t.fill()),this.rouletteHoveredZone==="zeroZone"&&(t.fillStyle="rgba(255, 255, 255, 0.3)",t.beginPath(),t.arc(u,f,M,-Math.PI/2,Math.PI/2),t.closePath(),t.fill(),t.fillRect(s+12*a,140+c,2*a,r),t.fillRect(s+13*a,360+c,a,r),t.beginPath(),t.moveTo(s+12*a,240+c),t.lineTo(u,240+c),t.lineTo(u,360+c),t.lineTo(s+13*a,360+c),t.closePath(),t.fill());const q=(o,n,i,p,g=50)=>{const h=g/2;t.save(),t.beginPath(),t.arc(o+2,n+3,h,0,Math.PI*2),t.fillStyle="rgba(0, 0, 0, 0.3)",t.fill(),t.beginPath(),t.arc(o,n,h,0,Math.PI*2),t.fillStyle=i,t.fill();const m=8;for(let pt=0;pt<m;pt++){const ut=pt/m*Math.PI*2-Math.PI/2;t.save(),t.translate(o,n),t.rotate(ut),t.fillStyle="#1a1a1a";const lt=h*.22,Lt=h*.28;t.fillRect(h-lt,-Lt/2,lt,Lt),t.fillStyle="#ffffff",t.fillRect(h-lt+2,-Lt/2+2,lt-4,Lt-4),t.restore()}t.beginPath(),t.arc(o,n,h-1,0,Math.PI*2),t.strokeStyle="rgba(0, 0, 0, 0.2)",t.lineWidth=1,t.stroke(),t.beginPath(),t.arc(o,n,h*.75,0,Math.PI*2),t.strokeStyle="#ffffff",t.lineWidth=h*.12,t.stroke();const Y=8,b=h*.75;for(let pt=0;pt<Y;pt++){const ut=pt/Y*Math.PI*2+Math.PI/8,lt=o+Math.cos(ut)*b,Lt=n+Math.sin(ut)*b;t.beginPath(),t.fillStyle=i;const Ut=h*.06;for(let Vt=0;Vt<5;Vt++){const Qt=Vt/5*Math.PI*2-Math.PI/2,te=lt+Math.cos(Qt)*Ut,ee=Lt+Math.sin(Qt)*Ut;Vt===0?t.moveTo(te,ee):t.lineTo(te,ee)}t.closePath(),t.fill()}t.beginPath(),t.arc(o,n,h*.62,0,Math.PI*2),t.strokeStyle=i,t.lineWidth=h*.08,t.stroke(),t.beginPath(),t.arc(o,n,h*.52,0,Math.PI*2),t.fillStyle="#2a2a3a",t.fill();const S=t.createRadialGradient(o-h*.1,n-h*.1,0,o,n,h*.52);S.addColorStop(0,"rgba(255, 255, 255, 0.1)"),S.addColorStop(1,"rgba(0, 0, 0, 0.2)"),t.fillStyle=S,t.fill();const J=[0,Math.PI/2,Math.PI,Math.PI*1.5],K=h*.88;J.forEach(pt=>{const ut=o+Math.cos(pt)*K,lt=n+Math.sin(pt)*K;t.beginPath(),t.arc(ut,lt,h*.05,0,Math.PI*2),t.fillStyle="#ffffff",t.fill()});const Mt=t.createRadialGradient(o-h*.3,n-h*.3,0,o-h*.3,n-h*.3,h*.4);Mt.addColorStop(0,"rgba(255, 255, 255, 0.25)"),Mt.addColorStop(1,"rgba(255, 255, 255, 0)"),t.beginPath(),t.arc(o-h*.2,n-h*.2,h*.35,0,Math.PI*2),t.fillStyle=Mt,t.fill();const Dt=Math.max(12,Math.floor(g*.4));t.font="bold "+Dt+"px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="rgba(0, 0, 0, 0.4)",t.fillText(String(p),o+1,n+1),t.fillStyle="#ffffff",t.fillText(String(p),o,n),t.restore()},k=620,y=15,gt=8,T=100,v=90,_=34,w=149,G=1860,A=(G-w-11*y)/12,x=A,tt=3*x+2*y,U=50;this.boardDimensions={y:k,gap:y,radius:gt,cellWidth:A,cellHeight:x,zeroWidth:T,colRailWidth:v,startX:_,numbersStartX:w,endX:G,totalHeight:tt};const z=[[3,6,9,12,15,18,21,24,27,30,33,36],[2,5,8,11,14,17,20,23,26,29,32,35],[1,4,7,10,13,16,19,22,25,28,31,34]],X=(o,n,i,p,g,h=!1)=>{t.save(),t.beginPath(),t.roundRect(o,n,i,p,gt),t.fillStyle=g,t.fill();const m=t.createLinearGradient(o,n,o+i,n+p);m.addColorStop(0,"rgba(0, 0, 0, 0.4)"),m.addColorStop(.1,"rgba(0, 0, 0, 0.2)"),m.addColorStop(.5,"rgba(0, 0, 0, 0)"),m.addColorStop(.9,"rgba(255, 255, 255, 0.1)"),m.addColorStop(1,"rgba(255, 255, 255, 0.15)"),t.fillStyle=m,t.fill(),t.strokeStyle="#d4af37",t.lineWidth=2,t.stroke(),h&&(t.fillStyle="rgba(255, 255, 255, 0.3)",t.fill()),t.restore()},bt=_,ct=k,xt=x*1.5+y*.5,H=this.hoveredBoardCell&&this.hoveredBoardCell.key==="straight-0";X(bt,ct,T,xt,"#0a6b0a",H),t.save(),t.font="bold 40px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="white",t.shadowColor="rgba(0,0,0,0.5)",t.shadowBlur=4,t.fillText("0",bt+T/2,ct+xt/2),t.restore();const W=k+xt+y,E=tt-xt-y,F=this.hoveredBoardCell&&this.hoveredBoardCell.key==="straight-00";X(bt,W,T,E,"#0a6b0a",F),t.save(),t.font="bold 40px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="white",t.shadowColor="rgba(0,0,0,0.5)",t.shadowBlur=4,t.fillText("00",bt+T/2,W+E/2),t.restore();for(let o=0;o<3;o++)for(let n=0;n<12;n++){const i=z[o][n],p=w+n*(A+y),g=k+o*(x+y),h=this.getRouletteColor(String(i)),m=this.hoveredBoardCell&&this.hoveredBoardCell.key===`straight-${i}`;X(p,g,A,x,h,m),t.save(),t.font="bold 36px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="white",t.shadowColor="rgba(0,0,0,0.5)",t.shadowBlur=4,t.fillText(String(i),p+A/2,g+x/2),t.restore()}const L=G+y,O=["col3","col2","col1"];for(let o=0;o<3;o++){const n=k+o*(x+y),i=this.hoveredBoardCell&&this.hoveredBoardCell.key===`column-${O[o]}`;X(L,n,v,x,"#0a5c0a",i),t.save(),t.translate(L+v/2,n+x/2),t.rotate(-Math.PI/2),t.font="bold 28px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="white",t.shadowColor="rgba(0,0,0,0.5)",t.shadowBlur=4,t.fillText("2 to 1",0,0),t.restore()}for(let o=0;o<2;o++)for(let n=0;n<12;n++){const i=z[o][n],p=z[o+1][n],g=w+n*(A+y)+A/2,h=k+(o+1)*(x+y)-y/2,m=U/2,Y=`split-${Math.min(i,p)}-${Math.max(i,p)}`;this.hoveredBoardCell&&this.hoveredBoardCell.key===Y&&(t.save(),t.beginPath(),t.arc(g,h,m,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore())}for(let o=0;o<3;o++)for(let n=0;n<11;n++){const i=z[o][n],p=z[o][n+1],g=w+(n+1)*(A+y)-y/2,h=k+o*(x+y)+x/2,m=U/2,Y=`split-${Math.min(i,p)}-${Math.max(i,p)}`;this.hoveredBoardCell&&this.hoveredBoardCell.key===Y&&(t.save(),t.beginPath(),t.arc(g,h,m,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore())}for(let o=0;o<2;o++)for(let n=0;n<11;n++){const p=`corner-${[z[o][n],z[o][n+1],z[o+1][n],z[o+1][n+1]].sort((b,S)=>b-S).join("-")}`,g=w+(n+1)*(A+y)-y/2,h=k+(o+1)*(x+y)-y/2,m=U/2;this.hoveredBoardCell&&this.hoveredBoardCell.key===p&&(t.save(),t.beginPath(),t.arc(g,h,m,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore())}for(let o=0;o<12;o++){const i=`street-${[z[0][o],z[1][o],z[2][o]].sort((Y,b)=>Y-b).join("-")}`,p=w+o*(A+y)+A/2,g=k+tt,h=U/2;this.hoveredBoardCell&&this.hoveredBoardCell.key===i&&(t.save(),t.beginPath(),t.arc(p,g,h,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore())}for(let o=0;o<11;o++){const n=[z[0][o],z[1][o],z[2][o],z[0][o+1],z[1][o+1],z[2][o+1]].sort((Y,b)=>Y-b),i=`line-${n[0]}-${n[5]}`,p=w+(o+1)*(A+y)-y/2,g=k+tt,h=U/2;this.hoveredBoardCell&&this.hoveredBoardCell.key===i&&(t.save(),t.beginPath(),t.arc(p,g,h,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore())}const R="line-0-00-1-2-3",st=w-y/2,$=k+tt;this.hoveredBoardCell&&this.hoveredBoardCell.key===R&&(t.save(),t.beginPath(),t.arc(st,$,U/2,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore());const Zt=U/2,qt=w-y/2,ge=k+x+y,be=k+2*x+y,Re=k+2*(x+y),Te=ge+x/2,$e=qt,Ie=k+x/2,Oe=qt,Ye=ge+15,Ae=_+T/2,Xe=k+tt/2,We=qt,Ee=Te,Le=qt,Ne=be-15,ze=qt,Ge=Re+x/2;this.hoveredBoardCell&&this.hoveredBoardCell.key==="split-0-3"&&(t.save(),t.beginPath(),t.arc($e,Ie,Zt,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore()),this.hoveredBoardCell&&this.hoveredBoardCell.key==="split-0-2"&&(t.save(),t.beginPath(),t.arc(Oe,Ye,Zt,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore()),this.hoveredBoardCell&&this.hoveredBoardCell.key==="street-0-00-2"&&(t.save(),t.beginPath(),t.arc(We,Ee,Zt,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore()),this.hoveredBoardCell&&this.hoveredBoardCell.key==="split-0-00"&&(t.save(),t.beginPath(),t.arc(Ae,Xe,Zt,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore()),this.hoveredBoardCell&&this.hoveredBoardCell.key==="split-00-2"&&(t.save(),t.beginPath(),t.arc(Le,Ne,Zt,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore()),this.hoveredBoardCell&&this.hoveredBoardCell.key==="split-00-1"&&(t.save(),t.beginPath(),t.arc(ze,Ge,Zt,0,Math.PI*2),t.fillStyle="rgba(255, 255, 255, 0.4)",t.fill(),t.restore());const Ft=new Map;this.state.placements.forEach(o=>{const n=o.targets||[],i=o.multiplier,p=o.type;(p==="sector"||p==="straight")&&n.length>0&&n.forEach(h=>{const m=String(h);Ft.has(m)||Ft.set(m,{totalValue:0,lastMultiplier:i,chips:0});const Y=Ft.get(m);Y.totalValue+=i,Y.lastMultiplier=i,Y.chips+=1})});for(let o=0;o<3;o++)for(let n=0;n<12;n++){const i=z[o][n],p=String(i),g=Ft.get(p);if(g&&g.chips>0){const h=w+n*(A+y)+A/2,m=k+o*(x+y)+x/2,Y=this.getChipColor(g.lastMultiplier);t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,t.shadowOffsetX=0,t.shadowOffsetY=0,q(h,m,Y,Math.round(g.totalValue),U),t.restore()}}const oe=Ft.get("0");if(oe&&oe.chips>0){const o=x*1.5+y*.5,n=_+T/2,i=k+o/2,p=this.getChipColor(oe.lastMultiplier);t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,q(n,i,p,Math.round(oe.totalValue),U),t.restore()}const ae=Ft.get("00");if(ae&&ae.chips>0){const o=x*1.5+y*.5,n=k+o+y,i=tt-o-y,p=_+T/2,g=n+i/2,h=this.getChipColor(ae.lastMultiplier);t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,q(p,g,h,Math.round(ae.totalValue),U),t.restore()}if(this.summary){const o=["column-col3","column-col2","column-col1"],n=G+y;for(let i=0;i<3;i++){const p=this.summary[o[i]];if(p&&p.chips>0){const g=n+v/2,h=k+i*(x+y)+x/2,m=this.getChipColor(p.lastMultiplier);t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,q(g,h,m,Math.round(p.totalValue),U),t.restore()}}}if(this.summary){Object.entries(this.summary).forEach(([i,p])=>{if(i.startsWith("split-")&&p.chips>0){const g=i.replace("split-","").split("-"),h=g.map(b=>isNaN(b)?b:parseInt(b));let m,Y;if(g.includes("0")||g.includes("00")){const b=w-y/2;i==="split-0-00"?(m=_+T/2,Y=k+tt/2):i==="split-0-2"?(m=b,Y=k+x+y+15):i==="split-0-3"?(m=b,Y=k+x/2):i==="split-00-2"?(m=b,Y=be-15):i==="split-00-1"&&(m=b,Y=k+2*(x+y)+x/2)}else{const b=h[0],S=h[1],J=Math.abs(b-S);let K,Mt,Dt,pt;for(let ut=0;ut<3;ut++)for(let lt=0;lt<12;lt++)z[ut][lt]===b&&(K=ut,Mt=lt),z[ut][lt]===S&&(Dt=ut,pt=lt);if(K!==void 0&&Mt!==void 0&&Dt!==void 0&&pt!==void 0){if(J===3){const ut=Math.min(Mt,pt),lt=K;m=w+(ut+1)*(A+y)-y/2,Y=k+lt*(x+y)+x/2}else if(J===1){const ut=Math.min(K,Dt);m=w+Mt*(A+y)+A/2,Y=k+(ut+1)*(x+y)-y/2}}}if(m&&Y){const b=this.getChipColor(p.lastMultiplier);t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,q(m,Y,b,Math.round(p.totalValue),U),t.restore()}}}),Object.entries(this.summary).forEach(([i,p])=>{if(i.startsWith("corner-")&&p.chips>0){const g=i.replace("corner-","").split("-").map(Number).sort((h,m)=>h-m);for(let h=0;h<2;h++)for(let m=0;m<11;m++)if([z[h][m],z[h][m+1],z[h+1][m],z[h+1][m+1]].sort((b,S)=>b-S).join("-")===g.join("-")){const b=w+(m+1)*(A+y)-y/2,S=k+(h+1)*(x+y)-y/2,J=this.getChipColor(p.lastMultiplier);t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,q(b,S,J,Math.round(p.totalValue),U),t.restore()}}}),Object.entries(this.summary).forEach(([i,p])=>{if(i.startsWith("street-")&&p.chips>0&&!i.includes("00")){const g=i.replace("street-","").split("-").map(h=>parseInt(h)).filter(h=>!isNaN(h));if(g.length===3){const h=Math.max(...g),m=z[0].indexOf(h);if(m>=0){const Y=w+m*(A+y)+A/2,b=k+tt,S=this.getChipColor(p.lastMultiplier);t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,q(Y,b,S,Math.round(p.totalValue),U),t.restore()}}}}),Object.entries(this.summary).forEach(([i,p])=>{if(i.startsWith("line-")&&p.chips>0){const g=i.replace("line-","").split("-"),h=parseInt(g[0]),m=z[2].indexOf(h);if(m>=0){const Y=w+(m+1)*(A+y)-y/2,b=k+tt,S=this.getChipColor(p.lastMultiplier);t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,q(Y,b,S,Math.round(p.totalValue),U),t.restore()}}});const o=this.summary["line-0-00-1-2-3"];if(o&&o.chips>0){const i=w-y/2,p=k+tt,g=this.getChipColor(o.lastMultiplier);t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,q(i,p,g,Math.round(o.totalValue),U),t.restore()}const n=this.summary["street-0-00-2"];if(n&&n.chips>0){const i=w-y/2,p=this.getChipColor(n.lastMultiplier);t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4;const g=k+x+y+x/2;q(i,g,p,Math.round(n.totalValue),U),t.restore()}}const At=1120,Gt=65,ie=20,He=2*ie,De=P-dt,re=dt,Nt=(De-He)/3,Ve=[{key:"1st12",label:"1ST 12",numbers:[1,2,3,4,5,6,7,8,9,10,11,12]},{key:"2nd12",label:"2ND 12",numbers:[13,14,15,16,17,18,19,20,21,22,23,24]},{key:"3rd12",label:"3RD 12",numbers:[25,26,27,28,29,30,31,32,33,34,35,36]}];for(let o=0;o<3;o++){const n=Ve[o],i=re+o*(Nt+ie);t.save(),t.shadowColor="rgba(0, 0, 0, 0.6)",t.shadowBlur=Math.max(3,M*.03),t.shadowOffsetX=3,t.shadowOffsetY=3;const p=t.createLinearGradient(i,At,i,At+Gt);p.addColorStop(0,"#3d5a80"),p.addColorStop(.3,"#2c4a6e"),p.addColorStop(.7,"#1e3a5f"),p.addColorStop(1,"#152a45"),t.fillStyle=p,t.fillRect(i,At,Nt,Gt),t.restore(),t.save(),t.beginPath(),t.rect(i,At,Nt,Gt),t.clip();const g=t.createLinearGradient(i,At,i,At+10);g.addColorStop(0,"rgba(184, 134, 80, 0.35)"),g.addColorStop(1,"rgba(184, 134, 80, 0)"),t.fillStyle=g,t.fillRect(i,At,Nt,10),t.restore(),t.save(),t.beginPath(),t.rect(i,At,Nt,Gt),t.clip();const h=t.createLinearGradient(i,At+Gt-12,i,At+Gt);h.addColorStop(0,"rgba(0, 0, 0, 0)"),h.addColorStop(1,"rgba(139, 90, 43, 0.4)"),t.fillStyle=h,t.fillRect(i,At+Gt-12,Nt,12),t.restore(),t.strokeStyle="#d4af37",t.lineWidth=2,t.strokeRect(i,At,Nt,Gt),t.font="bold 38px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="white",t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,t.shadowOffsetX=1,t.shadowOffsetY=1,t.fillText(n.label,i+Nt/2,At+Gt/2),t.shadowColor="transparent",t.shadowBlur=0}const me=["1st12","2nd12","3rd12"].indexOf(this.rouletteHoveredZone);if(me!==-1){t.fillStyle="rgba(255, 255, 255, 0.2)";const o=re+me*(Nt+ie);t.fillRect(o,At,Nt,Gt)}const Ze={"dozen-1st12":0,"dozen-2nd12":1,"dozen-3rd12":2};this.summary&&Object.entries(this.summary).forEach(([o,n])=>{const i=Ze[o];if(i!==void 0&&n.chips>0){const p=re+i*(Nt+ie)+Nt/2,g=At+Gt/2,h=42,m=this.getChipColor(n.lastMultiplier);q(p,g,m,Math.round(n.totalValue),h)}});const Rt=1205,Et=90,se=20,Fe=5*se,ne=dt,Wt=(P-dt-Fe)/6,Ce=[{key:"low",label:"1 to 18",hasBg:!0},{key:"even",label:"EVEN",hasBg:!0},{key:"red",label:"RED",hasBg:!1},{key:"black",label:"BLACK",hasBg:!1},{key:"odd",label:"ODD",hasBg:!0},{key:"high",label:"19 to 36",hasBg:!0}];for(let o=0;o<6;o++){const n=Ce[o],i=ne+o*(Wt+se);if(n.hasBg){t.save(),t.shadowColor="rgba(0, 0, 0, 0.6)",t.shadowBlur=Math.max(3,M*.03),t.shadowOffsetX=3,t.shadowOffsetY=3;const p=t.createLinearGradient(i,Rt,i,Rt+Et);p.addColorStop(0,"#3d5a80"),p.addColorStop(.3,"#2c4a6e"),p.addColorStop(.7,"#1e3a5f"),p.addColorStop(1,"#152a45"),t.fillStyle=p,t.fillRect(i,Rt,Wt,Et),t.restore(),t.save(),t.beginPath(),t.rect(i,Rt,Wt,Et),t.clip();const g=t.createLinearGradient(i,Rt,i,Rt+10);g.addColorStop(0,"rgba(184, 134, 80, 0.35)"),g.addColorStop(1,"rgba(184, 134, 80, 0)"),t.fillStyle=g,t.fillRect(i,Rt,Wt,10),t.restore(),t.save(),t.beginPath(),t.rect(i,Rt,Wt,Et),t.clip();const h=t.createLinearGradient(i,Rt+Et-12,i,Rt+Et);h.addColorStop(0,"rgba(0, 0, 0, 0)"),h.addColorStop(1,"rgba(139, 90, 43, 0.4)"),t.fillStyle=h,t.fillRect(i,Rt+Et-12,Wt,12),t.restore(),t.strokeStyle="#d4af37",t.lineWidth=2,t.strokeRect(i,Rt,Wt,Et),t.font="bold 38px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="white",t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=4,t.shadowOffsetX=1,t.shadowOffsetY=1,t.fillText(n.label,i+Wt/2,Rt+Et/2),t.shadowColor="transparent",t.shadowBlur=0}else{const h=i+Wt/2,m=Rt+Et/2-2;t.fillStyle=n.key==="red"?"#c41e3a":"#1a1a1a",t.beginPath(),t.moveTo(h,m-35),t.lineTo(h+50,m),t.lineTo(h,m+35),t.lineTo(h-50,m),t.closePath(),t.fill(),t.strokeStyle="#d4af37",t.lineWidth=2,t.stroke()}}const de=["low","even","red","black","odd","high"].indexOf(this.rouletteHoveredZone);if(de!==-1){const o=ne+de*(Wt+se);if(Ce[de].hasBg)t.fillStyle="rgba(255, 255, 255, 0.2)",t.fillRect(o,Rt,Wt,Et);else{const g=o+Wt/2,h=Rt+Et/2-2;t.fillStyle="rgba(255, 255, 255, 0.25)",t.beginPath(),t.moveTo(g,h-35-3),t.lineTo(g+50+3,h),t.lineTo(g,h+35+3),t.lineTo(g-50-3,h),t.closePath(),t.fill()}}const je={"range-low":0,"parity-even":1,"color-red":2,"color-black":3,"parity-odd":4,"range-high":5},Je={1:"#f59e0b",2:"#f97316",5:"#dc2626",10:"#16a34a",20:"#2563eb",30:"#7c3aed",50:"#0891b2",100:"#1f2937",200:"#1d4ed8",500:"#7e22ce"};this.summary&&Object.entries(this.summary).forEach(([o,n])=>{const i=je[o];if(i!==void 0&&n.chips>0){const p=ne+i*(Wt+se)+Wt/2,g=Rt+Et/2,h=56,m=Je[n.lastMultiplier]||"#475569";q(p,g,m,Math.round(n.totalValue),h)}});const Se=1445,ye=80,ot=ye/2,_t=2e3,we=60,he=120,Ht=Se-he/2,jt=t.createLinearGradient(0,Ht,0,Ht+he);jt.addColorStop(0,"#0d3d0d"),jt.addColorStop(.3,"#0a5a0a"),jt.addColorStop(.5,"#0d6b0d"),jt.addColorStop(.7,"#0a5a0a"),jt.addColorStop(1,"#073d07"),t.fillStyle=jt,t.fillRect(0,Ht,_t,he);const ce=t.createLinearGradient(0,Ht-20,0,Ht);ce.addColorStop(0,"rgba(0, 0, 0, 0)"),ce.addColorStop(1,"rgba(0, 0, 0, 0.4)"),t.fillStyle=ce,t.fillRect(0,Ht-20,_t,20),t.shadowColor="#d4af37",t.shadowBlur=8,t.shadowOffsetY=-2,t.beginPath(),t.moveTo(0,Ht),t.lineTo(_t,Ht),t.strokeStyle="#d4af37",t.lineWidth=4,t.stroke(),t.shadowColor="transparent",t.shadowBlur=0,t.shadowOffsetY=0,t.beginPath(),t.moveTo(0,Ht+5),t.lineTo(_t,Ht+5),t.strokeStyle="rgba(212, 175, 55, 0.3)",t.lineWidth=2,t.stroke();const Me=[1,2,5,10,20,30,50,100,200,500],Ke=Me.length,qe=(_t-2*we-ye)/(Ke-1),_e=we+ot,Ue={1:"#f59e0b",2:"#f97316",5:"#dc2626",10:"#16a34a",20:"#2563eb",30:"#7c3aed",50:"#0891b2",100:"#1f2937",200:"#1d4ed8",500:"#7e22ce"};Me.forEach((o,n)=>{const i=_e+n*qe,p=this.currentChipValue===o,g=this.hoveredChipValue===o,h=Se,m=Ue[o]||"#475569";t.save(),t.beginPath(),t.arc(i,h,ot,0,Math.PI*2),t.fillStyle=m,t.fill();const Y=8;for(let pt=0;pt<Y;pt++){const ut=pt/Y*Math.PI*2-Math.PI/2;t.save(),t.translate(i,h),t.rotate(ut),t.fillStyle="#1a1a1a";const lt=ot*.22,Lt=ot*.28;t.fillRect(ot-lt,-Lt/2,lt,Lt),t.fillStyle="#ffffff",t.fillRect(ot-lt+2,-Lt/2+2,lt-4,Lt-4),t.restore()}t.beginPath(),t.arc(i,h,ot-1,0,Math.PI*2),t.strokeStyle="rgba(0, 0, 0, 0.2)",t.lineWidth=1,t.stroke(),t.beginPath(),t.arc(i,h,ot*.75,0,Math.PI*2),t.strokeStyle="#ffffff",t.lineWidth=ot*.12,t.stroke();const b=8,S=ot*.75;for(let pt=0;pt<b;pt++){const ut=pt/b*Math.PI*2+Math.PI/8,lt=i+Math.cos(ut)*S,Lt=h+Math.sin(ut)*S;t.beginPath(),t.fillStyle=m;const Ut=ot*.06;for(let Vt=0;Vt<5;Vt++){const Qt=Vt/5*Math.PI*2-Math.PI/2,te=lt+Math.cos(Qt)*Ut,ee=Lt+Math.sin(Qt)*Ut;Vt===0?t.moveTo(te,ee):t.lineTo(te,ee)}t.closePath(),t.fill()}t.beginPath(),t.arc(i,h,ot*.62,0,Math.PI*2),t.strokeStyle=m,t.lineWidth=ot*.08,t.stroke(),t.beginPath(),t.arc(i,h,ot*.52,0,Math.PI*2),t.fillStyle="#2a2a3a",t.fill();const J=t.createRadialGradient(i-ot*.1,h-ot*.1,0,i,h,ot*.52);J.addColorStop(0,"rgba(255, 255, 255, 0.1)"),J.addColorStop(1,"rgba(0, 0, 0, 0.2)"),t.fillStyle=J,t.fill();const K=[0,Math.PI/2,Math.PI,Math.PI*1.5],Mt=ot*.88;K.forEach(pt=>{const ut=i+Math.cos(pt)*Mt,lt=h+Math.sin(pt)*Mt;t.beginPath(),t.arc(ut,lt,ot*.05,0,Math.PI*2),t.fillStyle="#ffffff",t.fill()});const Dt=t.createRadialGradient(i-ot*.3,h-ot*.3,0,i-ot*.3,h-ot*.3,ot*.4);Dt.addColorStop(0,"rgba(255, 255, 255, 0.25)"),Dt.addColorStop(1,"rgba(255, 255, 255, 0)"),t.beginPath(),t.arc(i-ot*.2,h-ot*.2,ot*.35,0,Math.PI*2),t.fillStyle=Dt,t.fill(),t.font="bold 38px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="rgba(0, 0, 0, 0.4)",t.fillText(String(o),i+1,h+1),t.fillStyle="#ffffff",t.fillText(String(o),i,h),(p||g)&&(t.beginPath(),t.arc(i,h,ot+4,0,Math.PI*2),t.strokeStyle="#ffffff",t.lineWidth=4,t.stroke(),t.beginPath(),t.arc(i,h,ot+8,0,Math.PI*2),t.strokeStyle="rgba(255, 255, 255, 0.3)",t.lineWidth=2,t.stroke()),t.restore()});const zt=1515,pe=115,mt=60,Qe=15,ve=(pe-mt)/2,ke=[{key:"undo",label:"UNDO",width:110,enabled:this.undoStack.length>0},{key:"redo",label:"REDO",width:110,enabled:this.redoStack.length>0},{key:"rebet",label:"RE-BET",width:130,enabled:this.lastBet&&this.lastBet.length>0},{key:"spin",label:"SPIN",width:160,enabled:!this.isSpinning&&!this.wheelAnimating&&this.state.placements.length>0}],to=12,xe=[{key:"x1",label:"x1",width:60,enabled:!0},{key:"x2",label:"x2",width:60,enabled:!0},{key:"x3",label:"x3",width:60,enabled:!0},{key:"x4",label:"x4",width:60,enabled:!0},{key:"x5",label:"x5",width:60,enabled:!0},{key:"clear",label:"CLEAR",width:120,enabled:this.state.placements.length>0},{key:"remove",label:this.removeMode?"DEACTIVATE REMOVE":"REMOVE",width:this.removeMode?280:150,enabled:!0}];let fe=1930;const le=[];for(let o=ke.length-1;o>=0;o--){const n=ke[o];fe-=n.width,le.push({...n,x:fe,y:zt+ve}),fe-=Qe}let Pe=70;for(let o=0;o<xe.length;o++){const n=xe[o];le.push({...n,x:Pe,y:zt+ve}),Pe+=n.width+to}this.controlButtons=le;const Jt=t.createLinearGradient(0,zt,0,zt+pe);Jt.addColorStop(0,"#0d3d0d"),Jt.addColorStop(.3,"#0a5a0a"),Jt.addColorStop(.5,"#0d6b0d"),Jt.addColorStop(.7,"#0a5a0a"),Jt.addColorStop(1,"#073d07"),t.fillStyle=Jt,t.fillRect(0,zt,2e3,pe);const ue=t.createLinearGradient(0,zt-20,0,zt);if(ue.addColorStop(0,"rgba(0, 0, 0, 0)"),ue.addColorStop(1,"rgba(0, 0, 0, 0.4)"),t.fillStyle=ue,t.fillRect(0,zt-20,2e3,20),t.shadowColor="#d4af37",t.shadowBlur=8,t.shadowOffsetY=-2,t.beginPath(),t.moveTo(0,zt),t.lineTo(2e3,zt),t.strokeStyle="#d4af37",t.lineWidth=4,t.stroke(),t.shadowColor="transparent",t.shadowBlur=0,t.shadowOffsetY=0,t.beginPath(),t.moveTo(0,zt+5),t.lineTo(2e3,zt+5),t.strokeStyle="rgba(212, 175, 55, 0.3)",t.lineWidth=2,t.stroke(),le.forEach(o=>{const n=this.hoveredButton===o.key,i=o.enabled,p=o.x+o.width/2,g=o.y+mt/2,h=["x1","x2","x3","x4","x5"].includes(o.key),m=o.key==="clear",Y=o.key==="remove",b=h&&this.activeMultiplier===o.key||Y&&this.removeMode;if(o.key==="spin"){const S=Date.now()*.003,J=i?Math.abs(Math.sin(S))*.5+.5:0;if(i)for(let Mt=3;Mt>=0;Mt--)t.beginPath(),t.roundRect(o.x-Mt*4,o.y-Mt*4,o.width+Mt*8,mt+Mt*8,14+Mt*2),t.fillStyle=`rgba(255, 215, 0, ${J*.08*(4-Mt)})`,t.fill();t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=Math.max(3,M*.03),t.shadowOffsetX=3,t.shadowOffsetY=3,t.beginPath(),t.roundRect(o.x,o.y,o.width,mt,10);const K=t.createLinearGradient(o.x,o.y,o.x,o.y+mt);i?(K.addColorStop(0,n?"#ffd700":"#f59e0b"),K.addColorStop(.5,n?"#ffb300":"#d97706"),K.addColorStop(1,n?"#ff8c00":"#b45309")):(K.addColorStop(0,"#4b5563"),K.addColorStop(1,"#374151")),t.fillStyle=K,t.fill(),t.restore(),t.strokeStyle=i?"#ffd700":"#4b5563",t.lineWidth=3,t.stroke(),t.beginPath(),t.roundRect(o.x+2,o.y+2,o.width-4,mt-4,8),t.strokeStyle="rgba(0, 0, 0, 0.3)",t.lineWidth=2,t.stroke(),i&&(t.beginPath(),t.roundRect(o.x+4,o.y+4,o.width-8,mt/2-6,6),t.fillStyle="rgba(255, 255, 255, 0.25)",t.fill()),t.font="bold 40px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="rgba(0, 0, 0, 0.4)",t.fillText(o.label,p+2,g+2),t.fillStyle=i?"#1a1a1a":"#6b7280",t.fillText(o.label,p,g)}else if(h){t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=8,t.shadowOffsetX=2,t.shadowOffsetY=3,t.beginPath(),t.roundRect(o.x,o.y,o.width,mt,8);const S=t.createLinearGradient(o.x,o.y,o.x,o.y+mt);b?(S.addColorStop(0,"#ffd700"),S.addColorStop(.5,"#f5a623"),S.addColorStop(1,"#d4880f")):n?(S.addColorStop(0,"#3a5a7a"),S.addColorStop(.5,"#2a4a6a"),S.addColorStop(1,"#1a3a5a")):(S.addColorStop(0,"#2a4a6a"),S.addColorStop(.5,"#1e3a5a"),S.addColorStop(1,"#152a45")),t.fillStyle=S,t.fill(),t.restore(),t.strokeStyle=b?"#ffd700":n?"#d4af37":"#8b7355",t.lineWidth=b?3:2,t.stroke(),t.beginPath(),t.roundRect(o.x+2,o.y+2,o.width-4,mt-4,6),t.strokeStyle=b?"rgba(0, 0, 0, 0.2)":"rgba(0, 0, 0, 0.3)",t.lineWidth=2,t.stroke(),t.beginPath(),t.roundRect(o.x+3,o.y+3,o.width-6,mt/2-4,5),t.fillStyle=b?"rgba(255, 255, 255, 0.3)":"rgba(255, 255, 255, 0.1)",t.fill(),t.font="bold 28px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="rgba(0, 0, 0, 0.4)",t.fillText(o.label,p+1,g+1),t.fillStyle=b?"#1a1a1a":"#ffffff",t.fillText(o.label,p,g)}else if(m){t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=8,t.shadowOffsetX=2,t.shadowOffsetY=3,t.beginPath(),t.roundRect(o.x,o.y,o.width,mt,8);const S=t.createLinearGradient(o.x,o.y,o.x,o.y+mt);i?(S.addColorStop(0,n?"#dc2626":"#b91c1c"),S.addColorStop(.5,n?"#b91c1c":"#991b1b"),S.addColorStop(1,n?"#991b1b":"#7f1d1d")):(S.addColorStop(0,"#2a2a2a"),S.addColorStop(1,"#1a1a1a")),t.fillStyle=S,t.fill(),t.restore(),t.strokeStyle=i?n?"#f87171":"#d4af37":"#3a3a3a",t.lineWidth=2,t.stroke(),t.beginPath(),t.roundRect(o.x+2,o.y+2,o.width-4,mt-4,6),t.strokeStyle="rgba(0, 0, 0, 0.3)",t.lineWidth=2,t.stroke(),i&&(t.beginPath(),t.roundRect(o.x+3,o.y+3,o.width-6,mt/2-4,5),t.fillStyle="rgba(255, 255, 255, 0.1)",t.fill()),t.font="bold 38px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="rgba(0, 0, 0, 0.4)",t.fillText(o.label,p+1,g+1),t.fillStyle=i?"#ffffff":"#5a5a5a",t.fillText(o.label,p,g)}else if(Y){t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=8,t.shadowOffsetX=2,t.shadowOffsetY=3,t.beginPath(),t.roundRect(o.x,o.y,o.width,mt,8);const S=t.createLinearGradient(o.x,o.y,o.x,o.y+mt);b?(S.addColorStop(0,"#ff6b35"),S.addColorStop(.5,"#e63946"),S.addColorStop(1,"#c1121f")):n?(S.addColorStop(0,"#4a3a3a"),S.addColorStop(.5,"#3a2a2a"),S.addColorStop(1,"#2a1a1a")):(S.addColorStop(0,"#3a3a4a"),S.addColorStop(.5,"#2a2a3a"),S.addColorStop(1,"#1a1a2a")),t.fillStyle=S,t.fill(),t.restore(),t.strokeStyle=b?"#ff4500":n?"#8b5a5a":"#6b5555",t.lineWidth=b?3:2,t.stroke(),t.beginPath(),t.roundRect(o.x+2,o.y+2,o.width-4,mt-4,6),t.strokeStyle=b?"rgba(0, 0, 0, 0.2)":"rgba(0, 0, 0, 0.3)",t.lineWidth=2,t.stroke(),t.beginPath(),t.roundRect(o.x+3,o.y+3,o.width-6,mt/2-4,5),t.fillStyle=b?"rgba(255, 255, 255, 0.3)":"rgba(255, 255, 255, 0.1)",t.fill(),t.font=b?"bold 18px Arial":"bold 24px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="rgba(0, 0, 0, 0.4)",t.fillText(o.label,p+1,g+1),t.fillStyle="#ffffff",t.fillText(o.label,p,g)}else{t.save(),t.shadowColor="rgba(0, 0, 0, 0.5)",t.shadowBlur=8,t.shadowOffsetX=2,t.shadowOffsetY=3,t.beginPath(),t.roundRect(o.x,o.y,o.width,mt,8);const S=t.createLinearGradient(o.x,o.y,o.x,o.y+mt);i?(S.addColorStop(0,n?"#3a5a7a":"#2a4a6a"),S.addColorStop(.5,n?"#2a4a6a":"#1e3a5a"),S.addColorStop(1,n?"#1a3a5a":"#152a45")):(S.addColorStop(0,"#2a2a2a"),S.addColorStop(1,"#1a1a1a")),t.fillStyle=S,t.fill(),t.restore(),t.strokeStyle=i?n?"#d4af37":"#8b7355":"#3a3a3a",t.lineWidth=2,t.stroke(),t.beginPath(),t.roundRect(o.x+2,o.y+2,o.width-4,mt-4,6),t.strokeStyle="rgba(0, 0, 0, 0.3)",t.lineWidth=2,t.stroke(),i&&(t.beginPath(),t.roundRect(o.x+3,o.y+3,o.width-6,mt/2-4,5),t.fillStyle="rgba(255, 255, 255, 0.1)",t.fill()),t.font="bold 38px Arial",t.textAlign="center",t.textBaseline="middle",t.fillStyle="rgba(0, 0, 0, 0.4)",t.fillText(o.label,p+1,g+1),t.fillStyle=i?"#ffffff":"#5a5a5a",t.fillText(o.label,p,g)}}),!this.isSpinning&&this.state.placements.length>0&&!this.pulseAnimationRunning){this.pulseAnimationRunning=!0;const o=()=>{this.state.placements.length>0&&!this.isSpinning?(this.drawRouletteCanvas(),requestAnimationFrame(o)):this.pulseAnimationRunning=!1};requestAnimationFrame(o)}}collectWheelSlice(t,e){const l=[];if(!Array.isArray(this.wheelOrder)||!this.wheelOrder.length||e<=0)return l;for(let d=0;d<e;d+=1){const s=(t+d)%this.wheelOrder.length,u=this.wheelOrder[s];typeof u<"u"&&l.push(String(u))}return l}getNumberColorClass(t){return t==="0"||t==="00"?"green":this.redNumbers.includes(String(t))?"red":"black"}render(){this.shadowRoot.innerHTML=this.template}cacheElements(){this.board=this.shadowRoot.getElementById("rouletteBoard"),this.summaryContainer=this.shadowRoot.getElementById("betSummary"),this.chipTotals=this.shadowRoot.getElementById("chipTotals"),this.chipNotice=this.shadowRoot.getElementById("chipNotice"),this.layout=this.shadowRoot.querySelector(".layout"),this.toastContainer=this.shadowRoot.getElementById("toastContainer"),this.wheelCanvas=this.shadowRoot.getElementById("wheelCanvas"),this.wheelCanvasCtx=this.wheelCanvas?.getContext("2d")||null,this.wheelElement=this.wheelCanvas,this.rouletteCanvas=this.shadowRoot.getElementById("roulette"),this.rouletteCtx=this.rouletteCanvas?.getContext("2d")||null,this.rouletteHoveredZone=null,this.hoveredBoardCell=null,this.historyDialog=this.shadowRoot.getElementById("historyDialog"),this.historyList=this.shadowRoot.getElementById("historyList"),this.historyPagination=this.shadowRoot.getElementById("historyPagination"),this.historyButton=this.shadowRoot.getElementById("historyBtn"),this.historyClose=this.shadowRoot.getElementById("historyClose"),this.logsButton=this.shadowRoot.getElementById("logsBtn"),this.logsDialog=this.shadowRoot.getElementById("logsDialog"),this.logsClose=this.shadowRoot.getElementById("logsClose"),this.logsList=this.shadowRoot.getElementById("logsList"),this.loadingDialog=this.shadowRoot.getElementById("loadingDialogAiState"),this.observeTheme(),this.initGeometryObservers(),this.refreshBetSpotElements(),this.renderCanvasWheel(),this.initRouletteCanvas()}refreshBetSpotElements(){this.betSpotElements.clear(),this.shadowRoot.querySelectorAll(".bet-spot").forEach(t=>{this.betSpotElements.set(t.dataset.betKey,t)})}getNumberButtonMap(){const t=new Map;return this.shadowRoot.querySelectorAll('[data-number-cell="true"]').forEach(e=>{e?.dataset?.number&&t.set(e.dataset.number,e)}),t}bindEvents(){this.board.addEventListener("click",t=>this.handleBoardClick(t)),this.historyButton&&this.historyButton.addEventListener("click",()=>this.openHistoryDialog()),this.historyClose&&this.historyClose.addEventListener("click",()=>this.closeHistoryDialog()),this.logsButton&&this.logsButton.addEventListener("click",()=>this.openLogsDialog()),this.logsClose&&this.logsClose.addEventListener("click",()=>this.closeLogsDialog()),this.historyDialog&&(this.historyDialog.addEventListener("cancel",t=>{t.preventDefault(),this.closeHistoryDialog()}),this.attachDialogBackdropClose(this.historyDialog,()=>this.closeHistoryDialog())),this.logsDialog&&(this.logsDialog.addEventListener("cancel",t=>{t.preventDefault(),this.closeLogsDialog()}),this.attachDialogBackdropClose(this.logsDialog,()=>this.closeLogsDialog())),this.historyPagination&&this.historyPagination.addEventListener("click",t=>this.handleHistoryPagination(t))}handleBoardClick(t){if(this.isSpinning)return;const e=t.target.closest(".bet-spot");if(!e)return;if(this.removeMode){this.removeLastChipFromSpot(e.dataset.betKey);return}const l={type:e.dataset.type,value:e.dataset.value||null,targets:e.dataset.targets?JSON.parse(e.dataset.targets):[],label:e.dataset.label||"",key:e.dataset.betKey,tokens:1,multiplier:this.currentChipValue};if(this.state.placements.filter(s=>s.key===l.key).length>=this.maxTokens){this.pushLog(`Maximum ${this.maxTokens} chips allowed on ${l.label}.`);return}this.undoStack.push({placements:JSON.parse(JSON.stringify(this.state.placements)),activeMultiplier:this.activeMultiplier,betMultiplier:this.betMultiplier}),this.redoStack=[],this.state.placements.push(l),this.dismissToastByReason("chips-required"),this.updateSummary(),this.updateBoardStacks(),this.drawRouletteCanvas()}removeLastChipFromSpot(t){const e=t.replace("straight-","");let l=-1,d=null;for(let s=this.state.placements.length-1;s>=0;s--){const u=this.state.placements[s];if(u.key===t||u.targets&&u.targets.includes(e)){l=s,d=u;break}}if(l!==-1&&d){this.undoStack.push({placements:JSON.parse(JSON.stringify(this.state.placements)),activeMultiplier:this.activeMultiplier,betMultiplier:this.betMultiplier}),this.redoStack=[];const s=d.type;if((s==="sector"||s==="range"||s==="parity"||s==="color"||s==="dozen"||s==="column")&&d.targets&&d.targets.length>1){const C=d.targets.filter(r=>r!==e),a=d.multiplier;this.state.placements.splice(l,1),C.forEach(r=>{this.state.placements.push({type:"straight",value:r,targets:[r],label:r,key:`straight-${r}`,tokens:1,multiplier:a})})}else this.state.placements.splice(l,1);this.updateSummary(),this.updateBoardStacks(),this.drawRouletteCanvas()}}openHistoryDialog(){this.historyDialog&&(this.historyDialog.showModal(),this.lockPageScroll(),this.historyList&&(this.historyList.innerHTML='<div class="history-loading"><div class="ripple"><div></div><div></div></div></div>'),this.fetchHistory(1))}closeHistoryDialog(){this.historyDialog?.open&&this.historyDialog.close(),this.unlockPageScroll()}openLogsDialog(){this.logsDialog&&(this.logsDialog.showModal(),this.lockPageScroll())}closeLogsDialog(){this.logsDialog?.open&&this.logsDialog.close(),this.unlockPageScroll()}handleHistoryPagination(t){const e=t.target.closest("button[data-page]");if(!e||e.disabled)return;const l=parseInt(e.dataset.page,10);l>0&&this.fetchHistory(l)}async fetchHistory(t=1){if(!this.history?.busy){this.history.busy=!0;try{this.scrollWheelIntoView();const e=await this.getRequest(this.endpoints.history,{page:t});this.renderHistory(e.data)}catch(e){this.pushLog(e)}finally{this.history.busy=!1}}}renderHistory(t){if(!this.historyList)return;const e=t?.history||[];e.length?this.historyList.innerHTML=`
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
			</tr>`}const s=l.bets.slice(0,2).map(u=>u.label||u.targets?.join("/")||u.value||u.type).join(", ");return`<tr class="history-row history-row-game">
			<td>Game</td>
			<td>#${t.result_number} <small>${s||""}</small></td>
			<td>${this.formatCurrency(t.total_stake||0)}</td>
			<td>${this.formatCurrency(t.payout||0)}</td>
			<td>${d.toLocaleString()}</td>
		</tr>`}renderHistoryPagination(t,e){if(!this.historyPagination)return;const l=Math.max(1,t-1),d=Math.min(e,t+1);this.historyPagination.innerHTML=`
			<button type="button" data-page="${l}" ${t<=1?"disabled":""}>Prev</button>
			<span>Page ${t} / ${e}</span>
			<button type="button" data-page="${d}" ${t>=e?"disabled":""}>Next</button>
		`}async handleSpin(){if(this.isSpinning)return;if(!this.state.placements.length){this.showToast("You need to add at least one chip to board if you want to play.",{reason:"chips-required"}),this.pushLog("Place at least one chip on the board.");return}this.lastBet=JSON.parse(JSON.stringify(this.state.placements)),this.undoStack=[],this.redoStack=[];const t=this.getTotalStake();if(t>this.state.credits){this.showToast(`Not enough credits. Stake ${this.formatCurrency(t)} exceeds your ${this.formatCurrency(this.state.credits)} balance.`);return}const e={bets:this.state.placements,bet_multiplier:this.betMultiplier||1};this.setSpinning(!0),this.winningDisplayState="spinning",this.drawRouletteCanvas();try{this.scrollWheelIntoView();const l=await this.postRequest(this.endpoints.spin,e),{number:d,color:s,parity:u,winnings:C,credits:a}=l.data;await this.animateWheel(d),this.lastWinningNumber=d,this.lastWonCredits=C,this.winningDisplayState="result",this.winningHistory.unshift(d),this.winningHistory.length>20&&this.winningHistory.pop(),this.drawRouletteCanvas(),this.state.credits=a,this.updateCredits(),this.pushLog(`Result ${d} (${s}), winnings ${this.formatCurrency(C)}`),this.clearPlacements()}catch(l){this.pushLog(l),this.showToast(l?.message||"Spin failed. Please try again.")}finally{this.setSpinning(!1)}}scrollWheelIntoView(){this.wheelElement&&this.wheelElement.scrollIntoView({behavior:"smooth",block:"center"})}openLoadingDialog(){this.loadingDialog&&(this.loadingDialog.classList.add("visible"),this.loadingDialog.setAttribute("aria-hidden","false"))}closeLoadingDialog(){this.loadingDialog&&(this.loadingDialog.classList.remove("visible"),this.loadingDialog.setAttribute("aria-hidden","true"))}lockPageScroll(){!document||!document.body||(this.bodyOverflowBackup||(this.bodyOverflowBackup=document.body.style.overflow||""),document.body.style.overflow="hidden")}unlockPageScroll(){!document||!document.body||(this.bodyOverflowBackup!==void 0?(document.body.style.overflow=this.bodyOverflowBackup,this.bodyOverflowBackup=void 0):document.body.style.overflow="")}recalculateBoardGeometry(t=!1){this.updateBoardStacks()}initGeometryObservers(){}observeTheme(){const t=()=>{!!document.head.querySelector("link#theme-style")?this.layout?.classList.add("dark"):this.layout?.classList.remove("dark")};t(),this.themeObserver||(this.themeObserver=new MutationObserver(t),this.themeObserver.observe(document.head,{childList:!0,subtree:!0}))}attachDialogBackdropClose(t,e){!t||typeof e!="function"||t.addEventListener("click",l=>{l.target===t&&e()})}setSpinning(t){this.isSpinning=t,t?this.swapDisabledState(!0):this.swapDisabledState(!1)}swapDisabledState(t){t?this.board.classList.add("disabled"):this.board.classList.remove("disabled"),this.drawRouletteCanvas()}updateCredits(){this.maybeShowNoCreditsToast(),this.drawRouletteCanvas()}updateChipSelector(){this.drawRouletteCanvas()}updateSummary(){const t={};this.state.placements.forEach(l=>{t[l.key]||(t[l.key]={label:l.label,type:l.type,value:l.value,targets:l.targets,sectorSize:l.sectorSize||(l.targets?l.targets.length:0),sectorKey:l.sectorKey||null,chips:0,amount:0,totalValue:0,lastMultiplier:l.multiplier,breakdown:{}});const d=t[l.key];d.chips+=l.tokens;const u=l.type==="sector"&&l.sectorSize||1;d.amount+=l.tokens*l.multiplier*u,d.totalValue+=l.tokens*l.multiplier*u,d.lastMultiplier=l.multiplier,d.type=l.type||d.type,d.value=l.value??d.value,d.targets=l.targets||d.targets,l.sectorSize&&(d.sectorSize=l.sectorSize,d.sectorKey=l.sectorKey||d.sectorKey),d.breakdown[l.multiplier]=(d.breakdown[l.multiplier]||0)+l.tokens}),this.summary=t;const e=Object.entries(t);e.length?(this.summaryContainer.innerHTML=e.map(([l,d])=>`
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
			`).join(""),this.summaryContainer.querySelectorAll("button[data-key]").forEach(l=>{l.addEventListener("click",()=>this.removePlacement(l.dataset.key))}),this.updateChipTotals(e)):(this.summaryContainer.innerHTML='<div class="empty">No chips placed.</div>',this.chipTotals&&(this.chipTotals.textContent="No chip totals yet.")),this.updateChipNotice(),this.updateBoardStacks()}updateChipTotals(t){if(!this.chipTotals)return;if(!t.length){this.chipTotals.textContent="No chip totals yet.";return}const e={};t.forEach(([C,a])=>{const r=a.breakdown||{},f=C.startsWith("sector-")&&a.sectorSize?a.sectorSize:1;Object.entries(r).forEach(([I,M])=>{const dt=M*f;e[I]=(e[I]||0)+dt})});const d=t.reduce((C,[,a])=>C+a.totalValue,0)*(this.betMultiplier||1),s=this.betMultiplier>1?` (${this.activeMultiplier})`:"",u=Object.entries(e).sort((C,a)=>parseInt(C[0],10)-parseInt(a[0],10)).map(([C,a])=>{const r=this.getChipColor(C);return`<tr>
					<td>${a} ${a===1?"chip":"chips"}</td>
					<td class="chip-table-cell">
						<span class="chip-table-face chip-face" data-chip="${C}" style="--chip-color:${r}">
							<span>${C}x</span>
						</span>
					</td>
				</tr>`}).join("");this.chipTotals.innerHTML=`
			<table>
				<thead><tr><th>Quantity</th><th>Multiplier</th></tr></thead>
				<tbody>${u}</tbody>
				<tfoot><tr><td>Total stake${s}:</td><td id="totalStakeValue">${Math.round(d)}</td></tr></tfoot>
			</table>
		`}renderSummaryLabel(t={}){if(t?.type==="sector"){const u=t?.sectorSize||t?.targets?.length||0,a=(t?.targets||[]).map(r=>{let c="black";return r==="0"||r==="00"?c="green":this.redNumbers.includes(String(r))&&(c="red"),`<span class="summary-token ${c}">${r}</span>`}).join("");return`<span class="summary-sector">${this.escapeHtml(t.label||"Sector")}<small>${u} numbers</small></span><div class="summary-number-group">${a}</div>`}const e=String(t?.label??"").trim();if(!e)return'<span class="summary-label-text">Bet</span>';const l=e.split("/").map(u=>u.trim()).filter(Boolean),d=/^(0|00|[1-9]\d?)$/;if(l.length>0&&l.every(u=>d.test(u))){const u=l.map(C=>{let a="black";return C==="0"||C==="00"?a="green":this.redNumbers.includes(C)&&(a="red"),`<span class="summary-token ${a}">${C}</span>`}).join("");return l.length>1?`<div class="summary-number-group">${u}</div>`:u}return`<span class="summary-label-text">${this.escapeHtml(e||"Bet")}</span>`}renderChipBreakdown(t){const e=t?.breakdown||{},l=Object.entries(e),d=Math.round(t?.totalValue||0);return l.length?`<div class="summary-chip-group">
			${l.sort((u,C)=>parseInt(u[0],10)-parseInt(C[0],10)).map(([u,C])=>{const a=this.getChipColor(u);return`<span class="chip-pill" aria-label="${C} chips at ${u}x">
					<span class="chip-pill-count">${C}×</span>
					<span class="chip-pill-value chip-face" data-chip="${u}" style="--chip-color:${a}">
						<span>${u}x</span>
					</span>
				</span>`}).join("")}
			<span class="summary-chip-total">${d} credits</span>
		</div>`:`<div class="summary-chip-group"><span class="summary-chip-total">${d} credits</span></div>`}getChipColor(t){const e={1:"#f59e0b",2:"#f97316",5:"#dc2626",10:"#16a34a",20:"#2563eb",30:"#7c3aed",50:"#0891b2",100:"#1f2937",200:"#1d4ed8",500:"#7e22ce"};return e[t]||e[String(t)]||"#475569"}updateChipNotice(){this.chipNotice.textContent=`Total chips: ${this.state.placements.length} (max ${this.maxTokens} per field)`}getTotalStake(){return this.state.placements.reduce((e,l)=>e+l.tokens*l.multiplier,0)*(this.betMultiplier||1)}maybeShowNoCreditsToast(){Number(this.state?.credits||0)<=0?this.noCreditReminderShown||(this.showToast("Please add credits to play."),this.noCreditReminderShown=!0):this.noCreditReminderShown=!1}showToast(t="Not enough credits for this bet.",e={}){const l=this.toastContainer??this.createToastContainer(),d=document.createElement("div");d.className="toast-message",d.textContent=t,e.reason&&(d.dataset.reason=e.reason),l.appendChild(d);const s=()=>{d.classList.add("exit");const u=C=>{C.animationName==="toastOut"&&(d.removeEventListener("animationend",u),d.remove())};d.addEventListener("animationend",u)};return e.persist?d.removeTimeout=setTimeout(s,e.persist):d.removeTimeout=setTimeout(s,6e3),d.dismiss=s,d}dismissToastByReason(t){!this.toastContainer||!t||this.toastContainer.querySelectorAll(`.toast-message[data-reason="${t}"]`).forEach(e=>{e.removeTimeout&&clearTimeout(e.removeTimeout),typeof e.dismiss=="function"?e.dismiss():(e.classList.add("exit"),setTimeout(()=>e.remove(),300))})}createToastContainer(){const t=document.createElement("div");return t.className="toast-container",this.shadowRoot.appendChild(t),this.toastContainer=t,t}updateBoardStacks(){const t=JSON.parse(JSON.stringify(this.summary||{}));this.pendingStacks=t,this.boardStackRaf&&cancelAnimationFrame(this.boardStackRaf),this.boardStackRaf=requestAnimationFrame(()=>{this.boardStackRaf=null,this.applyBoardStacks(t)})}applyBoardStacks(t=null){const e=t||this.pendingStacks||this.summary||{},l=new Map;this.state.placements.forEach(d=>{const s=d.targets||[],u=d.multiplier;if(d.type==="sector"&&s.length>0){const r=u;s.forEach(c=>{const f=`straight-${c}`;l.has(f)||l.set(f,{totalValue:0,lastMultiplier:u,chips:0});const I=l.get(f);I.totalValue+=r,I.lastMultiplier=u,I.chips+=1})}}),this.betSpotElements.forEach((d,s)=>{const u=d.querySelector(".chip-stack");if(!u)return;const C=e[s],a=l.get(s);s.startsWith("column-")||s.startsWith("dozen-")||s.startsWith("range-")||s.startsWith("parity-")||s.startsWith("color-");let r=0,c=0,f=1;if(a?(r=a.chips,c=a.totalValue,f=a.lastMultiplier):C&&(r=C.chips,c=C.totalValue,f=C.lastMultiplier),r>0){const I=`<span class="chip-token" data-chip="${f}" title="${r} chip(s)">${Math.round(c)}</span>`;u.innerHTML=I,u.hidden=!1}else u.innerHTML="",u.hidden=!0}),this.pendingStacks=null,this.drawRouletteCanvas()}removePlacement(t){this.state.placements=this.state.placements.filter(e=>e.key!==t),this.updateSummary()}clearPlacements(){this.state.placements=[],this.updateSummary()}updateLogs(){if(this.logsList){if(!this.state.logs.length){this.logsList.innerHTML='<p class="empty">No spins yet.</p>';return}this.logsList.innerHTML=`
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
		`}}pushLog(t){const e=this.normalizeLogMessage(t);this.state.logs.unshift({message:e,timestamp:Date.now()}),this.state.logs=this.state.logs.slice(0,20),this.updateLogs()}normalizeLogMessage(t){if(typeof t=="string")return t;if(t instanceof Error&&t.message)return t.message;if(t&&typeof t=="object"&&t.message)return String(t.message);if(t&&typeof t=="object")try{return this.scrollWheelIntoView(),JSON.stringify(t)}catch{return String(t)}return String(t??"")}escapeHtml(t){return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}async animateWheel(t){if(!this.wheelCanvas||!this.wheelCanvasCtx)return;const e=String(t),l=this.wheelOrder.indexOf(e);if(l===-1)return;this.clearBall(),this.ballLanded=!1;const d=this.wheelCanvas,s=d.clientWidth||600,u=d.clientHeight||600,C=s/2,a=u/2,r=Math.min(C,a)-4;if(r<50)return;const c=r/300,f=r*.96,dt=f*.85*.84*.98,P=f*.98,B=dt*.96,j=this.wheelOrder.length,Pt=Math.PI*2/j,It=Math.random()*Math.PI*2,Ct=(this.wheelRotation||0)+It,St=3e3,Ot=5e3,Tt=1e4,rt=Math.PI*1.9,et=.09,at=Math.PI*3.5,N=.95,wt=performance.now();let Z=null,nt=null,Q=!1,vt=!1,D=0,ht=at,V=P;const Xt=($t,ft)=>{let it=$t-ft+Math.PI/2+3.75*Math.PI/180;return it=(it%(Math.PI*2)+Math.PI*2)%(Math.PI*2),Math.floor(it/Pt)%j};return this.wheelAnimating=!0,new Promise($t=>{const ft=it=>{if(vt)return;const kt=it-wt,Yt=kt/1e3,Kt=rt*Math.exp(-et*Yt),Bt=Ct+rt/et*(1-Math.exp(-et*Yt));if(this.wheelRotation=Bt,kt>=St&&!this.ballLanded){Z===null&&(Z=it,D=Math.random()*Math.PI*2,ht=at,this.ballVisible=!0);const yt=(it-Z)/1e3;ht=at*Math.exp(-.33*yt),D-=ht*.04;const q=ht/at;if(q<.4){const k=(.4-q)/.4;V=P-(P-B)*(k*k)}ht<N&&V<=B+10*c&&Xt(D,Bt)===l&&(this.ballLanded=!0,nt=it,V=B,this.ballAngleOffset=D-Bt),this.ballAngle=D,this.ballRadiusRatio=V/r}if(this.ballLanded&&nt){const yt=it-nt;this.ballAngle=this.wheelRotation+this.ballAngleOffset;const q=800,k=25*c;let y=0;if(yt<q){const gt=yt/q;if(gt<.4)y=gt/.4*k;else if(gt<.55){const T=(gt-.4)/.15;y=k-5*c*Math.sin(T*Math.PI)}else if(gt<.7)y=k;else if(gt<.85){const T=(gt-.7)/.15;y=k-3*c*Math.sin(T*Math.PI)}else y=k}else y=k;if(this.ballRadiusRatio=(B-y)/r,yt>=Ot&&!Q&&(Q=!0,$t()),yt>=Tt){this.pocketAnimStartTime===null&&(this.ballStartRadiusForAnim=this.ballRadiusRatio*r,this.pocketAnimStartTime=it,this.pocketAnimActive=!0,this.highlightedPocket=l);const gt=it-this.pocketAnimStartTime,T=400,v=1500,_=400,w=T,G=T+v,A=T+v+_;if(gt<=T){const x=Math.min(gt/T,1);this.pocketOpenProgress=1-Math.pow(1-x,2),this.ballRadiusRatio=this.ballStartRadiusForAnim/r,this.ballScale=1,this.ballOpacity=1}else if(gt<=G){this.pocketOpenProgress=1;const x=Math.min((gt-w)/v,1),tt=x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2,U=this.ballStartRadiusForAnim,z=B*.1;this.ballRadiusRatio=(U-(U-z)*tt)/r,this.ballScale=1-tt*.7,this.ballOpacity=1-tt*.9,x>=.99&&(this.ballVisible=!1)}else if(gt<=A){this.ballVisible=!1;const x=Math.min((gt-G)/_,1),tt=1-Math.pow(1-x,2);this.pocketOpenProgress=1-tt}else this.pocketAnimActive&&(this.pocketOpenProgress=0,this.highlightedPocket=-1,this.pocketAnimActive=!1,this.ballScale=1,this.ballOpacity=1);!this.ballVisible&&!this.wheelSlowdownStart&&(this.wheelSlowdownStart=it,this.wheelSpeedAtBallGone=Kt,this.wheelAngleAtBallGone=Bt)}}if(this.wheelSlowdownStart){const yt=(it-this.wheelSlowdownStart)/1e3,q=2,k=this.wheelSpeedAtBallGone*Math.exp(-q*yt),y=this.wheelSpeedAtBallGone/q*(1-Math.exp(-q*yt));if(this.wheelRotation=this.wheelAngleAtBallGone+y,k<.01){this.wheelSlowdownStart=null,vt=!0,this.wheelAnimating=!1,this.renderCanvasWheel(),$t();return}}this.renderCanvasWheel(),requestAnimationFrame(ft)};requestAnimationFrame(ft)})}formatCurrency(t){return`${Number(t).toFixed(2)} credits`}async postRequest(t,e={}){const l={"Content-Type":"application/json"};this.csrfToken&&(l["X-CSRF-TOKEN"]=this.csrfToken);const s=await(await fetch(t,{method:"POST",headers:l,body:JSON.stringify(e)})).json();if(!s.success){const u=s?.message||s?.data?.message||"Something went wrong.";throw new Error(u)}return s}async getRequest(t,e={}){const l=new URLSearchParams(e).toString(),d=l?`${t}?${l}`:t,s={};this.csrfToken&&(s["X-CSRF-TOKEN"]=this.csrfToken);const C=await(await fetch(d,{method:"GET",headers:s})).json();if(!C.success){const a=C?.message||C?.data?.message||"Something went wrong.";throw new Error(a)}return C}}customElements.get("mini-roulette")||customElements.define("mini-roulette",Be),console.log("[ROULETTE] Web component registered")})();
