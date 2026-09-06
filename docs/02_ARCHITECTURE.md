# 02. 아키텍처

## 전체

```text
┌──────────────────────────┐
│ React Native / Expo App  │
└─────────────┬────────────┘
              │ HTTPS REST
              ▼
┌──────────────────────────┐       ┌──────────────────────┐
│      NestJS API          │◀─────▶│  Redis / BullMQ      │
│ Auth / Stock / Screening │       │ cache / job / lock   │
│ Preset / Watchlist/Admin │       └──────────────────────┘
└─────────────┬────────────┘
              │
              ▼
┌──────────────────────────┐
│ PostgreSQL               │
│ normalized + latest      │
└─────────────▲────────────┘
              │
        batch / worker
              │
 ┌────────────┼───────────────────────────┐
 ▼            ▼                           ▼
OpenDART    SEC EDGAR            MarketDataProvider
(KR fin.)   (US fin.)       ┌─────────────┼─────────────┐
                            ▼             ▼             ▼
                        Marketstack      Mock       Future vendor
```

관리자:

```text
Next.js Admin → 동일 NestJS API → PostgreSQL
```

## 모듈 경계

### API

- `auth`: 인증/토큰
- `users`: 회원/설정/entitlement
- `stocks`: 종목/기업/가격/재무 조회
- `screening`: 정확/근접 검색
- `presets`: 사용자 검색 프리셋
- `watchlists`: 관심종목
- `common`: 공통코드/설정
- `admin`: 운영 관리
- `audit`: 감사로그
- `providers`: 외부 데이터 공급자 어댑터
- `batch`: 데이터 수집/가공
- `health`: 상태확인

## Provider 분리 원칙

절대 하지 말 것:

```text
Marketstack JSON 필드명을 business service에서 직접 사용
```

반드시:

```text
Marketstack API Response DTO
        ↓
MarketstackMapper
        ↓
NormalizedDailyPrice
        ↓
MarketDataProvider interface
        ↓
Batch Service
        ↓
DB
```

다른 공급자로 변경할 때 `Mapper + Provider`만 교체합니다.

## 데이터 읽기/쓰기 분리

수집 원본/정규화 테이블과 검색용 최신값을 분리합니다.

- 사실 데이터: `financial_fact`, `daily_price`
- 파생 데이터: `derived_metric_value`
- 검색 hot path: `latest_metric_value`

검색할 때 매번 수년치 재무제표를 집계하지 않습니다.

## 배치 락

동일 시장/거래일 배치 중복 실행을 방지하기 위해 Redis distributed lock 또는 PostgreSQL advisory lock을 사용합니다.

## 확장성

해외시장 추가 시 필요한 변경:

1. `exchange` 추가
2. 종목 마스터 적재
3. 재무 Provider 추가 또는 기존 provider mapping 추가
4. 가격 provider mapping 추가
5. 지표 매핑 추가

스크리닝 엔진은 변경하지 않는 것이 목표입니다.
