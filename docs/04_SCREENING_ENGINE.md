# 04. Screening Engine

## 목표

SQL `WHERE`로 정확 조건만 자르는 것이 아니라, 관리자가 설정한 허용오차 안의 후보까지 보여줍니다.

## 기본 비교

사용자 조건:

```text
PER <= 15
ROE >= 10
```

### LTE (작을수록 유리)

- exact: `actual <= target`
- near: `target < actual <= target + delta`
- fail: 그 밖

### GTE (클수록 유리)

- exact: `actual >= target`
- near: `target - delta <= actual < target`
- fail: 그 밖

## 허용오차

### PERCENT

```text
delta = abs(target) * tolerance
```

PER 목표 15, tolerance 10%:

```text
delta = 1.5
near upper = 16.5
```

따라서 PER 16도 검색됩니다.

ROE 목표 10, tolerance 10%:

```text
delta = 1
near lower = 9
```

ROE 9도 검색됩니다.

### ABSOLUTE

예: 목표 10에 `1.5` 직접 허용.

## Condition score

- exact: 100
- near: 허용오차 경계까지 선형으로 100 → 0 감소
- fail: 후보 제외

예시 LTE:

```text
actual <= target      : 100
actual = target+50%δ  : 50
actual = target+δ     : 0
```

최종:

```text
similarity = Σ(condition_score × weight) / Σ(weight)
```

## 결과 등급

- `EXACT`: 모든 조건 정확충족
- `NEAR`: 최소 한 조건 near이며 fail은 없음
- fail 조건이 하나라도 있으면 제외

정렬:

1. EXACT 우선
2. similarity desc
3. 추가 tie breaker(시가총액/종목명 등)

## Missing data

초기 정책:

- 조건 지표가 NULL이면 해당 종목 제외
- 결과에 억지로 0을 넣지 않음

추후 사용자가 `데이터 없음 허용`을 선택하는 기능은 별도 검토.

## Boolean/Trend

흑자 여부, EPS 상승 여부는 일반 비율 tolerance와 섞지 않습니다.

방법:

- `PROFITABLE_TTM` 0/1 파생 metric
- `EPS_GROWTH_YOY`
- `EPS_POSITIVE_GROWTH_YEARS`
- `PROFITABLE_CONSECUTIVE_YEARS`

처럼 서버에서 계산해 숫자로 저장합니다.

## 관리자 오차 설정 예

```text
SYS001 / 100 / PER / PERCENT / 0.10
SYS001 / 110 / ROE / PERCENT / 0.10
SYS001 / 120 / PBR / PERCENT / 0.05
SYS001 / 130 / DEBT_RATIO / PERCENT / 0.10
```

초기값은 운영 중 데이터 분포를 보고 조정해야 합니다. 5%가 항상 적절한 것은 아닙니다.
