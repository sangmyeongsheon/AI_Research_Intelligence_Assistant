import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import {
  AiSuggestionSchema,
  ChatResponseSchema,
  ExtractedSourceResultSchema,
  MergedEvidenceResultSchema,
  StructuredProtocolOutputSchema,
} from "@/src/types";
import type {
  AiSuggestion,
  ChatResponse,
  ExtractedSourceResult,
  MergedEvidenceResult,
  SourceArtifact,
  SourceRef,
  StructuredProtocolOutput,
} from "@/src/types";
import {
  chatResponseJsonSchema,
  extractedSourceJsonSchema,
  mergedEvidenceJsonSchema,
  structuredProtocolJsonSchema,
  suggestionsJsonSchema,
} from "@/src/lib/ai/schemas";
import { parseAndValidateJson, AiResponseValidationError } from "@/src/lib/ai/json-recovery";
import type { GeminiModelConfig } from "@/src/lib/ai/model-config";
import {
  CHAT_PROMPT,
  EXTRACTION_PROMPT,
  GENERATION_PROMPT,
  LABTRACE_SYSTEM_PROMPT,
  MERGE_PROMPT,
  SUGGESTION_PROMPT,
} from "@/src/lib/ai/prompts";
import type {
  AIProvider,
  ChatWithProtocolInput,
  ExtractSourceInput,
  GenerateProtocolInput,
  GenerateSuggestionsInput,
  MergeEvidenceInput,
  RegenerateAfterResolutionInput,
} from "@/src/lib/ai/provider";

export type GeminiErrorCode =
  | "missing_key"
  | "quota"
  | "model_unavailable"
  | "network"
  | "invalid_response"
  | "unknown";

export class GeminiProviderError extends Error {
  constructor(
    readonly code: GeminiErrorCode,
    message: string,
    readonly userMessage: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "GeminiProviderError";
  }
}

export function normalizeGeminiMimeType(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase();
  const aliases: Record<string, string> = {
    "application/ogg": "audio/ogg",
    "audio/m4a": "audio/mp4",
    "audio/mp3": "audio/mpeg",
    "audio/wave": "audio/wav",
    "audio/x-aac": "audio/aac",
    "audio/x-flac": "audio/flac",
    "audio/x-m4a": "audio/mp4",
    "audio/x-mpeg": "audio/mpeg",
    "audio/x-wav": "audio/wav",
    "image/jpg": "image/jpeg",
  };
  return aliases[normalized] ?? normalized;
}

