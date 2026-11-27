const destinationKey = 'tsek.returnTo';
const protectedPath = /^\/(?:applications(?:\/[^/?#]+)?|admin(?:\/(?:overview|applications|queue))?)(?:\?[^#]*)?$/;
/** Only local, recognized destinations can be used after authentication. */
export function safeDestination(value: string | null) {
  return value && !/[\\\r\n]/.test(value) && protectedPath.test(value) ? value : null;
}
export function readRoute() {
  const legacy = window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : null;
  const route = legacy || window.location.pathname + window.location.search;
  return route.replace(/^\/dashboard(?=\?|$)/, '/applications');
}
export function migrateLegacyRoute() {
  if (window.location.hash.startsWith('#/') || window.location.pathname === '/dashboard') {
    const route = readRoute();
    const target = new URL(route, window.location.origin);
    // Keep email-verification query parameters outside older hash URLs too.
    for (const [key, value] of new URLSearchParams(window.location.search)) if (!target.searchParams.has(key)) target.searchParams.set(key, value);
    window.history.replaceState(window.history.state, '', target.pathname + target.search);
  }
}
export function navigate(path: string, replace = false) {
  const target = new URL(path, window.location.origin);
  if (target.origin !== window.location.origin) return;
  window.history[replace ? 'replaceState' : 'pushState'](window.history.state, '', target.pathname + target.search + target.hash);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
export function returnDestination() {
  const requested = safeDestination(new URLSearchParams(window.location.search).get('returnTo'));
  const current = safeDestination(readRoute());
  if (requested || current) return requested || current!;
  try { return safeDestination(sessionStorage.getItem(destinationKey)) || '/applications'; } catch { return '/applications'; }
}
export function rememberDestination() {
  try { sessionStorage.setItem(destinationKey, returnDestination()); } catch { /* URL remains the primary source. */ }
}
export const passwordSetupHref = () => '/password-setup?returnTo=' + encodeURIComponent(returnDestination());
export const signInHref = () => '/login?returnTo=' + encodeURIComponent(returnDestination());

export function clearDestination() {
  try { sessionStorage.removeItem(destinationKey); } catch { /* No persisted destination. */ }
}
