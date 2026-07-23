"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clipboard,
  Copy,
  FileDown,
  History,
  Lightbulb,
  MessageSquareText,
  Pencil,
  Plus,
  Printer,
  Save,
  Send,
  ShieldAlert,
  Trash2,
  Undo2,
  Wrench,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  AiSuggestion,
  ChatMessage,
  Conflict,
  MissingField,
  ProtocolDocument,
  ProtocolSnapshot,
  ProtocolStatus,
  ProtocolStep,
  ProtocolVersion,
  SourceArtifact,
  SourceRef,
} from "@/src/types";
import { PRODUCT_CONFIG } from "@/src/config/product";
import {
  buildProtocolMarkdown,
  downloadMarkdown,
  printProtocolAsPdf,
} from "@/src/lib/export";
import {
  InlineNotice,
  Modal,
  Panel,
  SourceBadge,
  StatusBadge,
} from "./common";

const statusLabels: Record<ProtocolStatus, string> = {
  draft: "작성 중",
  review: "검토 중",
  approved: "확정",
  archived: "보관됨",
};

function displayVersion(value: number, status: ProtocolStatus) {
  if (status === "approved" && value >= 10) {
    return `v${Math.floor(value / 10)}.${value % 10}`;
  }
  return `v0.${Math.max(1, value)}`;
}

function dateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function sourceDetail(ref: SourceRef) {
  if (ref.pageNumber) return `p.${ref.pageNumber}`;
  if (ref.timestampStart !== undefined) {
    const minutes = Math.floor(ref.timestampStart / 60);
    const seconds = Math.floor(ref.timestampStart % 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${Math.round(ref.confidence * 100)}%`;
}

function cloneSnapshot(snapshot: ProtocolSnapshot): ProtocolSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as ProtocolSnapshot;
}

function listOrUnknown(values: string[]) {
  return values.length ? values : ["자료에서 확인되지 않음"];
}

function StepCard({
  step,
  editMode,
  checked,
  expanded,
  onChecked,
  onChange,
  onMove,
  onDelete,
  onSource,
  onToggle,
}: {
  step: ProtocolStep;
  editMode: boolean;
  checked: boolean;
  expanded: boolean;
  onChecked: (checked: boolean) => void;
  onChange: (patch: Partial<ProtocolStep>) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  onSource: (ref: SourceRef) => void;
  onToggle: () => void;
}) {
  if (editMode) {
    return (
      <article className={`step-card${step.unresolved ? " has-warning" : ""}`}>
        <header className="step-header step-header-edit">
          <span className="step-number">
            <small>STEP</small>
            <strong>{String(step.order).padStart(2, "0")}</strong>
          </span>
          <div className="step-heading">
            <label className="field">
              <span>단계 제목</span>
              <input
                className="input"
                onChange={(event) => onChange({ title: event.target.value })}
                value={step.title}
              />
            </label>
          </div>
          <div className="edit-actions">
            <button
              aria-label="단계 위로 이동"
              className="icon-button"
              onClick={() => onMove(-1)}
              type="button"
            >
              <ArrowUp aria-hidden size={14} />
            </button>
            <button
              aria-label="단계 아래로 이동"
              className="icon-button"
              onClick={() => onMove(1)}
              type="button"
            >
              <ArrowDown aria-hidden size={14} />
            </button>
            <button
              aria-label="단계 삭제"
              className="icon-button"
              onClick={onDelete}
              type="button"
            >
              <Trash2 aria-hidden size={14} />
            </button>
          </div>
        </header>
        <div className="step-body edit-grid">
          <label className="field">
            <span>수행 행동</span>
            <textarea
              className="textarea"
              onChange={(event) => onChange({ action: event.target.value })}
              value={step.action}
            />
          </label>
          <div className="file-meta-grid">
            <label className="field">
              <span>준비물 · 쉼표로 구분</span>
              <input
                className="input"
                onChange={(event) =>
                  onChange({
                    materials: event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
                value={step.materials.join(", ")}
              />
            </label>
            <label className="field">
              <span>장비 · 쉼표로 구분</span>
              <input
                className="input"
                onChange={(event) =>
                  onChange({
                    equipment: event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
                value={step.equipment.join(", ")}
              />
            </label>
            <label className="field">
              <span>소요 시간</span>
              <input
                className="input"
                onChange={(event) => onChange({ duration: event.target.value })}
                value={step.duration}
              />
            </label>
            <label className="field">
              <span>신뢰도</span>
              <input
                className="input"
                max="1"
                min="0"
                onChange={(event) =>
                  onChange({ confidence: Number(event.target.value) })
                }
                step="0.01"
                type="number"
                value={step.confidence}
              />
            </label>
          </div>
          <label className="field">
            <span>선배의 팁 · 줄바꿈으로 구분</span>
            <textarea
              className="textarea"
              onChange={(event) =>
                onChange({
                  implicitTips: event.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
              value={step.implicitTips.join("\n")}
            />
          </label>
          <label className="field">
            <span>자주 발생하는 실수 · 줄바꿈으로 구분</span>
            <textarea
              className="textarea"
              onChange={(event) =>
                onChange({
                  commonMistakes: event.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
              value={step.commonMistakes.join("\n")}
            />
          </label>
          <label className="field">
            <span>Troubleshooting · 줄바꿈으로 구분</span>
            <textarea
              className="textarea"
              onChange={(event) =>
                onChange({
                  troubleshooting: event.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
              value={step.troubleshooting.join("\n")}
            />
          </label>
        </div>
      </article>
    );
  }

  return (
    <article className={`step-card${step.unresolved ? " has-warning" : ""}`}>
      <header className="step-header">
        <button
          aria-expanded={expanded}
          className="step-disclosure button-quiet"
          onClick={onToggle}
          type="button"
        >
          <span className="step-number">
            <small>STEP</small>
            <strong>{String(step.order).padStart(2, "0")}</strong>
          </span>
          <span className="step-heading">
            <h3>{step.title}</h3>
            <p>
              신뢰도 {Math.round(step.confidence * 100)}%
              {step.unresolved ? " · 연구자 확인 필요" : ""}
            </p>
          </span>
          {expanded ? (
            <ChevronDown aria-hidden size={17} />
          ) : (
            <ChevronRight aria-hidden size={17} />
          )}
        </button>
        <label className="step-complete">
          <input
            checked={checked}
            onChange={(event) => onChecked(event.target.checked)}
            type="checkbox"
          />
          실행 확인
        </label>
      </header>
      {expanded ? <div className="step-body">
        <p className="step-action">
          {step.action || "자료에서 확인되지 않음"}
        </p>

        <div className="condition-grid">
          {step.parameters.length ? (
            step.parameters.map((parameter, parameterIndex) => (
              <div
                className="condition"
                key={`${parameter.name}-${parameterIndex}`}
              >
                <span>{parameter.name}</span>
                <strong>
                  {parameter.value} {parameter.unit}
                </strong>
                <div className="source-badges" style={{ border: 0, margin: 0, paddingTop: 5 }}>
                  {parameter.sourceRefs
                    .slice(0, 2)
                    .map((ref, refIndex) => (
                    <SourceBadge
                      detail={sourceDetail(ref)}
                      key={`${ref.artifactId}-${ref.excerptId || ref.quote}-${refIndex}`}
                      label={ref.author}
                      onClick={() => onSource(ref)}
                    />
                    ))}
                </div>
              </div>
            ))
          ) : (
            <div className="condition">
              <span>핵심 조건</span>
              <strong>자료에서 확인되지 않음</strong>
            </div>
          )}
          <div className="condition">
            <span>소요 시간</span>
            <strong>{step.duration || "확인 필요"}</strong>
          </div>
          <div className="condition">
            <span>준비물</span>
            <strong>{step.materials.join(", ") || "확인 필요"}</strong>
          </div>
          <div className="condition">
            <span>장비</span>
            <strong>{step.equipment.join(", ") || "확인 필요"}</strong>
          </div>
        </div>

        <div className="step-detail-grid">
          <section className="step-detail tip-box">
            <h4>
              <Lightbulb aria-hidden size={13} /> 선배의 팁 및 암묵지
            </h4>
            <ul>
              {listOrUnknown(step.implicitTips).map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          </section>
          <section className="step-detail mistake-box">
            <h4>
              <AlertTriangle aria-hidden size={13} /> 자주 발생하는 실수
            </h4>
            <ul>
              {listOrUnknown(step.commonMistakes).map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          </section>
          <section className="step-detail">
            <h4>
              <Wrench aria-hidden size={13} /> Troubleshooting
            </h4>
            <ul>
              {listOrUnknown(step.troubleshooting).map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          </section>
          <section className="step-detail">
            <h4>
              <CheckCircle2 aria-hidden size={13} /> 성공·실패 확인 기준
            </h4>
            <ul>
              {listOrUnknown(step.successCriteria).map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          </section>
        </div>

        <div className="source-badges">
          {step.sourceRefs.length ? (
            step.sourceRefs.map((ref, refIndex) => (
              <SourceBadge
                detail={sourceDetail(ref)}
                key={`${ref.artifactId}-${ref.excerptId || ref.quote}-${refIndex}`}
                label={`${ref.sourceLabel} · ${ref.author}`}
                onClick={() => onSource(ref)}
              />
            ))
          ) : (
            <span className="warning-count">
              <AlertTriangle aria-hidden size={12} /> 연결된 출처 없음
            </span>
          )}
        </div>
      </div> : null}
    </article>
  );
}

function VersionsModal({
  versions,
  currentVersion,
  onClose,
}: {
  versions: ProtocolVersion[];
  currentVersion: number;
  onClose: () => void;
}) {
  return (
    <Modal
      description="이전 버전은 읽기 전용입니다. 변경 요약과 작성자를 확인할 수 있습니다."
      onClose={onClose}
      title="버전 및 변경 이력"
    >
      <div className="version-list">
        {[...versions]
          .sort((a, b) => b.versionNumber - a.versionNumber)
          .map((version) => (
            <article className="version-row" key={version.id}>
              <span className="version-number">
                v0.{version.versionNumber}
              </span>
              <div>
                <strong>{version.changeSummary}</strong>
                <span>
                  {version.changedBy} · {dateTime(version.createdAt)}
                  {version.versionNumber === currentVersion ? " · 현재" : ""}
                </span>
              </div>
            </article>
          ))}
      </div>
    </Modal>
  );
}

function SaveModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (summary: string, bumpVersion: boolean) => void;
}) {
  const [summary, setSummary] = useState("프로토콜 내용 검토 및 수정");
  const [bump, setBump] = useState(true);
  return (
    <Modal
      description="변경 요약은 다음 연구자가 수정 이유를 이해할 수 있도록 버전 이력에 남습니다."
      footer={
        <>
          <button className="button" onClick={onClose} type="button">
            취소
          </button>
          <button
            className="button button-primary"
            disabled={!summary.trim()}
            onClick={() => onSave(summary.trim(), bump)}
            type="button"
          >
            <Save aria-hidden size={14} /> 변경사항 저장
          </button>
        </>
      }
      onClose={onClose}
      title="수정 내용을 저장할까요?"
    >
      <div className="stack">
        <label className="field">
          <span>변경 요약</span>
          <textarea
            className="textarea"
            onChange={(event) => setSummary(event.target.value)}
            value={summary}
          />
        </label>
        <label className="consent-box">
          <input
            checked={bump}
            onChange={(event) => setBump(event.target.checked)}
            type="checkbox"
          />
          <span>
            새 버전으로 저장합니다. 일반 수정은 v0.2, v0.3처럼 증가하고 승인 시
            v1.0으로 전환할 수 있습니다.
          </span>
        </label>
      </div>
    </Modal>
  );
}

export function ProtocolDetailView({
  protocol,
  sources,
  conflicts,
  missingFields,
  versions,
  suggestions,
  onBack,
  onSave,
  onStatus,
  onAssistant,
  onReview,
  onSource,
  onAcceptSuggestion,
  onToast,
}: {
  protocol: ProtocolDocument;
  sources: SourceArtifact[];
  conflicts: Conflict[];
  missingFields: MissingField[];
  versions: ProtocolVersion[];
  suggestions: AiSuggestion[];
  onBack: () => void;
  onSave: (
    snapshot: ProtocolSnapshot,
    summary: string,
    bumpVersion: boolean,
  ) => void;
  onStatus: (status: ProtocolStatus) => void;
  onAssistant: () => void;
  onReview: () => void;
  onSource: (ref: SourceRef) => void;
  onAcceptSuggestion: (id: string) => void;
  onToast: (message: string, kind?: "success" | "error") => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<ProtocolSnapshot>(() =>
    cloneSnapshot(protocol.snapshot),
  );
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>(
    {},
  );
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>(
    {},
  );
  const [saveOpen, setSaveOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [pendingStatus, setPendingStatus] =
    useState<ProtocolStatus | null>(null);
  const lastAutosaveRef = useRef(JSON.stringify(protocol.snapshot));
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    if (!editMode) return;
    const serialized = JSON.stringify(draft);
    if (serialized === lastAutosaveRef.current) return;
    const timer = window.setTimeout(() => {
      lastAutosaveRef.current = serialized;
      onSaveRef.current(draft, "자동 임시 저장", false);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [draft, editMode]);

  const unresolvedConflicts = conflicts.filter(
    (item) => item.status === "unresolved",
  );
  const unresolvedMissing = missingFields.filter(
    (item) => item.status === "unresolved",
  );
  const protocolSummary =
    draft.experiment.objective?.trim() ||
    `${draft.steps.length}개 단계로 구성된 실험 프로토콜입니다.`;
  const keyConditions = Array.from(
    new Map(
      draft.steps
        .flatMap((step) => step.parameters)
        .map((parameter) => [
          `${parameter.name}-${parameter.value}-${parameter.unit ?? ""}`,
          `${parameter.name}: ${parameter.value}${parameter.unit ? ` ${parameter.unit}` : ""}`,
        ]),
    ).values(),
  ).slice(0, 6);

  const updateStep = (stepId: string, patch: Partial<ProtocolStep>) => {
    setDraft((value) => ({
      ...value,
      steps: value.steps.map((step) =>
        step.id === stepId ? { ...step, ...patch } : step,
      ),
    }));
  };

  const moveStep = (stepId: string, direction: -1 | 1) => {
    setDraft((value) => {
      const index = value.steps.findIndex((step) => step.id === stepId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= value.steps.length) {
        return value;
      }
      const steps = [...value.steps];
      [steps[index], steps[nextIndex]] = [steps[nextIndex], steps[index]];
      return {
        ...value,
        steps: steps.map((step, stepIndex) => ({
          ...step,
          order: stepIndex + 1,
        })),
      };
    });
  };

  const addStep = () => {
    setDraft((value) => ({
      ...value,
      steps: [
        ...value.steps,
        {
          id: crypto.randomUUID(),
          order: value.steps.length + 1,
          title: "새 단계",
          action: "자료에서 확인되지 않음",
          materials: [],
          equipment: [],
          parameters: [],
          duration: "",
          checkpoints: [],
          implicitTips: [],
          commonMistakes: [],
          troubleshooting: [],
          successCriteria: [],
          sourceRefs: [],
          confidence: 0,
          unresolved: true,
        },
      ],
    }));
  };

  const removeStep = (stepId: string) => {
    setDraft((value) => ({
      ...value,
      steps: value.steps
        .filter((step) => step.id !== stepId)
        .map((step, index) => ({ ...step, order: index + 1 })),
    }));
  };

  const exportBundle = {
    protocol,
    snapshot: draft,
    versions,
    sources,
  };

  const download = () => {
    try {
      const markdown = buildProtocolMarkdown(exportBundle, {
        includeVersionHistory: true,
      });
      downloadMarkdown(markdown, `${protocol.title}-ARIA.md`);
      onToast("Markdown 파일을 다운로드했습니다.");
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "내보내기에 실패했습니다.",
        "error",
      );
    }
  };

  const print = () => {
    try {
      printProtocolAsPdf(exportBundle, { includeVersionHistory: true });
      onToast("인쇄 창에서 ‘PDF로 저장’을 선택하세요.");
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "인쇄 창을 열지 못했습니다.",
        "error",
      );
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        buildProtocolMarkdown(exportBundle, { includeVersionHistory: true }),
      );
      onToast("프로토콜 Markdown을 클립보드에 복사했습니다.");
    } catch {
      onToast("클립보드 복사 권한을 확인해 주세요.", "error");
    }
  };

  return (
    <div className="page">
      <button
        className="button button-small button-quiet"
        onClick={onBack}
        type="button"
      >
        <ChevronLeft aria-hidden size={14} /> Protocols
      </button>

      <section className="protocol-header">
        <div className="protocol-title-row">
          <div>
            {editMode ? (
              <label className="field">
                <span>프로토콜 제목</span>
                <input
                  className="input"
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      experiment: {
                        ...value.experiment,
                        title: event.target.value,
                      },
                    }))
                  }
                  value={draft.experiment.title}
                />
              </label>
            ) : (
              <h1>{draft.experiment.title}</h1>
            )}
            <div className="protocol-subline">
              <span>{PRODUCT_CONFIG.defaultLab.name}</span>
              <StatusBadge status={protocol.status} />
              <span className="mono">
                {displayVersion(protocol.currentVersion, protocol.status)}
              </span>
              <span>작성 {dateTime(protocol.createdAt)}</span>
              <span>수정 {dateTime(protocol.updatedAt)}</span>
              <span>{protocol.createdBy}</span>
            </div>
          </div>
          <div className="field" style={{ minWidth: 150 }}>
            <label htmlFor="protocol-status">승인 상태</label>
            <select
              className="select"
              id="protocol-status"
              onChange={(event) => {
                const nextStatus = event.target.value as ProtocolStatus;
                if (
                  nextStatus === "archived" ||
                  (nextStatus === "approved" &&
                    unresolvedConflicts.length + unresolvedMissing.length > 0)
                ) {
                  setPendingStatus(nextStatus);
                  return;
                }
                onStatus(nextStatus);
              }}
              value={protocol.status}
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="protocol-toolbar">
          <div className="toolbar">
            <button
              className={`button${editMode ? " button-primary" : ""}`}
              onClick={() => {
                if (editMode) setSaveOpen(true);
                else setEditMode(true);
              }}
              type="button"
            >
              {editMode ? (
                <Save aria-hidden size={14} />
              ) : (
                <Pencil aria-hidden size={14} />
              )}
              {editMode ? "수정 저장" : "편집"}
            </button>
            {editMode ? (
              <button
                className="button"
                onClick={() => {
                  setDraft(cloneSnapshot(protocol.snapshot));
                  setEditMode(false);
                }}
                type="button"
              >
                <Undo2 aria-hidden size={14} /> 변경 취소
              </button>
            ) : null}
            <button
              className="button"
              onClick={() => setVersionsOpen(true)}
              type="button"
            >
              <History aria-hidden size={14} /> 버전 이력
            </button>
            <button className="button" onClick={onAssistant} type="button">
              <MessageSquareText aria-hidden size={14} /> 근거 질의
            </button>
          </div>
          <div className="toolbar">
            <button className="button" onClick={copy} type="button">
              <Copy aria-hidden size={14} /> 복사
            </button>
            <button className="button" onClick={download} type="button">
              <FileDown aria-hidden size={14} /> Markdown
            </button>
            <button className="button" onClick={print} type="button">
              <Printer aria-hidden size={14} /> PDF / 인쇄
            </button>
          </div>
        </div>
      </section>

      <section className="protocol-summary-hero">
        <div className="protocol-summary-eyebrow">PROTOCOL SUMMARY</div>
        <h2>프로토콜 요약</h2>
        <p>{protocolSummary}</p>
        <div className="protocol-summary-stats" aria-label="프로토콜 요약 지표">
          <div>
            <strong>{draft.steps.length}</strong>
            <span>실험 단계</span>
          </div>
          <div>
            <strong>{sources.length}</strong>
            <span>원본 자료</span>
          </div>
          <div>
            <strong>{keyConditions.length}</strong>
            <span>핵심 조건</span>
          </div>
          <div>
            <strong>
              {unresolvedConflicts.length + unresolvedMissing.length}
            </strong>
            <span>확인 필요</span>
          </div>
        </div>
        {keyConditions.length ? (
          <div className="protocol-summary-conditions">
            {keyConditions.map((condition) => (
              <span key={condition}>{condition}</span>
            ))}
          </div>
        ) : null}
      </section>

      <div className="protocol-layout">
        <main className="protocol-main">
          <section className="protocol-foundation">
            <header className="protocol-section-heading">
              <span>01</span>
              <div>
                <h2>실험 개요</h2>
                <p>목적과 실행에 필요한 기본 항목을 먼저 확인하세요.</p>
              </div>
            </header>
            <div className="protocol-overview">
              <section className="overview-box overview-box-wide">
              <h3>실험 목적</h3>
              {editMode ? (
                <textarea
                  className="textarea"
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      experiment: {
                        ...value.experiment,
                        objective: event.target.value,
                      },
                    }))
                  }
                  value={draft.experiment.objective}
                />
              ) : (
                <p>
                  {draft.experiment.objective || "자료에서 확인되지 않음"}
                </p>
              )}
              </section>
              <section className="overview-box">
                <h3>준비물 및 시약</h3>
                <ul>
                  {listOrUnknown(draft.materials).map((item, itemIndex) => (
                    <li key={`${item}-${itemIndex}`}>{item}</li>
                  ))}
                </ul>
              </section>
              <section className="overview-box">
                <h3>장비 및 설정값</h3>
                <ul>
                  {listOrUnknown(draft.equipment).map((item, itemIndex) => (
                    <li key={`${item}-${itemIndex}`}>{item}</li>
                  ))}
                </ul>
              </section>
              {(draft.researcherAnswers ?? []).length ? (
                <section className="overview-box overview-box-wide researcher-answers">
                  <h3>연구자 확인 답변</h3>
                  <div className="researcher-answer-list">
                    {(draft.researcherAnswers ?? []).map((item) => (
                      <article key={item.missingFieldId}>
                        <span className="answer-label">Q</span>
                        <div>
                          <strong>{item.question}</strong>
                          <p>
                            <span className="answer-label answer-label-filled">A</span>
                            {item.answer}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </section>

          <header className="protocol-section-heading procedure-heading">
            <span>02</span>
            <div>
              <h2>단계별 실험 절차</h2>
              <p>각 단계의 조건, 체크포인트와 원본 근거를 확인하세요.</p>
            </div>
          </header>

          {draft.steps
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((step) => (
              <StepCard
                checked={Boolean(completedSteps[step.id])}
                editMode={editMode}
                expanded={expandedSteps[step.id] !== false}
                key={step.id}
                onChange={(patch) => updateStep(step.id, patch)}
                onChecked={(checked) =>
                  setCompletedSteps((value) => ({
                    ...value,
                    [step.id]: checked,
                  }))
                }
                onDelete={() => removeStep(step.id)}
                onMove={(direction) => moveStep(step.id, direction)}
                onSource={onSource}
                onToggle={() =>
                  setExpandedSteps((value) => ({
                    ...value,
                    [step.id]: value[step.id] === false,
                  }))
                }
                step={step}
              />
            ))}

          {editMode ? (
            <button className="button" onClick={addStep} type="button">
              <Plus aria-hidden size={14} /> 단계 추가
            </button>
          ) : null}

          <section className="execution-guide">
            <header className="panel-header">
              <div>
                <h2>다음 실험자를 위한 실행 가이드</h2>
                <p>원본 자료에 근거한 실행 전 확인 순서</p>
              </div>
            </header>
            <div className="guide-section">
              <h4>1. 시작 전 확인 사항</h4>
              <ul>
                <li>target protein과 phospho-target 여부를 담당자에게 확인</li>
                <li>membrane 종류와 transfer 장비 모델 확인</li>
                <li>사용할 primary antibody 제품과 최근 검증 dilution 확인</li>
              </ul>
            </div>
            <div className="guide-section">
              <h4>2. 반드시 담당자에게 확인할 미해결 질문</h4>
              <ul>
                {unresolvedMissing.length ? (
                  unresolvedMissing.map((item) => (
                    <li key={item.id}>{item.question}</li>
                  ))
                ) : (
                  <li>현재 표시된 미해결 질문이 없습니다.</li>
                )}
              </ul>
            </div>
            <div className="guide-section">
              <h4>3. 자주 발생한 실수와 우선 확인 항목</h4>
              <ul>
                {listOrUnknown(
                  draft.steps.flatMap((step) => step.commonMistakes),
                ).map((item, itemIndex) => (
                  <li key={`${item}-${itemIndex}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="guide-section">
              <h4>4. 이상 징후와 troubleshooting</h4>
              <ul>
                {listOrUnknown(
                  draft.steps.flatMap((step) => step.troubleshooting),
                ).map((item, itemIndex) => (
                  <li key={`${item}-${itemIndex}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="guide-section">
              <h4>5. AI가 제안하는 개선 아이디어</h4>
              {suggestions
                .filter((item) => item.type === "ai_idea")
                .map((item) => (
                  <div className="ai-idea" key={item.id}>
                    <strong>{item.title}</strong>
                    <div>{item.content}</div>
                    <div>
                      {item.warning ||
                        "원본 자료에서 확인되지 않은 AI 아이디어"}
                    </div>
                    {item.status === "proposed" ? (
                      <button
                        className="button button-small"
                        onClick={() => onAcceptSuggestion(item.id)}
                        style={{ marginTop: 7 }}
                        type="button"
                      >
                        검토 후 수락
                      </button>
                    ) : (
                      <span className="status status-approved">수락됨</span>
                    )}
                  </div>
                ))}
            </div>
          </section>
        </main>

        <aside className="protocol-sidebar">
          <Panel
            action={
              <button
                className="button button-small"
                onClick={onReview}
                type="button"
              >
                검토
              </button>
            }
            title="문서 상태"
          >
            <div className="health-list">
              <div className="health-row">
                <ShieldAlert aria-hidden size={14} />
                <div>
                  <strong>미해결 충돌</strong>
                  <span>임의 선택하지 않음</span>
                </div>
                <span className="health-value warn">
                  {unresolvedConflicts.length}
                </span>
              </div>
              <div className="health-row">
                <CircleHelp aria-hidden size={14} />
                <div>
                  <strong>누락 질문</strong>
                  <span>연구자 답변 필요</span>
                </div>
                <span className="health-value warn">
                  {unresolvedMissing.length}
                </span>
              </div>
              <div className="health-row">
                <Clipboard aria-hidden size={14} />
                <div>
                  <strong>원본 자료</strong>
                  <span>작성자와 시점 포함</span>
                </div>
                <span className="health-value good">{sources.length}</span>
              </div>
            </div>
          </Panel>

          <Panel title="원본 출처">
            <div className="source-compact-list">
              {sources.map((source) => (
                <div className="source-compact" key={source.id}>
                  <span className="source-type-icon">
                    <span className="mono">
                      {source.type.slice(0, 3).toUpperCase()}
                    </span>
                  </span>
                  <div>
                    <strong title={source.fileName}>{source.displayName}</strong>
                    <span>
                      {source.author} · {source.sourceDate.slice(0, 10)}
                    </span>
                  </div>
                  <span className="tag">{source.reliability}</span>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>

      {saveOpen ? (
        <SaveModal
          onClose={() => setSaveOpen(false)}
          onSave={(summary, bump) => {
            onSave(draft, summary, bump);
            setSaveOpen(false);
            setEditMode(false);
          }}
        />
      ) : null}
      {versionsOpen ? (
        <VersionsModal
          currentVersion={protocol.currentVersion}
          onClose={() => setVersionsOpen(false)}
          versions={versions}
        />
      ) : null}
      {pendingStatus ? (
        <Modal
          description={
            pendingStatus === "archived"
              ? "보관 상태는 프로토콜 목록 필터에 반영되며 버전 이력과 원본 자료는 유지됩니다."
              : `미해결 충돌 ${unresolvedConflicts.length}건과 누락 ${unresolvedMissing.length}건이 남아 있습니다. 상태를 확정하기 전에 내용을 확인하세요.`
          }
          footer={
            <>
              <button
                className="button"
                onClick={() => setPendingStatus(null)}
                type="button"
              >
                취소
              </button>
              <button
                className={
                  pendingStatus === "archived"
                    ? "button button-danger"
                    : "button button-primary"
                }
                onClick={() => {
                  onStatus(pendingStatus);
                  setPendingStatus(null);
                }}
                type="button"
              >
                {pendingStatus === "archived" ? "보관 상태로 변경" : "확정"}
              </button>
            </>
          }
          onClose={() => setPendingStatus(null)}
          title={
            pendingStatus === "archived"
              ? "프로토콜을 보관 상태로 변경할까요?"
              : "미해결 항목이 있는 프로토콜을 확정할까요?"
          }
        >
          <InlineNotice
            kind={pendingStatus === "archived" ? "warning" : "danger"}
          >
            {pendingStatus === "archived"
              ? "프로토콜은 삭제되지 않으며 상태를 다시 변경할 수 있습니다."
              : "확정하기 전에 원본 근거와 조건을 직접 확인하세요."}
          </InlineNotice>
        </Modal>
      ) : null}
    </div>
  );
}

const exampleQuestions = [
  "이 실험에서 가장 자주 실수하는 부분은?",
  "출처가 충돌하는 조건만 정리해 줘.",
  "다음 실험자가 시작 전에 확인할 사항은?",
  "자료에서 확인되지 않은 정보는?",
  "프로토콜을 더 명확하게 만들 질문을 제안해 줘.",
  "실패했을 때 우선 확인할 항목은?",
];

export function AssistantView({
  protocol,
  messages,
  onBack,
  onSend,
  onSource,
  onSuggestEdit,
}: {
  protocol: ProtocolDocument;
  messages: ChatMessage[];
  onBack: () => void;
  onSend: (question: string) => Promise<void>;
  onSource: (ref: SourceRef) => void;
  onSuggestEdit: (message: ChatMessage) => void;
}) {
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  const send = async (text = question) => {
    const normalized = text.trim();
    if (!normalized || sending) return;
    setQuestion("");
    setSending(true);
    try {
      await onSend(normalized);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <button
            className="button button-small button-quiet"
            onClick={onBack}
            type="button"
          >
            <ChevronLeft aria-hidden size={14} /> 프로토콜로 돌아가기
          </button>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            프로토콜 질의
          </h1>
          <p className="page-description">
            현재 프로토콜, 연결된 출처, 미해결 충돌과 누락만을 근거로
            답변합니다. 일반 아이디어는 공식 프로토콜과 분리합니다.
          </p>
        </div>
      </header>

      <section className="chat-layout">
        <div className="chat-main">
          <header className="chat-context">
            <div>
              <strong>{protocol.title}</strong>
              <span>현재 프로토콜과 원본 자료를 기준으로 답변합니다.</span>
            </div>
            <StatusBadge status={protocol.status} />
          </header>

          <div aria-live="polite" className="chat-messages">
            {!messages.length ? (
              <div className="empty-state">
                <div>
                  <Bot aria-hidden size={28} />
                  <h3>프로토콜에 대해 질문하세요</h3>
                  <p>
                    출처가 있는 답변에는 원본 근거 배지가 표시됩니다. 자료에 없는
                    내용은 확인되지 않는다고 답합니다.
                  </p>
                </div>
              </div>
            ) : null}
            {messages.map((message) => (
              <article
                className={`message ${message.role === "user" ? "message-user" : "message-assistant"}`}
                key={message.id}
              >
                <div className="message-label">
                  {message.role === "user" ? "나" : "ARIA"} ·{" "}
                  {new Date(message.createdAt).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div className="message-bubble">
                  {message.suggestionType === "ai_idea" ? (
                    <div className="ai-idea" style={{ marginBottom: 8 }}>
                      <strong>검증되지 않은 일반 아이디어</strong>
                      <div>원본 자료에서 확인되지 않은 AI 아이디어입니다.</div>
                    </div>
                  ) : null}
                  <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
                  {message.citations.length ? (
                    <div className="message-sources">
                      {message.citations.map((ref, refIndex) => (
                        <SourceBadge
                          detail={sourceDetail(ref)}
                          key={`${ref.artifactId}-${ref.excerptId || ref.quote}-${refIndex}`}
                          label={ref.sourceLabel}
                          onClick={() => onSource(ref)}
                        />
                      ))}
                    </div>
                  ) : null}
                  {message.role === "assistant" ? (
                    <button
                      className="button button-small"
                      onClick={() => onSuggestEdit(message)}
                      style={{ marginTop: 8 }}
                      type="button"
                    >
                      프로토콜 수정 제안으로 전환
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
            {sending ? (
              <article className="message message-assistant">
                <div className="message-label">ARIA assistant</div>
                <div className="message-bubble">
                  연결된 출처와 미해결 항목을 확인하고 있습니다…
                </div>
              </article>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <footer className="chat-composer">
            <div className="composer-row">
              <label className="field">
                <span className="sr-only">프로토콜 질문</span>
                <textarea
                  className="textarea"
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="예: 다음 연구자가 실험 전에 반드시 확인해야 할 것은?"
                  rows={2}
                  value={question}
                />
              </label>
              <button
                aria-label="질문 보내기"
                className="button button-primary"
                disabled={!question.trim() || sending}
                onClick={() => void send()}
                type="button"
              >
                <Send aria-hidden size={15} />
                보내기
              </button>
            </div>
            <p className="privacy-note" style={{ margin: "6px 0 0" }}>
              근거가 없으면 “업로드된 자료에서는 확인되지 않습니다”라고
              답합니다.
            </p>
          </footer>
        </div>

        <aside className="chat-suggestions">
          <h3>빠른 질문</h3>
          {exampleQuestions.map((item) => (
            <button
              className="question-button"
              disabled={sending}
              key={item}
              onClick={() => void send(item)}
              type="button"
            >
              {item}
            </button>
          ))}
          <div className="ai-idea" style={{ marginTop: 16 }}>
            <strong>공식 프로토콜과 AI 의견 분리</strong>
            <div>
              답변이나 제안은 사용자가 명시적으로 확인하기 전에는 프로토콜
              본문에 합쳐지지 않습니다.
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
