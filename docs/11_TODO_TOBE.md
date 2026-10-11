# 11. 구현 현황 / TODO / TO-BE

기준일: 2026-10-05

표기 기준:

- `[x]` 코드 또는 SQL 구현 완료. 운영 환경 검증 완료를 뜻하지는 않는다.
- `[-]` 일부 구현. 뒤에 남은 작업을 적었다.
- `[ ]` 미구현 또는 외부 의사결정이 필요한 작업.

## 구현 완료

### 기반

- [x] 앱 이름 확정: 가치보는주식 / Valugether
- [x] PostgreSQL schema와 `01`~`13` seed/증분 SQL 작성
- [x] NestJS 이메일 회원가입, 로그인, access/refresh token 회전, 로그아웃, 내 정보 API
- [x] 역할 기반 `ADMIN` guard와 관리자 생성 스크립트
- [x] React Native Expo Router 내비게이션, 공통 UI, 세션 저장
- [x] 관리자 로그인과 API 프록시
- [x] 감사 로그, 공통 request ID, 구조화 HTTP 접근 로그, 전역 예외 필터

### 데이터 파이프라인

- [x] KIS/Marketstack/Mock `MarketDataProvider`와 내부 정규화 모델
- [x] KIS KOSPI·KOSDAQ 종목 마스터 수집과 provider symbol 매핑
- [x] SEC ticker master를 이용한 NASDAQ·NYSE 종목/CIK 매핑
- [x] OpenDART corp code와 국내 종목 매핑
- [x] OpenDART 및 SEC Company Facts 재무 adapter
- [x] 국내·미국 재무 fact 정규화와 DB 적재
- [x] 재무 수집 cursor/checkpoint, 200개 단위 pagination, 중단 후 이어받기
- [x] SEC Company Facts 404를 batch 실패가 아닌 `NO_DATA`로 분류
- [x] PER, PBR, ROE, 부채비율, 성장률, 배당 지표 등 파생지표 계산
- [x] 거래소별 일별 가격 upsert 배치와 적재 로그
- [x] 가격 적재 시 가격 기반 파생지표를 같은 거래일로 갱신
- [x] 가격·재무 최신성/커버리지, 가격 이상값, 정체·실패 배치 품질 검사와 결과 이력
- [x] master/financial/price 동기화 CLI와 데이터 상태 확인 CLI
- [x] 오류 건수·배치 상태, BullMQ 자동 재시도, 품질 임계치와 운영 알림

### 검색과 사용자 기능

- [x] 재무지표, 허용오차, 일반 전략 4종 초기 seed
- [x] 일반 전략 검색과 고급 조건 조합 검색 API
- [x] 거래소 필터, 정확/근접 판정, 유사도 정렬, 조건별 결과 설명
- [x] 검색 요청과 결과 건수 이력 저장
- [x] 모바일 일반검색, 고급검색, 결과, 종목 상세 화면
- [x] 검색·맞춤기업·종목 상세 시세 기준일과 지연/누락 안내, 검색 지표별 기준일, API 오류 재시도
- [x] 기본 관심종목 조회·추가·삭제
- [x] 검색 프리셋 생성·조회·수정·삭제와 모바일 프리셋 화면
- [x] 프리셋 알림 조건 평가, 알림함, 이메일 opt-in·발송 상태 추적, 알림 설정 화면

### 관리자 기능

- [x] 대시보드 요약
- [x] 허용오차 조회·편집
- [x] provider 상태, 배치 실행/이력, 감사 로그 조회
- [x] 약관 작성·수정·게시
- [x] 검색 순위 엑셀 export
- [x] 일반 검색 전략의 이름·설명·노출·순서·조건 편집과 감사 로그
- [x] 공지 작성·수정·게시·보관·삭제, 게시 기간과 모바일 홈 노출
- [x] 관리자 데이터 품질 조회·수동 실행과 중복 억제 운영 이메일

## 다음 작업

