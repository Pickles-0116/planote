/**
 * 云同步数据层统一入口（M1 数据层就绪）
 *
 * 导出墓碑、变更队列、同步配置、统一删除入口及其类型。
 * 业务代码（Repository / Store / UI）应通过本入口访问同步数据层，
 * 且同步层始终处于主链路之「侧」，失败不影响本地读写。
 */

export * from './types';
export * from './tombstones';
export * from './changeQueue';
export * from './config';
export * from './deleteRecord';
export * from './capture';
