# 19. 기술 스택

## Mobile

- TypeScript
- React Native 0.86 계열
- Expo SDK 57 계열
- Expo Router
- 초기 UI는 React Native 기본 컴포넌트 + 작은 자체 UI component layer

선택 이유:

- VS Code 중심 개발
- Android 우선, 추후 iOS 확장 가능
- React/TypeScript를 관리자 웹과 공유
- 초기 의존성 최소화

정식 디자인시스템이 필요해지면 React Native Paper 등의 component library를 도입할 수 있으나, 비즈니스 컴포넌트가 특정 UI library에 과도하게 종속되지 않도록 합니다.

## Backend

- NestJS 11 계열 (`@nestjs/config` 4.x peer dependency와 일치)
- TypeScript
- pg (PostgreSQL driver)
- class-validator
- Argon2id
- JWT Access + opaque Refresh token

향후:

- Redis
- BullMQ
- OpenTelemetry/Sentry

## Admin

- Next.js 16.3.3 (2026-08 security release 기준 Active LTS)
- React 19.2.3
- BFF route에서 NestJS access token을 HttpOnly cookie로 보관하는 샘플

## DB

- PostgreSQL 17
- pgcrypto
- citext
- pg_trgm

DB 스키마 생성은 ORM migration에 숨기지 않고 사용자가 요청한 SQL 파일을 기준으로 관리합니다. NestJS는 SQL/pg로 접근하는 초안을 제공합니다.

추후 Prisma/Drizzle을 도입하더라도 DB DDL이 source of truth라는 정책을 유지할 수 있습니다.

## Cache / Queue

- Redis 8
- BullMQ 도입 예정

초안에는 Redis 컨테이너를 포함하지만 Queue worker의 실제 스케줄 연결은 TODO입니다. 먼저 배치 서비스의 idempotency와 provider adapter를 확정한 뒤 Worker로 옮깁니다.

## Development baseline

Expo SDK 57 공식 문서 기준 React Native 0.86 / React 19.2.3 /
Node.js 최소 22.13.x 조합을 사용합니다. 의존성을 설치할 때는
`npx expo install --fix`와 `npx expo-doctor`로 Expo 호환성을 다시 확인하십시오.
