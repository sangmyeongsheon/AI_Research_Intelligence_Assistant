export const PRODUCT_CONFIG = {
  name: "LabTrace",
  nameKo: "랩트레이스",
  tagline: "연구 작성자와 원본 근거가 연결된 표준 랩실 프로토콜",
  description:
    "음성, 사진, 메모와 기존 문서를 통합해 출처와 검토 이력이 연결된 프로토콜을 만듭니다.",
  defaultLab: {
    name: "Neural Systems Lab",
    shortName: "NSL",
    field: "신경과학 및 분자생물학",
    description:
      "신경세포 신호전달과 시냅스 가소성을 분자·세포 수준에서 연구하며, 정량 Western blot과 이미징 기반 검증을 함께 수행합니다.",
    keyPapers: [
      {
        title:
          "Activity-dependent ERK signaling shapes synaptic plasticity in cortical neurons",
        journal: "Neural Systems Reports",
        year: "2025",
      },
      {
        title:
          "Quantitative phosphoproteomics reveals adaptive signaling after neuronal stimulation",
        journal: "Molecular Neurobiology Methods",
        year: "2024",
      },
      {
        title:
          "A reproducible Western blot workflow for low-abundance phosphoproteins",
        journal: "Laboratory Protocols",
        year: "2023",
      },
    ],
  },
  demoUser: "현재 사용자",
  supportEmail: "labtrace@example.invalid",
} as const;

export const AI_DRAFT_NOTICE =
  "미해결 충돌과 누락 항목을 확인하고 연구실의 검토 절차에 따라 상태를 확정하세요.";
