# 书库 · 在线阅读站

一个基于 GitHub 仓库 [`7wate/wiki`](https://github.com/7wate/wiki) 中 `Book/` 目录（14 大分类、70 本书摘与读书笔记）整理而成的**纯静态、可直接部署**的在线阅读网站。

- 清晰的「分类 → 书 → 章节」三级导航
- **逐章阅读**：每本书按原文 `##` 章节切分，支持「上一章 / 下一章」逐页翻读、目录跳转、键盘 ←/→ 翻章；可一键切换「逐章阅读 / 连续阅读」两种模式
- 舒适的正文阅读界面（可调节字号 / 行距 / 字体 / 阅读栏宽）
- 桌面、平板、手机多端响应式布局
- 站内全文搜索（书名 / 作者 / 标签 / 正文）
- 明 / 暗主题切换，阅读进度与书签（localStorage 持久化）
- 零运行时依赖：构建期把所有 Markdown 预渲染为 HTML，部署后离线可读

> 章节拆分严格保真：每本书按 `##` 边界逐块渲染后顺序拼接，与整篇一次渲染、与原始 Markdown 完全一致（已对 70 本书逐一校验），文字、标题、段落顺序零丢失。

> 内容整理自 7wate/wiki，遵循 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)；第三方引用内容版权归原作者所有。每篇阅读页底部均附来源链接与许可说明。

---

## 目录结构

```
wiki-book-site/
├── build/                 # 构建脚本（Node ESM）
│   ├── categories.js      # 14 个分类的中文名 / slug / emoji 映射
│   ├── fetch.js           # 从 GitHub API 抓取 Book/ 全部 .md 到 build/content
│   ├── parse.js           # 解析 front-matter、提取 ## 章节、渲染 HTML
│   ├── templates.js       # 首页 / 分类页 / 阅读页 HTML 模板
│   ├── generate.js        # 编排生成 dist/（含资源复制、Fuse.js 拉取）
│   └── serve.js           # 本地预览静态服务器
├── src/                   # 静态资源源码（会被复制到 dist/assets）
│   ├── style.css
│   └── app.js
├── build/content/Book/    # 抓取下来的原始 Markdown（git 可忽略）
└── dist/                  # 构建产物（部署目录，含 .nojekyll）
    ├── index.html
    ├── category/*.html
    ├── books/*.html
    └── assets/{style.css, app.js, data.js, search-index.json, vendor/fuse.js}
```

## 本地使用

### 1. 安装依赖

```bash
npm install        # 仅依赖 marked
```

### 2. 抓取内容（可选，已有 build/content 可跳过）

```bash
node build/fetch.js          # 拉取最新 Book/ 内容到 build/content
```

> 若网络受限，可手动把仓库 `Book/` 目录放到 `build/content/Book/` 下，结构与线上一致即可。

### 3. 构建站点

```bash
npm run build                # 等价于 node build/generate.js
```

产物输出到 `dist/`。

### 4. 本地预览

```bash
npm run serve                # 默认 http://localhost:4173
```

或直接用任意静态服务器打开 `dist/`：

```bash
npx serve dist
# 或
python3 -m http.server -d dist 8080
```

> 注意：`dist/` 全部使用相对路径，直接双击 `dist/index.html` 在浏览器打开也能正常浏览（搜索索引通过相对路径加载）。

## 部署

`dist/` 是一个完全自包含的静态站点，可部署到任意静态托管：

- **GitHub Pages**：把 `dist/` 内容推到仓库的 `gh-pages` 分支或开启 Pages 指向包含 `.nojekyll` 的分支即可（`.nojekyll` 已内置，避免 Jekyll 拦截 `_`/中文路径）。
- **Netlify / Vercel / Cloudflare Pages**：构建命令 `npm run build`，发布目录 `dist`。
- **对象存储 / 任意 Web 服务器**：直接上传 `dist/` 全部文件。

### 内容更新后重新构建

源仓库内容变动后：

```bash
node build/fetch.js && npm run build
```

然后重新部署 `dist/` 即可。

## 功能说明

| 功能 | 说明 |
| --- | --- |
| 导航 | 左侧分类树（桌面常驻、移动端抽屉），阅读页右侧章节目录（移动端转为悬浮「目录」按钮） |
| 搜索 | 点击顶栏 🔍 或首页搜索按钮，按书名/作者/标签/正文检索，命中跳转对应书 |
| 主题 | 顶栏 🌙/☀️ 切换明暗，自动记忆 |
| 阅读设置 | 阅读页右上角 `Aa`：正文字体（无衬线/衬线）、字号、行距、阅读栏宽 |
| 进度与书签 | 顶栏阅读进度条；阅读页 ☆ 收藏当前章节，🔖 查看/管理全部书签，均 localStorage 持久化 |
| 逐章阅读 | 阅读页顶部章节工具栏：显示「第 N / M 章」、上一章/下一章翻页、连续阅读↔逐章阅读切换；键盘 ←/→ 翻章；URL `#ch-<章节>` 可直达指定章；关闭 JS 时自动退化为展示全部章节 |

## 技术要点

- 构建期预渲染：无 SSG 框架依赖，输出纯静态 HTML。
- 全站相对路径 + `.nojekyll`，兼容 GitHub Pages 子路径与本地直开。
- 中文路径经 URL 编码；重复书名以「分类 + SHA1 哈希」保证唯一 id。
- 搜索索引（含正文全文）约 700KB，仅在首次打开搜索时懒加载。
- 抓取阶段单文件失败仅跳过并提示，不阻断整体构建。
