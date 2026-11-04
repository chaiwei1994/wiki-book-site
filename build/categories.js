// 14 个一级分类：中文名 → ASCII slug + 图标（用于首页卡片与排序）
export const CATEGORIES = [
  { name: '个人成长', slug: 'personal-growth', emoji: '🌱' },
  { name: '医学健康', slug: 'medical-health', emoji: '🩺' },
  { name: '历史', slug: 'history', emoji: '📜' },
  { name: '哲学宗教', slug: 'philosophy', emoji: '🧭' },
  { name: '心理', slug: 'psychology', emoji: '🧠' },
  { name: '政治军事', slug: 'politics-military', emoji: '🛡️' },
  { name: '教育学习', slug: 'education', emoji: '📚' },
  { name: '文学', slug: 'literature', emoji: '🖋️' },
  { name: '生活百科', slug: 'life', emoji: '🏡' },
  { name: '社会文化', slug: 'society-culture', emoji: '🌍' },
  { name: '科学技术', slug: 'science-tech', emoji: '🔬' },
  { name: '经济理财', slug: 'finance', emoji: '💰' },
  { name: '艺术', slug: 'art', emoji: '🎨' },
  { name: '计算机', slug: 'computer', emoji: '💻' },
];

// 中文分类名 → slug 查询表（抓取时用于归类/兜底）
export const CATEGORY_SLUG = Object.fromEntries(
  CATEGORIES.map((c) => [c.name, c.slug])
);

// 未知分类（如 Book 根下直接放 md）兜底
export const FALLBACK_CATEGORY = { name: '未分类', slug: 'uncategorized', emoji: '📁' };
