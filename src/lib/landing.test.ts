import { describe, expect, it } from 'vitest';
import { isPhone, landingPath } from './landing';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const PIXEL = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/604.1';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

describe('where a signed-in coach lands', () => {
  it('tells phones from computers and tablets', () => {
    expect(isPhone(IPHONE)).toBe(true);
    expect(isPhone(PIXEL)).toBe(true);
    expect(isPhone(IPAD)).toBe(false);
    expect(isPhone(MAC)).toBe(false);
    expect(isPhone(null)).toBe(false);
  });
  it('lands on the Team page', () => {
    expect(landingPath({ phone: false, practiceToday: true })).toBe('/team');
    expect(landingPath({ phone: true, practiceToday: false })).toBe('/team');
  });
  it('opens Today on a phone on practice day', () => {
    expect(landingPath({ phone: true, practiceToday: true })).toBe('/today');
  });
});
