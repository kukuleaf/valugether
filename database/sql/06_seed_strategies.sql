INSERT INTO screen_strategy(strategy_code, strategy_name, description, display_order) VALUES
('UNDERVALUED','저평가 기업','이익과 자산가치에 비해 주가가 낮은 회사를 찾습니다.',10),
('STABLE','안정적인 기업','부채가 적고 현금 흐름이 안정적인 회사를 찾습니다.',20),
('GROWTH','성장하는 기업','매출과 주당순이익이 꾸준히 성장하는 회사를 찾습니다.',30),
('DIVIDEND','배당 기업','배당을 꾸준히 지급하면서 수익성도 갖춘 회사를 찾습니다.',40)
ON CONFLICT (strategy_code) DO UPDATE SET strategy_name=EXCLUDED.strategy_name, description=EXCLUDED.description;

-- Seed values are DEVELOPMENT defaults, not investment advice.
WITH c(strategy_code, metric_code, operator_code, target_value, weight, ord) AS (
VALUES
('UNDERVALUED','PER','LTE',15,1.2,10),
('UNDERVALUED','PBR','LTE',1.5,1.0,20),
('UNDERVALUED','ROE','GTE',8,1.0,30),
('STABLE','DEBT_RATIO','LTE',100,1.2,10),
('STABLE','CURRENT_RATIO','GTE',1.2,1.0,20),
('STABLE','FREE_CASH_FLOW','GTE',0,1.0,30),
('STABLE','PROFITABLE_CONSECUTIVE_YEARS','GTE',3,1.0,40),
('GROWTH','REVENUE_GROWTH_YOY','GTE',5,1.0,10),
('GROWTH','EPS_GROWTH_YOY','GTE',5,1.2,20),
('GROWTH','ROE','GTE',10,1.0,30),
('DIVIDEND','DIVIDEND_YIELD','GTE',2,1.2,10),
('DIVIDEND','DIVIDEND_CONSECUTIVE_YEARS','GTE',3,1.0,20),
('DIVIDEND','PAYOUT_RATIO','LTE',70,0.7,30),
('DIVIDEND','PROFITABLE_TTM','EQ',1,1.0,40)
)
INSERT INTO screen_strategy_condition(strategy_id, metric_id, operator_code, target_value, weight, display_order)
SELECT s.strategy_id, m.metric_id, c.operator_code, c.target_value, c.weight, c.ord
FROM c
JOIN screen_strategy s ON s.strategy_code=c.strategy_code
JOIN financial_metric m ON m.metric_code=c.metric_code
ON CONFLICT (strategy_id, metric_id, operator_code) DO UPDATE
SET target_value=EXCLUDED.target_value, weight=EXCLUDED.weight, display_order=EXCLUDED.display_order;
