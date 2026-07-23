import { describe, expect, it } from "vitest";

import {
  normalizeProtocolResourceLabels,
  stripInlineSourceRefs,
} from "@/src/lib/protocol-resource-labels";

describe("protocol resource label normalization", () => {
  it("removes trailing inline sourceRefs metadata from generated labels", () => {
    expect(
      stripInlineSourceRefs(
        "PVDF 0.45 μm (sourceRefs: [41672b03-0525-4157-b83c-4a77826643f7])",
      ),
    ).toBe("PVDF 0.45 μm");
    expect(
      stripInlineSourceRefs(
        'Chemi-imager (Source Refs: ["dac405e0-ec39-4c8c-ae3e-095b258fd7fb"])',
      ),
    ).toBe("Chemi-imager");
    expect(
      stripInlineSourceRefs(
        "Rocking platform source_refs=[41672b03-0525-4157-b83c-4a77826643f7, dac405e0-ec39-4c8c-ae3e-095b258fd7fb];",
      ),
    ).toBe("Rocking platform");
  });

  it("leaves legitimate scientific labels and parentheses untouched", () => {
    expect(stripInlineSourceRefs("PVDF membrane (0.45 μm)")).toBe(
      "PVDF membrane (0.45 μm)",
    );
    expect(stripInlineSourceRefs("anti-pERK antibody, lot: A24-071")).toBe(
      "anti-pERK antibody, lot: A24-071",
    );
    expect(stripInlineSourceRefs("10× TBST [working solution]")).toBe(
      "10× TBST [working solution]",
    );
    expect(stripInlineSourceRefs("Reference standard source ref: [NIST SRM 1950]")).toBe(
      "Reference standard source ref: [NIST SRM 1950]",
    );
    expect(stripInlineSourceRefs("Filter sourceRefs: [catalog-1234]")).toBe(
      "Filter sourceRefs: [catalog-1234]",
    );
  });

  it("normalizes top-level and step labels while preserving real citations", () => {
    const sourceRefs = [
      {
        artifactId: "41672b03-0525-4157-b83c-4a77826643f7",
        label: "실험 노트",
      },
    ];
    const protocol = {
      materials: [
        "PVDF 0.45 μm (sourceRefs: [41672b03-0525-4157-b83c-4a77826643f7])",
        "(sourceRefs: [source-orphan-metadata])",
      ],
      equipment: [
        "Wet transfer tank (sourceRefs: [dac405e0-ec39-4c8c-ae3e-095b258fd7fb])",
      ],
      steps: [
        {
          materials: [
            "MeOH (sourceRefs: [41672b03-0525-4157-b83c-4a77826643f7])",
          ],
          equipment: [
            "Rocking platform (sourceRefs: [source-audio-handover])",
          ],
          sourceRefs,
        },
      ],
    };

    const normalized = normalizeProtocolResourceLabels(protocol);

    expect(normalized.materials).toEqual(["PVDF 0.45 μm"]);
    expect(normalized.equipment).toEqual(["Wet transfer tank"]);
    expect(normalized.steps[0].materials).toEqual(["MeOH"]);
    expect(normalized.steps[0].equipment).toEqual(["Rocking platform"]);
    expect(normalized.steps[0].sourceRefs).toBe(sourceRefs);
    expect(protocol.materials[0]).toContain("sourceRefs");
    expect(normalizeProtocolResourceLabels(normalized)).toBe(normalized);
  });

  it("returns an unchanged protocol by reference when no cleanup is needed", () => {
    const protocol = {
      materials: ["PVDF membrane (0.45 μm)"],
      equipment: ["Wet transfer tank"],
      steps: [{ materials: ["MeOH"], equipment: ["Rocking platform"] }],
    };

    expect(normalizeProtocolResourceLabels(protocol)).toBe(protocol);
  });
});
