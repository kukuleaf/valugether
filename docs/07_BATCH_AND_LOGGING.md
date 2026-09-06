# 07. 배치 및 로그

## 핵심 원칙

외부 API는 사용자 요청과 분리합니다.

```text
Scheduler
  ↓
Provider API 1~N회
  ↓
Normalize
  ↓
DB Upsert
  ↓
Derived Metric Calculation
  ↓
latest_metric_value Refresh
  ↓
사용자는 DB만 조회
```

## 권장 배치

### 가격

- `US_EOD_PRICE_SYNC`
  - 미국 장 마감 후 + 공급자 데이터 확정 시간을 고려
- `KR_EOD_PRICE_SYNC`
  - 국내 장 마감 후

### 재무

- `DART_FINANCIAL_SYNC`
  - 하루 1~여러 번 증분 공시 확인
- `SEC_FINANCIAL_SYNC`
  - nightly bulk 또는 증분

### 계산

- `DERIVED_METRIC_RECALC`
  - 가격/재무 sync 성공 후 변경된 security만 계산

## 배치 단계

예:

```text
US_EOD_PRICE_SYNC
  1. acquire_lock
  2. fetch_exchange_pages
  3. normalize
  4. map_security
  5. upsert_daily_price
  6. calculate_valuation_metrics
  7. refresh_latest
  8. release_lock
```

## 실패 정책

- 페이지 단위 retry: 지수 backoff
- 4xx 인증오류: 즉시 실패/관리자 알림
- 429: Retry-After 준수
- 5xx/network: 제한된 retry
- 일부 ticker 매핑 실패는 전체 batch 실패로 만들지 말고 skip 집계
- 동일 거래일 재실행은 idempotent upsert

## 로그 구조

### batch_job_run

한 번의 배치 실행 전체.

- started_at / ended_at
- status
- requested_by (scheduler/admin)
- inserted/updated/skipped/error counts

### batch_step_run

단계별 시간/건수/메시지.

### external_api_call_log

- provider
- endpoint group
- HTTP status
- duration
- request_count / returned_count
- error code

절대 저장 금지:

- API key
- Authorization header
- access token
- refresh token

### data_ingestion_log

데이터가 쌓이는 과정을 집계 단위로 기록.

예:

```text
provider=MARKETSTACK
entity=DAILY_PRICE
market=US
trade_date=2026-09-04
received=6120
mapped=6105
inserted=5980
updated=125
skipped=15
errors=0
```

### audit_log

운영/사용자 중요행위.

- actor_user_id
- action_code
- target_type/id
- before_json / after_json (민감정보 제거)
- request_id
- ip_hash
- user_agent 축약

## 보관주기

초기 제안:

- audit: 1년 이상 또는 법/운영정책 확정 후 조정
- API call detail: 90일
- batch summary: 장기 보관
- application errors: 90~180일
- search history: 사용자 기능 목적/분석 목적에 필요한 최소기간

실제 출시 시 개인정보처리방침/내부정책과 일치시켜야 합니다.
