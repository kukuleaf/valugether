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

일반 사용자 전략을 DB에서 수정합니다. 전략 코드는 프리셋과 딥링크 호환성을 위해 고정하고,
표시 이름·설명·활성 상태·표시 순서·지표 조건·가중치·필수 여부를 관리합니다. 저장한 활성 전략은
모바일 홈과 일반 검색에 즉시 반영되며 모든 변경은 감사 로그에 기록됩니다.

```text
UNDERVALUED
  PER <= 15
  PBR <= 1.5
  ROE >= 8
```

실제 운영 전 시장별/업종별 차이를 검토하고 튜닝합니다.

## Notices

- 제목, 본문, 게시 시작·종료 시각 작성
- `DRAFT`에서 검토한 뒤 `PUBLISHED`로 게시
- 게시 중이며 현재 시각이 게시 기간 안인 공지만 모바일 홈에 노출
- 게시 종료 시 `ARCHIVED`로 보관
- 작성 중 공지만 삭제 가능
- 생성·수정·게시·보관·삭제 모두 감사 로그 기록

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
