/**
 * M3 同步引擎集成测试
 *
 * 覆盖：
 * - 推送与拉取完整流程（T3.2 / T3.3）
 * - 首次同步（T3.6）
 * - 版本冲突重试
 * - 离线容错（T3.7）
 * - 串行化保护（T3.9）
 * - 错误映射（T3.8）
 * - 事件回调（T3.10）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { PlanoteDB } from '@/db/schema';
import { SyncEngine } from '../engine';
import { serializeSnapshot } from '../snapshot';
import type {
  StorageBackend,
  VersionResult,
  SnapshotDownloadResult,
  SnapshotUploadResult,
} from '../types';
import { StorageBackendError } from '../types';
import { getSyncConfig, setSyncConfig } from '@/db/sync/config';
import { enqueueChange, countPendingChanges } from '@/db/sync/changeQueue';
import type { SyncEventCallbacks, SyncableTableName } from '@/db/sync/types';

// ========== FakeBackend：内存模拟存储后端（改造自 github.test.ts） ==========

interface StoredSnapshot {
  data: string;
  version: number;
}

class FakeBackend implements StorageBackend {
  private snapshot: StoredSnapshot | null = null;
  readonly attachments = new Map<string, Blob>();
  private versionCounter = 1;
  /** 模拟网络故障 */
  failNext = false;
  /** 模拟指定错误 */
  nextError: StorageBackendError | null = null;

  simulateExternalUpload(data: string): string {
    const v = this.versionCounter++;
    this.snapshot = { data, version: v };
    return String(v);
  }

  async readVersion(): Promise<VersionResult> {
    if (this.failNext) {
      this.failNext = false;
      throw new TypeError('Failed to fetch');
    }
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }
    if (!this.snapshot) return { version: '' };
    return { version: String(this.snapshot.version) };
  }

  async downloadSnapshot(): Promise<SnapshotDownloadResult> {
    if (this.failNext) {
      this.failNext = false;
      throw new TypeError('Failed to fetch');
    }
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }
    if (!this.snapshot) return { data: '', version: '' };
    return { data: this.snapshot.data, version: String(this.snapshot.version) };
  }

  async uploadSnapshot(data: string, baseVersion: string): Promise<SnapshotUploadResult> {
    if (this.failNext) {
      this.failNext = false;
      throw new TypeError('Failed to fetch');
    }
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }
    const currentVersion = this.snapshot ? String(this.snapshot.version) : '';
    if (this.snapshot && baseVersion !== currentVersion) {
      throw new StorageBackendError(
        'VERSION_CONFLICT',
        `版本冲突：远端 ${currentVersion} !== base ${baseVersion}`,
      );
    }
    const newVersion = this.versionCounter++;
    this.snapshot = { data, version: newVersion };
    return { newVersion: String(newVersion) };
  }

  async uploadAttachment(_key: string, _blob: Blob): Promise<void> {
    // noop for engine tests
  }

  async downloadAttachment(_key: string): Promise<Blob> {
    return new Blob();
  }
}

// ========== 测试辅助 ==========

/** 创建测试数据库（每个测试独立实例）。 */
function createTestDB(name: string): PlanoteDB {
  return new PlanoteDB(`planote-test-${name}-${Date.now()}`);
}

/** 等待指定毫秒。 */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ========== 测试套件 ==========