### P0 - 로컬 통합 검증

- [x] 격리된 PostgreSQL 17.11에 `00`~`15` SQL 전체 신규 설치·재적용·API 기동 검증
- [x] 실행 중인 API와 PostgreSQL로 회원가입/로그인/token 회전/검색/관심종목/프리셋 E2E 검증
- [x] 가격 배치 idempotency와 부분 실패 복구 검증. KIS 재실행 및 Mock insert→update, 행별 savepoint 복구 자동 테스트
- [-] OpenDART/SEC/KIS 실제 키 통합 테스트. DART·SEC 연속 pagination과 KIS 4개 시장 최신 가격 갱신 완료. Marketstack 키 검증은 남음
- [x] API 핵심 흐름, 관리자 브라우저, 모바일 웹 Playwright 자동 E2E
- [x] 공통 request ID, 전역 예외 필터, 구조화 로그 추가

### P1 - MVP 기능 마감

- [x] 로컬 이메일 계정 인증, 재전송, 비밀번호 재설정, 모바일 딥링크 화면. 간편로그인은 대상 제외
- [x] 로컬 계정 회원탈퇴, 사용자 데이터 hard delete, 감사로그 비식별 보존, JWT 즉시 무효화
- [x] 로그인 검색 이력 자동 기록, 커서 조회, 재검색, 단건·전체 삭제 UI/API
- [x] 프리셋 신규 충족 기업 이메일 채널, 최초 기준선, 중복 방지, 실패 격리 연결
- [x] BullMQ worker, DB 기반 cron 자동 스케줄, 수동 enqueue, 중복 실행 방지 연결
- [x] BullMQ 지수 backoff 재시도, 최종 실패 기록, 데이터 최신성/결측/이상치 검사와 운영 알림
- [x] 관리자 strategy 편집과 공지 관리
- [-] EAS preview APK 생성 완료. Android 실제 기기 검증과 production AAB는 남음

### P2 - 외부 계정과 출시 준비

- [x] Android 패키지명 확정: `com.valugether.app`
- [-] 운영 이메일 발송 provider는 Resend로 확정. 서비스 도메인·발신 주소 등록은 남음
- [ ] OpenDART/KIS 운영 키 및 사용조건 확인
- [-] Kakao Android OIDC 로그인·약관 동의·이메일 없는 계정·재인증 탈퇴 코드와 로컬 DB 검증 완료. 양쪽 앱 키 설정·새 APK 실기기 검증·외부 연결 해제 웹훅 필요. Naver는 Android SDK와 서버 검증부터 구현하며 웹 OAuth는 보류. Google은 미구현
- [-] AdMob SDK·UMP·홈/검색 결과 테스트 배너 연결 완료. 운영 계정·앱·실제 ID·동의 메시지·게시 검증 필요. 아래 개설·연결 순서 참고
- [-] 개인정보처리방침/이용약관/투자정보 초안 작성과 DB `DRAFT` seed 완료. 운영자 정보 입력·법률 검토·게시 필요
- [-] Market data 외부 표시, DB 저장, 파생 표시 범위 확인 질문 초안 완료. 공급자 서면 확인 필요
- [x] CORS allowlist, 프록시 신뢰 hop, 인증·검색 API memory/Redis rate limit
- [ ] Secret Manager, 관리자 MFA 검토
- [-] PostgreSQL 17 자동 백업·격리 복구, 데이터 품질/운영 알림, 의존성 audit 완료. 운영 백업 암호화·스케줄·외부 모니터링·침투 테스트는 남음
- [ ] Play Console 등록과 스토어 투자정보 관련 문구 검토

### P3 - 고도화

- [ ] AD_FREE entitlement/payment
- [ ] AI 기업 요약
- [ ] 경제/산업 추세 결합
- [ ] AI 추천의 근거·모델 버전·데이터 시점 저장
- [ ] 웹 사용자 앱
- [ ] 해외시장 추가
- [ ] 전략 백테스트와 사용자 전략 성과 추적

