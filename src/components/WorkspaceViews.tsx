"use client";

import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Mic,
  Pause,
  PencilLine,
  Play,
  Plus,
  ScanText,
  Send,
  Square,
  UploadCloud,
  WandSparkles,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import type {
  Conflict,
  MissingField,
  SourceArtifact,
  SourceExcerpt,
  SourceRef,
} from "@/src/types";
import { getLabTraceRepository } from "@/src/lib/db";
import { resolveSourceReviewText } from "@/src/lib/files/transcript";
import {
  formatFileSize,
  validateUploadFile,
  type UploadSourceDraft,
} from "@/src/lib/files";
import type { AnalysisStage } from "@/src/stores/useLabTraceStore";
import {
  InlineNotice,
  Panel,
  SourceTypeIcon,
} from "./common";

type UploadTab = "files" | "text" | "transcript" | "record";

type FileDraft = UploadSourceDraft;

const reliabilityLabels = {
  current: "현재 사용 중",
  legacy: "오래된 자료",
  reference: "참고 자료",
  unknown: "알 수 없음",
};

const analysisStages = [
  {
    label: "파일 확인",
    detail: "형식, 용량과 메타데이터를 검증합니다.",
  },
  {
    label: "자료 읽기·전사·OCR",
    detail: "음성, 손글씨, PDF와 텍스트를 한 번에 구조화합니다.",
  },
  {
    label: "실험 단계 분류",
    detail: "evidence unit을 단계, 팁, 실수, troubleshooting으로 분류합니다.",
  },
  {
    label: "조건 정규화",
    detail: "시간, 온도, 농도, 속도와 단위를 정규화합니다.",
  },
  {
    label: "충돌 탐지",
    detail: "같은 조건을 다르게 설명한 근거를 비교합니다.",
  },
  {
    label: "누락 탐지",
    detail: "추측하지 않고 연구자에게 확인할 질문을 만듭니다.",
  },
  {
    label: "프로토콜 생성",
    detail: "원본 출처가 연결된 프로토콜을 생성합니다.",
  },
];

const sourceReliabilityLabels: Record<string, string> = {
  current: "현재 사용 중",
  legacy: "오래된 자료",
  reference: "참고 자료",
  unknown: "알 수 없음",
};

