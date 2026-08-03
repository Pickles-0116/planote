/**
 * 同步模块通用工具函数。
 *
 * 快照 JSON 含中文（计划/博客标题等），但 `btoa`/`atob` 只支持 Latin1
 * 字符集，直接使用会抛 `InvalidCharacterError` 或产生乱码。
 * 这里统一封装 UTF-8 安全的 base64 编解码：先经 TextEncoder/TextDecoder
 * 转字节，再与二进制串互转。
 */

/**
 * UTF-8 字符串 → base64。
 *
 * btoa 只支持 Latin1，故先用 TextEncoder 将字符串编码为 UTF-8 字节，
 * 再逐字节拼成 Latin1 二进制串交给 btoa。
 */
export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * base64 → UTF-8 字符串。
 *
 * atob 得到的是 Latin1 二进制串，需先还原为 Uint8Array，
 * 再经 TextDecoder 解码为 UTF-8 字符串，中文/emoji 才不乱码。
 */
export function base64ToUtf8(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}
