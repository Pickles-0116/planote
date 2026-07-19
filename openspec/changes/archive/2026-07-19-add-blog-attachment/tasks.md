# Tasks · 博客附件（图片 + PDF）

> 每条任务可独立 commit / review。
> 勾选条件：完成代码 + 跑通 AC（见 `proposal.md` 验收标准）。

> **时间预算**：~1.5 人天；每段工时按「单 task ≤ 25min」拆分。
> **完成日期**：2026-07-19 (Round 10)
> **依赖**：add-blog-tiptap-editor + add-data-layer-dexie + add-zustand-stores 已落地

---

## 1. DB schema 验证

- [x] 1.1 验证 `src/db/schema.ts` `attachments` 表结构
  - 确认字段：`&id, blogId, uploadedAt` 索引存在
  - 确认 `Attachment` 接口（domain.ts）含 `blogId / filename / mimeType / size / blob / uploadedAt`
- [x] 1.2 验证 `useAttachmentStore` API
  - `uploadAttachment(blogId, file) → Promise<Attachment>`
  - `deleteAttachment(id) → Promise<void>`（自动 revoke cache）
  - `getObjectURL(id) → Promise<string>`（cache 机制）
  - `revokeAll()`（unmount 调用）
- [x] 1.3 验证 `useAttachmentsForBlog(blogId)` hook
  - 返回 `Attachment[] | undefined`（live query）

## 2. Toast store（基础设施）

- [x] 2.1 `src/stores/toastStore.ts` → 极简 toast 队列
  - interface `Toast { id, kind, message, createdAt }`
  - 状态：`toasts: Toast[]`
  - action：`push(kind, message) → string`（返回 id）/ `dismiss(id)`
  - 内部 3 秒后自动 dismiss（setTimeout）
  - 最多同时 3 条（超出排队）
- [x] 2.2 `src/stores/index.ts` → 导出 `useToastStore` + `type ToastKind`
- [x] 2.3 `src/shared/components/ToastViewport.tsx` → 全局 toast 渲染
  - props: 无（全局唯一）
  - 监听 `useToastStore.toasts` → 渲染堆叠
  - 位置：右下角 `fixed bottom-4 right-4 z-[60]`
  - pointer-events-none 容器 + pointer-events-auto 单 toast
  - 颜色：error=red, info=blue, success=emerald
  - 文案 + 右侧「×」手动 dismiss
- [x] 2.4 `src/components/layout/AppLayout.tsx` → mount `<ToastViewport />`
  - 在 `<Outlet />` 旁边，不影响主布局

## 3. 校验工具

- [x] 3.1 `src/features/blog/utils/attachmentValidation.ts` → 文件校验
  - 导出 `ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']`
  - 导出 `MAX_SIZE_BYTES = 5 * 1024 * 1024`
  - 导出 `validateAttachment(file) → { ok: true } | { ok: false, error: string }`
  - 逻辑：先查 MIME 在白名单 → 再查 size ≤ 5MB

## 4. useAttachments hook

- [x] 4.1 `src/features/blog/hooks/useAttachments.ts` → 包装 hook
  - 签名：`useAttachments(blogId: ID) → { attachments, add, remove, loading, error, isUploading }`
  - 内部用 `useAttachmentsForBlog(blogId)` 订阅
  - `add(file)`：先校验 → 失败 toast + 返回 null → 成功 `uploadAttachment`
  - `remove(id)`：`deleteAttachment(id)`
  - 暴露 `loading` / `error` / `isUploading`（写操作状态）
- [x] 4.2 错误处理：所有 catch 走 `useToastStore.push('error', ...)` + console.error
- [x] 4.3 成功反馈：`add` 成功后 `useToastStore.push('success', '已添加')`

## 5. AttachmentUploader 组件

- [x] 5.1 `src/features/blog/components/AttachmentUploader.tsx` → 隐藏 file input
  - `forwardRef + useImperativeHandle` 暴露 `trigger()`
  - props：`{ onFile: (file: File) => void, accept?: string }`
  - 内部：隐藏 `<input type="file" accept={accept} className="hidden">` + onChange
  - ref trigger → `inputRef.current?.click()`
  - onFile 回调后清空 input.value（允许选同一文件再次触发）

## 6. AttachmentItem 组件

- [x] 6.1 `src/features/blog/components/AttachmentItem.tsx` → 单附件卡片
  - props：`{ attachment, blobUrl, onClick?, onRemove? }`
  - 图片分支：`<img src={blobUrl} alt={filename} />` + 缩略图样式
  - PDF 分支：`<FileText />` icon + 文件名 + 大小
  - 底部：filename（line-clamp-1）+ size（KB / MB 格式化）
  - 右上角「×」按钮（仅 onRemove 存在时显）
  - hover 态：边框 + 阴影
