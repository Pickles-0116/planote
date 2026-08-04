/**
 * M2 存储通道 — GitHub 仓库适配器
 *
 * 通过 GitHub REST Contents API 实现 StorageBackend。
 *
 * 存储协议（v1.3-CloudSync-Chunked）：
 * - 新数据走分片：{directory}/chunks/manifest.json + chunk-*.json
 * - 老数据兼容：{directory}/state.json（首次推送时自动迁移到分片）
 * - 附件：{directory}/attachments/{key}
 *
 * 认证：使用 SyncConfig.token（Bearer token，仅本地 meta，绝不进载荷）。
 * 版本标识：使用远端 manifest 的 blob SHA 作为乐观锁版本。
 * 乐观并发：上传时带 base SHA，GitHub API 校验不一致时返回 422 → 抛 VERSION_CONFLICT。
 *
 * 体积策略（v1.3-CloudSync-Chunked）：
 * - 单分片目标 ≤ 200KB base64（远低于 GitHub Contents API ~1MB 隐形边界）
 * - 上传路径完全避开单文件 1MB 死锁
 */

import {
  type StorageBackend,
  type VersionResult,
  type SnapshotDownloadResult,
  type SnapshotUploadResult,
  StorageBackendError,
} from './types';
import type { SyncConfig } from '@/db/sync/types';
import { utf8ToBase64, base64ToUtf8 } from './utils';
import { RemoteSnapshotTooLargeError, assertChunkFits } from './size-guard';
import {
  buildManifest,
  deserializeChunk,
  serializeChunk,
  splitSnapshotIntoChunks,
  mergeChunksIntoSnapshot,
  getSubChunkList,
  type ChunkedManifest,
  type ChunkMeta,
  DATA_CHUNK_NAMES,
  TOMBSTONE_CHUNK_NAME,
  CHUNKED_FORMAT_VERSION,
  CHUNK_TO_TABLES,
} from './chunks';
import type { SyncableTableName, Tombstone } from '@/db/sync/types';

/** GitHub REST API 基础 URL。 */
const GITHUB_API_BASE = 'https://api.github.com';

/** 空仓库初始化 .gitkeep 后重试上传的最大次数。 */
const MAX_EMPTY_REPO_RETRIES = 2;

/** 序列化后的全量快照载荷（manifest 内的快照 payload）。 */
interface SerializedSnapshot {
  tables: Partial<Record<SyncableTableName, Record<string, unknown>[]>>;
  tombstones: Tombstone[];
}

/** 适配器内部使用的版本结果（含 manifest 是否存在）。 */
interface ExtendedVersionResult extends VersionResult {
  /** 远端是否为分片模式（manifest.json 存在）。 */
  chunked: boolean;
}

/** GitHub Contents API 返回的单项响应类型。 */
interface GitHubContentItem {
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  name: string;
  path: string;
  sha: string;
  content?: string; // base64 编码
  encoding?: string;
  size: number;
}

/** GitHub Contents API PUT 响应类型。 */
interface GitHubPutResponse {
  content: Pick<GitHubContentItem, 'sha'>;
}

/**
 * 从 SyncConfig 解析 owner / repo。
 */
function parseRepo(repo: string): { owner: string; repo: string } {
  const parts = repo.split('/');
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new StorageBackendError(
      'INVALID_PAYLOAD',
      `无效的仓库标识 "${repo}"，格式应为 "用户名/仓库名"`,
    );
  }
  return { owner: parts[0]!, repo: parts[1]! };
}

/**
 * GitHub 仓库后端适配器（分片协议版）。
 */
export class GitHubBackend implements StorageBackend {
  private config: SyncConfig;
  private owner: string;
  private repo: string;
  private dir: string;
  /** 兼容老协议：state.json 路径。 */
  private statePath: string;
  /** 附件目录在仓库中的路径前缀。 */
  private attachmentsPrefix: string;
  /** 分片 manifest 路径。 */
  private manifestPath: string;
  /** 单个 chunk 文件路径（按 name）。 */
  private chunkPath(name: string): string {
    return `${this.dir}/chunks/${name}.json`;
  }

