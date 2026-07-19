/**
 * Step1BasicInfo - 步骤 1：基础信息表单
 *
 * 字段（spec §「基础信息表单」）：
 * - title：必填，max 100 字
 * - description：可选，max 500 字
 * - startDate：可选
 * - endDate：可选，> startDate
 * - tags：标签（v1.0 简化为字符串数组，input + 逗号分隔）
 *
 * 视觉（与 prototype plan-edit.html 步骤 1 对齐）：
 * - 白底卡片 + 圆角 2xl + 边框
 * - title 满行 + description 满行 + dates 并列
 * - 标签：badge + × 关闭
 *
 * 校验（内联红字）：
 * - title 空白时 disabled
 * - endDate < startDate 时红字「截止日期不能早于开始日期」
 */

import { useState, useRef, type KeyboardEvent } from 'react';
import { X, Plus, Tag as TagIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DraftFormState } from '../hooks/usePlanEditDraft';

interface Props {
  state: DraftFormState;
  onChange: (patch: Partial<DraftFormState>) => void;
}

export default function Step1BasicInfo({ state, onChange }: Props) {
  const [tagInput, setTagInput] = useState('');
  const tagInputRef = useRef<HTMLInputElement | null>(null);

  const tags = state.tags;
  const endBeforeStart =
    state.startDate &&
    state.endDate &&
    new Date(state.endDate) < new Date(state.startDate);

  const setTags = (next: string[]) => {
    onChange({ tags: next });
  };

  const handleAddTag = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) return;
    setTags([...tags, trimmed]);
    setTagInput('');
    tagInputRef.current?.focus();
  };

  const handleRemoveTag = (idx: number) => {
    setTags(tags.filter((_, i) => i !== idx));
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInput);
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-stone-200 p-6 mb-6 animate-fadeUp">
      <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-brand-900 text-white text-xs flex items-center justify-center font-bold">
          1
        </span>
        基础信息
      </h2>

      <div className="space-y-4">
        {/* 标题 */}
        <div>
          <label className="text-xs font-semibold text-brand-700 block mb-1.5">
            计划标题 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={state.title}
            maxLength={100}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="例如：完成 MVP 用户调研模块"
            className={cn(
              'w-full px-4 py-2.5 bg-stone-50 border rounded-xl text-sm transition',
              'focus:outline-none focus:bg-white focus:border-brand-900',
              state.title.trim().length === 0
                ? 'border-stone-200'
                : 'border-stone-200',
            )}
          />
          <div className="text-[10px] text-brand-400 mt-1 text-right">
            {state.title.length} / 100
          </div>
        </div>

        {/* 描述 */}
        <div>
          <label className="text-xs font-semibold text-brand-700 block mb-1.5">
            描述
          </label>
          <textarea
            value={state.description}
            maxLength={500}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="为什么做这件事？做到什么样算成功？"
            rows={3}
            className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-brand-900 transition resize-none"
          />
          <div className="text-[10px] text-brand-400 mt-1 text-right">
            {state.description.length} / 500
          </div>
        </div>

        {/* 日期 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-brand-700 block mb-1.5">
              开始日期
            </label>
            <input
              type="date"
              value={state.startDate}
              onChange={(e) => onChange({ startDate: e.target.value })}
              className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-brand-900 transition"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-700 block mb-1.5">
              截止日期
            </label>
            <input
              type="date"
              value={state.endDate}
              onChange={(e) => onChange({ endDate: e.target.value })}
              className={cn(
                'w-full px-4 py-2.5 bg-stone-50 border rounded-xl text-sm transition',
                'focus:outline-none focus:bg-white focus:border-brand-900',
                endBeforeStart ? 'border-red-400' : 'border-stone-200',
              )}
            />
            {endBeforeStart && (
              <div className="text-[10px] text-red-500 mt-1">
                截止日期不能早于开始日期
              </div>
            )}
          </div>
        </div>

        {/* 标签 */}
        <div>
          <label className="text-xs font-semibold text-brand-700 block mb-2 flex items-center gap-1">
            <TagIcon size={11} />
            标签
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {tags.map((t, i) => (
              <span
                key={`${t}-${i}`}
                className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs flex items-center gap-1"
              >
                {t}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(i)}
                  className="hover:text-blue-800"
                  aria-label={`删除标签 ${t}`}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <input
                ref={tagInputRef}
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => handleAddTag(tagInput)}
                placeholder="输入标签后回车"
                className="px-2 py-1 border border-dashed border-stone-300 text-brand-700 rounded-lg text-xs w-32 focus:outline-none focus:border-brand-500"
              />
              <button
                type="button"
                onClick={() => handleAddTag(tagInput)}
                className="px-2.5 py-1 border border-dashed border-stone-300 text-brand-400 rounded-lg text-xs hover:border-brand-500 hover:text-brand-700 flex items-center gap-1"
                aria-label="添加标签"
              >
                <Plus size={10} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
