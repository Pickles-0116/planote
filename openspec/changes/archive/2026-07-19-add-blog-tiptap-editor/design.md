# Design · 博客 Tiptap 富文本编辑器

> 本文档回答**「Tiptap 怎么集成、框架章节怎么注入、自动保存怎么搭、只读模式怎么复用」**。
> 不重复 `architecture.md` 已有的内容模型与 store 设计，仅补充本 change 的具体决策。

---

## 1. 选型复述

| 决策 | 选择 | 排除项 | 原因 |
|------|------|--------|------|
| 编辑器库 | Tiptap v2（@tiptap/react 2.x + pm）| Slate / Lexical / Quill | PRD 已锁定 Tiptap；React 集成最好；schema 可控 |
| 扩展集 | StarterKit + Link + Placeholder | 自研 schema | StarterKit 覆盖 90% 节点（paragraph/heading/bold/italic/blockquote/code/codeblock/lists），省 5 个扩展 |
| 内容格式 | Tiptap JSON 字符串（`JSON.stringify(editor.getJSON())`）| HTML / Markdown / ProseMirror binary | JSON 便于持久化、结构化检索、后续导出 MD；HTML 易注入 XSS；ProseMirror 私有 |
| 工具栏实现 | 自研按钮 + ProseMirror command | 浮泡工具栏 / slash command | 桌面优先 + 4 列固定布局简单可控；浮泡 v1.1 之后 |
| 自动保存策略 | 500ms debounce → store action | 实时写 IndexedDB | 高频 Tiptap onUpdate → 减少写入；500ms 心理"即时" |
| 只读模式 | `<RichEditor readOnly>` prop | 拆 Edit/Read 两个组件 | 单一组件降低维护成本；详情页用同组件 |
| 框架应用 | 工具栏按钮 + `applyFramework(editor, fw)` | 自动化（创建即应用）| 显式 > 隐式：用户先选 framework，确认后手动应用 |

---

## 2. 关键架构决策

### 2.1 组件分层

```
<RichEditor>                       容器（受控 + lifecycle + 工具栏插槽）
   ├─ <EditorToolbar>              顶部工具栏（11 个按钮 + 字数 + 保存状态）
   ├─ <EditorContent>              Tiptap 渲染区
   └─ <CharacterCount>             右下角字数统计（读 storage.characterCount）
```

- `<RichEditor>` 接收 `{ value: TiptapJSON, onChange, readOnly?, placeholder? }`
- 内部 `useEditor` hook 初始化 ProseMirror；deps = `[value]`（value 变化才重 init，避免无谓重渲）
- 工具栏 / 字数 / 内容区作为子组件接收 `editor` 实例，**不**自己建 editor

### 2.2 受控 vs 非受控

**v1.0 采用「半受控」**：
- value 是「真值」（initial value） → `useEditor({ content: value })`
- 用户输入不通过 setValue 同步回 editor（避免光标跳到开头）
- 提交时（onSave / 表单提交）才读 `editor.getJSON()`

理由：Tiptap 内部已维护完整文档状态；外部 setValue 会触发 ProseMirror transaction，光标位置重置、撤销栈丢失。半受控保证"组件外更新受控、组件内交互自由"。

### 2.3 内容格式：TiptapJSON

```ts
// 存储格式（Blog.content 字段）
type TiptapJSON = {
  type: 'doc';
  content: TiptapNode[];
};
type TiptapNode =
  | { type: 'paragraph'; content?: TiptapInlineNode[] }
  | { type: 'heading'; attrs: { level: 1|2|3 }; content?: TiptapInlineNode[] }
  | { type: 'bulletList' | 'orderedList' | 'blockquote' | 'codeBlock'; content?: TiptapNode[] }
  | { type: 'text'; text: string; marks?: TiptapMark[] }
  | { type: 'hardBreak' };
type TiptapMark = { type: 'bold'|'italic'|'code'|'link'; attrs?: { href?: string } };
```

- 存 `string`（`JSON.stringify(doc)`）兼容 Dexie 索引 / 未来 export
- 旧数据迁移：`{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: oldString }] }] }`
- 类型集中 `src/types/editor.ts`

### 2.4 框架应用

```ts
// src/features/blog/hooks/useApplyFramework.ts
export function useApplyFramework(editor: Editor | null, framework: Framework | null) {
  return useCallback(() => {
    if (!editor || !framework) return;
    // 幂等检查：已有 H2 文本匹配 section.heading 视为已应用
    const existingH2 = collectHeadings(editor, 2);
    const alreadyApplied = framework.sections.every((s) =>
      existingH2.includes(s.heading)
    );
    if (alreadyApplied) return;
    // 清空当前内容 + 注入结构
    editor.commands.clearContent();
    framework.sections.forEach((section) => {
      editor.commands.insertContent({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: section.heading }],
      });
      editor.commands.insertContent({
        type: 'paragraph',
        attrs: { 'data-placeholder': section.placeholder },
      });
    });
  }, [editor, framework]);
}
```

