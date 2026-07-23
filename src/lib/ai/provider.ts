import type {
  AiSuggestion,
  ChatMessage,
  ChatResponse,
  Conflict,
  EvidenceUnit,
  ExtractedSourceResult,
  MergedEvidenceResult,
  MissingField,
  ProtocolSnapshot,
  SourceArtifact,
  StructuredProtocolOutput,
} from "@/src/types";

export interface ExtractSourceInput {
  artifact: SourceArtifact;
  /** Text extracted locally, a pre-existing transcript, or pasted content. */
  text?: string;
  /** Base64 payload used by server-side multimodal providers. */
  base64Data?: string;
}

export interface MergeEvidenceInput {
  evidence: EvidenceUnit[];
  sources: SourceArtifact[];
}

export interface GenerateProtocolInput {
  evidence: EvidenceUnit[];
  sources: SourceArtifact[];
  conflicts?: Conflict[];
  missingFields?: MissingField[];
}

export interface RegenerateAfterResolutionInput {
  protocol: ProtocolSnapshot;
  evidence: EvidenceUnit[];
  conflicts: Conflict[];
  missingFields: MissingField[];
}

export interface ChatWithProtocolInput {
  protocol: ProtocolSnapshot;
  protocolId: string;
  question: string;
  history?: ChatMessage[];
}

export interface GenerateSuggestionsInput {
  protocol: ProtocolSnapshot;
  evidence: EvidenceUnit[];
}

export interface AIProvider {
  readonly id: "demo" | "gemini";
  extractSource(input: ExtractSourceInput): Promise<ExtractedSourceResult>;
  extractSources(
    inputs: ExtractSourceInput[],
  ): Promise<ExtractedSourceResult[]>;
  mergeEvidence(input: MergeEvidenceInput): Promise<MergedEvidenceResult>;
  generateProtocol(
    input: GenerateProtocolInput,
  ): Promise<StructuredProtocolOutput>;
  regenerateAfterResolution(
    input: RegenerateAfterResolutionInput,
  ): Promise<StructuredProtocolOutput>;
  chatWithProtocol(input: ChatWithProtocolInput): Promise<ChatResponse>;
  generateSuggestions(
    input: GenerateSuggestionsInput,
  ): Promise<AiSuggestion[]>;
}
