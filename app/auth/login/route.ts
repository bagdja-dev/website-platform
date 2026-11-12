import { NextRequest, NextResponse } from 'next/server';

import { createOAuthAuthorizationUrl } from '@/lib/oauth-flow';

export async function GET(request: NextRequest) {
  try {
    const { authorizeUrl } = await createOAuthAuthorizationUrl(
      request.nextUrl.origin,
      request.nextUrl.searchParams.get('next'),
      'login',
      request.nextUrl.searchParams.get('email'),
    );
    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    console.error('Website Platform could not start OAuth login:', error);
    return NextResponse.redirect(new URL('/?authError=server_misconfigured', request.url));
  }
}
