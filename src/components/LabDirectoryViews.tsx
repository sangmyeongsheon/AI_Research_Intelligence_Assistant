"use client";

import {
  ArrowLeft,
  BookOpen,
  Building2,
  ChevronRight,
  FlaskConical,
  LockKeyhole,
  MessageCircleQuestion,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  PRODUCT_CONFIG,
  publicAssetPath,
} from "@/src/config/product";
import { answerGuideQuestion } from "@/src/lib/guide";
import {
  DIRECTORY_DEPARTMENTS,
  DIRECTORY_LABS,
  getDepartment,
  getDirectoryLab,
} from "@/src/lib/lab-directory";
import type { Protocol } from "@/src/types";
import { Panel } from "./common";

export type WorkspaceViewMode = "visitor" | "researcher";

interface DirectoryNavigationProps {
  currentLabId?: string;
  onOpenProfile: (labId: string) => void;
  onOpenWorkspace: (labId: string) => void;
  viewMode: WorkspaceViewMode;
}

export function LabDirectoryView({
  onSelectDepartment,
}: {
  onSelectDepartment: (departmentId: string) => void;
}) {
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    DIRECTORY_LABS.forEach((lab) => {
      if (!lab.departmentId) return;
      result.set(lab.departmentId, (result.get(lab.departmentId) ?? 0) + 1);
    });
    return result;
  }, []);

  return (
    <div className="page directory-page">
      <header className="page-header">
        <div>
          <p className="page-kicker">LAB DIRECTORY</p>
          <h1 className="page-title">연구실 디렉터리</h1>
          <p className="page-description">
            학과와 연구 분야를 살펴본 뒤 공개 연구실 소개 또는 연결된
            프로토콜 작업 공간으로 이동하세요.
          </p>
        </div>
      </header>

      <div className="department-grid">
        {DIRECTORY_DEPARTMENTS.map((department) => (
          <button
            className="department-card"
            key={department.id}
            onClick={() => onSelectDepartment(department.id)}
            type="button"
          >
            <span
              aria-hidden
              className="department-accent"
              style={{ backgroundColor: department.color }}
            />
            <span className="department-card-copy">
              <strong>{department.name}</strong>
              <span>{department.nameEn}</span>
              <small>{department.description}</small>
            </span>
            <span className="department-card-footer">
              연구실 {counts.get(department.id) ?? 0}개
              <ChevronRight aria-hidden size={15} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function DepartmentLabsView({
  departmentId,
  currentLabId,
  onBack,
  onOpenProfile,
  onOpenWorkspace,
  protocols,
  unresolvedCount,
  viewMode,
}: DirectoryNavigationProps & {
  departmentId: string;
  onBack: () => void;
  protocols: Protocol[];
  unresolvedCount: number;
}) {
  const [query, setQuery] = useState("");
  const department = getDepartment(departmentId);
  const labs = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko-KR");
    return DIRECTORY_LABS.filter(
      (lab) =>
        lab.departmentId === departmentId &&
        (!normalized ||
          [lab.name, lab.shortName, lab.pi, lab.field].some((value) =>
            (value ?? "").toLocaleLowerCase("ko-KR").includes(normalized),
          )),
    ).sort((left, right) => {
      if (left.id === currentLabId) return -1;
      if (right.id === currentLabId) return 1;
      return left.name.localeCompare(right.name, "ko");
    });
  }, [currentLabId, departmentId, query]);

  if (!department) {
    return (
      <div className="page">
        <div className="empty-state">
          <div>
            <h3>학과 정보를 찾을 수 없습니다</h3>
            <button className="button" onClick={onBack} type="button">
              디렉터리로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page directory-page">
      <header className="page-header">
        <div>
          <button className="text-link" onClick={onBack} type="button">
            <ArrowLeft aria-hidden size={14} />
            전체 학과
          </button>
          <h1 className="page-title">{department.name} 연구실</h1>
          <p className="page-description">{department.description}</p>
        </div>
      </header>

      <label className="directory-search">
        <Search aria-hidden size={16} />
        <span className="sr-only">연구실 검색</span>
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="연구실명, 지도교수 또는 연구 분야 검색"
          type="search"
          value={query}
        />
      </label>

      <div className="lab-directory-list">
        {labs.map((lab) => {
          const workspaceConnected = lab.id === currentLabId;
          const protocolCount = workspaceConnected ? protocols.length : 0;
          return (
            <article className="lab-directory-row" key={lab.id}>
              <button
                className="lab-directory-main"
                onClick={() => onOpenProfile(lab.id)}
                type="button"
              >
                <span className="lab-directory-icon">
                  <Building2 aria-hidden size={18} />
                </span>
                <span>
                  <span className="lab-directory-title">
                    <strong>{lab.name}</strong>
                    {workspaceConnected ? (
                      <small>작업 공간 연결됨</small>
                    ) : null}
                  </span>
                  <span className="lab-directory-meta">
                    {lab.pi || "지도교수 정보 미등록"} · {lab.field}
                  </span>
                  <span className="lab-directory-stats">
                    프로토콜 {protocolCount}건
                    {workspaceConnected ? ` · 확인 필요 ${unresolvedCount}건` : ""}
                  </span>
                </span>
              </button>
              <div className="lab-directory-actions">
                <button
                  className="button button-small"
                  onClick={() => onOpenProfile(lab.id)}
                  type="button"
                >
                  소개
                </button>
                <button
                  className="button button-small button-primary"
                  disabled={viewMode === "visitor"}
                  onClick={() => onOpenWorkspace(lab.id)}
                  title={
                    viewMode === "visitor"
                      ? "연구원 보기에서 프로토콜을 열 수 있습니다."
                      : `${lab.name} 프로토콜 작업 공간 열기`
                  }
                  type="button"
                >
                  {viewMode === "visitor" ? (
                    <LockKeyhole aria-hidden size={13} />
                  ) : (
                    <FlaskConical aria-hidden size={13} />
                  )}
                  프로토콜
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {labs.length === 0 ? (
        <div className="empty-state directory-empty">
          <div>
            <Search aria-hidden size={24} />
            <h3>검색 결과가 없습니다</h3>
            <p>다른 연구실명이나 연구 분야로 검색해 보세요.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function LabProfileView({
  labId,
  currentLabId,
  onBack,
  onOpenWorkspace,
  onSwitchToResearcher,
  viewMode,
}: DirectoryNavigationProps & {
  labId: string;
  onBack: () => void;
  onSwitchToResearcher: () => void;
}) {
  const lab = getDirectoryLab(labId);
  const department = lab?.departmentId
    ? getDepartment(lab.departmentId)
    : undefined;
  const workspaceConnected = lab?.id === currentLabId;
  const papers =
    lab?.keyPapers ??
    (workspaceConnected ? PRODUCT_CONFIG.defaultLab.keyPapers : []);

  if (!lab) {
    return (
      <div className="page">
        <div className="empty-state">
          <div>
            <h3>연구실 정보를 찾을 수 없습니다</h3>
            <button className="button" onClick={onBack} type="button">
              연구실 목록으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page lab-profile-page">
      <header className="page-header lab-profile-header">
        <div>
          <button className="text-link" onClick={onBack} type="button">
            <ArrowLeft aria-hidden size={14} />
            {department?.name || "연구실 목록"}
          </button>
          <p className="page-kicker">PUBLIC LAB PROFILE</p>
          <h1 className="page-title">{lab.name}</h1>
          <p className="page-description">
            {lab.pi || "지도교수 정보 미등록"}
            {department ? ` · ${department.name}` : ""}
          </p>
        </div>
        <div className="page-actions">
          {viewMode === "visitor" ? (
            <button
              className="button button-primary"
              onClick={onSwitchToResearcher}
              type="button"
            >
              <Users aria-hidden size={14} />
              연구원 보기로 전환
            </button>
          ) : (
            <button
              className="button button-primary"
              onClick={() => onOpenWorkspace(lab.id)}
              type="button"
            >
              <FlaskConical aria-hidden size={14} />
              {workspaceConnected
                ? "프로토콜 관리"
                : "프로토콜 작업 공간 열기"}
            </button>
          )}
        </div>
      </header>

      <div className="lab-profile-layout">
        <main>
          <Panel title="연구실 소개">
            <div className="lab-profile-intro">
              <p>{lab.intro || lab.description}</p>
              {lab.profileBody ? (
                <div className="lab-profile-body">{lab.profileBody}</div>
              ) : null}
            </div>
          </Panel>

          <Panel title="주요 연구 분야">
            <div className="research-area-list">
              {(lab.researchAreas?.length
                ? lab.researchAreas
                : [lab.field]
              ).map((area) => (
                <span key={area}>{area}</span>
              ))}
            </div>
          </Panel>

          <Panel title="주요 논문">
            {papers.length ? (
              <div className="profile-paper-list">
                {papers.slice(0, 3).map((paper) => (
                  <article key={`${paper.title}-${paper.year}`}>
                    <BookOpen aria-hidden size={15} />
                    <div>
                      <strong>{paper.title}</strong>
                      <span>
                        {paper.journal} · {paper.year}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted-copy">
                공개 프로필에 등록된 주요 논문이 없습니다.
              </p>
            )}
          </Panel>
        </main>

        <aside className="lab-profile-aside">
          <div>
            <span>공개 범위</span>
            <strong>연구실 소개</strong>
          </div>
          <p>
            방문자 보기에서는 소개와 연구 분야만 공개됩니다. 프로토콜과
            원본 자료는 연구원 보기에서만 접근할 수 있습니다.
          </p>
          {workspaceConnected ? (
            <span className="workspace-connection">
              <span aria-hidden />
              ARIA 작업 공간 연결됨
            </span>
          ) : (
            <span className="workspace-connection is-muted">
              연구원 보기에서 작업 공간을 열 수 있음
            </span>
          )}
        </aside>
      </div>
    </div>
  );
}

interface GuideMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
}

const GUIDE_QUESTIONS = [
  "새 프로토콜은 어떻게 만들어?",
  "충돌과 누락은 어떻게 해결해?",
  "원본 출처는 어디서 확인해?",
  "사용자 API 키는 어디서 바꿔?",
];

export function GuideAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<GuideMessage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    setMessages((current) => {
      const nextId = (current.at(-1)?.id ?? 0) + 1;
      return [
        ...current,
        { id: nextId, role: "user", content: trimmed },
        {
          id: nextId + 1,
          role: "assistant",
          content: answerGuideQuestion(trimmed),
        },
      ];
    });
    setInput("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(input);
  };

  return (
    <div className={`guide-assistant${open ? " is-open" : ""}`}>
      {open ? (
        <section
          aria-label="ARIA 사용법 도움말"
          className="guide-panel"
        >
          <header>
            {/* Static local mascot; a plain image avoids framework image
                optimization work in the offline desktop launcher. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="달구"
              height={34}
                src={publicAssetPath("/dalgu.png")}
              width={34}
            />
            <div>
              <strong>달구 사용 안내</strong>
              <span>ARIA 화면과 작업 흐름을 안내합니다</span>
            </div>
            <button
              aria-label="사용법 도움말 닫기"
              className="icon-button"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X aria-hidden size={15} />
            </button>
          </header>

          <div aria-live="polite" className="guide-messages">
            <div className="guide-message assistant">
              안녕하세요. ARIA에서 하려는 작업을 알려 주세요. 실험
              조건은 Protocol Q&amp;A에서 근거와 함께 확인할 수 있어요.
            </div>
            {messages.map((message) => (
              <div
                className={`guide-message ${message.role}`}
                key={message.id}
              >
                {message.content}
              </div>
            ))}
            {messages.length === 0 ? (
              <div className="guide-questions">
                {GUIDE_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    onClick={() => send(question)}
                    type="button"
                  >
                    {question}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <form className="guide-form" onSubmit={submit}>
            <input
              aria-label="사용법 질문"
              onChange={(event) => setInput(event.target.value)}
              placeholder="화면 사용법을 물어보세요"
              ref={inputRef}
              value={input}
            />
            <button
              aria-label="질문 보내기"
              disabled={!input.trim()}
              type="submit"
            >
              <Send aria-hidden size={15} />
            </button>
          </form>
        </section>
      ) : null}

      <button
        aria-expanded={open}
        aria-label={open ? "사용법 도움말 닫기" : "사용법 도움말 열기"}
        className="guide-launcher"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                height={40}
                src={publicAssetPath("/dalgu.png")}
                width={40}
              />
        <span>
          <MessageCircleQuestion aria-hidden size={14} />
          도움말
        </span>
      </button>
    </div>
  );
}
