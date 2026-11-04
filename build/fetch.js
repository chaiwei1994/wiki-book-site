// 抓取 7wate/wiki 的 Book/ 全部 Markdown 到 build/content/（构建期一次性快照）
import { writeFile, mkdir, rm } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, 'content');

const OWNER = '7wate';
const REPO = 'wiki';
const BRANCH = 'main';

async function getTree() {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'wiki-book-site' } });
  if (!res.ok) throw new Error(`获取目录树失败: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (data.truncated) console.warn('⚠️ 目录树被截断，可能有文件遗漏');
  return data.tree || [];
}

async function downloadRaw(path, retries = 3) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  const url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${encoded}`;
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (i === retries) throw e;
      await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
}

async function main() {
  console.log('→ 拉取目录树…');
  const tree = await getTree();
  // 仅选取 Book/ 下的 .md 文件
  const files = tree.filter(
    (t) => t.type === 'blob' && t.path.startsWith('Book/') && t.path.endsWith('.md')
  );
  console.log(`→ 发现 ${files.length} 个 Markdown 文件，开始下载…`);

  await rm(CONTENT_DIR, { recursive: true, force: true });
  await mkdir(CONTENT_DIR, { recursive: true });

  let ok = 0;
  const failed = [];
  for (const f of files) {
    try {
      const text = await downloadRaw(f.path);
      const out = join(CONTENT_DIR, f.path); // 保留 Book/分类/书名 结构
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, text, 'utf8');
      ok++;
    } catch (e) {
      failed.push({ path: f.path, error: String(e.message || e) });
      process.stdout.write('x');
    }
  }
  console.log(`\n✓ 下载完成：${ok} 成功，${failed.length} 失败`);
  if (failed.length) {
    console.log('失败文件：');
    for (const f of failed) console.log(`  - ${f.path} (${f.error})`);
  }
}

main().catch((e) => {
  console.error('抓取失败：', e);
  process.exit(1);
});
