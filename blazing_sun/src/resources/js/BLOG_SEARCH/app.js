(function(){"use strict";class g{constructor(t){this.baseUrl=t.baseUrl||"",this.initialQuery=t.query||"",this.searchForm=t.searchForm,this.searchInput=t.searchInput,this.categorySelect=t.categorySelect,this.resultsContainer=t.resultsContainer,this.paginationContainer=t.paginationContainer,this.searchMetaContainer=t.searchMetaContainer,this.showToast=t.showToast||(()=>{}),this.query=this.initialQuery,this.category=t.category||"",this.results=[],this.currentPage=1,this.resultsPerPage=16,this.totalResults=0,this.totalPages=0,this.isLoading=!1,this.debounceTimeout=null,this.debounceDelay=300,this.minQueryLength=2,this.init()}async init(){this.bindFormEvents(),this.query&&await this.search(this.query,1)}bindFormEvents(){this.searchForm&&this.searchInput&&(this.searchForm.addEventListener("submit",t=>{t.preventDefault(),this.debounceTimeout&&(clearTimeout(this.debounceTimeout),this.debounceTimeout=null);const e=this.searchInput.value.trim();e&&(this.query=e,this.category=this.categorySelect?.value||"",this.search(e,1),this.updateUrl())}),this.searchInput.addEventListener("input",t=>{const e=t.target.value.trim();if(this.debounceTimeout&&clearTimeout(this.debounceTimeout),e.length<this.minQueryLength){e.length===0&&this.renderSearchPrompt();return}this.debounceTimeout=setTimeout(()=>{this.query=e,this.search(e,1),this.updateUrl()},this.debounceDelay)}),this.searchInput.addEventListener("paste",t=>{setTimeout(()=>{const e=this.searchInput.value.trim();e.length>=this.minQueryLength&&(this.debounceTimeout&&clearTimeout(this.debounceTimeout),this.query=e,this.search(e,1),this.updateUrl())},10)})),this.categorySelect&&this.categorySelect.addEventListener("change",t=>{this.category=t.target.value,this.query&&this.query.length>=this.minQueryLength&&(this.search(this.query,1),this.updateUrl())})}updateUrl(){const t=new URL(window.location);this.query?t.searchParams.set("q",this.query):t.searchParams.delete("q"),this.category?t.searchParams.set("category",this.category):t.searchParams.delete("category"),window.history.replaceState({},"",t)}renderSearchPrompt(){this.resultsContainer&&(this.resultsContainer.innerHTML=`
      <div class="search-prompt" style="grid-column: 1 / -1;">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <h3>Enter a search term</h3>
        <p>Type at least ${this.minQueryLength} characters to search posts.</p>
      </div>
    `,this.paginationContainer&&(this.paginationContainer.innerHTML=""),this.searchMetaContainer&&(this.searchMetaContainer.textContent=""))}async search(t,e=1){if(!(!t||t.trim().length===0)){this.query=t.trim(),this.currentPage=e,this.isLoading=!0,this.showLoading();try{const i=new URLSearchParams({q:this.query,page:e.toString(),per_page:this.resultsPerPage.toString()});this.category&&i.set("category",this.category);const s=await fetch(`${this.baseUrl}/api/v1/blog/search?${i}`);if(!s.ok){const n=await s.json().catch(()=>({}));if(s.status===503){this.renderSearchUnavailable();return}throw new Error(n.message||"Search failed")}const a=await s.json();this.results=a.results||[],this.totalResults=a.pagination?.total||0,this.totalPages=a.pagination?.total_pages||Math.ceil(this.totalResults/this.resultsPerPage),this.currentPage=a.pagination?.page||e,this.updateSearchMeta(),this.renderResults(),this.renderPagination()}catch(i){console.error("BlogSearchPage: Search error:",i),this.showToast("Search failed. Please try again.","error"),this.renderError(i.message)}finally{this.isLoading=!1}}}updateSearchMeta(){this.searchMetaContainer&&(this.totalResults>0?this.searchMetaContainer.textContent=`Found ${this.totalResults} ${this.totalResults===1?"result":"results"}`:this.searchMetaContainer.textContent="No results found")}showLoading(){this.resultsContainer&&(this.resultsContainer.innerHTML=`
      <div class="blog-loading" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
        <div class="blog-loading__spinner" style="
          width: 40px;
          height: 40px;
          border: 3px solid var(--border-color, #e5e7eb);
          border-top-color: var(--primary, #4f46e5);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 1rem;
        "></div>
        <p class="blog-loading__text">Searching...</p>
      </div>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `)}renderResults(){if(!this.resultsContainer)return;if(this.results.length===0){this.renderEmpty();return}const t=this.results.map(e=>this.renderResultItem(e)).join("");this.resultsContainer.innerHTML=t}renderResultItem(t){const e=t.highlights?.title?.[0]?t.highlights.title[0]:this.escapeHtml(t.title),i=t.highlights?.excerpt?.[0]?t.highlights.excerpt[0]:t.highlights?.content?.[0]?t.highlights.content[0]:this.escapeHtml(t.excerpt||""),s=t.categories?.[0],a=s?`<span class="post-card__category">${this.escapeHtml(s.name)}</span>`:"",n=this.formatDate(t.published_at),r=Math.min(100,Math.round(t.score*10)),h=t.tags?.slice(0,3).map(l=>`<span class="post-card__tag">${this.escapeHtml(l.name)}</span>`).join("")||"";return`
      <article class="post-card post-card--horizontal" aria-label="Search result">
        <a href="/blog/${this.escapeHtml(t.slug)}" class="post-card__link">
          <div class="post-card__image post-card__image--placeholder">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div class="post-card__content">
            ${a}
            <h3 class="post-card__title">${e}</h3>
            <p class="post-card__excerpt">${i}</p>
            <div class="post-card__meta">
              <time datetime="${t.published_at||""}">${n}</time>
              <span class="post-card__relevance" title="Relevance score">
                ${r}% match
              </span>
            </div>
            ${h?`<div class="post-card__tags">${h}</div>`:""}
          </div>
        </a>
      </article>
    `}renderEmpty(){this.resultsContainer&&(this.resultsContainer.innerHTML=`
      <div class="empty-state" style="grid-column: 1 / -1;">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
        <h3>No results found</h3>
        <p>We couldn't find any posts matching "<strong>${this.escapeHtml(this.query)}</strong>"</p>
        <div class="empty-state__suggestions">
          <p>Suggestions:</p>
          <ul>
            <li>Check your spelling</li>
            <li>Try more general terms</li>
            <li>Try different keywords</li>
          </ul>
        </div>
      </div>
    `,this.paginationContainer&&(this.paginationContainer.innerHTML=""))}renderSearchUnavailable(){this.resultsContainer&&(this.resultsContainer.innerHTML=`
      <div class="empty-state" style="grid-column: 1 / -1;">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h3>Search unavailable</h3>
        <p>Search is currently unavailable. Please try again later.</p>
      </div>
    `,this.paginationContainer&&(this.paginationContainer.innerHTML=""))}renderError(t){this.resultsContainer&&(this.resultsContainer.innerHTML=`
      <div class="empty-state" style="grid-column: 1 / -1;">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h3>Search failed</h3>
        <p>${t||"Something went wrong. Please try again."}</p>
      </div>
    `,this.paginationContainer&&(this.paginationContainer.innerHTML=""))}renderPagination(){if(!this.paginationContainer)return;if(this.totalPages<=1){this.paginationContainer.innerHTML="";return}const t=this.getPaginationRange();let e='<ul class="pagination__list">';this.currentPage>1&&(e+=`
        <li class="pagination__item">
          <button class="pagination__btn pagination__btn--prev" data-page="${this.currentPage-1}" aria-label="Previous page">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        </li>
      `),t.forEach(i=>{if(i==="...")e+='<li class="pagination__item"><span class="pagination__ellipsis">...</span></li>';else{const s=i===this.currentPage;e+=`
          <li class="pagination__item">
            <button
              class="pagination__btn ${s?"pagination__btn--active":""}"
              data-page="${i}"
              ${s?'aria-current="page"':""}
            >
              ${i}
            </button>
          </li>
        `}}),this.currentPage<this.totalPages&&(e+=`
        <li class="pagination__item">
          <button class="pagination__btn pagination__btn--next" data-page="${this.currentPage+1}" aria-label="Next page">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </li>
      `),e+="</ul>",this.paginationContainer.innerHTML=e,this.paginationContainer.querySelectorAll("[data-page]").forEach(i=>{i.addEventListener("click",()=>{const s=parseInt(i.dataset.page,10);s!==this.currentPage&&(this.search(this.query,s),window.scrollTo({top:0,behavior:"smooth"}))})})}getPaginationRange(){const t=this.totalPages,e=this.currentPage,i=2,s=[],a=[];for(let r=1;r<=t;r++)(r===1||r===t||r>=e-i&&r<=e+i)&&s.push(r);let n=null;for(const r of s)n&&(r-n===2?a.push(n+1):r-n!==1&&a.push("...")),a.push(r),n=r;return a}formatDate(t){return t?new Date(t).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}):""}escapeHtml(t){if(!t)return"";const e=document.createElement("div");return e.textContent=t,e.innerHTML}}function c(){const o=document.getElementById("searchForm"),t=document.getElementById("searchQuery"),e=document.getElementById("filterCategory"),i=document.getElementById("postsGrid"),s=document.getElementById("pagination"),a=document.querySelector(".blog-page__meta .blog-page__count"),n=window.BASE_URL||"",r=new URLSearchParams(window.location.search),h=r.get("q")||"",l=r.get("category")||"";l&&e&&(e.value=l);const d=u(),p=new g({baseUrl:n,query:h,category:l,searchForm:o,searchInput:t,categorySelect:e,resultsContainer:i,paginationContainer:s,searchMetaContainer:a,showToast:d});typeof window<"u"&&(window.blogSearchController=p)}function u(){const o={success:"linear-gradient(to right, #00b09b, #96c93d)",error:"linear-gradient(to right, #ff5f6d, #ffc371)",info:"linear-gradient(to right, #667eea, #764ba2)"};return function(e,i="success"){typeof Toastify<"u"?Toastify({text:e,duration:4e3,gravity:"top",position:"right",style:{background:o[i]||o.info}}).showToast():console.log(`[${i.toUpperCase()}] ${e}`)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",c):c()})();
