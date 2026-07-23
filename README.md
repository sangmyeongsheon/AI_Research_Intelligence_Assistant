# ARIA

ARIA(AI Research Intelligence Assistant)는 음성, 손글씨 이미지, PDF,
텍스트와 Markdown 자료를 분석해 원본 근거와 검토 이력이 연결된 연구실
프로토콜을 생성하는 브라우저 애플리케이션입니다.

## 주요 기능

- 여러 형식의 연구 자료 일괄 업로드
- 음성 전체 전사, OCR, PDF 텍스트 추출
- 단계, 조건, 암묵지, 실수와 troubleshooting 분류
- 충돌·누락 정보와 원문 근거 연결
- 프로토콜 편집, 버전 이력과 Markdown/PDF 내보내기
- 6개 학과의 연구실 디렉터리와 방문자·연구원 보기
- 브라우저 IndexedDB 기반 연구 데이터 저장

## Gemini API 키

배포본에는 Gemini API 키가 포함되어 있지 않습니다. 각 사용자가
`Settings`의 `API 키 관리`에서 자신의 키를 직접 입력합니다.

- 키는 현재 탭의 메모리에만 유지됩니다.
- F5, 새로고침 또는 탭 종료 시 키가 삭제됩니다.
- 키를 LocalStorage, SessionStorage, IndexedDB, GitHub 또는 ARIA 서버에
  저장하지 않습니다.
- 사용자가 업로드한 자료와 API 키는 브라우저에서 Google Gemini로 직접
  전송됩니다.

공개 테스트에는 Gemini API로 범위를 제한하고 사용량 한도를 설정한 별도
키를 권장합니다.

## 로컬 실행

요구 사항:

- Node.js 22.13 이상
- pnpm 11.9.0

```bash
pnpm install --frozen-lockfile
pnpm dev
```

브라우저에서 `http://localhost:3000`을 연 뒤 `Settings`에서 본인의 키를
입력합니다.

## 예제 모음집

사이트의 Overview 화면에서 **예제 모음집 다운로드**를 누르면 음성,
손글씨 이미지, PDF, Markdown 및 텍스트 메모가 담긴 ZIP 파일을 받을 수
있습니다. 압축을 푼 뒤 `New protocol` 화면에서 예제 파일을 한 번에
선택하면 전체 흐름을 바로 테스트할 수 있습니다.

## GitHub Pages 배포

`main` 브랜치에 변경을 올리면
`.github/workflows/deploy-pages.yml`이 다음 작업을 자동 실행합니다.

1. 의존성 설치
2. 타입 검사
3. 테스트
4. Next.js 정적 export
5. GitHub Pages 배포

프로젝트 저장소 이름을 기준으로 Next.js `basePath`와 정적 자산 경로를
자동 설정합니다.

## 검증

```bash
pnpm run typecheck
pnpm test
pnpm run build
```

정적 결과물은 `out/`에 생성됩니다.
