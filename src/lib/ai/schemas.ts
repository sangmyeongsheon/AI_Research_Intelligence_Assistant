import { z } from "zod";

export {
  AiSuggestionSchema,
  ChatResponseSchema,
  EvidenceUnitSchema,
  ExtractedSourceResultSchema,
  MergedEvidenceResultSchema,
  StructuredProtocolOutputSchema,
} from "@/src/types";

/**
 * JSON schemas passed to providers that support native constrained output.
 * Zod remains the final authority after the response returns.
 */
export const evidenceUnitJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "sourceArtifactId",
    "category",
    "statement",
    "author",
    "sourceDate",
    "quote",
    "confidence",
  ],
  properties: {
    id: { type: "string" },
    sourceArtifactId: { type: "string" },
    sourceExcerptId: { type: "string" },
    category: {
      type: "string",
      enum: [
        "experiment_name",
        "objective",
        "material",
        "equipment",
        "step",
        "parameter",
        "warning",
        "implicit_tip",
        "common_mistake",
        "troubleshooting",
        "success_criterion",
        "failure_experience",
        "other",
      ],
    },
    stepCandidate: { type: "string" },
    statement: { type: "string" },
    parameterName: { type: "string" },
    value: { anyOf: [{ type: "string" }, { type: "number" }] },
    unit: { type: "string" },
    normalizedValue: { anyOf: [{ type: "string" }, { type: "number" }] },
    normalizedUnit: { type: "string" },
    author: { type: "string" },
    sourceDate: { type: "string" },
    pageNumber: { type: "integer", minimum: 1 },
    timestamp: { type: "number", minimum: 0 },
    timestampEnd: { type: "number", minimum: 0 },
    quote: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    ambiguity: { type: "string" },
  },
} as const;

export const evidenceArrayJsonSchema = {
  type: "array",
  items: evidenceUnitJsonSchema,
} as const;

export const sourceRefJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "artifactId",
    "sourceLabel",
    "author",
    "quote",
    "confidence",
  ],
  properties: {
    artifactId: { type: "string" },
    excerptId: { type: "string" },
    sourceLabel: { type: "string" },
    author: { type: "string" },
    pageNumber: { type: "integer", minimum: 1 },
    timestampStart: { type: "number", minimum: 0 },
    timestampEnd: { type: "number", minimum: 0 },
    quote: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;

const stringArrayJsonSchema = {
  type: "array",
  items: { type: "string" },
} as const;

export const sourceArtifactJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "protocolId",
    "type",
    "fileName",
    "displayName",
    "mimeType",
    "size",
    "author",
    "sourceDate",
    "reliability",
    "notes",
    "extractedText",
    "processingStatus",
    "createdAt",
  ],
  properties: {
    id: { type: "string" },
    protocolId: { type: "string" },
    workspaceId: { type: "string" },
    type: {
      type: "string",
      enum: ["audio", "image", "pdf", "text", "markdown", "transcript"],
    },
    fileName: { type: "string" },
    displayName: { type: "string" },
    mimeType: { type: "string" },
    size: { type: "integer", minimum: 0 },
    author: { type: "string" },
    sourceDate: { type: "string" },
    reliability: {
      type: "string",
      enum: ["current", "legacy", "reference", "unknown"],
    },
    notes: { type: "string" },
    localBlobKey: { type: "string" },
    extractedText: { type: "string" },
    processingStatus: {
      type: "string",
      enum: ["pending", "processing", "ready", "error"],
    },
    processingError: { type: "string" },
    createdAt: { type: "string" },
  },
} as const;

export const sourceExcerptJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "sourceArtifactId",
    "excerptText",
    "confidence",
    "author",
    "sourceDate",
  ],
  properties: {
    id: { type: "string" },
    sourceArtifactId: { type: "string" },
    excerptText: { type: "string" },
    pageNumber: { type: "integer", minimum: 1 },
    timestampStart: { type: "number", minimum: 0 },
    timestampEnd: { type: "number", minimum: 0 },
    boundingDescription: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    author: { type: "string" },
    sourceDate: { type: "string" },
  },
} as const;

export const parameterJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "value", "unit", "sourceRefs"],
  properties: {
    name: { type: "string" },
    value: { type: "string" },
    unit: { type: "string" },
    normalizedValue: {
      anyOf: [{ type: "string" }, { type: "number" }],
    },
    normalizedUnit: { type: "string" },
    sourceRefs: { type: "array", items: sourceRefJsonSchema },
  },
} as const;

export const troubleshootingItemJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["problem", "cause", "action", "sourceRefs"],
  properties: {
    problem: { type: "string" },
    cause: { type: "string" },
    action: { type: "string" },
    sourceRefs: { type: "array", items: sourceRefJsonSchema },
  },
} as const;

