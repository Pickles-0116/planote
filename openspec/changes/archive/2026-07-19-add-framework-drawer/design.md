# Design · 博客框架库抽屉

> 本文档回答**「框架库抽屉的视觉/状态/复用边界、tag 筛选/搜索 UX、a11y 简化策略」**。
> 不重复 `architecture.md` §6.5 框架抽屉方案，仅补充本 change 的具体决策。

---

## 1. 选型复述

| 决策 | 选择 | 排除项 | 原因 |
|------|------|--------|------|
| 抽屉壳 | 复用 `src/components/shell/Drawer.tsx` | 自研滑入动画 | 已实现；与 PlanDetail 视觉一致；零新代码 |
| 预置数据 | 独立 `presets.ts`（6-10 个）| 全部走 `useFrameworks()`（Dexie）| Dexie 现仅 4 套；预置扩展需要在应用层做；v1.2 用户自建框架再走 Dexie |
| 状态管理 | `useUIStore` 增 `frameworkDrawerOpen` | 新 store | UI 状态统一归 uiStore；persist 白名单不扩 |
| 搜索/筛选逻辑 | 放 `useFrameworkDrawer` hook（useState） | Zustand 全局 | 抽屉打开期间用一次性；不跨页面共享 |
| a11y | 沿用 Drawer 的 ESC + 标题 focus + 简版 focus trap | 完整 focus trap 库 | v1.0 简化为"首次打开聚焦应用按钮"；v1.1 再加完整 trap |
| 动画 | 沿用 Drawer 内置 `drawerSlideIn 0.3s` | 重新设计 200ms | 跨页面视觉一致 |
| 与 add-blog-tiptap-editor 复用 | 抽屉的「应用」按钮调 `useApplyFramework.apply(editor, framework)` | 在抽屉内直接改 editor | 单一职责：drawer 只管选 framework；apply 走 hook |

---

## 2. 关键架构决策

### 2.1 抽屉壳复用

```tsx
// src/features/framework/components/FrameworkDrawer.tsx
interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (framework: Framework) => void;
}

export default function FrameworkDrawer({ open, onClose, onApply }: Props) {
  const { query, setQuery, selectedTags, toggleTag, filtered, selected } =
    useFrameworkDrawer();
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="选择博客框架"
      description="选一个框架，让写作有结构"
    >
      <SearchBar value={query} onChange={setQuery} />
      <TagFilter tags={ALL_TAGS} selected={selectedTags} onToggle={toggleTag} />
      <FrameworkList items={filtered} selectedId={selected?.id ?? null} onSelect={...} />
      <ApplyBar selected={selected} onApply={() => selected && onApply(selected)} />
    </Drawer>
  );
}
```

**与 PlanDetail 侧 FrameworkDrawer 关系**：
- v1.0 两者并存：PlanDetail 侧保留「生成博客用」抽屉，BlogEdit 侧新抽屉是「编辑已存在博客时切换框架」入口
- 命名上做区分：PlanDetail 侧叫 `FrameworkGenerationDrawer`，BlogEdit 侧叫 `FrameworkDrawer`（本文档对象）
- v1.1 再合并：让 PlanDetail 侧也调 BlogEdit 侧的新抽屉（统一入口）

### 2.2 状态机（uiStore + hook）

```ts
// src/stores/uiStore.ts 新增
frameworkDrawerOpen: boolean;
frameworkDrawerInitialFrameworkId: ID | null;
openFrameworkDrawer: (initialFrameworkId?: ID) => void;
closeFrameworkDrawer: () => void;

// persist 白名单保持原样（不持久化 frameworkDrawerOpen）
```

```ts
// src/features/framework/hooks/useFrameworkDrawer.ts
interface UseFrameworkDrawerResult {
  query: string;
  setQuery: (q: string) => void;
  selectedTags: string[];   // OR 关系
  toggleTag: (tag: string) => void;
  filtered: PresetFramework[];  // 应用 query + tag 后的列表
  selected: PresetFramework | null;
  selectFramework: (id: ID | null) => void;
}
```

**为什么不直接放 store**：
- query / selectedTags / selected 三个 UI 临时态在抽屉关闭后无意义
- 用 useState 在组件内管；uiStore 只管 open 开关（跨页面需读）
- 性能：6-10 条数据过滤 useMemo 一次 < 0.1ms

