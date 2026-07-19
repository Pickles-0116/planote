# Design · 博客附件（图片 + PDF）

> 本文档回答**「附件怎么上传/展示/下载、Blob URL 怎么生命周期管理、错误怎么处理、UI 怎么组织」**。
> 不重复 `architecture.md` 已有的数据模型 / Repository 模式，仅补充本 change 的具体决策。

---

## 1. 选型复述

| 决策 | 选择 | 排除项 | 原因 |
|------|------|--------|------|
| 存储 | 复用 Dexie `attachments` 表（Blob 字段）| IndexedDB 字符串 base64 / File System Access API | schema 已建；Dexie 原生支持 Blob；v1.1 FS Access API 后加 |
| URL 生命周期 | `URL.createObjectURL(blob)` + store 缓存 + revokeAll | DataURL 嵌入 src | Blob URL 性能优 + 浏览器原生解码；DataURL 大图卡顿 |
| 缩略图渲染 | `<img src={blobUrl}>` | 自建 canvas 缩放 | 浏览器原生；v1.0 无需压缩 |
| 全屏预览 | `<dialog>` 元素 + `showModal()` | 自己写模态层 / Lightbox 库 | 原生；无新依赖；a11y 内建 |
| PDF 下载 | `<a href={blobUrl} download={filename}>` | PDF.js 预览 | 不引依赖；PDF 阅读由用户本机 PDF 阅读器处理 |
| 错误反馈 | `toastStore` 极简队列 + `<ToastViewport>` 渲染 | 引入 react-hot-toast 等 | 项目零新依赖原则；3 行实现够用 |
| 上传流程 | 同步读取 + 立即存 DB | 流式上传 / 进度回调 | 5MB 以内瞬时完成；进度条无意义 |
| 文件选择 UI | 工具栏按钮 → 隐藏 `<input type="file" accept="image/*,.pdf">` | 拖拽 / 文件管理器 | v1.0 桌面优先；拖拽 v1.1+ |
| 校验时机 | 选中文件后立即校验（5MB + 类型）| 上传后校验 | 即时反馈；减少无意义 DB 写入 |
| 排序 | 按 `uploadedAt` 倒序 | 用户拖拽排序 / 字母序 | 博客时间线语义最自然 |
| 编辑器集成 | 工具栏按钮触发 + 附件在编辑器外独立管理 | 拖入编辑器（Tiptap Image ext）| 不引入 Tiptap Image 扩展；附件与正文解耦 |

---

## 2. 关键架构决策

### 2.1 组件分层

```
<BlogEdit>
  ├─ <RichEditor>
  │    └─ <EditorToolbar>     ← 加「图片」按钮（onAttachClick）
  └─ <AttachmentManager>      ← 缩略图网格 + 删除
       ├─ <AttachmentItem>    ← 单附件（缩略图 / PDF icon）
       └─ <AttachmentUploader> ← 隐藏 file input（被 onAttachClick 触发）

<BlogDetail>
  ├─ <RichEditor readOnly>     ← 已有
  └─ <AttachmentList>          ← 附件展示（图片点击放大 / PDF 下载）
       └─ <ImageLightbox>      ← dialog 全屏预览

<AppLayout>
  └─ <ToastViewport />         ← 监听 toastStore，自动消失
```

- `<AttachmentUploader>` 不直接渲染可见 UI；只暴露 `trigger()` 方法（用 forwardRef + useImperativeHandle）
- 工具栏按钮调用 `uploaderRef.current?.trigger()` → 触发隐藏 file input click
- 这种"隐藏 file input + ref trigger"模式与 Tiptap 工具栏无侵入集成

### 2.2 Blob URL 生命周期

```ts
// useAttachmentsForBlog → 自动监听 attachment 列表
// 每次渲染时通过 useAttachmentStore.getObjectURL(id) 拿 URL
// store 内 Map<id, url> 缓存，避免重复 createObjectURL
// 组件 unmount 时调 useAttachmentStore.revokeAll() 释放所有 URL
```

**关键时序**：
- mount → 订阅 → render → 调 getObjectURL → store 缓存 URL
- unmount → revokeAll → 释放所有 URL

