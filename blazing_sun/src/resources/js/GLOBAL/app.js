(function(){"use strict";class f{constructor(){this.COOKIE_NAME="blazing_sun_theme",this.DARK_THEME="dark",this.LIGHT_THEME="light",this.COOKIE_MAX_AGE=365*24*60*60,this.toggleButton=document.getElementById("themeToggle"),this.init()}init(){this.toggleButton&&this.toggleButton.addEventListener("click",()=>this.toggle())}getTheme(){const t=document.cookie.split("; ").find(e=>e.startsWith(this.COOKIE_NAME+"="));if(t){const e=t.split("=")[1];if(e===this.DARK_THEME||e===this.LIGHT_THEME)return e}return this.LIGHT_THEME}saveToCookie(t){document.cookie=`${this.COOKIE_NAME}=${t}; path=/; max-age=${this.COOKIE_MAX_AGE}; SameSite=Lax`}applyTheme(t){t===this.DARK_THEME?document.documentElement.setAttribute("data-theme",this.DARK_THEME):document.documentElement.removeAttribute("data-theme"),this.saveToCookie(t)}toggle(){const e=this.getTheme()===this.DARK_THEME?this.LIGHT_THEME:this.DARK_THEME;this.applyTheme(e)}setTheme(t){(t===this.DARK_THEME||t===this.LIGHT_THEME)&&this.applyTheme(t)}isDark(){return this.getTheme()===this.DARK_THEME}}class w{constructor(){this.navbar=document.querySelector(".navbar"),this.links=document.querySelectorAll(".navbar__link"),this.init()}init(){this.highlightActiveLink(),this.setupScrollBehavior()}highlightActiveLink(){const t=window.location.pathname;this.links.forEach(e=>{new URL(e.href).pathname===t?e.classList.add("navbar__link--active"):e.classList.remove("navbar__link--active")})}setupScrollBehavior(){this.navbar&&window.addEventListener("scroll",()=>{window.pageYOffset>10?this.navbar.classList.add("navbar--scrolled"):this.navbar.classList.remove("navbar--scrolled")},{passive:!0})}}function h(){const n=document.querySelector('meta[name="csrf-token"]');return n?n.getAttribute("content"):(console.warn('CSRF token not found. Ensure <meta name="csrf-token"> exists in page head.'),null)}function u(n={}){const t=h(),e={"Content-Type":"application/json",...n};return t&&(e["X-CSRF-TOKEN"]=t),e}class m{constructor(t={}){this.options={showIcons:!0,validateOnInput:!0,...t},this.validationRules={email:[{test:e=>e.length>0,message:"Email is required",key:"required"},{test:e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),message:"Must be a valid email format",key:"format"}],password:[{test:e=>e.length>0,message:"Password is required",key:"required"},{test:e=>e.length>=8,message:"Minimum 8 characters",key:"minLength"},{test:e=>/[A-Z]/.test(e),message:"At least one uppercase letter",key:"uppercase"},{test:e=>/[a-z]/.test(e),message:"At least one lowercase letter",key:"lowercase"},{test:e=>/[0-9]/.test(e),message:"At least one number",key:"number"},{test:e=>/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/.test(e),message:"At least one special character",key:"special"}],first_name:[{test:e=>e.length>0,message:"First name is required",key:"required"},{test:e=>e.length>=2,message:"Minimum 2 characters",key:"minLength"},{test:e=>/^[a-zA-Z\s'-]+$/.test(e)||e.length===0,message:"Letters only (no special characters)",key:"letters"}],last_name:[{test:e=>e.length>0,message:"Last name is required",key:"required"},{test:e=>e.length>=2,message:"Minimum 2 characters",key:"minLength"},{test:e=>/^[a-zA-Z\s'-]+$/.test(e)||e.length===0,message:"Letters only (no special characters)",key:"letters"}],current_password:[{test:e=>e.length>0,message:"Current password is required",key:"required"}],new_password:[{test:e=>e.length>0,message:"New password is required",key:"required"},{test:e=>e.length>=8,message:"Minimum 8 characters",key:"minLength"},{test:e=>/[A-Z]/.test(e),message:"At least one uppercase letter",key:"uppercase"},{test:e=>/[a-z]/.test(e),message:"At least one lowercase letter",key:"lowercase"},{test:e=>/[0-9]/.test(e),message:"At least one number",key:"number"},{test:e=>/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/.test(e),message:"At least one special character",key:"special"}]},this.boundInputs=new Map,this.passwordConfirmPairs=new Map}bindPasswordConfirm(t,e,s){if(!t||!e)return;const i={input:t,type:"password_confirm",feedbackContainer:s,isValid:!1,touched:!1,passwordInput:e};if(this.boundInputs.set(t,i),this.passwordConfirmPairs.set(t,e),s){s.innerHTML="",s.className="validation-feedback";const a=document.createElement("div");a.className="validation-item",a.dataset.rule="match",a.innerHTML=`
                <span class="validation-icon"></span>
                <span class="validation-text">Passwords must match</span>
            `,s.appendChild(a)}this.options.validateOnInput&&(t.addEventListener("input",()=>this.validatePasswordConfirm(i)),t.addEventListener("blur",()=>{i.touched=!0,this.validatePasswordConfirm(i)}),e.addEventListener("input",()=>{t.value.length>0&&this.validatePasswordConfirm(i)}))}validatePasswordConfirm(t){const{input:e,feedbackContainer:s,touched:i,passwordInput:a}=t,o=e.value,l=a.value,d=o.length>0&&o===l;if(t.isValid=d,s){const r=s.querySelector('[data-rule="match"]');r&&(r.classList.remove("valid","invalid"),(o.length>0||i)&&r.classList.add(d?"valid":"invalid"))}return e.classList.remove("input--valid","input--invalid"),(o.length>0||i)&&e.classList.add(d?"input--valid":"input--invalid"),d}bindInput(t,e,s){if(!t||!this.validationRules[e])return;const i={input:t,type:e,feedbackContainer:s,isValid:!1,touched:!1};this.boundInputs.set(t,i),this.createFeedbackElements(i),this.options.validateOnInput&&(t.addEventListener("input",()=>this.validateInput(i)),t.addEventListener("blur",()=>{i.touched=!0,this.validateInput(i)})),this.validateInput(i,!1)}createFeedbackElements(t){const{feedbackContainer:e,type:s}=t;if(!e)return;e.innerHTML="",e.className="validation-feedback",this.validationRules[s].forEach(a=>{const o=document.createElement("div");o.className="validation-item",o.dataset.rule=a.key,o.innerHTML=`
                <span class="validation-icon"></span>
                <span class="validation-text">${a.message}</span>
            `,e.appendChild(o)})}validateInput(t,e=!0){const{input:s,type:i,feedbackContainer:a,touched:o}=t,l=s.value,d=this.validationRules[i];let r=!0;return d.forEach(p=>{const v=p.test(l);if(v||(r=!1),a&&(e||o)){const c=a.querySelector(`[data-rule="${p.key}"]`);c&&(c.classList.remove("valid","invalid"),(l.length>0||o)&&c.classList.add(v?"valid":"invalid"))}}),t.isValid=r,s.classList.remove("input--valid","input--invalid"),(l.length>0||o)&&e&&s.classList.add(r?"input--valid":"input--invalid"),r}validateAll(){let t=!0;return this.boundInputs.forEach(e=>{e.touched=!0,e.type==="password_confirm"?this.validatePasswordConfirm(e)||(t=!1):this.validateInput(e,!0)||(t=!1)}),t}isValid(){let t=!0;return this.boundInputs.forEach(e=>{e.isValid||(t=!1)}),t}reset(){this.boundInputs.forEach(t=>{t.touched=!1,t.isValid=!1,t.input.classList.remove("input--valid","input--invalid"),t.feedbackContainer&&t.feedbackContainer.querySelectorAll(".validation-item").forEach(s=>s.classList.remove("valid","invalid"))})}getErrors(){const t={};return this.boundInputs.forEach((e,s)=>{const i=s.value,a=this.validationRules[e.type],o=[];a.forEach(l=>{l.test(i)||o.push(l.message)}),o.length>0&&(t[s.name||s.id||e.type]=o)}),t}}class g{constructor(t,e){this.input=t,this.toggleBtn=e,this.isVisible=!1,this.input&&this.toggleBtn&&this.init()}init(){this.toggleBtn.addEventListener("click",t=>{t.preventDefault(),this.toggle()}),this.updateIcon()}toggle(){this.isVisible=!this.isVisible,this.input.type=this.isVisible?"text":"password",this.updateIcon()}updateIcon(){const t='<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',e='<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';this.toggleBtn.innerHTML=this.isVisible?e:t,this.toggleBtn.setAttribute("aria-label",this.isVisible?"Hide password":"Show password")}}class b{constructor(t={}){this.options={baseUrl:"",onSuccess:null,onError:null,showToast:null,redirectAfterLogin:!1,redirectUrl:"/",...t},this.modal=null,this.form=null,this.validator=null,this.passwordToggle=null,this.isSubmitting=!1,this.createModal(),this.init()}createModal(){if(document.getElementById("loginModal")){this.modal=document.getElementById("loginModal");return}document.body.insertAdjacentHTML("beforeend",`
            <div id="loginModal" class="login-modal" role="dialog" aria-modal="true" aria-labelledby="loginModalTitle">
                <div class="login-modal__backdrop" data-action="close"></div>
                <div class="login-modal__content">
                    <button type="button" class="login-modal__close" data-action="close" aria-label="Close login modal">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>

                    <header class="login-modal__header">
                        <h2 id="loginModalTitle" class="login-modal__title">Sign In</h2>
                        <p class="login-modal__subtitle">Enter your credentials to continue</p>
                    </header>

                    <form id="loginModalForm" class="login-modal__form" novalidate>
                        <!-- Email Field -->
                        <div class="form-group">
                            <label for="loginEmail">Email</label>
                            <div class="input-wrapper">
                                <input
                                    type="email"
                                    id="loginEmail"
                                    name="email"
                                    autocomplete="email"
                                    aria-required="true"
                                    aria-describedby="loginEmailFeedback"
                                    placeholder="you@example.com"
                                >
                            </div>
                            <div id="loginEmailFeedback" class="validation-feedback" aria-live="polite"></div>
                        </div>

                        <!-- Password Field -->
                        <div class="form-group">
                            <label for="loginPassword">Password</label>
                            <div class="input-wrapper input-wrapper--password">
                                <input
                                    type="password"
                                    id="loginPassword"
                                    name="password"
                                    autocomplete="current-password"
                                    aria-required="true"
                                    aria-describedby="loginPasswordFeedback"
                                    placeholder="Enter your password"
                                >
                                <button type="button" class="password-toggle" id="loginPasswordToggle" aria-label="Show password">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                </button>
                            </div>
                            <div id="loginPasswordFeedback" class="validation-feedback" aria-live="polite"></div>
                        </div>

                        <!-- Remember Me -->
                        <div class="form-group form-group--checkbox">
                            <label class="checkbox-label">
                                <input type="checkbox" id="loginRemember" name="remember" value="1">
                                <span class="checkbox-custom"></span>
                                <span class="checkbox-text">Keep me logged in</span>
                            </label>
                        </div>

                        <!-- Error Message -->
                        <div id="loginModalError" class="login-modal__error" role="alert" aria-live="polite"></div>

                        <!-- Submit Button -->
                        <button type="submit" class="btn btn--primary btn--full" id="loginModalBtn">
                            Sign In
                        </button>
                    </form>

                    <footer class="login-modal__footer">
                        <a href="/forgot-password" class="link">Forgot password?</a>
                        <span class="login-modal__divider">|</span>
                        <a href="/sign-up" class="link">Create account</a>
                    </footer>
                </div>
            </div>
        `),this.modal=document.getElementById("loginModal")}init(){this.form=this.modal.querySelector("#loginModalForm");const t=this.modal.querySelector("#loginEmail"),e=this.modal.querySelector("#loginPassword"),s=this.modal.querySelector("#loginEmailFeedback"),i=this.modal.querySelector("#loginPasswordFeedback"),a=this.modal.querySelector("#loginPasswordToggle");this.validator=new m({validateOnInput:!0}),this.validator.bindInput(t,"email",s),this.validator.bindInput(e,"password",i),this.passwordToggle=new g(e,a),this.setupEventListeners()}setupEventListeners(){this.modal.addEventListener("click",t=>{t.target.closest('[data-action="close"]')&&this.hide()}),document.addEventListener("keydown",t=>{t.key==="Escape"&&this.isVisible()&&this.hide()}),this.form.addEventListener("submit",t=>this.handleSubmit(t))}async handleSubmit(t){if(t.preventDefault(),this.isSubmitting||!this.validator.validateAll())return;this.isSubmitting=!0,this.setLoading(!0),this.hideError();const e={email:this.form.querySelector("#loginEmail").value.trim(),password:this.form.querySelector("#loginPassword").value,remember:this.form.querySelector("#loginRemember").checked};try{const s=await fetch(`${this.options.baseUrl}/api/v1/auth/sign-in`,{method:"POST",headers:u(),body:JSON.stringify(e)}),i=await s.json();if(s.ok){if(i.token){const a=e.remember?2592e3:604800;document.cookie=`auth_token=${i.token}; path=/; max-age=${a}; SameSite=Strict`}this.options.showToast&&this.options.showToast("Sign in successful!","success"),this.options.onSuccess&&this.options.onSuccess(i),this.options.redirectAfterLogin?setTimeout(()=>{window.location.href=this.options.redirectUrl},500):setTimeout(()=>{window.location.reload()},500),this.hide()}else this.showError(i.message||"Sign in failed. Please check your credentials."),this.options.onError&&this.options.onError(i)}catch(s){console.error("Login error:",s),this.showError("Network error. Please try again."),this.options.onError&&this.options.onError({message:"Network error"})}finally{this.isSubmitting=!1,this.setLoading(!1)}}setLoading(t){const e=this.form.querySelector("#loginModalBtn");e&&(e.disabled=t,e.textContent=t?"Signing in...":"Sign In")}showError(t){const e=this.modal.querySelector("#loginModalError");e&&(e.textContent=t,e.style.display="block")}hideError(){const t=this.modal.querySelector("#loginModalError");t&&(t.style.display="none")}show(){this.modal.classList.add("login-modal--visible"),document.body.style.overflow="hidden",setTimeout(()=>{const t=this.form.querySelector("input");t&&t.focus()},100)}hide(){this.modal.classList.remove("login-modal--visible"),document.body.style.overflow="",this.form.reset(),this.validator.reset(),this.hideError()}isVisible(){return this.modal.classList.contains("login-modal--visible")}destroy(){this.modal&&this.modal.remove()}}document.addEventListener("DOMContentLoaded",()=>{window.Blazing_Sun=window.Blazing_Sun||{},window.Blazing_Sun.theme=new f,window.Blazing_Sun.navbar=new w,window.Blazing_Sun.csrf={getCsrfToken:h,getCsrfHeaders:u},window.Blazing_Sun.FormValidator=m,window.Blazing_Sun.PasswordToggle=g,window.Blazing_Sun.LoginModal=b})})();
