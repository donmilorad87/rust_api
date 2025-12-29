class c{constructor(e){this.baseUrl=e.baseUrl,this.usersTable=e.usersTable,this.pagination=e.pagination,this.showToast=e.showToast,this.currentPage=1,this.itemsPerPage=20,this.users=[],this.totalUsers=0,this.permissionLevels=[{value:1,label:"Basic"},{value:10,label:"Admin"},{value:50,label:"Affiliate"},{value:100,label:"Super Admin"}],this.init()}init(){this.bindEvents(),this.loadUsers()}bindEvents(){this.usersTable.addEventListener("click",t=>{const s=t.target.closest('[data-action="delete-avatar"]');if(s){const r=s.dataset.userId;this.confirmDeleteAvatar(r)}}),this.usersTable.addEventListener("change",t=>{const s=t.target.closest('[data-action="change-permission"]');if(s){const r=s.dataset.userId,a=parseInt(s.value,10);this.updatePermission(r,a)}});const e=document.getElementById("searchInput");if(e){let t;e.addEventListener("input",s=>{clearTimeout(t),t=setTimeout(()=>{this.currentPage=1,this.loadUsers(s.target.value)},300)})}}async loadUsers(e=""){try{const t=(this.currentPage-1)*this.itemsPerPage,s=new URLSearchParams({limit:this.itemsPerPage,offset:t}),r=await fetch(`${this.baseUrl}/api/v1/admin/users?${s}`,{method:"GET",headers:{"Content-Type":"application/json"},credentials:"include"});if(!r.ok)throw new Error("Failed to load users");const a=await r.json();if(a.status==="success")this.users=a.users||[],this.totalUsers=a.total||0,this.renderTable(),this.renderPagination();else throw new Error(a.message||"Failed to load users")}catch(t){console.error("Error loading users:",t),this.showToast("Failed to load users","error"),this.renderEmptyState()}}renderTable(){if(this.users.length===0){this.renderEmptyState();return}const e=this.users.map(t=>this.createRow(t)).join("");this.usersTable.innerHTML=e}createRow(e){const t=new Date(e.created_at).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}),s=e.activated===1?"status--success":"status--pending",r=e.activated===1?"Active":"Inactive",a=this.permissionLevels.map(o=>`<option value="${o.value}" ${e.permissions===o.value?"selected":""}>${o.label}</option>`).join(""),n=e.avatar_uuid!==null;return`
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
          <span class="status ${s}">${r}</span>
        </td>
        <td class="users-table__cell users-table__cell--balance">
          ${this.formatBalance(e.balance)}
        </td>
        <td class="users-table__cell users-table__cell--date">
          ${t}
        </td>
        <td class="users-table__cell users-table__cell--actions">
          ${n?`
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
    `;const s=Math.max(1,this.currentPage-2),r=Math.min(e,this.currentPage+2);for(let a=s;a<=r;a++)t+=`
        <button class="pagination__btn ${a===this.currentPage?"pagination__btn--active":""}" data-page="${a}">
          ${a}
        </button>
      `;t+=`
      <button class="pagination__btn" ${this.currentPage===e?"disabled":""} data-page="${this.currentPage+1}">
        Next &raquo;
      </button>
    `,t+="</div>",this.pagination.innerHTML=t,this.pagination.querySelectorAll("[data-page]").forEach(a=>{a.addEventListener("click",()=>{const n=parseInt(a.dataset.page,10);n>=1&&n<=e&&(this.currentPage=n,this.loadUsers())})})}confirmDeleteAvatar(e){confirm("Are you sure you want to delete this user's avatar?")&&this.deleteUserAvatar(e)}async deleteUserAvatar(e){try{const t=await fetch(`${this.baseUrl}/api/v1/admin/users/${e}/avatar`,{method:"DELETE",headers:{"Content-Type":"application/json"},credentials:"include"});if(!t.ok)throw new Error("Failed to delete avatar");const s=await t.json();if(s.status==="success")this.showToast("Avatar deleted successfully","success"),this.loadUsers();else throw new Error(s.message||"Failed to delete avatar")}catch(t){console.error("Error deleting avatar:",t),this.showToast("Failed to delete avatar","error")}}async updatePermission(e,t){try{const s=await fetch(`${this.baseUrl}/api/v1/admin/users/${e}/permissions`,{method:"PATCH",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({permissions:t})});if(!s.ok)throw new Error("Failed to update permission");const r=await s.json();if(r.status==="success")this.showToast("Permission updated successfully","success");else throw new Error(r.message||"Failed to update permission")}catch(s){console.error("Error updating permission:",s),this.showToast("Failed to update permission","error"),this.loadUsers()}}formatBalance(e){const t=e/100;return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(t)}}function l(){const i=document.getElementById("usersTable"),e=document.getElementById("pagination");if(!i){console.error("UsersPage: Required DOM elements not found");return}const t=window.BASE_URL||"",s=d(),r=new c({baseUrl:t,usersTable:i,pagination:e,showToast:s});typeof window<"u"&&(window.usersController=r)}function d(){const i={success:"linear-gradient(to right, #00b09b, #96c93d)",error:"linear-gradient(to right, #ff5f6d, #ffc371)",info:"linear-gradient(to right, #667eea, #764ba2)"};return function(t,s="success"){typeof Toastify<"u"?Toastify({text:t,duration:4e3,gravity:"top",position:"right",style:{background:i[s]||i.info}}).showToast():console.log(`[${s.toUpperCase()}] ${t}`)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",l):l();
