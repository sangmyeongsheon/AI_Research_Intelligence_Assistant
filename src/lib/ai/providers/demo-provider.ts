import {
  cloneDemoValue,
  demoEvidence,
  demoExcerpts,
  demoProtocolSnapshot,
  demoRef,
  demoSuggestions,
  USER_CONFIRMED_SOURCE_ID,
} from "@/src/lib/demo";
import {
  detectConflicts,
  detectMissingFields,
} from "@/src/lib/ai/detection";
import type {
  AIProvider,
  ChatWithProtocolInput,
  ExtractSourceInput,
  GenerateProtocolInput,
  MergeEvidenceInput,
  RegenerateAfterResolutionInput,
} from "@/src/lib/ai/provider";
import type {
  ChatResponse,
  Conflict,
  EvidenceUnit,
  MissingField,
  ProtocolSnapshot,
  ProtocolStep,
  SourceArtifact,
  SourceRef,
  StructuredProtocolOutput,
} from "@/src/types";

function uniqueId(prefix: string, value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function resolveConflictValue(conflict: Conflict): string | undefined {
  if (!conflict.selectedResolution) return undefined;
  return (
    conflict.options.find(
      (option) =>
        option.id === conflict.selectedResolution ||
        option.value === conflict.selectedResolution ||
        option.label === conflict.selectedResolution,
    )?.value ?? conflict.selectedResolution
  );
}

function replaceOrAppendParameter(
  step: ProtocolStep,
  parameterName: string,
  value: string,
  sourceRefs: SourceRef[],
): void {
  const normalizedName = parameterName.toLocaleLowerCase("en-US");
  const existing = step.parameters.find((parameter) =>
    parameter.name.toLocaleLowerCase("en-US").includes(normalizedName),
  );
  if (existing) {
    existing.value = value;
    existing.unit = "";
    existing.normalizedValue = value;
    existing.normalizedUnit = undefined;
    existing.sourceRefs = sourceRefs;
  } else {
    step.parameters.push({
      name: parameterName,
      value,
      unit: "",
      normalizedValue: value,
      sourceRefs,
    });
  }
}

function makeUserConfirmedSource(
  answered: MissingField[],
): SourceArtifact | undefined {
  if (answered.length === 0) return undefined;
  const latest = answered
    .map((field) => field.answeredAt)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);
  return {
    id: USER_CONFIRMED_SOURCE_ID,
    protocolId: "protocol-western-blot-transfer",
    type: "text",
    fileName: "user-confirmed-answers.txt",
    displayName: "연구자 확인 답변",
    mimeType: "text/plain",
    size: answered.reduce(
      (total, field) => total + (field.userAnswer?.length ?? 0),
      0,
    ),
    author: answered.at(-1)?.answeredBy ?? "현재 사용자",
    sourceDate: (latest ?? new Date().toISOString()).slice(0, 10),
    reliability: "current",
    notes: "누락 항목 검토 화면에서 연구자가 직접 확인한 답변입니다.",
    extractedText: answered
      .map((field) => `${field.question}\n${field.userAnswer}`)
      .join("\n\n"),
    processingStatus: "ready",
    createdAt: latest ?? new Date().toISOString(),
  };
}

function userAnswerRef(field: MissingField): SourceRef {
  return {
    artifactId: USER_CONFIRMED_SOURCE_ID,
    sourceLabel: "연구자 확인 답변",
    author: field.answeredBy ?? "현재 사용자",
    quote: field.userAnswer ?? "",
    confidence: 1,
  };
}

