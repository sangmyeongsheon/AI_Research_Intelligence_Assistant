import type {
  ChatMessage,
  Conflict,
  DemoSeedBundle,
  Lab,
  LocalBlobRecord,
  MissingField,
  Protocol,
  ProtocolDocument,
  ProtocolSnapshot,
  ProtocolVersion,
  SourceArtifact,
  SourceExcerpt,
} from "@/src/types";
import type {
  LabTraceRepository,
  SavedProtocolResult,
  SaveProtocolOptions,
} from "./repository";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function withoutProtocolId<T extends { protocolId: string }>(
  value: T,
): Omit<T, "protocolId"> {
  const copy = { ...value } as Partial<T>;
  delete copy.protocolId;
  return copy as Omit<T, "protocolId">;
}

/**
 * Used for SSR and unit tests. It follows the same version semantics as Dexie,
 * which keeps repository behavior testable without pretending server memory is
 * persistent browser storage.
 */
export class MemoryLabTraceRepository implements LabTraceRepository {
  private labs = new Map<string, Lab>();
  private protocols = new Map<string, Protocol>();
  private versions = new Map<string, ProtocolVersion>();
  private sources = new Map<string, SourceArtifact>();
  private excerpts = new Map<string, SourceExcerpt>();
  private conflicts = new Map<string, Conflict & { protocolId: string }>();
  private missing = new Map<string, MissingField & { protocolId: string }>();
  private chat = new Map<string, ChatMessage>();
  private blobs = new Map<string, LocalBlobRecord>();

  async hasData(): Promise<boolean> {
    return this.labs.size > 0;
  }

  async seed(bundle: DemoSeedBundle, replace = false): Promise<void> {
    if (replace) await this.reset();
    this.labs.set(bundle.lab.id, clone(bundle.lab));
    bundle.protocols.forEach((value) =>
      this.protocols.set(value.id, clone(value)),
    );
    bundle.versions.forEach((value) => this.versions.set(value.id, clone(value)));
    bundle.sources.forEach((value) => this.sources.set(value.id, clone(value)));
    bundle.excerpts.forEach((value) =>
      this.excerpts.set(value.id, clone(value)),
    );
    const protocolId = bundle.protocols[0]?.id ?? "";
    bundle.conflicts.forEach((value) =>
      this.conflicts.set(value.id, { ...clone(value), protocolId }),
    );
    bundle.missingFields.forEach((value) =>
      this.missing.set(value.id, { ...clone(value), protocolId }),
    );
    bundle.chatMessages.forEach((value) => this.chat.set(value.id, clone(value)));
  }

  async reset(): Promise<void> {
    this.labs.clear();
    this.protocols.clear();
    this.versions.clear();
    this.sources.clear();
    this.excerpts.clear();
    this.conflicts.clear();
    this.missing.clear();
    this.chat.clear();
    this.blobs.clear();
  }

  async getLabs(): Promise<Lab[]> {
    return clone([...this.labs.values()]);
  }

  async putLab(lab: Lab): Promise<void> {
    this.labs.set(lab.id, clone(lab));
  }

