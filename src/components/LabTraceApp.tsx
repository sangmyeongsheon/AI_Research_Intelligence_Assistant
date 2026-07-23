"use client";

import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ChatMessage, SourceArtifact } from "@/src/types";
import { prepareAnalysisPayload } from "@/src/lib/files";
import {
  useLabTraceStore,
  type AnalysisSourcePayload,
} from "@/src/stores/useLabTraceStore";
import {
  getDepartment,
  getDirectoryLab,
} from "@/src/lib/lab-directory";
import {
  AppShell,
  type AppScreen,
  type AppShellContext,
} from "./AppShell";
import {
  OverviewView,
  ProtocolsView,
  SettingsView,
  SourcesView,
} from "./DashboardViews";
import {
  AnalysisProgressView,
  ConflictReviewView,
  SourceReviewView,
  UploadWorkspaceView,
} from "./WorkspaceViews";
import { AssistantView, ProtocolDetailView } from "./ProtocolViews";
import { LoadingScreen } from "./common";
import {
  DepartmentLabsView,
  GuideAssistant,
  LabDirectoryView,
  LabProfileView,
  type WorkspaceViewMode,
} from "./LabDirectoryViews";
import {
  SourcePanel,
  type SourcePanelArtifact,
} from "./SourcePanel";

const VIEW_MODE_STORAGE_KEY = "labtrace:view-mode";
const VIEW_MODE_CHANGE_EVENT = "labtrace:view-mode-change";

function getStoredViewMode(): WorkspaceViewMode {
  return window.localStorage.getItem(VIEW_MODE_STORAGE_KEY) === "visitor"
    ? "visitor"
    : "researcher";
}

function getServerViewMode(): WorkspaceViewMode {
  return "researcher";
}

function subscribeToViewMode(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(VIEW_MODE_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(VIEW_MODE_CHANGE_EVENT, onStoreChange);
  };
}

function storeViewMode(mode: WorkspaceViewMode): void {
  window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  window.dispatchEvent(new Event(VIEW_MODE_CHANGE_EVENT));
}

interface LocalToast {
  id: number;
  message: string;
  kind: "success" | "error";
}

