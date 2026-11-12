import crypto from 'node:crypto';

export type AuthConfig = {
  authUrl: URL;
  loginUrl: URL;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured`);
  return value;
}

export function getAuthConfig(): AuthConfig {
  const authUrl = new URL(requiredEnv('BAGDJA_AUTH_URL'));
  if (authUrl.protocol !== 'https:' && authUrl.hostname !== 'localhost' && authUrl.hostname !== '127.0.0.1') {
    throw new Error('BAGDJA_AUTH_URL must use HTTPS outside local development');
  }

  const loginUrl = new URL(
    process.env.BAGDJA_LOGIN_URL?.trim() || 'https://login.bagdja.com',
  );
  if (loginUrl.protocol !== 'https:' && loginUrl.hostname !== 'localhost' && loginUrl.hostname !== '127.0.0.1') {
    throw new Error('BAGDJA_LOGIN_URL must use HTTPS outside local development');
  }

  const appUrl = new URL(requiredEnv('BAGDJA_APP_URL'));
  if (appUrl.protocol !== 'https:' && appUrl.hostname !== 'localhost' && appUrl.hostname !== '127.0.0.1') {
    throw new Error('BAGDJA_APP_URL must use HTTPS outside local development');
  }

  return {
    authUrl,
    loginUrl,
    clientId: requiredEnv('CLIENT_APP_ID'),
    clientSecret: requiredEnv('CLIENT_APP_SECRET'),
    redirectUri: new URL('/auth/callback', appUrl).toString(),
  };
}

function base64Url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

export function generateCodeVerifier(): string {
  return base64Url(crypto.randomBytes(32));
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  return base64Url(crypto.createHash('sha256').update(verifier).digest());
}
