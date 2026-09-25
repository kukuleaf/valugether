# 20. 상용 출시 체크리스트

## 데이터

- [ ] OpenDART 이용조건 재확인
- [ ] SEC Fair Access/데이터 사용정책 재확인
- [ ] Market Data 공급자에게 외부 display / DB 저장 / 파생지표 표시 사용형태 서면확인
- [ ] 가격 기준일 UI 표시
- [ ] 데이터 오류/지연 fallback
- [-] 데이터 품질 검사·운영메일 구현 완료. 운영 임계치 확정과 수신자/스케줄 활성화 필요
- [ ] 종목/공시 mapping 품질 샘플검수

## 보안

- [ ] 운영 Secret Manager
- [x] CORS allowlist 코드·검증 완료. 운영 도메인 확정 후 환경변수 입력 필요
- [ ] Admin MFA 검토
- [x] Auth/search memory·Redis rate limit과 Redis 장애 fallback
- [x] Refresh token rotation·폐기·재사용 차단 E2E
- [-] 의존성 audit 완료, high/critical 0. upstream Expo/ExcelJS moderate 추적 필요
- [-] 관리자 보호 경로, 권한, same-origin mutation, CSP/보안 헤더 자동 검사 완료. 외부 penetration test 필요
- [-] 로컬 PostgreSQL 17 자동 backup/restore 검증 완료. 운영 backup 암호화·보관·정기 훈련 필요

## 개인정보

- [ ] 개인정보처리방침
- [ ] 이용약관
- [-] 로컬 탈퇴/삭제 구현 완료. 소셜 provider 재인증과 법정 보존기간 확정 필요
- [ ] 광고 SDK 동의/스토어 고지
- [ ] 로그 보관기간 확정
- [ ] 개인정보 수집항목 실제 코드와 문서 일치

## 앱

- [ ] 실제 package name
- [ ] signing key
- [ ] Play Console
- [ ] AdMob test → production ID 전환
- [ ] app-ads.txt 검토
- [ ] crash monitoring
- [ ] accessibility/basic screen reader test

## 금융서비스 표현

- [ ] “추천/매수/매도” 표현 정책 검토
- [ ] 데이터 기반 스크리닝/정보제공 범위 법률검토
- [ ] 투자손실/정보오류 고지
- [ ] AI 추가 시 AI 결과의 투자자문 관련 별도 검토
