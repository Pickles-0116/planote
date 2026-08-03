/**
 * ModelConfigPanel · AI 模型配置管理页
 *
 * 设置页中的 AI 模型管理面板：
 * - 添加/编辑/删除模型配置
 * - API Key 掩码显示
 * - 连接测试
 * - 默认/备用角色切换
 */

import { useState, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Star,
  CheckCircle2,
  XCircle,
  Loader2,
  Key,
  Server,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIModelProfiles } from '../hooks/useAIModelProfiles';
import type { AIProvider, AIModelProfile } from '@/types/domain';
import { PROVIDER_MODELS } from '../adapters/AIProviderAdapter';

const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: 'OpenAI',
  claude: 'Claude',
  qwen: '通义千问',
  minimax: 'MiniMax',
  custom: '自定义',
};

const BASE_URL_PLACEHOLDERS: Record<AIProvider, string> = {
  openai: 'https://api.openai.com/v1（留空用默认，或填代理地址）',
  claude: 'https://api.anthropic.com（留空用默认，或填 MiniMax 等代理）',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  minimax: 'https://api.minimaxi.com/v1（留空用默认，已预置）',
  custom: 'https://your-api.com/v1',
};

function baseUrlPlaceholder(provider: AIProvider): string {
  return BASE_URL_PLACEHOLDERS[provider];
}

