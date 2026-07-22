# Design · add-blog-import-markdown

## 1. 选型

### 1.1 Markdown 解析器

| 候选 | 优点 | 缺点 | 选 |
|------|------|------|---|
| `marked` | 极轻量（~10KB gzip）、API 简单、速度最快 | 配置项较少 | ✅ |
| `remark` + `remark-parse` + `remark-gfm` | 插件体系强、支持 GFM 表格/任务列表 | 体积大（~50KB）、学习曲线陡 | ❌ |
| `markdown-it` | 中等（~30KB）、中文社区多 | 略重 | ❌ |

**选 marked**：v1.1 阶段只覆盖基础语法，marked 足够，体积小。

### 1.2 HTML → TiptapJSON 转换

Tiptap 2.x 官方包 `@tiptap/html` 提供 `generateJSON(html, extensions)`。

**选 `@tiptap/html`**：避免手工写 token mapping，节省 ~20 tasks。

## 2. 流程

```
用户点「导入 .md」
   ↓
<ImportMarkdownButton onFile={handleFile}>
   ↓
useMarkdownImport 钩子
   ↓
1. FileReader.readAsText(file)
   ↓
2. markdownToTiptap.convert(markdown)
   - marked.parse(md) → HTML 字符串
   - generateJSON(html, [...extensions]) → TiptapJSON
   ↓
3. createBlog({ title: filename, content: JSON, contentText, excerpt })
   ↓
4. navigate(`/blogs/${newBlog.id}/edit`)
   ↓
失败 → toast 错误 + 不创建
```

## 3. 文件结构

### 3.1 `src/features/blog/utils/markdownToTiptap.ts`

```ts
import { marked } from 'marked';
import { generateJSON } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';

const EXTENSIONS = [StarterKit, Link.configure({ openOnClick: false })];

export function markdownToTiptapJSON(markdown: string): TiptapJSON {
  const html = marked.parse(markdown, { async: false, gfm: true, breaks: true }) as string;
  return generateJSON(html, EXTENSIONS);
}

export function extractTitle(markdown: string, filename: string): string {
  // 优先级：1) Markdown H1  2) 文件名（去扩展名）
  const h1Match = markdown.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  return filename.replace(/\.(md|markdown|txt)$/i, '');
}

export function extractPlainText(json: TiptapJSON): string {
  // 复用 v1.0 extractPlainText.ts
}
```

### 3.2 `src/features/blog/hooks/useMarkdownImport.ts`

```ts
export function useMarkdownImport() {
  const createBlog = useBlogStore(s => s.createBlog);
  const navigate = useNavigate();
  const { pushToast } = useToastStore();

  return useCallback(async (file: File) => {
    try {
      if (file.size > 1_000_000) throw new Error('文件超过 1MB');
      if (!/\.(md|markdown|txt)$/i.test(file.name)) throw new Error('仅支持 .md / .markdown / .txt');

      const md = await file.text();
      const title = extractTitle(md, file.name);
      const content = markdownToTiptapJSON(md);
      const contentText = extractPlainText(content);

      const blog = await createBlog({ title, content: JSON.stringify(content), contentText, excerpt: '' });
      navigate(`/blogs/${blog.id}/edit`);
    } catch (err) {
      pushToast({ message: `导入失败：${err.message}`, type: 'error' });
    }
  }, [createBlog, navigate, pushToast]);
}
```

### 3.3 `src/features/blog/components/ImportMarkdownButton.tsx`

```tsx
export default function ImportMarkdownButton() {
  const ref = useRef<HTMLInputElement>(null);
  const importFile = useMarkdownImport();

  return (
    <>
      <button onClick={() => ref.current?.click()}>
        <FileUp size={14} /> 导入 .md
      </button>
      <input
        ref={ref}
        type="file"
        accept=".md,.markdown,.txt"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
      />
    </>
  );
}
```

### 3.4 `src/features/blog/components/NewBlogMenu.tsx`

统一入口：下拉菜单含「空白博客」/「导入 .md」/「应用框架」3 选项。整合到 BlogListToolbar 顶部。

## 4. 验证清单

1. `pnpm build` → 0 error
2. `pnpm lint` → 0 warning
3. `cmd /c openspec.cmd validate add-blog-import-markdown --strict` → valid
4. 浏览器：选 1 个含 H1+列表+代码块+链接 的 .md → 自动创建 + 跳转编辑页 + 内容完整保留
5. 浏览器：选 1 个 > 1MB 文件 → toast 错误 + 不创建
6. 浏览器：选 1 个 .pdf 文件 → toast 错误 + 不创建

## 5. 风险评估

- 风险等级：中等
- marked + @tiptap/html 组合需测试边缘 case（HTML 转义、特殊字符）
- 缓解：明确支持的语法清单（AC-5）+ 失败兜底