## 외부 계정 개설·연결 순서

Android 식별자는 `com.valugether.app`, 앱 딥링크는 `valugether://`로 고정합니다. 아래 값은
계정 생성 뒤 `.env` 또는 운영 Secret Manager에 넣으며 문서와 Git에는 실제 secret을
기록하지 않습니다.

### 1. Expo EAS와 Android 서명

이 저장소는 모노레포이므로 EAS 명령의 앱 루트는 저장소 최상위가 아니라 `apps/mobile`입니다.
루트에 `app.json`이나 `eas.json`을 만들면 API·관리자까지 Expo 앱으로 인식되어 번들이 실패할 수 있습니다.

1. Expo 계정을 만들고 `npx eas-cli login`을 실행합니다.
2. `cd apps/mobile` 후 `npx eas-cli build:configure`로 EAS 설정을 생성합니다. 현재는
   `@kukuleaf/valugether`와 연결된 `apps/mobile/eas.json`이 있으므로 다시 구성할 필요가 없습니다.
3. 저장소 루트에서 `npm run eas:preview`를 실행해 설치 가능한 preview APK를 만들고 실제 기기에서 확인합니다.
4. 실제 기기 검증이 끝난 뒤 `npm run eas:production`으로 production AAB를 생성합니다.
5. 기존 서명키가 없으면 EAS의 `Generate new keystore`를 사용하고 credentials 접근권한과 복구 절차를 별도 보관합니다.
6. Play Console의 Play App Signing을 활성화한 뒤 App integrity에서 배포 인증서 SHA-1을 확인합니다.

2026-09-26 진행 상태:

- EAS 프로젝트 연결 완료: `@kukuleaf/valugether`
- EAS project ID: `5186ee10-a655-4211-91bb-c7b5dc0b5e39`
- Android application ID: `com.valugether.app`
- preview APK용 Android 키스토어 생성 완료
- 이전 실패 원인: 저장소 루트를 앱으로 빌드하여 `expo/AppEntry`가 루트 `App`을 찾지 못함
- 조치: EAS 설정을 `apps/mobile`로 이동하고 로컬 Android 번들 검증 완료
- preview APK 빌드 완료: `e5f6854b-0b0b-4665-9584-7d26da33f802`
- Android 하단 시스템 내비게이션 safe-area와 겹치던 탭바 수정 완료
- preview HTTP 허용·production HTTP 차단을 동적 Expo 설정으로 분리 완료
- 수정 preview APK 빌드 완료: `bdc58509-a51f-49de-8f4f-353d58e573f0`, versionCode `2`
- EAS upload/preview 인증서 SHA-1: `28:12:14:D8:1C:8F:EE:D8:51:2B:A2:0F:D5:DA:44:C5:3F:3D:7E:CD`
- 위 인증서의 Kakao Android 키 해시(Base64 SHA-1): `KBIU2ByP7thRK6IP1dpExT89fs0=`. 네이티브 앱 키의 Android 설정에 등록 필요.
- 남은 작업: APK 실제 기기 설치·핵심 화면 확인, 키스토어 복구본의 안전한 별도 보관, 이후 production AAB 생성

