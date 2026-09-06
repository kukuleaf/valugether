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
for f in database/sql/{0[1-9],10}_*.sql; do
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
