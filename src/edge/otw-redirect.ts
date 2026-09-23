/**
 * The short alias otw.immatt.com, as its own script-only Worker so the game
 * itself stays pure static assets (no Worker invocation per sprite). Every
 * request is sent to the same path and query on the canonical host.
 * Deployed with `wrangler deploy -c wrangler.redirect.jsonc`.
 */
export const CANONICAL_HOST = 'opentowork.immatt.com';

export function canonicalUrl(requestUrl: string): string {
  const url = new URL(requestUrl);
  return `https://${CANONICAL_HOST}${url.pathname}${url.search}`;
}

export default {
  fetch(request: Request): Response {
    return Response.redirect(canonicalUrl(request.url), 301);
  },
};