- [x] 6.2 size 格式化工具 `formatFileSize(bytes) → string`
  - < 1KB：原字节数 + 'B'
  - < 1MB：KB 1 位小数
  - ≥ 1MB：MB 1 位小数

## 7. AttachmentList 组件

- [x] 7.1 `src/features/blog/components/AttachmentList.tsx` → 网格列表（详情页用）
  - props：`{ attachments: Attachment[], onImageClick?: (att, blobUrl) => void }`
  - 网格：`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3`
  - 每条：调 `useAttachmentStore.getObjectURL(id)` 拿 URL
  - 图片：包 `<button onClick={() => onImageClick?.(att, url)}>`
  - PDF：包 `<a href={url} download={filename}>` + `<Download />` icon
  - 排序：按 `uploadedAt` 倒序

## 8. AttachmentManager 组件

- [x] 8.1 `src/features/blog/components/AttachmentManager.tsx` → 编辑页附件面板
  - props：`{ attachments: Attachment[] | undefined, onRemove: (id) => void }`
  - 标题：「附件（N）」font-semibold + count
  - 内容：复用 AttachmentList 的网格布局
  - 每条可删除（onRemove 按钮）
  - 0 附件时不渲染（attachments?.length === 0 || undefined 都不渲染）
- [x] 8.2 blobUrl 处理：内部用 `useAttachmentStore.getObjectURL(id)` 拿 URL，传给子组件

## 9. ImageLightbox 组件

- [x] 9.1 `src/shared/components/ImageLightbox.tsx` → 全屏图片预览
  - props：`{ src: string | null, alt: string, onClose: () => void }`
  - 用 `<dialog>` 元素 + `useRef`
  - useEffect：src 变化时 `showModal()`；unmount / src 变 null 时 `close()`
  - 内容：`<img src={src} alt={alt} className="max-w-[90vw] max-h-[90vh]" />`
  - 背景：`<dialog className="backdrop:bg-black/80">`
  - 背景点击关闭：`onClick={(e) => e.target === e.currentTarget && onClose()}`
  - Esc 关闭：dialog 原生内建，无需手写
- [x] 9.2 a11y：dialog 原生 focus trap + Esc 关闭，无需额外

## 10. EditorToolbar 工具栏扩展

- [x] 10.1 `src/features/blog/components/EditorToolbar.tsx` → 加「图片」按钮
  - 在「link」按钮之后插入新按钮
  - icon：`<Paperclip size={14} />`
  - props 新增：`onAttachClick?: () => void`
  - disabled：`readOnly || !onAttachClick`
  - a11y：`aria-label="插入图片或 PDF"`
  - 焦点环：`focus-visible:ring-2 ring-brand-500 focus:outline-none`
- [x] 10.2 `src/features/blog/components/RichEditor.tsx` → 透传 onAttachClick
  - props 新增：`onAttachClick?: () => void`
  - 透传给 EditorToolbar

## 11. BlogEdit 集成

- [x] 11.1 `src/pages/blogs/BlogEdit.tsx` → mount AttachmentUploader + AttachmentManager
  - `useRef<AttachmentUploaderHandle>(null)` uploaderRef
  - `const { attachments, add, remove } = useAttachments(id ?? '')`
  - 工具栏 onAttachClick：`() => uploaderRef.current?.trigger()`
  - 富文本编辑器下方：`<AttachmentManager attachments={attachments} onRemove={remove} />`
  - mount `<AttachmentUploader ref={uploaderRef} onFile={add} accept="image/*,.pdf" />`
  - create 模式（mode === 'create'）时不挂载（v1.0 暂不实现新建）
- [x] 11.2 useAttachments 错误处理
  - 校验失败 → toast 错误（hook 内部已处理）
  - 上传失败 → toast 错误 + UI 不显示该附件

## 12. BlogDetail 集成

- [x] 12.1 `src/pages/blogs/BlogDetail.tsx` → mount AttachmentList + ImageLightbox
  - `const { attachments } = useAttachments(id)`
  - 状态：`const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)`
  - 富文本编辑器（只读）下方：`<AttachmentList attachments={attachments ?? []} onImageClick={(att, url) => setLightbox({ src: url, alt: att.filename })} />`
  - mount `<ImageLightbox src={lightbox?.src ?? null} alt={lightbox?.alt ?? ''} onClose={() => setLightbox(null)} />`
  - 0 附件不渲染附件区
- [x] 12.2 只读模式：无上传 / 删除入口（仅展示 + 放大 + 下载）

## 13. 单元 / 集成测试（可选，v1.0 跳过）

- [ ] 13.1 vitest：useAttachments hook 校验逻辑
- [ ] 13.2 vitest：toastStore push/dismiss
- [ ] 13.3 E2E：上传 → 详情页展示

