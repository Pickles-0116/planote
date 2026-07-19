/**
 * AboutSettings - 关于区块（add-settings-and-shell）
 *
 * Logo + 版本号 + 开源致谢 + 版权
 */

import { PenLine, Heart } from 'lucide-react';

const ACKNOWLEDGMENTS = [
  { name: 'React 18 + TypeScript + Vite', url: 'https://react.dev/' },
  { name: 'Tailwind CSS + Lucide React', url: 'https://tailwindcss.com/' },
  { name: 'Dexie + IndexedDB', url: 'https://dexie.org/' },
  { name: 'Zustand', url: 'https://zustand-demo.pmnd.rs/' },
  { name: 'React Router 6', url: 'https://reactrouter.com/' },
  { name: 'Tiptap', url: 'https://tiptap.dev/' },
  { name: 'OpenSpec', url: 'https://github.com/Fission-AI/OpenSpec' },
];

export default function AboutSettings(): JSX.Element {
  return (
    <section className="space-y-6">
      <div className="text-center py-8">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-brand-900 dark:bg-stone-700 flex items-center justify-center shadow-soft mb-5">
          <PenLine className="text-white" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-brand-900 dark:text-stone-100">
          Planote · 栖记
        </h1>
        <p className="text-sm text-brand-500 dark:text-stone-400 mt-2">
          v1.0.0 · 2026.07
        </p>
        <p className="text-xs text-brand-400 dark:text-stone-500 mt-1 max-w-md mx-auto">
          计划与博客一体化管理工具。数据存储于本地 IndexedDB，不上传服务器。
        </p>
      </div>

      <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-6">
        <h2 className="text-sm font-semibold text-brand-900 dark:text-stone-100 mb-3">
          开源致谢
        </h2>
        <ul className="text-sm text-brand-700 dark:text-stone-300 space-y-1.5">
          {ACKNOWLEDGMENTS.map((a) => (
            <li key={a.name} className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-brand-300 dark:bg-stone-500 flex-shrink-0" />
              <span className="flex-1">{a.name}</span>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-400 dark:text-stone-500 hover:text-brand-700 dark:hover:text-stone-200 transition"
              >
                链接
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-6">
        <h2 className="text-sm font-semibold text-brand-900 dark:text-stone-100 mb-3">
          变更日志
        </h2>
        <p className="text-sm text-brand-500 dark:text-stone-400">
          v1.0.0 — 设置中心 + dark mode + 数据导入导出 + 关于页。
        </p>
        <p className="text-xs text-brand-400 dark:text-stone-500 mt-1.5">
          14 个 OpenSpec change 依次落地：脚手架 / 数据层 / 状态管理 / 外壳 / 计划编辑 / 计划详情 / 看板 / 博客 / 框架 / 智能排序 / 列表视图 / 数据绑定 / 博客附件 / 设置与外壳。
        </p>
      </div>

      <div className="text-center pt-4 pb-2">
        <p className="text-xs text-brand-400 dark:text-stone-500 flex items-center justify-center gap-1">
          <Heart size={11} className="text-red-400" />
          © 2026 Planote · 个人项目，仅供学习与个人使用
        </p>
      </div>
    </section>
  );
}
