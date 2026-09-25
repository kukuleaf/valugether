# 08. 보안 / 개인정보 최소화

## 수집 최소화

v1 회원 필수정보:

- 이메일
- 인증수단 정보(password hash 또는 social provider subject)
- 서비스 운영용 생성/상태 시각

기본적으로 수집하지 않음:

- 실명
- 전화번호
- 주소
- 생년월일
- 성별
- 주민번호
- 투자자산 규모
- 실제 증권계좌 정보

## 비밀번호

- Argon2id 권장
- DB에는 hash만
- 비밀번호 로그 금지
- 인증 실패 이유를 지나치게 구체적으로 노출하지 않음
- 재설정 완료 시 기존 refresh token 전체 폐기

## 이메일 인증과 재설정

- 로컬 이메일 가입자는 인증 전 `PENDING_VERIFICATION` 상태이며 로그인을 차단
- 인증·재설정 token 원문은 메일로만 전달하고 DB에는 SHA-256 hash만 저장
- token은 목적별 만료시간, 1회 사용, 재전송 cooldown 적용
- 메일 요청 API는 계정 존재 여부와 소셜 계정 여부를 같은 응답으로 숨김
- 소셜 로그인 전용 계정은 이메일 인증·비밀번호 재설정 대상에서 제외

## 토큰

- Access JWT: 짧은 만료
- Refresh: 랜덤 opaque token 권장
- DB에는 refresh token hash만
- 회전(rotation) 및 폐기 가능
- 모바일 저장은 SecureStore/Keychain 계열 사용

## 소셜로그인

- provider의 access token을 장기저장하지 않도록 설계
- 필요한 최소 scope만 요청
- 내부 user_id와 provider subject를 mapping
- provider가 검증한 이메일은 로컬 이메일 인증을 다시 요구하지 않음

## API Key

- 서버 환경변수/Secret Manager
- 모바일 번들에 넣지 않음
- 관리자 화면에서도 전체 키 표시 금지

## 관리자

- 일반 API와 권한 분리
- ADMIN role guard 필수
- 주요 변경 audit
- 허용오차/전략 수정은 before/after 저장
- 운영 전 MFA 검토
- 관리자 페이지 전체를 session proxy로 보호하고 API token은 `HttpOnly`, `SameSite=Lax` cookie에만 저장
- 관리자 mutation BFF는 요청 `Origin`이 실제 host와 일치할 때만 허용
- CSP, HSTS, frame 차단, MIME sniffing 차단, 최소 권한 Permissions-Policy 적용
- upstream `401`이면 관리자 session cookie 즉시 제거

## 의존성

- `npm audit` 결과 high/critical 0을 유지
- Nest upload 경로의 Multer는 루트 고정과 override로 보안 패치 버전 사용
- `npm audit --force`로 framework major를 강제 변경하지 않고 Expo/ExcelJS upstream moderate advisory를 추적

## Rate Limit

- 회원가입, 로그인, token 갱신, 이메일 인증, 비밀번호 재설정 POST를 IP·endpoint 단위로 제한
- 일반·고급 검색 POST도 별도 한도로 abuse 방지
- 제한 초과 시 `429`, `Retry-After`, 남은 횟수 헤더와 request ID 반환
- rate-limit key의 IP는 `IP_HASH_SALT` HMAC으로 해시하여 저장
- 로컬·단일 인스턴스는 memory, 운영·다중 인스턴스는 Redis 공유 카운터 사용
- Redis 일시 장애 시 30초 재연결 유예와 프로세스 내 memory 제한으로 가용성 유지
- 외부 API는 batch 내부 자체 throttle

## 로그 PII

IP가 꼭 필요하면 원문 대신 주기적으로 salt 가능한 hash 저장을 기본으로 합니다.

```text
ip_hash = HMAC-SHA256(IP, server_secret_salt)
```

## 개인정보 삭제

현재 로컬 계정 회원탈퇴 정책:

- 현재 비밀번호 재확인 후 `app_user`를 hard delete하여 같은 이메일 재가입 허용
- 비밀번호, 소셜 식별자, refresh/verification token, 역할, 동의, entitlement 삭제
- 관심종목, 프리셋, 알림, 설정, 검색 이력 삭제
- 기존 access JWT는 매 요청의 활성 계정 확인으로 즉시 무효화
- 오류 로그의 userId 문맥 삭제
- 감사 로그의 actor FK, 사용자 target, before/after 내용을 제거하고 행위 종류와 시각만 보존
- 운영 배치·약관·공지 기록은 사용자 FK를 `NULL`로 바꾸고 비개인 운영 기록만 보존

Google/Kakao/Naver 계정은 소셜 로그인 구현 시 provider 재인증 후 같은 삭제 transaction을
호출해야 합니다. 운영 출시 전 감사 로그 보존기간과 법정 보존 항목은 법률·내부정책으로
확정해야 합니다.

## 고지

앱 결과는 데이터 오류/지연 가능성과 투자 손실 위험을 명확히 고지합니다. AI 기능 추가 시 생성결과의 근거시점과 한계를 별도로 표시합니다.
