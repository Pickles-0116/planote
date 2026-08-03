/**
 * M3 同步引擎 — 错误分类与映射（T3.8）
 *
 * 将后端错误（HTTP 4xx/5xx、网络异常、格式解析失败）映射为用户可读的中文错误提示。
 * 同步引擎捕获的原始错误统一转为 `SyncError`，供 M4 UI 展示。
 *
 * 错误类型枚举与 userMessage 映射表见 design.md §7 安全边界与 spec.md Scenario。
 */

/** 同步错误类型枚举。 */
export type SyncErrorType =
  | 'TOKEN_INVALID' // 401/403 → token 失效
  | 'REPO_NOT_FOUND' // 404 → 仓库/分支不存在
  | 'VERSION_CONFLICT' // 版本冲突 → 乐观锁重试
  | 'FORMAT_MISMATCH' // 快照格式版本不识别
  | 'NETWORK_ERROR' // 网络不可达
  | 'UNKNOWN'; // 其他

/** 错误类型到用户可读消息的映射。 */
export const SYNC_ERROR_MESSAGES: Record<SyncErrorType, string> = {
  TOKEN_INVALID: '访问令牌已失效，请重新生成并填写',
  REPO_NOT_FOUND: '无法访问该仓库，请检查仓库名与分支',
  VERSION_CONFLICT: '远端数据正在被其他设备更新，正在重试…',
  FORMAT_MISMATCH: '远端数据格式不兼容，已跳过',
  NETWORK_ERROR: '网络不可用，变更将在恢复后自动同步',
  UNKNOWN: '同步出错，请稍后重试',
};

/**
 * 同步错误类。
 *
 * 统一包装下层 StorageBackendError 与网络异常，提供 `type` 枚举供引擎决策
 * （如 NETWORK_ERROR 应保留队列重试，TOKEN_INVALID 应暂停自动同步），
 * 以及 `userMessage` 供 UI 直出。
 */
export class SyncError extends Error {
  /** 错误类型枚举。 */
  public readonly type: SyncErrorType;
  /** 用户可读的中文错误描述（直出到 UI）。 */
  public readonly userMessage: string;
  /** 原始错误（调试用）。 */
  public readonly cause?: unknown;

  constructor(type: SyncErrorType, cause?: unknown, message?: string) {
    const userMessage = message ?? SYNC_ERROR_MESSAGES[type];
    super(userMessage);
    this.name = 'SyncError';
    this.type = type;
    this.userMessage = userMessage;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 从任意错误映射为 SyncError。
 *
 * 识别 StorageBackendError、网络异常（TypeError）、格式解析错误等，
 * 转译为 SyncError 类型枚举与中文提示。
 */
import { StorageBackendError } from './types';

export function mapToSyncError(error: unknown): SyncError {
  // 已经是 SyncError → 直接返回
  if (error instanceof SyncError) return error;

  // StorageBackendError（M2 存储通道）
  if (error instanceof StorageBackendError) {
    switch (error.code) {
      case 'AUTH_FAILED':
        return new SyncError('TOKEN_INVALID', error);
      case 'NOT_FOUND':
        return new SyncError('REPO_NOT_FOUND', error);
      case 'VERSION_CONFLICT':
        return new SyncError('VERSION_CONFLICT', error);
      case 'NETWORK_ERROR':
        return new SyncError('NETWORK_ERROR', error);
      case 'INVALID_PAYLOAD':
        return new SyncError('FORMAT_MISMATCH', error);
      default:
        return new SyncError('UNKNOWN', error);
    }
  }

  // 网络异常（fetch 失败时抛 TypeError）
  if (error instanceof TypeError) {
    return new SyncError('NETWORK_ERROR', error);
  }

  // 格式解析错误（deserializeSnapshot 抛的 Error）
  if (
    error instanceof Error &&
    (error.message.includes('格式版本') ||
      error.message.includes('反序列化') ||
      error.message.includes('JSON'))
  ) {
    return new SyncError('FORMAT_MISMATCH', error);
  }

  // 兜底
  return new SyncError(
    'UNKNOWN',
    error,
    error instanceof Error ? `同步出错：${error.message}` : '同步出错，请稍后重试',
  );
}
