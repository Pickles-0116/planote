/**
 * ID 工具（ULID）
 *
 * 选用 ULID（Universally Unique Lexicographically Sortable Identifier）：
 * - 26 字符 Crockford base32 编码（去掉 I / L / O / U 避免视觉歧义）
 * - 前 10 字符为毫秒时间戳，字符串字典序 = 时间序
 * - 16 字符随机部分，128 位熵
 *
 * 详见 design.md §4。
 */

import { ulid } from 'ulid';
import type { ID } from '@/types/domain';

/**
 * 生成新的 ULID 字符串作为实体主键。
 *
 * @returns 26 字符 ULID（如 `01HXXXXXXXXXXXXXXXXXXXXXX`）
 */
export const newId = (): ID => ulid();

/**
 * 校验字符串是否符合 ULID 26 字符 Crockford base32 格式。
 *
 * 双重保证：
 * - 编译期：`type ID = string` 保证类型
 * - 运行时：`isValidId` 校验数据合法性（用于解析外部数据 / URL 参数）
 *
 * @param s 待校验字符串
 * @returns 是否为合法 ULID
 */
export const isValidId = (s: string): boolean =>
  typeof s === 'string' && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(s);
