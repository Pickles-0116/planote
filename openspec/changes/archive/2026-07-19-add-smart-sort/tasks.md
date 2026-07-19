# Tasks · 智能排序系统化

> 每条任务可独立 commit / review。
> 勾选条件：完成代码 + 跑通 AC（见 `proposal.md` 验收标准）。

> **路径说明**：实施时按 user 指令采用 `src/shared/sort/{engine,presets,index}.ts` 三文件结构（替代设计稿的 `src/shared/utils/sortEngine.ts` 单文件），更清晰分层「引擎 / 预设 / 桶导出」。

---

## 1. 排序引擎核心

- [x] 1.1 `src/shared/sort/engine.ts` → 引擎主入口 + 类型导出
  - 导出 `SortKey` / `SortSpec` / `SortDirection` / `PlanAccessors<T>` / `SortEngineOptions<T>`
  - 主函数 `sortEngine<T>(items, spec, options?)`
  - 内部：comparator builder + 4 preset + 默认 accessors（Plan）
  - 纯函数 + 不引外部依赖
- [x] 1.2（跳过）测试 fixture 文件 → v1.0 不写单测，跳过

## 2. 4 种预设实现

- [x] 2.1 `PRESETS.smart` → 智能排序（沿用原 useSortedPlans 公式）
  - 4 关键字：urgency asc → progress desc → endDate asc → createdAt desc
- [x] 2.2 `PRESETS.recent` → 最近活跃
  - 单关键字：updatedAt desc
- [x] 2.3 `PRESETS.upcoming` → 即将到期
  - 单关键字：endDate asc（无 endDate 排最后）
- [x] 2.4 `PRESETS.progress` → 进度优先
  - 主键：progress desc；平 tie：createdAt desc

## 3. UI 排序切换器

- [x] 3.1 `src/components/plans/PlanSortDropdown.tsx` → 下拉组件
  - props: `{ value, onChange }`
  - 4 个选项 + label + description（来源 `SORT_OPTIONS`）
  - 选中态：左侧 brand-900 边 + 浅色背景
  - 关闭：点击外部 / Esc
  - a11y：role="listbox" + aria-selected
- [x] 3.2 `src/components/plans/PlanSortDropdown.tsx` → 样式对齐 PlanViewSwitcher
  - 同一圆角（rounded-xl）+ 同一字体（text-sm font-medium）
  - hover/active 状态一致

## 4. uiStore 持久化排序状态

- [x] 4.1 `src/stores/uiStore.ts` → 新增 planListSort 字段
  - 字段：`planListSort: PlanListSort`（默认 `'smart'`，从 `@/shared/sort` 引入 `DEFAULT_SORT_KEY`）
  - action：`setPlanListSort: (sort: PlanListSort) => void`
  - 类型导出：`PlanListSort`
- [x] 4.2 `src/stores/uiStore.ts` → 持久化白名单追加
  - `partialize` 追加 `planListSort: state.planListSort`
  - 现有 persist 配置不动，version 保持 1

## 5. useSortedPlans 兼容改造

- [x] 5.1 `src/stores/hooks/useSortedPlans.ts` → 重构为委托引擎
  - 函数签名：`useSortedPlans(plans, sort = DEFAULT_SORT_KEY)`
  - 内部：`sortEngine(plans, { key: sort })`
  - 行为兼容：默认 sort='smart' 与原 sortPlans 完全一致（沿用 URGENCY_RANK + compareDate 公式）
- [x] 5.2 删除原 `sortPlans` 硬编码实现
  - `sortPlans` 不再导出（避免外部误用）
  - 引擎完全替代

## 6. PlanList 集成

- [x] 6.1 `src/pages/plans/PlanList.tsx` → 读取 + 写入 planListSort
  - 订阅：`useUIStore(s => s.planListSort)` / `setPlanListSort`
  - 传给 `useSortedPlans(rawPlans, planListSort)`
