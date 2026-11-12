// Social feeds (Facebook, LinkedIn, X, Slack, etc.) crop link previews to a
// wide 1.91:1 frame, while iMessage and Android texting show the tall 4:5
// graphic best. This swaps in the wide graphic for social crawlers only, so
// the same christmaswithccc.com link looks right everywhere.

// iMessage's preview fetcher pretends to be Facebook/Twitter but also says
// "Safari", so it is checked first and keeps the tall graphic.
const TEXTING = /Safari\/[\d.]+ facebookexternalhit|Facebot Twitterbot/i;
const SOCIAL = /facebookexternalhit|facebookcatalog|meta-externalagent|Twitterbot|LinkedInBot|Slackbot|Discordbot|Pinterest|redditbot|Threads|Instagram|Embedly|SkypeUriPreview|TelegramBot/i;

export default async (request, context) => {
  const ua = request.headers.get("user-agent") || "";
  const response = await context.next();
  if (TEXTING.test(ua) || !SOCIAL.test(ua)) return response;
  if (!(response.headers.get("content-type") || "").includes("text/html")) return response;

  let html = await response.text();
  const wide = html.match(/<meta name="twitter:image" content="([^"]+)"/);
  if (!wide) return new Response(html, response);

  html = html
    .replace(/(<meta property="og:image(?::secure_url)?" content=")[^"]+"/g, `$1${wide[1]}"`)
    .replace(/(<meta property="og:image:width" content=")\d+"/, '$11200"')
    .replace(/(<meta property="og:image:height" content=")\d+"/, '$1630"');

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("vary", "User-Agent");
  return new Response(html, { status: response.status, headers });
};

export const config = { path: "/" };
