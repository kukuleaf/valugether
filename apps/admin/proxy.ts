import { NextRequest, NextResponse } from 'next/server';
export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/login') || req.nextUrl.pathname.startsWith('/api/session'))
    return NextResponse.next();
  if (!req.cookies.get('admin_access') && !req.cookies.get('admin_refresh'))
    return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
}
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/tolerances/:path*',
    '/providers/:path*',
    '/batches/:path*',
    '/rankings/:path*',
    '/strategies/:path*',
    '/notices/:path*',
    '/logs/:path*',
    '/terms/:path*',
  ],
};
