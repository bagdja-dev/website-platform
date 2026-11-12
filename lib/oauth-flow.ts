import {
  generateCodeChallenge,
  generateCodeVerifier,
  getAuthConfig,
} from '@/lib/platform-config';
import {
  generateStateId,
  saveOAuthState,
} from '@/lib/oauth-state-store';
import { getSafeNextPath } from '@/lib/safe-next-path.mjs';

export async function createOAuthAuthorizationUrl(
  origin: string,
  nextPath: string | null,
  prompt?: string,
  loginHint?: string | null,
) {
  const config = getAuthConfig();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateStateId();

  await saveOAuthState(state, {
    codeVerifier,
    nextPath: getSafeNextPath(nextPath, origin),
  });

  const authorizeUrl = new URL('/oauth/authorize', config.loginUrl);
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('redirect_uri', config.redirectUri);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  if (prompt) authorizeUrl.searchParams.set('prompt', prompt);
  if (loginHint && loginHint.length <= 320) {
    authorizeUrl.searchParams.set('login_hint', loginHint);
  }

  return { authorizeUrl, loginUrl: config.loginUrl };
}
