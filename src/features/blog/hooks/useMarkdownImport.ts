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
const IMAGE_EXT = /\.(svg|png|jpe?g|gif|webp|bmp|avif)$/i;

/** 取 File 的 webkitRelativePath（目录选择时浏览器注入）。 */
const getRelPath = (file: File): string =>
  (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';

/** 判断是否图片文件。 */
const isImageFile = (name: string): boolean => IMAGE_EXT.test(name);

/** 把图片文件读成 data URL。SVG 用 utf8 编码（img 渲染最稳），其他用 base64。 */
async function fileToDataURL(file: File): Promise<string> {
  if (file.name.toLowerCase().endsWith('.svg')) {
    const text = await file.text();
    return `data:image/svg+xml;utf8,${encodeURIComponent(text)}`;
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`读取图片失败：${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * 把 Markdown 里的本地图片引用改写为 data URL（内联进正文）。
 * - 远程（http/https）/ 已内联（data:）的 src 跳过。
 * - 按图片完整相对路径优先配对，退一步用裸文件名。
 * - 同一图片只读一次（按文件名缓存）。
 */
async function rewriteImageSources(
  markdown: string,
  mdRelPath: string,
  imageIndex: Map<string, File>,
): Promise<string> {
  const mdDir = mdRelPath.includes('/')
    ? mdRelPath.slice(0, mdRelPath.lastIndexOf('/') + 1)
    : '';

  // 收集所有本地 src
  const localSrcs = new Set<string>();
  let m: RegExpExecArray | null;
  const probe = /!\[([^\]]*)\]\(([^)]+)\)/g;
  while ((m = probe.exec(markdown)) !== null) {
    const src = m[2];
    if (!/^(https?:|data:)/i.test(src)) localSrcs.add(src);
  }

  if (localSrcs.size === 0) return markdown;

  // 读取 data URL
  const fileCache = new Map<string, string>(); // fileName → dataUrl
  const srcToDataUrl = new Map<string, string>();
  for (const src of localSrcs) {
    const relSrc = src.replace(/^\.\//, '');
    const fullKey = mdDir ? `${mdDir}${relSrc}` : relSrc;
    const bareName = relSrc.split('/').pop() ?? relSrc;
    const imgFile = imageIndex.get(fullKey) ?? imageIndex.get(bareName);
    if (!imgFile) continue;

    let dataUrl = fileCache.get(imgFile.name);
    if (!dataUrl) {
      try {
        dataUrl = await fileToDataURL(imgFile);
        fileCache.set(imgFile.name, dataUrl);
      } catch {
        continue;
      }
    }
    srcToDataUrl.set(src, dataUrl);
  }

  if (srcToDataUrl.size === 0) return markdown;

  // 同步替换
  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (full, alt, src) => {
    const dataUrl = srcToDataUrl.get(src);
    return dataUrl ? `![${alt}](${dataUrl})` : full;
  });
}

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
  /** 目录导入入口：.md 与图片自动配对，图片以 data URL 内联进正文。 */
  importFilesWithImages: (files: File[]) => Promise<ImportResult>;
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
  imageIndex?: Map<string, File>,
  mdRelPath?: string,
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

  // 3.5 图片内联：把本地图片引用改写为 data URL
  if (imageIndex && imageIndex.size > 0) {
    markdown = await rewriteImageSources(markdown, mdRelPath ?? '', imageIndex);
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

  /** 目录导入入口：选目录后 .md 与图片自动配对，图片以 data URL 内联进正文。 */
  const importFilesWithImages = useCallback(
    async (files: File[]): Promise<ImportResult> => {
      const mdFiles = files.filter((f) => ALLOWED_EXT.test(f.name));
      const imageFiles = files.filter((f) => isImageFile(f.name));

      // 建立图片索引：完整相对路径 + 裸文件名
      const imageIndex = new Map<string, File>();
      for (const f of imageFiles) {
        const rel = getRelPath(f);
        if (rel) imageIndex.set(rel, f);
        imageIndex.set(f.name, f);
      }

      if (mdFiles.length === 0) {
        push('error', '所选目录中没有 .md / .markdown / .txt 文件');
        return { success: 0, failed: 0, errors: [] };
      }

      const imgCount = imageFiles.length;
      push(
        'info',
        `开始导入目录：${mdFiles.length} 篇博客${imgCount > 0 ? ` · ${imgCount} 张图片自动内联` : ''}…`,
      );

      const result: ImportResult = { success: 0, failed: 0, errors: [] };
      for (let i = 0; i < mdFiles.length; i++) {
        const file = mdFiles[i]!;
        push(
          'info',
          `(${i + 1}/${mdFiles.length}) 正在处理「${file.name}」(${formatSize(file.size)})`,
        );
        try {
          await parseAndCreate(file, createBlog, imageIndex, getRelPath(file));
          result.success += 1;
          push('success', `(${i + 1}/${mdFiles.length}) 「${file.name}」导入成功`);
        } catch (err) {
          const e = err as ImportError;
          if (e && typeof e === 'object' && 'code' in e) {
            result.failed += 1;
            result.errors.push(e);
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
            result.errors.push({
              filename: file.name,
              code: 'CREATE_FAILED',
              message,
              file,
            });
            push('error', message);
          }
        }
      }

      if (result.failed === 0) {
        push(
          'success',
          `目录导入完成 · 成功 ${result.success} 篇${imgCount > 0 ? ` · ${imgCount} 张图片已内联` : ''}`,
        );
      } else {
        push(
          'info',
          `目录导入完成 · 成功 ${result.success} 篇 · 失败 ${result.failed} 篇`,
        );
      }
      return result;
    },
    [createBlog, push, pushFull, retryFile],
  );

  return { importFile, importFiles, importFilesWithImages, retryFile };
}
