# Design · 设置中心 + 应用外壳（Settings & Shell）

> 本文档回答**「主题如何切（class toggle vs CSS variable）、数据如何导入导出（Dexie schema + JSON）、dark mode 全站适配范围、FOUC 防御、Settings 4 区块布局、二次确认实现」**。
> 不重复 `architecture.md` 已有的 Repository / persist 模式，仅补充本 change 的具体决策。

---

## 1. 选型复述

| 决策 | 选择 | 排除项 | 原因 |
|------|------|--------|------|
| 主题切换实现 | Tailwind `darkMode: 'class'` + `documentElement.classList` | CSS 变量 / styled-components | v1.0 Tailwind 已用；class 切换零运行时；v1.1 评估 CSS 变量（多主题） |
| 主题持久化 | `useUIStore.theme` + persist（已落地） | 独立 store | 复用现有 store；localStorage key `planote-ui` |
| 系统主题监听 | `window.matchMedia('(prefers-color-scheme: dark)')` | 第三方 hook | 浏览器原生 API；零依赖；v1.0 简单 |
| 主题切换动效 | 直接切换（无过渡） | View Transitions API / Framer Motion | v1.0 简版；切主题是低频操作 |
| 数据导出格式 | JSON（version + 6 张表） | CSV / SQLite | JSON 含嵌套结构（attachment blob base64）；CSV 难表达；v1.1 评估 SQLite dump |
| 数据导入模式 | merge（bulkPut）/ replace（清空+bulkPut） | 单模式 | 两种场景都常见：merge = 跨设备同步；replace = 测试 / 重置 |
| 清除确认 | 弹窗 + 输入「确认清除」 | 单确认 / 三次点击 | 不可逆操作；输入匹配是"显式"反例；与 prototype 一致 |
| 4 区块导航 | 左侧导航 + 右侧内容 | Tab | 4 项 + 后续可能扩（标签 / 快捷键 / 字体等）；侧边导航更可扩展 |
| dark mode 适配范围 | 全站 9 页面 + 共享组件 | 仅 Settings / 看板 | dark mode 是全应用特性，非单页面；AC-3 强制全站 |
| FOUC 防御 | main.tsx 同步 inline init | useEffect 异步 | useEffect 在首帧后才执行，必有闪屏；inline init 在 React 渲染前 |

---

## 2. 关键架构决策

### 2.1 主题系统架构

```
useUIStore.theme: 'system' | 'light' | 'dark'  ← 期望主题（持久化）
       ↓
useTheme()  ← hook：解析 + 应用
  ├─ matchMedia('(prefers-color-scheme: dark)')
  ├─ resolvedTheme: 'light' | 'dark'  ← 实际生效
  └─ documentElement.classList.toggle('dark', resolvedTheme === 'dark')
       ↓
Tailwind v3 darkMode: 'class'  ← 全站 dark:* 变体生效
```

**为什么 theme 字段语义改为 `system | light | dark`（v1.0 简版）**：
- 原字段 `theme: 'light' | 'dark' | 'eye-care'`（v1.0 占位，无 UI）
- 升级为 `'system | 'light' | 'dark'`：system 是用户最常用（不显设置就跟系统）
- eye-care 字段废弃：v1.0 暂不实现（如有旧值迁移为 light，v1.1 移除）
- 迁移逻辑：useUIStore persist version 升级 1 → 2，`migrate` 函数处理

**为什么 class toggle 而非 CSS 变量**：
- Tailwind v3 dark mode 两种模式：`media`（自动跟系统）/ `class`（手动控制）
- 选 `class`：`system` 选项需要手动控制；且 `class` 模式可与未来 CSS 变量共存
- 性能：class toggle 一次性，全站 dark:* 类重算 < 5ms

**resolvedTheme 计算**：

```ts
function useTheme() {
  const theme = useUIStore((s) => s.theme);
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolvedTheme: 'light' | 'dark' = useMemo(() => {
    if (theme === 'system') return systemDark ? 'dark' : 'light';
    return theme;
  }, [theme, systemDark]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  return { theme, resolvedTheme, setTheme: useUIStore((s) => s.setTheme) };
}
```

### 2.2 数据导入 / 导出

