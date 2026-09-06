# 15. 재무지표 계산 정책 초안

외부업체가 계산한 PER/ROE 등을 그대로 신뢰하는 대신, 가능한 지표는 원천 재무 + 가격으로 자체 계산합니다. 계산식은 반드시 `calculation_version`으로 버전 관리합니다.

## 기준 원칙

- 가격 기반 지표: 최신 확보 EOD 종가의 `trade_date`를 명시
- 이익/매출 기반 지표: 가능하면 TTM 우선, TTM 불가능 시 최근 FY임을 표시
- 평균 자산/자본: `(기초 + 기말) / 2` 우선
- 음수/0 분모: 무리하게 지표를 만들지 않고 NULL 처리 규칙 사용
- 통화가 필요한 지표는 동일 통화인지 확인
- Split/주식수 변화는 EPS/BPS/과거 price 비교 시 조정 여부 일관성 유지

## TTM 정책

TTM(Trailing Twelve Months)은 최근 연속 12개월 실적입니다.

- 매출, 영업이익, 순이익, EPS, CFO, CAPEX, FCF 같은 기간 누적 항목에 적용
- 자산, 부채, 자본 같은 시점 잔액은 합산하지 않고 최신 분기말 사용
- 동일 연결기준·통화·단위를 가진 정상 분기 4개가 있을 때만 계산
- DART 누적 분기값은 개별 분기값으로 변환한 뒤 합산
- 분기 누락·중복·기간 불일치 시 TTM을 만들지 않음
- TTM 계산 불가 시 최근 FY를 사용하고 결과에 `FY 기준` 표시
- 계산 결과에 사용한 공시일과 `calculation_version` 저장

## DART 연결 기준

- 연결재무제표가 있으면 연결재무제표 우선
- 연결재무제표가 없으면 별도재무제표 fallback
- 연결·별도 값을 섞어 TTM 또는 성장률을 계산하지 않음
- 결과에 `연결` 또는 `별도` 기준 표시

## 금융업 분리

- 은행·보험·증권·기타 금융업을 일반 기업 추천에서 제외
- 금융업 종목은 검색과 상세 조회에는 유지
- 일반 기업의 부채비율·유동비율·FCF 조건을 금융업에 적용하지 않음
- 금융업 전용 지표와 기준이 준비되기 전 `금융업 전용 평가기준 준비 중` 표시

## 기본식

```text
PER = Close Price / EPS(TTM)
Earnings Yield = 1 / PER
PBR = Close Price / BPS
BPS = Total Equity / Shares Outstanding
PSR = Market Cap / Revenue(TTM)
PCR = Market Cap / CFO(TTM)
ROE = Net Income(TTM) / Average Equity
ROA = Net Income(TTM) / Average Assets
Debt Ratio = Total Liabilities / Total Equity × 100
Current Ratio = Current Assets / Current Liabilities
Operating Margin = Operating Income / Revenue × 100
Net Margin = Net Income / Revenue × 100
FCF = CFO - CAPEX (CAPEX 부호 정책 정규화 후)
Dividend Yield = trailing/annualized DPS / Close Price × 100
```

## Growth

```text
YoY = (current / previous - 1) × 100
CAGR = (ending / beginning)^(1/years) - 1
```

음수→양수처럼 CAGR 의미가 깨지는 경우에는 NULL/별도 trend flag로 처리합니다.

## PER의 과거 평균

`AVG_PER_10Y`는 단순히 현재 PER를 10년 평균내는 것이 아니라, 각 과거 시점의 가격과 당시 사용 가능했던 EPS 기준을 명확히 정의해야 합니다. 룩어헤드 바이어스를 피하기 위해 향후 백테스트에서는 공시 가능 시점(filing_date)을 사용합니다.

## 계산 버전 예

```text
valuation-v1
profitability-v1
growth-v1
```

계산식 변경 시 기존 row를 덮어써 과거 결과를 잃지 말고 새 버전으로 재계산할 수 있게 합니다.
