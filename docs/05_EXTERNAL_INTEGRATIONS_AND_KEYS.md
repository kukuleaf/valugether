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
- 예: `Valugether/0.1 contact@example.com`
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
- [x] Android OAuth Client ID 생성 및 `com.valugether.app` 패키지 등록 (사용자 제공 콘솔 화면 확인)
- [ ] 등록된 SHA-1이 EAS preview APK 서명과 일치하는지 확인; Play 앱 서명 SHA-1도 출시 전 등록
- [ ] Web application OAuth Client ID (Android에서 발급받은 ID 토큰의 서버 검증용)

사용자가 제공한 `client_secret_817021645615-01s3hcmurbsjseosgvofe94i359fs2u2.apps.googleusercontent.com.json`에는 `installed.client_id`가 있고 `client_secret`은 없습니다. JSON 형식만으로 유형을 단정할 수 없었으나, 이후 제공한 Google Cloud Console 화면에서 이 ID가 **Android**용이고 패키지가 `com.valugether.app`임을 확인했습니다. 콘솔에 SHA-1도 등록되어 있지만 실제 EAS preview APK 서명과 일치하는지는 아직 확인하지 못했습니다. Play 배포용 서명 SHA-1은 별도 등록 대상입니다. 서버가 Android Google 로그인의 ID 토큰을 검증하려면 동일 프로젝트의 **Web application** 클라이언트 ID도 필요합니다. ID 토큰 검증만 할 때 Web client secret은 필요하지 않습니다. 이 파일은 Android의 `google-services.json`이 아니며 앱에 복사하지 않습니다.

환경변수 예:

```text
GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
```

### Kakao

- Console: https://developers.kakao.com/
- 로그인 문서: https://developers.kakao.com/docs/latest/ko/kakaologin/common

필요:

- [x] 앱 생성, 카카오 로그인·OIDC 활성화 (사용자 확인)
- [x] Android 네이티브 앱 키에 `com.valugether.app`과 EAS preview 키 해시 등록 (사용자 확인)
- [ ] Android 실기기 로그인 검증: 모바일/API 양쪽에 동일한 네이티브 앱 키 설정 후 새 APK 빌드
- [ ] 동의항목 최소화. 이메일은 선택 정보이며 소셜 가입에 필수로 요구하지 않음
- [ ] 외부 연결 해제 웹훅: 공개 HTTPS API와 수신 검증 구현 후 등록
- [ ] Play App Signing 배포 인증서의 별도 키 해시 등록

환경변수:

```text
KAKAO_NATIVE_APP_KEY=                # API: ID 토큰 aud 검증용
EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY=    # 모바일: 네이티브 앱 키, EAS 빌드에도 등록
KAKAO_REST_API_KEY=                  # 향후 REST API 방식 사용 시
KAKAO_CLIENT_SECRET=                 # 향후 REST API 방식 사용 시
```

현재 구현은 Android 네이티브 SDK와 OIDC ID 토큰 검증 방식이다. REST API 리다이렉트 URI는
이 방식에 필요하지 않으므로 임의 주소를 등록하지 않는다. Expo Go가 아닌 새 네이티브
development/preview 빌드가 필요하다. 최초 가입은 서비스 약관 동의를 받은 뒤 생성하고,
카카오 제공 이메일이 없어도 provider 회원번호로 계정을 만든다. 이메일 인증·비밀번호
재설정 메일은 간편 로그인에 적용하지 않는다. 카카오 계정 재인증 탈퇴·연결 해제는
구현했지만 실제 기기 검증과 외부 연결 해제 웹훅은 남았다.

### Naver

- Console: https://developers.naver.com/
- 로그인 문서: https://developers.naver.com/docs/login/devguide/devguide.md

필요:

- [x] 애플리케이션 등록 및 개발용 Client ID/Secret 전달 (사용자 확인)
- [-] Android SDK·서버 토큰 검증·약관 가입·탈퇴 연결 구현. 새 APK 실제 로그인 검증 필요
- [ ] 웹 OAuth Callback URL: NestJS 공개 HTTPS 배포 후 설정. 현재 사용자의 선택에 따라 웹 로그인은 보류
- [ ] Android package 등록
- [ ] 최소 프로필 항목만 요청
- [ ] 개발 중 상태의 테스트 계정 등록 및 출시 전 검수 요청

