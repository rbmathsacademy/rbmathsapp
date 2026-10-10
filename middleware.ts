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

  return NextResponse.next();
}

// Ensure middleware applies only to relevant paths, ignoring static files and Next.js internals
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/chat/batch-status).*)',
  ],
};
