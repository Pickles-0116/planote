# Design · 博客列表 + 博客详情

> 本文档回答**「列表筛选/排序/搜索如何组合、视图切换如何持久化、详情页元数据如何布局、删除流程如何安全、卡片视觉规范」**。
> 不重复 `architecture.md` 已有的数据模型 / Repository 模式，仅补充本 change 的具体决策。

---

## 1. 选型复述

| 决策 | 选择 | 排除项 | URL query | 原因 |
|------|------|--------|-----------|------|
| 排序实现 | 复用 sort-engine 模式（preset + comparator） | 自研复合条件排序 | 已有 `add-smart-sort` | preset 3 条（created / updated / title）够用；保持一致 |
| 搜索实现 | `useMemo` + `String.includes` | MiniSearch / Lunr | v1.0 子串匹配够用；v1.1 引入 MiniSearch 倒排索引 |
| 筛选组合 | 单个 useFilteredBlogs hook（多 useMemo 串联） | 多 hook 独立订阅 | 派生数据走 selector（project.md §3.2 #3），避免重复订阅 |
| 视图切换器 | 2 按钮胶囊容器 | 下拉菜单 | 2 个选项用按钮更直接 |
| 视图/排序持久化 | `useUIStore` + persist | URL query | 复用现有 store；URL 方案留 v1.1 深链分享 |
| 标签多选 | chip 列表（OR 关系） | 复杂下拉 | v1.0 简化；与 add-framework-drawer tag 筛选一致 |
| 状态过滤 | 3 tab 互斥（全部 / 草稿 / 已发布 / 已归档）| checkbox 多选 | 大多数用例单状态；checkbox 多选 99% 场景是单选 |
| 卡片视觉 | 复用 PlanCard 规范（rounded-2xl + 阴影 + hover）| 全新设计 | 跨页面视觉一致；ux-guidelines.md §1 原则 2 |
| 详情页元数据布局 | 顶部标题 + 单一元数据条 + 操作栏 + 内容 + 附件 | 侧边栏元数据 | 内容为主，元数据次之；与 prototype blog-detail 对齐 |
| 删除确认 | `window.confirm` 简版 | 自建 dialog | v1.0 简化；与 PlanDetail 一致；v1.1 可加 useConfirmDialog |

---

## 2. 关键架构决策

### 2.1 数据 pipeline

```
useBlogs()                       ← useLiveQuery 订阅
  ↓
useFilteredBlogs(filters, sort)  ← 内部 useMemo 串联
  ├─ useMemo: status filter
  ├─ useMemo: framework filter
  ├─ useMemo: tag filter (OR)
  ├─ useMemo: search filter
  └─ useMemo: sort (comparator)
  ↓
[GridView | ListView]            ← 仅切渲染分支
```

**为什么不分多个独立 hook**：
- 组合多 useMemo 性能优（输入未变时不重算）
- 单一 hook 暴露 `{ blogs, totalCount, isEmpty }` 语义清晰
- 视图切换 / 排序变化只触发 useMemo 重算，**不**触发 useLiveQuery 重订阅

### 2.2 sort-engine 复用（add-smart-sort 模式）

```ts
// src/features/blog/utils/sortBlogs.ts
export type BlogSortKey = 'created-desc' | 'updated-desc' | 'title-asc';

export const BLOG_SORT_PRESETS: Record<BlogSortKey, { label: string; comparator: (a: Blog, b: Blog) => number }> = {
  'created-desc': {
    label: '最近创建',
    comparator: (a, b) => b.createdAt.localeCompare(a.createdAt),
  },
  'updated-desc': {
    label: '最近更新',
    comparator: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  },
  'title-asc': {
    label: '标题 A→Z',
    comparator: (a, b) => a.title.localeCompare(b.title, 'zh-CN'),
  },
};

export function sortBlogs(blogs: Blog[], key: BlogSortKey): Blog[] {
  const preset = BLOG_SORT_PRESETS[key];
  return [...blogs].sort(preset.comparator);
}
```

