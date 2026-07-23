import { describe, expect, it } from "vitest";

import {
  detectConflicts,
  detectMissingFields,
} from "@/src/lib/ai/detection";
import { DemoProvider } from "@/src/lib/ai/providers/demo-provider";
import {
  validateChatCitationIntegrity,
  validateProtocolCitationIntegrity,
} from "@/src/lib/ai/source-integrity";
import { MemoryLabTraceRepository } from "@/src/lib/db/memory-repository";
import {
  createExampleProtocolBundle,
  EXAMPLE_PROTOCOL_ID,
} from "@/src/lib/example-protocol";
import {
  cloneDemoValue,
  completedDemoBundle,
  demoEvidence,
  demoExcerpts,
  demoMissingFields,
  demoProtocol,
  demoProtocolSnapshot,
  demoSources,
  USER_CONFIRMED_SOURCE_ID,
} from "@/src/lib/demo";
import {
  SourceArtifactSchema,
  StructuredProtocolOutputSchema,
} from "@/src/types";
import type { EvidenceUnit } from "@/src/types";

describe("evidence conflict detection", () => {
  it("finds exactly the four required demo conflicts without duplicating matching evidence", () => {
    const conflicts = detectConflicts(demoEvidence, demoSources);

    expect(conflicts).toHaveLength(4);
    expect(conflicts.map((conflict) => conflict.field).sort()).toEqual([
      "blocking_duration",
      "blocking_reagent",
      "primary_antibody_dilution",
      "transfer_conditions",
    ]);

    const transfer = conflicts.find(
      (conflict) => conflict.field === "transfer_conditions",
    );
    expect(transfer?.severity).toBe("high");
    expect(transfer?.status).toBe("unresolved");
    expect(transfer?.options).toHaveLength(2);
    expect(transfer?.options.map((option) => option.value).sort()).toEqual([
      "100 V / 60 min",
      "90 V / 90 min",
    ]);
    expect(
      transfer?.options.find((option) => option.value === "100 V / 60 min")
        ?.sourceRefs,
    ).toHaveLength(2);

    const dilution = conflicts.find(
      (conflict) => conflict.field === "primary_antibody_dilution",
    );
    expect(dilution?.options).toHaveLength(3);
    expect(dilution?.options.map((option) => option.value)).toEqual(
      expect.arrayContaining(["1:1000", "1:2000?", "target별 상이"]),
    );
  });

  it("does not manufacture a conflict when normalized values agree", () => {
    const matchingOnly = demoEvidence.filter(
      (unit) =>
        unit.id === "evidence-audio-transfer" ||
        unit.id === "evidence-pdf-transfer",
    );

    expect(detectConflicts(matchingOnly, demoSources)).toEqual([]);
  });
});

describe("required-field detection", () => {
  it("keeps all seven specified fields unresolved when evidence is absent or ambiguous", () => {
    const missing = detectMissingFields(demoEvidence);

    expect(missing).toHaveLength(7);
    expect(missing.map((field) => field.field).sort()).toEqual([
      "membrane_type",
      "objective_success_criterion",
      "phospho_target",
      "primary_antibody_product",
      "pvdf_pretreatment_conditions",
      "target_protein",
      "transfer_equipment",
    ]);
    expect(
      missing.find(
        (field) => field.field === "pvdf_pretreatment_conditions",
      )?.reason,
    ).toContain("구체 조건");
    expect(missing.every((field) => field.status === "unresolved")).toBe(true);
  });

  it("removes only a field backed by explicit, non-ambiguous evidence", () => {
    const explicitMembrane: EvidenceUnit = {
      id: "evidence-user-membrane",
      sourceArtifactId: demoSources[0]!.id,
      category: "parameter",
      statement: "현재 실험에는 PVDF membrane을 사용",
      parameterName: "membrane_type",
      value: "PVDF",
      author: "확인 연구자",
      sourceDate: "2026-07-23",
      quote: "PVDF membrane 사용",
      confidence: 1,
    };

    const missing = detectMissingFields([...demoEvidence, explicitMembrane]);
    expect(missing).toHaveLength(6);
    expect(missing.some((field) => field.field === "membrane_type")).toBe(
      false,
    );
    expect(
      missing.some(
        (field) => field.field === "pvdf_pretreatment_conditions",
      ),
    ).toBe(true);
  });
});