### 2.3 预置数据 schema

```ts
// src/features/framework/data/presets.ts
export interface PresetFramework {
  id: ID;
  name: string;
  description: string;
  /** Lucide icon name */
  icon: string;
  /** 框架分类（与现有 FrameworkCategory 兼容）*/
  category: 'review' | 'note' | 'summary' | 'habit' | 'decision' | 'analysis';
  /** 标签 chips（多对多，搜索时也匹配）*/
  tags: string[];
  sections: PresetSection[];
}

export interface PresetSection {
  heading: string;
  guide: string;
  placeholder: string;
}

export const FRAMEWORK_PRESETS: PresetFramework[] = [
  { id: 'fw_weekly_review', name: '周复盘', ... },
  { id: 'fw_project_review', name: '项目复盘', ... },
  { id: 'fw_reading_note', name: '读书笔记', ... },
  { id: 'fw_okr', name: 'OKR', ... },
  { id: 'fw_monthly_goal', name: '月度目标', ... },
  { id: 'fw_habit_21day', name: '21 天习惯', ... },
  { id: 'fw_decision_log', name: '决策日志', ... },
  { id: 'fw_learning_note', name: '学习笔记', ... },
  { id: 'fw_problem_analysis', name: '问题分析', ... },
  { id: 'fw_retrospective', name: '回顾模板', ... },
];
```

**为什么不复用 Dexie 的 4 套内置**：
- Dexie 4 套是给"从计划生成博客"用（`frameworkRepo.apply` 注入计划字段）
- 本抽屉是给"编辑时选框架起手/切换"用，**独立**于 sourcePlanId
- 6-10 个里部分与 Dexie 重叠（如"项目复盘"），v1.0 允许 overlap；v1.2 用户自建框架时统一为单一来源

### 2.4 过滤算法

```ts
const filtered = useMemo(() => {
  return FRAMEWORK_PRESETS.filter((fw) => {
    // 1. tag 过滤（OR：任一选中 tag 命中即通过）
    if (selectedTags.length > 0) {
      const hit = selectedTags.some((t) => fw.tags.includes(t));
      if (!hit) return false;
    }
    // 2. query 过滤（不区分大小写，按 name / section.heading / description 任一匹配）
    if (query.trim() !== '') {
      const needle = query.toLowerCase();
      const inName = fw.name.toLowerCase().includes(needle);
      const inDesc = fw.description.toLowerCase().includes(needle);
      const inSections = fw.sections.some((s) => s.heading.toLowerCase().includes(needle));
      if (!inName && !inDesc && !inSections) return false;
    }
    return true;
  });
}, [query, selectedTags]);
```

**为什么不实现模糊搜索**：
- 6-10 条 `String.includes` 已够用（O(n×m)，n=10，m=平均 30 字符）
- 未来扩到 100+ 时再接 `fuse.js` 或 `match-sorter`

### 2.5 视觉规范

- **Drawer 宽度**：默认 480px（与现有 Drawer 一致）
- **头部**：与 Drawer 内置头部一致
- **搜索框**：高 36px，rounded-xl，左侧 `<Search>` icon
- **Tag chips**：每 chip 12px 文本 + 1.5px padding，激活态 brand-900 背景白字，未激活 bg-stone-100
- **FrameworkCard**：
  - 宽 100%，padding 16px，rounded-xl
  - 选中态：border-2 border-accent-300 + bg-accent-50/30 + 右侧 `<Check>` 标志
  - 章节预览：每条带 bullet，截前 5 条
- **ApplyBar**：底部固定（sticky bottom），全宽 brand-900 按钮
- **动画**：沿用 Drawer 自带 `drawerSlideIn 0.3s ease-out`

### 2.6 a11y

- `<Drawer>` 已提供 `role="dialog" aria-modal="true" aria-labelledby="drawer-title"`
- 搜索框 `<input aria-label="搜索框架" />`
- Tag chips `<button role="switch" aria-checked={active} />`
- 框架卡片 `<button aria-pressed={isSelected} />`
- ApplyBar 按钮 `<button type="button">应用「{selected.name}」</button>`
- 简版 focus trap：useEffect 在 open 时聚焦 ApplyBar 按钮
- Esc 关闭（Drawer 已实现）
- Tab 顺序：搜索框 → tag chips → 卡片 → 应用按钮

