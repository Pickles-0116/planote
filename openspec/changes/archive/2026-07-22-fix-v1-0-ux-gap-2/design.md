# Design · fix-v1-0-ux-gap-2

## 1. 改动总览

2 项小修 + 1 个新增调试组件。3 个文件。净增加 ~80 行。

| 文件 | 改动类型 | 行数变化 |
|------|---------|---------|
| `src/components/layout/Sidebar.tsx` | 删 badge 字段 | -1 行 |
| `src/pages/settings/Settings.tsx` | 末尾 import + 渲染 DataInspector | +3 行 |
| `src/features/settings/components/DataInspector.tsx` | **新增** | +80 行 |

## 2. 改动详情

### 2.1 Sidebar.tsx 删 badge

```diff
 const PRIMARY_NAV: NavItem[] = [
   { to: '/', label: '仪表盘', icon: <LayoutDashboard size={16} />, end: true },
-  { to: '/plans', label: '计划', icon: <Target size={16} />, badge: '100' },
+  { to: '/plans', label: '计划', icon: <Target size={16} /> },
   { to: '/blogs', label: '博客', icon: <Newspaper size={16} /> },
   { to: '/kanban', label: '看板', icon: <Kanban size={16} /> },
 ];
```

`badge` 字段在 NavItem interface 中保留（其他场景可能用），仅删这一处实例。

### 2.2 新增 DataInspector 组件

**位置**：`src/features/settings/components/DataInspector.tsx`

**功能**：
- 读 Dexie 7 张表当前行数（useLiveQuery 实时订阅）
- 展示 6 张业务表 + 1 张 meta 表的 count
- 文字说明「数据存于浏览器 IndexedDB（数据库名 planote），不会因 dev server / 浏览器重启清空」

**视觉**：放在设置页底部，简洁卡片样式（与现有 settings 区块统一）

**实现要点**：
```tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';

export default function DataInspector() {
  const counts = useLiveQuery(async () => ({
    plans: await db.plans.count(),
    items: await db.items.count(),
    blogs: await db.blogs.count(),
    tags: await db.tags.count(),
    attachments: await db.attachments.count(),
    frameworks: await db.frameworks.count(),
    meta: await db.meta.count(),
  }), []);

  if (!counts) return <Skeleton className="h-32" />;

  return (
    <Card>
      <h3>数据状态</h3>
      <p>数据存于浏览器 IndexedDB（数据库名 planote），dev server / 浏览器重启不会清空。</p>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(counts).map(([table, count]) => (
          <div key={table}>
            <div>{table}</div>
            <div>{count}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

### 2.3 Settings.tsx 末尾添加

在 `</div>` 闭合前 import + 渲染 DataInspector。

## 3. 验证清单

1. `pnpm build` → 0 error
2. `pnpm lint` → 0 warning
3. `cmd /c openspec.cmd validate fix-v1-0-ux-gap-2 --strict` → valid
4. 浏览器：Sidebar「计划」无 100 徽章
5. 浏览器：`/settings` 末尾显示「数据状态」区块 + 7 张表 count

## 4. 风险

- 风险等级：极低
- DataInspector 是只读组件，不动数据
- 不影响其他页面
