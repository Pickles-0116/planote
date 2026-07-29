# Tasks · fix-item-crud-and-batch-import

> **包 A:item-crud（修 3 个严重 bug）** + **包 B:batch-import（升级单文件为批量）**

## A. item-crud

### A1. useItemCRUD hook
- [x] A1.1 新建 `src/features/plan/hooks/useItemCRUD.ts`（add/update/remove/setStatus/toggle/reorder）
- [x] A1.2 `add(planId, init?)` 实现：推新 item + 同步 plan.itemIds + recomputeProgress
- [x] A1.3 `update(itemId, patch)` 实现：仅 patch 字段
- [x] A1.4 `remove(itemId)` 实现：删 item + 从 plan.itemIds 移除 + recomputeProgress
- [x] A1.5 `setStatus / toggle / reorder` 实现

### A2. ItemChecklist + ItemRow 改造
- [x] A2.1 改 `ItemChecklist.tsx`：删 disabled + 加 onAdd + inline 添加 input
- [x] A2.2 改 `ItemRow.tsx`：加 onUpdate/onRemove + 始终显示删除 + 双击编辑

### A3. PlanDetail 接入
- [x] A3.1 改 `PlanDetail.tsx`：接入 useItemCRUD，传 add/update/remove 给 ItemChecklist

### A4. PlanEdit edit 模式预填 + 提交
- [x] A4.1 改 `PlanEdit.tsx`：prefilled.items 从 useItemsForPlan 读取
- [x] A4.2 改 `Step3Items.tsx`：ItemRow 接收 existingId + 状态徽章
- [x] A4.3 改 `usePlanEditSubmit.ts`：edit 模式 items diff（toCreate/toUpdate/toDelete）

### A5. 验证 item-crud
- [x] A5.1 `pnpm build` 0 error
- [x] A5.2 `pnpm lint` 0 warning

## B. batch-import

### B1. useMarkdownImport 重构
- [x] B1.1 改 `useMarkdownImport.ts`：新签名 `importFiles(files: File[]): Promise<ImportResult>`，MAX_SIZE 5MB
- [x] B1.2 保留单文件入口 `importFile`
- [x] B1.3 失败文件保留 File 对象

### B2. ImportMarkdownButton 升级
- [x] B2.1 改 `ImportMarkdownButton.tsx`：加 `multiple` + accept 调整 + 文案同步

### B3. NewBlogMenu / BlogList 同步
- [x] B3.1 改 `NewBlogMenu.tsx`：单文件入口文案 + 「批量导入」入口
- [x] B3.2 改 `BlogList.tsx`：空态文案同步

### B4. ToastViewport 扩展
- [x] B4.1 改 `ToastViewport.tsx`：toast details 字段 + 内联「重试」按钮

### B5. 验证 batch-import
- [x] B5.1 `pnpm build` 0 error
- [x] B5.2 `pnpm lint` 0 warning

## C. 通用验证 + 归档
- [x] C.1 `openspec validate fix-item-crud-and-batch-import --strict` valid
- [x] C.2 `openspec validate --specs --strict` 20/20 通过
- [x] C.3 `openspec archive fix-item-crud-and-batch-import --yes`
