(function(){"use strict";function h(){const s=document.querySelector('meta[name="csrf-token"]');return s?s.getAttribute("content"):(console.warn('CSRF token not found. Ensure <meta name="csrf-token"> exists in page head.'),null)}function c(s={}){const e=h(),t={"Content-Type":"application/json",...s};return e&&(t["X-CSRF-TOKEN"]=e),t}class u{constructor(e){this.baseUrl=e.baseUrl,this.showToast=e.showToast,this.categoryTree=document.getElementById("categoryTree"),this.categoryModal=document.getElementById("categoryModal"),this.confirmModal=document.getElementById("confirmModal"),this.searchInput=document.getElementById("searchInput"),this.addCategoryBtn=document.getElementById("addCategoryBtn"),this.categories=[],this.flatCategories=[],this.editingCategory=null,this.pendingAction=null,this.expandedIds=new Set,this.init()}init(){this.bindEvents(),this.categoryTree&&this.categoryTree.querySelectorAll(".category-item[data-id]").length>0||this.loadCategories()}bindEvents(){if(this.addCategoryBtn&&this.addCategoryBtn.addEventListener("click",()=>this.openModal()),this.searchInput){let e;this.searchInput.addEventListener("input",t=>{clearTimeout(e),e=setTimeout(()=>{this.filterCategories(t.target.value)},300)})}if(this.categoryModal){const e=this.categoryModal.querySelector('[data-action="close"]'),t=this.categoryModal.querySelector('[data-action="cancel"]'),i=this.categoryModal.querySelector('[data-action="save"]');e&&e.addEventListener("click",()=>this.closeModal()),t&&t.addEventListener("click",()=>this.closeModal()),i&&i.addEventListener("click",()=>this.saveCategory()),this.categoryModal.addEventListener("click",o=>{o.target===this.categoryModal&&this.closeModal()})}if(this.confirmModal){const e=this.confirmModal.querySelector('[data-action="confirm"]'),t=this.confirmModal.querySelector('[data-action="cancel"]');e&&e.addEventListener("click",()=>{this.pendingAction&&(this.pendingAction(),this.pendingAction=null),this.closeConfirmModal()}),t&&t.addEventListener("click",()=>this.closeConfirmModal()),this.confirmModal.addEventListener("click",i=>{i.target===this.confirmModal&&this.closeConfirmModal()})}this.categoryTree&&this.categoryTree.addEventListener("click",e=>this.handleTreeClick(e))}handleTreeClick(e){const t=e.target.closest("[data-action]");if(!t)return;const i=t.dataset.action,o=t.dataset.id;switch(i){case"toggle":this.toggleCategory(o);break;case"edit":this.editCategory(o);break;case"delete":this.confirmDeleteCategory(o);break;case"add-child":this.openModal(o);break}}async loadCategories(){if(this.categoryTree){this.renderLoading();try{const e=await fetch(`${this.baseUrl}/api/v1/admin/blog/categories`,{method:"GET",headers:c(),credentials:"include"});if(!e.ok)throw new Error("Failed to load categories");const t=await e.json();if(t.status==="success")this.flatCategories=t.categories||[],this.categories=this.buildTree(this.flatCategories),this.renderTree();else throw new Error(t.message||"Failed to load categories")}catch(e){console.error("Error loading categories:",e),this.showToast("Failed to load categories","error"),this.renderError()}}}buildTree(e){const t=new Map,i=[];e.forEach(r=>{t.set(r.id,{...r,children:[]})}),e.forEach(r=>{const a=t.get(r.id);r.parent_id&&t.has(r.parent_id)?t.get(r.parent_id).children.push(a):i.push(a)});const o=(r,a)=>(r.position||0)-(a.position||0);return i.sort(o),t.forEach(r=>r.children.sort(o)),i}renderTree(){if(this.categoryTree){if(this.categories.length===0){this.categoryTree.innerHTML=`
        <div class="category-tree__empty">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <p>No categories yet. Create your first category!</p>
        </div>
      `;return}this.categoryTree.innerHTML=`
      <ul class="category-tree__list">
        ${this.categories.map(e=>this.renderCategoryItem(e,0)).join("")}
      </ul>
    `}}renderCategoryItem(e,t){const i=e.children&&e.children.length>0,o=this.expandedIds.has(String(e.id)),r=e.post_count||0,a=i?`<ul class="category-item__children ${o?"":"category-item__children--hidden"}">
           ${e.children.map(n=>this.renderCategoryItem(n,t+1)).join("")}
         </ul>`:"";return`
      <li class="category-item" data-id="${e.id}">
        <div class="category-item__row">
          <button class="category-item__toggle ${o?"category-item__toggle--expanded":""} ${i?"":"category-item__toggle--hidden"}"
                  data-action="toggle"
                  data-id="${e.id}"
                  aria-label="${o?"Collapse":"Expand"} category">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <div class="category-item__drag-handle">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
              <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
            </svg>
          </div>
          <div class="category-item__icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div class="category-item__content">
            <div class="category-item__name">${this.escapeHtml(e.name)}</div>
            <div class="category-item__meta">
              <span class="category-item__count">${r} posts</span>
              ${e.slug?`<span class="category-item__slug">/${e.slug}</span>`:""}
            </div>
          </div>
          <div class="category-item__actions">
            <button class="btn btn--icon" data-action="add-child" data-id="${e.id}" title="Add subcategory">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <button class="btn btn--icon" data-action="edit" data-id="${e.id}" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn btn--icon" data-action="delete" data-id="${e.id}" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
        ${a}
      </li>
    `}toggleCategory(e){this.expandedIds.has(e)?this.expandedIds.delete(e):this.expandedIds.add(e),this.renderTree()}filterCategories(e){if(!e)this.categories=this.buildTree(this.flatCategories);else{const t=e.toLowerCase(),i=this.flatCategories.filter(o=>o.name.toLowerCase().includes(t)||o.slug&&o.slug.toLowerCase().includes(t));this.categories=this.buildTree(i),this.expandedIds=new Set(this.flatCategories.map(o=>String(o.id)))}this.renderTree()}openModal(e=null){if(!this.categoryModal)return;this.editingCategory=null;const t=this.categoryModal.querySelector(".category-modal__title"),i=this.categoryModal.querySelector("form"),o=this.categoryModal.querySelector("#categoryParent");t&&(t.textContent=e?"Add Subcategory":"Add Category"),i&&i.reset(),o&&(o.innerHTML='<option value="">None (Root Category)</option>',this.flatCategories.forEach(a=>{o.innerHTML+=`<option value="${a.id}">${"  ".repeat(this.getCategoryDepth(a.id))}${this.escapeHtml(a.name)}</option>`}),e&&(o.value=e)),this.categoryModal.classList.add("category-modal--visible"),this.categoryModal.setAttribute("aria-hidden","false");const r=this.categoryModal.querySelector('input:not([type="hidden"])');r&&setTimeout(()=>r.focus(),100)}editCategory(e){const t=this.flatCategories.find(d=>String(d.id)===String(e));if(!t||(this.editingCategory=t,!this.categoryModal))return;const i=this.categoryModal.querySelector(".category-modal__title"),o=this.categoryModal.querySelector("#categoryName"),r=this.categoryModal.querySelector("#categorySlug"),a=this.categoryModal.querySelector("#categoryDescription"),n=this.categoryModal.querySelector("#categoryParent");if(i&&(i.textContent="Edit Category"),o&&(o.value=t.name||""),r&&(r.value=t.slug||""),a&&(a.value=t.description||""),n){const d=this.getDescendantIds(e);d.add(String(e)),n.innerHTML='<option value="">None (Root Category)</option>',this.flatCategories.forEach(l=>{d.has(String(l.id))||(n.innerHTML+=`<option value="${l.id}">${"  ".repeat(this.getCategoryDepth(l.id))}${this.escapeHtml(l.name)}</option>`)}),t.parent_id&&(n.value=t.parent_id)}this.categoryModal.classList.add("category-modal--visible"),this.categoryModal.setAttribute("aria-hidden","false")}getDescendantIds(e){const t=new Set,i=o=>{this.flatCategories.forEach(r=>{String(r.parent_id)===String(o)&&(t.add(String(r.id)),i(r.id))})};return i(e),t}getCategoryDepth(e){let t=0,i=this.flatCategories.find(o=>String(o.id)===String(e));for(;i&&i.parent_id;)t++,i=this.flatCategories.find(o=>String(o.id)===String(i.parent_id));return t}closeModal(){this.categoryModal&&(this.categoryModal.classList.remove("category-modal--visible"),this.categoryModal.setAttribute("aria-hidden","true"),this.editingCategory=null)}async saveCategory(){const e=this.categoryModal?.querySelector("#categoryName"),t=this.categoryModal?.querySelector("#categorySlug"),i=this.categoryModal?.querySelector("#categoryDescription"),o=this.categoryModal?.querySelector("#categoryParent");if(!e?.value.trim()){this.showToast("Category name is required","error");return}const r={name:e.value.trim(),slug:t?.value.trim()||null,description:i?.value.trim()||null,parent_id:o?.value?parseInt(o.value,10):null};try{const a=!!this.editingCategory,n=a?`${this.baseUrl}/api/v1/admin/blog/categories/${this.editingCategory.id}`:`${this.baseUrl}/api/v1/admin/blog/categories`,d=await fetch(n,{method:a?"PUT":"POST",headers:c(),credentials:"include",body:JSON.stringify(r)});if(!d.ok){const f=await d.json().catch(()=>({}));throw new Error(f.message||"Failed to save category")}const l=await d.json();if(l.status==="success")this.showToast(`Category ${a?"updated":"created"} successfully`,"success"),this.closeModal(),this.loadCategories();else throw new Error(l.message||"Failed to save category")}catch(a){console.error("Error saving category:",a),this.showToast(a.message||"Failed to save category","error")}}confirmDeleteCategory(e){const t=this.flatCategories.find(r=>String(r.id)===String(e));if(!t)return;const i=this.flatCategories.some(r=>String(r.parent_id)===String(e));let o=`Are you sure you want to delete "${t.name}"?`;i&&(o+=" This will also delete all subcategories."),this.pendingAction=()=>this.deleteCategory(e),this.openConfirmModal("Delete Category",o)}async deleteCategory(e){try{const t=await fetch(`${this.baseUrl}/api/v1/admin/blog/categories/${e}`,{method:"DELETE",headers:c(),credentials:"include"});if(!t.ok)throw new Error("Failed to delete category");const i=await t.json();if(i.status==="success")this.showToast("Category deleted successfully","success"),this.loadCategories();else throw new Error(i.message||"Failed to delete category")}catch(t){console.error("Error deleting category:",t),this.showToast("Failed to delete category","error")}}openConfirmModal(e,t){if(!this.confirmModal)return;const i=this.confirmModal.querySelector(".confirm-modal__title"),o=this.confirmModal.querySelector(".confirm-modal__message");i&&(i.textContent=e),o&&(o.textContent=t),this.confirmModal.classList.add("confirm-modal--visible")}closeConfirmModal(){this.confirmModal&&(this.confirmModal.classList.remove("confirm-modal--visible"),this.pendingAction=null)}renderLoading(){this.categoryTree&&(this.categoryTree.innerHTML=`
      <div class="loading-spinner">
        <div class="loading-spinner__icon"></div>
      </div>
    `)}renderError(){this.categoryTree&&(this.categoryTree.innerHTML=`
      <div class="category-tree__empty">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <p>Failed to load categories. Please try again.</p>
      </div>
    `)}escapeHtml(e){if(!e)return"";const t=document.createElement("div");return t.textContent=e,t.innerHTML}}function g(){const s=window.BASE_URL||"",e=y(),t=new u({baseUrl:s,showToast:e});typeof window<"u"&&(window.blogCategoriesController=t)}function y(){const s={success:"linear-gradient(to right, #00b09b, #96c93d)",error:"linear-gradient(to right, #ff5f6d, #ffc371)",info:"linear-gradient(to right, #667eea, #764ba2)"};return function(t,i="success"){typeof Toastify<"u"?Toastify({text:t,duration:4e3,gravity:"top",position:"right",style:{background:s[i]||s.info}}).showToast():console.log(`[${i.toUpperCase()}] ${t}`)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",g):g()})();