export const protocolStepJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "order",
    "title",
    "action",
    "materials",
    "equipment",
    "parameters",
    "duration",
    "checkpoints",
    "implicitTips",
    "commonMistakes",
    "troubleshooting",
    "troubleshootingItems",
    "successCriteria",
    "sourceRefs",
    "confidence",
    "unresolved",
  ],
  properties: {
    id: { type: "string" },
    order: { type: "integer", minimum: 1 },
    title: { type: "string" },
    action: { type: "string" },
    materials: stringArrayJsonSchema,
    equipment: stringArrayJsonSchema,
    parameters: { type: "array", items: parameterJsonSchema },
    duration: { type: "string" },
    checkpoints: stringArrayJsonSchema,
    implicitTips: stringArrayJsonSchema,
    commonMistakes: stringArrayJsonSchema,
    troubleshooting: stringArrayJsonSchema,
    troubleshootingItems: {
      type: "array",
      items: troubleshootingItemJsonSchema,
    },
    successCriteria: stringArrayJsonSchema,
    sourceRefs: { type: "array", items: sourceRefJsonSchema },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    unresolved: { type: "boolean" },
  },
} as const;

export const conflictOptionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label", "value", "sourceRefs"],
  properties: {
    id: { type: "string" },
    label: { type: "string" },
    value: { type: "string" },
    sourceRefs: { type: "array", items: sourceRefJsonSchema },
  },
} as const;

export const conflictJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "field",
    "description",
    "options",
    "sourceRefs",
    "severity",
    "status",
  ],
  properties: {
    id: { type: "string" },
    field: { type: "string" },
    stepId: { type: "string" },
    description: { type: "string" },
    options: {
      type: "array",
      minItems: 2,
      items: conflictOptionJsonSchema,
    },
    sourceRefs: { type: "array", items: sourceRefJsonSchema },
    severity: { type: "string", enum: ["low", "medium", "high"] },
    status: { type: "string", enum: ["unresolved", "resolved"] },
    selectedResolution: { type: "string" },
    resolutionNote: { type: "string" },
  },
} as const;

export const missingFieldJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "field",
    "reason",
    "question",
    "severity",
    "status",
  ],
  properties: {
    id: { type: "string" },
    field: { type: "string" },
    stepId: { type: "string" },
    reason: { type: "string" },
    question: { type: "string" },
    severity: { type: "string", enum: ["low", "medium", "high"] },
    status: {
      type: "string",
      enum: ["unresolved", "answered", "dismissed"],
    },
    userAnswer: { type: "string" },
    answeredBy: { type: "string" },
    answeredAt: { type: "string" },
  },
} as const;

export const extractedSourceJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["artifact", "excerpts", "evidence", "warnings"],
  properties: {
    artifact: sourceArtifactJsonSchema,
    excerpts: { type: "array", items: sourceExcerptJsonSchema },
    evidence: evidenceArrayJsonSchema,
    warnings: stringArrayJsonSchema,
  },
} as const;

export const mergedEvidenceJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["evidence", "conflicts", "missingFields", "warnings"],
  properties: {
    evidence: evidenceArrayJsonSchema,
    conflicts: { type: "array", items: conflictJsonSchema },
    missingFields: { type: "array", items: missingFieldJsonSchema },
    warnings: stringArrayJsonSchema,
  },
} as const;

/**
 * This intentionally describes the full top-level contract while prompts also
 * include the field rules. Gemini receives it as responseJsonSchema; every
 * nested value is then checked with StructuredProtocolOutputSchema.
 */
export const structuredProtocolJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "experiment",
    "materials",
    "equipment",
    "preflightChecklist",
    "steps",
    "resultAcceptance",
    "conflicts",
    "missingFields",
    "sources",
    "overallWarnings",
  ],
  properties: {
    experiment: {
      type: "object",
      additionalProperties: false,
      required: ["title", "objective", "scope", "category"],
      properties: {
        title: { type: "string" },
        objective: { type: "string" },
        scope: { type: "string" },
        category: {
          type: "string",
          enum: ["experiment", "equipment", "troubleshooting"],
        },
      },
    },
    materials: stringArrayJsonSchema,
    equipment: stringArrayJsonSchema,
    preflightChecklist: stringArrayJsonSchema,
    steps: { type: "array", items: protocolStepJsonSchema },
    resultAcceptance: {
      type: "object",
      additionalProperties: false,
      required: ["pass", "repeat", "discard"],
      properties: {
        pass: stringArrayJsonSchema,
        repeat: stringArrayJsonSchema,
        discard: stringArrayJsonSchema,
      },
    },
    conflicts: { type: "array", items: conflictJsonSchema },
    missingFields: { type: "array", items: missingFieldJsonSchema },
    sources: { type: "array", items: sourceArtifactJsonSchema },
    overallWarnings: stringArrayJsonSchema,
  },
} as const;

export const suggestionsJsonSchema = {
  type: "array",
  items: {
    type: "object",
    required: [
      "id",
      "type",
      "title",
      "content",
      "sourceRefs",
      "status",
    ],
    properties: {
      id: { type: "string" },
      type: {
        type: "string",
        enum: ["source_backed", "clarification_question", "ai_idea"],
      },
      title: { type: "string" },
      content: { type: "string" },
      sourceRefs: { type: "array", items: sourceRefJsonSchema },
      warning: { type: "string" },
      status: {
        type: "string",
        enum: ["proposed", "accepted", "rejected"],
      },
    },
  },
} as const;

export const chatResponseJsonSchema = {
  type: "object",
  required: ["content", "citations"],
  properties: {
    content: { type: "string" },
    citations: { type: "array", items: sourceRefJsonSchema },
    suggestionType: {
      type: "string",
      enum: ["source_backed", "clarification_question", "ai_idea"],
    },
  },
} as const;

export type AnyZodSchema<T> = z.ZodType<T>;
