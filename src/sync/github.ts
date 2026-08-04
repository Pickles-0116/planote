/**
 * M2 存储通道 — GitHub 仓库适配器
 *
 * 通过 GitHub REST Contents API 实现 StorageBackend。
 * 快照存 `{directory}/state.json`，附件存 `{directory}/attachments/{key}`。
 *
 * 认证：使用 SyncConfig.token（Bearer token，仅本地 meta，绝不进载荷）。
 * 版本标识：使用远端 state.json 的 blob SHA 作为乐观锁版本。
 * 乐观并发：上传时带 base SHA，GitHub API 校验不一致时返回 422 → 抛 VERSION_CONFLICT。
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

/** GitHub REST API 基础 URL。 */
const GITHUB_API_BASE = 'https://api.github.com';

/** 空仓库初始化 .gitkeep 后重试上传的最大次数。 */
const MAX_EMPTY_REPO_RETRIES = 2;

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
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new StorageBackendError(
      'INVALID_PAYLOAD',
      `无效的仓库标识 "${repo}"，格式应为 "用户名/仓库名"`,
    );
  }
  return { owner: parts[0]!, repo: parts[1]! };
}

/**
 * GitHub 仓库后端适配器。
 *
 * @example
 * ```ts
 * const backend = new GitHubBackend(config);
 * const { version } = await backend.readVersion();
 * ```
 */
export class GitHubBackend implements StorageBackend {
  private config: SyncConfig;
  private owner: string;
  private repo: string;
  /** state.json 在仓库中的完整路径。 */
  private statePath: string;
  /** 附件目录在仓库中的路径前缀。 */
  private attachmentsPrefix: string;

  constructor(config: SyncConfig) {
    this.config = config;
    const parsed = parseRepo(config.repo);
    this.owner = parsed.owner;
    this.repo = parsed.repo;
    const dir = config.directory.replace(/^\/|\/$/g, ''); // 去掉首尾斜杠
    this.statePath = `${dir}/state.json`;
    this.attachmentsPrefix = `${dir}/attachments`;
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
    // GitHub 典型响应：422/409，body 含 "Git Repository is empty" 或 "initial commit required"。
    // 注意：必须放在 422+sha → VERSION_CONFLICT 判定之后，避免误判。
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

  /**
   * 读取远端版本标识。
   *
   * 通过 GET state.json 获取文件 SHA。文件不存在（首次同步）时返回空版本。
   */
  async readVersion(): Promise<VersionResult> {
    const url = `${this.contentsUrl(this.statePath)}?ref=${encodeURIComponent(this.config.branch)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers(),
    });

    if (response.status === 404) {
      return { version: '' };
    }

    const handled = await this.handleResponse(response, 'readVersion');
    const data = (await handled.json()) as GitHubContentItem;
    return { version: data.sha };
  }

  /**
   * 下载快照内容及其版本标识。
   *
   * 文件不存在（首次同步）时返回空数据。
   */
  async downloadSnapshot(): Promise<SnapshotDownloadResult> {
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
   * 上传快照（带乐观锁版本控制）。
   *
   * @param data - 序列化后的快照 JSON 字符串
   * @param baseVersion - 基于哪个版本修改（GitHub Commit SHA）
   * @throws StorageBackendError VERSION_CONFLICT 当远端版本与 baseVersion 不一致
   */
  async uploadSnapshot(
    data: string,
    baseVersion: string,
  ): Promise<SnapshotUploadResult> {
    const attempt = async (): Promise<SnapshotUploadResult> => {
      const encoded = utf8ToBase64(data);
      const body: Record<string, unknown> = {
        message: `sync: update state.json (base ${baseVersion.slice(0, 7) || 'init'})`,
        content: encoded,
        branch: this.config.branch,
      };

      // 有 baseVersion 表示更新已有文件，需传入 sha 实现乐观锁
      if (baseVersion) {
        body.sha = baseVersion;
      }

      const url = this.contentsUrl(this.statePath);
      const response = await fetch(url, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify(body),
      });

      const handled = await this.handleResponse(response, 'uploadSnapshot');
      const result = (await handled.json()) as GitHubPutResponse;
      return { newVersion: result.content.sha };
    };

    // 空仓库自愈：遇 REPO_EMPTY 时先初始化同步目录再重试
    return this.retryWithEmptyRepoInit(attempt);
  }

  /**
   * 初始化空仓库的同步目录。
   *
   * 空仓库无任何 commit/分支，Contents API 无法直接写入。
   * 在 `{directory}/.gitkeep` 写入占位文件以触发首次 commit。
   * 注意：GitHub Contents API 拒绝完全空的内容（422 "content is empty"），
   * 故使用单个换行作为占位；文件位于数据目录内，不污染仓库根目录。
   */
  private async initializeSyncDir(): Promise<void> {
    const dir = this.config.directory.replace(/^\/|\/$/g, '');
    const path = `${dir}/.gitkeep`;
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
   *
   * 最多重试 MAX_EMPTY_REPO_RETRIES 次；初始化失败时抛原始 REPO_EMPTY 错误。
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
          // 初始化失败：抛原始 REPO_EMPTY 错误，交由上层处理
          throw error;
        }
      }
    }
    // 理论不可达：循环内要么 return 要么 throw
    throw lastError;
  }

  /** 上传单个附件 blob。 */
  async uploadAttachment(key: string, blob: Blob): Promise<void> {
    const attempt = async (): Promise<void> => {
      const path = `${this.attachmentsPrefix}/${encodeURIComponent(key)}`;

      // Blob → base64
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
        // 可能是目录不存在或已有文件需要 sha
        // 先尝试获取已存在文件的 sha 再重试
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

    // 空仓库自愈：首次上传附件同样可能触发
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
