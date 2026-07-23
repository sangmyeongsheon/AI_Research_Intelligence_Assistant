"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileAudio,
  FileImage,
  FileText,
  Link2,
  LoaderCircle,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

export type ProtocolStatus = "draft" | "review" | "approved" | "archived";

export const STATUS_LABELS: Record<ProtocolStatus, string> = {
  draft: "작성 중",
  review: "검토 중",
  approved: "확정",
  archived: "보관됨",
};

export function StatusBadge({ status }: { status: ProtocolStatus }) {
  return (
    <span className={`status status-${status}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function SourceTypeIcon({
  type,
  size = 15,
}: {
  type: string;
  size?: number;
}) {
  if (type === "audio") return <FileAudio aria-hidden size={size} />;
  if (type === "image") return <FileImage aria-hidden size={size} />;
  return <FileText aria-hidden size={size} />;
}

export function SourceBadge({
  label,
  detail,
  onClick,
}: {
  label: string;
  detail?: string;
  onClick?: () => void;
}) {
  return (
    <button
      className="source-badge"
      onClick={onClick}
      title={`${label}${detail ? ` · ${detail}` : ""}`}
      type="button"
    >
      <Link2 aria-hidden size={11} />
      <span>{label}</span>
      {detail ? <span className="mono">{detail}</span> : null}
    </button>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className = "",
  noPadding = false,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <section className={`panel ${className}`}>
      {title || action ? (
        <header className="panel-header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={`panel-body${noPadding ? " no-padding" : ""}`}>
        {children}
      </div>
    </section>
  );
}

export function Modal({
  title,
  description,
  children,
  footer,
  onClose,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      aria-label={title}
      aria-modal="true"
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="dialog"
    >
      <div className="modal">
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            {description ? (
              <p className="page-description">{description}</p>
            ) : null}
          </div>
          <button
            aria-label="닫기"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden size={16} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function InlineNotice({
  kind = "info",
  children,
}: {
  kind?: "info" | "warning" | "danger" | "success";
  children: ReactNode;
}) {
  const className =
    kind === "danger"
      ? "danger-banner"
      : kind === "warning"
        ? "warning-banner"
        : "info-banner";
  const Icon =
    kind === "success"
      ? CheckCircle2
      : kind === "warning" || kind === "danger"
        ? AlertTriangle
        : CheckCircle2;
  return (
    <div className={className} role={kind === "danger" ? "alert" : "status"}>
      <Icon aria-hidden size={16} />
      <div>{children}</div>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div>
        <div className="loading-mark">
          <LoaderCircle aria-hidden size={22} />
        </div>
        <strong>로컬 작업을 복원하고 있습니다</strong>
      </div>
    </div>
  );
}
