/**
 * M2 存储通道 — 存储适配器契约
 *
 * 定义 StorageBackend 接口（四个核心能力）及其相关类型。
 * 这是可替换性设计的核心——所有远端存储实现均实现此接口，
 * M3 同步引擎只依赖本接口，不关心实际存储后端（design.md §8）。
 */

/** 版本读取结果。 */
export interface VersionResult {
  version: string;
}

/** 扩展版本读取结果（含协议类型标识）。v1.3-CloudSync-Chunked 引入。 */
export interface ExtendedVersionResult extends VersionResult {
  /** 远端是否使用分片协议（manifest.json 存在）。 */
  chunked: boolean;
}

/** 快照下载结果。 */
export interface SnapshotDownloadResult {
  data: string;
  version: string;
}

/** 快照上传结果。 */
export interface SnapshotUploadResult {
  newVersion: string;
}

/** 连接测试结果。 */
export interface ConnectionTestResult {
  ok: boolean;
  error?: string;
}

/**
 * 存储适配器错误类型枚举。
 *
 * M3 同步引擎可据此区分错误种类以决定重试策略（如版本冲突需重新合并，
 * 网络错误可重试，授权错误应静默停止）。
 */
export type StorageBackendErrorCode =
  | 'VERSION_CONFLICT'    // 乐观锁版本冲突，需重新合并
  | 'NOT_FOUND'           // 远端资源不存在（首次同步时预期行为）
  | 'AUTH_FAILED'         // 令牌无效或无权限
  | 'NETWORK_ERROR'       // 网络不可达
  | 'RATE_LIMITED'        // API 限流
  | 'STORAGE_FULL'        // 存储配额不足
  | 'INVALID_PAYLOAD'     // 载荷格式错误
  | 'REPO_EMPTY'          // 仓库为空（无 commit/分支），需先初始化同步目录
  | 'UNKNOWN';            // 其他

/** 存储适配器自定义错误。 */
export class StorageBackendError extends Error {
  code: StorageBackendErrorCode;

  constructor(code: StorageBackendErrorCode, message: string) {
    super(message);
    this.name = 'StorageBackendError';
    this.code = code;
  }
}

/**
 * 存储后端适配器契约。
 *
 * 对外只承诺四件事，干净、可替换（design.md §8）：
 * 1. readVersion  — 读远端版本标识（不下载内容）
 * 2. downloadSnapshot — 下载快照内容 + 版本标识
 * 3. uploadSnapshot   — 带乐观锁版本的上传
 * 4. uploadAttachment / downloadAttachment — 附件独立读写
 */
export interface StorageBackend {
  /** 读取远端版本标识（仅 HEAD 请求语义，不下载内容）。 */
  readVersion(): Promise<VersionResult>;

  /**
   * 读取扩展版本信息（含协议类型）。v1.3-CloudSync-Chunked 引入。
   * 默认实现：先调 readVersion()，再判定 chunked（通过读 manifest.json）。
   * 旧 backend 不实现此方法时，调用方应回退到全量推送。
   */
  readExtendedVersion?(): Promise<ExtendedVersionResult>;

  /** 下载完整快照内容及其版本标识。 */
  downloadSnapshot(): Promise<SnapshotDownloadResult>;

  /**
   * 上传快照。
   *
   * @param data - 序列化后的快照 JSON 字符串
   * @param baseVersion - 基于哪个版本修改（乐观锁比较依据）
   * @param options - 可选：
   *   - dirtyChunks: 逻辑分片名集合（'chunk-0'..'chunk-4'）。只推送这些分片，
   *     未列出的分片保留远端原文件不动。undefined/不传 = 全量推送。
   * @throws {StorageBackendError} 当远端版本与 baseVersion 不一致时抛 VERSION_CONFLICT
   */
  uploadSnapshot(
    data: string,
    baseVersion: string,
    options?: { dirtyChunks?: Set<string> },
  ): Promise<SnapshotUploadResult>;

  /** 上传单个附件 blob。 */
  uploadAttachment(key: string, blob: Blob): Promise<void>;

  /** 下载单个附件 blob。 */
  downloadAttachment(key: string): Promise<Blob>;
}