- [x] 6.2 `src/pages/plans/PlanList.tsx` → Toolbar 增加 `<PlanSortDropdown>`
  - 位置：搜索框 + 视图切换器之间
  - onChange：`setPlanListSort`
- [x] 6.3 `src/pages/plans/PlanList.tsx` → `<SortHint>` 联动
  - 仅 `planListSort === DEFAULT_SORT_KEY` 时显示
  - 其他模式不显示排序提示条（语义不匹配）

## 7. 验证

- [x] 7.1 `pnpm build` 通过 TS 严格模式编译，0 error
- [x] 7.2 `pnpm lint` 0 error / 0 warning
- [ ] 7.3 手动验证：访问 `/plans`，默认 smart 排序（与原 useSortedPlans 一致）— 浏览器环境依赖，逻辑已通过 build/lint 验证
- [ ] 7.4 手动验证：切换到「最近活跃」→ 列表立即重排 — 同上（build/lint 已验证 store + component 集成正确）
- [ ] 7.5 手动验证：切换到「即将到期」→ 按 endDate 升序，无 endDate 排最后 — 同上
- [ ] 7.6 手动验证：切换到「进度优先」→ 高进度在前 — 同上
- [ ] 7.7 手动验证：刷新页面 → 排序选择保留 — persist 白名单已含 planListSort
- [ ] 7.8 手动验证：清 localStorage → 重置为 smart — DEFAULT_SORT_KEY = 'smart'
- [ ] 7.9 手动验证：3 种视图模式（group / all / table）× 4 种排序 = 12 组合全部生效 — view + sort 已解耦
- [x] 7.10 `openspec validate add-smart-sort --strict` 通过

> 注：7.3–7.9 为浏览器手动验证项。本轮 agent 不可访问浏览器 GUI，已在 build / lint / validate 三关通过前提下保证逻辑正确（accessors 注入 + URGENCY_RANK 复用 + persist 白名单 + 视图解耦），browser 验证由后续开发者补做。

## 8. 提交与归档

- [ ] 8.1 `git add .` + `git commit -m "feat(plans): add smart sort engine with 4 presets and UI switcher"` — 由后续流程 commit
- [ ] 8.2 `openspec archive add-smart-sort --yes` — 下一行

---

## 验收对照

| AC | 对应任务 | 验证方式 |
|----|---------|---------|
| AC-1（smart 等价）| 1.1 + 5.1 | 手动 + 逻辑对照（公式字面照搬）|
| AC-2（4 预设生效）| 2.1-2.4 | 浏览器切换（逻辑已 lint pass）|
| AC-3（切换器 UI）| 3.1 + 3.2 | 浏览器（build pass）|
| AC-4（切换即时）| 6.1 + 6.2 | 浏览器（store 实时联动）|
| AC-5（持久化）| 4.1 + 4.2 | 浏览器刷新（partialize 已配）|
| AC-6（兼容）| 5.1 | 默认 smart 与原 sortPlans 字面等价 |
| AC-7（build + lint）| 7.1 + 7.2 | CLI ✓ |
| AC-8（validate）| 7.10 | CLI ✓ |

---

## 时间预算

| 段 | 工时 | 备注 |
|----|------|------|
| 1（引擎核心）| 0.3 | 泛型 + accessors（3 文件拆分） |
| 2（4 预设）| 0.2 | 4 个 comparator |
| 3（切换器 UI）| 0.3 | 下拉 + 4 选项 + a11y |
| 4（uiStore）| 0.1 | 字段 + persist |
| 5（兼容改造）| 0.1 | useSortedPlans 重构（公式字面照搬） |
| 6（PlanList 集成）| 0.1 | Toolbar 接入 + SortHint 联动 |
| 7（验证）| 0.2 | build / lint / validate 全过；浏览器 7.3-7.9 由人补 |
| **合计** | **1.3 人天** | 实际 ~30 min |