function mapGeminiError(error: unknown): GeminiProviderError {
  if (error instanceof GeminiProviderError) return error;
  if (error instanceof AiResponseValidationError) {
    return new GeminiProviderError(
      "invalid_response",
      error.message,
      error.userMessage,
      { cause: error },
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLocaleLowerCase("en-US");
  if (
    normalized.includes("429") ||
    normalized.includes("quota") ||
    normalized.includes("resource_exhausted")
  ) {
    return new GeminiProviderError(
      "quota",
      message,
      "Gemini 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요. 기존 데이터는 보존되었습니다.",
      { cause: error },
    );
  }
  if (
    normalized.includes("404") ||
    normalized.includes("model") ||
    normalized.includes("not found")
  ) {
    return new GeminiProviderError(
      "model_unavailable",
      message,
      "설정된 Gemini 모델을 사용할 수 없습니다. 모델 설정을 확인해 주세요.",
      { cause: error },
    );
  }
  if (
    normalized.includes("fetch") ||
    normalized.includes("network") ||
    normalized.includes("timeout") ||
    normalized.includes("econn") ||
    normalized.includes("500") ||
    normalized.includes("502") ||
    normalized.includes("503") ||
    normalized.includes("504") ||
    normalized.includes("overloaded") ||
    normalized.includes("unavailable")
  ) {
    return new GeminiProviderError(
      "network",
      message,
      "Gemini 서비스의 일시적인 연결 오류가 반복되었습니다. 업로드 자료는 보존되었습니다. 잠시 후 같은 자료로 다시 시도해 주세요.",
      { cause: error },
    );
  }
  return new GeminiProviderError(
    "unknown",
    message,
    "Gemini 분석 중 문제가 발생했습니다. 기존 데이터는 보존되었습니다. 잠시 후 다시 시도해 주세요.",
    { cause: error },
  );
}

function assertSourceIdentity(result: ExtractedSourceResult, sourceId: string) {
  if (
    result.artifact.id !== sourceId ||
    result.excerpts.some(
      (excerpt) => excerpt.sourceArtifactId !== sourceId,
    ) ||
    result.evidence.some((unit) => unit.sourceArtifactId !== sourceId)
  ) {
    throw new GeminiProviderError(
      "invalid_response",
      "Gemini returned mismatched source IDs.",
      "AI 응답의 출처 ID가 원본 자료와 일치하지 않습니다. 잘못된 결과는 저장하지 않았습니다. 다시 분석해 주세요.",
    );
  }
}

function invalidSourceReference(message: string): never {
  throw new GeminiProviderError(
    "invalid_response",
    message,
    "AI 응답의 출처 ID가 원본 자료와 일치하지 않습니다. 잘못된 결과는 저장하지 않았습니다. 다시 분석해 주세요.",
  );
}

function assertReferencesUseArtifacts(
  refs: SourceRef[],
  artifacts: SourceArtifact[],
) {
  const artifactIds = new Set(artifacts.map((artifact) => artifact.id));
  const invalid = refs.find((ref) => !artifactIds.has(ref.artifactId));
  if (invalid) {
    invalidSourceReference(
      `Gemini referenced an unknown artifact: ${invalid.artifactId}`,
    );
  }
}

function protocolReferences(protocol: StructuredProtocolOutput): SourceRef[] {
  return [
    ...protocol.steps.flatMap((step) => [
      ...step.sourceRefs,
      ...step.parameters.flatMap((parameter) => parameter.sourceRefs),
      ...(step.troubleshootingItems ?? []).flatMap(
        (item) => item.sourceRefs,
      ),
    ]),
    ...protocol.conflicts.flatMap((conflict) => [
      ...conflict.sourceRefs,
      ...conflict.options.flatMap((option) => option.sourceRefs),
    ]),
  ];
}

export class GeminiProvider implements AIProvider {
  readonly id = "gemini" as const;
  private readonly client: GoogleGenAI;
  private readonly primaryModel: string;
  private readonly fastModel: string;

  constructor(config: GeminiModelConfig) {
    if (!config.apiKey) {
      throw new GeminiProviderError(
        "missing_key",
        "A user-supplied Gemini API key is required.",
        "Settings에서 본인의 Gemini API 키를 입력한 뒤 다시 시도해 주세요.",
      );
    }
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
    this.primaryModel = config.primaryModel;
    this.fastModel = config.fastModel;
  }

  private async generateStructured<T>(
    model: string,
    prompt: string,
    schema: z.ZodType<T>,
    responseJsonSchema: unknown,
    attachments?: Array<{
      label: string;
      mimeType: string;
      data: string;
    }>,
  ): Promise<T> {
    const request = async (selectedModel: string) => {
      const parts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [{ text: prompt }];
      attachments?.forEach((attachment) => {
        parts.push({ text: attachment.label });
        parts.push({
          inlineData: {
            mimeType: normalizeGeminiMimeType(attachment.mimeType),
            data: attachment.data,
          },
        });
      });

      const response = await this.client.models.generateContent({
        model: selectedModel,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: LABTRACE_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema,
        },
      });
      const text = response.text;
      if (!text) {
        throw new AiResponseValidationError(
          "Gemini returned an empty structured response.",
        );
      }
      return parseAndValidateJson(text, schema);
    };

    try {
      return await request(model);
    } catch (error) {
      const primaryError = mapGeminiError(error);
      const canUseFallback =
        model !== this.fastModel &&
        ["model_unavailable", "invalid_response"].includes(
          primaryError.code,
        );
      if (!canUseFallback) throw primaryError;
      try {
        return await request(this.fastModel);
      } catch (fallbackError) {
        throw mapGeminiError(fallbackError);
      }
    }
  }

  async extractSource(
    input: ExtractSourceInput,
  ): Promise<ExtractedSourceResult> {
    const [result] = await this.extractSources([input]);
    return result;
  }

  async extractSources(
    inputs: ExtractSourceInput[],
  ): Promise<ExtractedSourceResult[]> {
    // Gemini 3.5 Flash-Lite rejects larger mixed multimodal arrays with a
    // generic INVALID_ARGUMENT even when every source succeeds on its own.
    // Two-source batches are stable for text, PDF and image combinations and
    // keep request counts well below the original one-request-per-file flow.
    if (inputs.length > 2) {
      const results: ExtractedSourceResult[] = [];
      for (let index = 0; index < inputs.length; index += 2) {
        results.push(
          ...(await this.extractSources(inputs.slice(index, index + 2))),
        );
      }
      return results;
    }

    const sourceManifests = inputs.map((input, index) => {
      const sourceInstruction =
        input.artifact.type === "pdf"
          ? [
              "PDF 원본의 텍스트 레이어, 스캔 이미지, 표, 캡션과 페이지 배치를 함께 확인하고 필요한 경우 OCR한다.",
              "각 excerpt에 실제 pageNumber를 기록하고 서로 다른 페이지를 하나의 인용으로 합치지 않는다.",
            ].join(" ")
          : input.text
            ? `브라우저에서 추출한 원문:\n${input.text}`
            : "첨부된 멀티모달 원본에서 원문과 evidence를 추출한다.";
      return [
        `SOURCE ${index + 1}`,
        `artifact: ${JSON.stringify(input.artifact)}`,
        sourceInstruction,
      ].join("\n");
    });
    const prompt = [
      EXTRACTION_PROMPT,
      "아래 모든 자료를 한 번에 분석하고 입력 순서와 같은 ExtractedSourceResult JSON 배열로 반환하라.",
      "각 결과는 해당 artifact 메타데이터를 그대로 보존해야 한다.",
      "모든 excerpt와 evidence의 sourceArtifactId는 해당 artifact.id와 정확히 같아야 한다.",
      ...sourceManifests,
    ].join("\n\n");
    const result = await this.generateStructured(
      this.primaryModel,
      prompt,
      z.array(ExtractedSourceResultSchema).length(inputs.length),
      {
        type: "array",
        minItems: inputs.length,
        maxItems: inputs.length,
        items: extractedSourceJsonSchema,
      },
      inputs.flatMap((input, index) =>
        input.base64Data
          ? [
              {
                label: `SOURCE ${index + 1} 원본 파일`,
                mimeType: input.artifact.mimeType,
                data: input.base64Data,
              },
            ]
          : [],
      ),
    );
    return result.map((sourceResult, index) => {
      const input = inputs[index];
      assertSourceIdentity(sourceResult, input.artifact.id);
      return {
        ...sourceResult,
        artifact: {
          ...input.artifact,
          extractedText: sourceResult.artifact.extractedText,
          processingStatus: "ready" as const,
          processingError: undefined,
        },
        excerpts: sourceResult.excerpts.map((excerpt) => ({
          ...excerpt,
          author: input.artifact.author,
          sourceDate: input.artifact.sourceDate,
        })),
        evidence: sourceResult.evidence.map((unit) => ({
          ...unit,
          author: input.artifact.author,
          sourceDate: input.artifact.sourceDate,
        })),
      };
    });
  }

  async mergeEvidence(
    input: MergeEvidenceInput,
  ): Promise<MergedEvidenceResult> {
    const result = await this.generateStructured(
      this.primaryModel,
      [
        MERGE_PROMPT,
        "MergedEvidenceResult JSON을 반환하라.",
        `sources: ${JSON.stringify(input.sources)}`,
        `evidence: ${JSON.stringify(input.evidence)}`,
      ].join("\n\n"),
      MergedEvidenceResultSchema,
      mergedEvidenceJsonSchema,
    );
    const artifactIds = new Set(input.sources.map((source) => source.id));
    if (
      result.evidence.some(
        (unit) => !artifactIds.has(unit.sourceArtifactId),
      )
    ) {
      invalidSourceReference(
        "Gemini merged evidence with an unknown source artifact.",
      );
    }
    assertReferencesUseArtifacts(
      result.conflicts.flatMap((conflict) => [
        ...conflict.sourceRefs,
        ...conflict.options.flatMap((option) => option.sourceRefs),
      ]),
      input.sources,
    );
    return result;
  }

  async generateProtocol(
    input: GenerateProtocolInput,
  ): Promise<StructuredProtocolOutput> {
    const result = await this.generateStructured(
      this.primaryModel,
      [
        GENERATION_PROMPT,
        "StructuredProtocolOutput JSON을 반환하라.",
        `sources: ${JSON.stringify(input.sources)}`,
        `evidence: ${JSON.stringify(input.evidence)}`,
        `detected conflicts: ${JSON.stringify(input.conflicts ?? [])}`,
        `detected missing fields: ${JSON.stringify(input.missingFields ?? [])}`,
      ].join("\n\n"),
      StructuredProtocolOutputSchema,
      structuredProtocolJsonSchema,
    );
    assertReferencesUseArtifacts(protocolReferences(result), input.sources);
    // The uploaded artifacts are canonical. Gemini may omit an unused source
    // from its generated list, so always restore the exact stored source set
    // after validating that every citation points to a real artifact.
    result.sources = input.sources;
    return result;
  }

  async regenerateAfterResolution(
    input: RegenerateAfterResolutionInput,
  ): Promise<StructuredProtocolOutput> {
    const result = await this.generateStructured(
      this.primaryModel,
      [
        GENERATION_PROMPT,
        "연구자가 해결한 conflict와 답한 missing field만 반영하라. 해결되지 않은 값은 확정하지 마라.",
        `current protocol: ${JSON.stringify(input.protocol)}`,
        `evidence: ${JSON.stringify(input.evidence)}`,
        `conflicts: ${JSON.stringify(input.conflicts)}`,
        `missing fields: ${JSON.stringify(input.missingFields)}`,
      ].join("\n\n"),
      StructuredProtocolOutputSchema,
      structuredProtocolJsonSchema,
    );
    assertReferencesUseArtifacts(
      protocolReferences(result),
      input.protocol.sources,
    );
    result.sources = input.protocol.sources;
    return result;
  }

  async chatWithProtocol(
    input: ChatWithProtocolInput,
  ): Promise<ChatResponse> {
    const result = await this.generateStructured(
      this.fastModel,
      [
        CHAT_PROMPT,
        `protocol: ${JSON.stringify(input.protocol)}`,
        `recent history: ${JSON.stringify((input.history ?? []).slice(-8))}`,
        `question: ${input.question}`,
      ].join("\n\n"),
      ChatResponseSchema,
      chatResponseJsonSchema,
    );
    assertReferencesUseArtifacts(result.citations, input.protocol.sources);
    return result;
  }

  async generateSuggestions(
    input: GenerateSuggestionsInput,
  ): Promise<AiSuggestion[]> {
    const result = await this.generateStructured(
      this.fastModel,
      [
        SUGGESTION_PROMPT,
        `protocol: ${JSON.stringify(input.protocol)}`,
        `evidence: ${JSON.stringify(input.evidence)}`,
      ].join("\n\n"),
      z.array(AiSuggestionSchema),
      suggestionsJsonSchema,
    );
    assertReferencesUseArtifacts(
      result.flatMap((suggestion) => suggestion.sourceRefs),
      input.protocol.sources,
    );
    return result;
  }
}
