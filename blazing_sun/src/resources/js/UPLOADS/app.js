(function(){"use strict";var i=document.createElement("style");i.textContent=`.uploads-page{max-width:1400px;margin:0 auto;padding:2rem 1rem}.uploads-page__header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem}.uploads-page__title{font-size:1.5rem;font-weight:600;color:var(--color-text-primary);margin:0}.uploads-page__controls{display:flex;gap:1rem;align-items:center;flex-wrap:wrap}.search-input{position:relative}.search-input__icon{position:absolute;left:.75rem;top:50%;transform:translateY(-50%);color:var(--color-text-muted);pointer-events:none}.search-input__field{padding:.5rem .75rem .5rem 2.25rem;border:1px solid var(--color-border);border-radius:6px;background:var(--color-bg-primary);color:var(--color-text-primary);font-size:.875rem;min-width:250px;transition:border-color .15s ease,box-shadow .15s ease}.search-input__field:focus{outline:none;border-color:var(--color-primary);box-shadow:0 0 0 3px #0d6efd26}.search-input__field::placeholder{color:var(--color-text-muted)}.filter-select{padding:.5rem 2rem .5rem .75rem;border:1px solid var(--color-border);border-radius:6px;background:var(--color-bg-primary);color:var(--color-text-primary);font-size:.875rem;cursor:pointer;-webkit-appearance:none;-moz-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236c757d' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right .75rem center}.filter-select:focus{outline:none;border-color:var(--color-primary)}.table-container{background:var(--color-bg-primary);border:1px solid var(--color-border);border-radius:8px;overflow:hidden;box-shadow:0 1px 3px #0000001a,0 1px 2px #0000000f}.uploads-table{width:100%;border-collapse:collapse;font-size:.875rem}.uploads-table__head{background:var(--color-bg-secondary)}.uploads-table__header{padding:.75rem 1rem;text-align:left;font-weight:600;color:var(--color-text-primary);border-bottom:1px solid var(--color-border);white-space:nowrap}.uploads-table__header--center{text-align:center}.uploads-table__row{transition:background-color .15s ease}.uploads-table__row:hover{background:var(--color-bg-secondary)}.uploads-table__row:not(:last-child){border-bottom:1px solid var(--color-border)}.uploads-table__cell{padding:.75rem 1rem;color:var(--color-text-secondary);vertical-align:middle}.uploads-table__cell--uuid{font-family:monospace;font-size:.8rem;color:var(--color-text-muted)}.uploads-table__cell--name{color:var(--color-text-primary);font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.uploads-table__cell--actions{text-align:center;white-space:nowrap}.uploads-table__empty{padding:3rem 1rem;text-align:center}.badge{display:inline-block;padding:.25rem .5rem;font-size:.75rem;font-weight:500;border-radius:4px;text-transform:uppercase}.badge--public{background:#19875426;color:var(--color-success)}.badge--private{background:#dc354526;color:var(--color-danger)}.status{display:inline-block;padding:.25rem .5rem;font-size:.75rem;font-weight:500;border-radius:4px}.status--success{background:#19875426;color:var(--color-success)}.status--pending{background:#ffc10726;color:var(--color-warning)}.btn{display:inline-flex;align-items:center;justify-content:center;padding:.5rem 1rem;font-size:.875rem;font-weight:500;border:none;border-radius:6px;cursor:pointer;transition:all .15s ease}.btn--icon{padding:.375rem;background:transparent;border:1px solid var(--color-border);color:var(--color-text-secondary)}.btn--icon:hover{background:var(--color-bg-secondary);color:var(--color-text-primary)}.btn--view:hover{border-color:var(--color-primary);color:var(--color-primary)}.btn--delete:hover{border-color:var(--color-danger);color:var(--color-danger)}.empty-state{display:flex;flex-direction:column;align-items:center;gap:1rem;color:var(--color-text-muted)}.empty-state svg{opacity:.5}.empty-state p{margin:0}.pagination{display:flex;justify-content:center;align-items:center;gap:.5rem;padding:1.5rem}.pagination__btn{padding:.5rem .75rem;font-size:.875rem;border:1px solid var(--color-border);border-radius:6px;background:var(--color-bg-primary);color:var(--color-text-secondary);cursor:pointer;transition:all .15s ease}.pagination__btn:hover:not(:disabled){background:var(--color-bg-secondary);border-color:var(--color-primary);color:var(--color-primary)}.pagination__btn:disabled{opacity:.5;cursor:not-allowed}.pagination__btn--active{background:var(--color-primary);border-color:var(--color-primary);color:#fff}.pagination__btn--active:hover:not(:disabled){background:var(--color-primary-hover);color:#fff}@media (max-width: 768px){.uploads-page{padding:1rem}.uploads-page__header{flex-direction:column;align-items:flex-start}.uploads-page__controls{width:100%}.search-input__field{width:100%;min-width:auto}.table-container{overflow-x:auto}.uploads-table{min-width:800px}}.admin-content{min-height:calc(100vh - 60px);background:var(--color-bg-secondary)}.stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:1.5rem}.stat-card{background:var(--color-bg-primary);border:1px solid var(--color-border);border-radius:8px;padding:1.25rem;box-shadow:0 1px 3px #0000001a,0 1px 2px #0000000f}.stat-card__label{font-size:.75rem;font-weight:500;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem}.stat-card__value{font-size:1.5rem;font-weight:600;color:var(--color-text-primary)}
/*$vite$:1*/`,document.head.appendChild(i);class p{constructor(e){this.baseUrl=e.baseUrl,this.uploadsTable=e.uploadsTable,this.pagination=e.pagination,this.showToast=e.showToast,this.currentPage=1,this.itemsPerPage=20,this.uploads=[],this.totalUploads=0,this.init()}init(){this.bindEvents(),this.loadUploads()}bindEvents(){this.uploadsTable.addEventListener("click",a=>{const o=a.target.closest('[data-action="delete"]');if(o){const s=o.dataset.uuid;this.confirmDelete(s)}const r=a.target.closest('[data-action="view"]');if(r){const s=r.dataset.url;window.open(s,"_blank")}});const e=document.getElementById("searchInput");if(e){let a;e.addEventListener("input",o=>{clearTimeout(a),a=setTimeout(()=>{this.currentPage=1,this.loadUploads(o.target.value)},300)})}const t=document.getElementById("filterStorage");t&&t.addEventListener("change",()=>{this.currentPage=1,this.loadUploads()})}async loadUploads(e=""){try{const t=(this.currentPage-1)*this.itemsPerPage,a=new URLSearchParams({limit:this.itemsPerPage,offset:t}),o=document.getElementById("filterStorage");o&&o.value&&o.value!=="all"&&a.append("storage_type",o.value);const r=document.getElementById("searchInput"),s=e||(r?r.value:"");s&&a.append("search",s);const c=await fetch(`${this.baseUrl}/api/v1/admin/uploads?${a}`,{method:"GET",headers:{"Content-Type":"application/json"},credentials:"include"});if(!c.ok)throw new Error("Failed to load uploads");const l=await c.json();if(l.status==="success")this.uploads=l.uploads||[],this.totalUploads=l.total||0,this.renderTable(),this.renderPagination();else throw new Error(l.message||"Failed to load uploads")}catch(t){console.error("Error loading uploads:",t),this.showToast("Failed to load uploads","error"),this.renderEmptyState()}}renderTable(){if(this.uploads.length===0){this.renderEmptyState();return}const e=this.uploads.map(t=>this.createRow(t)).join("");this.uploadsTable.innerHTML=e}createRow(e){const t=e.storage_type==="public",a=t?`${this.baseUrl}/api/v1/upload/download/public/${e.uuid}`:`${this.baseUrl}/api/v1/upload/private/${e.uuid}`,o=this.formatBytes(e.size_bytes),r=new Date(e.created_at).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}),s=e.upload_status==="completed"?"status--success":"status--pending";return`
      <tr class="uploads-table__row">
        <td class="uploads-table__cell uploads-table__cell--uuid" title="${e.uuid}">
          ${e.uuid.substring(0,8)}...
        </td>
        <td class="uploads-table__cell uploads-table__cell--name" title="${e.original_name}">
          ${this.truncate(e.original_name,30)}
        </td>
        <td class="uploads-table__cell uploads-table__cell--type">
          <span class="badge badge--${t?"public":"private"}">
            ${e.storage_type}
          </span>
        </td>
        <td class="uploads-table__cell uploads-table__cell--mime">
          ${e.mime_type}
        </td>
        <td class="uploads-table__cell uploads-table__cell--size">
          ${o}
        </td>
        <td class="uploads-table__cell uploads-table__cell--status">
          <span class="status ${s}">${e.upload_status}</span>
        </td>
        <td class="uploads-table__cell uploads-table__cell--user">
          ${e.user_id||"N/A"}
        </td>
        <td class="uploads-table__cell uploads-table__cell--date">
          ${r}
        </td>
        <td class="uploads-table__cell uploads-table__cell--actions">
          <button class="btn btn--icon btn--view" data-action="view" data-url="${a}" title="View/Download">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
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
    `}renderEmptyState(){this.uploadsTable.innerHTML=`
      <tr>
        <td colspan="9" class="uploads-table__empty">
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
    `}renderPagination(){if(!this.pagination)return;const e=Math.ceil(this.totalUploads/this.itemsPerPage);if(e<=1){this.pagination.innerHTML="";return}let t='<div class="pagination">';t+=`
      <button class="pagination__btn" ${this.currentPage===1?"disabled":""} data-page="${this.currentPage-1}">
        &laquo; Prev
      </button>
    `;const a=Math.max(1,this.currentPage-2),o=Math.min(e,this.currentPage+2);for(let r=a;r<=o;r++)t+=`
        <button class="pagination__btn ${r===this.currentPage?"pagination__btn--active":""}" data-page="${r}">
          ${r}
        </button>
      `;t+=`
      <button class="pagination__btn" ${this.currentPage===e?"disabled":""} data-page="${this.currentPage+1}">
        Next &raquo;
      </button>
    `,t+="</div>",this.pagination.innerHTML=t,this.pagination.querySelectorAll("[data-page]").forEach(r=>{r.addEventListener("click",()=>{const s=parseInt(r.dataset.page,10);s>=1&&s<=e&&(this.currentPage=s,this.loadUploads())})})}confirmDelete(e){confirm("Are you sure you want to delete this upload? This action cannot be undone.")&&this.deleteUpload(e)}async deleteUpload(e){try{const t=await fetch(`${this.baseUrl}/api/v1/upload/${e}`,{method:"DELETE",headers:{"Content-Type":"application/json"},credentials:"include"});if(!t.ok)throw new Error("Failed to delete upload");const a=await t.json();if(a.status==="success")this.showToast("Upload deleted successfully","success"),this.loadUploads();else throw new Error(a.message||"Failed to delete upload")}catch(t){console.error("Error deleting upload:",t),this.showToast("Failed to delete upload","error")}}formatBytes(e){if(e===0)return"0 B";const t=1024,a=["B","KB","MB","GB"],o=Math.floor(Math.log(e)/Math.log(t));return parseFloat((e/Math.pow(t,o)).toFixed(1))+" "+a[o]}truncate(e,t){return e?e.length>t?e.substring(0,t)+"...":e:""}}function d(){const n=document.getElementById("uploadsTable"),e=document.getElementById("pagination");if(!n){console.error("UploadsPage: Required DOM elements not found");return}const t=window.BASE_URL||"",a=u(),o=new p({baseUrl:t,uploadsTable:n,pagination:e,showToast:a});typeof window<"u"&&(window.uploadsController=o)}function u(){const n={success:"linear-gradient(to right, #00b09b, #96c93d)",error:"linear-gradient(to right, #ff5f6d, #ffc371)",info:"linear-gradient(to right, #667eea, #764ba2)"};return function(t,a="success"){typeof Toastify<"u"?Toastify({text:t,duration:4e3,gravity:"top",position:"right",style:{background:n[a]||n.info}}).showToast():console.log(`[${a.toUpperCase()}] ${t}`)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",d):d()})();