function sourceLocation(ref?: SourceRef) {
  if (!ref) return "";
  if (ref.pageNumber) return `p.${ref.pageNumber}`;
  if (ref.timestampStart !== undefined) {
    const minutes = Math.floor(ref.timestampStart / 60);
    const seconds = Math.floor(ref.timestampStart % 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return "";
}

export function UploadWorkspaceView({
  analyzing = false,
  onAnalyze,
}: {
  analyzing?: boolean;
  onAnalyze: (options: {
    drafts: FileDraft[];
    pastedText?: string;
  }) => void;
}) {
  const [tab, setTab] = useState<UploadTab>("files");
  const [drafts, setDrafts] = useState<FileDraft[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [textAuthor, setTextAuthor] = useState("작성자 미상");
  const [consent, setConsent] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(
      () => setRecordingSeconds((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [recording]);

  const addFiles = (files: File[]) => {
    const additions: FileDraft[] = [];
    const errors: string[] = [];
    files.forEach((file) => {
      const validated = validateUploadFile(file);
      if (!validated.ok) {
        errors.push(
          `${validated.error.title}: ${validated.error.message} ${validated.error.recovery}`,
        );
        return;
      }
      additions.push({
        id: crypto.randomUUID(),
        file,
        name: validated.value.sanitizedFileName,
        type: validated.value.mimeType,
        kind: validated.value.kind,
        size: validated.value.size,
        author: "작성자 미상",
        sourceDate: new Date().toISOString().slice(0, 10),
        reliability: "unknown",
        notes: "",
      });
    });
    if (errors.length) setError(errors.join("\n"));
    if (additions.length) setDrafts((value) => [...value, ...additions]);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  const updateDraft = (
    id: string,
    patch: Partial<Omit<FileDraft, "id">>,
  ) => {
    setDrafts((value) =>
      value.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const addPastedText = () => {
    if (!pastedText.trim()) {
      setError("붙여넣은 텍스트가 비어 있습니다. 내용을 입력해 주세요.");
      return;
    }
    const kind = tab === "transcript" ? "transcript" : "text";
    setDrafts((value) => [
      ...value,
      {
        id: crypto.randomUUID(),
        name:
          tab === "transcript"
            ? "pasted-transcript.txt"
            : "direct-note.txt",
        type: "text/plain",
        kind,
        size: new Blob([pastedText]).size,
        author: textAuthor.trim() || "작성자 미상",
        sourceDate: new Date().toISOString().slice(0, 10),
        reliability: "current",
        notes: pastedText.slice(0, 120),
        textContent: pastedText,
      },
    ]);
    setPastedText("");
    setError(null);
    setTab("files");
  };

  const startRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(
        "이 브라우저에서는 직접 녹음을 지원하지 않습니다. 휴대폰이나 녹음 앱에서 WAV 또는 M4A로 저장해 업로드해 주세요.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      mediaChunksRef.current = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size) mediaChunksRef.current.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        const blob = new Blob(mediaChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const file = new File(
          [blob],
          `labtrace-recording-${Date.now()}.ogg`,
          { type: blob.type || "audio/ogg" },
        );
        setDrafts((value) => [
          ...value,
          {
            id: crypto.randomUUID(),
            file,
            name: file.name,
            type: file.type,
            kind: "audio",
            size: file.size,
            author: "현재 사용자",
            sourceDate: new Date().toISOString().slice(0, 10),
            reliability: "current",
            notes: "브라우저에서 직접 녹음",
          },
        ]);
        stream.getTracks().forEach((track) => track.stop());
      });
      recorder.start();
      setRecordingSeconds(0);
      setRecording(true);
    } catch {
      setError(
        "마이크를 사용할 수 없습니다. 브라우저 권한을 확인하거나 오디오 파일을 업로드해 주세요. 기존 자료는 보존되어 있습니다.",
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const canAnalyze = drafts.length > 0 && consent && !analyzing;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">새 프로토콜 만들기</h1>
          <p className="page-description">
            음성, 손글씨 이미지, PDF, 메모와 기존 전사 결과를 한 번에 추가한 뒤
            작성자와 자료 시점을 확인합니다.
          </p>
        </div>
      </header>

      <div className="workspace">
        <div className="stack">
          <Panel title="자료 추가">
            <div className="upload-tabs" role="tablist">
              {[
                ["files", "파일 업로드", UploadCloud],
                ["text", "직접 메모", PencilLine],
                ["transcript", "전사 붙여넣기", ScanText],
                ["record", "직접 녹음", Mic],
              ].map(([value, label, Icon]) => (
                <button
                  aria-selected={tab === value}
                  className="upload-tab"
                  key={String(value)}
                  onClick={() => setTab(value as UploadTab)}
                  role="tab"
                  type="button"
                >
                  <Icon aria-hidden size={13} /> {String(label)}
                </button>
              ))}
            </div>

            {tab === "files" ? (
              <>
                <label
                  className={`dropzone${dragging ? " is-dragging" : ""}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={onDrop}
                >
                  <input
                    accept=".txt,.md,.pdf,.jpg,.jpeg,.png,.mp3,.wav,.m4a,.aac,.ogg,.flac"
                    className="sr-only"
                    multiple
                    onChange={(event) =>
                      addFiles(Array.from(event.target.files || []))
                    }
                    ref={fileInputRef}
                    type="file"
                  />
                  <span>
                    <span className="dropzone-icon">
                      <UploadCloud aria-hidden size={21} />
                    </span>
                    <strong>여러 자료를 끌어놓거나 클릭해 선택</strong>
                    <p>
                      파일은 브라우저에 보관됩니다. 분석을 시작할 때 선택한
                      내용이 연결된 AI 서비스로 전송될 수 있습니다.
                    </p>
                    <span className="button button-small">파일 선택</span>
                    <span className="support-line">
                      TXT · MD · PDF · JPG · PNG · MP3 · WAV · M4A/AAC · OGG ·
                      FLAC
                    </span>
                  </span>
                </label>
              </>
            ) : null}

            {tab === "text" || tab === "transcript" ? (
              <div className="stack">
                <label className="field">
                  <span>작성자 또는 발화자</span>
                  <input
                    className="input"
                    onChange={(event) => setTextAuthor(event.target.value)}
                    value={textAuthor}
                  />
                </label>
                <label className="field">
                  <span>
                    {tab === "transcript" ? "기존 전사 결과" : "직접 입력 메모"}
                  </span>
                  <textarea
                    className="textarea"
                    onChange={(event) => setPastedText(event.target.value)}
                    placeholder={
                      tab === "transcript"
                        ? "다글로 등에서 만든 전사 결과를 붙여넣으세요."
                        : "메신저나 연구 노트 내용을 붙여넣으세요."
                    }
                    rows={9}
                    value={pastedText}
                  />
                </label>
                <div>
                  <button
                    className="button button-primary"
                    onClick={addPastedText}
                    type="button"
                  >
                    <Plus aria-hidden size={14} /> 자료 목록에 추가
                  </button>
                </div>
              </div>
            ) : null}

            {tab === "record" ? (
              <div className="audio-player">
                <div className="audio-controls">
                  <button
                    aria-label={recording ? "녹음 중지" : "녹음 시작"}
                    className={`icon-button${recording ? " button-danger" : ""}`}
                    onClick={recording ? stopRecording : startRecording}
                    type="button"
                  >
                    {recording ? (
                      <Square aria-hidden size={15} />
                    ) : (
                      <Mic aria-hidden size={16} />
                    )}
                  </button>
                  <div>
                    <strong>
                      {recording ? "녹음 중" : "마이크로 인수인계 녹음"}
                    </strong>
                    <p className="page-description" style={{ marginTop: 2 }}>
                      녹음을 마치면 오디오가 자료 목록에 바로 추가됩니다.
                    </p>
                  </div>
                  <span className="mono">
                    {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:
                    {String(recordingSeconds % 60).padStart(2, "0")}
                  </span>
                </div>
              </div>
            ) : null}

            {error ? (
              <div style={{ marginTop: 12 }}>
                <InlineNotice kind="danger">
                  <strong>자료를 추가하지 못했습니다</strong>
                  <div style={{ whiteSpace: "pre-line" }}>{error}</div>
                  <span>이미 추가한 자료는 그대로 보존되었습니다.</span>
                </InlineNotice>
              </div>
            ) : null}
          </Panel>

          {drafts.length ? (
            <Panel
              action={<span className="mono">{drafts.length} sources</span>}
              description="카드에서 작성자, 날짜와 자료 성격을 빠르게 보완하세요."
              title="분석할 자료"
            >
              <div className="file-list">
                {drafts.map((draft) => (
                  <article className="file-card" key={draft.id}>
                    <span className="source-type-icon">
                      <SourceTypeIcon type={draft.kind} />
                    </span>
                    <div className="file-card-main">
                      <div className="file-card-title">
                        <strong title={draft.name}>{draft.name}</strong>
                        <span className="tag">{draft.kind.toUpperCase()}</span>
                      </div>
                      <div className="file-card-meta">
                        {formatFileSize(draft.size)} · {draft.type}
                      </div>
                      <div className="file-meta-grid">
                        <label className="field">
                          <span>작성자/발화자</span>
                          <input
                            className="input"
                            onChange={(event) =>
                              updateDraft(draft.id, {
                                author: event.target.value,
                              })
                            }
                            value={draft.author}
                          />
                        </label>
                        <label className="field">
                          <span>자료 작성일</span>
                          <input
                            className="input"
                            onChange={(event) =>
                              updateDraft(draft.id, {
                                sourceDate: event.target.value,
                              })
                            }
                            type="date"
                            value={draft.sourceDate}
                          />
                        </label>
                        <label className="field">
                          <span>자료 성격</span>
                          <select
                            className="select"
                            onChange={(event) =>
                              updateDraft(draft.id, {
                                reliability: event.target
                                  .value as FileDraft["reliability"],
                              })
                            }
                            value={draft.reliability}
                          >
                            {Object.entries(reliabilityLabels).map(
                              ([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <label className="field">
                          <span>설명 또는 비고</span>
                          <input
                            className="input"
                            onChange={(event) =>
                              updateDraft(draft.id, {
                                notes: event.target.value,
                              })
                            }
                            placeholder="선택 입력"
                            value={draft.notes}
                          />
                        </label>
                      </div>
                    </div>
                    <button
                      aria-label={`${draft.name} 제거`}
                      className="icon-button"
                      onClick={() =>
                        setDrafts((value) =>
                          value.filter((item) => item.id !== draft.id),
                        )
                      }
                      type="button"
                    >
                      <X aria-hidden size={14} />
                    </button>
                  </article>
                ))}
              </div>
            </Panel>
          ) : null}
        </div>

        <aside className="stack">
          <Panel title="분석 준비">
            <div className="health-list">
              <div className="health-row">
                {drafts.length ? (
                  <CheckCircle2 aria-hidden color="var(--success)" size={15} />
                ) : (
                  <Circle aria-hidden size={15} />
                )}
                <div>
                  <strong>자료 추가</strong>
                  <span>최소 1개 자료가 필요합니다</span>
                </div>
                <span className="mono">{drafts.length}</span>
              </div>
              <div className="health-row">
                {drafts.every((draft) => draft.author.trim()) &&
                drafts.length ? (
                  <CheckCircle2 aria-hidden color="var(--success)" size={15} />
                ) : (
                  <Circle aria-hidden size={15} />
                )}
                <div>
                  <strong>작성자 메타데이터</strong>
                  <span>없으면 작성자 미상 사용</span>
                </div>
                <span className="mono">
                  {drafts.filter((draft) => draft.author.trim()).length}/
                  {drafts.length}
                </span>
              </div>
            </div>

            <label className="consent-box">
              <input
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                type="checkbox"
              />
              <span>
                외부 AI API가 활성화된 경우 선택한 자료가 외부 모델 제공자에게
                전송될 수 있습니다. 기밀 연구자료는 기관 정책을 확인한 뒤
                사용하세요.
              </span>
            </label>

            <button
              className="button button-primary"
              disabled={!canAnalyze}
              onClick={() =>
                onAnalyze({
                  drafts,
                  pastedText,
                })
              }
              style={{ marginTop: 12, width: "100%" }}
              type="button"
            >
              <WandSparkles aria-hidden size={15} />{" "}
              {analyzing ? "자료 준비 중..." : "자료 분석 시작"}
            </button>
          </Panel>

          <Panel title="처리 방식">
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              <li>여러 자료를 한 번에 읽어 evidence unit 추출</li>
              <li>단계·조건·팁·실패 경험 분류</li>
              <li>숫자와 단위 정규화</li>
              <li>충돌과 누락을 숨기지 않고 표시</li>
              <li>단계별 원본 출처 연결</li>
            </ol>
            <p className="privacy-note" style={{ marginBottom: 0 }}>
              자료에 없는 수치나 위험한 조건은 자동으로 채우지 않습니다.
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

export function AnalysisProgressView({
  fileNames,
  onComplete,
  onCancel,
  complete,
  failed,
  errorMessage,
  progress,
  stage,
  statusText,
  onRetry,
}: {
  fileNames: string[];
  onComplete: () => void;
  onCancel: () => void;
  complete: boolean;
  failed: boolean;
  errorMessage?: string | null;
  progress: number;
  stage: AnalysisStage;
  statusText?: string;
  onRetry?: () => void;
}) {
  const stageIndexes: Record<AnalysisStage, number> = {
    idle: 0,
    extracting: 1,
    merging: 3,
    detecting: 5,
    generating: 6,
    complete: 6,
    error:
      progress >= 84
        ? 6
        : progress >= 70
          ? 5
          : progress >= 52
            ? 3
            : progress >= 10
              ? 1
              : 0,
  };
  const currentStage = stageIndexes[stage];
  const done = complete;

  useEffect(() => {
    if (!done) return;
    const timeout = window.setTimeout(onComplete, 650);
    return () => window.clearTimeout(timeout);
  }, [done, onComplete]);

  const percent = done ? 100 : Math.max(0, Math.min(99, Math.round(progress)));
  const currentFile =
    fileNames[currentStage % Math.max(1, fileNames.length)] ||
    "업로드한 자료";

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">자료 분석 중</h1>
          <p className="page-description">
            각 자료를 evidence 단위로 분리한 뒤 서로 비교하고 있습니다.
          </p>
        </div>
        <div className="page-actions">
          {failed && onRetry ? (
            <button
              className="button button-primary"
              onClick={onRetry}
              type="button"
            >
              같은 자료로 다시 시도
            </button>
          ) : null}
          <button className="button" onClick={onCancel} type="button">
            {failed ? "자료 화면으로 돌아가기" : "분석 취소"}
          </button>
        </div>
      </header>

      <section className="analysis-card">
        <div className="analysis-summary">
          <div>
            <strong>
              {failed
                ? "분석을 완료하지 못했습니다"
                : done
                ? "분석 결과를 저장했습니다"
                : analysisStages[currentStage].label}
            </strong>
            <p className="page-description">
              {failed
                ? "오류 안내를 확인한 뒤 다시 시도하세요. 기존 자료는 보존되었습니다."
                : done
                ? "충돌과 누락 항목을 검토 화면에 준비했습니다."
                : statusText || `현재 파일: ${currentFile}`}
            </p>
            <div
                aria-label={`분석 진행률 ${percent}%`}
                className="progress-track"
                role="progressbar"
              >
              <div
                className="progress-fill"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
          <div className="progress-number">{percent}%</div>
        </div>
        {failed ? (
          <InlineNotice kind="danger">
            <strong>분석 요청을 완료하지 못했습니다.</strong>{" "}
            {errorMessage ||
              "일시적인 연결 오류가 반복되었습니다. 업로드 자료는 보존되었으므로 다시 시도해 주세요."}
          </InlineNotice>
        ) : null}
        <div className="stage-list">
          {analysisStages.map((stage, index) => {
            const complete = index < currentStage || done;
            const active = index === currentStage && !done && !failed;
            const errorStage = index === currentStage && failed;
            return (
              <div
                className={`stage${complete ? " is-complete" : ""}${active ? " is-active" : ""}${errorStage ? " is-error" : ""}`}
                key={stage.label}
              >
                <span className="stage-marker">
                  <span className="stage-marker-content">
                    {complete ? (
                      <Check aria-hidden size={12} />
                    ) : errorStage ? (
                      <AlertCircle aria-hidden size={12} />
                    ) : (
                      String(index + 1).padStart(2, "0")
                    )}
                  </span>
                </span>
                <div>
                  <strong>{stage.label}</strong>
                  <span>{stage.detail}</span>
                </div>
                <span>
                  {complete
                    ? "완료"
                    : errorStage
                      ? "재시도 실패"
                      : active
                        ? "처리 중"
                        : "대기"}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function SourceReviewView({
  sources,
  excerpts,
  onUpdateSource,
  onContinue,
}: {
  sources: SourceArtifact[];
  excerpts: SourceExcerpt[];
  onUpdateSource: (sourceId: string, patch: Partial<SourceArtifact>) => void;
  onContinue: () => void;
}) {
  const [selectedId, setSelectedId] = useState(sources[0]?.id || "");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [playing, setPlaying] = useState(false);
  const [audioTime, setAudioTime] = useState(13);
  const [blobPreview, setBlobPreview] = useState<{
    key: string;
    url: string;
  } | null>(null);
  const selected =
    sources.find((source) => source.id === selectedId) || sources[0];
  const sourceExcerpts = excerpts.filter(
    (excerpt) => excerpt.sourceArtifactId === selected?.id,
  );

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setAudioTime((value) => (value >= 54 ? 0 : value + 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    const key = selected?.localBlobKey;
    if (!key) return;
    let cancelled = false;
    let objectUrl = "";
    void getLabTraceRepository()
      .getBlob(key)
      .then((record) => {
        if (!record || cancelled) return;
        objectUrl = URL.createObjectURL(record.blob);
        setBlobPreview({ key, url: objectUrl });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selected?.localBlobKey]);

  if (!selected) {
    return (
      <div className="page">
        <div className="empty-state">
          <p>검토할 자료가 없습니다.</p>
        </div>
      </div>
    );
  }

  const extractedDisplayText = resolveSourceReviewText(
    selected,
    sourceExcerpts,
  );
  const displayText = editing ? draftText : extractedDisplayText;
  const confidence =
    sourceExcerpts.length > 0
      ? sourceExcerpts.reduce((sum, item) => sum + item.confidence, 0) /
        sourceExcerpts.length
      : 0.88;
  const previewUrl =
    blobPreview && blobPreview.key === selected.localBlobKey
      ? blobPreview.url
      : null;
  const imagePreviewUrl = previewUrl;
  const pdfPreviewUrl = previewUrl;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">인식된 원본 자료 검토</h1>
          <p className="page-description">
            원본과 추출·전사 결과를 비교해 인식 오류를 수정하세요. 수정 내용은
            user-corrected로 기록됩니다.
          </p>
        </div>
        <button
          className="button button-primary"
          onClick={onContinue}
          type="button"
        >
          충돌 및 누락 검토 <ChevronRight aria-hidden size={15} />
        </button>
      </header>

      <section className="source-review-layout">
        <aside className="source-list-pane">
          <div className="pane-header">업로드 자료 · {sources.length}</div>
          {sources.map((source) => (
            <button
              aria-pressed={selected.id === source.id}
              className="source-list-button"
              key={source.id}
              onClick={() => {
                setSelectedId(source.id);
                setDraftText(source.extractedText || "");
                setEditing(false);
                setPage(1);
                setPlaying(false);
              }}
              type="button"
            >
              <span className="source-type-icon">
                <SourceTypeIcon type={source.type} />
              </span>
              <span>
                <strong title={source.fileName}>
                  {source.displayName || source.fileName}
                </strong>
                <span>
                  {source.author} ·{" "}
                  {sourceReliabilityLabels[source.reliability]}
                </span>
              </span>
            </button>
          ))}
        </aside>

        <div className="source-document-pane">
          <div className="document-toolbar">
            <div className="inline-meta">
              <span className="tag">{selected.type.toUpperCase()}</span>
              <strong>{selected.displayName || selected.fileName}</strong>
            </div>
            <div className="toolbar">
              {selected.type === "pdf" ? (
                <>
                  <button
                    aria-label="이전 페이지"
                    className="icon-button"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    type="button"
                  >
                    <ChevronLeft aria-hidden size={14} />
                  </button>
                  <span className="mono">p.{page} / 2</span>
                  <button
                    aria-label="다음 페이지"
                    className="icon-button"
                    disabled={page >= 2}
                    onClick={() => setPage((value) => Math.min(2, value + 1))}
                    type="button"
                  >
                    <ChevronRight aria-hidden size={14} />
                  </button>
                </>
              ) : null}
              <button
                className="button button-small"
                onClick={() => {
                  if (editing) {
                    onUpdateSource(selected.id, {
                      extractedText: draftText,
                      notes: `${selected.notes}${selected.notes ? " · " : ""}user-corrected`,
                    });
                  } else {
                    setDraftText(extractedDisplayText);
                  }
                  setEditing((value) => !value);
                }}
                type="button"
              >
                <PencilLine aria-hidden size={13} />
                {editing ? "수정 저장" : "인식 결과 수정"}
              </button>
            </div>
          </div>

          <div className="document-viewer">
            {selected.type === "image" ? (
              imagePreviewUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="손글씨 transfer 조건 메모"
                    className="image-preview"
                    src={imagePreviewUrl}
                  />
                </>
              ) : (
                <div className="document-paper">
                  원본 이미지 미리보기를 불러오는 중입니다.
                </div>
              )
            ) : null}

            {selected.type === "pdf" ? (
              pdfPreviewUrl ? (
                <iframe
                  className="pdf-frame"
                  src={`${pdfPreviewUrl}#page=${page}`}
                  title={`${selected.displayName} ${page}페이지`}
                />
              ) : (
                <div className="document-paper">
                  원본 PDF 미리보기를 불러오는 중입니다.
                </div>
              )
            ) : null}

            {selected.type === "audio" ? (
              <div className="audio-player">
                {previewUrl ? (
                  <audio controls src={previewUrl}>
                    이 브라우저는 오디오 재생을 지원하지 않습니다.
                  </audio>
                ) : (
                  <div className="audio-controls">
                    <button
                      aria-label={playing ? "재생 일시 정지" : "재생"}
                      className="icon-button"
                      onClick={() => setPlaying((value) => !value)}
                      type="button"
                    >
                      {playing ? (
                        <Pause aria-hidden size={15} />
                      ) : (
                        <Play aria-hidden size={15} />
                      )}
                    </button>
                    <input
                      aria-label="오디오 재생 위치"
                      className="audio-timeline"
                      max={54}
                      min={0}
                      onChange={(event) =>
                        setAudioTime(Number(event.target.value))
                      }
                      type="range"
                      value={audioTime}
                    />
                    <span className="mono">
                      00:{String(audioTime).padStart(2, "0")} / 00:54
                    </span>
                  </div>
                )}
              </div>
            ) : null}

            {selected.type !== "pdf" || editing ? (
              <div className="document-paper">
                <h3>
                  {editing
                    ? "사용자 수정본"
                    : selected.type === "audio"
                      ? "전체 전사본"
                      : "추출된 텍스트"}
                </h3>
                {editing ? (
                  <textarea
                    aria-label="인식 결과 수정"
                    className="document-edit"
                    onChange={(event) => setDraftText(event.target.value)}
                    value={draftText}
                  />
                ) : (
                  displayText
                    .split(/\n+/)
                    .filter(Boolean)
                    .map((paragraph, index) => (
                      <p key={`${paragraph.slice(0, 12)}-${index}`}>
                        {paragraph}
                      </p>
                    ))
                )}
              </div>
            ) : null}
          </div>
        </div>

        <aside className="source-meta-pane">
          <div className="pane-header">메타데이터 및 인식 품질</div>
          <dl className="meta-list">
            <div className="meta-row">
              <dt>파일명</dt>
              <dd title={selected.fileName}>{selected.fileName}</dd>
            </div>
            <div className="meta-row">
              <dt>작성자 또는 발화자</dt>
              <dd>{selected.author}</dd>
            </div>
            <div className="meta-row">
              <dt>자료 작성일</dt>
              <dd className="mono">{selected.sourceDate.slice(0, 10)}</dd>
            </div>
            <div className="meta-row">
              <dt>자료 성격</dt>
              <dd>{sourceReliabilityLabels[selected.reliability]}</dd>
            </div>
            <div className="meta-row">
              <dt>처리 상태</dt>
              <dd>
                <span className="status status-approved">추출 완료</span>
              </dd>
            </div>
            <div className="meta-row">
              <dt>인식 신뢰도</dt>
              <dd className="confidence">
                <span className="confidence-meter">
                  <span style={{ width: `${Math.round(confidence * 100)}%` }} />
                </span>
                <strong className="mono">{Math.round(confidence * 100)}%</strong>
              </dd>
            </div>
            <div className="meta-row">
              <dt>비고</dt>
              <dd>{selected.notes || "비고 없음"}</dd>
            </div>
          </dl>
        </aside>
      </section>
    </div>
  );
}

function ConflictCard({
  conflict,
  onResolve,
}: {
  conflict: Conflict;
  onResolve: (id: string, resolution?: string, note?: string) => void;
}) {
  const [selected, setSelected] = useState(
    conflict.selectedResolution || "unresolved",
  );
  const [custom, setCustom] = useState("");
  const resolved = conflict.status === "resolved";

  return (
    <article className="conflict-card">
      <header className="review-card-header">
        <div>
          <h3>{conflict.field}</h3>
          <p>{conflict.description}</p>
        </div>
        <span
          className={`status ${resolved ? "status-approved" : "status-draft"}`}
        >
          {resolved ? "해결됨" : "미해결"}
        </span>
      </header>
      <div
        className="source-compare"
        style={{
          gridTemplateColumns: `repeat(${Math.min(3, conflict.options.length)}, minmax(0, 1fr))`,
        }}
      >
        {conflict.options.map((option, index) => {
          const ref = option.sourceRefs[0];
          return (
            <label className="source-option" key={option.id}>
              <input
                checked={selected === option.value}
                name={`conflict-${conflict.id}`}
                onChange={() => setSelected(option.value)}
                type="radio"
              />
              <span>
                <span className="tag">출처 {String.fromCharCode(65 + index)}</span>
                <strong>{option.value}</strong>
                <blockquote>{ref?.quote || option.label}</blockquote>
                <span className="inline-meta">
                  <span>{ref?.author || "작성자 미상"}</span>
                  <span className="mono">{sourceLocation(ref)}</span>
                  <span>{option.label}</span>
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <footer className="review-card-footer">
        <label className="field">
          <span>직접 입력 또는 해결 메모</span>
          <input
            className="input"
            onChange={(event) => setCustom(event.target.value)}
            placeholder="예: 현재 장비에서는 100 V / 60 min으로 확인함"
            value={custom}
          />
        </label>
        <button
          className="button"
          onClick={() => {
            setSelected("unresolved");
            onResolve(conflict.id, undefined, custom);
          }}
          type="button"
        >
          아직 결정하지 않음
        </button>
        <button
          className="button button-primary"
          disabled={selected === "unresolved" && !custom.trim()}
          onClick={() =>
            onResolve(
              conflict.id,
              custom.trim() || selected,
              custom.trim() ? "연구자 직접 입력" : undefined,
            )
          }
          type="button"
        >
          <Check aria-hidden size={14} /> 결정 저장
        </button>
      </footer>
    </article>
  );
}

function MissingCard({
  missing,
  onAnswer,
}: {
  missing: MissingField;
  onAnswer: (id: string, answer?: string, dismissed?: boolean) => void;
}) {
  const [answer, setAnswer] = useState(missing.userAnswer || "");
  const resolved = missing.status !== "unresolved";

  return (
    <article className="missing-card">
      <header className="review-card-header">
        <div>
          <h3>{missing.field}</h3>
          <p>{missing.reason}</p>
        </div>
        <span
          className={`status ${resolved ? "status-approved" : "status-review"}`}
        >
          {resolved ? (missing.status === "dismissed" ? "보류" : "답변됨") : "확인 필요"}
        </span>
      </header>
      <div className="panel-body">
        <div className="notice">
          <AlertCircle aria-hidden size={16} />
          <div>
            <strong>담당 연구자에게 확인할 질문</strong>
            <div>{missing.question}</div>
          </div>
        </div>
      </div>
      <footer className="review-card-footer">
        <label className="field">
          <span>연구자 답변</span>
          <input
            className="input"
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="답변은 user-confirmed source로 기록됩니다"
            value={answer}
          />
        </label>
        <button
          className="button"
          onClick={() => onAnswer(missing.id, undefined, true)}
          type="button"
        >
          나중에 확인
        </button>
        <button
          className="button button-primary"
          disabled={!answer.trim()}
          onClick={() => onAnswer(missing.id, answer.trim(), false)}
          type="button"
        >
          <Send aria-hidden size={14} /> 답변 저장
        </button>
      </footer>
    </article>
  );
}

export function ConflictReviewView({
  conflicts,
  missingFields,
  lowConfidenceCount,
  onResolveConflict,
  onAnswerMissing,
  onBack,
  onOpenDraft,
}: {
  conflicts: Conflict[];
  missingFields: MissingField[];
  lowConfidenceCount: number;
  onResolveConflict: (
    id: string,
    resolution?: string,
    note?: string,
  ) => void;
  onAnswerMissing: (
    id: string,
    answer?: string,
    dismissed?: boolean,
  ) => void;
  onBack: () => void;
  onOpenDraft: () => void;
}) {
  const unresolvedConflicts = conflicts.filter(
    (item) => item.status === "unresolved",
  ).length;
  const unresolvedMissing = missingFields.filter(
    (item) => item.status === "unresolved",
  ).length;
  const [view, setView] = useState<"all" | "conflicts" | "missing">("all");

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <button
            className="button button-small button-quiet"
            onClick={onBack}
            type="button"
          >
            <ChevronLeft aria-hidden size={14} /> 자료 검토로 돌아가기
          </button>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            충돌 및 누락 검토
          </h1>
          <p className="page-description">
            서로 다른 값은 함께 보여주고, 자료에서 확인되지 않은 조건은
            추측하지 않습니다. 미해결 항목을 표시한 상태로 프로토콜을 열 수
            있습니다.
          </p>
        </div>
        <button
          className="button button-primary"
          onClick={onOpenDraft}
          type="button"
        >
          프로토콜 열기 <ChevronRight aria-hidden size={15} />
        </button>
      </header>

      <section className="review-summary">
        <button
          className="review-summary-item button-quiet"
          onClick={() => setView("conflicts")}
          type="button"
        >
          <span>미해결 충돌</span>
          <strong>{unresolvedConflicts}</strong>
        </button>
        <button
          className="review-summary-item button-quiet"
          onClick={() => setView("missing")}
          type="button"
        >
          <span>미해결 누락</span>
          <strong>{unresolvedMissing}</strong>
        </button>
        <div className="review-summary-item">
          <span>낮은 인식 신뢰도</span>
          <strong>{lowConfidenceCount}</strong>
        </div>
      </section>

      <div className="toolbar" style={{ marginBottom: 12 }}>
        {[
          ["all", "전체"],
          ["conflicts", `충돌 ${conflicts.length}건`],
          ["missing", `누락 ${missingFields.length}건`],
        ].map(([value, label]) => (
          <button
            className={`button button-small${view === value ? " button-primary" : ""}`}
            key={value}
            onClick={() => setView(value as typeof view)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="review-stack">
        {view !== "missing"
          ? conflicts.map((conflict) => (
              <ConflictCard
                conflict={conflict}
                key={conflict.id}
                onResolve={onResolveConflict}
              />
            ))
          : null}
        {view !== "conflicts"
          ? missingFields.map((missing) => (
              <MissingCard
                key={missing.id}
                missing={missing}
                onAnswer={onAnswerMissing}
              />
            ))
          : null}
      </div>

      <div style={{ marginTop: 16 }}>
        <InlineNotice kind="warning">
          <strong>
            미해결 {unresolvedConflicts + unresolvedMissing}건이 남아 있습니다.
          </strong>
          <div>
            프로토콜을 열람하고 편집할 수 있으며, 미해결 항목은 상태를
            확정하기 전에 확인해야 합니다.
          </div>
        </InlineNotice>
      </div>
    </div>
  );
}
