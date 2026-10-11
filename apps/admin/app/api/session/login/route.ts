import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossOrigin } from '../../../../lib/request-security';
export async function POST(req: NextRequest) {
  const rejected = rejectCrossOrigin(req);
  if (rejected) return rejected;
  try {
    const body = await req.text();
    const base = process.env.ADMIN_API_BASE_URL ?? 'http://localhost:3000/api';
    const login = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!login.ok) return NextResponse.json({ ok: false }, { status: 401 });
    const tokens = await login.json();
    // Verify this access token can actually call an ADMIN endpoint before creating the session.
    const probe = await fetch(`${base}/admin/dashboard`, {
      headers: { authorization: `Bearer ${tokens.accessToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!probe.ok) return NextResponse.json({ ok: false }, { status: 403 });
    const res = NextResponse.json({ ok: true });
    res.cookies.set('admin_access', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: tokens.expiresInSeconds ?? 900,
    });
    res.cookies.set('admin_refresh', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 30 * 86400,
    });
    return res;
  } catch {
    return NextResponse.json({ message: 'API 서버에 연결하지 못했습니다.' }, { status: 503 });
  }
}
