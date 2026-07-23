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
  formatTimedTranscript,
  type TimedTranscriptSegment,
} from "@/src/lib/files/transcript";
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

const AudioTranscriptSegmentSchema = z
  .object({
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().nonnegative(),
    speaker: z.string(),
    text: z.string().trim().min(1),
  })
  .refine((segment) => segment.endSeconds >= segment.startSeconds, {
    message: "Audio transcript segment ends before it starts.",
  });

const AudioTranscriptSchema = z.object({
  segments: z.array(AudioTranscriptSegmentSchema).min(1),
  warnings: z.array(z.string()),
});

type AudioTranscript = z.infer<typeof AudioTranscriptSchema>;

const audioTranscriptJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["segments", "warnings"],
  properties: {
    segments: {
      type: "array",
      minItems: 1,
      description:
        "Every spoken utterance from the beginning to the end, in chronological order.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["startSeconds", "endSeconds", "speaker", "text"],
        properties: {
          startSeconds: {
            type: "number",
            minimum: 0,
            description: "Segment start time in seconds from the audio start.",
          },
          endSeconds: {
            type: "number",
            minimum: 0,
            description: "Segment end time in seconds from the audio start.",
          },
          speaker: {
            type: "string",
            description:
              "Speaker label if distinguishable, otherwise '화자'.",
          },
          text: {
            type: "string",
            description:
              "Verbatim speech for this segment without summarizing or omitting details.",
          },
        },
      },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
      description:
        "Only genuine audio-quality or unintelligible-speech warnings.",
    },
  },
} as const;

export function createExtractionBatches(
  inputs: ExtractSourceInput[],
): ExtractSourceInput[][] {
  const audioBatches = inputs
    .filter((input) => input.artifact.type === "audio")
    .map((input) => [input]);
  const nonAudio = inputs.filter(
    (input) => input.artifact.type !== "audio",
  );
  const nonAudioBatches: ExtractSourceInput[][] = [];
  for (let index = 0; index < nonAudio.length; index += 2) {
    nonAudioBatches.push(nonAudio.slice(index, index + 2));
  }
  return [...audioBatches, ...nonAudioBatches];
}