function applyConflictResolutions(
  snapshot: ProtocolSnapshot,
  conflicts: Conflict[],
): void {
  for (const conflict of conflicts) {
    if (conflict.status !== "resolved") continue;
    const value = resolveConflictValue(conflict);
    if (!value) continue;
    const refs =
      conflict.options.find(
        (option) =>
          option.id === conflict.selectedResolution ||
          option.value === conflict.selectedResolution,
      )?.sourceRefs ?? conflict.sourceRefs;
    const step = snapshot.steps.find((item) => item.id === conflict.stepId);
    if (!step) continue;

    switch (conflict.field) {
      case "transfer_conditions":
        replaceOrAppendParameter(step, "Transfer 조건", value, refs);
        step.duration = value.match(/(\d+\s*min)/i)?.[1] ?? value;
        step.action = `연구자가 확인한 조건(${value})으로 Transfer 진행.`;
        break;
      case "blocking_duration":
        replaceOrAppendParameter(step, "Blocking 시간", value, refs);
        step.duration = value;
        break;
      case "blocking_reagent":
        replaceOrAppendParameter(step, "Blocking reagent", value, refs);
        step.materials = [
          value,
          ...step.materials.filter(
            (material) =>
              !/milk|bsa|blocking reagent/i.test(material.toLocaleLowerCase()),
          ),
        ];
        break;
      case "primary_antibody_dilution":
        replaceOrAppendParameter(step, "Dilution", value, refs);
        break;
      default:
        replaceOrAppendParameter(step, conflict.field, value, refs);
    }
  }
}

function applyMissingAnswers(
  snapshot: ProtocolSnapshot,
  missingFields: MissingField[],
): void {
  const answered = missingFields.filter(
    (field) => field.status === "answered" && field.userAnswer?.trim(),
  );
  const confirmedSource = makeUserConfirmedSource(answered);
  if (confirmedSource) {
    snapshot.sources = [
      ...snapshot.sources.filter(
        (source) => source.id !== USER_CONFIRMED_SOURCE_ID,
      ),
      confirmedSource,
    ];
  }

  for (const field of answered) {
    const answer = field.userAnswer!.trim();
    const sourceRef = userAnswerRef(field);
    const step = snapshot.steps.find((item) => item.id === field.stepId);

    switch (field.field) {
      case "target_protein":
        if (step)
          replaceOrAppendParameter(step, "Target protein", answer, [sourceRef]);
        if (!snapshot.materials.some((item) => item.startsWith("Target:"))) {
          snapshot.materials.push(`Target: ${answer} (연구자 확인)`);
        }
        break;
      case "membrane_type":
        snapshot.materials = [
          `${answer} (연구자 확인)`,
          ...snapshot.materials.filter(
            (item) => !item.toLocaleLowerCase().includes("membrane"),
          ),
        ];
        if (step) {
          step.materials = [`${answer} (연구자 확인)`];
          replaceOrAppendParameter(step, "Membrane 종류", answer, [sourceRef]);
        }
        break;
      case "pvdf_pretreatment_conditions":
        if (step)
          replaceOrAppendParameter(
            step,
            "PVDF 사전 처리",
            answer,
            [sourceRef],
          );
        break;
      case "transfer_equipment":
        snapshot.equipment = [
          `${answer} (연구자 확인)`,
          ...snapshot.equipment.filter(
            (item) => !item.toLocaleLowerCase().includes("transfer 장비"),
          ),
        ];
        if (step) step.equipment = [`${answer} (연구자 확인)`];
        break;
      case "primary_antibody_product":
        snapshot.materials = [
          `${answer} (연구자 확인)`,
          ...snapshot.materials.filter(
            (item) => !item.toLocaleLowerCase().includes("primary antibody"),
          ),
        ];
        if (step) step.materials = [`${answer} (연구자 확인)`];
        break;
      case "phospho_target":
        if (step)
          replaceOrAppendParameter(
            step,
            "Phospho-target 여부",
            answer,
            [sourceRef],
          );
        break;
      case "objective_success_criterion":
        for (const protocolStep of snapshot.steps) {
          protocolStep.successCriteria = [answer];
        }
        break;
      default:
        if (step) replaceOrAppendParameter(step, field.field, answer, [sourceRef]);
    }
  }
}

