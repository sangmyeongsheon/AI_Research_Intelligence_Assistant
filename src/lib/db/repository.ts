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
import {
  LabTraceDatabase,
  type StoredConflict,
  type StoredMissingField,
} from "./database";

export class LabTracePersistenceError extends Error {
  readonly userMessage =
    "로컬 저장 중 문제가 발생했습니다. 화면의 기존 데이터는 유지됩니다. 브라우저 저장 공간을 확인한 뒤 다시 시도해 주세요.";

  constructor(
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LabTracePersistenceError";
  }
}

export interface SavedProtocolResult {
  protocol: Protocol;
  version: ProtocolVersion;
}

export interface SaveProtocolOptions {
  changeSummary: string;
  changedBy: string;
  bumpVersion?: boolean;
  now?: string;
}

export interface LabTraceRepository {
  hasData(): Promise<boolean>;
  seed(bundle: DemoSeedBundle, replace?: boolean): Promise<void>;
  reset(): Promise<void>;
  getLabs(): Promise<Lab[]>;
  putLab(lab: Lab): Promise<void>;
  getProtocols(labId?: string): Promise<Protocol[]>;
  getProtocolDocument(protocolId: string): Promise<ProtocolDocument | null>;
  getVersions(protocolId: string): Promise<ProtocolVersion[]>;
  getSources(protocolId: string): Promise<SourceArtifact[]>;
  getExcerpts(protocolId: string): Promise<SourceExcerpt[]>;
  getConflicts(protocolId: string): Promise<Conflict[]>;
  getMissingFields(protocolId: string): Promise<MissingField[]>;
  getChatMessages(protocolId: string): Promise<ChatMessage[]>;
  saveProtocol(
    protocol: Protocol,
    snapshot: ProtocolSnapshot,
    options: SaveProtocolOptions,
  ): Promise<SavedProtocolResult>;
  putProtocol(protocol: Protocol, snapshot: ProtocolSnapshot): Promise<void>;
  deleteProtocol(protocolId: string): Promise<void>;
  updateSource(
    sourceId: string,
    patch: Partial<SourceArtifact>,
  ): Promise<SourceArtifact>;
  putSources(sources: SourceArtifact[]): Promise<void>;
  replaceSources(
    protocolId: string,
    sources: SourceArtifact[],
  ): Promise<void>;
  putExcerpts(excerpts: SourceExcerpt[]): Promise<void>;
  replaceReviewItems(
    protocolId: string,
    conflicts: Conflict[],
    missingFields: MissingField[],
  ): Promise<void>;
  putChatMessages(messages: ChatMessage[]): Promise<void>;
  putBlob(record: LocalBlobRecord): Promise<void>;
  getBlob(key: string): Promise<LocalBlobRecord | undefined>;
  deleteBlob(key: string): Promise<void>;
}

function withoutProtocolId<T extends { protocolId: string }>(
  value: T,
): Omit<T, "protocolId"> {
  const copy = { ...value } as Partial<T>;
  delete copy.protocolId;
  return copy as Omit<T, "protocolId">;
}

function latestVersion(versions: ProtocolVersion[]): ProtocolVersion | undefined {
  return [...versions].sort(
    (left, right) => right.versionNumber - left.versionNumber,
  )[0];
}

function makeVersion(
  protocol: Protocol,
  snapshot: ProtocolSnapshot,
  versionNumber: number,
  options: SaveProtocolOptions,
): ProtocolVersion {
  const now = options.now ?? new Date().toISOString();
  return {
    id: `${protocol.id}-v${versionNumber}-${now}`,
    protocolId: protocol.id,
    versionNumber,
    snapshot,
    changeSummary: options.changeSummary,
    changedBy: options.changedBy,
    createdAt: now,
  };
}

export class DexieLabTraceRepository implements LabTraceRepository {
  constructor(readonly database = new LabTraceDatabase()) {}

