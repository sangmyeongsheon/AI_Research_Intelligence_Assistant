import type { Lab } from "@/src/types";
import { DEMO_LAB_ID } from "@/src/lib/demo";
import { PRODUCT_CONFIG } from "@/src/config/product";

export interface Department {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  color: string;
  order: number;
}

// 첨부된 맥 버전의 디렉터리 데이터를 현재 LabTrace의 화면 구조에 맞게
// 재사용한다. 이 목록은 사용자가 제공한 자료를 기준으로 하며 실시간 학사
// 명부나 공식 권한 데이터로 취급하지 않는다.

export const DEPT_CHEM_PHYSICS = "dept-chemistry-physics";
export const DEPT_EECS = "dept-eecs";
export const DEPT_ROBOTICS = "dept-robotics";
export const DEPT_ENERGY = "dept-energy";
export const DEPT_BRAIN_SCIENCES = "dept-brain-sciences";
export const DEPT_NEW_BIOLOGY = "dept-new-biology";

export function buildDepartments(): Department[] {
  return [
    {
      id: DEPT_CHEM_PHYSICS,
      name: "화학물리학과",
      nameEn: "Chemistry and Physics",
      description: "물질의 구조와 반응을 화학·물리 관점에서 연구하는 학과입니다. 연구실 목록은 제공된 자료를 반영했습니다.",
      color: "#315CEB",
      order: 1,
    },
    {
      id: DEPT_EECS,
      name: "전기전자컴퓨터공학과",
      nameEn: "Electrical Engineering and Computer Science",
      description: "전자·통신·컴퓨터 시스템을 아우르는 공학 연구 학과입니다. 연구실 목록은 제공된 자료를 반영했습니다.",
      color: "#137A55",
      order: 2,
    },
    {
      id: DEPT_ROBOTICS,
      name: "로봇및기계전자공학과",
      nameEn: "Robotics and Mechatronics Engineering",
      description: "로봇 시스템과 기계·전자 융합 기술을 연구하는 학과입니다. 연구실 목록은 제공된 자료를 반영했습니다.",
      color: "#B7791F",
      order: 3,
    },
    {
      id: DEPT_ENERGY,
      name: "에너지공학과",
      nameEn: "Energy Science and Engineering",
      description: "차세대 에너지 소재·시스템을 연구하는 학과입니다. 연구실 목록은 제공된 자료를 반영했습니다.",
      color: "#B42318",
      order: 4,
    },
    {
      id: DEPT_BRAIN_SCIENCES,
      name: "뇌과학과",
      nameEn: "Brain Sciences",
      description:
        "뇌와 신경계의 구조·기능을 분자부터 시스템 수준까지 연구하는 학과입니다. Neural Systems Lab의 프로토콜 작업 공간이 연결되어 있습니다.",
      color: "#0B1739",
      order: 5,
    },
    {
      id: DEPT_NEW_BIOLOGY,
      name: "뉴바이올로지학과",
      nameEn: "New Biology",
      description: "융합 생명과학 기술로 새로운 생물학적 문제를 다루는 학과입니다. 연구실 목록은 제공된 자료를 반영했습니다.",
      color: "#6941C6",
      order: 6,
    },
  ];
}

interface LabSeed {
  id: string;
  name: string;
  shortName: string;
  pi: string;
  field: string;
}

