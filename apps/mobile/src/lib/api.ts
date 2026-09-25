import { Platform } from 'react-native';
import { clearTokens, getAccess, getRefresh, saveTokens } from './session';
const BASE =
  Platform.OS === 'web'
    ? (process.env.EXPO_PUBLIC_API_BASE_URL_WEB ?? 'http://localhost:3000/api')
    : (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:3000/api');

async function request(path: string, init?: RequestInit, access?: string | null) {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

function userMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/failed to fetch|network request failed|networkerror/i.test(message)) {
    return '서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';
  }
  return message;
}

export async function api<T>(path: string, init?: RequestInit, authenticated = false): Promise<T> {
  let access = authenticated ? await getAccess() : null;
  let response: Response;
  try {
    response = await request(path, init, access);
  } catch (error) {
    throw new Error(userMessage(error));
  }
  if (authenticated && response.status === 401) {
    const refresh = await getRefresh();
    if (refresh) {
      const rr = await request('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (rr.ok) {
        const tokens = await rr.json();
        await saveTokens(tokens);
        access = tokens.accessToken;
        response = await request(path, init, access);
      } else await clearTokens();
    }
  }
  if (!response.ok) {
    let message: any = '요청 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    try {
      const body = await response.json();
      message = body.message ?? message;
    } catch {}
    throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
  }
  return response.json() as Promise<T>;
}

export type ScreenCondition = {
  metricCode: string;
  operator: 'LTE' | 'GTE' | 'LT' | 'GT' | 'EQ' | 'BETWEEN';
  target: number;
  target2?: number;
  weight?: number;
};
export type ScreenResult = {
  securityId: number;
  ticker: string;
  name: string;
  marketCode: string;
  exchangeCode: string;
  matchType: 'EXACT' | 'NEAR';
  similarity: number;
  details: any[];
};
export type ScreenPreset = {
  preset_id: number;
  preset_name: string;
  description: string | null;
  search_mode: 'GENERAL' | 'ADVANCED_BASIC' | 'ADVANCED_DETAIL';
  market_filter_json: string[];
  exchange_filter_json: string[];
  conditions: ScreenCondition[];
};
export async function runScreening(body: {
  strategyCode?: string;
  marketCodes?: string[];
  exchangeCodes?: string[];
  conditions?: ScreenCondition[];
  limit?: number;
}) {
  return api<{ exactCount: number; nearCount: number; elapsedMs: number; results: ScreenResult[] }>(
    '/screening/search',
    { method: 'POST', body: JSON.stringify(body) },
    true,
  );
}
