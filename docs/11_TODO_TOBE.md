# 11. TODO / TO-BE

## Phase 0 - 의사결정 / 계정 준비

- [x] 앱 이름 확정: 바른주식 밸류 / Right Stock Value
- [ ] Android 패키지명 확정
- [ ] 도메인 확보
- [ ] OpenDART 키 발급
- [ ] 한국투자증권 Open API 사용조건 확인/키 준비
- [ ] Google/Kakao/Naver 개발자 앱 생성
- [ ] AdMob 계정/앱 생성
- [ ] 운영 이메일 발송 Provider 선정
- [ ] 개인정보처리방침/이용약관 초안

## Phase 1 - 기반

- [ ] PostgreSQL schema 적용
- [ ] NestJS auth 완성
- [ ] 이메일 인증/비밀번호 초기화
- [ ] ADMIN guard
- [ ] React Native navigation/theme
- [ ] Admin login
- [ ] audit/request id/exception filter

## Phase 2 - 데이터

- [ ] OpenDART adapter
- [ ] DART corp_code ↔ security 매핑
- [ ] SEC bulk Company Facts adapter
- [ ] CIK ↔ ticker mapping
- [x] 한국투자증권 MarketDataProvider/Mapper 골격
- [ ] 일별 가격 batch
- [ ] 재무 fact normalize
- [ ] 파생지표 calculator
- [ ] 데이터 품질 검증

## Phase 3 - Screening

- [ ] financial_metric 목록 확정
- [ ] tolerance 초기값 확정
- [ ] 일반 전략 4종 튜닝
- [ ] 고급 기본검색
- [ ] 상세검색 동적 UI
- [ ] 근접점수/정렬
- [ ] 결과 설명
- [ ] 검색 이력

## Phase 4 - User

- [ ] 관심종목
- [ ] 프리셋
- [ ] Google 로그인
- [ ] Kakao 로그인
- [ ] Naver 로그인
- [ ] 탈퇴/데이터 삭제

## Phase 5 - 운영

- [ ] 관리자 대시보드
- [ ] tolerance 편집
- [ ] strategy 편집
- [ ] provider/batch 모니터
- [ ] 로그 조회
- [ ] 공지
- [ ] 배치 실패 알림

## Phase 6 - 상용 오픈

- [ ] Market data external display/DB storage/derived display 서면 확인
- [ ] Android Play Console
- [ ] AdMob 실제 ID
- [ ] 개인정보처리방침/이용약관 게시
- [ ] 보안 점검
- [ ] API rate limit
- [ ] 백업/복구 테스트
- [ ] 모니터링/알림
- [ ] 스토어 투자정보 관련 문구 검토

## Phase 7 - 고도화

- [ ] AD_FREE entitlement/payment
- [ ] AI 기업 요약
- [ ] 경제/산업 추세 결합
- [ ] AI 추천(근거/모델버전/데이터시점 저장)
- [ ] 웹 사용자 앱
- [ ] 해외시장 추가
- [ ] 전략 백테스트
- [ ] 사용자가 만든 전략 성과 추적

## TO-BE 아키텍처

```text
Mobile/Web
   ↓
API Gateway/NestJS
   ├─ Auth/User
   ├─ Screening
   ├─ Portfolio-like Watchlist
   ├─ AI Orchestrator (future)
   └─ Admin
        ↓
PostgreSQL + Redis
        ↑
Data Pipeline
  ├─ DART
  ├─ SEC
  ├─ Market Data
  └─ Future News/Macro
```
