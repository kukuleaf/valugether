BEGIN;

CREATE TABLE IF NOT EXISTS terms_document (
  term_id         bigserial PRIMARY KEY,
  term_code       varchar(50) NOT NULL,
  title           varchar(200) NOT NULL,
  version         varchar(30) NOT NULL,
  content         text NOT NULL,
  is_required     boolean NOT NULL DEFAULT true,
  status_code     varchar(20) NOT NULL DEFAULT 'DRAFT'
                  CHECK (status_code IN ('DRAFT', 'PUBLISHED', 'RETIRED')),
  effective_from  timestamptz,
  published_at    timestamptz,
  created_by      uuid REFERENCES app_user(user_id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (term_code, version)
);

ALTER TABLE user_consent
  ADD COLUMN IF NOT EXISTS term_id bigint REFERENCES terms_document(term_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_user_consent_term
  ON user_consent(user_id, term_id)
  WHERE term_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_terms_public
  ON terms_document(status_code, effective_from, term_code);

INSERT INTO terms_document
  (term_code, title, version, content, is_required, status_code, effective_from, published_at)
VALUES
  (
    'SERVICE',
    '서비스 이용약관',
    '1.0',
    E'가치보는주식(Valugether)은 기업 정보를 이해하기 쉽게 제공하는 서비스입니다.\n\n검색 결과는 투자 권유나 수익 보장이 아니며, 최종 투자 판단과 책임은 이용자에게 있습니다. 이용자는 서비스를 법령에 어긋나는 목적으로 사용할 수 없습니다.',
    true,
    'PUBLISHED',
    now(),
    now()
  ),
  (
    'PRIVACY',
    '개인정보 수집 및 이용 동의',
    '1.0',
    E'수집 항목: 이메일, 암호화된 비밀번호, 서비스 이용 기록\n\n이용 목적: 회원 식별, 로그인, 관심종목과 검색조건 저장, 서비스 보안\n\n보관 기간: 회원 탈퇴 후 법령상 보관 기간이 지나면 파기합니다.',
    true,
    'PUBLISHED',
    now(),
    now()
  ),
  (
    'INVESTMENT_NOTICE',
    '투자정보 이용 안내',
    '1.0',
    E'제공되는 재무정보와 검색 결과는 참고자료입니다. 데이터가 늦게 반영되거나 오류가 있을 수 있으므로 실제 투자 전 공시와 거래 정보를 직접 확인해야 합니다.',
    true,
    'PUBLISHED',
    now(),
    now()
  ),
  (
    'MARKETING',
    '혜택 및 소식 알림 동의',
    '1.0',
    E'새로운 기능, 투자 학습 콘텐츠, 이벤트 소식을 이메일 또는 앱 알림으로 받을 수 있습니다. 동의하지 않아도 서비스를 이용할 수 있으며 언제든 철회할 수 있습니다.',
    false,
    'PUBLISHED',
    now(),
    now()
  )
ON CONFLICT (term_code, version) DO NOTHING;

COMMIT;
