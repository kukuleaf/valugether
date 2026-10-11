'use client';

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '요청을 처리하지 못했습니다. 다시 시도하세요.';
}

export async function adminFetch(path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(path, { ...init, cache: 'no-store' });
  } catch {
    throw new Error('서버에 연결하지 못했습니다. 연결 상태를 확인하고 다시 시도하세요.');
  }
  if (response.status === 401) {
    window.location.assign('/login');
    throw new Error('로그인이 만료되었습니다. 다시 로그인하세요.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.message ?? '요청을 처리하지 못했습니다. 다시 시도하세요.';
    throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
  }
  return response;
}

export async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await adminFetch(path, init);
  return response.json();
}
