# 21. 검증 상태

기준일: 2026-10-11

## 이번에 통과한 검증

- 2026-10-11 공식 로그인 자산·네이버 Android SDK·EAS 운영 광고 ID 최종 통합
  - 제공 ZIP의 Google·Kakao·Naver 원본 PNG를 사용하고 390px·320px 화면에서 순서, 비율, 로딩을 검증했다.
  - Android 네이버 SDK 5.12.0 로컬 Expo 모듈과 네이티브 자격 정보 config plugin, 서버 refresh grant 검증, 최초 가입 약관, 재인증 탈퇴 및 연결 해제 처리를 구현했다. 웹 OAuth는 사용자 요청에 따라 보류했다.
  - 사용자 제공 실제 AdMob App ID와 두 배너 Unit ID를 EAS production에 등록했다. development·preview는 운영 ID가 섞여도 테스트 ID만 사용하며, 세 프로필의 생성 AndroidManifest를 introspection으로 확인했다.
  - API 12/12, 네이버 API 12/12, Kakao 2/2, 가격 배치 4/4, Redis 큐 1/1, 광고 설정·동의·EAS 15/15, 모바일 네이버 adapter/config 14/14, Chromium UI 23/23: 총 83개 자동검증 통과
  - API·모바일 타입 검사, API·관리자 production build 및 모바일 web export 통과. 네이버를 포함한 새 Android 네이티브 빌드·실계정 로그인·광고 송출은 도구 승인 검토 한도로 실행하지 못했다. 이전 debug 빌드를 최신 APK로 간주하지 않는다.
  - production 의존성 audit 잔여 31건(critical 0, high 20, moderate 11), 실제 UMP 설정, 네이버 노출 키 재발급·EAS 환경 등록은 출시 전 조건으로 남는다. 자세한 결과는 `23_ADS_AND_RELEASE_AUDIT.md`에 기록했다.

- 2026-10-11 광고 통합 및 앱·관리자·API 회귀
  - Android AdMob 인라인 배너, 테스트/운영 ID 분리, 운영 UMP 동의 선행, 개인정보 옵션과 개인정보 안내 화면 구현
  - 홈 하단과 6건 이상 검색 결과의 5번째 카드 뒤에만 광고를 배치했다. 로그인·검색 입력·상세 차트에는 강제 전면 광고나 고정 광고를 넣지 않았다.
  - 모바일/API 타입 검사, API·Next.js 16.3.8 production build, 관리자 15개 route, 모바일 web export 통과
  - API 12/12, Kakao 2/2, 가격 배치 4/4, Redis 큐 1/1, 광고 설정·동의 단위검증 12/12, 관리자·모바일 Chromium 회귀 20/20 통과
  - 좁은 320px 화면에서 홈 한 줄 제목·시장 선택 가로 스크롤·재무 그리드 폭·차트 닫기 위치와 비동기 차트 응답 경합을 검증했다.
  - AdMob 포함 Android x86_64 debug APK 빌드 성공(359 tasks). 에뮬레이터 설치 및 앱의 API 요청은 확인했지만, 최신 화면·실제 배너의 육안 검증은 도구 승인 한도로 완료하지 못했다.
  - production 의존성 audit 31건(critical 0, high 20, moderate 11). 호환 패치 후 자동 회귀를 재실행했으며, 잔여 upstream 취약점과 운영 계정 검증은 출시 조건으로 남는다.
  - 추가 요청한 공식 로그인 이미지와 Android 네이버 SDK 통합 결과는 `23_ADS_AND_RELEASE_AUDIT.md`에 따로 기록한다. 이 단락의 검증 수치는 네이버 통합 이전 기준이다.

- 2026-10-05 Kakao Android OIDC 로그인 구현
  - Kakao SDK Expo config plugin, nonce를 포함한 네이티브 로그인, 서버 JWKS 서명·issuer·audience·만료·nonce 검증 구현
  - 최초 가입 약관 동의, 이메일 없는 소셜 계정, 기존 계정 재로그인, 카카오 재인증 탈퇴·연결 해제 구현. 간편 로그인에는 이메일 인증/재설정 메일 없음
  - 개발 DB에 `17_kakao_auth.sql` 적용. 카카오 인증 DB 통합 테스트 1/1, ID 토큰 암호 검증 단위 테스트 1/1, 기존 API E2E 3/3 통과
  - `npm run typecheck`, 모바일 web export, 관리자·모바일 Playwright 4/4, Expo config plugin의 Android callback activity/스킴 introspection 통과
  - 당시 의존성 audit에서 Next.js 16.3.3의 조건부 critical advisory 감지. 2026-10-11 Next.js 16.3.8로 패치하고 빌드·회귀를 재검증했다.
  - 모바일/API Kakao Native app key 환경변수 미설정. 새 APK 실제 Kakao 로그인·탈퇴 및 외부 연결 해제 웹훅은 미검증

