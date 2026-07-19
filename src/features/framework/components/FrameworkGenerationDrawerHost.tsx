/**
 * FrameworkGenerationDrawerHost - 计划侧「从计划生成博客」框架抽屉宿主
 *
 * 历史：原 features/framework/components/FrameworkDrawerHost.tsx
 * 改名原因：add-framework-drawer 增量把同路径让给 BlogEdit 侧抽屉；
 *          本侧按 design.md §2.1 命名约定改为 FrameworkGenerationDrawerHost。
 *
 * 行为（design.md §2.5 + spec Requirement: 框架抽屉入口）：
 * - 监听 useUIStore.drawerStack，找到 id === 'framework' 的 entry
 * - 渲染 FrameworkGenerationDrawer，从 entry.props 取 sourcePlanId
 * - 路由变化 effect：调 closeAllDrawers 防「幽灵抽屉」
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useUIStore } from '@/stores';
import FrameworkGenerationDrawer from './FrameworkGenerationDrawer';

interface FrameworkProps {
  sourcePlanId?: string;
}

export default function FrameworkGenerationDrawerHost() {
  const location = useLocation();
  const stack = useUIStore((s) => s.drawerStack);
  const closeAllDrawers = useUIStore((s) => s.closeAllDrawers);
  const closeDrawer = useUIStore((s) => s.closeDrawer);

  // 路由变化时清空所有抽屉（防幽灵抽屉）
  useEffect(() => {
    closeAllDrawers();
  }, [location.pathname, closeAllDrawers]);

  // 取 framework entry
  const entry = stack.find((d) => d.id === 'framework');
  if (!entry) return null;

  const props = (entry.props ?? {}) as FrameworkProps;

  return (
    <FrameworkGenerationDrawer
      sourcePlanId={props.sourcePlanId}
      open
      onClose={() => closeDrawer('framework')}
    />
  );
}
