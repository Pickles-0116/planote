/**
 * attachmentValidation - 附件校验工具（add-blog-attachment 增量）
 *
 * 规则：
 * - MIME 必须在白名单内：image/jpeg, image/png, image/gif, image/webp, application/pdf
 * - 大小 ≤ 5 × 1024 × 1024 bytes
 * - 校验失败返回 `{ ok: false, error: '中文提示' }`
 *
 * 设计：返回判别联合（`{ ok: true } | { ok: false, error: string }`），
 * 调用方用 if (!result.ok) 守卫，避免抛错打断 UI 流。
 */

export const ALLOWED_MIME_TYPES: ReadonlyArray<string> = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];

/** 单附件最大字节数（5 MB）。 */
export const MAX_SIZE_BYTES: number = 5 * 1024 * 1024;

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/** MIME 命中白名单 → 'image' | 'pdf' | 'other'。 */
export type AttachmentKind = 'image' | 'pdf' | 'other';

export function getAttachmentKind(mime: string): AttachmentKind {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  return 'other';
}

/** 校验文件 MIME + 大小。 */
export function validateAttachment(file: File): ValidationResult {
  // 1) MIME 白名单
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: '仅支持图片和 PDF' };
  }
  // 2) 大小
  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, error: '文件超过 5MB' };
  }
  return { ok: true };
}

/** 格式化字节数为 KB / MB / B 字符串。 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