- 2026-09-28 시세 기준일·지연/누락 안내
  - 검색 결과·맞춤기업·종목 상세에 가격 기준일과 시세 지연/누락 상태 표시
  - 검색 조건별 지표 기준일 표시. 시세 누락 시 재무정보 표시 유지, API 오류 재시도 버튼 추가
  - 기존 데이터 품질 검사의 가격 최대 경과일 설정을 API 시세 상태 판정과 공유
  - `npm run typecheck`, `npm run test:e2e` 3/3, `npm run test:ui:e2e` 4/4 통과. 검색·종목 상세 시세 상태 계약 확인
  - Android APK 재빌드/실기기 확인은 이번 검증 범위에서 제외

- 2026-09-25 전체 회귀와 운영 검증
  - 브랜드를 가치보는주식/Valugether로 변경하고 Android package `com.valugether.app`, Expo slug·scheme `valugether` 적용
  - 메일 제목, 관리자·모바일 표시명, package/workspace 이름, queue·rate-limit namespace, health ID와 문서의 기존 브랜드 제거
  - 이용약관·개인정보 처리방침·투자정보·마케팅 동의 편집 초안을 `DRAFT`로 DB에 적용
  - Google/Kakao/Naver, AdMob, Expo EAS 계정 개설·연결 순서를 TO-BE에 정리
  - `npm run typecheck`, `npm run build` 통과. Next.js 관리자 15개 route 생성
  - `npm run test:e2e` 3/3, `npm run test:batch` 2/2, `npm run test:queue` 1/1, `npm run test:ui:e2e` 4/4 통과
  - 관리자 보호 경로, CSP/보안 헤더, same-origin mutation, 로그인/로그아웃, 공지 lifecycle, Excel export를 Playwright Chromium으로 확인
  - 모바일 web 홈·검색·고급 조건·로그인 session·로그아웃을 Playwright Chromium으로 확인
  - Mock 가격 첫 실행 insert/재실행 update와 invalid row savepoint rollback 후 후속 행 처리 확인
  - 임시 Redis 7에서 BullMQ worker 기동과 `DATA_QUALITY_CHECK` job 완료, failed 0 확인
  - PostgreSQL 17 custom dump를 격리 PostgreSQL 17에 복원. table 49개, company 10,038개, security 11,653개 일치
  - backup/restore와 queue 검증의 임시 컨테이너·dump 0개 잔존 확인
  - Expo SDK 57 권장 patch 갱신 후 공식 Expo Doctor 21/21 통과
  - `npm audit`: Multer 2.3.0 override로 high 3개 제거, high/critical 0. upstream Expo/ExcelJS 계열 moderate 14개는 breaking downgrade 없이 추적
  - KIS 최신 가격 갱신: KOSPI 412개, KOSDAQ 10개, NASDAQ 198개, NYSE 123개, 오류 0
  - 최신 거래일: KOSPI·KOSDAQ 2026-09-23, NASDAQ·NYSE 2026-09-24
  - `data-status`에 거래소별 최신 거래일과 해당 일자 가격 종목 수 추가

- PostgreSQL 17.11 전체 신규 설치
  - 격리된 빈 컨테이너에서 `00_create_database.sql`로 역할과 DB 생성
  - `01_extensions.sql`부터 `15_data_quality.sql`까지 순차 적용 성공
  - `00`~`15` 전체 재적용 성공으로 로컬 개발용 idempotency 확인
  - public table 49개, view 3개, 재무지표 67개, 일반 전략 4개/조건 14개, 배치 정의 7개, 약관 4개 확인
  - 전략 조건·가격·최신지표 참조 무결성 오류와 전략 중복 지표 0건
  - 신규 DB로 NestJS API 기동, 일반 전략/지표/약관/공지 조회와 데모 로그인 성공
  - 관리자 데이터 품질 실행·최신 결과 재조회 성공
  - 비활성 데모 종목만 있는 신규 DB가 `PASS`로 판정되던 문제를 발견해 `ACTIVE_SECURITY_EMPTY/CRITICAL`로 수정·재검증
  - 검증 전용 API 종료와 임시 PostgreSQL 컨테이너 제거 완료

