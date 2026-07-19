/**
 * 错误归一化工具（store 内部使用）
 *
 * Repository 层抛出的可能是 `AppError`（结构化）、`Error`（原生）、或其它任意值。
 * UI 层需要统一的 `{ code, message, ... }` 结构体来 switch on `code`。
 *
 * 此函数把任意 `unknown` 归一化为 `AppErrorPayload`。
 */

import { AppError, type AppErrorPayload } from '@/db/repos/types';

/**
 * 把任意 throw 值归一化为 AppErrorPayload。
 *
 * - 已是 AppError → 返回其内部结构
 * - 原生 Error → 包成 `code: 'UNKNOWN'`，附 cause
 * - 其它 → 包成 `code: 'UNKNOWN'`，cause 是原值
 */
export function toAppErrorPayload(e: unknown): AppErrorPayload {
  if (e instanceof AppError) return e.error;
  if (e instanceof Error) {
    return { code: 'UNKNOWN', message: e.message, cause: e };
  }
  return { code: 'UNKNOWN', message: 'Unknown error', cause: e };
}
