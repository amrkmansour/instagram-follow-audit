import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index.js';

const environment = () => ({
  ALLOWED_ORIGINS: 'https://follow-check.com',
  APP_URL: 'https://follow-check.com',
});

afterEach(() => vi.restoreAllMocks());

describe('anonymous marketing events', () => {
  it('records only the approved dimensions in a fixed schema', async () => {
    const env = environment();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const response = await worker.fetch(new Request('https://api.follow-check.com/api/events', {
      method: 'POST',
      headers: { origin: 'https://follow-check.com', 'content-type': 'application/json' },
      body: JSON.stringify({
        event: 'audit_completed',
        page: '/',
        campaign: { utm_source: 'TikTok', utm_campaign: 'Episode 01', extra: 'discard me' },
        filename: 'private-export.zip',
        usernames: ['private_account'],
      }),
    }), env);

    expect(response.status).toBe(204);
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({
      message: 'marketing_event', event: 'audit_completed', page: '/', source: 'tiktok', medium: '', campaign: 'episode-01', content: '', target: '',
    });
  });

  it('rejects unknown events and disallowed origins', async () => {
    const env = environment();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const makeRequest = (origin, event) => new Request('https://api.follow-check.com/api/events', {
      method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ event, page: '/' }),
    });

    expect((await worker.fetch(makeRequest('https://follow-check.com', 'made_up'), env)).status).toBe(400);
    expect((await worker.fetch(makeRequest('https://example.com', 'page_view'), env)).status).toBe(403);
    expect(log).not.toHaveBeenCalled();
  });
});