**为什么独立文件**：
- 与 `add-smart-sort` 的 sort-engine 一致（preset 注册模式）
- 易于 v1.1 扩展（加 sort key 只动 preset 表）

### 2.3 搜索字段：title / excerpt / tagIds

```ts
// searchFilter
const needle = query.trim().toLowerCase();
if (!needle) return blogs;
return blogs.filter((b) => {
  if (b.title.toLowerCase().includes(needle)) return true;
  if (b.excerpt.toLowerCase().includes(needle)) return true;
  if (b.tagIds.some((t) => t.toLowerCase().includes(needle))) return true;
  return false;
});
```

**为什么不搜 contentText**：
- contentText 是 Tiptap 提取的全文（含 HTML 标签噪声）
- v1.0 用户通常搜标题/摘要/标签命中即可
- 全文搜索留 v1.1 `add-global-search`（MiniSearch 倒排索引）

### 2.4 标签多选 UI（chip 列表）

```tsx
// BlogListFilters.tsx
<div className="flex flex-wrap gap-1.5">
  {tags.map(tag => (
    <button
      type="button"
      role="switch"
      aria-checked={selected.includes(tag.id)}
      onClick={() => onToggle(tag.id)}
    >
      #{tag.name}
    </button>
  ))}
</div>
```

**OR 关系**：选中任一 tag 即通过（`blog.tagIds.some(t => selected.includes(t))`）。
**为什么不做 AND**：v1.0 用户心智负担低；AND 留给 v1.1 高级筛选。

### 2.5 状态过滤（3 tab 互斥）

```tsx
// 全部 / 草稿 / 已发布 / 已归档 — 4 个互斥单选
type StatusFilter = 'all' | BlogStatus;
const [status, setStatus] = useState<StatusFilter>('all');
```

- v1.0 不做多状态并集过滤（checkbox）；大多数用例单状态
- 「全部」= 不过滤

### 2.6 BlogCard 视觉规范

复用 PlanCard 设计语言：

```tsx
<div className="
  bg-white rounded-2xl border border-stone-200 p-5 shadow-soft
  hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5
  transition cursor-pointer
">
  <div className="flex items-start justify-between mb-2">
    <h3 className="text-base font-bold line-clamp-2">{blog.title}</h3>
    <StatusBadge status={blog.status} />
  </div>
  <p className="text-xs text-brand-500 line-clamp-2 mb-3">{blog.excerpt}</p>
  <div className="flex flex-wrap gap-1 mb-3">
    {blog.tagIds.map(t => <TagChip key={t} name={t} />)}
  </div>
  <div className="flex items-center justify-between text-[10px] text-brand-400">
    {blog.frameworkId && <span>{frameworkName}</span>}
    <span>{formatRelativeTime(blog.updatedAt)}</span>
  </div>
</div>
```

**密度变化**：
- grid：宽 100%（3 列响应式：lg:grid-cols-3 md:grid-cols-2 grid-cols-1）
- list：单行紧凑（进度环省略，改为右侧元数据条）

### 2.7 详情页元数据布局

```
┌─────────────────────────────────────────────┐
│ ← 返回   博客 / {title}    [编辑] [删除]   │ 顶栏
├─────────────────────────────────────────────┤
│ # {title}                                   │ H1
│ ┌─────────────────────────────────────────┐ │
│ │ 状态 | 框架 | 字数 | 创建 | 更新 | 标签 │ │ 元数据条
│ └─────────────────────────────────────────┘ │
│ 来源计划：{plan.title} → 跳转               │ 来源（可选）
├─────────────────────────────────────────────┤
│ {RichEditor readOnly}                       │ 内容
├─────────────────────────────────────────────┤
│ 附件（N）                                   │ 附件（Round 10）
│ {AttachmentList}                            │
└─────────────────────────────────────────────┘
```

