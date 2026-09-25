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
  - 시장별 마지막 `company_id`를 `system_setting`의 `FINANCIAL_SYNC_CURSOR_KR/US`에 저장
  - 회사 처리 직후 checkpoint를 갱신하므로 중단 후 같은 명령으로 이어서 실행
  - 전체 순회 완료 시 cursor를 `0`으로 되돌림
  - SEC Company Facts 404와 빈 응답은 `NO_DATA`로 집계하고 batch 오류와 분리

### 계산

- `DERIVED_METRIC_RECALC`
  - 가격/재무 sync 성공 후 변경된 security만 계산

현재 구현에서는 재무 sync가 재무·성장·수익성 지표를 계산하고, 가격 sync가 변경된
종목의 `CLOSE_PRICE`, `PER`, `PBR`, `MARKET_CAP`, `DIVIDEND_YIELD`,
`EARNINGS_YIELD`를 같은 transaction에서 `PRICE_V1`으로 갱신합니다. 별도 worker로
분리하기 전에도 가격과 valuation 지표의 기준일이 일치해야 합니다.

## BullMQ worker

- `BATCH_WORKER_ENABLED=true`일 때 API 프로세스가 Redis queue와 단일 worker를 시작합니다.
- `batch_definition`의 `is_enabled`, `schedule_cron`, `timezone_name`, `max_retry`를 Job Scheduler에 동기화합니다.
- 지원 작업: `KR_EOD_PRICE_SYNC`, `US_EOD_PRICE_SYNC`, `DART_FINANCIAL_SYNC`, `SEC_FINANCIAL_SYNC`, `PRESET_MATCH_NOTIFY`, `DATA_QUALITY_CHECK`
- worker concurrency는 1이며 PostgreSQL advisory lock으로 같은 batch의 중복 실행을 한 번 더 막습니다.
- 수동 enqueue는 batch code 단위 BullMQ deduplication을 사용합니다.
- Redis가 시작 제한시간 안에 연결되지 않으면 API 시작을 실패시켜 worker 없는 상태의 오동작을 막습니다.
- 실패는 `max_retry + 1`회까지 60초 기준 지수 backoff로 재시도하고 마지막 시도까지 실패한 경우에만 최종 오류 문맥을 `application_error_log`에 기록합니다.
- 완료 job은 최대 24시간/500개, 실패 job은 최대 7일/1,000개 보관합니다.

관리자 API:

- `GET /api/admin/batches/queue`: queue count, scheduler, 정의 조회
- `POST /api/admin/batches/queue/:batchCode`: 즉시 enqueue
- `PATCH /api/admin/batches/schedules/:batchCode`: 활성화, cron, 재시도 횟수 변경
- `GET /api/admin/batches/data-quality`: 최근 품질 검사와 이슈 조회
- `POST /api/admin/batches/data-quality`: Redis 없이 즉시 품질 검사

## 데이터 품질 검사

`DATA_QUALITY_CHECK`는 다음을 검사하고 `data_quality_run`, `data_quality_issue`에 결과를
남깁니다.

- 거래소별 최신 가격 일수와 가격 보유 종목 비율
- 시장별 최신 재무 일수와 재무 보유 종목 비율
- 최신 가격의 0 이하 종가, 고가/저가 역전, 범위를 벗어난 종가, 음수 거래량
- 제한시간을 넘긴 `RUNNING` 배치
- 최근 `FAILED`, `PARTIAL_SUCCESS` 배치

이슈가 있으면 선택적으로 운영 이메일을 보냅니다. 같은 이슈 조합은 기본 24시간 동안
다시 보내지 않으며, 이메일 실패는 품질 검사 결과를 실패시키지 않고 별도 오류 로그로
격리합니다.

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

### HTTP 요청 상관관계

- 모든 API 요청에 UUID `x-request-id`를 부여하고 같은 응답 헤더로 반환
- 클라이언이 정상 UUID를 보내면 재사용하고, 잘못된 값은 서버가 새로 생성
- 접근 로그는 `event`, `requestId`, method, query string을 제외한 path, status, 처리 시간을 JSON으로 기록
- request body, Authorization, token, API key는 접근 로그에 기록하지 않음
- 검색 이력과 감사 로그에 현재 request ID를 자동 저장
- 전역 예외 필터가 오류 응답에 request ID를 넣고, 500 오류는 `application_error_log`에 같은 ID로 저장
- 예상하지 못한 500의 내부 메시지와 stack은 클라이언에 노출하지 않음

## 보관주기

초기 제안:

- audit: 1년 이상 또는 법/운영정책 확정 후 조정
- API call detail: 90일
- batch summary: 장기 보관
- application errors: 90~180일
- search history: 사용자 기능 목적/분석 목적에 필요한 최소기간

실제 출시 시 개인정보처리방침/내부정책과 일치시켜야 합니다.
