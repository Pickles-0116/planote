/**
 * AIWritingPanel - AI 写作主面板（右侧抽屉）
 *
 * 3 个 Tab：模板生成 / 风格仿写 / 自由润色
 * 通过 tab 状态切换 TemplateGenerator / ImitateGenerator / PolishGenerator。
 *
 * 支持拖拽左边缘调整宽度（420px ~ 80vw），默认 560px。
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles, X, FileText, PenLine, Wand2 } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { cn } from '@/lib/utils';
import TemplateGenerator from './TemplateGenerator';
import ImitateGenerator from './ImitateGenerator';
import PolishGenerator from './PolishGenerator';

type TabKey = 'template' | 'imitate' | 'polish';

interface Tab {
  key: TabKey;
  label: string;
  icon: typeof FileText;
}

const TABS: Tab[] = [
  { key: 'template', label: '模板生成', icon: FileText },
  { key: 'imitate', label: '风格仿写', icon: PenLine },
  { key: 'polish', label: '自由润色', icon: Wand2 },
];

const DEFAULT_WIDTH = 560;
const MIN_WIDTH = 420;

interface Props {
  onClose: () => void;
  editor?: Editor | null;
  /** 预填补充信息（从计划跳转时注入计划事项清单）。 */
  initialGlobalNotes?: string;
}

export default function AIWritingPanel({ onClose, editor, initialGlobalNotes }: Props): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabKey>('template');
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_WIDTH);

  // 拖拽调整宽度
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [panelWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = startXRef.current - e.clientX; // 向左拖 = 变宽
      const maxW = Math.round(window.innerWidth * 0.8);
      const newW = Math.min(maxW, Math.max(MIN_WIDTH, startWidthRef.current + delta));
      setPanelWidth(newW);
    };
    const handleMouseUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      {/* 背景遮罩 */}
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭面板"
        className="absolute inset-0 bg-black/30 animate-fadeUp"
        style={{ animationDuration: '0.2s' }}
      />

      {/* 面板主体 */}
      <div
        className="absolute right-0 top-0 bottom-0 bg-white dark:bg-stone-800 shadow-2xl flex flex-col"
        style={{
          width: panelWidth,
          animation: 'drawerSlideIn 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左边缘拖拽手柄 */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize group z-10"
          aria-hidden
        >
          <div className="absolute inset-y-0 left-0 w-1 bg-transparent group-hover:bg-brand-500/40 group-active:bg-brand-500/60 transition-colors rounded-r" />
        </div>

        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-stone-200 dark:border-stone-700 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-brand-900 dark:text-brand-400" />
              <h3 className="text-base font-bold text-brand-900 dark:text-stone-100">
                AI 写作
              </h3>
              <span className="text-[11px] text-stone-400 dark:text-stone-500 font-normal">
                拖拽左边缘可调宽度
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="w-8 h-8 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 flex items-center justify-center text-brand-500 dark:text-stone-400"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tab 栏 */}
          <div className="flex gap-1 bg-stone-100 dark:bg-stone-700 rounded-xl p-1">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors',
                  activeTab === key
                    ? 'bg-white dark:bg-stone-600 text-brand-900 dark:text-stone-100 shadow-sm'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300',
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {activeTab === 'template' && <TemplateGenerator editor={editor} initialGlobalNotes={initialGlobalNotes} />}
          {activeTab === 'imitate' && <ImitateGenerator editor={editor} />}
          {activeTab === 'polish' && <PolishGenerator editor={editor} />}
        </div>
      </div>
    </div>
  );
}
