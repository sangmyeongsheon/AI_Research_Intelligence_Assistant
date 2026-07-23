"use client";

let geminiApiKey = "";

export function setSessionGeminiApiKey(value: string): void {
  geminiApiKey = value.trim();
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
