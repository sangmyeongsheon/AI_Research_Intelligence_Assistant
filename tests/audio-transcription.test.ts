import { describe, expect, it } from "vitest";

import { createExtractionBatches } from "@/src/lib/ai/providers/gemini-provider";
import {
  formatTimedTranscript,
  resolveSourceReviewText,
} from "@/src/lib/files/transcript";
import type {
  ExtractSourceInput,
} from "@/src/lib/ai/provider";
import type { SourceArtifact, SourceExcerpt } from "@/src/types";

function artifact(
  id: string,
  type: SourceArtifact["type"],
): SourceArtifact {
  const now = "2026-07-24T00:00:00.000Z";
  return {
    id,
    protocolId: "protocol-audio-test",
    type,
    fileName: `${id}.${type === "audio" ? "m4a" : "txt"}`,
    displayName: id,
    mimeType: type === "audio" ? "audio/mp4" : "text/plain",
    size: 1024,
    author: "테스트",
    sourceDate: now,
    reliability: "current",
    notes: "",
    extractedText: "",
    processingStatus: "pending",
    createdAt: now,
  };
}

describe("음성 전체 전사 처리", () => {
  it("음성은 다른 자료와 같은 Gemini 추출 배치에 넣지 않는다", () => {
    const inputs: ExtractSourceInput[] = [
      { artifact: artifact("audio", "audio"), base64Data: "AA==" },
      { artifact: artifact("note", "text"), text: "메모" },
      { artifact: artifact("pdf", "pdf"), base64Data: "AA==" },
      { artifact: artifact("image", "image"), base64Data: "AA==" },
    ];

    const batches = createExtractionBatches(inputs);

    expect(batches.map((batch) => batch.map((item) => item.artifact.id))).toEqual([
      ["audio"],
      ["note", "pdf"],
      ["image"],
    ]);
  });

  it("타임스탬프 segment를 읽기 좋은 전체 전사본으로 만든다", () => {
    expect(
      formatTimedTranscript([
        {
          startSeconds: 62,
          endSeconds: 70,
          speaker: "연구자",
          text: "PVDF는 절대 말리지 않습니다.",
        },
        {
          startSeconds: 5,
          endSeconds: 10,
          speaker: "",
          text: "이번 배치는 신경세포 라이세이트를 사용했습니다.",
        },
      ]),
    ).toBe(
      "[00:05-00:10] 이번 배치는 신경세포 라이세이트를 사용했습니다.\n[01:02-01:10] 연구자: PVDF는 절대 말리지 않습니다.",
    );
  });

  it("자료 검토 화면은 evidence 발췌보다 전체 전사본을 우선한다", () => {
    const source = {
      ...artifact("audio", "audio"),
      extractedText:
        "[00:00-00:10] 첫 문장\n[00:10-00:20] 중간 문장\n[04:00-04:09] 마지막 문장",
    };
    const excerpts: SourceExcerpt[] = [
      {
        id: "excerpt-1",
        sourceArtifactId: source.id,
        excerptText: "첫 문장",
        confidence: 0.9,
        author: source.author,
        sourceDate: source.sourceDate,
      },
    ];

    const displayed = resolveSourceReviewText(source, excerpts);

    expect(displayed).toContain("중간 문장");
    expect(displayed).toContain("마지막 문장");
    expect(displayed).not.toBe("첫 문장");
  });
});
