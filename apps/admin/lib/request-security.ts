import { NextRequest, NextResponse } from 'next/server';

export function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin === null) return true;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0].trim() ?? request.headers.get('host');
  const protocol =
    request.headers.get('x-forwarded-proto')?.split(',')[0].trim() ??
    request.nextUrl.protocol.replace(':', '');
  return parsed.host === host && parsed.protocol === `${protocol}:`;
}

export function rejectCrossOrigin(request: NextRequest) {
  return isSameOrigin(request)
    ? null
    : NextResponse.json({ message: 'cross-origin request rejected' }, { status: 403 });
}

export function clearAdminCookies(response: NextResponse) {
  for (const name of ['admin_access', 'admin_refresh']) {
    response.cookies.set(name, '', {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });
  }
}
