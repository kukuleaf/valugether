# 20. 상용 출시 체크리스트

## 데이터

- [ ] OpenDART 이용조건 재확인
- [ ] SEC Fair Access/데이터 사용정책 재확인
- [ ] Market Data 공급자에게 외부 display / DB 저장 / 파생지표 표시 사용형태 서면확인
- [ ] 가격 기준일 UI 표시
- [ ] 데이터 오류/지연 fallback
- [ ] 종목/공시 mapping 품질 샘플검수

## 보안

- [ ] 운영 Secret Manager
- [ ] CORS allowlist
- [ ] Admin MFA 검토
- [ ] Auth rate limit
- [ ] Refresh rotation/탈취대응
- [ ] 의존성 취약점 검사
- [ ] 관리자 API penetration/basic security test
- [ ] backup encryption/restore test

## 개인정보

- [ ] 개인정보처리방침
- [ ] 이용약관
- [ ] 탈퇴/삭제 처리
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
