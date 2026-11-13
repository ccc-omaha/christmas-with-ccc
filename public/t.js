/* Christmas with CCC: simple, private visit counts.
   No cookies, nothing personal stored. Counts page views and key clicks.
   Visit any page with ?notrack=1 to stop counting your own visits on this
   browser (?notrack=0 to undo). */
(() => {
  const ok = /(^|\.)christmaswithccc\.com$/.test(location.hostname);
  const qs = new URLSearchParams(location.search);
  try {
    if (qs.get('notrack') === '1') localStorage.setItem('ccc-notrack', '1');
    if (qs.get('notrack') === '0') localStorage.removeItem('ccc-notrack');
  } catch (e) {}
  let off = !ok || navigator.webdriver;
  try { off = off || localStorage.getItem('ccc-notrack') === '1'; } catch (e) {}

  const send = (e, d) => {
    if (off) return;
    const body = JSON.stringify({ e, d: d || '', p: location.pathname, r: document.referrer, u: qs.get('utm_source') || '' });
    try { if (navigator.sendBeacon && navigator.sendBeacon('/api/t', body)) return; } catch (x) {}
    fetch('/api/t', { method: 'POST', body, keepalive: true }).catch(() => {});
  };
  window.cccTrack = send;
  send('pv');

  const SOCIAL = /youtube|instagram|tiktok|facebook|threads|x\.com/;
  document.addEventListener('click', ev => {
    const a = ev.target.closest && ev.target.closest('a,button');
    if (!a) return;
    const href = a.getAttribute('href') || '', where = (a.closest('section[id],header[id],footer') || {}).id || 'footer';
    if (a.matches('[data-open-in-church-center-modal]')) send('plan_visit', where);
    else if (/google\.com\/maps/.test(href)) send('directions');
    else if (/calendar\.google\.com/.test(href)) send('calendar', 'google');
    else if (/Apple or Outlook/.test(a.textContent)) send('calendar', 'ics');
    else if (a.id === 'shareBtn') send('invite', 'share');
    else if (a.id === 'smsBtn') send('invite', 'text');
    else if (a.id === 'copyBtn') send('invite', 'copy');
    else if (a.id === 'send') send('invite', 'nfc-text');
    else if (a.id === 'copy') send('invite', 'nfc-copy');
    else if (a.classList.contains('app-link')) send('watch', 'app');
    else if (a.closest('footer') && SOCIAL.test(href)) send('social', (href.match(SOCIAL) || [''])[0].replace('.com', ''));
    else if (/youtube\.com/.test(href)) send('watch', 'youtube');
    else if (a.id === 'candle') setTimeout(() => { if (a.getAttribute('aria-pressed') === 'true') send('candle'); }, 0);
  }, true);
})();
