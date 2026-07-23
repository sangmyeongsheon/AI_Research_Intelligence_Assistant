"use client";

import { create } from "zustand";

import {
  getSessionGeminiApiKey,
  hasSessionGeminiApiKey,
} from "@/src/lib/ai/api-key-session";
import { createGeminiModelConfig } from "@/src/lib/ai/model-config";
import type { ExtractSourceInput } from "@/src/lib/ai/provider";
import { GeminiProvider } from "@/src/lib/ai/providers/gemini-provider";
import {
  detectConflicts,
  detectMissingFields,
} from "@/src/lib/ai/detection";
import { getLabTraceRepository } from "@/src/lib/db";
import {
  createExampleProtocolBundle,
  EXAMPLE_PROTOCOL_ID,
} from "@/src/lib/example-protocol";
import {
  cloneDemoValue,
  DEMO_LAB_ID,
} from "@/src/lib/demo";
import {
  createDefaultProtocolTitle,
  createGeneratedProtocolTitle,
  isLegacyDefaultProtocolTitle,
  protocolTitleSuffix,
} from "@/src/lib/protocol-naming";
import { normalizeProtocolResourceLabels } from "@/src/lib/protocol-resource-labels";
import { PRODUCT_CONFIG } from "@/src/config/product";
import type {
  AiSuggestion,
  ChatMessage,
  Conflict,
  DemoSeedBundle,
  EvidenceUnit,
  ExtractedSourceResult,
  Lab,
  LocalBlobRecord,
  MissingField,
  Protocol,
  ProtocolDocument,
  ProtocolSnapshot,
  ProtocolStatus,
  ProtocolVersion,
  SourceArtifact,
  SourceExcerpt,
  SourceRef,
} from "@/src/types";

export type AnalysisStage =
  | "idle"
  | "extracting"
  | "merging"
  | "detecting"
  | "generating"
  | "complete"
  | "error";

export interface AnalysisProgress {
  stage: AnalysisStage;
  progress: number;
  label: string;
}

export interface AnalysisSourcePayload {
  inputs: ExtractSourceInput[];
  blobs: LocalBlobRecord[];
}

export interface StoreToast {
  kind: "success" | "info" | "warning";
  message: string;
}

export type AIKeySource = "session" | "none";

export type ProtocolSavePatch = Partial<
  Omit<Protocol, "id" | "labId" | "createdAt">
> & {
  snapshot?: ProtocolSnapshot;
};

export interface LabTraceState {
  lab: Lab | null;
  protocols: Protocol[];
  activeProtocol: ProtocolDocument | null;
  sources: SourceArtifact[];
  excerpts: SourceExcerpt[];
  conflicts: Conflict[];
  missingFields: MissingField[];
  versions: ProtocolVersion[];
  chatMessages: ChatMessage[];
  suggestions: AiSuggestion[];
  evidence: EvidenceUnit[];
  hydrated: boolean;
  demoMode: boolean;
  aiKeySource: AIKeySource;
  analysisStage: AnalysisStage;
  analysisProgress: number;
  selectedSourceRef: SourceRef | null;
  toast: StoreToast | null;
  error: string | null;

  hydrate(): Promise<void>;
  selectLab(lab: Lab): Promise<void>;
  refreshAIConnection(): Promise<boolean>;
  updateLab(patch: Partial<Lab>): Promise<void>;
  createExampleProtocol(): Promise<Protocol | null>;
  startFreshDemo(): Promise<void>;
  runDemoAnalysis(
    onProgress?: (progress: AnalysisProgress) => void,
    payload?: AnalysisSourcePayload,
  ): Promise<void>;
  resolveConflict(
    id: string,
    resolution: string,
    note?: string,
  ): Promise<void>;
  answerMissing(id: string, answer: string): Promise<void>;
  saveProtocol(
    patch: ProtocolSavePatch,
    summary: string,
    bumpVersion?: boolean,
  ): Promise<void>;
  setProtocolStatus(status: ProtocolStatus): Promise<void>;
  duplicateProtocol(id: string): Promise<Protocol | null>;
  deleteProtocol(id: string): Promise<void>;
  updateSource(
    id: string,
    patch: Partial<SourceArtifact>,
  ): Promise<void>;
  sendChat(question: string): Promise<ChatMessage | null>;
  selectSource(ref: SourceRef | null): void;
  setActiveProtocol(id: string): Promise<void>;
  updateProtocolSnapshot(patch: Partial<ProtocolSnapshot>): void;
  clearToast(): void;
  clearError(): void;
  resetDemo(): Promise<void>;
}

const SELECTED_LAB_STORAGE_KEY = "labtrace:selected-lab-id";

function selectProvider() {
  return new GeminiProvider(
    createGeminiModelConfig(getSessionGeminiApiKey()),
  );
}

function getStoredSelectedLabId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(SELECTED_LAB_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function rememberSelectedLabId(labId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SELECTED_LAB_STORAGE_KEY, labId);
  } catch {
    // Workspace switching still works when browser storage is unavailable.
  }
}