- `npm run typecheck`
  - NestJS API `tsc --noEmit` 통과
  - Expo 모바일 `tsc --noEmit` 통과
- `npm run build`
  - NestJS production build 통과
  - Next.js 관리자 production build 및 15개 route 생성 통과
- `npm run test:e2e`
  - Node 내장 test runner와 임시 포트의 실제 NestJS HTTP 서버 사용
  - 공개 catalog/health 1개 묶음 통과
  - 로그인·내 정보·refresh 회전·이전 token 재사용 401·관리자 접근 403·로그아웃 1개 묶음 통과
  - DTO whitelist 400, 검색 이력, 관심종목, 프리셋 CRUD, 알림 설정 1개 묶음 통과
  - 서버 생성·클라이언 제공·잘못된 request ID 교체와 응답 헤더 확인
  - 400·401·500 오류 응답 형식과 request ID 일치 확인
  - 검색 이력·감사·`application_error_log` request ID 적재 확인
  - 예상하지 못한 500 내부 메시지 비공개와 오류 로그 자동 정리 확인
  - CORS 허용 Origin preflight 204/allow-origin 헤더와 비허용 Origin 헤더 미반환 확인
  - 운영 환경 CORS allowlist 미설정 거부 확인
  - 인증 API 3회 허용 후 4회째 429, `Retry-After`·남은 횟수·request ID 확인
  - 테스트 계정·검색 이력·감사 로그 자동 정리와 잔여 테스트 계정 0건 확인
- 임시 Redis 7 컨테이너 공유 rate-limit 검증
  - 독립 `RateLimitService` 두 개가 같은 key의 카운터 1→2→3을 공유하는 것 확인
  - 검증 후 임시 컨테이너 제거
- `node tools/near-match-demo.mjs`
  - 6개 예제 통과: EXACT 1건, NEAR 3건, FAIL 2건
- PostgreSQL 17.11 기존 개발 DB 구조 확인
  - public table 47개, view 3개
  - SQL `10`~`12`의 table, column, index 적용 확인
  - 종목·가격·지표·프리셋 참조 무결성 오류 0건
  - `13_auth_tokens.sql` 인증 token 조회·정리 index 적용
  - `14_notification_email_delivery.sql` 이메일 opt-in, 발송 상태, 재처리 조회 index 적용
  - `15_data_quality.sql` 품질 실행/이슈 table, index, 배치 정의 적용 및 재실행 성공
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
  - Resend SMTP 인증 성공 및 `onboarding@resend.dev`에서 계정 소유자 Gmail로 실제 인증
    템플릿 전달 수락 확인. 서비스 도메인 등록 전 전달 시험 범위로 한정
- 회원 탈퇴 E2E
  - 잘못된 현재 비밀번호 401, 올바른 비밀번호 탈퇴 성공
  - 관심종목 1개, 프리셋 1개, 검색 이력 1개 삭제 집계 확인
  - 탈퇴 후 계정 0건, 기존 access JWT 401, 동일 자격 로그인 401
  - 탈퇴 감사 기록의 `actor_user_id`와 `target_id`가 `NULL`인 비식별 상태 확인
- 검색 이력 API runtime
  - 비로그인 조회 401, 로그인 검색 2건의 사용자별 자동 기록 확인
  - `beforeId` 커서 페이지 이동, 단건 삭제, 전체 삭제와 최종 빈 목록 확인
  - 임시 사용자의 이력이 다른 사용자와 섞이지 않는 것 확인 후 테스트 데이터 제거
- 프리셋 이메일 알림 runtime
  - 최초 프리셋 평가가 기준선만 저장하고 메일을 보내지 않는 것 확인
  - 신규 충족 기업만 1회 발송하고 동일 결과 재평가 시 중복 발송 0건 확인
  - 발송 상태 `SENT/FAILED`, 실패 격리, HTML escaping, 앱 딥링크 확인
  - 내부 알림 평가가 사용자 검색 이력을 생성하지 않는 것 확인
  - 이메일 opt-in 기본값 `false`, 설정 저장·조회 확인 후 임시 데이터 제거
