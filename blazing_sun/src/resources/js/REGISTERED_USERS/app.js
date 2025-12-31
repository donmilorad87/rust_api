(function(){"use strict";var l=document.createElement("style");l.textContent=`.users-page{max-width:1400px;margin:0 auto;padding:2rem 1rem}.users-page__header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem}.users-page__title{font-size:1.5rem;font-weight:600;color:var(--color-text-primary);margin:0}.users-page__controls{display:flex;gap:1rem;align-items:center;flex-wrap:wrap}.search-input{position:relative}.search-input__icon{position:absolute;left:.75rem;top:50%;transform:translateY(-50%);color:var(--color-text-muted);pointer-events:none}.search-input__field{padding:.5rem .75rem .5rem 2.25rem;border:1px solid var(--color-border);border-radius:6px;background:var(--color-bg-primary);color:var(--color-text-primary);font-size:.875rem;min-width:250px;transition:border-color .15s ease,box-shadow .15s ease}.search-input__field:focus{outline:none;border-color:var(--color-primary);box-shadow:0 0 0 3px #0d6efd26}.search-input__field::placeholder{color:var(--color-text-muted)}.table-container{background:var(--color-bg-primary);border:1px solid var(--color-border);border-radius:8px;overflow:hidden;box-shadow:0 1px 3px #0000001a,0 1px 2px #0000000f}.users-table{width:100%;border-collapse:collapse;font-size:.875rem}.users-table__head{background:var(--color-bg-secondary)}.users-table__header{padding:.75rem 1rem;text-align:left;font-weight:600;color:var(--color-text-primary);border-bottom:1px solid var(--color-border);white-space:nowrap}.users-table__header--center{text-align:center}.users-table__row{transition:background-color .15s ease}.users-table__row:hover{background:var(--color-bg-secondary)}.users-table__row:not(:last-child){border-bottom:1px solid var(--color-border)}.users-table__cell{padding:.75rem 1rem;color:var(--color-text-secondary);vertical-align:middle}.users-table__cell--id{font-family:monospace;font-size:.8rem;color:var(--color-text-muted)}.users-table__cell--email{color:var(--color-text-primary);font-weight:500}.users-table__cell--name{color:var(--color-text-primary)}.users-table__cell--actions{text-align:center;white-space:nowrap}.users-table__empty{padding:3rem 1rem;text-align:center}.permission-select{padding:.375rem 1.75rem .375rem .5rem;font-size:.8rem;border:1px solid var(--color-border);border-radius:4px;background:var(--color-bg-primary);color:var(--color-text-primary);cursor:pointer;-webkit-appearance:none;-moz-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236c757d' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right .5rem center}.permission-select:focus{outline:none;border-color:var(--color-primary)}.status{display:inline-block;padding:.25rem .5rem;font-size:.75rem;font-weight:500;border-radius:4px}.status--success{background:#19875426;color:var(--color-success)}.status--pending{background:#ffc10726;color:var(--color-warning)}.btn{display:inline-flex;align-items:center;justify-content:center;padding:.5rem 1rem;font-size:.875rem;font-weight:500;border:none;border-radius:6px;cursor:pointer;transition:all .15s ease}.btn--icon{padding:.375rem;background:transparent;border:1px solid var(--color-border);color:var(--color-text-secondary)}.btn--icon:hover{background:var(--color-bg-secondary);color:var(--color-text-primary)}.btn--delete:hover{border-color:var(--color-danger);color:var(--color-danger)}.empty-state{display:flex;flex-direction:column;align-items:center;gap:1rem;color:var(--color-text-muted)}.empty-state svg{opacity:.5}.empty-state p{margin:0}.pagination{display:flex;justify-content:center;align-items:center;gap:.5rem;padding:1.5rem}.pagination__btn{padding:.5rem .75rem;font-size:.875rem;border:1px solid var(--color-border);border-radius:6px;background:var(--color-bg-primary);color:var(--color-text-secondary);cursor:pointer;transition:all .15s ease}.pagination__btn:hover:not(:disabled){background:var(--color-bg-secondary);border-color:var(--color-primary);color:var(--color-primary)}.pagination__btn:disabled{opacity:.5;cursor:not-allowed}.pagination__btn--active{background:var(--color-primary);border-color:var(--color-primary);color:#fff}.pagination__btn--active:hover:not(:disabled){background:var(--color-primary-hover);color:#fff}@media (max-width: 768px){.users-page{padding:1rem}.users-page__header{flex-direction:column;align-items:flex-start}.users-page__controls{width:100%}.search-input__field{width:100%;min-width:auto}.table-container{overflow-x:auto}.users-table{min-width:800px}}.admin-content{min-height:calc(100vh - 60px);background:var(--color-bg-secondary)}.stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:1.5rem}.stat-card{background:var(--color-bg-primary);border:1px solid var(--color-border);border-radius:8px;padding:1.25rem;box-shadow:0 1px 3px #0000001a,0 1px 2px #0000000f}.stat-card__label{font-size:.75rem;font-weight:500;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem}.stat-card__value{font-size:1.5rem;font-weight:600;color:var(--color-text-primary)}
/*$vite$:1*/`,document.head.appendChild(l);class d{constructor(e){this.baseUrl=e.baseUrl,this.usersTable=e.usersTable,this.pagination=e.pagination,this.showToast=e.showToast,this.currentPage=1,this.itemsPerPage=20,this.users=[],this.totalUsers=0,this.permissionLevels=[{value:1,label:"Basic"},{value:10,label:"Admin"},{value:50,label:"Affiliate"},{value:100,label:"Super Admin"}],this.init()}init(){this.bindEvents(),this.loadUsers()}bindEvents(){this.usersTable.addEventListener("click",t=>{const r=t.target.closest('[data-action="delete-avatar"]');if(r){const s=r.dataset.userId;this.confirmDeleteAvatar(s)}}),this.usersTable.addEventListener("change",t=>{const r=t.target.closest('[data-action="change-permission"]');if(r){const s=r.dataset.userId,a=parseInt(r.value,10);this.updatePermission(s,a)}});const e=document.getElementById("searchInput");if(e){let t;e.addEventListener("input",r=>{clearTimeout(t),t=setTimeout(()=>{this.currentPage=1,this.loadUsers(r.target.value)},300)})}}async loadUsers(e=""){try{const t=(this.currentPage-1)*this.itemsPerPage,r=new URLSearchParams({limit:this.itemsPerPage,offset:t}),s=await fetch(`${this.baseUrl}/api/v1/admin/users?${r}`,{method:"GET",headers:{"Content-Type":"application/json"},credentials:"include"});if(!s.ok)throw new Error("Failed to load users");const a=await s.json();if(a.status==="success")this.users=a.users||[],this.totalUsers=a.total||0,this.renderTable(),this.renderPagination();else throw new Error(a.message||"Failed to load users")}catch(t){console.error("Error loading users:",t),this.showToast("Failed to load users","error"),this.renderEmptyState()}}renderTable(){if(this.users.length===0){this.renderEmptyState();return}const e=this.users.map(t=>this.createRow(t)).join("");this.usersTable.innerHTML=e}createRow(e){const t=new Date(e.created_at).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}),r=e.activated===1?"status--success":"status--pending",s=e.activated===1?"Active":"Inactive",a=this.permissionLevels.map(n=>`<option value="${n.value}" ${e.permissions===n.value?"selected":""}>${n.label}</option>`).join(""),i=e.avatar_uuid!==null;return`
      <tr class="users-table__row">
        <td class="users-table__cell users-table__cell--id">
          ${e.id}
        </td>
        <td class="users-table__cell users-table__cell--email">
          ${e.email}
        </td>
        <td class="users-table__cell users-table__cell--name">
          ${e.first_name} ${e.last_name}
        </td>
        <td class="users-table__cell users-table__cell--permission">
          <select class="permission-select" data-action="change-permission" data-user-id="${e.id}" aria-label="User permission level">
            ${a}
          </select>
        </td>
        <td class="users-table__cell users-table__cell--status">
          <span class="status ${r}">${s}</span>
        </td>
        <td class="users-table__cell users-table__cell--balance">
          ${this.formatBalance(e.balance)}
        </td>
        <td class="users-table__cell users-table__cell--date">
          ${t}
        </td>
        <td class="users-table__cell users-table__cell--actions">
          ${i?`
            <button class="btn btn--icon btn--delete" data-action="delete-avatar" data-user-id="${e.id}" title="Delete Avatar">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="15" y2="15"></line>
                <line x1="15" y1="9" x2="9" y2="15"></line>
              </svg>
            </button>
          `:`
            <span class="text-muted fs-xs">No avatar</span>
          `}
        </td>
      </tr>
    `}renderEmptyState(){this.usersTable.innerHTML=`
      <tr>
        <td colspan="8" class="users-table__empty">
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <p>No users found</p>
          </div>
        </td>
      </tr>
    `}renderPagination(){if(!this.pagination)return;const e=Math.ceil(this.totalUsers/this.itemsPerPage);if(e<=1){this.pagination.innerHTML="";return}let t='<div class="pagination">';t+=`
      <button class="pagination__btn" ${this.currentPage===1?"disabled":""} data-page="${this.currentPage-1}">
        &laquo; Prev
      </button>
    `;const r=Math.max(1,this.currentPage-2),s=Math.min(e,this.currentPage+2);for(let a=r;a<=s;a++)t+=`
        <button class="pagination__btn ${a===this.currentPage?"pagination__btn--active":""}" data-page="${a}">
          ${a}
        </button>
      `;t+=`
      <button class="pagination__btn" ${this.currentPage===e?"disabled":""} data-page="${this.currentPage+1}">
        Next &raquo;
      </button>
    `,t+="</div>",this.pagination.innerHTML=t,this.pagination.querySelectorAll("[data-page]").forEach(a=>{a.addEventListener("click",()=>{const i=parseInt(a.dataset.page,10);i>=1&&i<=e&&(this.currentPage=i,this.loadUsers())})})}confirmDeleteAvatar(e){confirm("Are you sure you want to delete this user's avatar?")&&this.deleteUserAvatar(e)}async deleteUserAvatar(e){try{const t=await fetch(`${this.baseUrl}/api/v1/admin/users/${e}/avatar`,{method:"DELETE",headers:{"Content-Type":"application/json"},credentials:"include"});if(!t.ok)throw new Error("Failed to delete avatar");const r=await t.json();if(r.status==="success")this.showToast("Avatar deleted successfully","success"),this.loadUsers();else throw new Error(r.message||"Failed to delete avatar")}catch(t){console.error("Error deleting avatar:",t),this.showToast("Failed to delete avatar","error")}}async updatePermission(e,t){try{const r=await fetch(`${this.baseUrl}/api/v1/admin/users/${e}/permissions`,{method:"PATCH",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({permissions:t})});if(!r.ok)throw new Error("Failed to update permission");const s=await r.json();if(s.status==="success")this.showToast("Permission updated successfully","success");else throw new Error(s.message||"Failed to update permission")}catch(r){console.error("Error updating permission:",r),this.showToast("Failed to update permission","error"),this.loadUsers()}}formatBalance(e){const t=e/100;return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(t)}}function c(){const o=document.getElementById("usersTable"),e=document.getElementById("pagination");if(!o){console.error("UsersPage: Required DOM elements not found");return}const t=window.BASE_URL||"",r=p(),s=new d({baseUrl:t,usersTable:o,pagination:e,showToast:r});typeof window<"u"&&(window.usersController=s)}function p(){const o={success:"linear-gradient(to right, #00b09b, #96c93d)",error:"linear-gradient(to right, #ff5f6d, #ffc371)",info:"linear-gradient(to right, #667eea, #764ba2)"};return function(t,r="success"){typeof Toastify<"u"?Toastify({text:t,duration:4e3,gravity:"top",position:"right",style:{background:o[r]||o.info}}).showToast():console.log(`[${r.toUpperCase()}] ${t}`)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",c):c()})();