function forgetSelectedLabId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SELECTED_LAB_STORAGE_KEY);
  } catch {
    // The repository reset remains authoritative.
  }
}

function emptyProtocolState() {
  return {
    activeProtocol: null,
    sources: [],
    excerpts: [],
    conflicts: [],
    missingFields: [],
    versions: [],
    chatMessages: [],
  };
}

async function readAIConnectionStatus(): Promise<{
  demoMode: boolean;
  aiKeySource: AIKeySource;
}> {
  const configured = hasSessionGeminiApiKey();
  return {
    demoMode: !configured,
    aiKeySource: configured ? "session" : "none",
  };
}

function createId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

const LEGACY_DEFAULT_LAB_DESCRIPTIONS = new Set([
  "연구 자료와 프로토콜의 원본 근거, 검토 이력을 연결해 관리합니다.",
  "LabTrace 시연을 위해 만든 가상 연구실입니다. 모든 인물과 자료는 가상입니다.",
]);

function backfillDefaultLabProfile(lab: Lab): Lab {
  if (lab.id !== DEMO_LAB_ID) return lab;
  const shouldUpdateDescription = LEGACY_DEFAULT_LAB_DESCRIPTIONS.has(
    lab.description.trim(),
  );
  const shouldAddPapers = !lab.keyPapers?.length;
  if (!shouldUpdateDescription && !shouldAddPapers) return lab;
  return {
    ...lab,
    description: shouldUpdateDescription
      ? PRODUCT_CONFIG.defaultLab.description
      : lab.description,
    keyPapers: shouldAddPapers
      ? PRODUCT_CONFIG.defaultLab.keyPapers.map((paper) => ({ ...paper }))
      : lab.keyPapers,
    isDemo: false,
    updatedAt: new Date().toISOString(),
  };
}

function createWorkspaceBundle(
  lab: Lab | null = null,
  title = "새 프로토콜",
): DemoSeedBundle {
  const now = new Date().toISOString();
  const workspaceLab: Lab =
    lab ?? {
      id: "lab-neural-systems",
      name: PRODUCT_CONFIG.defaultLab.name,
      shortName: PRODUCT_CONFIG.defaultLab.shortName,
      field: PRODUCT_CONFIG.defaultLab.field,
      description:
        PRODUCT_CONFIG.defaultLab.description,
      keyPapers: [...PRODUCT_CONFIG.defaultLab.keyPapers],
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    };
  const protocolId = createId("protocol");
  const snapshot: ProtocolSnapshot = {
    experiment: {
      title,
      objective: "자료를 업로드하면 출처가 연결된 프로토콜을 생성합니다.",
      category: "experiment",
    },
    materials: [],
    equipment: [],
    steps: [],
    conflicts: [],
    missingFields: [],
    sources: [],
    overallWarnings: [],
  };
  const protocol: Protocol = {
    id: protocolId,
    labId: workspaceLab.id,
    title,
    objective: snapshot.experiment.objective,
    category: "experiment",
    status: "draft",
    currentVersion: 1,
    tags: [],
    createdBy: "현재 사용자",
    createdAt: now,
    updatedAt: now,
  };

  return {
    lab: workspaceLab,
    protocols: [protocol],
    versions: [
      {
        id: `${protocolId}-v1-${now}`,
        protocolId,
        versionNumber: 1,
        snapshot,
        changeSummary: "새 프로토콜 생성",
        changedBy: "현재 사용자",
        createdAt: now,
      },
    ],
    sources: [],
    excerpts: [],
    conflicts: [],
    missingFields: [],
    chatMessages: [],
  };
}

function createEmptyWorkspaceBundle(): DemoSeedBundle {
  const bundle = createWorkspaceBundle();
  return {
    ...bundle,
    protocols: [],
    versions: [],
  };
}

function toUserMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "userMessage" in error &&
    typeof error.userMessage === "string"
  ) {
    return error.userMessage;
  }
  return error instanceof Error
    ? error.message
    : "요청을 처리하지 못했습니다. 기존 데이터는 보존되었습니다.";
}

class SourceExtractionError extends Error {
  readonly userMessage: string;

  constructor(fileName: string, cause: unknown) {
    const detail = toUserMessage(cause);
    super(`${fileName}: ${detail}`, { cause });
    this.name = "SourceExtractionError";
    this.userMessage = `"${fileName}" 처리에 실패했습니다. ${detail}`;
  }
}

function appendUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}

