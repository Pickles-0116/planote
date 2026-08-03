/**
 * M2 存储通道 — 连接测试能力
 *
 * 提供 testConnection 函数，对远端存储做只读校验（不写任何远端文件）。
 * M4 设置页可据此向用户展示连接状态（AC-10 错误可读要求）。
 */

import type { StorageBackend, ConnectionTestResult } from './types';

/** 可读错误描述映射。 */
function describeError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('token')) {
    return '令牌权限不足：请检查 GitHub 令牌是否有效并具有 contents 读取权限';
  }
  if (lower.includes('403') || lower.includes('forbidden')) {
    return '访问被拒绝：令牌可能缺少必要权限或资源不可访问';
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return '仓库不可达：请确认仓库地址是否正确且分支存在';
  }
  if (lower.includes('rate') || lower.includes('limit')) {
    return 'API 限流：请稍后重试';
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('econnrefused')) {
    return '网络不可达：请检查网络连接';
  }
  if (lower.includes('dns') || lower.includes('enotfound')) {
    return 'DNS 解析失败：无法解析 GitHub API 地址，请检查网络';
  }

  return `连接失败：${msg}`;
}

/**
 * 测试与远端存储后端的连接。
 *
 * 只读校验，不写任何远端文件。
 *
 * @param backend - 存储后端适配器实例
 * @returns {ConnectionTestResult} 带有可读错误信息的测试结果
 */
export async function testConnection(
  backend: StorageBackend,
): Promise<ConnectionTestResult> {
  try {
    await backend.readVersion();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}
