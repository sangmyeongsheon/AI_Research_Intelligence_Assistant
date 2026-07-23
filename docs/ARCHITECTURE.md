# ARIA GitHub Pages 구조

ARIA는 Next.js 정적 export로 배포되는 브라우저 애플리케이션입니다.

## 실행 흐름

1. 정적 HTML, CSS와 JavaScript를 GitHub Pages에서 불러옵니다.
2. 사용자가 `Settings`에서 자신의 Gemini API 키를 입력합니다.
3. 키는 현재 탭의 모듈 메모리에만 유지됩니다.
4. 분석 요청은 브라우저에서 Google Gemini로 직접 전송됩니다.
5. 연구실, 프로토콜, 출처와 검토 데이터는 브라우저 IndexedDB에
   저장됩니다. API 키는 IndexedDB에 저장하지 않습니다.

## 배포

- `next.config.ts`가 정적 export와 저장소 하위 경로를 설정합니다.
- `.github/workflows/deploy-pages.yml`이 타입 검사, 테스트, 빌드와 Pages
  배포를 수행합니다.
- 서버 라우트, 배포 기본 키와 서버 데이터베이스는 사용하지 않습니다.

## 보안 경계

ARIA 운영자는 사용자 키를 수집하거나 저장하는 서버를 운영하지 않습니다.
다만 탭이 열린 동안에는 브라우저 메모리와 네트워크 요청에 키가 존재하므로,
신뢰할 수 없는 확장 프로그램이나 수정된 사이트 코드는 위험할 수 있습니다.
제한된 테스트용 키와 사용량 한도를 권장합니다.
