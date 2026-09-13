import { Inject, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Pool } from 'pg';
import { DB_POOL } from '../common/database/database.module';

type RankingRow = {
  company_name: string;
  ticker: string;
  market_code: string;
  currency_code: string;
  basis_value: string;
  basis_date: string;
  per: string | null;
  earnings_yield: string | null;
  eps: string | null;
  close_price: string | null;
  pbr: string | null;
  roe: string | null;
  revenue_growth: string | null;
  operating_income_growth: string | null;
  profitable_ttm: string | null;
  net_income: string | null;
  debt_ratio: string | null;
  current_ratio: string | null;
  psr: string | null;
};

type ExportOptions = {
  marketCode?: string;
  limit?: number;
};

const BLUE = 'FF17324D';
const LIGHT_BLUE = 'FFEAF2F8';
const PALE_GREEN = 'FFE8F5E9';
const BORDER = 'FFD9E2EA';

@Injectable()
export class RankingExportService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async build(options: ExportOptions = {}) {
    const marketCode = options.marketCode?.trim().toUpperCase() || undefined;
    const limit = Math.min(Math.max(Math.trunc(options.limit ?? 100), 1), 500);
    const [revenue, operatingIncome] = await Promise.all([
      this.rankBy('REVENUE', marketCode, limit),
      this.rankBy('OPERATING_INCOME', marketCode, limit),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Right Stock Value';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.calcProperties.fullCalcOnLoad = true;

    this.addSheet(workbook, '매출기준_기업순위분석', '매출액', revenue, marketCode);
    this.addSheet(workbook, '영업이익기준_기업순위분석', '영업이익', operatingIncome, marketCode);

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private async rankBy(
    metricCode: 'REVENUE' | 'OPERATING_INCOME',
    marketCode: string | undefined,
    limit: number,
  ) {
    const result = await this.db.query<RankingRow>(
      `select
         c.display_name as company_name,
         s.ticker,
         e.market_code,
         s.currency_code,
         basis.numeric_value::text as basis_value,
         basis.as_of_date::text as basis_date,
         max(metric_value.numeric_value) filter (where metric.metric_code='PER')::text as per,
         max(metric_value.numeric_value) filter (where metric.metric_code='EARNINGS_YIELD')::text as earnings_yield,
         coalesce(
           max(metric_value.numeric_value) filter (where metric.metric_code='EPS_DILUTED'),
           max(metric_value.numeric_value) filter (where metric.metric_code='EPS_BASIC')
         )::text as eps,
         coalesce(
           max(metric_value.numeric_value) filter (where metric.metric_code='CLOSE_PRICE'),
           price.close_price
         )::text as close_price,
         max(metric_value.numeric_value) filter (where metric.metric_code='PBR')::text as pbr,
         max(metric_value.numeric_value) filter (where metric.metric_code='ROE')::text as roe,
         max(metric_value.numeric_value) filter (where metric.metric_code='REVENUE_GROWTH_YOY')::text as revenue_growth,
         max(metric_value.numeric_value) filter (where metric.metric_code='OPERATING_INCOME_GROWTH_YOY')::text as operating_income_growth,
         max(metric_value.numeric_value) filter (where metric.metric_code='PROFITABLE_TTM')::text as profitable_ttm,
         max(metric_value.numeric_value) filter (where metric.metric_code='NET_INCOME')::text as net_income,
         max(metric_value.numeric_value) filter (where metric.metric_code='DEBT_RATIO')::text as debt_ratio,
         max(metric_value.numeric_value) filter (where metric.metric_code='CURRENT_RATIO')::text as current_ratio,
         max(metric_value.numeric_value) filter (where metric.metric_code='PSR')::text as psr
       from security s
       join company c on c.company_id=s.company_id and c.is_active=true
       join exchange e on e.exchange_id=s.exchange_id and e.is_active=true
       join financial_metric basis_metric on basis_metric.metric_code=$1
       join latest_metric_value basis
         on basis.security_id=s.security_id and basis.metric_id=basis_metric.metric_id
       left join latest_metric_value metric_value on metric_value.security_id=s.security_id
       left join financial_metric metric on metric.metric_id=metric_value.metric_id
       left join v_latest_price price on price.security_id=s.security_id
       where s.is_active=true
         and s.security_type <> 'ADR'
         and ($2::text is null or e.market_code=$2)
         and basis.numeric_value is not null
       group by c.display_name, s.ticker, e.market_code, s.currency_code,
                basis.numeric_value, basis.as_of_date, price.close_price
       order by basis.numeric_value desc, c.display_name, s.ticker
       limit $3`,
      [metricCode, marketCode ?? null, limit],
    );
    return result.rows;
  }

  private addSheet(
    workbook: ExcelJS.Workbook,
    name: string,
    basisLabel: string,
    rows: RankingRow[],
    marketCode?: string,
  ) {
    const sheet = workbook.addWorksheet(name, {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 3 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      properties: { defaultRowHeight: 18 },
    });

    sheet.mergeCells('A1:W1');
    const title = sheet.getCell('A1');
    title.value = `${basisLabel} 기준 기업 순위 분석`;
    title.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
    title.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(1).height = 30;

    sheet.mergeCells('A2:W2');
    const meta = sheet.getCell('A2');
    meta.value = `시장: ${marketCode ?? '전체'} | 생성: ${new Date().toISOString()} | 단위: 기업별 표시 통화`;
    meta.font = { size: 10, color: { argb: 'FF526577' } };
    meta.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };

    const headers = [
      '순위',
      '기업명',
      '티커',
      '시장',
      `${basisLabel} 금액`,
      '통화',
      '기준일',
      'PER',
      '1/PER (%)',
      'EPS',
      '최근 종가',
      '적정가 (PER 25)',
      '적정가 (PER 20)',
      '적정가 (PER 15)',
      'PBR',
      'ROE (%)',
      '매출 증가율 (%)',
      '영업이익 증가율 (%)',
      '흑자 여부',
      '부채비율 (%)',
      '유동비율 (%)',
      'PSR',
      '데이터 출처',
    ];
    sheet.addRow(headers);
    const header = sheet.getRow(3);
    header.height = 34;
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = { bottom: { style: 'thin', color: { argb: BORDER } } };
    });

