/**
 * AIChat · /ai-chat 全屏页
 *
 * AppLayout 已为 /ai-chat 路由提供整宽整高的 <main> 容器（绕过 max-w-7xl）。
 * 这里直接 h-full 填满父级即可。
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Sparkles, GitBranch, ListChecks, FileText, Settings as SettingsIcon } from 'lucide-react';
import { useAIChat } from '@/features/ai-chat/hooks/useAIChat';
import { useAIModelStore } from '@/features/ai/stores/aiModelStore';
import { buildChatSystemPrompt } from '@/features/ai-chat/prompts/chatSystemPrompt';
import ChatSessionList from '@/features/ai-chat/components/ChatSessionList';
import ChatPanel, { type CardAction } from '@/features/ai-chat/components/ChatPanel';
import ModelSelector from '@/features/ai-chat/components/ModelSelector';
import { handleCreatePlan } from '@/features/ai-chat/handlers/createPlanHandler';
import { handleSaveBlogDraft } from '@/features/ai-chat/handlers/createBlogHandler';
import { handleCreateTemplate } from '@/features/ai-chat/handlers/createTemplateHandler';
import { emitChatEvent } from '@/features/ai-chat/utils/emitChatEvent';
import { generateExecutionPlan, type PlanSkillContext } from '@/features/ai-chat/utils/generateExecutionPlan';
import { parseMentions, stripMentions } from '@/features/ai-chat/utils/mentionParser';
import { executeStep } from '@/features/ai-chat/utils/executeStep';
import { interceptDataQuery } from '@/features/ai-chat/utils/queryInterceptor';
import { aiPlanRepo, chatSessionRepo, planModeMetaRepo, skillRepo } from '@/db/repos';
import { newId } from '@/lib/id';
import type { ActionCard, AIPlan, ChatMessage, ExecutionStepStatus, ID } from '@/types/domain';

/** 从会话消息中取最后一个 execution_plan 卡片。 */
function findPlanInMessages(messages: ChatMessage[]): AIPlan | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const c = messages[i].actionCard;
    if (c?.type === 'execution_plan') return c.data;
  }
  return null;
}

/**
 * 持久化 PlanMode 双会话映射（Dexie meta 表，键 planModeState，架构 §7.3）。
 * 以 meta 为准；useState 只做 UI 同步，刷新后从此恢复 A/B 会话与进度。
 */
async function persistPlanModeState(
  patch: Partial<{ planA?: ID; planB?: ID; activeTab?: 'A' | 'B' }>,
): Promise<void> {
  const prev = (await planModeMetaRepo.getState()) ?? {};
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  await planModeMetaRepo.setState(next);
}

/**
 * 直接向指定会话追加 assistant 文本消息（不触发 React 状态）。
 *
 * 为什么不用 chat.appendAssistantMessage：
 * /plan 在 PlanMode 未开启时会先 enterPlanMode 切到新会话 A，React 18 同一事件内不会 re-render，
 * hook 方法闭包捕获的还是旧 activeSessionId，追加会落到旧会话（或空会话被丢弃）。
 * 这里直写 repo + 调用方最后 chat.setSessionId 重载，幂等且不依赖渲染时机。
 *
 * @param thinking D1：AI 思考过程，写入后 ChatMessage 自动渲染「思考过程 ▼」折叠区（默认收起）。
 */
async function appendTextToSession(sessionId: ID, text: string, thinking?: string): Promise<void> {
  const msg: ChatMessage = { id: newId(), role: 'assistant', content: text, timestamp: Date.now() };
  if (thinking && thinking.trim()) msg.thinking = thinking;
  await chatSessionRepo.appendMessage(sessionId, msg);
}

/**
 * 直接向指定会话追加 assistant 卡片消息（不触发 React 状态）。
 * @param thinking D1：AI 思考过程（挂在承载「生成说明」的这条消息上）。
 */
async function appendCardToSession(
  sessionId: ID,
  card: ActionCard,
  text = '',
  thinking?: string,
): Promise<void> {
  const msg: ChatMessage = {
    id: newId(),
    role: 'assistant',
    content: text,
    timestamp: Date.now(),
    actionCard: card,
  };
  if (thinking && thinking.trim()) msg.thinking = thinking;
  await chatSessionRepo.appendMessage(sessionId, msg);
}

