# 18. 종목 마스터 동기화

스크리닝 전에 “어떤 종목들이 존재하는가”를 먼저 만들고, 각 공급자의 symbol을 내부 `security_id`에 연결해야 합니다.

## 한국

OpenDART의 `corpCode.xml`에는 다음 정보가 있습니다.

- corp_code
- corp_name
- corp_eng_name
- stock_code (상장사 6자리)
- modify_date

따라서:

```text
DART corpCode.xml
  ↓
company.dart_corp_code
company.display_name
security.ticker = stock_code
```

KOSPI/KOSDAQ/KONEX 구분이 필요할 때는 DART 공시목록 등의 `corp_cls` 또는 별도 공식 시장 마스터를 보강합니다.

초기 DB의 `KRX` exchange row는 한국시장 통합 논리값으로 사용할 수 있고, 이후 KOSPI/KOSDAQ을 별도 exchange로 세분화해도 `security_id` 중심 구조는 유지합니다.

## 미국

SEC는 공식적으로 ticker/CIK/exchange association 파일을 제공합니다.

```text
https://www.sec.gov/files/company_tickers_exchange.json
```

이 데이터로:

```text
company.sec_cik
company.display_name
security.ticker
security.exchange_id
```

를 구성합니다.

SEC도 해당 association 데이터의 정확성/범위를 보증하지 않는다고 안내하므로, Market Data Provider의 ticker/exchange 목록과 교차검증합니다.

## Provider Mapping

내부 symbol과 Marketstack symbol이 같아 보여도 문자열을 직접 join하지 않습니다.

```text
provider_security_map
  provider_id
  security_id
  external_symbol
  external_exchange
```

초기 자동매칭:

1. ticker 정규화
2. exchange/mic 확인
3. company name 보조확인
4. 확실한 row만 활성화
5. 미매핑 목록 관리자 화면 표시

## 상장폐지/티커변경

- 기존 `security_id`를 삭제하지 않음
- `is_active=false`, `delisting_date`
- ticker 변경은 변경이력 테이블을 향후 추가 가능
- 과거 price/financial data는 보존
