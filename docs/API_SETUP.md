# Gemini API 사용

ARIA GitHub Pages 배포본은 서버용 또는 공용 API 키를 사용하지 않습니다.

1. 사이트에서 `Settings`를 엽니다.
2. `API 키 관리`에 본인의 Gemini API 키를 입력합니다.
3. `현재 탭에서 키 사용`을 누릅니다.
4. 자료 분석이나 Protocol Q&A를 실행합니다.

키는 현재 탭의 JavaScript 메모리에만 유지됩니다. F5, 새로고침 또는 탭
종료 후에는 다시 입력해야 합니다. LocalStorage, SessionStorage,
IndexedDB, GitHub 저장소와 ARIA 서버에는 저장되지 않습니다.

공개 테스트에는 Gemini API로 사용 범위를 제한하고 사용량 한도·알림을
설정한 별도 키를 사용하세요.

오류가 발생해도 업로드한 파일과 기존 프로토콜은 브라우저의 연구 데이터
저장소에 유지되지만 API 키는 유지되지 않습니다.
