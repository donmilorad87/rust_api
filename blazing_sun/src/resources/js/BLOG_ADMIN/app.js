(function(){"use strict";function i(){const s=document.querySelector('meta[name="csrf-token"]');return s?s.getAttribute("content"):(console.warn('CSRF token not found. Ensure <meta name="csrf-token"> exists in page head.'),null)}function r(s={}){const t=i(),e={"Content-Type":"application/json",...s};return t&&(e["X-CSRF-TOKEN"]=t),e}class a{constructor(t){this.baseUrl=t.baseUrl,this.showToast=t.showToast,this.statsGrid=document.getElementById("statsGrid"),this.recentPostsList=document.getElementById("recentPostsList"),this.stats=null,this.recentPosts=[],this.init()}init(){this.loadDashboardData()}async loadDashboardData(){try{await Promise.all([this.loadStats(),this.loadRecentPosts()])}catch(t){console.error("Error loading dashboard data:",t)}}async loadStats(){if(this.statsGrid){this.statsGrid.innerHTML=this.renderLoadingState();try{const t=await fetch(`${this.baseUrl}/api/v1/admin/blog/stats`,{method:"GET",headers:r(),credentials:"include"});if(!t.ok)throw new Error("Failed to load stats");const e=await t.json();if(e.status==="success")this.stats=e.stats,this.renderStats();else throw new Error(e.message||"Failed to load stats")}catch(t){console.error("Error loading stats:",t),this.statsGrid.innerHTML=this.renderErrorState("Failed to load statistics")}}}renderStats(){if(!this.statsGrid||!this.stats)return;const t=[{icon:"posts",value:this.stats.total_posts||0,label:"Total Posts",trend:this.stats.posts_trend},{icon:"drafts",value:this.stats.draft_posts||0,label:"Drafts",trend:null},{icon:"categories",value:this.stats.total_categories||0,label:"Categories",trend:null},{icon:"tags",value:this.stats.total_tags||0,label:"Tags",trend:null},{icon:"taxonomies",value:this.stats.total_taxonomies||0,label:"Taxonomies",trend:null},{icon:"views",value:this.formatNumber(this.stats.total_views||0),label:"Total Views",trend:this.stats.views_trend}];this.statsGrid.innerHTML=t.map(e=>this.renderStatCard(e)).join("")}renderStatCard(t){const e=t.trend?`<div class="stat-card__trend stat-card__trend--${t.trend.direction}">
           ${this.getTrendIcon(t.trend.direction)}
           ${t.trend.value}%
         </div>`:"";return`
      <div class="stat-card">
        <div class="stat-card__icon stat-card__icon--${t.icon}">
          ${this.getStatIcon(t.icon)}
        </div>
        <div class="stat-card__value">${t.value}</div>
        <div class="stat-card__label">${t.label}</div>
        ${e}
      </div>
    `}getStatIcon(t){const e={posts:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',drafts:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',categories:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',tags:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',taxonomies:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',views:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'};return e[t]||e.posts}getTrendIcon(t){return t==="up"?'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>':'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>'}async loadRecentPosts(){if(this.recentPostsList){this.recentPostsList.innerHTML=this.renderLoadingState();try{const t=await fetch(`${this.baseUrl}/api/v1/admin/blog/posts?limit=5&sort=created_at&order=desc`,{method:"GET",headers:r(),credentials:"include"});if(!t.ok)throw new Error("Failed to load recent posts");const e=await t.json();if(e.status==="success")this.recentPosts=e.posts||[],this.renderRecentPosts();else throw new Error(e.message||"Failed to load recent posts")}catch(t){console.error("Error loading recent posts:",t),this.recentPostsList.innerHTML=this.renderEmptyState("No recent posts")}}}renderRecentPosts(){if(this.recentPostsList){if(this.recentPosts.length===0){this.recentPostsList.innerHTML=this.renderEmptyState("No posts yet. Create your first post!");return}this.recentPostsList.innerHTML=this.recentPosts.map(t=>`
      <li class="recent-posts__item">
        <div class="recent-posts__info">
          <div class="recent-posts__title">${this.escapeHtml(t.title)}</div>
          <div class="recent-posts__meta">
            ${this.formatDate(t.created_at)} by ${this.escapeHtml(t.author_name||"Unknown")}
          </div>
        </div>
        <span class="recent-posts__status recent-posts__status--${t.status}">
          ${t.status}
        </span>
      </li>
    `).join("")}}renderLoadingState(){return`
      <div class="loading-spinner">
        <div class="loading-spinner__icon"></div>
      </div>
    `}renderErrorState(t){return`
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <p>${this.escapeHtml(t)}</p>
      </div>
    `}renderEmptyState(t){return`
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <p>${this.escapeHtml(t)}</p>
      </div>
    `}formatNumber(t){return t>=1e6?(t/1e6).toFixed(1)+"M":t>=1e3?(t/1e3).toFixed(1)+"K":t.toString()}formatDate(t){return t?new Date(t).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"Unknown"}escapeHtml(t){if(!t)return"";const e=document.createElement("div");return e.textContent=t,e.innerHTML}}function o(){const s=window.BASE_URL||"",t=l(),e=new a({baseUrl:s,showToast:t});typeof window<"u"&&(window.blogAdminController=e)}function l(){const s={success:"linear-gradient(to right, #00b09b, #96c93d)",error:"linear-gradient(to right, #ff5f6d, #ffc371)",info:"linear-gradient(to right, #667eea, #764ba2)"};return function(e,n="success"){typeof Toastify<"u"?Toastify({text:e,duration:4e3,gravity:"top",position:"right",style:{background:s[n]||s.info}}).showToast():console.log(`[${n.toUpperCase()}] ${e}`)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",o):o()})();
