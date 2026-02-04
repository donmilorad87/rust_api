(function(){"use strict";class c{constructor(e,t={}){if(!e){console.error("SearchBox: Container element required");return}this.container=e,this.baseUrl=t.baseUrl||"",this.placeholder=t.placeholder||"Search...",this.debounceMs=t.debounceMs||300,this.minChars=t.minChars||2,this.previewLimit=t.previewLimit||5,this.onSearch=t.onSearch||null,this.onSuggestionClick=t.onSuggestionClick||null,this.suggestions=[],this.totalResults=0,this.activeIndex=-1,this.debounceTimer=null,this.isLoading=!1,this.currentQuery="",this.enhance(),this.bindEvents()}enhance(){if(this.form=this.container.querySelector("form"),this.input=this.container.querySelector('input[type="search"], input[name="q"]'),this.form&&this.input){const e=this.form.parentElement;e&&e!==this.container?e.style.position="relative":this.form.style.position="relative",this.suggestionsEl=document.createElement("div"),this.suggestionsEl.className="search-widget__suggestions",this.suggestionsEl.setAttribute("role","listbox"),this.suggestionsEl.setAttribute("aria-label","Search results"),this.form.insertAdjacentElement("afterend",this.suggestionsEl),this.input.setAttribute("autocomplete","off")}else this.render()}render(){this.container.innerHTML=`
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
    `,this.form=this.container.querySelector(".search-widget__form"),this.input=this.container.querySelector(".search-widget__input"),this.suggestionsEl=this.container.querySelector(".search-widget__suggestions")}bindEvents(){this.form.addEventListener("submit",e=>{e.preventDefault(),this.submitSearch()}),this.input.addEventListener("input",()=>{this.handleInput()}),this.input.addEventListener("keydown",e=>{this.handleKeydown(e)}),this.input.addEventListener("focus",()=>{this.suggestions.length>0&&this.showSuggestions()}),document.addEventListener("click",e=>{this.container.contains(e.target)||this.hideSuggestions()}),this.suggestionsEl.addEventListener("click",e=>{const t=e.target.closest(".search-widget__result");if(t){const r=parseInt(t.dataset.index,10);!isNaN(r)&&this.onSuggestionClick&&(e.preventDefault(),this.selectSuggestion(r)),this.hideSuggestions()}})}handleInput(){clearTimeout(this.debounceTimer);const e=this.input.value.trim();if(e.length<this.minChars){this.suggestions=[],this.hideSuggestions();return}this.debounceTimer=setTimeout(()=>{this.fetchSuggestions(e)},this.debounceMs)}handleKeydown(e){const t=this.suggestions.length;switch(e.key){case"ArrowDown":e.preventDefault(),t>0&&(this.activeIndex=Math.min(this.activeIndex+1,t-1),this.updateActiveSuggestion());break;case"ArrowUp":e.preventDefault(),t>0&&(this.activeIndex=Math.max(this.activeIndex-1,-1),this.updateActiveSuggestion());break;case"Enter":this.activeIndex>=0&&this.activeIndex<t&&(e.preventDefault(),this.selectSuggestion(this.activeIndex));break;case"Escape":this.hideSuggestions(),this.input.blur();break}}async fetchSuggestions(e){this.isLoading=!0,this.currentQuery=e,this.suggestionsEl.innerHTML=`
      <div class="search-widget__loading">
        <span class="search-widget__loading-spinner"></span>
        Searching...
      </div>
    `,this.showSuggestions();try{const t=new URLSearchParams({q:e,per_page:this.previewLimit.toString(),page:"1"}),r=await fetch(`${this.baseUrl}/api/v1/blog/search?${t}`);if(!r.ok)throw new Error("Failed to fetch search results");const s=await r.json();this.suggestions=(s.results||[]).map(i=>({id:i.id,title:i.title,slug:i.slug,excerpt:i.excerpt,category:i.categories&&i.categories[0]?i.categories[0].name:null,categorySlug:i.categories&&i.categories[0]?i.categories[0].slug:null,published_at:i.published_at,highlights:i.highlights})),this.totalResults=s.pagination?.total||0,this.activeIndex=-1,this.renderSuggestions()}catch(t){console.error("SearchBox: Error fetching search results:",t),this.suggestions=[],this.suggestionsEl.innerHTML=`
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
      `,this.showSuggestions();return}const e=this.input.value.trim().toLowerCase(),t=this.suggestions.map((s,i)=>{let n=s.highlights?.title?.[0]||this.highlightMatch(s.title,e),o="";return s.highlights?.content?.[0]?o=s.highlights.content[0]:s.highlights?.excerpt?.[0]?o=s.highlights.excerpt[0]:s.excerpt&&(o=this.truncateText(s.excerpt,80)),`
          <a
            href="${this.baseUrl}/blog/${s.slug}"
            class="search-widget__result ${i===this.activeIndex?"search-widget__result--active":""}"
            data-index="${i}"
            role="option"
            aria-selected="${i===this.activeIndex}"
          >
            <div class="search-widget__result-content">
              <span class="search-widget__result-title">${n}</span>
              ${o?`<span class="search-widget__result-excerpt">${o}</span>`:""}
            </div>
            ${s.category?`<span class="search-widget__result-category">${this.escapeHtml(s.category)}</span>`:""}
          </a>
        `}).join(""),r=this.totalResults>this.previewLimit?`
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
      ${t}
      ${r}
    `,this.showSuggestions()}truncateText(e,t){if(!e)return"";const r=e.replace(/<[^>]*>/g,"");return r.length<=t?this.escapeHtml(r):this.escapeHtml(r.substring(0,t).trim())+"..."}highlightMatch(e,t){if(!t)return this.escapeHtml(e);const r=this.escapeHtml(e),s=new RegExp(`(${this.escapeRegex(t)})`,"gi");return r.replace(s,"<mark>$1</mark>")}updateActiveSuggestion(){const e=this.suggestionsEl.querySelectorAll(".search-widget__result");e.forEach((t,r)=>{const s=r===this.activeIndex;t.classList.toggle("search-widget__result--active",s),t.setAttribute("aria-selected",s)}),this.activeIndex>=0&&e[this.activeIndex]?.scrollIntoView({block:"nearest"})}selectSuggestion(e){const t=this.suggestions[e];t&&(this.input.value=t.title,this.hideSuggestions(),this.onSuggestionClick&&this.onSuggestionClick(t))}submitSearch(){const e=this.input.value.trim();e&&(this.hideSuggestions(),this.onSearch?this.onSearch(e):window.location.href=`${this.baseUrl}/blog/search?q=${encodeURIComponent(e)}`)}showSuggestions(){this.suggestionsEl.classList.add("search-widget__suggestions--visible")}hideSuggestions(){this.suggestionsEl.classList.remove("search-widget__suggestions--visible"),this.activeIndex=-1}setValue(e){this.input.value=e}getValue(){return this.input.value.trim()}focus(){this.input.focus()}clear(){this.input.value="",this.suggestions=[],this.hideSuggestions()}escapeHtml(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}escapeRegex(e){return e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}}class h{constructor(e){this.baseUrl=e.baseUrl||"",this.categoriesContainer=e.categoriesContainer,this.tagsContainer=e.tagsContainer,this.searchContainer=e.searchContainer,this.showToast=e.showToast||(()=>{}),this.categories=[],this.tags=[],this.isLoading=!1,this.searchBox=null,this.init()}async init(){this.initWidgets(),await this.loadData()}initWidgets(){this.searchContainer&&(this.searchBox=new c(this.searchContainer,{baseUrl:this.baseUrl,placeholder:"Search posts...",onSearch:e=>this.handleSearch(e)}))}async loadData(){this.showLoading();try{await Promise.all([this.loadCategories(),this.loadTags()])}catch(e){console.error("BlogTaxonomyPage: Error loading data:",e),this.showError("Failed to load taxonomy data")}}async loadCategories(){try{const e=await fetch(`${this.baseUrl}/api/v1/blog/categories`);if(!e.ok)throw new Error("Failed to load categories");const t=await e.json();this.categories=t.categories||[],this.renderCategories()}catch(e){console.error("Error loading categories:",e),this.renderCategoriesError()}}async loadTags(){try{const e=await fetch(`${this.baseUrl}/api/v1/blog/tags?limit=100`);if(!e.ok)throw new Error("Failed to load tags");const t=await e.json();this.tags=t.tags||[],this.renderTags()}catch(e){console.error("Error loading tags:",e),this.renderTagsError()}}renderCategories(){if(!this.categoriesContainer)return;if(this.categories.length===0){this.categoriesContainer.innerHTML=`
        <div class="blog-empty">
          <svg class="blog-empty__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <h3 class="blog-empty__title">No categories yet</h3>
          <p class="blog-empty__text">Categories will appear here once created.</p>
        </div>
      `;return}const e=this.categories.map(t=>this.renderCategoryCard(t)).join("");this.categoriesContainer.innerHTML=`
      <section class="taxonomy-section">
        <h2 class="taxonomy-section__title">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          Categories
        </h2>
        <div class="categories-grid">
          ${e}
        </div>
      </section>
    `}renderCategoryCard(e){return`
      <a href="${this.baseUrl}/blog/category/${e.slug}" class="category-card">
        <div class="category-card__icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <h3 class="category-card__name">${this.escapeHtml(e.name)}</h3>
        ${e.description?`<p class="category-card__description">${this.escapeHtml(e.description)}</p>`:""}
        <div class="category-card__meta">
          <span class="category-card__count">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            ${e.post_count||0} posts
          </span>
        </div>
      </a>
    `}renderTags(){if(!this.tagsContainer)return;if(this.tags.length===0){this.tagsContainer.innerHTML=`
        <div class="blog-empty">
          <svg class="blog-empty__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
          <h3 class="blog-empty__title">No tags yet</h3>
          <p class="blog-empty__text">Tags will appear here once created.</p>
        </div>
      `;return}const e=this.tags.map(i=>i.post_count||0),t=Math.min(...e),r=Math.max(...e),s=this.tags.map(i=>{const n=this.getSizeClass(i.post_count||0,t,r);return`
          <a href="${this.baseUrl}/blog/tag/${i.slug}" class="tags-cloud-large__tag tags-cloud-large__tag--${n}">
            #${this.escapeHtml(i.name)}
            <span class="tags-cloud-large__count">(${i.post_count||0})</span>
          </a>
        `}).join("");this.tagsContainer.innerHTML=`
      <section class="taxonomy-section">
        <h2 class="taxonomy-section__title">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
          Tags
        </h2>
        <div class="tags-cloud-large">
          ${s}
        </div>
      </section>
    `}getSizeClass(e,t,r){const s=["xs","sm","md","lg","xl"];if(r===t)return"md";const i=(e-t)/(r-t),n=Math.min(Math.floor(i*s.length),s.length-1);return s[n]}showLoading(){const e=`
      <div class="blog-loading">
        <div class="blog-loading__spinner"></div>
        <p class="blog-loading__text">Loading...</p>
      </div>
    `;this.categoriesContainer&&(this.categoriesContainer.innerHTML=e),this.tagsContainer&&(this.tagsContainer.innerHTML="")}renderCategoriesError(){this.categoriesContainer&&(this.categoriesContainer.innerHTML=`
      <div class="blog-empty">
        <h3 class="blog-empty__title">Failed to load categories</h3>
      </div>
    `)}renderTagsError(){this.tagsContainer&&(this.tagsContainer.innerHTML=`
      <div class="blog-empty">
        <h3 class="blog-empty__title">Failed to load tags</h3>
      </div>
    `)}showError(e){this.categoriesContainer&&(this.categoriesContainer.innerHTML=`
        <div class="blog-empty">
          <svg class="blog-empty__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3 class="blog-empty__title">Error</h3>
          <p class="blog-empty__text">${this.escapeHtml(e)}</p>
        </div>
      `)}handleSearch(e){window.location.href=`${this.baseUrl}/blog/search?q=${encodeURIComponent(e)}`}escapeHtml(e){if(!e)return"";const t=document.createElement("div");return t.textContent=e,t.innerHTML}}function l(){const a=document.getElementById("categoriesContainer"),e=document.getElementById("tagsContainer"),t=document.getElementById("searchWidget"),r=window.BASE_URL||"",s=g(),i=new h({baseUrl:r,categoriesContainer:a,tagsContainer:e,searchContainer:t,showToast:s});typeof window<"u"&&(window.blogTaxonomyController=i)}function g(){const a={success:"linear-gradient(to right, #00b09b, #96c93d)",error:"linear-gradient(to right, #ff5f6d, #ffc371)",info:"linear-gradient(to right, #667eea, #764ba2)"};return function(t,r="success"){typeof Toastify<"u"?Toastify({text:t,duration:4e3,gravity:"top",position:"right",style:{background:a[r]||a.info}}).showToast():console.log(`[${r.toUpperCase()}] ${t}`)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",l):l()})();
