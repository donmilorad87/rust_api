(function(){"use strict";function v(){const d=document.querySelector('meta[name="csrf-token"]');return d?d.getAttribute("content"):(console.warn('CSRF token not found. Ensure <meta name="csrf-token"> exists in page head.'),null)}function p(d={}){const e=v(),t={"Content-Type":"application/json",...d};return e&&(t["X-CSRF-TOKEN"]=e),t}class b{constructor(e,t,s,a,l,i,o=!1){this.upload=e,this.baseUrl=t,this.onEditClick=s,this.onDeleteClick=a,this.onPreviewClick=l,this.onSelectToggle=i,this.isSelected=o}render(){const e=document.createElement("div");e.className=`asset-card${this.isSelected?" asset-card--selected":""}`,e.dataset.uuid=this.upload.uuid;const t=this.isImageType(this.upload.mime_type),s=this.isVideoType(this.upload.mime_type),a=this.upload.mime_type==="application/pdf",l=this.upload.storage_type==="public",i=l?`${this.baseUrl}/api/v1/upload/download/public/${this.upload.uuid}`:`${this.baseUrl}/api/v1/upload/private/${this.upload.uuid}`,o=this.renderPreview(t,s,a,i),n=this.upload.title||this.upload.original_name,c=this.upload.description||"",u=this.formatBytes(this.upload.size_bytes);e.innerHTML=`
      <div class="asset-card__preview">
        <label class="asset-card__select" aria-label="Select upload">
          <input type="checkbox" class="asset-card__checkbox" ${this.isSelected?"checked":""}>
          <span class="asset-card__checkmark" aria-hidden="true"></span>
        </label>
        ${o}
        <div class="asset-card__overlay">
          <div class="asset-card__actions">
            <button class="btn btn--icon btn--edit" title="Asset Info">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn btn--icon btn--delete" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div class="asset-card__info">
        <h3 class="asset-card__title" title="${this.escapeHtml(n)}">
          ${this.escapeHtml(this.truncate(n,30))}
        </h3>
        ${c?`<p class="asset-card__description" title="${this.escapeHtml(c)}">${this.escapeHtml(this.truncate(c,50))}</p>`:""}
        <div class="asset-card__meta">
          <span class="badge badge--${l?"public":"private"}">
            ${this.upload.storage_type}
          </span>
          <span class="asset-card__size">${u}</span>
          <span class="asset-card__extension">.${this.upload.extension}</span>
        </div>
      </div>
    `;const x=e.querySelector(".btn--edit"),k=e.querySelector(".btn--delete"),h=e.querySelector(".asset-card__checkbox"),g=e.querySelector(".asset-card__select");return x.addEventListener("click",r=>{r.stopPropagation(),this.onEditClick(this.upload)}),k.addEventListener("click",r=>{r.stopPropagation(),this.onDeleteClick(this.upload.uuid)}),g&&g.addEventListener("click",r=>{r.stopPropagation()}),h&&(h.addEventListener("click",r=>{r.stopPropagation()}),h.addEventListener("change",r=>{r.stopPropagation(),e.classList.toggle("asset-card--selected",h.checked),this.onSelectToggle&&this.onSelectToggle(this.upload.uuid,h.checked)})),e.querySelector(".asset-card__preview").addEventListener("click",r=>{if(!r.target.closest(".btn")&&!r.target.closest(".asset-card__select"))if(this.onPreviewClick){const U=this.isImageType(this.upload.mime_type)?`${i}?variant=full`:i;this.onPreviewClick(this.upload,U)}else window.open(i,"_blank")}),e}renderPreview(e,t,s,a){return e?`<img src="${`${a}?variant=small`}" alt="${this.escapeHtml(this.upload.title||this.upload.original_name)}" class="asset-card__image" data-full-url="${a}">`:t?`
        <video class="asset-card__video" controls>
          <source src="${a}" type="${this.upload.mime_type}">
          Your browser does not support the video tag.
        </video>
      `:s?`
        <div class="asset-card__icon asset-card__icon--pdf">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <text x="12" y="17" text-anchor="middle" font-size="6" font-weight="bold" fill="currentColor">PDF</text>
          </svg>
        </div>
      `:`
        <div class="asset-card__icon asset-card__icon--file">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <span class="asset-card__icon-text">${this.upload.extension.toUpperCase()}</span>
        </div>
      `}isImageType(e){return e.startsWith("image/")}isVideoType(e){return e.startsWith("video/")}formatBytes(e){if(e===0)return"0 B";const t=1024,s=["B","KB","MB","GB"],a=Math.floor(Math.log(e)/Math.log(t));return parseFloat((e/Math.pow(t,a)).toFixed(1))+" "+s[a]}truncate(e,t){return e?e.length>t?e.substring(0,t)+"...":e:""}escapeHtml(e){if(!e)return"";const t=document.createElement("div");return t.textContent=e,t.innerHTML}}class f{constructor(e){this.baseUrl=e.baseUrl,this.showToast=e.showToast,this.onSave=e.onSave,this.modal=null,this.currentUpload=null,this.createModal()}createModal(){this.modal=document.createElement("div"),this.modal.className="modal",this.modal.id="assetInfoModal",this.modal.style.display="none",this.modal.innerHTML=`
      <div class="modal__overlay"></div>
      <div class="modal__content">
        <div class="modal__header">
          <h2 class="modal__title">Asset Information</h2>
          <button class="modal__close" type="button" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal__body">
          <form id="assetInfoForm" class="asset-info-form">
            <div class="form-group">
              <label for="assetTitle" class="form-label">
                Title
                <span class="form-hint">(Used for aria-title attribute)</span>
              </label>
              <input
                type="text"
                id="assetTitle"
                name="title"
                class="form-input"
                maxlength="255"
                placeholder="Enter asset title"
              >
              <small class="form-help">Leave empty to use filename</small>
            </div>

            <div class="form-group">
              <label for="assetDescription" class="form-label">
                Description
                <span class="form-hint">(Used for alt attribute)</span>
              </label>
              <textarea
                id="assetDescription"
                name="description"
                class="form-textarea"
                rows="4"
                maxlength="500"
                placeholder="Enter asset description"
              ></textarea>
              <small class="form-help">Describe what this asset shows or represents</small>
            </div>

            <div class="form-group">
              <label class="form-label">
                Storage Type
              </label>
              <div class="toggle-group">
                <label class="toggle-option">
                  <input type="radio" name="storageType" value="public" id="storagePublic">
                  <span class="toggle-option__label">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M12 6v6l4 2"></path>
                    </svg>
                    Public
                  </span>
                  <small class="toggle-option__hint">Accessible via direct URL</small>
                </label>
                <label class="toggle-option">
                  <input type="radio" name="storageType" value="private" id="storagePrivate">
                  <span class="toggle-option__label">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    Private
                  </span>
                  <small class="toggle-option__hint">Requires authentication</small>
                </label>
              </div>
            </div>

            <div class="asset-info-form__preview">
              <strong>File:</strong> <span id="assetFileName"></span>
            </div>
            <div class="asset-info-form__preview">
              <strong>Type:</strong> <span id="assetFileType"></span>
            </div>
            <div class="asset-info-form__preview">
              <strong>UUID:</strong> <span id="assetUUID"></span>
            </div>
          </form>
        </div>
        <div class="modal__footer">
          <button type="button" class="btn btn--secondary modal__cancel">Cancel</button>
          <button type="submit" form="assetInfoForm" class="btn btn--primary">
            Save Changes
          </button>
        </div>
      </div>
    `,document.body.appendChild(this.modal),this.bindEvents()}bindEvents(){const e=this.modal.querySelector(".modal__overlay"),t=this.modal.querySelector(".modal__close"),s=this.modal.querySelector(".modal__cancel"),a=this.modal.querySelector("#assetInfoForm");e.addEventListener("click",()=>this.close()),t.addEventListener("click",()=>this.close()),s.addEventListener("click",()=>this.close()),a.addEventListener("submit",l=>{l.preventDefault(),this.save()}),document.addEventListener("keydown",l=>{l.key==="Escape"&&this.modal.style.display==="flex"&&this.close()})}open(e){this.currentUpload=e,document.getElementById("assetTitle").value=e.title||"",document.getElementById("assetDescription").value=e.description||"",document.getElementById("assetFileName").textContent=e.original_name,document.getElementById("assetFileType").textContent=e.mime_type,document.getElementById("assetUUID").textContent=e.uuid,e.storage_type==="public"?document.getElementById("storagePublic").checked=!0:document.getElementById("storagePrivate").checked=!0,this.modal.style.display="flex",document.body.style.overflow="hidden",setTimeout(()=>{document.getElementById("assetTitle").focus()},100)}close(){this.modal.style.display="none",document.body.style.overflow="",this.currentUpload=null,document.getElementById("assetInfoForm").reset()}async save(){if(!this.currentUpload)return;const e=document.getElementById("assetTitle").value.trim(),t=document.getElementById("assetDescription").value.trim(),s=document.querySelector('input[name="storageType"]:checked').value,a={title:e||null,description:t||null,storage_type:s};try{const l=await fetch(`${this.baseUrl}/api/v1/admin/uploads/${this.currentUpload.uuid}/metadata`,{method:"PATCH",headers:p(),credentials:"include",body:JSON.stringify(a)});if(!l.ok){const o=await l.json();throw new Error(o.message||"Failed to update asset metadata")}const i=await l.json();if(i.status==="success")this.showToast("Asset metadata updated successfully","success"),this.close(),this.onSave&&this.onSave();else throw new Error(i.message||"Failed to update asset metadata")}catch(l){console.error("Error updating asset metadata:",l),this.showToast(l.message||"Failed to update asset metadata","error")}}destroy(){this.modal&&this.modal.parentElement&&this.modal.parentElement.removeChild(this.modal),this.modal=null,this.currentUpload=null}}class w{constructor(){this.currentImage=null,this.lightboxEl=null}open(e,t=""){this.currentImage={url:e,title:t},this.render(),document.body.style.overflow="hidden"}close(){this.lightboxEl&&(this.lightboxEl.remove(),this.lightboxEl=null,document.body.style.overflow="")}render(){this.close(),this.lightboxEl=document.createElement("div"),this.lightboxEl.className="lightbox",this.lightboxEl.innerHTML=`
      <div class="lightbox__overlay"></div>
      <div class="lightbox__content">
        <button class="lightbox__close" title="Close (Esc)">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div class="lightbox__image-container">
          <img src="${this.currentImage.url}" alt="${this.escapeHtml(this.currentImage.title)}" class="lightbox__image">
        </div>
        ${this.currentImage.title?`<div class="lightbox__title">${this.escapeHtml(this.currentImage.title)}</div>`:""}
        <a href="${this.currentImage.url}" download class="lightbox__download" title="Download">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </a>
      </div>
    `,document.body.appendChild(this.lightboxEl),this.bindEvents()}bindEvents(){this.lightboxEl.querySelector(".lightbox__close").addEventListener("click",()=>this.close()),this.lightboxEl.querySelector(".lightbox__overlay").addEventListener("click",()=>this.close());const s=l=>{l.key==="Escape"&&(this.close(),document.removeEventListener("keydown",s))};document.addEventListener("keydown",s),this.lightboxEl.querySelector(".lightbox__image-container").addEventListener("click",l=>l.stopPropagation())}escapeHtml(e){if(!e)return"";const t=document.createElement("div");return t.textContent=e,t.innerHTML}}class _{constructor(e){this.baseUrl=e.baseUrl,this.showToast=e.showToast,this.onComplete=e.onComplete,this.modalEl=null,this.uploadedFile=null,this.currentStep=1}open(){this.currentStep=1,this.uploadedFile=null,this.render()}close(){this.modalEl&&(this.modalEl.remove(),this.modalEl=null)}render(){this.close(),this.modalEl=document.createElement("div"),this.modalEl.className="modal",this.modalEl.innerHTML=`
      <div class="modal__overlay"></div>
      <div class="modal__content">
        <div class="modal__header">
          <h2 class="modal__title">${this.currentStep===1?"Upload File":"File Metadata"}</h2>
          <button class="modal__close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal__body">
          ${this.currentStep===1?this.renderUploadStep():this.renderMetadataStep()}
        </div>
      </div>
    `,document.body.appendChild(this.modalEl),this.bindEvents()}renderUploadStep(){return`
      <div class="upload-step">
        <div class="file-dropzone" id="fileDropzone">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <p class="file-dropzone__text">
            <strong>Click to browse</strong> or drag and drop your file here
          </p>
          <p class="file-dropzone__hint">Supported: Images, PDFs, Documents</p>
          <input type="file" id="fileInput" class="file-dropzone__input" accept="image/*,application/pdf,.doc,.docx,.txt">
        </div>
        <div id="uploadProgress" class="upload-progress" style="display: none;">
          <div class="upload-progress__bar">
            <div class="upload-progress__fill" id="progressFill"></div>
          </div>
          <p class="upload-progress__text" id="progressText">Uploading...</p>
        </div>
      </div>
    `}renderMetadataStep(){const t=this.uploadedFile.storage_type==="public"?`${this.baseUrl}/api/v1/upload/download/public/${this.uploadedFile.uuid}`:`${this.baseUrl}/api/v1/upload/private/${this.uploadedFile.uuid}`;return`
      <form class="upload-metadata-form" id="metadataForm">
        <div class="upload-metadata-form__preview">
          ${this.uploadedFile.mime_type&&this.uploadedFile.mime_type.startsWith("image/")?`
            <div class="upload-preview-image">
              <img src="${t}" alt="${this.escapeHtml(this.uploadedFile.original_name)}" />
            </div>
          `:`
            <div class="upload-preview-file">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </div>
          `}
          <div class="upload-preview-info">
            <strong>File:</strong> ${this.escapeHtml(this.uploadedFile.original_name)}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="uploadTitle">
            Title <span class="form-hint">(optional)</span>
          </label>
          <input
            type="text"
            id="uploadTitle"
            class="form-input"
            placeholder="Enter a descriptive title"
            value="${this.escapeHtml(this.uploadedFile.original_name)}"
          >
        </div>

        <div class="form-group">
          <label class="form-label" for="uploadDescription">
            Description <span class="form-hint">(optional)</span>
          </label>
          <textarea
            id="uploadDescription"
            class="form-textarea"
            placeholder="Enter a description or alt text"
            rows="3"
          ></textarea>
          <small class="form-help">Used for accessibility and SEO</small>
        </div>

        <div class="form-group">
          <label class="form-label">
            Storage Type
          </label>
          <div class="toggle-group">
            <label class="toggle-option">
              <input type="radio" name="storageType" value="public" checked>
              <span class="toggle-option__label">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 6v6l4 2"></path>
                </svg>
                Public
              </span>
              <small class="toggle-option__hint">Accessible via direct URL</small>
            </label>
            <label class="toggle-option">
              <input type="radio" name="storageType" value="private">
              <span class="toggle-option__label">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Private
              </span>
              <small class="toggle-option__hint">Requires authentication</small>
            </label>
          </div>
        </div>

        <div class="modal__footer">
          <button type="button" class="btn btn--secondary" id="cancelMetadata">Cancel</button>
          <button type="submit" class="btn btn--primary">Save & Finish</button>
        </div>
      </form>
    `}bindEvents(){this.modalEl.querySelector(".modal__close").addEventListener("click",()=>this.close()),this.modalEl.querySelector(".modal__overlay").addEventListener("click",()=>this.close()),this.currentStep===1?this.bindUploadStepEvents():this.bindMetadataStepEvents()}bindUploadStepEvents(){const e=this.modalEl.querySelector("#fileDropzone"),t=this.modalEl.querySelector("#fileInput");e.addEventListener("click",()=>t.click()),t.addEventListener("change",s=>{s.target.files.length>0&&this.uploadFile(s.target.files[0])}),e.addEventListener("dragover",s=>{s.preventDefault(),e.classList.add("file-dropzone--dragover")}),e.addEventListener("dragleave",()=>{e.classList.remove("file-dropzone--dragover")}),e.addEventListener("drop",s=>{s.preventDefault(),e.classList.remove("file-dropzone--dragover"),s.dataTransfer.files.length>0&&this.uploadFile(s.dataTransfer.files[0])})}bindMetadataStepEvents(){const e=this.modalEl.querySelector("#metadataForm"),t=this.modalEl.querySelector("#cancelMetadata");e.addEventListener("submit",s=>{s.preventDefault(),this.saveMetadata()}),t.addEventListener("click",()=>this.close())}async uploadFile(e){const t=this.modalEl.querySelector("#fileDropzone"),s=this.modalEl.querySelector("#uploadProgress"),a=this.modalEl.querySelector("#progressFill"),l=this.modalEl.querySelector("#progressText");t.style.display="none",s.style.display="block";try{const i=new FormData;i.append("file",e),i.append("storage_type","public");const o=new XMLHttpRequest;o.upload.addEventListener("progress",n=>{if(n.lengthComputable){const c=n.loaded/n.total*100;a.style.width=c+"%",l.textContent=`Uploading... ${Math.round(c)}%`}}),o.addEventListener("load",()=>{if(o.status===200||o.status===201){const n=JSON.parse(o.responseText);if(n.status==="success")this.uploadedFile=n.upload,this.currentStep=2,this.showToast("File uploaded successfully!","success"),this.render();else throw new Error(n.message||"Upload failed")}else throw new Error("Upload failed")}),o.addEventListener("error",()=>{throw new Error("Network error during upload")}),o.open("POST",`${this.baseUrl}/api/v1/upload/public`),o.withCredentials=!0,o.send(i)}catch(i){console.error("Upload error:",i),this.showToast(i.message||"Failed to upload file","error"),t.style.display="flex",s.style.display="none"}}async saveMetadata(){const e=this.modalEl.querySelector("#uploadTitle").value.trim(),t=this.modalEl.querySelector("#uploadDescription").value.trim(),s=this.modalEl.querySelector('input[name="storageType"]:checked').value;try{const a=await fetch(`${this.baseUrl}/api/v1/admin/uploads/${this.uploadedFile.uuid}/metadata`,{method:"PATCH",headers:p(),credentials:"include",body:JSON.stringify({title:e||null,description:t||null,storage_type:s})});if(!a.ok)throw new Error("Failed to save metadata");const l=await a.json();if(l.status==="success")this.showToast("Upload completed successfully!","success"),this.close(),this.onComplete&&this.onComplete();else throw new Error(l.message||"Failed to save metadata")}catch(a){console.error("Save metadata error:",a),this.showToast("Failed to save metadata","error")}}escapeHtml(e){if(!e)return"";const t=document.createElement("div");return t.textContent=e,t.innerHTML}}class y{constructor(e){this.baseUrl=e.baseUrl,this.uploadsTable=e.uploadsTable,this.uploadsGrid=e.uploadsGrid,this.pagination=e.pagination,this.showToast=e.showToast,this.confirmModal=document.getElementById("confirmUploadModal"),this.confirmTitle=document.getElementById("confirmUploadModalTitle"),this.confirmMessage=document.getElementById("confirmUploadModalMessage"),this.confirmButton=document.querySelector('#confirmUploadModal [data-action="confirm-modal"]'),this.cancelButton=document.querySelector('#confirmUploadModal [data-action="cancel-modal"]'),this.selectAllUploadsCheckbox=document.getElementById("selectAllUploads"),this.selectedUploadsCount=document.getElementById("selectedUploadsCount"),this.bulkDeleteUploadsBtn=document.getElementById("bulkDeleteUploadsBtn"),this.currentPage=1,this.itemsPerPage=20,this.uploads=[],this.totalUploads=0,this.viewMode="grid",this.pendingAction=null,this.selectedUploadUuids=new Set,this.modal=new f({baseUrl:this.baseUrl,showToast:this.showToast,onSave:()=>this.loadUploads()}),this.lightbox=new w,this.uploadModal=new _({baseUrl:this.baseUrl,showToast:this.showToast,onComplete:()=>this.loadUploads()}),this.init()}init(){this.initConfirmModal(),this.bindEvents(),this.loadUploads()}initConfirmModal(){!this.confirmModal||!this.confirmButton||!this.cancelButton||(this.confirmModal.addEventListener("click",e=>{const t=e.target.closest('[data-action="close-modal"]'),s=e.target.closest('[data-action="cancel-modal"]');(t||s)&&this.closeConfirmModal()}),this.confirmButton.addEventListener("click",()=>{typeof this.pendingAction=="function"&&this.pendingAction(),this.closeConfirmModal()}))}bindEvents(){const e=document.getElementById("uploadBtn");e&&e.addEventListener("click",()=>{this.uploadModal.open()});const t=document.getElementById("viewToggle");t&&t.addEventListener("change",l=>{this.viewMode=l.target.value,this.renderView()}),this.uploadsTable.addEventListener("click",l=>{const i=l.target.closest('[data-action="delete"]');if(i){const n=i.dataset.uuid;this.confirmDelete(n)}const o=l.target.closest('[data-action="edit"]');if(o){const n=o.dataset.uuid,c=this.uploads.find(u=>u.uuid===n);c&&this.modal.open(c)}}),this.uploadsTable.addEventListener("change",l=>{const i=l.target.closest(".upload-select__checkbox");if(!i)return;const o=i.dataset.uuid,n=i.closest(".uploads-table__row");n&&n.classList.toggle("uploads-table__row--selected",i.checked),this.toggleUploadSelection(o,i.checked)});const s=document.getElementById("searchInput");if(s){let l;s.addEventListener("input",i=>{clearTimeout(l),l=setTimeout(()=>{this.currentPage=1,this.loadUploads(i.target.value)},300)})}const a=document.getElementById("filterStorage");a&&a.addEventListener("change",()=>{this.currentPage=1,this.loadUploads()}),this.selectAllUploadsCheckbox&&this.selectAllUploadsCheckbox.addEventListener("change",()=>this.handleSelectAllUploads()),this.bulkDeleteUploadsBtn&&this.bulkDeleteUploadsBtn.addEventListener("click",()=>this.confirmBulkDelete())}async loadUploads(e=""){try{const t=(this.currentPage-1)*this.itemsPerPage,s=new URLSearchParams({limit:this.itemsPerPage,offset:t}),a=document.getElementById("filterStorage");a&&a.value&&a.value!=="all"&&s.append("storage_type",a.value);const l=document.getElementById("searchInput"),i=e||(l?l.value:"");i&&s.append("search",i);const o=await fetch(`${this.baseUrl}/api/v1/admin/uploads?${s}`,{method:"GET",headers:p(),credentials:"include"});if(!o.ok)throw new Error("Failed to load uploads");const n=await o.json();if(n.status==="success")this.uploads=n.uploads||[],this.totalUploads=n.total||0,this.selectedUploadUuids.clear(),this.renderView(),this.renderPagination();else throw new Error(n.message||"Failed to load uploads")}catch(t){console.error("Error loading uploads:",t),this.showToast("Failed to load uploads","error"),this.renderEmptyState()}}renderView(){if(this.uploads.length===0){this.renderEmptyState();return}this.viewMode==="grid"?this.renderGrid():this.renderTable()}renderGrid(){this.uploadsTable.parentElement&&(this.uploadsTable.parentElement.parentElement.style.display="none"),this.uploadsGrid&&(this.uploadsGrid.style.display="grid",this.uploadsGrid.innerHTML="",this.uploads.forEach(e=>{const t=new b(e,this.baseUrl,s=>this.modal.open(s),s=>this.confirmDelete(s),(s,a)=>this.handlePreviewClick(s,a),(s,a)=>this.toggleUploadSelection(s,a),this.selectedUploadUuids.has(e.uuid));this.uploadsGrid.appendChild(t.render())})),this.updateBulkSelectionUI()}handlePreviewClick(e,t){if(e.mime_type.startsWith("image/")){const s=e.title||e.original_name;this.lightbox.open(t,s)}else window.open(t,"_blank")}renderTable(){this.uploadsGrid&&(this.uploadsGrid.style.display="none"),this.uploadsTable.parentElement&&(this.uploadsTable.parentElement.parentElement.style.display="block");const e=this.uploads.map(t=>this.createRow(t)).join("");this.uploadsTable.innerHTML=e,this.updateBulkSelectionUI(),this.uploadsTable.querySelectorAll(".thumbnail-link").forEach(t=>{t.addEventListener("click",s=>{s.preventDefault();const a=s.currentTarget.dataset.uuid,l=this.uploads.find(i=>i.uuid===a);if(l){const o=l.storage_type==="public"?`${this.baseUrl}/api/v1/upload/download/public/${l.uuid}`:`${this.baseUrl}/api/v1/upload/private/${l.uuid}`;this.handlePreviewClick(l,o)}})})}createRow(e){const t=e.storage_type==="public",s=t?`${this.baseUrl}/api/v1/upload/download/public/${e.uuid}`:`${this.baseUrl}/api/v1/upload/private/${e.uuid}`,a=this.formatBytes(e.size_bytes),l=new Date(e.created_at).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}),i=e.upload_status==="completed"?"status--success":"status--pending",o=e.mime_type.startsWith("image/"),n=o?`${s}?variant=thumb`:s,c=o?`<img src="${n}" alt="${e.original_name}" class="table-thumbnail" data-full-url="${s}" />`:`<div class="table-thumbnail table-thumbnail--icon">
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
             <polyline points="14 2 14 8 20 8"></polyline>
           </svg>
         </div>`;return`
      <tr class="${this.selectedUploadUuids.has(e.uuid)?"uploads-table__row uploads-table__row--selected":"uploads-table__row"}">
        <td class="uploads-table__cell uploads-table__cell--select" data-label="Select">
          <label class="upload-select">
            <input type="checkbox" class="upload-select__checkbox" data-uuid="${e.uuid}" ${this.selectedUploadUuids.has(e.uuid)?"checked":""}>
            <span class="upload-select__checkmark" aria-hidden="true"></span>
          </label>
        </td>
        <td class="uploads-table__cell uploads-table__cell--thumbnail" data-label="Preview">
          <a href="${s}" data-uuid="${e.uuid}" class="thumbnail-link">${c}</a>
        </td>
        <td class="uploads-table__cell uploads-table__cell--uuid" data-label="UUID" title="${e.uuid}">
          ${e.uuid.substring(0,8)}...
        </td>
        <td class="uploads-table__cell uploads-table__cell--name" data-label="Name" title="${e.original_name}">
          ${this.truncate(e.original_name,30)}
        </td>
        <td class="uploads-table__cell uploads-table__cell--type" data-label="Storage">
          <span class="badge badge--${t?"public":"private"}">
            ${e.storage_type}
          </span>
        </td>
        <td class="uploads-table__cell uploads-table__cell--mime" data-label="Type">
          ${e.mime_type}
        </td>
        <td class="uploads-table__cell uploads-table__cell--size" data-label="Size">
          ${a}
        </td>
        <td class="uploads-table__cell uploads-table__cell--status" data-label="Status">
          <span class="status ${i}">${e.upload_status}</span>
        </td>
        <td class="uploads-table__cell uploads-table__cell--user" data-label="User ID">
          ${e.user_id||"N/A"}
        </td>
        <td class="uploads-table__cell uploads-table__cell--date" data-label="Date">
          ${l}
        </td>
        <td class="uploads-table__cell uploads-table__cell--actions" data-label="Actions">
          <button class="btn btn--icon btn--edit" data-action="edit" data-uuid="${e.uuid}" title="Edit Info">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn btn--icon btn--delete" data-action="delete" data-uuid="${e.uuid}" title="Delete">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </td>
      </tr>
    `}renderEmptyState(){this.uploadsGrid&&(this.uploadsGrid.innerHTML=""),this.uploadsTable.innerHTML=`
      <tr>
        <td colspan="11" class="uploads-table__empty">
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <p>No uploads found</p>
          </div>
        </td>
      </tr>
    `,this.updateBulkSelectionUI()}renderPagination(){if(!this.pagination)return;const e=Math.ceil(this.totalUploads/this.itemsPerPage);if(e<=1){this.pagination.innerHTML="";return}const{startPage:t,endPage:s}=this.calculatePageWindow(this.currentPage,e);let a='<nav class="pagination" aria-label="Pagination">';a+=`
      <button class="pagination__btn pagination__btn--first" ${this.currentPage===1?"disabled":""} data-page="1" aria-label="Go to first page">
        First
      </button>
    `,a+=`
      <button class="pagination__btn pagination__btn--prev" ${this.currentPage===1?"disabled":""} data-page="${this.currentPage-1}" aria-label="Go to previous page">
        Prev
      </button>
    `,a+='<div class="pagination__pages">';for(let o=t;o<=s;o++){const n=o===this.currentPage;a+=`
        <button class="pagination__btn ${n?"pagination__btn--active":""}" data-page="${o}" ${n?'aria-current="page" disabled':""}>
          ${o}
        </button>
      `}a+="</div>",a+=`
      <button class="pagination__btn pagination__btn--next" ${this.currentPage===e?"disabled":""} data-page="${this.currentPage+1}" aria-label="Go to next page">
        Next
      </button>
    `,a+=`
      <button class="pagination__btn pagination__btn--last" ${this.currentPage===e?"disabled":""} data-page="${e}" aria-label="Go to last page">
        Last
      </button>
    `,a+=`
      <div class="pagination__goto">
        <input type="number" class="pagination__input" min="1" max="${e}" placeholder="Page" aria-label="Go to page number">
        <button class="pagination__btn" data-action="goto" aria-label="Go to entered page">Go</button>
      </div>
    `,a+="</nav>",this.pagination.innerHTML=a,this.pagination.querySelectorAll("[data-page]").forEach(o=>{o.addEventListener("click",()=>{const n=parseInt(o.dataset.page,10);n>=1&&n<=e&&(this.currentPage=n,this.loadUploads())})});const l=this.pagination.querySelector('[data-action="goto"]'),i=this.pagination.querySelector(".pagination__input");l&&i&&(l.addEventListener("click",()=>{const o=parseInt(i.value,10);o>=1&&o<=e&&(this.currentPage=o,this.loadUploads())}),i.addEventListener("keydown",o=>{if(o.key==="Enter"){const n=parseInt(i.value,10);n>=1&&n<=e&&(this.currentPage=n,this.loadUploads())}}))}calculatePageWindow(e,t){let l,i;return t<=7?(l=1,i=t):e<=4?(l=1,i=7):e>=t-3?(l=t-7+1,i=t):(l=e-3,i=e+3),{startPage:l,endPage:i}}confirmDelete(e){this.openConfirmModal({title:"Delete Upload",message:"Are you sure you want to delete this upload? This action cannot be undone.",confirmLabel:"Delete",onConfirm:()=>this.deleteUpload(e)})}confirmBulkDelete(){const e=Array.from(this.selectedUploadUuids);if(e.length===0)return;const t=e.length===1?"Delete this upload? This action cannot be undone.":`Delete ${e.length} uploads? This action cannot be undone.`;this.openConfirmModal({title:"Delete Uploads",message:t,confirmLabel:"Delete",onConfirm:()=>this.bulkDeleteUploads(e)})}async deleteUpload(e){try{const t=await fetch(`${this.baseUrl}/api/v1/upload/${e}`,{method:"DELETE",headers:p(),credentials:"include"});if(!t.ok)throw new Error("Failed to delete upload");const s=await t.json();if(s.status==="success")this.showToast("Upload deleted successfully","success"),this.uploads.length===1&&this.currentPage>1&&this.currentPage--,await this.loadUploads();else throw new Error(s.message||"Failed to delete upload")}catch(t){console.error("Error deleting upload:",t),this.showToast("Failed to delete upload","error")}}async bulkDeleteUploads(e){try{const t=await fetch(`${this.baseUrl}/api/v1/admin/uploads/bulk-delete`,{method:"POST",headers:p(),credentials:"include",body:JSON.stringify({upload_uuids:e})});if(!t.ok)throw new Error("Failed to delete uploads");const s=await t.json();if(s.status==="success")this.showToast("Uploads deleted successfully","success"),this.uploads.length<=e.length&&this.currentPage>1&&this.currentPage--,await this.loadUploads();else throw new Error(s.message||"Failed to delete uploads")}catch(t){console.error("Error deleting uploads:",t),this.showToast("Failed to delete uploads","error")}}toggleUploadSelection(e,t){e&&(t?this.selectedUploadUuids.add(e):this.selectedUploadUuids.delete(e),this.updateBulkSelectionUI())}handleSelectAllUploads(){const e=this.selectAllUploadsCheckbox?.checked,t=this.uploads.map(s=>s.uuid);this.selectedUploadUuids=new Set(e?t:[]),document.querySelectorAll(".upload-select__checkbox, .asset-card__checkbox").forEach(s=>{s.checked=e;const a=s.closest(".asset-card");a&&a.classList.toggle("asset-card--selected",e)}),this.updateBulkSelectionUI()}updateBulkSelectionUI(){const e=this.selectedUploadUuids.size,t=this.uploads.length;this.selectedUploadsCount&&(this.selectedUploadsCount.textContent=`${e} selected`),this.selectAllUploadsCheckbox&&(this.selectAllUploadsCheckbox.disabled=t===0,this.selectAllUploadsCheckbox.checked=e>0&&e===t,this.selectAllUploadsCheckbox.indeterminate=e>0&&e<t),this.bulkDeleteUploadsBtn&&(this.bulkDeleteUploadsBtn.disabled=e===0,this.bulkDeleteUploadsBtn.classList.toggle("btn--hidden",e===0))}openConfirmModal(e){!this.confirmModal||!this.confirmTitle||!this.confirmMessage||!this.confirmButton||(this.confirmTitle.textContent=e.title||"Confirm action",this.confirmMessage.textContent=e.message||"Are you sure?",this.confirmButton.textContent=e.confirmLabel||"Confirm",this.pendingAction=e.onConfirm||null,this.confirmModal.classList.add("confirm-modal--visible"),this.confirmModal.setAttribute("aria-hidden","false"))}closeConfirmModal(){this.confirmModal&&(this.confirmModal.classList.remove("confirm-modal--visible"),this.confirmModal.setAttribute("aria-hidden","true"),this.pendingAction=null)}formatBytes(e){if(e===0)return"0 B";const t=1024,s=["B","KB","MB","GB"],a=Math.floor(Math.log(e)/Math.log(t));return parseFloat((e/Math.pow(t,a)).toFixed(1))+" "+s[a]}truncate(e,t){return e?e.length>t?e.substring(0,t)+"...":e:""}}function m(){const d=document.getElementById("uploadsTable"),e=document.getElementById("uploadsGrid"),t=document.getElementById("pagination");if(!d||!e){console.error("UploadsPage: Required DOM elements not found");return}const s=window.BASE_URL||"",a=E(),l=new y({baseUrl:s,uploadsTable:d,uploadsGrid:e,pagination:t,showToast:a});typeof window<"u"&&(window.uploadsController=l)}function E(){const d={success:"linear-gradient(to right, #00b09b, #96c93d)",error:"linear-gradient(to right, #ff5f6d, #ffc371)",info:"linear-gradient(to right, #667eea, #764ba2)"};return function(t,s="success"){typeof Toastify<"u"?Toastify({text:t,duration:4e3,gravity:"top",position:"right",style:{background:d[s]||d.info}}).showToast():console.log(`[${s.toUpperCase()}] ${t}`)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",m):m()})();