**为什么用 store 缓存而不是组件内 useMemo**：
- 跨组件共享：详情页和编辑页可能同时存在（理论上不会，但加保险）
- 同一 blob 多次渲染共用同一 URL

### 2.3 附件上传流程

```ts
// 1. 工具栏「图片」按钮 → onAttachClick()
// 2. AttachmentUploader.trigger() → 隐藏 input.click()
// 3. 用户选文件 → onChange(fileList)
// 4. 校验：类型 + 大小
//    - 失败 → toast 错误 + return
//    - 通过 → 调 useAttachments(blogId).add(file)
// 5. add(file) → useAttachmentStore.uploadAttachment(blogId, file)
//    → attachmentRepo.upload() → Dexie 写 blob + 同步 Blog.attachmentIds
// 6. useAttachmentsForBlog 自动 live query → 列表更新
// 7. 缩略图 URL 通过 getObjectURL 获取 → 渲染
```

### 2.4 附件删除流程

```ts
// 1. AttachmentItem 点「删除」按钮
// 2. window.confirm('确认删除「xxx.png」？')
// 3. 确认 → 调 useAttachments(blogId).remove(id)
// 4. remove(id) → useAttachmentStore.deleteAttachment(id)
//    → 内部先 revokeObjectURL(cached) + 从 Map 删除
//    → attachmentRepo.delete(id) → Dexie 删除 + 同步 Blog.attachmentIds
// 5. useAttachmentsForBlog 自动更新 → UI 移除该卡片
```

### 2.5 详情页全屏预览

```tsx
// ImageLightbox.tsx
export default function ImageLightbox({ src, alt, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (src) dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, [src]);

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="backdrop:bg-black/80"
    >
      <img src={src} alt={alt} className="max-w-[90vw] max-h-[90vh]" />
    </dialog>
  );
}
```

- 背景点击关闭（dialog 原生支持 `e.target === currentTarget`）
- Esc 关闭（dialog 原生内建）
- 不需要 state 同步：useEffect 在 src 变化时 open/close

### 2.6 PDF 下载

```tsx
<a
  href={blobUrl}
  download={attachment.filename}
  className="..."
>
  <FileText size={16} />
  {attachment.filename}
  <Download size={14} />
</a>
```

- `<a download>` 触发浏览器下载（Chrome/Edge/Firefox/Safari 均支持）
- blobUrl 来自 `useAttachmentStore.getObjectURL(id)`
- 不预览避免 PDF.js 依赖

### 2.7 错误处理：toastStore

```ts
// src/stores/toastStore.ts
interface Toast { id: string; kind: 'error' | 'info' | 'success'; message: string; }
interface ToastStoreState {
  toasts: Toast[];
  push: (kind: Toast['kind'], message: string) => void;
  dismiss: (id: string) => void;
}
```

- 简单队列，最多同时 3 条
- 3 秒后自动 dismiss（用 setTimeout）
- `<ToastViewport>` 全局渲染（mount 在 AppLayout）→ 监听 `toasts` → 渲染右下角堆叠

**为什么新建 store 而不是用 useUIStore**：
- toast 是高频短期状态；放 uiStore 会让 selector 订阅者被频繁通知
- 独立 store 让 toast 推送不影响其他 UI 状态订阅

### 2.8 useAttachments hook 签名

```ts
// src/features/blog/hooks/useAttachments.ts
interface UseAttachmentsResult {
  attachments: Attachment[] | undefined;  // live query
  add: (file: File) => Promise<Attachment | null>;  // null = 校验失败
  remove: (id: ID) => Promise<void>;
  loading: boolean;  // 写操作进行中
  error: AppErrorPayload | null;
  /** 是否正在上传（用于 UI 反馈）。 */
  isUploading: boolean;
}

export function useAttachments(blogId: ID): UseAttachmentsResult {
  const attachments = useAttachmentsForBlog(blogId);
  const store = useAttachmentStore();
  
  const add = useCallback(async (file: File): Promise<Attachment | null> => {
    // 1. 校验
    if (!isValidFile(file)) {
      useToastStore.getState().push('error', getValidationError(file));
      return null;
    }
    // 2. 上传
    return store.uploadAttachment(blogId, file);
  }, [blogId, store]);
  
  const remove = useCallback((id: ID) => store.deleteAttachment(id), [store]);
  
  return {
    attachments,
    add,
    remove,
    loading: store.loading,
    error: store.error,
    isUploading: store.loading,
  };
}
```

