import { z } from "zod";

/**
 * LabTrace stores dates as ISO strings so records can move unchanged between
 * IndexedDB, an API response, and a future PostgreSQL adapter.
 */
export const IsoDateSchema = z.string().min(1);
export const ConfidenceSchema = z.number().min(0).max(1);
const OptionalNonEmptyStringSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().min(1).optional(),
);
const OptionalIsoDateSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  IsoDateSchema.optional(),
);

export const KeyPaperSchema = z.object({
  title: z.string().min(1),
  journal: z.string(),
  year: z.string(),
  url: z.string().url().optional(),
});

export const LabSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
  field: z.string().min(1),
  description: z.string(),
  keyPapers: z.array(KeyPaperSchema).max(3).optional(),
  isDemo: z.boolean(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const ProtocolCategorySchema = z.enum([
  "experiment",
  "equipment",
  "troubleshooting",
]);

export const ProtocolStatusSchema = z.enum([
  "draft",
  "review",
  "approved",
  "archived",
]);

export const ProtocolSchema = z.object({
  id: z.string().min(1),
  labId: z.string().min(1),
  title: z.string().min(1),
  objective: z.string(),
  category: ProtocolCategorySchema,
  status: ProtocolStatusSchema,
  currentVersion: z.number().int().nonnegative(),
  tags: z.array(z.string()),
  createdBy: z.string().min(1),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const SourceArtifactTypeSchema = z.enum([
  "audio",
  "image",
  "pdf",
  "text",
  "markdown",
  "transcript",
]);

export const SourceReliabilitySchema = z.enum([
  "current",
  "legacy",
  "reference",
  "unknown",
]);

export const ProcessingStatusSchema = z.enum([
  "pending",
  "processing",
  "ready",
  "error",
]);

export const SourceArtifactSchema = z
  .object({
    id: z.string().min(1),
    protocolId: OptionalNonEmptyStringSchema,
    workspaceId: OptionalNonEmptyStringSchema,
    type: SourceArtifactTypeSchema,
    fileName: z.string().min(1),
    displayName: z.string().min(1),
    mimeType: z.string(),
    size: z.number().int().nonnegative(),
    author: z.string().min(1),
    sourceDate: IsoDateSchema,
    reliability: SourceReliabilitySchema,
    notes: z.string(),
    localBlobKey: OptionalNonEmptyStringSchema,
    extractedText: z.string(),
    processingStatus: ProcessingStatusSchema,
    processingError: z.string().optional(),
    createdAt: IsoDateSchema,
  })
  .refine((source) => Boolean(source.protocolId || source.workspaceId), {
    message: "protocolId 또는 workspaceId 중 하나가 필요합니다.",
  });

export const SourceExcerptSchema = z.object({
  id: z.string().min(1),
  sourceArtifactId: z.string().min(1),
  excerptText: z.string(),
  pageNumber: z.number().int().positive().optional(),
  timestampStart: z.number().nonnegative().optional(),
  timestampEnd: z.number().nonnegative().optional(),
  boundingDescription: z.string().optional(),
  confidence: ConfidenceSchema,
  author: z.string().min(1),
  sourceDate: IsoDateSchema,
});

export const SourceRefSchema = z.object({
  artifactId: z.string().min(1),
  excerptId: OptionalNonEmptyStringSchema,
  sourceLabel: z.string().min(1),
  author: z.string().min(1),
  pageNumber: z.number().int().positive().optional(),
  timestampStart: z.number().nonnegative().optional(),
  timestampEnd: z.number().nonnegative().optional(),
  quote: z.string(),
  confidence: ConfidenceSchema,
});

export const ParameterSchema = z.object({
  name: z.string().min(1),
  value: z.string(),
  unit: z.string(),
  normalizedValue: z.union([z.string(), z.number()]).optional(),
  normalizedUnit: z.string().optional(),
  sourceRefs: z.array(SourceRefSchema),
});

export const TroubleshootingItemSchema = z.object({
  problem: z.string().min(1),
  cause: z.string(),
  action: z.string().min(1),
  sourceRefs: z.array(SourceRefSchema),
});

export const ProtocolStepSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().positive(),
  title: z.string().min(1),
  action: z.string(),
  materials: z.array(z.string()),
  equipment: z.array(z.string()),
  parameters: z.array(ParameterSchema),
  duration: z.string(),
  checkpoints: z.array(z.string()),
  implicitTips: z.array(z.string()),
  commonMistakes: z.array(z.string()),
  troubleshooting: z.array(z.string()),
  troubleshootingItems: z.array(TroubleshootingItemSchema).optional(),
  successCriteria: z.array(z.string()),
  sourceRefs: z.array(SourceRefSchema),
  confidence: ConfidenceSchema,
  unresolved: z.boolean(),
});

export const ConflictSeveritySchema = z.enum(["low", "medium", "high"]);
export const ConflictStatusSchema = z.enum(["unresolved", "resolved"]);

export const ConflictOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.string(),
  sourceRefs: z.array(SourceRefSchema),
});

export const ConflictSchema = z.object({
  id: z.string().min(1),
  field: z.string().min(1),
  stepId: OptionalNonEmptyStringSchema,
  description: z.string().min(1),
  options: z.array(ConflictOptionSchema).min(2),
  sourceRefs: z.array(SourceRefSchema),
  severity: ConflictSeveritySchema,
  status: ConflictStatusSchema,
  selectedResolution: z.string().optional(),
  resolutionNote: z.string().optional(),
});

