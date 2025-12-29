class c{constructor(t){this.baseUrl=t.baseUrl,this.uploadsTable=t.uploadsTable,this.pagination=t.pagination,this.showToast=t.showToast,this.currentPage=1,this.itemsPerPage=20,this.uploads=[],this.totalUploads=0,this.init()}init(){this.bindEvents(),this.loadUploads()}bindEvents(){this.uploadsTable.addEventListener("click",a=>{const s=a.target.closest('[data-action="delete"]');if(s){const n=s.dataset.uuid;this.confirmDelete(n)}const o=a.target.closest('[data-action="view"]');if(o){const n=o.dataset.url;window.open(n,"_blank")}});const t=document.getElementById("searchInput");if(t){let a;t.addEventListener("input",s=>{clearTimeout(a),a=setTimeout(()=>{this.currentPage=1,this.loadUploads(s.target.value)},300)})}const e=document.getElementById("filterStorage");e&&e.addEventListener("change",()=>{this.currentPage=1,this.loadUploads()})}async loadUploads(t=""){try{const e=(this.currentPage-1)*this.itemsPerPage,a=new URLSearchParams({limit:this.itemsPerPage,offset:e}),s=document.getElementById("filterStorage");s&&s.value&&s.value!=="all"&&a.append("storage_type",s.value);const o=document.getElementById("searchInput"),n=t||(o?o.value:"");n&&a.append("search",n);const r=await fetch(`${this.baseUrl}/api/v1/admin/uploads?${a}`,{method:"GET",headers:{"Content-Type":"application/json"},credentials:"include"});if(!r.ok)throw new Error("Failed to load uploads");const i=await r.json();if(i.status==="success")this.uploads=i.uploads||[],this.totalUploads=i.total||0,this.renderTable(),this.renderPagination();else throw new Error(i.message||"Failed to load uploads")}catch(e){console.error("Error loading uploads:",e),this.showToast("Failed to load uploads","error"),this.renderEmptyState()}}renderTable(){if(this.uploads.length===0){this.renderEmptyState();return}const t=this.uploads.map(e=>this.createRow(e)).join("");this.uploadsTable.innerHTML=t}createRow(t){const e=t.storage_type==="public",a=e?`${this.baseUrl}/api/v1/upload/download/public/${t.uuid}`:`${this.baseUrl}/api/v1/upload/private/${t.uuid}`,s=this.formatBytes(t.size_bytes),o=new Date(t.created_at).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}),n=t.upload_status==="completed"?"status--success":"status--pending";return`
      <tr class="uploads-table__row">
        <td class="uploads-table__cell uploads-table__cell--uuid" title="${t.uuid}">
          ${t.uuid.substring(0,8)}...
        </td>
        <td class="uploads-table__cell uploads-table__cell--name" title="${t.original_name}">
          ${this.truncate(t.original_name,30)}
        </td>
        <td class="uploads-table__cell uploads-table__cell--type">
          <span class="badge badge--${e?"public":"private"}">
            ${t.storage_type}
          </span>
        </td>
        <td class="uploads-table__cell uploads-table__cell--mime">
          ${t.mime_type}
        </td>
        <td class="uploads-table__cell uploads-table__cell--size">
          ${s}
        </td>
        <td class="uploads-table__cell uploads-table__cell--status">
          <span class="status ${n}">${t.upload_status}</span>
        </td>
        <td class="uploads-table__cell uploads-table__cell--user">
          ${t.user_id||"N/A"}
        </td>
        <td class="uploads-table__cell uploads-table__cell--date">
          ${o}
        </td>
        <td class="uploads-table__cell uploads-table__cell--actions">
          <button class="btn btn--icon btn--view" data-action="view" data-url="${a}" title="View/Download">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
          <button class="btn btn--icon btn--delete" data-action="delete" data-uuid="${t.uuid}" title="Delete">
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
    `}renderPagination(){if(!this.pagination)return;const t=Math.ceil(this.totalUploads/this.itemsPerPage);if(t<=1){this.pagination.innerHTML="";return}let e='<div class="pagination">';e+=`
      <button class="pagination__btn" ${this.currentPage===1?"disabled":""} data-page="${this.currentPage-1}">
        &laquo; Prev
      </button>
    `;const a=Math.max(1,this.currentPage-2),s=Math.min(t,this.currentPage+2);for(let o=a;o<=s;o++)e+=`
        <button class="pagination__btn ${o===this.currentPage?"pagination__btn--active":""}" data-page="${o}">
          ${o}
        </button>
      `;e+=`
      <button class="pagination__btn" ${this.currentPage===t?"disabled":""} data-page="${this.currentPage+1}">
        Next &raquo;
      </button>
    `,e+="</div>",this.pagination.innerHTML=e,this.pagination.querySelectorAll("[data-page]").forEach(o=>{o.addEventListener("click",()=>{const n=parseInt(o.dataset.page,10);n>=1&&n<=t&&(this.currentPage=n,this.loadUploads())})})}confirmDelete(t){confirm("Are you sure you want to delete this upload? This action cannot be undone.")&&this.deleteUpload(t)}async deleteUpload(t){try{const e=await fetch(`${this.baseUrl}/api/v1/upload/${t}`,{method:"DELETE",headers:{"Content-Type":"application/json"},credentials:"include"});if(!e.ok)throw new Error("Failed to delete upload");const a=await e.json();if(a.status==="success")this.showToast("Upload deleted successfully","success"),this.loadUploads();else throw new Error(a.message||"Failed to delete upload")}catch(e){console.error("Error deleting upload:",e),this.showToast("Failed to delete upload","error")}}formatBytes(t){if(t===0)return"0 B";const e=1024,a=["B","KB","MB","GB"],s=Math.floor(Math.log(t)/Math.log(e));return parseFloat((t/Math.pow(e,s)).toFixed(1))+" "+a[s]}truncate(t,e){return t?t.length>e?t.substring(0,e)+"...":t:""}}function d(){const l=document.getElementById("uploadsTable"),t=document.getElementById("pagination");if(!l){console.error("UploadsPage: Required DOM elements not found");return}const e=window.BASE_URL||"",a=u(),s=new c({baseUrl:e,uploadsTable:l,pagination:t,showToast:a});typeof window<"u"&&(window.uploadsController=s)}function u(){const l={success:"linear-gradient(to right, #00b09b, #96c93d)",error:"linear-gradient(to right, #ff5f6d, #ffc371)",info:"linear-gradient(to right, #667eea, #764ba2)"};return function(e,a="success"){typeof Toastify<"u"?Toastify({text:e,duration:4e3,gravity:"top",position:"right",style:{background:l[a]||l.info}}).showToast():console.log(`[${a.toUpperCase()}] ${e}`)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",d):d();
