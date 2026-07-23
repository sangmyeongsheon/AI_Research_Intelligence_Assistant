import type { LabTraceRepository } from "./repository";
import { DexieLabTraceRepository } from "./repository";
import { MemoryLabTraceRepository } from "./memory-repository";

export * from "./database";
export * from "./memory-repository";
export * from "./repository";

let defaultRepository: LabTraceRepository | undefined;

export function getLabTraceRepository(): LabTraceRepository {
  if (!defaultRepository) {
    defaultRepository =
      typeof indexedDB === "undefined"
        ? new MemoryLabTraceRepository()
        : new DexieLabTraceRepository();
  }
  return defaultRepository;
}

/** Test seam and future remote-adapter seam. */
export function setLabTraceRepository(
  repository: LabTraceRepository | undefined,
): void {
  defaultRepository = repository;
}

