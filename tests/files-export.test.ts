import { describe, expect, it } from "vitest";
import type {
  Protocol,
  ProtocolSnapshot,
  ProtocolVersion,
  SourceArtifact,
  SourceExcerpt,
  SourceRef,
} from "@/src/types";
import {
  MEBIBYTE,
  SUPPORTED_FILE_DEFINITIONS,
  checkSourceRefIntegrity,
  sanitizeFileName,
  validateUploadFile,
} from "@/src/lib/files";
import {
  AI_DRAFT_WARNING,
  buildPrintableProtocolHtml,
  buildProtocolMarkdown,
  escapeHtml,
  escapeMarkdownInline,
} from "@/src/lib/export";
import { normalizeGeminiMimeType } from "@/src/lib/ai/providers/gemini-provider";

describe("업로드 파일 검증", () => {
  const supportedCases = [
    ["note.txt", "text/plain"],
    ["note.md", "text/markdown"],
    ["paper.pdf", "application/pdf"],
    ["image.jpg", "image/jpeg"],
    ["image.jpeg", "image/jpeg"],
    ["image.png", "image/png"],
    ["recording.mp3", "audio/mpeg"],
    ["recording.wav", "audio/wav"],
    ["recording.m4a", "audio/mp4"],
    ["recording.aac", "audio/aac"],
    ["recording.ogg", "audio/ogg"],
    ["recording.flac", "audio/flac"],
  ] as const;

  it.each(supportedCases)("%s 형식을 허용한다", (name, type) => {
    const result = validateUploadFile({ name, type, size: 1024 });
    expect(result.ok).toBe(true);
  });

  it("브라우저가 MIME을 주지 않으면 안전한 확장자로 판별한다", () => {
    const result = validateUploadFile({
      name: "실험 기록.MD",
      type: "",
      size: 32,
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        extension: "md",
        kind: "markdown",
        mimeType: "text/markdown",
      },
    });
  });

  it("브라우저의 M4A MIME 별칭을 Gemini 호환 형식으로 정규화한다", () => {
    const result = validateUploadFile({
      name: "transfer-handover.m4a",
      type: "audio/x-m4a",
      size: 1024,
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        kind: "audio",
        mimeType: "audio/mp4",
      },
    });
    expect(normalizeGeminiMimeType("audio/x-m4a")).toBe("audio/mp4");
  });

  it("지원하지 않는 확장자를 구체적인 오류로 거부한다", () => {
    const result = validateUploadFile({
      name: "protocol.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 100,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNSUPPORTED_FILE_TYPE");
      expect(result.error.recovery).toContain("TXT");
      expect(result.error.dataPreserved).toBe(true);
    }
  });

  it("빈 파일을 거부한다", () => {
    const result = validateUploadFile({
      name: "empty.txt",
      type: "text/plain",
      size: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("EMPTY_FILE");
  });

  it("확장자와 MIME이 다르면 거부한다", () => {
    const result = validateUploadFile({
      name: "renamed.pdf",
      type: "image/png",
      size: 100,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("MIME_EXTENSION_MISMATCH");
  });

  it("형식별 최대 용량을 초과하면 제한값을 제공한다", () => {
    const result = validateUploadFile({
      name: "large.pdf",
      type: "application/pdf",
      size: 25 * MEBIBYTE + 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FILE_TOO_LARGE");
      expect(result.error.maxSizeBytes).toBe(
        SUPPORTED_FILE_DEFINITIONS.pdf.maxSizeBytes,
      );
    }
  });
});

describe("파일명 정제", () => {
  it("경로 조작과 OS 예약 문자를 제거하고 한글과 확장자를 보존한다", () => {
    expect(
      sanitizeFileName(String.raw`..\..\보고서: 최종?.PDF`),
    ).toBe("보고서_ 최종_.PDF");
  });

  it("Windows 예약 파일명을 무해하게 만든다", () => {
    expect(sanitizeFileName("../../CON.txt")).toBe("_CON.txt");
  });

  it("빈 이름에 안전한 기본값을 사용한다", () => {
    expect(sanitizeFileName("...\u0000")).toBe("자료");
  });

  it("긴 이름도 확장자를 유지한다", () => {
    const sanitized = sanitizeFileName(`${"가".repeat(200)}.md`, {
      maxLength: 40,
    });
    expect(sanitized).toHaveLength(40);
    expect(sanitized.endsWith(".md")).toBe(true);
  });
});

describe("HTML/Markdown 이스케이프", () => {
  it("HTML 태그를 실행 가능한 형태로 남기지 않는다", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("Markdown과 raw HTML 문법을 이스케이프한다", () => {
    const escaped = escapeMarkdownInline("**위험** <img src=x>");
    expect(escaped).not.toContain("**위험**");
    expect(escaped).not.toContain("<img");
    expect(escaped).toContain("&lt;img");
  });
});

describe("출처 참조 무결성", () => {
  const artifact = {
    id: "artifact-a",
    protocolId: "protocol-a",
    type: "pdf",
    fileName: "source.pdf",
    displayName: "기존 프로토콜",
    mimeType: "application/pdf",
    size: 100,
    author: "연구실 관리자",
    sourceDate: "2026-07-01",
    reliability: "reference",
    notes: "",
    localBlobKey: "blob-a",
    extractedText: "Transfer",
    processingStatus: "ready",
    createdAt: "2026-07-01T00:00:00.000Z",
  } as SourceArtifact;
  const excerpt = {
    id: "excerpt-a",
    sourceArtifactId: "artifact-a",
    excerptText: "100 V, 60 min",
    pageNumber: 2,
    confidence: 0.95,
    author: "연구실 관리자",
    sourceDate: "2026-07-01",
  } as SourceExcerpt;
  const validRef: SourceRef = {
    artifactId: "artifact-a",
    excerptId: "excerpt-a",
    sourceLabel: "기존 프로토콜",
    author: "연구실 관리자",
    pageNumber: 2,
    quote: "100 V, 60 min",
    confidence: 0.95,
  };

  it("유효한 artifact/excerpt 연결을 통과시킨다", () => {
    const result = checkSourceRefIntegrity(
      [validRef],
      [artifact],
      [excerpt],
    );
    expect(result.valid).toBe(true);
    expect(result.validRefs).toEqual([validRef]);
  });

  it("존재하지 않는 artifact와 excerpt를 함께 보고한다", () => {
    const result = checkSourceRefIntegrity(
      [
        {
          ...validRef,
          artifactId: "missing-artifact",
          excerptId: "missing-excerpt",
        },
      ],
      [artifact],
      [excerpt],
    );
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "MISSING_ARTIFACT",
      "MISSING_EXCERPT",
    ]);
  });

  it("excerpt가 다른 artifact를 가리키면 거부한다", () => {
    const result = checkSourceRefIntegrity(
      [{ ...validRef, artifactId: "artifact-b" }],
      [{ ...artifact, id: "artifact-b" }],
      [excerpt],
    );
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "EXCERPT_ARTIFACT_MISMATCH" }),
      ]),
    );
  });
});

