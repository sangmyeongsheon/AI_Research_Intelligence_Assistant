import type {
  Protocol,
  ProtocolSnapshot,
  ProtocolStep,
  SourceArtifact,
  SourceExcerpt,
  SourceRef,
} from "@/src/types";

export const EXAMPLE_PROTOCOL_ID = "protocol-example-phospho-erk";

const EXAMPLE_DATE = "2026-07-22";

function source(
  id: string,
  type: SourceArtifact["type"],
  fileName: string,
  displayName: string,
  author: string,
  reliability: SourceArtifact["reliability"],
  extractedText: string,
  protocolId: string,
  mimeType: string,
): SourceArtifact {
  return {
    id,
    protocolId,
    type,
    fileName,
    displayName,
    mimeType,
    size: extractedText.length,
    author,
    sourceDate: EXAMPLE_DATE,
    reliability,
    notes: "예시 프로토콜의 출처 연결을 보여주는 연구 자료",
    extractedText,
    processingStatus: "ready",
    createdAt: `${EXAMPLE_DATE}T09:00:00.000Z`,
  };
}

function ref(
  artifact: SourceArtifact,
  excerptId: string,
  quote: string,
  pageNumber?: number,
): SourceRef {
  return {
    artifactId: artifact.id,
    excerptId,
    sourceLabel: artifact.displayName,
    author: artifact.author,
    pageNumber,
    quote,
    confidence: 0.96,
  };
}

function parameter(
  name: string,
  value: string,
  unit: string,
  sourceRefs: SourceRef[],
) {
  return {
    name,
    value,
    unit,
    normalizedValue: value,
    normalizedUnit: unit || undefined,
    sourceRefs,
  };
}