```
exportData():
  db.tables.forEach(async t => { data[t.name] = await t.toArray() })
  ↓
  { version: 1, exportedAt: ISO, plans, items, blogs, frameworks, tags, attachments }
  ↓
  JSON.stringify → Blob('application/json') → URL.createObjectURL → a[download]
```

**JSON schema**（向下兼容 v1.0+）：

```json
{
  "version": 1,
  "exportedAt": "2026-07-19T10:00:00Z",
  "plans": [...],
  "items": [...],
  "blogs": [...],
  "frameworks": [...],
  "tags": [...],
  "attachments": [
    { "id": "att_1", "blogId": "blog_1", "filename": "hero.png", "mimeType": "image/png", "size": 12345, "blob": "data:image/png;base64,...", "width": 800, "height": 600, "uploadedAt": "..." }
  ]
}
```

**blob 处理**：
- IndexedDB 原生 `Blob` 对象在 toArray 后是 `Blob` 实例
- `JSON.stringify(blob)` 不可行（Blob 不是 plain object）
- 导出时手动转 base64：`FileReader.readAsDataURL(blob)` → `data:url`
- 导入时手动还原：`fetch(dataUrl).then(r => r.blob())` → 写入 Dexie
- 性能：1MB 图片 base64 → ~1.3MB JSON；100 张图预计 50MB JSON（v1.0 用户量足够）

**导入模式**：

```ts
async function importData(file: File, mode: 'merge' | 'replace') {
  const text = await file.text();
  const data = JSON.parse(text);

  // 1. schema 校验
  if (data.version !== 1) throw new Error('版本不匹配');
  for (const table of ['plans', 'items', 'blogs', 'frameworks', 'tags', 'attachments']) {
    if (!Array.isArray(data[table])) throw new Error(`缺少 ${table} 表`);
  }

  // 2. blob 还原
  const attachments = await Promise.all(
    data.attachments.map(async (a) => ({
      ...a,
      blob: await (await fetch(a.blob)).blob(),
    })),
  );

  // 3. 写入
  await db.transaction('rw', db.tables, async () => {
    if (mode === 'replace') {
      for (const t of db.tables) await t.clear();
    }
    await db.plans.bulkPut(data.plans);
    await db.items.bulkPut(data.items);
    await db.blogs.bulkPut(data.blogs);
    await db.frameworks.bulkPut(data.frameworks);
    await db.tags.bulkPut(data.tags);
    await db.attachments.bulkPut(attachments);
  });
}
```

**边界**：
- 版本不匹配 → toast「导出文件版本不匹配」
- 字段缺失 → toast「导出文件格式错误」
- 文件过大（> 50MB）→ toast「文件过大，请检查附件」
- 解析失败 → toast「JSON 解析失败」

### 2.3 清除数据（双层确认）

```tsx
function ClearDataConfirm({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  return (
    <>
      <button onClick={() => setOpen(true)} className="danger">清除全部数据</button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <h2>确认清除？</h2>
        <p>将删除全部 N 条计划 / 事项 / 博客 / 附件。此操作不可逆。</p>
        <input
          placeholder="输入「确认清除」以启用按钮"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          disabled={text !== '确认清除'}
          onClick={() => { onConfirm(); setOpen(false); }}
        >
          我已了解风险，清除
        </button>
      </Dialog>
    </>
  );
}
```

**为什么需要输入「确认清除」**：
- 防止误点（v1.0 删除不可逆；与 v1.1 服务端备份前最大保护）
- 比「再次点击确认」更显式（要求用户读 + 输入）
- 与 prototype `settings.html` 视觉一致

**清除后**：
- 调 `db.transaction('rw', db.tables, ...)` + 每个表 `clear()`
- 调 `navigate('/')` 跳 Dashboard
- 不刷新（liveQuery 自动清空；store state 需重置——v1.0 简化：刷新页面）

### 2.4 Settings 4 区块布局

```
┌────────────────────────────────────────────────┐
│  Settings · 设置                                │
├──────────┬─────────────────────────────────────┤
│ 主题     │  [主题内容]                          │
│ 数据     │                                      │
│ 关于     │                                      │
│ 反馈     │                                      │
│ (占位)  │                                      │
└──────────┴─────────────────────────────────────┘
```