- 관리자 전략·공지 runtime
  - 임시 비활성 전략을 생성해 이름·설명·순서·필수 여부·가중치·조건 저장 확인
  - 전략 활성화 뒤 공개 전략 API에 수정된 조건과 숫자 형식이 반영되는 것 확인
  - 공지 작성 중 생성 → 수정 → 게시 → 공개 목록 노출 → 보관 → 공개 목록 제외 확인
  - 작성 중 공지 삭제와 모든 7개 변경의 감사 로그 호출 확인
  - 임시 전략·공지·사용자 데이터 제거 완료
- 데이터 품질 runtime
  - 실제 개발 DB에서 가격·재무 최신성/커버리지, 최신 가격 이상값, 정체·실패 배치 18개 검사 실행
  - 현재 부분 적재 상태에서 가격 커버리지 4개 거래소와 재무 커버리지 2개 시장의 심각 이슈 6건 감지
  - 품질 실행/이슈/배치 결과 저장과 최신 결과 재조회 확인
  - 운영 이메일 비활성 상태에서 SMTP를 호출하지 않고 `SKIPPED_DISABLED`로 기록 확인
  - 동일 이슈 조합을 연속 실행해 첫 운영 알림 1회, 두 번째 `SKIPPED_DUPLICATE` 확인 후 임시 검증 기록 제거
- Expo EAS Android preview build
  - 잘못 생성된 루트 Expo 설정이 `expo/AppEntry`에서 루트 `App`을 찾던 최초 번들 실패 원인 확인
  - EAS 앱 루트를 `apps/mobile`로 수정하고 Android application ID `com.valugether.app` 확인
  - 로컬 Android export 성공: Expo Router entry 1,285개 모듈 번들
  - EAS 프로젝트 `@kukuleaf/valugether`, 빌드 `e5f6854b-0b0b-4665-9584-7d26da33f802` preview APK 생성 성공
  - EAS preview API 환경변수 미등록 상태 확인. 생성 APK의 설치·정적 화면 검증 후 실제 기기에서 접근 가능한 API 주소로 재빌드 필요
  - Android 시스템 내비게이션과 하단 탭바 겹침을 기기별 bottom safe-area 기반 높이·패딩으로 수정
  - `expo-build-properties`로 preview `usesCleartextTraffic=true`, production `false` 네이티브 Manifest 분리 확인
  - 수정 빌드 `bdc58509-a51f-49de-8f4f-353d58e573f0`, versionCode `2` preview APK 생성 성공

## 구현을 확인했지만 런타임 검증이 필요한 범위

- 고급 검색 대규모 지표 조합과 성능. 각 operator·거래소·상태 필터는 자동 E2E 완료
- 관리자·모바일 실제 기기 접근성/수동 탐색. Chromium 자동 E2E는 완료
- 운영 영속 Redis와 실제 활성 cron 장기 실행. 격리 Redis queue/worker 자동 E2E는 완료
- Marketstack 수집과 정규화

## 아직 수행하지 못한 검증

- Marketstack 실제 키 수집 테스트
- DART/SEC 전체 cursor 순회와 순회 완료 후 `0` reset 검증
- 재무지표가 있지만 가격이 없는 NYSE 24개 종목 원인 확인
- Android preview APK 실제 기기 설치·탐색과 production AAB build
- Google/Naver callback, Kakao 새 APK 실기기 로그인·재인증 탈퇴 및 외부 연결 해제 웹훅
- push 알림 전송
- AdMob 운영 계정의 실제 광고 송출·UMP 메시지·개인정보 옵션 및 실제 Android 기기 검증. SDK 통합·네이티브 debug 빌드·설정/동의 단위검증은 2026-10-11 완료
- 기존 로컬 Redis volume RDB의 현재 이미지 호환성 복구 및 운영 영속 Redis 장기 검증
- 부하·외부 침투 테스트와 운영 backup 암호화·스케줄 검증

현재 상태는 정적 검사, production build, PostgreSQL 17 신규 설치·백업 복구, API·배치·큐·관리자·모바일 web 자동 E2E, 과거 Android EAS preview APK, AdMob 포함 로컬 Android debug 빌드, OpenDART/SEC/KIS 실데이터 동기화를 검증한 MVP 구현본이다. Android 실제 기기와 production AAB, 광고 운영 계정·동의, 잔여 보안 취약점, 외부 계정·도메인·법률·운영 인프라 검증 전까지 출시 가능 판정은 아니다.
