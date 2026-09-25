import { Pool } from 'pg';

async function main() {
  const db = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const [exchanges, prices, metrics, demos] = await Promise.all([
      db.query(
        `select e.exchange_code,count(*)::int active_securities
         from security s join exchange e on e.exchange_id=s.exchange_id
         join company c on c.company_id=s.company_id
         where s.is_active=true and c.is_active=true
         group by e.exchange_code order by e.exchange_code`,
      ),
      db.query(
        `select e.exchange_code,latest.trade_date::text latest_trade_date,
                count(distinct p.security_id)::int securities_at_latest_date
         from exchange e
         left join lateral (
           select max(p2.trade_date) trade_date
           from security s2
           join daily_price p2 on p2.security_id=s2.security_id
           where s2.exchange_id=e.exchange_id
         ) latest on true
         left join security s on s.exchange_id=e.exchange_id
         left join daily_price p on p.security_id=s.security_id and p.trade_date=latest.trade_date
         group by e.exchange_code,latest.trade_date
         order by e.exchange_code`,
      ),
      db.query(
        `select p.provider_code,count(distinct fp.company_id)::int companies,
                count(f.*)::int facts
         from financial_period fp
         join data_provider p on p.provider_id=fp.source_provider_id
         join financial_fact f on f.financial_period_id=fp.financial_period_id
         group by p.provider_code order by p.provider_code`,
      ),
      db.query(
        `select count(*)::int count from company where is_active=true and sec_cik like 'DEMO%'`,
      ),
    ]);
    process.stdout.write(
      `${JSON.stringify(
        {
          exchanges: exchanges.rows,
          latestPrices: prices.rows,
          financials: metrics.rows,
          activeDemoCompanies: demos.rows[0].count,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
