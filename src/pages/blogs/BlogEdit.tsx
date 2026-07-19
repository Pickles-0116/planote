/**
 * BlogEdit - 博客编辑页（/blogs/new + /blogs/:id/edit）
 *
 * 完整流程（add-blog-tiptap-editor）：
 * 1. 路由：mode 由 props.mode 决定（'create' | 'edit'）
 * 2. 顶栏：返回 + breadcrumb + 保存
 * 3. 标题输入（text input）
 * 4. 框架选择（select，4 个内置）
 * 5. 状态选择（draft / published / archived）
 * 6. 标签（v1.0 简化为 input + 逗号分隔）
 * 7. 富文本编辑器：<RichEditor>
 * 8. 自动保存：useAutoSave(editor, 500ms) → updateBlog
 * 9. 框架应用：useApplyFramework(editor, framework) → 工具栏按钮触发
 * 10. 离开守卫：dirty 时 confirm
 *
 * 加载 / 错误态：
 * - 加载中：返回骨架（v1.0 简化为「加载中…」）
 * - ID 不存在（edit 模式）：EmptyState + 返回
 * - create 模式：直接渲染空白表单
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import EmptyState from '@/components/shell/EmptyState';
import RichEditor from '@/features/blog/components/RichEditor';
import AttachmentUploader, {
  type AttachmentUploaderHandle,
} from '@/features/blog/components/AttachmentUploader';
import AttachmentManager from '@/features/blog/components/AttachmentManager';
import { useApplyFramework } from '@/features/blog/hooks/useApplyFramework';
import { useAttachments } from '@/features/blog/hooks/useAttachments';
import { useAutoSave } from '@/features/blog/hooks/useAutoSave';
import { extractPlainText } from '@/features/blog/utils/extractPlainText';
import { useAttachmentStore, useBlog, useFrameworks, useBlogStore, useUIStore } from '@/stores';
import type { Blog, BlogStatus, Framework, TiptapJSON } from '@/types/domain';
import { cn } from '@/lib/utils';
import FrameworkDrawerHost from '@/features/framework/components/FrameworkDrawerHost';
import { type PresetFramework } from '@/features/framework/data/presets';

interface BlogEditProps {
  mode?: 'create' | 'edit';
}

const STATUS_OPTIONS: Array<{ value: BlogStatus; label: string }> = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' },
];

/** 把 Blog.content 转字符串（持久化用）。 */
const contentToString = (content: TiptapJSON | undefined): string =>
  content ? JSON.stringify(content) : '';

