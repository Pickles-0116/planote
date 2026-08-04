/**
 * SyncError / mapToSyncError 测试（v1.3-CloudSync-Trim 增补）
 *
 * 重点验证：
 * - SnapshotTooLargeError → PAYLOAD_TOO_LARGE 类型，且透出具体大小信息
 * - 已有映射路径不受影响
 */

import { describe, it, expect } from 'vitest';
import { mapToSyncError, SYNC_ERROR_MESSAGES } from '../sync-error';
import { SnapshotTooLargeError } from '../size-guard';
import { StorageBackendError } from '../types';

describe('mapToSyncError', () => {
  it('SnapshotTooLargeError → PAYLOAD_TOO_LARGE，userMessage 透出具体大小', () => {
    const orig = new SnapshotTooLargeError(2_500_000, 921_600);
    const err = mapToSyncError(orig);

    expect(err.type).toBe('PAYLOAD_TOO_LARGE');
    // 2.5MB 用 formatBytes 转成 "2.38 MB"（保留两位小数）
    expect(err.userMessage).toMatch(/2\.\d+ MB/);
    // 921600 字节 = 900.0 KB
    expect(err.userMessage).toMatch(/900\.0 KB/);
    expect(err.cause).toBe(orig);
  });

  it('PAYLOAD_TOO_LARGE 在 SYNC_ERROR_MESSAGES 里有兜底提示', () => {
    expect(SYNC_ERROR_MESSAGES.PAYLOAD_TOO_LARGE).toMatch(/清理|暂停/);
  });

  it('StorageBackendError INVALID_PAYLOAD 仍映射为 FORMAT_MISMATCH（不受新增类型影响）', () => {
    const err = mapToSyncError(
      new StorageBackendError('INVALID_PAYLOAD', 'some issue'),
    );
    expect(err.type).toBe('FORMAT_MISMATCH');
  });

  it('未知错误仍走 UNKNOWN 兜底', () => {
    const err = mapToSyncError(new Error('神秘失败'));
    expect(err.type).toBe('UNKNOWN');
  });
});
