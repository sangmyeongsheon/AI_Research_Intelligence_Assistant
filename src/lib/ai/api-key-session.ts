"use client";

const MAX_API_KEY_LENGTH = 512;

let geminiApiKey = "";

export function normalizeGeminiApiKey(
  value: string | null | undefined,
): string {
  const normalized = value?.trim() ?? "";
  if (!normalized) return "";
  if (
    normalized.length > MAX_API_KEY_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new Error("Gemini API 키 형식을 확인해 주세요.");
  }
  return normalized;
}

export function setSessionGeminiApiKey(value: string): void {
  geminiApiKey = normalizeGeminiApiKey(value);
}

export function getSessionGeminiApiKey(): string {
  return geminiApiKey;
}

export function hasSessionGeminiApiKey(): boolean {
  return geminiApiKey.length > 0;
}

export function clearSessionGeminiApiKey(): void {
  geminiApiKey = "";
}