2026-10-05 확인: EAS 환경변수 입력 화면에는 `development`만 선택되고 `preview`는 미선택 상태였습니다.
입력한 `172.26.48.1`은 PC의 WSL 가상 어댑터 주소이며 휴대폰에서 사용할 LAN 주소가 아닙니다.
현재 PC의 네트워크 목록에는 별도의 사설 LAN 주소가 없어 실제 기기용 API 주소를 아직 확정할 수 없습니다.
내부 IP 방식은 PC와 휴대폰이 같은 공유기 네트워크에 연결될 때만 사용합니다. 연결할 수 없다면 USB 디버깅과
`adb reverse tcp:3000 tcp:3000`을 사용하고 EAS `preview`의 API 주소를 `http://127.0.0.1:3000/api`로 설정합니다.
이 방식은 USB 연결과 API 실행을 유지하는 동안만 동작합니다. 휴대폰의 IP 주소를 API 주소로 사용하지 않습니다.
API를 PC에서 실행하고 휴대폰 브라우저로 선택한 방식의 `http://<PC LAN IP 또는 127.0.0.1>:3000/api/health`를 먼저 확인한 뒤,
`npm run eas:preview`로 새 APK를 빌드해 로그인·검색을 검증합니다. 모바일 데이터·다른 Wi-Fi에서는
이 preview API 주소가 동작하지 않습니다. 공개 배포 전에는 API를 외부 HTTPS 주소로 배포하고
production EAS 환경의 `EXPO_PUBLIC_API_BASE_URL`을 그 주소로 설정합니다.

키스토어 복구본은 `cd apps/mobile` 후 `npx eas-cli credentials --platform android`를 실행하고
`preview` → `credentials.json: Upload/Download credentials between EAS servers and your local json` →
`Download credentials from EAS to credentials.json` 순서로 받습니다. 생성되는 JSON·JKS와 비밀번호는
Git에 넣지 말고 암호화된 비밀번호 관리자나 별도 보안 저장소에 보관합니다. 저장소의 `.gitignore`에는
`credentials.json`, `*.jks`, `*.keystore` 차단 규칙을 추가했습니다.

공식 문서: <https://docs.expo.dev/build/setup/>, <https://docs.expo.dev/build-reference/apk/>

### 2. Google 로그인

1. Google Cloud 프로젝트와 OAuth consent screen을 만듭니다.
2. Android OAuth client를 만들고 package에 `com.valugether.app`을 입력합니다.
3. 개발용 debug SHA-1과 Play App Signing 배포 SHA-1에 대응하는 Android client를 각각 준비합니다.
4. 서버에서 ID token의 audience를 검증할 Web OAuth client도 만듭니다.
5. Android client ID는 `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, Web client ID/secret은 API 서버 환경변수에 저장합니다.
6. 앱에서 받은 token을 서버가 Google 공개키·issuer·audience·만료시간 기준으로 검증한 뒤 내부 계정과 연결합니다.

공식 문서: <https://developers.google.com/identity/protocols/oauth2>, <https://developers.google.com/android/guides/client-auth>

### 3. Kakao 로그인

1. Kakao Developers에서 `Valugether` 앱을 만듭니다.
2. Native app key의 Android 정보에 `com.valugether.app`과 debug/release key hash를 등록합니다.
3. Kakao 로그인을 활성화하고 이메일 등 필요한 최소 동의항목만 신청합니다.
4. Android callback scheme은 Kakao 규칙인 `kakao{NATIVE_APP_KEY}://oauth`를 사용합니다. Valugether 자체 딥링크와 구분합니다.
5. 동일한 Native app key를 모바일 `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY`와 API의 `KAKAO_NATIVE_APP_KEY`에 설정합니다. Admin key/client secret은 모바일에 절대 넣지 않습니다.
6. Android 네이티브 SDK에서 nonce와 OIDC ID 토큰을 받아 API가 Kakao 공개키·issuer·audience·nonce를 검증합니다. 최초 가입은 약관 동의가 필요하고 이메일 인증은 제외합니다.
7. 카카오 재인증 후 provider 연결 해제와 내부 계정 삭제 코드를 구현했습니다. 새 APK 실기기 검증이 남았습니다.
8. 외부에서 연결을 끊은 사용자의 웹훅은 공개 HTTPS API와 처리 엔드포인트 준비 후 등록합니다. Play 배포 인증서 키 해시는 별도로 추가합니다.

공식 문서: <https://developers.kakao.com/docs/ko/app-setting/app>, <https://developers.kakao.com/docs/ko/kakaologin/android>

### 4. Naver 로그인