> **v1.0 跳过**：PRD / project.md 明确 v1.0 Sprint 1-2 暂不写单测；上 Round 7-8 也未写

## 14. 验证

- [x] 14.1 `pnpm build` 通过 TS 严格模式编译，0 error
- [x] 14.2 `pnpm lint` 0 error / 0 warning
- [ ] 14.3 手动验证：BlogEdit 工具栏「图片」按钮 → 文件选择器弹出 — 浏览器
  > **agent 环境受限，留待人工验证**
- [ ] 14.4 手动验证：选 1 张 jpg → 立即在底部附件区显缩略图 + toast「已添加」— 浏览器
  > **agent 环境受限，留待人工验证**
- [ ] 14.5 手动验证：选 1 张 6MB png → toast「文件超过 5MB」+ 不写入 — 浏览器
  > **agent 环境受限，留待人工验证**
- [ ] 14.6 手动验证：选 1 个 .docx → toast「仅支持图片和 PDF」— 浏览器
  > **agent 环境受限，留待人工验证**
- [ ] 14.7 手动验证：附件删除（带 confirm → UI + DB 移除）— 浏览器
  > **agent 环境受限，留待人工验证**
- [ ] 14.8 手动验证：BlogDetail 页面附件列表（图片缩略图 + PDF icon）— 浏览器
  > **agent 环境受限，留待人工验证**
- [ ] 14.9 手动验证：详情页图片点击 → 全屏 dialog → 背景点击关闭 — 浏览器
  > **agent 环境受限，留待人工验证**
- [ ] 14.10 手动验证：详情页 PDF 点击 → 浏览器下载 — 浏览器
  > **agent 环境受限，留待人工验证**
- [ ] 14.11 手动验证：刷新页面后附件仍在 — 浏览器
  > **agent 环境受限，留待人工验证**
- [ ] 14.12 手动验证：编辑页上传 → 切详情页 → 同步显示 — 浏览器
  > **agent 环境受限，留待人工验证**
- [x] 14.13 `openspec validate add-blog-attachment --strict` 通过

## 15. 提交与归档

- [ ] 15.1 `git add .` + `git commit -m "feat(blog): add image and PDF attachments with upload, preview and download"`
  > **agent 不做 git，由父会话提交**
- [x] 15.2 `openspec archive add-blog-attachment --yes`

---

## 验收对照

| AC | 对应任务 | 验证方式 |
|----|---------|---------|
| AC-1（工具栏按钮 + file input）| 10.1 + 11.1 | 浏览器 |
| AC-2（缩略图 + PDF icon）| 6.1 + 8.1 | 浏览器 |
| AC-3（瞬时完成 + toast）| 4.3 + 5.1 | 浏览器 |
| AC-4（删除 + confirm）| 8.1 + 11.1 | 浏览器 |
| AC-5（详情页展示 + 放大 + 下载）| 7.1 + 9.1 + 12.1 | 浏览器 |
| AC-6（持久化）| 1.1 + 1.2 + 4.1 | 浏览器刷新 |
| AC-7（5MB 限制）| 3.1 + 4.1 | 浏览器 |
| AC-8（类型白名单）| 3.1 + 4.1 | 浏览器 |
| AC-9（build + lint）| 14.1 + 14.2 | CLI ✓ |
| AC-10（validate）| 14.13 | CLI ✓ |

---

## 时间预算

| 段 | 工时 | 备注 |
|----|------|------|
| 1（schema 验证）| 0.05 | 读现成代码确认 |
| 2（toast store）| 0.15 | 1 store + 1 组件 + AppLayout mount |
| 3（校验工具）| 0.1 | 1 utils 文件 |
| 4（useAttachments hook）| 0.2 | 包装 + 校验 + 错误处理 |
| 5（AttachmentUploader）| 0.1 | 隐藏 input + ref trigger |
| 6（AttachmentItem）| 0.15 | 双分支 + 格式化 |
| 7（AttachmentList）| 0.15 | 网格 + blobUrl 注入 |
| 8（AttachmentManager）| 0.1 | 标题 + 列表包装 |
| 9（ImageLightbox）| 0.15 | dialog + showModal |
| 10（工具栏扩展）| 0.05 | 1 按钮 + 透传 |
| 11（BlogEdit 集成）| 0.15 | mount + 状态管理 |
| 12（BlogDetail 集成）| 0.15 | mount + lightbox state |
| 13（测试）| 0 | v1.0 跳过 |
| 14（验证）| 0.3 | build / lint / validate + 浏览器 11 项 |
| 15（提交归档）| 0.1 | git + archive |
| **合计** | **1.7 人天** | 略超 1.5h；可压缩验证段 |