function splitResearchAreas(field: string): string[] {
  return field
    .split(/[,、]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}

interface LabProfileOverride {
  intro: string;
  researchAreas: string[];
  profileBody: string;
}

// 제공받은 실제 소개 자료로 채운 연구실 공개 프로필. id가 일치하는 연구실에만 적용된다.
const LAB_PROFILE_OVERRIDES: Record<string, LabProfileOverride> = {
  "lab-brain-locomotor": {
    intro: "척수와 뇌의 신경회로가 걷기와 같은 반복적인 운동을 어떻게 생성하고 조절하는지 연구하는 연구실입니다.",
    researchAreas: ["운동 신경회로와 보행 조절", "척수 인터뉴런과 운동신경세포", "신경회로 발생 및 신경분화", "제브라피시 신경생물학", "성상교세포와 운동회로의 상호작용"],
    profileBody:
      "동물이 걷거나 뛰는 동안 운동신경세포는 일정한 순서와 리듬에 따라 활성화된다. 백명인 교수 연구실은 감각신경, 척수 내 인터뉴런, 운동신경 및 뇌에서 내려오는 하행성 신호가 어떻게 상호작용하여 이러한 운동 패턴을 만들어 내는지 연구한다. 특히 제브라피시 등의 동물모델을 이용하여 운동 신경회로의 발생, 연결 구조 및 기능을 분석한다. 공식 연구실 소개에서도 운동신경의 리드미컬한 활동이 감각 입력, 국소 인터뉴런 및 상위 중추의 입력에 의해 결정된다고 설명한다.\n\n최근 연구 방향: 성상교세포가 스트레스 상황에서 신경계와 운동 기능을 조절하는 과정, 그리고 뇌 발달 과정에서 단백질 번역 조절인자인 eIF3α가 신경세포 분화에 미치는 영향 등이 연구되고 있다.",
  },
  "lab-brain-molecular-psychiatry": {
    intro: "스트레스, 우울증, 중독과 같은 정신질환이 뇌의 분자와 신경회로를 어떻게 변화시키는지 연구하는 연구실입니다.",
    researchAreas: ["우울증과 스트레스", "도파민·세로토닌 신호", "약물중독과 보상회로", "정서 및 동기 행동", "정신질환의 분자적 기전", "단일세포 전사체 및 신경회로 분석"],
    profileBody:
      "오용석 교수 연구실은 스트레스와 환경적 경험이 뇌 기능에 장기적인 변화를 일으키는 과정을 분자·세포·회로 수준에서 연구한다. 특히 도파민과 세로토닌을 포함한 신경조절물질이 감정, 보상, 동기 및 정신질환 관련 행동에 미치는 영향에 관심을 둔다. 동물 행동실험과 분자생물학, 신경회로 조절기술을 결합하여 정신질환의 발병기전을 밝히고 새로운 치료 표적을 찾는 것을 목표로 한다. DGIST는 오용석 교수의 연구분야를 Molecular Psychiatry로 분류하고 있다.\n\n최근 논문의 핵심 범주: 스트레스에 따른 뇌 신경회로 변화, 세로토닌·도파민 수용체 기능, 우울 및 보상행동의 신경생물학적 기전, 정신질환 관련 세포유형별 유전자 발현 변화.",
  },
  "lab-brain-neurobehavior": {
    intro: "유전자와 신경회로가 감각, 학습 및 행동을 만들어 내는 원리를 연구하는 연구실입니다.",
    researchAreas: ["신경행동학", "신경회로", "신경발생", "신경유전학", "감각정보 처리", "행동 가소성 및 적응"],
    profileBody:
      "김규형 교수 연구실은 신경세포의 발생과 연결이 동물의 행동으로 이어지는 과정을 연구한다. 비교적 단순한 신경계를 가진 모델동물을 이용하여 특정 유전자와 신경세포가 감각정보 처리, 행동 선택, 학습 및 적응에 어떤 역할을 하는지 분석한다. 분자유전학, 신경영상, 행동분석 및 신경회로 조절기술을 결합해 유전자–신경회로–행동 사이의 관계를 규명한다. DGIST Scholar에는 김규형 교수의 관심 분야가 Neurobehavior, Neural Circuit, Neurodevelopment, Neurogenetics로 제시돼 있다.\n\n대표적인 연구 접근법: 예쁜꼬마선충 등 모델동물, 유전자 변이 및 세포 특이적 조절, 칼슘 이미징, 행동 추적, 광유전학·화학유전학.",
  },
  "lab-brain-neurometabolism": {
    intro: "뇌가 식욕과 에너지 소비를 조절하는 원리와 비만·당뇨가 뇌 기능에 미치는 영향을 연구합니다.",
    researchAreas: ["시상하부와 식욕 조절", "비만과 당뇨", "인슐린·렙틴 신호", "자가포식과 세포 대사", "대사질환과 알츠하이머병", "신경염증"],
    profileBody:
      "김은경 교수 연구실은 신경세포가 영양상태와 대사 신호를 감지하여 식욕, 체중, 에너지 소비 및 혈당을 조절하는 원리를 연구한다. 특히 시상하부를 중심으로 대사호르몬과 신경회로의 상호작용을 분석하고, 비만과 당뇨 같은 대사질환이 뇌 기능 및 퇴행성 뇌질환에 미치는 영향을 탐구한다. DGIST Scholar는 김은경 교수의 연구관심을 대사질환에서의 신경기능, 뇌신경세포와 비만·당뇨의 관계로 소개한다.\n\n최근 연구 방향: 뇌 대사 이상과 알츠하이머병의 연결, 자가포식 이상에 의한 신경세포 기능 저하, 비만 및 당뇨 환경에서의 신경회로 변화.",
  },
  "lab-brain-neuronal-cell-death": {
    intro: "신경세포가 손상되고 죽는 과정을 규명하여 치매와 신경퇴행성 질환의 치료법을 찾는 연구실입니다.",
    researchAreas: ["신경세포 사멸", "신경염증", "오토파지", "알츠하이머병", "파킨슨병", "단백질 항상성과 세포 스트레스"],
    profileBody:
      "유성운 교수 연구실은 신경세포 사멸과 신경퇴행이 어떤 분자적 과정에 의해 발생하는지 연구한다. 신경세포가 스트레스, 염증 및 단백질 이상에 반응하는 과정과 오토파지·세포사멸 경로 사이의 관계를 분석한다. 이를 통해 알츠하이머병, 파킨슨병 및 기타 신경퇴행성 질환에서 신경세포를 보호할 수 있는 치료 표적을 찾는 것을 목표로 한다. 공식 연구자 정보에는 연구분야가 \"신경세포 사멸 및 신경퇴행의 분자적 기전\"으로 제시되어 있다.\n\n최근 논문을 묶을 범주: 오토파지와 신경세포 보호, 염증성 신호와 신경퇴행, 비정상 단백질 축적, 신경세포 사멸 억제 후보물질.",
  },
  "lab-brain-optical-neurophysiology": {
    intro: "빛을 이용해 신경세포와 시냅스의 활동을 관찰하고 조절하는 광학 기반 신경생리학 연구실입니다.",
    researchAreas: ["광유전학", "형광 단백질 센서", "시냅스 가소성", "학습과 기억", "단백질 이동 및 상호작용", "고해상도 신경영상"],
    profileBody:
      "박포정 교수 연구실은 광유전학, 형광 바이오센서 및 고해상도 이미징 기술을 이용하여 살아 있는 신경세포의 활동을 측정한다. 특히 학습과 기억 과정에서 시냅스의 수용체와 단백질이 어떻게 이동하고 변화하는지, 그리고 이러한 변화가 신경회로 기능에 어떤 영향을 주는지 연구한다. 필요한 경우 새로운 단백질 센서나 광학 측정기술 자체도 개발한다. 박포정 교수는 신경생리학과 광학 기반 뇌 연구를 수행하며, Harvard University에서 전기·전자공학 분야 박사후연구를 거친 뒤 DGIST에 합류했다.\n\n주요 연구기술: 2광자 현미경, 단분자 및 초해상도 이미징, 형광 바이오센서, 전기생리학, 광학적 신경회로 조절.",
  },
  "lab-brain-protein-biophysics": {
    intro: "단백질이 접히고 움직이며 다른 분자와 결합하는 과정을 물리·화학 및 계산기법으로 연구합니다.",
    researchAreas: ["단백질 접힘", "단백질 구조와 동역학", "단백질–단백질 상호작용", "수소교환 분석", "단백질 구조 예측", "계산생물학·계산신경과학", "AI 기반 단백질 분석"],
    profileBody:
      "유우경 교수 연구실은 단백질의 구조가 고정된 하나의 모양이 아니라 시간에 따라 변화하는 동적인 체계라는 관점에서 연구한다. 단백질 접힘, 구조 변화, 분자 간 상호작용을 실험 및 계산적으로 분석하고, 이러한 변화가 신경계 기능과 질환에 어떤 영향을 주는지 탐구한다. 단백질 구조 예측과 계산신경과학도 연구영역에 포함된다. 공식 연구실 소개에는 단백질 접힘과 운동, 구조 변화 및 계산신경과학이 핵심 분야로 명시돼 있다.\n\n다른 연구실과의 차이: 이 연구실은 동물의 행동이나 특정 신경회로보다 단백질의 물리적 구조와 움직임 자체에 더 집중한다.",
  },
  "lab-brain-synapse-circuits-dynamics": {
    intro: "시냅스가 신호를 전달하고 변화하는 과정이 신경회로와 인지기능을 어떻게 조절하는지 연구합니다.",
    researchAreas: ["시냅스 전달", "신경망 연결성", "시냅스 가소성", "신경조절물질", "신경회로 동역학", "학습과 기억"],
    profileBody:
      "김민환 교수 연구실은 신경세포 사이의 연결부인 시냅스에서 신호가 전달되는 과정과, 경험 및 신경조절물질에 의해 시냅스의 강도와 연결성이 변화하는 원리를 연구한다. 개별 시냅스의 변화가 신경망의 활동과 학습, 기억 및 인지기능으로 어떻게 이어지는지 밝히는 것이 핵심 목표다. DGIST는 김민환 교수의 연구관심을 시냅스 전달, 시냅스 및 신경망 연결성, 신경조절물질에 의한 시냅스·네트워크 변화로 소개한다.\n\n주요 연구기술: 뇌 절편 및 생체 전기생리학, 패치클램프, 광유전학, 칼슘 이미징, 신경회로 추적.",
  },
  "lab-brain-synapse-disorder": {
    intro: "시냅스 연결 이상이 자폐스펙트럼장애와 알츠하이머병 등 뇌질환으로 이어지는 과정을 연구합니다.",
    researchAreas: ["시냅스 형성 및 유지", "시냅스 접착단백질", "자폐스펙트럼장애", "알츠하이머병", "뇌전증", "신경발달질환"],
    profileBody:
      "엄지원 교수 연구실은 신경세포 사이의 시냅스가 형성되고 유지되는 분자적 원리를 연구한다. 특히 시냅스 접착단백질의 이상이 신경회로 연결과 행동에 어떤 문제를 일으키는지 분석하며, 이를 자폐스펙트럼장애, 뇌전증 및 알츠하이머병과 연결하여 연구한다. 엄지원 교수는 DGIST 뇌과학과에서 시냅스 질환 연구를 수행하고 있으며, 고재원 교수팀과 함께 뇌 세포 사이의 소통과 시냅스 형성을 조절하는 분자기전에 관한 연구를 발표해 왔다.\n\n최근 연구 방향: MDGA 단백질이 신경세포 연결을 조절하는 원리, 시냅스 단백질 변이가 자폐 관련 행동에 미치는 영향, 뇌 세포 간 상호작용을 조절하는 분자 네트워크.",
  },
  "lab-brain-synapse-diversity": {
    intro: "수많은 신경세포가 정확한 상대와 시냅스를 형성하도록 만드는 '분자 코드'를 연구합니다.",
    researchAreas: ["시냅스 접착단백질", "시냅스 다양성과 특이성", "Neurexin 및 PTPδ", "흥분성·억제성 시냅스", "자폐 및 신경발달질환", "액체–액체 상분리와 시냅스 단백질"],
    profileBody:
      "고재원 교수 연구실은 뇌의 신경세포들이 어떤 분자를 이용해 서로를 인식하고 선택적으로 연결되는지 연구한다. 특히 neurexin, PTPδ, MDGA 등 시냅스 접착단백질이 흥분성·억제성 시냅스의 형성, 기능 및 다양성을 결정하는 원리를 규명한다. 이러한 분자기전이 자폐스펙트럼장애, 지적장애 및 기타 신경발달질환과 어떻게 연결되는지도 연구한다. 고재원 교수의 연구 키워드에는 synaptic adhesion, neurexin, excitatory synapse, neural circuit, PTPδ 등이 포함된다.\n\n최근 연구 방향: 2024년에는 MDGA 단백질이 신경 연결을 조절하는 분자기전과, 뇌 세포 간 소통방식을 정리한 연구가 주요 연구성과로 소개됐다.",
  },
};

function buildLabsFromSeed(seeds: LabSeed[], departmentId: string): Lab[] {
  const now = new Date().toISOString();
  return seeds.map((seed) => {
    const override = LAB_PROFILE_OVERRIDES[seed.id];
    return {
      id: seed.id,
      departmentId,
      name: seed.name,
      shortName: seed.shortName,
      field: seed.field,
      pi: seed.pi,
      description: "아직 등록된 프로토콜이 없습니다.",
      isDemo: false,
      createdAt: now,
      updatedAt: now,
      intro: override?.intro ?? `${seed.pi} 연구실로, ${seed.field}를 연구합니다.`,
      researchAreas: override?.researchAreas ?? splitResearchAreas(seed.field),
      profileBody: override?.profileBody,
      isProfilePublic: true,
    };
  });
}

type ChemPhysicsLabSeed = LabSeed;

const CHEM_PHYSICS_LABS: ChemPhysicsLabSeed[] = [
  { id: "lab-chem-xlab", name: "Xlab", shortName: "Xlab", pi: "이신범 교수", field: "반도체·에너지·센서용 기능성 나노소재 및 박막" },
  { id: "lab-chem-sqpl", name: "Semiconductor Quantum Photonics Lab", shortName: "SQPL", pi: "조창희 교수", field: "반도체 나노포토닉스, 양자광학, 광-물질 상호작용" },
  { id: "lab-chem-cmtg", name: "Computational Materials Theory Group", shortName: "CMTG", pi: "강준구 교수", field: "계산재료과학, DFT, 머신러닝, 생성형 AI 기반 소재설계" },
  { id: "lab-chem-aosds", name: "Asymmetric Organic Synthesis & Drug Synthesis Lab", shortName: "AOSDS Lab", pi: "정병혁 교수", field: "비대칭 유기합성, 촉매, 의약품 합성" },
  { id: "lab-chem-oihl", name: "OIHL", shortName: "OIHL", pi: "박진희 교수", field: "MOF/MOP/MOA 기반 다공성 기능성 소재" },
  { id: "lab-chem-scl", name: "Sustainable Chemistry Lab", shortName: "SCL", pi: "김성균 교수", field: "지속가능 화학, 플라스틱 업사이클링, 수처리·담수화" },
  { id: "lab-chem-snt", name: "Spin NanoTech Lab", shortName: "SNT Lab", pi: "홍정일 교수", field: "스핀트로닉스, 나노소재, 자기·전자 물성" },
  { id: "lab-chem-tqd", name: "Topological Quantum Device Lab", shortName: "TQD Lab", pi: "김영욱 교수", field: "위상 양자소자, 2D 물질, 양자회로" },
  { id: "lab-chem-nqm", name: "Novel Quantum Materials Laboratory", shortName: "NQM Lab", pi: "박기성 교수", field: "초전도체, 위상물질, 양자물질 합성" },
  { id: "lab-chem-bom", name: "Bioinspired Organic Materials Laboratory", shortName: "BOM Lab", pi: "홍선기 교수", field: "생체모사 소재, 바이오소재, 의료공학" },
  { id: "lab-chem-qmbt", name: "Quantum Many-Body Theory Group", shortName: "QMBT Group", pi: "김아람 교수", field: "양자다체계 이론, 강상관계 물질" },
  { id: "lab-chem-osc", name: "Organic Synthesis & Catalysis Lab", shortName: "OSC Lab", pi: "이성기 교수", field: "유기합성, 촉매, 유기반응 개발" },
  { id: "lab-chem-nclamc", name: "NC Laboratory of Advanced Inorganic Materials Chemistry", shortName: "NC Lab", pi: "정낙천 교수", field: "MOF 기반 무기소재화학" },
  { id: "lab-chem-femto", name: "FemtoLab for Advanced Energy Materials", shortName: "FemtoLab", pi: "성주영 교수", field: "차세대 에너지 소재, 초고속 분광학" },
  { id: "lab-chem-nbe", name: "NanoBioEngineering & Spintronics Lab", shortName: "NBE Lab", pi: "김철기 교수", field: "바이오센서, 스핀트로닉스, 나노바이오공학" },
  { id: "lab-chem-spin", name: "Spin Phenomena for Information Nano-devices Lab", shortName: "SPIN Lab", pi: "유천열 교수", field: "차세대 메모리·논리소자용 스핀트로닉스" },
  { id: "lab-chem-ltm", name: "Low-dimensional Topological Matter Laboratory", shortName: "LTM Lab", pi: "서정필 교수", field: "저차원 위상물질, STM 기반 양자물성" },
  { id: "lab-chem-qdi", name: "Quantum Dynamics & Information Laboratory", shortName: "QDI Lab", pi: "이재동 교수", field: "계산물리, DFT, 양자동역학" },
  { id: "lab-chem-bhd", name: "BHD Lab", shortName: "BHD Lab", pi: "이성원 교수", field: "웨어러블·전자피부·생체조화 센서" },
  { id: "lab-chem-cdsc", name: "Chemical Design & Sustainable Catalysis Labs", shortName: "CDSC Labs", pi: "서상원 교수", field: "친환경 촉매, 유기합성, 지속가능 화학" },
  { id: "lab-chem-rmsd", name: "Reaction Mechanism & Structural Dynamics Lab", shortName: "RMSD Lab", pi: "김종구 교수", field: "반응 메커니즘, 시간분해 X-ray, MD·ML" },
  { id: "lab-chem-cms", name: "Correlated Matter Spectroscopy Lab", shortName: "CMS Lab", pi: "김소연 교수", field: "강상관 물질, 초고속 분광학" },
  { id: "lab-chem-misc", name: "Molecular Inorganic Synthesis & Catalysis Lab", shortName: "MISC Lab", pi: "문혜원 교수", field: "무기합성, 유기금속 촉매" },
];

function buildChemPhysicsLabs(): Lab[] {
  return buildLabsFromSeed(CHEM_PHYSICS_LABS, DEPT_CHEM_PHYSICS);
}

const EECS_LABS: LabSeed[] = [
  { id: "lab-eecs-advanced-devices", name: "첨단전자소자 그룹", shortName: "첨단전자소자", pi: "권혁준 교수", field: "차세대 반도체 소자, 전자소재, 반도체 공정(FEOL/BEOL), 레이저 열공정" },
  { id: "lab-eecs-next-experience", name: "차세대 경험 및 기술 연구실", shortName: "차세대 경험기술", pi: "길현재 교수", field: "VR·AR·MR, HCI, 다중감각 인터페이스, 사용자 경험(UX), 로봇 시뮬레이션" },
  { id: "lab-eecs-signal-circuits", name: "신호처리 회로 및 시스템 연구실", shortName: "신호처리 회로", pi: "김가인 교수", field: "아날로그·혼성신호 회로, ADC/DAC, 초고속 인터페이스, 반도체 회로설계" },
  { id: "lab-eecs-ai-se", name: "인공지능 소프트웨어공학 연구실", shortName: "AI SE Lab", pi: "김기섭 교수", field: "LLM, AI for Software Engineering, 코드 생성·리뷰, 제조 AI, 모델 경량화" },
  { id: "lab-eecs-dependable-sw", name: "고신뢰성 소프트웨어 시스템 연구실", shortName: "고신뢰 SW", pi: "김백규 교수", field: "소프트웨어 검증, 디지털 트윈, 자율주행 안전성, 클라우드·IoT, 분산컴퓨팅" },
  { id: "lab-eecs-smart-input", name: "스마트 입력장치 연구실", shortName: "스마트 입력장치", pi: "김선준 교수", field: "HCI, 스마트 입력장치, 아날로그 키보드, 사용자 인터랙션, 입력장치 최적화" },
  { id: "lab-eecs-privacy-crypto", name: "프라이버시 및 응용 암호 연구실", shortName: "프라이버시·암호", pi: "김영식 교수", field: "동형암호, 양자내성암호(PQC), Secure Multi-Party Computation, 개인정보 보호" },
  { id: "lab-eecs-dependable-systems", name: "무결점시스템 연구실", shortName: "무결점시스템", pi: "김윤승 교수", field: "정형 검증(Formal Verification), 소프트웨어 신뢰성, AI 안전성 검증" },
  { id: "lab-eecs-multimodal-nlp", name: "자연어 기반 멀티모달 지능 연구실", shortName: "멀티모달 지능", pi: "목지수 교수", field: "LLM, 멀티모달 AI, AI 에이전트, 정보검색(IR), 대화형 AI" },
  { id: "lab-eecs-cps", name: "사이버물리시스템 통합 연구실", shortName: "CPS 통합", pi: "박경준 교수", field: "자율이동로봇(AMR), ROS2, 예지보전, 산업 AI, 사이버물리시스템(CPS)" },
];

function buildEecsLabs(): Lab[] {
  return buildLabsFromSeed(EECS_LABS, DEPT_EECS);
}

const ROBOTICS_LABS: LabSeed[] = [
  { id: "lab-robotics-biohybrid", name: "생체융합 로보틱스 연구실", shortName: "생체융합 로보틱스", pi: "송석호 교수", field: "생체모사 로봇, 소프트 로봇, 소프트 그리퍼, 웨어러블 센서" },
  { id: "lab-robotics-medical-multiscale", name: "멀티스케일 의료로봇 연구실", shortName: "멀티스케일 의료로봇", pi: "박석호 교수", field: "마이크로·나노로봇, 의료로봇, 메디컬 디바이스" },
  { id: "lab-robotics-surgical", name: "수술 로봇 및 정밀 조작 연구실", shortName: "수술로봇·정밀조작", pi: "황민호 교수", field: "수술로봇, 로봇 조작(Manipulation), 강화학습, 컴퓨터비전, Isaac Sim" },
  { id: "lab-robotics-nano-devices", name: "나노소재 및 소자 연구실", shortName: "나노소재·소자", pi: "김회준 교수", field: "4D 프린팅, 로봇 센서, 가스센서, 반도체 공정" },
  { id: "lab-robotics-bioelectronics", name: "소프트 바이오일렉트로닉스 연구실", shortName: "소프트 바이오일렉트로닉스", pi: "이재홍 교수", field: "웨어러블 센서, 바이오센서, 유연전자소자, 전자피부(E-Skin)" },
  { id: "lab-robotics-imaging-vision", name: "지능형 이미징 및 비전 시스템 연구실", shortName: "지능형 이미징·비전", pi: "문인규 교수", field: "의료영상 AI, 딥러닝, 컴퓨터비전, 영상 위변조 탐지" },
  { id: "lab-robotics-nanophotonics", name: "지능형 나노광학 연구실", shortName: "지능형 나노광학", pi: "한상윤 교수", field: "실리콘 포토닉스, 광반도체, 광 GPU, AR·VR 광학" },
  { id: "lab-robotics-future", name: "미래연구실", shortName: "미래연구실", pi: "김봉훈 교수", field: "로보틱스, 전자소자, 헬스케어, 에너지소자, 나노소재" },
  { id: "lab-robotics-wearable-assist", name: "웨어러블 및 보조로봇 연구실", shortName: "웨어러블·보조로봇", pi: "박준혁 교수", field: "웨어러블 로봇, 엑소슈트, AI 보조로봇, 재활·돌봄 로봇" },
  { id: "lab-robotics-neural-interface", name: "신경인터페이스 및 마이크로시스템 연구실", shortName: "신경인터페이스", pi: "김소희 교수", field: "BCI/BMI, 신경인터페이스, 생체신호, 웨어러블 센서" },
];

function buildRoboticsLabs(): Lab[] {
  return buildLabsFromSeed(ROBOTICS_LABS, DEPT_ROBOTICS);
}

const ENERGY_LABS: LabSeed[] = [
  { id: "lab-energy-biophysics", name: "생물물리 및 연성물질 연구실", shortName: "생물물리·연성물질", pi: "최승호 교수", field: "분자동역학(MD), 세포투과성 펩타이드(CPP), 생물물리, 연성물질, 이온 수송" },
  { id: "lab-energy-molecular-modeling", name: "분자모델링 연구실", shortName: "분자모델링", pi: "장윤희 교수", field: "계산화학, 분자동역학, AI 기반 전산모사, 반도체·에너지·바이오 소재 설계" },
  { id: "lab-energy-polymer-photocatalysis", name: "고분자 광촉매 연구실", shortName: "고분자 광촉매", pi: "김승현 교수", field: "고분자 광촉매, 지속가능 화학, 에너지 소재, 광촉매 반응" },
  { id: "lab-energy-battery-design", name: "배터리 설계 공정 연구실", shortName: "배터리 설계공정", pi: "김진수 교수", field: "전고체전지, 배터리 공정, 전극 설계, 멀티스케일 최적화" },
  { id: "lab-energy-electrochemistry", name: "Electrochemistry Laboratory for Sustainable Energy", shortName: "Electrochemistry Lab", pi: "이호춘 교수", field: "전기화학, 리튬이온전지, 차세대 배터리(Na·K·Mg), 고체전해질" },
  { id: "lab-energy-emdp", name: "EMDP Lab", shortName: "EMDP Lab", pi: "호동해 교수", field: "화학 데이터 마이닝, 딥러닝, 화학 AI, XYZ 데이터 시스템" },
  { id: "lab-energy-nanomaterials", name: "NanoMaterials Laboratory", shortName: "NanoMaterials Lab", pi: "양지웅 교수", field: "양자소재, 양자점(QD), 광전자소자, 웨어러블 전자소자, TEM" },
  { id: "lab-energy-organic-electronics", name: "유기인쇄전자 연구실", shortName: "유기인쇄전자", pi: "이윤구 교수", field: "OLED, QLED, 유기반도체, 플렉시블·스트레처블 전자소자" },
  { id: "lab-energy-battery-materials", name: "배터리 소재 및 에너지 연구실", shortName: "배터리 소재·에너지", pi: "김운혁 교수", field: "리튬이온전지, 전고체전지, 양극·음극 소재, 고체전해질" },
  { id: "lab-energy-catalyst-process", name: "Catalyst and Process Laboratory", shortName: "Catalyst & Process Lab", pi: "김찬연 교수", field: "CO₂ 전환 촉매, 전기화학 촉매, 촉매 설계, 물질전달" },
];

function buildEnergyLabs(): Lab[] {
  return buildLabsFromSeed(ENERGY_LABS, DEPT_ENERGY);
}

const BRAIN_SCIENCES_LABS: LabSeed[] = [
  { id: "lab-brain-synapse-diversity", name: "Center for Synapse Diversity and Specificity", shortName: "Synapse Diversity Center", pi: "고재원 교수", field: "시냅스 생물학, 신경회로 발달, 시냅스 접착단백질, 액체-액체 상분리(LLPS)" },
  { id: "lab-brain-neurobehavior", name: "Laboratory of Neurobehavior and Neural Circuit", shortName: "Neurobehavior·Circuit Lab", pi: "김규형 교수", field: "신경회로, 신경행동, 행동가소성, 행동 조절" },
  { id: "lab-brain-synapse-circuits-dynamics", name: "Laboratory of Synapse and Circuits Dynamics", shortName: "Synapse·Circuits Dynamics", pi: "김민환 교수", field: "시냅스 전달, 신경망 연결성, 신경회로 동역학, 인지기능" },
  { id: "lab-brain-neurometabolism", name: "Laboratory of Neurometabolism", shortName: "Neurometabolism Lab", pi: "김은경 교수", field: "뇌대사, 비만·당뇨, 자가포식(Autophagy), 대사질환" },
  { id: "lab-brain-optical-neurophysiology", name: "Optical Neurophysiology Laboratory", shortName: "Optical Neurophysiology", pi: "박포정 교수", field: "광유전학, 신경생리학, 학습·기억, 단백질 센서" },
  { id: "lab-brain-locomotor", name: "Laboratory of Locomotor NeuroCircuit", shortName: "Locomotor NeuroCircuit", pi: "백명인 교수", field: "운동신경회로, 발생생물학, 제브라피쉬, 운동 조절" },
  { id: "lab-brain-synapse-disorder", name: "Synapse Disorder Laboratory", shortName: "Synapse Disorder Lab", pi: "엄지원 교수", field: "알츠하이머, 자폐, 뇌전증, 시냅스 질환" },
  { id: "lab-brain-molecular-psychiatry", name: "Laboratory of Molecular Psychiatry", shortName: "Molecular Psychiatry Lab", pi: "오용석 교수", field: "정신질환, 스트레스, 도파민·세로토닌, 단일세포 전사체" },
  { id: "lab-brain-neuronal-cell-death", name: "Laboratory of Neuronal Cell Death", shortName: "Neuronal Cell Death Lab", pi: "유성운 교수", field: "신경세포 사멸, 치매, 신경염증, 오토파지" },
  { id: "lab-brain-protein-biophysics", name: "Laboratory of Protein Biophysics", shortName: "Protein Biophysics Lab", pi: "유우경 교수", field: "단백질 시뮬레이션, 계산생물학, AI 기반 뇌과학, 단백질 공진화" },
];

function buildBrainSciencesLabs(): Lab[] {
  return buildLabsFromSeed(BRAIN_SCIENCES_LABS, DEPT_BRAIN_SCIENCES);
}

const NEW_BIOLOGY_LABS: LabSeed[] = [
  { id: "lab-newbio-plant-development", name: "식물발달과 세포 정밀성 연구실", shortName: "식물발달·세포정밀성", pi: "곽준명 교수", field: "식물 발달, 단일세포 분석, 세포 특이적 유전학, 세포 신호전달" },
  { id: "lab-newbio-brain-immune-axis", name: "뇌-면역 축 연구실", shortName: "뇌-면역 축", pi: "구재형 교수", field: "뇌-면역 상호작용, 감염·염증, 암, 치매, 장내미생물" },
  { id: "lab-newbio-cancer-genome", name: "암 신호전달 및 유전체 항상성 연구실", shortName: "암신호전달·유전체항상성", pi: "기영훈 교수", field: "암 생물학, DNA 손상복구, 유전체 항상성, 약물저항성" },
  { id: "lab-newbio-precision-medicine", name: "큐바이오 정밀의학 연구실", shortName: "큐바이오 정밀의학", pi: "김민식 교수", field: "정밀의학, 질량분석, 단백체학, 대사체학, 시스템생물학" },
  { id: "lab-newbio-epigenetics", name: "분자후성유전학 연구실", shortName: "분자후성유전학", pi: "김유리 교수", field: "후성유전학, 유전체 구조, 형광이미징, DNA 바이오센서" },
  { id: "lab-newbio-protein-aging", name: "단백질 구조 노화 연구실", shortName: "단백질구조·노화", pi: "김진해 교수", field: "단백질 구조, 노화, 단백질 오접힘, 구조생물학" },
  { id: "lab-newbio-stem-cell", name: "줄기세포공학-치료 연구실", shortName: "줄기세포공학-치료", pi: "김태완 교수", field: "줄기세포, 뇌질환 모델링, 재생의학, 세포치료" },
  { id: "lab-newbio-biotherapeutics", name: "바이오치료제 디자인 랩", shortName: "바이오치료제 디자인", pi: "예경무 교수", field: "항체의약품, 바이오의약품, 세포외소포체(EV), 세포신호전달" },
  { id: "lab-newbio-plant-communication", name: "식물분자커뮤니케이션 연구실", shortName: "식물분자커뮤니케이션", pi: "우혜련 교수", field: "식물 노화, 식물 스트레스, 후성유전학, DNA 손상복구" },
  { id: "lab-newbio-protein-homeostasis", name: "단백질 항상성 및 신약개발 연구실", shortName: "단백질항상성·신약개발", pi: "교수명 미기재", field: "유비퀴틴-프로테아좀 시스템(UPS), PROTAC, 표적 단백질 분해, 신약개발" },
];

function buildNewBiologyLabs(): Lab[] {
  return buildLabsFromSeed(NEW_BIOLOGY_LABS, DEPT_NEW_BIOLOGY);
}

export function buildDirectoryLabs(): Lab[] {
  const now = new Date().toISOString();
  return [
    {
      id: DEMO_LAB_ID,
      departmentId: DEPT_BRAIN_SCIENCES,
      name: PRODUCT_CONFIG.defaultLab.name,
      shortName: PRODUCT_CONFIG.defaultLab.shortName,
      field: "신경과학 및 분자생물학",
      pi: "연구실 관리자",
      description: PRODUCT_CONFIG.defaultLab.description,
      keyPapers: PRODUCT_CONFIG.defaultLab.keyPapers.map((paper) => ({
        ...paper,
      })),
      isDemo: false,
      createdAt: now,
      updatedAt: now,
      intro: PRODUCT_CONFIG.defaultLab.description,
      researchAreas: ["시냅스 가소성", "신경회로", "이미징", "분자신경생물학"],
      isProfilePublic: true,
    },
    ...buildBrainSciencesLabs(),
    ...buildChemPhysicsLabs(),
    ...buildEecsLabs(),
    ...buildRoboticsLabs(),
    ...buildEnergyLabs(),
    ...buildNewBiologyLabs(),
  ];
}

export const DIRECTORY_DEPARTMENTS = buildDepartments();
export const DIRECTORY_LABS = buildDirectoryLabs();

export function getDepartment(departmentId: string): Department | undefined {
  return DIRECTORY_DEPARTMENTS.find(
    (department) => department.id === departmentId,
  );
}

export function getDirectoryLab(labId: string): Lab | undefined {
  return DIRECTORY_LABS.find((lab) => lab.id === labId);
}
