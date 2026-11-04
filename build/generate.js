// 编排：读取解析结果 → 生成 dist/ 全部静态文件
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildBooks } from './parse.js';
import { CATEGORIES, FALLBACK_CATEGORY } from './categories.js';
import { pageHome, pageCategory, pageBook } from './templates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

const FUSE_CDN = 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js';

async function fetchFuse() {
  try {
    const res = await fetch(FUSE_CDN);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
  } catch (e) {
    // 离线兜底：若已存在则复用
    const local = join(DIST, 'assets', 'vendor', 'fuse.js');
    try {
      return await readFile(local, 'utf8');
    } catch {
      throw new Error('无法获取 Fuse.js：' + e.message);
    }
  }
}

function buildNav(books) {
  const byCat = new Map();
  for (const b of books) {
    if (!byCat.has(b.categorySlug)) byCat.set(b.categorySlug, []);
    byCat.get(b.categorySlug).push(b);
  }
  return {
    categories: CATEGORIES.map((c) => {
      const list = (byCat.get(c.slug) || []).map((b) => ({
        id: b.id,
        title: b.title,
        desc: b.description,
        tags: b.tags,
      }));
      return { slug: c.slug, name: c.name, emoji: c.emoji, count: list.length, books: list };
    }).filter((c) => c.count > 0),
  };
}

async function write(rel, content) {
  const full = join(DIST, rel);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, 'utf8');
}

async function main() {
  console.log('→ 解析内容…');
  const books = await buildBooks();
  const nav = buildNav(books);
  console.log(`→ 共 ${books.length} 本书，${nav.categories.length} 个分类`);

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  // 首页
  await write('index.html', pageHome(nav, books, ''));

  // 分类页
  for (const cat of nav.categories) {
    const inCat = books.filter((b) => b.categorySlug === cat.slug);
    await write(`category/${cat.slug}.html`, pageCategory(nav, cat, inCat, '../'));
  }

  // 阅读页（带上一本/下一本）
  for (let i = 0; i < books.length; i++) {
    const prev = books[i - 1] || null;
    const next = books[i + 1] || null;
    await write(`books/${books[i].id}.html`, pageBook(nav, books[i], prev, next, '../'));
  }

  // 导航数据
  await write('assets/data.js', `window.__NAV__ = ${JSON.stringify(nav)};\n`);

  // 搜索索引（含正文全文）
  const index = books.map((b) => ({
    id: b.id,
    title: b.title,
    category: b.categoryName,
    categorySlug: b.categorySlug,
    desc: b.description,
    tags: b.tags,
    author: (b.intro && b.intro['作者']) || '',
    text: b.text,
    chapters: b.chapters,
  }));
  await write('assets/search-index.json', JSON.stringify(index));

  // 静态资源（样式与前端脚本，从 src/ 复制进 dist）
  const srcDir = join(ROOT, 'src');
  const srcCss = await readFile(join(srcDir, 'style.css'), 'utf8');
  await write('assets/style.css', srcCss);
  const srcApp = await readFile(join(srcDir, 'app.js'), 'utf8');
  await write('assets/app.js', srcApp);

  // Fuse.js（自包含，离线可复用）
  const fuse = await fetchFuse();
  await write('assets/vendor/fuse.js', fuse);

  // 关闭 Jekyll
  await write('.nojekyll', '');

  console.log('✓ 生成完成，输出目录：dist/');
}

main().catch((e) => {
  console.error('生成失败：', e);
  process.exit(1);
});