export function createExampleProtocolBundle(labId: string): {
  protocol: Protocol;
  snapshot: ProtocolSnapshot;
  excerpts: SourceExcerpt[];
} {
  const now = new Date().toISOString();
  const protocolId = EXAMPLE_PROTOCOL_ID;
  const audio = source(
    "example-source-audio",
    "audio",
    "transfer-handover.m4a",
    "Transfer 인수인계 녹음",
    "김민재",
    "current",
    "PVDF 활성화 후 90 V에서 90분 transfer. 45분에 ice pack 교체. Membrane은 절대 말리지 않는다.",
    protocolId,
    "audio/mp4",
  );
  const note = source(
    "example-source-note",
    "text",
    "latest-direct-note.txt",
    "최근 직접 메모",
    "이수빈",
    "current",
    "pERK는 5% BSA로 blocking하고 primary 1:2000, 4도 overnight. TBST wash는 3회 수행한다.",
    protocolId,
    "text/plain",
  );
  const pdf = source(
    "example-source-pdf",
    "pdf",
    "neural-systems-lab-reference-protocol.pdf",
    "NSL Western blot 기준 프로토콜",
    "Neural Systems Lab",
    "reference",
    "10% gel, 20 ug/lane, transfer 90 V 90 min, Ponceau S 확인, ECL 1:1 검출 조건.",
    protocolId,
    "application/pdf",
  );
  const trouble = source(
    "example-source-troubleshooting",
    "markdown",
    "troubleshooting-experience.md",
    "Western blot 문제 해결 기록",
    "최현우",
    "current",
    "High background는 wash와 BSA 상태를 먼저 확인. Weak band는 primary 농도를 올리기 전에 transfer를 확인.",
    protocolId,
    "text/markdown",
  );
  const image = source(
    "example-source-image",
    "image",
    "handwritten-transfer-note.png",
    "Transfer 손글씨 실험 노트",
    "김민재",
    "current",
    "PVDF 0.45 um, MeOH 20 sec, transfer 90 V 90 min, Ponceau S 5 min, BSA blocking 60 min, ECL exposure 10/30/60 sec.",
    protocolId,
    "image/png",
  );
  const sources = [audio, note, pdf, trouble, image];
  const excerptIds = new Map(
    sources.map((item) => [item.id, `${item.id}-excerpt-1`]),
  );
  const excerpts: SourceExcerpt[] = sources.map((item) => ({
    id: excerptIds.get(item.id)!,
    sourceArtifactId: item.id,
    excerptText: item.extractedText,
    pageNumber: item.type === "pdf" ? 2 : undefined,
    timestampStart: item.type === "audio" ? 8 : undefined,
    timestampEnd: item.type === "audio" ? 58 : undefined,
    confidence: item.type === "image" ? 0.91 : 0.98,
    author: item.author,
    sourceDate: item.sourceDate,
  }));
  const audioRef = ref(
    audio,
    excerptIds.get(audio.id)!,
    "90 V에서 90분 transfer하고 45분에 ice pack을 교체합니다.",
  );
  const noteRef = ref(
    note,
    excerptIds.get(note.id)!,
    "pERK는 5% BSA, primary 1:2000, 4°C overnight.",
  );
  const pdfRef = ref(
    pdf,
    excerptIds.get(pdf.id)!,
    "10% gel, 20 μg/lane, transfer 90 V 90 min.",
    2,
  );
  const troubleRef = ref(
    trouble,
    excerptIds.get(trouble.id)!,
    "Weak band는 antibody 농도보다 transfer 여부를 먼저 확인한다.",
  );
  const imageRef = ref(
    image,
    excerptIds.get(image.id)!,
    "PVDF 0.45 μm, MeOH 20 sec, Ponceau S 5 min.",
  );

  const steps: ProtocolStep[] = [
    {
      id: "example-step-1",
      order: 1,
      title: "시료 로딩 및 전기영동",
      action: "10% SDS-PAGE gel의 각 lane에 단백질 시료 20 μg을 로딩한다.",
      materials: ["10% SDS-PAGE gel", "단백질 시료", "Protein ladder"],
      equipment: ["전기영동 장치", "Power supply"],
      parameters: [
        parameter("시료량", "20", "μg/lane", [pdfRef]),
        parameter("전기영동", "120", "V · 70 min", [pdfRef]),
      ],
      duration: "70 min",
      checkpoints: ["Tracking dye가 gel 하단에서 약 10 mm 남은 위치에 도달했는지 확인"],
      implicitTips: ["첫 lane과 마지막 lane의 빈 공간을 동일하게 유지한다."],
      commonMistakes: ["Well 벽을 찔러 시료가 인접 lane으로 새는 것"],
      troubleshooting: ["Lane이 휘면 gel 과열과 buffer 상태를 확인한다."],
      troubleshootingItems: [
        {
          problem: "Lane 왜곡",
          cause: "전기영동 중 과열 또는 오래된 running buffer",
          action: "Running buffer와 전압 설정을 확인하고 gel 온도를 기록한다.",
          sourceRefs: [troubleRef],
        },
      ],
      successCriteria: ["Marker와 시료 lane이 수직으로 분리되어야 한다."],
      sourceRefs: [pdfRef],
      confidence: 0.97,
      unresolved: false,
    },
    {
      id: "example-step-2",
      order: 2,
      title: "PVDF membrane 활성화",
      action: "0.45 μm PVDF membrane을 methanol에 20초간 완전히 적신다.",
      materials: ["PVDF membrane 0.45 μm", "Methanol", "DI water"],
      equipment: ["Clean tray", "Timer"],
      parameters: [
        parameter("Methanol 활성화", "20", "sec", [imageRef]),
        parameter("DI water 평형", "2", "min", [imageRef]),
      ],
      duration: "약 3 min",
      checkpoints: ["Membrane 전체가 균일하게 반투명해졌는지 확인"],
      implicitTips: ["핀셋으로 모서리만 잡아 단백질 결합면 손상을 줄인다."],
      commonMistakes: ["Methanol에 너무 오래 두거나 membrane을 건조시키는 것"],
      troubleshooting: ["젖지 않는 영역이 있으면 새 membrane으로 교체한다."],
      troubleshootingItems: [],
      successCriteria: ["마른 반점 없이 membrane 전체가 균일하게 젖어 있어야 한다."],
      sourceRefs: [imageRef, audioRef],
      confidence: 0.98,
      unresolved: false,
    },
    {
      id: "example-step-3",
      order: 3,
      title: "Wet transfer",
      action: "Gel과 PVDF membrane을 transfer cassette에 조립하고 90 V로 transfer한다.",
      materials: ["Transfer buffer", "Filter paper", "Sponge", "PVDF membrane"],
      equipment: ["Wet transfer tank", "Power supply", "Ice pack"],
      parameters: [
        parameter("전압", "90", "V", [audioRef, pdfRef, imageRef]),
        parameter("시간", "90", "min", [audioRef, pdfRef, imageRef]),
        parameter("Ice pack 교체", "45", "min 시점", [audioRef, imageRef]),
      ],
      duration: "90 min",
      checkpoints: ["Cassette 내부 기포 제거", "전극 방향 확인", "45분에 ice pack 교체"],
      implicitTips: ["Roller를 중앙에서 바깥쪽으로 밀어 기포를 제거한다."],
      commonMistakes: ["Gel과 membrane 방향을 반대로 조립하는 것"],
      troubleshooting: ["약한 밴드는 primary 농도 변경 전에 transfer 상태를 확인한다."],
      troubleshootingItems: [
        {
          problem: "전체 밴드가 약함",
          cause: "불완전한 transfer 또는 cassette 내부 기포",
          action: "Ponceau S 결과와 transfer 방향, 기포 흔적을 먼저 확인한다.",
          sourceRefs: [troubleRef, audioRef],
        },
      ],
      successCriteria: ["Transfer 중 과열이 없고 membrane에 기포 자국이 없어야 한다."],
      sourceRefs: [audioRef, pdfRef, imageRef, troubleRef],
      confidence: 0.99,
      unresolved: false,
    },
    {
      id: "example-step-4",
      order: 4,
      title: "Ponceau S transfer 확인",
      action: "Membrane을 Ponceau S 용액에 5분간 담가 단백질 transfer 패턴을 확인한다.",
      materials: ["Ponceau S", "DI water"],
      equipment: ["Rocking platform"],
      parameters: [parameter("염색", "5", "min", [imageRef, pdfRef])],
      duration: "5-10 min",
      checkpoints: ["Lane별 단백질 패턴과 기포 형태의 공백 확인"],
      implicitTips: ["세척 전 이미지를 촬영해 실행 기록에 남긴다."],
      commonMistakes: ["확인 사진 없이 완전히 탈색하는 것"],
      troubleshooting: ["빈 원형 영역이 보이면 transfer cassette의 기포를 의심한다."],
      troubleshootingItems: [],
      successCriteria: ["모든 lane에서 연속적인 단백질 패턴이 확인되어야 한다."],
      sourceRefs: [imageRef, pdfRef],
      confidence: 0.97,
      unresolved: false,
    },
    {
      id: "example-step-5",
      order: 5,
      title: "BSA blocking",
      action: "Membrane을 5% BSA in TBST 용액에 넣어 실온에서 흔들어 반응시킨다.",
      materials: ["5% BSA in TBST"],
      equipment: ["Rocking platform"],
      parameters: [
        parameter("Blocking", "60", "min · RT", [noteRef, imageRef]),
        parameter("흔들기", "70", "rpm", [imageRef]),
      ],
      duration: "60 min",
      checkpoints: ["Membrane 전체가 blocking 용액에 잠겨 있는지 확인"],
      implicitTips: ["Phospho-target에는 새로 조제한 BSA 용액을 사용한다."],
      commonMistakes: ["Membrane이 용기 벽에 붙어 일부 면이 노출되는 것"],
      troubleshooting: ["Background가 높으면 BSA 조제일과 보관 상태를 확인한다."],
      troubleshootingItems: [
        {
          problem: "높은 background",
          cause: "오래된 blocking 용액 또는 불충분한 세척",
          action: "새 BSA 용액을 준비하고 wash 시간을 5분 늘려 비교한다.",
          sourceRefs: [troubleRef, noteRef],
        },
      ],
      successCriteria: ["Membrane이 마르지 않고 blocking 용액에 균일하게 노출되어야 한다."],
      sourceRefs: [noteRef, imageRef, troubleRef],
      confidence: 0.98,
      unresolved: false,
    },
    {
      id: "example-step-6",
      order: 6,
      title: "Primary antibody 반응",
      action: "Anti-pERK primary antibody를 1:2000으로 희석해 membrane과 4°C에서 반응시킨다.",
      materials: ["Anti-pERK primary antibody", "5% BSA in TBST"],
      equipment: ["4°C cold room 또는 refrigerator", "Rocking platform"],
      parameters: [
        parameter("희석배수", "1:2000", "", [noteRef, imageRef]),
        parameter("반응", "overnight", "4°C", [noteRef, imageRef]),
      ],
      duration: "12-18 h",
      checkpoints: ["항체 lot A24-071과 희석 기록 확인"],
      implicitTips: ["용액량은 membrane이 자유롭게 움직일 정도로 유지한다."],
      commonMistakes: ["Target 확인 없이 다른 항체의 검증 희석배수를 그대로 적용하는 것"],
      troubleshooting: ["예상 위치 외 밴드는 항체 specificity와 sample preparation을 확인한다."],
      troubleshootingItems: [],
      successCriteria: ["반응 종료까지 membrane이 완전히 젖어 있어야 한다."],
      sourceRefs: [noteRef, imageRef],
      confidence: 0.98,
      unresolved: false,
    },
    {
      id: "example-step-7",
      order: 7,
      title: "Primary 후 TBST 세척",
      action: "Membrane을 새 TBST로 5분씩 3회 세척한다.",
      materials: ["TBST"],
      equipment: ["Rocking platform", "Timer"],
      parameters: [
        parameter("세척", "3 × 5", "min", [noteRef, imageRef]),
        parameter("흔들기", "70", "rpm", [imageRef]),
      ],
      duration: "15 min",
      checkpoints: ["매 회차 새 TBST로 교환"],
      implicitTips: ["용기 모서리에 남은 항체 용액도 함께 제거한다."],
      commonMistakes: ["한 용액을 교환하지 않고 15분 연속 세척하는 것"],
      troubleshooting: ["Background가 높았던 run은 각 세척을 10분으로 연장해 기록한다."],
      troubleshootingItems: [],
      successCriteria: ["세척액에 눈에 띄는 거품이나 BSA 침전이 없어야 한다."],
      sourceRefs: [noteRef, imageRef, troubleRef],
      confidence: 0.97,
      unresolved: false,
    },
    {
      id: "example-step-8",
      order: 8,
      title: "Secondary antibody 반응",
      action: "Anti-rabbit HRP secondary antibody를 1:5000으로 희석해 실온에서 반응시킨다.",
      materials: ["Anti-rabbit HRP secondary antibody", "5% BSA in TBST"],
      equipment: ["Rocking platform"],
      parameters: [
        parameter("희석배수", "1:5000", "", [imageRef]),
        parameter("반응", "60", "min · RT", [imageRef]),
      ],
      duration: "60 min",
      checkpoints: ["Secondary lot S24-033과 실온 시작·종료 시각 기록"],
      implicitTips: ["빛과 열원에서 떨어진 위치에서 반응시킨다."],
      commonMistakes: ["Primary host species와 맞지 않는 secondary를 사용하는 것"],
      troubleshooting: ["신호가 전혀 없으면 primary-secondary 조합부터 확인한다."],
      troubleshootingItems: [],
      successCriteria: ["Membrane이 용액에 균일하게 노출되어야 한다."],
      sourceRefs: [imageRef],
      confidence: 0.95,
      unresolved: false,
    },
    {
      id: "example-step-9",
      order: 9,
      title: "Secondary 후 TBST 세척",
      action: "Membrane을 새 TBST로 10분씩 3회 세척한다.",
      materials: ["TBST"],
      equipment: ["Rocking platform", "Timer"],
      parameters: [parameter("세척", "3 × 10", "min", [imageRef])],
      duration: "30 min",
      checkpoints: ["마지막 세척 직후 ECL 단계로 이동"],
      implicitTips: ["노출 준비를 세척 종료 전에 완료해 membrane 건조를 방지한다."],
      commonMistakes: ["마지막 세척 후 membrane을 트레이 밖에 방치하는 것"],
      troubleshooting: ["Background가 높으면 세척 용량과 platform 속도를 확인한다."],
      troubleshootingItems: [],
      successCriteria: ["마지막 세척 후 membrane 표면에 침전이 없어야 한다."],
      sourceRefs: [imageRef, troubleRef],
      confidence: 0.97,
      unresolved: false,
    },
    {
      id: "example-step-10",
      order: 10,
      title: "ECL 반응 및 이미지 획득",
      action: "ECL reagent A와 B를 1:1로 혼합해 membrane에 2분간 반응시킨다.",
      materials: ["ECL reagent A", "ECL reagent B"],
      equipment: ["Chemiluminescence imager"],
      parameters: [
        parameter("ECL 혼합", "1:1", "", [imageRef, pdfRef]),
        parameter("반응", "2", "min", [imageRef]),
        parameter("노출", "10 / 30 / 60", "sec", [imageRef]),
      ],
      duration: "약 8 min",
      checkpoints: ["10초 노출부터 포화 여부 확인 후 30초와 60초 순서로 획득"],
      implicitTips: ["동일 membrane의 비교 이미지는 같은 contrast 범위로 저장한다."],
      commonMistakes: ["첫 이미지부터 장시간 노출해 밴드를 포화시키는 것"],
      troubleshooting: ["약한 신호는 transfer와 Ponceau 기록을 먼저 검토한다."],
      troubleshootingItems: [
        {
          problem: "밴드 포화",
          cause: "과도한 노출 시간",
          action: "10초 노출 이미지로 돌아가 포화되지 않은 조건을 선택한다.",
          sourceRefs: [imageRef],
        },
      ],
      successCriteria: ["pERK 약 44 kDa 위치의 밴드가 포화되지 않은 노출에서 구분되어야 한다."],
      sourceRefs: [imageRef, pdfRef, troubleRef],
      confidence: 0.98,
      unresolved: false,
    },
  ];

  const snapshot: ProtocolSnapshot = {
    experiment: {
      title: "Phospho-ERK Western blot 검출 프로토콜",
      objective:
        "신경세포 단백질 시료에서 phospho-ERK 신호를 재현성 있게 검출하고, transfer 품질과 노출 조건을 단계별로 기록한다.",
      scope:
        "10% SDS-PAGE에서 분리한 신경세포 lysate와 0.45 μm PVDF membrane을 사용하는 wet transfer 조건에 적용한다.",
      category: "experiment",
    },
    materials: [
      "10% SDS-PAGE gel",
      "단백질 시료 20 μg/lane",
      "PVDF membrane 0.45 μm",
      "Transfer buffer",
      "Ponceau S",
      "5% BSA in TBST",
      "Anti-pERK primary antibody",
      "Anti-rabbit HRP secondary antibody",
      "ECL reagent A/B",
    ],
    equipment: [
      "SDS-PAGE 전기영동 장치",
      "Wet transfer tank 및 power supply",
      "Rocking platform 70 rpm",
      "Chemiluminescence imager",
    ],
    preflightChecklist: [
      "Primary lot A24-071과 secondary lot S24-033 확인",
      "Ice pack 2개를 완전히 냉동하고 transfer buffer를 예냉",
      "ECL 촬영 폴더와 파일명 규칙 준비",
      "Membrane을 건조시키지 않도록 단계 간 용액을 미리 준비",
    ],
    steps,
    resultAcceptance: {
      pass: [
        "Ponceau S에서 모든 lane의 연속적인 transfer 패턴이 확인된다.",
        "약 44 kDa의 pERK 밴드가 포화되지 않은 노출에서 분리된다.",
        "대조 lane과 실험 lane을 동일한 노출 조건으로 비교할 수 있다.",
      ],
      repeat: [
        "기포 형태의 transfer 공백이 있거나 일부 lane만 현저히 약하다.",
        "모든 노출에서 신호가 포화되어 정량 범위를 확보하지 못했다.",
      ],
      discard: [
        "Membrane이 건조되었거나 전극 방향 오류로 단백질이 반대 방향으로 이동했다.",
        "시료·항체 lot 기록이 없어 결과의 추적성을 확보할 수 없다.",
      ],
    },
    conflicts: [],
    missingFields: [],
    sources,
    overallWarnings: [
      "실제 실행 전 항체 제조사 데이터시트와 연구실의 최신 lot 검증 기록을 확인한다.",
    ],
  };
  const protocol: Protocol = {
    id: protocolId,
    labId,
    title: snapshot.experiment.title,
    objective: snapshot.experiment.objective,
    category: "experiment",
    status: "review",
    currentVersion: 1,
    tags: ["Western blot", "pERK", "PVDF", "예시"],
    createdBy: "Neural Systems Lab",
    createdAt: now,
    updatedAt: now,
  };
  return { protocol, snapshot, excerpts };
}
