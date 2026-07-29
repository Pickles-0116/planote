# Design · fix-item-crud-and-batch-import

## item-crud 设计

### useItemCRUD hook

新建 `src/features/plan/hooks/useItemCRUD.ts`，统一封装事项的增删改查：

```ts
export interface UseItemCRUD {
  add: (init?: Partial<DraftItem>) => Promise<Item>;
  update: (itemId: ID, patch: Partial<Item>) => Promise<void>;
  remove: (itemId: ID) => Promise<void>;
  setStatus: (itemId: ID, status: ItemStatus) => Promise<void>;
  toggle: (itemId: ID) => Promise<void>;
  reorder: (itemIds: ID[]) => Promise<void>;
}
```

内部包 Dexie transaction，失败抛 Error。所有写操作完成后调 `planRepo.recomputeProgress(planId)`。

### ItemChecklist 改造

- 「+ 添加事项」按钮 enabled
- 点击展开 inline input（autoFocus + 提交后保留焦点）
- 回车 = 提交，ESC = 收起
- ItemRow 接收 onUpdate / onRemove 回调
- 列表行删除按钮始终显示（不再 hover-only）
- 双击标题进入 inline 编辑

### PlanEdit edit 模式预填

`PlanEdit.tsx` 加载已有 plan 时，从 `useItemsForPlan(planId)` 读取 items 转为 `DraftItem[]`，每个 draft 带 `existingId` 标记。

### usePlanEditSubmit edit 模式 diff

计算三类操作：
- `toCreate`: draft 中无 `existingId` 且 `title.trim() !== ''`
- `toUpdate`: draft 中 `existingId` 存在 + title/status/dueDate 变化
- `toDelete`: 原始 items 中有，但 draft 中无 或 draft.title 被清空

串行执行 create → update → delete（避免 ID 引用错乱），类内 `Promise.all`。全部包 Dexie transaction。

## batch-import 设计

### useMarkdownImport 重构

新签名：
```ts
interface ImportResult {
  success: number;
  failed: number;
  errors: ImportError[];
}
interface ImportError {
  filename: string;
  code: 'FILE_TOO_LARGE' | 'UNSUPPORTED_EXT' | 'READ_FAILED' | 'EMPTY_FILE' | 'PARSE_FAILED' | 'CREATE_FAILED';
  message: string;
  file: File;
}
```

- `MAX_SIZE = 5_000_000`（5MB）
- 串行处理 + 实时 push 进度 toast
- 失败文件保留 `File` 对象支持重试
- 保留 `importFile(file)` 单文件入口

### ImportMarkdownButton 加 multiple

```tsx
<input type="file" multiple accept=".md,.markdown,.txt" hidden />
<button onClick={openPicker}>导入 .md</button>
```

### Toast 进度

每文件开始/结束 push toast，失败时 toast 含失败详情 + 重试按钮。

## 验证

- `pnpm build` 0 error
- `pnpm lint` 0 warning
- `openspec validate --strict` valid
- 浏览器手验全部 AC
