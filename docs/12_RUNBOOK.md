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
```

PATCH 예:

```json
{ "isEnabled": true, "scheduleCron": "0 18 * * 1-5", "maxRetry": 2 }
```

Redis 로그에 `Wrong signature trying to load DB from file`이 나오면 기존 volume을 삭제하지
말고 백업 후 현재 Redis 이미지와 호환되는 RDB 마이그레이션을 수행합니다. worker는
Redis 복구 전까지 `BATCH_WORKER_ENABLED=false`로 유지합니다.

## 9. 이메일 인증과 비밀번호 재설정

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

이 흐름은 이메일/비밀번호 계정만 대상입니다. Google/Kakao/Naver 간편 로그인 계정은
인증·재설정 메일을 보내지 않습니다.

## 운영 체크

매일 확인:

- 마지막 가격 거래일
- 재무 배치 마지막 성공
- 오류 배치
- 외부 API quota
- provider mapping 누락
- latest_metric_value freshness

주기적:

- DB backup 복구 테스트
- refresh token cleanup
- log retention cleanup
- expired verification token cleanup
