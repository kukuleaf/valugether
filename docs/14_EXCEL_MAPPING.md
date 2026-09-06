# 14. 2025 엑셀 → 앱 매핑

사용자가 2025년 미국 주식 분석에 사용한 엑셀의 시트 구조를 기준으로 앱의 고급 기본검색 항목을 잡았습니다.

확인된 시트:

- 투자원칙
- 기업순위
- 매출기준_기업분석
- 영업이익기준_기업분석
- 투자대상

확인된 주요 판단항목:

| 엑셀 개념           | 앱 metric                                     |
| ------------------- | --------------------------------------------- |
| PER                 | PER                                           |
| 1/PER               | EARNINGS_YIELD                                |
| 현재 EPS            | EPS_DILUTED / EPS_BASIC                       |
| 현재 주가           | CLOSE_PRICE                                   |
| PER 25/20/15 적정가 | FAIR_PRICE_BY_PE_* (향후 파생 metric/계산 UI) |
| PBR                 | PBR                                           |
| EPS 과거/현재       | EPS_DILUTED + history                         |
| EPS 증가            | EPS_GROWTH_YOY / EPS_CAGR_3Y                  |
| ROE                 | ROE                                           |
| 매출 증가           | REVENUE_GROWTH_YOY / CAGR                     |
| 흑자 여부           | PROFITABLE_TTM / PROFITABLE_YEARS             |
| 부채비율            | DEBT_RATIO                                    |
| 유동비율            | CURRENT_RATIO                                 |
| PSR                 | PSR                                           |
| 10년 평균 PER       | AVG_PER_10Y                                   |

## 앱에서는 더 확장

엑셀은 핵심 판단용으로 유지하되 상세검색에서는:

- 재무상태표 전체 주요계정
- 손익계산서 전체 주요계정
- 현금흐름표 전체 주요계정
- 수익성/안정성/성장성/가치평가 파생지표

를 `financial_metric` 마스터로 확장합니다.

## 유지할 사고방식

엑셀에서 사람이 하던 과정:

```text
재무 데이터 찾기
→ 기록
→ PER/부채/PBR/EPS/흑자 등 비교
→ 투자대상 분류
```

앱:

```text
외부 데이터 자동 수집
→ 정규화/계산
→ 사용자 조건
→ 정확/근접 후보
→ 상세근거
→ 관심종목/프리셋
```