### 2.7 集成：与 add-blog-tiptap-editor 协作

```tsx
// src/pages/blogs/BlogEdit.tsx
import { useUIStore } from '@/stores';
import FrameworkDrawerHost from '@/features/framework/components/FrameworkDrawerHost';

export default function BlogEdit() {
  const openFrameworkDrawer = useUIStore((s) => s.openFrameworkDrawer);
  // ... 已有 editor / framework state
  const { apply: applyFramework, isApplied } = useApplyFramework(editor, framework);

  const handleApplyFromDrawer = useCallback((fw: PresetFramework) => {
    setFrameworkId(fw.id);
    // 触发 effect：用 frameworkId 变化重新 apply
    // 详细：见 implementation tasks
  }, []);

  return (
    <>
      {/* 工具栏的「应用框架」按钮改为触发抽屉 */}
      <EditorToolbar
        ...
        onApplyFramework={openFrameworkDrawer}  // 工具栏按钮直接调 open
        frameworkApplied={isApplied}
      />
      <FrameworkDrawerHost onApply={handleApplyFromDrawer} />
    </>
  );
}
```

**关键问题**：「应用框架」按钮在 toolbar 中——点击它应该打开抽屉（让人选），还是直接应用（如果已选）？  
**v1.0 决策**：
- 工具栏「应用框架」按钮 → 总是打开抽屉（统一入口）
- 抽屉「应用《xxx》」CTA → 关闭抽屉 + 实际注入章节
- 这样可以避免「按钮是切换应用还是打开抽屉」的认知负担

### 2.8 抽屉内 Apply 流程

```ts
// FrameworkDrawerHost
const FrameworkDrawerHost = ({ onApply }: { onApply: (fw: PresetFramework) => void }) => {
  const open = useUIStore((s) => s.frameworkDrawerOpen);
  const close = useUIStore((s) => s.closeFrameworkDrawer);
  return (
    <FrameworkDrawer
      open={open}
      onClose={close}
      onApply={(fw) => {
        onApply(fw);
        close();
      }}
    />
  );
};
```

```ts
// BlogEdit.handleApplyFromDrawer
const handleApplyFromDrawer = useCallback((fw: PresetFramework) => {
  setFrameworkId(fw.id);  // 1) 同步 select 状态
  // 2) 把 preset 转 Tiptap doc：直接走 useApplyFramework.apply
  //   但 useApplyFramework 拿的是 Dexie Framework 类型
  //   → 方案：抽屉内 onApply 时同步 Dexie（preset.id 与 Dexie 兼容）OR 在 BlogEdit 内构造临时 Framework 对象
  //   v1.0 选方案 B：构造临时 Framework 对象（保持 preset 与 Dexie 隔离）
}, [setFrameworkId, editor, framework]);
```

**关键技术决策**：preset 不写入 Dexie；通过构造临时 `Framework` 对象传给 `useApplyFramework.apply()`。

```ts
// 临时 Framework 构造
const tempFramework: Framework = {
  id: fw.id,
  name: fw.name,
  description: fw.description,
  category: fw.category,
  icon: fw.icon,
  sections: fw.sections,
  useCount: 0,
  builtin: true,
};
```

---

## 3. 组件详细设计

### 3.1 FrameworkDrawer

```ts
interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (framework: PresetFramework) => void;
}

// 内部结构
<div>
  <SearchBar />
  <TagFilter />
  <FrameworkList />
  <ApplyBar />
</div>
```

- 搜索框：input + 清除按钮
- Tag 列表：从所有 preset.tags 去重得到
- ApplyBar：sticky 底部，禁用态当未选

### 3.2 FrameworkList

```ts
interface Props {
  items: PresetFramework[];
  selectedId: ID | null;
  onSelect: (id: ID) => void;
}
```

- 渲染空态：「没有匹配的框架」+ 清除筛选按钮
- 滚动条：max-height: calc(100vh - 280px)

### 3.3 FrameworkCard

```ts
interface Props {
  framework: PresetFramework;
  isSelected: boolean;
  onClick: () => void;
}
```

