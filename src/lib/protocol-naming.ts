import type { Protocol } from "@/src/types";

const TITLE_SUFFIX_PATTERN = /(?:\s*·\s*)?(\d{8})-(\d{3})$/;
const LEGACY_DEFAULT_TITLES = new Set(["새 프로토콜", "프로토콜"]);
const DEFAULT_TITLE_PREFIX = "실험 프로토콜";

function kstDateCode(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const safeDate = Number.isNaN(date.valueOf()) ? new Date() : date;
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  }).formatToParts(safeDate);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}${part("month")}${part("day")}`;
}

function normalizeTitleBase(value: string): string {
  const withoutSuffix = value.replace(TITLE_SUFFIX_PATTERN, "").trim();
  const normalized = withoutSuffix
    .replace(/\s+/g, " ")
    .replace(/[·\-:]+$/, "")
    .trim();
  if (!normalized || LEGACY_DEFAULT_TITLES.has(normalized)) {
    return DEFAULT_TITLE_PREFIX;
  }
  return normalized.slice(0, 72).trim();
}

export function protocolTitleSuffix(title: string): string | undefined {
  const match = TITLE_SUFFIX_PATTERN.exec(title.trim());
  return match ? `${match[1]}-${match[2]}` : undefined;
}

export function createDefaultProtocolTitle(
  protocols: readonly Protocol[],
  now: string | Date = new Date(),
): string {
  const dateCode = kstDateCode(now);
  const highestSequence = protocols.reduce((highest, protocol) => {
    const suffix = protocolTitleSuffix(protocol.title);
    if (!suffix?.startsWith(`${dateCode}-`)) return highest;
    const sequence = Number(suffix.slice(-3));
    return Number.isFinite(sequence) ? Math.max(highest, sequence) : highest;
  }, 0);
  return `${DEFAULT_TITLE_PREFIX} · ${dateCode}-${String(highestSequence + 1).padStart(3, "0")}`;
}

export function createGeneratedProtocolTitle(
  generatedTitle: string,
  draftTitle: string,
): string {
  const suffix =
    protocolTitleSuffix(draftTitle) ??
    `${kstDateCode(new Date())}-001`;
  return `${normalizeTitleBase(generatedTitle)} · ${suffix}`;
}

export function isLegacyDefaultProtocolTitle(title: string): boolean {
  return LEGACY_DEFAULT_TITLES.has(title.trim());
}
