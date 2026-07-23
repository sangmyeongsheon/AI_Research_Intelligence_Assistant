import type {
  Conflict,
  MissingField,
  Protocol,
  ProtocolSnapshot,
  ProtocolStep,
  ProtocolVersion,
  SourceArtifact,
  SourceRef,
} from "@/src/types";
import {
  escapeMarkdownBlock,
  escapeMarkdownInline,
  escapeMarkdownTableCell,
} from "./sanitize";

export const AI_DRAFT_WARNING =
  "미해결 충돌과 누락 항목을 확인하고 연구실의 검토 절차에 따라 상태를 확정하세요.";

export interface ProtocolExportBundle {
  protocol: Protocol;
  snapshot: ProtocolSnapshot;
  versions?: readonly ProtocolVersion[];
  sources?: readonly SourceArtifact[];
}

export interface MarkdownExportOptions {
  generatedAt?: string | Date;
  includeResolvedConflicts?: boolean;
  includeDismissedMissingFields?: boolean;
  includeVersionHistory?: boolean;
}

const STATUS_LABELS: Record<Protocol["status"], string> = {
  draft: "작성 중",
  review: "검토 중",
  approved: "확정",
  archived: "보관됨",
};

const RELIABILITY_LABELS: Record<SourceArtifact["reliability"], string> = {
  current: "현재 사용 중",
  legacy: "오래된 자료",
  reference: "참고 자료",
  unknown: "알 수 없음",
};

const SEVERITY_LABELS = {
  low: "낮음",
  medium: "보통",
  high: "높음",
} as const;

function safeInline(value: unknown, fallback = "자료에서 확인되지 않음"): string {
  const text = String(value ?? "").trim();
  return escapeMarkdownInline(text || fallback);
}

function safeBlock(value: unknown, fallback = "자료에서 확인되지 않음"): string {
  const text = String(value ?? "").trim();
  return escapeMarkdownBlock(text || fallback);
}

function formatDate(value: string | Date | undefined): string {
  if (!value) return "자료에서 확인되지 않음";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return safeInline(value);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(date);
}

function formatTimestamp(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;
  return hours > 0
    ? [hours, minutes, remainder]
        .map((part) => String(part).padStart(2, "0"))
        .join(":")
    : [minutes, remainder]
        .map((part) => String(part).padStart(2, "0"))
        .join(":");
}

function renderSourceRef(ref: SourceRef): string {
  const location: string[] = [];
  if (ref.pageNumber !== undefined) location.push(`${ref.pageNumber}페이지`);
  if (ref.timestampStart !== undefined) {
    const end =
      ref.timestampEnd !== undefined
        ? `–${formatTimestamp(ref.timestampEnd)}`
        : "";
    location.push(`${formatTimestamp(ref.timestampStart)}${end}`);
  }
  const author = ref.author?.trim() || "작성자 미상";
  const confidence = Number.isFinite(ref.confidence)
    ? `신뢰도 ${Math.round(ref.confidence * 100)}%`
    : undefined;
  return [
    safeInline(ref.sourceLabel),
    safeInline(author),
    location.length ? safeInline(location.join(", ")) : undefined,
    confidence,
  ]
    .filter(Boolean)
    .join(" · ");
}

function renderSourceRefs(refs: readonly SourceRef[], indent = ""): string[] {
  if (refs.length === 0) return [`${indent}- 자료에서 확인되지 않음`];
  return refs.flatMap((ref) => {
    const lines = [`${indent}- ${renderSourceRef(ref)}`];
    if (ref.quote?.trim()) {
      lines.push(`${indent}  - 원문: “${safeInline(ref.quote)}”`);
    }
    return lines;
  });
}

function renderStringList(
  values: readonly string[],
  emptyText = "자료에서 확인되지 않음",
  indent = "",
): string[] {
  if (values.length === 0) return [`${indent}- ${emptyText}`];
  return values.map((value) => `${indent}- ${safeBlock(value)}`);
}

