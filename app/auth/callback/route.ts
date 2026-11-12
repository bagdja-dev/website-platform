import { NextRequest, NextResponse } from 'next/server';

import { consumeOAuthState } from '@/lib/oauth-state-store';
import { getAuthConfig } from '@/lib/platform-config';
import { setSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const authError = searchParams.get('error');
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (authError) {
    return NextResponse.redirect(new URL('/?authError=access_denied', request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/?authError=missing_parameters', request.url));
  }

  try {
    const savedState = await consumeOAuthState(state);
    if (!savedState) {
      return NextResponse.redirect(new URL('/?authError=state_mismatch', request.url));
    }

    const config = getAuthConfig();
    const tokenResponse = await fetch(new URL('/oauth/token', config.loginUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code_verifier: savedState.codeVerifier,
      }),
      cache: 'no-store',
    });

    if (!tokenResponse.ok) {
      console.error(`Website Platform OAuth token exchange failed (${tokenResponse.status})`);
      return NextResponse.redirect(new URL('/?authError=token_exchange_failed', request.url));
    }

    const tokenData: unknown = await tokenResponse.json();
    if (
      !tokenData ||
      typeof tokenData !== 'object' ||
      !('access_token' in tokenData) ||
      typeof tokenData.access_token !== 'string' ||
      tokenData.access_token.length === 0
    ) {
      console.error('Website Platform OAuth token response did not contain an access token');
      return NextResponse.redirect(new URL('/?authError=invalid_token_response', request.url));
    }

    const response = NextResponse.redirect(
      new URL(savedState.nextPath ?? '/', request.url),
    );
    setSession(response, tokenData.access_token);
    return response;
  } catch (error) {
    console.error('Website Platform OAuth callback failed:', error);
    return NextResponse.redirect(new URL('/?authError=server_error', request.url));
  }
}
