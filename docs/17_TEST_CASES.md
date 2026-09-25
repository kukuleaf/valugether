# 17. 핵심 테스트 케이스

## 자동 API E2E

로컬 PostgreSQL과 임시 포트의 NestJS 앱을 사용합니다.

```bash
npm run test:e2e
```

자동 검증 범위:

- health, 일반 전략과 조건, 기본 지표, 시행 약관, 공개 공지
- 인증 필요 API 401, 로그인, 내 정보
- refresh token 회전과 이전 token 재사용 401
- 일반 사용자의 관리자 API 접근 403
- 검색 요청, 검색 이력 조회·삭제와 DTO whitelist 400
- 관심종목 추가·조회·삭제
- 프리셋 생성·조회·수정·삭제
- 프리셋 알림 설정
- `x-request-id` 생성·정상 UUID 재사용·잘못된 값 교체
- 400·401·500 오류 응답의 request ID 헤더/본문 일치
- 검색 이력·감사·앱 오류 DB 로그의 request ID 상관관계
- 예상하지 못한 500 응답의 내부 오류 은폐와 `application_error_log` 적재
- CORS allowlist 허용 Origin preflight과 비허용 Origin 응답 헤더 차단
- 운영 환경의 CORS allowlist 누락 시 기동 설정 거부
- 인증 API 제한 횟수 이후 429, 남은 횟수·재시도·request ID 헤더
- Redis를 공유하는 두 rate limiter 인스턴스의 카운터 일치
- 테스트 계정과 검색·감사 데이터 정리
- 고급 검색 `LTE`, `LT`, `GTE`, `GT`, `EQ`, `BETWEEN`, 거래소·상태 필터

`NODE_ENV=production`에서는 실행하지 않습니다. localhost가 아닌 DB는 명시적으로
`E2E_ALLOW_NONLOCAL_DATABASE=true`를 지정하지 않으면 거부합니다.

## 배치·큐·UI·복구 자동 검증

```bash
npm run test:batch
npm run test:queue
npm run test:ui:e2e
npm run db:backup-check
```

- 가격 배치: 첫 실행 insert, 같은 거래일 재실행 update, 중복 0건
- 가격 부분 실패: 잘못된 행만 savepoint rollback, 이후 정상 행 계속 처리, `PARTIAL_SUCCESS`
- BullMQ: 격리 Redis 연결, worker ready, 실제 데이터 품질 job 완료, failed 0, 테스트 DB 기록 정리
- 관리자: 모든 보호 경로 redirect, CSP/보안 헤더, same-origin mutation, 로그인, 각 화면, 공지 생성·삭제, Excel export, 로그아웃
- 모바일 web: 홈, 일반 검색 결과, 고급 조건 화면, 로컬 계정 로그인·프로필·로그아웃과 저장 세션 제거
- 백업 복구: PostgreSQL custom dump 생성, 격리 PostgreSQL 17 restore, table/company/security 건수 일치, 임시 자원 정리

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
