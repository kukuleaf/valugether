# 16. Provider Contract 상세

## 설계 목표

사용자가 말한 “상대가 주는 것과 우리가 받는 것을 별개로 분리해서 매칭”을 코드/DB 둘 다 적용합니다.

## 4단계

```text
1. External DTO
   공급자 원문 모양 그대로

2. Mapper
   필드명/날짜/통화/단위/종목코드를 내부 표준으로 변환

3. Normalized Contract
   NestJS 나머지 모듈이 아는 유일한 외부데이터 계약

4. Persistence Mapping
   provider_security_map / provider_metric_mapping으로 내부 PK와 연결
```

## 금지

ScreeningService가 다음을 알면 안 됩니다.

```text
adj_close
access_key
CIK000...
DART account_nm
Marketstack exchange endpoint
```

ScreeningService는 오직:

```text
security_id
metric_code
numeric_value
as_of_date
```

를 봅니다.

## 공급자 교체 예

Marketstack → VendorB 변경:

필요:

- VendorBExternalDto
- VendorBMapper
- VendorBProvider
- data_provider row
- provider_security_map

불필요:

- screening algorithm 수정
- mobile 수정
- admin 검색 UI 수정
- financial_metric 수정
- 사용자 preset 수정

## Raw payload 저장 여부

초기에는 모든 raw JSON을 영구 저장하지 않습니다. 필요 시 object storage에 배치 단위 압축 원본을 제한기간 저장하는 구조를 추가합니다.

장점:

- 공급자 오류 조사
- 매핑 변경 후 재처리

주의:

- 라이선스가 원본 데이터 보관을 허용하는지 확인
- DB에 raw payload를 무제한 저장하지 않음
