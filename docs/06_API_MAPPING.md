# 06. 외부 API ↔ 내부 모델 매핑

## 목적

공급자 응답 형식이 바뀌거나 공급자를 교체해도 비즈니스 로직을 수정하지 않도록 합니다.

## 가격 데이터 내부 계약

```ts
interface NormalizedDailyPrice {
  providerCode: string;
  externalSymbol: string;
  exchangeMic: string;
  tradeDate: string; // YYYY-MM-DD
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  adjustedClose: number | null;
  volume: number | null;
  currency: string | null;
}
```

Marketstack은 Mapper가 자신의 필드명을 이 구조로 변환합니다.

```text
MarketstackResponse
  .symbol
  .exchange
  .date
  .open/high/low/close
  .adj_close
  .volume
       ↓ mapper
NormalizedDailyPrice
       ↓ provider_security_map
internal security_id
       ↓
daily_price
```

## 재무 데이터 내부 계약

```ts
interface NormalizedFinancialFact {
  providerCode: string;
  externalCompanyId: string; // DART corp_code / SEC CIK
  metricCode: string; // REVENUE, NET_INCOME ...
  periodType: 'FY' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'TTM';
  startDate?: string;
  endDate: string;
  filingDate?: string;
  value: number;
  currency?: string;
  unit?: string;
  sourceReportId: string;
}
```

OpenDART 보고서 코드는 다음처럼 분기 단위로 정규화합니다.

```text
11013 → Q1
11012 → Q2 (반기 누적값은 단독 2분기 값으로 변환)
11014 → Q3 (3분기 누적값은 단독 3분기 값으로 변환)
11011 → FY, 필요한 경우 FY-Q1-Q2-Q3으로 Q4 계산
```

## 종목 상세 응답

`GET /api/stocks/:id`는 다음 정보를 한 번에 반환합니다.

- 회사·종목·거래소 기본정보
- 최신 주가와 최근 120개 일별 OHLC·수정종가·거래량
- 현재 재무지표 전체
- 각 지표의 공시/계산 이력과 사업연도·분기·연결 여부
- 배당·주식분할 내역

분기 이력이 없는 지표는 `history: []`이며 앱은 최신값만 표시합니다. 앱이 OpenDART를 직접 호출하지 않고, 배치에서 외부 응답을 정규화한 뒤 상세 API가 제공합니다.

## Provider Metric Mapping

외부 taxonomy를 직접 financial_metric에 박지 않습니다.

예:

```text
SEC / us-gaap:Revenues             → REVENUE
SEC / us-gaap:SalesRevenueNet      → REVENUE (fallback)
DART / 매출액                      → REVENUE
DART / 영업수익                    → REVENUE (업종별 mapping)
```

`provider_metric_mapping`에는 우선순위와 유효기간을 둘 수 있습니다.

## 같은 지표가 여러 태그로 오는 문제

SEC XBRL은 기업마다 다른 태그를 사용할 수 있으므로 다음 순서가 필요합니다.

1. 표준 taxonomy 후보 우선순위
2. 기간/폼(10-K, 10-Q) 검증
3. unit 검증
4. 중복 fact 선택 규칙
5. custom taxonomy는 승인된 mapping만 허용
6. 선택된 source fact의 trace를 보관

## 재무 계산 분리

외부에서 PER/ROE를 제공하더라도 가능하면 원천 데이터로 자체 계산합니다.

```text
raw facts + price
    ↓
MetricCalculator(versioned)
    ↓
derived_metric_value
```

계산식 버전을 저장하여 과거 결과를 재현할 수 있게 합니다.

## Adapter 디렉터리 예

```text
providers/
  core/
    market-data.provider.ts
    financial-data.provider.ts
    normalized-models.ts
  marketstack/
    marketstack.external.ts
    marketstack.mapper.ts
    marketstack.provider.ts
  dart/
    dart.external.ts
    dart.mapper.ts
    dart.provider.ts
  sec/
    sec.external.ts
    sec.mapper.ts
    sec.provider.ts
  mock/
```
