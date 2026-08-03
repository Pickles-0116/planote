/**
 * Settings - 设置中心主入口（add-settings-and-shell）
 *
 * 布局：左侧 240px 导航 + 右侧 4 区块
 * 区块切换：useState activeKey（v1.0 简版，不走 URL hash）
 */

import { useEffect, useState } from 'react';
import {
  Palette,
  Database,
  Bot,
  Cloud,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ThemeSettings from './ThemeSettings';
import DataSettings from './DataSettings';
import ModelConfigPanel from '@/features/ai/components/ModelConfigPanel';
import CallStatsPanel from '@/features/ai/components/CallStatsPanel';
import DataInspector from '@/features/settings/components/DataInspector';
import CloudSyncSettings from './CloudSyncSettings';

type SettingsKey = 'theme' | 'ai' | 'data' | 'sync';

interface NavItem {
  key: SettingsKey;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'theme', label: '主题', icon: Palette },
  { key: 'ai', label: 'AI 模型', icon: Bot },
  { key: 'data', label: '数据', icon: Database },
  { key: 'sync', label: '云同步', icon: Cloud },
];

const HASH_TO_KEY: Record<string, SettingsKey> = {
  theme: 'theme',
  ai: 'ai',
  data: 'data',
  sync: 'sync',
};

function getInitialKey(): SettingsKey {
  if (typeof window === 'undefined') return 'theme';
  const hash = window.location.hash.replace(/^#/, '');
  if (hash && hash in HASH_TO_KEY) {
    return HASH_TO_KEY[hash]!;
  }
  return 'theme';
}

export default function Settings(): JSX.Element {
  const [activeKey, setActiveKey] = useState<SettingsKey>(getInitialKey);

  // 监听 hash 变化（深链支持）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (): void => {
      const hash = window.location.hash.replace(/^#/, '');
      if (hash && hash in HASH_TO_KEY) {
        setActiveKey(HASH_TO_KEY[hash]!);
      }
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const handleNav = (key: SettingsKey): void => {
    setActiveKey(key);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${key}`);
    }
  };

  return (
    <div className="flex gap-6 max-w-5xl mx-auto">
      {/* 左侧导航 */}
      <nav
        className="w-60 flex-shrink-0"
        aria-label="设置区块导航"
      >
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-brand-900 dark:text-stone-100">
            设置
          </h1>
          <p className="text-xs text-brand-500 dark:text-stone-400 mt-1">
            主题 · AI · 数据 · 云同步
          </p>
        </div>
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === activeKey;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => handleNav(item.key)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 rounded-xl text-sm transition flex items-center gap-3',
                    isActive
                      ? 'bg-brand-900 dark:bg-stone-700 text-white font-medium shadow-sm'
                      : 'text-brand-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <item.icon size={14} />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* 右侧内容 */}
      <div className="flex-1 min-w-0 space-y-6">
        {activeKey === 'theme' && <ThemeSettings />}
        {activeKey === 'ai' && (
          <div className="space-y-6">
            <div id="ai-models" className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 scroll-mt-4">
              <ModelConfigPanel />
            </div>
            <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-6">
              <CallStatsPanel />
            </div>
          </div>
        )}
        {activeKey === 'data' && <DataSettings />}
        {activeKey === 'sync' && <CloudSyncSettings />}

        {/* 调试区块：始终显示，让用户直观确认 IndexedDB 数据状态 */}
        <DataInspector />
      </div>
    </div>
  );
}
