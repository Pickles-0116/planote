import { Link } from 'react-router-dom';
import { Construction, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlaceholderPageProps {
  title: string;
  description?: string;
  /** 返回链接（默认回首页） */
  backTo?: string;
  backLabel?: string;
}

/**
 * 占位页面：用于尚未实现的核心页面（计划/博客 CRUD、看板、设置等）
 * 与 prototype 保持一致的视觉风格：白底卡片 + 柔和阴影 + 圆角。
 */
export default function PlaceholderPage({
  title,
  description = '该功能正在开发中，敬请期待。',
  backTo = '/',
  backLabel = '返回仪表盘',
}: PlaceholderPageProps) {
  return (
    <div className="animate-fadeUp">
      <div
        className={cn(
          'bg-white rounded-2xl border border-stone-200 p-12 text-center',
          'shadow-soft',
        )}
      >
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <Construction className="text-accent-500" size={24} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">{title}</h1>
        <p className="text-sm text-brand-500 max-w-md mx-auto mb-6">{description}</p>
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-900 text-white text-sm font-medium hover:bg-brand-800 transition shadow-sm"
        >
          <ArrowLeft size={14} />
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
