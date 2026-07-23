# Security

## 사용자 제공 Gemini API 키

LabTrace는 저장소나 배포 환경에 공용 Gemini API 키를 포함하지 않습니다.
사용자가 Settings 화면에서 직접 입력한 키는 JavaScript 모듈의 메모리에만
보관되며 다음 위치에는 기록하지 않습니다.

- GitHub 저장소
- 환경 파일
- LocalStorage
- SessionStorage
- IndexedDB
- LabTrace 서버

새로고침하거나 탭을 닫으면 키가 삭제됩니다. AI 요청은 사용자 브라우저에서
Gemini API로 직접 전송되므로 브라우저 확장 프로그램, XSS 또는 추가된
서드파티 스크립트가 키를 읽을 위험은 여전히 존재합니다. 이 사이트에서는
신뢰할 수 없는 스크립트를 추가하지 마세요.

키가 노출되었다고 의심되면 Google AI Studio에서 즉시 폐기하고 새 키를
발급하세요.
