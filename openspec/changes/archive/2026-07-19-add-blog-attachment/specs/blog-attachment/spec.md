# blog-attachment 规范（增量 / Delta Spec）

> **Capability**：`blog-attachment`
> **Change**：`add-blog-attachment`
> **类型**：ADDED Requirements（全新能力）
> **来源**：PRD v1.0 §6.5 博客附件 + architecture.md §3.1 Attachment 模型 + data-layer-dexie 已落地 attachments 表

本 capability 定义博客附件的契约——文件类型、大小限制、上传/展示/下载/删除、Blob URL 生命周期、a11y、错误处理。

---

## ADDED Requirements

### Requirement: 附件类型与大小限制

系统 MUST 仅接受图片（jpg/png/gif/webp）+ PDF 附件，单文件 ≤ 5MB。

#### Scenario: 支持的类型

- **GIVEN** 用户在文件选择器中选 `image/jpeg`
- **WHEN** `useAttachments.add(file)` 执行
- **THEN** 校验通过，写入 IndexedDB

#### Scenario: jpg/png/gif/webp/pdf 全部支持

- **GIVEN** 5 种 MIME 类型：image/jpeg, image/png, image/gif, image/webp, application/pdf
- **WHEN** 依次上传
- **THEN** 全部 5 个都被接受

#### Scenario: 5MB 边界允许

- **GIVEN** 用户选 1 个 5 × 1024 × 1024 字节的文件
- **WHEN** 校验执行
- **THEN** 通过，写入 IndexedDB

#### Scenario: 5MB+1byte 拒绝

- **GIVEN** 用户选 1 个 5 × 1024 × 1024 + 1 字节的文件
- **WHEN** 校验执行
- **THEN** 拒绝，弹 toast「文件超过 5MB」
- **AND** 不写入 IndexedDB

#### Scenario: 错误格式拒绝

- **GIVEN** 用户选 1 个 .docx 文件（application/vnd.openxmlformats-officedocument.wordprocessingml.document）
- **WHEN** 校验执行
- **THEN** 拒绝，弹 toast「仅支持图片和 PDF」

### Requirement: 文件选择入口

系统 MUST 在 `BlogEdit` 工具栏提供「图片」按钮，点击触发文件选择器。

#### Scenario: 工具栏按钮存在

- **GIVEN** 用户在 `/blogs/:id/edit` 路由
- **WHEN** 渲染 `<EditorToolbar>`
- **THEN** 显「图片」按钮（Paperclip icon）
- **AND** 按钮 `aria-label="插入图片或 PDF"`

#### Scenario: 只读模式禁用

- **GIVEN** 用户在 `/blogs/:id` 路由（详情页只读）
- **WHEN** 渲染 `<RichEditor readOnly>`
- **THEN** 「图片」按钮 disabled

#### Scenario: 点击触发文件选择

- **GIVEN** BlogEdit 已 mount + `<AttachmentUploader ref>` 已挂载
- **WHEN** 用户点工具栏「图片」按钮
- **THEN** 调 `uploaderRef.current.trigger()`
- **AND** 隐藏 `<input type="file" accept="image/*,.pdf">` 触发 click 事件
- **AND** 浏览器原生文件选择器弹出

### Requirement: 附件上传

系统 MUST 接受用户选中的文件，校验后立即写入 IndexedDB。

#### Scenario: 上传成功

- **GIVEN** BlogEdit 已加载，blogId 存在
- **WHEN** 用户选 1 个 2MB jpg + 触发 add(file)
- **THEN** `useAttachmentStore.uploadAttachment(blogId, file)` 调用
- **AND** `attachmentRepo.upload(blogId, file)` 写 Dexie attachments 表
- **AND** 同步写入 Blog.attachmentIds
- **AND** `useAttachmentsForBlog(blogId)` 自动 live query 触发
- **AND** 弹 toast「已添加」

#### Scenario: 上传瞬时完成

- **GIVEN** 用户选 1 个 1MB png
- **WHEN** 触发 add(file)
- **THEN** 100ms 内完成（本地读取 + 写 DB）
- **AND** 缩略图立即渲染

#### Scenario: 校验失败不上传

- **GIVEN** 用户选 1 个 6MB 文件
- **WHEN** 触发 add(file)
- **THEN** 校验失败
- **AND** 弹 toast 错误
- **AND** `add` 返回 null
- **AND** IndexedDB 0 写入

### Requirement: 附件展示

系统 MUST 在 `BlogEdit` 底部与 `BlogDetail` 内容下方展示附件列表。

#### Scenario: 编辑页附件管理面板

- **GIVEN** BlogEdit 加载 + blogId 存在
- **WHEN** 渲染 `<AttachmentManager>`
- **THEN** 显「附件（N）」标题
- **AND** 网格布局（每条 = 缩略图 / PDF icon + 文件名 + 大小）
- **AND** 0 附件时面板不渲染