  async getProtocols(labId?: string): Promise<Protocol[]> {
    return clone(
      [...this.protocols.values()]
        .filter((protocol) => !labId || protocol.labId === labId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    );
  }

  async getProtocolDocument(
    protocolId: string,
  ): Promise<ProtocolDocument | null> {
    const protocol = this.protocols.get(protocolId);
    const version = (await this.getVersions(protocolId))[0];
    return protocol && version
      ? clone({ ...protocol, snapshot: version.snapshot })
      : null;
  }

  async getVersions(protocolId: string): Promise<ProtocolVersion[]> {
    return clone(
      [...this.versions.values()]
        .filter((version) => version.protocolId === protocolId)
        .sort((left, right) => right.versionNumber - left.versionNumber),
    );
  }

  async getSources(protocolId: string): Promise<SourceArtifact[]> {
    return clone(
      [...this.sources.values()].filter(
        (source) => source.protocolId === protocolId,
      ),
    );
  }

  async getExcerpts(protocolId: string): Promise<SourceExcerpt[]> {
    const sourceIds = new Set(
      (await this.getSources(protocolId)).map((source) => source.id),
    );
    return clone(
      [...this.excerpts.values()].filter((excerpt) =>
        sourceIds.has(excerpt.sourceArtifactId),
      ),
    );
  }

  async getConflicts(protocolId: string): Promise<Conflict[]> {
    return clone(
      [...this.conflicts.values()]
        .filter((conflict) => conflict.protocolId === protocolId)
        .map(withoutProtocolId),
    );
  }

  async getMissingFields(protocolId: string): Promise<MissingField[]> {
    return clone(
      [...this.missing.values()]
        .filter((field) => field.protocolId === protocolId)
        .map(withoutProtocolId),
    );
  }

  async getChatMessages(protocolId: string): Promise<ChatMessage[]> {
    return clone(
      [...this.chat.values()]
        .filter((message) => message.protocolId === protocolId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    );
  }

  async saveProtocol(
    protocol: Protocol,
    snapshot: ProtocolSnapshot,
    options: SaveProtocolOptions,
  ): Promise<SavedProtocolResult> {
    const versions = await this.getVersions(protocol.id);
    const current = versions[0]?.versionNumber ?? protocol.currentVersion ?? 0;
    const bump = options.bumpVersion ?? true;
    const versionNumber = bump ? current + 1 : Math.max(current, 1);
    const now = options.now ?? new Date().toISOString();
    const savedProtocol: Protocol = {
      ...clone(protocol),
      currentVersion: versionNumber,
      updatedAt: now,
    };
    if (!bump) {
      for (const version of versions) {
        if (version.versionNumber === versionNumber) {
          this.versions.delete(version.id);
        }
      }
    }
    const version: ProtocolVersion = {
      id: `${protocol.id}-v${versionNumber}-${now}`,
      protocolId: protocol.id,
      versionNumber,
      snapshot: clone(snapshot),
      changeSummary: options.changeSummary,
      changedBy: options.changedBy,
      createdAt: now,
    };
    this.protocols.set(protocol.id, clone(savedProtocol));
    this.versions.set(version.id, clone(version));
    await this.putSources(snapshot.sources);
    await this.replaceReviewItems(
      protocol.id,
      snapshot.conflicts,
      snapshot.missingFields,
    );
    return clone({ protocol: savedProtocol, version });
  }

  async putProtocol(
    protocol: Protocol,
    snapshot: ProtocolSnapshot,
  ): Promise<void> {
    await this.saveProtocol(protocol, snapshot, {
      changeSummary: "자동 저장",
      changedBy: "현재 사용자",
      bumpVersion: false,
      now: protocol.updatedAt,
    });
  }

  async deleteProtocol(protocolId: string): Promise<void> {
    const sources = await this.getSources(protocolId);
    const sourceIds = new Set(sources.map((source) => source.id));
    this.protocols.delete(protocolId);
    for (const [id, version] of this.versions) {
      if (version.protocolId === protocolId) this.versions.delete(id);
    }
    for (const [id, source] of this.sources) {
      if (source.protocolId === protocolId) {
        if (source.localBlobKey) this.blobs.delete(source.localBlobKey);
        this.sources.delete(id);
      }
    }
    for (const [id, excerpt] of this.excerpts) {
      if (sourceIds.has(excerpt.sourceArtifactId)) this.excerpts.delete(id);
    }
    for (const [id, conflict] of this.conflicts) {
      if (conflict.protocolId === protocolId) this.conflicts.delete(id);
    }
    for (const [id, field] of this.missing) {
      if (field.protocolId === protocolId) this.missing.delete(id);
    }
    for (const [id, message] of this.chat) {
      if (message.protocolId === protocolId) this.chat.delete(id);
    }
  }

  async updateSource(
    sourceId: string,
    patch: Partial<SourceArtifact>,
  ): Promise<SourceArtifact> {
    const source = this.sources.get(sourceId);
    if (!source) throw new Error(`Source artifact not found: ${sourceId}`);
    const updated = { ...source, ...clone(patch), id: source.id };
    this.sources.set(sourceId, updated);
    return clone(updated);
  }

  async putSources(sources: SourceArtifact[]): Promise<void> {
    sources.forEach((source) => this.sources.set(source.id, clone(source)));
  }

  async replaceSources(
    protocolId: string,
    sources: SourceArtifact[],
  ): Promise<void> {
    const existing = [...this.sources.values()].filter(
      (source) => source.protocolId === protocolId,
    );
    const sourceIds = new Set(existing.map((source) => source.id));
    existing.forEach((source) => {
      this.sources.delete(source.id);
      if (source.localBlobKey) this.blobs.delete(source.localBlobKey);
    });
    for (const [id, excerpt] of this.excerpts) {
      if (sourceIds.has(excerpt.sourceArtifactId)) this.excerpts.delete(id);
    }
    await this.putSources(sources);
  }

  async putExcerpts(excerpts: SourceExcerpt[]): Promise<void> {
    excerpts.forEach((excerpt) =>
      this.excerpts.set(excerpt.id, clone(excerpt)),
    );
  }

  async replaceReviewItems(
    protocolId: string,
    conflicts: Conflict[],
    missingFields: MissingField[],
  ): Promise<void> {
    for (const [id, conflict] of this.conflicts) {
      if (conflict.protocolId === protocolId) this.conflicts.delete(id);
    }
    for (const [id, field] of this.missing) {
      if (field.protocolId === protocolId) this.missing.delete(id);
    }
    conflicts.forEach((conflict) =>
      this.conflicts.set(conflict.id, {
        ...clone(conflict),
        protocolId,
      }),
    );
    missingFields.forEach((field) =>
      this.missing.set(field.id, { ...clone(field), protocolId }),
    );
  }

  async putChatMessages(messages: ChatMessage[]): Promise<void> {
    messages.forEach((message) => this.chat.set(message.id, clone(message)));
  }

  async putBlob(record: LocalBlobRecord): Promise<void> {
    this.blobs.set(record.key, clone(record));
  }

  async getBlob(key: string): Promise<LocalBlobRecord | undefined> {
    const record = this.blobs.get(key);
    return record ? clone(record) : undefined;
  }

  async deleteBlob(key: string): Promise<void> {
    this.blobs.delete(key);
  }
}
