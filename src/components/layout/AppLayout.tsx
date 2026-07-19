import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import FrameworkGenerationDrawerHost from '@/features/framework/components/FrameworkGenerationDrawerHost';
import ToastViewport from '@/shared/components/ToastViewport';
import { useUIStore } from '@/stores/uiStore';

/**
 * 主布局：左侧 Sidebar + 右侧 Header + 主内容区 + 全局 Framework 抽屉宿主
 *
 * FrameworkGenerationDrawerHost 全局挂载（计划侧生成博客用）：
 * - 监听 useUIStore.drawerStack
 * - 路由变化时清空抽屉栈（防幽灵抽屉）
 * - 与 Dashboard / 详情页等入口共用同一 Drawer 壳
 *
 * BlogEdit 侧「应用框架」抽屉由 BlogEdit 自身局部挂载（add-framework-drawer 增量）
 *
 * ToastViewport 全局挂载（add-blog-attachment 增量）：
 * - 监听 useToastStore.toasts
 * - 右下角堆叠，z-60 高于 Drawer（z-50）
 *
 * 使用 <Outlet /> 渲染当前路由对应的页面。
 */
export default function AppLayout() {
  const closeAllDrawers = useUIStore((s) => s.closeAllDrawers);

  // 路由变化时清空抽屉栈（防幽灵抽屉）
  useEffect(() => {
    return () => {
      closeAllDrawers();
    };
  }, [closeAllDrawers]);

  return (
    <div className="flex h-screen overflow-hidden bg-stone-50 dark:bg-stone-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-7xl mx-auto px-8 py-8 text-brand-900 dark:text-stone-100">
            <Outlet />
          </div>
        </main>
      </div>
      <FrameworkGenerationDrawerHost />
      <ToastViewport />
    </div>
  );
}
