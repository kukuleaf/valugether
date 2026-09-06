import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
    return r.json() as Promise<any>;
  }
}
