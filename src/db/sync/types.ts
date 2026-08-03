/**
 * 云同步数据层类型与默认值（M1 数据层就绪）
 *
 * 本文件只定义「数据结构」，不含任何同步逻辑（同步逻辑在 M3）。
 * 这些类型全部落在本地 IndexedDB，绝不作为同步载荷上传（见 design.md §2.1：
 * 同步配置 / 变更队列 / 墓碑均为设备私有或仅传播删除意图，不含令牌与密钥）。
 */

import type { ID, ISODate } from '@/types/domain';

/**
 * 参与同步的业务表名。
 *
 * 与 `schema.ts` 中声明的 store 名一一对应。新增可同步表时务必同步更新此处，
 * 否则 `deleteRecord` / 变更队列 / 墓碑的 `table` 字段会漏掉该表。
 */
export type SyncableTableName =
  | 'plans'
  | 'items'
  | 'blogs'
  | 'tags'
  | 'attachments'
  | 'frameworks'
  | 'blogTemplates'
  | 'aiCallLogs'
  | 'collections'
  | 'collectionItems'
  | 'chatSessions'
  | 'folders'
  | 'skillFolders'
  | 'skills'
  | 'aiPlans';

/**
 * 墓碑：一条「某记录已于某时刻被删除」的声明。
 *
 * 让删除可跨设备传播，并防止对端「复活」已被删除的记录（见 design.md §4.5）。
 */
export interface Tombstone {
  /** ULID 主键（每条墓碑唯一，便于幂等写入与清理）。 */
  id: ID;
  /** 被删记录所在表名。 */
  table: SyncableTableName;
  /** 被删记录的主键。 */
  recordId: ID;
  /** 删除发生的时间。合并时用于与记录 updatedAt 比较（见 spec.md Requirement: 删除传播）。 */
  deletedAt: ISODate;
}

/** 变更操作类型。 */
export type ChangeOp = 'put' | 'delete';

/**
 * 变更队列项：本地尚未推送成功的变更。
 *
 * 仅记录「哪张表的哪条记录发生了什么操作」，不内联记录体——
 * 推送时 M3 直接读本地当前记录（本地是事实来源），从而天然支持
 * 离线合批与跨会话保留（见 design.md §4.1 / spec.md Requirement: 离线容错）。
 */
export interface ChangeQueueItem {
  /** ULID 主键。 */
  id: ID;
  /** 发生变更的表。 */
  table: SyncableTableName;
  /** 发生变更的记录主键。 */
  recordId: ID;
  /** 操作：put = 新增/更新；delete = 删除。 */
  op: ChangeOp;
  /** 入队时间，用于排序与状态展示（"N 项待同步"）。 */
  enqueuedAt: ISODate;
}

/** 远端存储适配器类型（M2 实现，此处先落地配置键）。 */
export type SyncStorageType = 'github';

/**
 * 同步配置。
 *
 * 全部存放于本地 `meta` 表（键 `sync:config`），设备私有、不参与同步。
 * 所有阈值（轮询间隔、防抖、附件上限、墓碑保留期）均为可配置项而非写死常量
 * （见 design.md §5：「设计取向」）。
 */
export interface SyncConfig {
  /** 是否启用云同步。 */
  enabled: boolean;
  /** 远端存储适配器种类。 */
  storageType: SyncStorageType;
  /** 仓库标识 `用户名/仓库名`。 */
  repo: string;
  /** 数据所在分支。 */
  branch: string;
  /** 访问令牌（仅存本地，绝不进同步载荷）。 */
  token: string;
  /** 远端存放同步数据的目录。 */
  directory: string;
  /** 后台定时拉取间隔（毫秒）。 */
  pollIntervalMs: number;
  /** 推送防抖窗口（毫秒）。 */
  pushDebounceMs: number;
  /** 上次成功同步的远端版本标识（系统维护）。 */
  cursor: string | null;
  /** 最近一次成功同步的时刻（系统维护）。 */
  lastSyncAt: string | null;
  /** 单附件体积上限（字节），超出则跳过该附件（spec.md Requirement: 附件同步）。 */
  attachmentMaxBytes: number;
  /** 墓碑保留期（毫秒），超过则视为已被所有设备消费可清理（design.md §4.5）。 */
  tombstoneRetentionMs: number;
}

/** 同步配置默认值（无配置时使用的初始状态）。 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enabled: false,
  storageType: 'github',
  repo: '',
  branch: 'main',
  token: '',
  directory: 'sync',
  pollIntervalMs: 30_000,
  pushDebounceMs: 2_000,
  cursor: null,
  lastSyncAt: null,
  // 10 MB
  attachmentMaxBytes: 10 * 1024 * 1024,
  // 30 天
  tombstoneRetentionMs: 30 * 24 * 60 * 60 * 1000,
};

/** 同步配置在 `meta` 表中的键。 */
export const SYNC_CONFIG_KEY = 'sync:config';

// ========== M3 同步引擎类型（供 M4 UI 使用） ==========

/**
 * 同步状态机（见 design.md §6）。
 *
 * 界面对用户只暴露这几种状态，M4 据此渲染对应 UI。
 */
export type SyncStatus =
  /** 同步开关关闭。 */
  | 'disabled'
  /** 已启用但配置不完整（repo/token 为空）。 */
  | 'pending_config'
  /** 正在推送或拉取。 */
  | 'syncing'
  /** 最近一次同步成功。 */
  | 'synced'
  /** 网络不可用，队列非空。 */
  | 'offline_pending'
  /** 出错（令牌失效 / 权限不足 / 仓库不存在 / 解析失败）。 */
  | 'error';

/**
 * 同步引擎事件回调接口（供 M4 UI 订阅）。
 *
 * 同步引擎不直接 import React/Zustand，通过回调通知上层。
 * 同步过程不阻塞界面交互（见 design.md §9 / AC-9）。
 */
export interface SyncEventCallbacks {
  /** 同步完成时触发，携带发生变化的表名列表。 */
  onSyncComplete?(changedTables: SyncableTableName[]): void;
  /** 同步出错时触发。 */
  onSyncError?(error: unknown): void;
  /** 同步状态变化时触发。 */
  onSyncStatusChange?(status: SyncStatus): void;
  /** 待同步项计数变化时触发。 */
  onPendingCountChange?(count: number): void;
}

/** 合并操作结果。 */
export interface MergeResult {
  /** 需要写入本地的记录（按表分组）。 */
  localWrites: Partial<Record<SyncableTableName, Record<string, unknown>[]>>;
  /** 需要在本地删除的记录 ID（按表分组）。 */
  localDeletions: Partial<Record<SyncableTableName, string[]>>;
  /** 合并后本地有哪些新增/变更需要推回远端（变更项列表）。 */
  pushChanges: Array<{ table: SyncableTableName; recordId: ID }>;
}

/** 同步执行结果（供引擎内部使用与回调）。 */
export interface SyncResult {
  /** 成功同步的远端版本标识。 */
  cursor: string;
  /** 同步时间。 */
  syncedAt: ISODate;
  /** 发生变化的表名列表。 */
  changedTables: SyncableTableName[];
}
