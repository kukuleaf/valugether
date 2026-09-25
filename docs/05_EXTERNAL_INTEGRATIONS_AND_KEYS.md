# 05. 외부 연동 및 발급해야 할 키

이 문서는 **개발자가 실제로 가입/발급해야 하는 것**을 체크리스트로 관리합니다.

## A. 필수 데이터

### A-1. OpenDART (한국 재무)

- 사이트: https://opendart.fss.or.kr/
- 인증키 신청: OpenDART 사이트의 `인증키 신청`
- 환경변수: `DART_API_KEY`
- 용도: 한국 상장기업 공시/재무제표
- 서버에서만 사용

TODO:

- [ ] 계정 생성
- [ ] API 인증키 발급
- [ ] 회사 고유번호(corp_code) 전체 동기화
- [ ] 사업보고서/분기보고서 재무 API 매핑
- [ ] 연결/별도재무제표 선택 규칙 확정

### A-2. SEC EDGAR (미국 재무)

- API: https://data.sec.gov/
- 문서: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- API Key: 없음
- 필수 환경변수: `SEC_USER_AGENT`
- 예: `StockScreener/0.1 contact@example.com`
- 용도: submissions, companyfacts, nightly bulk data

TODO:

- [ ] 서비스용 연락 이메일 결정
- [ ] User-Agent 설정
- [ ] CIK ↔ ticker 동기화
- [ ] 대량처리는 `companyfacts.zip` 야간 bulk 우선 검토
- [ ] SEC Fair Access 정책 준수(현재 공식 가이드: 총 10 req/s 이하)

### A-3. Market Data Provider (한국/미국 가격)

내부 코드에서는 특정 업체를 고정하지 않습니다.

환경변수:

```text
MARKET_DATA_PROVIDER=mock|marketstack|future
MARKET_DATA_API_KEY=
MARKET_DATA_BASE_URL=
```

#### MVP: 한국투자증권 Open API

- 용도: 한국 주식 일별 수정주가
- 외부 응답은 `KisPriceMapper`에서 `NormalizedDailyPrice`로 변환
- `provider_security_map`을 통해 한국투자 종목코드와 내부 `security_id` 연결
- 앱 키와 시크릿은 서버에서만 사용

```text
MARKET_DATA_PROVIDER=kis
KIS_APP_KEY=
KIS_APP_SECRET=
KIS_BASE_URL=https://openapi.koreainvestment.com:9443
KIS_REQUEST_INTERVAL_MS=100
KIS_TOKEN_CACHE_PATH=.cache/kis-token.json
```

호출 제한은 계정과 공식 공지에 맞춰 `KIS_REQUEST_INTERVAL_MS`를 조정합니다. 전체 종목 배치의 허용 여부와 데이터 외부 표시·저장 조건은 출시 전에 확인합니다.
접근 토큰은 유효기간 동안 메모리와 Git 제외 로컬 캐시에 보관해 재사용합니다. 캐시가 손상되면 자동 재발급하지 않습니다. 토큰 발급은 API 서버 단일 인스턴스에서만 수행하며, 다중 인스턴스 배포 전에는 공유 Secret Store와 분산 잠금을 추가합니다.

#### Marketstack 후보 (미국 시장 후속)

- 사이트: https://marketstack.com/
- 문서: https://marketstack.com/documentation
- 가격: https://marketstack.com/pricing
- 키: Marketstack 계정의 access key
- 현재 Basic 표기: $9.99/month, 10,000 req/month, EOD/10년 history/Commercial Use 포함
- 대상 기능: EOD 가격, ticker/exchange 정보, dividend/split 등

설계상 사용 예:

```text
/exchanges/XNAS/eod/latest
/exchanges/XNYS/eod/latest
```

처럼 거래소 단위로 페이지네이션하여 하루 한 번 DB에 저장하고, 사용자 호출 시 Marketstack을 직접 호출하지 않습니다.

**출시 전 필수 확인**

- [ ] 광고가 있는 소비자용 Android/Web 앱에서 회원에게 EOD 가격을 표시해도 되는지 서면 확인
- [ ] DB에 저장해 파생 PER/PBR을 계산/표시하는 방식 허용 확인
- [ ] exchange-wide endpoint의 quota 계산 기준 확인
- [ ] 대상 미국 거래소/티커 coverage 확인
- [ ] 재배포/외부 display 별도 계약 필요 여부 확인

Provider를 바꾸더라도 DB/스크리닝 코드는 유지됩니다.