describe("DemoProvider", () => {
  const provider = new DemoProvider();

  it("extracts all five sources and deterministically generates a valid structured draft", async () => {
    const extracted = await Promise.all(
      demoSources.map((artifact) =>
        provider.extractSource({
          artifact,
          text: artifact.extractedText,
        }),
      ),
    );
    expect(extracted).toHaveLength(5);
    expect(extracted.every((result) => result.evidence.length > 0)).toBe(true);
    expect(
      extracted.flatMap((result) => result.evidence).map((unit) => unit.id),
    ).toHaveLength(demoEvidence.length);

    const merged = await provider.mergeEvidence({
      evidence: extracted.flatMap((result) => result.evidence),
      sources: extracted.map((result) => result.artifact),
    });
    expect(merged.conflicts).toHaveLength(4);
    expect(merged.missingFields).toHaveLength(7);

    const input = {
      evidence: merged.evidence,
      sources: extracted.map((result) => result.artifact),
      conflicts: merged.conflicts,
      missingFields: merged.missingFields,
    };
    const first = await provider.generateProtocol(input);
    const second = await provider.generateProtocol(input);

    expect(first).toEqual(second);
    expect(StructuredProtocolOutputSchema.safeParse(first).success).toBe(true);
    expect(first.steps.length).toBeGreaterThanOrEqual(5);
    expect(first.conflicts).toHaveLength(4);
    expect(first.missingFields).toHaveLength(7);
  });

  it("applies a selected conflict and a researcher-confirmed missing answer", async () => {
    const conflicts = cloneDemoValue(demoProtocolSnapshot.conflicts);
    const transfer = conflicts.find(
      (conflict) => conflict.field === "transfer_conditions",
    )!;
    const selected = transfer.options.find(
      (option) => option.value === "100 V / 60 min",
    )!;
    transfer.status = "resolved";
    transfer.selectedResolution = selected.id;

    const missingFields = cloneDemoValue(demoMissingFields);
    const membrane = missingFields.find(
      (field) => field.field === "membrane_type",
    )!;
    membrane.status = "answered";
    membrane.userAnswer = "PVDF";
    membrane.answeredBy = "테스트 연구자";
    membrane.answeredAt = "2026-07-23T12:00:00.000Z";

    const regenerated = await provider.regenerateAfterResolution({
      protocol: demoProtocolSnapshot,
      evidence: demoEvidence,
      conflicts,
      missingFields,
    });
    const transferStep = regenerated.steps.find(
      (step) => step.id === "step-transfer",
    )!;
    const membraneStep = regenerated.steps.find(
      (step) => step.id === "step-membrane",
    )!;

    expect(transferStep.action).toContain("100 V / 60 min");
    expect(transferStep.duration).toBe("60 min");
    expect(
      membraneStep.parameters.find(
        (parameter) => parameter.name === "Membrane 종류",
      )?.value,
    ).toBe("PVDF");
    expect(
      regenerated.sources.some(
        (source) => source.id === USER_CONFIRMED_SOURCE_ID,
      ),
    ).toBe(true);
    expect(
      membraneStep.parameters
        .flatMap((parameter) => parameter.sourceRefs)
        .some((ref) => ref.artifactId === USER_CONFIRMED_SOURCE_ID),
    ).toBe(true);
  });

  it("keeps source-backed chat and unverified AI suggestions visibly separated", async () => {
    const chat = await provider.chatWithProtocol({
      protocol: demoProtocolSnapshot,
      protocolId: demoProtocol.id,
      question: "다음 연구자가 실험 전에 반드시 확인해야 할 것은?",
    });
    const suggestions = await provider.generateSuggestions();

    expect(chat.suggestionType).toBe("source_backed");
    expect(chat.citations.length).toBeGreaterThan(0);
    expect(
      validateChatCitationIntegrity(
        chat,
        demoProtocolSnapshot,
        demoExcerpts,
      ),
    ).toEqual([]);
    expect(suggestions.map((suggestion) => suggestion.type)).toEqual(
      expect.arrayContaining([
        "source_backed",
        "clarification_question",
        "ai_idea",
      ]),
    );
    const aiIdea = suggestions.find(
      (suggestion) => suggestion.type === "ai_idea",
    );
    expect(aiIdea?.warning).toContain("원본 자료에서 확인되지 않은");
    expect(aiIdea?.status).toBe("proposed");
  });
});

