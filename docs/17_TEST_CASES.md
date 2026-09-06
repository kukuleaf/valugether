# 17. 핵심 테스트 케이스

## 근접검색

기준:

```text
PER <= 15, tolerance 10%
ROE >= 10, tolerance 10%
```

예상:

| PER | ROE | 결과  |
| --: | --: | ----- |
|  14 |  12 | EXACT |
|  16 |  11 | NEAR  |
|  14 | 9.5 | NEAR  |
|  16 | 9.5 | NEAR  |
|  17 |  12 | FAIL  |
|  14 |   8 | FAIL  |

## 데이터 누락

PER 값이 없고 조건에 PER가 포함되면 초기 정책상 제외.

## Provider

- 같은 외부 symbol이 다른 exchange에 있을 때 잘못 매핑하지 않음
- mapping 없는 ticker는 skip + `data_ingestion_log.skipped_count`
- 동일 거래일 재실행 시 INSERT 중복 없음
- API key/Authorization이 로그에 없음

## Auth

- 이메일 중복
- 잘못된 password
- suspended user
- expired refresh
- revoked refresh 재사용
- ADMIN API 일반 user 접근 403

## Admin

- tolerance 변경 audit before/after
- provider secret 미표시
- batch 재실행 audit 추가(구현 예정)

## 개인정보

로그 검색으로 다음 문자열이 존재하지 않아야 함:

- password 원문
- refresh token 원문
- DART_API_KEY
- MARKET_DATA_API_KEY
