/**
 * AttachmentUploader - 隐藏 file input 触发器（add-blog-attachment 增量）
 *
 * 用法：
 * - 父组件 `ref` 拿到 handle，调 `uploaderRef.current?.trigger()`
 * - 工具栏「图片」按钮点击 → 调 trigger → 弹出原生文件选择器
 * - 用户选完文件后 → 调 onFile(file) → 父组件走 useAttachments.add
 *
 * 设计：
 * - forwardRef + useImperativeHandle 暴露 trigger()
 * - 隐藏 input（className="hidden"），视觉无副作用
 * - onFile 后清空 input.value（允许选同一文件再次触发）
 */

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ChangeEvent,
} from 'react';

export interface AttachmentUploaderHandle {
  trigger: () => void;
}

interface Props {
  /** 文件选中后回调（onFile 内部走 useAttachments.add）。 */
  onFile: (file: File) => void | Promise<void>;
  /** accept 属性；默认 "image/*,.pdf"。 */
  accept?: string;
}

const AttachmentUploader = forwardRef<AttachmentUploaderHandle, Props>(
  function AttachmentUploader({ onFile, accept = 'image/*,.pdf' }, ref) {
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(
      ref,
      () => ({
        trigger: () => {
          inputRef.current?.click();
        },
      }),
      [],
    );

    const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
      const file = e.target.files?.[0];
      // 清空 value（允许选同一文件再次触发）
      e.target.value = '';
      if (!file) return;
      void onFile(file);
    };

    return (
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={false}
        onChange={handleChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
    );
  },
);

export default AttachmentUploader;
