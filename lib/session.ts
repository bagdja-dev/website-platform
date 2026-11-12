import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

const SESSION_COOKIE = 'bagdja_website_platform_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60;

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

export function setSession(response: NextResponse, accessToken: string): void {
  response.cookies.set(SESSION_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSession(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

