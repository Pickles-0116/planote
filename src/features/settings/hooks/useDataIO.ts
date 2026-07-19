/**
 * useDataIO - 数据导入/导出/清除 hook（add-settings-and-shell）
 *
 * 包装 dexieExport / dexieImport / dexieClear 三个纯函数，添加：
 * - 导出：触发 <a download> 下载
 * - 导入：透传 mode 参数
 * - 清除：透传
 *
 * 不含 UI（toast 提示、确认弹窗在调用方 DataSettings 中实现）。
 */

import { useCallback } from 'react';
import {
  dexieExport,
  dexieImport,
  dexieClear,
  type ImportMode,
  type ImportSummary,
} from '../utils';

export interface UseDataIOResult {
  /** 触发浏览器下载 JSON 备份。 */
  exportData: () => Promise<void>;
  /**
   * 导入 JSON 文件。merge 模式保留旧数据，replace 模式先清空再写入。
   * @throws ImportError 校验失败 / JSON 解析失败
   */
  importData: (file: File, mode: ImportMode) => Promise<ImportSummary>;
  /** 清空 7 张表（不可逆）。 */
  clearAllData: () => Promise<void>;
}

export function useDataIO(): UseDataIOResult {
  const exportData = useCallback(async (): Promise<void> => {
    const payload = await dexieExport();
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planote-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const importData = useCallback(
    async (file: File, mode: ImportMode): Promise<ImportSummary> => {
      return await dexieImport(file, mode);
    },
    [],
  );

  const clearAllData = useCallback(async (): Promise<void> => {
    await dexieClear();
  }, []);

  return { exportData, importData, clearAllData };
}
