/**
 * M2 存储通道 + M3 同步引擎 — 统一导出
 *
 * 为外层提供干净的导入入口。
 */

export type {
  StorageBackend,
  VersionResult,
  SnapshotDownloadResult,
  SnapshotUploadResult,
  ConnectionTestResult,
  StorageBackendErrorCode,
} from './types';
export { StorageBackendError } from './types';

export { GitHubBackend } from './github';

export type { SnapshotPayload, SnapshotData } from './snapshot';
export { serializeSnapshot, deserializeSnapshot, SNAPSHOT_FORMAT_VERSION } from './snapshot';

export { AttachmentManager } from './attachments';

export { validateNoSecrets, validatePayload } from './validate';

export { testConnection } from './test-connection';

// ==================== M3 同步引擎 ====================

export { SyncEngine } from './engine';
export { mergeSnapshots, applyRemoteTombstones, filterExpiredTombstones } from './merger';
export { SyncError, mapToSyncError } from './sync-error';
export type { SyncErrorType } from './sync-error';
