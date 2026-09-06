INSERT INTO common_code_group(group_code, group_name, description, sort_order) VALUES
('USER_STATUS','회원상태','회원 계정 상태',10),
('SOCIAL_PROVIDER','소셜로그인','외부 인증 사업자',20),
('ROLE','권한','서비스 권한',30),
('MARKET','시장','시장 코드',40),
('OPERATOR','검색연산자','스크리닝 연산자',50),
('TOLERANCE_TYPE','오차유형','허용오차 계산방식',60),
('BATCH_STATUS','배치상태','배치 실행상태',70),
('LOG_ACTION','감사행위','중요 감사 이벤트',80),
('SYS001','검색 허용오차 설정','지표별 근접검색 설정 그룹',90)
ON CONFLICT (group_code) DO UPDATE SET
  group_name=EXCLUDED.group_name,
  description=EXCLUDED.description,
  sort_order=EXCLUDED.sort_order,
  updated_at=now();

INSERT INTO common_code(group_code, code, code_name, sort_order) VALUES
('USER_STATUS','ACTIVE','정상',10),
('USER_STATUS','LOCKED','잠금',20),
('USER_STATUS','SUSPENDED','정지',30),
('USER_STATUS','WITHDRAWN','탈퇴',40),
('SOCIAL_PROVIDER','GOOGLE','Google',10),
('SOCIAL_PROVIDER','KAKAO','Kakao',20),
('SOCIAL_PROVIDER','NAVER','Naver',30),
('ROLE','USER','일반회원',10),
('ROLE','ADMIN','관리자',90),
('MARKET','KR','한국',10),
('MARKET','US','미국',20),
('OPERATOR','LTE','이하',10),
('OPERATOR','LT','미만',20),
('OPERATOR','GTE','이상',30),
('OPERATOR','GT','초과',40),
('OPERATOR','EQ','같음',50),
('OPERATOR','BETWEEN','범위',60),
('TOLERANCE_TYPE','PERCENT','비율',10),
('TOLERANCE_TYPE','ABSOLUTE','절대값',20),
('BATCH_STATUS','RUNNING','실행중',10),
('BATCH_STATUS','SUCCESS','성공',20),
('BATCH_STATUS','PARTIAL_SUCCESS','부분성공',30),
('BATCH_STATUS','FAILED','실패',40),
('LOG_ACTION','AUTH_REGISTER','회원가입',10),
('LOG_ACTION','AUTH_LOGIN_SUCCESS','로그인성공',20),
('LOG_ACTION','AUTH_LOGIN_FAIL','로그인실패',30),
('LOG_ACTION','SCREEN_SEARCH','검색실행',40),
('LOG_ACTION','PRESET_CHANGE','프리셋변경',50),
('LOG_ACTION','WATCHLIST_CHANGE','관심종목변경',60),
('LOG_ACTION','ADMIN_CONFIG_CHANGE','관리자설정변경',70),
('SYS001','100','PER 허용오차',100),
('SYS001','110','ROE 허용오차',110),
('SYS001','120','PBR 허용오차',120),
('SYS001','130','부채비율 허용오차',130),
('SYS001','140','EPS성장률 허용오차',140)
ON CONFLICT (group_code, code) DO UPDATE SET
  code_name=EXCLUDED.code_name,
  sort_order=EXCLUDED.sort_order,
  updated_at=now();

INSERT INTO entitlement(entitlement_code, entitlement_name, description) VALUES
('AD_FREE','광고 제거','광고 제거 권한'),
('AI_BASIC','AI Basic','향후 기본 AI 분석 권한'),
('AI_PRO','AI Pro','향후 고급 AI 분석 권한')
ON CONFLICT (entitlement_code) DO UPDATE SET
  entitlement_name=EXCLUDED.entitlement_name,
  description=EXCLUDED.description;
