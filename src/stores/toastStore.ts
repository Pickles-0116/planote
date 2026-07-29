/**
 * toastStore - 极简 toast 队列（add-blog-attachment 增量 + v1.1 batch-import 扩展）
 *
 * 用途：附件上传 / 删除 / 校验失败 / 批量导入进度 等全局通知。
 * 队列容量：3 条（超出排队等待）。
 * 自动消失：3 秒后自动 dismiss（setTimeout）。
 *
 * 设计：
 * - 独立 store：toast 是高频短期状态，独立可避免其他 UI 状态订阅被频繁通知
 * - 不持久化：toast 是瞬时态
 * - `push` 返回 toast id（供高级场景手动 dismiss）
 * - v1.1 扩展：支持 `details: Array<{ message, action? }>` 用于批量导入等场景
 *   每条 detail 可带一个内联 action（按钮），点击触发回调
 *
 * 渲染：`<ToastViewport />`（src/shared/components/ToastViewport.tsx）订阅并渲染。
 */

import { create } from 'zustand';

/** toast 类别（决定颜色与图标）。 */
export type ToastKind = 'error' | 'info' | 'success';

/** 内联操作（如「重试」）。 */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

/** 单条 detail。 */
export interface ToastDetail {
  message: string;
  action?: ToastAction;
}

/** 单条 toast。 */
export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  /** 创建时间戳（毫秒）。用于按需做相对时间显示。 */
  createdAt: number;
  /**
   * 可选详情列表（v1.1）：
   * - error toast 显示「失败原因 + 重试按钮」等多行信息
   * - 每行 detail 可带一个内联 action
   * - 渲染层在主 message 下方堆叠 details
   */
  details?: ToastDetail[];
  /** 详情展开时整体不自动消失（默认 false：仍 3s 自动 dismiss）。 */
  sticky?: boolean;
}

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 3000;

interface ToastStoreState {
  toasts: Toast[];
  /** 简单 push（兼容旧 API）。 */
  push: (kind: ToastKind, message: string) => string;
  /** 完整 push：可传 details / sticky。 */
  pushFull: (toast: Omit<Toast, 'id' | 'createdAt'>) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let toastCounter = 0;
const nextId = (): string => {
  toastCounter += 1;
  return `t_${Date.now().toString(36)}_${toastCounter.toString(36)}`;
};

export const useToastStore = create<ToastStoreState>((set, get) => ({
  toasts: [],

  push: (kind, message) => {
    return get().pushFull({ kind, message });
  },

  pushFull: ({ kind, message, details, sticky }) => {
    const id = nextId();
    const toast: Toast = {
      id,
      kind,
      message,
      createdAt: Date.now(),
      details,
      sticky,
    };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    // 自动 dismiss（sticky 跳过）
    if (!sticky && typeof window !== 'undefined') {
      window.setTimeout(() => {
        const { toasts } = get();
        if (toasts.some((t) => t.id === id)) {
          get().dismiss(id);
        }
      }, AUTO_DISMISS_MS);
    }
    return id;
  },

  dismiss: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  clear: () => set({ toasts: [] }),
}));

/** 队列最大同时显示条数（导出供 ToastViewport 渲染上限参考）。 */
export const TOAST_MAX_VISIBLE = MAX_VISIBLE;
