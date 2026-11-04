// 解析 build/content/Book 下的全部 Markdown → 结构化书籍对象
import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { marked } from 'marked';
import { CATEGORIES, CATEGORY_SLUG, FALLBACK_CATEGORY } from './categories.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, 'content', 'Book');

// 生成锚点 id：保留中英文与连字符，去首尾连字符
export function slugify(text) {
  const cleaned = String(text)
    .replace(/^#+\s*/, '')
    .replace(/\s*#*$/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w一-龥-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'section';
}

// 极简 YAML front-matter 解析：支持 key: value 与 `- list`
function parseFrontMatter(fm) {
  const meta = {};
  let key = null;
  for (const lineRaw of fm.split('\n')) {
    const listMatch = lineRaw.match(/^\s*-\s+(.*)$/);
    if (listMatch && key) {
      const item = listMatch[1].trim();
      if (!Array.isArray(meta[key])) meta[key] = [];
      meta[key].push(item);
      continue;
    }
    const kvMatch = lineRaw.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kvMatch) {
      key = kvMatch[1];
      let val = kvMatch[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      meta[key] = val === '' ? [] : val;
    }
  }
  return meta;
}

// 拆分 front-matter 与正文
function splitContent(text) {
  if (!text.startsWith('---')) return { meta: {}, body: text };
  const lines = text.split('\n');
  let i = 1;
  while (i < lines.length && lines[i].trim() !== '---') i++;
  const fm = lines.slice(1, i).join('\n');
  const body = lines.slice(i + 1).join('\n');
  return { meta: parseFrontMatter(fm), body };
}

// 从 简介 段落提取结构化元信息（**键**：值）
function parseIntro(body) {
  const info = {};
  const lines = body.split('\n');
  let inIntro = false;
  let fence = false;
  for (const line of lines) {
    if (line.trim().startsWith('```')) fence = !fence;
    if (/^##\s+简介/.test(line)) {
      inIntro = true;
      continue;
    }
    if (inIntro && /^##\s+/.test(line)) break;
    if (inIntro && !fence) {
      const m = line.match(/^\s*-\s*\*\*([^*]+)\*\*\s*[:：]\s*(.*)$/);
      if (m) info[m[1].trim()] = m[2].trim().replace(/^《|》$/g, '');
    }
  }
  return info;
}

// 渲染 Markdown 并给标题加 id
// used：跨多个区块共享的去重表，保证「整篇一次渲染」与「分块逐段渲染再拼接」生成的 id 完全一致
function renderMarkdown(body, used) {
  const u = used || new Map();
  const renderer = {
    heading(text, level, raw) {
      const base = slugify(raw || text);
      let id = base;
      let n = 1;
      while (u.has(id)) id = `${base}-${n++}`;
      u.set(id, true);
      return `<h${level} id="${id}" class="md-h md-h-${level}">${text}</h${level}>\n`;
    },
    link(href, title, text) {
      const external = /^https?:\/\//.test(href);
      const attrs = external
        ? ' target="_blank" rel="noopener noreferrer"'
        : '';
      const t = title ? ` title="${title}"` : '';
      return `<a href="${href}"${t}${attrs}>${text}</a>`;
    },
  };
  marked.use({ renderer, gfm: true, breaks: false });
  return marked.parse(body);
}

// 提取 H2 章节目录
function extractChapters(body) {
  const chapters = [];
  const used = new Map();
  const lines = body.split('\n');
  let fence = false;
  for (const line of lines) {
    if (line.trim().startsWith('```')) fence = !fence;
    if (fence) continue;
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      const text = m[1].replace(/^#+\s*/, '').trim();
      const base = slugify(text);
      let id = base;
      let n = 1;
      while (used.has(id)) id = `${base}-${n++}`;
      used.set(id, true);
      chapters.push({ id, text });
    }
  }
  return chapters;
}

// 把正文按 ## 拆成独立区块（顺序与原文完全一致）。
// 第一个 ## 之前的零散内容（如有）记为 title=null 的「前言」区块。
function splitMarkdownSections(body) {
  const lines = body.split('\n');
  let fence = false;
  const chunks = [];
  let curTitle = null;
  let curLines = [];
  const pushChunk = () => {
    // 仅当块有实质内容才保留；避免正文开头空行被误判为「前言」
    if (curLines.join('\n').trim()) chunks.push({ title: curTitle, lines: curLines.join('\n') });
  };
  for (const line of lines) {
    if (line.trim().startsWith('```')) fence = !fence;
    if (!fence) {
      const m = line.match(/^##\s+(.+?)\s*$/);
      if (m) {
        pushChunk();
        curTitle = m[1].replace(/^#+\s*/, '').trim();
        curLines = [line];
        continue;
      }
    }
    curLines.push(line);
  }
  pushChunk();
  return chunks;
}

function plainText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashId(str) {
  return createHash('sha1').update(str).digest('hex').slice(0, 10);
}

// 读取全部书籍
export async function buildBooks() {
  const books = [];
  const cats = await readdir(CONTENT_DIR, { withFileTypes: true });
  for (const catEnt of cats) {
    if (!catEnt.isDirectory() || catEnt.name === '.DS_Store') continue;
    const catName = catEnt.name;
    const catSlug = CATEGORY_SLUG[catName] || FALLBACK_CATEGORY.slug;
    const catMeta =
      CATEGORIES.find((c) => c.slug === catSlug) || FALLBACK_CATEGORY;
    const catDir = join(CONTENT_DIR, catName);
    const files = (await readdir(catDir)).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      const full = join(catDir, file);
      const raw = await readFile(full, 'utf8');
      const { meta, body } = splitContent(raw);
      const html = renderMarkdown(body, new Map());
      const intro = parseIntro(body);

      // 按章节拆分：逐块渲染（共享去重表），顺序与原文一致，零内容丢失
      const sectionUsed = new Map();
      const sections = splitMarkdownSections(body).map((chunk) => {
        const html = renderMarkdown(chunk.lines, sectionUsed);
        // 从渲染结果提取 h2 的 id，作为该章节的唯一标识（外层 section 加 ch- 前缀避免与 h2 id 重复）
        const h2m = html.match(/^<h2\s+id="([^"]+)"/);
        let id;
        if (h2m) {
          id = h2m[1];
        } else {
          id = sectionUsed.has('preamble') ? 'preamble-1' : 'preamble';
          sectionUsed.set(id, true);
        }
        return {
          id,
          title: chunk.title || '前言',
          html,
        };
      });
      const chapters = sections.map((s) => ({ id: s.id, text: s.title }));

      const title = (meta.title || file.replace(/\.md$/, '')).trim();
      const tags = Array.isArray(meta.tags) ? meta.tags : [];
      const sourcePath = `Book/${catName}/${file}`;
      books.push({
        id: hashId(sourcePath),
        title,
        description: (meta.description || '').trim(),
        tags,
        author: (meta.author || '').trim(),
        date: (meta.date || '').trim(),
        categoryName: catName,
        categorySlug: catSlug,
        categoryEmoji: catMeta.emoji,
        chapters,
        sections,
        intro,
        text: plainText(html),
        wordCount: plainText(html).length,
        sourcePath,
      });
    }
  }
  // 按分类顺序 + 书名排序，便于导航稳定
  const order = Object.fromEntries(CATEGORIES.map((c, i) => [c.slug, i]));
  books.sort((a, b) => {
    const oa = order[a.categorySlug] ?? 99;
    const ob = order[b.categorySlug] ?? 99;
    if (oa !== ob) return oa - ob;
    return a.title.localeCompare(b.title, 'zh');
  });
  return books;
}
