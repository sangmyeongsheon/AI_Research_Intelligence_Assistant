const EXPERIMENT_TERMS =
  /농도|온도|시간|전압|항체|시약|배양|원심|transfer|western|실험\s*조건/i;

export function answerGuideQuestion(question: string): string {
  const normalized = question.trim().toLocaleLowerCase("ko-KR");
  if (!normalized) {
    return "궁금한 화면이나 작업을 짧게 적어 주세요.";
  }

  if (EXPERIMENT_TERMS.test(normalized)) {
    return "실험 조건에 관한 질문은 해당 프로토콜의 ‘Protocol Q&A’에서 물어보세요. 그곳에서는 연결된 원본 근거를 함께 확인할 수 있습니다.";
  }
  if (
    /예제|샘플|데모/.test(normalized) &&
    /다운로드|파일|모음|사용/.test(normalized)
  ) {
    return "Overview 위쪽의 ‘예제 모음집 다운로드’를 누르면 음성, 손글씨 이미지, PDF와 메모가 담긴 ZIP을 받을 수 있습니다. 압축을 푼 뒤 ‘New protocol’에서 예제 파일을 한 번에 선택해 테스트하세요.";
  }
  if (/새\s*프로토콜|만들|생성|업로드/.test(normalized)) {
    return "왼쪽 메뉴의 ‘New protocol’에서 파일이나 직접 입력 자료를 추가한 뒤 ‘자료 분석 시작’을 누르세요. 분석 후 인식 결과와 충돌·누락 항목을 검토할 수 있습니다.";
  }
  if (/충돌|누락|질문|해결/.test(normalized)) {
    return "분석이 끝나면 출처 검토 다음 단계에서 충돌 후보를 선택하고 누락 질문에 답할 수 있습니다. 답변을 건너뛰면 미해결 상태로 남아 승인 전에 다시 확인할 수 있습니다.";
  }
  if (/출처|근거|원본|인용/.test(normalized)) {
    return "프로토콜의 출처 배지나 Sources 목록의 자료를 누르면 오른쪽 원본 패널이 열립니다. 오디오는 해당 시점, PDF는 해당 페이지, 이미지는 원본 미리보기로 연결됩니다.";
  }
  if (/내보내기|pdf|markdown|다운로드|인쇄/.test(normalized)) {
    return "프로토콜 상세 화면 위쪽의 내보내기 메뉴에서 Markdown 또는 PDF용 인쇄 화면을 열 수 있습니다.";
  }
  if (/api|키|gemini|연결/.test(normalized)) {
    return "Settings의 ‘API 키 관리’에서 본인의 Gemini API 키를 입력하세요. 키는 현재 탭 메모리에만 있으며 F5를 누르거나 탭을 닫으면 삭제됩니다.";
  }
  if (/연구실|학과|방문자|연구원|전환/.test(normalized)) {
    return "‘Labs’에서 학과와 연구실을 탐색하세요. 방문자 보기에서는 공개 소개만 보이고, 연구원 보기에서는 연결된 연구실의 프로토콜 작업 공간으로 들어갈 수 있습니다.";
  }
  if (/버전|이력|상태|승인|검토/.test(normalized)) {
    return "프로토콜 상세 화면에서 상태와 버전을 관리합니다. 저장할 때 변경 요약을 남기면 버전 이력에서 이전 기록을 확인할 수 있습니다.";
  }

  return "화면 사용법을 안내할 수 있어요. 예제 모음집 다운로드, 새 프로토콜 만들기, 충돌·누락 검토, 원본 출처 확인, 내보내기, 연구실 전환 또는 API 키 설정 중 하나를 물어보세요.";
}