#### Scenario: 详情页附件列表

- **GIVEN** BlogDetail 加载 + blogId 存在
- **WHEN** 渲染 `<AttachmentList>`
- **THEN** 网格布局展示所有附件
- **AND** 按 `uploadedAt` 倒序（最新在前）
- **AND** 0 附件时不渲染

#### Scenario: 图片缩略图渲染

- **GIVEN** 1 个 image/jpeg 附件
- **WHEN** 渲染 `<AttachmentItem>`
- **THEN** 显 `<img src={blobUrl} alt={filename} />`
- **AND** 缩略图用 `URL.createObjectURL(blob)`（来自 `useAttachmentStore.getObjectURL(id)`）

#### Scenario: PDF 缩略图渲染

- **GIVEN** 1 个 application/pdf 附件
- **WHEN** 渲染 `<AttachmentItem>`
- **THEN** 显 `<FileText />` icon + 文件名
- **AND** 不显示预览图（仅 icon）

### Requirement: 附件删除

系统 MUST 让用户在编辑页删除附件（带确认）。

#### Scenario: 删除确认

- **GIVEN** BlogEdit 加载 + 有 3 个附件
- **WHEN** 用户点第 2 个附件的「删除」按钮
- **THEN** 弹 `window.confirm('确认删除「xxx.png」？')`
- **AND** 取消则无操作

#### Scenario: 删除成功

- **GIVEN** 用户点「删除」+ 确认
- **WHEN** `useAttachments.remove(id)` 执行
- **THEN** `useAttachmentStore.deleteAttachment(id)` 调用
- **AND** 内部先 revokeObjectURL 缓存的 URL
- **AND** `attachmentRepo.delete(id)` 从 Dexie 删除 + 同步 Blog.attachmentIds
- **AND** 缩略图从 UI 立即消失

#### Scenario: 详情页不显删除

- **GIVEN** BlogDetail 加载
- **WHEN** 渲染附件列表
- **THEN** 不显「删除」按钮（只读模式）

### Requirement: 图片全屏预览

系统 MUST 让用户在详情页点击图片缩略图时全屏显示。

#### Scenario: 点击放大

- **GIVEN** BlogDetail 加载 + 1 个 jpg 附件
- **WHEN** 用户点击缩略图
- **THEN** `<ImageLightbox src={blobUrl}>` 渲染
- **AND** `<dialog>` 元素 + `showModal()` 调用
- **AND** 全屏显示 `<img src={blobUrl} max-w-[90vw] max-h-[90vh]>`

#### Scenario: 背景点击关闭

- **GIVEN** dialog 打开
- **WHEN** 用户点击背景（非图片区域）
- **THEN** dialog 关闭
- **AND** `onClose` 回调 → setLightboxSrc(null)

#### Scenario: Esc 关闭

- **GIVEN** dialog 打开
- **WHEN** 用户按 Esc
- **AND** dialog 原生处理关闭
- **AND** 触发 onClose

#### Scenario: 切图

- **GIVEN** dialog 打开 + 显示图片 A
- **WHEN** 父组件 setLightboxSrc(图片B 的 url)
- **THEN** dialog 内容更新为图片 B

### Requirement: PDF 下载

系统 MUST 让用户在详情页点击 PDF 附件时触发下载。

#### Scenario: 点击下载

- **GIVEN** BlogDetail 加载 + 1 个 pdf 附件
- **WHEN** 用户点击 PDF 附件
- **THEN** 浏览器原生下载触发
- **AND** 文件名 = `attachment.filename`
- **AND** href = `blobUrl`（来自 `useAttachmentStore.getObjectURL(id)`）

#### Scenario: 锚点属性

- **GIVEN** 1 个 PDF 附件
- **WHEN** 渲染 `<AttachmentItem>`（详情页）
- **THEN** 元素是 `<a href={blobUrl} download={filename}>`
- **AND** 含 `<Download />` icon 提示可下载

### Requirement: Blob URL 生命周期

系统 MUST 管理 `URL.createObjectURL` 创建的 object URL，避免内存泄漏。

#### Scenario: 缓存避免重复创建

- **GIVEN** 1 个 attachment id
- **WHEN** 多个组件同时调 `useAttachmentStore.getObjectURL(id)`
- **THEN** store 内部 Map 缓存，同一 id 只 createObjectURL 1 次
- **AND** 后续调用直接返回缓存的 URL

#### Scenario: 组件 unmount 释放

- **GIVEN** BlogEdit / BlogDetail 渲染（订阅 attachments）
- **WHEN** 组件 unmount
- **THEN** `useAttachmentStore.revokeAll()` 调用
- **AND** 遍历所有缓存 URL 调 `URL.revokeObjectURL`
- **AND** 清空 Map

