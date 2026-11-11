// Builds christmaswithccc.com from content/*.json + src/*.njk into dist/.
// Netlify runs this on every save from Pages CMS (see netlify.toml).
import fs from "node:fs";
import path from "node:path";
import nunjucks from "nunjucks";
import sharp from "sharp";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIST = path.join(ROOT, "dist");
const PUBLIC = path.join(ROOT, "public");
const SITE = { url: "https://christmaswithccc.com" };
const TZ = "America/Chicago";

const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const C = Object.fromEntries(
  ["settings", "top", "services", "expect", "gallery", "online", "faq", "invite", "closing"]
    .map(n => [n, read(`content/${n}.json`)])
);
const schemaBase = read("src/schema-base.json");

/* ---------- helpers ---------- */
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// Tiny inline formatting for staff: *italic* and [link text](https://...)
const md = t => esc(t)
  .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*|#[^)\s]*)\)/g, (_, txt, url) =>
    url.startsWith("http") ? `<a href="${url}" target="_blank" rel="noopener">${txt}</a>` : `<a href="${url}">${txt}</a>`)
  .replace(/\*([^*]+)\*/g, "<em>$1</em>");
const plain = t => String(t ?? "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*([^*]+)\*/g, "$1");
const jsonscript = v => JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parseTime(t) {
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (!m) throw new Error(`Service time "${t}" should look like 6:00 PM`);
  let h = +m[1] % 12; if (/p/i.test(m[3])) h += 12;
  return { h, min: +m[2], clock: `${+m[1]}:${m[2]}`, ampm: m[3].toUpperCase(), short: `${+m[1]}${m[2] === "00" ? "" : ":" + m[2]} ${m[3].toUpperCase()}` };
}
// Offset of America/Chicago on a given local date/time, e.g. "-06:00"
function chicagoOffset(y, mo, d, h, min) {
  const guess = Date.UTC(y, mo - 1, d, h, min);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(guess)).reduce((a, p) => (a[p.type] = p.value, a), {});
  const asLocal = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  const offMin = Math.round((asLocal - guess) / 60000);
  const sign = offMin <= 0 ? "-" : "+", a = Math.abs(offMin);
  return { minutes: offMin, iso: `${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}` };
}
const pad = n => String(n).padStart(2, "0");

/* ---------- services ---------- */
const nights = (C.services.nights || []).map(n => {
  const [y, mo, d] = n.date.split("-").map(Number);
  const wd = WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  const isEve = mo === 12 && d === 24;
  const services = (n.services || []).map(s => {
    const t = parseTime(s.time);
    const off = chicagoOffset(y, mo, d, t.h, t.min);
    const startUtc = new Date(Date.UTC(y, mo - 1, d, t.h, t.min) - off.minutes * 60000);
    const utcStart = startUtc.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const label = isEve ? `Christmas Eve at ${t.short}` : `${wd}, ${MONTHS[mo - 1].slice(0, 3)} ${d} at ${t.short}`;
    const localIso = (hh) => `${y}-${pad(mo)}-${pad(d)}T${pad(hh)}:${pad(t.min)}:00${off.iso}`;
    return {
      ...s, ...t, notes: (s.notes || []).filter(Boolean), utcStart, label,
      chip: `${wd.slice(0, 3)} ${t.short}`,
      startIso: localIso(t.h), endIso: localIso(t.h + 1),
      eventName: (isEve ? `Christmas Eve Service in Omaha, NE: ${t.short}` : `Christmas Service in Omaha, NE: ${wd}, ${MONTHS[mo - 1].slice(0, 3)} ${d}, ${t.short}`) + (s.searchNote ? ` (${s.searchNote})` : ""),
    };
  });
  return { ...n, weekday: wd, dateLong: `${MONTHS[mo - 1]} ${d}`, dateShort: `${wd}, ${MONTHS[mo - 1].slice(0, 3)} ${d}`, services };
});
const allServices = nights.flatMap(n => n.services);
const defaultService = (allServices.find(s => s.preselect) || allServices[0] || {}).label || "";
const whenParts = nights.map(n => `<span style="white-space:nowrap">${esc(n.dateShort)}</span>`);
const heroWhen = whenParts.length <= 2 ? whenParts.join(" &amp; ") : whenParts.slice(0, -1).join(", ") + " &amp; " + whenParts.at(-1);

