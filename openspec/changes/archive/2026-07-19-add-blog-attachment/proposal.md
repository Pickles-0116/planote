# Proposal · 博客附件（图片 + PDF）

## Why

PRD v1.0 §6.5 明确博客支持「图片 + 附件」能力，但当前现状：

- 博客详情页（`/blogs/:id`）只展示 Tiptap 渲染的富文本 + 纯文本
- 博客编辑页（`/blogs/:id/edit`）的 Tiptap 工具栏没有「插入图片」按钮
- 即使博客里写「参考截图：xxx.png」，读者看不到图；写「参考 PDF：xxx.pdf」，读者下载不到
- 截图、参考图、设计稿、参考论文 PDF 都属于博客常见附件类型；纯文本博客承载不了这类内容

`add-data-layer-dexie` 已经把 `Attachment` 模型 + `AttachmentRepository` + Dexie `attachments` 表建好（含 blogId / mimeType / size / blob / filename / uploadedAt 字段），`add-blog-tiptap-editor` 也把 Tiptap 编辑器落地。**数据层和编辑器就绪，只差 UI 集成与组件**——这一轮把"博客附件"从模型变成用户可见可用。

## What Changes

### 1. BlogEdit 工具栏加「图片」按钮

- 在 `EditorToolbar` 加一个「图片」按钮（`Paperclip` icon）
- 点击触发隐藏的 `<input type="file" accept="image/*,.pdf">` click
- 选中文件后调 `useAttachments(blogId).add(file)` → 立即存入 IndexedDB

### 2. BlogEdit 底部「附件」管理面板

- 编辑器下方新增 `AttachmentManager` 区域
- 列出当前 blog 的所有附件（缩略图 / PDF icon + 文件名 + 大小）
- 缩略图 = `URL.createObjectURL(blob)`（缓存于 `useAttachmentStore.objectUrls`）
- 每条附件可删除（带 confirm）
- 0 附件时折叠隐藏（不显空区域）

### 3. BlogDetail 内容下方展示附件

- 在 `<RichEditor readOnly>` 之后渲染 `<AttachmentList>` 组件
- 图片附件：点击放大（用 `<dialog>` + showModal 全屏显示）
- PDF 附件：点击触发下载（`<a download>`）
- 按上传时间倒序排列

### 4. useAttachments hook

- `src/features/blog/hooks/useAttachments.ts`
- 暴露 `{ attachments, add(file), remove(id), loading, error, isUploading }`
- 内部用 `useAttachmentsForBlog(blogId)` 订阅 + `useAttachmentStore` 写操作
- 错误用现有 `useToast` 模式（无则新建 `toastStore` 极简版：array + push/dismiss）

### 5. 上传校验

- 单文件 ≤ 5MB
- 类型：`image/*`（jpg/png/gif/webp）+ `application/pdf`
- 超过 5MB 或错误格式：弹 toast 错误，不写入 IndexedDB

### 6. 持久化

- 复用现有 Dexie `attachments` 表（schema 已含 `&id, blogId, uploadedAt` 索引）
- 复用 `useAttachmentStore.uploadAttachment` / `deleteAttachment` / `getObjectURL` / `revokeAll`
- `Blog.attachmentIds` 数组由 `AttachmentRepository` 自动维护

## Scope

**In Scope**：

- 新建 `src/features/blog/components/AttachmentUploader.tsx` + `AttachmentList.tsx` + `AttachmentItem.tsx` + `AttachmentManager.tsx`
- 新建 `src/features/blog/hooks/useAttachments.ts`（包装 useAttachmentStore）
- 新建 `src/shared/components/ImageLightbox.tsx`（`<dialog>` 全屏图片预览）
- 新建 `src/stores/toastStore.ts`（极简 toast 队列 store + `<ToastViewport>` 渲染器）
- 改造 `src/features/blog/components/EditorToolbar.tsx`：加「图片」按钮（accept="image/*,.pdf"）
- 改造 `src/features/blog/components/RichEditor.tsx`：透传 `onAttachClick` prop（点击触发文件选择）
- 改造 `src/pages/blogs/BlogEdit.tsx`：mount AttachmentUploader + AttachmentManager；管理文件选择回调
- 改造 `src/pages/blogs/BlogDetail.tsx`：内容下方加 AttachmentList + 集成 ImageLightbox
- 改造 `src/app/App.tsx` 或 `src/components/layout/AppLayout.tsx`：mount `<ToastViewport />`
- spec 增量：新增 `blog-attachment` capability，9-10 个 ADDED Requirements，~25 个 Scenarios

**Out of Scope**（明确不做）：