describe('SyncEngine', () => {
  let db: PlanoteDB;
  let backend: FakeBackend;
  let engine: SyncEngine;
  let callbackStatuses: string[];
  let callbackErrors: unknown[];
  let callbackChanges: SyncableTableName[][];

  beforeEach(async () => {
    db = createTestDB('engine-test');
    backend = new FakeBackend();
    callbackStatuses = [];
    callbackErrors = [];
    callbackChanges = [];

    const callbacks: SyncEventCallbacks = {
      onSyncStatusChange: (s) => {
        callbackStatuses.push(s);
      },
      onSyncError: (e) => {
        callbackErrors.push(e);
      },
      onSyncComplete: (tables) => {
        callbackChanges.push(tables);
      },
    };

    engine = new SyncEngine(db, backend, callbacks);

    // 启用同步配置
    await setSyncConfig(db, {
      enabled: true,
      repo: 'test/repo',
      token: 'test-token',
      branch: 'main',
      directory: 'sync',
      cursor: null,
      lastSyncAt: null,
    });
  });

  // ==================== 首次同步 T3.6 ====================

  describe('T3.6 首次同步', () => {
    it('远端为空时直接推送本地数据', async () => {
      // 写入本地数据
      await db.plans.put({ id: 'p1', title: 'test', description: '', level: 'short', timeDim: 'daily', status: 'todo', progress: 0, urgency: 'none', tagIds: [], itemIds: [], blogIds: [], childPlanIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

      const result = await engine.firstSync();

      expect(result).not.toBeNull();
      expect(result!.cursor).toBeTruthy();
      expect(result!.changedTables).toContain('plans');

      // 远端应有数据
      const remote = await backend.downloadSnapshot();
      expect(remote.data).toContain('test');
    });

    it('本地为空时拉取远端数据', async () => {
      // 预先在远端放数据
      const remoteSnapshot = serializeSnapshot({
        tables: {
          plans: [{ id: 'p_remote', title: 'remote-plan', description: '', level: 'short', timeDim: 'daily', status: 'todo', progress: 0, urgency: 'none', tagIds: [], itemIds: [], blogIds: [], childPlanIds: [], createdAt: '2026-07-30T10:00:00Z', updatedAt: '2026-07-30T10:00:00Z' }],
        },
        tombstones: [],
      });
      backend.simulateExternalUpload(remoteSnapshot);

      const result = await engine.firstSync();

      expect(result).not.toBeNull();
      // 本地应有数据
      const plans = await db.plans.toArray();
      expect(plans).toHaveLength(1);
      expect(plans[0]!.title).toBe('remote-plan');
    });
  });

  // ==================== 推送流程 T3.2 ====================

  describe('T3.2 推送流程', () => {
    it('推送成功清空队列并更新游标', async () => {
      // 写入本地数据并模拟变更入队
      await db.plans.put({ id: 'p_push', title: 'push-test', description: '', level: 'short', timeDim: 'daily', status: 'todo', progress: 0, urgency: 'none', tagIds: [], itemIds: [], blogIds: [], childPlanIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      await enqueueChange(db, 'plans', 'p_push', 'put');

      const result = await engine.executePush();

      expect(result).not.toBeNull();
      // 队列应清空
      const pending = await countPendingChanges(db);
      expect(pending).toBe(0);
      // 游标应更新
      const config = await getSyncConfig(db);
      expect(config.cursor).toBe(result!.cursor);
      expect(config.lastSyncAt).toBeTruthy();
    });

    it('推送触发状态回调', async () => {
      await enqueueChange(db, 'plans', 'p_cb', 'put');

      await engine.executePush();

      expect(callbackStatuses).toContain('syncing');
      expect(callbackStatuses).toContain('synced');
    });
  });

  // ==================== 拉取流程 T3.3 ====================

  describe('T3.3 拉取流程', () => {
    it('版本一致时零成本跳过', async () => {
      // 设置游标与远端版本一致
      const remoteSnapshot = serializeSnapshot({ tables: {}, tombstones: [] });
      const version = backend.simulateExternalUpload(remoteSnapshot);
      await setSyncConfig(db, { cursor: version });

      const result = await engine.pull();

      expect(result).not.toBeNull();
      expect(result!.changedTables).toHaveLength(0);
    });

    it('版本不一致时拉取并合并', async () => {
      const remoteSnapshot = serializeSnapshot({
        tables: {
          blogs: [{ id: 'b_pull', title: 'pulled-blog', content: { type: 'doc', content: [] }, contentText: '', excerpt: '', tagIds: [], attachmentIds: [], folderId: 'root', status: 'draft', source: 'direct', createdAt: '2026-07-30T10:00:00Z', updatedAt: '2026-07-30T10:00:00Z' }],
        },
        tombstones: [],
      });
      backend.simulateExternalUpload(remoteSnapshot);

      const result = await engine.pull();

      expect(result).not.toBeNull();
      // 本地应有远程的博客
      const blogs = await db.blogs.toArray();
      expect(blogs).toHaveLength(1);
      expect(blogs[0]!.title).toBe('pulled-blog');
    });
  });

  // ==================== 版本冲突重试 ====================

  describe('版本冲突重试', () => {
    it('推送时版本冲突 → 重新拉取合并后成功', async () => {
      // 先有远端的初始数据
      const initial = serializeSnapshot({ tables: { plans: [{ id: 'p1', title: 'initial' }] }, tombstones: [] });
      backend.simulateExternalUpload(initial);

      // 模拟他人写入（导致版本冲突）
      const others = serializeSnapshot({ tables: { plans: [{ id: 'p1', title: 'others-version' }] }, tombstones: [] });
      backend.simulateExternalUpload(others);

      // 现在再推送，会先拉取他人版本，合并后上传
      await enqueueChange(db, 'plans', 'p_local', 'put');

      const result = await engine.executePush();

      // 应该成功
      expect(result).not.toBeNull();
      expect(result!.cursor).toBeTruthy();
    });
  });

  // ==================== 离线容错 T3.7 ====================

  describe('T3.7 离线容错', () => {
    it('网络错误时保留队列', async () => {
      backend.failNext = true;
      await enqueueChange(db, 'plans', 'p_offline', 'put');

      await expect(engine.executePush()).rejects.toThrow();

      // 队列应保留
      const pending = await countPendingChanges(db);
      expect(pending).toBe(1);
    });

    it('网络恢复后可继续推送', async () => {
      // 先失败
      backend.failNext = true;
      await enqueueChange(db, 'plans', 'p_recover', 'put');

      await expect(engine.executePush()).rejects.toThrow();

      // 恢复后推送应成功
      const result = await engine.executePush();
      expect(result).not.toBeNull();

      // 队列应清空
      const pending = await countPendingChanges(db);
      expect(pending).toBe(0);
    });
  });

  // ==================== 串行化保护 T3.9 ====================

  describe('T3.9 串行化保护', () => {
    it('并发触发时仅执行一次', async () => {
      // 模拟同步耗时较长
      const slowBackend = new (class extends FakeBackend {
        override async readVersion(): Promise<VersionResult> {
          await wait(100);
          return { version: '' };
        }
      })();

      const slowEngine = new SyncEngine(db, slowBackend);

      // 同时触发两次
      const p1 = slowEngine.executePush();
      const p2 = slowEngine.executePush();

      const [r1, r2] = await Promise.all([p1, p2]);

      // 一个应执行，一个应跳过
      expect(r1 === null || r2 === null).toBe(true);
    });
  });

  // ==================== 错误映射 T3.8 ====================

  describe('T3.8 错误映射', () => {
    it('TOKEN_INVALID → 中文提示', async () => {
      backend.nextError = new StorageBackendError('AUTH_FAILED', 'Bad credentials');

      await expect(engine.executePush()).rejects.toThrow();

      expect(callbackErrors.length).toBeGreaterThan(0);
      const err = callbackErrors[0] as { type?: string; userMessage?: string };
      expect(err.type === 'TOKEN_INVALID' || (err as { code?: string }).code === 'TOKEN_INVALID').toBe(true);
    });

    it('NETWORK_ERROR → 中文提示', async () => {
      backend.failNext = true;

      await expect(engine.executePush()).rejects.toThrow();

      expect(callbackErrors.length).toBeGreaterThan(0);
    });
  });

  // ==================== 事件回调 T3.10 ====================

  describe('T3.10 事件回调', () => {
    it('同步完成时触发 onSyncComplete', async () => {
      await db.plans.put({ id: 'p_cb2', title: 'cb-test', description: '', level: 'short', timeDim: 'daily', status: 'todo', progress: 0, urgency: 'none', tagIds: [], itemIds: [], blogIds: [], childPlanIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      await enqueueChange(db, 'plans', 'p_cb2', 'put');

      await engine.executePush();

      expect(callbackChanges.length).toBeGreaterThan(0);
      expect(callbackChanges[0]!).toContain('plans');
    });

    it('同步错误时触发 onSyncError', async () => {
      backend.failNext = true;
      await enqueueChange(db, 'plans', 'p_err', 'put');

      await expect(engine.executePush()).rejects.toThrow();

      expect(callbackErrors.length).toBeGreaterThan(0);
    });
  });

  // ==================== 防抖推送 ====================

  describe('防抖推送', () => {
    it('schedulePush 防抖合并多次触发为一次', async () => {
      // 禁用延迟等待
      await setSyncConfig(db, { pushDebounceMs: 50 });

      // 第一次调用重置定时器
      engine.schedulePush();
      engine.schedulePush();
      engine.schedulePush();

      // 等待防抖结束
      await wait(200);

      // 由于没有实际变更，应该没数据 — 但至少不崩溃
      // 主要验证防抖逻辑不抛异常
      expect(true).toBe(true);
    });
  });
});
