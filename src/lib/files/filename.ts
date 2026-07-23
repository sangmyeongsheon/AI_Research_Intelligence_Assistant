const WINDOWS_RESERVED_NAME =
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;
const WINDOWS_UNSAFE_CHARACTERS = /[<>:"/\\|?*]/g;

export interface SanitizeFileNameOptions {
  fallbackName?: string;
  maxLength?: number;
}

function splitExtension(fileName: string): { stem: string; extension: string } {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === fileName.length - 1) {
    return { stem: fileName, extension: "" };
  }
  return {
    stem: fileName.slice(0, lastDot),
    extension: fileName.slice(lastDot),
  };
}

/**
 * 경로 조각과 OS 예약 문자를 제거하되 한글 파일명과 확장자는 보존합니다.
 */
export function sanitizeFileName(
  input: string,
  options: SanitizeFileNameOptions = {},
): string {
  const maxLength = Math.max(16, options.maxLength ?? 120);
  const fallback = (options.fallbackName ?? "자료").normalize("NFC");
  const pathTail = String(input ?? "").split(/[\\/]/).at(-1) ?? "";
  let normalized = pathTail
    .normalize("NFC")
    .replace(CONTROL_CHARACTERS, "")
    .replace(WINDOWS_UNSAFE_CHARACTERS, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, "");

  if (!normalized) normalized = fallback;
  if (WINDOWS_RESERVED_NAME.test(normalized)) normalized = `_${normalized}`;

  if (normalized.length <= maxLength) return normalized;

  const { stem, extension } = splitExtension(normalized);
  const safeExtension = extension.slice(0, Math.min(extension.length, 16));
  const availableStemLength = Math.max(1, maxLength - safeExtension.length);
  const shortenedStem =
    stem.slice(0, availableStemLength).replace(/[.\s]+$/g, "") || fallback;
  return `${shortenedStem}${safeExtension}`.slice(0, maxLength);
}

export function getFileExtension(fileName: string): string | undefined {
  const sanitized = sanitizeFileName(fileName);
  const lastDot = sanitized.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === sanitized.length - 1) return undefined;
  return sanitized.slice(lastDot + 1).toLowerCase();
}