**实现**：
- `Settings.tsx`：`flex` + 左侧 240px + 右侧 `flex-1`
- 4 个区块各自独立组件（`ThemeSettings` / `DataSettings` / `AboutSettings` / `FeedbackSettings`）
- 区块切换：useState `activeKey` + 条件渲染（不依赖 URL hash，简化 v1.0；v1.1 评估 hash 深链）

**为什么不走 URL hash**：
- 4 区块 + 用户量小；深链分享价值低
- 简化：useState 已够用；不污染 history
- v1.1 评估：用户请求深链时再加 hash 路由

### 2.5 dark mode 全站适配策略

**目标**：全站 dark 模式下，背景 / 文字 / 边框 / 阴影都有合理颜色

**适配规则**：

| 元素 | light | dark |
|------|-------|------|
| 主背景 | `bg-stone-50` | `dark:bg-stone-900` |
| 卡片背景 | `bg-white` | `dark:bg-stone-800` |
| 次级背景 | `bg-stone-100` | `dark:bg-stone-700` |
| 主文字 | `text-brand-900` | `dark:text-stone-100` |
| 次文字 | `text-brand-700` | `dark:text-stone-300` |
| 弱文字 | `text-brand-500` | `dark:text-stone-500` |
| 边框 | `border-stone-200` | `dark:border-stone-700` |
| hover 边 | `border-stone-300` | `dark:border-stone-600` |

**特殊组件**：
- `Sidebar`：整体背景 dark:bg-stone-800；NavLink active 态 dark:bg-stone-700
- `Header`：dark:bg-stone-800 + 搜索框 dark:bg-stone-700
- `Drawer`：dark:bg-stone-800
- 表格 / 卡片：bg-white dark:bg-stone-800
- 紧急度 chip：保持原色（红/橙/黄/绿），dark 模式仅加 dark:bg-* 暗背景
- `EmptyState`：dark:bg-stone-800 + dark:text-stone-*

**跳过**：
- Lucide icon 默认颜色：`currentColor` 自动适配
- Tag chip（`bg-amber-100` 等）：保留原色（彩色识别度高）
- Status badge（`bg-emerald-50` 等）：保留原色（语义化）

**实施分 5 段**：
1. AppLayout / Sidebar / Header（顶层）
2. 9 页面（Dashboard / PlanList / PlanDetail / PlanEdit / BlogList / BlogDetail / BlogEdit / Kanban / Settings）
3. 共享组件（Card / EmptyState / Skeleton / Stepper / Drawer / Toast / ProgressRing）
4. 业务组件（PlanCard / ItemRow / ItemChecklist / KanbanCard / KanbanColumn / FrameworkCard / BlogCard 等）
5. review：扫漏 + 边界组件（Modal / Tooltip / DatePicker 等）

### 2.6 FOUC 防御

**问题**：刷新页面时，HTML 先以 light 模式渲染（默认），useEffect 后才应用 dark class → 闪屏

**方案**：

```ts
// src/main.tsx
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';

// 1. 同步读 localStorage
const stored = localStorage.getItem('planote-ui');
let initialTheme: 'light' | 'dark' | 'system' = 'light';
if (stored) {
  try {
    const parsed = JSON.parse(stored);
    initialTheme = parsed.state?.theme ?? 'light';
  } catch {
    /* ignore */
  }
}

// 2. 解析 system
const resolvedDark =
  initialTheme === 'dark' ||
  (initialTheme === 'system' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches);

// 3. 同步应用（在 React 渲染前）
document.documentElement.classList.toggle('dark', resolvedDark);

// 4. 渲染 React
createRoot(document.getElementById('root')!).render(<App />);
```

**为什么放在 main.tsx 而非 useEffect**：
- useEffect 在 React 渲染后执行，必有闪屏
- main.tsx 同步代码在 createRoot 之前 → 无闪屏
- 性能：localStorage 读取 < 1ms

### 2.7 NavBar 主题显示

- 位置：Header 右上角「设置」入口旁
- 显示：当前 resolvedTheme（icon + 简短文本）
  - 浅色：☀️ 浅色
  - 深色：🌙 深色
  - 系统：自动
- 交互：点击下拉 3 选项（系统 / 浅色 / 深色）
- v1.0 简化：直接显示 + 点击跳 `/settings#theme`

---

## 3. 组件详细设计

### 3.1 Settings 页

