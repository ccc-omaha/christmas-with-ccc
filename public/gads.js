/* Google Ads conversion tracking (account AW-844847119).
   Fires one conversion per key click. The Google tag itself loads in <head>. */
(() => {
  const AW = 'AW-844847119/';
  const LABELS = {
    visit: 'rposCL62yLcdEI-w7ZID',      // Plan a Visit - Form Click
    calendar: 'QObdCMG2yLcdEI-w7ZID',   // Christmas - Add to Calendar
    directions: 'mkMoCMS2yLcdEI-w7ZID', // Website - Get Directions Click
    phone: 'IE8hCMe2yLcdEI-w7ZID'       // Website - Phone Call Click
  };
  const fire = key => {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', 'conversion', { send_to: AW + LABELS[key], transport_type: 'beacon' });
  };
  document.addEventListener('click', e => {
    const el = e.target.closest('a, button');
    if (!el) return;
    const href = (el.getAttribute('href') || '').toLowerCase();
    const text = (el.textContent || '').toLowerCase();

    if (el.closest('.cal .menu')) return fire('calendar');
    if (href.includes('churchcenter.com/people/forms/340750')) return fire('visit');
    if (href.startsWith('tel:')) return fire('phone');
    if (/google\.[a-z.]+\/maps|maps\.google|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.apple\.com/.test(href) ||
        text.includes('get directions')) return fire('directions');
  }, true);
})();