export function LabTraceApp() {
  const store = useLabTraceStore();
  const [screen, setScreen] = useState<AppScreen>("overview");
  const [analysisFiles, setAnalysisFiles] = useState<string[]>([]);
  const [analysisPayload, setAnalysisPayload] =
    useState<AnalysisSourcePayload | null>(null);
  const [analysisStatusText, setAnalysisStatusText] = useState("");
  const [preparingAnalysis, setPreparingAnalysis] = useState(false);
  const [localToast, setLocalToast] = useState<LocalToast | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedProfileLabId, setSelectedProfileLabId] = useState("");
  const viewMode = useSyncExternalStore(
    subscribeToViewMode,
    getStoredViewMode,
    getServerViewMode,
  );
  const startingNewRef = useRef(false);
  const demoMode = store.demoMode;

  useEffect(() => {
    void store.hydrate();
    // hydrate is a stable Zustand action. Running once avoids duplicate seed work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const hasToast = Boolean(localToast || store.toast || store.error);
    if (!hasToast) return;
    if (store.error && store.analysisStage === "error") return;
    const timer = window.setTimeout(() => {
      setLocalToast(null);
      store.clearToast();
      store.clearError();
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [localToast, store]);

  const notify = useCallback(
    (message: string, kind: "success" | "error" = "success") => {
      setLocalToast({ id: Date.now(), message, kind });
    },
    [],
  );

  const openProtocol = useCallback(
    async (id: string) => {
      await store.setActiveProtocol(id);
      setScreen("detail");
    },
    [store],
  );

  const startNew = useCallback(async () => {
    if (startingNewRef.current) return;
    startingNewRef.current = true;
    try {
      await store.startFreshDemo();
      setAnalysisFiles([]);
      setAnalysisPayload(null);
      setAnalysisStatusText("");
      setScreen("new");
    } finally {
      startingNewRef.current = false;
    }
  }, [store]);

  const navigate = useCallback(
    (next: AppScreen) => {
      const internalScreens: AppScreen[] = [
        "overview",
        "protocols",
        "new",
        "analysis",
        "source-review",
        "review",
        "detail",
        "assistant",
        "sources",
      ];
      if (viewMode === "visitor" && internalScreens.includes(next)) {
        setSelectedProfileLabId(store.lab?.id ?? "");
        setScreen("lab-profile");
        return;
      }
      if (next === "new") {
        void startNew();
        return;
      }
      if (
        (next === "detail" || next === "assistant" || next === "review") &&
        !store.activeProtocol
      ) {
        setScreen("protocols");
        return;
      }
      setScreen(next);
    },
    [startNew, store.activeProtocol, store.lab?.id, viewMode],
  );

  const selectedArtifact = useMemo<SourcePanelArtifact | undefined>(() => {
    const artifact = store.sources.find(
      (source) => source.id === store.selectedSourceRef?.artifactId,
    );
    return artifact;
  }, [store.selectedSourceRef?.artifactId, store.sources]);

  const selectArtifact = (artifact: SourceArtifact) => {
    const excerpt = store.excerpts.find(
      (item) => item.sourceArtifactId === artifact.id,
    );
    store.selectSource({
      artifactId: artifact.id,
      excerptId: excerpt?.id,
      sourceLabel: artifact.displayName,
      author: artifact.author,
      pageNumber: excerpt?.pageNumber,
      timestampStart: excerpt?.timestampStart,
      timestampEnd: excerpt?.timestampEnd,
      quote: excerpt?.excerptText || artifact.extractedText.slice(0, 420),
      confidence: excerpt?.confidence ?? 0.86,
    });
  };

  if (!store.hydrated) return <LoadingScreen />;

  const active = store.activeProtocol;
  const unresolvedCount =
    store.conflicts.filter((item) => item.status === "unresolved").length +
    store.missingFields.filter((item) => item.status === "unresolved").length;
  const displayedScreen: AppScreen =
    viewMode === "visitor" &&
    !["directory", "department", "lab-profile", "settings"].includes(screen)
      ? "lab-profile"
      : screen;
  const selectedDepartment = getDepartment(selectedDepartmentId);
  const profiledLab =
    getDirectoryLab(selectedProfileLabId || store.lab?.id || "") ?? store.lab;
  const profileDepartment = profiledLab?.departmentId
    ? getDepartment(profiledLab.departmentId)
    : undefined;
  const internalScreens: AppScreen[] = [
    "overview",
    "protocols",
    "new",
    "analysis",
    "source-review",
    "review",
    "detail",
    "assistant",
    "sources",
  ];

  let shellContext: AppShellContext;
  if (displayedScreen === "directory") {
    shellContext = {
      trail: "Labs",
      title: "연구실 디렉터리",
      subtitle: "Directory",
    };
  } else if (displayedScreen === "department") {
    shellContext = {
      trail: "Labs",
      title: selectedDepartment?.name ?? "학과 연구실",
      subtitle: selectedDepartment?.nameEn,
    };
  } else if (displayedScreen === "lab-profile" && profiledLab) {
    shellContext = {
      trail: profileDepartment
        ? `Labs / ${profileDepartment.name}`
        : "Labs",
      title: profiledLab.name,
      subtitle: profiledLab.shortName,
      activeLabTitle: profiledLab.name,
    };
  } else if (displayedScreen === "settings") {
    shellContext = {
      trail: "ARIA",
      title: "설정",
      subtitle: "Settings",
    };
  } else if (internalScreens.includes(displayedScreen) && store.lab) {
    shellContext = {
      trail: "Lab workspace",
      title: store.lab.name,
      subtitle: store.lab.shortName,
      activeLabTitle: store.lab.name,
    };
  } else {
    shellContext = {
      trail: "ARIA",
      title: "연구실",
    };
  }

  const openLabWorkspace = async (labId: string) => {
    const lab = getDirectoryLab(labId);
    if (!lab) return;
    await store.selectLab(lab);
    if (useLabTraceStore.getState().lab?.id !== lab.id) return;
    setSelectedProfileLabId(lab.id);
    setSelectedDepartmentId(lab.departmentId ?? "");
    storeViewMode("researcher");
    setScreen("overview");
  };

  let content = null;
  if (displayedScreen === "directory") {
    content = (
      <LabDirectoryView
        onSelectDepartment={(departmentId) => {
          setSelectedDepartmentId(departmentId);
          setScreen("department");
        }}
      />
    );
  } else if (displayedScreen === "department") {
    content = (
      <DepartmentLabsView
        currentLabId={store.lab?.id}
        departmentId={selectedDepartmentId}
        onBack={() => setScreen("directory")}
        onOpenProfile={(labId) => {
          const lab = getDirectoryLab(labId);
          if (lab?.departmentId) setSelectedDepartmentId(lab.departmentId);
          setSelectedProfileLabId(labId);
          setScreen("lab-profile");
        }}
        onOpenWorkspace={(labId) => void openLabWorkspace(labId)}
        protocols={store.protocols}
        unresolvedCount={unresolvedCount}
        viewMode={viewMode}
      />
    );
  } else if (displayedScreen === "lab-profile") {
    content = (
      <LabProfileView
        currentLabId={store.lab?.id}
        labId={selectedProfileLabId || store.lab?.id || ""}
        onBack={() =>
          setScreen(selectedDepartmentId ? "department" : "directory")
        }
        onOpenProfile={(labId) => {
          const lab = getDirectoryLab(labId);
          if (lab?.departmentId) setSelectedDepartmentId(lab.departmentId);
          setSelectedProfileLabId(labId);
        }}
        onOpenWorkspace={(labId) => void openLabWorkspace(labId)}
        onSwitchToResearcher={() => storeViewMode("researcher")}
        viewMode={viewMode}
      />
    );
  } else if (displayedScreen === "overview") {
    content = (
      <OverviewView
        activeProtocolId={active?.id}
        conflicts={store.conflicts}
        lab={store.lab ?? undefined}
        missingFields={store.missingFields}
        onNavigate={(next) => {
          if (next === "new") void startNew();
          else setScreen(next);
        }}
        onCreateExample={() => {
          void store.createExampleProtocol().then((result) => {
            if (result) setScreen("detail");
          });
        }}
        onOpenProtocol={(id) => void openProtocol(id)}
        onSaveLab={(patch) => void store.updateLab(patch)}
        protocols={store.protocols}
        sources={store.sources}
      />
    );
  } else if (displayedScreen === "protocols") {
    content = (
      <ProtocolsView
        activeProtocolId={active?.id}
        conflicts={store.conflicts}
        initialSearch=""
        missingFields={store.missingFields}
        onDelete={(id) => void store.deleteProtocol(id)}
        onDuplicate={(id) => {
          void store.duplicateProtocol(id).then((result) => {
            if (result) setScreen("detail");
          });
        }}
        onNew={() => void startNew()}
        onOpen={(id) => void openProtocol(id)}
        protocols={store.protocols}
        sources={store.sources}
      />
    );
  } else if (displayedScreen === "new") {
    content = (
      <UploadWorkspaceView
        analyzing={preparingAnalysis}
        onAnalyze={({ drafts }) => {
          if (preparingAnalysis) return;
          setPreparingAnalysis(true);
          void (async () => {
            try {
              const activeProtocol = store.activeProtocol;
              if (!activeProtocol) {
                throw new Error("분석할 프로토콜을 찾지 못했습니다.");
              }
              const payload = await prepareAnalysisPayload(
                drafts,
                activeProtocol.id,
              );
              setAnalysisFiles(drafts.map((draft) => draft.name));
              setAnalysisPayload(payload);
              setScreen("analysis");
              setPreparingAnalysis(false);
              await store.runDemoAnalysis(
                (progress) => setAnalysisStatusText(progress.label),
                payload,
              );
            } catch (error) {
              notify(
                error instanceof Error
                  ? error.message
                  : "자료를 준비하지 못했습니다. 기존 파일은 보존되었습니다.",
                "error",
              );
            } finally {
              setPreparingAnalysis(false);
            }
          })();
        }}
      />
    );
  } else if (displayedScreen === "analysis") {
    content = (
      <AnalysisProgressView
        complete={store.analysisStage === "complete"}
        errorMessage={store.error}
        failed={store.analysisStage === "error"}
        fileNames={
          analysisFiles.length
            ? analysisFiles
            : store.sources.map((source) => source.fileName)
        }
        onCancel={() => setScreen("new")}
        onComplete={() => setScreen("source-review")}
        onRetry={
          analysisPayload
            ? () => {
                store.clearError();
                void store.runDemoAnalysis(
                  (progress) => setAnalysisStatusText(progress.label),
                  analysisPayload,
                );
              }
            : undefined
        }
        progress={store.analysisProgress}
        stage={store.analysisStage}
        statusText={analysisStatusText}
      />
    );
  } else if (displayedScreen === "source-review") {
    content = (
      <SourceReviewView
        excerpts={store.excerpts}
        onContinue={() => setScreen("review")}
        onUpdateSource={(id, patch) => void store.updateSource(id, patch)}
        sources={store.sources}
      />
    );
  } else if (displayedScreen === "review") {
    content = (
      <ConflictReviewView
        conflicts={store.conflicts}
        lowConfidenceCount={store.excerpts.filter((item) => item.confidence < 0.75).length}
        missingFields={store.missingFields}
        onAnswerMissing={(id, answer, dismissed) => {
          if (dismissed) {
            notify(
              "항목을 미해결 상태로 유지했습니다. 승인 전에 다시 확인하세요.",
            );
            return;
          }
          if (answer) void store.answerMissing(id, answer);
        }}
        onBack={() => setScreen("source-review")}
        onOpenDraft={() => setScreen("detail")}
        onResolveConflict={(id, resolution, note) => {
          if (!resolution) {
            notify(
              "충돌을 미해결 상태로 유지했습니다. 프로토콜에 확인 항목으로 계속 표시됩니다.",
            );
            return;
          }
          void store.resolveConflict(id, resolution, note);
        }}
      />
    );
  } else if (displayedScreen === "detail" && active) {
    content = (
      <ProtocolDetailView
        conflicts={store.conflicts}
        key={active.id}
        missingFields={store.missingFields}
        onAcceptSuggestion={() =>
          notify(
            "제안을 수락 후보로 표시했습니다. 공식 단계에는 자동 병합하지 않았습니다.",
          )
        }
        onAssistant={() => setScreen("assistant")}
        onBack={() => setScreen("protocols")}
        onReview={() => setScreen("review")}
        onSave={(snapshot, summary, bump) =>
          void store.saveProtocol(
            {
              snapshot,
              title: snapshot.experiment.title,
              objective: snapshot.experiment.objective,
            },
            summary,
            bump,
          )
        }
        onSource={(ref) => store.selectSource(ref)}
        onStatus={(status) => void store.setProtocolStatus(status)}
        onToast={notify}
        protocol={active}
        sources={store.sources}
        suggestions={store.suggestions}
        versions={store.versions}
      />
    );
  } else if (displayedScreen === "assistant" && active) {
    content = (
      <AssistantView
        messages={store.chatMessages}
        onBack={() => setScreen("detail")}
        onSend={async (question) => {
          await store.sendChat(question);
        }}
        onSource={(ref) => store.selectSource(ref)}
        onSuggestEdit={(message: ChatMessage) =>
          notify(
            `“${message.content.slice(0, 28)}…”을 수정 제안으로 표시했습니다. 사용자가 저장하기 전에는 본문에 반영되지 않습니다.`,
          )
        }
        protocol={active}
      />
    );
  } else if (displayedScreen === "sources") {
    content = (
      <SourcesView onSelect={selectArtifact} sources={store.sources} />
    );
  } else if (displayedScreen === "settings") {
    content = (
      <SettingsView
        aiKeySource={store.aiKeySource}
        demoMode={demoMode}
        lab={store.lab ?? undefined}
        onApiKeyChanged={() => store.refreshAIConnection()}
        onReset={() => void store.resetDemo()}
      />
    );
  } else {
    content = (
      <div className="page">
        <div className="empty-state">
          <div>
            <h3>열 수 있는 프로토콜이 없습니다</h3>
            <p>Protocols 목록에서 문서를 선택하거나 새 프로토콜을 만드세요.</p>
            <button
              className="button button-primary"
              onClick={() => setScreen("protocols")}
              type="button"
            >
              Protocols로 이동
            </button>
          </div>
        </div>
      </div>
    );
  }

  const visibleToast =
    localToast ||
    (store.error
      ? { id: 0, kind: "error" as const, message: store.error }
      : store.toast
        ? {
            id: 0,
            kind: "success" as const,
            message: store.toast.message,
          }
        : null);

  return (
    <AppShell
      context={shellContext}
      demoMode={demoMode}
      onNavigate={navigate}
      onViewModeChange={(mode) => {
        storeViewMode(mode);
        if (mode === "visitor") {
          const currentLab = getDirectoryLab(store.lab?.id ?? "");
          setSelectedProfileLabId(currentLab?.id ?? store.lab?.id ?? "");
          setSelectedDepartmentId(currentLab?.departmentId ?? "");
        }
      }}
      screen={displayedScreen}
      unresolvedCount={unresolvedCount}
      viewMode={viewMode}
    >
      {content}
      <SourcePanel
        artifact={selectedArtifact}
        onClose={() => store.selectSource(null)}
        sourceRef={store.selectedSourceRef}
      />
      <GuideAssistant />
      <div aria-live="polite" className="toast-region">
        {visibleToast ? (
          <div
            className={`toast${visibleToast.kind === "error" ? " error" : ""}`}
            key={visibleToast.id}
            role={visibleToast.kind === "error" ? "alert" : "status"}
          >
            {visibleToast.kind === "error" ? (
              <AlertTriangle aria-hidden size={16} color="var(--danger)" />
            ) : (
              <CheckCircle2 aria-hidden size={16} color="var(--success)" />
            )}
            <span>{visibleToast.message}</span>
            <button
              aria-label="알림 닫기"
              className="button-quiet"
              onClick={() => {
                setLocalToast(null);
                store.clearToast();
                store.clearError();
              }}
              type="button"
            >
              <X aria-hidden size={14} />
            </button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