```tsx
type SettingsKey = 'theme' | 'data' | 'about' | 'feedback';

const NAV_ITEMS: { key: SettingsKey; label: string; icon: LucideIcon }[] = [
  { key: 'theme', label: '主题', icon: Palette },
  { key: 'data', label: '数据', icon: Database },
  { key: 'about', label: '关于', icon: Info },
  { key: 'feedback', label: '反馈', icon: MessageCircle },
];

export default function Settings() {
  const [activeKey, setActiveKey] = useState<SettingsKey>('theme');
  return (
    <div className="flex gap-6 max-w-5xl mx-auto">
      <nav className="w-60 flex-shrink-0">
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            onClick={() => setActiveKey(item.key)}
            className={cn('w-full text-left px-4 py-3 rounded-xl flex items-center gap-3',
              activeKey === item.key ? 'bg-brand-900 text-white' : 'hover:bg-stone-100 dark:hover:bg-stone-800')}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="flex-1">
        {activeKey === 'theme' && <ThemeSettings />}
        {activeKey === 'data' && <DataSettings />}
        {activeKey === 'about' && <AboutSettings />}
        {activeKey === 'feedback' && <FeedbackSettings />}
      </div>
    </div>
  );
}
```

### 3.2 ThemeToggle 组件

```tsx
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const OPTIONS = [
    { value: 'system' as const, label: '跟随系统', icon: Monitor },
    { value: 'light' as const, label: '浅色', icon: Sun },
    { value: 'dark' as const, label: '深色', icon: Moon },
  ];
  return (
    <div className="flex gap-2 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={cn('flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm',
            theme === opt.value
              ? 'bg-white dark:bg-stone-700 shadow-sm font-medium'
              : 'text-brand-500 hover:text-brand-900 dark:hover:text-stone-100')}
        >
          <opt.icon size={14} />
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

### 3.3 DataSettings 组件

```tsx
export default function DataSettings() {
  const { exportData, importData, clearAllData } = useDataIO();
  const pushToast = useToastStore((s) => s.push);
  const navigate = useNavigate();

  const handleExport = async () => {
    try {
      await exportData();
      pushToast('success', '已导出 JSON 备份');
    } catch (e) {
      pushToast('error', '导出失败');
    }
  };

  const handleImport = async (file: File, mode: 'merge' | 'replace') => {
    try {
      await importData(file, mode);
      pushToast('success', '导入成功');
    } catch (e) {
      pushToast('error', `导入失败：${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      <Card title="导出数据">
        <p>将所有计划 / 事项 / 博客 / 附件导出为 JSON 文件。</p>
        <button onClick={handleExport}>导出 JSON 备份</button>
      </Card>
      <Card title="导入数据">
        <ImportForm onImport={handleImport} />
      </Card>
      <Card title="清除数据" danger>
        <p>将删除全部数据。此操作不可逆。</p>
        <ClearDataConfirm onConfirm={async () => {
          await clearAllData();
          pushToast('success', '已清除全部数据');
          navigate('/');
        }} />
      </Card>
    </div>
  );
}
```

### 3.4 useDataIO hook

```ts
export function useDataIO() {
  const exportData = useCallback(async () => {
    const data = await dexieExport();  // 纯函数 + 异步
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planote-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const importData = useCallback(async (file: File, mode: 'merge' | 'replace') => {
    return await dexieImport(file, mode);
  }, []);

  const clearAllData = useCallback(async () => {
    await db.transaction('rw', db.tables, async () => {
      for (const t of db.tables) await t.clear();
    });
  }, []);

  return { exportData, importData, clearAllData };
}
```

### 3.5 AboutSettings 组件

```tsx
export default function AboutSettings() {
  return (
    <div className="space-y-6 text-center py-12">
      <div className="w-20 h-20 mx-auto rounded-2xl bg-brand-900 flex items-center justify-center">
        <PenLine className="text-white" size={32} />
      </div>
      <h1 className="text-2xl font-bold">Planote · 栖记</h1>
      <p className="text-sm text-brand-500">v1.0.0 · 2026.07</p>

      <div className="max-w-md mx-auto text-left">
        <h2 className="font-semibold mb-2">致谢</h2>
        <ul className="text-sm text-brand-500 space-y-1">
          <li>· React 18 + TypeScript + Vite</li>
          <li>· Tailwind CSS + Lucide React</li>
          <li>· Dexie + IndexedDB</li>
          <li>· Zustand</li>
          <li>· React Router 6</li>
          <li>· TanStack Table + react-virtuoso</li>
          <li>· Tiptap</li>
        </ul>
      </div>
      <p className="text-xs text-brand-400">© 2026 Planote · 个人项目，仅供学习与个人使用</p>
    </div>
  );
}
```

---

## 4. 集成方案

### 4.1 新增文件清单

```
src/
├── pages/
│   └── settings/
│       ├── Settings.tsx              # 4 区块主入口
│       ├── ThemeSettings.tsx         # 主题设置
│       ├── DataSettings.tsx          # 数据导入/导出/清除
│       ├── AboutSettings.tsx         # 关于
│       └── FeedbackSettings.tsx       # 反馈占位
├── features/
│   └── settings/
│       ├── components/
│       │   └── ThemeToggle.tsx
│       ├── hooks/
│       │   ├── useTheme.ts
│       │   └── useDataIO.ts
│       └── utils/
│           ├── dexieExport.ts         # 纯函数：导出 6 张表
│           ├── dexieImport.ts         # 纯函数：导入 + 校验
│           └── dexieClear.ts          # 纯函数：清空 6 张表
```

### 4.2 修改文件

- `src/pages/Settings.tsx`（删除或 re-export 转向 `pages/settings/Settings.tsx`）
- `src/components/layout/AppLayout.tsx`（dark 适配 + NavBar 主题显示）
- `src/components/layout/Sidebar.tsx`（dark 适配）
- `src/components/layout/Header.tsx`（dark 适配 + 主题入口）
- `src/tailwind.config.ts`（`darkMode: 'class'`）
- `src/main.tsx`（FOUC 防御内联初始化）
- `src/stores/uiStore.ts`（theme 字段语义升级 + migrate）
- 9 个页面 + 共享组件（dark 适配）

### 4.3 依赖列表

- **不引新依赖**：用现有 React / Tailwind / Zustand / Dexie / React Router
- Dexie `db.tables` / `db.transaction` 已有
- `useUIStore` 已有
- Lucide icon（Monitor / Sun / Moon / Palette / Database / Info / MessageCircle）已有

---

## 5. 边界与测试场景

### 5.1 主题切换

```ts
// system 模式 + 浅色系统
useUIStore.theme = 'system'; system = light
→ resolvedTheme = 'light', classList.remove('dark')

// 切换到 dark
setTheme('dark') → resolvedTheme = 'dark', classList.add('dark')

// system 模式 + 系统切换为 dark
matchMedia listener → setSystemDark(true) → resolvedTheme = 'dark', classList.add('dark')
```

### 5.2 数据导出

```ts
// 0 数据
exportData() → JSON { plans: [], items: [], ... }
// 1 plan + 5 item
exportData() → JSON 含完整对象
// 附件
exportData() → attachments[].blob = "data:image/png;base64,..."
```

### 5.3 数据导入

```ts
// merge 模式 + 1 plan 重名
importData(file, 'merge') → bulkPut → 旧 plan 保留 + 新 plan 添加（不同 id）
// replace 模式
importData(file, 'replace') → 清空 + bulkPut → 旧数据全没
// 版本不匹配
importData(file_v2, 'merge') → throw '版本不匹配'
// 字段缺失
importData(broken_file, 'merge') → throw '缺少 items 表'
```

### 5.4 清除数据

```ts
// 第一次点击
打开弹窗 + 输入框 disabled until text = '确认清除'
// 输入「确认清除」
按钮 enabled
// 点击「我已了解风险，清除」
调 clearAllData() + navigate('/') + toast '已清除'
```

### 5.5 dark mode FOUC

```ts
// localStorage 存 theme='dark'
main.tsx init: parsed.state.theme = 'dark' → resolvedDark = true → classList.add('dark')
// createRoot → React 渲染时已 dark 模式
// 无闪屏
```

---

## 6. 不在本 change 范围

- 主题过渡动画
- 主题色板（v1.0 仅 dark / light 二元；v1.1 评估 eye-care 复用 dark 视觉但调色温）
- 字体切换
- 标签管理 UI
- 快捷键设置
- 多语言 i18n
- 服务端备份
- 实时同步
- 移动端专属布局
- 主题扩展 API（用户自定主题）
