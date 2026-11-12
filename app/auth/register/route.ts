import { NextRequest, NextResponse } from 'next/server';

import { createOAuthAuthorizationUrl } from '@/lib/oauth-flow';

export async function GET(request: NextRequest) {
  try {
    const { authorizeUrl, loginUrl } = await createOAuthAuthorizationUrl(
      request.nextUrl.origin,
      request.nextUrl.searchParams.get('next'),
    );
    const registerUrl = new URL('/register', loginUrl);
    registerUrl.searchParams.set('authorize_redirect', authorizeUrl.toString());
    const email = request.nextUrl.searchParams.get('email');
    if (email && email.length <= 320) {
      registerUrl.searchParams.set('email', email);
    }
    if (request.nextUrl.searchParams.get('verification_mode') === 'otp') {
      registerUrl.searchParams.set('verification_mode', 'otp');
    }

    return NextResponse.redirect(registerUrl);
  } catch (error) {
    console.error('Website Platform could not start OAuth registration:', error);
    return NextResponse.redirect(new URL('/?authError=server_misconfigured', request.url));
  }
}
