/**
 * ChatInput · 输入框 + 发送按钮 + 中断按钮 + PlanMode 徽章 + @ 引用下拉
 *
 * @ 引用交互（2026-08-03 设计确认）：
 *  - 输入 `@` 弹出快捷命令菜单（@plan / @skill），选 @skill / @plan 进入对应筛选下拉
 *  - 输入 `@skill 关` 实时按名称/描述过滤技能，↑↓ 选择、Enter/点击确认、Esc 关闭
 *  - 选中后把 `@skill 名称 `（或 @plan 标题）填回输入框，可继续编辑后发送
 *  - @skill 与 @plan 可在一条消息内连用（如 `@plan 月报 @skill SEO 写月报`），互不锁定
 *  - 候选排序：纯字母/匹配序
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Square, GitBranch, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMode, Skill, AIPlan, SkillType } from '@/types/domain';
import type { ChatStatus } from '../hooks/useAIChat';
import { skillRepo, aiPlanRepo } from '@/db/repos';

interface Props {
  status: ChatStatus;
  mode: ChatMode;
  planMode?: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
  onModeChange?: (mode: ChatMode) => void;
  onExitPlanMode?: () => void;
}

const PLAN_PREFIX = '/plan ';

type MentionKind = 'command' | 'skill' | 'plan';
interface MentionState {
  kind: MentionKind;
  query: string;
}

const COMMANDS = [
  { key: '@plan', label: '引用计划', desc: '把已有执行计划注入当前会话' },
  { key: '@skill', label: '引用技能', desc: '把技能模板注入当前会话' },
];

const TYPE_COLOR: Record<SkillType, string> = {
  summary: '#6366f1',
  writing: '#10b981',
  imitate: '#a855f7',
  translate: '#f59e0b',
  custom: '#94a3b8',
};
const TYPE_LABEL: Record<SkillType, string> = {
  summary: '总结',
  writing: '写作',
  imitate: '模仿',
  translate: '翻译',
  custom: '自定义',
};

type Row =
  | { tag: 'command'; cmd: { key: string; label: string; desc: string } }
  | { tag: 'skill'; skill: Skill }
  | { tag: 'plan'; plan: AIPlan };

export default function ChatInput({
  status,
  mode,
  planMode = false,
  onSend,
  onCancel,
  onModeChange,
  onExitPlanMode,
}: Props): JSX.Element {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevPlanModeRef = useRef(planMode);

  const [mention, setMention] = useState<MentionState | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [plans, setPlans] = useState<AIPlan[]>([]);

  useEffect(() => {
    // 仅列出可引用的技能（status:'raw' 为原样收藏、尚未修复，不进选择器）。
    skillRepo.list().then((list) => setSkills(list.filter((s) => s.status !== 'raw'))).catch(() => {});
    aiPlanRepo.list().then(setPlans).catch(() => {});
  }, []);

  const isGenerating = status === 'generating';

  // PlanMode 下自动预填 /plan 前缀（仅在 false→true 跳变时触发）
  useEffect(() => {
    const prev = prevPlanModeRef.current;
    prevPlanModeRef.current = planMode;

    if (!prev && planMode) {
      const el = textareaRef.current;
      let next = text;
      if (next === '') {
        next = PLAN_PREFIX;
      } else if (!next.startsWith('/')) {
        next = PLAN_PREFIX + next;
      }
      if (next !== text) {
        setText(next);
        requestAnimationFrame(() => {
          if (!el) return;
          el.focus();
          const pos = next.length;
          el.setSelectionRange(pos, pos);
        });
      }
      return;
    }

    if (prev && !planMode) {
      if (text === PLAN_PREFIX) {
        setText('');
      }
    }
  }, [planMode, text]);

  // canSend：PlanMode 下剥掉 '/plan ' 前缀后再判空
  const effectiveBody = planMode && text.startsWith(PLAN_PREFIX) ? text.slice(PLAN_PREFIX.length) : text;
  const canSend = effectiveBody.trim().length > 0 && !isGenerating;

  // —— @ 引用下拉检测 ——
  const detect = () => {
    const el = textareaRef.current;
    if (!el) return;
    const before = el.value.slice(0, el.selectionStart);

    let m: RegExpMatchArray | null;
    if ((m = before.match(/@skill\s*(\S*)$/))) {
      setMention({ kind: 'skill', query: m[1] });
      return;
    }
    if ((m = before.match(/@plan\s*(\S*)$/))) {
      setMention({ kind: 'plan', query: m[1] });
      return;
    }
    if ((m = before.match(/(^|\s)@([a-z]*)$/i))) {
      setMention({ kind: 'command', query: m[2] });
      return;
    }
    setMention(null);
  };

  const rows = useMemo<Row[]>(() => {
    if (!mention) return [];
    const q = mention.query.trim().toLowerCase();
    if (mention.kind === 'command') {
      return COMMANDS.filter((c) => q === '' || c.key.slice(1).startsWith(q)).map((c) => ({ tag: 'command', cmd: c }));
    }
    if (mention.kind === 'skill') {
      const arr = skills.filter(
        (s) => !q || s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q),
      );
      arr.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
      return arr.map((s) => ({ tag: 'skill', skill: s }));
    }
    const arr = plans.filter((p) => !q || (p.title || '').toLowerCase().includes(q));
    arr.sort((a, b) => (a.title || '').localeCompare((b.title || ''), 'zh'));
    return arr.map((p) => ({ tag: 'plan', plan: p }));
  }, [mention, skills, plans]);

  useEffect(() => {
    setActiveIndex(0);
  }, [mention]);

  const select = (i: number) => {
    const el = textareaRef.current;
    if (!el || !mention) return;
    const pos = el.selectionStart;
    const before = el.value.slice(0, pos);
    const after = el.value.slice(pos);

    if (mention.kind === 'command') {
      const cmd = COMMANDS[i]?.key;
      if (!cmd) return;
      const mm = before.match(/@([a-z]*)$/i);
      const from = mm ? before.length - mm[0].length : before.length;
      const insert = `${cmd} `;
      const next = before.slice(0, from) + insert + after;
      setText(next);
      const np = from + insert.length;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(np, np);
      });
      setMention({ kind: cmd === '@skill' ? 'skill' : 'plan', query: '' });
      return;
    }
    if (mention.kind === 'skill') {
      const row = rows[i];
      if (!row || row.tag !== 'skill') return;
      const mm = before.match(/@skill\s*\S*$/);
      const from = mm ? before.length - mm[0].length : before.length;
      const insert = `@skill ${row.skill.name} `;
      const next = before.slice(0, from) + insert + after;
      setText(next);
      const np = from + insert.length;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(np, np);
      });
      setMention(null);
      return;
    }
    if (mention.kind === 'plan') {
      const row = rows[i];
      if (!row || row.tag !== 'plan') return;
      const mm = before.match(/@plan\s*\S*$/);
      const from = mm ? before.length - mm[0].length : before.length;
      const insert = `@plan ${row.plan.title} `;
      const next = before.slice(0, from) + insert + after;
      setText(next);
      const np = from + insert.length;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(np, np);
      });
      setMention(null);
      return;
    }
  };

  // 自动撑高（最多 200px）
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const handleSend = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText(planMode ? PLAN_PREFIX : '');
    setMention(null);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.style.height = 'auto';
        if (planMode) {
          const pos = PLAN_PREFIX.length;
          el.setSelectionRange(pos, pos);
        }
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && rows.length > 0 && activeIndex >= 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((a) => (rows.length ? (a + 1) % rows.length : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((a) => (rows.length ? (a - 1 + rows.length) % rows.length : 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        select(activeIndex);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const placeholder = isGenerating
    ? 'AI 正在回复...'
    : planMode
      ? '输入需求（可 @skill 引用技能作为计划方法论）…'
      : '输入消息…（输入 @ 引用计划/技能可连用 · /plan 生成计划 · /execute 执行）';

  return (
    <div className="border-t border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-3">
      <div className="relative flex items-end gap-2">
        {planMode && (
          <button
            type="button"
            data-testid="chat-plan-badge"
            aria-label="退出计划模式"
            title="点击退出 PlanMode"
            onClick={onExitPlanMode}
            className={cn(
              'flex-shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-full',
              'text-xs font-medium text-brand-700 dark:text-brand-300',
              'bg-brand-100 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800',
              'hover:bg-brand-200 dark:hover:bg-brand-900/60 transition-colors',
            )}
          >
            <GitBranch size={12} />
            <span>计划</span>
            <X size={12} className="ml-0.5" />
          </button>
        )}
        <textarea
          ref={textareaRef}
          data-testid="chat-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            detect();
          }}
          onClick={detect}
          onKeyUp={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) detect();
          }}
          onBlur={() => setMention(null)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isGenerating}
          rows={1}
          className={cn(
            'flex-1 resize-none rounded-xl border border-stone-200 dark:border-stone-600',
            'bg-white dark:bg-stone-700 text-sm text-stone-800 dark:text-stone-100 px-3 py-2',
            'focus:outline-none focus:ring-2 focus:ring-brand-900/20 placeholder:text-stone-400',
            'disabled:bg-stone-50 dark:disabled:bg-stone-800 disabled:cursor-not-allowed',
          )}
        />

        {/* @ 引用下拉 */}
        {mention && (
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-xl max-h-72 overflow-y-auto z-20">
            <div className="flex items-center justify-between px-3 py-2 text-[11px] text-stone-400 border-b border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/40 rounded-t-xl">
              <span>{mention.kind === 'command' ? '选择命令' : mention.kind === 'skill' ? '引用技能' : '引用计划'}（实时匹配）</span>
              <span>
                <kbd className="px-1 py-0.5 rounded bg-stone-200 dark:bg-stone-700">↑</kbd>
                <kbd className="px-1 py-0.5 rounded bg-stone-200 dark:bg-stone-700 ml-0.5">↓</kbd> 选择 ·{' '}
                <kbd className="px-1 py-0.5 rounded bg-stone-200 dark:bg-stone-700">Enter</kbd> 确认 ·{' '}
                <kbd className="px-1 py-0.5 rounded bg-stone-200 dark:bg-stone-700">Esc</kbd> 关闭
              </span>
            </div>
            {rows.length === 0 ? (
              <div className="px-3 py-3 text-xs text-stone-400 text-center">无匹配，回车按原样发送</div>
            ) : (
              rows.map((r, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 cursor-pointer border-b border-stone-50 dark:border-stone-700/50 last:border-0',
                    i === activeIndex && 'bg-brand-50 dark:bg-brand-900/30',
                  )}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(i);
                  }}
                >
                  {r.tag === 'command' && (
                    <>
                      <span className="text-[13px] font-semibold text-brand-700 dark:text-brand-300 w-14 flex-shrink-0">{r.cmd.key}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-stone-800 dark:text-stone-100">{r.cmd.label}</div>
                        <div className="text-[11px] text-stone-400 truncate">{r.cmd.desc}</div>
                      </div>
                    </>
                  )}
                  {r.tag === 'skill' && (
                    <>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TYPE_COLOR[r.skill.type] }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-stone-800 dark:text-stone-100">
                          {r.skill.name}
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-700 text-stone-500">
                            {TYPE_LABEL[r.skill.type]}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-400 truncate">{r.skill.description || '（无描述）'}</div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {r.skill.params.map((p) => (
                          <span key={p.key} className="text-[10px] bg-stone-100 dark:bg-stone-700 text-stone-500 rounded px-1.5 py-0.5">
                            {p.label || p.key}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  {r.tag === 'plan' && (
                    <>
                      <span className="w-2 h-2 rounded-full flex-shrink-0 bg-cyan-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-stone-800 dark:text-stone-100">{r.plan.title}</div>
                        <div className="text-[11px] text-stone-400 truncate">
                          {r.plan.steps.length} 步{r.plan.description ? ` · ${r.plan.description}` : ''}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {isGenerating ? (
          <button
            type="button"
            data-testid="chat-cancel"
            onClick={onCancel}
            aria-label="停止生成"
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
          >
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            data-testid="chat-send"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="发送"
            className={cn(
              'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
              canSend
                ? 'bg-brand-900 hover:bg-brand-800 text-white dark:bg-brand-700 dark:hover:bg-brand-600'
                : 'bg-stone-100 dark:bg-stone-700 text-stone-400 cursor-not-allowed',
            )}
          >
            <Send size={16} />
          </button>
        )}
      </div>

      {/* 模式占位（ai-chat-intent-routing 接入） */}
      {onModeChange && (
        <div className="mt-2 flex items-center justify-between text-[11px] text-stone-400 dark:text-stone-500">
          <span>当前模式：{mode === 'guided' ? '🧭 引导模式' : '⚡ 自由模式'}</span>
          <button type="button" onClick={() => onModeChange(mode === 'guided' ? 'free' : 'guided')} className="hover:underline">
            切换
          </button>
        </div>
      )}
    </div>
  );
}