- 内部：icon + name + description + 章节预览（max 5 条）+ tag chips
- a11y：`role="button" aria-pressed`

### 3.4 SearchBar

```ts
interface Props {
  value: string;
  onChange: (v: string) => void;
}
```

- input + `<Search>` icon + 清除按钮（value 非空时显）

### 3.5 TagFilter

```ts
interface Props {
  tags: string[];
  selected: string[];
  onToggle: (tag: string) => void;
}
```

- chip 列表：横向 scroll，激活态 brand-900

### 3.6 ApplyBar

```ts
interface Props {
  selected: PresetFramework | null;
  onApply: () => void;
}
```

- 禁用态：未选时显「请先选择一个框架」
- 启用态：显「应用《{name}」」

---

## 4. 集成方案

### 4.1 文件清单（新增）

```
src/
├── features/framework/
│   ├── components/
│   │   ├── FrameworkDrawer.tsx          # 抽屉壳（无状态）
│   │   ├── FrameworkDrawerHost.tsx      # 顶层挂载（订阅 uiStore）
│   │   ├── FrameworkList.tsx            # 列表
│   │   ├── FrameworkCard.tsx            # 单卡片
│   │   ├── SearchBar.tsx                # 搜索框
│   │   ├── TagFilter.tsx                # tag 筛选
│   │   └── ApplyBar.tsx                 # 底部 CTA
│   ├── hooks/
│   │   └── useFrameworkDrawer.ts        # 状态机 + 过滤
│   └── data/
│       └── presets.ts                   # 6-10 个预置框架
└── stores/
    └── useFrameworkStore.ts             # （可选）preset 索引；v1.0 不引
```

### 4.2 修改文件

- `src/stores/uiStore.ts`：增 `frameworkDrawerOpen` + `frameworkDrawerInitialFrameworkId` + 2 个 action
- `src/pages/blogs/BlogEdit.tsx`：工具栏按钮 onApplyFramework → openFrameworkDrawer；mount `<FrameworkDrawerHost />`
- `src/App.tsx`：**不**改（FrameworkDrawerHost 局部挂载到 BlogEdit）
- `src/components/shell/Drawer.tsx`：**不**改（API 兼容）

### 4.3 依赖列表

- **不引新依赖**：用现有 Drawer / Lucide / Tailwind
- 现有 `lucide-react` 已含 `Search` / `X` / `Check` 等 icon

---

## 5. 边界与测试场景

### 5.1 抽屉交互

- 打开：工具栏「应用框架」点击 → open=true → 滑入 0.3s
- 关闭：Esc / 背景点击 / 关闭按钮 → open=false → 滑出
- 搜索：输入"复盘" → 过滤保留含"复盘"的预设
- Tag 筛选：点 chip「学习」→ 列表仅显含"学习" tag 的预设
- 选中：点卡片 → 卡片高亮 + ApplyBar 启用
- 应用：点 ApplyBar → 调 onApply + 关闭抽屉

### 5.2 与 editor 集成

- 抽屉应用后：BlogEdit 的 frameworkId 状态更新
- 触发 useApplyFramework 的 useMemo 重算 isApplied
- 工具栏「应用框架」按钮显对勾
- 重新打开抽屉：search / selectedTags 保留（v1.0 简化，不清空）

### 5.3 边界

- 空 preset 列表（不应发生，预设写死 10 个）
- 搜索无结果：显「没有匹配的框架」+「清除筛选」按钮
- 全部 tag 取消：等价于无 tag 过滤
- 重复点同一框架：幂等（`useApplyFramework.apply` 已实现）

### 5.4 跨页面干扰

- 抽屉关闭后 state 重置？**v1.0 简化：抽屉重新打开保留 query / selectedTags / selected**（用户连续多次应用相同筛选）
- PlanDetail 侧 framework-drawer 互不干扰（独立 store 字段）

---

## 6. 不在本 change 范围

- 框架 CRUD UI
- 用户自定义框架
- 框架版本管理
- 完整 focus trap
- 抽屉嵌套抽屉
- 单测（v1.0 暂不写）
- 移动端适配（桌面优先）
- 抽屉动效重新设计（沿用 Drawer 内置 0.3s）