function applyMissingAnswerLocally(
  snapshot: ProtocolSnapshot,
  missing: MissingField,
  missingFields: MissingField[],
  answer: string,
  answeredAt: string,
): ProtocolSnapshot {
  const next = cloneDemoValue(snapshot);
  next.missingFields = missingFields;
  next.researcherAnswers = [
    ...(next.researcherAnswers ?? []).filter(
      (item) => item.missingFieldId !== missing.id,
    ),
    {
      missingFieldId: missing.id,
      field: missing.field,
      stepId: missing.stepId,
      question: missing.question,
      answer,
      answeredBy: "현재 사용자",
      answeredAt,
    },
  ];

  if (missing.field === "objective_success_criterion") {
    next.resultAcceptance = {
      pass: appendUnique(next.resultAcceptance?.pass ?? [], answer),
      repeat: next.resultAcceptance?.repeat ?? [],
      discard: next.resultAcceptance?.discard ?? [],
    };
  }

  const step = missing.stepId
    ? next.steps.find((item) => item.id === missing.stepId)
    : undefined;
  if (step) {
    if (
      missing.field.includes("equipment") ||
      missing.field.includes("instrument")
    ) {
      step.equipment = appendUnique(step.equipment, answer);
      next.equipment = appendUnique(next.equipment, answer);
    } else if (
      missing.field.includes("membrane") ||
      missing.field.includes("reagent") ||
      missing.field.includes("antibody_product")
    ) {
      step.materials = appendUnique(step.materials, answer);
      next.materials = appendUnique(next.materials, answer);
    }
    const existing = step.parameters.find(
      (parameter) => parameter.name === missing.field,
    );
    if (existing) {
      existing.value = answer;
      existing.normalizedValue = answer;
    } else {
      step.parameters.push({
        name: missing.field,
        value: answer,
        unit: "",
        normalizedValue: answer,
        sourceRefs: [],
      });
    }
    step.unresolved =
      missingFields.some(
        (item) =>
          item.stepId === step.id && item.status === "unresolved",
      ) ||
      next.conflicts.some(
        (item) =>
          item.stepId === step.id && item.status === "unresolved",
      );
  }
  return next;
}

async function readProtocolState(protocolId: string) {
  const repository = getLabTraceRepository();
  const [
    activeProtocol,
    sources,
    excerpts,
    conflicts,
    missingFields,
    versions,
    chatMessages,
  ] = await Promise.all([
    repository.getProtocolDocument(protocolId),
    repository.getSources(protocolId),
    repository.getExcerpts(protocolId),
    repository.getConflicts(protocolId),
    repository.getMissingFields(protocolId),
    repository.getVersions(protocolId),
    repository.getChatMessages(protocolId),
  ]);
  const normalizedActiveProtocol = normalizeProtocolDocument(activeProtocol);
  return {
    activeProtocol: normalizedActiveProtocol,
    sources,
    excerpts,
    conflicts,
    missingFields,
    versions,
    chatMessages,
  };
}

function normalizeProtocolDocument(
  protocol: ProtocolDocument | null,
): ProtocolDocument | null {
  if (!protocol) return null;
  const snapshot = normalizeProtocolResourceLabels(protocol.snapshot);
  return snapshot === protocol.snapshot
    ? protocol
    : { ...protocol, snapshot };
}

function remapSnapshotSources(
  snapshot: ProtocolSnapshot,
  sourceIdMap: Map<string, string>,
  excerptIdMap: Map<string, string>,
  protocolId: string,
): ProtocolSnapshot {
  const cloned = cloneDemoValue(snapshot);
  const remapRef = (ref: SourceRef): SourceRef => ({
    ...ref,
    artifactId: sourceIdMap.get(ref.artifactId) ?? ref.artifactId,
    excerptId: ref.excerptId
      ? (excerptIdMap.get(ref.excerptId) ?? ref.excerptId)
      : undefined,
  });
  cloned.sources = cloned.sources.map((source) => ({
    ...source,
    id: sourceIdMap.get(source.id) ?? source.id,
    protocolId,
    workspaceId: undefined,
    localBlobKey: undefined,
  }));
  cloned.steps = cloned.steps.map((step) => ({
    ...step,
    sourceRefs: step.sourceRefs.map(remapRef),
    parameters: step.parameters.map((parameter) => ({
      ...parameter,
      sourceRefs: parameter.sourceRefs.map(remapRef),
    })),
    troubleshootingItems: step.troubleshootingItems?.map((item) => ({
      ...item,
      sourceRefs: item.sourceRefs.map(remapRef),
    })),
  }));
  cloned.conflicts = cloned.conflicts.map((conflict) => ({
    ...conflict,
    id: `${protocolId}-${conflict.id}`,
    sourceRefs: conflict.sourceRefs.map(remapRef),
    options: conflict.options.map((option) => ({
      ...option,
      id: `${protocolId}-${option.id}`,
      sourceRefs: option.sourceRefs.map(remapRef),
    })),
  }));
  cloned.missingFields = cloned.missingFields.map((field) => ({
    ...field,
    id: `${protocolId}-${field.id}`,
  }));
  return normalizeProtocolResourceLabels(cloned);
}

