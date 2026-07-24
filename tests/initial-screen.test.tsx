import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/src/stores/useLabTraceStore", () => {
  const state = {
    activeProtocol: null,
    analysisStage: "idle",
    conflicts: [],
    demoMode: true,
    error: null,
    excerpts: [],
    hydrated: true,
    lab: null,
    missingFields: [],
    protocols: [],
    selectedSourceRef: null,
    sources: [],
    toast: null,
  };
  return {
    useLabTraceStore: Object.assign(() => state, {
      getState: () => state,
    }),
  };
});

import { LabTraceApp } from "@/src/components/LabTraceApp";

describe("ARIA initial screen", () => {
  it("opens the Labs department directory before the protocol workspace", () => {
    const html = renderToStaticMarkup(<LabTraceApp />);

    expect(html).toContain("연구실 디렉터리");
    expect(html).toContain("화학물리학과");
    expect(html).toContain("뇌과학과");
    expect(html).not.toContain("프로토콜 관리");
  });
});