1. Naver Developers에서 애플리케이션을 등록하고 네이버 로그인을 선택합니다. 개발용 키는 사용자에게 전달받았습니다.
2. Android 환경에 package `com.valugether.app`과 앱 이름을 등록하고 개발 중 사용할 테스트 계정을 추가합니다.
3. 먼저 Android 공식 SDK를 사용합니다. 웹 OAuth는 NestJS 공개 HTTPS 배포 후 callback URL과 연결 끊기 알림을 설정하며 현재는 보류합니다.
4. 이름·생일·성별·휴대전화번호 등 불필요한 항목을 제외합니다. 고유 식별자를 사용하며 이메일은 제공되지 않아도 가입할 수 있습니다.
5. API와 모바일 빌드에 같은 `NAVER_CLIENT_ID`·`NAVER_CLIENT_SECRET`을 설정합니다. 모바일은 공개 JavaScript 환경변수가 아닌 네이티브 리소스로 주입하지만 APK 추출 방지는 보장되지 않습니다. 노출된 Secret은 운영 전 재발급합니다.
6. 서버는 SDK refresh token을 우리 Client ID/Secret으로 교환한 새 토큰으로 프로필을 확인합니다. 약관 동의·로그인·로그아웃·탈퇴의 코드/모킹 회귀와 실제 기기 검증을 구분합니다.
7. Client ID/secret은 API 서버 Secret Manager에만 저장합니다.
8. 개발 완료 뒤 검수 자료와 로그인·동의·탈퇴 화면을 제출합니다.

공식 문서: <https://developers.naver.com/docs/login/devguide/devguide.md>

### 5. AdMob

1. AdMob 계정을 만들고 결제·신원 정보를 설정합니다.
2. 아직 Play에 게시되지 않았다면 unpublished Android 앱으로 `가치보는주식`을 등록합니다.
3. AdMob App ID와 필요한 광고 단위 ID를 발급합니다.
4. 개발 중에는 Google demo 광고 단위 또는 등록한 test device만 사용합니다. 실제 광고를 개발자가 클릭하지 않습니다.
5. Android SDK·동의 게이트·홈/결과 배너는 구현되어 있습니다. AdMob의 Privacy & messaging에서 필요한 지역의 메시지를 게시하고 개인정보처리방침·Google Play Data safety를 확정합니다. production EAS 환경에 실제 ID와 `EXPO_PUBLIC_ADS_ENABLED=true`를 입력합니다.
6. 도메인 확정 후 개발자 웹사이트에 `app-ads.txt`를 게시하고 Play 스토어의 개발자 웹사이트와 연결합니다.
7. 출시 직전에 production ID로 교체하고 test ID가 남지 않았는지 검사합니다.

공식 문서: <https://support.google.com/admob/answer/15948559>, <https://developers.google.com/admob/android/test-ads>, <https://support.google.com/admob/answer/9363762>

### 계정 생성 후 전달할 값

secret 값은 채팅에 붙이지 않습니다. 각 로컬 `.env` 또는 운영 Secret Manager에 직접 넣고
설정 완료 여부와 공개 client ID만 알려줍니다.

- Google Android client ID, Web client ID/secret 설정 완료 여부
- Kakao Native app key, REST API key/client secret 설정 완료 여부
- Naver client ID/secret 설정 완료 여부
- AdMob App ID와 banner unit ID 설정 완료 여부
- EAS project 연결과 Android signing SHA-1

## TO-BE 아키텍처

```text
Mobile/Web
   ↓
API Gateway/NestJS
   ├─ Auth/User
   ├─ Screening
   ├─ Portfolio-like Watchlist
   ├─ AI Orchestrator (future)
   └─ Admin
        ↓
PostgreSQL + Redis
        ↑
Data Pipeline / BullMQ Worker
  ├─ DART
  ├─ SEC
  ├─ KIS / Market Data
  └─ Future News/Macro
```
