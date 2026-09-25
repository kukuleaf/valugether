# 11. 구현 현황 / TODO / TO-BE

기준일: 2026-09-25

표기 기준:

- `[x]` 코드 또는 SQL 구현 완료. 운영 환경 검증 완료를 뜻하지는 않는다.
- `[-]` 일부 구현. 뒤에 남은 작업을 적었다.
- `[ ]` 미구현 또는 외부 의사결정이 필요한 작업.

## 구현 완료

### 기반

- [x] 앱 이름 확정: 바른주식 밸류 / Right Stock Value
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
- [ ] Android 실제 기기 및 EAS build 검증

### P2 - 외부 계정과 출시 준비

- [ ] Android 패키지명 확정 (`com.example.stockscreener` 교체)
- [-] 운영 이메일 발송 provider는 Resend로 확정. 서비스 도메인·발신 주소 등록은 남음
- [ ] OpenDART/KIS 운영 키 및 사용조건 확인
- [ ] Google/Kakao/Naver 개발자 앱 생성, 소셜 로그인과 provider 재인증 탈퇴 구현
- [ ] AdMob 계정·앱·실제 ID 생성 및 SDK 연결
- [ ] 개인정보처리방침/이용약관 확정·게시
- [ ] Market data 외부 표시, DB 저장, 파생 표시 범위 서면 확인
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
