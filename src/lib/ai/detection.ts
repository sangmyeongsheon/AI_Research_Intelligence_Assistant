import type {
  Conflict,
  ConflictSeverity,
  EvidenceUnit,
  MissingField,
  SourceArtifact,
  SourceRef,
} from "@/src/types";

const severityByField: Record<string, ConflictSeverity> = {
  transfer_conditions: "high",
  blocking_duration: "medium",
  blocking_reagent: "high",
  primary_antibody_dilution: "high",
};

function normalizedEvidenceValue(evidence: EvidenceUnit): string | undefined {
  const value = evidence.normalizedValue ?? evidence.value;
  if (value === undefined || value === "") return undefined;
  const unit = evidence.normalizedUnit ?? evidence.unit ?? "";
  return `${String(value).trim()} ${unit.trim()}`
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ");
}

function labelForField(field: string): string {
  const labels: Record<string, string> = {
    transfer_conditions: "Transfer 조건",
    blocking_duration: "Blocking 시간",
    blocking_reagent: "Blocking reagent",
    primary_antibody_dilution: "Primary antibody dilution",
  };
  return labels[field] ?? field.replaceAll("_", " ");
}

function stepForField(field: string): string | undefined {
  if (field.startsWith("transfer")) return "step-transfer";
  if (field.startsWith("blocking")) return "step-blocking";
  if (field.startsWith("primary_antibody")) return "step-primary";
  return undefined;
}

function evidenceToSourceRef(
  evidence: EvidenceUnit,
  sourceMap: Map<string, SourceArtifact>,
): SourceRef {
  return {
    artifactId: evidence.sourceArtifactId,
    excerptId: evidence.sourceExcerptId,
    sourceLabel:
      sourceMap.get(evidence.sourceArtifactId)?.displayName ??
      evidence.sourceArtifactId,
    author: evidence.author,
    pageNumber: evidence.pageNumber,
    timestampStart: evidence.timestamp,
    timestampEnd: evidence.timestampEnd,
    quote: evidence.quote,
    confidence: evidence.confidence,
  };
}

/**
 * Evidence-level detector: values are grouped only by an explicit semantic
 * parameterName, never by fuzzy text guesses. This makes conflicts auditable
 * and prevents a provider from silently collapsing incompatible values.
 */
export function detectConflicts(
  evidence: EvidenceUnit[],
  sources: SourceArtifact[] = [],
): Conflict[] {
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const groups = new Map<
    string,
    Map<string, { displayValue: string; evidence: EvidenceUnit[] }>
  >();

  for (const unit of evidence) {
    if (!unit.parameterName) continue;
    const normalized = normalizedEvidenceValue(unit);
    if (!normalized) continue;
    const displayValue = `${String(unit.value ?? unit.normalizedValue)}${
      unit.unit ? ` ${unit.unit}` : ""
    }`.trim();
    const values =
      groups.get(unit.parameterName) ??
      new Map<string, { displayValue: string; evidence: EvidenceUnit[] }>();
    const current = values.get(normalized) ?? { displayValue, evidence: [] };
    current.evidence.push(unit);
    values.set(normalized, current);
    groups.set(unit.parameterName, values);
  }

  const conflicts: Conflict[] = [];
  for (const [field, values] of groups) {
    if (values.size < 2) continue;
    const options = [...values.entries()].map(
      ([normalized, group], optionIndex) => ({
        id: `conflict-${field}-option-${optionIndex + 1}`,
        label: group.displayValue,
        value: group.displayValue,
        sourceRefs: group.evidence.map((unit) =>
          evidenceToSourceRef(unit, sourceMap),
        ),
        _sort: normalized,
      }),
    );
    options.sort((left, right) => left._sort.localeCompare(right._sort));
    const cleanOptions = options.map((option) => {
      const clean = { ...option } as Partial<typeof option>;
      delete clean._sort;
      return clean as Omit<typeof option, "_sort">;
    });
    const sourceRefs = cleanOptions.flatMap((option) => option.sourceRefs);

    conflicts.push({
      id: `conflict-${field}`,
      field,
      stepId: stepForField(field),
      description: `${labelForField(field)}에 대해 서로 다른 근거가 확인되었습니다. 연구자가 원본을 비교해 확정해야 합니다.`,
      options: cleanOptions,
      sourceRefs,
      severity: severityByField[field] ?? "medium",
      status: "unresolved",
    });
  }

  return conflicts.sort((left, right) => left.id.localeCompare(right.id));
}

