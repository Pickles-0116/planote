/**
 * useSyncEngine - M4 云同步引擎 React Hook
 *
 * 封装 SyncEngine 的生命周期管理，供 CloudSyncSettings 纯 UI 组件调用：
 * - 初始化引擎（懒加载，首次读取配置后才创建）
 * - 暴露 status / pendingCount / lastSyncAt 供 UI 渲染
 * - 提供 syncNow / updateConfig / testConnection 等方法
 * - 组件卸载时释放引擎资源
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { db } from '@/db';
import { getSyncConfig, setSyncConfig } from '@/db/sync';
import { countPendingChanges } from '@/db/sync';
import { SyncEngine, GitHubBackend, testConnection } from '@/sync';
import type { SyncConfig, SyncStatus, SyncEventCallbacks } from '@/db/sync/types';
import type { ConnectionTestResult } from '@/sync/types';

function makeBackend(config: SyncConfig): GitHubBackend {
  return new GitHubBackend(config);
}

export function useSyncEngine() {
  const engineRef = useRef<SyncEngine | null>(null);
  const [status, setStatus] = useState<SyncStatus>('disabled');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /** 读取配置并启动/重启引擎 */
  const refreshEngine = useCallback(async () => {
    const config = await getSyncConfig(db);

    setLastSyncAt(config.lastSyncAt);

    if (!config.enabled) {
      setStatus('disabled');
      engineRef.current?.stopAutoSync();
      return;
    }

    if (!config.repo || !config.token) {
      setStatus('pending_config');
      engineRef.current?.stopAutoSync();
      return;
    }

    // 成功路径（enabled 且配置完整）：清空上一次的错误提示
    setErrorMsg(null);

    // 创建引擎实例
    const backend = makeBackend(config);
    const callbacks: SyncEventCallbacks = {
      onSyncStatusChange: (s) => setStatus(s),
      onPendingCountChange: (n) => setPendingCount(n),
      onSyncError: (e) => setErrorMsg(e instanceof Error ? e.message : String(e)),
    };

    if (engineRef.current) {
      engineRef.current.setBackend(backend);
      engineRef.current.setCallbacks(callbacks);
      engineRef.current.startAutoSync();
    } else {
      const engine = new SyncEngine(db, backend, callbacks);
      engineRef.current = engine;
      engine.startAutoSync();
    }

    // 刷新待同步计数
    const count = await countPendingChanges(db);
    setPendingCount(count);
  }, []);

  // 初始化
  useEffect(() => {
    refreshEngine().then(() => setInitialized(true));
    return () => {
      engineRef.current?.stopAutoSync();
      engineRef.current = null;
    };
  }, [refreshEngine]);

  /** 更新配置并重启引擎 */
  const updateConfig = useCallback(
    async (patch: Partial<SyncConfig>) => {
      const config = await setSyncConfig(db, patch);
      setLastSyncAt(config.lastSyncAt);
      await refreshEngine();
    },
    [refreshEngine],
  );

  /** 立即执行同步 */
  const syncNow = useCallback(async () => {
    if (!engineRef.current) return;
    try {
      await engineRef.current.executePush();
    } catch {
      // 错误已在引擎回调中处理
    }
  }, []);

  /** 测试连接 */
  const testConn = useCallback(
    async (overrides?: { repo?: string; token?: string }): Promise<ConnectionTestResult> => {
      const config = await getSyncConfig(db);
      const repo = overrides?.repo ?? config.repo;
      const token = overrides?.token ?? config.token;
      if (!repo || !token) {
        return { ok: false, error: '请先填写仓库标识与访问令牌' };
      }
      const backend = makeBackend({ ...config, repo, token });
      return testConnection(backend);
    },
    [],
  );

  return {
    status,
    pendingCount,
    lastSyncAt,
    errorMsg,
    initialized,
    updateConfig,
    syncNow,
    testConn,
  };
}
