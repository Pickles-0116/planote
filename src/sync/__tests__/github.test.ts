/**
 * 适配器契约测试
 *
 * 使用内存 FakeBackend 实现 StorageBackend，验证四能力行为：
 * - 正常读版本 / 下载 / 上传 + 版本号递增
 * - 上传时版本冲突检测
 * - 附件上传下载
 *
 * 不触碰实际 GitHub API（全内存模拟）。
 */

import { describe, it, expect } from 'vitest';
import type { StorageBackend, VersionResult, SnapshotDownloadResult, SnapshotUploadResult } from '../types';
import { StorageBackendError } from '../types';

// ========== FakeBackend：内存模拟存储后端 ==========

interface StoredSnapshot {
  data: string;
  version: number; // 单调递增的整数版本号
}

class FakeBackend implements StorageBackend {
  private snapshot: StoredSnapshot | null = null;
  private attachments = new Map<string, Blob>();
  private versionCounter = 1;

  /** 模拟远端版本被他人更新。 */
  simulateExternalUpload(data: string): void {
    this.snapshot = { data, version: this.versionCounter++ };
  }

  async readVersion(): Promise<VersionResult> {
    if (!this.snapshot) {
      return { version: '' };
    }
    return { version: String(this.snapshot.version) };
  }

  async downloadSnapshot(): Promise<SnapshotDownloadResult> {
    if (!this.snapshot) {
      return { data: '', version: '' };
    }
    return { data: this.snapshot.data, version: String(this.snapshot.version) };
  }

  async uploadSnapshot(data: string, baseVersion: string): Promise<SnapshotUploadResult> {
    const currentVersion = this.snapshot ? String(this.snapshot.version) : '';

    if (this.snapshot && baseVersion !== currentVersion) {
      throw new StorageBackendError(
        'VERSION_CONFLICT',
        `版本冲突：远端版本 ${currentVersion} !== baseVersion ${baseVersion}`,
      );
    }

    const newVersion = this.versionCounter++;
    this.snapshot = { data, version: newVersion };
    return { newVersion: String(newVersion) };
  }

  async uploadAttachment(key: string, blob: Blob): Promise<void> {
    this.attachments.set(key, blob);
  }

  async downloadAttachment(key: string): Promise<Blob> {
    const blob = this.attachments.get(key);
    if (!blob) {
      throw new StorageBackendError('NOT_FOUND', `附件 ${key} 不存在`);
    }
    return blob;
  }
}

// ========== 测试套件 ==========

describe('StorageBackend 契约（FakeBackend）', () => {
  describe('基础读写能力', () => {
    it('空仓时 readVersion 返回空版本', async () => {
      const backend = new FakeBackend();
      const result = await backend.readVersion();
      expect(result.version).toBe('');
    });

    it('空仓时 downloadSnapshot 返回空数据', async () => {
      const backend = new FakeBackend();
      const result = await backend.downloadSnapshot();
      expect(result.data).toBe('');
      expect(result.version).toBe('');
    });

    it('上传后 readVersion 返回递增版本号', async () => {
      const backend = new FakeBackend();

      const v1 = await backend.uploadSnapshot('{"hello":"world"}', '');
      expect(v1.newVersion).toBe('1');

      const version = await backend.readVersion();
      expect(version.version).toBe('1');
    });

    it('上传后 downloadSnapshot 返回写入的内容与匹配版本', async () => {
      const backend = new FakeBackend();
      const testData = '{"foo":"bar"}';

      await backend.uploadSnapshot(testData, '');
      const result = await backend.downloadSnapshot();

      expect(result.data).toBe(testData);
      expect(result.version).toBe('1');
    });

    it('多次上传后版本号单调递增', async () => {
      const backend = new FakeBackend();

      const r1 = await backend.uploadSnapshot('v1', '');
      const r2 = await backend.uploadSnapshot('v2', r1.newVersion);
      const r3 = await backend.uploadSnapshot('v3', r2.newVersion);

      expect(r1.newVersion).toBe('1');
      expect(r2.newVersion).toBe('2');
      expect(r3.newVersion).toBe('3');
    });
  });

  describe('版本冲突检测', () => {
    it('上传时 baseVersion 不匹配当前版本抛 VERSION_CONFLICT', async () => {
      const backend = new FakeBackend();

      await backend.uploadSnapshot('初始数据', '');
      // 模拟他人更新
      backend.simulateExternalUpload('他人写入的数据');

      // 基于过期的版本号上传应该冲突
      await expect(
        backend.uploadSnapshot('我的数据', '1'),
      ).rejects.toThrow(StorageBackendError);

      await expect(
        backend.uploadSnapshot('我的数据', '1'),
      ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    });

    it('上传时 baseVersion 匹配当前版本则成功', async () => {
      const backend = new FakeBackend();

      const v1 = await backend.uploadSnapshot('v1', '');
      const v2 = await backend.uploadSnapshot('v2', v1.newVersion);
      expect(v2.newVersion).toBe('2');
    });

    it('首次上传时 baseVersion 为空字符串可正常工作', async () => {
      const backend = new FakeBackend();
      const result = await backend.uploadSnapshot('首次数据', '');
      expect(result.newVersion).toBe('1');
    });
  });

  describe('附件上传下载', () => {
    it('上传后可以下载相同的附件内容', async () => {
      const backend = new FakeBackend();
      const content = 'Hello, 附件内容!';
      const blob = new Blob([content], { type: 'text/plain' });

      await backend.uploadAttachment('att-001', blob);
      const downloaded = await backend.downloadAttachment('att-001');

      const text = await downloaded.text();
      expect(text).toBe(content);
    });

    it('多个附件独立存储', async () => {
      const backend = new FakeBackend();

      await backend.uploadAttachment('att-a', new Blob(['A']));
      await backend.uploadAttachment('att-b', new Blob(['B']));

      const a = await backend.downloadAttachment('att-a');
      const b = await backend.downloadAttachment('att-b');

      expect(await a.text()).toBe('A');
      expect(await b.text()).toBe('B');
    });

    it('下载不存在的附件抛 NOT_FOUND', async () => {
      const backend = new FakeBackend();

      await expect(
        backend.downloadAttachment('nonexistent'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
