/**
 * importSkills.ts · F2+F5 导入入口（Skills.tsx 调用）
 *
 * 流程：扩展名分发 → 解析（JSON 保留 __folders 映射 / MD 走 frontmatter 解析）
 *      → 逐条 validateSkillRecord 校验（原子拦截，坏数据整文件中止）
 *      → folder 按名 get-or-create → fromExportSkill 归一化 → bulkPut 一次性写。
 *
 * 红线：不修改 fromExportSkill / SkillRepo；校验放在归一化之前。
 */

import { validateSkillRecord } from './validateSkill';
import { parseSkillMarkdown, DEFAULT_FOLDER_NAME } from './parseSkillMarkdown';
import { skillRepo, skillFolderRepo, ROOT_SKILL_FOLDER_ID, fromExportSkill } from '@/db/repos';
import type { ID } from '@/types/domain';

export interface ImportSkillResult {
  imported: number;
  errors: string[];
}

export type PrepareImportResult =
  | { status: 'ready'; raws: Record<string, unknown>[]; fileName: string }
  | { status: 'needs-repair'; text: string; errorMessage: string; fileName: string }
  | { status: 'fatal'; errorMessage: string; fileName: string };

/** 按文件扩展名分发并导入；任一记录非法即抛 Error（message 含「第 n 条」定位）。 */
export async function importSkillFile(file: File): Promise<ImportSkillResult> {
  const prepared = await prepareSkillImport(file);

  if (prepared.status === 'fatal') {
    throw new Error(prepared.errorMessage);
  }
  if (prepared.status === 'needs-repair') {
    throw new Error(prepared.errorMessage);
  }

  return importSkillRaws(prepared.raws);
}

/**
 * 探测式导入准备：先尝试解析/校验，若 .md 格式不合法则返回 needs-repair，
 * 由 UI 决定是否调 AI 修复；JSON 语法错 / 扩展名不支持返回 fatal。
 */
export async function prepareSkillImport(file: File): Promise<PrepareImportResult> {
  const fileName = file.name;
  const lowerName = fileName.toLowerCase();

  if (!lowerName.endsWith('.json') && !lowerName.endsWith('.md') && !lowerName.endsWith('.markdown')) {
    return { status: 'fatal', errorMessage: `不支持的文件格式：${file.name}（仅支持 .json / .md）`, fileName };
  }

  const text = await file.text();

  if (lowerName.endsWith('.json')) {
    try {
      const { raws } = await parseJsonRaws(text);
      const check = checkSkillRaws(raws);
      if (!check.ok) {
        // JSON 坏数据目前不进入 AI 修复（结构太难让模型猜），按 fatal 处理
        return { status: 'fatal', errorMessage: check.message, fileName };
      }
      return { status: 'ready', raws: check.raws, fileName };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'JSON 解析失败';
      return { status: 'fatal', errorMessage: msg, fileName };
    }
  }

  // Markdown 路径
  const check = checkSkillMarkdown(text);
  if (!check.ok) {
    return { status: 'needs-repair', text, errorMessage: check.message, fileName };
  }
  return { status: 'ready', raws: check.raws, fileName };
}

/** 纯校验：不抛错。ok=true 时返回可导入的 raws。 */
export function checkSkillMarkdown(text: string): { ok: true; raws: Record<string, unknown>[] } | { ok: false; message: string } {
  const { records, errors } = parseSkillMarkdown(text);
  if (errors.length > 0) {
    return { ok: false, message: errors.map((e) => `第 ${e.index + 1} 条：${e.message}`).join('；') };
  }
  const raws = records.map((r) => r.raw);
  return checkSkillRaws(raws);
}

function checkSkillRaws(raws: unknown[]): { ok: true; raws: Record<string, unknown>[] } | { ok: false; message: string } {
  if (raws.length === 0) {
    return { ok: false, message: '文件中没有可识别的技能记录' };
  }
  for (let i = 0; i < raws.length; i++) {
    const raw = raws[i];
    if (raw === null || typeof raw !== 'object') {
      return { ok: false, message: `第 ${i + 1} 条：记录不是对象` };
    }
    const record = raw as Record<string, unknown>;
    if (typeof record.name !== 'string' || record.name.trim() === '') {
      return { ok: false, message: `第 ${i + 1} 条：name 缺失（必须为非空字符串）` };
    }
    const check = validateSkillRecord(record);
    if (!check.ok) {
      return { ok: false, message: `第 ${i + 1} 条：${check.message}` };
    }
  }
  return { ok: true, raws: raws as Record<string, unknown>[] };
}

