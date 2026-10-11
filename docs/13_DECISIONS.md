# 13. 결정사항

## 확정

| 항목          | 결정                                                             |
| ------------- | ---------------------------------------------------------------- |
| 앱 이름       | 가치보는주식 / Valugether                                        |
| Android ID    | `com.valugether.app`                                             |
| 앱 딥링크     | `valugether://`                                                  |
| 설명 문구     | 초보자를 위한 현명한 기업 찾기                                   |
| MVP 목표      | 회사 추천 로직 완성                                              |
| MVP 시장      | 한국 우선, 미국은 후속                                           |
| 모바일        | React Native + Expo + TypeScript                                 |
| API           | NestJS + TypeScript                                              |
| 관리자        | Next.js web only                                                 |
| DB            | PostgreSQL, SQL 직접 관리                                        |
| Queue/Cache   | Redis + BullMQ 방향                                              |
| 회원          | 이메일/비밀번호 + Google/Kakao/Naver                             |
| 개인정보      | 최소수집                                                         |
| 수익          | 광고, 추후 AD_FREE/AI 유료                                       |
| 일반검색      | 저평가/안정/성장/배당                                            |
| 고급          | 기본검색 + 상세검색                                              |
| 핵심차별      | 조건 허용오차 기반 근접검색                                      |
| 설정          | 공통코드 + 도메인 설정 테이블                                    |
| 관심종목      | 포함                                                             |
| 프리셋        | 포함                                                             |
| 로그          | 엄격하게 데이터 흐름/중요행위 기록                               |
| 데이터 호출   | 사용자 호출과 분리, 배치 DB 적재                                 |
| 재무 KR       | OpenDART                                                         |
| 재무 US       | SEC EDGAR                                                        |
| 가격          | 한국투자증권 Open API, Provider 추상화, 일별 수정주가 중심       |
| DART 재무제표 | 연결재무제표 우선, 없으면 별도재무제표 fallback 및 출처 표시     |
| 금융업        | 일반 추천에서 제외하고 별도 정책·지표로 평가                     |
| 실적 기간     | 정상 분기 4개가 있으면 TTM 우선, 불가능하면 최근 FY 및 기준 표시 |
| 주문/계좌     | v1 제외                                                          |
| AI            | 미래 확장                                                        |

## 임시결정/출시 전 확정

### Market Data

MVP는 한국투자증권 Open API를 사용합니다. 외부 DTO를 `NormalizedDailyPrice`로 변환하므로 공급자 변경 시 adapter만 교체합니다. 실제 서비스 오픈 전 외부 표시, DB 저장, 파생지표 표시에 관한 사용조건을 확인합니다.

Marketstack은 미국 시장 추가 시 후보입니다. 도입 전 다음 사용형태를 공급자에게 확인:

- 광고 기반 앱
- 회원에게 EOD 가격 display
- 서버 DB 저장
- 자체 계산한 PER/PBR 등 display
- 거래소 단위 batch 호출 quota

공급자 변경은 adapter로 처리.

### 일반 전략 숫자

Seed의 숫자는 개발용 초기값일 뿐 투자기준으로 확정된 값이 아닙니다. 실제 오픈 전 업종/시장 분포를 분석하여 조정.

### 계산식

세부 계산식은 `docs/15_METRIC_CALCULATION_POLICY.md`를 기준으로 구현하고 calculator version을 저장합니다.
