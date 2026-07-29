/**
 * useMarkdownImport · v1.1 批量升级
 *
 * 弹文件选择 → 解析 Markdown → 创建 blog（draft 状态）→ 留在列表页。
 *
 * 行为（spec Requirement: 批量导入）：
 * - 新签名 `importFiles(files: File[]): Promise<ImportResult>`
 * - 串行处理：每个文件完成后再处理下一个（避免 Dexie 写入竞争）
 * - 实时 push 进度 toast：每文件开始/结束
 * - 单文件入口 `importFile(file)` 保留（兼容旧调用方）
 * - 失败文件保留 `File` 对象支持重试
 *
 * 失败处理（spec Scenario: 部分失败汇总）：
 * - 文件 > 5MB → FILE_TOO_LARGE
 * - 扩展名非 .md/.markdown/.txt → UNSUPPORTED_EXT
 * - 读取失败 → READ_FAILED
 * - 文件内容为空 → EMPTY_FILE
 * - 解析异常 → PARSE_FAILED
 * - 创建 blog 失败 → CREATE_FAILED
 *
 * 行为（spec Requirement: 批量导入后 MUST 不跳转编辑页）：
 * - importFiles 完成后**不** navigate
 * - importFile (单文件入口) 维持旧行为：成功跳编辑页
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlogStore, useToastStore } from '@/stores';
import { ROOT_FOLDER_ID } from '@/features/folders/constants';
import { extractPlainText } from '@/features/blog/utils/extractPlainText';
import {
  markdownToTiptapJSON,
  extractTitle,
  extractExcerpt,
} from '@/features/blog/utils/markdownToTiptap';

const MAX_SIZE = 5_000_000; // 5MB（v1.1 提升：1MB → 5MB）
const ALLOWED_EXT = /\.(md|markdown|txt)$/i;

/** 单文件错误码（spec Requirement: 部分失败汇总）。 */
export type ImportErrorCode =
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_EXT'
  | 'READ_FAILED'
  | 'EMPTY_FILE'
  | 'PARSE_FAILED'
  | 'CREATE_FAILED';

/** 单文件错误结构（保留 File 用于重试）。 */
export interface ImportError {
  filename: string;
  code: ImportErrorCode;
  message: string;
  file: File;
}

/** 批量导入结果汇总。 */
export interface ImportResult {
  success: number;
  failed: number;
  errors: ImportError[];
}