/** 把已校验的 raw 记录写入数据库（folder get-or-create + fromExportSkill + bulkPut）。 */
export async function importSkillRaws(raws: Record<string, unknown>[]): Promise<ImportSkillResult> {
  const folderResolver = await makeFolderResolver();

  const list = [];
  for (const record of raws) {
    const folderId = await resolveFolderId(record, new Map<ID, ID>(), folderResolver);
    const skill = fromExportSkill({ ...record, folderId }, new Map<ID, ID>());
    list.push(skill);
  }

  await skillRepo.bulkPut(list);
  return { imported: list.length, errors: [] };
}

/* ---------------- 内部实现 ---------------- */

type FolderResolver = (name: string | undefined) => Promise<ID>;

async function makeFolderResolver(): Promise<FolderResolver> {
  const byName = new Map<string, ID>();
  const existing = await skillFolderRepo.list();
  for (const f of existing) byName.set(f.name, f.id);

  return async (name) => {
    const n = (name ?? '').trim();
    if (!n || n === DEFAULT_FOLDER_NAME) return ROOT_SKILL_FOLDER_ID;
    const hit = byName.get(n);
    if (hit) return hit;
    const created = await skillFolderRepo.create(n);
    byName.set(n, created.id);
    return created.id;
  };
}

/** folder 解析优先级：JSON 的 __folders 映射（folderId 旧 id） > MD 的 folder 名 > 根。 */
async function resolveFolderId(
  record: Record<string, unknown>,
  folderIdMap: Map<ID, ID>,
  resolver: FolderResolver,
): Promise<ID> {
  if (typeof record.folderId === 'string') {
    const mapped = folderIdMap.get(record.folderId);
    if (mapped) return mapped;
  }
  return resolver(record.folder as string | undefined);
}

/** JSON：数组归一化 + 提取 __folders 建文件夹映射（保持 v1.3 行为）。 */
async function parseJsonRaws(text: string): Promise<{ raws: unknown[]; folderIdMap: Map<ID, ID> }> {
  const parsed: unknown = JSON.parse(text);
  const arr = Array.isArray(parsed) ? (parsed as unknown[]) : [parsed];
  const folderIdMap = new Map<ID, ID>();

  if (!Array.isArray(parsed) && parsed !== null && typeof parsed === 'object') {
    const folders = (parsed as Record<string, unknown>).__folders;
    if (Array.isArray(folders)) {
      const resolver = await makeFolderResolver();
      for (const f of folders as unknown[]) {
        if (f === null || typeof f !== 'object') continue;
        const rec = f as Record<string, unknown>;
        if (typeof rec.id !== 'string') continue;
        const name = typeof rec.name === 'string' && rec.name.trim() !== '' ? rec.name : '导入文件夹';
        const folderId = await resolver(name);
        folderIdMap.set(rec.id, folderId);
      }
    }
  }

  return { raws: arr, folderIdMap };
}

/**
 * 从已修正的 markdown 文本直接解析并导入（供 AI 修复后用）。
 * 不经过 File 探测，纯文本 → 校验 → 写库。校验失败抛错。
 */
export async function importSkillMarkdownText(text: string): Promise<ImportSkillResult> {
  const check = checkSkillMarkdown(text);
  if (!check.ok) {
    throw new Error(check.message);
  }
  return importSkillRaws(check.raws);
}

/**
 * 就地修复一条原样收藏（status:'raw'）的技能：解析修复后的 markdown，
 * 把字段写回该技能记录并把 status 置为 'ready'，清空 rawText。
 * 不新建记录，避免重复导入。校验失败抛错（由调用方 UI 捕获展示）。
 */
export async function repairSkillById(id: ID, fixedText: string): Promise<ImportSkillResult> {
  const check = checkSkillMarkdown(fixedText);
  if (!check.ok) {
    throw new Error(check.message);
  }
  const normalized = fromExportSkill(check.raws[0], new Map<ID, ID>());
  await skillRepo.update(id, {
    name: normalized.name,
    type: normalized.type,
    description: normalized.description,
    promptTemplate: normalized.promptTemplate,
    params: normalized.params,
    status: 'ready',
    rawText: undefined,
  });
  return { imported: 1, errors: [] };
}
