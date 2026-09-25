# 12. 로컬 실행 / 운영 Runbook

## 필요 프로그램

- Node.js 22 LTS 이상 권장
- npm
- Docker Desktop
- VS Code
- Android Studio/SDK 또는 실제 Android 기기

## 1. 인프라

루트에서 전체 workspace 의존성을 한 번에 설치합니다.

```bash
npm install
```

`apps/api`, `apps/mobile`, `apps/admin`에서 따로 설치할 필요가 없습니다.

```bash
docker compose up -d
```

## 2. DB

관리자 접속:

```bash
psql -h localhost -p 5433 -U postgres -d postgres -f database/sql/00_create_database.sql
```

그 후:

```bash
for f in database/sql/{0[1-9],1[0-3]}_*.sql; do
  psql -h localhost -p 5433 -U stock_app -d stock_screener -f "$f"
done
```

개발 편의를 위한 password는 docker-compose에 들어있으므로 운영에서 절대 그대로 사용하지 않습니다.

## 3. API

```bash
cp apps/api/.env.example apps/api/.env
npm run api
```

Health:

```text
GET http://localhost:3000/api/health
```

## 4. Mobile

```bash
cp apps/mobile/.env.example apps/mobile/.env
npm run mobile
```

Android 에뮬레이터에서 PC localhost 접근은 보통 `10.0.2.2`가 필요합니다.

## 5. Admin

```bash
cp apps/admin/.env.example apps/admin/.env.local
npm run admin
```

## 6. MOCK 실행

초기에는 실제 API 키 없이 `09_seed_demo.sql`의 가상종목과 mock provider로 스크리닝을 확인합니다.

예:

```http
POST /api/screening/search
Content-Type: application/json

{
  "conditions": [
    {"metricCode":"PER","operator":"LTE","target":15,"weight":1},
    {"metricCode":"ROE","operator":"GTE","target":10,"weight":1}
  ]
}
```

## 7. 재무 동기화 이어받기

재무 동기화는 시장별 cursor를 DB에 저장합니다. 첫 실행 또는 의도적인 전체 재순회만
`reset`을 붙이고, 이후 실행에서는 생략합니다.

```bash
cd apps/api
npm run sync-data -- financial KR 200 reset
npm run sync-data -- financial KR 200
npm run sync-data -- financial US 200 reset
npm run sync-data -- financial US 200
```

결과의 `cursorStart`, `cursorEnd`, `nextCursor`, `cycleCompleted`로 진행 상태를 확인합니다.
`NO_DATA`는 외부 provider에 재무 원문이 없는 종목이며 `errors`와 별도 집계됩니다.

## 8. 자동 배치 worker

Redis가 정상 실행 중인지 먼저 확인하고 API 환경변수를 설정합니다.

```env
BATCH_WORKER_ENABLED=true
BATCH_QUEUE_NAME=right-stock-batch
BATCH_REDIS_STARTUP_TIMEOUT_MS=10000
FINANCIAL_SYNC_CHUNK_SIZE=200
REDIS_URL=redis://localhost:6379
```

API 시작 시 활성화된 `batch_definition`이 BullMQ Job Scheduler에 동기화됩니다. 초기 seed는
모두 비활성화 상태이므로 관리자 API로 cron과 활성 여부를 확인한 뒤 한 작업씩 켭니다.

```text
GET   /api/admin/batches/queue
POST  /api/admin/batches/queue/PRESET_MATCH_NOTIFY
PATCH /api/admin/batches/schedules/KR_EOD_PRICE_SYNC
POST  /api/admin/batches/data-quality
```

PATCH 예:

```json
{ "isEnabled": true, "scheduleCron": "0 18 * * 1-5", "maxRetry": 2 }
```

Redis 로그에 `Wrong signature trying to load DB from file`이 나오면 기존 volume을 삭제하지
말고 백업 후 현재 Redis 이미지와 호환되는 RDB 마이그레이션을 수행합니다. worker는
Redis 복구 전까지 `BATCH_WORKER_ENABLED=false`로 유지합니다.

## 9. HTTP 보안 설정

로컬 기본값:

```env
CORS_ALLOWED_ORIGINS=http://localhost:3100,http://127.0.0.1:3100
TRUST_PROXY_HOPS=0
RATE_LIMIT_ENABLED=true
RATE_LIMIT_STORE=memory
AUTH_RATE_LIMIT_MAX=10
AUTH_RATE_LIMIT_WINDOW_SECONDS=60
SEARCH_RATE_LIMIT_MAX=30
SEARCH_RATE_LIMIT_WINDOW_SECONDS=60
```

운영에서는 실제 관리자/웹 도메인만 `CORS_ALLOWED_ORIGINS`에 쉼표로 나란히
입력합니다. origin은 path 없는 정확한 `https://...` 형식이어야 하며 `*`는
허용하지 않습니다. 운영에서 값이 없으면 API 기동을 거부합니다.

역방향 프록시를 사용하는 경우에만 `TRUST_PROXY_HOPS`를 API와 클라이언 사이의
신뢰할 프록시 수로 설정합니다. 잘못된 값은 `X-Forwarded-For` 위조로 제한을
우회하게 할 수 있으므로 배포 토폴로지와 같아야 합니다.

다중 API 인스턴스와 운영 환경은 공유 Redis를 사용합니다.

```env
RATE_LIMIT_STORE=redis
RATE_LIMIT_REDIS_URL=redis://redis-host:6379
```

Redis 연결이 일시적으로 실패하면 로컬 memory 제한으로 fallback하고 30초 후
재연결합니다. `IP_HASH_SALT`는 rate-limit key에서도 사용하므로 운영 secret으로
관리합니다.

