import { describe, expect, it } from 'vitest';
import { CANONICAL_HOST } from './edge/otw-redirect';

const html = Object.values(
  import.meta.glob<string>('../index.html', { query: '?raw', import: 'default', eager: true }),
)[0];
const publicFiles = Object.keys(import.meta.glob('../public/*.{png,ico}')).map((path) =>
  path.replace('../public', ''),
);
const SITE = `https://${CANONICAL_HOST}/`;

/** The content of the page's `<meta property|name="key">`, or undefined. */
function meta(key: string): string | undefined {
  const tag = html?.match(new RegExp(`<meta\\s+(?:property|name)="${key}"\\s+content="([^"]*)"`));
  return tag?.[1];
}

function linkHref(rel: string): string | undefined {
  return html?.match(new RegExp(`<link rel="${rel}" href="([^"]*)"`))?.[1];
}

describe('the page head', () => {
  it('gives a link preview a title, a description and the large card', () => {
    expect(meta('og:title')).toBe('OPEN TO WORK');
    expect(meta('og:description')).toBe(meta('description'));
    expect(meta('og:description')?.length).toBeGreaterThan(40);
    expect(meta('twitter:card')).toBe('summary_large_image');
    expect([meta('og:image:width'), meta('og:image:height')]).toEqual(['1200', '630']);
    expect(meta('og:image:alt')).toBeTruthy();
  });

  it('points crawlers at absolute URLs on the canonical host', () => {
    expect(meta('og:url')).toBe(SITE);
    expect(linkHref('canonical')).toBe(SITE);
    expect(meta('og:image')).toBe(`${SITE}og.png`);
  });

  it('serves every image it names from public/', () => {
    const named = [
      meta('og:image')?.replace(SITE, '/'),
      linkHref('icon'),
      linkHref('apple-touch-icon'),
      '/favicon.ico',
    ];
    for (const path of named) expect(publicFiles, path).toContain(path);
  });
});
