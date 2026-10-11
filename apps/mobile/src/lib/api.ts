import { Platform } from 'react-native';
import { clearTokens, getAccess, getRefresh, saveTokens } from './session';
const BASE =
  Platform.OS === 'web'
    ? (process.env.EXPO_PUBLIC_API_BASE_URL_WEB ?? 'http://localhost:3000/api')
    : (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:3000/api');

async function request(path: string, init?: RequestInit, access?: string | null) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    return await fetch(`${BASE}${path}`, {
      signal: init?.signal ?? controller.signal,
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('연결이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.');
    }
    throw new Error(userMessage(error));
  } finally {
    clearTimeout(timeout);
  }
}

function userMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/failed to fetch|network request failed|networkerror/i.test(message)) {
    return '서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';
  }
  return message;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function responseError(response: Response, authenticated: boolean) {
  if (authenticated && response.status === 401) {
    return new ApiError('로그인이 만료되었습니다. 다시 로그인해 주세요.', 401);
  }
  let message: any = '요청 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  try {
    const body = await response.json();
    message = body.message ?? message;
  } catch {}
  return new ApiError(
    Array.isArray(message) ? message.join(', ') : String(message),
    response.status,
  );
}

let refreshing: Promise<string | null> | null = null;

function refreshAccess(expiredAccess: string | null) {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const currentAccess = await getAccess();
    if (currentAccess !== expiredAccess) return currentAccess;
    const refreshToken = await getRefresh();
    if (!refreshToken) {
      if (currentAccess) await clearTokens(null);
      return null;
    }
    const response = await request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        await clearTokens(refreshToken);
      }
      throw await responseError(response, true);
    }
    const tokens = await response.json();
    await saveTokens(tokens, refreshToken);
    return getAccess();
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function api<T>(path: string, init?: RequestInit, authenticated = false): Promise<T> {
  const access = authenticated ? await getAccess() : null;
  let response = await request(path, init, access);
  if (authenticated && response.status === 401) {
    const refreshedAccess = await refreshAccess(access);
    if (refreshedAccess) response = await request(path, init, refreshedAccess);
  }
  if (!response.ok) throw await responseError(response, authenticated);
  if (response.status === 204) return undefined as T;
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
  priceAsOfDate: string | null;
  priceStatus: 'CURRENT' | 'DELAYED' | 'MISSING';
  details: {
    metricCode: string;
    metricName: string;
    unitType: string;
    actual: number | null;
    asOfDate: string | null;
    target: number;
    target2?: number;
    operator: string;
    status: 'EXACT' | 'NEAR' | 'FAIL';
  }[];
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