function renderStep(step: ProtocolStep): string[] {
  const lines = [
    `### ${step.order}. ${safeInline(step.title, "제목 미정")}`,
    "",
    safeBlock(step.action),
    "",
    `- **소요 시간:** ${safeInline(step.duration)}`,
    `- **신뢰도:** ${Math.round(Math.max(0, Math.min(1, step.confidence)) * 100)}%`,
    `- **연구자 확인:** ${step.unresolved ? "필요" : "현재 표시된 미해결 항목 없음"}`,
    "",
    "#### 준비물",
    "",
    ...renderStringList(step.materials),
    "",
    "#### 장비",
    "",
    ...renderStringList(step.equipment),
    "",
    "#### 핵심 조건",
    "",
  ];

  if (step.parameters.length === 0) {
    lines.push("- 자료에서 확인되지 않음");
  } else {
    for (const parameter of step.parameters) {
      const normalized =
        parameter.normalizedValue !== undefined &&
        parameter.normalizedValue !== null
          ? ` (정규화: ${parameter.normalizedValue}${parameter.normalizedUnit ? ` ${safeInline(parameter.normalizedUnit, "")}` : ""})`
          : "";
      lines.push(
        `- **${safeInline(parameter.name)}:** ${safeInline(parameter.value)}${parameter.unit ? ` ${safeInline(parameter.unit, "")}` : ""}${normalized}`,
      );
      lines.push(...renderSourceRefs(parameter.sourceRefs, "  "));
    }
  }

  lines.push(
    "",
    "#### Checkpoint",
    "",
    ...renderStringList(step.checkpoints),
    "",
    "#### 선배의 팁 및 암묵지",
    "",
    ...renderStringList(step.implicitTips),
    "",
    "#### 자주 발생하는 실수",
    "",
    ...renderStringList(step.commonMistakes),
    "",
    "#### Troubleshooting",
    "",
    ...renderStringList(step.troubleshooting),
    "",
    "#### 성공 및 실패 판정 기준",
    "",
    ...renderStringList(step.successCriteria),
    "",
    "#### 단계 출처",
    "",
    ...renderSourceRefs(step.sourceRefs),
    "",
  );

  return lines;
}

function renderConflict(conflict: Conflict): string[] {
  const lines = [
    `#### ${safeInline(conflict.field)} · 위험도 ${SEVERITY_LABELS[conflict.severity]}`,
    "",
    safeBlock(conflict.description),
    "",
    `- **상태:** ${conflict.status === "resolved" ? "해결됨" : "미해결"}`,
  ];
  for (const option of conflict.options) {
    lines.push(
      `- **선택지 — ${safeInline(option.label)}:** ${safeInline(option.value)}`,
    );
    lines.push(...renderSourceRefs(option.sourceRefs, "  "));
  }
  if (conflict.selectedResolution) {
    lines.push(
      `- **선택한 해결값:** ${safeInline(conflict.selectedResolution)}`,
    );
  }
  if (conflict.resolutionNote) {
    lines.push(`- **해결 메모:** ${safeInline(conflict.resolutionNote)}`);
  }
  lines.push("- **관련 출처:**", ...renderSourceRefs(conflict.sourceRefs, "  "), "");
  return lines;
}

function renderMissingField(field: MissingField): string[] {
  const status =
    field.status === "answered"
      ? "답변됨"
      : field.status === "dismissed"
        ? "제외됨"
        : "연구자 확인 필요";
  const lines = [
    `- **${safeInline(field.field)}** · 위험도 ${SEVERITY_LABELS[field.severity]} · ${status}`,
    `  - 누락 이유: ${safeInline(field.reason)}`,
    `  - 확인 질문: ${safeInline(field.question)}`,
  ];
  if (field.userAnswer) {
    lines.push(`  - 연구자 답변: ${safeInline(field.userAnswer)}`);
  }
  return lines;
}

function renderSource(source: SourceArtifact): string[] {
  const date = source.sourceDate
    ? formatDate(source.sourceDate).replace(/\s\d{2}:\d{2}$/, "")
    : "작성일 미상";
  const author = source.author?.trim() || "작성자 미상";
  const description = source.notes?.trim()
    ? ` — ${safeInline(source.notes)}`
    : "";
  return [
    `- **${safeInline(source.displayName || source.fileName)}**`,
    `  - 파일: ${safeInline(source.fileName)} · 작성자: ${safeInline(author)} · 작성일: ${safeInline(date)} · 성격: ${RELIABILITY_LABELS[source.reliability]}${description}`,
  ];
}

function renderVersion(version: ProtocolVersion): string[] {
  return [
    `- **v${version.versionNumber}** · ${safeInline(version.changeSummary)} · ${safeInline(version.changedBy)} · ${safeInline(formatDate(version.createdAt))}`,
  ];
}

/**
 * 저장·공유 가능한 Markdown 문서를 만듭니다. 모든 외부 입력은 Markdown 문법으로
 * 실행되지 않도록 이스케이프하고, 누락값은 명시적으로 표시합니다.
 */