describe("repository persistence and versioning", () => {
  it("persists a snapshot, increments versions, and overwrites an autosave without another bump", async () => {
    const repository = new MemoryLabTraceRepository();
    await repository.seed(cloneDemoValue(completedDemoBundle));
    const initial = await repository.getProtocolDocument(demoProtocol.id);
    expect(initial?.currentVersion).toBe(1);
    expect(await repository.getVersions(demoProtocol.id)).toHaveLength(1);

    const versionTwoSnapshot = cloneDemoValue(demoProtocolSnapshot);
    versionTwoSnapshot.experiment.objective = "연구자 검토용 수정 목적";
    const saved = await repository.saveProtocol(
      initial!,
      versionTwoSnapshot,
      {
        changeSummary: "목적 수정",
        changedBy: "테스트 연구자",
        bumpVersion: true,
        now: "2026-07-23T13:00:00.000Z",
      },
    );

    expect(saved.protocol.currentVersion).toBe(2);
    expect(saved.version.versionNumber).toBe(2);
    expect(await repository.getVersions(demoProtocol.id)).toHaveLength(2);
    expect(
      (await repository.getProtocolDocument(demoProtocol.id))?.snapshot
        .experiment.objective,
    ).toBe("연구자 검토용 수정 목적");

    const autosavedSnapshot = cloneDemoValue(versionTwoSnapshot);
    autosavedSnapshot.experiment.title = "자동 저장된 제목";
    const autosaved = await repository.saveProtocol(
      saved.protocol,
      autosavedSnapshot,
      {
        changeSummary: "자동 저장",
        changedBy: "테스트 연구자",
        bumpVersion: false,
        now: "2026-07-23T13:05:00.000Z",
      },
    );

    expect(autosaved.protocol.currentVersion).toBe(2);
    expect(await repository.getVersions(demoProtocol.id)).toHaveLength(2);
    expect(
      (await repository.getProtocolDocument(demoProtocol.id))?.snapshot
        .experiment.title,
    ).toBe("자동 저장된 제목");
  });
});

describe("source reference integrity", () => {
  it("accepts every demo citation and reports an unknown artifact precisely", () => {
    expect(
      validateProtocolCitationIntegrity(
        demoProtocolSnapshot,
        demoExcerpts,
      ),
    ).toEqual([]);

    const broken = cloneDemoValue(demoProtocolSnapshot);
    broken.steps[0]!.sourceRefs[0]!.artifactId = "source-does-not-exist";
    const issues = validateProtocolCitationIntegrity(broken, demoExcerpts);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: "steps[0].sourceRefs[0]",
      artifactId: "source-does-not-exist",
      reason: "unknown_artifact",
    });
  });
});

describe("provider response normalization", () => {
  it("treats empty optional artifact identifiers as absent", () => {
    const artifact = SourceArtifactSchema.parse({
      id: "source-1",
      protocolId: "protocol-1",
      workspaceId: "",
      type: "markdown",
      fileName: "note.md",
      displayName: "note",
      mimeType: "text/markdown",
      size: 10,
      author: "연구자",
      sourceDate: "2026-07-24",
      reliability: "current",
      notes: "",
      localBlobKey: "",
      extractedText: "내용",
      processingStatus: "ready",
      createdAt: "2026-07-24T00:00:00.000Z",
    });

    expect(artifact.workspaceId).toBeUndefined();
    expect(artifact.localBlobKey).toBeUndefined();
    expect(artifact.protocolId).toBe("protocol-1");
  });
});

describe("example protocol", () => {
  it("creates one complete, schema-valid protocol with traceable sources", () => {
    const bundle = createExampleProtocolBundle("lab-default");

    expect(bundle.protocol.id).toBe(EXAMPLE_PROTOCOL_ID);
    expect(bundle.snapshot.steps).toHaveLength(10);
    expect(bundle.snapshot.missingFields).toHaveLength(0);
    expect(bundle.snapshot.conflicts).toHaveLength(0);
    expect(
      StructuredProtocolOutputSchema.safeParse(bundle.snapshot).success,
    ).toBe(true);
    expect(
      validateProtocolCitationIntegrity(
        bundle.snapshot,
        bundle.excerpts,
      ),
    ).toEqual([]);
  });
});
