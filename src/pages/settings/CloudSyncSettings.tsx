/**
 * CloudSyncSettings - 云同步设置面板（M4）
 *
 * 对应 T4.2–T4.7，涵盖：
 * - 配置表单（开关 / 仓库 / 分支 / 令牌 / 目录）
 * - 连接测试按钮与结果回显
 * - 六种同步状态展示 + 状态预览网格
 * - 「立即同步」按钮
 * - 令牌获取引导（可折叠 5 步）
 * - 数据安全提醒
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Cloud,
  Settings2,
  Plug,
  CircleCheck,
  CircleAlert,
  Eye,
  EyeOff,
  X,
  Loader2,
  Shield,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { useSyncEngine } from '@/features/sync/hooks/useSyncEngine';
import type { SyncStatus } from '@/db/sync/types';

// ==================== 状态元数据 ====================

interface StatusMeta {
  icon: typeof Cloud;
  label: string;
  desc: string;
  dotClass: string;
  iconBg: string;
  iconColor: string;
  barBg: string;
  barBd: string;
}

const STATUS_META: Record<SyncStatus, StatusMeta> = {
  disabled: {
    icon: CircleAlert,
    label: '未开启云同步',
    desc: '开启后自动同步计划、博客、标签等数据',
    dotClass: 'bg-stone-300 dark:bg-stone-500',
    iconBg: 'bg-stone-100 dark:bg-stone-700',
    iconColor: 'text-stone-400 dark:text-stone-500',
    barBg: 'bg-stone-50 dark:bg-stone-800/60',
    barBd: 'border-stone-200 dark:border-stone-700',
  },
  pending_config: {
    icon: CircleAlert,
    label: '待配置',
    desc: '请填写仓库标识与访问令牌',
    dotClass: 'bg-amber-400',
    iconBg: 'bg-amber-50 dark:bg-amber-900/30',
    iconColor: 'text-amber-500 dark:text-amber-400',
    barBg: 'bg-amber-50/60 dark:bg-amber-900/20',
    barBd: 'border-amber-200 dark:border-amber-700',
  },
  syncing: {
    icon: RefreshCw,
    label: '同步中…',
    desc: '正在拉取远端变更并合并',
    dotClass: 'bg-blue-400',
    iconBg: 'bg-blue-50 dark:bg-blue-900/30',
    iconColor: 'text-blue-500 dark:text-blue-400',
    barBg: 'bg-blue-50/60 dark:bg-blue-900/20',
    barBd: 'border-blue-200 dark:border-blue-700',
  },
  synced: {
    icon: CircleCheck,
    label: '已是最新',
    desc: '数据已同步到远端仓库',
    dotClass: 'bg-emerald-400',
    iconBg: 'bg-emerald-50 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-500 dark:text-emerald-400',
    barBg: 'bg-emerald-50/60 dark:bg-emerald-900/20',
    barBd: 'border-emerald-200 dark:border-emerald-700',
  },
  offline_pending: {
    icon: CircleAlert,
    label: '离线待发',
    desc: '网络恢复后自动同步',
    dotClass: 'bg-amber-400',
    iconBg: 'bg-amber-50 dark:bg-amber-900/30',
    iconColor: 'text-amber-500 dark:text-amber-400',
    barBg: 'bg-amber-50/60 dark:bg-amber-900/20',
    barBd: 'border-amber-200 dark:border-amber-700',
  },
  error: {
    icon: CircleAlert,
    label: '同步出错',
    desc: '请检查配置或网络连接',
    dotClass: 'bg-red-400',
    iconBg: 'bg-red-50 dark:bg-red-900/30',
    iconColor: 'text-red-500 dark:text-red-400',
    barBg: 'bg-red-50/60 dark:bg-red-900/20',
    barBd: 'border-red-200 dark:border-red-700',
  },
};

const STATUS_GRID_ITEMS: { status: SyncStatus; label: string }[] = [
  { status: 'disabled', label: '未启用' },
  { status: 'pending_config', label: '待配置' },
  { status: 'syncing', label: '同步中' },
  { status: 'synced', label: '已同步' },
  { status: 'offline_pending', label: '离线待发' },
  { status: 'error', label: '出错' },
];

export default function CloudSyncSettings(): JSX.Element {
  const { status, pendingCount, lastSyncAt, errorMsg, updateConfig, syncNow, testConn } =
    useSyncEngine();

  // 表单状态
  const [enabled, setEnabled] = useState(false);
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [token, setToken] = useState('');
  const [directory, setDirectory] = useState('sync');

  // UI 状态
  const [tokenVisible, setTokenVisible] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  // 加载初始配置
  useEffect(() => {
    (async () => {
      const { db: _db } = await import('@/db');
      const { getSyncConfig } = await import('@/db/sync');
      const config = await getSyncConfig(_db);
      setEnabled(config.enabled);
      setRepo(config.repo);
      setBranch(config.branch);
      setToken(config.token);
      setDirectory(config.directory);
    })();
  }, []);

  const handleToggle = useCallback(
    async (checked: boolean) => {
      setEnabled(checked);
      await updateConfig({ enabled: checked });
    },
    [updateConfig],
  );

  const handleSave = useCallback(
    async (patch: { repo?: string; branch?: string; token?: string; directory?: string }) => {
      await updateConfig(patch);
    },
    [updateConfig],
  );

  const handleTestConnection = useCallback(async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const result = await testConn({ repo, token });
      setTestResult({
        ok: result.ok,
        msg: result.ok ? '连接成功' : result.error ?? '连接失败',
      });
    } catch {
      setTestResult({ ok: false, msg: '连接测试异常' });
    } finally {
      setTestLoading(false);
    }
  }, [testConn, repo, token]);

  const handleSyncNow = useCallback(async () => {
    setSyncLoading(true);
    try {
      await syncNow();
    } finally {
      setSyncLoading(false);
    }
  }, [syncNow]);

  const meta = STATUS_META[status];
  const StatusIcon = meta.icon;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-lg font-bold text-brand-900 dark:text-stone-100">
          云同步
        </h2>
        <p className="text-sm text-brand-500 dark:text-stone-400 mt-1">
          将数据同步到 GitHub 仓库，跨设备访问
        </p>
      </header>

      {/* ===== T4.2 状态卡片 + 开关 ===== */}
      <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center flex-shrink-0">
              <Cloud className="text-sky-600 dark:text-sky-300" size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-brand-900 dark:text-stone-100">
                云同步
              </h3>
              <p className="text-xs text-brand-500 dark:text-stone-400 mt-1">
                将数据同步到 GitHub 仓库，跨设备访问
              </p>
            </div>
          </div>
          {/* Toggle 开关 */}
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={enabled}
              onChange={(e) => handleToggle(e.target.checked)}
            />
            <div className="w-11 h-6 bg-stone-200 dark:bg-stone-600 rounded-full peer peer-checked:bg-brand-900 dark:peer-checked:bg-stone-300 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-stone-300 dark:after:border-stone-500 after:rounded-full after:h-5 after:w-5 after:transition-all" />
          </label>
        </div>

        {/* T4.4 状态栏 */}
        <div
          className={`mt-4 p-4 rounded-xl border flex items-center justify-between ${meta.barBg} ${meta.barBd}`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.iconBg}`}>
              {status === 'syncing' ? (
                <Loader2 className={`animate-spin ${meta.iconColor}`} size={16} />
              ) : (
                <StatusIcon className={meta.iconColor} size={16} />
              )}
            </div>
            <div>
              <div
                className={`text-sm font-medium ${
                  status === 'error' ? 'text-red-700 dark:text-red-400' : 'text-brand-700 dark:text-stone-200'
                }`}
              >
                {meta.label}
                {pendingCount > 0 && status !== 'syncing' && (
                  <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                    · {pendingCount} 项待同步
                  </span>
                )}
              </div>
              <div className="text-xs text-brand-500 dark:text-stone-400 mt-0.5">
                {status === 'error' && errorMsg ? errorMsg : meta.desc}
              </div>
            </div>
          </div>

          {/* T4.5 立即同步按钮 */}
          {status !== 'disabled' && status !== 'pending_config' && (
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={syncLoading || status === 'syncing'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 text-brand-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-600 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {syncLoading || status === 'syncing' ? (
                <Loader2 className="animate-spin" size={12} />
              ) : (
                <RefreshCw size={12} />
              )}
              {syncLoading || status === 'syncing' ? '同步中…' : '立即同步'}
            </button>
          )}
        </div>

        {/* 状态预览网格 */}
        <div className="mt-4">
          <label className="text-xs font-semibold text-brand-500 dark:text-stone-400 block mb-2">
            状态预览（点击切换）
          </label>
          <div className="grid grid-cols-3 gap-2">
            {STATUS_GRID_ITEMS.map((item) => {
              const m = STATUS_META[item.status];
              const isActive = status === item.status;
              return (
                <button
                  key={item.status}
                  type="button"
                  onClick={() => {
                    // 仅预览，不实际改变引擎状态
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs border transition ${
                    isActive
                      ? 'border-brand-900 dark:border-stone-400 bg-brand-50 dark:bg-stone-700'
                      : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-stone-400 dark:hover:border-stone-500'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.dotClass}`} />
                  <span className="text-brand-600 dark:text-stone-300">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* T4.4 时间 / 待同步数 */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
            <div className="text-[10px] font-semibold text-brand-400 dark:text-stone-500 uppercase tracking-wider">
              上次同步
            </div>
            <div className="text-sm font-medium text-brand-700 dark:text-stone-200 mt-1">
              {lastSyncAt
                ? new Date(lastSyncAt).toLocaleString('zh-CN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
            <div className="text-[10px] font-semibold text-brand-400 dark:text-stone-500 uppercase tracking-wider">
              待同步项
            </div>
            <div className="text-sm font-medium text-brand-700 dark:text-stone-200 mt-1">
              {pendingCount > 0 ? `${pendingCount} 项` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* ===== T4.2 配置表单 ===== */}
      <div
        className={`bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 transition-opacity ${
          !enabled ? 'opacity-40 pointer-events-none' : ''
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-700 flex items-center justify-center flex-shrink-0">
            <Settings2 className="text-brand-500 dark:text-stone-400" size={18} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-brand-900 dark:text-stone-100">
              连接配置
            </h3>
            <p className="text-xs text-brand-500 dark:text-stone-400 mt-1">
              填写 GitHub 仓库信息以启用云同步
            </p>

            {/* 仓库标识 */}
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-brand-600 dark:text-stone-300 mb-1.5">
                  仓库标识
                </label>
                <input
                  type="text"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  onBlur={() => handleSave({ repo })}
                  placeholder="用户名/仓库名"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm text-brand-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-brand-900/20 dark:focus:ring-stone-400/30"
                />
                <p className="text-[10px] text-brand-400 dark:text-stone-500 mt-1">
                  例如：<code className="bg-stone-100 dark:bg-stone-700 px-1 rounded">songzihao/planote-data</code>
                </p>
              </div>

              {/* 分支 */}
              <div>
                <label className="block text-xs font-semibold text-brand-600 dark:text-stone-300 mb-1.5">
                  分支
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  onBlur={() => handleSave({ branch })}
                  placeholder="main"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm text-brand-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-brand-900/20 dark:focus:ring-stone-400/30"
                />
              </div>

              {/* 访问令牌 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-brand-600 dark:text-stone-300">
                    访问令牌
                  </label>
                  <button
                    type="button"
                    onClick={() => setGuideOpen(!guideOpen)}
                    className="text-[10px] text-brand-400 dark:text-stone-400 underline underline-offset-2 hover:text-brand-600 dark:hover:text-stone-200"
                  >
                    如何获取？
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={tokenVisible ? 'text' : 'password'}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    onBlur={() => handleSave({ token })}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-3 py-2 pr-16 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm text-brand-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-brand-900/20 dark:focus:ring-stone-400/30"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => setTokenVisible(!tokenVisible)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 transition"
                      title={tokenVisible ? '隐藏令牌' : '显示令牌'}
                    >
                      {tokenVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setToken('');
                        handleSave({ token: '' });
                      }}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                      title="清除令牌"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-brand-400 dark:text-stone-500 mt-1">
                  令牌仅存本地，不上传。需要 <code className="bg-stone-100 dark:bg-stone-700 px-1 rounded">contents:write</code> 权限
                </p>
              </div>

              {/* 数据目录 */}
              <div>
                <label className="block text-xs font-semibold text-brand-600 dark:text-stone-300 mb-1.5">
                  数据目录
                </label>
                <input
                  type="text"
                  value={directory}
                  onChange={(e) => setDirectory(e.target.value)}
                  onBlur={() => handleSave({ directory })}
                  placeholder="sync"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm text-brand-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-brand-900/20 dark:focus:ring-stone-400/30"
                />
                <p className="text-[10px] text-brand-400 dark:text-stone-500 mt-1">
                  远端仓库中存储同步数据的路径
                </p>
              </div>
            </div>

            {/* T4.3 测试连接 */}
            <div className="mt-4">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testLoading || !repo || !token}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 text-brand-700 dark:text-stone-200 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-600 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {testLoading ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Plug size={14} />
                )}
                {testLoading ? '测试中…' : '测试连接'}
              </button>
              {testResult && (
                <div
                  className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                    testResult.ok
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                  }`}
                >
                  {testResult.ok ? (
                    <CircleCheck size={12} />
                  ) : (
                    <CircleAlert size={12} />
                  )}
                  {testResult.msg}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== T4.6 令牌获取引导 ===== */}
      {guideOpen && (
        <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 animate-fadeIn">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <ChevronDown className="text-amber-500 dark:text-amber-300" size={18} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-brand-900 dark:text-stone-100">
                获取 GitHub 访问令牌
              </h3>
              <p className="text-xs text-brand-500 dark:text-stone-400 mt-1">
                按照以下步骤生成令牌
              </p>

              <div className="mt-4 space-y-3">
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    1
                  </div>
                  <p className="text-xs text-brand-600 dark:text-stone-300 pt-0.5">
                    访问{' '}
                    <a
                      href="https://github.com/settings/tokens?type=beta"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 underline underline-offset-2"
                    >
                      GitHub Fine-grained tokens
                    </a>{' '}
                    设置页
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    2
                  </div>
                  <p className="text-xs text-brand-600 dark:text-stone-300 pt-0.5">
                    点击「Generate new token」，输入名称
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    3
                  </div>
                  <p className="text-xs text-brand-600 dark:text-stone-300 pt-0.5">
                    「Repository access」选择「Only select repositories」，勾选你的同步仓库
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    4
                  </div>
                  <p className="text-xs text-brand-600 dark:text-stone-300 pt-0.5">
                    「Permissions」中开启{' '}
                    <code className="bg-stone-100 dark:bg-stone-700 px-1 rounded text-[10px]">
                      Contents: Read and write
                    </code>
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    5
                  </div>
                  <p className="text-xs text-brand-600 dark:text-stone-300 pt-0.5">
                    生成后复制令牌，粘贴到上方「访问令牌」输入框
                  </p>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 flex items-start gap-2">
                <CircleAlert size={14} className="text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-amber-800 dark:text-amber-200">
                  <strong>令牌吊销：</strong>可在 GitHub 设置页随时吊销。吊销后同步将停止，需重新生成。
                </p>
              </div>

              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="mt-3 text-xs text-brand-400 dark:text-stone-400 underline underline-offset-2 hover:text-brand-600 dark:hover:text-stone-200"
              >
                收起指引 &#x25B2;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== T4.7 安全提醒 ===== */}
      <div className="bg-white dark:bg-stone-800 rounded-2xl border border-red-200 dark:border-red-900/40 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
            <Shield className="text-red-500 dark:text-red-300" size={18} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-brand-900 dark:text-stone-100">
              数据安全提醒
            </h3>
            <p className="text-xs text-brand-500 dark:text-stone-400 mt-1">
              同步数据存储在 GitHub 仓库中。请确保：
            </p>
            <ul className="mt-3 space-y-1.5">
              <li className="flex items-start gap-2 text-xs text-brand-600 dark:text-stone-300">
                <span className="text-emerald-500 font-bold flex-shrink-0">&#x2713;</span>
                使用<strong className="font-semibold">私有仓库</strong>存储同步数据，避免公开泄露
              </li>
              <li className="flex items-start gap-2 text-xs text-brand-600 dark:text-stone-300">
                <span className="text-emerald-500 font-bold flex-shrink-0">&#x2713;</span>
                使用<strong className="font-semibold">细粒度令牌</strong>，仅授权目标仓库
              </li>
              <li className="flex items-start gap-2 text-xs text-brand-600 dark:text-stone-300">
                <span className="text-emerald-500 font-bold flex-shrink-0">&#x2713;</span>
                令牌仅存本地，不会被上传到任何服务器
              </li>
              <li className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                <span className="text-red-400 font-bold flex-shrink-0">&#x2717;</span>
                公开仓库中的数据可被任何人读取
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
