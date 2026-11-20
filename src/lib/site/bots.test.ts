import { describe, expect, it } from 'vitest';
import { AI_BOTS, HTML_LIMITED_BOTS } from './bots';

// AI crawlers don't run JavaScript, so Next must put the metadata in <head> for them (decision 0047).
describe('HTML_LIMITED_BOTS', () => {
  const ua: Record<string, string> = {
    GPTBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
    ClaudeBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
    PerplexityBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
    bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  };
  it.each(Object.entries(ua))('matches %s', (_, s) => expect(HTML_LIMITED_BOTS.test(s)).toBe(true));
  it.each(AI_BOTS)('matches %s by name', (name) => expect(HTML_LIMITED_BOTS.test(`Mozilla/5.0 (compatible; ${name}/1.0)`)).toBe(true));
  it('leaves people in browsers alone', () =>
    expect(HTML_LIMITED_BOTS.test('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe(false));
});
