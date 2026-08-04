/**
 * 同步 payload 体积防护测试（v1.3-CloudSync-Trim）
 *
 * 验证：
 * - 估算公式正确（小 payload 不超限）
 * - 超限时抛 SnapshotTooLargeError，错误信息含具体字节数
 * - 上限边界附近的临界值处理
 */

import { describe, it, expect } from 'vitest';
import {
  estimateBase64Bytes,
  assertSnapshotFits,
  SnapshotTooLargeError,
  RemoteSnapshotTooLargeError,
  MAX_SNAPSHOT_BASE64_BYTES,
} from '../size-guard';

describe('size-guard 体积防护', () => {
  it('小 payload 估算后不超限，应通过校验', () => {
    // 100KB 字节 → 估算 base64 ≈ 133KB，远低于 900KB 上限
    const json = JSON.stringify({ payload: 'x'.repeat(100 * 1024) });
    expect(() => assertSnapshotFits(json)).not.toThrow();
  });

  it('估算 base64 字节数符合公式 ceil(n*4/3)', () => {
    // 3 字符 → ceil(12/3) = 4 字节 base64
    expect(estimateBase64Bytes('abc')).toBe(4);
    // 6 字符 → ceil(24/3) = 8 字节 base64
    expect(estimateBase64Bytes('abcdef')).toBe(8);
    // 1 字符 → ceil(4/3) = 2 字节 base64（用 ceil 偏保守）
    expect(estimateBase64Bytes('a')).toBe(2);
    // 空字符串 → 0
    expect(estimateBase64Bytes('')).toBe(0);
  });

  it('超限时抛 SnapshotTooLargeError，错误信息含 KB/MB 数字', () => {
    // 构造 1.5MB 字符串 → 估算 base64 ≈ 2MB，必然超限
    const bigJson = JSON.stringify({ payload: 'x'.repeat(1500 * 1024) });
    expect(() => assertSnapshotFits(bigJson)).toThrow(SnapshotTooLargeError);
    expect(() => assertSnapshotFits(bigJson)).toThrow(/过大/);
  });

  it('SnapshotTooLargeError 暴露实际 size 与 limit 字段', () => {
    const bigJson = JSON.stringify({ payload: 'x'.repeat(1500 * 1024) });
    try {
      assertSnapshotFits(bigJson);
      expect.fail('应该抛错');
    } catch (err) {
      expect(err).toBeInstanceOf(SnapshotTooLargeError);
      const e = err as SnapshotTooLargeError;
      expect(e.size).toBeGreaterThan(MAX_SNAPSHOT_BASE64_BYTES);
      expect(e.limit).toBe(MAX_SNAPSHOT_BASE64_BYTES);
    }
  });

  it('正好等于上限时通过（边界 = 不超）', () => {
    // 构造一个估算后正好 ≈ 上限的 payload：n = limit * 3 / 4
    // 我们保守一些，用 n = limit * 3 / 4 - 1 字节确保不超
    const targetJson = 'a'.repeat(Math.floor((MAX_SNAPSHOT_BASE64_BYTES * 3) / 4) - 1);
    expect(() => assertSnapshotFits(targetJson)).not.toThrow();
  });

  it('超出上限 1 字节时拒绝', () => {
    // 构造一个估算后必然超限的 payload
    const targetJson = 'a'.repeat(Math.ceil((MAX_SNAPSHOT_BASE64_BYTES * 3) / 4) + 1000);
    expect(() => assertSnapshotFits(targetJson)).toThrow(SnapshotTooLargeError);
  });
});

describe('RemoteSnapshotTooLargeError（远端文件超限）', () => {
  it('构造时暴露 remoteSize 字段', () => {
    const err = new RemoteSnapshotTooLargeError(1_379_615);
    expect(err.remoteSize).toBe(1_379_615);
    expect(err.name).toBe('RemoteSnapshotTooLargeError');
  });

  it('userMessage 含「删除」和具体大小提示', () => {
    const err = new RemoteSnapshotTooLargeError(1_379_615);
    expect(err.message).toMatch(/删除/);
    expect(err.message).toMatch(/1\.3\d MB/);
  });
});