**元数据条设计**：
- 单行 flex + gap-4 + 分隔符
- 字数：复用 BlogEdit 的 `countText` 工具
- 创建/更新时间：复用 `formatChineseDate` + 相对时间（`formatRelativeTime`）

### 2.8 删除流程

```ts
const handleDelete = useCallback(async () => {
  if (!id) return;
  const ok = window.confirm(`确认删除博客「${blog.title}」？\n附件将保留在 IndexedDB 中（孤儿数据）。`);
  if (!ok) return;
  try {
    await deleteBlog(id);
    navigate('/blogs');
  } catch (e) {
    pushToast('error', '删除失败');
  }
}, [id, blog, deleteBlog, navigate, pushToast]);
```

**为什么不级联删附件**：
- `attachmentRepo.delete` 是按 id 删；级联删需要在 `deleteBlog` 里 `attachmentRepo.listByBlog(blogId).forEach(a => repo.delete(a.id))`
- v1.0 简化为「删 blog 保留孤儿附件」+ confirm 文案明示
- v1.1 加 `attachmentRepo.deleteByBlog(blogId)` 后再做级联

### 2.9 持久化（uiStore 增量）

```ts
// src/stores/uiStore.ts
interface UIState {
  // ... 已有字段
  blogListView: 'grid' | 'list';                    // 默认 'grid'
  blogListSort: BlogSortKey;                        // 默认 'created-desc'
  blogListStatusFilter: StatusFilter;               // 默认 'all'
  setBlogListView: (v: 'grid' | 'list') => void;
  setBlogListSort: (s: BlogSortKey) => void;
  setBlogListStatusFilter: (s: StatusFilter) => void;
}

// persist partialize 增量
partialize: (state) => ({
  // ... 已有字段
  blogListView: state.blogListView,
  blogListSort: state.blogListSort,
  blogListStatusFilter: state.blogListStatusFilter,
})
```

**为什么用 3 个独立字段而非 1 个 blob**：
- 与现有 `planListView` / `planListSort` 字段一致（`add-plan-list-view` 模式）
- 独立字段便于未来加"按状态过滤"等更多偏好

### 2.10 路由懒加载（沿用 add-app-shell）

```tsx
// App.tsx 已懒加载 BlogList / BlogDetail；本 change 替换 src/pages/blogs/BlogList.tsx
const BlogList = lazy(() => import('@/pages/blogs/BlogList'));
// 不改 App.tsx
```

---

## 3. 组件详细设计

### 3.1 BlogList

```tsx
interface Props {} // 无 props

export default function BlogList() {
  const blogs = useBlogs();
  const view = useUIStore(s => s.blogListView);
  const sort = useUIStore(s => s.blogListSort);
  const statusFilter = useUIStore(s => s.blogListStatusFilter);
  
  // 本地状态（不持久化）
  const [query, setQuery] = useState('');
  const [frameworkId, setFrameworkId] = useState<ID | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<ID[]>([]);
  
  const filtered = useFilteredBlogs(blogs, {
    query, frameworkId, selectedTagIds, statusFilter, sort,
  });
  
  if (filtered === undefined) return <Skeleton />;
  if (filtered.length === 0 && !hasAnyFilter) {
    return <EmptyState icon={Notebook} title="还没有博客" action={...} />;
  }
  if (filtered.length === 0 && hasAnyFilter) {
    return <EmptyState icon={SearchX} title="没找到匹配的博客" action={...} />;
  }
  
  return (
    <div className="space-y-6">
      <PageHeader count={blogs?.length ?? 0} />
      <BlogListFilters
        query={query} onQueryChange={setQuery}
        frameworkId={frameworkId} onFrameworkChange={setFrameworkId}
        selectedTagIds={selectedTagIds} onTagToggle={...}
        statusFilter={statusFilter} onStatusChange={...}
        onClearFilters={...}
      />
      <BlogListToolbar view={view} onViewChange={...} sort={sort} onSortChange={...} />
      {view === 'grid' ? <BlogGridView blogs={filtered} /> : <BlogListView blogs={filtered} />}
    </div>
  );
}
```

