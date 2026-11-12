export function getSafeNextPath(nextPath, origin) {
  if (typeof nextPath !== 'string' || !nextPath.startsWith('/')) return null;

  try {
    const target = new URL(nextPath, origin);
    if (target.origin !== origin) return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