## B. 로그인

### Google

- Console: https://console.cloud.google.com/
- OAuth docs: https://developers.google.com/identity/protocols/oauth2

필요:

- [ ] Google Cloud Project
- [ ] OAuth consent screen
- [ ] Android OAuth Client ID (package + SHA)
- [ ] Web client ID/secret (백엔드 검증/웹 관리자 필요 시)

환경변수 예:

```text
GOOGLE_WEB_CLIENT_ID=
GOOGLE_WEB_CLIENT_SECRET=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
```

### Kakao

- Console: https://developers.kakao.com/
- 로그인 문서: https://developers.kakao.com/docs/latest/ko/kakaologin/common

필요:

- [ ] 앱 생성
- [ ] Android 플랫폼 등록
- [ ] Redirect URI
- [ ] 동의항목 최소화

환경변수:

```text
KAKAO_REST_API_KEY=
KAKAO_CLIENT_SECRET=
```

### Naver

- Console: https://developers.naver.com/
- 로그인 문서: https://developers.naver.com/docs/login/devguide/devguide.md

필요:

- [ ] 애플리케이션 등록
- [ ] Callback URL
- [ ] Android package 등록
- [ ] 최소 프로필 항목만 요청

환경변수:

```text
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
```

## C. 광고

### Google AdMob

- 사이트: https://admob.google.com/

필요:

- [ ] AdMob 계정
- [ ] Android 앱 등록
- [ ] App ID
- [ ] Banner/Interstitial 등 Ad Unit ID
- [ ] 테스트 광고 ID로 개발
- [ ] 출시 전 app-ads.txt/스토어 설정 확인

환경변수 예:

```text
EXPO_PUBLIC_ADS_ENABLED=false
EXPO_PUBLIC_ADMOB_ANDROID_APP_ID=
EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID=
```

광고 SDK는 개인정보/동의 정책과 스토어 정책을 함께 검토합니다.

## D. 이메일

이메일 회원가입 시 인증메일/비밀번호 초기화가 필요합니다.

개발:

- Mailpit (docker-compose 포함)

초기 운영 발송 provider는 개인 계정으로 사용할 수 있는 Resend로 결정했습니다. 발신
도메인은 아직 미정입니다. 도메인 등록 전 `onboarding@resend.dev`는 계정 소유자 대상
전달 테스트에만 사용하고, 일반 사용자 발송은 활성화하지 않습니다. 로컬 개발은 Mailpit을
계속 사용합니다.

환경변수:

```text
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM=
EMAIL_VERIFICATION_URL=rightstockvalue://auth/verify-email
PASSWORD_RESET_URL=rightstockvalue://auth/reset-password
PRESET_ALERT_URL=rightstockvalue://custom
PRESET_ALERT_EMAIL_ENABLED=false
```

이메일 인증과 비밀번호 재설정은 이메일/비밀번호(`user_password`) 계정에만 적용합니다.
Google/Kakao/Naver 간편 로그인 계정은 소셜 provider의 검증 결과를 사용하므로 이 메일
인증·재설정 흐름의 대상이 아닙니다.

Resend SMTP 설정은 `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`,
`SMTP_SECURE=true`, `SMTP_USER=resend`입니다. API 키는 `apps/api/.env` 또는 운영
secret 저장소의 `SMTP_PASSWORD`에만 넣고 문서·예제 파일·Git에는 기록하지 않습니다.

프리셋 이메일 알림은 사용자별 opt-in과 `PRESET_ALERT_EMAIL_ENABLED=true`가 모두 충족될
때만 발송합니다. 도메인 인증 전에는 전역 스위치를 `false`로 유지합니다. 발송 결과는
`user_notification.email_status`에 `PENDING/SENT/FAILED/SKIPPED`로 기록됩니다.

## E. 오류 추적(선택)

Sentry 등 사용 가능.

```text
SENTRY_DSN=
```

사용자 이메일 등 PII 자동전송 옵션은 꺼두는 것을 기본으로 합니다.

## F. 키 관리 규칙

- `.env` Git commit 금지
- 모바일의 `EXPO_PUBLIC_*` 값은 **비밀이 아님**. 진짜 Secret 금지
- OpenDART/Market data/소셜 client secret은 NestJS 서버에만 보관
- 운영은 Secret Manager/Vault/클라우드 환경변수 사용
- 키 변경 이력을 audit log에 **키 값 없이** 기록