**为什么幂等**：用户可能切 framework，应用新框架前要清空 + 重建；多次点同一 framework 不污染（已在 design 里写"按钮禁用 + 对勾"）。

**为什么用 H2 而非 H1**：博客标题来自 `Blog.title` 字段（H1 语义），H2 给章节。详情页用同一个组件渲染，标题由 page header 渲染。

### 2.5 自动保存

```ts
// src/shared/hooks/useDebouncedCallback.ts
export function useDebouncedCallback<T extends (...args: never[]) => void>(
  fn: T,
  delay: number,
): T {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fnRef.current(...args), delay);
  }, [delay]) as T;
}
```

```ts
// src/features/blog/hooks/useAutoSave.ts
export function useAutoSave(
  editor: Editor | null,
  blogId: ID,
  onSave: (content: TiptapJSON, plain: string, excerpt: string) => void,
  delay = 500,
) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debouncedSave = useDebouncedCallback((json: TiptapJSON) => {
    const plain = extractPlainText(json);
    const excerpt = plain.slice(0, 100);
    onSave(json, plain, excerpt);
    setStatus('saved');
  }, delay);
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      setStatus('saving');
      debouncedSave(editor.getJSON());
    };
    editor.on('update', handler);
    return () => { editor.off('update', handler); };
  }, [editor, debouncedSave]);
  return { status };
}
```

- `onSave` 由 BlogEdit 注入（写 store → 触发 repo）
- `status` 透传给工具栏右上角显示
- 500ms 是 PRD 心理阈值；>1s 显"保存中…"，= 0 显"已保存"
- unmount 时 `clearTimeout` 防内存泄漏

### 2.6 字数统计

```ts
// 复用 Tiptap @tiptap/extension-characterCount（可选依赖）
// 或自研：从 doc 走 DFS 数 text node 的 characters / words

// 自研版本（不引新依赖）
export function countText(doc: TiptapJSON): { words: number; chars: number } {
  const texts: string[] = [];
  walkText(doc, (t) => texts.push(t));
  const joined = texts.join('');
  return {
    chars: joined.length,
    words: joined.trim() ? joined.trim().split(/\s+/).length : 0,
  };
}
```

**v1.0 决定：自研**——避免多引一个 `@tiptap/extension-characterCount`；DFS 50 行可控。

### 2.7 只读模式

```tsx
<RichEditor value={blog.content} readOnly />  // 详情页用法
```

- `useEditor({ editable: false })`
- 工具栏 + 字数仍渲染（只读模式下字数有意义）；保存状态不显示
- 链接点击：ProseMirror 默认行为，保留
- 撤销栈在只读模式下被禁用，符合预期

### 2.8 现有 BlogEdit 改造点

```tsx
// 旧
<textarea value={content} onChange={(e) => setContent(e.target.value)} />

// 新
<RichEditor
  value={blog.content ?? ''}
  onChange={() => {/* 半受控，无需更新 */}}
  placeholder="开始写你的博客..."
/>
```

- `content` 字段语义从 `string`（纯文本）升级为 `TiptapJSON string`（结构化 JSON）
- 提交时 `editor.getJSON()` → `JSON.stringify` → `updateBlog({ content })`
- `onSave` 自动同步 `contentText` / `excerpt`，BlogEdit 不再关心这些派生

### 2.9 旧数据迁移

```ts
// src/features/blog/utils/migrateBlogContent.ts
export function migrateBlogContent(raw: string | undefined | null): TiptapJSON {
  if (!raw) return { type: 'doc', content: [{ type: 'paragraph' }] };
  // 已是 JSON
  if (raw.trimStart().startsWith('{')) {
    try { return JSON.parse(raw); } catch { /* fallthrough */ }
  }
  // 旧纯文本 → 段落包装
  return {
    type: 'doc',
    content: raw.split('\n').map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : undefined,
    })),
  };
}
```

- 在 `useBlog(id)` / `useBlogs()` selector 层迁移
- 一旦所有用户升级，旧数据自然清空
- 幂等：再次调用不重复包裹

---

## 3. 组件详细设计

### 3.1 RichEditor

```ts
interface Props {
  value: string;                              // TiptapJSON string
  onChange?: (json: TiptapJSON) => void;      // 半受控，可选
  readOnly?: boolean;
  placeholder?: string;
  onSaveStatusChange?: (status: SaveStatus) => void;
  onEditorReady?: (editor: Editor) => void;   // 给父组件接 useApplyFramework
}
```

- 内部用 `useEditor` hook（@tiptap/react 提供）
- `extensions = [StarterKit, Link.configure({ openOnClick: false }), Placeholder]`
- `editorProps.handleKeyDown` 自定义 Cmd+S / Ctrl+S 强制保存
- unmount 调 `editor.destroy()` 释放 ProseMirror

### 3.2 EditorToolbar

```ts
interface Props {
  editor: Editor | null;
  readOnly?: boolean;
  saveStatus?: SaveStatus;
  charCount?: { words: number; chars: number };
  onApplyFramework?: () => void;
  frameworkApplied?: boolean;
}
```

