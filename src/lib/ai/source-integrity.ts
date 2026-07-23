import type {
  ChatResponse,
  Conflict,
  ProtocolSnapshot,
  SourceExcerpt,
  SourceRef,
} from "@/src/types";

export interface CitationIntegrityIssue {
  path: string;
  artifactId: string;
  excerptId?: string;
  reason: "unknown_artifact" | "unknown_excerpt" | "excerpt_artifact_mismatch";
}

function collectRefs(snapshot: ProtocolSnapshot): Array<{
  path: string;
  ref: SourceRef;
}> {
  const refs: Array<{ path: string; ref: SourceRef }> = [];
  const add = (path: string, values: SourceRef[]) => {
    values.forEach((ref, index) => refs.push({ path: `${path}[${index}]`, ref }));
  };

  snapshot.steps.forEach((step, stepIndex) => {
    add(`steps[${stepIndex}].sourceRefs`, step.sourceRefs);
    step.parameters.forEach((parameter, parameterIndex) => {
      add(
        `steps[${stepIndex}].parameters[${parameterIndex}].sourceRefs`,
        parameter.sourceRefs,
      );
    });
  });
  snapshot.conflicts.forEach((conflict, conflictIndex) => {
    add(`conflicts[${conflictIndex}].sourceRefs`, conflict.sourceRefs);
    conflict.options.forEach((option, optionIndex) =>
      add(
        `conflicts[${conflictIndex}].options[${optionIndex}].sourceRefs`,
        option.sourceRefs,
      ),
    );
  });
  return refs;
}

export function validateSourceRefs(
  refs: Array<{ path: string; ref: SourceRef }>,
  artifactIds: Set<string>,
  excerpts: SourceExcerpt[],
): CitationIntegrityIssue[] {
  const excerptMap = new Map(excerpts.map((excerpt) => [excerpt.id, excerpt]));
  const issues: CitationIntegrityIssue[] = [];

  for (const { path, ref } of refs) {
    if (!artifactIds.has(ref.artifactId)) {
      issues.push({
        path,
        artifactId: ref.artifactId,
        excerptId: ref.excerptId,
        reason: "unknown_artifact",
      });
      continue;
    }
    if (!ref.excerptId) continue;
    const excerpt = excerptMap.get(ref.excerptId);
    if (!excerpt) {
      issues.push({
        path,
        artifactId: ref.artifactId,
        excerptId: ref.excerptId,
        reason: "unknown_excerpt",
      });
    } else if (excerpt.sourceArtifactId !== ref.artifactId) {
      issues.push({
        path,
        artifactId: ref.artifactId,
        excerptId: ref.excerptId,
        reason: "excerpt_artifact_mismatch",
      });
    }
  }
  return issues;
}

export function validateProtocolCitationIntegrity(
  snapshot: ProtocolSnapshot,
  excerpts: SourceExcerpt[],
): CitationIntegrityIssue[] {
  return validateSourceRefs(
    collectRefs(snapshot),
    new Set(snapshot.sources.map((source) => source.id)),
    excerpts,
  );
}

export function collectConflictSourceRefs(conflicts: Conflict[]): SourceRef[] {
  return conflicts.flatMap((conflict) => [
    ...conflict.sourceRefs,
    ...conflict.options.flatMap((option) => option.sourceRefs),
  ]);
}

export function validateChatCitationIntegrity(
  response: ChatResponse,
  snapshot: ProtocolSnapshot,
  excerpts: SourceExcerpt[],
): CitationIntegrityIssue[] {
  return validateSourceRefs(
    response.citations.map((ref, index) => ({
      path: `citations[${index}]`,
      ref,
    })),
    new Set(snapshot.sources.map((source) => source.id)),
    excerpts,
  );
}

