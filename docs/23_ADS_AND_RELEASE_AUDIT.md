# 23. 광고 통합 및 출시 전 점검

검증일: 2026-10-11. 구현·로컬 검증 결과이며, 스토어 출시 승인이나 수익 발생을 의미하지 않습니다.

## 광고 방식과 배치

Android 앱에 Google AdMob 인라인 적응형 배너를 적용했습니다. 광고에는 `광고` 라벨과 콘텐츠 사이의 여백을 두고, 하단 내비게이션 위에 고정하지 않습니다.

- 홈: 기업 유형과 맞춤기업 안내를 읽은 뒤 보이는 하단 배너 1개
- 검색 결과: 결과가 6개 이상일 때 5번째 기업 카드와 6번째 카드 사이 배너 1개
- 제외: 검색 입력, 로그인·회원가입·탈퇴, 알림 설정, 재무 그리드·주가 차트, 빈 검색 결과와 오류 화면
- 전면·앱 시작·보상형 광고는 적용하지 않았습니다. 검색이나 뒤로가기를 광고 시청 조건으로 만들지 않습니다.
- 화면이 포커스를 잃거나 앱이 백그라운드로 이동하면 해당 배너를 제거합니다. 별도 수동 새로고침 타이머는 없습니다.
- 광고 로딩 실패는 광고 슬롯만 숨깁니다. 기업 검색·조회·로그인에는 영향을 주지 않습니다.
- 웹·iOS·관리자에는 AdMob 요청을 하지 않습니다. 이번 수익화 구현 범위는 Android입니다.