- 11 按钮 + 1 状态指示器 + 1 字数组件
- 按钮按 `editor.isActive('bold')` 等显激活态
- a11y：`aria-label` / `aria-pressed`
- 移动端：v1.0 暂不优化（桌面优先）

### 3.3 CharacterCount

- 纯展示组件，位置：工具栏右下
- 文案：「字数 N · 字符 M」
- 只读模式也显示

### 3.4 SaveStatusBadge

- 状态：'idle' | 'saving' | 'saved'
- 文案：' ' / '保存中…' / '已保存 · 刚刚'
- 颜色：text-stone-400 / text-amber-600 / text-emerald-600
- v1.0 不做"上次保存于 13:42"时间显示（v1.1 增强）

---

## 4. 集成方案

### 4.1 文件清单（新增）

```
src/
├── types/editor.ts                          # TiptapJSON 类型
├── shared/hooks/useDebouncedCallback.ts     # 通用 debounce hook
├── features/blog/
│   ├── components/
│   │   ├── RichEditor.tsx
│   │   ├── EditorToolbar.tsx
│   │   ├── CharacterCount.tsx
│   │   └── SaveStatusBadge.tsx
│   ├── hooks/
│   │   ├── useApplyFramework.ts
│   │   └── useAutoSave.ts
│   └── utils/
│       ├── extractPlainText.ts
│       ├── countText.ts
│       └── migrateBlogContent.ts
```

### 4.2 修改文件

- `src/pages/blogs/BlogEdit.tsx`：textarea → `<RichEditor>` + 接入 useAutoSave
- `src/pages/blogs/BlogDetail.tsx`：用 `<RichEditor readOnly>` 替代 `MarkdownRender`（MarkdownRender 后续 change 处理纯文本/外部 MD）
- `package.json`：新增 5 个依赖
- `src/types/domain.ts`：`Blog.content` 字段注释更新为 TiptapJSON string

### 4.3 依赖列表

```json
{
  "@tiptap/react": "^2.6.0",
  "@tiptap/pm": "^2.6.0",
  "@tiptap/starter-kit": "^2.6.0",
  "@tiptap/extension-link": "^2.6.0",
  "@tiptap/extension-placeholder": "^2.6.0"
}
```

- 全用 v2（稳定，React 18 兼容）
- 不锁死 patch 版本（`^2.6.0` 接受小版本更新）
- 预估体积：gzip 后 ~80KB

---

## 5. 边界与测试场景

### 5.1 编辑器边界

- 空 value → `{ type: 'doc', content: [{ type: 'paragraph' }] }`
- 损坏 JSON → 走 migrate 逻辑，落到纯文本包装或空 doc
- 10000 字文档 → 编辑仍流畅（ProseMirror diff 算法）
- 卸载组件 → editor.destroy() 释放（避免 memory leak）

### 5.2 自动保存场景

```ts
// 场景 A：用户输入字符 → onUpdate → setStatus('saving') → 500ms 后 save → setStatus('saved')
// 场景 B：连续输入 → debounce 持续重置定时器 → 500ms 内不写
// 场景 C：500ms 内切页面 → clearTimeout，不写脏数据
// 场景 D：保存失败（IndexedDB 错）→ setStatus('error') + toast（v1.0 简化为不处理，靠 useBlogStore 错误捕获）
```

### 5.3 框架应用场景

```ts
// 场景 A：未选 framework → 「应用框架」按钮 disabled
// 场景 B：选 framework + 点应用 → 编辑器清空 + 注入 N 个 H2 + N 个空段
// 场景 C：再点一次（同 framework）→ 幂等检查通过 → 不动内容（按钮显对勾）
// 场景 D：切到不同 framework + 点应用 → 清空 + 重新注入
// 场景 E：已有内容 + 切 framework → 提示「应用将覆盖现有内容，确认？」(v1.0 简化为不提示，直接覆盖；v1.1 加确认弹窗)
```

### 5.4 只读模式场景

```ts
// 场景 A：详情页 /blogs/:id 渲染 → 工具栏不显示，字数显示
// 场景 B：用户尝试在只读编辑器输入 → ProseMirror 拒绝
// 场景 C：用户点击链接 → 浏览器默认行为（新窗口打开）
// 场景 D：只读模式下撤销栈被禁用（符合预期）
```

### 5.5 旧数据迁移

```ts
// 场景 A：Blog.content = undefined → 渲染空 doc
// 场景 B：Blog.content = "旧纯文本" → 渲染成 paragraph 包装
// 场景 C：Blog.content = "{invalid json" → catch 走纯文本逻辑
// 场景 D：Blog.content = '{"type":"doc","content":[]}' → 原样渲染
```

---

## 6. 不在本 change 范围

- 附件上传 / 图片拖入
- 协作 / 评论 / 修订
- Markdown 导出 / PDF 导出
- 自定义工具栏配置
- 移动端适配
- Tiptap 撤销/重做 UI 按钮
- 单元测试（v1.0 暂不写）
- 旧的 MarkdownRender 组件迁移（详情页换 RichEditor 后 MarkdownRender 暂时保留，供外部 .md 导入使用）