function readMp4DurationSeconds(base64Data: string): number | undefined {
  try {
    const binary = atob(base64Data);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    const marker = [0x6d, 0x76, 0x68, 0x64];
    let markerIndex = -1;
    for (let index = 0; index <= bytes.length - marker.length; index += 1) {
      if (marker.every((value, offset) => bytes[index + offset] === value)) {
        markerIndex = index;
        break;
      }
    }
    if (markerIndex < 0 || markerIndex + 32 > bytes.length) return undefined;
    const view = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    );
    const version = bytes[markerIndex + 4];
    if (version === 0) {
      const timescale = view.getUint32(markerIndex + 16, false);
      const duration = view.getUint32(markerIndex + 20, false);
      return timescale > 0 ? duration / timescale : undefined;
    }
    if (version === 1 && markerIndex + 40 <= bytes.length) {
      const timescale = view.getUint32(markerIndex + 24, false);
      const durationHigh = view.getUint32(markerIndex + 28, false);
      const durationLow = view.getUint32(markerIndex + 32, false);
      const duration = durationHigh * 2 ** 32 + durationLow;
      return timescale > 0 ? duration / timescale : undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function transcriptIsComplete(
  transcript: AudioTranscript,
  durationSeconds?: number,
): boolean {
  const spokenText = transcript.segments
    .map((segment) => segment.text.trim())
    .join(" ");
  if (spokenText.length < 40) return false;
  if (!durationSeconds || durationSeconds < 30) return true;

  const finalTimestamp = Math.max(
    ...transcript.segments.map((segment) => segment.endSeconds),
  );
  const minimumCharacters = Math.min(
    400,
    Math.max(80, Math.floor(durationSeconds * 0.8)),
  );
  const minimumSegments = Math.max(2, Math.floor(durationSeconds / 90));
  return (
    spokenText.length >= minimumCharacters &&
    transcript.segments.length >= minimumSegments &&
    finalTimestamp >= durationSeconds * 0.72
  );
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

  private async transcribeAudio(
    input: ExtractSourceInput,
  ): Promise<{ text: string; warnings: string[] }> {
    if (!input.base64Data) {
      const existingText = input.text?.trim() || input.artifact.extractedText.trim();
      if (!existingText) {
        throw new GeminiProviderError(
          "invalid_response",
          "Audio input has neither binary data nor an existing transcript.",
          "음성 원본을 읽을 수 없어 전사를 시작하지 못했습니다. 파일을 다시 추가해 주세요.",
        );
      }
      return { text: existingText, warnings: [] };
    }

    const durationSeconds =
      normalizeGeminiMimeType(input.artifact.mimeType) === "audio/mp4"
        ? readMp4DurationSeconds(input.base64Data)
        : undefined;
    const durationInstruction = durationSeconds
      ? `이 파일의 실제 재생 길이는 약 ${Math.round(durationSeconds)}초다. 마지막 발화 또는 무음 구간까지 확인하고 마지막 segment가 실제 끝부분을 반영해야 한다.`
      : "오디오의 실제 끝까지 확인한다.";
    const prompt = [
      `파일명: ${input.artifact.fileName}`,
      durationInstruction,
      "이 오디오의 음성을 00:00부터 끝까지 빠짐없이 전사하라.",
      "요약하거나 핵심 정보만 추출하지 말고, 말한 순서와 반복도 유지한다.",
      "한국어와 영어 실험 전문용어, 숫자, 농도, 비율, 시간, 온도, 부피와 장비 설정을 들리는 그대로 보존한다.",
      "문장 또는 짧은 발화 단위로 나누고 모든 segment에 초 단위 시작·종료 시각을 기록한다.",
      "알아듣기 어려운 부분은 추측하지 말고 [불명확]으로 표시한다. 긴 무음은 warnings에 기록하되 앞뒤 발화를 생략하지 않는다.",
      "segments에는 전체 발화를 포함하고 summary나 해설은 만들지 않는다.",
    ].join("\n");

    const requestTranscript = async (retry = false) => {
      const response = await this.client.models.generateContent({
        model: this.primaryModel,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: retry
                  ? `${prompt}\n이전 시도가 전체 구간을 충분히 포함하지 못했다. 이번에는 중간과 후반을 생략하지 말고 처음부터 끝까지 다시 전사하라.`
                  : prompt,
              },
              {
                inlineData: {
                  mimeType: normalizeGeminiMimeType(input.artifact.mimeType),
                  data: input.base64Data!,
                },
              },
            ],
          },
        ],
        config: {
          systemInstruction:
            "당신은 생명과학 연구실 인수인계 녹음을 축약 없이 전사하는 전문 전사자다. 요청된 JSON Schema만 반환한다.",
          responseMimeType: "application/json",
          responseJsonSchema: audioTranscriptJsonSchema,
          maxOutputTokens: 16_384,
        },
      });
      const finishReason = String(
        response.candidates?.[0]?.finishReason ?? "",
      );
      if (finishReason && finishReason !== "STOP") {
        throw new AiResponseValidationError(
          `Gemini audio transcription stopped with ${finishReason}.`,
        );
      }
      if (!response.text) {
        throw new AiResponseValidationError(
          "Gemini returned an empty audio transcript.",
        );
      }
      return parseAndValidateJson(response.text, AudioTranscriptSchema);
    };

    try {
      let transcript = await requestTranscript();
      if (!transcriptIsComplete(transcript, durationSeconds)) {
        transcript = await requestTranscript(true);
      }
      if (!transcriptIsComplete(transcript, durationSeconds)) {
        throw new GeminiProviderError(
          "invalid_response",
          "Gemini returned an incomplete audio transcript twice.",
          "음성 전체 구간을 전사하지 못했습니다. 결과를 일부 전사로 저장하지 않았습니다. 같은 파일로 다시 시도해 주세요.",
        );
      }
      return {
        text: formatTimedTranscript(
          transcript.segments as TimedTranscriptSegment[],
        ),
        warnings: transcript.warnings,
      };
    } catch (error) {
      throw mapGeminiError(error);
    }
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
    // Audio transcription needs full attention and a much simpler response
    // contract than evidence extraction. Never pair audio with another source.
    // Non-audio multimodal batches remain capped at two for Flash-Lite.
    const batches = createExtractionBatches(inputs);
    if (
      batches.length > 1 ||
      (batches[0] && batches[0].length !== inputs.length)
    ) {
      const results: ExtractedSourceResult[] = [];
      for (const batch of batches) {
        results.push(...(await this.extractSources(batch)));
      }
      const resultById = new Map(
        results.map((result) => [result.artifact.id, result]),
      );
      return inputs.map((input) => {
        const result = resultById.get(input.artifact.id);
        if (!result) {
          throw new GeminiProviderError(
            "invalid_response",
            `Missing extraction result for ${input.artifact.id}.`,
            "AI 분석 결과에서 일부 자료가 누락되었습니다. 잘못된 결과는 저장하지 않았습니다.",
          );
        }
        return result;
      });
    }

    const audioTranscripts = new Map<
      string,
      { text: string; warnings: string[] }
    >();
    for (const input of inputs) {
      if (input.artifact.type === "audio") {
        audioTranscripts.set(
          input.artifact.id,
          await this.transcribeAudio(input),
        );
      }
    }
    const analysisInputs = inputs.map((input) => {
      const transcript = audioTranscripts.get(input.artifact.id);
      return transcript
        ? { ...input, text: transcript.text, base64Data: undefined }
        : input;
    });

    const sourceManifests = analysisInputs.map((input, index) => {
      const sourceInstruction =
        input.artifact.type === "pdf"
          ? [
              "PDF 원본의 텍스트 레이어, 스캔 이미지, 표, 캡션과 페이지 배치를 함께 확인하고 필요한 경우 OCR한다.",
              "각 excerpt에 실제 pageNumber를 기록하고 서로 다른 페이지를 하나의 인용으로 합치지 않는다.",
            ].join(" ")
          : input.artifact.type === "audio" && input.text
            ? [
                "별도 전체 전사 단계에서 생성한 타임스탬프 전사본이다.",
                "전사본 전체를 사용해 evidence를 추출하고, 중간과 후반의 발화도 빠뜨리지 않는다.",
                `전체 전사본:\n${input.text}`,
              ].join("\n")
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
      analysisInputs.flatMap((input, index) =>
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
      const audioTranscript = audioTranscripts.get(input.artifact.id);
      assertSourceIdentity(sourceResult, input.artifact.id);
      return {
        ...sourceResult,
        artifact: {
          ...input.artifact,
          extractedText:
            audioTranscript?.text ?? sourceResult.artifact.extractedText,
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
        warnings: [
          ...sourceResult.warnings,
          ...(audioTranscript?.warnings ?? []),
        ],
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