**校验逻辑**：
- 允许类型：`image/jpeg, image/png, image/gif, image/webp, application/pdf`
- 允许大小：≤ 5 × 1024 × 1024 bytes
- 失败：弹 toast + 返回 null（不抛错，因为是用户输入问题）

### 2.9 工具栏按钮集成

```tsx
// EditorToolbar.tsx
<button
  type="button"
  onClick={onAttachClick}
  disabled={readOnly}
  aria-label="插入图片或 PDF"
  className="..."
>
  <Paperclip size={14} />
</button>
```

- `onAttachClick` prop 由 BlogEdit 传入：`() => uploaderRef.current?.trigger()`
- 只读模式下 disabled（详情页不需要）

### 2.10 BlogEdit 集成

```tsx
// BlogEdit.tsx
const uploaderRef = useRef<AttachmentUploaderHandle>(null);
const { attachments, add, remove } = useAttachments(id ?? '');

return (
  <>
    {/* ... 原有 title / select / RichEditor ... */}
    <RichEditor
      ...
      onAttachClick={() => uploaderRef.current?.trigger()}
    />
    <AttachmentManager
      attachments={attachments}
      onRemove={remove}
    />
    <AttachmentUploader ref={uploaderRef} onFile={add} accept="image/*,.pdf" />
  </>
);
```

- 附件面板在编辑器下方（与编辑器解耦）
- create 模式（无 blogId）时禁用上传（v1.0 暂不实现「新建」）

### 2.11 BlogDetail 集成

```tsx
// BlogDetail.tsx
const { attachments } = useAttachments(id);
const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

return (
  <>
    <RichEditor value={blog.content} readOnly />
    {attachments && attachments.length > 0 && (
      <AttachmentList
        attachments={attachments}
        onImageClick={(att) => setLightboxSrc(/* blobUrl */)}
      />
    )}
    <ImageLightbox
      src={lightboxSrc}
      alt=""
      onClose={() => setLightboxSrc(null)}
    />
  </>
);
```

- 只读模式：附件只展示，不可上传 / 删除
- 缩略图点击 → setLightboxSrc → dialog 自动 showModal
- 关闭 dialog → setLightboxSrc(null) → dialog 自动 close

### 2.12 Toast 队列与展示

```tsx
// ToastViewport.tsx
export default function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} />
      ))}
    </div>
  );
}
```

- z-60 高于 Drawer (z-50)，避免被遮罩盖住
- pointer-events-none 让背景可点击；toast 自身 pointer-events-auto

---

## 3. 组件详细设计

### 3.1 AttachmentUploader

```ts
interface AttachmentUploaderHandle {
  trigger: () => void;
}
interface Props {
  onFile: (file: File) => void | Promise<void>;
  accept?: string;
}

// forwardRef + useImperativeHandle 暴露 trigger
```

- 隐藏 `<input type="file" accept={accept} multiple={false} className="hidden" />`
- onChange 拿到 File → 调 onFile(file)
- ref trigger 调 inputRef.current?.click()

### 3.2 AttachmentItem

```ts
interface Props {
  attachment: Attachment;
  blobUrl: string;
  onRemove?: () => void;
  onClick?: () => void;
}
```

- 图片：`<img src={blobUrl} alt={attachment.filename} />`
- PDF：`<FileText />` icon + 文件名
- 底部：filename + size（KB / MB 格式）
- 可选 onRemove 按钮（编辑模式显，详情页不显）
- onClick 用于详情页图片放大

### 3.3 AttachmentList

```ts
interface Props {
  attachments: Attachment[];
  onImageClick?: (att: Attachment, blobUrl: string) => void;
}
```

- 网格布局：3 列（桌面）/ 2 列（平板）/ 1 列（移动）
- 每条用 AttachmentItem 渲染
- PDF 渲染为下载链接

### 3.4 AttachmentManager

```ts
interface Props {
  attachments: Attachment[] | undefined;
  onRemove: (id: ID) => void;
}
```

- 包装 AttachmentList + 标题「附件（N）」
- 0 附件时不渲染

### 3.5 ImageLightbox

