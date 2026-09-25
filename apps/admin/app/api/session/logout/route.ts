import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { clearAdminCookies, rejectCrossOrigin } from '../../../../lib/request-security';

export async function POST(request: NextRequest) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  const jar = await cookies();
  const refreshToken = jar.get('admin_refresh')?.value;
  if (refreshToken) {
    const base = process.env.ADMIN_API_BASE_URL ?? 'http://localhost:3000/api';
    await fetch(`${base}/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    }).catch(() => undefined);
  }

  const response = NextResponse.redirect(new URL('/login', request.url), 303);
  clearAdminCookies(response);
  return response;
}
