# 20. 상용 출시 체크리스트

## 데이터

- [ ] OpenDART 이용조건 재확인
- [ ] SEC Fair Access/데이터 사용정책 재확인
- [ ] Market Data 공급자에게 외부 display / DB 저장 / 파생지표 표시 사용형태 서면확인
- [x] 검색 결과·맞춤기업·종목 상세 가격 기준일 UI 표시. 각 검색 지표의 기준일도 표시
- [-] 시세 누락·지연 및 검색/상세 API 오류 fallback 구현. 실제 기기·운영 데이터에서 문구/임계치 검수 필요
- [-] 데이터 품질 검사·운영메일 구현 완료. 운영 임계치 확정과 수신자/스케줄 활성화 필요
- [ ] 종목/공시 mapping 품질 샘플검수

## 보안

- [ ] 운영 Secret Manager
- [x] CORS allowlist 코드·검증 완료. 운영 도메인 확정 후 환경변수 입력 필요
- [ ] Admin MFA 검토
- [x] Auth/search memory·Redis rate limit과 Redis 장애 fallback
- [x] Refresh token rotation·폐기·재사용 차단 E2E
- [-] 2026-10-11 production 의존성 audit: 총 31건(critical 0, high 20, moderate 11). Next.js 16.3.8·Multer 2.4.0·Nest Express 11.2.7 및 호환 전이 의존성을 패치하고 빌드·회귀를 재검증했다. 패치가 없는 upstream 의존성과 major 변경이 필요한 항목은 출시 전 추적·대응해야 한다.
- [-] 관리자 보호 경로, 권한, same-origin mutation, CSP/보안 헤더 자동 검사 완료. 외부 penetration test 필요
- [-] 로컬 PostgreSQL 17 자동 backup/restore 검증 완료. 운영 backup 암호화·보관·정기 훈련 필요

## 개인정보

- [-] 개인정보 처리방침 초안과 DB `DRAFT` 생성 완료. 운영자·수탁사·보유기간 입력 및 법률 검토 필요
- [-] 이용약관·투자정보·마케팅 동의 초안과 DB `DRAFT` 생성 완료. 검토 후 정식 버전 게시 필요
- [-] 로컬 탈퇴/삭제와 Kakao 재인증 탈퇴 코드 완료. Android 실기기 검증, 외부 연결 해제 웹훅, 법정 보존기간 확정 필요
- [-] Android AdMob SDK·UMP 동의 선행·개인정보 옵션·개인정보 안내 화면 및 자동검증 구현 완료. 실제 운영 App ID의 UMP 메시지, 게시된 개인정보 처리방침과 Play 데이터 안전성 고지는 운영 계정에서 검증 필요
- [ ] 로그 보관기간 확정
- [ ] 개인정보 수집항목 실제 코드와 문서 일치

## 앱

- [x] Android package name `com.valugether.app`
- [-] EAS Android signing key 생성 완료. 복구본의 안전한 별도 보관 필요
- [x] 과거 EAS preview APK 빌드 완료. 2026-10-11 AdMob 포함 로컬 Android debug APK 빌드도 완료했으며, 최신 EAS APK/AAB 배포와는 구분한다.
- [-] Kakao 네이티브 OIDC 로그인 코드·로컬 DB 테스트 완료. 앱 키 환경변수·새 APK 검증 필요
- [ ] preview APK 실제 기기 테스트
- [ ] production AAB 빌드
- [ ] Play Console
- [x] EAS development·preview 테스트 광고 / production 실제 App ID·홈·검색 결과 Unit ID 분리. 프로필별 AndroidManifest 자동검증 통과
- [ ] 새 production AAB의 실제 광고 송출·UMP 동의 및 개인정보 옵션 검증
- [ ] app-ads.txt 검토
- [ ] crash monitoring
- [ ] accessibility/basic screen reader test

최신 광고 배치·설정·테스트 결과와 출시 잔여 항목은 `23_ADS_AND_RELEASE_AUDIT.md`를 확인한다.

## 금융서비스 표현

- [ ] “추천/매수/매도” 표현 정책 검토
- [ ] 데이터 기반 스크리닝/정보제공 범위 법률검토
- [ ] 투자손실/정보오류 고지
- [ ] AI 추가 시 AI 결과의 투자자문 관련 별도 검토
