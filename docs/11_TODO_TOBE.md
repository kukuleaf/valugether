# 11. 구현 현황 / TODO / TO-BE

기준일: 2026-09-19

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
- [-] 감사 로그 작성. 공통 request ID와 전역 예외 필터는 남음

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
- [x] master/financial/price 동기화 CLI와 데이터 상태 확인 CLI
- [-] 오류 건수와 배치 상태 기록, BullMQ 자동 재시도 구현. 품질 임계치와 운영 알림은 남음

### 검색과 사용자 기능

- [x] 재무지표, 허용오차, 일반 전략 4종 초기 seed
- [x] 일반 전략 검색과 고급 조건 조합 검색 API
- [x] 거래소 필터, 정확/근접 판정, 유사도 정렬, 조건별 결과 설명
- [x] 검색 요청과 결과 건수 이력 저장
- [x] 모바일 일반검색, 고급검색, 결과, 종목 상세 화면
- [x] 기본 관심종목 조회·추가·삭제
- [x] 검색 프리셋 생성·조회·수정·삭제와 모바일 프리셋 화면
- [x] 프리셋 알림 조건 평가, 알림함, 알림 설정 화면

### 관리자 기능

- [x] 대시보드 요약
- [x] 허용오차 조회·편집
- [x] provider 상태, 배치 실행/이력, 감사 로그 조회
- [x] 약관 작성·수정·게시
- [x] 검색 순위 엑셀 export

## 다음 작업

### P0 - 로컬 통합 검증

- [ ] PostgreSQL 17에 `00`~`13` SQL 전체 신규 설치 검증
- [x] 실행 중인 API와 PostgreSQL로 회원가입/로그인/token 회전/검색/관심종목/프리셋 E2E 검증
- [-] 가격 배치 idempotency 검증. KIS 354종목 재실행은 insert 0/update 354/error 0 확인, Mock과 부분 실패 복구는 남음
- [-] OpenDART/SEC/KIS 실제 키 통합 테스트. DART 연속 2페이지 400/400, SEC 연속 2페이지 325개 적재·75개 `NO_DATA`, KIS 국내 422·미국 321종목 가격 처리 확인. Marketstack 검증은 남음
- [ ] API 자동 테스트와 관리자/모바일 핵심 흐름 테스트 추가
- [ ] 공통 request ID, 전역 예외 필터, 구조화 로그 추가

### P1 - MVP 기능 마감

- [x] 로컬 이메일 계정 인증, 재전송, 비밀번호 재설정, 모바일 딥링크 화면. 간편로그인은 대상 제외
- [ ] 회원 탈퇴와 개인정보 삭제/보존 처리
- [ ] 검색 이력 조회·삭제 UI/API
- [ ] 프리셋 알림의 이메일 또는 push 전송 채널 연결
- [x] BullMQ worker, DB 기반 cron 자동 스케줄, 수동 enqueue, 중복 실행 방지 연결
- [-] 실패 재시도 구현. 데이터 최신성/결측/이상치 검사와 운영 알림은 남음
- [ ] 관리자 strategy 편집과 공지 관리
- [ ] Android 실제 기기 및 EAS build 검증

### P2 - 외부 계정과 출시 준비

- [ ] Android 패키지명 확정 (`com.example.stockscreener` 교체)
- [ ] 도메인과 운영 이메일 발송 provider 확정
- [ ] OpenDART/KIS 운영 키 및 사용조건 확인
- [ ] Google/Kakao/Naver 개발자 앱 생성과 소셜 로그인 구현
- [ ] AdMob 계정·앱·실제 ID 생성 및 SDK 연결
- [ ] 개인정보처리방침/이용약관 확정·게시
- [ ] Market data 외부 표시, DB 저장, 파생 표시 범위 서면 확인
- [ ] CORS allowlist, API rate limit, Secret Manager, 관리자 MFA 검토
- [ ] 백업/복구, 모니터링/알림, 보안 점검
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
