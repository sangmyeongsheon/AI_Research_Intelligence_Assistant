import { describe, expect, it } from "vitest";
import type { Protocol } from "@/src/types";
import {
  createDefaultProtocolTitle,
  createGeneratedProtocolTitle,
  protocolTitleSuffix,
} from "@/src/lib/protocol-naming";

function protocol(title: string): Protocol {
  return {
    id: `protocol-${title}`,
    labId: "lab-1",
    title,
    objective: "",
    category: "experiment",
    status: "draft",
    currentVersion: 1,
    tags: [],
    createdBy: "현재 사용자",
    createdAt: "2026-07-24T00:00:00.000Z",
    updatedAt: "2026-07-24T00:00:00.000Z",
  };
}

describe("프로토콜 기본 이름 규칙", () => {
  it("한국 시간 날짜와 일련번호로 중복되지 않는 이름을 만든다", () => {
    const existing = [
      protocol("실험 프로토콜 · 20260724-001"),
      protocol("Western blot · 20260724-002"),
      protocol("다른 날짜 · 20260723-009"),
    ];
    expect(
      createDefaultProtocolTitle(existing, "2026-07-24T03:00:00.000Z"),
    ).toBe("실험 프로토콜 · 20260724-003");
  });

  it("생성된 제목에 초안의 고유 번호를 유지한다", () => {
    expect(
      createGeneratedProtocolTitle(
        "Western Blot Membrane Transfer",
        "실험 프로토콜 · 20260724-004",
      ),
    ).toBe("Western Blot Membrane Transfer · 20260724-004");
  });

  it("제목에서 규칙에 맞는 고유 번호를 읽는다", () => {
    expect(protocolTitleSuffix("막 전이 프로토콜 · 20260724-027")).toBe(
      "20260724-027",
    );
  });
});
