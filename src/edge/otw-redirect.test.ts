import { describe, expect, it } from 'vitest';
import worker, { CANONICAL_HOST, canonicalUrl } from './otw-redirect';

describe('the otw alias', () => {
  it('sends the bare host to the canonical one over https', () => {
    expect(canonicalUrl('http://otw.immatt.com/')).toBe('https://opentowork.immatt.com/');
  });

  it('keeps the path and query, so a stage link survives', () => {
    expect(canonicalUrl('https://otw.immatt.com/?stage=2')).toBe(
      'https://opentowork.immatt.com/?stage=2',
    );
    expect(canonicalUrl('https://otw.immatt.com/sprites/bg/street-far.png')).toBe(
      'https://opentowork.immatt.com/sprites/bg/street-far.png',
    );
  });

  it('answers with a permanent redirect', () => {
    const response = worker.fetch(new Request('https://otw.immatt.com/?stage=3'));
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(`https://${CANONICAL_HOST}/?stage=3`);
  });
});
