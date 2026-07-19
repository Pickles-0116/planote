/**
 * DataSettings - 数据导入 / 导出 / 清除（add-settings-and-shell）
 *
 * 3 个 Card：
 * 1. 导出数据 — 按钮调 exportData() + toast
 * 2. 导入数据 — merge/replace 切换 + file input
 * 3. 清除数据 — 输入「确认清除」双层确认
 */

import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  Database,
} from 'lucide-react';
import { useDataIO } from '@/features/settings/hooks/useDataIO';
import { ImportError, type ImportMode } from '@/features/settings/utils';
import { useToastStore } from '@/stores/toastStore';
import { cn } from '@/lib/utils';

const CONFIRM_PHRASE = '确认清除';

export default function DataSettings(): JSX.Element {
  const { exportData, importData, clearAllData } = useDataIO();
  const pushToast = useToastStore((s) => s.push);
  const navigate = useNavigate();

  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);

  const handleExport = async (): Promise<void> => {
    try {
      await exportData();
      pushToast('success', '已导出 JSON 备份');
    } catch (e) {
      pushToast('error', '导出失败');
      console.error('[export] failed:', e);
    }
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm(`确定以「${importMode === 'merge' ? '合并' : '替换'}」模式导入？`)) {
      e.target.value = '';
      return;
    }
    setImporting(true);
    try {
      const summary = await importData(file, importMode);
      const cleared = summary.clearedTables > 0
        ? `（已清空 ${summary.clearedTables} 张表）`
        : '';
      pushToast('success', `导入成功${cleared}`);
    } catch (err) {
      if (err instanceof ImportError) {
        pushToast('error', err.message);
      } else {
        pushToast('error', '导入失败：未知错误');
        console.error('[import] failed:', err);
      }
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleClearConfirm = async (): Promise<void> => {
    setClearing(true);
    try {
      await clearAllData();
      pushToast('success', '已清除全部数据');
      setConfirmOpen(false);
      setConfirmText('');
      navigate('/');
    } catch (e) {
      pushToast('error', '清除失败');
      console.error('[clear] failed:', e);
    } finally {
      setClearing(false);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-lg font-bold text-brand-900 dark:text-stone-100">数据</h2>
        <p className="text-sm text-brand-500 dark:text-stone-400 mt-1">
          导出 / 导入 / 清除本机的全部数据。所有操作都在本地完成，不会上传到服务器。
        </p>
      </header>

      {/* 导出 */}
      <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <Download className="text-blue-600 dark:text-blue-300" size={18} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-brand-900 dark:text-stone-100">
              导出数据
            </h3>
            <p className="text-xs text-brand-500 dark:text-stone-400 mt-1">
              将所有计划 / 事项 / 博客 / 标签 / 附件 / 框架导出为 JSON 文件。
            </p>
            <button
              type="button"
              onClick={handleExport}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-medium hover:bg-brand-800 dark:hover:bg-stone-200 transition shadow-sm"
            >
              <Download size={14} />
              导出 JSON 备份
            </button>
          </div>
        </div>
      </div>

      {/* 导入 */}
      <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
            <Upload className="text-emerald-600 dark:text-emerald-300" size={18} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-brand-900 dark:text-stone-100">
              导入数据
            </h3>
            <p className="text-xs text-brand-500 dark:text-stone-400 mt-1">
              从 JSON 备份恢复。merge 模式保留现有数据，replace 模式先清空再导入。
            </p>

            <div className="mt-4 flex items-center gap-4 flex-wrap">
              <div className="inline-flex bg-stone-100 dark:bg-stone-700 rounded-xl p-1">
                {(['merge', 'replace'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setImportMode(m)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition',
                      importMode === m
                        ? 'bg-white dark:bg-stone-900 text-brand-900 dark:text-stone-100 shadow-sm'
                        : 'text-brand-500 dark:text-stone-400 hover:text-brand-900 dark:hover:text-stone-200',
                    )}
                  >
                    {m === 'merge' ? '合并' : '替换'}
                  </button>
                ))}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                className="hidden"
                disabled={importing}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 text-brand-900 dark:text-stone-100 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-600 transition disabled:opacity-50"
              >
                <Upload size={14} />
                {importing ? '导入中…' : '选择 JSON 文件'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 清除 */}
      <div className="bg-white dark:bg-stone-800 rounded-2xl border border-red-200 dark:border-red-900/40 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
            <Trash2 className="text-red-600 dark:text-red-300" size={18} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-brand-900 dark:text-stone-100">
              清除数据
            </h3>
            <p className="text-xs text-brand-500 dark:text-stone-400 mt-1">
              将删除全部计划 / 事项 / 博客 / 标签 / 附件 / 框架。此操作不可逆。
            </p>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 dark:bg-red-700 text-white text-sm font-medium hover:bg-red-700 dark:hover:bg-red-600 transition shadow-sm"
            >
              <Trash2 size={14} />
              清除全部数据
            </button>
          </div>
        </div>
      </div>

      {/* 清除确认 Modal */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 animate-fadeUp"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-confirm-title"
          onClick={() => !clearing && setConfirmOpen(false)}
        >
          <div
            className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="text-red-600 dark:text-red-300" size={20} />
              </div>
              <div>
                <h2
                  id="clear-confirm-title"
                  className="text-base font-bold text-brand-900 dark:text-stone-100"
                >
                  确认清除？
                </h2>
                <p className="text-sm text-brand-500 dark:text-stone-400 mt-1">
                  将删除全部 7 张表的数据。此操作不可逆。
                </p>
              </div>
            </div>

            <label className="block text-xs text-brand-500 dark:text-stone-400 mb-2">
              输入「{CONFIRM_PHRASE}」以启用清除按钮：
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              disabled={clearing}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm text-brand-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-red-500"
            />

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText('');
                }}
                disabled={clearing}
                className="px-4 py-2 rounded-xl bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 text-sm text-brand-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-600 transition disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleClearConfirm}
                disabled={confirmText !== CONFIRM_PHRASE || clearing}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition disabled:bg-stone-300 disabled:cursor-not-allowed dark:disabled:bg-stone-600"
              >
                {clearing ? '清除中…' : '我已了解风险，清除'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="text-xs text-brand-400 dark:text-stone-500 flex items-center gap-1.5 pt-2">
        <Database size={12} />
        数据存储于浏览器 IndexedDB（数据库名 <code className="font-mono">planote</code>）
      </div>
    </section>
  );
}
