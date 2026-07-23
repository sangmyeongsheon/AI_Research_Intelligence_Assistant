"use client";

import {
  AlertTriangle,
  ArrowDownUp,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Copy,
  FilePlus2,
  FileSearch,
  Files,
  Filter,
  Plus,
  Pencil,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
  Conflict,
  Lab,
  MissingField,
  Protocol,
  SourceArtifact,
} from "@/src/types";
import { PRODUCT_CONFIG } from "@/src/config/product";
import {
  Modal,
  Panel,
  SourceTypeIcon,
  StatusBadge,
  type ProtocolStatus,
} from "./common";

const categoryLabels = {
  experiment: "실험",
  equipment: "장비",
  troubleshooting: "Troubleshooting",
} as const;

const reliabilityLabels: Record<string, string> = {
  current: "현재 사용 중",
  legacy: "오래된 자료",
  reference: "참고 자료",
  unknown: "알 수 없음",
};

function versionLabel(protocol: Protocol) {
  if (protocol.status === "approved" && protocol.currentVersion >= 10) {
    return `v${Math.floor(protocol.currentVersion / 10)}.${protocol.currentVersion % 10}`;
  }
  return `v0.${Math.max(1, protocol.currentVersion)}`;
}

function dateLabel(value: string) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function unresolvedForProtocol(
  protocolId: string,
  activeProtocolId: string | undefined,
  conflicts: Conflict[],
  missingFields: MissingField[],
) {
  if (protocolId !== activeProtocolId) return 0;
  return (
    conflicts.filter((item) => item.status === "unresolved").length +
    missingFields.filter((item) => item.status === "unresolved").length
  );
}