/* ---------- images ---------- */
const publicPath = p => path.join(PUBLIC, decodeURI(p).replace(/^\//, ""));
const meta = async p => { const m = await sharp(publicPath(p)).metadata(); return { width: m.width, height: m.height }; };

fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(PUBLIC, DIST, { recursive: true });

const photos = [];
for (const [i, ph] of (C.gallery.photos || []).filter(p => p && p.image).entries()) {
  const { width, height } = await meta(ph.image);
  const ext = path.extname(ph.image);
  let small = ph.image.slice(0, -ext.length) + "-sm" + ext;
  if (!fs.existsSync(publicPath(small))) {
    small = ph.image.slice(0, -ext.length) + "-sm.webp";
    const out = path.join(DIST, small.replace(/^\//, ""));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await sharp(publicPath(ph.image)).rotate().resize(720, 720, { fit: "inside" }).webp({ quality: 78 }).toFile(out);
  }
  const sm = await sharp(fs.existsSync(publicPath(small)) ? publicPath(small) : path.join(DIST, small.replace(/^\//, ""))).metadata();
  photos.push({ i, src: ph.image.replace(/^\//, ""), alt: ph.alt || "", cap: ph.caption || "", portrait: height > width, small: small.replace(/^\//, ""), smallW: sm.width, smallH: sm.height });
}
const shareTall = await meta(C.settings.shareImageTall);
const shareWide = await meta(C.settings.shareImageWide);

/* ---------- structured data ---------- */
const abs = p => p.startsWith("http") ? p : SITE.url + p;
const jsonld = {
  "@context": "https://schema.org",
  "@graph": [
    schemaBase.church,
    { ...schemaBase.page, name: C.settings.seoTitle },
    ...allServices.map(s => ({
      ...schemaBase.eventTemplate,
      name: s.eventName, startDate: s.startIso, endDate: s.endIso,
      image: [abs(C.settings.shareImageTall), ...(photos[0] ? [abs("/" + photos[0].src)] : [])],
      description: C.settings.eventDescription,
    })),
    { "@type": "FAQPage", mainEntity: (C.faq.items || []).map(f => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: plain(f.answer) } })) },
  ],
};

/* ---------- render ---------- */
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(ROOT, "src")), { autoescape: true, throwOnUndefined: false });
env.addFilter("md", t => new nunjucks.runtime.SafeString(md(t)));
env.addFilter("jsonscript", v => new nunjucks.runtime.SafeString(jsonscript(v)));
env.addFilter("nbspdots", t => new nunjucks.runtime.SafeString(esc(t).replace(/ · /g, " &nbsp;·&nbsp; ")));

const ctx = {
  site: SITE, ...C, nights, allServices, defaultService, heroWhen, photos, shareTall, shareWide, jsonld,
  jsdata: {
    photos: photos.map(p => ({ src: p.src, alt: p.alt, cap: p.cap })),
    defaultService, inviteMessage: C.invite.message, calendarDescription: C.settings.calendarDescription,
  },
  textMessage: String(C.invite.textPageMessage).split("{link}").join(SITE.url),
};
const write = (rel, html) => { const out = path.join(DIST, rel); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html); };
write("index.html", env.render("index.njk", ctx));
write("text/index.html", env.render("text.njk", ctx));
write("share/index.html", env.render("share.njk", ctx));

const today = new Date().toISOString().slice(0, 10);
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${SITE.url}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <image:image><image:loc>${abs(C.settings.shareImageTall)}</image:loc></image:image>
${photos.slice(0, 2).map(p => `    <image:image><image:loc>${abs("/" + p.src)}</image:loc></image:image>`).join("\n")}
  </url>
</urlset>
`);
console.log(`Built ${allServices.length} services, ${photos.length} photos, ${(C.faq.items || []).length} FAQs.`);
