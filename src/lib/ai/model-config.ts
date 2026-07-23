export interface GeminiModelConfig {
  apiKey: string;
  primaryModel: string;
  fastModel: string;
}

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

export function createGeminiModelConfig(apiKey: string): GeminiModelConfig {
  return {
    apiKey: apiKey.trim(),
    primaryModel: DEFAULT_GEMINI_MODEL,
    fastModel: DEFAULT_GEMINI_MODEL,
  };
}