function updateUnresolvedState(
  snapshot: ProtocolSnapshot,
  conflicts: Conflict[],
  missingFields: MissingField[],
): void {
  for (const step of snapshot.steps) {
    step.unresolved =
      conflicts.some(
        (conflict) =>
          conflict.stepId === step.id && conflict.status === "unresolved",
      ) ||
      missingFields.some(
        (field) =>
          field.stepId === step.id && field.status === "unresolved",
      );
  }
  const unresolvedConflicts = conflicts.filter(
    (conflict) => conflict.status === "unresolved",
  ).length;
  const unresolvedMissing = missingFields.filter(
    (field) => field.status === "unresolved",
  ).length;
  snapshot.overallWarnings = [
    "미해결 충돌과 누락 항목을 확인하고 연구실의 검토 절차에 따라 상태를 확정하세요.",
    `미해결 충돌 ${unresolvedConflicts}건과 누락 항목 ${unresolvedMissing}건을 반드시 확인하세요.`,
    "업로드한 원본에서 확인되지 않은 조건은 프로토콜에 확정하지 않았습니다.",
  ];
}

export class DemoProvider implements AIProvider {
  readonly id = "demo" as const;

  async extractSource(
    input: ExtractSourceInput,
  ): Promise<ReturnType<AIProvider["extractSource"]> extends Promise<infer T> ? T : never> {
    const matchingEvidence = demoEvidence.filter(
      (unit) => unit.sourceArtifactId === input.artifact.id,
    );
    const matchingExcerpts = demoExcerpts.filter(
      (excerpt) => excerpt.sourceArtifactId === input.artifact.id,
    );
    if (matchingEvidence.length > 0) {
      return cloneDemoValue({
        artifact: { ...input.artifact, processingStatus: "ready" as const },
        excerpts: matchingExcerpts,
        evidence: matchingEvidence,
        warnings: [],
      });
    }

    const text = input.text ?? input.artifact.extractedText;
    if (!text.trim()) {
      return {
        artifact: {
          ...input.artifact,
          processingStatus: "error",
          processingError: "자료에서 읽을 수 있는 텍스트를 찾지 못했습니다.",
        },
        excerpts: [],
        evidence: [],
        warnings: [
          "자료에서 읽을 수 있는 텍스트를 찾지 못했습니다. 원본을 확인해 주세요.",
        ],
      };
    }

    const excerptId = uniqueId("excerpt", input.artifact.id);
    const evidenceId = uniqueId("evidence", input.artifact.id);
    const excerpt = {
      id: excerptId,
      sourceArtifactId: input.artifact.id,
      excerptText: text,
      confidence: 1,
      author: input.artifact.author,
      sourceDate: input.artifact.sourceDate,
    };
    const evidence: EvidenceUnit = {
      id: evidenceId,
      sourceArtifactId: input.artifact.id,
      sourceExcerptId: excerptId,
      category: "other",
      statement: text,
      author: input.artifact.author,
      sourceDate: input.artifact.sourceDate,
      quote: text.slice(0, 500),
      confidence: 1,
    };
    return {
      artifact: {
        ...input.artifact,
        extractedText: text,
        processingStatus: "ready",
      },
      excerpts: [excerpt],
      evidence: [evidence],
      warnings: [
        "추가 자료는 원문 evidence로 보존되며 AI 연결 상태에 따라 의미 분류 범위가 달라질 수 있습니다.",
      ],
    };
  }

  async extractSources(inputs: ExtractSourceInput[]) {
    return Promise.all(inputs.map((input) => this.extractSource(input)));
  }

  async mergeEvidence(input: MergeEvidenceInput) {
    const evidence = cloneDemoValue(input.evidence);
    return {
      evidence,
      conflicts: detectConflicts(evidence, input.sources),
      missingFields: detectMissingFields(evidence),
      warnings: [],
    };
  }

