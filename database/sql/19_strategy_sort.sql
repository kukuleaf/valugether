-- Strategy result order is managed separately from screening conditions.
ALTER TABLE screen_strategy
  ADD COLUMN IF NOT EXISTS sort_metric_code varchar(80) DEFAULT 'PER' REFERENCES financial_metric(metric_code);

ALTER TABLE screen_strategy
  ADD COLUMN IF NOT EXISTS sort_direction varchar(4) NOT NULL DEFAULT 'ASC'
    CHECK (sort_direction IN ('ASC', 'DESC'));
