import { describe, expect, it } from "vitest";

import { PRODUCT_CONFIG } from "@/src/config/product";
import { answerGuideQuestion } from "@/src/lib/guide";
import {
  DEPT_BRAIN_SCIENCES,
  DIRECTORY_DEPARTMENTS,
  DIRECTORY_LABS,
  getDepartment,
  getDirectoryLab,
} from "@/src/lib/lab-directory";
import { DEMO_LAB_ID } from "@/src/lib/demo";
import { LabSchema } from "@/src/types";

describe("Lab directory data", () => {
  it("exposes exactly six ordered departments with unique identifiers", () => {
    expect(DIRECTORY_DEPARTMENTS).toHaveLength(6);
    expect(new Set(DIRECTORY_DEPARTMENTS.map(({ id }) => id)).size).toBe(6);
    expect(new Set(DIRECTORY_DEPARTMENTS.map(({ name }) => name)).size).toBe(6);
    expect(DIRECTORY_DEPARTMENTS.map(({ order }) => order)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it("keeps every lab valid, uniquely identified, and linked to a real department", () => {
    const departmentIds = new Set(
      DIRECTORY_DEPARTMENTS.map((department) => department.id),
    );
    const labIds = DIRECTORY_LABS.map((lab) => lab.id);

    expect(new Set(labIds).size).toBe(labIds.length);
    expect(DIRECTORY_LABS.length).toBeGreaterThan(DIRECTORY_DEPARTMENTS.length);

    for (const lab of DIRECTORY_LABS) {
      expect(() => LabSchema.parse(lab)).not.toThrow();
      expect(lab.departmentId).toBeTruthy();
      expect(departmentIds.has(lab.departmentId!)).toBe(true);
      expect(getDirectoryLab(lab.id)).toBe(lab);
    }

    for (const department of DIRECTORY_DEPARTMENTS) {
      expect(getDepartment(department.id)).toBe(department);
      expect(
        DIRECTORY_LABS.some(
          (lab) => lab.departmentId === department.id,
        ),
      ).toBe(true);
    }
  });

  it("includes the connected LabTrace lab with its research areas and key papers", () => {
    const currentLab = getDirectoryLab(DEMO_LAB_ID);

    expect(currentLab).toBeDefined();
    expect(currentLab).toMatchObject({
      departmentId: DEPT_BRAIN_SCIENCES,
      name: PRODUCT_CONFIG.defaultLab.name,
      shortName: PRODUCT_CONFIG.defaultLab.shortName,
      isProfilePublic: true,
    });
    expect(currentLab?.researchAreas?.length).toBeGreaterThanOrEqual(3);
    expect(currentLab?.researchAreas?.every(Boolean)).toBe(true);
    expect(currentLab?.keyPapers).toEqual(
      PRODUCT_CONFIG.defaultLab.keyPapers,
    );
    expect(currentLab?.keyPapers).toHaveLength(3);
  });
});

describe("LabTrace guide answers", () => {
  it.each([
    "Western blot transfer 전압은 몇 V인가요?",
    "항체 농도와 배양 시간은 어떻게 정하나요?",
    "원심분리 온도 조건을 알려줘",
  ])("routes scientific protocol questions to Protocol Q&A: %s", (question) => {
    const answer = answerGuideQuestion(question);

    expect(answer).toContain("Protocol Q&A");
    expect(answer).toContain("원본 근거");
  });

  it.each([
    ["새 프로토콜은 어떻게 만들고 파일을 업로드하나요?", "New protocol"],
    ["충돌과 누락 질문은 어디서 해결해?", "누락 질문"],
    ["원본 출처와 인용은 어디서 확인해?", "오른쪽 원본 패널"],
    ["PDF로 내보내기와 다운로드는 어떻게 해?", "내보내기 메뉴"],
    ["Gemini API 키를 바꾸려면?", "API 키 관리"],
    ["학과와 연구실을 전환하려면?", "‘Labs’"],
    ["프로토콜 버전 이력과 승인 상태는?", "버전 이력"],
  ])("answers the key navigation question %s", (question, expected) => {
    expect(answerGuideQuestion(question)).toContain(expected);
  });

  it("prompts for a concrete task when no question is supplied", () => {
    expect(answerGuideQuestion("   ")).toContain("짧게 적어");
  });
});