### 3.2 useFilteredBlogs hook

```ts
interface BlogFilters {
  query: string;
  frameworkId: ID | null;
  selectedTagIds: ID[];
  statusFilter: StatusFilter;
}

export function useFilteredBlogs(
  blogs: Blog[] | undefined,
  filters: BlogFilters,
  sort: BlogSortKey,
): Blog[] | undefined {
  // status filter
  const statusFiltered = useMemo(() => {
    if (!blogs) return undefined;
    if (filters.statusFilter === 'all') return blogs;
    return blogs.filter(b => b.status === filters.statusFilter);
  }, [blogs, filters.statusFilter]);

  // framework filter
  const frameworkFiltered = useMemo(() => {
    if (!statusFiltered) return undefined;
    if (!filters.frameworkId) return statusFiltered;
    return statusFiltered.filter(b => b.frameworkId === filters.frameworkId);
  }, [statusFiltered, filters.frameworkId]);

  // tag filter (OR)
  const tagFiltered = useMemo(() => {
    if (!frameworkFiltered) return undefined;
    if (filters.selectedTagIds.length === 0) return frameworkFiltered;
    return frameworkFiltered.filter(b => 
      b.tagIds.some(t => filters.selectedTagIds.includes(t))
    );
  }, [frameworkFiltered, filters.selectedTagIds]);

  // search filter
  const searched = useMemo(() => {
    if (!tagFiltered) return undefined;
    const needle = filters.query.trim().toLowerCase();
    if (!needle) return tagFiltered;
    return tagFiltered.filter(b => {
      if (b.title.toLowerCase().includes(needle)) return true;
      if (b.excerpt.toLowerCase().includes(needle)) return true;
      if (b.tagIds.some(t => t.toLowerCase().includes(needle))) return true;
      return false;
    });
  }, [tagFiltered, filters.query]);

  // sort
  const sorted = useMemo(() => {
    if (!searched) return undefined;
    return sortBlogs(searched, sort);
  }, [searched, sort]);

  return sorted;
}
```

### 3.3 BlogCard

```tsx
interface Props {
  blog: Blog;
  density?: 'grid' | 'list';
  frameworkName?: string;
}

function BlogCardBase({ blog, density = 'grid', frameworkName }: Props) {
  // 视觉如 §2.6
  // onClick → navigate(`/blogs/${blog.id}`)
}
```

### 3.4 BlogListFilters

```tsx
interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  frameworkId: ID | null;
  onFrameworkChange: (id: ID | null) => void;
  selectedTagIds: ID[];
  onTagToggle: (id: ID) => void;
  statusFilter: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
  onClearFilters: () => void;
}
```

- 搜索框 + 框架下拉 + 标签 chips + 状态 tabs + 清除按钮
- 标签 chips：横排滚动；激活态 brand-900 背景白字
- 状态 tabs：4 段（全部 / 草稿 / 已发布 / 已归档）

### 3.5 BlogListToolbar

```tsx
interface Props {
  view: 'grid' | 'list';
  onViewChange: (v: 'grid' | 'list') => void;
  sort: BlogSortKey;
  onSortChange: (s: BlogSortKey) => void;
}
```

- 视图切换器（2 段）+ 排序下拉 + 「写新博客」按钮（右端）
- 排序下拉用 `<select>` 简版（3 选项够用）；v1.1 可换下拉菜单

### 3.6 BlogDetail 改造

增量添加：
- 字数统计：用 `countText(blog.content)` 工具
- 创建/更新时间：用 `formatChineseDate` + 相对时间
- 来源计划：用 `usePlan(blog.sourcePlanId)` 订阅；存在时显跳转链接
- 删除按钮：handleDelete 用 `window.confirm` + `useBlogStore.deleteBlog` + `navigate('/blogs')`