export default function BlogEdit({ mode = 'create' }: BlogEditProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const updateBlog = useBlogStore((s) => s.updateBlog);
  const openFrameworkDrawer = useUIStore((s) => s.openFrameworkDrawer);

  // edit 模式订阅单 blog
  const blog = useBlog(mode === 'edit' ? (id ?? null) : null);
  const frameworks = useFrameworks();

  // 表单状态（create 模式无 blog 时用空白）
  const initialTitle = blog?.title ?? '';
  const initialFrameworkId = blog?.frameworkId ?? '';
  const initialStatus = (blog?.status ?? 'draft') as BlogStatus;
  const initialTags = (blog?.tagIds ?? []).join(',');
  const initialContent = contentToString(blog?.content);

  const [title, setTitle] = useState(initialTitle);
  const [frameworkId, setFrameworkId] = useState<string>(initialFrameworkId);
  const [status, setStatus] = useState<BlogStatus>(initialStatus);
  const [tagsInput, setTagsInput] = useState(initialTags);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // add-blog-attachment 增量：附件上传/管理
  const uploaderRef = useRef<AttachmentUploaderHandle>(null);
  const editBlogId = mode === 'edit' ? id ?? null : null;
  const { attachments, add: addAttachment, remove: removeAttachment } =
    useAttachments(editBlogId);
  const revokeAll = useAttachmentStore((s) => s.revokeAll);

  // 框架实例（用于 useApplyFramework）
  const framework = useMemo<Framework | null>(() => {
    if (!frameworkId || !frameworks) return null;
    return frameworks.find((f) => f.id === frameworkId) ?? null;
  }, [frameworkId, frameworks]);

  // dirty 判定（与初始值对比；create 模式只要有内容就 dirty）
  const dirty = useMemo(() => {
    if (mode === 'create') {
      return (
        title !== '' ||
        frameworkId !== '' ||
        status !== 'draft' ||
        tagsInput !== '' ||
        (editor !== null && extractPlainText(editor.getJSON() as TiptapJSON).length > 0)
      );
    }
    return (
      title !== initialTitle ||
      frameworkId !== initialFrameworkId ||
      status !== initialStatus ||
      tagsInput !== initialTags
    );
  }, [mode, title, frameworkId, status, tagsInput, editor, initialTitle, initialFrameworkId, initialStatus, initialTags]);

  // 自动保存：调 updateBlog，写入 content / contentText / excerpt / frameworkId
  const onAutoSave = useCallback(
    (json: TiptapJSON, plain: string, excerpt: string): void => {
      if (mode !== 'edit' || !id) return;
      const tagIds = tagsInput
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      void updateBlog(id, {
        title: title.trim() || '未命名博客',
        content: json,
        contentText: plain,
        excerpt,
        status,
        frameworkId: frameworkId || undefined,
        tagIds,
      }).catch((e: unknown) => {
        console.error('[BlogEdit] auto save failed:', e);
      });
    },
    [mode, id, tagsInput, title, status, frameworkId, updateBlog],
  );

  const { status: saveStatus, saveNow } = useAutoSave(editor, onAutoSave, 500);

  // 框架应用 hook（isApplied 用于工具栏「已应用」状态显示）
  const { isApplied } = useApplyFramework(editor, framework);

  // 抽屉选中 → 应用（add-framework-drawer 增量）
  // 设计：preset 不写入 Dexie；直接把 preset.sections 注入 editor
  // 同步：setFrameworkId 让 form 字段 + isApplied 重算
  const handleApplyFromDrawer = useCallback(
    (preset: PresetFramework): void => {
      if (!editor) return;
      // 1) 幂等：若已应用（同样的 section.heading 全匹配）则跳过
      const existingHeadings: string[] = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'heading' && node.attrs.level === 2) {
          const text = node.textContent;
          if (text) existingHeadings.push(text);
        }
        return true;
      });
      const alreadyApplied =
        existingHeadings.length >= preset.sections.length &&
        preset.sections.every((s) => existingHeadings.includes(s.heading));
      if (alreadyApplied) return;
      // 2) 清空 + 注入 H2 + 空段
      editor.commands.clearContent();
      const nodes: TiptapJSON['content'] = [];
      for (const s of preset.sections) {
        nodes.push({
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: s.heading }],
        });
        nodes.push({
          type: 'paragraph',
          attrs: { 'data-placeholder': s.placeholder },
        } as TiptapJSON['content'][number]);
      }
      editor.commands.insertContent(nodes as unknown as string);
      // 3) 同步 frameworkId 到 form state
      setFrameworkId(preset.id);
    },
    [editor],
  );

  // 显式编辑就绪回调
  const onEditorReady = useCallback((ed: Editor) => {
    setEditor(ed);
  }, []);

  // add-blog-attachment 增量：组件卸载时释放 blob URL
  useEffect(() => {
    return () => {
      revokeAll();
    };
  }, [revokeAll]);

  // 返回
  const handleBack = useCallback(() => {
    if (dirty) {
      const ok = window.confirm('有未保存的修改，确定离开？');
      if (!ok) return;
    }
    if (mode === 'edit' && id) {
      navigate(`/blogs/${id}`);
    } else {
      navigate('/blogs');
    }
  }, [dirty, mode, id, navigate]);

  // 手动保存（按钮 + Cmd/Ctrl+S）
  const handleSubmit = useCallback(async (): Promise<void> => {
    if (mode === 'create') {
      setSubmitError('v1.0 暂未实现「新建」流程；请使用「编辑」模式（add-blog-generation-flow 接手）');
      return;
    }
    if (!id) return;
    setSaving(true);
    setSubmitError(null);
    try {
      // 强制取一次最新 JSON
      saveNow();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }, [mode, id, saveNow]);

  // 加载 / 错误态
  if (mode === 'edit') {
    if (blog === undefined) {
      return (
        <EmptyState
          icon={AlertCircle}
          title="找不到该博客"
          description="该博客可能已被删除"
          action={{
            label: '返回博客列表',
            onClick: () => navigate('/blogs'),
          }}
          variant="default"
        />
      );
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* 顶栏 */}
      <div className="flex items-center gap-3 mb-6 animate-fadeUp">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-brand-500 dark:text-stone-400 hover:text-brand-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition"
          aria-label="返回"
        >
          <ArrowLeft size={14} />
        </button>

        <nav className="flex items-center gap-2 text-sm flex-1 min-w-0">
          <Link
            to="/blogs"
            className="text-brand-500 dark:text-stone-400 hover:text-brand-900 dark:hover:text-stone-100 transition flex-shrink-0"
          >
            博客
          </Link>
          <span className="text-brand-300 dark:text-stone-600 flex-shrink-0">/</span>
          <span className="text-brand-900 dark:text-stone-100 font-medium truncate">
            {mode === 'create' ? '新建博客' : '编辑博客'}
          </span>
        </nav>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-sm',
            saving
              ? 'bg-stone-200 dark:bg-stone-700 text-stone-400 dark:text-stone-500 cursor-not-allowed'
              : 'bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-brand-800 dark:hover:bg-stone-200',
          )}
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          {saving ? '保存中' : '保存博客'}
        </button>
      </div>

      {/* 错误提示 */}
      {submitError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 animate-fadeUp">
          {submitError}
        </div>
      )}

      {/* 标题 */}
      <div className="mb-4">
        <label
          htmlFor="blog-title"
          className="block text-xs font-medium text-brand-500 dark:text-stone-400 mb-1.5"
        >
          标题
        </label>
        <input
          id="blog-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="给你的博客起个标题…"
          className="w-full px-4 py-2.5 text-base font-semibold bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-xl focus:border-brand-500 focus:outline-none transition text-brand-900 dark:text-stone-100"
        />
      </div>

      {/* 元数据：框架 / 状态 / 标签 */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label
            htmlFor="blog-framework"
            className="block text-xs font-medium text-brand-500 dark:text-stone-400 mb-1.5"
          >
            框架
          </label>
          <select
            id="blog-framework"
            value={frameworkId}
            onChange={(e) => setFrameworkId(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-xl focus:border-brand-500 focus:outline-none text-brand-900 dark:text-stone-100"
          >
            <option value="">不选择</option>
            {(frameworks ?? []).map((fw) => (
              <option key={fw.id} value={fw.id}>
                {fw.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="blog-status"
            className="block text-xs font-medium text-brand-500 dark:text-stone-400 mb-1.5"
          >
            状态
          </label>
          <select
            id="blog-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as BlogStatus)}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-xl focus:border-brand-500 focus:outline-none text-brand-900 dark:text-stone-100"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="blog-tags"
            className="block text-xs font-medium text-brand-500 dark:text-stone-400 mb-1.5"
          >
            标签（逗号分隔）
          </label>
          <input
            id="blog-tags"
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="如：复盘, 21天"
            className="w-full px-3 py-2 text-sm bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-xl focus:border-brand-500 focus:outline-none text-brand-900 dark:text-stone-100"
          />
        </div>
      </div>

      {/* 富文本编辑器 */}
      <RichEditor
        value={initialContent}
        onEditorReady={onEditorReady}
        hasFramework={framework !== null}
        frameworkApplied={isApplied}
        onApplyFramework={() => openFrameworkDrawer()}
        saveStatus={saveStatus}
        onSaveNow={saveNow}
        placeholder="开始写你的博客…"
        onAttachClick={mode === 'edit' ? () => uploaderRef.current?.trigger() : undefined}
      />

      {/* add-blog-attachment 增量：附件管理面板（编辑页） */}
      {mode === 'edit' && (
        <AttachmentManager
          attachments={attachments}
          onRemove={removeAttachment}
        />
      )}

      {/* add-blog-attachment 增量：隐藏 file input 触发器 */}
      {mode === 'edit' && (
        <AttachmentUploader
          ref={uploaderRef}
          onFile={(file) => void addAttachment(file)}
          accept="image/*,.pdf"
        />
      )}

      {/* add-framework-drawer 增量：博客框架库抽屉宿主（局部挂载，详情页不挂） */}
      <FrameworkDrawerHost
        onApply={handleApplyFromDrawer}
        appliedFrameworkId={frameworkId || null}
      />
    </div>
  );
}

// 显式给 App.tsx 用：类型对齐 Blog（避免 TS 推导成 never）
export type { Blog };
