import { NextRequest, NextResponse } from 'next/server';

import { clearSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/', request.url), 303);
  clearSession(response);
  return response;
}
