import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  
  // Skip logic if it's localhost (for development)
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return NextResponse.next();
  }

  // Get current date in IST (UTC+5:30)
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istTime = new Date(utc + (3600000 * 5.5));
  const currentDay = istTime.getDate();

  // Determine active domain based on the date
  // 10th - 24th -> rbmathsapp9.vercel.app
  // Other days -> rbmathsapp92.vercel.app
  const targetDomain = (currentDay >= 10 && currentDay <= 24) 
    ? 'rbmathsapp9.vercel.app' 
    : 'rbmathsapp92.vercel.app';

  // If the user visits the inactive domain, redirect them instantly
  if (hostname !== targetDomain && (hostname === 'rbmathsapp9.vercel.app' || hostname === 'rbmathsapp92.vercel.app')) {
    const url = request.nextUrl.clone();
    url.hostname = targetDomain;
    url.port = ''; // Ensure no port is used in production
    url.protocol = 'https:';
    
    // Use a 302 Found (temporary redirect) because the active domain shifts over time
    return NextResponse.redirect(url, 302);
  }

  const reset = studentAppReset(request);
  if (reset) return reset;

  return NextResponse.next();
}

// ── One-time student app reset ─────────────────────────────────────────────────────────────
// Some phones (the Android WebView app) kept running an old cached copy of the student app. On a
// device's first student request after this version ships, the server tells the browser engine
// itself to wipe the offline cache, the service worker and stored data (Clear-Site-Data - this works
// even though the old app code knows nothing about it) and logs the student out, so they log in
// again on the latest app. A marker cookie makes it happen once per device. Bump the version to
// run another reset in future.
const STUDENT_RESET_VERSION = '2026-10-22';
const RESET_COOKIE = 'student_app_reset';

function studentAppReset(request: NextRequest): NextResponse | null {
  const path = request.nextUrl.pathname;
  const studentArea = path === '/student' || path.startsWith('/student/') || path.startsWith('/api/student/');
  if (!studentArea || request.cookies.get(RESET_COOKIE)?.value === STUDENT_RESET_VERSION) return null;

  const markDone = (res: NextResponse) => {
    res.cookies.set(RESET_COOKIE, STUDENT_RESET_VERSION, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', secure: true });
    return res;
  };

  // Never interrupt someone who is taking an online test right now; reset on their next normal page
  const referer = request.headers.get('referer') || '';
  if (/^\/student\/online-test\/[^/]+$/.test(path) || path.startsWith('/api/student/online-tests/') || /\/student\/online-test\/[^/?#]+(?:$|[?#])/.test(referer)) {
    return null;
  }

  // Logging in / signing up: don't wipe the session being created, just mark the device as done
  if (/^\/api\/student\/(login|auth|guest-register|register)/.test(path)) {
    return markDone(NextResponse.next());
  }

  const res = NextResponse.next();
  res.headers.set('Clear-Site-Data', '"cache", "storage"');
  res.cookies.set('auth_token', '', { path: '/', maxAge: 0 }); // one-time logout
  return markDone(res);
}

// Ensure middleware applies only to relevant paths, ignoring static files and Next.js internals
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/chat/batch-status).*)',
  ],
};
