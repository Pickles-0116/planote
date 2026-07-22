/**
 * DataInspector · v1.0 收尾调试组件
 *
 * 用于让用户直观确认 IndexedDB 持久化数据状态。
 * - 实时显示 7 张表的当前行数（useLiveQuery 订阅）
 * - 文字说明数据存于浏览器 IndexedDB（数据库名 planote）
 * - 提示「dev server / 浏览器重启不会清空数据」
 *
 * 仅在设置页底部显示，不影响生产路径。
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { Database, ExternalLink } from 'lucide-react';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/shell/Skeleton';
import { db } from '@/db';

interface TableCount {
  plans: number;
  items: number;
  blogs: number;
  tags: number;
  attachments: number;
  frameworks: number;
  meta: number;
}

const TABLE_LABELS: Array<{ key: keyof TableCount; label: string; desc: string }> = [
  { key: 'plans', label: '计划', desc: '顶层计划' },
  { key: 'items', label: '事项', desc: '计划内清单项' },
  { key: 'blogs', label: '博客', desc: '发布的博客' },
  { key: 'tags', label: '标签', desc: '标签字典' },
  { key: 'attachments', label: '附件', desc: '博客图片 / PDF' },
  { key: 'frameworks', label: '框架', desc: '内置 + 自定义' },
  { key: 'meta', label: 'Meta', desc: '配置键值对' },
];

export default function DataInspector() {
  const counts = useLiveQuery<TableCount | undefined>(async () => {
    return {
      plans: await db.plans.count(),
      items: await db.items.count(),
      blogs: await db.blogs.count(),
      tags: await db.tags.count(),
      attachments: await db.attachments.count(),
      frameworks: await db.frameworks.count(),
      meta: await db.meta.count(),
    };
  }, []);

  if (!counts) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Database size={16} className="text-brand-500" />
          <h3 className="text-sm font-semibold">数据状态</h3>
        </div>
        <Skeleton className="h-20" />
      </Card>
    );
  }

  const totalRows = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-brand-500" />
          <h3 className="text-sm font-semibold text-brand-900 dark:text-stone-100">数据状态</h3>
        </div>
        <span className="text-[10px] text-brand-400 dark:text-stone-500 bg-stone-100 dark:bg-stone-700 px-1.5 py-0.5 rounded">
          共 {totalRows} 行
        </span>
      </div>

      <p className="text-xs text-brand-500 dark:text-stone-400 mb-4 leading-relaxed">
        数据存于<strong className="text-brand-700 dark:text-stone-200">浏览器 IndexedDB</strong>
        （数据库名 <code className="text-[10px] bg-stone-100 dark:bg-stone-700 px-1 rounded">planote</code>），
        dev server / 浏览器重启 <strong className="text-emerald-600 dark:text-emerald-400">不会清空</strong>。
        想深入检查：浏览器 DevTools → Application → IndexedDB → planote。
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {TABLE_LABELS.map(({ key, label, desc }) => (
          <div
            key={key}
            className="px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700"
          >
            <div className="text-[10px] text-brand-400 dark:text-stone-500">{label}</div>
            <div className="text-lg font-semibold text-brand-900 dark:text-stone-100 tabular-nums">
              {counts[key]}
            </div>
            <div className="text-[9px] text-brand-300 dark:text-stone-600 truncate">{desc}</div>
          </div>
        ))}
      </div>

      <a
        href="https://developer.chrome.com/docs/devtools/storage/indexeddb/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-[10px] text-brand-500 hover:text-brand-900 dark:text-stone-400 dark:hover:text-stone-100"
      >
        了解 IndexedDB <ExternalLink size={10} />
      </a>
    </Card>
  );
}
