(function(){"use strict";class g{constructor(t,e={}){if(!t){console.error("Pagination: Container element required");return}this.container=t,this.currentPage=e.currentPage||1,this.totalPages=e.totalPages||1,this.onPageChange=e.onPageChange||(()=>{}),this.render(),this.bindEvents()}calculatePageWindow(){let i,s;return this.totalPages<=7?(i=1,s=this.totalPages):this.currentPage<=4?(i=1,s=7):this.currentPage>=this.totalPages-3?(i=this.totalPages-7+1,s=this.totalPages):(i=this.currentPage-3,s=this.currentPage+3),{startPage:i,endPage:s}}render(){if(this.totalPages<=1){this.container.innerHTML="";return}const{startPage:t,endPage:e}=this.calculatePageWindow();let i="";for(let s=t;s<=e;s++){const a=s===this.currentPage;i+=`
        <button
          class="pagination__btn ${a?"pagination__btn--active":""}"
          data-page="${s}"
          ${a?'aria-current="page" disabled':""}
        >
          ${s}
        </button>
      `}this.container.innerHTML=`
      <nav class="pagination" aria-label="Pagination">
        <button
          class="pagination__btn pagination__btn--first"
          data-page="1"
          ${this.currentPage===1?"disabled":""}
          aria-label="Go to first page"
        >
          First
        </button>
        <button
          class="pagination__btn pagination__btn--prev"
          data-page="${this.currentPage-1}"
          ${this.currentPage===1?"disabled":""}
          aria-label="Go to previous page"
        >
          Prev
        </button>

        <div class="pagination__pages">${i}</div>

        <button
          class="pagination__btn pagination__btn--next"
          data-page="${this.currentPage+1}"
          ${this.currentPage===this.totalPages?"disabled":""}
          aria-label="Go to next page"
        >
          Next
        </button>
        <button
          class="pagination__btn pagination__btn--last"
          data-page="${this.totalPages}"
          ${this.currentPage===this.totalPages?"disabled":""}
          aria-label="Go to last page"
        >
          Last
        </button>

        <div class="pagination__goto">
          <input
            type="number"
            class="pagination__input"
            min="1"
            max="${this.totalPages}"
            placeholder="Page"
            aria-label="Go to page number"
          >
          <button class="pagination__btn pagination__btn--go" aria-label="Go to entered page">Go</button>
        </div>
      </nav>
    `}bindEvents(){this.container.addEventListener("click",i=>{const s=i.target.closest(".pagination__btn[data-page]");if(s&&!s.disabled){const a=parseInt(s.dataset.page,10);this.goToPage(a)}});const t=this.container.querySelector(".pagination__btn--go"),e=this.container.querySelector(".pagination__input");t&&e&&(t.addEventListener("click",()=>{const i=parseInt(e.value,10);i>=1&&i<=this.totalPages&&this.goToPage(i)}),e.addEventListener("keydown",i=>{if(i.key==="Enter"){const s=parseInt(e.value,10);s>=1&&s<=this.totalPages&&this.goToPage(s)}}))}goToPage(t){t<1||t>this.totalPages||t===this.currentPage||(this.currentPage=t,this.render(),this.bindEvents(),this.onPageChange(t))}update(t,e){this.currentPage=t,this.totalPages=e,this.render(),this.bindEvents()}getCurrentPage(){return this.currentPage}getTotalPages(){return this.totalPages}}class d{constructor(t,e={}){if(!t){console.error("TagCloud: Container element required");return}this.container=t,this.tags=e.tags||[],this.baseUrl=e.baseUrl||"",this.onTagClick=e.onTagClick||null,this.sizeClasses=["xs","sm","md","lg","xl"],this.render()}calculateSizeClass(t,e,i){if(i===e)return"md";const s=(t-e)/(i-e),a=Math.min(Math.floor(s*this.sizeClasses.length),this.sizeClasses.length-1);return this.sizeClasses[a]}render(){if(this.tags.length===0){this.container.innerHTML=`
        <div class="tag-cloud tag-cloud--empty">
          <p>No tags found</p>
        </div>
      `;return}const t=this.tags.map(a=>a.post_count||0),e=Math.min(...t),i=Math.max(...t),s=this.tags.map(a=>{const r=this.calculateSizeClass(a.post_count||0,e,i);return`
          <a
            href="${`${this.baseUrl}/blog/tag/${a.slug}`}"
            class="tag-cloud__tag tag-cloud__tag--${r}"
            data-tag-id="${a.id}"
            data-tag-slug="${a.slug}"
            title="${a.name} (${a.post_count||0} posts)"
          >
            ${this.escapeHtml(a.name)}
            <span class="tag-cloud__tag__count">(${a.post_count||0})</span>
          </a>
        `}).join("");this.container.innerHTML=`<div class="tag-cloud">${s}</div>`,this.bindEvents()}bindEvents(){this.onTagClick&&this.container.querySelectorAll(".tag-cloud__tag").forEach(t=>{t.addEventListener("click",e=>{e.preventDefault();const i=parseInt(t.dataset.tagId,10),s=this.tags.find(a=>a.id===i);s&&this.onTagClick(s)})})}update(t){this.tags=t||[],this.render()}escapeHtml(t){const e=document.createElement("div");return e.textContent=t,e.innerHTML}}class u{constructor(t,e={}){if(!t){console.error("SearchBox: Container element required");return}this.container=t,this.baseUrl=e.baseUrl||"",this.placeholder=e.placeholder||"Search...",this.debounceMs=e.debounceMs||300,this.minChars=e.minChars||2,this.previewLimit=e.previewLimit||5,this.onSearch=e.onSearch||null,this.onSuggestionClick=e.onSuggestionClick||null,this.suggestions=[],this.totalResults=0,this.activeIndex=-1,this.debounceTimer=null,this.isLoading=!1,this.currentQuery="",this.enhance(),this.bindEvents()}enhance(){if(this.form=this.container.querySelector("form"),this.input=this.container.querySelector('input[type="search"], input[name="q"]'),this.form&&this.input){const t=this.form.parentElement;t&&t!==this.container?t.style.position="relative":this.form.style.position="relative",this.suggestionsEl=document.createElement("div"),this.suggestionsEl.className="search-widget__suggestions",this.suggestionsEl.setAttribute("role","listbox"),this.suggestionsEl.setAttribute("aria-label","Search results"),this.form.insertAdjacentElement("afterend",this.suggestionsEl),this.input.setAttribute("autocomplete","off")}else this.render()}render(){this.container.innerHTML=`
      <div class="search-widget">
        <form class="search-widget__form" role="search">
          <input
            type="search"
            class="search-widget__input"
            placeholder="${this.escapeHtml(this.placeholder)}"
            aria-label="Search"
            autocomplete="off"
          >
          <button type="submit" class="search-widget__btn" aria-label="Search">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
        </form>
        <div class="search-widget__suggestions" role="listbox" aria-label="Search results"></div>
      </div>
    `,this.form=this.container.querySelector(".search-widget__form"),this.input=this.container.querySelector(".search-widget__input"),this.suggestionsEl=this.container.querySelector(".search-widget__suggestions")}bindEvents(){this.form.addEventListener("submit",t=>{t.preventDefault(),this.submitSearch()}),this.input.addEventListener("input",()=>{this.handleInput()}),this.input.addEventListener("keydown",t=>{this.handleKeydown(t)}),this.input.addEventListener("focus",()=>{this.suggestions.length>0&&this.showSuggestions()}),document.addEventListener("click",t=>{this.container.contains(t.target)||this.hideSuggestions()}),this.suggestionsEl.addEventListener("click",t=>{const e=t.target.closest(".search-widget__result");if(e){const i=parseInt(e.dataset.index,10);!isNaN(i)&&this.onSuggestionClick&&(t.preventDefault(),this.selectSuggestion(i)),this.hideSuggestions()}})}handleInput(){clearTimeout(this.debounceTimer);const t=this.input.value.trim();if(t.length<this.minChars){this.suggestions=[],this.hideSuggestions();return}this.debounceTimer=setTimeout(()=>{this.fetchSuggestions(t)},this.debounceMs)}handleKeydown(t){const e=this.suggestions.length;switch(t.key){case"ArrowDown":t.preventDefault(),e>0&&(this.activeIndex=Math.min(this.activeIndex+1,e-1),this.updateActiveSuggestion());break;case"ArrowUp":t.preventDefault(),e>0&&(this.activeIndex=Math.max(this.activeIndex-1,-1),this.updateActiveSuggestion());break;case"Enter":this.activeIndex>=0&&this.activeIndex<e&&(t.preventDefault(),this.selectSuggestion(this.activeIndex));break;case"Escape":this.hideSuggestions(),this.input.blur();break}}async fetchSuggestions(t){this.isLoading=!0,this.currentQuery=t,this.suggestionsEl.innerHTML=`
      <div class="search-widget__loading">
        <span class="search-widget__loading-spinner"></span>
        Searching...
      </div>
    `,this.showSuggestions();try{const e=new URLSearchParams({q:t,per_page:this.previewLimit.toString(),page:"1"}),i=await fetch(`${this.baseUrl}/api/v1/blog/search?${e}`);if(!i.ok)throw new Error("Failed to fetch search results");const s=await i.json();this.suggestions=(s.results||[]).map(a=>({id:a.id,title:a.title,slug:a.slug,excerpt:a.excerpt,category:a.categories&&a.categories[0]?a.categories[0].name:null,categorySlug:a.categories&&a.categories[0]?a.categories[0].slug:null,published_at:a.published_at,highlights:a.highlights})),this.totalResults=s.pagination?.total||0,this.activeIndex=-1,this.renderSuggestions()}catch(e){console.error("SearchBox: Error fetching search results:",e),this.suggestions=[],this.suggestionsEl.innerHTML=`
        <div class="search-widget__error">
          Search unavailable
        </div>
      `}finally{this.isLoading=!1}}renderSuggestions(){if(this.suggestions.length===0){this.suggestionsEl.innerHTML=`
        <div class="search-widget__no-results">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
          <span>No results found for "${this.escapeHtml(this.currentQuery)}"</span>
        </div>
      `,this.showSuggestions();return}const t=this.input.value.trim().toLowerCase(),e=this.suggestions.map((s,a)=>{let r=s.highlights?.title?.[0]||this.highlightMatch(s.title,t),n="";return s.highlights?.content?.[0]?n=s.highlights.content[0]:s.highlights?.excerpt?.[0]?n=s.highlights.excerpt[0]:s.excerpt&&(n=this.truncateText(s.excerpt,80)),`
          <a
            href="${this.baseUrl}/blog/${s.slug}"
            class="search-widget__result ${a===this.activeIndex?"search-widget__result--active":""}"
            data-index="${a}"
            role="option"
            aria-selected="${a===this.activeIndex}"
          >
            <div class="search-widget__result-content">
              <span class="search-widget__result-title">${r}</span>
              ${n?`<span class="search-widget__result-excerpt">${n}</span>`:""}
            </div>
            ${s.category?`<span class="search-widget__result-category">${this.escapeHtml(s.category)}</span>`:""}
          </a>
        `}).join(""),i=this.totalResults>this.previewLimit?`
        <a href="${this.baseUrl}/blog/search?q=${encodeURIComponent(this.currentQuery)}" class="search-widget__view-all">
          View all ${this.totalResults} results
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </a>
      `:"";this.suggestionsEl.innerHTML=`
      <div class="search-widget__results-header">
        ${this.totalResults} result${this.totalResults===1?"":"s"} found
      </div>
      ${e}
      ${i}
    `,this.showSuggestions()}truncateText(t,e){if(!t)return"";const i=t.replace(/<[^>]*>/g,"");return i.length<=e?this.escapeHtml(i):this.escapeHtml(i.substring(0,e).trim())+"..."}highlightMatch(t,e){if(!e)return this.escapeHtml(t);const i=this.escapeHtml(t),s=new RegExp(`(${this.escapeRegex(e)})`,"gi");return i.replace(s,"<mark>$1</mark>")}updateActiveSuggestion(){const t=this.suggestionsEl.querySelectorAll(".search-widget__result");t.forEach((e,i)=>{const s=i===this.activeIndex;e.classList.toggle("search-widget__result--active",s),e.setAttribute("aria-selected",s)}),this.activeIndex>=0&&t[this.activeIndex]?.scrollIntoView({block:"nearest"})}selectSuggestion(t){const e=this.suggestions[t];e&&(this.input.value=e.title,this.hideSuggestions(),this.onSuggestionClick&&this.onSuggestionClick(e))}submitSearch(){const t=this.input.value.trim();t&&(this.hideSuggestions(),this.onSearch?this.onSearch(t):window.location.href=`${this.baseUrl}/blog/search?q=${encodeURIComponent(t)}`)}showSuggestions(){this.suggestionsEl.classList.add("search-widget__suggestions--visible")}hideSuggestions(){this.suggestionsEl.classList.remove("search-widget__suggestions--visible"),this.activeIndex=-1}setValue(t){this.input.value=t}getValue(){return this.input.value.trim()}focus(){this.input.focus()}clear(){this.input.value="",this.suggestions=[],this.hideSuggestions()}escapeHtml(t){const e=document.createElement("div");return e.textContent=t,e.innerHTML}escapeRegex(t){return t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}}class p{constructor(t){this.baseUrl=t.baseUrl||"",this.year=t.year||null,this.month=t.month||null,this.headerContainer=t.headerContainer,this.archiveNavContainer=t.archiveNavContainer,this.postsContainer=t.postsContainer,this.paginationContainer=t.paginationContainer,this.tagCloudContainer=t.tagCloudContainer,this.searchContainer=t.searchContainer,this.showToast=t.showToast||(()=>{}),this.archives=[],this.posts=[],this.currentPage=1,this.postsPerPage=9,this.totalPosts=0,this.expandedYears=new Set,this.monthNames=["January","February","March","April","May","June","July","August","September","October","November","December"],this.pagination=null,this.tagCloud=null,this.searchBox=null,this.init()}async init(){this.initWidgets(),await this.loadArchives(),this.year&&this.month&&await this.loadPostsForMonth(this.year,this.month,1),await this.loadSidebarData()}initWidgets(){this.paginationContainer&&(this.pagination=new g(this.paginationContainer,{currentPage:this.currentPage,totalPages:1,onPageChange:t=>{this.year&&this.month&&this.loadPostsForMonth(this.year,this.month,t)}})),this.searchContainer&&(this.searchBox=new u(this.searchContainer,{baseUrl:this.baseUrl,placeholder:"Search posts...",onSearch:t=>this.handleSearch(t)})),this.tagCloudContainer&&(this.tagCloud=new d(this.tagCloudContainer,{tags:[],baseUrl:this.baseUrl}))}async loadArchives(){this.showLoading();try{const t=await fetch(`${this.baseUrl}/api/v1/blog/archive`);if(!t.ok)throw new Error("Failed to load archives");const e=await t.json();this.archives=e.archive||[],this.renderHeader(),this.renderArchiveNav()}catch(t){console.error("BlogArchivePage: Error loading archives:",t),this.showError("Failed to load archive data")}}async loadPostsForMonth(t,e,i=1){this.currentPage=i,this.postsContainer&&(this.postsContainer.innerHTML=`
        <div class="blog-loading">
          <div class="blog-loading__spinner"></div>
          <p class="blog-loading__text">Loading posts...</p>
        </div>
      `);try{const s=new URLSearchParams({page:i.toString(),per_page:this.postsPerPage.toString()}),a=e.toString().padStart(2,"0"),r=await fetch(`${this.baseUrl}/api/v1/blog/archive/${t}/${a}?${s}`);if(!r.ok)throw new Error("Failed to load posts");const n=await r.json();if(this.posts=n.posts||[],this.totalPosts=n.pagination?.total||0,this.renderPosts(),this.pagination){const o=Math.ceil(this.totalPosts/this.postsPerPage);this.pagination.update(this.currentPage,o)}}catch(s){console.error("BlogArchivePage: Error loading posts:",s),this.showToast("Failed to load posts","error"),this.renderPostsEmpty()}}async loadSidebarData(){try{const t=await fetch(`${this.baseUrl}/api/v1/blog/tags?limit=20`);if(t.ok&&this.tagCloud){const e=await t.json();this.tagCloud.update(e.tags||[])}}catch(t){console.error("Error loading tags:",t)}}groupByYear(){const t=new Map;return this.archives.forEach(e=>{t.has(e.year)||t.set(e.year,[]),t.get(e.year).push({month:e.month,post_count:e.post_count})}),t.forEach(e=>{e.sort((i,s)=>s.month-i.month)}),new Map([...t.entries()].sort((e,i)=>i[0]-e[0]))}getTotalPosts(){return this.archives.reduce((t,e)=>t+(e.post_count||0),0)}renderHeader(){if(!this.headerContainer)return;const t=this.year&&this.month?`${this.monthNames[this.month-1]} ${this.year}`:"Archives",e=this.year&&this.month?`Posts from ${this.monthNames[this.month-1]} ${this.year}`:"Browse posts by date",i=this.year&&this.month?this.totalPosts:this.getTotalPosts();this.headerContainer.innerHTML=`
      <div class="archive-header">
        <div class="archive-header__breadcrumb">
          <a href="${this.baseUrl}/blog">Blog</a>
          <span>/</span>
          ${this.year&&this.month?`<a href="${this.baseUrl}/blog/archive">Archives</a><span>/</span><span>${this.monthNames[this.month-1]} ${this.year}</span>`:"<span>Archives</span>"}
        </div>
        <h1 class="archive-header__title">
          <svg class="archive-header__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          ${t}
        </h1>
        <p class="archive-header__description">${e}</p>
        <div class="archive-header__meta">
          <span class="archive-header__count">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            ${i} posts
          </span>
        </div>
      </div>
    `}renderArchiveNav(){if(!this.archiveNavContainer)return;if(this.archives.length===0){this.archiveNavContainer.innerHTML=`
        <div class="blog-empty">
          <svg class="blog-empty__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <h3 class="blog-empty__title">No archives yet</h3>
          <p class="blog-empty__text">Posts will appear here once published.</p>
        </div>
      `;return}const t=this.groupByYear();let e="";t.forEach((i,s)=>{const a=this.expandedYears.has(s)||this.year===s,r=i.reduce((o,l)=>o+(l.post_count||0),0),n=i.map(o=>{const l=this.year===s&&this.month===o.month;return`
          <a href="${this.baseUrl}/blog/archive/${s}/${String(o.month).padStart(2,"0")}"
             class="archive-month ${l?"archive-month--active":""}">
            <span class="archive-month__name">${this.monthNames[o.month-1]}</span>
            <span class="archive-month__count">${o.post_count||0}</span>
          </a>
        `}).join("");e+=`
        <div class="archive-year" data-year="${s}">
          <div class="archive-year__header" data-action="toggle">
            <span class="archive-year__label">${s}</span>
            <span class="archive-year__count">${r} posts</span>
            <svg class="archive-year__toggle ${a?"archive-year__toggle--expanded":""}"
                 xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <div class="archive-year__months ${a?"archive-year__months--expanded":""}">
            <div class="archive-months">${n}</div>
          </div>
        </div>
      `}),this.archiveNavContainer.innerHTML=`
      <nav class="archive-nav" aria-label="Archive navigation">
        <h2 class="archive-nav__title">Browse by Date</h2>
        <div class="archive-timeline">${e}</div>
      </nav>
    `,this.bindNavEvents()}bindNavEvents(){this.archiveNavContainer&&this.archiveNavContainer.querySelectorAll('[data-action="toggle"]').forEach(t=>{t.addEventListener("click",()=>{const e=t.closest(".archive-year"),i=parseInt(e.dataset.year,10);this.toggleYear(i)})})}toggleYear(t){this.expandedYears.has(t)?this.expandedYears.delete(t):this.expandedYears.add(t),this.renderArchiveNav()}renderPosts(){if(!this.postsContainer)return;if(this.posts.length===0){this.renderPostsEmpty();return}const t=this.posts.map(e=>this.renderPostCard(e)).join("");this.postsContainer.innerHTML=`
      <section class="archive-posts">
        <div class="archive-posts__header">
          <h2 class="archive-posts__title">Posts from ${this.monthNames[this.month-1]} ${this.year}</h2>
          <a href="${this.baseUrl}/blog/archive" class="archive-posts__back">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back to all archives
          </a>
        </div>
        <div class="posts-grid">${t}</div>
      </section>
    `}renderPostCard(t){const e=t.featured_image_url?`<img src="${this.escapeHtml(t.featured_image_url)}" alt="${this.escapeHtml(t.title)}" loading="lazy">`:`<div class="post-card__image-placeholder">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </div>`,i=this.formatDate(t.published_at||t.created_at);return`
      <article class="post-card">
        <a href="${this.baseUrl}/blog/${t.slug}" class="post-card__image">
          ${e}
        </a>
        <div class="post-card__content">
          <h3 class="post-card__title">
            <a href="${this.baseUrl}/blog/${t.slug}">${this.escapeHtml(t.title)}</a>
          </h3>
          <p class="post-card__excerpt">${this.escapeHtml(t.excerpt||"")}</p>
          <div class="post-card__meta">
            <div class="post-card__date">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <time datetime="${t.published_at||t.created_at}">${i}</time>
            </div>
          </div>
        </div>
      </article>
    `}showLoading(){this.archiveNavContainer&&(this.archiveNavContainer.innerHTML=`
        <div class="blog-loading">
          <div class="blog-loading__spinner"></div>
          <p class="blog-loading__text">Loading archives...</p>
        </div>
      `)}renderPostsEmpty(){this.postsContainer&&(this.postsContainer.innerHTML=`
      <div class="blog-empty">
        <svg class="blog-empty__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        <h3 class="blog-empty__title">No posts found</h3>
        <p class="blog-empty__text">No posts were published in this period.</p>
      </div>
    `)}showError(t){this.archiveNavContainer&&(this.archiveNavContainer.innerHTML=`
        <div class="blog-empty">
          <svg class="blog-empty__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3 class="blog-empty__title">Error</h3>
          <p class="blog-empty__text">${this.escapeHtml(t)}</p>
        </div>
      `)}handleSearch(t){window.location.href=`${this.baseUrl}/blog/search?q=${encodeURIComponent(t)}`}formatDate(t){return t?new Date(t).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}):""}escapeHtml(t){if(!t)return"";const e=document.createElement("div");return e.textContent=t,e.innerHTML}}function c(){const h=document.getElementById("archiveHeader"),t=document.getElementById("archiveNav"),e=document.getElementById("postsContainer"),i=document.getElementById("pagination"),s=document.getElementById("tagCloudWidget"),a=document.getElementById("searchWidget"),r=window.BASE_URL||"",n=window.ARCHIVE_YEAR?parseInt(window.ARCHIVE_YEAR,10):null,o=window.ARCHIVE_MONTH?parseInt(window.ARCHIVE_MONTH,10):null,l=v(),m=new p({baseUrl:r,year:n,month:o,headerContainer:h,archiveNavContainer:t,postsContainer:e,paginationContainer:i,tagCloudContainer:s,searchContainer:a,showToast:l});typeof window<"u"&&(window.blogArchiveController=m)}function v(){const h={success:"linear-gradient(to right, #00b09b, #96c93d)",error:"linear-gradient(to right, #ff5f6d, #ffc371)",info:"linear-gradient(to right, #667eea, #764ba2)"};return function(e,i="success"){typeof Toastify<"u"?Toastify({text:e,duration:4e3,gravity:"top",position:"right",style:{background:h[i]||h.info}}).showToast():console.log(`[${i.toUpperCase()}] ${e}`)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",c):c()})();
