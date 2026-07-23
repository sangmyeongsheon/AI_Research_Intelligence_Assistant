# LabTrace — GitHub Pages

LabTrace는 음성, 이미지, PDF, 텍스트와 Markdown 자료를 분석해 원본 근거와
검토 이력이 연결된 연구실 프로토콜을 만드는 브라우저 애플리케이션입니다.

이 배포본에는 Gemini API 키가 포함되어 있지 않습니다. 각 사용자가
`Settings`에서 자신의 Gemini API 키를 직접 입력하며, 키는 현재 탭의
메모리에만 유지됩니다. 새로고침하거나 탭을 닫으면 키가 삭제됩니다.

## 로컬 실행

요구 사항:

- Node.js 22.13 이상
- pnpm 11.9.0

```bash
pnpm install --frozen-lockfile
pnpm dev
```

브라우저에서 `http://localhost:3000`을 열고 `Settings`에서 본인의 Gemini
API 키를 입력합니다.

## GitHub Pages 배포

1. 이 폴더의 파일을 GitHub 저장소 `main` 브랜치에 올립니다.
2. 저장소에서 `Settings` → `Pages`를 엽니다.
3. `Build and deployment`의 `Source`를 `GitHub Actions`로 선택합니다.
4. `Actions`에서 `Deploy LabTrace to GitHub Pages`가 완료될 때까지 기다립니다.
5. 완료된 작업의 `deploy` 단계에 표시되는 주소를 엽니다.

`.github/workflows/deploy-pages.yml`이 타입 검사, 테스트, 정적 빌드와 Pages
배포를 자동으로 수행합니다. 프로젝트 저장소 경로에 맞춰 Next.js
`basePath`도 자동 적용합니다.

GitHub Free에서 비공개 저장소의 Pages 사용이 허용되지 않는 계정이라면
저장소를 공개로 전환하거나 Cloudflare Pages 같은 정적 호스팅을 사용해야
합니다.

## API 키 보안

- 실제 키를 `.env`, 소스 코드, Git 커밋에 넣지 마세요.
- 이 배포본은 서버 API 경로를 포함하지 않으며 브라우저에서 Gemini를
  직접 호출합니다.
- 키는 LocalStorage와 IndexedDB에 저장하지 않습니다.
- 외부 광고, 분석 또는 임의의 서드파티 스크립트를 추가하면 브라우저에
  입력된 키가 노출될 수 있으므로 추가하지 않는 것을 권장합니다.
- 공개 테스트용 키는 Gemini API 전용으로 제한하고 사용량 알림을
  설정하세요.

## 검증

```bash
pnpm run typecheck
pnpm test
pnpm run build
```

정적 결과물은 `out/`에 생성됩니다.