환경변수:

```text
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
```

Android SDK는 모바일 빌드의 비공개 환경변수 `NAVER_CLIENT_ID`·`NAVER_CLIENT_SECRET`을
네이티브 문자열 리소스로 주입합니다. `EXPO_PUBLIC_`이나 Expo `extra`에는 키 값을 넣지
않습니다. 그래도 APK 리소스는 추출할 수 있으므로 운영 키는 공개 저장소·로그에 남기지
않으며, 대화에서 노출된 Secret은 운영 전에 재발급합니다. 로컬 `.env`는 Git/EAS 업로드에서
제외되므로 EAS 환경에도 별도로 두 값을 설정해야 합니다.

API에도 동일한 앱의 두 환경변수가 필요합니다. API는 클라이언트가 보내는 프로필이나
액세스 토큰을 신뢰하지 않고 네이버 refresh grant를 서버의 Client ID/Secret으로 교환한 뒤
그 새 토큰으로 계정 식별자를 조회합니다. 이메일은 선택 정보이며 이메일 일치로 기존
계정을 자동 병합하지 않습니다. 실제 네이버 인증 요청과 새 APK 검증은 별도입니다.
EAS에서 네이버를 켜려면 `NAVER_CLIENT_ID`·`NAVER_CLIENT_SECRET`을 해당 환경의
`sensitive` 가시성 변수로 등록합니다. 현재 동적 앱 설정이 EAS CLI에서도 값을 확인하므로
CLI가 읽을 수 없는 `secret` 가시성은 사용하지 않습니다. SDK 자격 정보가 Android
리소스에 포함된다는 제한은 가시성 설정으로 제거되지 않습니다.

## C. 광고

### Google AdMob

- 사이트: https://admob.google.com/

필요:

- [ ] AdMob 계정
- [ ] Android 앱 등록
- [x] 사용자 제공 Android App ID를 EAS production 프로필에 등록
- [x] 사용자 제공 홈/검색 결과 Banner Ad Unit ID를 EAS production 프로필에 등록 (전면광고 사용하지 않음)
- [x] 테스트 광고 ID·Android SDK·UMP 동의 게이트 구현
- [ ] 출시 전 app-ads.txt/스토어 설정 확인

환경변수 예:

```text
EXPO_PUBLIC_ADS_ENABLED=true
EXPO_PUBLIC_ADMOB_ANDROID_APP_ID=
EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID=
EXPO_PUBLIC_ADMOB_HOME_BANNER_UNIT_ID=
EXPO_PUBLIC_ADMOB_RESULTS_BANNER_UNIT_ID=
```

개발·preview 빌드는 환경변수의 실광고 ID를 무시하고 Google 테스트 ID만 사용합니다.
세 EAS 프로필에서 광고를 활성화했습니다. 공개 식별자인 광고 ID만 `eas.json`에 기록하며,
development·preview에는 실제 ID를 설정하지 않습니다. 프로필별 생성 AndroidManifest의
App ID와 production의 cleartext 비활성화까지 쓰기 없는 introspection 테스트로 확인했습니다.
production에서 광고를 켜면 실제 App ID와 같은 publisher의 배너 ID가 필수입니다.
별도 placement ID가 없으면 `EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID`를 공통으로 사용합니다.
ID는 모바일 빌드에 포함되며 변경 후 새 APK/AAB가 필요합니다. 상세 배치·운영 절차는
`docs/23_ADS_AND_RELEASE_AUDIT.md`를 확인합니다. 웹/iOS/관리자에는 AdMob 광고를 요청하지 않습니다.

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
EMAIL_VERIFICATION_URL=valugether://auth/verify-email
PASSWORD_RESET_URL=valugether://auth/reset-password
PRESET_ALERT_URL=valugether://custom
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
