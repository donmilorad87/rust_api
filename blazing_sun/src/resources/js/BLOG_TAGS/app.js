(function(){"use strict";function u(){const l=document.querySelector('meta[name="csrf-token"]');return l?l.getAttribute("content"):(console.warn('CSRF token not found. Ensure <meta name="csrf-token"> exists in page head.'),null)}function c(l={}){const t=u(),e={"Content-Type":"application/json",...l};return t&&(e["X-CSRF-TOKEN"]=t),e}class f{constructor(t){this.baseUrl=t.baseUrl,this.showToast=t.showToast,this.tagsTable=document.getElementById("tagsTableBody"),this.tagCloud=document.getElementById("tagCloud"),this.tagModal=document.getElementById("tagModal"),this.confirmModal=document.getElementById("confirmModal"),this.searchInput=document.getElementById("searchInput"),this.addTagBtn=document.getElementById("addTagBtn"),this.pagination=document.getElementById("pagination"),this.tags=[],this.totalTags=0,this.currentPage=1,this.itemsPerPage=20,this.editingTag=null,this.editingInlineId=null,this.pendingAction=null,this.searchTerm="",this.colorPresets=["#667eea","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#f97316","#14b8a6","#6366f1"],this.init()}init(){this.bindEvents(),this.tagsTable&&this.tagsTable.querySelectorAll("tr[data-id]").length>0||this.loadTags()}bindEvents(){if(this.addTagBtn&&this.addTagBtn.addEventListener("click",()=>this.openModal()),this.searchInput){let e;this.searchInput.addEventListener("input",i=>{clearTimeout(e),e=setTimeout(()=>{this.searchTerm=i.target.value,this.currentPage=1,this.loadTags()},300)})}if(this.tagModal){const e=this.tagModal.querySelector('[data-action="close"]'),i=this.tagModal.querySelector('[data-action="cancel"]'),a=this.tagModal.querySelector('[data-action="save"]');e&&e.addEventListener("click",()=>this.closeModal()),i&&i.addEventListener("click",()=>this.closeModal()),a&&a.addEventListener("click",()=>this.saveTag()),this.tagModal.querySelectorAll("[data-color]").forEach(n=>{n.addEventListener("click",o=>{const r=o.target.dataset.color,d=this.tagModal.querySelector("#tagColor");d&&(d.value=r),this.updateColorPresetSelection(r)})});const s=this.tagModal.querySelector("#tagColor");s&&s.addEventListener("input",n=>{this.updateColorPresetSelection(n.target.value)}),this.tagModal.addEventListener("click",n=>{n.target===this.tagModal&&this.closeModal()})}if(this.confirmModal){const e=this.confirmModal.querySelector('[data-action="confirm"]'),i=this.confirmModal.querySelector('[data-action="cancel"]');e&&e.addEventListener("click",()=>{this.pendingAction&&(this.pendingAction(),this.pendingAction=null),this.closeConfirmModal()}),i&&i.addEventListener("click",()=>this.closeConfirmModal()),this.confirmModal.addEventListener("click",a=>{a.target===this.confirmModal&&this.closeConfirmModal()})}this.tagsTable&&(this.tagsTable.addEventListener("click",e=>this.handleTableClick(e)),this.tagsTable.addEventListener("keydown",e=>this.handleInlineKeydown(e)));const t=document.querySelector('[data-action="refresh-cloud"]');t&&t.addEventListener("click",()=>this.renderTagCloud())}handleTableClick(t){const e=t.target.closest("[data-action]");if(!e){const s=t.target.closest(".tag-cell__name");if(s){const n=s.closest("tr")?.dataset.id;n&&this.startInlineEdit(n)}return}const i=e.dataset.action,a=e.dataset.id||e.closest("tr")?.dataset.id;switch(i){case"edit":this.editTag(a);break;case"delete":this.confirmDeleteTag(a);break;case"inline-save":this.saveInlineEdit(a);break;case"inline-cancel":this.cancelInlineEdit(a);break}}handleInlineKeydown(t){!this.editingInlineId||!t.target.closest(".tag-cell__input")||(t.key==="Enter"?(t.preventDefault(),this.saveInlineEdit(this.editingInlineId)):t.key==="Escape"&&(t.preventDefault(),this.cancelInlineEdit(this.editingInlineId)))}async loadTags(){if(this.tagsTable){this.renderLoading();try{const t=(this.currentPage-1)*this.itemsPerPage,e=new URLSearchParams({limit:this.itemsPerPage,offset:t});this.searchTerm&&e.append("search",this.searchTerm);const i=await fetch(`${this.baseUrl}/api/v1/admin/blog/tags?${e}`,{method:"GET",headers:c(),credentials:"include"});if(!i.ok)throw new Error("Failed to load tags");const a=await i.json();if(a.status==="success")this.tags=a.tags||[],this.totalTags=a.total||0,this.renderTable(),this.renderPagination(),this.renderTagCloud();else throw new Error(a.message||"Failed to load tags")}catch(t){console.error("Error loading tags:",t),this.showToast("Failed to load tags","error"),this.renderError()}}}renderTable(){if(this.tagsTable){if(this.tags.length===0){this.tagsTable.innerHTML=`
        <tr>
          <td colspan="5" class="tags-table__empty">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
            <p>No tags yet. Create your first tag!</p>
          </td>
        </tr>
      `;return}this.tagsTable.innerHTML=this.tags.map(t=>this.renderTagRow(t)).join("")}}renderTagRow(t){const e=this.editingInlineId===String(t.id),i=t.color||"#667eea",a=t.post_count||0;return`
      <tr data-id="${t.id}">
        <td>
          <div class="tag-cell ${e?"tag-cell--editing":""}">
            <div class="tag-cell__display">
              <span class="tag-cell__color" style="background-color: ${i}"></span>
              <span class="tag-cell__name">${this.escapeHtml(t.name)}</span>
            </div>
            <div class="tag-cell__edit">
              <input type="text" class="tag-cell__input" value="${this.escapeHtml(t.name)}" />
              <button class="btn btn--icon btn--xs" data-action="inline-save" title="Save">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
              <button class="btn btn--icon btn--xs" data-action="inline-cancel" title="Cancel">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
        </td>
        <td>${this.escapeHtml(t.slug||"")}</td>
        <td>${a}</td>
        <td>${this.formatDate(t.created_at)}</td>
        <td>
          <div class="tag-actions">
            <button class="btn btn--icon" data-action="edit" data-id="${t.id}" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn btn--icon" data-action="delete" data-id="${t.id}" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `}renderTagCloud(){if(!this.tagCloud)return;if(this.tags.length===0){this.tagCloud.innerHTML='<div class="tag-cloud__empty">No tags to display</div>';return}const t=Math.max(...this.tags.map(e=>e.post_count||0),1);this.tagCloud.innerHTML=this.tags.map(e=>{const i=e.post_count||0,a=i/t;let s="xs";return a>.8?s="xl":a>.6?s="lg":a>.4?s="md":a>.2&&(s="sm"),`
        <span class="tag-cloud-item tag-cloud-item--${s}" style="border-color: ${e.color||"#667eea"}20">
          ${this.escapeHtml(e.name)}
          <span class="tag-cloud-item__count">(${i})</span>
        </span>
      `}).join("")}startInlineEdit(t){this.editingInlineId&&this.cancelInlineEdit(this.editingInlineId),this.editingInlineId=String(t),this.renderTable();const i=this.tagsTable.querySelector(`tr[data-id="${t}"]`)?.querySelector(".tag-cell__input");i&&(i.focus(),i.select())}async saveInlineEdit(t){const a=this.tagsTable.querySelector(`tr[data-id="${t}"]`)?.querySelector(".tag-cell__input")?.value.trim();if(!a){this.showToast("Tag name cannot be empty","error");return}try{const s=await fetch(`${this.baseUrl}/api/v1/admin/blog/tags/${t}`,{method:"PUT",headers:c(),credentials:"include",body:JSON.stringify({name:a})});if(!s.ok)throw new Error("Failed to update tag");const n=await s.json();if(n.status==="success")this.showToast("Tag updated successfully","success"),this.editingInlineId=null,this.loadTags();else throw new Error(n.message||"Failed to update tag")}catch(s){console.error("Error updating tag:",s),this.showToast("Failed to update tag","error")}}cancelInlineEdit(t){this.editingInlineId=null,this.renderTable()}openModal(){if(!this.tagModal)return;this.editingTag=null;const t=this.tagModal.querySelector(".tag-modal__title"),e=this.tagModal.querySelector("form"),i=this.tagModal.querySelector("#tagColor");t&&(t.textContent="Add Tag"),e&&e.reset(),i&&(i.value=this.colorPresets[0]),this.updateColorPresetSelection(this.colorPresets[0]),this.tagModal.classList.add("tag-modal--visible"),this.tagModal.setAttribute("aria-hidden","false");const a=this.tagModal.querySelector('input[type="text"]');a&&setTimeout(()=>a.focus(),100)}editTag(t){const e=this.tags.find(r=>String(r.id)===String(t));if(!e||(this.editingTag=e,!this.tagModal))return;const i=this.tagModal.querySelector(".tag-modal__title"),a=this.tagModal.querySelector("#tagName"),s=this.tagModal.querySelector("#tagSlug"),n=this.tagModal.querySelector("#tagDescription"),o=this.tagModal.querySelector("#tagColor");i&&(i.textContent="Edit Tag"),a&&(a.value=e.name||""),s&&(s.value=e.slug||""),n&&(n.value=e.description||""),o&&(o.value=e.color||this.colorPresets[0]),this.updateColorPresetSelection(e.color||this.colorPresets[0]),this.tagModal.classList.add("tag-modal--visible"),this.tagModal.setAttribute("aria-hidden","false")}updateColorPresetSelection(t){this.tagModal&&this.tagModal.querySelectorAll("[data-color]").forEach(e=>{e.classList.toggle("form-group__color-preset--active",e.dataset.color.toLowerCase()===t.toLowerCase())})}closeModal(){this.tagModal&&(this.tagModal.classList.remove("tag-modal--visible"),this.tagModal.setAttribute("aria-hidden","true"),this.editingTag=null)}generateSlug(t){return t.toLowerCase().trim().replace(/[^\w\s-]/g,"").replace(/[\s_-]+/g,"-").replace(/^-+|-+$/g,"")}async saveTag(){const t=this.tagModal?.querySelector("#tagName"),e=this.tagModal?.querySelector("#tagSlug"),i=this.tagModal?.querySelector("#tagDescription");if(!t?.value.trim()){this.showToast("Tag name is required","error");return}const a=t.value.trim(),s=e?.value.trim()||this.generateSlug(a),n={name:a,slug:s,description:i?.value.trim()||null};try{const o=!!this.editingTag,r=o?`${this.baseUrl}/api/v1/admin/blog/tags/${this.editingTag.id}`:`${this.baseUrl}/api/v1/admin/blog/tags`,d=await fetch(r,{method:o?"PUT":"POST",headers:c(),credentials:"include",body:JSON.stringify(n)});if(!d.ok){const m=await d.json().catch(()=>({}));throw new Error(m.message||"Failed to save tag")}const h=await d.json();if(h.status==="success")this.showToast(`Tag ${o?"updated":"created"} successfully`,"success"),this.closeModal(),this.loadTags();else throw new Error(h.message||"Failed to save tag")}catch(o){console.error("Error saving tag:",o),this.showToast(o.message||"Failed to save tag","error")}}confirmDeleteTag(t){const e=this.tags.find(i=>String(i.id)===String(t));e&&(this.pendingAction=()=>this.deleteTag(t),this.openConfirmModal("Delete Tag",`Are you sure you want to delete "${e.name}"?`))}async deleteTag(t){try{const e=await fetch(`${this.baseUrl}/api/v1/admin/blog/tags/${t}`,{method:"DELETE",headers:c(),credentials:"include"});if(!e.ok)throw new Error("Failed to delete tag");const i=await e.json();if(i.status==="success")this.showToast("Tag deleted successfully","success"),this.loadTags();else throw new Error(i.message||"Failed to delete tag")}catch(e){console.error("Error deleting tag:",e),this.showToast("Failed to delete tag","error")}}openConfirmModal(t,e){if(!this.confirmModal)return;const i=this.confirmModal.querySelector(".confirm-modal__title"),a=this.confirmModal.querySelector(".confirm-modal__message");i&&(i.textContent=t),a&&(a.textContent=e),this.confirmModal.classList.add("confirm-modal--visible")}closeConfirmModal(){this.confirmModal&&(this.confirmModal.classList.remove("confirm-modal--visible"),this.pendingAction=null)}renderPagination(){if(!this.pagination)return;const t=Math.ceil(this.totalTags/this.itemsPerPage);if(t<=1){this.pagination.innerHTML="";return}const{startPage:e,endPage:i}=this.calculatePageWindow(this.currentPage,t);let a='<nav class="pagination" aria-label="Pagination">';a+=`<button class="pagination__btn" ${this.currentPage===1?"disabled":""} data-page="1">First</button>`,a+=`<button class="pagination__btn" ${this.currentPage===1?"disabled":""} data-page="${this.currentPage-1}">Prev</button>`,a+='<div class="pagination__pages">';for(let o=e;o<=i;o++){const r=o===this.currentPage;a+=`<button class="pagination__btn ${r?"pagination__btn--active":""}" data-page="${o}" ${r?"disabled":""}>${o}</button>`}a+="</div>",a+=`<button class="pagination__btn" ${this.currentPage===t?"disabled":""} data-page="${this.currentPage+1}">Next</button>`,a+=`<button class="pagination__btn" ${this.currentPage===t?"disabled":""} data-page="${t}">Last</button>`,a+=`
      <div class="pagination__goto">
        <input type="number" class="pagination__input" min="1" max="${t}" placeholder="Page">
        <button class="pagination__btn" data-action="goto">Go</button>
      </div>
    `,a+="</nav>",this.pagination.innerHTML=a,this.pagination.querySelectorAll("[data-page]").forEach(o=>{o.addEventListener("click",()=>{const r=parseInt(o.dataset.page,10);r>=1&&r<=t&&(this.currentPage=r,this.loadTags())})});const s=this.pagination.querySelector('[data-action="goto"]'),n=this.pagination.querySelector(".pagination__input");s&&n&&(s.addEventListener("click",()=>{const o=parseInt(n.value,10);o>=1&&o<=t&&(this.currentPage=o,this.loadTags())}),n.addEventListener("keydown",o=>{if(o.key==="Enter"){const r=parseInt(n.value,10);r>=1&&r<=t&&(this.currentPage=r,this.loadTags())}}))}calculatePageWindow(t,e){let s,n;return e<=7?(s=1,n=e):t<=4?(s=1,n=7):t>=e-3?(s=e-7+1,n=e):(s=t-3,n=t+3),{startPage:s,endPage:n}}renderLoading(){this.tagsTable&&(this.tagsTable.innerHTML=`
      <tr>
        <td colspan="5">
          <div class="loading-spinner">
            <div class="loading-spinner__icon"></div>
          </div>
        </td>
      </tr>
    `)}renderError(){this.tagsTable&&(this.tagsTable.innerHTML=`
      <tr>
        <td colspan="5" class="tags-table__empty">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <p>Failed to load tags. Please try again.</p>
        </td>
      </tr>
    `)}formatDate(t){return t?new Date(t).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"-"}escapeHtml(t){if(!t)return"";const e=document.createElement("div");return e.textContent=t,e.innerHTML}}function g(){const l=window.BASE_URL||"",t=p(),e=new f({baseUrl:l,showToast:t});typeof window<"u"&&(window.blogTagsController=e)}function p(){const l={success:"linear-gradient(to right, #00b09b, #96c93d)",error:"linear-gradient(to right, #ff5f6d, #ffc371)",info:"linear-gradient(to right, #667eea, #764ba2)"};return function(e,i="success"){typeof Toastify<"u"?Toastify({text:e,duration:4e3,gravity:"top",position:"right",style:{background:l[i]||l.info}}).showToast():console.log(`[${i.toUpperCase()}] ${e}`)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",g):g()})();