export const MissingFieldStatusSchema = z.enum([
  "unresolved",
  "answered",
  "dismissed",
]);

export const MissingFieldSchema = z.object({
  id: z.string().min(1),
  field: z.string().min(1),
  stepId: OptionalNonEmptyStringSchema,
  reason: z.string().min(1),
  question: z.string().min(1),
  severity: ConflictSeveritySchema,
  status: MissingFieldStatusSchema,
  userAnswer: z.string().optional(),
  answeredBy: z.string().optional(),
  answeredAt: OptionalIsoDateSchema,
});

export const AiSuggestionTypeSchema = z.enum([
  "source_backed",
  "clarification_question",
  "ai_idea",
]);

export const AiSuggestionStatusSchema = z.enum([
  "proposed",
  "accepted",
  "rejected",
]);

export const AiSuggestionSchema = z.object({
  id: z.string().min(1),
  type: AiSuggestionTypeSchema,
  title: z.string().min(1),
  content: z.string().min(1),
  sourceRefs: z.array(SourceRefSchema),
  warning: z.string().optional(),
  status: AiSuggestionStatusSchema,
});

export const ChatRoleSchema = z.enum(["user", "assistant", "system"]);

export const ChatMessageSchema = z.object({
  id: z.string().min(1),
  protocolId: z.string().min(1),
  role: ChatRoleSchema,
  content: z.string().min(1),
  citations: z.array(SourceRefSchema),
  suggestionType: AiSuggestionTypeSchema.optional(),
  createdAt: IsoDateSchema,
});

export const EvidenceCategorySchema = z.enum([
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
]);

export const EvidenceUnitSchema = z.object({
  id: z.string().min(1),
  sourceArtifactId: z.string().min(1),
  sourceExcerptId: OptionalNonEmptyStringSchema,
  category: EvidenceCategorySchema,
  stepCandidate: z.string().optional(),
  statement: z.string().min(1),
  parameterName: z.string().optional(),
  value: z.union([z.string(), z.number()]).optional(),
  unit: z.string().optional(),
  normalizedValue: z.union([z.string(), z.number()]).optional(),
  normalizedUnit: z.string().optional(),
  author: z.string().min(1),
  sourceDate: IsoDateSchema,
  pageNumber: z.number().int().positive().optional(),
  timestamp: z.number().nonnegative().optional(),
  timestampEnd: z.number().nonnegative().optional(),
  quote: z.string(),
  confidence: ConfidenceSchema,
  ambiguity: z.string().optional(),
});

export const ExperimentSummarySchema = z.object({
  title: z.string().min(1),
  objective: z.string(),
  scope: z.string().optional(),
  category: ProtocolCategorySchema,
});

export const ResultAcceptanceSchema = z.object({
  pass: z.array(z.string()),
  repeat: z.array(z.string()),
  discard: z.array(z.string()),
});

export const ResearcherAnswerSchema = z.object({
  missingFieldId: z.string().min(1),
  field: z.string().min(1),
  stepId: OptionalNonEmptyStringSchema,
  question: z.string().min(1),
  answer: z.string().min(1),
  answeredBy: z.string().min(1),
  answeredAt: IsoDateSchema,
});

/**
 * Canonical, provider-independent structured AI response. Provider output is
 * accepted only after this entire graph passes validation.
 */
export const StructuredProtocolOutputSchema = z.object({
  experiment: ExperimentSummarySchema,
  materials: z.array(z.string()),
  equipment: z.array(z.string()),
  preflightChecklist: z.array(z.string()).optional(),
  steps: z.array(ProtocolStepSchema),
  resultAcceptance: ResultAcceptanceSchema.optional(),
  researcherAnswers: z.array(ResearcherAnswerSchema).optional(),
  conflicts: z.array(ConflictSchema),
  missingFields: z.array(MissingFieldSchema),
  sources: z.array(SourceArtifactSchema),
  overallWarnings: z.array(z.string()),
});

export const ExtractedSourceResultSchema = z.object({
  artifact: SourceArtifactSchema,
  excerpts: z.array(SourceExcerptSchema),
  evidence: z.array(EvidenceUnitSchema),
  warnings: z.array(z.string()),
});

export const MergedEvidenceResultSchema = z.object({
  evidence: z.array(EvidenceUnitSchema),
  conflicts: z.array(ConflictSchema),
  missingFields: z.array(MissingFieldSchema),
  warnings: z.array(z.string()),
});

export const ChatResponseSchema = z.object({
  content: z.string().min(1),
  citations: z.array(SourceRefSchema),
  suggestionType: AiSuggestionTypeSchema.optional(),
});

export const ProtocolSnapshotSchema = StructuredProtocolOutputSchema;

export const ProtocolVersionSchema = z.object({
  id: z.string().min(1),
  protocolId: z.string().min(1),
  versionNumber: z.number().int().positive(),
  snapshot: ProtocolSnapshotSchema,
  changeSummary: z.string().min(1),
  changedBy: z.string().min(1),
  createdAt: IsoDateSchema,
});

export const ProtocolDocumentSchema = ProtocolSchema.extend({
  snapshot: ProtocolSnapshotSchema,
});

export const LocalBlobRecordSchema = z.object({
  key: z.string().min(1),
  blob: z.instanceof(Blob),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  createdAt: IsoDateSchema,
});
