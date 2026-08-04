/**
 * 同步 payload 体积防护（v1.3-CloudSync-Chunked）
 *
 * 协议变更说明：
 * - v1.3-CloudSync-Trim 阶段：单文件 state.json，上限 900KB base64
 *   （GitHub Contents API 在 ~1MB 起回包不稳定，content 可能为空）
 * - v1.3-CloudSync-Chunked 阶段：拆成多片，单分片上限 200KB base64
 *   （5x 安全边界），不再有单文件上限
 *
 * 旧常量 MAX_SNAPSHOT_BASE64_BYTES / SnapshotTooLargeError 保留以维持
 * 既有测试与外部调用方兼容；新代码应使用 `assertChunkFits`。
 */

/** 历史保留：单文件 state.json 上限（900KB base64）。新协议下已无单文件，但保留常量避免破坏性变更。 */
export const MAX_SNAPSHOT_BASE64_BYTES = 900 * 1024;

/** 分片上限（200KB base64）。新协议下所有上传文件必须满足。 */
export const MAX_CHUNK_BASE64_BYTES = 200 * 1024;

/** payload 体积超限时抛出的错误（专门类型供 engine / UI 区分）。 */
export class SnapshotTooLargeError extends Error {
  /** 实际估算的 base64 字节数。 */
  public readonly size: number;
  /** 上限字节数。 */
  public readonly limit: number;
  constructor(size: number, limit: number) {
    super(
      `同步数据过大（${formatBytes(size)} 估算后，上限 ${formatBytes(limit)}）。` +
        `请清理附件或 AI 历史后再试，或考虑在「云同步」设置中调整同步范围。`,
    );
    this.name = 'SnapshotTooLargeError';
    this.size = size;
    this.limit = limit;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 远端 state.json 体积超限（v1.3-CloudSync-Trim 二次修复）。
 *
 * 触发场景：本地下载远端 state.json 时，GitHub Contents API 对超大文件（实测
 * 1.4MB 左右二进制）会返回 metadata 但 content 字段为空（`encoding: "none"`）。
 * 之前这条路径被误报为 INVALID_PAYLOAD → FORMAT_MISMATCH，掩盖了真实原因。
 *
 * 修复：github.ts 检测到 content 为空 + file size 超大时直接抛本错误，
 * mapToSyncError 把它映射为 PAYLOAD_TOO_LARGE 提示用户删除远端旧文件后重试。
 */
export class RemoteSnapshotTooLargeError extends Error {
  /** 远端文件实际字节数（从 GitHub API 的 `size` 字段拿到）。 */
  public readonly remoteSize: number;
  constructor(remoteSize: number) {
    super(
      `远端 state.json 体积过大（${formatBytes(remoteSize)}），GitHub 已不再返回内容。` +
        `请在仓库「${'(由实际 directory 配置决定)'}」中删除该文件后，在应用内点「立即同步」重试。`,
    );
    this.name = 'RemoteSnapshotTooLargeError';
    this.remoteSize = remoteSize;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 估算 JSON 字符串 base64 编码后的字节数。
 *
 * 不真的做 base64 编码（开销大），而是用近似公式：
 *   4 * ceil(N / 3) - 去除的填充字符数
 * 对 UTF-8 多字节字符保守地按 1 字符 = 1 字节计算（实际会更小）。
 * 估算值会比真实 base64 略偏大，对防护目的更安全。
 */
export function estimateBase64Bytes(json: string): number {
  const len = json.length;
  // 4 * ceil(n/3) 含 padding
  return Math.ceil((len * 4) / 3);
}

/**
 * 检查序列化后的快照 JSON 体积是否超出安全上限。
 * 超限则抛 SnapshotTooLargeError，调用方应 catch 并以用户可读错误上报。
 *
 * 注：本函数主要用于 v1.3 旧协议的单文件 state.json；新协议下应在每片
 * 上传前调用 `assertChunkFits`。
 */
export function assertSnapshotFits(serialized: string): void {
  const size = estimateBase64Bytes(serialized);
  if (size > MAX_SNAPSHOT_BASE64_BYTES) {
    throw new SnapshotTooLargeError(size, MAX_SNAPSHOT_BASE64_BYTES);
  }
}

/**
 * 检查单分片序列化后的体积是否超出 200KB base64 上限。
 * 新协议下每个 chunk 文件上传前必须调用。
 */
export function assertChunkFits(serialized: string): void {
  const size = estimateBase64Bytes(serialized);
  if (size > MAX_CHUNK_BASE64_BYTES) {
    throw new SnapshotTooLargeError(size, MAX_CHUNK_BASE64_BYTES);
  }
}

/** 把字节数格式化为可读字符串（KB / MB）。 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