export function OverviewView({
  lab,
  protocols,
  sources,
  conflicts,
  missingFields,
  onNavigate,
  onOpenProtocol,
  onSaveLab,
  onCreateExample,
  activeProtocolId,
}: {
  lab?: Lab;
  protocols: Protocol[];
  sources: SourceArtifact[];
  conflicts: Conflict[];
  missingFields: MissingField[];
  onNavigate: (screen: "new" | "protocols" | "review" | "sources") => void;
  onOpenProtocol: (protocolId: string) => void;
  onSaveLab: (patch: Partial<Lab>) => void;
  onCreateExample: () => void;
  activeProtocolId?: string;
}) {
  const fallbackLab = PRODUCT_CONFIG.defaultLab;
  const [labEditOpen, setLabEditOpen] = useState(false);
  const [labDraft, setLabDraft] = useState(() => ({
    name: lab?.name || fallbackLab.name,
    shortName: lab?.shortName || fallbackLab.shortName,
    field: lab?.field || fallbackLab.field,
    description: lab?.description || fallbackLab.description,
    keyPapers: lab?.keyPapers || [...fallbackLab.keyPapers],
  }));
  const unresolvedConflicts = conflicts.filter(
    (item) => item.status === "unresolved",
  ).length;
  const unresolvedMissing = missingFields.filter(
    (item) => item.status === "unresolved",
  ).length;
  const approved = protocols.filter(
    (protocol) => protocol.status === "approved",
  ).length;
  const recentProtocols = [...protocols]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  const recentSources = [...sources]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <div className="page">
      <section className="lab-profile-card">
        <div className="lab-profile-copy">
          <div className="lab-profile-mark">
            <Building2 aria-hidden size={21} />
          </div>
          <div>
            <div className="lab-profile-kicker">CURRENT LAB</div>
            <h1>{lab?.name || fallbackLab.name}</h1>
            <p>{lab?.description || fallbackLab.description}</p>
            <span className="lab-field">
              {lab?.field || fallbackLab.field}
            </span>
          </div>
        </div>
        <div className="lab-paper-list">
          <div className="lab-paper-heading">
            <BookOpen aria-hidden size={14} />
            <strong>
              주요 논문{lab?.keyPapers?.length ? "" : " (예시)"}
            </strong>
          </div>
          {(lab?.keyPapers?.length
            ? lab.keyPapers
            : fallbackLab.keyPapers
          ).map((paper) => (
            <article key={`${paper.title}-${paper.year}`}>
              <strong>{paper.title}</strong>
              <span>
                {paper.journal} · {paper.year}
              </span>
            </article>
          ))}
        </div>
        <button
          className="button button-small"
          onClick={() => {
            setLabDraft({
              name: lab?.name || fallbackLab.name,
              shortName: lab?.shortName || fallbackLab.shortName,
              field: lab?.field || fallbackLab.field,
              description: lab?.description || fallbackLab.description,
              keyPapers: lab?.keyPapers || [...fallbackLab.keyPapers],
            });
            setLabEditOpen(true);
          }}
          type="button"
        >
          <Pencil aria-hidden size={13} /> Lab 정보 수정
        </button>
      </section>

      <header className="page-header">
        <div>
          <h1 className="page-title">프로토콜 관리</h1>
          <p className="page-description">
            {lab?.name || PRODUCT_CONFIG.defaultLab.name}의 연구 자료를
            출처와 검토 이력이 연결된 프로토콜로 정리합니다.
          </p>
        </div>
        <div className="page-actions">
          <button
            className="button"
            onClick={onCreateExample}
            type="button"
          >
            <FilePlus2 aria-hidden size={16} />
            예시 프로토콜 추가
          </button>
          <button
            className="button button-primary"
            onClick={() => onNavigate("new")}
            type="button"
          >
            <Plus aria-hidden size={16} />
            새 프로토콜 만들기
          </button>
        </div>
      </header>

      <section aria-label="요약 지표" className="stats-grid">
        <div className="stat">
          <div className="stat-label">프로토콜</div>
          <div className="stat-value">
            {protocols.length}
            <span className="stat-detail">현재 Lab</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">확정</div>
          <div className="stat-value">
            {approved}
            <span className="stat-detail">
              {protocols.length ? `${Math.round((approved / protocols.length) * 100)}%` : "0%"}
            </span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">미해결 충돌</div>
          <div className="stat-value">
            {unresolvedConflicts}
            <span className="stat-detail">연구자 확인 필요</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">연결된 자료</div>
          <div className="stat-value">
            {sources.length}
            <span className="stat-detail">작성자 {new Set(sources.map((item) => item.author)).size}명</span>
          </div>
        </div>
      </section>

      <div className="dashboard-grid">
        <div className="stack">
          <Panel
            action={
              <button
                className="button button-small button-quiet"
                onClick={() => onNavigate("protocols")}
                type="button"
              >
                전체 보기 <ChevronRight aria-hidden size={13} />
              </button>
            }
            description="최근 수정 순"
            noPadding
            title="최근 프로토콜"
          >
            {recentProtocols.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>프로토콜</th>
                      <th>상태</th>
                      <th>버전</th>
                      <th>확인 필요</th>
                      <th>수정일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentProtocols.map((protocol) => (
                      <tr
                        className="clickable-row"
                        key={protocol.id}
                        onClick={() => onOpenProtocol(protocol.id)}
                      >
                        <td className="cell-title">
                          <strong>{protocol.title}</strong>
                          <span>{protocol.objective}</span>
                        </td>
                        <td>
                          <StatusBadge
                            status={protocol.status as ProtocolStatus}
                          />
                        </td>
                        <td className="mono">{versionLabel(protocol)}</td>
                        <td>
                          {unresolvedForProtocol(
                            protocol.id,
                            activeProtocolId,
                            conflicts,
                            missingFields,
                          ) ? (
                            <span className="warning-count">
                              <AlertTriangle aria-hidden size={12} />
                              {unresolvedForProtocol(
                                protocol.id,
                                activeProtocolId,
                                conflicts,
                                missingFields,
                              )}
                            </span>
                          ) : (
                            <span className="status status-approved">0</span>
                          )}
                        </td>
                        <td className="mono">
                          {dateLabel(protocol.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div>
                  <FilePlus2 aria-hidden size={28} />
                  <h3>아직 프로토콜이 없습니다</h3>
                  <p>새 프로토콜을 만든 뒤 자료를 업로드해 시작하세요.</p>
                  <button
                    className="button button-primary"
                    onClick={() => onNavigate("new")}
                    type="button"
                  >
                    새 프로토콜 만들기
                  </button>
                </div>
              </div>
            )}
          </Panel>

          <Panel
            action={
              unresolvedConflicts || unresolvedMissing ? (
                <button
                  className="button button-small"
                  onClick={() => onNavigate("review")}
                  type="button"
                >
                  검토 화면 열기
                </button>
              ) : null
            }
            title="최근 활동"
          >
            <div className="activity-list">
              {recentProtocols.map((protocol) => (
                <button
                  className="activity button-quiet"
                  key={protocol.id}
                  onClick={() => onOpenProtocol(protocol.id)}
                  type="button"
                >
                  <div>
                    <strong>{protocol.title}</strong>
                    <span>
                      {protocol.status === "approved" ? "확정" : "작성 중"} ·
                      버전 {versionLabel(protocol)}
                    </span>
                  </div>
                  <span className="mono">{dateLabel(protocol.updatedAt)}</span>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        <div className="stack">
          <Panel title="검토 상태">
            <div className="health-list">
              <button
                className="health-row button-quiet"
                onClick={() => onNavigate("review")}
                type="button"
              >
                <CircleDot aria-hidden size={15} />
                <div>
                  <strong>충돌</strong>
                  <span>서로 다른 조건을 임의로 합치지 않음</span>
                </div>
                <span className="health-value warn">
                  {unresolvedConflicts}
                </span>
              </button>
              <button
                className="health-row button-quiet"
                onClick={() => onNavigate("review")}
                type="button"
              >
                <FileSearch aria-hidden size={15} />
                <div>
                  <strong>누락</strong>
                  <span>담당자에게 확인할 질문</span>
                </div>
                <span className="health-value warn">
                  {unresolvedMissing}
                </span>
              </button>
              <div className="health-row">
                <CheckCircle2 aria-hidden size={15} />
                <div>
                  <strong>출처 무결성</strong>
                  <span>중요 조건에 원본 근거 연결</span>
                </div>
                <span className="health-value good">정상</span>
              </div>
            </div>
          </Panel>

          <Panel
            action={
              <button
                className="button button-small button-quiet"
                onClick={() => onNavigate("sources")}
                type="button"
              >
                전체 보기
              </button>
            }
            title="최근 자료"
          >
            <div className="source-compact-list">
              {recentSources.map((source) => (
                <div className="source-compact" key={source.id}>
                  <span className="source-type-icon">
                    <SourceTypeIcon type={source.type} />
                  </span>
                  <div>
                    <strong title={source.fileName}>
                      {source.displayName || source.fileName}
                    </strong>
                    <span>
                      {source.author} · {reliabilityLabels[source.reliability]}
                    </span>
                  </div>
                  <span className="mono">
                    {source.sourceDate.slice(5, 10)}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {labEditOpen ? (
        <Modal
          description="Overview에 표시할 연구실 소개와 주요 논문을 수정합니다. 이 브라우저에 저장됩니다."
          footer={
            <>
              <button
                className="button"
                onClick={() => setLabEditOpen(false)}
                type="button"
              >
                취소
              </button>
              <button
                className="button button-primary"
                onClick={() => {
                  onSaveLab(labDraft);
                  setLabEditOpen(false);
                }}
                type="button"
              >
                저장
              </button>
            </>
          }
          onClose={() => setLabEditOpen(false)}
          title="Lab 정보 수정"
        >
          <div className="stack">
            <div className="file-meta-grid">
              <label className="field">
                <span>랩실 이름</span>
                <input
                  className="input"
                  onChange={(event) =>
                    setLabDraft((value) => ({
                      ...value,
                      name: event.target.value,
                    }))
                  }
                  value={labDraft.name}
                />
              </label>
              <label className="field">
                <span>약칭</span>
                <input
                  className="input"
                  onChange={(event) =>
                    setLabDraft((value) => ({
                      ...value,
                      shortName: event.target.value,
                    }))
                  }
                  value={labDraft.shortName}
                />
              </label>
            </div>
            <label className="field">
              <span>연구 분야</span>
              <input
                className="input"
                onChange={(event) =>
                  setLabDraft((value) => ({
                    ...value,
                    field: event.target.value,
                  }))
                }
                value={labDraft.field}
              />
            </label>
            <label className="field">
              <span>간략한 설명</span>
              <textarea
                className="textarea"
                onChange={(event) =>
                  setLabDraft((value) => ({
                    ...value,
                    description: event.target.value,
                  }))
                }
                rows={3}
                value={labDraft.description}
              />
            </label>
            <div className="stack" style={{ gap: 8 }}>
              <strong className="field-section-label">주요 논문 3편</strong>
              {labDraft.keyPapers.map((paper, index) => (
                <div className="paper-edit-row" key={index}>
                  <input
                    aria-label={`주요 논문 ${index + 1} 제목`}
                    className="input"
                    onChange={(event) =>
                      setLabDraft((value) => ({
                        ...value,
                        keyPapers: value.keyPapers.map((item, paperIndex) =>
                          paperIndex === index
                            ? { ...item, title: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    placeholder="논문 제목"
                    value={paper.title}
                  />
                  <input
                    aria-label={`주요 논문 ${index + 1} 저널`}
                    className="input"
                    onChange={(event) =>
                      setLabDraft((value) => ({
                        ...value,
                        keyPapers: value.keyPapers.map((item, paperIndex) =>
                          paperIndex === index
                            ? { ...item, journal: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    placeholder="저널"
                    value={paper.journal}
                  />
                  <input
                    aria-label={`주요 논문 ${index + 1} 연도`}
                    className="input"
                    onChange={(event) =>
                      setLabDraft((value) => ({
                        ...value,
                        keyPapers: value.keyPapers.map((item, paperIndex) =>
                          paperIndex === index
                            ? { ...item, year: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    placeholder="연도"
                    value={paper.year}
                  />
                </div>
              ))}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export function ProtocolsView({
  protocols,
  sources,
  conflicts,
  missingFields,
  initialSearch = "",
  activeProtocolId,
  onOpen,
  onDuplicate,
  onDelete,
  onNew,
}: {
  protocols: Protocol[];
  sources: SourceArtifact[];
  conflicts: Conflict[];
  missingFields: MissingField[];
  initialSearch?: string;
  activeProtocolId?: string;
  onOpen: (protocolId: string) => void;
  onDuplicate: (protocolId: string) => void;
  onDelete: (protocolId: string) => void;
  onNew: () => void;
}) {
  const [query, setQuery] = useState(initialSearch);
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [tag, setTag] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<Protocol | null>(
    null,
  );
  const allTags = useMemo(
    () => [...new Set(protocols.flatMap((item) => item.tags))].sort(),
    [protocols],
  );
  const rows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko");
    return [...protocols]
      .filter((protocol) => {
        const sourceAuthors = sources
          .filter((source) => source.protocolId === protocol.id)
          .map((source) => source.author)
          .join(" ");
        const haystack = [
          protocol.title,
          protocol.objective,
          protocol.createdBy,
          protocol.tags.join(" "),
          sourceAuthors,
        ]
          .join(" ")
          .toLocaleLowerCase("ko");
        return (
          (!normalized || haystack.includes(normalized)) &&
          (status === "all" || protocol.status === status) &&
          (category === "all" || protocol.category === category) &&
          (tag === "all" || protocol.tags.includes(tag))
        );
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [category, protocols, query, sources, status, tag]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Protocols</h1>
          <p className="page-description">
            제목, 작성자, 태그와 원본 자료 작성자를 함께 검색합니다. 미승인
            미해결 항목과 연결된 근거를 확인해 상태를 확정하세요.
          </p>
        </div>
        <button
          className="button button-primary"
          onClick={onNew}
          type="button"
        >
          <Plus aria-hidden size={16} /> 새 프로토콜
        </button>
      </header>

      <section aria-label="프로토콜 필터" className="filters">
        <label className="field">
          <span>검색</span>
          <span style={{ position: "relative" }}>
            <Search
              aria-hidden
              size={14}
              style={{ left: 10, position: "absolute", top: 11 }}
            />
            <input
              className="input"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="제목, 작성자, 출처 작성자"
              style={{ paddingLeft: 32 }}
              type="search"
              value={query}
            />
          </span>
        </label>
        <label className="field">
          <span>상태</span>
          <select
            className="select"
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="all">전체 상태</option>
            <option value="draft">작성 중</option>
            <option value="review">검토 중</option>
            <option value="approved">확정</option>
            <option value="archived">보관됨</option>
          </select>
        </label>
        <label className="field">
          <span>유형</span>
          <select
            className="select"
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          >
            <option value="all">전체 유형</option>
            <option value="experiment">실험</option>
            <option value="equipment">장비</option>
            <option value="troubleshooting">Troubleshooting</option>
          </select>
        </label>
        <label className="field">
          <span>태그</span>
          <select
            className="select"
            onChange={(event) => setTag(event.target.value)}
            value={tag}
          >
            <option value="all">전체 태그</option>
            {allTags.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>정렬</span>
          <button className="button" type="button">
            <ArrowDownUp aria-hidden size={14} /> 최신 수정일
          </button>
        </div>
      </section>

      <Panel
        action={
          <span className="inline-meta">
            <Filter aria-hidden size={13} /> {rows.length}개 결과
          </span>
        }
        noPadding
        title="프로토콜 목록"
      >
        {rows.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>유형</th>
                  <th>상태</th>
                  <th>버전</th>
                  <th>작성자</th>
                  <th>자료</th>
                  <th>미해결</th>
                  <th>수정일</th>
                  <th>
                    <span className="sr-only">작업</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((protocol) => {
                  const protocolSources = sources.filter(
                    (source) => source.protocolId === protocol.id,
                  );
                  const unresolved = unresolvedForProtocol(
                    protocol.id,
                    activeProtocolId,
                    conflicts,
                    missingFields,
                  );
                  return (
                    <tr key={protocol.id}>
                      <td
                        className="cell-title clickable-row"
                        onClick={() => onOpen(protocol.id)}
                      >
                        <strong>{protocol.title}</strong>
                        <span>{protocol.tags.join(" · ")}</span>
                      </td>
                      <td>{categoryLabels[protocol.category]}</td>
                      <td>
                        <StatusBadge
                          status={protocol.status as ProtocolStatus}
                        />
                      </td>
                      <td className="mono">{versionLabel(protocol)}</td>
                      <td>{protocol.createdBy}</td>
                      <td className="mono">{protocolSources.length}</td>
                      <td>
                        {unresolved ? (
                          <span className="warning-count">
                            <AlertTriangle aria-hidden size={12} /> {unresolved}
                          </span>
                        ) : (
                          <span className="mono">0</span>
                        )}
                      </td>
                      <td className="mono">{dateLabel(protocol.updatedAt)}</td>
                      <td>
                        <div className="toolbar" style={{ flexWrap: "nowrap" }}>
                          <button
                            aria-label={`${protocol.title} 복제`}
                            className="icon-button"
                            onClick={() => onDuplicate(protocol.id)}
                            title="복제"
                            type="button"
                          >
                            <Copy aria-hidden size={14} />
                          </button>
                          <button
                            aria-label={`${protocol.title} 삭제`}
                            className="icon-button"
                            onClick={() => setDeleteTarget(protocol)}
                            title="삭제"
                            type="button"
                          >
                            <Trash2 aria-hidden size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div>
              <Search aria-hidden size={28} />
              <h3>일치하는 프로토콜이 없습니다</h3>
              <p>검색어나 필터를 바꾸거나 새 프로토콜을 만들어 보세요.</p>
              <button
                className="button"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                  setCategory("all");
                  setTag("all");
                }}
                type="button"
              >
                필터 초기화
              </button>
            </div>
          </div>
        )}
      </Panel>

      {deleteTarget ? (
        <Modal
          description="연결된 출처와 버전 이력도 함께 삭제됩니다. 삭제한 데이터는 복구할 수 없습니다."
          footer={
            <>
              <button
                className="button"
                onClick={() => setDeleteTarget(null)}
                type="button"
              >
                취소
              </button>
              <button
                className="button button-danger"
                onClick={() => {
                  onDelete(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                type="button"
              >
                <Trash2 aria-hidden size={14} /> 삭제
              </button>
            </>
          }
          onClose={() => setDeleteTarget(null)}
          title="프로토콜을 삭제할까요?"
        >
          <strong>{deleteTarget.title}</strong>
        </Modal>
      ) : null}
    </div>
  );
}

export function SourcesView({
  sources,
  onSelect,
}: {
  sources: SourceArtifact[];
  onSelect: (artifact: SourceArtifact) => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const rows = sources.filter((source) => {
    const haystack =
      `${source.displayName} ${source.fileName} ${source.author} ${source.notes}`.toLocaleLowerCase(
        "ko",
      );
    return (
      (!query || haystack.includes(query.toLocaleLowerCase("ko"))) &&
      (type === "all" || source.type === type)
    );
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Sources</h1>
          <p className="page-description">
            프로토콜에 연결된 음성, 이미지, PDF, 메모와 전사 결과를 작성자·날짜
            기준으로 확인합니다.
          </p>
        </div>
      </header>

      <div className="filters" style={{ gridTemplateColumns: "1fr 220px auto" }}>
        <label className="field">
          <span>자료 검색</span>
          <input
            className="input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="파일명, 자료명, 작성자"
            type="search"
            value={query}
          />
        </label>
        <label className="field">
          <span>자료 유형</span>
          <select
            className="select"
            onChange={(event) => setType(event.target.value)}
            value={type}
          >
            <option value="all">전체 유형</option>
            <option value="audio">Audio</option>
            <option value="image">Image</option>
            <option value="pdf">PDF</option>
            <option value="text">Text</option>
            <option value="markdown">Markdown</option>
          </select>
        </label>
        <div className="field">
          <span>결과</span>
          <span className="button" style={{ cursor: "default" }}>
            <Files aria-hidden size={14} /> {rows.length}개
          </span>
        </div>
      </div>

      <div className="source-catalog">
        {rows.map((source) => (
          <article className="source-card" key={source.id}>
            <span className="source-type-icon">
              <SourceTypeIcon size={17} type={source.type} />
            </span>
            <div style={{ minWidth: 0 }}>
              <h3 title={source.fileName}>
                {source.displayName || source.fileName}
              </h3>
              <p>{source.extractedText || source.notes}</p>
              <div className="inline-meta">
                <span>
                  <UserRound aria-hidden size={10} /> {source.author}
                </span>
                <span className="mono">{source.sourceDate}</span>
                <span className="tag">
                  {reliabilityLabels[source.reliability]}
                </span>
              </div>
            </div>
            <button
              aria-label={`${source.displayName} 원본 근거 보기`}
              className="icon-button"
              onClick={() => onSelect(source)}
              type="button"
            >
              <ChevronRight aria-hidden size={15} />
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

export function SettingsView({
  lab,
  apiKeyConfigured,
  onApiKeyClear,
  onApiKeySave,
  onReset,
}: {
  lab?: Lab;
  apiKeyConfigured: boolean;
  onApiKeyClear: () => void;
  onApiKeySave: (apiKey: string) => void;
  onReset: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-description">
            AI 연결 상태와 이 브라우저에 저장된 프로토콜 데이터를 관리합니다.
          </p>
        </div>
      </header>

      <div className="settings-grid">
        <Panel title="AI 연결">
          <div className="setting-row">
            <div>
              <strong>Gemini API</strong>
              <p>
                {apiKeyConfigured
                  ? "현재 탭에 입력한 키로 Gemini를 직접 호출합니다."
                  : "본인의 Gemini API 키를 입력해야 AI 분석을 사용할 수 있습니다."}
              </p>
            </div>
            <span
              className={`status status-${apiKeyConfigured ? "draft" : "review"}`}
            >
              {apiKeyConfigured ? "키 입력됨" : "키 필요"}
            </span>
          </div>
          <form
            className="api-key-form"
            onSubmit={(event) => {
              event.preventDefault();
              onApiKeySave(apiKey);
              setApiKey("");
            }}
          >
            <label className="field">
              <span className="field-label">내 Gemini API 키</span>
              <input
                aria-describedby="api-key-privacy"
                autoCapitalize="none"
                autoComplete="off"
                className="input"
                name="gemini-api-key"
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Google AI Studio에서 발급한 키를 붙여넣으세요"
                spellCheck={false}
                type="password"
                value={apiKey}
              />
            </label>
            <p className="privacy-note" id="api-key-privacy">
              키는 현재 탭의 메모리에만 유지되며 LocalStorage, IndexedDB,
              GitHub 또는 LabTrace 서버에 저장되지 않습니다. 새로고침하거나
              탭을 닫으면 삭제됩니다.
            </p>
            <div className="api-key-actions">
              <button
                className="button button-primary"
                disabled={!apiKey.trim()}
                type="submit"
              >
                이 키 사용
              </button>
              {apiKeyConfigured ? (
                <button
                  className="button"
                  onClick={() => {
                    onApiKeyClear();
                    setApiKey("");
                  }}
                  type="button"
                >
                  현재 키 지우기
                </button>
              ) : null}
            </div>
          </form>
        </Panel>

        <div className="stack">
          <Panel title="서비스 및 Lab">
            <dl className="meta-list" style={{ padding: 0 }}>
              <div className="meta-row">
                <dt>서비스명</dt>
                <dd>
                  {PRODUCT_CONFIG.name} ({PRODUCT_CONFIG.nameKo})
                </dd>
              </div>
              <div className="meta-row">
                <dt>현재 Lab</dt>
                <dd>{lab?.name || PRODUCT_CONFIG.defaultLab.name}</dd>
              </div>
              <div className="meta-row">
                <dt>분야</dt>
                <dd>{lab?.field || PRODUCT_CONFIG.defaultLab.field}</dd>
              </div>
              <div className="meta-row">
                <dt>데이터 저장 위치</dt>
                <dd>이 브라우저의 IndexedDB</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="로컬 데이터">
            <div className="stack" style={{ gap: 8 }}>
              <button
                className="button button-danger"
                onClick={() => setResetOpen(true)}
                type="button"
              >
                <Trash2 aria-hidden size={14} /> 로컬 데이터 초기화
              </button>
            </div>
          </Panel>
        </div>
      </div>

      {resetOpen ? (
        <Modal
          description="현재 브라우저의 LabTrace 프로토콜, 출처, 채팅과 버전 이력을 초기화합니다."
          footer={
            <>
              <button
                className="button"
                onClick={() => setResetOpen(false)}
                type="button"
              >
                취소
              </button>
              <button
                className="button button-danger"
                onClick={() => {
                  onReset();
                  setResetOpen(false);
                }}
                type="button"
              >
                초기화
              </button>
            </>
          }
          onClose={() => setResetOpen(false)}
          title="로컬 데이터를 초기화할까요?"
        >
          <p className="privacy-note">
            이 작업은 되돌릴 수 없습니다. 필요한 프로토콜은 먼저 Markdown으로
            내보내세요.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