describe("프로토콜 Markdown 내보내기", () => {
  const sourceRef: SourceRef = {
    artifactId: "source-1",
    sourceLabel: "기존 PDF",
    author: "Neural Systems Lab 관리자",
    pageNumber: 2,
    quote: "Transfer 100 V, 60 min",
    confidence: 0.94,
  };
  const source = {
    id: "source-1",
    protocolId: "protocol-1",
    type: "pdf",
    fileName: "western-blot.pdf",
    displayName: "기존 PDF 프로토콜",
    mimeType: "application/pdf",
    size: 1024,
    author: "Neural Systems Lab 관리자",
    sourceDate: "2024-09-12",
    reliability: "reference",
    notes: "페이지별 추출",
    localBlobKey: "blob-source-1",
    extractedText: "Transfer 100 V, 60 min",
    processingStatus: "ready",
    createdAt: "2026-07-23T00:00:00.000Z",
  } as SourceArtifact;
  const protocol = {
    id: "protocol-1",
    labId: "lab-1",
    title: "Western blot <script>",
    objective: "단백질 발현 확인",
    category: "experiment",
    status: "review",
    currentVersion: 2,
    tags: ["Western blot"],
    createdBy: "이수빈",
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
  } as Protocol;
  const snapshot = {
    experiment: {
      title: protocol.title,
      objective: protocol.objective,
      scope: "PVDF membrane을 사용하는 Western blot transfer 단계",
      category: "experiment",
    },
    materials: ["PVDF membrane"],
    equipment: ["Transfer 장비 — 모델 미확인"],
    preflightChecklist: [
      "Transfer 장비 설정값을 확인한다.",
      "PVDF membrane이 마르지 않도록 준비한다.",
    ],
    steps: [
      {
        id: "step-1",
        order: 1,
        title: "Transfer",
        action: "Membrane으로 단백질을 transfer한다.",
        materials: ["PVDF membrane"],
        equipment: ["Transfer 장비"],
        parameters: [
          {
            name: "Voltage",
            value: "100",
            unit: "V",
            normalizedValue: 100,
            normalizedUnit: "V",
            sourceRefs: [sourceRef],
          },
        ],
        duration: "60 min",
        checkpoints: ["Membrane 방향 확인"],
        implicitTips: ["Membrane을 말리지 않는다."],
        commonMistakes: ["방향을 반대로 조립"],
        troubleshooting: ["밴드가 약하면 transfer 여부부터 확인"],
        troubleshootingItems: [
          {
            problem: "밴드가 약함",
            cause: "Transfer 불충분 가능성",
            action: "항체 농도 변경 전에 transfer 여부를 확인한다.",
            sourceRefs: [sourceRef],
          },
        ],
        successCriteria: ["Membrane transfer가 균일하게 확인됨"],
        sourceRefs: [sourceRef],
        confidence: 0.9,
        unresolved: true,
      },
    ],
    resultAcceptance: {
      pass: ["Membrane transfer가 균일하게 확인됨"],
      repeat: ["Transfer 불균일이 확인되면 재실험 검토"],
      discard: [],
    },
    conflicts: [
      {
        id: "conflict-1",
        field: "Transfer 조건",
        stepId: "step-1",
        description: "100 V/60 min과 90 V/90 min이 충돌합니다.",
        options: [
          {
            id: "option-1",
            label: "기존 PDF",
            value: "100 V, 60 min",
            sourceRefs: [sourceRef],
          },
        ],
        sourceRefs: [sourceRef],
        severity: "high",
        status: "unresolved",
      },
    ],
    missingFields: [
      {
        id: "missing-1",
        field: "target protein",
        stepId: "step-1",
        reason: "자료에 target 정보가 없음",
        question: "이번 실험의 target protein은 무엇인가요?",
        severity: "high",
        status: "unresolved",
      },
    ],
    sources: [source],
    overallWarnings: ["미해결 충돌을 검토하세요."],
  } as ProtocolSnapshot;
  const versions = [
    {
      id: "version-2",
      protocolId: protocol.id,
      versionNumber: 2,
      snapshot,
      changeSummary: "충돌 검토 내용 추가",
      changedBy: "이수빈",
      createdAt: "2026-07-23T00:00:00.000Z",
    },
  ] as ProtocolVersion[];

  it("절차·팁·troubleshooting·출처·충돌·누락·버전·경고를 모두 포함한다", () => {
    const markdown = buildProtocolMarkdown(
      { protocol, snapshot, versions },
      { generatedAt: "2026-07-23T12:00:00.000Z" },
    );

    expect(markdown).toContain("## 단계별 실험 절차");
    expect(markdown).toContain("선배의 팁 및 암묵지");
    expect(markdown).toContain("밴드가 약하면 transfer 여부부터 확인");
    expect(markdown).toContain("기존 PDF 프로토콜");
    expect(markdown).toContain("100 V/60 min과 90 V/90 min이 충돌합니다");
    expect(markdown).toContain("이번 실험의 target protein은 무엇인가요");
    expect(markdown).toContain("v2");
    expect(markdown).toContain("미해결 충돌을 검토하세요");
    expect(markdown).toContain(AI_DRAFT_WARNING);
  });

  it("프로토콜의 raw HTML을 그대로 내보내지 않는다", () => {
    const markdown = buildProtocolMarkdown(
      { protocol, snapshot, versions },
      { generatedAt: "2026-07-23T12:00:00.000Z" },
    );
    expect(markdown).not.toContain("<script>");
    expect(markdown).toContain("&lt;script&gt;");
  });

  it("PDF 인쇄용 문서를 표준 프로토콜 구조로 만든다", () => {
    const html = buildPrintableProtocolHtml(
      { protocol, snapshot, versions },
      {
        generatedAt: "2026-07-23T12:00:00.000Z",
        includeVersionHistory: true,
      },
    );

    expect(html).toContain("STANDARD OPERATING PROTOCOL");
    expect(html).toContain("프로토콜 요약");
    expect(html).toContain("목적 및 적용 범위");
    expect(html).toContain("실험 전 준비사항");
    expect(html).toContain("단계별 실험 절차");
    expect(html).toContain("문제 또는 관찰");
    expect(html).toContain("Transfer 불충분 가능성");
    expect(html).toContain("결과 판정 기준");
    expect(html).toContain("문서 변경 이력");
    expect(html).toContain("검토 및 승인");
    expect(html).toContain("class=\"condition-table\"");
    expect(html).toContain("@page { size: A4");
    expect(html).not.toContain("<script>");
  });
});