export interface UseMarkdownImportResult {
  /** 单文件入口：成功跳编辑页（v1.0 旧行为）。 */
  importFile: (file: File) => Promise<{ blogId?: string } | void>;
  /** 批量入口：串行处理 + 实时 toast，**不**跳转。 */
  importFiles: (files: File[]) => Promise<ImportResult>;
  /** 重试单个失败文件。 */
  retryFile: (file: File) => Promise<{ blogId?: string } | void>;
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** 把字节大小转 MB（保留 1 位小数）。 */
const toMB = (bytes: number): string => (bytes / 1_000_000).toFixed(1);

/** 内部：解析单个文件并创建 blog（不负责 toast / navigate）。 */
const parseAndCreate = async (
  file: File,
  createBlog: ReturnType<typeof useBlogStore.getState>['createBlog'],
): Promise<{ blogId: string; title: string }> => {
  // 1. 大小校验
  if (file.size > MAX_SIZE) {
    const err: ImportError = {
      filename: file.name,
      code: 'FILE_TOO_LARGE',
      message: `文件「${file.name}」超过 5MB（${toMB(file.size)}MB），请精简后再导入`,
      file,
    };
    throw err;
  }

  // 2. 扩展名校验
  if (!ALLOWED_EXT.test(file.name)) {
    const err: ImportError = {
      filename: file.name,
      code: 'UNSUPPORTED_EXT',
      message: `不支持的文件格式「${file.name}」，仅支持 .md / .markdown / .txt`,
      file,
    };
    throw err;
  }

  // 3. 读取
  let markdown: string;
  try {
    markdown = await file.text();
  } catch (e) {
    const err: ImportError = {
      filename: file.name,
      code: 'READ_FAILED',
      message: `读取文件失败：${(e as Error).message}`,
      file,
    };
    throw err;
  }

  if (!markdown.trim()) {
    const err: ImportError = {
      filename: file.name,
      code: 'EMPTY_FILE',
      message: `文件「${file.name}」内容为空`,
      file,
    };
    throw err;
  }

  // 4. 解析
  let content;
  let contentText = '';
  try {
    content = markdownToTiptapJSON(markdown);
    contentText = extractPlainText(content);
  } catch (e) {
    const err: ImportError = {
      filename: file.name,
      code: 'PARSE_FAILED',
      message: `Markdown 解析失败：${(e as Error).message}`,
      file,
    };
    throw err;
  }

  // 5. 创建 blog
  const title = extractTitle(markdown, file.name);
  const excerpt = extractExcerpt(markdown);
  try {
    const blog = await createBlog({
      title,
      content,
      contentText,
      excerpt,
      status: 'draft',
      tagIds: [],
      attachmentIds: [],
      source: 'direct',
      folderId: ROOT_FOLDER_ID,
    });
    return { blogId: blog.id, title };
  } catch (e) {
    const err: ImportError = {
      filename: file.name,
      code: 'CREATE_FAILED',
      message: `创建博客失败：${(e as Error).message}`,
      file,
    };
    throw err;
  }
};

export function useMarkdownImport(): UseMarkdownImportResult {
  const createBlog = useBlogStore((s) => s.createBlog);
  const navigate = useNavigate();
  const push = useToastStore((s) => s.push);
  const pushFull = useToastStore((s) => s.pushFull);

  /** 单文件入口：v1.0 行为（成功跳编辑页 + 失败 toast）。 */
  const importFile = useCallback(
    async (file: File) => {
      try {
        const { blogId, title } = await parseAndCreate(file, createBlog);
        push('success', `已导入「${title}」`);
        navigate(`/blogs/${blogId}/edit`);
        return { blogId };
      } catch (err) {
        const e = err as ImportError;
        if (e && typeof e === 'object' && 'code' in e) {
          push('error', e.message);
        } else {
          push('error', `导入失败：${(err as Error).message ?? '未知错误'}`);
        }
      }
    },
    [createBlog, navigate, push],
  );

  /** 重试单个文件（行为同 importFile）。 */
  const retryFile = useCallback(
    async (file: File) => {
      await importFile(file);
    },
    [importFile],
  );

  /** 批量入口：串行处理 + 实时 toast + 不跳转。 */
  const importFiles = useCallback(
    async (files: File[]): Promise<ImportResult> => {
      const result: ImportResult = { success: 0, failed: 0, errors: [] };

      if (files.length === 0) {
        return result;
      }

      // 起始 toast
      push('info', `开始导入 ${files.length} 个文件…`);

      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        // 单文件进度 toast
        push('info', `(${i + 1}/${files.length}) 正在处理「${file.name}」(${formatSize(file.size)})`);

        try {
          await parseAndCreate(file, createBlog);
          result.success += 1;
          push('success', `(${i + 1}/${files.length}) 「${file.name}」导入成功`);
        } catch (err) {
          const e = err as ImportError;
          if (e && typeof e === 'object' && 'code' in e) {
            result.failed += 1;
            result.errors.push(e);
            // 失败 toast（带「重试」按钮 + sticky 让用户有时间点）
            pushFull({
              kind: 'error',
              message: e.message,
              sticky: true,
              details: [
                {
                  message: `文件大小: ${formatSize(e.file.size)} · ${e.code}`,
                  action: {
                    label: '重试',
                    onClick: () => {
                      void retryFile(e.file);
                    },
                  },
                },
              ],
            });
          } else {
            result.failed += 1;
            const message = `导入「${file.name}」失败：${(err as Error).message ?? '未知错误'}`;
            const synthetic: ImportError = {
              filename: file.name,
              code: 'CREATE_FAILED',
              message,
              file,
            };
            result.errors.push(synthetic);
            push('error', message);
          }
        }
      }

      // 汇总 toast
      if (result.failed === 0) {
        push('success', `批量导入完成 · 成功 ${result.success} 篇`);
      } else {
        push('info', `批量导入完成 · 成功 ${result.success} 篇 · 失败 ${result.failed} 篇`);
      }

      return result;
    },
    [createBlog, push, pushFull, retryFile],
  );

  return { importFile, importFiles, retryFile };
}
