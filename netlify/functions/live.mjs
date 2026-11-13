// /api/live: tells the page whether the CCC YouTube channel is streaming
// right now, and which video to play. Netlify's CDN caches the answer for
// 60 seconds, so YouTube is checked at most about once a minute no matter
// how many people have the page open. No API key needed.
import online from "../../content/online.json";

const HEADERS = {
  "content-type": "application/json",
  "cache-control": "public, max-age=0, must-revalidate",
  "netlify-cdn-cache-control": "public, durable, s-maxage=60, stale-while-revalidate=60",
};
const reply = body => new Response(JSON.stringify(body), { headers: HEADERS });

// Accepts any channel link staff paste: /@handle, /c/name, /user/name, /channel/UC...
export function liveUrl(link) {
  const m = String(link || "").match(/youtube\.com\/((?:@|c\/|user\/|channel\/)[\w.-]+)/i);
  return m ? `https://www.youtube.com/${m[1]}/live` : null;
}

// YouTube's /live page is the current broadcast's watch page while live.
// Otherwise it is the channel page or an upcoming stream (isLiveNow false).
export function parse(html) {
  const live = /"isLiveNow":\s*true/.test(html);
  const id = (html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/) || [])[1];
  return live && id ? { live: true, id } : { live: false };
}

export default async () => {
  const url = online.liveBarEnabled ? liveUrl(online.liveChannelUrl) : null;
  if (!url) return reply({ live: false });
  try {
    const r = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
        cookie: "CONSENT=YES+1; SOCS=CAI",
      },
      signal: AbortSignal.timeout(8000),
    });
    return reply(parse(await r.text()));
  } catch {
    return reply({ live: false });
  }
};

export const config = { path: "/api/live" };
