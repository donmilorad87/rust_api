(function(){"use strict";function g(){const o=document.querySelector('meta[name="csrf-token"]');return o?o.getAttribute("content"):(console.warn('CSRF token not found. Ensure <meta name="csrf-token"> exists in page head.'),null)}function c(o={}){const e=g(),t={"Content-Type":"application/json",...o};return e&&(t["X-CSRF-TOKEN"]=e),t}class m{constructor(e){this.baseUrl=e.baseUrl,this.showToast=e.showToast,this.onSave=e.onSave,this.onImageSelect=e.onImageSelect,this.category=null,this.selectedImageUuid=null,this.saving=!1,this.createModal(),this.bindEvents()}createModal(){this.modal=document.createElement("div"),this.modal.className="modal",this.modal.id="categoryModal",this.modal.setAttribute("aria-hidden","true"),this.modal.innerHTML=`
      <div class="modal__backdrop" data-action="close"></div>
      <div class="modal__dialog" role="dialog" aria-modal="true" aria-labelledby="categoryModalTitle">
        <header class="modal__header">
          <h2 id="categoryModalTitle" class="modal__title">Create Category</h2>
          <button type="button" class="modal__close" data-action="close" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>
        <form id="categoryForm" class="modal__body">
          <div class="form-group">
            <label class="form-label" for="categoryName">Name <span style="color: var(--color-error)">*</span></label>
            <input type="text" id="categoryName" class="form-input" required maxlength="100" placeholder="Enter category name">
            <span class="form-error" id="categoryNameError"></span>
          </div>

          <div class="form-group">
            <label class="form-label" for="categorySlug">Slug</label>
            <input type="text" id="categorySlug" class="form-input" maxlength="100" placeholder="auto-generated-from-name">
            <span class="form-hint">Leave empty to auto-generate from name</span>
            <span class="form-error" id="categorySlugError"></span>
          </div>

          <div class="form-group">
            <label class="form-label" for="categoryDescription">Description</label>
            <textarea id="categoryDescription" class="form-textarea" rows="3" maxlength="500" placeholder="Enter category description (optional)"></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Cover Image</label>
            <div class="image-selector" id="coverImageSelector">
              <div class="image-selector__preview" id="coverImagePreview">
                <img src="" alt="Cover preview" class="image-selector__image" id="coverImage" style="display: none;">
                <div class="image-selector__placeholder" id="coverPlaceholder">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                  <span>No image</span>
                </div>
                <button type="button" class="image-selector__remove" id="removeCoverBtn" style="display: none;" aria-label="Remove image">
                  &times;
                </button>
              </div>
              <div class="image-selector__actions">
                <button type="button" class="image-selector__btn" id="selectCoverBtn">Browse Images</button>
              </div>
            </div>
            <input type="hidden" id="coverImageUuid" name="cover_image_uuid">
          </div>

          <div class="form-group">
            <label class="form-checkbox">
              <input type="checkbox" id="categoryActive" class="form-checkbox__input" checked>
              <span class="form-checkbox__label">Active</span>
            </label>
            <span class="form-hint">Inactive categories won't be visible in the store</span>
          </div>
        </form>
        <footer class="modal__footer">
          <button type="button" class="btn btn--ghost" data-action="close">Cancel</button>
          <button type="button" class="btn btn--primary" id="saveCategoryBtn">
            <span id="saveBtnText">Create Category</span>
            <span id="saveBtnSpinner" style="display: none;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
              </svg>
            </span>
          </button>
        </footer>
      </div>
    `,document.body.appendChild(this.modal),this.form=document.getElementById("categoryForm"),this.titleEl=document.getElementById("categoryModalTitle"),this.nameInput=document.getElementById("categoryName"),this.slugInput=document.getElementById("categorySlug"),this.descriptionInput=document.getElementById("categoryDescription"),this.activeCheckbox=document.getElementById("categoryActive"),this.coverImageUuidInput=document.getElementById("coverImageUuid"),this.coverImage=document.getElementById("coverImage"),this.coverPlaceholder=document.getElementById("coverPlaceholder"),this.removeCoverBtn=document.getElementById("removeCoverBtn"),this.saveBtn=document.getElementById("saveCategoryBtn"),this.saveBtnText=document.getElementById("saveBtnText"),this.saveBtnSpinner=document.getElementById("saveBtnSpinner"),this.nameError=document.getElementById("categoryNameError"),this.slugError=document.getElementById("categorySlugError")}bindEvents(){this.modal.addEventListener("click",e=>{e.target.closest('[data-action="close"]')&&this.close()}),document.addEventListener("keydown",e=>{e.key==="Escape"&&this.modal.classList.contains("modal--visible")&&this.close()}),this.nameInput.addEventListener("input",()=>{!this.category&&!this.slugInput.value&&(this.slugInput.placeholder=this.generateSlug(this.nameInput.value)||"auto-generated-from-name")}),document.getElementById("selectCoverBtn").addEventListener("click",()=>{typeof this.onImageSelect=="function"&&this.onImageSelect((e,t)=>{this.setSelectedImage(e,t)})}),this.removeCoverBtn.addEventListener("click",()=>{this.clearSelectedImage()}),this.saveBtn.addEventListener("click",()=>{this.save()}),this.form.addEventListener("submit",e=>{e.preventDefault(),this.save()})}open(e=null){this.category=e,this.resetForm(),e?(this.titleEl.textContent="Edit Category",this.saveBtnText.textContent="Update Category",this.nameInput.value=e.name||"",this.slugInput.value=e.slug||"",this.descriptionInput.value=e.description||"",this.activeCheckbox.checked=e.is_active!==!1,e.cover_image_uuid&&e.cover_image_url&&this.setSelectedImage(e.cover_image_uuid,e.cover_image_url)):(this.titleEl.textContent="Create Category",this.saveBtnText.textContent="Create Category"),this.modal.classList.add("modal--visible"),this.modal.setAttribute("aria-hidden","false"),this.nameInput.focus()}close(){this.modal.classList.remove("modal--visible"),this.modal.setAttribute("aria-hidden","true"),this.category=null}resetForm(){this.form.reset(),this.clearSelectedImage(),this.clearErrors(),this.activeCheckbox.checked=!0,this.slugInput.placeholder="auto-generated-from-name"}setSelectedImage(e,t){this.selectedImageUuid=e,this.coverImageUuidInput.value=e,this.coverImage.src=t+"?variant=thumb",this.coverImage.style.display="block",this.coverPlaceholder.style.display="none",this.removeCoverBtn.style.display="flex",this.modal.querySelector(".image-selector__preview").classList.add("image-selector__preview--has-image")}clearSelectedImage(){this.selectedImageUuid=null,this.coverImageUuidInput.value="",this.coverImage.src="",this.coverImage.style.display="none",this.coverPlaceholder.style.display="flex",this.removeCoverBtn.style.display="none",this.modal.querySelector(".image-selector__preview").classList.remove("image-selector__preview--has-image")}clearErrors(){this.nameError.textContent="",this.slugError.textContent="",this.nameInput.classList.remove("form-input--error"),this.slugInput.classList.remove("form-input--error")}showError(e,t){e==="name"?(this.nameError.textContent=t,this.nameInput.classList.add("form-input--error")):e==="slug"&&(this.slugError.textContent=t,this.slugInput.classList.add("form-input--error"))}generateSlug(e){return e.toLowerCase().trim().replace(/[^\w\s-]/g,"").replace(/[\s_-]+/g,"-").replace(/^-+|-+$/g,"")}validate(){this.clearErrors();let e=!0;const t=this.nameInput.value.trim();t?t.length<2&&(this.showError("name","Name must be at least 2 characters"),e=!1):(this.showError("name","Name is required"),e=!1);const s=this.slugInput.value.trim();return s&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)&&(this.showError("slug","Slug must contain only lowercase letters, numbers, and hyphens"),e=!1),e}async save(){if(!this.saving&&this.validate()){this.saving=!0,this.saveBtn.disabled=!0,this.saveBtnText.style.display="none",this.saveBtnSpinner.style.display="inline-flex";try{const e={name:this.nameInput.value.trim(),slug:this.slugInput.value.trim()||null,description:this.descriptionInput.value.trim()||null,cover_image_uuid:this.selectedImageUuid||null,is_active:this.activeCheckbox.checked},t=this.category?`${this.baseUrl}/api/v1/admin/store/categories/${this.category.id}`:`${this.baseUrl}/api/v1/admin/store/categories`,s=this.category?"PUT":"POST",a=await fetch(t,{method:s,headers:{...c(),"Content-Type":"application/json"},credentials:"include",body:JSON.stringify(e)}),i=await a.json();if(!a.ok){if(i.errors){i.errors.name&&this.showError("name",i.errors.name),i.errors.slug&&this.showError("slug",i.errors.slug);return}throw new Error(i.message||"Failed to save category")}if(i.status==="success")this.showToast(this.category?"Category updated successfully":"Category created successfully","success"),this.close(),typeof this.onSave=="function"&&this.onSave();else throw new Error(i.message||"Failed to save category")}catch(e){console.error("Error saving category:",e),this.showToast(e.message||"Failed to save category","error")}finally{this.saving=!1,this.saveBtn.disabled=!1,this.saveBtnText.style.display="inline",this.saveBtnSpinner.style.display="none"}}}}class u{constructor(e){this.showToast=e.showToast,this.onConfirm=null,this.processing=!1,this.createModal(),this.bindEvents()}createModal(){this.modal=document.createElement("div"),this.modal.className="confirm-modal",this.modal.id="confirmModal",this.modal.setAttribute("aria-hidden","true"),this.modal.innerHTML=`
      <div class="modal__backdrop" data-action="close"></div>
      <div class="confirm-modal__dialog modal__dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmModalTitle">
        <header class="modal__header">
          <h2 id="confirmModalTitle" class="modal__title">Confirm Action</h2>
          <button type="button" class="modal__close" data-action="close" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>
        <div class="modal__body">
          <p id="confirmModalMessage" class="confirm-modal__message">Are you sure?</p>
          <div id="confirmModalWarning" class="confirm-modal__warning" style="display: none;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span id="confirmModalWarningText"></span>
          </div>
          <div id="confirmModalTransfer" class="confirm-modal__select" style="display: none;">
            <label class="form-label" for="transferSelect">Transfer products to:</label>
            <select id="transferSelect" class="form-input">
              <option value="">Don't transfer (leave uncategorized)</option>
            </select>
          </div>
        </div>
        <footer class="confirm-modal__actions">
          <button type="button" class="btn btn--ghost" data-action="close">Cancel</button>
          <button type="button" class="btn btn--danger" id="confirmModalBtn">
            <span id="confirmBtnText">Confirm</span>
            <span id="confirmBtnSpinner" style="display: none;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
              </svg>
            </span>
          </button>
        </footer>
      </div>
    `,document.body.appendChild(this.modal),this.titleEl=document.getElementById("confirmModalTitle"),this.messageEl=document.getElementById("confirmModalMessage"),this.warningEl=document.getElementById("confirmModalWarning"),this.warningTextEl=document.getElementById("confirmModalWarningText"),this.transferEl=document.getElementById("confirmModalTransfer"),this.transferSelect=document.getElementById("transferSelect"),this.confirmBtn=document.getElementById("confirmModalBtn"),this.confirmBtnText=document.getElementById("confirmBtnText"),this.confirmBtnSpinner=document.getElementById("confirmBtnSpinner")}bindEvents(){this.modal.addEventListener("click",e=>{e.target.closest('[data-action="close"]')&&this.close()}),document.addEventListener("keydown",e=>{e.key==="Escape"&&this.modal.classList.contains("modal--visible")&&this.close()}),this.confirmBtn.addEventListener("click",async()=>{await this.confirm()})}open(e){this.titleEl.textContent=e.title||"Confirm Action",this.messageEl.textContent=e.message||"Are you sure?",this.confirmBtnText.textContent=e.confirmLabel||"Confirm",this.onConfirm=e.onConfirm,this.confirmBtn.className="btn",this.confirmBtn.classList.add(e.confirmClass||"btn--primary"),e.showWarning&&e.warningMessage?(this.warningTextEl.textContent=e.warningMessage,this.warningEl.style.display="flex"):this.warningEl.style.display="none",e.showTransfer&&e.transferOptions&&e.transferOptions.length>0?(this.transferSelect.innerHTML=`<option value="">Don't transfer (leave uncategorized)</option>`,e.transferOptions.forEach(t=>{const s=document.createElement("option");s.value=t.id,s.textContent=t.name,this.transferSelect.appendChild(s)}),this.transferEl.style.display="block"):this.transferEl.style.display="none",this.modal.classList.add("modal--visible"),this.modal.setAttribute("aria-hidden","false"),this.confirmBtn.focus()}close(){this.processing||(this.modal.classList.remove("modal--visible"),this.modal.setAttribute("aria-hidden","true"),this.onConfirm=null)}async confirm(){if(!(this.processing||typeof this.onConfirm!="function")){this.processing=!0,this.confirmBtn.disabled=!0,this.confirmBtnText.style.display="none",this.confirmBtnSpinner.style.display="inline-flex";try{const e=this.transferSelect.value?parseInt(this.transferSelect.value,10):null;await this.onConfirm(e),this.close()}catch(e){console.error("Confirm action error:",e)}finally{this.processing=!1,this.confirmBtn.disabled=!1,this.confirmBtnText.style.display="inline",this.confirmBtnSpinner.style.display="none"}}}}class p{constructor(e){this.baseUrl=e.baseUrl,this.showToast=e.showToast,this.images=[],this.selectedUuid=null,this.selectedUrl=null,this.onSelect=null,this.loading=!1,this.uploading=!1,this.createModal(),this.bindEvents()}createModal(){this.modal=document.createElement("div"),this.modal.className="image-picker-modal modal",this.modal.id="imagePickerModal",this.modal.setAttribute("aria-hidden","true"),this.modal.innerHTML=`
      <div class="modal__backdrop" data-action="close"></div>
      <div class="image-picker-modal__dialog modal__dialog" role="dialog" aria-modal="true" aria-labelledby="imagePickerTitle">
        <header class="modal__header">
          <h2 id="imagePickerTitle" class="modal__title">Select Image</h2>
          <button type="button" class="modal__close" data-action="close" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>
        <div class="modal__body">
          <div id="imagePickerContent" class="image-picker-modal__grid">
            <!-- Images will be loaded here -->
          </div>
        </div>
        <footer class="modal__footer">
          <button type="button" class="btn btn--ghost" data-action="close">Cancel</button>
          <button type="button" class="btn btn--primary" id="selectImageBtn" disabled>Select Image</button>
        </footer>
      </div>
      <input type="file" id="imagePickerUpload" accept="image/*" style="display: none;">
    `,document.body.appendChild(this.modal),this.contentEl=document.getElementById("imagePickerContent"),this.selectBtn=document.getElementById("selectImageBtn"),this.fileInput=document.getElementById("imagePickerUpload")}bindEvents(){this.modal.addEventListener("click",e=>{e.target.closest('[data-action="close"]')&&this.close()}),document.addEventListener("keydown",e=>{e.key==="Escape"&&this.modal.classList.contains("modal--visible")&&this.close()}),this.contentEl.addEventListener("click",e=>{const t=e.target.closest(".image-picker-modal__item");t&&(t.classList.contains("image-picker-modal__upload")?this.fileInput.click():this.selectImage(t))}),this.selectBtn.addEventListener("click",()=>{this.confirmSelection()}),this.fileInput.addEventListener("change",e=>{e.target.files&&e.target.files[0]&&this.uploadImage(e.target.files[0])})}open(e){this.onSelect=e,this.selectedUuid=null,this.selectedUrl=null,this.selectBtn.disabled=!0,this.modal.classList.add("modal--visible"),this.modal.setAttribute("aria-hidden","false"),this.loadImages()}close(){this.modal.classList.remove("modal--visible"),this.modal.setAttribute("aria-hidden","true"),this.onSelect=null}async loadImages(){this.loading=!0,this.contentEl.innerHTML=`
      <div class="image-picker-modal__loading">
        <div class="loading-state__spinner"></div>
        <span>Loading images...</span>
      </div>
    `;try{const e=await fetch(`${this.baseUrl}/api/v1/admin/uploads?storage_type=public&limit=50`,{method:"GET",headers:c(),credentials:"include"});if(!e.ok)throw new Error("Failed to load images");const t=await e.json();if(t.status==="success")this.images=(t.uploads||[]).filter(s=>s.mime_type&&s.mime_type.startsWith("image/")),this.renderImages();else throw new Error(t.message||"Failed to load images")}catch(e){console.error("Error loading images:",e),this.contentEl.innerHTML=`
        <div class="image-picker-modal__empty">
          <p>Failed to load images</p>
          <button class="btn btn--ghost" onclick="this.closest('.image-picker-modal').querySelector('.modal__close').click()">Close</button>
        </div>
      `}finally{this.loading=!1}}renderImages(){if(this.images.length===0){this.contentEl.innerHTML=`
        <div class="image-picker-modal__item image-picker-modal__upload">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Upload Image</span>
        </div>
        <div class="image-picker-modal__empty" style="grid-column: span 3;">
          <p>No images available</p>
        </div>
      `;return}let e=`
      <div class="image-picker-modal__item image-picker-modal__upload">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>Upload</span>
      </div>
    `;this.images.forEach(t=>{const s=`${this.baseUrl}/api/v1/upload/download/public/${t.uuid}`,a=this.selectedUuid===t.uuid;e+=`
        <div class="image-picker-modal__item ${a?"image-picker-modal__item--selected":""}"
             data-uuid="${t.uuid}"
             data-url="${s}">
          <img src="${s}?variant=thumb" alt="${t.original_name||"Image"}" loading="lazy">
        </div>
      `}),this.contentEl.innerHTML=e}selectImage(e){this.contentEl.querySelectorAll(".image-picker-modal__item--selected").forEach(t=>{t.classList.remove("image-picker-modal__item--selected")}),e.classList.add("image-picker-modal__item--selected"),this.selectedUuid=e.dataset.uuid,this.selectedUrl=e.dataset.url,this.selectBtn.disabled=!1}confirmSelection(){!this.selectedUuid||!this.selectedUrl||(typeof this.onSelect=="function"&&this.onSelect(this.selectedUuid,this.selectedUrl),this.close())}async uploadImage(e){if(!this.uploading){this.uploading=!0;try{const t=new FormData;t.append("file",e),t.append("storage_type","public");const s=document.querySelector('meta[name="csrf-token"]')?.content||"",a=await fetch(`${this.baseUrl}/api/v1/upload`,{method:"POST",headers:{"X-CSRF-Token":s},credentials:"include",body:t});if(!a.ok)throw new Error("Failed to upload image");const i=await a.json();if(i.status==="success"){if(this.showToast("Image uploaded successfully","success"),await this.loadImages(),i.upload&&i.upload.uuid){const r=this.contentEl.querySelector(`[data-uuid="${i.upload.uuid}"]`);r&&this.selectImage(r)}}else throw new Error(i.message||"Failed to upload image")}catch(t){console.error("Error uploading image:",t),this.showToast("Failed to upload image","error")}finally{this.uploading=!1,this.fileInput.value=""}}}}class v{constructor(e){this.baseUrl=e.baseUrl,this.categoriesTable=e.categoriesTable,this.showToast=e.showToast,this.categories=[],this.loading=!1,this.draggedRow=null,this.draggedIndex=null,this.categoryModal=new m({baseUrl:this.baseUrl,showToast:this.showToast,onSave:()=>this.loadCategories(),onImageSelect:t=>this.imagePicker.open(t)}),this.confirmModal=new u({showToast:this.showToast}),this.imagePicker=new p({baseUrl:this.baseUrl,showToast:this.showToast}),this.init()}init(){this.bindEvents(),this.loadCategories()}bindEvents(){const e=document.getElementById("createCategoryBtn");e&&e.addEventListener("click",()=>{this.categoryModal.open()});const t=document.getElementById("searchInput");if(t){let s;t.addEventListener("input",a=>{clearTimeout(s),s=setTimeout(()=>{this.filterCategories(a.target.value)},300)})}this.categoriesTable.addEventListener("click",s=>{const a=s.target.closest('[data-action="edit"]');if(a){const n=parseInt(a.dataset.id,10),l=this.categories.find(d=>d.id===n);l&&this.categoryModal.open(l);return}const i=s.target.closest('[data-action="delete"]');if(i){const n=parseInt(i.dataset.id,10),l=this.categories.find(d=>d.id===n);l&&this.confirmDelete(l);return}const r=s.target.closest('[data-action="toggle"]');if(r){const n=parseInt(r.dataset.id,10),l=this.categories.find(d=>d.id===n);l&&this.toggleActive(l);return}}),this.categoriesTable.addEventListener("dragstart",s=>this.handleDragStart(s)),this.categoriesTable.addEventListener("dragend",s=>this.handleDragEnd(s)),this.categoriesTable.addEventListener("dragover",s=>this.handleDragOver(s)),this.categoriesTable.addEventListener("drop",s=>this.handleDrop(s)),this.categoriesTable.addEventListener("dragleave",s=>this.handleDragLeave(s))}async loadCategories(){this.loading=!0,this.renderLoading();try{const e=await fetch(`${this.baseUrl}/api/v1/admin/store/categories`,{method:"GET",headers:c(),credentials:"include"});if(!e.ok)throw new Error("Failed to load categories");const t=await e.json();if(t.status==="success")this.categories=t.categories||[],this.renderTable();else throw new Error(t.message||"Failed to load categories")}catch(e){console.error("Error loading categories:",e),this.showToast("Failed to load categories","error"),this.renderError()}finally{this.loading=!1}}filterCategories(e){const t=e.toLowerCase().trim();if(!t){this.renderTable();return}const s=this.categories.filter(a=>a.name.toLowerCase().includes(t)||a.slug.toLowerCase().includes(t)||a.description&&a.description.toLowerCase().includes(t));this.renderTable(s)}renderTable(e=null){const t=e||this.categories;if(t.length===0){this.renderEmpty();return}const s=t.map((a,i)=>this.createRow(a,i)).join("");this.categoriesTable.innerHTML=s}createRow(e,t){const s=e.cover_image_url?`<img src="${e.cover_image_url}?variant=thumb" alt="${e.name}" class="cover-thumbnail">`:`<div class="cover-thumbnail cover-thumbnail--placeholder">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
             <circle cx="8.5" cy="8.5" r="1.5"></circle>
             <polyline points="21 15 16 10 5 21"></polyline>
           </svg>
         </div>`,a=e.is_active?"status-badge--active":"status-badge--inactive",i=e.is_active?"Active":"Inactive",r=e.is_active?'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>':'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',n=e.description?this.truncate(e.description,50):'<span style="color: var(--text-muted)">No description</span>';return`
      <tr class="categories-table__row" draggable="true" data-id="${e.id}" data-index="${t}">
        <td class="categories-table__cell categories-table__cell--drag" data-label="Order">
          <span class="drag-handle" title="Drag to reorder">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="5" r="1"></circle>
              <circle cx="9" cy="12" r="1"></circle>
              <circle cx="9" cy="19" r="1"></circle>
              <circle cx="15" cy="5" r="1"></circle>
              <circle cx="15" cy="12" r="1"></circle>
              <circle cx="15" cy="19" r="1"></circle>
            </svg>
          </span>
        </td>
        <td class="categories-table__cell categories-table__cell--cover" data-label="Cover">
          ${s}
        </td>
        <td class="categories-table__cell categories-table__cell--name" data-label="Name">
          ${this.escapeHtml(e.name)}
        </td>
        <td class="categories-table__cell categories-table__cell--slug" data-label="Slug">
          ${this.escapeHtml(e.slug)}
        </td>
        <td class="categories-table__cell categories-table__cell--description" data-label="Description" title="${this.escapeHtml(e.description||"")}">
          ${n}
        </td>
        <td class="categories-table__cell categories-table__cell--count" data-label="Products">
          ${e.product_count||0}
        </td>
        <td class="categories-table__cell categories-table__cell--status" data-label="Status">
          <span class="status-badge ${a}">${i}</span>
        </td>
        <td class="categories-table__cell categories-table__cell--actions" data-label="Actions">
          <div class="action-buttons">
            <button class="btn btn--icon btn--edit" data-action="edit" data-id="${e.id}" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn btn--icon btn--toggle" data-action="toggle" data-id="${e.id}" title="${e.is_active?"Deactivate":"Activate"}">
              ${r}
            </button>
            <button class="btn btn--icon btn--delete" data-action="delete" data-id="${e.id}" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `}renderEmpty(){this.categoriesTable.innerHTML=`
      <tr>
        <td colspan="8" class="categories-table__empty">
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <p>No categories found</p>
            <div class="empty-state__action">
              <button class="btn btn--primary" id="emptyCreateBtn">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create First Category
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;const e=document.getElementById("emptyCreateBtn");e&&e.addEventListener("click",()=>{this.categoryModal.open()})}renderLoading(){this.categoriesTable.innerHTML=`
      <tr>
        <td colspan="8" class="categories-table__empty">
          <div class="loading-state">
            <div class="loading-state__spinner"></div>
            <p>Loading categories...</p>
          </div>
        </td>
      </tr>
    `}renderError(){this.categoriesTable.innerHTML=`
      <tr>
        <td colspan="8" class="categories-table__empty">
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p>Failed to load categories</p>
            <div class="empty-state__action">
              <button class="btn btn--ghost" onclick="location.reload()">
                Retry
              </button>
            </div>
          </div>
        </td>
      </tr>
    `}async confirmDelete(e){const t=e.product_count&&e.product_count>0,s=this.categories.filter(a=>a.id!==e.id);this.confirmModal.open({title:"Delete Category",message:`Are you sure you want to delete "${e.name}"?`,confirmLabel:"Delete",confirmClass:"btn--danger",showWarning:t,warningMessage:`This category has ${e.product_count} product(s). They will become uncategorized.`,showTransfer:t&&s.length>0,transferOptions:s,onConfirm:async a=>{await this.deleteCategory(e.id,a)}})}async deleteCategory(e,t=null){try{const s=t?`${this.baseUrl}/api/v1/admin/store/categories/${e}?transfer_to=${t}`:`${this.baseUrl}/api/v1/admin/store/categories/${e}`,a=await fetch(s,{method:"DELETE",headers:c(),credentials:"include"});if(!a.ok){const r=await a.json().catch(()=>({}));throw new Error(r.message||"Failed to delete category")}const i=await a.json();if(i.status==="success")this.showToast("Category deleted successfully","success"),await this.loadCategories();else throw new Error(i.message||"Failed to delete category")}catch(s){console.error("Error deleting category:",s),this.showToast(s.message||"Failed to delete category","error")}}async toggleActive(e){try{const t=await fetch(`${this.baseUrl}/api/v1/admin/store/categories/${e.id}`,{method:"PUT",headers:{...c(),"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({is_active:!e.is_active})});if(!t.ok)throw new Error("Failed to update category");const s=await t.json();if(s.status==="success")this.showToast(`Category ${e.is_active?"deactivated":"activated"} successfully`,"success"),await this.loadCategories();else throw new Error(s.message||"Failed to update category")}catch(t){console.error("Error toggling category:",t),this.showToast("Failed to update category","error")}}handleDragStart(e){const t=e.target.closest(".categories-table__row");t&&(this.draggedRow=t,this.draggedIndex=parseInt(t.dataset.index,10),t.classList.add("categories-table__row--dragging"),e.dataTransfer.effectAllowed="move",e.dataTransfer.setData("text/plain",t.dataset.id))}handleDragEnd(e){const t=e.target.closest(".categories-table__row");t&&t.classList.remove("categories-table__row--dragging"),this.categoriesTable.querySelectorAll(".categories-table__row--drag-over").forEach(s=>{s.classList.remove("categories-table__row--drag-over")}),this.draggedRow=null,this.draggedIndex=null}handleDragOver(e){e.preventDefault(),e.dataTransfer.dropEffect="move";const t=e.target.closest(".categories-table__row");!t||t===this.draggedRow||(this.categoriesTable.querySelectorAll(".categories-table__row--drag-over").forEach(s=>{s!==t&&s.classList.remove("categories-table__row--drag-over")}),t.classList.add("categories-table__row--drag-over"))}handleDragLeave(e){const t=e.target.closest(".categories-table__row");t&&!t.contains(e.relatedTarget)&&t.classList.remove("categories-table__row--drag-over")}async handleDrop(e){e.preventDefault();const t=e.target.closest(".categories-table__row");if(!t||!this.draggedRow||t===this.draggedRow)return;t.classList.remove("categories-table__row--drag-over");const s=parseInt(t.dataset.index,10),a=parseInt(this.draggedRow.dataset.id,10);if(isNaN(s)||isNaN(a))return;const i=this.categories.find(r=>r.id===a);i&&(this.categories=this.categories.filter(r=>r.id!==a),this.categories.splice(s,0,i),this.renderTable(),await this.saveReorder())}async saveReorder(){try{const e=this.categories.map(a=>a.id),t=await fetch(`${this.baseUrl}/api/v1/admin/store/categories/reorder`,{method:"POST",headers:{...c(),"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({category_ids:e})});if(!t.ok)throw new Error("Failed to save order");const s=await t.json();if(s.status==="success")this.showToast("Category order updated","success");else throw new Error(s.message||"Failed to save order")}catch(e){console.error("Error saving order:",e),this.showToast("Failed to save category order","error"),await this.loadCategories()}}escapeHtml(e){if(!e)return"";const t=document.createElement("div");return t.textContent=e,t.innerHTML}truncate(e,t){return e?e.length>t?e.substring(0,t)+"...":e:""}}function h(){const o=document.getElementById("categoriesTable");if(!o){console.error("CategoryManagePage: Required DOM elements not found");return}const e=window.BASE_URL||"",t=f(),s=new v({baseUrl:e,categoriesTable:o,showToast:t});typeof window<"u"&&(window.categoriesController=s)}function f(){const o={success:"linear-gradient(to right, #00b09b, #96c93d)",error:"linear-gradient(to right, #ff5f6d, #ffc371)",info:"linear-gradient(to right, #667eea, #764ba2)"};return function(t,s="success"){typeof Toastify<"u"?Toastify({text:t,duration:4e3,gravity:"top",position:"right",style:{background:o[s]||o.info}}).showToast():console.log(`[${s.toUpperCase()}] ${t}`)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",h):h()})();