```ts
interface Props {
  src: string | null;
  alt: string;
  onClose: () => void;
}
```

- `<dialog>` 元素 + showModal/close
- 背景点击关闭 + Esc 关闭（原生）

### 3.6 Toast

```ts
interface Props {
  id: string;
  kind: 'error' | 'info' | 'success';
  message: string;
}
```

- 右下角堆叠
- 颜色按 kind 区分（error=red, info=blue, success=emerald）
- 3 秒自动 dismiss

---

## 4. 集成方案

### 4.1 文件清单（新增）

```
src/
├── features/blog/
│   ├── components/
│   │   ├── AttachmentUploader.tsx   # 隐藏 file input + ref trigger
│   │   ├── AttachmentList.tsx       # 列表（详情页用）
│   │   ├── AttachmentItem.tsx       # 单附件卡片
│   │   ├── AttachmentManager.tsx    # 编辑页附件管理面板
│   ├── hooks/
│   │   └── useAttachments.ts        # 包装 useAttachmentStore
├── shared/
│   └── components/
│       └── ImageLightbox.tsx        # <dialog> 全屏图片预览
└── stores/
    └── toastStore.ts                # 极简 toast 队列
```

### 4.2 修改文件

- `src/features/blog/components/EditorToolbar.tsx`：加「图片」按钮 + onAttachClick prop
- `src/features/blog/components/RichEditor.tsx`：透传 onAttachClick
- `src/pages/blogs/BlogEdit.tsx`：mount AttachmentUploader + AttachmentManager
- `src/pages/blogs/BlogDetail.tsx`：mount AttachmentList + ImageLightbox
- `src/components/layout/AppLayout.tsx`：mount `<ToastViewport />`
- `src/stores/index.ts`：导出 `useToastStore`

### 4.3 依赖列表

- **不引新依赖**：用现有 lucide-react（`Paperclip` / `FileText` / `Download` / `Trash2` / `X`）+ Tailwind + zustand + Dexie + 浏览器原生 `<dialog>`
- `useAttachmentStore` 已有，仅包装
- `useAttachmentsForBlog` hook 已有

---

## 5. 边界与测试场景

### 5.1 上传流程

- 选 1 张 2MB jpg → 立即显缩略图 + toast「已添加」
- 选 1 张 6MB png → toast 错误「文件超过 5MB」+ 不写入
- 选 1 个 .docx → toast 错误「仅支持图片和 PDF」+ 不写入
- 选 1 个 4MB pdf → 立即显 PDF icon + 文件名

### 5.2 展示

- 详情页有 3 附件 → 网格显示
- 详情页有 0 附件 → 不显示附件区
- 编辑页有 5 附件 → 缩略图网格 + 每条删除按钮

### 5.3 删除

- 缩略图右上角「×」点击 → confirm 弹窗
- 确认 → 立即从 UI 移除 + DB 写入删除
- 取消 → 无变化

### 5.4 全屏预览

- 点击图片缩略图 → dialog 全屏显示
- 背景点击 / Esc → 关闭
- 连续点击不同图片 → 切 src → dialog 内容更新

### 5.5 PDF 下载

- 点击 PDF 附件 → 浏览器下载
- 不弹 dialog（直接走系统下载）

### 5.6 持久化

- 上传 1 张图 → 刷新页面 → 仍在
- 上传后 Blog.attachmentIds 数组已含该 id（live query 自动）

### 5.7 跨页面

- 编辑页上传 5 张 → 切到详情页 → 5 张都在
- 详情页删除 1 张 → 切回编辑页 → 4 张（live query 同步）

### 5.8 错误

- Dexie 写失败 → toast 错误 + UI 回滚（v1.0 简化为：失败抛错，UI 不显示）
- 5MB 边界：5MB 整 = 允许；5MB+1byte = 拒绝
- 类型边界：image/heic（不支持）= 拒绝

---

## 6. 不在本 change 范围

- 视频附件
- 云存储
- 拖拽上传
- 多文件批量进度条
- 图片编辑（裁剪 / 旋转 / 滤镜）
- PDF 预览
- 附件搜索 / 标签 / 排序
- 博客封面图
- 附件版本管理 / 软删除
- 移动端手势
- 单测
- 国际化（v1.0 中文为主）
- 附件权限 / 分享链接
