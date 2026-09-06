# 09. 관리자 웹

## 메뉴

```text
Dashboard
Users
Stocks / Data Quality
Metrics
Screen Strategies
Tolerance Settings
Common Codes
System Settings
Providers
Batch Jobs
Logs
Notices
Terms
```

## Dashboard

- 총/활성 회원
- 오늘 검색 수
- 관심종목 추가 수
- 마지막 KR/US 가격 데이터 날짜
- 마지막 DART/SEC 적재시각
- 실패 배치
- 외부 API 오류율
- 미매핑 종목 수

## Tolerance Settings

관리자가 지표별 허용오차 수정.

예:

| Code | Metric | Type    | Value |
| ---- | ------ | ------- | ----: |
| 100  | PER    | PERCENT |  0.10 |
| 110  | ROE    | PERCENT |  0.10 |
| 120  | PBR    | PERCENT |  0.05 |

변경 시 audit 필수.

## Strategy

일반 사용자 전략을 DB에서 수정:

```text
UNDERVALUED
  PER <= 15
  PBR <= 1.5
  ROE >= 8
```

실제 운영 전 시장별/업종별 차이를 검토하고 튜닝합니다.

## Provider

- ENABLED/DISABLED
- 마지막 성공
- 오늘 API 호출 수
- 장애상태
- 지원 시장

API key 값은 관리자에게 보여주지 않습니다.

## Batch

- 최근 실행
- 단계
- 처리건수
- 오류
- 수동 재실행

수동 재실행은 권한과 audit가 필수입니다.

## Terms

- 서비스 이용약관, 개인정보, 투자정보 안내, 마케팅 등 임의 종류 추가
- 종류별 버전 생성
- 작성 중 문서만 수정
- 검토 후 배포, 이전 배포본 자동 보관
- 앱은 현재 시행 중인 최신 배포본만 조회
- 회원 동의는 약관 ID와 버전으로 기록

## 개발 초안 주의

관리자 API는 Access Token과 ADMIN 권한을 모두 검사합니다. 실서비스에서는 관리자 계정의
다중 인증과 접근 IP 정책을 추가 검토합니다.
