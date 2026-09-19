export interface KisTokenResponse {
  access_token?: string;
  expires_in?: number;
  error_code?: string;
  error_description?: string;
}

export interface KisDailyPriceItem {
  stck_bsop_date?: string;
  stck_oprc?: string;
  stck_hgpr?: string;
  stck_lwpr?: string;
  stck_clpr?: string;
  acml_vol?: string;
}

export interface KisDailyPriceResponse {
  rt_cd?: string;
  msg_cd?: string;
  msg1?: string;
  output?: KisDailyPriceItem[];
}

export interface KisOverseasDailyPriceItem {
  xymd?: string;
  open?: string;
  high?: string;
  low?: string;
  clos?: string;
  tvol?: string;
}

export interface KisOverseasDailyPriceResponse {
  rt_cd?: string;
  msg_cd?: string;
  msg1?: string;
  output2?: KisOverseasDailyPriceItem[];
}
