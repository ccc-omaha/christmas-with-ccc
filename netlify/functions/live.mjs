// /api/live: tells the page whether the CCC YouTube channel is streaming
// right now, and which video to play. Settings and stream times come from
// /live.json (written by build.mjs from Pages CMS). Netlify's CDN caches the
// answer for 60 seconds, and YouTube is only checked inside a stream window.

const HEADERS = {
  "content-type": "application/json",
  "cache-control": "public, max-age=0, must-revalidate",
  "netlify-cdn-cache-control": "public, durable, s-maxage=60, stale-while-revalidate=30",
};
const reply = body => new Response(JSON.stringify(body), { headers: HEADERS });

// Accepts any channel link staff paste: /@handle, /c/name, /user/name, /channel/UC...
export function liveUrl(link) {
  const m = String(link || "").match(/youtube\.com\/((?:@|c\/|user\/|channel\/)[\w.-]+)/i);
  return m ? `https://www.youtube.com/${m[1]}/live` : null;
}

// Is it inside a stream window? Weekly times are Central.
export function inWindow(cfg, now = new Date()) {
  const t = now.getTime();
  if ((cfg.windows || []).some(([s, e]) => t >= s && t <= e)) return true;
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(now).reduce((a, x) => (a[x.type] = x.value, a), {});
  const d = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday), m = +p.hour * 60 + +p.minute;
  return (cfg.weekly || []).some(w => w.d === d && m >= w.s && m <= w.e);
}

// YouTube's /live page is the current broadcast's watch page while live.
// Otherwise it is the channel page or an upcoming stream (isLiveNow false).
export function parse(html) {
  const live = /"isLiveNow":\s*true/.test(html);
  const id = (html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/) || [])[1];
  return live && id ? { live: true, id } : { live: false };
}

export default async request => {
  try {
    const cfg = await (await fetch(new URL("/live.json", request.url))).json();
    const url = cfg.on ? liveUrl(cfg.channel) : null;
    if (!url) return reply({ live: false, reason: "off" });
    if (!inWindow(cfg)) return reply({ live: false, reason: "outside stream times" });
    const r = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
        cookie: "CONSENT=YES+1; SOCS=CAI",
      },
      signal: AbortSignal.timeout(8000),
    });
    return reply({ ...parse(await r.text()), checked: true });
  } catch (e) {
    return reply({ live: false, reason: "error" });
  }
};

export const config = { path: "/api/live" };
