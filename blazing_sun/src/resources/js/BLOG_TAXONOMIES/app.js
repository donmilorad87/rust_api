(function(){"use strict";function y(){const d=document.querySelector('meta[name="csrf-token"]');return d?d.getAttribute("content"):(console.warn('CSRF token not found. Ensure <meta name="csrf-token"> exists in page head.'),null)}function c(d={}){const t=y(),e={"Content-Type":"application/json",...d};return t&&(e["X-CSRF-TOKEN"]=t),e}class p{constructor(t){this.baseUrl=t.baseUrl,this.showToast=t.showToast,this.taxonomyList=document.getElementById("taxonomyList"),this.taxonomyModal=document.getElementById("taxonomyModal"),this.confirmModal=document.getElementById("confirmModal"),this.searchInput=document.getElementById("searchInput"),this.addTaxonomyBtn=document.getElementById("addTaxonomyBtn"),this.taxonomies=[],this.categories=[],this.tags=[],this.posts=[],this.editingTaxonomy=null,this.pendingAction=null,this.rules=[],this.ruleTypes=[{value:"require_categories",label:"Require Categories"},{value:"require_tags",label:"Require Tags"},{value:"include_posts",label:"Include Posts"},{value:"exclude_posts",label:"Exclude Posts"},{value:"min_word_count",label:"Min Word Count"},{value:"max_word_count",label:"Max Word Count"}],this.init()}init(){this.bindEvents(),this.loadTaxonomies(),this.loadReferenceData()}bindEvents(){if(this.addTaxonomyBtn&&this.addTaxonomyBtn.addEventListener("click",()=>this.openModal()),this.searchInput){let t;this.searchInput.addEventListener("input",e=>{clearTimeout(t),t=setTimeout(()=>{this.filterTaxonomies(e.target.value)},300)})}if(this.taxonomyModal){const t=this.taxonomyModal.querySelector('[data-action="close"]'),e=this.taxonomyModal.querySelector('[data-action="cancel"]'),o=this.taxonomyModal.querySelector('[data-action="save"]'),s=this.taxonomyModal.querySelector('[data-action="add-rule"]');t&&t.addEventListener("click",()=>this.closeModal()),e&&e.addEventListener("click",()=>this.closeModal()),o&&o.addEventListener("click",()=>this.saveTaxonomy()),s&&s.addEventListener("click",()=>this.addRule()),this.taxonomyModal.addEventListener("click",i=>{i.target===this.taxonomyModal&&this.closeModal()})}if(this.confirmModal){const t=this.confirmModal.querySelector('[data-action="confirm"]'),e=this.confirmModal.querySelector('[data-action="cancel"]');t&&t.addEventListener("click",()=>{this.pendingAction&&(this.pendingAction(),this.pendingAction=null),this.closeConfirmModal()}),e&&e.addEventListener("click",()=>this.closeConfirmModal()),this.confirmModal.addEventListener("click",o=>{o.target===this.confirmModal&&this.closeConfirmModal()})}this.taxonomyList&&this.taxonomyList.addEventListener("click",t=>this.handleListClick(t))}handleListClick(t){const e=t.target.closest("[data-action]");if(!e)return;const o=e.dataset.action,s=e.dataset.id;switch(o){case"edit":this.editTaxonomy(s);break;case"delete":this.confirmDeleteTaxonomy(s);break;case"duplicate":this.duplicateTaxonomy(s);break}}async loadTaxonomies(){if(this.taxonomyList){this.renderLoading();try{const t=await fetch(`${this.baseUrl}/api/v1/admin/blog/taxonomies`,{method:"GET",headers:c(),credentials:"include"});if(!t.ok)throw new Error("Failed to load taxonomies");const e=await t.json();if(e.status==="success")this.taxonomies=e.taxonomies||[],this.renderList();else throw new Error(e.message||"Failed to load taxonomies")}catch(t){console.error("Error loading taxonomies:",t),this.showToast("Failed to load taxonomies","error"),this.renderError()}}}async loadReferenceData(){try{const[t,e,o]=await Promise.all([fetch(`${this.baseUrl}/api/v1/admin/blog/categories`,{method:"GET",headers:c(),credentials:"include"}),fetch(`${this.baseUrl}/api/v1/admin/blog/tags?limit=500`,{method:"GET",headers:c(),credentials:"include"}),fetch(`${this.baseUrl}/api/v1/admin/blog/posts?limit=100&status=published`,{method:"GET",headers:c(),credentials:"include"})]);if(t.ok){const s=await t.json();s.status==="success"&&(this.categories=s.categories||[])}if(e.ok){const s=await e.json();s.status==="success"&&(this.tags=s.tags||[])}if(o.ok){const s=await o.json();s.status==="success"&&(this.posts=s.posts||[])}}catch(t){console.error("Error loading reference data:",t)}}renderList(){if(this.taxonomyList){if(this.taxonomies.length===0){this.taxonomyList.innerHTML=`
        <div class="taxonomy-list__empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
          <p>No taxonomies yet. Create your first taxonomy!</p>
        </div>
      `;return}this.taxonomyList.innerHTML=this.taxonomies.map(t=>`
      <li class="taxonomy-item" data-id="${t.id}">
        <div class="taxonomy-item__row">
          <div class="taxonomy-item__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
          </div>
          <div class="taxonomy-item__content">
            <div class="taxonomy-item__name">${this.escapeHtml(t.name)}</div>
            <div class="taxonomy-item__description">${this.escapeHtml(t.description||"No description")}</div>
          </div>
          <div class="taxonomy-item__meta">
            <div class="taxonomy-item__stat">
              <div class="taxonomy-item__stat-value">${t.rule_count||0}</div>
              <div class="taxonomy-item__stat-label">Rules</div>
            </div>
            <div class="taxonomy-item__stat">
              <div class="taxonomy-item__stat-value">${t.post_count||0}</div>
              <div class="taxonomy-item__stat-label">Posts</div>
            </div>
          </div>
          <div class="taxonomy-item__actions">
            <button class="btn btn--icon" data-action="edit" data-id="${t.id}" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn btn--icon" data-action="duplicate" data-id="${t.id}" title="Duplicate">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
            <button class="btn btn--icon" data-action="delete" data-id="${t.id}" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      </li>
    `).join("")}}filterTaxonomies(t){if(!this.taxonomyList)return;const e=this.taxonomyList.querySelectorAll(".taxonomy-item"),o=t.toLowerCase();e.forEach(s=>{const i=s.querySelector(".taxonomy-item__name")?.textContent.toLowerCase()||"",n=s.querySelector(".taxonomy-item__description")?.textContent.toLowerCase()||"",a=i.includes(o)||n.includes(o);s.style.display=a?"":"none"})}openModal(){if(!this.taxonomyModal)return;this.editingTaxonomy=null,this.rules=[];const t=this.taxonomyModal.querySelector(".taxonomy-modal__title"),e=this.taxonomyModal.querySelector("form");t&&(t.textContent="Add Taxonomy"),e&&e.reset(),this.renderRules(),this.taxonomyModal.classList.add("taxonomy-modal--visible"),this.taxonomyModal.setAttribute("aria-hidden","false");const o=this.taxonomyModal.querySelector('input[type="text"]');o&&setTimeout(()=>o.focus(),100)}async editTaxonomy(t){try{const e=await fetch(`${this.baseUrl}/api/v1/admin/blog/taxonomies/${t}`,{method:"GET",headers:c(),credentials:"include"});if(!e.ok)throw new Error("Failed to load taxonomy");const o=await e.json();if(o.status==="success"&&o.taxonomy){if(this.editingTaxonomy=o.taxonomy,this.rules=o.taxonomy.rules||[],!this.taxonomyModal)return;const s=this.taxonomyModal.querySelector(".taxonomy-modal__title"),i=this.taxonomyModal.querySelector("#taxonomyName"),n=this.taxonomyModal.querySelector("#taxonomySlug"),a=this.taxonomyModal.querySelector("#taxonomyDescription");s&&(s.textContent="Edit Taxonomy"),i&&(i.value=o.taxonomy.name||""),n&&(n.value=o.taxonomy.slug||""),a&&(a.value=o.taxonomy.description||""),this.renderRules(),this.taxonomyModal.classList.add("taxonomy-modal--visible"),this.taxonomyModal.setAttribute("aria-hidden","false")}else throw new Error(o.message||"Failed to load taxonomy")}catch(e){console.error("Error loading taxonomy:",e),this.showToast("Failed to load taxonomy","error")}}closeModal(){this.taxonomyModal&&(this.taxonomyModal.classList.remove("taxonomy-modal--visible"),this.taxonomyModal.setAttribute("aria-hidden","true"),this.editingTaxonomy=null,this.rules=[])}addRule(){this.rules.push({id:Date.now(),type:"require_categories",operator:"any",values:[]}),this.renderRules()}removeRule(t){this.rules=this.rules.filter(e=>e.id!==t),this.renderRules()}renderRules(){const t=this.taxonomyModal?.querySelector("#rulesContainer");if(t){if(this.rules.length===0){t.innerHTML='<p class="text-muted">No rules yet. Add a rule to define this taxonomy.</p>';return}t.innerHTML=this.rules.map(e=>this.renderRuleItem(e)).join(""),t.querySelectorAll(".rule-item").forEach((e,o)=>{const s=this.rules[o],i=e.querySelector(".rule-item__type-select");i&&i.addEventListener("change",r=>{s.type=r.target.value,s.values=[],this.renderRules()});const n=e.querySelector(".rule-item__operator select");n&&n.addEventListener("change",r=>{s.operator=r.target.value});const a=e.querySelector(".rule-item__remove");a&&a.addEventListener("click",()=>this.removeRule(s.id)),this.initRuleValuesSelect(e,s)})}}renderRuleItem(t){const e=this.ruleTypes.map(a=>`<option value="${a.value}" ${t.type===a.value?"selected":""}>${a.label}</option>`).join(""),o=["require_categories","require_tags"].includes(t.type),s=!["min_word_count","max_word_count"].includes(t.type),i=["min_word_count","max_word_count"].includes(t.type);let n="";return s?n=`
        <div class="rule-item__values">
          <div class="multi-select-chips__wrapper" data-rule-id="${t.id}">
            <div class="multi-select-chips__container">
              ${t.values.map(a=>`
                <span class="multi-select-chips__chip" data-value="${a.id}">
                  ${this.escapeHtml(a.name)}
                  <button type="button" class="multi-select-chips__chip-remove" data-remove="${a.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </span>
              `).join("")}
              <input type="text" class="multi-select-chips__input" placeholder="Type to search...">
            </div>
            <div class="multi-select-chips__dropdown"></div>
          </div>
        </div>
      `:i&&(n=`
        <div class="rule-item__values">
          <input type="number" class="form-group__input" value="${t.values[0]||""}" placeholder="Enter number" min="0">
        </div>
      `),`
      <div class="rule-item" data-rule-id="${t.id}">
        <div class="rule-item__type">
          <select class="rule-item__type-select">${e}</select>
        </div>
        ${o?`
          <div class="rule-item__operator">
            <select>
              <option value="any" ${t.operator==="any"?"selected":""}>Any</option>
              <option value="all" ${t.operator==="all"?"selected":""}>All</option>
            </select>
          </div>
        `:""}
        ${n}
        <button type="button" class="rule-item__remove" title="Remove rule">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `}initRuleValuesSelect(t,e){const o=t.querySelector(".multi-select-chips__wrapper");if(!o)return;const s=o.querySelector(".multi-select-chips__container"),i=o.querySelector(".multi-select-chips__input"),n=o.querySelector(".multi-select-chips__dropdown");if(!s||!i||!n)return;let a=[];switch(e.type){case"require_categories":a=this.categories.map(l=>({id:l.id,name:l.name}));break;case"require_tags":a=this.tags.map(l=>({id:l.id,name:l.name}));break;case"include_posts":case"exclude_posts":a=this.posts.map(l=>({id:l.id,name:l.title}));break}const r=new Set(e.values.map(l=>l.id));i.addEventListener("focus",()=>{this.renderDropdown(n,a,r,i.value,e,o),n.classList.add("multi-select-chips__dropdown--visible")}),i.addEventListener("blur",()=>{setTimeout(()=>{n.classList.remove("multi-select-chips__dropdown--visible")},200)}),i.addEventListener("input",()=>{this.renderDropdown(n,a,r,i.value,e,o)}),s.querySelectorAll("[data-remove]").forEach(l=>{l.addEventListener("click",u=>{u.stopPropagation();const v=parseInt(l.dataset.remove,10);e.values=e.values.filter(f=>f.id!==v),this.renderRules()})});const m=t.querySelector('.rule-item__values input[type="number"]');m&&m.addEventListener("change",l=>{e.values=[parseInt(l.target.value,10)||0]})}renderDropdown(t,e,o,s,i,n){const a=e.filter(r=>!o.has(r.id)&&r.name.toLowerCase().includes(s.toLowerCase()));if(a.length===0){t.innerHTML='<div class="multi-select-chips__option">No options available</div>';return}t.innerHTML=a.slice(0,20).map(r=>`
      <div class="multi-select-chips__option" data-id="${r.id}" data-name="${this.escapeHtml(r.name)}">
        ${this.escapeHtml(r.name)}
      </div>
    `).join(""),t.querySelectorAll(".multi-select-chips__option").forEach(r=>{r.addEventListener("mousedown",m=>{m.preventDefault();const l=parseInt(r.dataset.id,10),u=r.dataset.name;i.values.push({id:l,name:u}),this.renderRules()})})}async saveTaxonomy(){const t=this.taxonomyModal?.querySelector("#taxonomyName"),e=this.taxonomyModal?.querySelector("#taxonomySlug"),o=this.taxonomyModal?.querySelector("#taxonomyDescription");if(!t?.value.trim()){this.showToast("Taxonomy name is required","error");return}const s={name:t.value.trim(),slug:e?.value.trim()||null,description:o?.value.trim()||null,rules:this.rules.map(i=>({type:i.type,operator:i.operator||"any",values:i.values}))};try{const i=!!this.editingTaxonomy,n=i?`${this.baseUrl}/api/v1/admin/blog/taxonomies/${this.editingTaxonomy.id}`:`${this.baseUrl}/api/v1/admin/blog/taxonomies`,a=await fetch(n,{method:i?"PUT":"POST",headers:c(),credentials:"include",body:JSON.stringify(s)});if(!a.ok){const m=await a.json().catch(()=>({}));throw new Error(m.message||"Failed to save taxonomy")}const r=await a.json();if(r.status==="success")this.showToast(`Taxonomy ${i?"updated":"created"} successfully`,"success"),this.closeModal(),this.loadTaxonomies();else throw new Error(r.message||"Failed to save taxonomy")}catch(i){console.error("Error saving taxonomy:",i),this.showToast(i.message||"Failed to save taxonomy","error")}}confirmDeleteTaxonomy(t){const e=this.taxonomies.find(o=>String(o.id)===String(t));e&&(this.pendingAction=()=>this.deleteTaxonomy(t),this.openConfirmModal("Delete Taxonomy",`Are you sure you want to delete "${e.name}"?`))}async deleteTaxonomy(t){try{const e=await fetch(`${this.baseUrl}/api/v1/admin/blog/taxonomies/${t}`,{method:"DELETE",headers:c(),credentials:"include"});if(!e.ok)throw new Error("Failed to delete taxonomy");const o=await e.json();if(o.status==="success")this.showToast("Taxonomy deleted successfully","success"),this.loadTaxonomies();else throw new Error(o.message||"Failed to delete taxonomy")}catch(e){console.error("Error deleting taxonomy:",e),this.showToast("Failed to delete taxonomy","error")}}async duplicateTaxonomy(t){try{const e=await fetch(`${this.baseUrl}/api/v1/admin/blog/taxonomies/${t}/duplicate`,{method:"POST",headers:c(),credentials:"include"});if(!e.ok)throw new Error("Failed to duplicate taxonomy");const o=await e.json();if(o.status==="success")this.showToast("Taxonomy duplicated successfully","success"),this.loadTaxonomies();else throw new Error(o.message||"Failed to duplicate taxonomy")}catch(e){console.error("Error duplicating taxonomy:",e),this.showToast("Failed to duplicate taxonomy","error")}}openConfirmModal(t,e){if(!this.confirmModal)return;const o=this.confirmModal.querySelector(".confirm-modal__title"),s=this.confirmModal.querySelector(".confirm-modal__message");o&&(o.textContent=t),s&&(s.textContent=e),this.confirmModal.classList.add("confirm-modal--visible")}closeConfirmModal(){this.confirmModal&&(this.confirmModal.classList.remove("confirm-modal--visible"),this.pendingAction=null)}renderLoading(){this.taxonomyList&&(this.taxonomyList.innerHTML=`
      <div class="loading-spinner">
        <div class="loading-spinner__icon"></div>
      </div>
    `)}renderError(){this.taxonomyList&&(this.taxonomyList.innerHTML=`
      <div class="taxonomy-list__empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <p>Failed to load taxonomies. Please try again.</p>
      </div>
    `)}escapeHtml(t){if(!t)return"";const e=document.createElement("div");return e.textContent=t,e.innerHTML}}function h(){const d=window.BASE_URL||"",t=x(),e=new p({baseUrl:d,showToast:t});typeof window<"u"&&(window.blogTaxonomiesController=e)}function x(){const d={success:"linear-gradient(to right, #00b09b, #96c93d)",error:"linear-gradient(to right, #ff5f6d, #ffc371)",info:"linear-gradient(to right, #667eea, #764ba2)"};return function(e,o="success"){typeof Toastify<"u"?Toastify({text:e,duration:4e3,gravity:"top",position:"right",style:{background:d[o]||d.info}}).showToast():console.log(`[${o.toUpperCase()}] ${e}`)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",h):h()})();