  private async protect<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof LabTracePersistenceError) throw error;
      throw new LabTracePersistenceError(
        error instanceof Error ? error.message : "IndexedDB operation failed.",
        { cause: error },
      );
    }
  }

  async hasData(): Promise<boolean> {
    return this.protect(async () => (await this.database.labs.count()) > 0);
  }

  async seed(bundle: DemoSeedBundle, replace = false): Promise<void> {
    return this.protect(async () => {
      await this.database.transaction(
        "rw",
        [
          this.database.labs,
          this.database.protocols,
          this.database.versions,
          this.database.sources,
          this.database.excerpts,
          this.database.conflicts,
          this.database.missingFields,
          this.database.chatMessages,
          this.database.blobs,
        ],
        async () => {
          if (replace) {
            await Promise.all([
              this.database.labs.clear(),
              this.database.protocols.clear(),
              this.database.versions.clear(),
              this.database.sources.clear(),
              this.database.excerpts.clear(),
              this.database.conflicts.clear(),
              this.database.missingFields.clear(),
              this.database.chatMessages.clear(),
              this.database.blobs.clear(),
            ]);
          }
          await this.database.labs.bulkPut([bundle.lab]);
          await this.database.protocols.bulkPut(bundle.protocols);
          await this.database.versions.bulkPut(bundle.versions);
          await this.database.sources.bulkPut(bundle.sources);
          await this.database.excerpts.bulkPut(bundle.excerpts);
          await this.database.conflicts.bulkPut(
            bundle.conflicts.map((conflict) => ({
              ...conflict,
              protocolId: bundle.protocols[0]?.id ?? "",
            })),
          );
          await this.database.missingFields.bulkPut(
            bundle.missingFields.map((missing) => ({
              ...missing,
              protocolId: bundle.protocols[0]?.id ?? "",
            })),
          );
          await this.database.chatMessages.bulkPut(bundle.chatMessages);
        },
      );
    });
  }

  async reset(): Promise<void> {
    return this.protect(async () => {
      await this.database.transaction(
        "rw",
        [
          this.database.labs,
          this.database.protocols,
          this.database.versions,
          this.database.sources,
          this.database.excerpts,
          this.database.conflicts,
          this.database.missingFields,
          this.database.chatMessages,
          this.database.blobs,
        ],
        async () => {
          await Promise.all([
            this.database.labs.clear(),
            this.database.protocols.clear(),
            this.database.versions.clear(),
            this.database.sources.clear(),
            this.database.excerpts.clear(),
            this.database.conflicts.clear(),
            this.database.missingFields.clear(),
            this.database.chatMessages.clear(),
            this.database.blobs.clear(),
          ]);
        },
      );
    });
  }

  async getLabs(): Promise<Lab[]> {
    return this.protect(() => this.database.labs.toArray());
  }

  async putLab(lab: Lab): Promise<void> {
    return this.protect(async () => {
      await this.database.labs.put(lab);
    });
  }

  async getProtocols(labId?: string): Promise<Protocol[]> {
    return this.protect(async () => {
      const protocols = labId
        ? await this.database.protocols.where("labId").equals(labId).toArray()
        : await this.database.protocols.toArray();
      return protocols.sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
    });
  }

  async getProtocolDocument(
    protocolId: string,
  ): Promise<ProtocolDocument | null> {
    return this.protect(async () => {
      const [protocol, versions] = await Promise.all([
        this.database.protocols.get(protocolId),
        this.database.versions
          .where("protocolId")
          .equals(protocolId)
          .toArray(),
      ]);
      const version = latestVersion(versions);
      return protocol && version
        ? { ...protocol, snapshot: version.snapshot }
        : null;
    });
  }

  async getVersions(protocolId: string): Promise<ProtocolVersion[]> {
    return this.protect(async () =>
      (
        await this.database.versions
          .where("protocolId")
          .equals(protocolId)
          .toArray()
      ).sort((left, right) => right.versionNumber - left.versionNumber),
    );
  }

  async getSources(protocolId: string): Promise<SourceArtifact[]> {
    return this.protect(() =>
      this.database.sources.where("protocolId").equals(protocolId).toArray(),
    );
  }

  async getExcerpts(protocolId: string): Promise<SourceExcerpt[]> {
    return this.protect(async () => {
      const sourceIds = new Set(
        (
          await this.database.sources
            .where("protocolId")
            .equals(protocolId)
            .toArray()
        ).map((source) => source.id),
      );
      return (await this.database.excerpts.toArray()).filter((excerpt) =>
        sourceIds.has(excerpt.sourceArtifactId),
      );
    });
  }

  async getConflicts(protocolId: string): Promise<Conflict[]> {
    return this.protect(async () =>
      (
        await this.database.conflicts
          .where("protocolId")
          .equals(protocolId)
          .toArray()
      ).map((value) => withoutProtocolId(value)),
    );
  }

  async getMissingFields(protocolId: string): Promise<MissingField[]> {
    return this.protect(async () =>
      (
        await this.database.missingFields
          .where("protocolId")
          .equals(protocolId)
          .toArray()
      ).map((value) => withoutProtocolId(value)),
    );
  }

  async getChatMessages(protocolId: string): Promise<ChatMessage[]> {
    return this.protect(async () =>
      (
        await this.database.chatMessages
          .where("protocolId")
          .equals(protocolId)
          .toArray()
      ).sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    );
  }

  async saveProtocol(
    protocol: Protocol,
    snapshot: ProtocolSnapshot,
    options: SaveProtocolOptions,
  ): Promise<SavedProtocolResult> {
    return this.protect(async () =>
      this.database.transaction(
        "rw",
        [
          this.database.protocols,
          this.database.versions,
          this.database.sources,
          this.database.conflicts,
          this.database.missingFields,
        ],
        async () => {
          const existingVersions = await this.database.versions
            .where("protocolId")
            .equals(protocol.id)
            .toArray();
          const current =
            latestVersion(existingVersions)?.versionNumber ??
            protocol.currentVersion ??
            0;
          const bumpVersion = options.bumpVersion ?? true;
          const versionNumber = bumpVersion ? current + 1 : Math.max(current, 1);
          const now = options.now ?? new Date().toISOString();
          const savedProtocol: Protocol = {
            ...protocol,
            currentVersion: versionNumber,
            updatedAt: now,
          };
          const version = makeVersion(
            savedProtocol,
            snapshot,
            versionNumber,
            { ...options, now },
          );

          await this.database.protocols.put(savedProtocol);
          if (!bumpVersion) {
            const sameVersion = existingVersions.find(
              (item) => item.versionNumber === versionNumber,
            );
            if (sameVersion) await this.database.versions.delete(sameVersion.id);
          }
          await this.database.versions.put(version);
          await this.database.sources.bulkPut(snapshot.sources);
          await this.replaceReviewItemsUnsafe(
            protocol.id,
            snapshot.conflicts,
            snapshot.missingFields,
          );
          return { protocol: savedProtocol, version };
        },
      ),
    );
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
    return this.protect(async () => {
      await this.database.transaction(
        "rw",
        [
          this.database.protocols,
          this.database.versions,
          this.database.sources,
          this.database.excerpts,
          this.database.conflicts,
          this.database.missingFields,
          this.database.chatMessages,
          this.database.blobs,
        ],
        async () => {
          const sources = await this.database.sources
            .where("protocolId")
            .equals(protocolId)
            .toArray();
          const sourceIds = sources.map((source) => source.id);
          const blobKeys = sources
            .map((source) => source.localBlobKey)
            .filter((key): key is string => Boolean(key));
          await Promise.all([
            this.database.protocols.delete(protocolId),
            this.database.versions
              .where("protocolId")
              .equals(protocolId)
              .delete(),
            this.database.sources.where("protocolId").equals(protocolId).delete(),
            this.database.conflicts
              .where("protocolId")
              .equals(protocolId)
              .delete(),
            this.database.missingFields
              .where("protocolId")
              .equals(protocolId)
              .delete(),
            this.database.chatMessages
              .where("protocolId")
              .equals(protocolId)
              .delete(),
            this.database.excerpts
              .where("sourceArtifactId")
              .anyOf(sourceIds)
              .delete(),
            this.database.blobs.bulkDelete(blobKeys),
          ]);
        },
      );
    });
  }

  async updateSource(
    sourceId: string,
    patch: Partial<SourceArtifact>,
  ): Promise<SourceArtifact> {
    return this.protect(async () => {
      const existing = await this.database.sources.get(sourceId);
      if (!existing) {
        throw new LabTracePersistenceError(
          `Source artifact not found: ${sourceId}`,
        );
      }
      const updated = { ...existing, ...patch, id: existing.id };
      await this.database.sources.put(updated);
      return updated;
    });
  }

  async putSources(sources: SourceArtifact[]): Promise<void> {
    return this.protect(async () => {
      await this.database.sources.bulkPut(sources);
    });
  }

  async replaceSources(
    protocolId: string,
    sources: SourceArtifact[],
  ): Promise<void> {
    return this.protect(async () => {
      await this.database.transaction(
        "rw",
        [
          this.database.sources,
          this.database.excerpts,
          this.database.blobs,
        ],
        async () => {
          const existing = await this.database.sources
            .where("protocolId")
            .equals(protocolId)
            .toArray();
          const sourceIds = existing.map((source) => source.id);
          const blobKeys = existing
            .map((source) => source.localBlobKey)
            .filter((key): key is string => Boolean(key));
          await this.database.sources
            .where("protocolId")
            .equals(protocolId)
            .delete();
          if (sourceIds.length) {
            await this.database.excerpts
              .where("sourceArtifactId")
              .anyOf(sourceIds)
              .delete();
          }
          if (blobKeys.length) await this.database.blobs.bulkDelete(blobKeys);
          if (sources.length) await this.database.sources.bulkPut(sources);
        },
      );
    });
  }

  async putExcerpts(excerpts: SourceExcerpt[]): Promise<void> {
    return this.protect(async () => {
      await this.database.excerpts.bulkPut(excerpts);
    });
  }

  private async replaceReviewItemsUnsafe(
    protocolId: string,
    conflicts: Conflict[],
    missingFields: MissingField[],
  ): Promise<void> {
    await this.database.conflicts
      .where("protocolId")
      .equals(protocolId)
      .delete();
    await this.database.missingFields
      .where("protocolId")
      .equals(protocolId)
      .delete();
    await this.database.conflicts.bulkPut(
      conflicts.map((conflict): StoredConflict => ({
        ...conflict,
        protocolId,
      })),
    );
    await this.database.missingFields.bulkPut(
      missingFields.map((missing): StoredMissingField => ({
        ...missing,
        protocolId,
      })),
    );
  }

  async replaceReviewItems(
    protocolId: string,
    conflicts: Conflict[],
    missingFields: MissingField[],
  ): Promise<void> {
    return this.protect(async () => {
      await this.database.transaction(
        "rw",
        [this.database.conflicts, this.database.missingFields],
        () =>
          this.replaceReviewItemsUnsafe(
            protocolId,
            conflicts,
            missingFields,
          ),
      );
    });
  }

  async putChatMessages(messages: ChatMessage[]): Promise<void> {
    return this.protect(async () => {
      await this.database.chatMessages.bulkPut(messages);
    });
  }

  async putBlob(record: LocalBlobRecord): Promise<void> {
    return this.protect(async () => {
      await this.database.blobs.put(record);
    });
  }

  async getBlob(key: string): Promise<LocalBlobRecord | undefined> {
    return this.protect(() => this.database.blobs.get(key));
  }

  async deleteBlob(key: string): Promise<void> {
    return this.protect(async () => {
      await this.database.blobs.delete(key);
    });
  }
}