export default function ModelConfigPanel() {
  const {
    profiles,
    error,
    addProfile,
    updateProfile,
    deleteProfile,
    setDefault,
    clearError,
    getDecodedApiKey,
    testConnection,
    maskApiKey,
    hasDefaultModel,
  } = useAIModelProfiles();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  // 新建/编辑共用表单状态
  const [formProvider, setFormProvider] = useState<AIProvider>('openai');
  const [formName, setFormName] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formModel, setFormModel] = useState('gpt-4o');
  const [formTemp, setFormTemp] = useState(0.7);
  const [formMaxTokens, setFormMaxTokens] = useState(4096);

  /** 把 profile 装载到表单里，进入编辑模式。 */
  const startEdit = useCallback(
    (p: AIModelProfile) => {
      setFormProvider(p.provider);
      setFormName(p.name);
      setFormApiKey(''); // 不回填 key（掩码原因），让用户重新输入或留空表示不修改
      setFormBaseUrl(p.baseUrl ?? '');
      setFormModel(p.model);
      setFormTemp(p.temperature);
      setFormMaxTokens(p.maxTokens);
      setEditingId(p.id);
      setShowForm(true);
    },
    [],
  );

  /** 取消编辑/新建，重置表单。 */
  const cancelForm = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setFormApiKey('');
    setFormName('');
    setFormModel('gpt-4o');
    setFormTemp(0.7);
    setFormMaxTokens(4096);
  }, []);

  const handleTest = useCallback(
    async (profile: AIModelProfile) => {
      setTesting(profile.id);
      setTestResult(null);
      try {
        const apiKey = getDecodedApiKey(profile.id);
        const result = await testConnection(profile.provider, apiKey, profile.baseUrl, profile.model);
        setTestResult({ id: profile.id, ok: true, msg: `连接成功 (${result.latencyMs}ms)` });
      } catch (e) {
        setTestResult({ id: profile.id, ok: false, msg: e instanceof Error ? e.message : '连接失败' });
      } finally {
        setTesting(null);
      }
    },
    [testConnection, getDecodedApiKey],
  );

  const handleSave = useCallback(() => {
    if (!formModel.trim()) return;
    if (editingId) {
      // 编辑模式：updateProfile
      const patch: Partial<AIModelProfile> = {
        name: formName || `${PROVIDER_LABELS[formProvider]} - ${formModel}`,
        provider: formProvider,
        baseUrl: formBaseUrl.trim() || undefined,
        model: formModel,
        temperature: formTemp,
        maxTokens: formMaxTokens,
      };
      // 仅当用户输入了新 API Key 才更新（掩码原因不回填）
      if (formApiKey.trim()) {
        patch.apiKey = formApiKey;
      }
      updateProfile(editingId, patch);
    } else {
      // 新建模式：必须填 API Key
      if (!formApiKey.trim()) return;
      addProfile({
        name: formName || `${PROVIDER_LABELS[formProvider]} - ${formModel}`,
        provider: formProvider,
        apiKey: formApiKey,
        baseUrl: formBaseUrl.trim() || undefined,
        model: formModel,
        temperature: formTemp,
        maxTokens: formMaxTokens,
        role: profiles.length === 0 ? 'default' : 'backup',
      });
    }
    cancelForm();
  }, [editingId, addProfile, updateProfile, formProvider, formName, formApiKey, formBaseUrl, formModel, formTemp, formMaxTokens, profiles.length, cancelForm]);

  const handleDelete = useCallback(
    (id: string) => {
      if (confirm('确定删除此模型配置？')) {
        deleteProfile(id);
      }
    },
    [deleteProfile],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-brand-900 dark:text-stone-100">AI 模型配置</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-brand-800 dark:hover:bg-stone-200 transition"
        >
          <Plus size={14} />
          添加模型
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
          {error}
          <button onClick={clearError} className="ml-2 underline">关闭</button>
        </div>
      )}

      {/* 模型列表 */}
      <div className="space-y-3">
        {profiles.map((p) => (
          <div
            key={p.id}
            className={cn(
              'border rounded-xl p-4 transition',
              p.role === 'default'
                ? 'border-brand-500 dark:border-brand-400 bg-brand-50/50 dark:bg-brand-900/20'
                : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-brand-900 dark:text-stone-100 truncate">
                    {p.name}
                  </span>
                  {p.role === 'default' && (
                    <span className="px-1.5 py-0.5 text-xs rounded bg-brand-500 text-white">
                      默认
                    </span>
                  )}
                </div>
                <div className="text-xs text-brand-500 dark:text-stone-400 space-x-3">
                  <span>{PROVIDER_LABELS[p.provider]}</span>
                  <span>{p.model}</span>
                  <span className="inline-flex items-center gap-1">
                    <Key size={10} />
                    {maskApiKey(p.apiKey)}
                  </span>
                </div>
                <div className="text-xs text-brand-400 dark:text-stone-500 mt-1">
                  温度 {p.temperature} · 最大 {p.maxTokens} tokens
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* 测试连接 */}
                <button
                  onClick={() => handleTest(p)}
                  disabled={testing === p.id}
                  className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition"
                  title="测试连接"
                >
                  {testing === p.id ? (
                    <Loader2 size={14} className="animate-spin text-brand-500" />
                  ) : testResult?.id === p.id ? (
                    testResult.ok ? (
                      <CheckCircle2 size={14} className="text-green-500" />
                    ) : (
                      <XCircle size={14} className="text-red-500" />
                    )
                  ) : (
                    <Server size={14} className="text-brand-500 dark:text-stone-400" />
                  )}
                </button>
                {/* 编辑 */}
                <button
                  onClick={() => startEdit(p)}
                  className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition"
                  title="编辑"
                >
                  <Pencil size={14} className="text-brand-500 dark:text-stone-400 hover:text-brand-700" />
                </button>
                {/* 设为默认 */}
                {p.role !== 'default' && (
                  <button
                    onClick={() => setDefault(p.id)}
                    className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition"
                    title="设为默认"
                  >
                    <Star size={14} className="text-brand-400 dark:text-stone-500" />
                  </button>
                )}
                {/* 删除 */}
                <button
                  onClick={() => handleDelete(p.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                  title="删除"
                >
                  <Trash2 size={14} className="text-brand-400 dark:text-stone-500 hover:text-red-500" />
                </button>
              </div>
            </div>
            {testResult?.id === p.id && (
              <div className={cn('text-xs mt-2', testResult.ok ? 'text-green-600' : 'text-red-500')}>
                {testResult.msg}
              </div>
            )}
          </div>
        ))}

        {profiles.length === 0 && (
          <div className="text-center py-8 text-brand-400 dark:text-stone-500 text-sm">
            还没有配置 AI 模型，点击上方"添加模型"开始配置
          </div>
        )}
      </div>

      {/* 添加/编辑表单 */}
      {showForm && (
        <div className="border border-stone-200 dark:border-stone-700 rounded-xl p-4 bg-white dark:bg-stone-800 space-y-3">
          <h4 className="font-medium text-brand-900 dark:text-stone-100">
            {editingId ? '编辑模型配置' : '新建模型配置'}
          </h4>

          {/* 服务商 */}
          <div>
            <label className="text-xs text-brand-500 dark:text-stone-400 mb-1 block">服务商</label>
            <div className="flex gap-2">
              {(['openai', 'claude', 'qwen', 'minimax', 'custom'] as AIProvider[]).map((prov) => (
                <button
                  key={prov}
                  onClick={() => {
                    // 只切换 provider，保留已输入的 model / baseUrl / name
                    setFormProvider(prov);
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm transition border',
                    formProvider === prov
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-900 dark:text-stone-100'
                      : 'border-stone-200 dark:border-stone-600 text-brand-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-700',
                  )}
                >
                  {PROVIDER_LABELS[prov]}
                </button>
              ))}
            </div>
          </div>

          {/* 备注名称 */}
          <div>
            <label className="text-xs text-brand-500 dark:text-stone-400 mb-1 block">备注名称（可选）</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="如：我的 GPT-4o"
              maxLength={30}
              className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-sm text-brand-900 dark:text-stone-100 focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="text-xs text-brand-500 dark:text-stone-400 mb-1 block">
              API Key {editingId ? '（留空表示不修改）' : '*'}
            </label>
            <input
              type="password"
              value={formApiKey}
              onChange={(e) => setFormApiKey(e.target.value)}
              placeholder={editingId ? '留空保留原值' : 'sk-...'}
              className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-sm text-brand-900 dark:text-stone-100 focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          {/* Base URL（所有 provider 都可填，用于反向代理） */}
          <div>
            <label className="text-xs text-brand-500 dark:text-stone-400 mb-1 block">
              API Base URL {formProvider === 'custom' ? '*' : '（可选，用于代理）'}
            </label>
            <input
              value={formBaseUrl}
              onChange={(e) => setFormBaseUrl(e.target.value)}
              placeholder={baseUrlPlaceholder(formProvider)}
              className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-sm text-brand-900 dark:text-stone-100 focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          {/* 模型名称：始终用文本输入 + datalist 提示（保留用户输入，不强制重置） */}
          <div>
            <label className="text-xs text-brand-500 dark:text-stone-400 mb-1 block">模型 *</label>
            <input
              list={`models-${formProvider}`}
              value={formModel}
              onChange={(e) => setFormModel(e.target.value)}
              placeholder={formProvider === 'custom' ? '输入模型名称，如 MiniMax-M3' : '选择或输入自定义模型'}
              className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-sm text-brand-900 dark:text-stone-100 focus:ring-2 focus:ring-brand-500 outline-none"
            />
            {PROVIDER_MODELS[formProvider].length > 0 && (
              <datalist id={`models-${formProvider}`}>
                {PROVIDER_MODELS[formProvider].map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            )}
            <p className="mt-1 text-[10px] text-stone-400 dark:text-stone-500">
              {formProvider === 'custom'
                ? 'custom 模式：直接输入模型名，无推荐列表'
                : `可从下拉选 ${PROVIDER_MODELS[formProvider].length} 个推荐模型，或自行输入`}
            </p>
          </div>

          {/* 温度 */}
          <div>
            <label className="text-xs text-brand-500 dark:text-stone-400 mb-1 block">
              温度: {formTemp.toFixed(1)}
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={formTemp}
              onChange={(e) => setFormTemp(parseFloat(e.target.value))}
              className="w-full accent-brand-600"
            />
          </div>

          {/* 最大 Token */}
          <div>
            <label className="text-xs text-brand-500 dark:text-stone-400 mb-1 block">最大 Token 数</label>
            <input
              type="number"
              value={formMaxTokens}
              onChange={(e) => setFormMaxTokens(Math.max(256, Math.min(128000, parseInt(e.target.value) || 4096)))}
              min={256}
              max={128000}
              className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-sm text-brand-900 dark:text-stone-100 focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={!formModel.trim() || formModel === '__custom__' || (!editingId && !formApiKey.trim())}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-brand-800 dark:hover:bg-stone-200 disabled:opacity-50 transition"
            >
              保存
            </button>
            <button
              onClick={cancelForm}
              className="px-4 py-2 rounded-lg text-sm border border-stone-200 dark:border-stone-600 text-brand-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-700 transition"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {!hasDefaultModel && profiles.length > 0 && (
        <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
          请设置一个默认模型，AI 写作功能需要至少一个默认模型配置
        </div>
      )}
    </div>
  );
}
