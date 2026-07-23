const CONTROL_CHARACTERS_EXCEPT_LAYOUT =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

export function sanitizePlainText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARACTERS_EXCEPT_LAYOUT, "")
    .replace(/\u0000/g, "");
}

export function escapeHtml(value: unknown): string {
  return sanitizePlainText(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

/**
 * 외부 입력을 HTML 조각으로 해석하지 않고 항상 텍스트로 만듭니다.
 */
export const sanitizeHtml = escapeHtml;

export function escapeMarkdownInline(value: unknown): string {
  return sanitizePlainText(value)
    .replace(/\s*\n+\s*/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\\/g, "\\\\")
    .replace(/([`*_{}\[\]()#+!|~])/g, "\\$1");
}

export function escapeMarkdownBlock(value: unknown): string {
  return sanitizePlainText(value)
    .split("\n")
    .map((line) => escapeMarkdownInline(line))
    .join("\n");
}

export function escapeMarkdownTableCell(value: unknown): string {
  return escapeMarkdownInline(value);
}

/**
 * Markdown 렌더러에서 원본 HTML이나 링크 문법이 실행되지 않도록 이스케이프합니다.
 */
export const sanitizeMarkdown = escapeMarkdownBlock;

export function safeExternalUrl(value: unknown): string | undefined {
  const raw = sanitizePlainText(value).trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}
