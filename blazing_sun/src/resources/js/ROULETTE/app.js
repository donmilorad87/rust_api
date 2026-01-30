(function(){"use strict";class o{constructor(t,e={}){this.container=t,this.options=e,this.totalSeconds=120,this.currentSeconds=120,this.phase="betting",this.blockBets=!1,this.circumference=2*Math.PI*80,this.render()}render(){this.container.innerHTML=`
            <div class="countdown-timer">
                <div class="countdown-timer__circle">
                    <svg viewBox="0 0 180 180">
                        <circle
                            class="countdown-timer__track"
                            cx="90"
                            cy="90"
                            r="80"
                        />
                        <circle
                            id="countdown-progress"
                            class="countdown-timer__progress"
                            cx="90"
                            cy="90"
                            r="80"
                            stroke-dasharray="${this.circumference}"
                            stroke-dashoffset="0"
                        />
                    </svg>
                    <div class="countdown-timer__content">
                        <div id="countdown-seconds" class="countdown-timer__seconds">${this.currentSeconds}</div>
                        <div id="countdown-label" class="countdown-timer__label">seconds</div>
                        <div id="countdown-blocked" class="countdown-timer__blocked-text" style="display: none;">NO MORE BETS</div>
                        <div id="countdown-phase" class="countdown-timer__phase">${this.getPhaseLabel()}</div>
                    </div>
                </div>
            </div>
        `,this.progressEl=document.getElementById("countdown-progress"),this.secondsEl=document.getElementById("countdown-seconds"),this.labelEl=document.getElementById("countdown-label"),this.blockedEl=document.getElementById("countdown-blocked"),this.phaseEl=document.getElementById("countdown-phase")}update(t,e,s){if(this.currentSeconds=t,this.phase=e,this.blockBets=s,this.secondsEl&&(this.secondsEl.textContent=t,s?this.secondsEl.classList.add("countdown-timer__seconds--danger"):this.secondsEl.classList.remove("countdown-timer__seconds--danger")),this.progressEl){const n=t/this.totalSeconds,i=this.circumference*(1-n);this.progressEl.style.strokeDashoffset=i,this.progressEl.classList.remove("countdown-timer__progress--warning","countdown-timer__progress--danger"),s?this.progressEl.classList.add("countdown-timer__progress--danger"):t<=30&&this.progressEl.classList.add("countdown-timer__progress--warning")}this.blockedEl&&(this.blockedEl.style.display=s?"block":"none"),this.labelEl&&(this.labelEl.style.display=s?"none":"block"),this.phaseEl&&(this.phaseEl.textContent=this.getPhaseLabel()),t===5&&this.options.onComplete&&this.options.onComplete()}getPhaseLabel(){switch(this.phase){case"betting":return"Place your bets";case"animation":return"No more bets";case"spinning":return"Spinning...";case"payout":return"Calculating payouts";default:return""}}reset(){this.update(this.totalSeconds,"betting",!1)}}class r{constructor(t,e=[]){this.container=t,this.history=e.slice(0,20),this.maxItems=20,this.render()}render(){const t=this.history.length===0;this.container.innerHTML=`
            <div class="spin-history ${t?"spin-history--empty":""}">
                <div class="spin-history__header">
                    <span class="spin-history__title">Recent Results</span>
                    <span class="spin-history__count">${this.history.length} / ${this.maxItems}</span>
                </div>
                <div class="spin-history__bar" id="history-bar">
                    ${t?this.renderEmpty():this.renderItems()}
                </div>
            </div>
        `,this.barEl=document.getElementById("history-bar")}renderEmpty(){return'<span class="spin-history__empty-text">No spins yet</span>'}renderItems(){return this.history.map(t=>this.renderItem(t)).join("")}renderItem(t,e=!1){return`
            <div class="spin-history__item spin-history__item--${this.getColorClass(t.winning_color)} ${e?"spin-history__item--new":""}"
                 title="${t.winning_color}"
                 data-spin-id="${t.spin_id}">
                ${t.winning_number}
            </div>
        `}getColorClass(t){switch(t?.toLowerCase()){case"red":return"red";case"black":return"black";case"green":return"green";default:return"black"}}addSpin(t){if(this.history.unshift(t),this.history.length>this.maxItems&&this.history.pop(),this.barEl){this.barEl.querySelector(".spin-history__empty-text")&&(this.barEl.innerHTML="");const s=this.renderItem(t,!0);this.barEl.insertAdjacentHTML("afterbegin",s);const n=this.barEl.querySelectorAll(".spin-history__item");n.length>this.maxItems&&n[n.length-1].remove();const i=this.container.querySelector(".spin-history__count");i&&(i.textContent=`${this.history.length} / ${this.maxItems}`)}}setHistory(t){this.history=t.slice(0,this.maxItems),this.render()}getHistory(){return this.history}clear(){this.history=[],this.render()}}class l{constructor(t,e={}){this.container=t,this.options=e,this.balance=e.balance||0,this.bets=[],this.currentBetAmount=1e3,this.disabled=!1,this.numbers=["0","00",...Array.from({length:36},(s,n)=>String(n+1))],this.redNumbers=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36],this.blackNumbers=[2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35],this.render()}render(){this.container.innerHTML=`
            <div class="bet-manager ${this.disabled?"bet-manager--disabled":""}">
                <div class="bet-manager__controls">
                    <div class="bet-manager__amount-selector">
                        <button class="bet-manager__chip" data-amount="1000">1</button>
                        <button class="bet-manager__chip bet-manager__chip--selected" data-amount="5000">5</button>
                        <button class="bet-manager__chip" data-amount="10000">10</button>
                        <button class="bet-manager__chip" data-amount="25000">25</button>
                        <button class="bet-manager__chip" data-amount="50000">50</button>
                        <button class="bet-manager__chip" data-amount="100000">100</button>
                    </div>
                    <button class="bet-manager__clear" id="clear-bets">Clear All</button>
                </div>

                <div class="bet-manager__table">
                    <!-- Quick bets row -->
                    <div class="bet-manager__quick-bets">
                        <button class="bet-manager__quick-bet" data-bet-type="red">Red</button>
                        <button class="bet-manager__quick-bet" data-bet-type="black">Black</button>
                        <button class="bet-manager__quick-bet" data-bet-type="odd">Odd</button>
                        <button class="bet-manager__quick-bet" data-bet-type="even">Even</button>
                        <button class="bet-manager__quick-bet" data-bet-type="low">1-18</button>
                        <button class="bet-manager__quick-bet" data-bet-type="high">19-36</button>
                    </div>

                    <!-- Dozens row -->
                    <div class="bet-manager__dozens">
                        <button class="bet-manager__dozen" data-bet-type="first_dozen">1st 12</button>
                        <button class="bet-manager__dozen" data-bet-type="second_dozen">2nd 12</button>
                        <button class="bet-manager__dozen" data-bet-type="third_dozen">3rd 12</button>
                    </div>

                    <!-- Columns row -->
                    <div class="bet-manager__columns">
                        <button class="bet-manager__column" data-bet-type="first_column">2:1</button>
                        <button class="bet-manager__column" data-bet-type="second_column">2:1</button>
                        <button class="bet-manager__column" data-bet-type="third_column">2:1</button>
                    </div>

                    <!-- Numbers grid -->
                    <div class="bet-manager__numbers-grid">
                        <button class="bet-manager__number bet-manager__number--green" data-number="0">0</button>
                        <button class="bet-manager__number bet-manager__number--green" data-number="00">00</button>
                        ${this.renderNumberButtons()}
                    </div>
                </div>
            </div>
        `,this.attachEventListeners()}renderNumberButtons(){return Array.from({length:36},(t,e)=>{const s=e+1;return`<button class="bet-manager__number bet-manager__number--${this.redNumbers.includes(s)?"red":"black"}" data-number="${s}">${s}</button>`}).join("")}attachEventListeners(){this.container.querySelectorAll(".bet-manager__chip").forEach(t=>{t.addEventListener("click",e=>{this.disabled||this.selectChip(e.target,parseInt(e.target.dataset.amount))})}),document.getElementById("clear-bets")?.addEventListener("click",()=>{this.disabled||this.clearBets()}),this.container.querySelectorAll(".bet-manager__quick-bet").forEach(t=>{t.addEventListener("click",e=>{this.disabled||this.placeQuickBet(e.target.dataset.betType)})}),this.container.querySelectorAll(".bet-manager__dozen").forEach(t=>{t.addEventListener("click",e=>{this.disabled||this.placeBet(e.target.dataset.betType,this.getDozenNumbers(e.target.dataset.betType))})}),this.container.querySelectorAll(".bet-manager__column").forEach(t=>{t.addEventListener("click",e=>{this.disabled||this.placeBet(e.target.dataset.betType,this.getColumnNumbers(e.target.dataset.betType))})}),this.container.querySelectorAll(".bet-manager__number").forEach(t=>{t.addEventListener("click",e=>{this.disabled||this.placeBet("straight",[e.target.dataset.number])})})}selectChip(t,e){this.container.querySelectorAll(".bet-manager__chip").forEach(s=>{s.classList.remove("bet-manager__chip--selected")}),t.classList.add("bet-manager__chip--selected"),this.currentBetAmount=e}placeQuickBet(t){let e=[];switch(t){case"red":e=this.redNumbers.map(String);break;case"black":e=this.blackNumbers.map(String);break;case"odd":e=Array.from({length:18},(s,n)=>String(n*2+1));break;case"even":e=Array.from({length:18},(s,n)=>String((n+1)*2));break;case"low":e=Array.from({length:18},(s,n)=>String(n+1));break;case"high":e=Array.from({length:18},(s,n)=>String(n+19));break}this.placeBet(t,e)}getDozenNumbers(t){switch(t){case"first_dozen":return Array.from({length:12},(e,s)=>String(s+1));case"second_dozen":return Array.from({length:12},(e,s)=>String(s+13));case"third_dozen":return Array.from({length:12},(e,s)=>String(s+25));default:return[]}}getColumnNumbers(t){switch(t){case"first_column":return[3,6,9,12,15,18,21,24,27,30,33,36].map(String);case"second_column":return[2,5,8,11,14,17,20,23,26,29,32,35].map(String);case"third_column":return[1,4,7,10,13,16,19,22,25,28,31,34].map(String);default:return[]}}placeBet(t,e){if(this.currentBetAmount>this.balance-this.getTotalBetAmount()){this.showError("Insufficient balance");return}const s=this.bets.findIndex(n=>n.bet_type===t&&JSON.stringify(n.numbers.sort())===JSON.stringify(e.sort()));s>=0?this.bets[s].amount+=this.currentBetAmount:this.bets.push({bet_type:t,numbers:e,amount:this.currentBetAmount}),this.notifyBetsChange()}clearBets(){this.bets=[],this.notifyBetsChange()}getBets(){return this.bets}getTotalBetAmount(){return this.bets.reduce((t,e)=>t+e.amount,0)}setBalance(t){this.balance=t}setPendingBets(t){this.bets=t||[],this.notifyBetsChange()}confirmBet(t){this.disable()}reset(){this.bets=[],this.notifyBetsChange()}enable(){this.disabled=!1,this.container.querySelector(".bet-manager")?.classList.remove("bet-manager--disabled")}disable(){this.disabled=!0,this.container.querySelector(".bet-manager")?.classList.add("bet-manager--disabled")}notifyBetsChange(){this.options.onBetsChange&&this.options.onBetsChange(this.bets)}showError(t){console.warn(t)}}class c{constructor(t){this.container=t,this.isSpinning=!1,this.render()}render(){this.container.innerHTML=`
            <div class="wheel-animation__wheel" id="wheel"></div>
            <div class="wheel-animation__ball" id="ball"></div>
            <div class="wheel-animation__result" id="result">
                <div class="wheel-animation__number" id="result-number"></div>
                <div class="wheel-animation__color" id="result-color"></div>
            </div>
        `,this.wheelEl=document.getElementById("wheel"),this.ballEl=document.getElementById("ball"),this.resultEl=document.getElementById("result"),this.numberEl=document.getElementById("result-number"),this.colorEl=document.getElementById("result-color")}spin(t,e,s){if(this.isSpinning)return;this.isSpinning=!0,this.container.classList.add("wheel-animation--active");const n=this.getNumberAngle(t),u=5*360+n;this.wheelEl&&(this.wheelEl.style.transform=`rotate(${u}deg)`),setTimeout(()=>{this.showResult(t,e)},5e3),setTimeout(()=>{this.hide(),this.isSpinning=!1,s&&s()},8e3)}getNumberAngle(t){const s=["0","28","9","26","30","11","7","20","32","17","5","22","34","15","3","24","36","13","1","00","27","10","25","29","12","8","19","31","18","6","21","33","16","4","23","35","14","2"].indexOf(String(t));if(s===-1)return 0;const n=360/38;return s*n}showResult(t,e){this.numberEl&&(this.numberEl.textContent=t,this.numberEl.className="wheel-animation__number",e?.toLowerCase()==="red"?this.numberEl.classList.add("wheel-animation__number--red"):e?.toLowerCase()==="green"&&this.numberEl.classList.add("wheel-animation__number--green")),this.colorEl&&(this.colorEl.textContent=e||""),this.resultEl&&this.resultEl.classList.add("wheel-animation__result--visible")}hide(){this.container.classList.remove("wheel-animation--active"),this.resultEl&&this.resultEl.classList.remove("wheel-animation__result--visible"),this.wheelEl&&(this.wheelEl.style.transition="none",this.wheelEl.style.transform="rotate(0deg)",this.wheelEl.offsetHeight,this.wheelEl.style.transition="")}showPreview(t,e){this.container.classList.add("wheel-animation--active"),this.showResult(t,e)}}class h{constructor(t,e={}){this.container=t,this.options=e,this.messages=[],this.maxMessages=100,this.optedOut=!1,this.collapsed=!1,this.render()}render(){this.container.innerHTML=`
            <div class="roulette-chat ${this.collapsed?"roulette-chat--collapsed":""}">
                <div class="roulette-chat__header">
                    <div class="roulette-chat__title">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                        </svg>
                        Chat
                    </div>
                    <button
                        class="roulette-chat__toggle ${this.optedOut?"roulette-chat__toggle--opted-out":""}"
                        id="chat-opt-out-toggle"
                    >
                        ${this.optedOut?"Muted":"Mute"}
                    </button>
                </div>

                <div class="roulette-chat__messages" id="chat-messages">
                    ${this.messages.length===0?'<div class="roulette-chat__empty">No messages yet</div>':""}
                </div>

                <div class="roulette-chat__input-area">
                    <input
                        type="text"
                        class="roulette-chat__input"
                        id="chat-input"
                        placeholder="Type a message..."
                        maxlength="500"
                        ${this.optedOut?"disabled":""}
                    />
                    <button class="roulette-chat__send" id="chat-send" ${this.optedOut?"disabled":""}>
                        Send
                    </button>
                </div>
            </div>
        `,this.messagesEl=document.getElementById("chat-messages"),this.inputEl=document.getElementById("chat-input"),this.sendBtn=document.getElementById("chat-send"),this.toggleBtn=document.getElementById("chat-opt-out-toggle"),this.attachEventListeners()}attachEventListeners(){this.sendBtn?.addEventListener("click",()=>this.sendMessage()),this.inputEl?.addEventListener("keypress",t=>{t.key==="Enter"&&!t.shiftKey&&(t.preventDefault(),this.sendMessage())}),this.toggleBtn?.addEventListener("click",()=>this.toggleOptOut())}sendMessage(){if(this.optedOut||!this.inputEl)return;const t=this.inputEl.value.trim();t&&(this.inputEl.value="",this.options.onSendMessage&&this.options.onSendMessage(t))}toggleOptOut(){this.optedOut=!this.optedOut,this.toggleBtn&&(this.toggleBtn.textContent=this.optedOut?"Muted":"Mute",this.toggleBtn.classList.toggle("roulette-chat__toggle--opted-out",this.optedOut)),this.inputEl&&(this.inputEl.disabled=this.optedOut),this.sendBtn&&(this.sendBtn.disabled=this.optedOut),this.options.onToggleOptOut&&this.options.onToggleOptOut(this.optedOut)}addMessage(t){const e=this.messagesEl?.querySelector(".roulette-chat__empty");e&&e.remove(),this.messages.push(t),this.messages.length>this.maxMessages&&(this.messages.shift(),this.messagesEl?.querySelector(".roulette-chat__message")?.remove());const s=this.renderMessage(t);this.messagesEl?.insertAdjacentHTML("beforeend",s),this.scrollToBottom()}addSystemMessage(t){this.addMessage({user_id:0,username:"System",avatar_id:null,content:t,timestamp:new Date().toISOString(),is_system:!0})}renderMessage(t){const e=t.is_system,s=t.avatar_id?`<img src="/api/v1/avatar/${t.avatar_id}" alt="${t.username}">`:this.getInitials(t.username),n=this.formatTime(t.timestamp);return`
            <div class="roulette-chat__message ${e?"roulette-chat__message--system":""}">
                <div class="roulette-chat__avatar">${s}</div>
                <div class="roulette-chat__content">
                    <div class="roulette-chat__username">${this.escapeHtml(t.username)}</div>
                    <div class="roulette-chat__text">${this.escapeHtml(t.content)}</div>
                    <div class="roulette-chat__time">${n}</div>
                </div>
            </div>
        `}getInitials(t){return t.split(" ").map(e=>e[0]).join("").toUpperCase().slice(0,2)}formatTime(t){try{return new Date(t).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}catch{return""}}escapeHtml(t){const e=document.createElement("div");return e.textContent=t,e.innerHTML}scrollToBottom(){this.messagesEl&&(this.messagesEl.scrollTop=this.messagesEl.scrollHeight)}clear(){this.messages=[],this.messagesEl&&(this.messagesEl.innerHTML='<div class="roulette-chat__empty">No messages yet</div>')}setOptedOut(t){this.optedOut=t,this.render()}}class d{constructor(t){this.container=t,this.ws=null,this.state={spinId:null,secondsRemaining:120,phase:"betting",blockBets:!1,connectedCount:0,balance:0,history:[],pendingBets:[]},this.components={},this.reconnectAttempts=0,this.maxReconnectAttempts=5,this.init()}async init(){this.showLoading(),await this.fetchInitialState(),this.render(),this.initComponents(),this.connectWebSocket()}showLoading(){this.container.innerHTML=`
            <div class="roulette-loading">
                <div class="roulette-loading__spinner"></div>
                <div class="roulette-loading__text">Connecting to table...</div>
            </div>
        `}async fetchInitialState(){try{const t=await fetch("/api/v1/roulette/multiplayer/state",{headers:{Authorization:`Bearer ${this.getToken()}`}});if(t.ok){const e=await t.json();e.success&&e.data&&(this.state.history=e.data.history||[],this.state.balance=e.data.balance||0)}}catch(t){console.error("Failed to fetch initial state:",t)}}getToken(){return localStorage.getItem("jwt_token")||sessionStorage.getItem("jwt_token")||""}render(){this.container.innerHTML=`
            <div class="roulette-multiplayer__header">
                <h1 class="roulette-multiplayer__title">Multiplayer Roulette</h1>
                <div class="roulette-multiplayer__balance">
                    <span class="balance-icon">&#9679;</span>
                    <span class="balance-amount">${this.formatBalance(this.state.balance)}</span>
                </div>
            </div>

            <div class="roulette-multiplayer__main">
                <div class="roulette-multiplayer__game-area">
                    <div id="spin-history"></div>
                    <div id="countdown-timer"></div>
                    <div id="status-message"></div>
                    <div class="roulette-multiplayer__betting-area">
                        <div id="betting-table"></div>
                        <div class="roulette-multiplayer__current-bets">
                            <div class="roulette-multiplayer__current-bets-header">
                                <span class="roulette-multiplayer__current-bets-title">Your Bets</span>
                                <span class="roulette-multiplayer__current-bets-total">Total: <span id="bet-total">0</span></span>
                            </div>
                            <div id="current-bets-list" class="roulette-multiplayer__current-bets-list"></div>
                        </div>
                    </div>
                </div>

                <div class="roulette-multiplayer__sidebar">
                    <div class="roulette-multiplayer__connected">
                        <span id="connected-count">${this.state.connectedCount}</span> players online
                    </div>
                    <div id="roulette-chat"></div>
                </div>
            </div>

            <div id="wheel-animation" class="wheel-animation"></div>
        `}initComponents(){this.components.countdown=new o(document.getElementById("countdown-timer"),{onComplete:()=>this.onCountdownComplete()}),this.components.history=new r(document.getElementById("spin-history"),this.state.history),this.components.betManager=new l(document.getElementById("betting-table"),{onBetsChange:t=>this.onBetsChange(t),balance:this.state.balance}),this.components.wheelAnimation=new c(document.getElementById("wheel-animation")),this.components.chat=new h(document.getElementById("roulette-chat"),{onSendMessage:t=>this.sendChatMessage(t),onToggleOptOut:t=>this.toggleChatOptOut(t)})}connectWebSocket(){const e=`${window.location.protocol==="https:"?"wss:":"ws:"}//${window.location.host}/ws/roulette?token=${this.getToken()}`;this.ws=new WebSocket(e),this.ws.onopen=()=>{console.log("WebSocket connected"),this.reconnectAttempts=0,this.sendCommand({type:"roulette.join"})},this.ws.onmessage=s=>{try{const n=JSON.parse(s.data);this.handleMessage(n)}catch(n){console.error("Failed to parse message:",n)}},this.ws.onclose=()=>{console.log("WebSocket disconnected"),this.attemptReconnect()},this.ws.onerror=s=>{console.error("WebSocket error:",s)}}attemptReconnect(){if(this.reconnectAttempts<this.maxReconnectAttempts){this.reconnectAttempts++;const t=Math.min(1e3*Math.pow(2,this.reconnectAttempts),3e4);console.log(`Reconnecting in ${t}ms (attempt ${this.reconnectAttempts})`),setTimeout(()=>this.connectWebSocket(),t)}else this.showError("Connection lost. Please refresh the page.")}sendCommand(t){this.ws&&this.ws.readyState===WebSocket.OPEN&&this.ws.send(JSON.stringify(t))}handleMessage(t){switch(t.type||t.event_type){case"roulette.tick":this.handleTick(t);break;case"roulette.state":this.handleState(t);break;case"roulette.user_joined":this.handleUserJoined(t);break;case"roulette.user_left":this.handleUserLeft(t);break;case"roulette.bet_confirmed":this.handleBetConfirmed(t);break;case"roulette.bet_rejected":this.handleBetRejected(t);break;case"roulette.spin_result":this.handleSpinResult(t);break;case"roulette.payout":this.handlePayout(t);break;case"roulette.chat":this.handleChatMessage(t);break;case"roulette.error":this.handleError(t);break}}handleTick(t){this.state.spinId=t.spin_id,this.state.secondsRemaining=t.seconds_remaining,this.state.phase=t.phase,this.state.blockBets=t.block_bets,this.state.connectedCount=t.connected_count,this.components.countdown.update(t.seconds_remaining,t.phase,t.block_bets),this.updateConnectedCount(t.connected_count),t.block_bets&&this.components.betManager.disable()}handleState(t){this.state.spinId=t.spin_id,this.state.secondsRemaining=t.seconds_remaining,this.state.phase=t.phase,this.state.blockBets=t.block_bets,this.state.connectedCount=t.connected_count,this.state.history=t.history||[],this.state.pendingBets=t.pending_bets||[],this.state.balance=t.balance,this.components.countdown.update(t.seconds_remaining,t.phase,t.block_bets),this.components.history.setHistory(t.history),this.components.betManager.setBalance(t.balance),this.updateConnectedCount(t.connected_count),this.updateBalanceDisplay(t.balance),t.pending_bets&&this.components.betManager.setPendingBets(t.pending_bets)}handleUserJoined(t){this.updateConnectedCount(t.connected_count),this.components.chat.addSystemMessage(`${t.username} joined the table`)}handleUserLeft(t){this.updateConnectedCount(t.connected_count),this.components.chat.addSystemMessage(`${t.username} left the table`)}handleBetConfirmed(t){this.showStatus("Bet confirmed!","success"),this.updateBalanceDisplay(t.new_balance),this.components.betManager.confirmBet(t.total_amount)}handleBetRejected(t){this.showStatus(`Bet rejected: ${t.reason}`,"error"),this.components.betManager.enable()}handleSpinResult(t){this.components.history.addSpin({spin_id:t.spin_id,winning_number:t.winning_number,winning_color:t.winning_color}),this.components.wheelAnimation.spin(t.winning_number,t.winning_color,()=>{this.components.betManager.reset(),this.components.betManager.enable()})}handlePayout(t){this.updateBalanceDisplay(t.new_balance),t.payout_amount>0&&this.showStatus(`You won ${this.formatBalance(t.payout_amount)}!`,"success")}handleChatMessage(t){this.components.chat.addMessage({user_id:t.user_id,username:t.username,avatar_id:t.avatar_id,content:t.content,timestamp:t.timestamp,is_system:t.is_system})}handleError(t){this.showError(t.message)}onCountdownComplete(){this.state.blockBets||this.broadcastBets()}onBetsChange(t){this.updateCurrentBetsDisplay(t)}broadcastBets(){const t=this.components.betManager.getBets();t.length>0&&this.sendCommand({type:"roulette.broadcast_bets",spin_id:this.state.spinId,bets:t})}sendChatMessage(t){this.sendCommand({type:"roulette.chat",content:t})}toggleChatOptOut(t){this.sendCommand({type:"roulette.toggle_chat",opt_out:t})}updateConnectedCount(t){const e=document.getElementById("connected-count");e&&(e.textContent=t)}updateBalanceDisplay(t){this.state.balance=t;const e=this.container.querySelector(".balance-amount");e&&(e.textContent=this.formatBalance(t)),this.components.betManager.setBalance(t)}updateCurrentBetsDisplay(t){const e=document.getElementById("current-bets-list"),s=document.getElementById("bet-total");if(!e||!s)return;if(t.length===0){e.innerHTML='<div class="roulette-multiplayer__current-bets-empty">No bets placed</div>',s.textContent="0";return}let n=0;e.innerHTML=t.map(i=>(n+=i.amount,`
                <div class="roulette-multiplayer__current-bets-item">
                    <span>${i.bet_type}: ${i.numbers.join(", ")}</span>
                    <span>${this.formatBalance(i.amount)}</span>
                </div>
            `)).join(""),s.textContent=this.formatBalance(n)}showStatus(t,e="info"){const s=document.getElementById("status-message");s&&(s.innerHTML=`<div class="roulette-status roulette-status--${e}">${t}</div>`,setTimeout(()=>{s.innerHTML=""},5e3))}showError(t){this.showStatus(t,"error")}formatBalance(t){return(t/1e3).toLocaleString(void 0,{minimumFractionDigits:2,maximumFractionDigits:2})}destroy(){this.ws&&this.ws.close()}}document.addEventListener("DOMContentLoaded",()=>{const a=document.getElementById("roulette-multiplayer");a&&(window.rouletteGame=new d(a))})})();
