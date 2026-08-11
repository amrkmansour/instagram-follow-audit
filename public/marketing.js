(() => {
  const STORAGE_KEY = 'followcheck-campaign';
  const API_URL = 'https://api.follow-check.com/api/events';
  const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
  const clean = (value, max = 80) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, max);

  const readCampaign = () => {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  };
  const incoming = Object.fromEntries(CAMPAIGN_KEYS.map((key) => [key, clean(new URLSearchParams(location.search).get(key))]).filter(([, value]) => value));
  const campaign = Object.keys(incoming).length ? incoming : readCampaign();
  if (Object.keys(incoming).length) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(incoming)); } catch { /* Tracking remains optional. */ }
  }

  const track = (event, details = {}) => {
    const body = JSON.stringify({ event: clean(event, 40), page: location.pathname, campaign, ...details });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(API_URL, new Blob([body], { type: 'application/json' }));
      return;
    }
    fetch(API_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
  };

  window.followCheckTrack = track;
  window.followCheckCampaign = campaign;
  track('page_view');

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-track]');
    if (link) track(link.dataset.track, { target: clean(link.dataset.trackTarget || link.pathname, 100) });
  });
})();