export function buildProtocolMarkdown(
  bundle: ProtocolExportBundle,
  options: MarkdownExportOptions = {},
): string {
  const { protocol, snapshot } = bundle;
  const sources = bundle.sources ?? snapshot.sources;
  const conflicts = snapshot.conflicts.filter(
    (conflict) =>
      options.includeResolvedConflicts !== false ||
      conflict.status === "unresolved",
  );
  const missingFields = snapshot.missingFields.filter(
    (field) =>
      options.includeDismissedMissingFields !== false ||
      field.status !== "dismissed",
  );
  const generatedAt = options.generatedAt ?? new Date();
  const troubleshooting = snapshot.steps.flatMap((step) =>
    step.troubleshooting.map((item) => ({
      step: `${step.order}. ${step.title}`,
      item,
    })),
  );

  const lines: string[] = [
    `# ${safeInline(protocol.title || snapshot.experiment.title, "제목 미정")}`,
    "",
    `> **중요:** ${escapeMarkdownInline(AI_DRAFT_WARNING)}`,
    "",
    "| 항목 | 내용 |",
    "| --- | --- |",
    `| 상태 | ${escapeMarkdownTableCell(STATUS_LABELS[protocol.status])} |`,
    `| 버전 | v${protocol.currentVersion} |`,
    `| 분류 | ${escapeMarkdownTableCell(protocol.category)} |`,
    `| 작성자 | ${escapeMarkdownTableCell(protocol.createdBy || "작성자 미상")} |`,
    `| 태그 | ${escapeMarkdownTableCell(protocol.tags.length ? protocol.tags.join(", ") : "없음")} |`,
    `| 내보낸 시각 | ${escapeMarkdownTableCell(formatDate(generatedAt))} |`,
    "",
    "## 실험 목적",
    "",
    safeBlock(protocol.objective || snapshot.experiment.objective),
    "",
    "## 적용 범위",
    "",
    safeBlock(snapshot.experiment.scope),
    "",
    ...(snapshot.researcherAnswers?.length
      ? [
          "## 연구자 확인 답변",
          "",
          ...snapshot.researcherAnswers.flatMap((item) => [
            `- **Q. ${safeInline(item.question)}**`,
            `  - A. ${safeInline(item.answer)}`,
            `  - ${safeInline(item.answeredBy)} · ${safeInline(formatDate(item.answeredAt))}`,
          ]),
          "",
        ]
      : []),
    "## 준비물 및 시약",
    "",
    ...renderStringList(snapshot.materials),
    "",
    "## 장비 및 설정값",
    "",
    ...renderStringList(snapshot.equipment),
    "",
    "## 실험 전 준비사항",
    "",
    ...renderStringList(snapshot.preflightChecklist ?? []),
    "",
    "## 단계별 실험 절차",
    "",
    ...(snapshot.steps.length
      ? snapshot.steps.flatMap(renderStep)
      : ["- 자료에서 확인되지 않음", ""]),
    "## 전체 Troubleshooting 실행 가이드",
    "",
    ...(troubleshooting.length
      ? troubleshooting.map(
          ({ step, item }) => `- **${safeInline(step)}:** ${safeBlock(item)}`,
        )
      : ["- 자료에서 확인되지 않음"]),
    "",
    `## 충돌 항목 (${conflicts.length}건)`,
    "",
    ...(conflicts.length
      ? conflicts.flatMap(renderConflict)
      : ["- 표시할 충돌이 없습니다.", ""]),
    `## 누락 항목 (${missingFields.length}건)`,
    "",
    ...(missingFields.length
      ? missingFields.flatMap(renderMissingField)
      : ["- 표시할 누락 항목이 없습니다."]),
    "",
    "## 전체 경고",
    "",
    ...renderStringList(snapshot.overallWarnings, "현재 추가 경고가 없습니다."),
    "",
    `## 원본 출처 (${sources.length}건)`,
    "",
    ...(sources.length
      ? sources.flatMap(renderSource)
      : ["- 원본 출처가 연결되지 않았습니다."]),
    "",
  ];

  if (options.includeVersionHistory !== false) {
    const versions = [...(bundle.versions ?? [])].sort(
      (a, b) => b.versionNumber - a.versionNumber,
    );
    lines.push(
      "## 변경 이력",
      "",
      ...(versions.length
        ? versions.flatMap(renderVersion)
        : [
            `- **v${protocol.currentVersion}** · 현재 버전 · ${safeInline(protocol.createdBy || "작성자 미상")} · ${safeInline(formatDate(protocol.updatedAt))}`,
          ]),
      "",
    );
  }

  lines.push("---", "", escapeMarkdownInline(AI_DRAFT_WARNING), "");
  return lines.join("\n");
}

export const createProtocolMarkdown = buildProtocolMarkdown;
export const protocolToMarkdown = buildProtocolMarkdown;
