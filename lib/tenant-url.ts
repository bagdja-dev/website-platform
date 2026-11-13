/**
 * URL publik website tenant (sama dengan Studio `buildTenantWebUrl`): lokal memakai path
 * `http://localhost:5005/{slug}`, production `https://{slug}.<host renderer>`.
 */
const WEB_URL = (process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:5005').replace(/\/+$/, '');

export function tenantWebUrl(slug: string): string {
  try {
    const base = new URL(WEB_URL);
    if (base.hostname === 'localhost' || base.hostname === '127.0.0.1') return `${WEB_URL}/${encodeURIComponent(slug)}`;
    base.hostname = `${slug}.${base.hostname}`;
    base.pathname = '/';
    return base.toString().replace(/\/$/, '');
  } catch {
    return `${WEB_URL}/${encodeURIComponent(slug)}`;
  }
}