  constructor(config: SyncConfig) {
    this.config = config;
    const parsed = parseRepo(config.repo);
    this.owner = parsed.owner;
    this.repo = parsed.repo;
    this.dir = config.directory.replace(/^\/|\/$/g, '');
    this.statePath = `${this.dir}/state.json`;
    this.attachmentsPrefix = `${this.dir}/attachments`;
    this.manifestPath = `${this.dir}/chunks/manifest.json`;
  }

  /** 构建 GitHub API 请求头。 */
  private headers(): Record<string, string> {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.config.token}`,
      'User-Agent': 'planote-cloud-sync',
    };
  }

  /** 构建 Contents API URL。 */
  private contentsUrl(path: string): string {
    return `${GITHUB_API_BASE}/repos/${this.owner}/${this.repo}/contents/${path}`;
  }

  /** 处理 GitHub API 响应，将错误状态码转为 StorageBackendError。 */
  private async handleResponse(
    response: Response,
    context: string,
  ): Promise<Response> {
    if (response.ok) return response;

    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch {
      // ignore parse error
    }

    const lower = errorBody.toLowerCase();

    if (response.status === 401 || response.status === 403) {
      if (lower.includes('rate') || lower.includes('limit')) {
        throw new StorageBackendError('RATE_LIMITED', `API 限流：${context}`);
      }
      throw new StorageBackendError('AUTH_FAILED', `认证失败（${response.status}）：${context}`);
    }

    if (response.status === 404) {
      throw new StorageBackendError('NOT_FOUND', `资源不存在（${context}）`);
    }

    if (response.status === 422 && lower.includes('sha')) {
      throw new StorageBackendError(
        'VERSION_CONFLICT',
        '版本冲突：远端已被其他设备更新，请重新合并后上传',
      );
    }

    // 空仓库（无任何 commit、无实际分支）无法通过 Contents API 直接写入。
    if (
      (response.status === 422 || response.status === 409) &&
      (lower.includes('empty') || lower.includes('initial commit'))
    ) {
      throw new StorageBackendError(
        'REPO_EMPTY',
        '仓库为空，正在初始化同步目录…',
      );
    }

    if (response.status === 409) {
      throw new StorageBackendError(
        'VERSION_CONFLICT',
        '版本冲突：远端版本与 baseVersion 不一致',
      );
    }

    throw new StorageBackendError(
      'UNKNOWN',
      `GitHub API 错误（${response.status}）：${context} — ${errorBody.slice(0, 200)}`,
    );
  }

  // ========== 内部：底层文件读写（带 404 透传，避免被 handleResponse 转成 NOT_FOUND 错误） ==========

  /**
   * 读取单个文件原始内容。文件不存在时返回 null。
   */
  private async readRawFile(
    path: string,
  ): Promise<{ content: string; size: number; sha: string; encoding: string } | null> {
    const url = `${this.contentsUrl(path)}?ref=${encodeURIComponent(this.config.branch)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers(),
    });
    if (response.status === 404) return null;
    const handled = await this.handleResponse(response, `readRawFile(${path})`);
    const data = (await handled.json()) as GitHubContentItem;
    return {
      content: data.content ?? '',
      size: data.size,
      sha: data.sha,
      encoding: data.encoding ?? '',
    };
  }

  /**
   * 写入单个文件（带乐观锁）。baseVersion 为空表示新建。
   */
  private async writeRawFile(
    path: string,
    content: string,
    baseVersion: string,
    commitMessage: string,
  ): Promise<string> {
    const attempt = async (): Promise<string> => {
      const encoded = utf8ToBase64(content);
      const body: Record<string, unknown> = {
        message: commitMessage,
        content: encoded,
        branch: this.config.branch,
      };
      if (baseVersion) body.sha = baseVersion;
      const url = this.contentsUrl(path);
      const response = await fetch(url, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify(body),
      });
      const handled = await this.handleResponse(response, `writeRawFile(${path})`);
      const result = (await handled.json()) as GitHubPutResponse;
      return result.content.sha;
    };
    return this.retryWithEmptyRepoInit(attempt);
  }

  /**
   * 删除单个文件（带乐观锁）。
   */
  private async deleteRawFile(path: string, baseVersion: string, message: string): Promise<void> {
    const url = this.contentsUrl(path);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.headers(),
      body: JSON.stringify({
        message,
        sha: baseVersion,
        branch: this.config.branch,
      }),
    });
    await this.handleResponse(response, `deleteRawFile(${path})`);
  }

  // ========== StorageBackend 接口实现 ==========

  /**
   * 读取远端版本标识。
   *
   * 优先级：manifest（分片）> state.json（兼容老协议）。返回的 version 是
   * 当前实际生效文件的 blob SHA，作为乐观锁的 baseVersion。
   */
  async readVersion(): Promise<VersionResult> {
    const ext = await this.readExtendedVersion();
    return { version: ext.version };
  }

  /**
   * 读取远端版本（含分片/单文件标记）。供 engine 决策走哪条路径。
   */
  async readExtendedVersion(): Promise<ExtendedVersionResult> {
    // 先查 manifest
    const manifest = await this.readRawFile(this.manifestPath);
    if (manifest) {
      return { version: manifest.sha, chunked: true };
    }
    // 退到老 state.json
    const legacy = await this.readRawFile(this.statePath);
    if (legacy) {
      return { version: legacy.sha, chunked: false };
    }
    return { version: '', chunked: false };
  }

  /**
   * 下载快照内容及其版本标识。
   *
   * 分片模式：读 manifest + 全部 chunk + tombstone chunk，拼成完整 SnapshotData。
   * 兼容模式：直接读 state.json 并 deserialize。
   * 文件不存在（首次同步）时返回空数据。
   */
  async downloadSnapshot(): Promise<SnapshotDownloadResult> {
    // 优先分片
    const manifestRaw = await this.readRawFile(this.manifestPath);
    if (manifestRaw) {
      if (manifestRaw.size > 1024 * 1024) {
        throw new RemoteSnapshotTooLargeError(manifestRaw.size);
      }
      if (!manifestRaw.content || manifestRaw.encoding !== 'base64') {
        throw new StorageBackendError(
          'INVALID_PAYLOAD',
          `远端 manifest.json 编码异常（encoding=${manifestRaw.encoding ?? '<missing>'}）`,
        );
      }
      const manifestJson = base64ToUtf8(manifestRaw.content);
      const manifest = parseManifest(manifestJson);

      // 收集所有子片名（兼容老版 manifest 形态）
      const allSubNames: Array<{ chunkKey: string; subName: string }> = [];
      for (const [chunkKey, meta] of Object.entries(manifest.chunks)) {
        const subList = getSubChunkList(meta, chunkKey);
        for (const sub of subList) {
          allSubNames.push({ chunkKey, subName: sub.name });
        }
      }

      // 并行读所有子片
      const subChunkResults = await Promise.all(
        allSubNames.map(async ({ subName }) => {
          const raw = await this.readRawFile(this.chunkPath(subName));
          if (!raw) {
            throw new StorageBackendError(
              'INVALID_PAYLOAD',
              `远端缺少子片 ${subName}（manifest 声明存在但文件不存在）`,
            );
          }
          if (raw.size > 1024 * 1024) {
            throw new RemoteSnapshotTooLargeError(raw.size);
          }
          if (!raw.content || raw.encoding !== 'base64') {
            throw new StorageBackendError(
              'INVALID_PAYLOAD',
              `远端子片 ${subName} 编码异常`,
            );
          }
          const json = base64ToUtf8(raw.content);
          return {
            name: subName,
            payload: deserializeChunk(json) as { tables: Partial<Record<SyncableTableName, Record<string, unknown>[]>> },
          };
        }),
      );

      // 读墓碑分片
      const tombstoneRaw = await this.readRawFile(this.chunkPath(manifest.tombstoneChunk));
      let tombstones: Tombstone[] = [];
      if (tombstoneRaw) {
        if (tombstoneRaw.size > 1024 * 1024) {
          throw new RemoteSnapshotTooLargeError(tombstoneRaw.size);
        }
        if (tombstoneRaw.content && tombstoneRaw.encoding === 'base64') {
          const tJson = base64ToUtf8(tombstoneRaw.content);
          const t = deserializeChunk(tJson) as { tombstones: Tombstone[] };
          tombstones = t.tombstones;
        }
      }

      const merged = mergeChunksIntoSnapshot(manifest, subChunkResults, tombstones);
      // 仍然以单文件 JSON 形式返回（用 SNAPSHOT_FORMAT_VERSION=1 的旧 schema），
      // engine 一侧不知道分片存在，但合并后结构兼容。
      const wrapped = {
        formatVersion: 1, // 兼容旧 schema
        generatedAt: manifest.generatedAt,
        tables: merged.tables,
        tombstones: merged.tombstones,
      };
      return {
        data: JSON.stringify(wrapped),
        version: manifestRaw.sha, // 用 manifest 的 SHA 作为 version
      };
    }

    // 兼容老 state.json
    const url = `${this.contentsUrl(this.statePath)}?ref=${encodeURIComponent(this.config.branch)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers(),
    });
    if (response.status === 404) {
      return { data: '', version: '' };
    }
    const handled = await this.handleResponse(response, 'downloadSnapshot');
    const data = (await handled.json()) as GitHubContentItem;
    if (!data.content || data.encoding !== 'base64') {
      const fileSize = typeof data.size === 'number' ? data.size : 0;
      if (fileSize > 1024 * 1024) {
        throw new RemoteSnapshotTooLargeError(fileSize);
      }
      throw new StorageBackendError(
        'INVALID_PAYLOAD',
        `远端 state.json 编码格式异常（content 长度=${data.content?.length ?? 0}，` +
          `encoding=${data.encoding ?? '<missing>'}，file size=${data.size ?? '<unknown>'} 字节）`,
      );
    }
    const decoded = base64ToUtf8(data.content);
    return { data: decoded, version: data.sha };
  }

  /**
   * 上传快照（带乐观锁）。
   *
   * 总是走分片路径（即使 baseVersion 来自老 state.json）。如果远端是老格式，
   * 首次上传时会一并把 state.json 改名为 state.json.legacy 并写入分片结构。
   */
  async uploadSnapshot(
    data: string,
    baseVersion: string,
  ): Promise<SnapshotUploadResult> {
    // 解析 data（兼容旧 schema 形式）
    const snapshot = parseSnapshotData(data);

    // 1. 拆分成 chunk + tombstone
    const dataChunks = splitSnapshotIntoChunks(snapshot);
    const tombstoneJson = serializeChunk({ tombstones: snapshot.tombstones });
    assertChunkFits(tombstoneJson);
    const tombstoneName = TOMBSTONE_CHUNK_NAME;

    // 2. 判断 baseVersion 指向的是 manifest 还是 state.json
    const ext = await this.readExtendedVersion();
    const isLegacyBase = baseVersion && ext.version === baseVersion && !ext.chunked;
    const isManifestBase = baseVersion && ext.version === baseVersion && ext.chunked;

    // 3. 上传所有数据分片
    // 按"逻辑分片 → 子片列表"分组（chunk-1-a / chunk-1-b 同属 chunk-1）
    const newChunkMetas: Record<string, ChunkMeta> = {};
    for (const { name, payload } of dataChunks) {
      const json = serializeChunk(payload);
      // 单子片体积防护（防止单记录超大撑爆 200KB 上限）
      assertChunkFits(json);
      const chunkBaseVersion = isManifestBase
        ? (ext.version && (await this.readRawFile(this.chunkPath(name)))?.sha) || ''
        : ''; // 新协议下首次写或从老协议迁移：baseVersion 为空
      const sha = await this.writeRawFile(
        this.chunkPath(name),
        json,
        chunkBaseVersion,
        `sync: update ${name} (base ${(baseVersion || 'init').slice(0, 7)})`,
      );

      // 确定这个子片属于哪个逻辑分片（chunk-1-a → chunk-1；chunk-1 → chunk-1）
      const logicalKey = name.replace(/-[a-z]$/, '');
      const logicalTables = (CHUNK_TO_TABLES[logicalKey] ?? []) as SyncableTableName[];

      // 追加到对应逻辑分片的 subChunks 列表
      if (!newChunkMetas[logicalKey]) {
        newChunkMetas[logicalKey] = {
          tables: logicalTables,
          subChunks: [],
        };
      }
      newChunkMetas[logicalKey]!.subChunks.push({
        name,
        sha,
        size: json.length,
      });
    }

    // 4. 上传墓碑分片
    const tombBaseVersion = isManifestBase
      ? (ext.version && (await this.readRawFile(this.chunkPath(tombstoneName)))?.sha) || ''
      : '';
    const tombSha = await this.writeRawFile(
      this.chunkPath(tombstoneName),
      tombstoneJson,
      tombBaseVersion,
      `sync: update ${tombstoneName} (base ${(baseVersion || 'init').slice(0, 7)})`,
    );

    // 5. 写 manifest
    const manifest = buildManifest(newChunkMetas, { sha: tombSha, size: tombstoneJson.length });
    const manifestJson = JSON.stringify(manifest);
    assertChunkFits(manifestJson);
    const manifestBase = isManifestBase ? baseVersion : '';
    const newManifestSha = await this.writeRawFile(
      this.manifestPath,
      manifestJson,
      manifestBase,
      `sync: update manifest (base ${(baseVersion || 'init').slice(0, 7)})`,
    );

    // 6. 如果远端之前是老 state.json，把它归档为 state.json.legacy（一次性）
    if (isLegacyBase) {
      try {
        // 已经在 ext 里读到 sha 了；重命名思路：把老 state.json 拉一份出来，
        // 写到 state.json.legacy，再删老 state.json。
        const legacyRaw = await this.readRawFile(this.statePath);
        if (legacyRaw && legacyRaw.content) {
          const legacyJson = base64ToUtf8(legacyRaw.content);
          // 写到 .legacy
          await this.writeRawFile(
            `${this.dir}/state.json.legacy`,
            legacyJson,
            '', // 新建
            'sync: archive legacy state.json after chunked migration',
          );
        }
        // 删除老 state.json
        if (legacyRaw) {
          await this.deleteRawFile(
            this.statePath,
            legacyRaw.sha,
            'sync: remove legacy state.json after chunked migration',
          );
        }
      } catch (err) {
        // 归档失败不阻断主流程（分片已经写成功了）
        // eslint-disable-next-line no-console
        console.warn('[sync] 归档 legacy state.json 失败（不影响同步）:', err);
      }
    }

    return { newVersion: newManifestSha };
  }

  /**
   * 初始化空仓库的同步目录。
   */
  private async initializeSyncDir(): Promise<void> {
    const path = `${this.dir}/.gitkeep`;
    const url = this.contentsUrl(path);
    const response = await fetch(url, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({
        message: 'sync: initialize sync directory',
        content: btoa('\n'),
        branch: this.config.branch,
      }),
    });
    await this.handleResponse(response, 'initializeSyncDir');
  }

  /**
   * 空仓库自愈包装：捕获 REPO_EMPTY → 初始化同步目录 → 重试原操作。
   */
  private async retryWithEmptyRepoInit<T>(
    attempt: () => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;
    for (
      let attemptCount = 0;
      attemptCount <= MAX_EMPTY_REPO_RETRIES;
      attemptCount++
    ) {
      try {
        return await attempt();
      } catch (error) {
        lastError = error;
        const isRepoEmpty =
          error instanceof StorageBackendError && error.code === 'REPO_EMPTY';
        if (!isRepoEmpty || attemptCount >= MAX_EMPTY_REPO_RETRIES) {
          throw error;
        }
        try {
          await this.initializeSyncDir();
        } catch {
          throw error;
        }
      }
    }
    throw lastError;
  }

  /** 上传单个附件 blob。 */
  async uploadAttachment(key: string, blob: Blob): Promise<void> {
    const attempt = async (): Promise<void> => {
      const path = `${this.attachmentsPrefix}/${encodeURIComponent(key)}`;
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!);
      }
      const encoded = btoa(binary);
      const body = {
        message: `sync: upload attachment ${key}`,
        content: encoded,
        branch: this.config.branch,
      };
      const url = this.contentsUrl(path);
      const response = await fetch(url, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify(body),
      });
      if (response.status === 422) {
        const getUrl = `${this.contentsUrl(path)}?ref=${encodeURIComponent(this.config.branch)}`;
        const getResp = await fetch(getUrl, {
          method: 'GET',
          headers: this.headers(),
        });
        if (getResp.ok) {
          const existing = (await getResp.json()) as GitHubContentItem;
          const retryBody = { ...body, sha: existing.sha };
          const retryResp = await fetch(url, {
            method: 'PUT',
            headers: this.headers(),
            body: JSON.stringify(retryBody),
          });
          await this.handleResponse(retryResp, `uploadAttachment(${key})`);
          return;
        }
      }
      await this.handleResponse(response, `uploadAttachment(${key})`);
    };
    await this.retryWithEmptyRepoInit(attempt);
  }

  /** 下载单个附件 blob。 */
  async downloadAttachment(key: string): Promise<Blob> {
    const path = `${this.attachmentsPrefix}/${encodeURIComponent(key)}`;
    const url = `${this.contentsUrl(path)}?ref=${encodeURIComponent(this.config.branch)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers(),
    });
    const handled = await this.handleResponse(response, `downloadAttachment(${key})`);
    const data = (await handled.json()) as GitHubContentItem;
    if (!data.content || data.encoding !== 'base64') {
      throw new StorageBackendError(
        'INVALID_PAYLOAD',
        `附件 ${key} 编码格式异常（content 长度=${data.content?.length ?? 0}，` +
          `encoding=${data.encoding ?? '<missing>'}，file size=${data.size ?? '<unknown>'} 字节）`,
      );
    }
    const decoded = atob(data.content);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return new Blob([bytes]);
  }
}

