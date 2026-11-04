// HTML 模板：布局 / 首页 / 分类页 / 阅读页
function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 路径前缀：index 在根，category/book 在子目录
const p = (base, path) => base + path;

// 侧边导航树（服务端渲染，无 JS 也可导航）
function renderSidebar(nav, base, { activeBookId = '', activeCategorySlug = '' } = {}) {
  const items = nav.categories
    .map((cat) => {
      const open = cat.slug === activeCategorySlug ? ' open' : '';
      const books = cat.books
        .map((b) => {
          const act = b.id === activeBookId ? ' class="active"' : '';
          return `<li><a href="${p(base, 'books/' + b.id + '.html')}"${act}>${esc(b.title)}</a></li>`;
        })
        .join('');
      return `
      <div class="nav-cat" data-cat="${esc(cat.slug)}">
        <button class="nav-cat-toggle${open}" aria-expanded="${cat.slug === activeCategorySlug}">
          <span class="nav-cat-emoji">${cat.emoji}</span>
          <span class="nav-cat-name">${esc(cat.name)}</span>
          <span class="nav-cat-count">${cat.count}</span>
          <span class="nav-cat-caret">▸</span>
        </button>
        <ul class="nav-cat-list${open}">${books}</ul>
      </div>`;
    })
    .join('');
  return `
    <nav class="sidebar-nav" aria-label="书籍导航">
      <a href="${p(base, 'index.html')}" class="nav-home${activeBookId === '' && activeCategorySlug === '' ? ' active' : ''}">🏠 书库首页</a>
      ${items}
    </nav>`;
}

function metaBlock(book) {
  const rows = [];
  if (book.intro && book.intro['作者']) rows.push(['作者', book.intro['作者']]);
  if (book.intro && book.intro['出版社']) rows.push(['出版社', book.intro['出版社']]);
  if (book.intro && book.intro['ISBN']) rows.push(['ISBN', book.intro['ISBN']]);
  if (book.date) rows.push(['整理日期', book.date]);
  if (!rows.length) return '';
  const cells = rows
    .map(([k, v]) => `<div class="meta-item"><span class="meta-k">${esc(k)}</span><span class="meta-v">${esc(v)}</span></div>`)
    .join('');
  return `<div class="book-meta">${cells}</div>`;
}

function tagChips(tags) {
  if (!tags || !tags.length) return '';
  return `<div class="tag-chips">${tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>`;
}

function bookCard(book, base) {
  return `
    <a class="book-card" href="${p(base, 'books/' + book.id + '.html')}">
      <div class="book-card-emoji">${book.categoryEmoji}</div>
      <div class="book-card-body">
        <h3 class="book-card-title">${esc(book.title)}</h3>
        <div class="book-card-sub">${esc(book.intro && book.intro['作者'] ? '作者：' + book.intro['作者'] : book.categoryName)}</div>
        <p class="book-card-desc">${esc(book.description ? (book.description.slice(0, 56) + (book.description.length > 56 ? '…' : '')) : '点击阅读全文')}</p>
        ${tagChips(book.tags)}
      </div>
    </a>`;
}

// 首页
export function pageHome(nav, books, base) {
  const total = books.length;
  const catCards = nav.categories
    .map(
      (cat) => `
      <a class="cat-card" href="${p(base, 'category/' + cat.slug + '.html')}">
        <div class="cat-card-emoji">${cat.emoji}</div>
        <div class="cat-card-name">${esc(cat.name)}</div>
        <div class="cat-card-count">${cat.count} 本</div>
      </a>`
    )
    .join('');
  const featured = books.slice(0, 6);
  const body = `
    <section class="hero">
      <h1 class="hero-title">书库 · 在线阅读</h1>
      <p class="hero-sub">整理自 <a href="https://github.com/7wate/wiki" target="_blank" rel="noopener">7wate/wiki</a> 的 ${nav.categories.length} 大分类、共 ${total} 本书摘与读书笔记。清晰导航，舒适阅读。</p>
      <button class="btn-primary" id="home-search-btn">🔍 搜索书名 / 内容</button>
    </section>
    <section class="section">
      <h2 class="section-title">分类浏览</h2>
      <div class="cat-grid">${catCards}</div>
    </section>
    <section class="section">
      <h2 class="section-title">随便看看</h2>
      <div class="book-grid">${featured.map((b) => bookCard(b, base)).join('')}</div>
    </section>`;
  return wrap({
    title: '书库 · 在线阅读',
    body,
    base,
    nav,
    activeBookId: '',
    activeCategorySlug: '',
  });
}

// 分类页
export function pageCategory(nav, category, booksInCat, base) {
  const body = `
    <section class="cat-header">
      <div class="cat-header-emoji">${category.emoji}</div>
      <div>
        <h1 class="cat-header-title">${esc(category.name)}</h1>
        <p class="cat-header-sub">共 ${booksInCat.length} 本书</p>
      </div>
    </section>
    <div class="book-grid">${booksInCat.map((b) => bookCard(b, base)).join('')}</div>`;
  return wrap({
    title: category.name + ' · 书库',
    body,
    base,
    nav,
    activeBookId: '',
    activeCategorySlug: category.slug,
  });
}

