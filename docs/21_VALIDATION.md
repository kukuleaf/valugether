# 21. 검증 상태

기준일: 2026-09-19

## 이번에 통과한 검증

- `npm run typecheck`
  - NestJS API `tsc --noEmit` 통과
  - Expo 모바일 `tsc --noEmit` 통과
- `npm run build`
  - NestJS production build 통과
  - Next.js 관리자 production build 및 12개 route 생성 통과
- `node tools/near-match-demo.mjs`
  - 6개 예제 통과: EXACT 1건, NEAR 3건, FAIL 2건
- PostgreSQL 17.11 기존 개발 DB 구조 확인
  - public table 47개, view 3개
  - SQL `10`~`12`의 table, column, index 적용 확인
  - 종목·가격·지표·프리셋 참조 무결성 오류 0건
  - `13_auth_tokens.sql` 인증 token 조회·정리 index 적용
- 실제 외부 provider 동기화
  - OpenDART pagination 1차: cursor `0`→`313`, 200/200, 오류 0개
  - OpenDART pagination 2차: cursor `313`→`542`, 200/200, 오류 0개
  - 재시작 시 저장된 cursor `313`부터 이어지는 것과 최종 checkpoint `542` 확인
  - SEC pagination 1차: cursor `0`→`4193`, 164개 적재, `NO_DATA` 36개, 오류 0개
  - SEC pagination 2차: cursor `4193`→`4393`, 161개 적재, `NO_DATA` 39개, 오류 0개
  - SEC HTTP 404가 `NO_DATA/SEC_COMPANY_FACTS_404`로 변환되고 batch 오류와 분리되는 것 확인
  - KIS: KOSPI 412개, KOSDAQ 10개, NASDAQ 198개, NYSE 123개 가격 처리
  - NASDAQ 동기화 중 `KIS OPSQ1002: SESSION FULL` 1건 발생 후 재실행으로 198개 전체 갱신, 오류 0개 확인
  - KIS 가격 배치 재실행: insert 0개, update 354개, 오류 0개
  - 최신 가격과 가격 파생지표 기준일: 2026-09-18
- 실데이터 적재 결과
  - DART: 422개 회사, 16,445개 fact
  - SEC: 345개 회사, 14,528개 fact
  - 가격 보유: 743개 종목
  - `PRICE_V1`: 2026-09-18 기준 742개 종목/2,407개 지표, 거래정지 추정 1개 종목은 2026-09-16 기준 3개 지표
- 동기화 중 발견한 오류 수정
  - PostgreSQL `date` 객체가 `Fri Sep 11` 형태로 잘려 저장되던 날짜 변환 오류
  - 가격 sync 뒤 `PER`/`PBR` 등 가격 파생지표의 값과 기준일이 갱신되지 않던 오류
  - 재무 sync가 항상 같은 상위 200개만 처리하던 제한
  - SEC Company Facts 404가 전체 batch 오류로 집계되던 문제
- API/PostgreSQL 핵심 사용자 흐름 E2E
  - health와 DB 연결
  - 활성 약관 4개 조회와 필수 동의 기반 임시 회원가입
  - 내 정보, 로그아웃, 재로그인, refresh token 회전, 최종 로그아웃
  - 국내 PER 조건 검색 10건 반환
  - 관심종목 추가·조회·삭제
  - 프리셋 생성·조회·삭제
  - 알림 설정 활성화와 알림함 조회
  - E2E 전용 계정과 종속 데이터 정리 후 잔여 계정 0건 확인
- BullMQ 자동 배치 runtime
  - Redis 연결, worker 기동, 비활성 batch scheduler 동기화 확인
  - `PRESET_MATCH_NOTIFY` 실제 queue 처리 성공: 평가 사용자 0, 프리셋 0, 알림 0
  - Redis 미연결 시 설정된 startup timeout 뒤 API 시작 실패와 오류 로그 제한 확인
  - 테스트 job과 임시 비영속 Redis 컨테이너 제거
- 이메일 인증/비밀번호 재설정 E2E
  - Mailpit SMTP 실제 발송과 앱 딥링크 token 확인
  - 로컬 가입 직후 로그인 403, 이메일 인증 후 access/refresh token 발급
  - 비밀번호 재설정 뒤 기존 비밀번호 401, 새 비밀번호 200, token 재사용 400
  - `user_password`가 없는 간편로그인 전용 계정에는 인증·재설정 메일 0건
  - 임시 로컬·소셜 계정과 Mailpit 테스트 메일 정리 완료

## 구현을 확인했지만 런타임 검증이 필요한 범위

- 빈 DB 대상 PostgreSQL DDL, seed, 증분 SQL
- 고급 검색과 검색 이력 적재
- 관리자 대시보드, 허용오차, 약관, 배치, 감사 로그, 엑셀 export
- 영속 Redis 대상 BullMQ 관리자 queue/schedule API
- Marketstack 수집과 정규화

## 아직 수행하지 못한 검증

- 핵심 사용자 흐름을 반복 실행할 자동화 integration/E2E test suite
- 빈 PostgreSQL 17에 `00_create_database.sql`부터 `13_auth_tokens.sql`까지 적용한 뒤 API 기동
- Marketstack 실제 키 수집 테스트
- DART/SEC 전체 cursor 순회와 순회 완료 후 `0` reset 검증
- 재무지표가 있지만 가격이 없는 NYSE 24개 종목 원인 확인
- Mock provider 중복 방지와 부분 실패 복구 테스트
- Android 실제 기기 및 EAS build
- Google/Kakao/Naver callback
- 이메일/push 알림 전송과 AdMob SDK
- 기존 로컬 Redis volume RDB의 현재 이미지 호환성 복구 및 영속 Redis에서 worker 재검증
- 부하, 보안, 백업/복구 테스트

현재 상태는 **정적 검사, API/관리자 build, 기존 PostgreSQL DB, 핵심 사용자 E2E, OpenDART/SEC/KIS 실데이터 동기화를 검증한 MVP 구현본**이다. 신규 DB 전체 설치와 자동화 E2E suite를 통과하기 전까지 출시 가능 판정은 아니다. 다음 검증 순서는 `docs/11_TODO_TOBE.md`의 P0를 따른다.
