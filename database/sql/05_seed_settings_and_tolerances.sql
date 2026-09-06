INSERT INTO system_setting(setting_key, setting_value, value_type, description) VALUES
('screen.default_tolerance_type','PERCENT','STRING','지표별 오차가 없을 때 사용할 유형'),
('screen.default_tolerance_value','0','DECIMAL','기본 허용오차. 0이면 정확검색'),
('screen.max_results','200','INTEGER','검색 최대 반환 수'),
('screen.near_enabled','true','BOOLEAN','근접검색 활성화'),
('screen.missing_metric_policy','EXCLUDE','STRING','조건 지표 누락시 기본 정책'),
('market.price_display_mode','EOD','STRING','초기 가격표시 방식'),
('ads.enabled','false','BOOLEAN','개발단계 광고 비활성'),
('ai.enabled','false','BOOLEAN','AI 기능 초기 비활성'),
('privacy.store_raw_ip','false','BOOLEAN','원 IP 저장 금지')
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value=EXCLUDED.setting_value,
  value_type=EXCLUDED.value_type,
  description=EXCLUDED.description,
  updated_at=now();

WITH m AS (SELECT metric_id, metric_code FROM financial_metric)
INSERT INTO screen_metric_tolerance
(setting_group_code, setting_detail_code, metric_id, operator_code, tolerance_type, tolerance_value, effective_from)
SELECT 'SYS001', x.detail_code, m.metric_id, x.operator_code, x.tolerance_type, x.tolerance_value, DATE '2026-01-01'
FROM (VALUES
 ('100','PER','LTE','PERCENT',0.10::numeric),
 ('110','ROE','GTE','PERCENT',0.10::numeric),
 ('120','PBR','LTE','PERCENT',0.05::numeric),
 ('130','DEBT_RATIO','LTE','PERCENT',0.10::numeric),
 ('140','EPS_GROWTH_YOY','GTE','PERCENT',0.10::numeric),
 ('150','PSR','LTE','PERCENT',0.05::numeric),
 ('160','CURRENT_RATIO','GTE','PERCENT',0.10::numeric),
 ('170','REVENUE_GROWTH_YOY','GTE','PERCENT',0.10::numeric),
 ('180','OPERATING_MARGIN','GTE','PERCENT',0.10::numeric),
 ('190','DIVIDEND_YIELD','GTE','PERCENT',0.10::numeric)
) AS x(detail_code, metric_code, operator_code, tolerance_type, tolerance_value)
JOIN m ON m.metric_code=x.metric_code
ON CONFLICT (setting_group_code, setting_detail_code, effective_from) DO NOTHING;
