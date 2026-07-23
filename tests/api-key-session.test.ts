import { afterEach, describe, expect, it, vi } from "vitest";

describe("Gemini API key session", () => {
  afterEach(async () => {
    const session = await import("@/src/lib/ai/api-key-session");
    session.clearSessionGeminiApiKey();
    vi.resetModules();
  });

  it("keeps a normalized key in module memory", async () => {
    const session = await import("@/src/lib/ai/api-key-session");

    session.setSessionGeminiApiKey("  user-gemini-key  ");

    expect(session.getSessionGeminiApiKey()).toBe("user-gemini-key");
    expect(session.hasSessionGeminiApiKey()).toBe(true);
  });

  it("loses the key when the page module reloads", async () => {
    const firstPage = await import("@/src/lib/ai/api-key-session");
    firstPage.setSessionGeminiApiKey("temporary-key");
    expect(firstPage.hasSessionGeminiApiKey()).toBe(true);

    vi.resetModules();

    const reloadedPage = await import("@/src/lib/ai/api-key-session");
    expect(reloadedPage.getSessionGeminiApiKey()).toBe("");
    expect(reloadedPage.hasSessionGeminiApiKey()).toBe(false);
  });

  it("rejects control characters and oversized values", async () => {
    const session = await import("@/src/lib/ai/api-key-session");

    expect(() => session.setSessionGeminiApiKey("bad\nkey")).toThrow(
      "Gemini API 키 형식을 확인해 주세요.",
    );
    expect(() => session.setSessionGeminiApiKey("x".repeat(513))).toThrow(
      "Gemini API 키 형식을 확인해 주세요.",
    );
  });
});
