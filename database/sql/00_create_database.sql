-- Run while connected to postgres (or another maintenance DB).
-- Development credentials only. Change in real environments.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stock_app') THEN
    CREATE ROLE stock_app LOGIN PASSWORD 'stock_app_dev_password';
  END IF;
END $$;

-- Keep an existing local development volume aligned with apps/api/.env.
ALTER ROLE stock_app WITH LOGIN PASSWORD 'stock_app_dev_password';

SELECT 'CREATE DATABASE stock_screener OWNER stock_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'stock_screener')\gexec