- 视频附件（v1.2+）
- 云存储 / 上传到 OSS（v1.1+）
- 拖拽上传（v1.1+）
- 多文件批量进度条（v1.0 同步读取瞬时完成，进度条无意义；未来真接云端再补）
- 图片编辑（裁剪 / 旋转 / 滤镜）—— v1.2
- 图片懒加载（v1.0 数量少无需）
- Markdown / PDF 附件预览（PDF 只下载不预览）—— v1.1
- 附件搜索 / 标签 / 排序（v1.0 仅按 uploadedAt 倒序）—— v1.2
- 博客封面图（`Blog.coverImageId`）—— 下一轮 add-blog-cover-image
- 附件版本管理 / 软删除（v1.0 真删）—— v1.2
- 移动端手势（v1.0 桌面优先）
- 单测

## Acceptance Criteria

- [ ] **AC-1**：`BlogEdit` 工具栏「图片」按钮 → 触发隐藏 file input（accept="image/*,.pdf"）
- [ ] **AC-2**：选中文件后立即在 `BlogEdit` 底部「附件」区域显示缩略图（图片）或 PDF icon + 文件名
- [ ] **AC-3**：上传瞬时完成（本地读取），UI 立即显「已添加」反馈（toast 提示）
- [ ] **AC-4**：附件可删除（带 confirm 确认 → 立即从 IndexedDB + UI 移除）
- [ ] **AC-5**：`BlogDetail` 内容下方展示附件列表，图片点击放大（`<dialog>` 全屏），PDF 点击下载（`<a download>`）
- [ ] **AC-6**：附件数据持久化到 IndexedDB（刷新后仍在）
- [ ] **AC-7**：单文件 ≤ 5MB 校验（超过弹 toast 错误，不写入 DB）
- [ ] **AC-8**：非图片/PDF 类型拒绝（toast 错误，不写入）
- [ ] **AC-9**：`pnpm build` 0 error / `pnpm lint` 0 warning
- [ ] **AC-10**：`openspec validate add-blog-attachment --strict` 通过

## Risks

| 风险 | 等级 | 缓解 |
|------|------|------|
| Blob URL 内存泄漏 | 中 | `useAttachmentStore.revokeAll` + 组件 unmount cleanup；`getObjectURL` 缓存避免重复创建 |
| 5MB 限制太严格 | 低 | v1.0 PRD 规定；v1.1 可按用户偏好调整 |
| 大量附件性能（100+ blob）| 中 | 缩略图用 `URL.createObjectURL(blob)` 直接渲染，无须 DataURL；v1.0 数量少（个人博客）；v1.2 加虚拟化 |
| 详情页 attachmentIds 引用失效 | 低 | 删附件时同步从 `Blog.attachmentIds` 移除（AttachmentRepository 已实现）|
| PDF 浏览器兼容性 | 低 | 所有现代浏览器都支持 `<a download>`；不预览避免 PDF.js 依赖 |
| 工具栏按钮位置冲突 | 低 | 加在「link」按钮之后，分组「insert」区；移动端折叠 |
| 删除后 Blob URL 已 revoke 但仍引用 | 低 | 删除时先 revoke + 移除 store，再调 repo delete；UI 同步移除 |
| Toast 干扰主交互 | 低 | toast 自动 3s 消失；位置右下角；不阻塞按钮 |
| 大图卡顿（单张 5MB 4K 图）| 中 | 缩略图用 `URL.createObjectURL(blob)`；浏览器原生解码；v1.0 不做压缩（保持原始）|

## Dependencies

- **上游（已完成）**：
  - `add-data-layer-dexie`：`Attachment` 模型 + `attachments` 表 + `AttachmentRepository.upload/delete/getObjectURL` 已可用
  - `add-zustand-stores`：`useAttachmentStore`（含 uploadAttachment / deleteAttachment / getObjectURL / revokeAll）
  - `add-blog-tiptap-editor`：`<RichEditor>` + `<EditorToolbar>` 已落地
  - `add-framework-drawer`（上一轮）：抽屉模式可复用（v1.0 不复用，独立组件）

- **下游（待启动）**：
  - `add-blog-cover-image`：基于本 change 的附件上传能力，单独一张设为封面
  - `add-blog-attachment-search`：v1.2 附件搜索
  - `add-blog-export-zip`：导出整篇博客（含附件）到本地

## Out of Scope Reminder

- 不实现视频附件
- 不实现云存储
- 不实现拖拽上传
- 不实现多文件批量进度条
- 不实现图片编辑
- 不实现 PDF 预览
- 不实现封面图（下一轮 add-blog-cover-image）
- 不写单测
- 不引入新依赖（用现有 lucide-react / Tailwind / zustand / dexie / browser `<dialog>`）
- 不破坏现有 `<RichEditor>` 只读模式（详情页只读不能上传）
