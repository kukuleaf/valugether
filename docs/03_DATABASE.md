# 03. DB 설계 기준

## 원칙

1. 공통코드는 분류값에 사용
2. 숫자 설정값은 별도 설정/도메인 테이블 사용
3. 외부 공급자 코드를 내부 PK로 사용하지 않음
4. 재무 지표는 행 기반(EAV에 가까운 Metric Fact)으로 정규화하되, 검색 성능을 위해 최신값 테이블을 별도 유지
5. 원본 사실값과 계산값 구분
6. 사용자 개인정보/인증정보 분리
7. 로그는 운영 데이터와 분리 가능하도록 테이블 경계 명확화

## 주요 테이블 그룹

### Common / Config

- common_code_group
- common_code
- system_setting

### User / Auth

- app_user
- user_password
- user_social_account
- user_refresh_token
- user_role
- user_consent
- terms_document
- entitlement
- user_entitlement

`terms_document`는 약관 종류 코드와 버전을 함께 보관합니다. 작성 중, 배포 중, 이전 버전
상태를 구분하며 배포된 문서는 수정하지 않습니다. `user_consent.term_id`로 사용자가 실제로
확인한 약관 원문과 버전을 추적합니다.

### Company / Security

- exchange
- company
- security

기업(company)과 거래되는 증권(security)을 분리하여 동일 기업의 복수 클래스주/시장 확장을 고려합니다.

### Provider

- data_provider
- data_provider_capability
- provider_security_map
- provider_metric_mapping

### Financial

- financial_metric
- financial_period
- financial_fact
- derived_metric_value
- latest_metric_value

`financial_fact`는 공시에서 얻은 정규화 사실값.
`derived_metric_value`는 PER/ROE/성장률 등 계산값.
`latest_metric_value`는 스크리닝용 최신 스냅샷.

### Market

- daily_price
- dividend_event
- split_event

### Screening

- screen_metric_tolerance
- screen_strategy
- screen_strategy_condition
- screen_preset
- screen_preset_condition
- screen_search_log

### User feature

- watchlist
- watchlist_item

### Ops

- batch_definition
- batch_job_run
- batch_step_run
- external_api_call_log
- data_ingestion_log
- data_quality_run
- data_quality_issue
- audit_log
- application_error_log
- notice

## 공통코드와 SYS001

사용자 제안인 `SYS001 = 오차설정` 개념은 남깁니다. 다만 실제 허용오차 숫자를 `common_code`에 문자열로 억지 저장하지 않습니다.

```text
common_code_group
  SYS001  검색 허용오차 유형

screen_metric_tolerance
  setting_group_code = SYS001
  setting_detail_code = 100
  metric_code = PER
  tolerance_type = PERCENT
  tolerance_value = 0.10
```

이렇게 하면 공통분류와 도메인 설정을 동시에 만족합니다.

## 재무 Metric 방식의 장단점

장점:

- 지표 추가 시 컬럼 수백 개 ALTER 불필요
- 국가/공시체계 차이를 Mapping으로 흡수
- 상세검색 UI를 DB 기반으로 동적 생성

단점:

- 단순 wide table보다 검색 SQL 복잡

해결:

- `latest_metric_value`를 검색 전용으로 유지
- 인덱스 `(metric_id, numeric_value, security_id)`
- 많이 쓰는 조합은 materialized view/검색 전용 wide cache를 추후 추가

## 금액 통화

원천 금액은 통화와 함께 저장합니다. 국가가 다르므로 KRW/USD를 단순 비교하지 않습니다. 비율/성장률은 비교 가능하지만 매출액 절대값 검색은 사용자가 통화/시장 기준을 명시하도록 합니다.
