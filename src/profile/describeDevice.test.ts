import { describe, expect, it } from 'vitest';
import { describeDevice } from './describeDevice';

describe('describeDevice', () => {
  it.each([
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'Chrome on Windows'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0', 'Edge on Windows'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', 'Safari on iOS'],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0', 'Firefox on Linux'],
    ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36', 'Chrome on Android'],
  ])('%s is %s', (userAgent, expected) => {
    expect(describeDevice(userAgent)).toBe(expected);
  });

  it('admits when it cannot tell', () => {
    expect(describeDevice(null)).toBe('Unknown device');
    expect(describeDevice('curl/8.0')).toBe('Unknown device');
  });
});
