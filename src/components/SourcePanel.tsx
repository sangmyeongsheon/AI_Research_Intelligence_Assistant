"use client";

import { CalendarDays, Gauge, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getLabTraceRepository } from "@/src/lib/db";
import { SourceTypeIcon } from "./common";

export interface SourcePanelRef {
  artifactId: string;
  excerptId?: string;
  sourceLabel?: string;
  author?: string;
  pageNumber?: number;
  timestampStart?: number;
  timestampEnd?: number;
  quote?: string;
  confidence?: number;
}

export interface SourcePanelArtifact {
  id: string;
  type: string;
  fileName: string;
  displayName?: string;
  author?: string;
  sourceDate?: string;
  reliability?: string;
  extractedText?: string;
  notes?: string;
  localBlobKey?: string;
  mimeType?: string;
}

const reliabilityLabels: Record<string, string> = {
  current: "현재 사용 중",
  legacy: "오래된 자료",
  reference: "참고 자료",
  unknown: "알 수 없음",
};

function formatSeconds(value?: number) {
  if (value === undefined) return "";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function SourcePanel({
  sourceRef,
  artifact,
  onClose,
}: {
  sourceRef: SourcePanelRef | null;
  artifact?: SourcePanelArtifact;
  onClose: () => void;
}) {
  const [blobPreview, setBlobPreview] = useState<{
    key: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    const key = artifact?.localBlobKey;
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
  }, [artifact?.localBlobKey]);

  if (!sourceRef) return null;

  const label =
    artifact?.displayName ||
    sourceRef.sourceLabel ||
    artifact?.fileName ||
    "원본 자료";
  const detail =
    sourceRef.pageNumber !== undefined
      ? `PDF ${sourceRef.pageNumber}페이지`
      : sourceRef.timestampStart !== undefined
        ? `${formatSeconds(sourceRef.timestampStart)}–${formatSeconds(sourceRef.timestampEnd)}`
        : "추출 원문";
  const previewUrl =
    blobPreview && blobPreview.key === artifact?.localBlobKey
      ? blobPreview.url
      : null;
  return (
    <>
      <div className="source-panel-backdrop" onClick={onClose} />
      <aside aria-label="원본 근거" className="source-panel">
        <header className="source-panel-header">
          <div>
            <h2>원본 근거</h2>
            <p>{label}</p>
          </div>
          <button
            aria-label="출처 패널 닫기"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden size={16} />
          </button>
        </header>
        <div className="source-panel-content">
          <div className="inline-meta">
            <span className="source-type-icon">
              <SourceTypeIcon type={artifact?.type || "text"} />
            </span>
            <strong>{label}</strong>
            <span className="tag">
              {reliabilityLabels[artifact?.reliability || "unknown"]}
            </span>
          </div>

          <dl className="meta-list">
            <div className="meta-row">
              <dt>
                <UserRound aria-hidden size={11} /> 작성자 또는 발화자
              </dt>
              <dd>{sourceRef.author || artifact?.author || "작성자 미상"}</dd>
            </div>
            <div className="meta-row">
              <dt>
                <CalendarDays aria-hidden size={11} /> 자료 작성일
              </dt>
              <dd>{artifact?.sourceDate || "날짜 미상"}</dd>
            </div>
            <div className="meta-row">
              <dt>위치</dt>
              <dd className="mono">{detail}</dd>
            </div>
            <div className="meta-row">
              <dt>
                <Gauge aria-hidden size={11} /> 인식 신뢰도
              </dt>
              <dd className="confidence">
                <span className="confidence-meter">
                  <span
                    style={{
                      width: `${Math.round((sourceRef.confidence ?? 0.86) * 100)}%`,
                    }}
                  />
                </span>
                <strong className="mono">
                  {Math.round((sourceRef.confidence ?? 0.86) * 100)}%
                </strong>
              </dd>
            </div>
          </dl>

          <h3 className="field-label">원문 일부</h3>
          <blockquote className="excerpt">
            {sourceRef.quote ||
              artifact?.extractedText ||
              "연결된 원문 일부를 찾을 수 없습니다. 자료 검토 화면에서 출처 연결을 확인하세요."}
          </blockquote>

          <h3 className="field-label">원본 미리보기</h3>
          <div className="source-preview-mini">
            {artifact?.type === "image" && previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={`${label} 원본`}
                src={previewUrl}
              />
            ) : artifact?.type === "pdf" && previewUrl ? (
              <iframe
                src={`${previewUrl}#page=${sourceRef.pageNumber || 1}`}
                title={`${label} PDF 미리보기`}
              />
            ) : artifact?.type === "audio" && previewUrl ? (
              <audio controls src={previewUrl}>
                이 브라우저는 오디오 재생을 지원하지 않습니다.
              </audio>
            ) : artifact?.type === "pdf" ? (
              <span>PDF · {detail}</span>
            ) : artifact?.type === "audio" ? (
              <span>Audio transcript · {detail}</span>
            ) : (
              <span>{artifact?.fileName || "텍스트 자료"}</span>
            )}
          </div>

          <p className="privacy-note">
            출처 배지는 AI가 연결한 근거 위치입니다. 최종 승인 전 원본 파일과
            인식 결과를 함께 확인하세요.
          </p>
        </div>
      </aside>
    </>
  );
}