/** 直接向指定会话追加 user 消息（PlanMode 自动出计划时回显用户输入）。 */
async function appendUserToSession(sessionId: ID, text: string): Promise<void> {
  const msg: ChatMessage = {
    id: newId(),
    role: 'user',
    content: text,
    timestamp: Date.now(),
    status: 'sent',
  };
  await chatSessionRepo.appendMessage(sessionId, msg);
}

/**
 * 从会话消息中收集 data_query(get_blogs) 卡片真实命中的博客 id。
 * 取最后一张查询卡（用户最近一次查询即当前上下文），真实走 interceptDataQuery。
 */
async function collectQueryCardBlogIds(messages: ChatMessage[]): Promise<ID[]> {
  for (let i = messages.length - 1; i >= 0; i--) {
    const card = messages[i].actionCard;
    if (card?.type === 'data_query' && card.tool === 'get_blogs') {
      try {
        const qr = await interceptDataQuery('get_blogs', card.filter);
        return qr.displayRows.map((r) => r.id);
      } catch (err) {
        console.error('[collectQueryCardBlogIds] 查询失败：', err);
        return [];
      }
    }
  }
  return [];
}

/** 在指定会话中回写 execution_plan 卡片（步骤进度），供 /execute 逐步执行时同步进度。 */
async function updatePlanCardInSession(sessionId: ID, planId: ID, next: AIPlan): Promise<void> {
  const session = await chatSessionRepo.get(sessionId);
  if (!session) return;
  const messages = session.messages.map((m) =>
    m.actionCard?.type === 'execution_plan' && (m.actionCard.data as AIPlan).id === planId
      ? { ...m, actionCard: { type: 'execution_plan', data: next } as ActionCard }
      : m,
  );
  await chatSessionRepo.update(sessionId, { messages });
}

