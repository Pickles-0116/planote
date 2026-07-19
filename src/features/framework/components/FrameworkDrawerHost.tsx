/**
 * FrameworkDrawerHost - 博客框架库抽屉宿主（add-framework-drawer 增量）
 *
 * 行为：
 * - 订阅 useUIStore.frameworkDrawerOpen 控制 open
 * - 调用 onApply 父组件注入 + 关闭抽屉
 * - 仅在 BlogEdit 挂载期存在（详情页不挂载）
 *
 * 与 PlanDetail 侧 FrameworkDrawerHost 关系：
 * - v1.0 两者并存，订阅不同 store 字段
 * - 路径相同 features/framework/components/FrameworkDrawerHost.tsx
 *   本 change 把 BlogEdit 侧版本覆盖此路径
 */

import { useCallback } from 'react';
import FrameworkDrawer from './FrameworkDrawer';
import { useUIStore } from '@/stores';
import type { PresetFramework } from '@/features/framework/data/presets';

interface Props {
  /** 抽屉内点「应用」→ 父组件调 useApplyFramework.apply */
  onApply: (framework: PresetFramework) => void;
  /** 当前 Blog 已应用的 framework id（用于显示「已应用」标记）。 */
  appliedFrameworkId?: string | null;
}

export default function FrameworkDrawerHost({
  onApply,
  appliedFrameworkId = null,
}: Props): JSX.Element {
  const open = useUIStore((s) => s.frameworkDrawerOpen);
  const close = useUIStore((s) => s.closeFrameworkDrawer);

  const handleApply = useCallback(
    (fw: PresetFramework): void => {
      onApply(fw);
      close();
    },
    [onApply, close],
  );

  return (
    <FrameworkDrawer
      open={open}
      onClose={close}
      onApply={handleApply}
      appliedFrameworkId={appliedFrameworkId}
    />
  );
}