---

## 4. 集成方案

### 4.1 文件清单（新增）

```
src/
└── features/blog/
    ├── components/
    │   ├── BlogCard.tsx              # 列表卡片
    │   ├── BlogListFilters.tsx       # 筛选条
    │   ├── BlogListToolbar.tsx       # 工具栏（视图 + 排序 + 新建）
    │   └── BlogGridView.tsx          # 网格视图容器（可选；或 inline）
    ├── hooks/
    │   └── useFilteredBlogs.ts       # 筛选 + 排序组合
    └── utils/
        └── sortBlogs.ts              # sort-engine preset
```

### 4.2 修改文件

- `src/pages/blogs/BlogList.tsx`：替换 PlaceholderPage 为真实实现
- `src/pages/blogs/BlogDetail.tsx`：扩展元数据 + 字数 + 时间 + 删除
- `src/stores/uiStore.ts`：增 `blogListView` / `blogListSort` / `blogListStatusFilter` + actions + persist
- `src/stores/index.ts`：导出 `BlogSortKey` / `StatusFilter` 类型
- `src/App.tsx`：**不**改（BlogList / BlogDetail 路由已注册）

### 4.3 依赖列表

- **不引新依赖**：用现有 lucide-react / Tailwind / zustand / dexie / react-router
- `useBlogs` / `useBlog` / `useBlogStore.deleteBlog` / `useFrameworks` / `useTags` 已有
- `countText` / `extractPlainText` / `formatChineseDate` 已有

---

## 5. 边界与测试场景

### 5.1 列表筛选边界

```ts
// 0 blog
useFilteredBlogs([], filters, sort) === []
// 单 blog
useFilteredBlogs([b], filters, sort) === [b]
// 搜索命中 title
useFilteredBlogs([b1, b2], { query: '复盘' }, 'created-desc').length === 1
// 标签 OR 命中
useFilteredBlogs([b_tag1, b_tag2], { selectedTagIds: ['t1'] }, 'created-desc').length === 1
// 状态过滤
useFilteredBlogs([b_draft, b_pub], { statusFilter: 'draft' }, 'created-desc').length === 1
// 排序：created-desc
sortBlogs([b1, b2], 'created-desc') // b2 排前（updatedAt 更新）
```

### 5.2 详情页元数据边界

```ts
// 无 sourcePlanId：来源计划区块不渲染
<BlogDetail blog={b_no_plan} /> // 不显示「来源：」
// 无 tagIds：标签区块不渲染
<BlogDetail blog={b_no_tags} />
// 字数 0：显「0 字」+ 不报错
countText({ type: 'doc', content: [] }).chars === 0
```

### 5.3 删除流程边界

```ts
// 确认取消：UI 不变
window.confirm = () => false; handleDelete() // 不调 deleteBlog
// 确认 + 成功：跳回 /blogs
window.confirm = () => true; await handleDelete() // navigate('/blogs')
// 确认 + 失败：toast 错误
await handleDelete() // catch → toast.error('删除失败')
```

### 5.4 持久化边界

```ts
// 切换视图 → 刷新 → 视图保留
useUIStore.getState().setBlogListView('list');
localStorage.getItem('planote-ui').blogListView === 'list'
// 切换排序 → 刷新 → 排序保留
useUIStore.getState().setBlogListSort('title-asc');
localStorage.getItem('planote-ui').blogListSort === 'title-asc'
```

---

## 6. 不在本 change 范围

- 博客分页
- 批量操作
- 拖拽排序
- 标签 CRUD
- 全文检索
- 博客新建流程
- 封面图 UI
- Markdown / PDF 导出
- 单测
- 国际化（v1.0 中文为主）
- 移动端专属布局
- 删除时级联清理附件（孤儿数据保留）
- 完整 useConfirmDialog（v1.0 window.confirm 够用）
- 深链分享（URL query 持久化，v1.1）