// ========== 模块级辅助 ==========

/** 解析 manifest JSON。 */
function parseManifest(json: string): ChunkedManifest {
  const parsed = JSON.parse(json) as ChunkedManifest;
  if (typeof parsed.formatVersion !== 'number') {
    throw new Error('manifest 缺少 formatVersion');
  }
  if (parsed.formatVersion !== CHUNKED_FORMAT_VERSION) {
    throw new Error(
      `不支持的 manifest 版本 ${parsed.formatVersion}（当前 ${CHUNKED_FORMAT_VERSION}）`,
    );
  }
  if (!parsed.chunks || typeof parsed.chunks !== 'object') {
    throw new Error('manifest.chunks 缺失或类型错误');
  }
  if (typeof parsed.tombstoneChunk !== 'string' || typeof parsed.tombstoneSha !== 'string') {
    throw new Error('manifest 缺少 tombstone 元信息');
  }
  return parsed;
}

/**
 * 解析 engine 传来的"快照 JSON 字符串"。
 *
 * 兼容两种形态：
 * 1. 新版带 formatVersion 的 SnapshotPayload（mergeSnapshots 输出）
 * 2. 旧版纯 tables + tombstones
 */
function parseSnapshotData(json: string): SerializedSnapshot {
  const parsed = JSON.parse(json) as Partial<{
    formatVersion: number;
    tables: Partial<Record<SyncableTableName, Record<string, unknown>[]>>;
    tombstones: Tombstone[];
  }>;
  if (!parsed || typeof parsed !== 'object') {
    throw new StorageBackendError('INVALID_PAYLOAD', '快照反序列化失败：payload 不是对象');
  }
  const tables = (parsed.tables ?? {}) as Partial<Record<SyncableTableName, Record<string, unknown>[]>>;
  const tombstones = Array.isArray(parsed.tombstones) ? parsed.tombstones : [];
  return { tables, tombstones };
}

// 抑制 unused 警告（DATA_CHUNK_NAMES 通过 chunks 模块的间接依赖保留）
void DATA_CHUNK_NAMES;
