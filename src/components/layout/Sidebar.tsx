import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Target,
  Newspaper,
  Kanban,
  Settings as SettingsIcon,
  PenLine,
  FileText,
  Sparkles,
  FolderTree,
  Boxes,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import SidebarFolders from './SidebarFolders';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  end?: boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: '仪表盘', icon: <LayoutDashboard size={16} />, end: true },
  { to: '/plans', label: '计划', icon: <Target size={16} /> },
  { to: '/blogs', label: '博客', icon: <Newspaper size={16} /> },
  { to: '/folders', label: '文件夹', icon: <FolderTree size={16} /> },
  { to: '/templates', label: '模板', icon: <FileText size={16} /> },
  { to: '/skills', label: '技能', icon: <Boxes size={16} />, badge: '新' },
  { to: '/ai-chat', label: 'AI 对话', icon: <Sparkles size={16} /> },
  { to: '/kanban', label: '看板', icon: <Kanban size={16} /> },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition',
    isActive
      ? 'bg-brand-900 dark:bg-stone-700 text-white shadow-sm font-medium'
      : 'text-brand-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800',
  );

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white dark:bg-stone-800 border-r border-stone-200 dark:border-stone-700 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-stone-100 dark:border-stone-700">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-900 dark:bg-stone-700 flex items-center justify-center shadow-sm">
            <PenLine className="text-white" size={16} />
          </div>
          <div>
            <div className="font-bold text-brand-900 dark:text-stone-100 text-base leading-tight">Planote</div>
            <div className="text-[10px] text-brand-400 dark:text-stone-500 tracking-wider">栖 · 记</div>
          </div>
        </div>
      </div>

      {/* 主导航 */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
            <span className="w-5 flex items-center justify-center">{item.icon}</span>
            <span>{item.label}</span>
            {item.badge && (
              <span className="ml-auto text-[10px] bg-stone-100 dark:bg-stone-700 text-brand-500 dark:text-stone-300 px-1.5 py-0.5 rounded-md font-semibold">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}

        {/* V1.2：文件夹区块（与 /folders 页一致的数据源） */}
        <div className="pt-4 pb-1 border-t border-stone-100 dark:border-stone-700">
          <SidebarFolders />
        </div>

        {/* 其他 */}
        <div className="pt-4 pb-2 px-3 text-[10px] font-semibold text-brand-400 dark:text-stone-500 tracking-wider uppercase">
          其他
        </div>
        <NavLink to="/settings" className={linkClass}>
          <span className="w-5 flex items-center justify-center">
            <SettingsIcon size={16} />
          </span>
          <span>设置</span>
        </NavLink>
        <NavLink to="/export" className={linkClass}>
          <span className="w-5 flex items-center justify-center">
            <Download size={16} />
          </span>
          <span>导出</span>
        </NavLink>
      </nav>

      {/* 用户卡片（默认 Planote 标识） */}
      <div className="m-3 p-3 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-50 dark:from-stone-700 dark:to-stone-800 border border-stone-200 dark:border-stone-600">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center text-white text-xs font-bold">
            P
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate text-brand-900 dark:text-stone-100">Planote</div>
            <div className="text-[10px] text-brand-400 dark:text-stone-500">本地优先 · 个人版</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
