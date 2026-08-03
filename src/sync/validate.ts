/**
 * M2 存储通道 — 敏感数据剔除校验
 *
 * 防御性校验：确认 AI 密钥 / 访问令牌 / 同步配置本身不进快照载荷。
 * 理论上它们不在 SyncableTableName 内（因此不会进入快照），
 * 但加一层双重校验防止未来误操作或代码错误引入。
 */

/** 需阻断的敏感字段名关键词（全小写匹配）。 */
const SENSITIVE_KEYWORDS = ['token', 'key', 'secret', 'password', 'credential'];

/**
 * 检查单个字段名是否包含敏感关键词。
 */
function isSensitiveField(fieldName: string): boolean {
  const lower = fieldName.toLowerCase();
  return SENSITIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * 防御性校验：遍历快照载荷的所有字段，若发现字段名含敏感关键词则抛错。
 *
 * @param payload 即将上传的快照 SnapshotPayload（或其 tables 部分）
 * @throws Error 当发现敏感字段时
 */
export function validateNoSecrets(
  tables: Partial<Record<string, Record<string, unknown>[]>>,
): void {
  for (const [tableName, records] of Object.entries(tables)) {
    if (!records || !Array.isArray(records)) continue;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (!record || typeof record !== 'object') continue;

      for (const fieldName of Object.keys(record)) {
        if (isSensitiveField(fieldName)) {
          throw new Error(
            `安全校验失败：表 "${tableName}" 第 ${i + 1} 条记录包含敏感字段 "${fieldName}"，` +
            '不允许进入同步载荷',
          );
        }
      }
    }
  }
}

/** @deprecated 保留向后兼容的别名。请直接使用 validateNoSecrets。 */
export const validatePayload = validateNoSecrets;