#### Scenario: 删除时同步 revoke

- **GIVEN** 用户点删除
- **WHEN** `useAttachmentStore.deleteAttachment(id)` 执行
- **THEN** 先 revoke 缓存的该 id URL
- **AND** 从 Map 移除
- **AND** 再调 `attachmentRepo.delete(id)` 删 DB

### Requirement: 错误反馈（toast）

系统 MUST 通过 toast 通知用户上传错误。

#### Scenario: 5MB 超限 toast

- **GIVEN** 用户选 6MB 文件
- **WHEN** 校验失败
- **THEN** `useToastStore.push('error', '文件超过 5MB')`
- **AND** 右下角 toast 3 秒后自动消失

#### Scenario: 错误格式 toast

- **GIVEN** 用户选 .docx 文件
- **WHEN** 校验失败
- **THEN** `useToastStore.push('error', '仅支持图片和 PDF')`

#### Scenario: 上传成功 toast

- **GIVEN** 用户选 1 个有效文件
- **WHEN** 上传成功
- **THEN** `useToastStore.push('success', '已添加')`

#### Scenario: toast 队列

- **GIVEN** 短时间内多个 toast 推送
- **WHEN** ToastViewport 渲染
- **THEN** 同时最多显示 3 个
- **AND** 超出排队等待
- **AND** 3 秒后自动 dismiss

#### Scenario: toast 位置与 z-index

- **GIVEN** toast 队列非空
- **WHEN** ToastViewport 渲染
- **THEN** 位置：右下角
- **AND** z-index = 60（高于 Drawer 的 50）
- **AND** 不阻塞页面交互（pointer-events-none 容器 + pointer-events-auto toast 本身）

### Requirement: a11y 与键盘交互

系统 MUST 让附件功能满足基础 a11y。

#### Scenario: 工具栏按钮可访问

- **GIVEN** BlogEdit 渲染
- **WHEN** 工具栏「图片」按钮渲染
- **THEN** 显 `aria-label="插入图片或 PDF"`
- **AND** Tab 可聚焦
- **AND** `focus-visible:ring-2 ring-brand-500` 焦点环

#### Scenario: 缩略图可访问

- **GIVEN** 1 个 image 附件
- **WHEN** 渲染缩略图
- **THEN** `<img>` 有 `alt={attachment.filename}`

#### Scenario: dialog 原生 a11y

- **GIVEN** ImageLightbox 打开
- **WHEN** dialog 渲染
- **THEN** 焦点自动移到 dialog 内（浏览器原生）
- **AND** Esc 关闭（浏览器原生）
- **AND** 关闭后焦点回到触发元素（浏览器原生）

### Requirement: 状态隔离与持久化

系统 MUST 让附件数据持久化到 IndexedDB，且不影响其他页面。

#### Scenario: 刷新后附件仍在

- **GIVEN** 用户上传 2 张图
- **WHEN** 刷新 `/blogs/:id/edit` 页面
- **THEN** `useAttachmentsForBlog(blogId)` 从 Dexie 重新查询
- **AND** 2 张图仍显示

#### Scenario: 跨页面同步

- **GIVEN** 编辑页上传 1 张图
- **WHEN** 切到详情页
- **THEN** 详情页 useAttachmentsForBlog 自动更新
- **AND** 1 张图在详情页显

#### Scenario: 不影响其他博客

- **GIVEN** 博客 A 有 2 附件，博客 B 有 1 附件
- **WHEN** 渲染博客 A 的附件
- **THEN** 仅显 A 的 2 附件（blogId 索引过滤）

---

## Cross-Reference

- 现有 `Attachment` 模型：`src/types/domain.ts`（blogId / filename / mimeType / size / blob）
- 现有 `attachments` 表：`src/db/schema.ts`（&id, blogId, uploadedAt 索引）
- 现有 `useAttachmentStore`：`src/stores/attachmentsStore.ts`（uploadAttachment / deleteAttachment / getObjectURL / revokeAll）
- 现有 `useAttachmentsForBlog`：`src/stores/hooks/useAttachmentsForBlog.ts`（live query）
- 现有 `<RichEditor>`：`src/features/blog/components/RichEditor.tsx`（add-blog-tiptap-editor 落地）
- 现有 `<EditorToolbar>`：`src/features/blog/components/EditorToolbar.tsx`（11 按钮 + onAttachClick 增量）
- BlogEdit 集成点：`src/pages/blogs/BlogEdit.tsx`
- BlogDetail 集成点：`src/pages/blogs/BlogDetail.tsx`
- AppLayout 集成点：`src/components/layout/AppLayout.tsx`（mount ToastViewport）
