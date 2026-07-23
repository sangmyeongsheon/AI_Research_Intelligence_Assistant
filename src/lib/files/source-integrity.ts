import type {
  ProtocolSnapshot,
  SourceArtifact,
  SourceExcerpt,
  SourceRef,
} from "@/src/types";
import { FileProcessingError } from "./errors";

export type SourceRefIntegrityIssueCode =
  | "MISSING_ARTIFACT"
  | "MISSING_EXCERPT"
  | "EXCERPT_ARTIFACT_MISMATCH"
  | "INVALID_PAGE_NUMBER"
  | "INVALID_TIMESTAMP_RANGE"
  | "INVALID_CONFIDENCE"
  | "EMPTY_SOURCE_LABEL";

export interface SourceRefIntegrityIssue {
  code: SourceRefIntegrityIssueCode;
  refIndex: number;
  artifactId: string;
  excerptId?: string;
  message: string;
}

export interface SourceRefIntegrityResult {
  valid: boolean;
  validRefs: SourceRef[];
  invalidRefs: SourceRef[];
  issues: SourceRefIntegrityIssue[];
}

export function checkSourceRefIntegrity(
  refs: readonly SourceRef[],
  artifacts: readonly SourceArtifact[],
  excerpts: readonly SourceExcerpt[] = [],
): SourceRefIntegrityResult {
  const artifactIds = new Set(artifacts.map((artifact) => artifact.id));
  const excerptById = new Map(
    excerpts.map((excerpt) => [excerpt.id, excerpt] as const),
  );
  const issues: SourceRefIntegrityIssue[] = [];
  const invalidIndexes = new Set<number>();

  const addIssue = (
    ref: SourceRef,
    refIndex: number,
    code: SourceRefIntegrityIssueCode,
    message: string,
  ) => {
    invalidIndexes.add(refIndex);
    issues.push({
      code,
      refIndex,
      artifactId: ref.artifactId,
      excerptId: ref.excerptId,
      message,
    });
  };

  refs.forEach((ref, refIndex) => {
    if (!artifactIds.has(ref.artifactId)) {
      addIssue(
        ref,
        refIndex,
        "MISSING_ARTIFACT",
        `출처 자료 ID(${ref.artifactId})가 자료 목록에 없습니다.`,
      );
    }

    if (ref.excerptId) {
      const excerpt = excerptById.get(ref.excerptId);
      if (!excerpt) {
        addIssue(
          ref,
          refIndex,
          "MISSING_EXCERPT",
          `원문 일부 ID(${ref.excerptId})를 찾을 수 없습니다.`,
        );
      } else if (excerpt.sourceArtifactId !== ref.artifactId) {
        addIssue(
          ref,
          refIndex,
          "EXCERPT_ARTIFACT_MISMATCH",
          `원문 일부(${ref.excerptId})가 다른 자료(${excerpt.sourceArtifactId})에 연결되어 있습니다.`,
        );
      }
    }

    if (
      ref.pageNumber !== undefined &&
      (!Number.isInteger(ref.pageNumber) || ref.pageNumber < 1)
    ) {
      addIssue(
        ref,
        refIndex,
        "INVALID_PAGE_NUMBER",
        "PDF 페이지 번호는 1 이상의 정수여야 합니다.",
      );
    }

    if (
      ref.timestampStart !== undefined &&
      ref.timestampEnd !== undefined &&
      (ref.timestampStart < 0 || ref.timestampEnd < ref.timestampStart)
    ) {
      addIssue(
        ref,
        refIndex,
        "INVALID_TIMESTAMP_RANGE",
        "오디오 타임스탬프 범위가 올바르지 않습니다.",
      );
    }

    if (
      !Number.isFinite(ref.confidence) ||
      ref.confidence < 0 ||
      ref.confidence > 1
    ) {
      addIssue(
        ref,
        refIndex,
        "INVALID_CONFIDENCE",
        "출처 신뢰도는 0에서 1 사이여야 합니다.",
      );
    }

    if (!ref.sourceLabel.trim()) {
      addIssue(
        ref,
        refIndex,
        "EMPTY_SOURCE_LABEL",
        "출처 표시 이름이 비어 있습니다.",
      );
    }
  });

  return {
    valid: issues.length === 0,
    validRefs: refs.filter((_, index) => !invalidIndexes.has(index)),
    invalidRefs: refs.filter((_, index) => invalidIndexes.has(index)),
    issues,
  };
}

export function assertSourceRefIntegrity(
  refs: readonly SourceRef[],
  artifacts: readonly SourceArtifact[],
  excerpts: readonly SourceExcerpt[] = [],
): void {
  const result = checkSourceRefIntegrity(refs, artifacts, excerpts);
  if (result.valid) return;

  throw new FileProcessingError({
    code: "SOURCE_REF_INVALID",
    title: "일부 출처 연결을 확인할 수 없습니다",
    message: `${result.issues.length}개의 출처 참조가 원본 자료와 일치하지 않습니다.`,
    recovery:
      "원본 자료가 삭제되었는지 확인하고, 문제가 있는 출처를 다시 연결해 주세요.",
    dataPreserved: true,
  });
}

export function collectProtocolSourceRefs(
  snapshot: Pick<ProtocolSnapshot, "steps" | "conflicts">,
): SourceRef[] {
  return [
    ...snapshot.steps.flatMap((step) => [
      ...step.sourceRefs,
      ...step.parameters.flatMap((parameter) => parameter.sourceRefs),
    ]),
    ...snapshot.conflicts.flatMap((conflict) => [
      ...conflict.sourceRefs,
      ...conflict.options.flatMap((option) => option.sourceRefs),
    ]),
  ];
}

export function checkProtocolSourceRefIntegrity(
  snapshot: Pick<ProtocolSnapshot, "steps" | "conflicts" | "sources">,
  excerpts: readonly SourceExcerpt[] = [],
): SourceRefIntegrityResult {
  return checkSourceRefIntegrity(
    collectProtocolSourceRefs(snapshot),
    snapshot.sources,
    excerpts,
  );
}