interface RequiredEvidenceField {
  id: string;
  field: string;
  stepId?: string;
  matches: (unit: EvidenceUnit) => boolean;
  reason: string;
  question: string;
  severity: ConflictSeverity;
}

const requiredEvidenceFields: RequiredEvidenceField[] = [
  {
    id: "missing-target-protein",
    field: "target_protein",
    stepId: "step-primary",
    matches: (unit) =>
      unit.parameterName === "target_protein" && unit.value !== undefined,
    reason: "현재 실험의 target protein 정보가 자료에 없습니다.",
    question: "이번 실험의 target protein은 무엇인가요?",
    severity: "high",
  },
  {
    id: "missing-membrane-type",
    field: "membrane_type",
    stepId: "step-membrane",
    matches: (unit) =>
      unit.parameterName === "membrane_type" &&
      unit.value !== undefined &&
      !unit.ambiguity,
    reason: "실제로 사용할 membrane 종류가 확정되어 있지 않습니다.",
    question: "사용할 membrane 종류는 무엇인가요?",
    severity: "high",
  },
  {
    id: "missing-pvdf-pretreatment",
    field: "pvdf_pretreatment_conditions",
    stepId: "step-membrane",
    matches: (unit) =>
      unit.parameterName === "pvdf_pretreatment_conditions" &&
      unit.value !== undefined &&
      !unit.ambiguity,
    reason: "PVDF 사전 처리 필요성만 언급되었고 구체 조건은 없습니다.",
    question:
      "PVDF를 사용할 경우 사전 처리 시간과 용액 등 구체 조건은 무엇인가요?",
    severity: "high",
  },
  {
    id: "missing-transfer-equipment",
    field: "transfer_equipment",
    stepId: "step-transfer",
    matches: (unit) =>
      unit.parameterName === "transfer_equipment" && unit.value !== undefined,
    reason: "Transfer 장비 또는 장비별 조건이 확인되지 않습니다.",
    question: "현재 연구실에서 사용하는 transfer 장비 모델은 무엇인가요?",
    severity: "medium",
  },
  {
    id: "missing-primary-antibody",
    field: "primary_antibody_product",
    stepId: "step-primary",
    matches: (unit) =>
      unit.parameterName === "primary_antibody_product" &&
      unit.value !== undefined,
    reason: "실제 primary antibody 제품 정보가 없습니다.",
    question:
      "사용할 primary antibody의 제조사, catalog number, 공식 dilution 또는 최근 검증값은 무엇인가요?",
    severity: "high",
  },
  {
    id: "missing-phospho-target",
    field: "phospho_target",
    stepId: "step-blocking",
    matches: (unit) =>
      unit.parameterName === "phospho_target" && unit.value !== undefined,
    reason: "Blocking reagent 선택에 필요한 phospho-target 여부가 없습니다.",
    question: "이번 target이 phospho-target에 해당하나요?",
    severity: "high",
  },
  {
    id: "missing-success-criterion",
    field: "objective_success_criterion",
    matches: (unit) =>
      unit.category === "success_criterion" && unit.value !== undefined,
    reason: "성공을 판단할 객관적인 기준이 자료에 없습니다.",
    question:
      "이번 실험의 성공 판정에 사용할 객관적 기준(예: 대조군 또는 허용 범위)은 무엇인가요?",
    severity: "medium",
  },
];

/**
 * Missing means no explicit, non-ambiguous evidence exists. Merely mentioning
 * a concept (for example "PVDF needs pretreatment") cannot fill its conditions.
 */
export function detectMissingFields(evidence: EvidenceUnit[]): MissingField[] {
  return requiredEvidenceFields
    .filter((required) => !evidence.some(required.matches))
    .map((required) => ({
      id: required.id,
      field: required.field,
      stepId: required.stepId,
      reason: required.reason,
      question: required.question,
      severity: required.severity,
      status: "unresolved" as const,
    }));
}

export { requiredEvidenceFields };
