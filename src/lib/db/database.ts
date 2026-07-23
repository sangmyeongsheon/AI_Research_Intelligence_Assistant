import Dexie, { type EntityTable, type Table } from "dexie";

import type {
  ChatMessage,
  Conflict,
  Lab,
  LocalBlobRecord,
  MissingField,
  Protocol,
  ProtocolVersion,
  SourceArtifact,
  SourceExcerpt,
} from "@/src/types";

export interface StoredConflict extends Conflict {
  protocolId: string;
}

export interface StoredMissingField extends MissingField {
  protocolId: string;
}

/**
 * Version 1 mirrors the domain model and keeps large binary data separate from
 * searchable source metadata. A future Supabase adapter can implement the same
 * repository without leaking Dexie into product code.
 */
export class LabTraceDatabase extends Dexie {
  labs!: EntityTable<Lab, "id">;
  protocols!: EntityTable<Protocol, "id">;
  versions!: EntityTable<ProtocolVersion, "id">;
  sources!: EntityTable<SourceArtifact, "id">;
  excerpts!: EntityTable<SourceExcerpt, "id">;
  conflicts!: EntityTable<StoredConflict, "id">;
  missingFields!: EntityTable<StoredMissingField, "id">;
  chatMessages!: EntityTable<ChatMessage, "id">;
  blobs!: Table<LocalBlobRecord, string>;

  constructor(name = "labtrace") {
    super(name);
    this.version(1).stores({
      labs: "id, isDemo, updatedAt",
      protocols:
        "id, labId, status, category, updatedAt, currentVersion, *tags",
      versions: "id, protocolId, [protocolId+versionNumber], createdAt",
      sources:
        "id, protocolId, workspaceId, type, reliability, processingStatus, createdAt",
      excerpts: "id, sourceArtifactId",
      conflicts: "id, protocolId, stepId, status, severity",
      missingFields: "id, protocolId, stepId, status, severity",
      chatMessages: "id, protocolId, createdAt",
      blobs: "key, createdAt",
    });
  }
}