export default function AIChat(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSessionId = searchParams.get('session');

  const chat = useAIChat((ctx) => buildChatSystemPrompt({ mode: ctx.mode ?? 'free' }));
  const [sessionTitle, setSessionTitle] = useState('新对话');

  // ===== F4：未配置 AI 模型时的启动检测与空态引导 =====
  // 等待 zustand persist 水合完成后再做空态判断，避免水合前初始空数组导致页面闪一下空态。
  const [modelsReady, setModelsReady] = useState(false);
  useEffect(() => {
    if (useAIModelStore.persist.hasHydrated()) {
      setModelsReady(true);
      return;
    }
    const unsub = useAIModelStore.persist.onFinishHydration(() => setModelsReady(true));
    return () => unsub();
  }, []);
  /** 水合完成后仍无任何模型配置 → 渲染整页空态卡片（替代 ChatPanel）。 */
  const showModelSetupEmpty = modelsReady && chat.availableProfiles.length === 0;

  // ===== PlanMode（v1.3 P 模块）=====
  const [planMode, setPlanMode] = useState(false);
  const [planTab, setPlanTab] = useState<'A' | 'B'>('A');
  const [sessionsAB, setSessionsAB] = useState<{ A?: ID; B?: ID }>({});
  const enteringRef = useRef(false);
  /** @plan 注入的计划引用（/execute 缺省取此，其次当前会话卡片、最近保存）。 */
  const referencedPlanIdRef = useRef<ID | null>(null);
  /**
   * Plan 模式下 @skill 引用的「计划生成方法论上下文」（仅当前计划会话有效）。
   * 生成计划时注入 system，让 AI 按该技能模板拆解步骤；退出 PlanMode 清空。
   */
  const planSkillRef = useRef<PlanSkillContext | null>(null);
  /**
   * 会话上下文「已选博客 id」。
   * 目前由外部入口（博客列表 → 发送到对话）预留写入；/execute 时与查询卡片命中 id 合并去重。
   */
  const selectedBlogIdsRef = useRef<ID[]>([]);

  /**
   * 兜底：即使异步初始化失败，也要把 UI 切到 PlanMode，避免「点了没反应」。
   * @returns 规划会话 A 的 session id（初始化失败时为 undefined）。
   * 建 A 后立即持久化 planA，保证 /plan 未开模式直接输入时也能正确恢复。
   */
  const enterPlanMode = async (): Promise<ID | undefined> => {
    if (enteringRef.current) return sessionsAB.A;
    enteringRef.current = true;
    try {
      let a = sessionsAB.A;
      if (!a) {
        a = await chat.createNewSession();
        setSessionsAB((s) => ({ ...s, A: a }));
        await persistPlanModeState({ planA: a, activeTab: 'A' });
      }
      await chat.setSessionId(a);
      return a;
    } catch (err) {
      console.error('[enterPlanMode] 初始化失败，仍进入 PlanMode：', err);
    } finally {
      setPlanTab('A');
      setPlanMode(true);
      enteringRef.current = false;
    }
    return undefined;
  };

  /** 确保规划会话 A 存在并返回其 id（先读 state/meta，避免重复创建空会话）。 */
  const ensurePlanSessionA = async (): Promise<ID | undefined> => {
    const existing = sessionsAB.A ?? (await planModeMetaRepo.getState())?.planA;
    if (existing) return existing;
    return enterPlanMode();
  };

  /**
   * 向指定会话追加 assistant 文本并同步 UI（sid 缺省退化为 hook 方法，追加到当前活动会话）。
   * 同步 = repo 直写后 chat.setSessionId(sid) 重载消息（幂等）。
   */
  const sayTo = async (text: string, sid?: ID): Promise<void> => {
    if (sid) {
      await appendTextToSession(sid, text);
      await chat.setSessionId(sid);
    } else {
      await chat.appendAssistantMessage(text);
    }
  };

  /**
   * 向指定会话追加 assistant 卡片并同步 UI（sid 缺省退化为 hook 方法）。
   * @param thinking D1：思考过程写入该条消息，ChatMessage 折叠渲染。
   */
  const cardTo = async (card: ActionCard, text: string, sid?: ID, thinking?: string): Promise<void> => {
    if (sid) {
      await appendCardToSession(sid, card, text, thinking);
      await chat.setSessionId(sid);
    } else if (thinking && thinking.trim()) {
      // hook 无 thinking 入参：退化为「当前活动会话直写 repo + 重载」，保证折叠区不丢
      const active = chat.activeSessionId;
      if (active) {
        await appendCardToSession(active, card, text, thinking);
        await chat.setSessionId(active);
      } else {
        await chat.appendAssistantCard(card, text);
      }
    } else {
      await chat.appendAssistantCard(card, text);
    }
  };

  /**
   * 生成执行计划并落卡片（/plan 与 PlanMode 自动触发共用，T1 + T3）。
   * thinking 写入承载「生成说明」的那条 assistant 消息 → ChatMessage 折叠渲染。
   */
  const generateAndRenderPlan = async (
    goal: string,
    sid?: ID,
    skillCtx?: PlanSkillContext,
  ): Promise<void> => {
    try {
      const { plan, fallback, thinking } = await generateExecutionPlan(goal, skillCtx);
      const saved = await aiPlanRepo.upsert({ ...plan, sourceSessionId: sid });
      await cardTo(
        { type: 'execution_plan', data: saved },
        fallback ? 'AI 解析失败，已降级为可编辑模板（可点修改）：' : `已为「${goal}」生成执行计划：`,
        sid,
        thinking,
      );
    } catch (err) {
      await sayTo('生成计划失败：' + (err instanceof Error ? err.message : String(err)), sid);
    }
  };

  /**
   * 合并去重「会话上下文已选博客 id」∪「查询卡片命中博客 id」。
   * 作为 executeStep 的 ctx.blogs 注入源（替代原来的空数组）。
   */
  const resolveContextBlogIds = async (sid?: ID): Promise<ID[]> => {
    let messages: ChatMessage[] = chat.messages;
    if (sid) {
      try {
        const session = await chatSessionRepo.get(sid);
        if (session) messages = session.messages;
      } catch (err) {
        console.error('[resolveContextBlogIds] 读取会话失败：', err);
      }
    }
    const fromCards = await collectQueryCardBlogIds(messages);
    return Array.from(new Set([...selectedBlogIdsRef.current, ...fromCards]));
  };

  const exitPlanMode = async () => {
    setPlanMode(false);
    planSkillRef.current = null; // 清空 Plan 模式的技能方法论上下文
    // 退出后默认回到 A tab（映射本身保留，供恢复逻辑使用）
    await persistPlanModeState({ activeTab: 'A' }).catch(console.error);
  };

  /**
   * @plan <关键词>：引用已有执行计划卡片到会话。
   */
  const applyPlanMention = async (keyword: string): Promise<void> => {
    const kw = keyword.toLowerCase();
    const sid = planMode ? (chat.activeSessionId ?? undefined) : await enterPlanMode();
    const plans = await aiPlanRepo.list();
    const matched = kw
      ? (() => {
          const exact = plans.find((p) => p.title.toLowerCase() === kw);
          return exact ? [exact] : plans.filter((p) => p.title.toLowerCase().includes(kw));
        })()
      : plans;
    if (matched.length === 0) {
      await sayTo('没有匹配的计划，请先用 /plan 生成。', sid);
      return;
    }
    const p = matched[0]; // 取第一条匹配（精确优先）
    referencedPlanIdRef.current = p.id; // 供 /execute 缺省引用
    await cardTo({ type: 'execution_plan', data: p }, `引用计划「${p.title}」：`, sid);
  };

  /**
   * @skill <关键词>：
   *  - Plan 模式下 → 设为「计划生成方法论上下文」（planSkillRef），生成计划时注入 system。
   *  - 普通模式 → 把 promptTemplate 注入当前会话 system 消息（[技能引用：X]）。
   * @param opts.silent 为 true 时不单独发确认消息（调用方即将生成计划/发送时避免重复提示）。
   */
  const applySkillMention = async (keyword: string, opts?: { silent?: boolean }): Promise<void> => {
    const kw = keyword.toLowerCase();
    const skills = await skillRepo.list();
    const s = skills.find((x) => x.name.toLowerCase() === kw) ?? skills.find((x) => x.name.toLowerCase().includes(kw));
    if (!s) {
      await sayTo(`没有匹配到名为「${keyword}」的技能。`);
      return;
    }
    // 原样收藏（status:'raw'）尚未修复，不可引用。
    if (s.status === 'raw') {
      await sayTo(`技能「${s.name}」尚未修复（导入时格式不兼容、仅作收藏）。请先在「技能」页该卡片上点「修复」转为可用格式，再引用。`);
      return;
    }
    // 用默认值填充参数占位符
    let injected = s.promptTemplate;
    for (const p of s.params) {
      injected = injected.split(`{{${p.key}}}`).join(p.default ?? '');
    }
    if (planMode) {
      planSkillRef.current = { name: s.name, template: injected };
      if (!opts?.silent) {
        await sayTo(`已设为计划生成模板：「${s.name}」，生成计划时将按该技能方法论拆解步骤。`, chat.activeSessionId ?? undefined);
      }
      return;
    }
    let sid = chat.activeSessionId ?? undefined;
    if (!sid) {
      sid = await chat.createNewSession();
      await chat.setSessionId(sid);
    }
    const sysMsg: ChatMessage = {
      id: newId(),
      role: 'system',
      content: `[技能引用：${s.name}]\n${injected}`,
      timestamp: Date.now(),
    };
    await chatSessionRepo.appendMessage(sid, sysMsg);
    await chat.setSessionId(sid);
    if (!opts?.silent) {
      await sayTo(`已引用技能「${s.name}」，后续对话将按该技能模板执行。`, sid);
    }
  };

  /**
   * PlanMode 命令拦截：返回 true 表示已本地处理（不转发给 AI）。
   * 即使 PlanMode 没开，/plan /execute @plan 也自动激活模式。
   *
   * - /plan <需求> [内嵌 @plan/@skill]：规划会话 A 真走 AI 流式生成（generateExecutionPlan），
   *   内嵌的 @skill 作为计划方法论上下文、@plan 引用计划卡片，均可连用
   * - /execute [planId] [1-3|all]：逐步真实执行（executeStep），步骤状态回写 + 结果卡片
   * - @plan / @skill 可一条消息内多次出现、互相连用：分别引用计划 / 设定技能模板，
   *   剩余文本作为需求（PlanMode 生成计划）或普通消息（普通模式发给 AI）
   */
  const handlePlanCommand = async (raw: string): Promise<boolean> => {
    const t = raw.trim();
    const mentions = parseMentions(t);
    const isCommand =
      mentions.length > 0 ||
      t.startsWith('/plan ') ||
      t.startsWith('/execute') ||
      t.startsWith('@plan') ||
      t.startsWith('@skill');
    if (!isCommand) {
      // T3：PlanMode 开启时，非 `/` 开头的普通输入 = 需求描述 → 自动产出执行计划卡片
      // （PlanMode 未开启的普通聊天完全不受影响，继续走 chat.send）
      if (planMode && t.length > 0 && !t.startsWith('/')) {
        const sid = await ensurePlanSessionA();
        if (sid) await appendUserToSession(sid, t);
        await generateAndRenderPlan(t, sid, planSkillRef.current ?? undefined);
        return true;
      }
      return false;
    }

    // —— /plan <需求>（可内嵌 @plan/@skill 引用，一并解析）——
    if (t.startsWith('/plan ')) {
      let goal = t.slice('/plan '.length).trim();
      const inner = parseMentions(goal);
      for (const m of inner) {
        if (m.kind === 'plan') await applyPlanMention(m.keyword);
        else if (m.kind === 'skill') await applySkillMention(m.keyword, { silent: true });
      }
      goal = stripMentions(goal);
      const sid = await ensurePlanSessionA();
      if (!goal) {
        await sayTo('请提供规划需求，例如 /plan 写一篇月度算法总结', sid);
        return true;
      }
      if (sid) await appendUserToSession(sid, t);
      await generateAndRenderPlan(goal, sid, planSkillRef.current ?? undefined);
      return true;
    }

    // —— /execute [planId] [1-3|all] ——
    if (t.startsWith('/execute')) {
      const arg = t.slice('/execute'.length).trim();
      // 执行会话：PlanMode 已开 → 当前查看的会话；未开 → 自动进入（建 A）
      const sid = planMode
        ? (chat.activeSessionId ?? sessionsAB.B ?? sessionsAB.A ?? undefined)
        : await enterPlanMode();

      // 解析 planId 与步骤范围："planId 1-3" / "1-3" / "all" / "planId" / 空
      const tokens = arg.split(/\s+/).filter(Boolean);
      const isRangeToken = (s: string): boolean => /^\d+(-\d+)?$/.test(s) || /^all$/i.test(s);
      let planIdArg: string | undefined;
      let range = 'all';
      if (tokens.length >= 2) {
        if (!isRangeToken(tokens[0])) {
          // "planId 1-3"
          planIdArg = tokens[0];
          range = tokens.slice(1).join(' ');
        } else {
          range = tokens.join(' ');
        }
      } else if (tokens.length === 1) {
        if (isRangeToken(tokens[0])) {
          range = tokens[0];
        } else {
          // 单个 token 且不是范围 → 视为 planId（ULID 长度 > 3）
          planIdArg = tokens[0];
        }
      }

      // 取计划：显式 planId > @plan 引用 > 当前会话末条计划卡片 > 最近保存
      // findPlanInMessages 返回 AIPlan | null，故声明含 null
      let plan: AIPlan | undefined | null;
      if (planIdArg) {
        plan = await aiPlanRepo.get(planIdArg);
      } else {
        if (referencedPlanIdRef.current) {
          plan = await aiPlanRepo.get(referencedPlanIdRef.current);
        }
        if (!plan) plan = findPlanInMessages(chat.messages);
        if (!plan) {
          const plans = await aiPlanRepo.list();
          if (plans.length > 0) plan = plans[0];
        }
      }
      if (!plan) {
        await sayTo('没有可执行的计划，请先在规划会话用 /plan 生成，或 @plan 引用一个计划。', sid);
        return true;
      }

      // 解析范围 → 步骤下标
      const total = plan.steps.length;
      const indices: number[] = [];
      if (/^all$/i.test(range)) {
        plan.steps.forEach((_, i) => indices.push(i));
      } else if (range.includes('-')) {
        const [ra, rb] = range.split('-').map((n) => parseInt(n, 10));
        if (Number.isFinite(ra) && Number.isFinite(rb)) {
          for (let i = ra; i <= rb && i <= total; i++) {
            if (i >= 1) indices.push(i - 1);
          }
        }
      } else {
        const n = parseInt(range, 10);
        if (Number.isFinite(n) && n >= 1 && n <= total) indices.push(n - 1);
      }
      if (indices.length === 0) {
        await sayTo(`步骤范围「${range}」无效，该计划共 ${total} 步。`, sid);
        return true;
      }

      // 注入真实博客：会话上下文已选 ∪ 查询卡片命中（合并去重），替代原来的空数组
      const contextBlogIds = await resolveContextBlogIds(sid);

      // 逐步真实执行（executeStep 失败不 throw，结果文本照常落卡片）
      let done = 0;
      for (const idx of indices) {
        const step = plan.steps[idx];
        const { result, cards } = await executeStep(plan, step, { blogs: contextBlogIds });
        await aiPlanRepo.setStepStatus(plan.id, step.id, 'done');
        const updated = await aiPlanRepo.get(plan.id);
        if (sid && updated) {
          await updatePlanCardInSession(sid, plan.id, updated);
        } else if (updated) {
          await chat.updateAssistantPlan(plan.id, updated);
        }
        const card: ActionCard = {
          type: 'execution_step_result',
          data: { planId: plan.id, stepOrder: idx + 1, title: step.title, result },
        };
        if (sid) {
          await appendCardToSession(sid, card);
          // 真实查询卡片（DataQueryCard 自行调 interceptDataQuery 渲染命中数据）
          for (const extra of cards) await appendCardToSession(sid, extra);
        } else {
          await chat.appendAssistantCard(card);
          for (const extra of cards) await chat.appendAssistantCard(extra);
        }
        done += 1;
      }
      await sayTo(`已推进 ${range}：完成 ${done} 步。`, sid);
      return true;
    }

    // —— 含有 @plan / @skill 引用（可多个、可连用）——
    if (mentions.length > 0) {
      // 先剥离所有 mention 片段，得到剩余文本（即真正的"需求/内容"）
      const remaining = stripMentions(t);

      // 先处理 @plan（引用计划卡片），再 @skill（设定模板/注入会话）
      for (const m of mentions) {
        if (m.kind === 'plan') await applyPlanMention(m.keyword);
      }
      for (const m of mentions) {
        if (m.kind === 'skill') await applySkillMention(m.keyword, { silent: !!remaining });
      }

      if (remaining) {
        if (planMode) {
          const sid = await ensurePlanSessionA();
          if (sid) await appendUserToSession(sid, remaining);
          await generateAndRenderPlan(remaining, sid, planSkillRef.current ?? undefined);
        } else {
          // 普通模式：技能已注入会话 system，剩余文本作为用户消息发给 AI
          await chat.send(remaining);
        }
      }
      return true;
    }

    return false;
  };

  const handleSend = async (text: string) => {
    if (await handlePlanCommand(text)) return;
    chat.send(text).catch(console.error);
  };

  const handlePlanStepToggle = async (planId: ID, stepId: ID, status: ExecutionStepStatus) => {
    const plan = await aiPlanRepo.get(planId);
    if (!plan) return;
    const updated: AIPlan = { ...plan, steps: plan.steps.map((s) => (s.id === stepId ? { ...s, status } : s)) };
    await aiPlanRepo.upsert(updated);
    await chat.updateAssistantPlan(updated.id, updated);
  };

  const handlePlanRunInB = async (planId: ID) => {
    let b = sessionsAB.B;
    if (!b) {
      b = await chat.createNewSession();
      setSessionsAB((s) => ({ ...s, B: b }));
      await persistPlanModeState({ planB: b, activeTab: 'B' });
    }
    await chat.setSessionId(b);
    setPlanTab('B');
    const plan = await aiPlanRepo.get(planId);
    // repo 直写 + 重载，避免同一事件内切换会话后闭包 activeSessionId 过期
    if (plan) {
      await appendCardToSession(b, { type: 'execution_plan', data: plan }, `开始执行计划「${plan.title}」：`);
      await chat.setSessionId(b);
    }
  };

  useEffect(() => {
    if (initialSessionId) {
      chat.setSessionId(initialSessionId).catch(console.error);
    }
  }, [initialSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== PlanMode：sessionsAB 从 meta 表恢复（刷新后 A/B 双会话与进度不丢，架构 §3.3） =====
  useEffect(() => {
    (async () => {
      try {
        const st = await planModeMetaRepo.getState();
        if (!st) return;
        // 校验会话存在性（被删的跳过）
        const [aOk, bOk] = await Promise.all([
          st.planA ? chatSessionRepo.get(st.planA).then(Boolean) : Promise.resolve(false),
          st.planB ? chatSessionRepo.get(st.planB).then(Boolean) : Promise.resolve(false),
        ]);
        const next: { A?: ID; B?: ID } = {};
        if (st.planA && aOk) next.A = st.planA;
        if (st.planB && bOk) next.B = st.planB;
        setSessionsAB(next);
        if ((st.planA && aOk) || (st.planB && bOk)) {
          setPlanMode(true);
          setPlanTab(st.activeTab === 'B' && st.planB && bOk ? 'B' : 'A');
          // URL 带 ?session=xxx 时优先切到 URL 会话（架构 §3.3），仍保留 tab 栏
          if (!initialSessionId) {
            const target = st.activeTab === 'B' ? (bOk ? st.planB : st.planA) : (aOk ? st.planA : st.planB);
            if (target) await chat.setSessionId(target);
          }
        }
      } catch (err) {
        console.error('[PlanMode 恢复] 读取 planModeState 失败：', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const s = chat.sessions.find((x) => x.id === chat.activeSessionId);
    if (s) setSessionTitle(s.title);
  }, [chat.sessions, chat.activeSessionId]);

  const ctx = useMemo(
    () => ({
      navigate,
      appendAssistantMessage: chat.appendAssistantMessage,
    }),
    [navigate, chat.appendAssistantMessage],
  );

  const handleCardAction: CardAction = (card, action) => {
    const cardType =
      card.type === 'plan_preview' ? 'plan' :
      card.type === 'blog_preview' ? 'blog' :
      card.type === 'template_preview' ? 'template' :
      card.type === 'data_query' ? 'query' :
      card.type === 'suggestion' ? 'suggestion' : 'plan';

    if (action === 'cancel') {
      emitChatEvent('chat_card_cancel', { cardType });
      chat.appendAssistantMessage('好的，已取消该操作。').catch(console.error);
      return;
    }
    if (action === 'modify') {
      emitChatEvent('chat_card_modify', { cardType });
      chat.appendAssistantMessage('请告诉我你想如何修改？').catch(console.error);
      return;
    }
    emitChatEvent('chat_card_confirm', { cardType });
    if (card.type === 'plan_preview') {
      void handleCreatePlan(card.data, ctx);
    } else if (card.type === 'blog_preview') {
      void handleSaveBlogDraft(card.data, ctx);
    } else if (card.type === 'template_preview') {
      void handleCreateTemplate(card.data, ctx);
    } else {
      console.log('[CardAction confirm] unhandled card type:', card.type);
    }
  };

  const handleTemplatePick = (templateName: string) => {
    chat.send(`使用模板 ${templateName}`).catch(console.error);
  };

  const showTemplatePicker = useMemo(() => {
    const last = chat.messages[chat.messages.length - 1];
    return (
      last?.actionCard?.type === 'blog_preview' &&
      !last.actionCard.data.templateId
    );
  }, [chat.messages]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-stone-900">
      {/* 顶栏 */}
      <div className="px-6 py-3 border-b border-stone-200 dark:border-stone-700 flex items-center gap-3 bg-white dark:bg-stone-800 flex-shrink-0">
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="返回"
          className="w-8 h-8 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 flex items-center justify-center text-brand-500"
        >
          <ArrowLeft size={16} />
        </button>
        <Sparkles size={16} className="text-brand-700 dark:text-brand-400" />
        <button
          type="button"
          onClick={() => (planMode ? exitPlanMode() : enterPlanMode())}
          className={
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ' +
            (planMode
              ? 'bg-brand-900 text-white'
              : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-200')
          }
        >
          <GitBranch size={13} /> PlanMode
        </button>
        <h2 className="text-base font-bold text-brand-900 dark:text-stone-100 truncate flex-1">
          {planMode ? (planTab === 'A' ? '规划 A' : '执行 B') : sessionTitle}
        </h2>
        <ModelSelector
          value={chat.modelProfileId}
          options={chat.availableProfiles}
          disabled={!chat.activeSessionId || chat.status === 'generating'}
          onChange={(id) => {
            chat.setModelProfileId(id).catch(console.error);
          }}
        />
        <span className="text-xs text-stone-400 dark:text-stone-500 ml-2">
          {chat.activeSessionId ? `${chat.messages.length} 条消息` : '未选择会话'}
        </span>
      </div>

      {/* PlanMode 双会话 Tab */}
      {planMode && (
        <div className="px-6 py-2 border-b border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 flex items-center gap-2">
          {(['A', 'B'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={async () => {
                const sid = tab === 'A' ? sessionsAB.A : sessionsAB.B;
                if (sid) {
                  await chat.setSessionId(sid);
                  setPlanTab(tab);
                  await persistPlanModeState({ activeTab: tab });
                }
              }}
              className={
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ' +
                (planTab === tab
                  ? 'bg-brand-900 text-white'
                  : 'bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-600')
              }
            >
              {tab === 'A' ? <FileText size={13} /> : <ListChecks size={13} />}
              {tab === 'A' ? '规划 A' : '执行 B'}
            </button>
          ))}
          <span className="ml-2 text-[11px] text-stone-400">
            规划 A 用 <code>/plan</code> 产出计划，执行 B 用 <code>/execute 1-3|all</code> 推进
          </span>
        </div>
      )}

      {/* 主体 */}
      <div className="flex flex-1 min-h-0">
        <div className="w-60 flex-shrink-0 border-r border-stone-200 dark:border-stone-700">
          <ChatSessionList
            sessions={chat.sessions}
            activeSessionId={chat.activeSessionId}
            onSelect={(id) => {
              chat.setSessionId(id).catch(console.error);
              navigate(`/ai-chat?session=${id}`, { replace: true });
            }}
            onCreate={() => {
              chat
                .createNewSession()
                .then((id) => navigate(`/ai-chat?session=${id}`, { replace: true }))
                .catch(console.error);
            }}
            onDelete={() => {
              chat.deleteCurrentSession().catch(console.error);
              navigate('/ai-chat', { replace: true });
            }}
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {showModelSetupEmpty ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="w-full max-w-sm text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-50 dark:bg-stone-800 border border-brand-100 dark:border-stone-700 flex items-center justify-center">
                  <Sparkles size={28} className="text-brand-600 dark:text-brand-400" />
                </div>
                <h3 className="text-lg font-bold text-brand-900 dark:text-stone-100 mb-2">
                  尚未配置 AI 模型
                </h3>
                <p className="text-sm text-stone-500 dark:text-stone-400 mb-6 leading-relaxed">
                  前往设置添加模型（支持 OpenAI / Claude / MiniMax / Qwen）即可开始对话
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/settings#ai-models')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-900 hover:bg-brand-800 dark:bg-brand-700 dark:hover:bg-brand-600 text-white text-sm font-medium transition-colors"
                >
                  <SettingsIcon size={14} />
                  去设置
                </button>
              </div>
            </div>
          ) : (
            <ChatPanel
              status={chat.status}
              messages={chat.messages}
              mode={chat.mode}
              planMode={planMode}
              activeSessionId={chat.activeSessionId}
              errorMessage={chat.errorMessage}
              onSend={handleSend}
              onCancel={chat.cancel}
              onExitPlanMode={exitPlanMode}
              onModeChange={(m) => {
                chat.setMode(m).catch(console.error);
              }}
              onCardAction={handleCardAction}
              onTemplatePick={handleTemplatePick}
              showTemplatePicker={showTemplatePicker}
              onPlanStepToggle={handlePlanStepToggle}
              onPlanRunInB={handlePlanRunInB}
            />
          )}
        </div>
      </div>
    </div>
  );
}