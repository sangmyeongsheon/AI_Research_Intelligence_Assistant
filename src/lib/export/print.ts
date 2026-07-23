import { sanitizeFileName } from "../files/filename";
import { ExportProcessingError } from "./errors";
import {
  type MarkdownExportOptions,
  type ProtocolExportBundle,
} from "./markdown";
import type {
  Conflict,
  MissingField,
  Protocol,
  ProtocolStep,
  SourceArtifact,
  SourceRef,
} from "@/src/types";
import { escapeHtml, sanitizePlainText } from "./sanitize";

export interface PrintableDocumentOptions {
  title?: string;
  locale?: string;
}

export interface PrintWindowOptions {
  windowName?: string;
  autoPrint?: boolean;
}

function restoreEscapedMarkdown(value: string): string {
  return value.replace(/\\([\\`*_[\]{}()#+.!|>~<>&-])/g, "$1");
}

function renderInline(value: string): string {
  let safe = escapeHtml(value);
  safe = safe.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  safe = safe.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  return restoreEscapedMarkdown(safe);
}

function splitTableRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let escaped = false;
  for (const character of line.trim().replace(/^\||\|$/g, "")) {
    if (escaped) {
      current += `\\${character}`;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  return cells;
}

function isTableDivider(line: string): boolean {
  return /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

/**
 * 제한된 Markdown 문법만 처리하는 인쇄 전용 렌더러입니다.
 * 원본 HTML과 URL을 해석하지 않으므로 외부 입력이 실행될 수 없습니다.
 */
export function markdownToSafePrintHtml(markdown: string): string {
  const lines = sanitizePlainText(markdown).split("\n");
  const html: string[] = [];
  let index = 0;
  let listType: "ul" | "ol" | undefined;

  const closeList = () => {
    if (listType) html.push(`</${listType}>`);
    listType = undefined;
  };

  while (index < lines.length) {
    const line = lines[index];
    const nextLine = lines[index + 1];

    if (
      line.trim().startsWith("|") &&
      nextLine !== undefined &&
      isTableDivider(nextLine)
    ) {
      closeList();
      const headers = splitTableRow(line);
      html.push(
        "<table><thead><tr>",
        ...headers.map((cell) => `<th>${renderInline(cell)}</th>`),
        "</tr></thead><tbody>",
      );
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        html.push(
          "<tr>",
          ...splitTableRow(lines[index]).map(
            (cell) => `<td>${renderInline(cell)}</td>`,
          ),
          "</tr>",
        );
        index += 1;
      }
      html.push("</tbody></table>");
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    const unordered = /^\s*-\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+\.\s+(.+)$/.exec(line);
    const quote = /^\s*>\s?(.*)$/.exec(line);

    if (!line.trim()) {
      closeList();
    } else if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
    } else if (/^\s*---+\s*$/.test(line)) {
      closeList();
      html.push("<hr>");
    } else if (quote) {
      closeList();
      html.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
    } else if (unordered || ordered) {
      const nextListType = unordered ? "ul" : "ol";
      if (listType !== nextListType) {
        closeList();
        listType = nextListType;
        html.push(`<${nextListType}>`);
      }
      html.push(`<li>${renderInline((unordered ?? ordered)?.[1] ?? "")}</li>`);
    } else {
      closeList();
      html.push(`<p>${renderInline(line)}</p>`);
    }
    index += 1;
  }

  closeList();
  return html.join("\n");
}

export function createPrintableHtmlFromMarkdown(
  markdown: string,
  options: PrintableDocumentOptions = {},
): string {
  const title = options.title?.trim() || "LabTrace 프로토콜";
  const locale = options.locale?.trim() || "ko";
  const safeTitle = escapeHtml(title);
  const body = markdownToSafePrintHtml(markdown);
  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <style>
    :root { color-scheme: light; font-family: Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", "Segoe UI", sans-serif; color: #151a24; }
    * { box-sizing: border-box; }
    body { max-width: 860px; margin: 0 auto; padding: 32px 36px 56px; font-size: 13px; line-height: 1.65; }
    h1 { color: #0b1739; font-size: 26px; border-bottom: 2px solid #315ceb; padding-bottom: 10px; }
    h2 { color: #0b1739; font-size: 19px; margin-top: 30px; border-bottom: 1px solid #d9dee8; padding-bottom: 6px; break-after: avoid; }
    h3 { font-size: 16px; margin-top: 24px; break-after: avoid; }
    h4 { font-size: 13px; margin: 18px 0 5px; break-after: avoid; }
    p { margin: 6px 0; }
    ul, ol { margin: 5px 0 12px; padding-left: 24px; }
    li { margin: 3px 0; }
    blockquote { margin: 16px 0; padding: 10px 14px; border-left: 4px solid #b7791f; background: #fffaf0; color: #5f370e; }
    table { width: 100%; border-collapse: collapse; margin: 14px 0 20px; }
    th, td { border: 1px solid #d9dee8; padding: 7px 9px; text-align: left; vertical-align: top; }
    th { width: 22%; background: #f6f7f9; color: #0b1739; }
    code { font-family: ui-monospace, "Cascadia Code", monospace; background: #f1f3f7; padding: 1px 3px; }
    hr { border: 0; border-top: 1px solid #d9dee8; margin: 28px 0; }
    @page { size: A4; margin: 15mm; }
    @media print {
      body { max-width: none; padding: 0; font-size: 10pt; }
      h1, h2, h3, h4, blockquote, table { break-inside: avoid; }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

const PRINT_STATUS_LABELS: Record<Protocol["status"], string> = {
  draft: "작성 중",
  review: "검토 중",
  approved: "확정",
  archived: "보관됨",
};

const PRINT_RELIABILITY_LABELS: Record<SourceArtifact["reliability"], string> = {
  current: "현재 사용 중",
  legacy: "오래된 자료",
  reference: "참고 자료",
  unknown: "알 수 없음",
};

const PRINT_SEVERITY_LABELS = {
  low: "낮음",
  medium: "보통",
  high: "높음",
} as const;

function printText(value: unknown, fallback = "자료에서 확인되지 않음") {
  const normalized = sanitizePlainText(String(value ?? "")).trim();
  return escapeHtml(normalized || fallback);
}

function printDate(value: string | Date | undefined, includeTime = false) {
  if (!value) return "자료에서 확인되지 않음";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return printText(value);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : {}),
    timeZone: "Asia/Seoul",
  }).format(date);
}

function printVersion(protocol: Protocol) {
  if (protocol.status === "approved" && protocol.currentVersion >= 10) {
    return `v${Math.floor(protocol.currentVersion / 10)}.${protocol.currentVersion % 10}`;
  }
  return `v0.${Math.max(1, protocol.currentVersion)}`;
}

function printTimestamp(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function printList(
  values: readonly string[],
  className = "",
  emptyText = "자료에서 확인되지 않음",
) {
  const items = values.length ? values : [emptyText];
  return `<ul${className ? ` class="${className}"` : ""}>${items
    .map((item) => `<li>${printText(item)}</li>`)
    .join("")}</ul>`;
}

function printResourceTable(
  values: readonly string[],
  prefix: "M" | "E",
) {
  const rows = values.length
    ? values
        .map(
          (value, index) => `<tr>
        <td>${prefix}${String(index + 1).padStart(2, "0")}</td>
        <td>${printText(value)}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="2">자료에서 확인된 항목이 없습니다.</td></tr>`;
  return `<table class="resource-table">
    <thead><tr><th>ID</th><th>항목 및 재현 정보</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function printChecklist(values: readonly string[]) {
  if (!values.length) {
    return `<p class="empty-copy">자료에서 확인된 실험 전 준비사항이 없습니다.</p>`;
  }
  return `<ul class="preflight-list">${values
    .map((value) => `<li><span aria-hidden="true">□</span>${printText(value)}</li>`)
    .join("")}</ul>`;
}

function printRef(ref: SourceRef) {
  const location =
    ref.pageNumber !== undefined
      ? `${ref.pageNumber}페이지`
      : ref.timestampStart !== undefined
        ? `${printTimestamp(ref.timestampStart)}${ref.timestampEnd !== undefined ? `-${printTimestamp(ref.timestampEnd)}` : ""}`
        : "";
  return [
    printText(ref.sourceLabel),
    printText(ref.author || "작성자 미상"),
    location,
  ]
    .filter(Boolean)
    .join(" · ");
}

function printRefs(refs: readonly SourceRef[]) {
  if (!refs.length) {
    return `<div class="evidence-line"><strong>근거</strong><span>연결된 원본 근거 없음</span></div>`;
  }
  return `<div class="evidence-line"><strong>근거</strong><span>${refs
    .map(printRef)
    .join("<br>")}</span></div>`;
}

function printDetailBlock(
  title: string,
  values: readonly string[],
  tone: "neutral" | "info" | "warning" | "danger" = "neutral",
) {
  if (!values.length) return "";
  return `<section class="detail-block ${tone}">
    <h4>${printText(title)}</h4>
    ${printList(values)}
  </section>`;
}

function printStep(step: ProtocolStep) {
  const parameterRows = step.parameters.length
    ? step.parameters
        .map(
          (parameter) => `<tr>
        <th>${printText(parameter.name)}</th>
        <td class="condition-value">${printText(parameter.value)}${parameter.unit ? ` ${printText(parameter.unit, "")}` : ""}</td>
        <td>${parameter.normalizedValue !== undefined && parameter.normalizedValue !== null ? `${printText(parameter.normalizedValue)}${parameter.normalizedUnit ? ` ${printText(parameter.normalizedUnit, "")}` : ""}` : "-"}</td>
        <td>${parameter.sourceRefs.length ? parameter.sourceRefs.map(printRef).join("<br>") : "연결된 근거 없음"}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="4">자료에서 확인된 핵심 조건이 없습니다.</td></tr>`;
  const detailBlocks = [
    printDetailBlock("다음 단계 진행 기준", step.checkpoints, "info"),
    printDetailBlock("실무 팁", step.implicitTips, "info"),
    printDetailBlock("핵심 주의 및 자주 발생하는 실수", step.commonMistakes, "warning"),
    printDetailBlock("정상 완료 기준", step.successCriteria),
  ].join("");
  return `<article class="protocol-step">
    <header class="step-head">
      <span class="step-index"><small>STEP</small><strong>${String(step.order).padStart(2, "0")}</strong></span>
      <div>
        <h3>${printText(step.title, "제목 미정")}</h3>
        <p>${step.duration ? `예상 소요 ${printText(step.duration)}` : "소요 시간 미확인"} · 신뢰도 ${Math.round(Math.max(0, Math.min(1, step.confidence)) * 100)}%</p>
      </div>
      <span class="review-flag ${step.unresolved ? "needs-review" : ""}">${step.unresolved ? "확인 필요" : "확인됨"}</span>
    </header>
    <div class="step-content">
      <p class="step-action">${printText(step.action)}</p>
      <table class="condition-table">
        <thead><tr><th>조건</th><th>사용값</th><th>정규화</th><th>근거</th></tr></thead>
        <tbody>${parameterRows}</tbody>
      </table>
      ${detailBlocks ? `<div class="detail-grid">${detailBlocks}</div>` : ""}
      ${printRefs(step.sourceRefs)}
    </div>
  </article>`;
}

function printTroubleshootingTable(steps: readonly ProtocolStep[]) {
  const rows = steps.flatMap((step) => {
    const structured = step.troubleshootingItems ?? [];
    if (structured.length) {
      return structured.map(
        (item) => `<tr>
          <td>${String(step.order).padStart(2, "0")} · ${printText(step.title)}</td>
          <td>${printText(item.problem)}</td>
          <td>${printText(item.cause)}</td>
          <td>${printText(item.action)}</td>
        </tr>`,
      );
    }
    return step.troubleshooting.map(
      (action) => `<tr>
        <td>${String(step.order).padStart(2, "0")} · ${printText(step.title)}</td>
        <td>단계 수행 중 이상</td>
        <td>자료에서 확인되지 않음</td>
        <td>${printText(action)}</td>
      </tr>`,
    );
  });
  return `<table class="troubleshooting-table">
    <thead><tr><th>단계</th><th>문제 또는 관찰</th><th>가능한 원인</th><th>확인 및 조치</th></tr></thead>
    <tbody>${rows.length ? rows.join("") : `<tr><td colspan="4">자료에서 확인된 troubleshooting 항목이 없습니다.</td></tr>`}</tbody>
  </table>`;
}

function printAcceptanceGroup(
  title: string,
  values: readonly string[],
  tone: "pass" | "repeat" | "discard",
) {
  return `<section class="acceptance-group ${tone}">
    <h3>${printText(title)}</h3>
    ${printList(values, "", "자료에서 확인되지 않음")}
  </section>`;
}

function printConflict(conflict: Conflict) {
  return `<article class="review-item">
    <header><strong>${printText(conflict.field.replaceAll("_", " "))}</strong><span>위험도 ${PRINT_SEVERITY_LABELS[conflict.severity]} · ${conflict.status === "resolved" ? "해결됨" : "미해결"}</span></header>
    <p>${printText(conflict.description)}</p>
    <ul>${conflict.options
      .map(
        (option) =>
          `<li><strong>${printText(option.label)}:</strong> ${printText(option.value)}</li>`,
      )
      .join("")}</ul>
    ${conflict.selectedResolution ? `<p><strong>선택한 해결값:</strong> ${printText(conflict.selectedResolution)}</p>` : ""}
  </article>`;
}

function printMissingField(field: MissingField) {
  const status =
    field.status === "answered"
      ? "답변됨"
      : field.status === "dismissed"
        ? "제외됨"
        : "확인 필요";
  return `<article class="review-item">
    <header><strong>${printText(field.field.replaceAll("_", " "))}</strong><span>위험도 ${PRINT_SEVERITY_LABELS[field.severity]} · ${status}</span></header>
    <p><strong>누락 이유:</strong> ${printText(field.reason)}</p>
    <p><strong>확인 질문:</strong> ${printText(field.question)}</p>
    ${field.userAnswer ? `<p><strong>연구자 답변:</strong> ${printText(field.userAnswer)}</p>` : ""}
  </article>`;
}

function printableProtocolBody(
  bundle: ProtocolExportBundle,
  options: MarkdownExportOptions,
) {
  const { protocol, snapshot } = bundle;
  const sources = bundle.sources ?? snapshot.sources;
  const conflicts = snapshot.conflicts.filter(
    (item) =>
      options.includeResolvedConflicts !== false ||
      item.status === "unresolved",
  );
  const missingFields = snapshot.missingFields.filter(
    (item) =>
      options.includeDismissedMissingFields !== false ||
      item.status !== "dismissed",
  );
  const unresolved =
    snapshot.conflicts.filter((item) => item.status === "unresolved").length +
    snapshot.missingFields.filter((item) => item.status === "unresolved")
      .length;
  const generatedAt = options.generatedAt ?? new Date();
  const preflightChecklist = snapshot.preflightChecklist ?? [];
  const resultAcceptance = snapshot.resultAcceptance ?? {
    pass: snapshot.steps.flatMap((step) => step.successCriteria),
    repeat: [],
    discard: [],
  };
  const researcherAnswers = snapshot.researcherAnswers ?? [];
  const documentCode =
    /(\d{8}-\d{3})$/.exec(protocol.title)?.[1] ??
    protocol.id.replace(/^protocol-/, "").slice(-12).toUpperCase();
  const sourceRows = sources.length
    ? sources
        .map(
          (source, index) => `<tr>
        <td>S${String(index + 1).padStart(2, "0")}</td>
        <td><strong>${printText(source.displayName || source.fileName)}</strong><br><span class="subtle">${printText(source.fileName)}</span></td>
        <td>${printText(source.author || "작성자 미상")}</td>
        <td>${printDate(source.sourceDate)}</td>
        <td>${PRINT_RELIABILITY_LABELS[source.reliability]}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="5">연결된 원본 자료가 없습니다.</td></tr>`;
  const versions =
    options.includeVersionHistory && bundle.versions?.length
      ? `<section class="revision-section">
      <h2><span>09</span> 문서 변경 이력</h2>
      <table>
        <thead><tr><th>버전</th><th>변경 내용 및 이유</th><th>작성자</th><th>일시</th></tr></thead>
        <tbody>${bundle.versions
          .map(
            (version) => `<tr>
            <td>v${version.versionNumber}</td>
            <td>${printText(version.changeSummary)}</td>
            <td>${printText(version.changedBy)}</td>
            <td>${printDate(version.createdAt, true)}</td>
          </tr>`,
          )
          .join("")}</tbody>
      </table>
    </section>`
      : "";

  return `<header class="document-header">
    <div class="document-brand">
      <div><span>LABTRACE</span><strong>STANDARD OPERATING PROTOCOL</strong></div>
      <dl>
        <div><dt>문서 번호</dt><dd>${printText(documentCode)}</dd></div>
        <div><dt>버전</dt><dd>${printVersion(protocol)}</dd></div>
        <div><dt>상태</dt><dd>${PRINT_STATUS_LABELS[protocol.status]}</dd></div>
      </dl>
    </div>
    <div class="document-title">
      <p>${printText(bundle.protocol.category).toUpperCase()} PROTOCOL</p>
      <h1>${printText(protocol.title || snapshot.experiment.title, "제목 미정")}</h1>
      <div class="title-rule"></div>
      <p class="document-objective">${printText(protocol.objective || snapshot.experiment.objective)}</p>
    </div>
    <div class="document-meta">
      <div><span>Lab</span><strong>Neural Systems Lab</strong></div>
      <div><span>작성자</span><strong>${printText(protocol.createdBy || "작성자 미상")}</strong></div>
      <div><span>작성일</span><strong>${printDate(protocol.createdAt)}</strong></div>
      <div><span>최종 수정일</span><strong>${printDate(protocol.updatedAt)}</strong></div>
    </div>
  </header>

  <section class="protocol-summary">
    <h2>프로토콜 요약</h2>
    <div class="summary-panel">
      <div>
        <span>실험 단계</span><strong>${snapshot.steps.length}</strong>
      </div>
      <div>
        <span>준비물 및 시약</span><strong>${snapshot.materials.length}</strong>
      </div>
      <div>
        <span>장비 및 설정값</span><strong>${snapshot.equipment.length}</strong>
      </div>
      <div class="${unresolved ? "attention" : ""}">
        <span>확인 필요</span><strong>${unresolved}</strong>
      </div>
    </div>
  </section>

  ${
    unresolved
      ? `<aside class="review-notice"><strong>실행 전 검토 필요</strong><span>미해결 충돌 또는 누락 항목 ${unresolved}건이 있습니다. 해당 조건을 확인하기 전에는 임의로 확정하지 마세요.</span></aside>`
      : ""
  }

  <section class="document-section">
    <h2><span>01</span> 목적 및 적용 범위</h2>
    <h3 class="subsection-label">실험 목적</h3>
    <p class="lead">${printText(protocol.objective || snapshot.experiment.objective)}</p>
    <h3 class="subsection-label">적용 범위</h3>
    <p class="scope-copy">${printText(snapshot.experiment.scope)}</p>
    ${
      researcherAnswers.length
        ? `<h3 class="subsection-label">연구자 확인 답변</h3>
    <div class="confirmed-answer-list">${researcherAnswers
      .map(
        (item) => `<article>
      <strong>Q. ${printText(item.question)}</strong>
      <p>A. ${printText(item.answer)}</p>
      <span>${printText(item.answeredBy)} · ${printDate(item.answeredAt, true)}</span>
    </article>`,
      )
      .join("")}</div>`
        : ""
    }
  </section>

  <section class="document-section resource-section">
    <h2><span>02</span> 시약 및 소모품</h2>
    <p class="section-note">농도, 규격, 제조사, 카탈로그 번호와 보관 조건은 원본 근거에서 확인된 경우에만 함께 표시합니다.</p>
    ${printResourceTable(snapshot.materials, "M")}
  </section>

  <section class="document-section resource-section">
    <h2><span>03</span> 장비 및 설정값</h2>
    <p class="section-note">장비 모델, 교정 상태와 설정값은 원본 근거에서 확인된 경우에만 함께 표시합니다.</p>
    ${printResourceTable(snapshot.equipment, "E")}
  </section>

  <section class="document-section preflight-section">
    <h2><span>04</span> 실험 전 준비사항</h2>
    ${printChecklist(preflightChecklist)}
  </section>

  <section class="document-section procedure-section">
    <h2><span>05</span> 단계별 실험 절차</h2>
    ${snapshot.steps.length ? snapshot.steps.slice().sort((a, b) => a.order - b.order).map(printStep).join("") : `<p>자료에서 확인된 실험 단계가 없습니다.</p>`}
  </section>

  <section class="document-section troubleshooting-section">
    <h2><span>06</span> Troubleshooting</h2>
    ${printTroubleshootingTable(snapshot.steps)}
  </section>

  <section class="document-section acceptance-section">
    <h2><span>07</span> 결과 판정 기준</h2>
    <div class="acceptance-grid">
      ${printAcceptanceGroup("정상 완료", resultAcceptance.pass, "pass")}
      ${printAcceptanceGroup("재실험 또는 추가 확인", resultAcceptance.repeat, "repeat")}
      ${printAcceptanceGroup("폐기 또는 사용 중단", resultAcceptance.discard, "discard")}
    </div>
  </section>

  <section class="appendix-section">
    <h2><span>08</span> 검토 항목 및 원본 근거</h2>
    <div class="review-grid">
      <div>
        <h3>충돌 항목 (${conflicts.length})</h3>
        ${conflicts.length ? conflicts.map(printConflict).join("") : `<p class="empty-copy">표시할 충돌이 없습니다.</p>`}
      </div>
      <div>
        <h3>누락 항목 (${missingFields.length})</h3>
        ${missingFields.length ? missingFields.map(printMissingField).join("") : `<p class="empty-copy">표시할 누락 항목이 없습니다.</p>`}
      </div>
    </div>
    <div class="source-block">
      <h3 class="source-heading">연결된 원본 자료</h3>
      <table class="source-table">
        <thead><tr><th>ID</th><th>자료</th><th>작성자</th><th>작성일</th><th>성격</th></tr></thead>
        <tbody>${sourceRows}</tbody>
      </table>
    </div>
  </section>

  ${versions}

  <section class="signoff">
    <h2>검토 및 승인</h2>
    <div>
      <span>작성자</span><strong>${printText(protocol.createdBy || "작성자 미상")}</strong><i>서명 / 날짜</i>
      <span>검토자</span><strong></strong><i>서명 / 날짜</i>
      <span>승인자</span><strong></strong><i>서명 / 날짜</i>
    </div>
  </section>
  <footer class="document-footer">
    <span>LabTrace · ${printText(documentCode)}</span>
    <span>내보낸 시각 ${printDate(generatedAt, true)} · 원본 자료와 검토 이력이 연결된 프로토콜</span>
  </footer>`;
}

export function buildPrintableProtocolHtml(
  bundle: ProtocolExportBundle,
  markdownOptions: MarkdownExportOptions = {},
): string {
  const safeTitle = escapeHtml(bundle.protocol.title || "LabTrace 프로토콜");
  const body = printableProtocolBody(bundle, markdownOptions);
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Pretendard, "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", "Segoe UI", sans-serif;
      color: #172033;
      background: #eef1f5;
    }
    * { box-sizing: border-box; }
    body {
      width: 210mm;
      min-height: 297mm;
      margin: 16px auto;
      padding: 16mm 15mm 20mm;
      font-size: 9.5pt;
      line-height: 1.58;
      background: white;
      box-shadow: 0 12px 36px rgba(20, 31, 55, .12);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    h1, h2, h3, h4, p { margin-top: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      padding: 7px 8px;
      text-align: left;
      vertical-align: top;
      border: 1px solid #d9e0ea;
    }
    th { color: #283750; font-size: 8.4pt; font-weight: 700; background: #f2f5f8; }
    td { font-size: 8.3pt; }
    .document-brand {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 88mm;
      align-items: end;
      gap: 10mm;
      padding-bottom: 5mm;
      border-bottom: 1.5px solid #122344;
    }
    .document-brand > div span {
      display: block;
      color: #315ceb;
      font-size: 9pt;
      font-weight: 800;
      letter-spacing: .18em;
    }
    .document-brand > div strong { display: block; margin-top: 2px; color: #122344; font-size: 8pt; letter-spacing: .08em; }
    .document-brand dl {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin: 0;
      border: 1px solid #cbd4e1;
    }
    .document-brand dl div { padding: 4px 6px; border-right: 1px solid #cbd4e1; }
    .document-brand dl div:last-child { border-right: 0; }
    .document-brand dt { color: #66748a; font-size: 6.8pt; }
    .document-brand dd { margin: 1px 0 0; color: #122344; font-size: 8.2pt; font-weight: 750; }
    .document-title { padding: 13mm 0 7mm; text-align: center; }
    .document-title > p:first-child { margin-bottom: 3mm; color: #315ceb; font-size: 7.5pt; font-weight: 750; letter-spacing: .16em; }
    .document-title h1 { max-width: 165mm; margin: 0 auto; color: #122344; font-size: 23pt; line-height: 1.25; letter-spacing: -.035em; }
    .title-rule { width: 18mm; height: 2px; margin: 5mm auto; background: #315ceb; }
    .document-objective { max-width: 150mm; margin: 0 auto; color: #46546a; font-size: 9.5pt; line-height: 1.7; }
    .document-meta {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      margin-bottom: 7mm;
      border-top: 1px solid #d8dfe9;
      border-bottom: 1px solid #d8dfe9;
    }
    .document-meta div { padding: 3mm 4mm; border-right: 1px solid #e0e5ed; }
    .document-meta div:last-child { border-right: 0; }
    .document-meta span, .summary-panel span { display: block; color: #6d798d; font-size: 7pt; }
    .document-meta strong { display: block; margin-top: 1mm; color: #26344c; font-size: 8.5pt; }
    .protocol-summary > h2 {
      margin: 0 0 2.5mm;
      color: #122344;
      font-size: 11pt;
      text-align: center;
    }
    .summary-panel {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      margin-bottom: 5mm;
      overflow: hidden;
      background: #d6deea;
      border: 1px solid #d6deea;
      border-radius: 2mm;
    }
    .summary-panel div { padding: 3mm 4mm; background: #f7f9fb; }
    .summary-panel div.attention { background: #fff6e5; }
    .summary-panel strong { display: block; margin-top: 1mm; color: #122344; font-size: 15pt; line-height: 1; }
    .review-notice {
      display: grid;
      grid-template-columns: 38mm minmax(0, 1fr);
      gap: 4mm;
      margin: 0 0 7mm;
      padding: 3.5mm 4mm;
      color: #674b13;
      background: #fff8e9;
      border: 1px solid #e8cd8e;
      border-left: 3px solid #c58a16;
    }
    .review-notice strong { font-size: 8.7pt; }
    .review-notice span { font-size: 8.2pt; }
    .document-section, .appendix-section, .revision-section { margin-top: 8mm; }
    .document-section > h2, .appendix-section > h2, .revision-section > h2 {
      display: flex;
      align-items: center;
      gap: 3mm;
      margin-bottom: 4mm;
      color: #122344;
      font-size: 13pt;
      break-after: avoid;
    }
    .document-section > h2 span, .appendix-section > h2 span, .revision-section > h2 span {
      display: inline-grid;
      width: 8mm;
      height: 8mm;
      place-items: center;
      color: white;
      font-size: 7pt;
      background: #122344;
      border-radius: 1.5mm;
    }
    .lead { margin: 0; padding: 4mm 5mm; color: #303d52; font-size: 10pt; line-height: 1.75; background: #f6f8fb; border-left: 3px solid #315ceb; }
    .subsection-label { margin: 4mm 0 1.5mm; color: #58667a; font-size: 8pt; letter-spacing: .04em; }
    .scope-copy { margin: 0; padding: 3.5mm 5mm; color: #303d52; background: #fafbfc; border: 1px solid #e0e5ed; }
    .section-note { margin: -1mm 0 3mm; color: #6d798d; font-size: 7.6pt; }
    .resource-section { break-inside: avoid; }
    .resource-table th:first-child, .resource-table td:first-child { width: 13mm; text-align: center; }
    .resource-table td:nth-child(2) { font-size: 8.7pt; line-height: 1.55; }
    .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
    .two-column > div { min-width: 0; }
    .check-list { margin: 0; padding: 0; list-style: none; }
    .check-list li { position: relative; margin: 0 0 2mm; padding: 2.5mm 3mm 2.5mm 8mm; background: #fafbfc; border: 1px solid #e0e5ed; }
    .check-list li::before { position: absolute; left: 3mm; content: "-"; color: #315ceb; font-weight: 800; }
    .preflight-section { break-inside: avoid; }
    .preflight-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 2mm 4mm;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .preflight-list li {
      display: grid;
      grid-template-columns: 6mm minmax(0, 1fr);
      gap: 2mm;
      padding: 2.5mm 3mm;
      background: #fafbfc;
      border: 1px solid #dce2ea;
      break-inside: avoid;
    }
    .preflight-list li span { color: #315ceb; font-size: 11pt; line-height: 1; }
    .procedure-section { break-before: page; }
    .protocol-step { margin: 0 0 7mm; border: 1px solid #cfd7e3; border-radius: 2mm; }
    .step-head {
      display: grid;
      grid-template-columns: 18mm minmax(0, 1fr) auto;
      align-items: center;
      gap: 3mm;
      padding: 3.5mm 4mm;
      background: #f2f5f8;
      border-bottom: 1px solid #cfd7e3;
      break-after: avoid;
    }
    .step-index { display: inline-flex; width: 17mm; height: 7mm; align-items: center; justify-content: center; gap: 1.2mm; color: #122344; background: #eef3f8; border: 1px solid #adbed4; border-radius: 7mm; }
    .step-index small { color: #647895; font-size: 5pt; font-weight: 800; letter-spacing: .08em; }
    .step-index strong { font-size: 7.5pt; font-weight: 800; }
    .step-head h3 { margin: 0; color: #122344; font-size: 11.5pt; }
    .step-head p { margin: .6mm 0 0; color: #6b778b; font-size: 7.5pt; }
    .confirmed-answer-list { display: grid; gap: 2mm; }
    .confirmed-answer-list article { padding: 3mm 4mm; background: #f7f9fc; border: 1px solid #d8e1ed; break-inside: avoid; }
    .confirmed-answer-list strong { color: #263b59; font-size: 8.2pt; }
    .confirmed-answer-list p { margin: 1.3mm 0; color: #27364e; font-size: 8.5pt; }
    .confirmed-answer-list span { color: #718096; font-size: 6.8pt; }
    .review-flag { padding: 1.2mm 2.2mm; color: #276346; font-size: 7pt; font-weight: 700; background: #eaf6ef; border-radius: 9mm; }
    .review-flag.needs-review { color: #7a5310; background: #fff0cc; }
    .step-content { padding: 4mm; }
    .step-action { margin: 0 0 4mm; color: #27364e; font-size: 9.5pt; line-height: 1.7; }
    .condition-table { margin-bottom: 4mm; break-inside: avoid; }
    .condition-table th:nth-child(1) { width: 18%; }
    .condition-table th:nth-child(2) { width: 20%; }
    .condition-table th:nth-child(3) { width: 16%; }
    .condition-value { color: #122344; font-weight: 750; }
    .detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3mm; }
    .detail-block { min-width: 0; padding: 3mm; background: #fafbfc; border: 1px solid #e0e5ed; break-inside: avoid; }
    .detail-block h4 { margin: 0 0 1.5mm; color: #33415a; font-size: 8pt; }
    .detail-block ul { margin: 0; padding-left: 4.5mm; }
    .detail-block li { margin: .8mm 0; font-size: 7.8pt; }
    .detail-block.info { background: #f3f7ff; border-color: #d6e1f5; }
    .detail-block.warning { background: #fff8ea; border-color: #ead7aa; }
    .detail-block.danger { background: #fff4f2; border-color: #ebc9c4; }
    .evidence-line { display: grid; grid-template-columns: 16mm minmax(0, 1fr); gap: 2mm; margin-top: 3mm; padding-top: 3mm; color: #66748a; font-size: 7.4pt; border-top: 1px dashed #ccd5e1; }
    .evidence-line strong { color: #33415a; }
    .troubleshooting-section { break-before: page; }
    .troubleshooting-table th:nth-child(1) { width: 20%; }
    .troubleshooting-table th:nth-child(2) { width: 22%; }
    .troubleshooting-table th:nth-child(3) { width: 23%; }
    .troubleshooting-table th:nth-child(4) { width: 35%; }
    .troubleshooting-table tr { break-inside: avoid; }
    .acceptance-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 3mm;
    }
    .acceptance-group { padding: 3.5mm; border: 1px solid #dbe2eb; break-inside: avoid; }
    .acceptance-group h3 { margin: 0 0 2mm; font-size: 8.5pt; }
    .acceptance-group ul { margin: 0; padding-left: 4mm; }
    .acceptance-group li { margin: 1mm 0; font-size: 7.8pt; }
    .acceptance-group.pass { background: #f0f8f3; border-color: #cce3d4; }
    .acceptance-group.repeat { background: #fff8e9; border-color: #e8d5a7; }
    .acceptance-group.discard { background: #fff3f1; border-color: #eccbc6; }
    .appendix-section { break-before: page; }
    .revision-section { break-before: auto; }
    .review-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
    .review-grid h3, .source-heading { margin: 0 0 3mm; color: #26344c; font-size: 10pt; }
    .review-item { margin-bottom: 3mm; padding: 3mm; background: #fafbfc; border: 1px solid #dce2ea; break-inside: avoid; }
    .review-item header { display: flex; justify-content: space-between; gap: 3mm; padding-bottom: 1.5mm; border-bottom: 1px solid #e3e7ed; }
    .review-item header span { color: #7b5a18; font-size: 7pt; }
    .review-item p, .review-item li { margin: 1.5mm 0 0; font-size: 7.8pt; }
    .review-item ul { margin: 1.5mm 0 0; padding-left: 4.5mm; }
    .empty-copy { color: #6d798d; font-size: 8pt; }
    .source-heading { margin-top: 7mm; }
    .source-block { break-inside: avoid; page-break-inside: avoid; }
    .source-table .subtle { color: #758196; font-size: 7pt; }
    .signoff { margin-top: 10mm; break-inside: avoid; }
    .signoff h2 { margin-bottom: 3mm; color: #122344; font-size: 11pt; }
    .signoff > div { display: grid; grid-template-columns: 18mm 1fr 30mm; border-top: 1px solid #9ba7b8; }
    .signoff span, .signoff strong, .signoff i { min-height: 12mm; padding: 3mm; border-right: 1px solid #cfd6e0; border-bottom: 1px solid #cfd6e0; }
    .signoff span { color: #5f6d81; font-size: 8pt; background: #f4f6f8; border-left: 1px solid #cfd6e0; }
    .signoff i { color: #8993a2; font-size: 7pt; font-style: normal; text-align: center; }
    .document-footer { display: flex; justify-content: space-between; margin-top: 10mm; padding-top: 3mm; color: #7a8596; font-size: 6.8pt; border-top: 1px solid #ccd4df; }
    @page { size: A4; margin: 14mm 14mm 16mm; }
    @media print {
      :root { background: white; }
      body { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
      .document-header, .protocol-summary, .summary-panel, .review-notice, .document-section > h2,
      .appendix-section > h2, .revision-section > h2, .step-head, table, .detail-block, .review-item,
      .signoff { break-inside: avoid; }
      .protocol-step { break-inside: avoid-page; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

/**
 * 브라우저 인쇄 창을 열며, 사용자는 대상에서 “PDF로 저장”을 선택할 수 있습니다.
 */
export function openPrintWindow(
  html: string,
  options: PrintWindowOptions = {},
): Window {
  if (typeof window === "undefined") {
    throw new ExportProcessingError({
      code: "EXPORT_NOT_AVAILABLE",
      title: "이 환경에서는 인쇄할 수 없습니다",
      message: "PDF/인쇄 내보내기는 브라우저 화면에서만 실행할 수 있습니다.",
      recovery: "LabTrace 브라우저 화면으로 돌아가 다시 시도해 주세요.",
    });
  }

  const printWindow = window.open(
    "",
    options.windowName ?? "labtrace-print",
    "popup,width=960,height=760,noopener=false",
  );
  if (!printWindow) {
    throw new ExportProcessingError({
      code: "PRINT_WINDOW_BLOCKED",
      title: "인쇄 창이 차단되었습니다",
      message: "브라우저가 LabTrace의 인쇄 창을 열지 못했습니다.",
      recovery:
        "이 사이트의 팝업을 허용한 뒤 다시 시도해 주세요. 편집 중인 데이터는 보존되어 있습니다.",
    });
  }

  try {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    if (options.autoPrint !== false) {
      const runPrint = () => {
        printWindow.focus();
        printWindow.print();
      };
      if (printWindow.document.readyState === "complete") {
        setTimeout(runPrint, 0);
      } else {
        printWindow.addEventListener("load", runPrint, { once: true });
      }
    }
    return printWindow;
  } catch (cause) {
    printWindow.close();
    throw new ExportProcessingError({
      code: "PRINT_FAILED",
      title: "인쇄 문서를 만들지 못했습니다",
      message: "프로토콜을 인쇄용 문서로 여는 중 오류가 발생했습니다.",
      recovery:
        "Markdown으로 먼저 내려받거나 브라우저를 새로고침한 뒤 다시 시도해 주세요.",
      cause,
    });
  }
}

export function printProtocolAsPdf(
  bundle: ProtocolExportBundle,
  markdownOptions: MarkdownExportOptions = {},
): Window {
  return openPrintWindow(
    buildPrintableProtocolHtml(bundle, markdownOptions),
    {
      windowName: sanitizeFileName(`labtrace-${bundle.protocol.title}`),
      autoPrint: true,
    },
  );
}

export const printProtocol = printProtocolAsPdf;
