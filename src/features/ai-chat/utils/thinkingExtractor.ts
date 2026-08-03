/**
 * thinkingExtractor.ts · D2
 *
 * 从 AI 返回的文本（流式或完整字符串）中剥离 <thinking>/</thinking> 与 <think>/</think> 标签，
 * 把标签内内容归为 thinking，标签外内容归为正文。
 *
 * 关键行为：
 * - 大小写不敏感
 * - 支持多段 thinking，用 `\n\n` 拼接
 * - 跨 chunk 半截标签保护：尾部可能是 `<thin` 时暂扣，等待下一个 delta
 * - 未闭合时 flush 把剩余全部计入 thinking，正文不受污染
 */

export interface SplitThinkingResult {
  content: string;
  thinking: string;
  unclosed: boolean;
}

export interface ThinkingStream {
  push(delta: string): { content: string; thinking: string };
  flush(): { content: string; thinking: string; unclosed: boolean };
}

const OPEN_TAGS = ['<thinking>', '<think>'] as const;
const CLOSE_TAGS = ['</thinking>', '</think>'] as const;

const MAX_OPEN_LEN = Math.max(...OPEN_TAGS.map((t) => t.length));
const MAX_CLOSE_LEN = Math.max(...CLOSE_TAGS.map((t) => t.length));

interface TagMatch {
  index: number;
  tag: string;
  isOpen: boolean;
}

function findNextTag(text: string): TagMatch | null {
  let best: TagMatch | null = null;
  for (const tag of OPEN_TAGS) {
    const idx = indexOfIgnoreCase(text, tag);
    if (idx !== -1 && (best === null || idx < best.index)) {
      best = { index: idx, tag, isOpen: true };
    }
  }
  for (const tag of CLOSE_TAGS) {
    const idx = indexOfIgnoreCase(text, tag);
    if (idx !== -1 && (best === null || idx < best.index)) {
      best = { index: idx, tag, isOpen: false };
    }
  }
  return best;
}

function indexOfIgnoreCase(haystack: string, needle: string): number {
  const lowerHay = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  return lowerHay.indexOf(lowerNeedle);
}

/**
 * 把 buffer 拆成「可安全输出」和「需留到下个 chunk 的潜在标签前缀」两部分。
 * 从末尾往前找 '<'，如果它落在 maxLookback 范围内，则 '<' 之前安全输出，'<' 及之后暂扣。
 */
function safeSplit(buffer: string, maxLookback: number): { safe: string; pending: string } {
  if (buffer.length === 0) return { safe: '', pending: '' };
  const startAt = Math.max(0, buffer.length - maxLookback);
  const lastLt = buffer.lastIndexOf('<', buffer.length - 1);
  if (lastLt >= startAt) {
    return { safe: buffer.slice(0, lastLt), pending: buffer.slice(lastLt) };
  }
  return { safe: buffer, pending: '' };
}

function joinThinking(parts: string[]): string {
  return parts.join('\n\n');
}

export function createThinkingStream(): ThinkingStream {
  let buffer = '';
  let inThinking = false;
  const contentParts: string[] = [];
  const thinkingParts: string[] = [];
  let lastContentLen = 0;
  let lastThinkingLen = 0;

  function currentTotals() {
    return {
      content: contentParts.join(''),
      thinking: joinThinking(thinkingParts),
    };
  }

  return {
    push(delta: string): { content: string; thinking: string } {
      buffer += delta;
      let guard = 0;

      while (buffer.length > 0 && guard++ < 100_000) {
        const tag = findNextTag(buffer);

        if (!tag) {
          const maxLookback = inThinking ? MAX_CLOSE_LEN : MAX_OPEN_LEN;
          const { safe, pending } = safeSplit(buffer, maxLookback);
          if (safe.length === 0 && pending.length > 0) {
            // 整个 buffer 都是潜在前缀，留待下次
            break;
          }
          if (inThinking) {
            if (safe.length > 0) thinkingParts.push(safe);
          } else {
            if (safe.length > 0) contentParts.push(safe);
          }
          buffer = pending;
          if (pending.length > 0) break;
          continue;
        }

        if (inThinking) {
          if (tag.isOpen) {
            // thinking 内部又出现开标签：当作 thinking 文本的一部分，跳过该标签字面量
            if (tag.index > 0) {
              thinkingParts.push(buffer.slice(0, tag.index));
            }
            buffer = buffer.slice(tag.index + tag.tag.length);
            continue;
          }
          // 找到闭标签
          if (tag.index > 0) {
            thinkingParts.push(buffer.slice(0, tag.index));
          }
          buffer = buffer.slice(tag.index + tag.tag.length);
          inThinking = false;
          continue;
        }

        // content 模式
        if (tag.isOpen) {
          if (tag.index > 0) {
            contentParts.push(buffer.slice(0, tag.index));
          }
          buffer = buffer.slice(tag.index + tag.tag.length);
          inThinking = true;
          continue;
        }
        // content 模式遇到孤立闭标签：当作普通文本保留
        contentParts.push(buffer.slice(0, tag.index + tag.tag.length));
        buffer = buffer.slice(tag.index + tag.tag.length);
      }

      const totals = currentTotals();
      const contentDelta = totals.content.slice(lastContentLen);
      const thinkingDelta = totals.thinking.slice(lastThinkingLen);
      lastContentLen = totals.content.length;
      lastThinkingLen = totals.thinking.length;

      return { content: contentDelta, thinking: thinkingDelta };
    },

    flush(): { content: string; thinking: string; unclosed: boolean } {
      let unclosed = false;

      if (inThinking) {
        unclosed = true;
        if (buffer.length > 0) {
          thinkingParts.push(buffer);
          buffer = '';
        }
      } else {
        if (buffer.length > 0) {
          contentParts.push(buffer);
          buffer = '';
        }
      }

      return {
        content: contentParts.join(''),
        thinking: joinThinking(thinkingParts),
        unclosed,
      };
    },
  };
}

export function splitThinking(raw: string): SplitThinkingResult {
  const stream = createThinkingStream();
  stream.push(raw);
  return stream.flush();
}

/** 合并来自原生 reasoning 通道与正文标签提取的 thinking，避免重复。 */
export function mergeThinking(a: string, b: string): string {
  const ta = a.trim();
  const tb = b.trim();
  if (ta.length === 0) return tb;
  if (tb.length === 0) return ta;
  if (ta.includes(tb)) return ta;
  if (tb.includes(ta)) return tb;
  return `${ta}\n\n${tb}`;
}
