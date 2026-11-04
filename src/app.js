/* ============================================================
   书库 · 在线阅读站  前端交互
   依赖（已通过 vendor 同步加载）：Fuse（全局）
   数据（已通过 data.js 同步加载）：window.__NAV__
   ============================================================ */
(function () {
  'use strict';

  var STORE_KEY = 'wikibook:v1';
  var state = loadState();

  // 当前页资源基址：子目录（books/、category/）下需回退一级
  var BASE = (function () {
    var p = location.pathname || '';
    if (/\/(books|category)\//.test(p)) return '../';
    return '';
  })();

  function loadState() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { theme: 'light', bookmarks: [], settings: {} };
  }
  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- 主题 ---------- */
  function applyTheme() {
    var t = state.theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    var btn = $('#theme-btn');
    if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
  }
  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(); saveState();
  }

  /* ---------- 侧边栏抽屉（移动端） ---------- */
  function lockScroll(lock) { document.body.classList.toggle('no-scroll', !!lock); }
  function openSidebar() {
    var sb = $('#sidebar'); var bd = $('#sidebar-backdrop');
    if (sb) sb.classList.add('open');
    if (bd) bd.classList.add('open');
    lockScroll(true);
  }
  function closeSidebar() {
    var sb = $('#sidebar'); var bd = $('#sidebar-backdrop');
    if (sb) sb.classList.remove('open');
    if (bd) bd.classList.remove('open');
    lockScroll(false);
  }
  function toggleSidebar() {
    var sb = $('#sidebar');
    if (sb && sb.classList.contains('open')) closeSidebar(); else openSidebar();
  }

  /* ---------- 侧边分类折叠 ---------- */
  function initNavCats() {
    $all('.nav-cat-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var list = btn.parentElement.querySelector('.nav-cat-list');
        var open = btn.classList.toggle('open');
        if (list) list.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  }

  /* ---------- 弹窗通用 ---------- */
  function openModal(id) {
    var m = $('#' + id);
    if (m) m.hidden = false;
    if (id === 'search-modal') setTimeout(function () { var i = $('#search-input'); if (i) i.focus(); }, 30);
  }
  function closeModal(id) {
    var m = $('#' + id);
    if (m) m.hidden = true;
  }
  function initModals() {
    $all('[data-close]').forEach(function (el) {
      el.addEventListener('click', function () { closeModal('' + el.getAttribute('data-close') + '-modal'); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        ['search', 'bookmarks', 'settings'].forEach(closeModal);
        closeSidebar();
        closeTocDrawer();
      }
    });
  }

  /* ---------- 搜索 ---------- */
  var fuseReady = false, fuseInstance = null;
  function buildFuse(list) {
    fuseInstance = new Fuse(list, {
      includeMatches: true,
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.35,
      keys: [
        { name: 'title', weight: 0.4 },
        { name: 'author', weight: 0.2 },
        { name: 'tags', weight: 0.2 },
        { name: 'desc', weight: 0.15 },
        { name: 'text', weight: 0.05 }
      ]
    });
    fuseReady = true;
  }
  function loadSearchIndex(cb) {
    if (fuseReady) { cb(); return; }
    fetch(BASE + 'assets/search-index.json', { cache: 'force-cache' })
      .then(function (r) { return r.json(); })
      .then(function (list) {
        // 预先在每本书里把章节拼成可搜索段，便于定位
        list.forEach(function (b) {
          b._chapters = (b.chapters || []).map(function (c) {
            return { id: c.id, text: c.text };
          });
        });
        buildFuse(list);
        cb();
      })
      .catch(function (e) { console.error('搜索索引加载失败', e); });
  }
  function highlight(text, indices) {
    if (!indices || !indices.length) return escapeHtml(text);
    var out = ''; var last = 0;
    indices.slice().sort(function (a, b) { return a[0] - b[0]; }).forEach(function (pair) {
      out += escapeHtml(text.slice(last, pair[0]));
      out += '<mark>' + escapeHtml(text.slice(pair[0], pair[1])) + '</mark>';
      last = pair[1];
    });
    out += escapeHtml(text.slice(last));
    return out;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function findSnippet(text, q) {
    if (!text) return '';
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return text.slice(0, 80);
    var s = Math.max(0, i - 30);
    return (s > 0 ? '…' : '') + text.slice(s, i + q.length + 50);
  }
  function runSearch(q) {
    var box = $('#search-results');
    if (!box) return;
    q = q.trim();
    if (!q) { box.innerHTML = ''; return; }
    if (!fuseReady) { box.innerHTML = '<div class="search-empty">索引加载中…</div>'; return; }
    var res = fuseInstance.search(q).slice(0, 30);
    if (!res.length) { box.innerHTML = '<div class="search-empty">没有找到相关内容</div>'; return; }
    box.innerHTML = res.map(function (r) {
      var b = r.item;
      var titleMatch = (r.matches || []).find(function (m) { return m.key === 'title'; });
      var title = titleMatch ? highlight(b.title, titleMatch.indices) : escapeHtml(b.title);
      var sub = (b.category || '') + (b.author ? ' · ' + b.author : '');
      var snippet = findSnippet(b.text, q);
      return '<a class="search-result" href="' + BASE + 'books/' + b.id + '.html">' +
        '<div class="search-result-title">' + title + '</div>' +
        '<div class="search-result-sub">' + escapeHtml(sub) + '</div>' +
        '<div class="search-result-snippet">' + escapeHtml(snippet) + '</div></a>';
    }).join('');
  }
  function initSearch() {
    var btn = $('#search-btn'); var homeBtn = $('#home-search-btn');
    var input = $('#search-input');
    if (btn) btn.addEventListener('click', function () {
      openModal('search-modal'); loadSearchIndex(function () { runSearch(input ? input.value : ''); });
    });
    if (homeBtn) homeBtn.addEventListener('click', function () {
      openModal('search-modal'); loadSearchIndex(function () { runSearch(''); });
    });
    if (input) {
      var t;
      input.addEventListener('input', function () {
        clearTimeout(t); t = setTimeout(function () { runSearch(input.value); }, 120);
      });
    }
  }

  /* ---------- 书签 ---------- */
  function bookmarkKey() {
    var reader = $('.reader');
    if (!reader) return null;
    var id = reader.getAttribute('data-book-id');
    var hash = location.hash || '';
    return { id: id, hash: hash };
  }
  function currentBookmarkExists() {
    var k = bookmarkKey();
    if (!k) return false;
    return state.bookmarks.some(function (b) { return b.id === k.id && b.hash === k.hash; });
  }
  function renderBookmarks() {
    var list = $('#bookmarks-list');
    if (!list) return;
    if (!state.bookmarks.length) {
      list.innerHTML = '<div class="search-empty">还没有收藏。在阅读页点击 ☆ 可收藏当前章节。</div>';
      return;
    }
    var nav = window.__NAV__;
    var byId = {};
    (nav ? nav.categories : []).forEach(function (c) {
      c.books.forEach(function (b) { byId[b.id] = { title: b.title, cat: c.name, catSlug: c.slug }; });
    });
    list.innerHTML = state.bookmarks.map(function (b, idx) {
      var info = byId[b.id] || { title: b.id, cat: '', catSlug: '' };
      var href = BASE + 'books/' + b.id + '.html' + (b.hash || '');
      var sec = b.section ? ' › ' + escapeHtml(b.section) : '';
      return '<div class="bookmark-item">' +
        '<a href="' + href + '"><div>' + escapeHtml(info.title) + sec + '</div>' +
        '<div class="bm-cat">' + escapeHtml(info.cat) + '</div></a>' +
        '<button class="bm-remove" data-idx="' + idx + '" title="移除">✕</button></div>';
    }).join('');
    $all('.bm-remove', list).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = parseInt(btn.getAttribute('data-idx'), 10);
        state.bookmarks.splice(i, 1); saveState(); renderBookmarks(); updateBookmarkBtn();
      });
    });
  }
  function updateBookmarkBtn() {
    var btn = $('#bookmark-btn');
    if (!btn) return;
    var on = currentBookmarkExists();
    btn.textContent = on ? '★' : '☆';
    btn.classList.toggle('active', on);
  }
  function toggleBookmark() {
    var k = bookmarkKey();
    if (!k) return;
    var nav = window.__NAV__;
    var section = '';
    if (k.hash) {
      var el = $(k.hash);
      if (el) {
        var h2 = el.querySelector('h2');
        section = (h2 ? h2.textContent : (el.getAttribute('data-id') || '')).trim();
      }
    }
    var ex = currentBookmarkExists();
    if (ex) {
      state.bookmarks = state.bookmarks.filter(function (b) { return !(b.id === k.id && b.hash === k.hash); });
    } else {
      state.bookmarks.unshift({ id: k.id, hash: k.hash, section: section });
    }
    saveState(); updateBookmarkBtn();
  }
  function initBookmarks() {
    var btn = $('#bookmarks-btn');
    if (btn) btn.addEventListener('click', function () { renderBookmarks(); openModal('bookmarks-modal'); });
    var bbtn = $('#bookmark-btn');
    if (bbtn) bbtn.addEventListener('click', toggleBookmark);
  }

  /* ---------- 阅读设置 ---------- */
  function applySettings() {
    var s = state.settings || {};
    var root = document.documentElement;
    if (s.fontSize) root.style.setProperty('--read-font-size', s.fontSize + 'px');
    if (s.lineHeight) root.style.setProperty('--read-line-height', String(s.lineHeight));
    if (s.width) root.style.setProperty('--read-width', s.width + 'px');
    if (s.font === 'serif') root.style.setProperty('--read-current-font', 'var(--read-serif)');
    else root.style.setProperty('--read-current-font', 'var(--read-font)');
  }
  function readSettingVal(el) { return el ? el.value : null; }
  function buildSettingsUI() {
    var body = $('#settings-body');
    if (!body) return;
    var s = state.settings || {};
    function seg(name, options, current) {
      return '<div class="setting-row"><label>' + name + '</label><div class="setting-control seg" data-seg="' + name + '">' +
        options.map(function (o) {
          return '<button data-val="' + o.v + '" class="' + (String(current) === String(o.v) ? 'active' : '') + '">' + o.t + '</button>';
        }).join('') + '</div></div>';
    }
    body.innerHTML =
      seg('正文字体', [{ v: 'sans', t: '无衬线' }, { v: 'serif', t: '衬线' }], s.font || 'sans') +
      '<div class="setting-row"><label>字号 <span id="fs-val">' + (s.fontSize || 18) + 'px</span></label>' +
      '<input type="range" id="set-fontsize" min="15" max="24" step="1" value="' + (s.fontSize || 18) + '"></div>' +
      '<div class="setting-row"><label>行距 <span id="lh-val">' + (s.lineHeight || 1.85) + '</span></label>' +
      '<input type="range" id="set-lineheight" min="1.4" max="2.4" step="0.05" value="' + (s.lineHeight || 1.85) + '"></div>' +
      '<div class="setting-row"><label>阅读栏宽 <span id="wd-val">' + (s.width || 720) + 'px</span></label>' +
      '<input type="range" id="set-width" min="560" max="900" step="20" value="' + (s.width || 720) + '"></div>';

    $all('.seg', body).forEach(function (group) {
      var name = group.getAttribute('data-seg');
      $all('button', group).forEach(function (b) {
        b.addEventListener('click', function () {
          $all('button', group).forEach(function (x) { x.classList.remove('active'); });
          b.classList.add('active');
          state.settings = state.settings || {};
          state.settings.font = b.getAttribute('data-val');
          saveState(); applySettings();
        });
      });
    });
    var fs = $('#set-fontsize'), lh = $('#set-lineheight'), wd = $('#set-width');
    if (fs) fs.addEventListener('input', function () {
      $('#fs-val').textContent = fs.value + 'px';
      state.settings.fontSize = parseInt(fs.value, 10); saveState(); applySettings();
    });
    if (lh) lh.addEventListener('input', function () {
      $('#lh-val').textContent = lh.value;
      state.settings.lineHeight = parseFloat(lh.value); saveState(); applySettings();
    });
    if (wd) wd.addEventListener('input', function () {
      $('#wd-val').textContent = wd.value + 'px';
      state.settings.width = parseInt(wd.value, 10); saveState(); applySettings();
    });
  }
  function initSettings() {
    var btn = $('#reading-settings-btn');
    if (btn) btn.addEventListener('click', function () { buildSettingsUI(); openModal('settings-modal'); });
  }

  /* ---------- 阅读进度 + 章节目录高亮 + TOC 抽屉 ---------- */
  var chapterContext = null; // 书籍页的逐章上下文；存在时由它接管滚动/高亮
  function onScroll() {
    if (chapterContext) { chapterContext.onScroll(); return; }
    // 非书籍页兜底：仅进度条
    var bar = $('#reading-progress');
    if (bar) {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
      bar.style.setProperty('--progress', pct.toFixed(2) + '%');
    }
  }
  function closeTocDrawer() {
    var tp = $('#toc-panel');
    var bd = $('#toc-backdrop');
    if (tp && tp.classList.contains('as-drawer')) {
      tp.classList.remove('open');
      if (bd) bd.classList.remove('open');
      lockScroll(false);
    }
  }
  function initToc() {
    var fab = $('#fab-toc');
    var tp = $('#toc-panel');
    var bd = $('#toc-backdrop');
    if (fab && tp) {
      // 在窄屏时把 TOC 变成抽屉
      if (window.matchMedia('(max-width: 1024px)').matches) {
        tp.classList.add('as-drawer');
      }
      function setToc(open) {
        tp.classList.toggle('open', open);
        if (bd) bd.classList.toggle('open', open);
        lockScroll(open);
      }
      fab.addEventListener('click', function () {
        setToc(!tp.classList.contains('open'));
      });
      // 点击遮罩关闭抽屉（移动端无 fab 可见时仍可关闭）
      if (bd) bd.addEventListener('click', function () { setToc(false); });
    }
    // 章节点击的跳转逻辑在 initChapters 中统一处理
  }

  /* ---------- 逐章阅读 ---------- */
  function initChapters() {
    var reader = $('.reader');
    if (!reader) return;
    var bookId = reader.getAttribute('data-book-id');
    var sections = $all('.chapter', reader);
    if (!sections.length) return;
    var tocLinks = $all('.toc-link');
    var idxEl = $('#ct-index'), titleEl = $('#ct-title');
    var prevBtn = $('#ch-prev'), nextBtn = $('#ch-next'), modeBtn = $('#mode-toggle');
    var total = sections.length;
    var mode = (state.settings && state.settings.chapterMode) || 'chapter';
    var savedId = (state.reading && state.reading[bookId]) || '';

    function indexOfId(id) {
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].getAttribute('data-id') === id) return i;
      }
      return -1;
    }
    function currentIndex() {
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].classList.contains('active')) return i;
      }
      return 0;
    }
    function setProgress(pct) {
      var bar = $('#reading-progress');
      if (bar) bar.style.setProperty('--progress', pct + '%');
    }
    function refresh() {
      var i = currentIndex();
      var sec = sections[i];
      var id = sec.getAttribute('data-id');
      tocLinks.forEach(function (l) {
        l.classList.toggle('active', l.getAttribute('data-chapter') === id);
      });
      if (idxEl) idxEl.textContent = '第 ' + (i + 1) + ' / ' + total + ' 章';
      if (titleEl) {
        var h2 = sec.querySelector('h2');
        titleEl.textContent = h2 ? h2.textContent : id;
      }
      if (prevBtn) prevBtn.disabled = (i === 0);
      if (nextBtn) nextBtn.disabled = (i === total - 1);
      if (!state.reading) state.reading = {};
      state.reading[bookId] = id;
      saveState();
      if (mode === 'chapter') setProgress(((i + 1) / total) * 100);
    }
    function showChapter(i, doScroll) {
      i = Math.max(0, Math.min(total - 1, i));
      sections.forEach(function (s, idx) { s.classList.toggle('active', idx === i); });
      refresh();
      if (doScroll !== false) {
        if (mode === 'chapter') {
          var top = reader.getBoundingClientRect().top + window.scrollY - 56;
          window.scrollTo({ top: top, behavior: 'smooth' });
        } else {
          var el = document.getElementById('ch-' + sections[i].getAttribute('data-id'));
          if (el) {
            var t = el.getBoundingClientRect().top + window.scrollY - 64;
            window.scrollTo({ top: t, behavior: 'smooth' });
          }
        }
      }
      if (history.replaceState) {
        history.replaceState(null, '', '#ch-' + sections[i].getAttribute('data-id'));
      }
    }
    function go(delta) { showChapter(currentIndex() + delta, true); }
    function applyMode(m) {
      mode = m;
      if (!state.settings) state.settings = {};
      state.settings.chapterMode = m;
      reader.classList.toggle('mode-chapter', m === 'chapter');
      if (modeBtn) modeBtn.textContent = m === 'chapter' ? '连续阅读' : '逐章阅读';
      saveState();
      refresh();
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { go(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { go(1); });
    if (modeBtn) modeBtn.addEventListener('click', function () {
      applyMode(mode === 'chapter' ? 'full' : 'chapter');
    });
    tocLinks.forEach(function (l) {
      l.addEventListener('click', function (e) {
        var id = l.getAttribute('data-chapter');
        var i = indexOfId(id);
        if (i >= 0) { e.preventDefault(); showChapter(i, true); closeTocDrawer(); }
      });
    });

    function initialIndex() {
      var h = location.hash || '';
      var m = h.match(/^#ch-(.+)$/);
      if (m) { var i = indexOfId(decodeURIComponent(m[1])); if (i >= 0) return i; }
      if (savedId) { var si = indexOfId(savedId); if (si >= 0) return si; }
      return 0;
    }
    function onScrollHandler() {
      if (mode === 'chapter') return; // 逐章模式进度由 showChapter 设置
      var bar = $('#reading-progress');
      if (bar) {
        var dh = document.documentElement;
        var max = dh.scrollHeight - dh.clientHeight;
        var pct = max > 0 ? (dh.scrollTop / max) * 100 : 0;
        bar.style.setProperty('--progress', pct.toFixed(2) + '%');
      }
      var pos = window.scrollY + 120;
      var activeId = null;
      sections.forEach(function (s) {
        var t = s.getBoundingClientRect().top + window.scrollY;
        if (t <= pos) activeId = s.getAttribute('data-id');
      });
      tocLinks.forEach(function (l) {
        l.classList.toggle('active', l.getAttribute('data-chapter') === activeId);
      });
    }
    chapterContext = { onScroll: onScrollHandler };

    document.addEventListener('keydown', function (e) {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (mode === 'chapter') {
        if (e.key === 'ArrowLeft') go(-1);
        else if (e.key === 'ArrowRight') go(1);
      }
    });

    applyMode(mode);
    showChapter(initialIndex(), false);
  }

  /* ---------- 启动 ---------- */
  function init() {
    applyTheme();
    applySettings();
    initNavCats();
    initModals();
    initSearch();
    initBookmarks();
    initSettings();
    initToc();
    initChapters();
    updateBookmarkBtn();

    var menuBtn = $('#menu-btn');
    if (menuBtn) menuBtn.addEventListener('click', toggleSidebar);
    var bd = $('#sidebar-backdrop');
    if (bd) bd.addEventListener('click', closeSidebar);
    var themeBtn = $('#theme-btn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
