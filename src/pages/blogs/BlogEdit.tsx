/**
 * BlogEdit - 博客编辑页（/blogs/new + /blogs/:id/edit）
 *
 * 完整流程（add-blog-tiptap-editor）：
 * 1. 路由：mode 由 props.mode 决定（'create' | 'edit'）
 * 2. 顶栏：返回 + breadcrumb + 保存
 * 3. 标题输入（text input）
 * 4. 模板选择（select，模板库）
 * 5. 状态选择（draft / published / archived）
 * 6. 标签（v1.0 简化为 input + 逗号分隔）
 * 7. 富文本编辑器：<RichEditor>
 * 8. 自动保存：useAutoSave(editor, 500ms) → updateBlog
 * 9. 模板应用：useApplyFramework(editor, frameworkForApply) → 工具栏按钮触发
 * 10. 离开守卫：dirty 时 confirm
 *
 * 加载 / 错误态：
 * - 加载中：返回骨架（v1.0 简化为「加载中…」）
 * - ID 不存在（edit 模式）：EmptyState + 返回
 * - create 模式：直接渲染空白表单
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { useAttachmentStore, useBlog, useTemplates, useBlogStore, useUIStore, usePlan, useItemsForPlan } from '@/stores';
import type { Blog, BlogStatus, Framework, FrameworkCategory, TiptapJSON } from '@/types/domain';
import { cn } from '@/lib/utils';
import { ROOT_FOLDER_ID } from '@/features/folders/constants';
import { useFolders } from '@/features/folders/hooks/useFolders';
import FolderPicker from '@/features/folders/components/FolderPicker';
import FrameworkDrawerHost from '@/features/framework/components/FrameworkDrawerHost';
import { type PresetFramework } from '@/features/framework/data/presets';
import AIWritingPanel from '@/features/ai/components/AIWritingPanel';
import AIStatusBar from '@/features/ai/components/AIStatusBar';

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
  const [searchParams] = useSearchParams();
  const updateBlog = useBlogStore((s) => s.updateBlog);
  const createBlog = useBlogStore((s) => s.createBlog);
  const openFrameworkDrawer = useUIStore((s) => s.openFrameworkDrawer);

  // edit 模式订阅单 blog
  const blog = useBlog(mode === 'edit' ? (id ?? null) : null);
  const templates = useTemplates();
  const folders = useFolders();

  // create 模式：从 URL 参数读取预填值（从计划生成博客场景）
  const queryTemplateId = mode === 'create' ? (searchParams.get('templateId') ?? searchParams.get('frameworkId') ?? '') : '';
  const sourcePlanId = mode === 'create' ? (searchParams.get('sourcePlanId') ?? undefined) : undefined;
  const autoOpenAI = mode === 'create' && searchParams.get('autoOpenAI') === 'true';

  // 从计划跳转时：读取计划数据和事项清单，构建 AI 写作素材
  const sourcePlan = usePlan(sourcePlanId);
  const sourcePlanItems = useItemsForPlan(sourcePlanId);
  const planContextNotes = useMemo(() => {
    if (!sourcePlan) return '';
    const lines: string[] = [`【来源计划】${sourcePlan.title}`];
    if (sourcePlan.description) lines.push(`计划描述：${sourcePlan.description}`);
    lines.push(`完成度：${sourcePlan.progress}%`);
    if (sourcePlanItems && sourcePlanItems.length > 0) {
      lines.push('', '事项清单：');
      for (const item of sourcePlanItems) {
        const statusLabel = item.status === 'done' ? '✓' : item.status === 'doing' ? '⏳' : '○';
        lines.push(`- ${statusLabel} ${item.title}`);
      }
    }
    return lines.join('\n');
  }, [sourcePlan, sourcePlanItems]);

  // 表单状态（create 模式无 blog 时用空白）
  const initialTitle = blog?.title ?? '';
  const initialTemplateId = blog?.templateId ?? blog?.frameworkId ?? queryTemplateId;
  const initialStatus = (blog?.status ?? 'draft') as BlogStatus;
  const initialTags = (blog?.tagIds ?? []).join(',');
  const initialFolderId = blog?.folderId ?? ROOT_FOLDER_ID;
  const initialContent = contentToString(blog?.content);

  const [title, setTitle] = useState(initialTitle);
  const [templateId, setTemplateId] = useState<string>(initialTemplateId);
  const [status, setStatus] = useState<BlogStatus>(initialStatus);
  const [tagsInput, setTagsInput] = useState(initialTags);
  const [folderId, setFolderId] = useState<string>(initialFolderId);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // v1.3-AI：AI 写作面板
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  // 从计划跳转时自动打开 AI 写作面板（仅首次，等计划数据就绪）
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenAI && !autoOpenedRef.current && sourcePlan !== undefined) {
      autoOpenedRef.current = true;
      setAiPanelOpen(true);
    }
  }, [autoOpenAI, sourcePlan]);

  // add-blog-attachment 增量：附件上传/管理
  const uploaderRef = useRef<AttachmentUploaderHandle>(null);
  const editBlogId = mode === 'edit' ? id ?? null : null;
  const { attachments, add: addAttachment, remove: removeAttachment } =
    useAttachments(editBlogId);
  const revokeAll = useAttachmentStore((s) => s.revokeAll);

  // 模板实例（用于 useApplyFramework）
  const selectedTemplate = useMemo(() => {
    if (!templateId || !templates) return undefined;
    return templates.find(t => t.id === templateId);
  }, [templateId, templates]);

  // Build a Framework-like object for useApplyFramework
  const frameworkForApply = useMemo<Framework | null>(() => {
    if (!selectedTemplate) return null;
    return {
      id: selectedTemplate.id,
      name: selectedTemplate.name,
      description: selectedTemplate.description,
      category: 'review' as FrameworkCategory,
      icon: selectedTemplate.icon,
      sections: selectedTemplate.sections,
      useCount: selectedTemplate.useCount,
      builtin: selectedTemplate.builtin,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [selectedTemplate]);

  // dirty 判定（与初始值对比；create 模式只要有内容就 dirty）
  const dirty = useMemo(() => {
    if (mode === 'create') {
      return (
        title !== '' ||
        templateId !== '' ||
        status !== 'draft' ||
        tagsInput !== '' ||
        (editor !== null && extractPlainText(editor.getJSON() as TiptapJSON).length > 0)
      );
    }
    return (
      title !== initialTitle ||
      templateId !== initialTemplateId ||
      status !== initialStatus ||
      tagsInput !== initialTags ||
      folderId !== initialFolderId
    );
  }, [mode, title, templateId, status, tagsInput, folderId, editor, initialTitle, initialTemplateId, initialStatus, initialTags, initialFolderId]);

  // 离开保护：浏览器关闭/刷新时弹出确认
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // 自动保存：调 updateBlog，写入 content / contentText / excerpt / templateId
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
        templateId: templateId || undefined,
        tagIds,
        folderId,
      }).catch((e: unknown) => {
        console.error('[BlogEdit] auto save failed:', e);
      });
    },
    [mode, id, tagsInput, title, status, templateId, updateBlog],
  );

  const { status: saveStatus, saveNow } = useAutoSave(editor, onAutoSave, 500);

  // 框架应用 hook（isApplied 用于工具栏「已应用」状态显示）
  const { apply: applyFramework, isApplied } = useApplyFramework(editor, frameworkForApply);

  // 从计划跳转时自动应用框架结构到编辑器（仅首次）
  const autoAppliedRef = useRef(false);
  useEffect(() => {
    if (
      mode === 'create' &&
      queryTemplateId &&
      editor &&
      frameworkForApply &&
      !autoAppliedRef.current
    ) {
      autoAppliedRef.current = true;
      applyFramework();
    }
  }, [mode, queryTemplateId, editor, frameworkForApply, applyFramework]);

  // 抽屉选中 → 应用（add-framework-drawer 增量）
  // 设计：preset 不写入 Dexie；直接把 preset.sections 注入 editor
  // 同步：setTemplateId 让 form 字段 + isApplied 重算
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
      // 3) 同步 templateId 到 form state（preset.id 映射到 tpl_ 前缀模板 ID）
      setTemplateId(`tpl_${preset.id}`);
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

  // 返回（dirty 时弹确认框；浏览器关闭/刷新由 beforeunload 处理）
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
    setSaving(true);
    setSubmitError(null);

    if (mode === 'create') {
      try {
        const json = editor ? (editor.getJSON() as TiptapJSON) : ({ type: 'doc', content: [] } as TiptapJSON);
        const plain = extractPlainText(json);
        const excerpt = plain.slice(0, 120);
        const tagIds = tagsInput
          .split(/[,，\s]+/)
          .map((t) => t.trim())
          .filter(Boolean);
        const newBlog = await createBlog({
          title: title.trim() || '未命名博客',
          content: json,
          contentText: plain,
          excerpt,
          status,
          source: 'direct',
          templateId: templateId || undefined,
          tagIds,
          folderId,
          sourcePlanId: sourcePlanId || undefined,
          attachmentIds: [],
        });
        // 创建成功后跳转到编辑页继续编辑
        navigate(`/blogs/${newBlog.id}/edit`, { replace: true });
        return;
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : '创建失败');
        return;
      } finally {
        setSaving(false);
      }
    }

    // edit 模式
    if (!id) return;
    try {
      saveNow();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }, [mode, id, editor, title, status, templateId, tagsInput, createBlog, navigate, saveNow, sourcePlanId]);

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

      {/* 元数据：模板 / 状态 / 标签 / 文件夹 */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label
            htmlFor="blog-template"
            className="block text-xs font-medium text-brand-500 dark:text-stone-400 mb-1.5"
          >
            模板
          </label>
          <select
            id="blog-template"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-xl focus:border-brand-500 focus:outline-none text-brand-900 dark:text-stone-100"
          >
            <option value="">不选择</option>
            {(templates ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
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

        <div>
          <label
            htmlFor="blog-folder"
            className="block text-xs font-medium text-brand-500 dark:text-stone-400 mb-1.5"
          >
            文件夹
          </label>
          <FolderPicker
            id="blog-folder"
            value={folderId}
            onChange={setFolderId}
            folders={folders ?? []}
            className="w-full"
          />
        </div>
      </div>

      {/* 富文本编辑器 */}
      <AIStatusBar
        status={aiGenerating ? 'generating' : 'idle'}
        onCancel={() => setAiGenerating(false)}
      />
      <RichEditor
        value={initialContent}
        onEditorReady={onEditorReady}
        hasFramework={frameworkForApply !== null}
        frameworkApplied={isApplied}
        onApplyFramework={() => openFrameworkDrawer()}
        saveStatus={saveStatus}
        onSaveNow={saveNow}
        placeholder="开始写你的博客…"
        onAttachClick={mode === 'edit' ? () => uploaderRef.current?.trigger() : undefined}
        onAIWriting={() => setAiPanelOpen(true)}
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
        appliedFrameworkId={templateId || null}
      />

      {/* v1.3-AI：AI 写作面板（右侧抽屉） */}
      {aiPanelOpen && (
        <AIWritingPanel
          editor={editor}
          onClose={() => setAiPanelOpen(false)}
          initialGlobalNotes={planContextNotes || undefined}
        />
      )}
    </div>
  );
}

// 显式给 App.tsx 用：类型对齐 Blog（避免 TS 推导成 never）
export type { Blog };
