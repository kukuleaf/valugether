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

## Rate Limit

- 로그인/회원가입/비밀번호 초기화 강한 제한
- 일반 검색도 abuse 방지 제한
- 외부 API는 batch 내부 자체 throttle

## 로그 PII

IP가 꼭 필요하면 원문 대신 주기적으로 salt 가능한 hash 저장을 기본으로 합니다.

```text
ip_hash = HMAC-SHA256(IP, server_secret_salt)
```

## 개인정보 삭제

회원탈퇴 시:

- 인증수단 폐기
- 사용자 직접 데이터 삭제/익명화 정책 적용
- 법적/보안상 보관해야 하는 audit은 별도 근거에 따라 최소정보 보관

## 고지

앱 결과는 데이터 오류/지연 가능성과 투자 손실 위험을 명확히 고지합니다. AI 기능 추가 시 생성결과의 근거시점과 한계를 별도로 표시합니다.
