import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import iconv from 'iconv-lite';
import JSZip from 'jszip';
import { Pool } from 'pg';
import { Inject } from '@nestjs/common';
import { DB_POOL } from '../common/database/database.module';

type MasterSymbol = { ticker: string; name: string };
type SecTicker = { cik: number; name: string; ticker: string; exchange: string };

@Injectable()
export class MasterDataSyncService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly config: ConfigService,
  ) {}

  async run(market: string) {
    const normalized = market.toUpperCase();
    if (normalized === 'KR') return this.syncKorea();
    if (normalized === 'US') return this.syncUnitedStates();
    throw new Error('market must be KR or US');
  }

  private async syncKorea() {
    const [kospi, kosdaq, dartCompanies] = await Promise.all([
      this.fetchKisMaster('kospi'),
      this.fetchKisMaster('kosdaq'),
      this.fetchDartCompanies(),
    ]);
    const kospiCount = await this.upsertKisSymbols('KOSPI', 'XKRX', kospi);
    const kosdaqCount = await this.upsertKisSymbols('KOSDAQ', 'XKOS', kosdaq);
    const dartMapped = await this.mapDartCompanies(dartCompanies);
    return {
      market: 'KR',
      source: ['KIS master', 'OpenDART corpCode'],
      kospi: kospiCount,
      kosdaq: kosdaqCount,
      dartMapped,
    };
  }

  private async syncUnitedStates() {
    const tickers = await this.fetchSecTickers();
    const eligible = tickers.filter(
      (item) => item.ticker && (item.exchange === 'Nasdaq' || item.exchange === 'NYSE'),
    );
    const result = await this.db.query(
      `with input as (
         select * from jsonb_to_recordset($1::jsonb)
           as x(cik bigint,name text,ticker text,exchange text)
       ), companies as (
         insert into company(legal_name,display_name,country_code,sec_cik,is_active)
         select distinct on (cik) name,name,'US',cik::text,true from input
         on conflict(sec_cik) do update set
           legal_name=excluded.legal_name,display_name=excluded.display_name,is_active=true,updated_at=now()
         returning company_id,sec_cik
       ), securities as (
         insert into security(company_id,exchange_id,ticker,security_name,currency_code,is_active)
         select c.company_id,e.exchange_id,i.ticker,i.name,'USD',true
         from input i
         join companies c on c.sec_cik=i.cik::text
         join exchange e on e.exchange_code=case when i.exchange='Nasdaq' then 'NASDAQ' else 'NYSE' end
         on conflict(exchange_id,ticker) do update set
           company_id=excluded.company_id,security_name=excluded.security_name,is_active=true,updated_at=now()
         returning security_id,exchange_id,ticker
       )
       insert into provider_security_map(
         provider_id,security_id,external_symbol,external_exchange,external_company_id,is_active,last_verified_at
       )
       select p.provider_id,s.security_id,s.ticker,
              case when e.exchange_code='NASDAQ' then 'NAS' else 'NYS' end,
              c.sec_cik,true,now()
       from securities s
       join exchange e on e.exchange_id=s.exchange_id
       join security sec on sec.security_id=s.security_id
       join company c on c.company_id=sec.company_id
       join data_provider p on p.provider_code='KIS'
       on conflict(provider_id,security_id) do update set
         external_symbol=excluded.external_symbol,
         external_exchange=excluded.external_exchange,
         external_company_id=excluded.external_company_id,
         is_active=true,last_verified_at=now()
       returning security_id`,
      [JSON.stringify(eligible)],
    );
    return {
      market: 'US',
      source: ['SEC ticker master', 'KIS price mapping'],
      downloaded: tickers.length,
      eligible: eligible.length,
      mapped: result.rowCount,
    };
  }

  private async upsertKisSymbols(exchangeCode: string, mic: string, symbols: MasterSymbol[]) {
    const client = await this.db.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into exchange(
           market_code,exchange_code,mic,exchange_name,country_code,currency_code,timezone_name,is_active
         ) values('KR',$1,$2,$1,'KR','KRW','Asia/Seoul',true)
         on conflict(exchange_code) do update set mic=excluded.mic,is_active=true`,
        [exchangeCode, mic],
      );
      await client.query(
        `create temporary table sync_kis_symbol(
           ticker text primary key,name text not null,exchange_code text not null,
           external_exchange text not null
         ) on commit drop`,
      );
      await client.query(
        `insert into sync_kis_symbol(ticker,name,exchange_code,external_exchange)
         select ticker,name,$2,$3
         from jsonb_to_recordset($1::jsonb) as x(ticker text,name text)
         on conflict(ticker) do update set name=excluded.name`,
        [JSON.stringify(symbols), exchangeCode, exchangeCode],
      );
      await client.query(
        `do $sync$
         declare item record; selected_company_id bigint; selected_security_id bigint;
         begin
           for item in select * from sync_kis_symbol loop
             select s.company_id,s.security_id into selected_company_id,selected_security_id
             from security s join exchange e on e.exchange_id=s.exchange_id
             where e.exchange_code=item.exchange_code and s.ticker=item.ticker;
             if selected_company_id is null then
               insert into company(legal_name,display_name,country_code,is_active)
               values(item.name,item.name,'KR',true) returning company_id into selected_company_id;
               insert into security(company_id,exchange_id,ticker,security_name,currency_code,is_active)
               select selected_company_id,exchange_id,item.ticker,item.name,'KRW',true
               from exchange where exchange_code=item.exchange_code
               returning security_id into selected_security_id;
             else
               update company set legal_name=item.name,display_name=item.name,is_active=true,updated_at=now()
               where company_id=selected_company_id;
               update security set security_name=item.name,is_active=true,updated_at=now()
               where security_id=selected_security_id;
             end if;
             insert into provider_security_map(
               provider_id,security_id,external_symbol,external_exchange,is_active,last_verified_at
             )
             select provider_id,selected_security_id,item.ticker,item.external_exchange,true,now()
             from data_provider where provider_code='KIS'
             on conflict(provider_id,security_id) do update set
               external_symbol=excluded.external_symbol,external_exchange=excluded.external_exchange,
               is_active=true,last_verified_at=now();
           end loop;
         end $sync$`,
      );
      await client.query('commit');
      return symbols.length;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private async fetchKisMaster(market: 'kospi' | 'kosdaq'): Promise<MasterSymbol[]> {
    const url = `https://new.real.download.dws.co.kr/common/master/${market}_code.mst.zip`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`KIS master HTTP ${response.status}`);
    const zip = await JSZip.loadAsync(await response.arrayBuffer());
    const file = Object.values(zip.files).find(
      (entry) => !entry.dir && entry.name.endsWith('.mst'),
    );
    if (!file) throw new Error(`KIS ${market} master file missing`);
    const body = await file.async('nodebuffer');
    const parsed = body
      .toString('binary')
      .split(/\r?\n/)
      .flatMap((line) => {
        const bytes = Buffer.from(line, 'binary');
        if (bytes.length < 61) return [];
        const rawTicker = bytes.subarray(0, 9).toString('ascii').trim();
        const ticker = rawTicker.replace(/^A/, '').slice(-6);
        const name = iconv.decode(bytes.subarray(21, 61), 'euc-kr').trim();
        return /^\d{6}$/.test(ticker) && name ? [{ ticker, name }] : [];
      });
    return [...new Map(parsed.map((item) => [item.ticker, item])).values()];
  }

  private async fetchSecTickers(): Promise<SecTicker[]> {
    const ua = this.config.get<string>('SEC_USER_AGENT');
    if (!ua) throw new Error('SEC_USER_AGENT is not configured');
    const response = await fetch('https://www.sec.gov/files/company_tickers_exchange.json', {
      headers: { 'User-Agent': ua, Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`SEC ticker master HTTP ${response.status}`);
    const body = (await response.json()) as { fields: string[]; data: unknown[][] };
    const positions = Object.fromEntries(body.fields.map((field, index) => [field, index]));
    return body.data.map((row) => ({
      cik: Number(row[positions.cik]),
      name: String(row[positions.name]),
      ticker: String(row[positions.ticker]),
      exchange: String(row[positions.exchange]),
    }));
  }

  private async fetchDartCompanies() {
    const key = this.config.get<string>('DART_API_KEY');
    if (!key) throw new Error('DART_API_KEY is not configured');
    const response = await fetch(
      `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${encodeURIComponent(key)}`,
    );
    if (!response.ok) throw new Error(`DART corp master HTTP ${response.status}`);
    const zip = await JSZip.loadAsync(await response.arrayBuffer());
    const file = Object.values(zip.files).find(
      (entry) => !entry.dir && entry.name.endsWith('.xml'),
    );
    if (!file) throw new Error('DART corp master XML missing');
    const xml = await file.async('string');
    return [...xml.matchAll(/<list>([\s\S]*?)<\/list>/g)].flatMap((match) => {
      const block = match[1];
      const value = (tag: string) =>
        (block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1] ?? '').trim();
      const ticker = value('stock_code');
      return /^\d{6}$/.test(ticker)
        ? [{ ticker, corpCode: value('corp_code'), name: value('corp_name') }]
        : [];
    });
  }

  private async mapDartCompanies(
    companies: Array<{ ticker: string; corpCode: string; name: string }>,
  ) {
    const result = await this.db.query(
      `with input as (
         select distinct on (ticker) ticker,"corpCode" corp_code,name
         from jsonb_to_recordset($1::jsonb)
           as x(ticker text,"corpCode" text,name text)
         order by ticker
       ), matched as (
         select distinct on (i.corp_code) s.company_id,i.corp_code,i.name
         from input i
         join security s on s.ticker=i.ticker
         join exchange e on e.exchange_id=s.exchange_id and e.market_code='KR'
         left join company owner on owner.dart_corp_code=i.corp_code
         where owner.company_id is null or owner.company_id=s.company_id
         order by i.corp_code,e.is_active desc,s.company_id
       )
       update company c set dart_corp_code=m.corp_code,legal_name=m.name,display_name=m.name,
         is_active=true,updated_at=now()
       from matched m where c.company_id=m.company_id
       returning c.company_id`,
      [JSON.stringify(companies)],
    );
    return result.rowCount;
  }
}