    rows.forEach((row, index) => {
      const excelRow = index + 4;
      const per = this.number(row.per);
      const eps = this.number(row.eps);
      const earningsYield = this.number(row.earnings_yield) ?? (per ? 100 / per : null);
      const profitable = this.profitability(row);
      const data = sheet.addRow([
        index + 1,
        row.company_name,
        row.ticker,
        row.market_code,
        this.number(row.basis_value),
        row.currency_code,
        row.basis_date,
        per,
        earningsYield,
        eps,
        this.number(row.close_price),
        eps == null ? null : { formula: `J${excelRow}*25`, result: eps * 25 },
        eps == null ? null : { formula: `J${excelRow}*20`, result: eps * 20 },
        eps == null ? null : { formula: `J${excelRow}*15`, result: eps * 15 },
        this.number(row.pbr),
        this.number(row.roe),
        this.number(row.revenue_growth),
        this.number(row.operating_income_growth),
        profitable,
        this.number(row.debt_ratio),
        this.number(row.current_ratio),
        this.number(row.psr),
        'DB 최신 적재값',
      ]);
      data.height = 21;
      data.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = { bottom: { style: 'hair', color: { argb: BORDER } } };
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      });
      for (const column of [2, 3, 4, 6, 7, 19, 23]) {
        data.getCell(column).alignment = { vertical: 'middle', horizontal: 'left' };
      }
      if (index % 2 === 1) {
        data.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAFC' } };
        });
      }
      if (profitable === '흑자') {
        data.getCell(19).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: PALE_GREEN },
        };
      }
    });

    sheet.autoFilter = { from: 'A3', to: `W${Math.max(rows.length + 3, 3)}` };
    sheet.columns = [
      { width: 8 },
      { width: 32 },
      { width: 14 },
      { width: 12 },
      { width: 20 },
      { width: 10 },
      { width: 14 },
      { width: 12 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 12 },
      { width: 14 },
      { width: 18 },
      { width: 22 },
      { width: 12 },
      { width: 16 },
      { width: 16 },
      { width: 12 },
      { width: 18 },
    ];
    for (const column of ['E', 'J', 'K', 'L', 'M', 'N'])
      sheet.getColumn(column).numFmt = '#,##0.00';
    for (const column of ['H', 'I', 'O', 'P', 'Q', 'R', 'T', 'U', 'V']) {
      sheet.getColumn(column).numFmt = '0.00';
    }
    sheet.getColumn('G').numFmt = 'yyyy-mm-dd';
  }

  private number(value: string | null) {
    if (value == null || value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private profitability(row: RankingRow) {
    const profitable = this.number(row.profitable_ttm);
    const netIncome = this.number(row.net_income);
    if (profitable != null) return profitable > 0 ? '흑자' : '적자';
    if (netIncome != null) return netIncome > 0 ? '흑자' : '적자';
    return '';
  }
}
