// /api/stats?key=...&from=YYYY-MM-DD: daily counts for the /stats page.
// Locked with the STATS_KEY environment variable in Netlify.
// Finished days are summarized once and saved, so the page stays fast.
import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const same = (a, b) => { const x = Buffer.from(a || ""), y = Buffer.from(b || ""); return x.length === y.length && timingSafeEqual(x, y); };

async function keys(store, prefix) {
  const out = [];
  for await (const page of store.list({ prefix, paginate: true })) out.push(...page.blobs.map(b => b.key));
  return out;
}
const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };

async function summarize(store, d) {
  const s = { day: d, pv: 0, uv: 0, pages: {}, sources: {}, devices: {}, events: {} };
  for (const k of await keys(store, `pv/${d}/`)) {
    const [, , page, src, dev] = k.split("/");
    s.pv++; inc(s.pages, page); if (src !== "internal") inc(s.sources, src); inc(s.devices, dev);
  }
  s.uv = (await keys(store, `uv/${d}/`)).length;
  for (const k of await keys(store, `ev/${d}/`)) {
    const [, , e, detail] = k.split("/");
    inc(s.events, detail && detail !== "none" ? `${e}:${detail}` : e);
  }
  return s;
}

export default async request => {
  const url = new URL(request.url);
  if (!process.env.STATS_KEY) return json({ error: "Stats key isn't set up yet." }, 503);
  if (!same(url.searchParams.get("key"), process.env.STATS_KEY)) return json({ error: "Wrong key." }, 401);

  const store = getStore("stats");
  const t = today();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("from") || "") ? url.searchParams.get("from") : "2026-11-01";
  const days = [];
  for (let d = new Date(from + "T12:00:00Z"); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const ds = d.toISOString().slice(0, 10);
    if (ds > t || days.length > 400) break;
    days.push(ds);
  }
  const out = await Promise.all(days.map(async d => {
    if (d < t) {
      const cached = await store.get(`sum/${d}`, { type: "json" });
      if (cached) return cached;
      const s = await summarize(store, d);
      await store.setJSON(`sum/${d}`, s);
      return s;
    }
    return summarize(store, d);
  }));
  return json({ today: t, days: out });
};

export const config = { path: "/api/stats" };
