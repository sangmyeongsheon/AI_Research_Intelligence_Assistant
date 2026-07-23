import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MemoryLabTraceRepository,
  setLabTraceRepository,
} from "@/src/lib/db";
import { useLabTraceStore } from "@/src/stores/useLabTraceStore";
import type {
  DemoSeedBundle,
  Lab,
  Protocol,
  ProtocolSnapshot,
} from "@/src/types";

const SELECTED_LAB_STORAGE_KEY = "labtrace:selected-lab-id";
const now = "2026-07-24T00:00:00.000Z";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

function createLab(id: string, name: string, description = ""): Lab {
  return {
    id,
    name,
    shortName: name.slice(0, 3),
    field: "분자생물학",
    description,
    isDemo: false,
    createdAt: now,
    updatedAt: now,
  };
}

function createBundle(lab: Lab, protocolId: string): DemoSeedBundle {
  const snapshot: ProtocolSnapshot = {
    experiment: {
      title: `${lab.name} 프로토콜`,
      objective: `${lab.name} 전용 작업`,
      category: "experiment",
    },
    materials: [],
    equipment: [],
    steps: [],
    conflicts: [],
    missingFields: [],
    sources: [],
    overallWarnings: [],
  };
  const protocol: Protocol = {
    id: protocolId,
    labId: lab.id,
    title: snapshot.experiment.title,
    objective: snapshot.experiment.objective,
    category: "experiment",
    status: "draft",
    currentVersion: 1,
    tags: [],
    createdBy: "현재 사용자",
    createdAt: now,
    updatedAt: now,
  };
  return {
    lab,
    protocols: [protocol],
    versions: [
      {
        id: `${protocolId}-v1`,
        protocolId,
        versionNumber: 1,
        snapshot,
        changeSummary: "초기 버전",
        changedBy: "현재 사용자",
        createdAt: now,
      },
    ],
    sources: [],
    excerpts: [],
    conflicts: [],
    missingFields: [],
    chatMessages: [],
  };
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: createMemoryStorage() });
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ mode: "gemini", keySource: "server" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    ),
  );
});

afterEach(() => {
  setLabTraceRepository(undefined);
  vi.unstubAllGlobals();
});

describe("multi-lab workspace switching", () => {
  it("loads only the selected lab and clears prior-lab transient state", async () => {
    const repository = new MemoryLabTraceRepository();
    const neuralLab = createLab(
      "lab-neural-systems",
      "Neural Systems Lab",
      "사용자가 수정한 소개",
    );
    const targetLab = createLab("lab-target", "Target Lab");
    await repository.seed(createBundle(neuralLab, "protocol-neural"));
    await repository.seed(createBundle(targetLab, "protocol-target"));
    setLabTraceRepository(repository);
    useLabTraceStore.setState({
      lab: neuralLab,
      protocols: (await repository.getProtocols(neuralLab.id)),
      analysisStage: "generating",
      analysisProgress: 91,
      selectedSourceRef: {
        artifactId: "old-source",
        sourceLabel: "이전 연구실 자료",
        author: "이전 사용자",
        quote: "이전 자료",
        confidence: 1,
      },
      error: "이전 오류",
    });

    await useLabTraceStore.getState().selectLab(targetLab);
    const state = useLabTraceStore.getState();

    expect(state.lab?.id).toBe(targetLab.id);
    expect(state.protocols.map((protocol) => protocol.id)).toEqual([
      "protocol-target",
    ]);
    expect(state.activeProtocol?.id).toBe("protocol-target");
    expect(state.activeProtocol?.labId).toBe(targetLab.id);
    expect(state.analysisStage).toBe("idle");
    expect(state.analysisProgress).toBe(0);
    expect(state.selectedSourceRef).toBeNull();
    expect(state.evidence).toEqual([]);
    expect(state.suggestions).toEqual([]);
    expect(state.error).toBeNull();
    expect(window.localStorage.getItem(SELECTED_LAB_STORAGE_KEY)).toBe(
      targetLab.id,
    );
    expect(
      (await repository.getLabs()).find((lab) => lab.id === neuralLab.id)
        ?.description,
    ).toBe("사용자가 수정한 소개");
  });

  it("persists a new directory lab without creating or borrowing another lab's protocol", async () => {
    const repository = new MemoryLabTraceRepository();
    const neuralLab = createLab(
      "lab-neural-systems",
      "Neural Systems Lab",
      "보존할 사용자 소개",
    );
    await repository.seed(createBundle(neuralLab, "protocol-neural"));
    setLabTraceRepository(repository);
    const newLab = createLab("lab-directory-new", "Directory Lab");

    await useLabTraceStore.getState().selectLab(newLab);
    const state = useLabTraceStore.getState();
    const storedLabs = await repository.getLabs();

    expect(storedLabs.map((lab) => lab.id).sort()).toEqual(
      [neuralLab.id, newLab.id].sort(),
    );
    expect(state.lab).toMatchObject({ id: newLab.id, isDemo: false });
    expect(state.protocols).toEqual([]);
    expect(state.activeProtocol).toBeNull();
    expect((await repository.getProtocols(neuralLab.id))).toHaveLength(1);
    expect(
      storedLabs.find((lab) => lab.id === neuralLab.id)?.description,
    ).toBe("보존할 사용자 소개");
  });

  it("restores the remembered lab and its latest protocol during hydrate", async () => {
    const repository = new MemoryLabTraceRepository();
    const neuralLab = createLab("lab-neural-systems", "Neural Systems Lab");
    const rememberedLab = createLab("lab-remembered", "Remembered Lab");
    await repository.seed(createBundle(neuralLab, "protocol-neural"));
    await repository.seed(createBundle(rememberedLab, "protocol-remembered"));
    setLabTraceRepository(repository);
    window.localStorage.setItem(
      SELECTED_LAB_STORAGE_KEY,
      rememberedLab.id,
    );
    useLabTraceStore.setState({
      hydrated: false,
      lab: null,
      protocols: [],
      activeProtocol: null,
    });

    await useLabTraceStore.getState().hydrate();
    const state = useLabTraceStore.getState();

    expect(state.hydrated).toBe(true);
    expect(state.lab?.id).toBe(rememberedLab.id);
    expect(state.protocols.map((protocol) => protocol.id)).toEqual([
      "protocol-remembered",
    ]);
    expect(state.activeProtocol?.id).toBe("protocol-remembered");
  });
});
