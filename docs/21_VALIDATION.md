# 21. 초안 검증 상태

작성 시 수행한 정적 검증:

- TypeScript/TSX 72개 파일 syntax transpile 검사: 오류 0
- JSON 파일 parse 검사
- 핵심 파일 존재 검사
- 근접검색 예제 6건 자동검증
  - EXACT 1건
  - NEAR 3건
  - FAIL 2건
- `.env` 실제 비밀파일/`node_modules`가 ZIP에 포함되지 않는지 확인

아직 수행하지 않은 것:

- PostgreSQL 17에 전체 DDL 실제 실행 검증
- npm dependency 전체 설치 후 Nest/Expo/Next production build
- 실제 OpenDART/SEC/Marketstack 키를 이용한 통합테스트
- Android 실제 기기/EAS build
- 소셜 로그인 실제 callback 테스트
- AdMob SDK 연결

따라서 이 ZIP은 **개발 시작용 v0.1 초안**이며, Phase 1에서 로컬 환경에 설치한 뒤 DDL/build 오류를 수정하면서 `v0.2`로 올리는 것을 전제로 합니다.