## 10. 이메일 인증과 비밀번호 재설정

로컬 Mailpit:

```env
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
MAIL_FROM=no-reply@example.local
EMAIL_VERIFICATION_URL=rightstockvalue://auth/verify-email
PASSWORD_RESET_URL=rightstockvalue://auth/reset-password
```

메일은 `http://localhost:8025`에서 확인합니다. Windows에서 `localhost`가 IPv6로 해석되어
SMTP 연결이 지연되면 `127.0.0.1`을 사용합니다. 운영에서는 발송 provider, 발신 도메인,
SPF/DKIM/DMARC와 실제 앱 딥링크를 확정해야 합니다.

Resend 전달 테스트:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASSWORD=                     # Resend API key; Git/문서 기록 금지
MAIL_FROM=onboarding@resend.dev    # 도메인 등록 전 계정 소유자 테스트 전용
PRESET_ALERT_URL=rightstockvalue://custom
PRESET_ALERT_EMAIL_ENABLED=false   # 도메인 인증 뒤 true
```

서비스 도메인을 정한 뒤 Resend에서 도메인을 인증하고 `MAIL_FROM`을 해당 도메인의 발신
주소로 교체합니다. 그 전에는 일반 사용자 대상 운영 발송을 활성화하지 않습니다.

기존 DB에는 `npm run db:notification-email`로 `14_notification_email_delivery.sql`을
적용합니다. 프리셋 이메일은 사용자가 앱에서 직접 켠 경우에만 발송합니다. 최초 평가는
현재 충족 종목을 기준선으로만 저장하고, 다음 평가부터 새로 추가된 기업만 보냅니다.
`user_notification.email_status`에서 `SENT`, `FAILED`, `SKIPPED`를 확인할 수 있습니다.

이메일 인증·비밀번호 재설정 흐름은 이메일/비밀번호 계정만 대상입니다.
Google/Kakao/Naver 간편 로그인 계정은 인증·재설정 메일을 보내지 않습니다.

## 11. 데이터 품질과 운영 알림

기존 DB에는 다음 증분 SQL을 적용합니다.

```bash
npm run db:data-quality
```

기본 임계치와 운영메일 설정:

```env
DATA_QUALITY_PRICE_MAX_AGE_DAYS=4
DATA_QUALITY_FINANCIAL_MAX_AGE_DAYS=550
DATA_QUALITY_MIN_PRICE_COVERAGE_PERCENT=80
DATA_QUALITY_MIN_METRIC_COVERAGE_PERCENT=70
DATA_QUALITY_STUCK_BATCH_MINUTES=180
DATA_QUALITY_RECENT_FAILURE_HOURS=24
OPS_ALERT_EMAIL_ENABLED=false
OPS_ALERT_EMAILS=ops@example.com
OPS_ALERT_COOLDOWN_HOURS=24
```

도메인 인증 전에는 `OPS_ALERT_EMAIL_ENABLED=false`를 유지합니다. 관리자의 배치·데이터 품질
화면에서는 이메일을 켜지 않아도 검사 결과를 확인하고 수동 실행할 수 있습니다. 자동 실행은
`DATA_QUALITY_CHECK` 배치 정의를 검토한 뒤 활성화합니다.

## 12. 회원 탈퇴

로컬 계정은 access token과 현재 비밀번호가 필요합니다.

```http
DELETE /api/auth/me
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json

{"confirmation":"DELETE_MY_ACCOUNT","password":"CURRENT_PASSWORD"}
```

성공 즉시 계정과 사용자 데이터가 hard delete되고 기존 access/refresh token은 사용할 수
없습니다. 감사 로그에는 사용자 식별자와 payload를 제거한 탈퇴 행위/시각만 남습니다.
소셜 계정 탈퇴는 provider 재인증 기능 구현 후 활성화합니다.

## 13. 자동 검증

```bash
npm run typecheck
npm run build
npm run test:e2e
npm run test:batch
npm run test:queue
npm run test:ui:e2e
npm run db:backup-check
```

- `test:queue`는 동적 로컬 포트의 임시 Redis 7 컨테이너에서 BullMQ worker와 `DATA_QUALITY_CHECK` job 완료를 확인한 뒤 테스트 DB 기록과 컨테이너를 제거합니다.
- `test:ui:e2e`는 API·관리자·Expo web을 임시 포트로 띄우고 관리자 보호 경로, 보안 헤더, 로그인/로그아웃, 공지, export, 모바일 검색/세션을 Chromium에서 검사합니다.
- Playwright Chromium 최초 설치: `npx playwright install chromium`
- `db:backup-check`는 로컬 Docker PostgreSQL 17만 허용합니다. custom-format dump를 별도 임시 PostgreSQL 17에 복원하고 table/company/security 건수를 비교한 뒤 컨테이너와 dump를 제거합니다.
- Expo 설정 검사: `npx expo-doctor apps/mobile`

`npm audit --force`는 Expo/Nest major 변경을 제안할 수 있으므로 사용하지 않습니다. high 취약점은 고정된 Multer override로 제거했고, 남은 moderate는 upstream Expo/ExcelJS 의존성 업데이트를 추적합니다.

## 운영 체크

매일 확인:

- 마지막 가격 거래일
- 재무 배치 마지막 성공
- 오류 배치
- 외부 API quota
- provider mapping 누락
- latest_metric_value freshness

주기적:

- 운영 DB 암호화 backup과 정기 복구 훈련
- refresh token cleanup
- log retention cleanup
- expired verification token cleanup
