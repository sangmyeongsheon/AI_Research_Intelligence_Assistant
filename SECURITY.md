# Security

## Gemini API 키

ARIA 배포본에는 API 키가 포함되지 않습니다. 사용자가 입력한 키는 현재 탭의
메모리에만 유지되며 F5, 새로고침 또는 탭 종료 시 삭제됩니다.

키를 다음 위치에 저장하지 않습니다.

- Git 또는 GitHub
- 환경 파일
- LocalStorage
- SessionStorage
- IndexedDB
- ARIA 서버

브라우저는 사용자의 자료와 키를 Google Gemini로 직접 전송합니다. 공개
테스트에는 범위와 사용량을 제한한 별도 키를 사용하세요. 키가 노출됐다고
의심되면 즉시 폐기하고 새 키를 발급하세요.
