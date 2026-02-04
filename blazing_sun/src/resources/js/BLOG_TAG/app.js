(function(){"use strict";class h{constructor(t,e={}){if(!t){console.error("Pagination: Container element required");return}this.container=t,this.currentPage=e.currentPage||1,this.totalPages=e.totalPages||1,this.onPageChange=e.onPageChange||(()=>{}),this.render(),this.bindEvents()}calculatePageWindow(){let s,i;return this.totalPages<=7?(s=1,i=this.totalPages):this.currentPage<=4?(s=1,i=7):this.currentPage>=this.totalPages-3?(s=this.totalPages-7+1,i=this.totalPages):(s=this.currentPage-3,i=this.currentPage+3),{startPage:s,endPage:i}}render(){if(this.totalPages<=1){this.container.innerHTML="";return}const{startPage:t,endPage:e}=this.calculatePageWindow();let s="";for(let i=t;i<=e;i++){const a=i===this.currentPage;s+=`
        <button
          class="pagination__btn ${a?"pagination__btn--active":""}"
          data-page="${i}"
          ${a?'aria-current="page" disabled':""}
        >
          ${i}
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

        <div class="pagination__pages">${s}</div>

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
    `}bindEvents(){this.container.addEventListener("click",s=>{const i=s.target.closest(".pagination__btn[data-page]");if(i&&!i.disabled){const a=parseInt(i.dataset.page,10);this.goToPage(a)}});const t=this.container.querySelector(".pagination__btn--go"),e=this.container.querySelector(".pagination__input");t&&e&&(t.addEventListener("click",()=>{const s=parseInt(e.value,10);s>=1&&s<=this.totalPages&&this.goToPage(s)}),e.addEventListener("keydown",s=>{if(s.key==="Enter"){const i=parseInt(e.value,10);i>=1&&i<=this.totalPages&&this.goToPage(i)}}))}goToPage(t){t<1||t>this.totalPages||t===this.currentPage||(this.currentPage=t,this.render(),this.bindEvents(),this.onPageChange(t))}update(t,e){this.currentPage=t,this.totalPages=e,this.render(),this.bindEvents()}getCurrentPage(){return this.currentPage}getTotalPages(){return this.totalPages}}class c{constructor(t,e={}){if(!t){console.error("TagCloud: Container element required");return}this.container=t,this.tags=e.tags||[],this.baseUrl=e.baseUrl||"",this.onTagClick=e.onTagClick||null,this.sizeClasses=["xs","sm","md","lg","xl"],this.render()}calculateSizeClass(t,e,s){if(s===e)return"md";const i=(t-e)/(s-e),a=Math.min(Math.floor(i*this.sizeClasses.length),this.sizeClasses.length-1);return this.sizeClasses[a]}render(){if(this.tags.length===0){this.container.innerHTML=`
        <div class="tag-cloud tag-cloud--empty">
          <p>No tags found</p>
        </div>
      `;return}const t=this.tags.map(a=>a.post_count||0),e=Math.min(...t),s=Math.max(...t),i=this.tags.map(a=>{const o=this.calculateSizeClass(a.post_count||0,e,s);return`
          <a
            href="${`${this.baseUrl}/blog/tag/${a.slug}`}"
            class="tag-cloud__tag tag-cloud__tag--${o}"
            data-tag-id="${a.id}"
            data-tag-slug="${a.slug}"
            title="${a.name} (${a.post_count||0} posts)"
          >
            ${this.escapeHtml(a.name)}
            <span class="tag-cloud__tag__count">(${a.post_count||0})</span>
          </a>
        `}).join("");this.container.innerHTML=`<div class="tag-cloud">${i}</div>`,this.bindEvents()}bindEvents(){this.onTagClick&&this.container.querySelectorAll(".tag-cloud__tag").forEach(t=>{t.addEventListener("click",e=>{e.preventDefault();const s=parseInt(t.dataset.tagId,10),i=this.tags.find(a=>a.id===s);i&&this.onTagClick(i)})})}update(t){this.tags=t||[],this.render()}escapeHtml(t){const e=document.createElement("div");return e.textContent=t,e.innerHTML}}class g{constructor(t,e={}){if(!t){console.error("ArchiveWidget: Container element required");return}this.container=t,this.archives=e.archives||[],this.baseUrl=e.baseUrl||"",this.onMonthClick=e.onMonthClick||null,this.expandedYears=new Set,this.monthNames=["January","February","March","April","May","June","July","August","September","October","November","December"],this.render()}groupByYear(){const t=new Map;return this.archives.forEach(e=>{t.has(e.year)||t.set(e.year,[]),t.get(e.year).push({month:e.month,post_count:e.post_count})}),t.forEach((e,s)=>{e.sort((i,a)=>a.month-i.month)}),new Map([...t.entries()].sort((e,s)=>s[0]-e[0]))}getYearTotal(t){return t.reduce((e,s)=>e+(s.post_count||0),0)}render(){if(this.archives.length===0){this.container.innerHTML=`
        <div class="archive-widget archive-widget--empty">
          <p>No archives found</p>
        </div>
      `;return}const t=this.groupByYear();let e='<div class="archive-widget">';t.forEach((s,i)=>{const a=this.expandedYears.has(i),o=this.getYearTotal(s);e+=`
        <div class="archive-widget__year" data-year="${i}">
          <div class="archive-widget__year-header" data-action="toggle">
            <span class="archive-widget__year-label">${i}</span>
            <span class="archive-widget__year-count">${o} posts</span>
            <svg
              class="archive-widget__year-icon ${a?"archive-widget__year-icon--expanded":""}"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <div class="archive-widget__months ${a?"archive-widget__months--expanded":""}">
            ${this.renderMonths(i,s)}
          </div>
        </div>
      `}),e+="</div>",this.container.innerHTML=e,this.bindEvents()}renderMonths(t,e){return e.map(s=>{const i=this.monthNames[s.month-1]||"Unknown";return`
          <a
            href="${`${this.baseUrl}/blog/archive/${t}/${String(s.month).padStart(2,"0")}`}"
            class="archive-widget__month"
            data-year="${t}"
            data-month="${s.month}"
          >
            <span class="archive-widget__month-name">${i}</span>
            <span class="archive-widget__month-count">${s.post_count||0}</span>
          </a>
        `}).join("")}bindEvents(){this.container.querySelectorAll('[data-action="toggle"]').forEach(t=>{t.addEventListener("click",()=>{const e=t.closest(".archive-widget__year"),s=parseInt(e.dataset.year,10);this.toggleYear(s)})}),this.onMonthClick&&this.container.querySelectorAll(".archive-widget__month").forEach(t=>{t.addEventListener("click",e=>{e.preventDefault();const s=parseInt(t.dataset.year,10),i=parseInt(t.dataset.month,10);this.onMonthClick(s,i)})})}toggleYear(t){this.expandedYears.has(t)?this.expandedYears.delete(t):this.expandedYears.add(t),this.render()}expandYear(t){this.expandedYears.add(t),this.render()}collapseYear(t){this.expandedYears.delete(t),this.render()}expandAll(){this.groupByYear().forEach((t,e)=>{this.expandedYears.add(e)}),this.render()}collapseAll(){this.expandedYears.clear(),this.render()}update(t){this.archives=t||[],this.render()}}class d{constructor(t,e={}){if(!t){console.error("SearchBox: Container element required");return}this.container=t,this.baseUrl=e.baseUrl||"",this.placeholder=e.placeholder||"Search...",this.debounceMs=e.debounceMs||300,this.minChars=e.minChars||2,this.previewLimit=e.previewLimit||5,this.onSearch=e.onSearch||null,this.onSuggestionClick=e.onSuggestionClick||null,this.suggestions=[],this.totalResults=0,this.activeIndex=-1,this.debounceTimer=null,this.isLoading=!1,this.currentQuery="",this.enhance(),this.bindEvents()}enhance(){if(this.form=this.container.querySelector("form"),this.input=this.container.querySelector('input[type="search"], input[name="q"]'),this.form&&this.input){const t=this.form.parentElement;t&&t!==this.container?t.style.position="relative":this.form.style.position="relative",this.suggestionsEl=document.createElement("div"),this.suggestionsEl.className="search-widget__suggestions",this.suggestionsEl.setAttribute("role","listbox"),this.suggestionsEl.setAttribute("aria-label","Search results"),this.form.insertAdjacentElement("afterend",this.suggestionsEl),this.input.setAttribute("autocomplete","off")}else this.render()}render(){this.container.innerHTML=`
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
    `,this.form=this.container.querySelector(".search-widget__form"),this.input=this.container.querySelector(".search-widget__input"),this.suggestionsEl=this.container.querySelector(".search-widget__suggestions")}bindEvents(){this.form.addEventListener("submit",t=>{t.preventDefault(),this.submitSearch()}),this.input.addEventListener("input",()=>{this.handleInput()}),this.input.addEventListener("keydown",t=>{this.handleKeydown(t)}),this.input.addEventListener("focus",()=>{this.suggestions.length>0&&this.showSuggestions()}),document.addEventListener("click",t=>{this.container.contains(t.target)||this.hideSuggestions()}),this.suggestionsEl.addEventListener("click",t=>{const e=t.target.closest(".search-widget__result");if(e){const s=parseInt(e.dataset.index,10);!isNaN(s)&&this.onSuggestionClick&&(t.preventDefault(),this.selectSuggestion(s)),this.hideSuggestions()}})}handleInput(){clearTimeout(this.debounceTimer);const t=this.input.value.trim();if(t.length<this.minChars){this.suggestions=[],this.hideSuggestions();return}this.debounceTimer=setTimeout(()=>{this.fetchSuggestions(t)},this.debounceMs)}handleKeydown(t){const e=this.suggestions.length;switch(t.key){case"ArrowDown":t.preventDefault(),e>0&&(this.activeIndex=Math.min(this.activeIndex+1,e-1),this.updateActiveSuggestion());break;case"ArrowUp":t.preventDefault(),e>0&&(this.activeIndex=Math.max(this.activeIndex-1,-1),this.updateActiveSuggestion());break;case"Enter":this.activeIndex>=0&&this.activeIndex<e&&(t.preventDefault(),this.selectSuggestion(this.activeIndex));break;case"Escape":this.hideSuggestions(),this.input.blur();break}}async fetchSuggestions(t){this.isLoading=!0,this.currentQuery=t,this.suggestionsEl.innerHTML=`
      <div class="search-widget__loading">
        <span class="search-widget__loading-spinner"></span>
        Searching...
      </div>
    `,this.showSuggestions();try{const e=new URLSearchParams({q:t,per_page:this.previewLimit.toString(),page:"1"}),s=await fetch(`${this.baseUrl}/api/v1/blog/search?${e}`);if(!s.ok)throw new Error("Failed to fetch search results");const i=await s.json();this.suggestions=(i.results||[]).map(a=>({id:a.id,title:a.title,slug:a.slug,excerpt:a.excerpt,category:a.categories&&a.categories[0]?a.categories[0].name:null,categorySlug:a.categories&&a.categories[0]?a.categories[0].slug:null,published_at:a.published_at,highlights:a.highlights})),this.totalResults=i.pagination?.total||0,this.activeIndex=-1,this.renderSuggestions()}catch(e){console.error("SearchBox: Error fetching search results:",e),this.suggestions=[],this.suggestionsEl.innerHTML=`
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
      `,this.showSuggestions();return}const t=this.input.value.trim().toLowerCase(),e=this.suggestions.map((i,a)=>{let o=i.highlights?.title?.[0]||this.highlightMatch(i.title,t),r="";return i.highlights?.content?.[0]?r=i.highlights.content[0]:i.highlights?.excerpt?.[0]?r=i.highlights.excerpt[0]:i.excerpt&&(r=this.truncateText(i.excerpt,80)),`
          <a
            href="${this.baseUrl}/blog/${i.slug}"
            class="search-widget__result ${a===this.activeIndex?"search-widget__result--active":""}"
            data-index="${a}"
            role="option"
            aria-selected="${a===this.activeIndex}"
          >
            <div class="search-widget__result-content">
              <span class="search-widget__result-title">${o}</span>
              ${r?`<span class="search-widget__result-excerpt">${r}</span>`:""}
            </div>
            ${i.category?`<span class="search-widget__result-category">${this.escapeHtml(i.category)}</span>`:""}
          </a>
        `}).join(""),s=this.totalResults>this.previewLimit?`
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
      ${s}
    `,this.showSuggestions()}truncateText(t,e){if(!t)return"";const s=t.replace(/<[^>]*>/g,"");return s.length<=e?this.escapeHtml(s):this.escapeHtml(s.substring(0,e).trim())+"..."}highlightMatch(t,e){if(!e)return this.escapeHtml(t);const s=this.escapeHtml(t),i=new RegExp(`(${this.escapeRegex(e)})`,"gi");return s.replace(i,"<mark>$1</mark>")}updateActiveSuggestion(){const t=this.suggestionsEl.querySelectorAll(".search-widget__result");t.forEach((e,s)=>{const i=s===this.activeIndex;e.classList.toggle("search-widget__result--active",i),e.setAttribute("aria-selected",i)}),this.activeIndex>=0&&t[this.activeIndex]?.scrollIntoView({block:"nearest"})}selectSuggestion(t){const e=this.suggestions[t];e&&(this.input.value=e.title,this.hideSuggestions(),this.onSuggestionClick&&this.onSuggestionClick(e))}submitSearch(){const t=this.input.value.trim();t&&(this.hideSuggestions(),this.onSearch?this.onSearch(t):window.location.href=`${this.baseUrl}/blog/search?q=${encodeURIComponent(t)}`)}showSuggestions(){this.suggestionsEl.classList.add("search-widget__suggestions--visible")}hideSuggestions(){this.suggestionsEl.classList.remove("search-widget__suggestions--visible"),this.activeIndex=-1}setValue(t){this.input.value=t}getValue(){return this.input.value.trim()}focus(){this.input.focus()}clear(){this.input.value="",this.suggestions=[],this.hideSuggestions()}escapeHtml(t){const e=document.createElement("div");return e.textContent=t,e.innerHTML}escapeRegex(t){return t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}}class u{constructor(t){this.baseUrl=t.baseUrl||"",this.tagSlug=t.tagSlug||"",this.headerContainer=t.headerContainer,this.postsContainer=t.postsContainer,this.paginationContainer=t.paginationContainer,this.tagCloudContainer=t.tagCloudContainer,this.archiveContainer=t.archiveContainer,this.searchContainer=t.searchContainer,this.showToast=t.showToast||(()=>{}),this.tag=null,this.posts=[],this.relatedTags=[],this.currentPage=1,this.postsPerPage=9,this.totalPosts=0,this.isLoading=!1,this.pagination=null,this.tagCloud=null,this.archiveWidget=null,this.searchBox=null,this.init()}async init(){this.initWidgets(),await this.loadInitialData()}initWidgets(){this.paginationContainer&&(this.pagination=new h(this.paginationContainer,{currentPage:this.currentPage,totalPages:1,onPageChange:t=>this.loadPosts(t)})),this.searchContainer&&(this.searchBox=new d(this.searchContainer,{baseUrl:this.baseUrl,placeholder:"Search posts...",onSearch:t=>this.handleSearch(t)})),this.tagCloudContainer&&(this.tagCloud=new c(this.tagCloudContainer,{tags:[],baseUrl:this.baseUrl})),this.archiveContainer&&(this.archiveWidget=new g(this.archiveContainer,{archives:[],baseUrl:this.baseUrl}))}async loadInitialData(){this.showLoading();try{await Promise.all([this.loadTag(),this.loadTags(),this.loadArchives()]),this.tag&&await this.loadPosts(1)}catch(t){console.error("BlogTagPage: Error loading data:",t),this.showError("Failed to load tag data")}}async loadTag(){const t=await fetch(`${this.baseUrl}/api/v1/blog/tags/${this.tagSlug}`);if(!t.ok)throw new Error("Tag not found");const e=await t.json();this.tag=e.tag,this.relatedTags=e.related_tags||[],this.renderHeader()}async loadPosts(t=1){this.currentPage=t,this.isLoading=!0;try{const e=new URLSearchParams({page:t.toString(),limit:this.postsPerPage.toString(),tag:this.tagSlug,status:"published"}),s=await fetch(`${this.baseUrl}/api/v1/blog/posts?${e}`);if(!s.ok)throw new Error("Failed to load posts");const i=await s.json();if(this.posts=i.posts||[],this.totalPosts=i.pagination?.total||0,this.renderPosts(),this.pagination){const a=Math.ceil(this.totalPosts/this.postsPerPage);this.pagination.update(this.currentPage,a)}}catch(e){console.error("BlogTagPage: Error loading posts:",e),this.showToast("Failed to load posts","error"),this.renderEmpty()}finally{this.isLoading=!1}}async loadTags(){if(this.tagCloud)try{const t=await fetch(`${this.baseUrl}/api/v1/blog/tags?limit=30`);if(t.ok){const e=await t.json();this.tagCloud.update(e.tags||[])}}catch(t){console.error("Error loading tags:",t)}}async loadArchives(){if(this.archiveWidget)try{const t=await fetch(`${this.baseUrl}/api/v1/blog/archives`);if(t.ok){const e=await t.json();this.archiveWidget.update(e.archives||[])}}catch(t){console.error("Error loading archives:",t)}}renderHeader(){if(!this.headerContainer||!this.tag)return;const t=this.relatedTags.length>0?`
        <div class="related-tags">
          <span class="related-tags__title">Related tags:</span>
          <div class="related-tags__list">
            ${this.relatedTags.map(e=>`
              <a href="${this.baseUrl}/blog/tag/${e.slug}" class="related-tags__link">
                ${this.escapeHtml(e.name)}
              </a>
            `).join("")}
          </div>
        </div>
      `:"";this.headerContainer.innerHTML=`
      <div class="tag-header">
        <div class="tag-header__breadcrumb">
          <a href="${this.baseUrl}/blog">Blog</a>
          <span>/</span>
          <a href="${this.baseUrl}/blog/tags">Tags</a>
          <span>/</span>
          <span>${this.escapeHtml(this.tag.name)}</span>
        </div>
        <h1 class="tag-header__title">
          <svg class="tag-header__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
          <span class="tag-header__badge">#${this.escapeHtml(this.tag.name)}</span>
        </h1>
        ${this.tag.description?`<p class="tag-header__description">${this.escapeHtml(this.tag.description)}</p>`:""}
        <div class="tag-header__meta">
          <span class="tag-header__count">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            ${this.tag.post_count||0} posts
          </span>
        </div>
        ${t}
      </div>
    `}renderPosts(){if(!this.postsContainer)return;if(this.posts.length===0){this.renderEmpty();return}const t=this.posts.map(e=>this.renderPostCard(e)).join("");this.postsContainer.innerHTML=`
      <div class="posts-grid">
        ${t}
      </div>
    `}renderPostCard(t){const e=t.featured_image_url?`<img src="${this.escapeHtml(t.featured_image_url)}" alt="${this.escapeHtml(t.title)}" loading="lazy">`:`<div class="post-card__image-placeholder">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </div>`,s=this.formatDate(t.published_at||t.created_at);return`
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
              <time datetime="${t.published_at||t.created_at}">${s}</time>
            </div>
          </div>
        </div>
      </article>
    `}showLoading(){this.postsContainer&&(this.postsContainer.innerHTML=`
      <div class="blog-loading">
        <div class="blog-loading__spinner"></div>
        <p class="blog-loading__text">Loading posts...</p>
      </div>
    `)}renderEmpty(){this.postsContainer&&(this.postsContainer.innerHTML=`
      <div class="blog-empty">
        <svg class="blog-empty__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
          <line x1="7" y1="7" x2="7.01" y2="7"></line>
        </svg>
        <h3 class="blog-empty__title">No posts with this tag</h3>
        <p class="blog-empty__text">Check back later for new content.</p>
      </div>
    `)}showError(t){this.postsContainer&&(this.postsContainer.innerHTML=`
      <div class="blog-empty">
        <svg class="blog-empty__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h3 class="blog-empty__title">Error</h3>
        <p class="blog-empty__text">${this.escapeHtml(t)}</p>
      </div>
    `)}handleSearch(t){window.location.href=`${this.baseUrl}/blog/search?q=${encodeURIComponent(t)}`}formatDate(t){return t?new Date(t).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}):""}escapeHtml(t){if(!t)return"";const e=document.createElement("div");return e.textContent=t,e.innerHTML}}function l(){const n=document.getElementById("tagHeader"),t=document.getElementById("postsContainer"),e=document.getElementById("pagination"),s=document.getElementById("tagCloudWidget"),i=document.getElementById("archiveWidget"),a=document.getElementById("searchWidget");if(!t){console.error("BlogTagPage: Posts container not found");return}const o=window.BASE_URL||"",r=window.TAG_SLUG||"",v=p(),_=new u({baseUrl:o,tagSlug:r,headerContainer:n,postsContainer:t,paginationContainer:e,tagCloudContainer:s,archiveContainer:i,searchContainer:a,showToast:v});typeof window<"u"&&(window.blogTagController=_)}function p(){const n={success:"linear-gradient(to right, #00b09b, #96c93d)",error:"linear-gradient(to right, #ff5f6d, #ffc371)",info:"linear-gradient(to right, #667eea, #764ba2)"};return function(e,s="success"){typeof Toastify<"u"?Toastify({text:e,duration:4e3,gravity:"top",position:"right",style:{background:n[s]||n.info}}).showToast():console.log(`[${s.toUpperCase()}] ${e}`)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",l):l()})();