  async generateProtocol(
    input: GenerateProtocolInput,
  ): Promise<StructuredProtocolOutput> {
    const snapshot = cloneDemoValue(demoProtocolSnapshot);
    snapshot.sources = cloneDemoValue(input.sources);
    snapshot.conflicts = cloneDemoValue(
      input.conflicts ?? detectConflicts(input.evidence, input.sources),
    );
    snapshot.missingFields = cloneDemoValue(
      input.missingFields ?? detectMissingFields(input.evidence),
    );
    updateUnresolvedState(
      snapshot,
      snapshot.conflicts,
      snapshot.missingFields,
    );
    return snapshot;
  }

  async regenerateAfterResolution(
    input: RegenerateAfterResolutionInput,
  ): Promise<StructuredProtocolOutput> {
    const snapshot = cloneDemoValue(input.protocol);
    snapshot.conflicts = cloneDemoValue(input.conflicts);
    snapshot.missingFields = cloneDemoValue(input.missingFields);
    applyConflictResolutions(snapshot, snapshot.conflicts);
    applyMissingAnswers(snapshot, snapshot.missingFields);
    updateUnresolvedState(
      snapshot,
      snapshot.conflicts,
      snapshot.missingFields,
    );
    return snapshot;
  }

  async chatWithProtocol(
    input: ChatWithProtocolInput,
  ): Promise<ChatResponse> {
    const question = input.question.toLocaleLowerCase("ko-KR");
    if (
      question.includes("반드시") ||
      question.includes("실험 전") ||
      question.includes("확인")
    ) {
      return {
        content:
          "다음 연구자는 실행 전에 ① target protein과 phospho-target 여부, ② membrane 종류와 PVDF 사전 처리 조건, ③ transfer 장비 모델, ④ primary antibody 제품과 검증 dilution을 확인해야 합니다. 자료 안에서는 transfer 조건, blocking 시간·reagent, primary dilution이 서로 충돌합니다. 약한 밴드가 예상되면 antibody 농도를 먼저 바꾸기보다 transfer 상태부터 확인하라는 인수인계가 있습니다.",
        citations: [
          demoRef("evidence-audio-transfer"),
          demoRef("evidence-image-transfer"),
          demoRef("evidence-pdf-blocking-reagent"),
          demoRef("evidence-note-bsa"),
          demoRef("evidence-audio-weak-band-tip"),
        ],
        suggestionType: "source_backed",
      };
    }
    if (question.includes("background") || question.includes("백그라운드")) {
      return {
        content:
          "자료에서는 membrane 건조를 피하고, background가 높을 때 washing 조건과 blocking reagent를 확인하라고 합니다. 현재 blocking reagent는 5% milk와 phospho-target용 BSA가 충돌하므로 phospho-target 여부를 먼저 확인해야 합니다.",
        citations: [
          demoRef("evidence-note-dry-warning"),
          demoRef("evidence-trouble-background"),
          demoRef("evidence-pdf-blocking-reagent"),
          demoRef("evidence-note-bsa"),
        ],
        suggestionType: "source_backed",
      };
    }
    if (question.includes("dilution") || question.includes("희석")) {
      return {
        content:
          "원본에는 1:1000, 불확실한 1:2000?, target별 상이라는 세 근거가 있어 공통값을 확정할 수 없습니다. 사용할 antibody 제품과 target의 최근 검증값을 담당 연구자에게 확인하세요.",
        citations: [
          demoRef("evidence-pdf-primary-dilution"),
          demoRef("evidence-image-primary"),
          demoRef("evidence-note-dilution-variable"),
        ],
        suggestionType: "clarification_question",
      };
    }
    return {
      content:
        "연결된 자료에서 이 질문에 답할 충분한 근거를 찾지 못했습니다. 담당 연구자에게 확인할 질문으로 남겨 주세요. 일반 지식으로 빈칸을 채우지 않았습니다.",
      citations: [],
      suggestionType: "clarification_question",
    };
  }

  async generateSuggestions() {
    return cloneDemoValue(demoSuggestions);
  }
}

export {
  applyConflictResolutions,
  applyMissingAnswers,
  updateUnresolvedState,
};
