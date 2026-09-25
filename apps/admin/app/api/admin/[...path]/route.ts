import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { clearAdminCookies, rejectCrossOrigin } from '../../../../lib/request-security';

async function callNest(req: NextRequest, path: string[], token: string) {
  const base = process.env.ADMIN_API_BASE_URL ?? 'http://localhost:3000/api';
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.clone().text();
  return fetch(`${base}/admin/${path.join('/')}${req.nextUrl.search}`, {
    method: req.method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body,
    cache: 'no-store',
  });
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    const rejected = rejectCrossOrigin(req);
    if (rejected) return rejected;
  }
  const { path } = await ctx.params;
  const jar = await cookies();
  let access = jar.get('admin_access')?.value;
  const refresh = jar.get('admin_refresh')?.value;
  if (!access && !refresh) return NextResponse.json({ message: 'unauthorized' }, { status: 401 });

  let upstream = access ? await callNest(req, path, access) : null;
  let newTokens: any = null;
  if ((!upstream || upstream.status === 401) && refresh) {
    const base = process.env.ADMIN_API_BASE_URL ?? 'http://localhost:3000/api';
    const rr = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
      cache: 'no-store',
    });
    if (rr.ok) {
      newTokens = await rr.json();
      access = newTokens.accessToken;
      upstream = await callNest(req, path, access!);
    }
  }
  if (!upstream) return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  const headers = new Headers();
  for (const name of [
    'content-type',
    'content-disposition',
    'cache-control',
    'x-request-id',
    'retry-after',
  ]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  const res = new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers,
  });
  if (newTokens) {
    res.cookies.set('admin_access', newTokens.accessToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: newTokens.expiresInSeconds ?? 900,
    });
    res.cookies.set('admin_refresh', newTokens.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 30 * 86400,
    });
  }
  if (upstream.status === 401) clearAdminCookies(res);
  return res;
}
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