const initialState = {
  lab: null,
  protocols: [],
  activeProtocol: null,
  sources: [],
  excerpts: [],
  conflicts: [],
  missingFields: [],
  versions: [],
  chatMessages: [],
  suggestions: [],
  evidence: [],
  hydrated: false,
  demoMode: true,
  aiKeySource: "none" as AIKeySource,
  analysisStage: "idle" as AnalysisStage,
  analysisProgress: 0,
  selectedSourceRef: null,
  toast: null,
  error: null,
};

export const useLabTraceStore = create<LabTraceState>((set, get) => ({
  ...initialState,

  hydrate: async () => {
    try {
      const repository = getLabTraceRepository();
      const existingLabs = await repository.getLabs();
      if (
        !(await repository.hasData()) ||
        existingLabs.some((item) => item.isDemo)
      ) {
        await repository.seed(createEmptyWorkspaceBundle(), true);
      }
      const labs = await repository.getLabs();
      const selectedLabId = getStoredSelectedLabId();
      const storedLab =
        labs.find((item) => item.id === selectedLabId) ??
        labs.find((item) => item.id === DEMO_LAB_ID) ??
        labs[0] ??
        null;
      const lab = storedLab ? backfillDefaultLabProfile(storedLab) : null;
      if (lab && lab !== storedLab) {
        await repository.putLab(lab);
      }
      if (lab) rememberSelectedLabId(lab.id);
      const protocols = await repository.getProtocols(lab?.id);
      const protocolId = protocols[0]?.id;
      const protocolState = protocolId
        ? await readProtocolState(protocolId)
        : emptyProtocolState();
      let demoMode = true;
      let aiKeySource: AIKeySource = "none";
      try {
        const connection = await readAIConnectionStatus();
        demoMode = connection.demoMode;
        aiKeySource = connection.aiKeySource;
      } catch {
        demoMode = true;
        aiKeySource = "none";
      }
      set({
        ...protocolState,
        lab,
        protocols,
        evidence: [],
        suggestions: [],
        analysisStage: "idle",
        analysisProgress: 0,
        hydrated: true,
        demoMode,
        aiKeySource,
        error: null,
      });
    } catch (error) {
      set({
        hydrated: true,
        error: toUserMessage(error),
        analysisStage: "error",
      });
    }
  },

  selectLab: async (requestedLab) => {
    try {
      const repository = getLabTraceRepository();
      const existingLab = (await repository.getLabs()).find(
        (item) => item.id === requestedLab.id,
      );
      const lab = existingLab ?? {
        ...requestedLab,
        isDemo: false,
      };
      if (!existingLab) {
        await repository.putLab(lab);
      }

      const protocols = await repository.getProtocols(lab.id);
      const protocolState = protocols[0]
        ? await readProtocolState(protocols[0].id)
        : emptyProtocolState();
      rememberSelectedLabId(lab.id);
      set({
        ...protocolState,
        lab,
        protocols,
        evidence: [],
        suggestions: [],
        analysisStage: "idle",
        analysisProgress: 0,
        selectedSourceRef: null,
        toast: {
          kind: "info",
          message: `${lab.name} 작업 공간으로 전환했습니다.`,
        },
        error: null,
      });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },

  refreshAIConnection: async () => {
    try {
      const connection = await readAIConnectionStatus();
      set({
        demoMode: connection.demoMode,
        aiKeySource: connection.aiKeySource,
      });
      return !connection.demoMode;
    } catch {
      set({ demoMode: true, aiKeySource: "none" });
      return false;
    }
  },

  updateLab: async (patch) => {
    const current = get().lab;
    if (!current) return;
    const updated: Lab = {
      ...current,
      ...patch,
      id: current.id,
      isDemo: false,
      updatedAt: new Date().toISOString(),
    };
    try {
      await getLabTraceRepository().putLab(updated);
      set({
        lab: updated,
        toast: {
          kind: "success",
          message: "Overview의 Lab 정보를 저장했습니다.",
        },
        error: null,
      });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },

  createExampleProtocol: async () => {
    const lab = get().lab;
    if (!lab) return null;
    try {
      const repository = getLabTraceRepository();
      const existing = (await repository.getProtocols(lab.id)).find(
        (protocol) => protocol.id === EXAMPLE_PROTOCOL_ID,
      );
      if (!existing) {
        const example = createExampleProtocolBundle(lab.id);
        await Promise.all([
          repository.putProtocol(example.protocol, example.snapshot),
          repository.putExcerpts(example.excerpts),
        ]);
      }
      const protocolState = await readProtocolState(EXAMPLE_PROTOCOL_ID);
      const protocols = await repository.getProtocols(lab.id);
      set({
        ...protocolState,
        protocols,
        evidence: [],
        suggestions: [],
        toast: {
          kind: "success",
          message: existing
            ? "기존 예시 프로토콜을 열었습니다."
            : "예시 프로토콜을 추가했습니다.",
        },
        error: null,
      });
      return protocolState.activeProtocol;
    } catch (error) {
      set({ error: toUserMessage(error) });
      return null;
    }
  },

  startFreshDemo: async () => {
    try {
      const repository = getLabTraceRepository();
      const labs = await repository.getLabs();
      const lab =
        get().lab ??
        labs.find((item) => item.id === getStoredSelectedLabId()) ??
        labs.find((item) => item.id === DEMO_LAB_ID) ??
        labs[0];
      const existingProtocols = await repository.getProtocols(lab?.id);
      const active = get().activeProtocol;
      const canReuseActiveDraft =
        active?.status === "draft" &&
        active.currentVersion === 1 &&
        active.snapshot.steps.length === 0 &&
        active.snapshot.sources.length === 0 &&
        get().sources.length === 0;

      if (active && canReuseActiveDraft) {
        const nextTitle = isLegacyDefaultProtocolTitle(active.title)
          ? createDefaultProtocolTitle(existingProtocols, active.createdAt)
          : active.title;
        const reusableProtocol = {
          ...active,
          title: nextTitle,
          objective: active.snapshot.experiment.objective,
        };
        const reusableSnapshot = {
          ...active.snapshot,
          experiment: {
            ...active.snapshot.experiment,
            title: nextTitle,
          },
        };
        if (nextTitle !== active.title) {
          await repository.putProtocol(reusableProtocol, reusableSnapshot);
        }
        const protocolState = await readProtocolState(active.id);
        const protocols = await repository.getProtocols(active.labId);
        set({
          ...protocolState,
          protocols,
          evidence: [],
          suggestions: [],
          analysisStage: "idle",
          analysisProgress: 0,
          selectedSourceRef: null,
          toast: {
            kind: "info",
            message:
              "비어 있는 프로토콜을 이어서 사용합니다. 자료를 추가해 분석을 시작하세요.",
          },
          error: null,
        });
        return;
      }

      const title = createDefaultProtocolTitle(existingProtocols);
      const bundle = createWorkspaceBundle(lab, title);
      await repository.seed(bundle);
      const protocolId = bundle.protocols[0]!.id;
      const protocolState = await readProtocolState(protocolId);
      const protocols = await repository.getProtocols(bundle.lab.id);
      set({
        ...protocolState,
        lab: bundle.lab,
        protocols,
        evidence: [],
        suggestions: [],
        hydrated: true,
        demoMode: get().demoMode,
        analysisStage: "idle",
        analysisProgress: 0,
        selectedSourceRef: null,
        toast: {
          kind: "info",
          message: "새 프로토콜을 만들었습니다. 자료를 추가해 분석을 시작하세요.",
        },
        error: null,
      });
    } catch (error) {
      set({ error: toUserMessage(error), analysisStage: "error" });
    }
  },

  runDemoAnalysis: async (onProgress, payload) => {
    const active = get().activeProtocol;
    if (!active) {
      set({ error: "분석할 프로토콜이 없습니다." });
      return;
    }
    const report = (
      stage: AnalysisStage,
      progress: number,
      label: string,
    ) => {
      set({ analysisStage: stage, analysisProgress: progress });
      onProgress?.({ stage, progress, label });
    };

    try {
      set({ error: null, toast: null });
      const provider = selectProvider();
      const repository = getLabTraceRepository();
      const sourceInputs =
        payload?.inputs ??
        get().sources.map((artifact) => ({
          artifact,
          text: artifact.extractedText,
        }));
      if (payload) {
        const uploadedSources = sourceInputs.map((input) => input.artifact);
        const currentSourceIds = new Set(
          get().sources.map((source) => source.id),
        );
        const sameSourceSet =
          currentSourceIds.size === uploadedSources.length &&
          uploadedSources.every((source) => currentSourceIds.has(source.id));
        const canReuseCompletedExtraction =
          sameSourceSet && get().evidence.length > 0;
        if (!canReuseCompletedExtraction) {
          await repository.replaceSources(active.id, uploadedSources);
          set({ sources: uploadedSources, excerpts: [], evidence: [] });
        }
        await Promise.all(
          payload.blobs.map((blob) => repository.putBlob(blob)),
        );
      }
      report("extracting", 10, "음성 전사·OCR·문서 텍스트 확인");
      const cachedResults: ExtractedSourceResult[] = sourceInputs.flatMap((input) => {
        const cachedArtifact = get().sources.find(
          (source) =>
            source.id === input.artifact.id &&
            source.processingStatus === "ready",
        );
        const cachedEvidence = get().evidence.filter(
          (unit) => unit.sourceArtifactId === input.artifact.id,
        );
        if (!cachedArtifact || !cachedEvidence.length) return [];
        return [
          {
            artifact: cachedArtifact,
            excerpts: get().excerpts.filter(
              (excerpt) =>
                excerpt.sourceArtifactId === input.artifact.id,
            ),
            evidence: cachedEvidence,
            warnings: [],
          },
        ];
      });
      const cachedIds = new Set(
        cachedResults.map((result) => result.artifact.id),
      );
      const pendingInputs = sourceInputs.filter(
        (input) => !cachedIds.has(input.artifact.id),
      );
      let newResults: ExtractedSourceResult[] = [];
      if (pendingInputs.length) {
        report(
          "extracting",
          18,
          `${pendingInputs.length}개 자료를 한 번의 요청으로 전사·OCR·구조화 중`,
        );
        try {
          newResults = await provider.extractSources(pendingInputs);
        } catch (error) {
          throw new SourceExtractionError(
            `업로드한 ${pendingInputs.length}개 자료`,
            error,
          );
        }
        await Promise.all([
          repository.putSources(
            newResults.map((result) => result.artifact),
          ),
          repository.putExcerpts(
            newResults.flatMap((result) => result.excerpts),
          ),
        ]);
      }
      const resultBySource = new Map(
        [...cachedResults, ...newResults].map((result) => [
          result.artifact.id,
          result,
        ]),
      );
      const extracted = sourceInputs.map((input) => {
        const result = resultBySource.get(input.artifact.id);
        if (!result) {
          throw new SourceExtractionError(
            input.artifact.fileName,
            "분석 결과에서 해당 자료를 찾지 못했습니다.",
          );
        }
        return result;
      });
      const sources = extracted.map((result) => result.artifact);
      const excerpts = extracted.flatMap((result) => result.excerpts);
      const evidence = extracted.flatMap((result) => result.evidence);
      await Promise.all([
        repository.putSources(sources),
        repository.putExcerpts(excerpts),
      ]);
      set({ sources, excerpts, evidence });

      report("merging", 52, "Evidence unit 통합 및 조건 정규화");
      const merged = {
        evidence,
        conflicts: detectConflicts(evidence, sources),
        missingFields: detectMissingFields(evidence),
        warnings: [] as string[],
      };
      report("detecting", 70, "충돌 및 필수 조건 누락 탐지");
      set({
        conflicts: merged.conflicts,
        missingFields: merged.missingFields,
      });

      report("generating", 84, "출처가 연결된 프로토콜 생성");
      const snapshot = await provider.generateProtocol({
        evidence,
        sources,
        conflicts: merged.conflicts,
        missingFields: merged.missingFields,
      });
      const generatedTitle = createGeneratedProtocolTitle(
        snapshot.experiment.title,
        protocolTitleSuffix(active.title)
          ? active.title
          : createDefaultProtocolTitle(get().protocols, active.createdAt),
      );
      const namedSnapshot = {
        ...snapshot,
        experiment: {
          ...snapshot.experiment,
          title: generatedTitle,
        },
      };
      const namedProtocol = {
        ...active,
        title: generatedTitle,
        objective: namedSnapshot.experiment.objective,
        category: namedSnapshot.experiment.category,
      };
      const result = await repository.saveProtocol(
        namedProtocol,
        namedSnapshot,
        {
          changeSummary: `${sources.length}개 자료의 evidence를 분석해 프로토콜 생성`,
          changedBy: "현재 사용자",
          bumpVersion: true,
        },
      );
      const protocols = await repository.getProtocols(active.labId);
      const versions = await repository.getVersions(active.id);
      set({
        activeProtocol: { ...result.protocol, snapshot: namedSnapshot },
        protocols,
        sources: namedSnapshot.sources,
        conflicts: namedSnapshot.conflicts,
        missingFields: namedSnapshot.missingFields,
        versions,
        suggestions: [],
      });
      report("complete", 100, "분석 완료");
      set({
        toast: {
          kind: "success",
          message: `충돌 ${namedSnapshot.conflicts.length}건과 누락 ${namedSnapshot.missingFields.length}건을 표시한 프로토콜을 생성했습니다.`,
        },
      });
    } catch (error) {
      report("error", get().analysisProgress, "분석 오류");
      set({ error: toUserMessage(error) });
    }
  },

  resolveConflict: async (id, resolution, note) => {
    const state = get();
    if (!state.activeProtocol) return;
    const conflict = state.conflicts.find((item) => item.id === id);
    if (!conflict) {
      set({ error: "해당 충돌 항목을 찾지 못했습니다." });
      return;
    }
    try {
      const provider = selectProvider();
      const conflicts = state.conflicts.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "resolved" as const,
              selectedResolution: resolution.trim(),
              resolutionNote: note?.trim() || undefined,
            }
          : item,
      );
      const snapshot = await provider.regenerateAfterResolution({
        protocol: state.activeProtocol.snapshot,
        evidence: state.evidence,
        conflicts,
        missingFields: state.missingFields,
      });
      const result = await getLabTraceRepository().saveProtocol(
        state.activeProtocol,
        snapshot,
        {
          changeSummary: `${conflict.description} 해결`,
          changedBy: "현재 사용자",
          bumpVersion: true,
        },
      );
      const [protocols, versions] = await Promise.all([
        getLabTraceRepository().getProtocols(state.activeProtocol.labId),
        getLabTraceRepository().getVersions(state.activeProtocol.id),
      ]);
      set({
        activeProtocol: { ...result.protocol, snapshot },
        protocols,
        versions,
        conflicts: snapshot.conflicts,
        missingFields: snapshot.missingFields,
        sources: snapshot.sources,
        toast: {
          kind: "success",
          message: "선택한 근거를 프로토콜에 반영하고 새 버전을 만들었습니다.",
        },
        error: null,
      });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },

  answerMissing: async (id, answer) => {
    const state = get();
    if (!state.activeProtocol) return;
    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer) {
      set({ error: "확인한 답변을 입력해 주세요." });
      return;
    }
    const missing = state.missingFields.find((item) => item.id === id);
    if (!missing) {
      set({ error: "해당 누락 항목을 찾지 못했습니다." });
      return;
    }
    try {
      const now = new Date().toISOString();
      const missingFields = state.missingFields.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "answered" as const,
              userAnswer: trimmedAnswer,
              answeredBy: "현재 사용자",
              answeredAt: now,
            }
          : item,
      );
      const snapshot = applyMissingAnswerLocally(
        state.activeProtocol.snapshot,
        missing,
        missingFields,
        trimmedAnswer,
        now,
      );
      const result = await getLabTraceRepository().saveProtocol(
        state.activeProtocol,
        snapshot,
        {
          changeSummary: `누락 항목 답변 반영: ${missing.question}`,
          changedBy: "현재 사용자",
          bumpVersion: true,
          now,
        },
      );
      const [protocols, versions] = await Promise.all([
        getLabTraceRepository().getProtocols(state.activeProtocol.labId),
        getLabTraceRepository().getVersions(state.activeProtocol.id),
      ]);
      set({
        activeProtocol: { ...result.protocol, snapshot },
        protocols,
        versions,
        conflicts: snapshot.conflicts,
        missingFields: snapshot.missingFields,
        sources: snapshot.sources,
        toast: {
          kind: "success",
          message:
            "연구자 확인 답변을 출처로 기록하고 프로토콜에 반영했습니다.",
        },
        error: null,
      });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },

  saveProtocol: async (patch, summary, bumpVersion = true) => {
    const active = get().activeProtocol;
    if (!active) return;
    try {
      const { snapshot: nextSnapshot, ...protocolPatch } = patch;
      const protocol: Protocol = {
        ...active,
        ...protocolPatch,
        id: active.id,
        labId: active.labId,
        createdAt: active.createdAt,
      };
      const snapshot = normalizeProtocolResourceLabels(
        nextSnapshot ?? active.snapshot,
      );
      const result = await getLabTraceRepository().saveProtocol(
        protocol,
        snapshot,
        {
          changeSummary: summary || "프로토콜 수정",
          changedBy: "현재 사용자",
          bumpVersion,
        },
      );
      const [protocols, versions] = await Promise.all([
        getLabTraceRepository().getProtocols(active.labId),
        getLabTraceRepository().getVersions(active.id),
      ]);
      set({
        activeProtocol: { ...result.protocol, snapshot },
        protocols,
        versions,
        conflicts: snapshot.conflicts,
        missingFields: snapshot.missingFields,
        sources: snapshot.sources,
        toast: {
          kind: "success",
          message: bumpVersion
            ? `버전 ${result.protocol.currentVersion}으로 저장했습니다.`
            : "변경사항을 자동 저장했습니다.",
        },
        error: null,
      });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },

  setProtocolStatus: async (status) => {
    await get().saveProtocol(
      { status },
      `상태를 ${status}로 변경`,
      true,
    );
  },

  duplicateProtocol: async (id) => {
    try {
      const repository = getLabTraceRepository();
      const original = await repository.getProtocolDocument(id);
      if (!original) {
        set({ error: "복제할 프로토콜을 찾지 못했습니다." });
        return null;
      }
      const originalSources = await repository.getSources(id);
      const originalExcerpts = await repository.getExcerpts(id);
      const newProtocolId = createId("protocol");
      const sourceIdMap = new Map(
        originalSources.map((source) => [
          source.id,
          createId(`${newProtocolId}-source`),
        ]),
      );
      const excerptIdMap = new Map(
        originalExcerpts.map((excerpt) => [
          excerpt.id,
          createId(`${newProtocolId}-excerpt`),
        ]),
      );
      const now = new Date().toISOString();
      const snapshot = remapSnapshotSources(
        original.snapshot,
        sourceIdMap,
        excerptIdMap,
        newProtocolId,
      );
      const protocol: Protocol = {
        ...original,
        id: newProtocolId,
        title: `${original.title} — 복사본`,
        status: "draft",
        currentVersion: 1,
        createdBy: "현재 사용자",
        createdAt: now,
        updatedAt: now,
      };
      await repository.putProtocol(protocol, snapshot);
      await repository.putExcerpts(
        originalExcerpts.map((excerpt) => ({
          ...excerpt,
          id: excerptIdMap.get(excerpt.id)!,
          sourceArtifactId:
            sourceIdMap.get(excerpt.sourceArtifactId) ??
            excerpt.sourceArtifactId,
        })),
      );
      const protocols = await repository.getProtocols(protocol.labId);
      const protocolState = await readProtocolState(protocol.id);
      set({
        ...protocolState,
        protocols,
        evidence: [],
        suggestions: [],
        selectedSourceRef: null,
        toast: {
          kind: "success",
          message: "프로토콜과 출처를 독립된 복사본으로 만들었습니다.",
        },
        error: null,
      });
      return protocol;
    } catch (error) {
      set({ error: toUserMessage(error) });
      return null;
    }
  },

  deleteProtocol: async (id) => {
    try {
      const state = get();
      await getLabTraceRepository().deleteProtocol(id);
      const protocols = await getLabTraceRepository().getProtocols(
        state.lab?.id,
      );
      const nextId =
        state.activeProtocol?.id === id
          ? protocols[0]?.id
          : state.activeProtocol?.id;
      const protocolState = nextId
        ? await readProtocolState(nextId)
        : {
            activeProtocol: null,
            sources: [],
            excerpts: [],
            conflicts: [],
            missingFields: [],
            versions: [],
            chatMessages: [],
          };
      set({
        ...protocolState,
        protocols,
        evidence: [],
        suggestions: [],
        selectedSourceRef: null,
        toast: { kind: "success", message: "프로토콜을 삭제했습니다." },
        error: null,
      });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },

  updateSource: async (id, patch) => {
    const active = get().activeProtocol;
    if (!active) return;
    try {
      const updated = await getLabTraceRepository().updateSource(id, patch);
      const sources = get().sources.map((source) =>
        source.id === id ? updated : source,
      );
      const snapshot = {
        ...active.snapshot,
        sources: active.snapshot.sources.map((source) =>
          source.id === id ? updated : source,
        ),
      };
      const nextProtocol = {
        ...active,
        snapshot,
        updatedAt: new Date().toISOString(),
      };
      await getLabTraceRepository().putProtocol(nextProtocol, snapshot);
      set({
        activeProtocol: nextProtocol,
        sources,
        toast: { kind: "success", message: "자료 메타데이터를 저장했습니다." },
        error: null,
      });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },

  sendChat: async (question) => {
    const state = get();
    const trimmed = question.trim();
    if (!state.activeProtocol || !trimmed) return null;
    const createdAt = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: createId("chat-user"),
      protocolId: state.activeProtocol.id,
      role: "user",
      content: trimmed,
      citations: [],
      createdAt,
    };
    const pendingMessages = [...state.chatMessages, userMessage];
    set({ chatMessages: pendingMessages, error: null });
    try {
      const provider = selectProvider();
      await getLabTraceRepository().putChatMessages([userMessage]);
      const response = await provider.chatWithProtocol({
        protocol: state.activeProtocol.snapshot,
        protocolId: state.activeProtocol.id,
        question: trimmed,
        history: pendingMessages,
      });
      const assistantMessage: ChatMessage = {
        id: createId("chat-assistant"),
        protocolId: state.activeProtocol.id,
        role: "assistant",
        content: response.content,
        citations: response.citations,
        suggestionType: response.suggestionType,
        createdAt: new Date(Date.now() + 1).toISOString(),
      };
      await getLabTraceRepository().putChatMessages([assistantMessage]);
      set({
        chatMessages: [...pendingMessages, assistantMessage],
        error: null,
      });
      return assistantMessage;
    } catch (error) {
      set({ error: toUserMessage(error) });
      return null;
    }
  },

  selectSource: (ref) => set({ selectedSourceRef: ref }),

  setActiveProtocol: async (id) => {
    try {
      const protocolState = await readProtocolState(id);
      set({
        ...protocolState,
        evidence: [],
        suggestions: [],
        selectedSourceRef: null,
        error: null,
      });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },

  updateProtocolSnapshot: (patch) => {
    const active = get().activeProtocol;
    if (!active) return;
    const snapshot = normalizeProtocolResourceLabels({
      ...active.snapshot,
      ...patch,
    });
    set({
      activeProtocol: { ...active, snapshot },
      conflicts: snapshot.conflicts,
      missingFields: snapshot.missingFields,
      sources: snapshot.sources,
    });
  },

  clearToast: () => set({ toast: null }),
  clearError: () => set({ error: null }),

  resetDemo: async () => {
    try {
      await getLabTraceRepository().reset();
      forgetSelectedLabId();
      set({
        lab: null,
        protocols: [],
        activeProtocol: null,
        sources: [],
        excerpts: [],
        conflicts: [],
        missingFields: [],
        versions: [],
        chatMessages: [],
        suggestions: [],
        evidence: [],
        hydrated: true,
        analysisStage: "idle",
        analysisProgress: 0,
        selectedSourceRef: null,
        toast: {
          kind: "success",
          message: "이 브라우저의 ARIA 데이터를 초기화했습니다.",
        },
        error: null,
      });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },

}));