Google은 내비게이션과 가까운 배너 및 조작을 가로막는 배치를 우발 클릭 위험으로 설명합니다. 이 배치는 해당 위험을 줄이기 위한 제품 판단이며 Google의 개별 앱 승인 보장은 아닙니다. [배너 배치 가이드](https://support.google.com/admob/answer/6275345?hl=en), [전면 광고 배치 제한](https://support.google.com/admob/answer/6201362?hl=en)

## 테스트 광고와 운영 광고

개발·preview 빌드는 Google 샘플 App ID와 테스트 배너만 사용합니다. 로컬 환경변수에 운영 ID가 있어도 실제 광고 ID를 사용하지 않습니다. 테스트 광고를 클릭하지 마세요.

사용자가 제공한 실제 Android App ID와 홈·검색 결과 배너 Unit ID를 `apps/mobile/eas.json`의 production 프로필에 등록했습니다. development·preview는 광고를 활성화하되 Google 테스트 ID만 사용합니다. production에는 다음 값을 적용합니다. 광고 ID는 공개 식별자이며 로그인 Client Secret과는 다릅니다.

```dotenv
VALUGETHER_BUILD_ENV=production
EXPO_PUBLIC_ADS_ENABLED=true
EXPO_PUBLIC_ADMOB_ANDROID_APP_ID=ca-app-pub-5560163853842844~6891356682
EXPO_PUBLIC_ADMOB_HOME_BANNER_UNIT_ID=ca-app-pub-5560163853842844/2984910423
EXPO_PUBLIC_ADMOB_RESULTS_BANNER_UNIT_ID=ca-app-pub-5560163853842844/2952111675
```

두 배너 ID를 따로 만들면 배치별 수익·클릭률을 비교할 수 있습니다. 공통 `EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID`도 지원합니다. 운영 모드에서 광고를 켜고 ID가 없거나 샘플·다른 퍼블리셔의 ID이면 빌드를 거부합니다. 광고 없이 출시할 때는 `EXPO_PUBLIC_ADS_ENABLED=false`로 설정합니다.

development·preview에 운영 ID가 섞여도 테스트 광고만 사용되는지, production의 실제 Unit ID가 보존되는지 자동검증했습니다. 세 프로필에서 기존 생성 파일을 읽거나 쓰지 않는 Expo introspection으로 AndroidManifest App ID·측정 지연·cleartext 정책도 확인했습니다. EAS 클라우드 빌드나 계정 설정 변경은 실행하지 않았습니다.

AdMob·UMP는 네이티브 모듈입니다. Expo Go 또는 이전 APK에는 새 모듈이 없으므로 새 APK가 필요합니다. 루트 `.easignore`에서 생성된 Android/iOS 폴더와 `.env`를 제외하여 EAS가 해당 빌드 환경으로 네이티브 설정을 다시 생성하도록 했습니다. 기존 사용자 데이터는 개발 APK의 `adb install -r` 설치로 유지했습니다. [Expo 설치 가이드](https://docs.page/invertase/react-native-google-mobile-ads/installation/expo), [EAS ignore](https://docs.expo.dev/build-reference/easignore/)

## 동의와 개인정보

운영 광고는 UMP 동의 상태를 확인한 후 `canRequestAds`일 때만 SDK를 초기화합니다. 오프라인이면 UMP에 저장된 이전 판단만 사용하며, 판단이 없으면 광고 없이 앱을 사용할 수 있습니다. Google 샘플 App ID는 운영 UMP 메시지를 제공하지 않으므로 테스트 광고에만 별도 동의 우회를 적용했습니다.

UMP가 개인정보 옵션을 요구하면 내 정보·개인정보 화면에 광고 개인정보 설정 진입점을 표시합니다. 설정을 여는 동안 기존 배너를 제거하고, 최신 UMP 판단 이후 새 광고를 요청합니다. [Google UMP 가이드](https://developers.google.com/admob/android/privacy)

요청은 비개인화 광고로 제한했습니다. 이는 SDK의 모든 데이터 처리를 없앤다는 뜻이 아닙니다. IP 주소·광고 식별자·상호작용·진단 정보 등 SDK가 처리하는 실제 항목을 개인정보 처리방침과 Play 데이터 안전성 양식에 맞춰 고지해야 합니다. 앱은 이메일·검색 조건·관심기업 목록을 배너 요청에 전달하지 않습니다. [Google SDK 데이터 공개 가이드](https://developers.google.com/admob/android/privacy/play-data-disclosure)

`docs/22_LEGAL_DRAFTS.md`의 초안에 광고 고지를 추가했지만, 게시된 DB 약관은 임의로 덮어쓰지 않았습니다. 운영자 정보·수탁사·보유기간 등을 검토한 뒤 관리자에서 정식 버전을 게시해야 합니다.

## 앱·관리자·API 점검에서 수정한 내용

- 모바일: 인증 갱신 중복과 세션 경합, 오류 재시도, 관심기업 로그인 확인, 설정 저장·탈퇴 중복 동작, 맞춤기업 조회·이동, 좁은 화면의 그리드·차트·모달, 비동기 이전 응답이 최신 차트를 덮는 문제
- 관리자: 데이터 로딩·오류·재시도, 로그인 갱신 경합, 저장 실패 피드백, 약관 모달의 키보드·포커스·취소, 표와 전략 조건 반응형 폭
- API: 동시 refresh의 단일 성공, 관리자 권한 즉시 재검증, 정지 계정의 이메일 인증 재활성화 차단, 입력 범위 검증, 존재하지 않는 관심종목 검사
- 금융 데이터: 누락 값을 0으로 바꾸지 않음, 일반 전략에서 비양수 PER/PBR을 정상 저평가 값으로 취급하지 않음, 적자·자본잠식 전환의 오래된 평가 지표 제거, 전년 동기·연속 흑자·배당 연도 누락 처리, 검색 가격 상태의 ID 타입 불일치
- 기존 관리자 정렬 설정을 유지했습니다. PER를 UI에서 강제하지 않으며 각 전략의 정렬 지표와 방향을 관리자 설정으로 적용합니다.

## 검증 결과

네이버 추가 통합 및 실제 EAS 광고 ID 반영 후 최종 회귀 기준입니다. 외부 로그인·광고 서비스는 mock 또는 설정 검증이므로 실계정 인증과 실제 광고 송출을 대신하지 않습니다.

- API·모바일 TypeScript 검사 통과
- API production build 및 Next.js 16.3.8 관리자 production build 통과, 관리자 15개 route 생성
- 모바일 웹 export 통과
- API 12/12, 네이버 API 12/12, Kakao 2/2, 가격 배치 4/4, 실제 Redis 큐 1/1, 광고 설정·동의·EAS 15/15, 모바일 네이버 adapter/config 14/14, 관리자·모바일 Chromium 23/23: 총 83개 자동검증 통과
- 320px 화면에서 제목 한 줄, 시장 선택 가로 스크롤, 단일 기간 그리드 전체 폭, 여러 기간 가로 스크롤, 차트 닫기 버튼과 응답 경합 확인
- 네이버 모듈 추가 전 AdMob 포함 Android x86_64 debug APK 네이티브 빌드 성공: 359 tasks, 8분 42초
- 에뮬레이터에 데이터 삭제 없이 설치하고 앱의 기업 전략·공지 API 요청을 확인했습니다. 최신 네이티브 화면·배너의 육안 확인은 도구 승인 검토 한도로 완료하지 못했습니다.
- debug APK는 에뮬레이터용 x86_64 빌드이며 Metro가 필요합니다. 일반 휴대전화용 preview APK나 서명된 production AAB로 안내하지 않습니다.
- 네이버를 포함한 최신 Android APK/AAB는 도구 승인 검토 한도로 빌드하지 못했습니다. 해당 제한은 구현 성공이나 실패를 뜻하지 않으며 실제 네이티브 컴파일·인증·광고 확인은 남아 있습니다.

재검증 명령은 저장소 루트에서 `npm run test:ads`, `npm run test:social`, `npm run test:naver`, `npm run test:ui:e2e`입니다. API DB·Redis 통합 검증에는 로컬 테스트 인프라가 필요합니다.

## 보안 의존성

사용자 동의를 받은 production `npm audit --omit=dev`에서 최초 39건(critical 3, high 23, moderate 13)을 확인했습니다. Next.js 16.3.8, Nest Express 11.2.7, Multer 2.4.0 및 호환되는 전이 의존성을 갱신했습니다. 최종 결과는 31건(critical 0, high 20, moderate 11)입니다.

일부 취약점은 동일 upstream 의존성에서 여러 상위 패키지로 전파됩니다. 최신 버전에도 패치가 없는 `node-forge`·`braces`, major 또는 호환성 검토가 필요한 `uuid`·`decode-uri-component` 등이 남아 있습니다. `npm audit fix --force`로 프레임워크를 강제 변경하지 않았으며, 잔여 취약점이 안전하다고 판정하지 않습니다. 출시 전 도달 가능성 검토·완화 또는 안전한 upstream 교체와 재검증이 필요합니다. [Next.js 16.3.8 릴리스](https://github.com/vercel/next.js/releases/tag/v16.3.8)

## 공식 로그인 이미지와 네이버

사용자가 제공한 ZIP의 Google·Kakao·Naver 공식 PNG로 기존 로그인 버튼을 교체했습니다. ZIP 문서를 실행 지시로 취급하지 않고 필요한 정적 이미지만 사용했습니다. 원본 비율, 공급자 색상, Google·Kakao·Naver 순서를 유지합니다. 원본 PNG와의 SHA-256 일치와 390px·320px 화면의 이미지 로딩·순서·전체 카드 폭을 검증했습니다. Google Android 클라이언트 ID와 패키지는 콘솔에서 확인했지만, 서버 검증용 Web 클라이언트 ID가 없어 버튼을 비활성화했습니다. 네이버는 설정된 Android 네이티브 빌드에서만 활성화됩니다. 화면의 준비 중·Android 안내 문구는 제거했습니다.

사용자 선택에 따라 네이버는 Android 네이티브 SDK부터 통합하며 웹 OAuth는 보류합니다. Client ID/Secret은 Git에서 제외되는 로컬 환경변수에만 설정합니다. SDK 초기화에는 Client Secret이 필요하므로 APK 내 키를 추출할 수 있다는 제한이 있습니다. 공개 저장소나 JavaScript 설정에는 비밀 값을 넣지 않으며, 대화에 노출된 키는 운영 전 재발급을 권장합니다. 네이버 개발자센터의 Android 패키지·앱 이름·테스터 등록과 새 APK 검증이 별도로 필요합니다. [네이버 Android SDK](https://developers.naver.com/docs/login/android/android.md)

Android 네이버 SDK 5.12.0을 로컬 Expo 모듈로 연결했습니다. 자격 정보는 config plugin이 네이티브 Android 리소스에만 기록하며, JS 번들·공개 Expo 설정에는 Client Secret을 포함하지 않습니다. 로컬 `.env`와 생성 Android/iOS 폴더는 Git·EAS 업로드에서 제외했습니다. EAS 빌드에는 `NAVER_CLIENT_ID`·`NAVER_CLIENT_SECRET`을 EAS의 해당 환경에 별도 등록해야 합니다. 클라우드 환경변수 등록은 이번 작업에서 실행하지 않았습니다.

이 두 네이버 변수는 EAS의 `sensitive` 가시성으로 등록해야 합니다. 현재 `app.config.js`가 CLI의 로컬 설정 해석에서도 두 값을 확인하므로 EAS 서버에서만 읽을 수 있는 `secret` 가시성을 사용하면 로컬·원격 설정이 달라질 수 있습니다. `EXPO_PUBLIC_` 이름이나 `eas.json` 값으로 Client Secret을 기록하지 마세요. 서버 NestJS의 비밀 값은 별도 서버 Secret 관리에 두며, Android SDK에 포함된 값은 APK 추출로부터 숨길 수 없습니다. [EAS 환경변수 적용 범위](https://docs.expo.dev/eas/environment-variables/usage/)

모바일은 네이버 refresh token만 서버에 보내고, 서버는 자신의 Client ID/Secret으로 refresh grant를 수행한 뒤 공식 profile API의 subject를 확인합니다. 클라이언트가 보내는 이메일·프로필·access token을 가입 근거로 신뢰하지 않으며 이메일이 같다는 이유로 계정을 자동 병합하지 않습니다. 최초 가입 약관, 취소·중복 로그인, provider 이메일 없는 계정, SDK 미포함 구 APK 안내를 구현했습니다.

탈퇴는 사용자 확인과 SDK 재로그인 후 서버 subject 일치를 검사하고 DB 삭제가 성공한 뒤 네이버 연결 해제를 요청합니다. 연결 해제만 실패하면 계정은 이미 삭제됐음을 표시하고 수동 연결 해제를 안내합니다. 네이버 SDK의 refresh token 자체는 서버 검증 가능한 최근 재인증 시각을 제공하지 않으므로 이를 암호학적 최근 인증 증명으로 설명하지 않습니다. 로그인·탈퇴 API에는 인증 요청 제한을 적용했습니다. [네이버 로그인 API](https://developers.naver.com/docs/login/api/api.md)

네이버 서버 12개, 모바일 adapter/config 14개, 공식 버튼·프로필 UI 2개 검증을 통과했습니다. 웹 OAuth 콜백과 실제 네이버 계정 인증은 보류 상태이며, 통과한 이전 Android debug 빌드에는 네이버 모듈이 없습니다.

## 운영자가 완료해야 할 출시 조건

1. 등록한 AdMob Android 앱 및 두 배너 ID가 운영 계정에서 올바른 앱에 연결되어 있는지 확인합니다. EAS production의 실제 ID 반영과 development·preview의 테스트 ID 분리는 구현·자동검증 완료입니다.
2. AdMob의 개인정보 보호 및 메시지 설정에서 UMP를 구성하고 실제 앱으로 대상 지역·거절·기존 동의·개인정보 옵션을 검증합니다.
3. 운영자 검토를 마친 개인정보 처리방침·이용약관을 게시하고 Play 데이터 안전성 고지 및 광고 포함 여부를 맞춥니다.
4. 개발자 웹사이트 루트의 `app-ads.txt`와 Play 스토어 개발자 웹사이트 연결을 확인합니다. 퍼블리셔 ID를 임의로 생성하지 않습니다. [Google app-ads.txt](https://support.google.com/admob/answer/9363762?hl=en)
5. 네이버 운영키 재발급·API와 EAS 환경 등록·Android 설정·개발 중 테스터 등록, Kakao 실제 로그인·재인증 탈퇴, 메일 발신 도메인·알림 발송을 확인합니다. Google은 동일 프로젝트의 Web application 클라이언트 ID와 EAS APK/Play 서명 SHA-1 확인이 추가로 필요하며 현재 버튼은 비활성화 상태입니다.
6. 잔여 보안 취약점·인증/검색 부하, 운영 Redis·백업·모니터링·Secret 관리·법률 및 데이터 사용 허가를 검토합니다.
7. 배포된 API의 HTTPS 주소를 EAS production의 `EXPO_PUBLIC_API_BASE_URL`에 등록한 뒤 production AAB를 서명·검증합니다. 미설정 시 현재 클라이언트의 Android 에뮬레이터용 기본 주소(`http://10.0.2.2:3000/api`)가 적용되므로 실제 휴대전화 운영 주소로 사용할 수 없습니다. production은 cleartext HTTP를 허용하지 않습니다. 최신 preview APK도 실제 Android 휴대전화에서 접근 가능한 API 주소로 확인해야 합니다. 사용자의 별도 요청 없이 EAS 유료 빌드나 스토어 게시를 수행하지 않았습니다.

재무 이력은 현재 수집한 FY 최대 4년 중심입니다. UI가 분기·TTM을 표시할 수 있어도 해당 데이터가 없는 종목에서 값을 만들어 채우지 않습니다. 분기 수집 및 평균 자본 기반 일부 지표 정책, 가격 이력의 전체 커버리지와 오래된 시세는 추가 데이터 검증 대상으로 남습니다.

## 로컬 네이티브 진단 후 상태

이번 점검용 API(3301)와 Metro(8082)는 종료했으며, 기존 사용자 Metro(8081)와 에뮬레이터는 종료하지 않았습니다. 진단 중 해당 에뮬레이터의 개발 서버 주소를 `localhost:8082`로 설정하고 adb reverse 8081·8082를 8082에 연결했습니다. 승인 검토 한도로 adb 설정 복원은 실행하지 못했습니다. 기존 8081 개발 서버를 다시 사용할 때는 에뮬레이터의 개발 설정에서 서버 주소를 `localhost:8081`로 바꾸고 `adb reverse tcp:8081 tcp:8081`을 실행하세요. 새 preview APK는 Metro 없이 동작하므로 이 개발 서버 설정에 의존하지 않습니다.
