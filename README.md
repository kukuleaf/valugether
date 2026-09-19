# 바른주식 밸류 (Right Stock Value) v0.1

초보자를 위한 현명한 기업 찾기.

국내·미국 주식을 대상으로 재무제표와 일별 주가를 수집합니다.
사용자가 원하는 조건과 **정확히 일치하거나 근접한 기업**을 찾는 상업용 앱의
초기 설계/샘플 프로젝트입니다. 미국 시장은 후속 범위입니다.

이 ZIP은 이후 실제 개발의 기준점으로 사용하기 위한 초안입니다.
모바일 앱, API 서버, 관리자 웹, PostgreSQL DDL/기초데이터, 외부 연동 규격,
배치/로그/보안/개인정보 최소수집 기준을 한 번에 정리했습니다.

## 핵심 범위

- Android 우선: React Native + Expo + TypeScript
- API: NestJS + TypeScript
- 관리자 웹: Next.js
- DB: PostgreSQL (DDL/Seed SQL 직접 제공)
- Cache/Queue: Redis + BullMQ 예정
- 인증: 이메일/비밀번호 + Google/Kakao/Naver 소셜 로그인 확장 구조
- 대상 시장: KOSPI, KOSDAQ, NASDAQ, NYSE
- MVP 목표: 데이터 수집·정규화·지표 계산·근거 설명을 포함한 회사 추천 로직 완성
- 일반 검색: 저평가 / 안정 / 성장 / 배당
- 고급 검색
  - 기본 검색: PER/PBR/EPS/ROE/부채비율/성장률 등
  - 상세 검색: 재무제표/재무비율 전체 지표 조합
- 근접검색: 관리자 지정 허용오차로 조건에 조금 못 미치는 종목도 검색
- 관심종목, 검색 프리셋, 검색 이력
- 강한 감사/배치/API 로그
- 광고 기반, 추후 AD_FREE/AI 권한 확장
- 주문/계좌연결/자동매매는 v1 제외

## 데이터 원천 기본 방향

- 한국 재무: OpenDART
- 미국 재무: SEC EDGAR / Company Facts / bulk data (MVP 이후)
- 시장가격: `MarketDataProvider` 인터페이스로 분리
  - MVP: 한국투자증권 Open API 일별 수정주가
  - 후속 후보: Marketstack EOD
  - 공급자 변경 가능하도록 외부 DTO와 내부 모델을 분리
- 사용자 요청 시 외부 API를 실시간 호출하지 않음
  - 배치가 하루 1회 데이터를 DB에 적재
  - 앱 검색/상세는 PostgreSQL만 조회

## 시작 순서

1. `docs/01_REQUIREMENTS.md` 검토
2. `docs/13_DECISIONS.md`에서 아직 미확정인 항목 확인
3. PostgreSQL 실행 후 `database/sql`을 번호 순서대로 실행
4. `.env.example`을 복사해 API 키/DB 정보를 입력
5. API 서버 실행
6. 모바일 앱 및 관리자 웹 실행
7. OpenDART/SEC/KIS 환경변수 설정
8. 아래 실데이터 동기화 실행

## 로컬 인프라

```bash
docker compose up -d
```

기본 포트:

- PostgreSQL: 5433 (컨테이너 내부 5432)
- Redis: 6379
- Mailpit SMTP: 1025
- Mailpit UI: 8025
- NestJS API: 3000
- Next.js Admin: 3100
- Expo: Expo CLI 기본 포트

## SQL 실행

`00_create_database.sql`은 접속 DB 자체를 만드는 파일이므로 PostgreSQL 관리자 DB(`postgres`)에서 실행합니다.

그 후 생성한 DB에 접속하여 `01`~`12`를 순서대로 실행합니다.

```text
database/sql/
  00_create_database.sql
  01_extensions.sql
  02_schema.sql
  03_seed_common_codes.sql
  04_seed_metrics.sql
  05_seed_settings_and_tolerances.sql
  06_seed_strategies.sql
  07_seed_providers_and_batches.sql
  08_indexes_and_views.sql
  09_seed_demo.sql
  10_terms_versioning.sql
  11_preset_notifications.sql
  12_global_alerts_exchanges.sql
```

로컬 샘플 계정(`09_seed_demo.sql` 적용 후):

```text
이메일: demo@rightstock.local
비밀번호: DemoPassword1!
```

기존 개발 DB에 약관 구조만 추가할 때:

```bash
npm run db:terms
```

## 실데이터 동기화

```bash
npm run db:global-alerts-exchanges
cd apps/api
npm run sync-data -- master KR
npm run sync-data -- master US
npm run sync-data -- financial KR 20
npm run sync-data -- financial US 20
npm run sync-data -- price XKRX
npm run sync-data -- price XKOS
npm run sync-data -- price XNAS
npm run sync-data -- price XNYS
npm run data-status
```

KIS 접근 토큰은 발급 결과를 `.cache/kis-token.json`에 저장해 유효기간 동안 재사용합니다.
유효 토큰이 이미 발급됐지만 캐시에 없다면 같은 날 가격 동기화를 다시 실행하지 않습니다.

## 문서

- `00_OVERVIEW.md` : 전체 개념
- `01_REQUIREMENTS.md` : 요구사항
- `02_ARCHITECTURE.md` : 시스템 구조
- `03_DATABASE.md` : DB 설계 기준
- `04_SCREENING_ENGINE.md` : 정확/근접 검색 알고리즘
- `05_EXTERNAL_INTEGRATIONS_AND_KEYS.md` : 발급해야 할 키/사이트
- `06_API_MAPPING.md` : 외부 API ↔ 내부 모델 매핑 원칙
- `07_BATCH_AND_LOGGING.md` : 배치/로그
- `08_SECURITY_PRIVACY.md` : 보안/개인정보
- `09_ADMIN.md` : 관리자 웹
- `10_MOBILE_UI.md` : 모바일 UI
- `11_TODO_TOBE.md` : 개발 순서/고도화
- `12_RUNBOOK.md` : 실행/운영 가이드
- `13_DECISIONS.md` : 확정/미확정 의사결정
- `14_EXCEL_MAPPING.md` : 기존 2025 엑셀 → 앱 지표 매핑
- `SOURCES.md` : 외부 문서/공식 링크

## 중요

이 초안은 **실제 서비스 출시 전 법률/라이선스/개인정보/스토어 정책 검토를
대체하지 않습니다.** 특히 시장가격 데이터는 공급자 플랜의 `Commercial Use`
문구만 보지 말고, 최종 서비스 형태(광고 포함, 회원에게 EOD 가격 표시, DB 저장,
파생지표 표시)를 공급자에게 서면 확인한 뒤 오픈하는 것을 권장합니다.
