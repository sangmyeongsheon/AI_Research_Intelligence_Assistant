import type { z } from "zod";

import type {
  AiSuggestionSchema,
  AiSuggestionStatusSchema,
  AiSuggestionTypeSchema,
  ChatMessageSchema,
  ChatResponseSchema,
  ChatRoleSchema,
  ConflictOptionSchema,
  ConflictSchema,
  ConflictSeveritySchema,
  ConflictStatusSchema,
  EvidenceCategorySchema,
  EvidenceUnitSchema,
  ExperimentSummarySchema,
  ExtractedSourceResultSchema,
  KeyPaperSchema,
  LabSchema,
  LocalBlobRecordSchema,
  MergedEvidenceResultSchema,
  MissingFieldSchema,
  MissingFieldStatusSchema,
  ParameterSchema,
  ProcessingStatusSchema,
  ProtocolCategorySchema,
  ProtocolDocumentSchema,
  ProtocolSchema,
  ProtocolSnapshotSchema,
  ProtocolStatusSchema,
  ProtocolStepSchema,
  ProtocolVersionSchema,
  ResultAcceptanceSchema,
  ResearcherAnswerSchema,
  SourceArtifactSchema,
  SourceArtifactTypeSchema,
  SourceExcerptSchema,
  SourceRefSchema,
  SourceReliabilitySchema,
  StructuredProtocolOutputSchema,
  TroubleshootingItemSchema,
} from "./schemas";

export type Lab = z.infer<typeof LabSchema>;
export type KeyPaper = z.infer<typeof KeyPaperSchema>;
export type ProtocolCategory = z.infer<typeof ProtocolCategorySchema>;
export type ProtocolStatus = z.infer<typeof ProtocolStatusSchema>;
export type Protocol = z.infer<typeof ProtocolSchema>;
export type ProtocolDocument = z.infer<typeof ProtocolDocumentSchema>;
export type ProtocolVersion = z.infer<typeof ProtocolVersionSchema>;
export type ProtocolSnapshot = z.infer<typeof ProtocolSnapshotSchema>;
export type SourceArtifactType = z.infer<typeof SourceArtifactTypeSchema>;
export type SourceReliability = z.infer<typeof SourceReliabilitySchema>;
export type ProcessingStatus = z.infer<typeof ProcessingStatusSchema>;
export type SourceArtifact = z.infer<typeof SourceArtifactSchema>;
export type SourceExcerpt = z.infer<typeof SourceExcerptSchema>;
export type SourceRef = z.infer<typeof SourceRefSchema>;
export type Parameter = z.infer<typeof ParameterSchema>;
export type TroubleshootingItem = z.infer<typeof TroubleshootingItemSchema>;
export type ProtocolStep = z.infer<typeof ProtocolStepSchema>;
export type ConflictSeverity = z.infer<typeof ConflictSeveritySchema>;
export type ConflictStatus = z.infer<typeof ConflictStatusSchema>;
export type ConflictOption = z.infer<typeof ConflictOptionSchema>;
export type Conflict = z.infer<typeof ConflictSchema>;
export type MissingFieldStatus = z.infer<typeof MissingFieldStatusSchema>;
export type MissingField = z.infer<typeof MissingFieldSchema>;
export type AiSuggestionType = z.infer<typeof AiSuggestionTypeSchema>;
export type AiSuggestionStatus = z.infer<typeof AiSuggestionStatusSchema>;
export type AiSuggestion = z.infer<typeof AiSuggestionSchema>;
export type ChatRole = z.infer<typeof ChatRoleSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type EvidenceCategory = z.infer<typeof EvidenceCategorySchema>;
export type EvidenceUnit = z.infer<typeof EvidenceUnitSchema>;
export type ExperimentSummary = z.infer<typeof ExperimentSummarySchema>;
export type ResultAcceptance = z.infer<typeof ResultAcceptanceSchema>;
export type ResearcherAnswer = z.infer<typeof ResearcherAnswerSchema>;
export type StructuredProtocolOutput = z.infer<
  typeof StructuredProtocolOutputSchema
>;
export type ExtractedSourceResult = z.infer<typeof ExtractedSourceResultSchema>;
export type MergedEvidenceResult = z.infer<typeof MergedEvidenceResultSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
export type LocalBlobRecord = z.infer<typeof LocalBlobRecordSchema>;

export interface DemoSeedBundle {
  lab: Lab;
  protocols: Protocol[];
  versions: ProtocolVersion[];
  sources: SourceArtifact[];
  excerpts: SourceExcerpt[];
  conflicts: Conflict[];
  missingFields: MissingField[];
  chatMessages: ChatMessage[];
}
