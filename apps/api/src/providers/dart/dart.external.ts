import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DartFinancialAccount {
  rcept_no: string;
  reprt_code: '11011' | '11012' | '11013' | '11014';
  bsns_year: string;
  corp_code: string;
  sj_div: 'BS' | 'IS' | 'CIS' | 'CF' | 'SCE' | string;
  sj_nm: string;
  account_id: string;
  account_nm: string;
  account_detail: string;
  thstrm_nm: string;
  thstrm_amount: string;
  thstrm_add_amount?: string;
  frmtrm_nm: string;
  frmtrm_amount: string;
  frmtrm_q_nm?: string;
  frmtrm_q_amount?: string;
  frmtrm_add_amount?: string;
  bfefrmtrm_nm?: string;
  bfefrmtrm_amount?: string;
  ord: string;
  currency: string;
}

export interface DartFinancialResponse {
  status: string;
  message: string;
  list?: DartFinancialAccount[];
}

@Injectable()
export class DartExternalClient {
  constructor(private readonly config: ConfigService) {}

  async fetchAllAccounts(corpCode: string, bsnsYear: number, reprtCode: string, fsDiv = 'CFS') {
    const key = this.config.get<string>('DART_API_KEY');
    if (!key) throw new Error('DART_API_KEY is not configured');
    const url = new URL('https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json');
    url.searchParams.set('crtfc_key', key);
    url.searchParams.set('corp_code', corpCode);
    url.searchParams.set('bsns_year', String(bsnsYear));
    url.searchParams.set('reprt_code', reprtCode);
    url.searchParams.set('fs_div', fsDiv);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`DART HTTP ${r.status}`);
    return r.json() as Promise<DartFinancialResponse>;
  }
}