// 阅读页
export function pageBook(nav, book, prev, next, base) {
  const toc = book.chapters
    .map((c) => `<li><a href="#ch-${esc(c.id)}" class="toc-link" data-chapter="${esc(c.id)}">${esc(c.text)}</a></li>`)
    .join('');
  const sectionsHtml = book.sections
    .map((s) => `<section class="chapter" id="ch-${esc(s.id)}" data-id="${esc(s.id)}">${s.html}</section>`)
    .join('');
  const srcUrl =
    'https://github.com/7wate/wiki/blob/main/' + encodeURI(book.sourcePath);
  const prevHtml = prev
    ? `<a class="pager-prev" href="${p(base, 'books/' + prev.id + '.html')}"><span>← 上一本</span><strong>${esc(prev.title)}</strong></a>`
    : `<span class="pager-disabled">← 上一本</span>`;
  const nextHtml = next
    ? `<a class="pager-next" href="${p(base, 'books/' + next.id + '.html')}"><span>下一本 →</span><strong>${esc(next.title)}</strong></a>`
    : `<span class="pager-disabled">下一本 →</span>`;
  const body = `
    <div class="reading-progress" id="reading-progress"></div>
    <article class="reader" data-book-id="${book.id}">
      <nav class="breadcrumb">
        <a href="${p(base, 'index.html')}">首页</a> /
        <a href="${p(base, 'category/' + book.categorySlug + '.html')}">${esc(book.categoryName)}</a> /
        <span>${esc(book.title)}</span>
      </nav>
      <header class="reader-head">
        <div class="reader-emoji">${book.categoryEmoji}</div>
        <div class="reader-head-main">
          <h1 class="reader-title">${esc(book.title)}</h1>
          ${metaBlock(book)}
          ${tagChips(book.tags)}
        </div>
        <div class="reader-actions">
          <button class="icon-btn" id="bookmark-btn" title="收藏本节">☆</button>
          <button class="icon-btn" id="reading-settings-btn" title="阅读设置">Aa</button>
        </div>
      </header>
      <div class="chapter-toolbar" id="chapter-toolbar">
        <div class="ct-info">
          <span class="ct-index" id="ct-index">第 1 / ${book.chapters.length} 章</span>
          <span class="ct-title" id="ct-title"></span>
        </div>
        <div class="ct-actions">
          <button class="ch-btn" id="ch-prev" aria-label="上一章">← 上一章</button>
          <button class="ch-btn" id="ch-next" aria-label="下一章">下一章 →</button>
          <button class="ch-btn" id="mode-toggle" aria-label="切换阅读模式">连续阅读</button>
        </div>
      </div>
      <div class="reader-content md-body" id="reader-content">${sectionsHtml}</div>
      <nav class="pager">${prevHtml}${nextHtml}</nav>
      <footer class="reader-foot">
        <p>内容整理自 <a href="${srcUrl}" target="_blank" rel="noopener">7wate/wiki · ${esc(book.sourcePath)}</a></p>
        <p class="license">本站仅作书摘聚合与学习用途，遵循 <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>；第三方内容版权归原作者所有。</p>
      </footer>
    </article>`;
  return wrap({
    title: book.title + ' · 书库',
    body,
    base,
    nav,
    activeBookId: book.id,
    activeCategorySlug: book.categorySlug,
    isBook: true,
    toc,
  });
}

// 顶层布局
function wrap({ title, body, base, nav, activeBookId, activeCategorySlug, isBook = false, toc = '' }) {
  const sidebar = renderSidebar(nav, base, { activeBookId, activeCategorySlug });
  const layoutClass = isBook ? 'layout layout-book' : 'layout';
  const mainClass = isBook ? 'main main-book' : 'main';
  const tocAside = isBook
    ? `<aside class="toc-panel" id="toc-panel">
         <div class="toc-sticky">
           <div class="toc-title">目录</div>
           <ul class="toc-list">${toc}</ul>
         </div>
       </aside>
       <button class="fab-toc" id="fab-toc" aria-label="目录">☰ 目录</button>`
    : '';
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(title)} - 书库在线阅读">
<link rel="stylesheet" href="${p(base, 'assets/style.css')}">
</head>
<body>
<header class="topbar">
  <button class="icon-btn menu-btn" id="menu-btn" aria-label="菜单">☰</button>
  <a class="brand" href="${p(base, 'index.html')}">📚 书库</a>
  <div class="topbar-spacer"></div>
  <button class="icon-btn" id="search-btn" aria-label="搜索">🔍</button>
  <button class="icon-btn" id="theme-btn" aria-label="主题">🌙</button>
  <button class="icon-btn" id="bookmarks-btn" aria-label="书签">🔖</button>
</header>
<div class="${layoutClass}">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-inner">${sidebar}</div>
  </aside>
  <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
  <div class="toc-backdrop" id="toc-backdrop"></div>
  <main class="${mainClass}">${body}</main>
  ${tocAside}
</div>

<div class="modal" id="search-modal" hidden>
  <div class="modal-backdrop" data-close="search"></div>
  <div class="modal-box search-box">
    <input type="search" id="search-input" class="search-input" placeholder="搜索书名、作者、标签或正文…" autocomplete="off">
    <div class="search-results" id="search-results"></div>
  </div>
</div>

<div class="modal" id="bookmarks-modal" hidden>
  <div class="modal-backdrop" data-close="bookmarks"></div>
  <div class="modal-box">
    <div class="modal-head"><h3>我的书签</h3><button class="icon-btn" data-close="bookmarks">✕</button></div>
    <div class="bookmarks-list" id="bookmarks-list"></div>
  </div>
</div>

<div class="modal" id="settings-modal" hidden>
  <div class="modal-backdrop" data-close="settings"></div>
  <div class="modal-box">
    <div class="modal-head"><h3>阅读设置</h3><button class="icon-btn" data-close="settings">✕</button></div>
    <div class="settings-body" id="settings-body"></div>
  </div>
</div>

<script src="${p(base, 'assets/data.js')}"></script>
<script src="${p(base, 'assets/vendor/fuse.js')}"></script>
<script src="${p(base, 'assets/app.js')}"></script>
</body>
</html>`;
}
