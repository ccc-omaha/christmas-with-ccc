// /api/t: records one page view or click. No cookies; nothing personal is
// stored. Unique visitors are counted with a one-way daily hash (IP + browser
// + a random salt that is thrown away each day), so a visitor can't be
// identified or followed from one day to the next.
import { getStore } from "@netlify/blobs";
import { createHash, randomBytes } from "node:crypto";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|python|curl|wget|monitor/i;
const EVENTS = new Set(["pv", "plan_visit", "directions", "calendar", "invite", "watch", "social", "candle", "live_open", "quest"]);
const slug = s => String(s || "").toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "none";
const day = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());

function source(u, ref) {
  if (u) return slug(u);
  let h = "";
  try { h = new URL(ref).hostname.replace(/^www\.|^m\.|^l\.|^lm\./, ""); } catch { return "direct"; }
  if (/christmaswithccc\.com$/.test(h)) return "internal";
  if (/(^|\.)google\./.test(h)) return "google";
  if (/bing\.com$/.test(h)) return "bing";
  if (/duckduckgo/.test(h)) return "duckduckgo";
  if (/facebook\.com$|fb\.com$|fb\.me$/.test(h)) return "facebook";
  if (/instagram\.com$/.test(h)) return "instagram";
  if (/^t\.co$|twitter\.com$|x\.com$/.test(h)) return "x";
  if (/threads\.(net|com)$/.test(h)) return "threads";
  if (/tiktok\.com$/.test(h)) return "tiktok";
  if (/youtube\.com$/.test(h)) return "youtube";
  if (/cccomaha\.org$/.test(h)) return h.startsWith("links.") ? "nfc" : "cccomaha.org";
  if (/churchcenter\.com$/.test(h)) return "church-center";
  return slug(h);
}
const device = ua => /iPad|Tablet/i.test(ua) ? "tablet" : /Mobi|iPhone|Android/i.test(ua) ? "mobile" : "desktop";

export default async (request, context) => {
  const done = new Response(null, { status: 204 });
  if (request.method !== "POST") return done;
  const ua = request.headers.get("user-agent") || "";
  if (!ua || BOT.test(ua)) return done;
  let b;
  try { b = JSON.parse(await request.text()); } catch { return done; }
  if (!EVENTS.has(b.e)) return done;

  const store = getStore("stats");
  const d = day(), rnd = Date.now().toString(36) + randomBytes(3).toString("hex");
  if (b.e === "pv") {
    const page = slug(String(b.p || "/").split("/")[1] || "home");
    await store.set(`pv/${d}/${page}/${source(b.u, b.r)}/${device(ua)}/${rnd}`, "");
    // Daily unique visitor
    let salt = await store.get(`salt/${d}`);
    if (!salt) {
      await store.set(`salt/${d}`, randomBytes(16).toString("hex"), { onlyIfNew: true });
      salt = await store.get(`salt/${d}`);
      const { blobs } = await store.list({ prefix: "salt/" });
      await Promise.all(blobs.filter(x => x.key !== `salt/${d}`).map(x => store.delete(x.key)));
    }
    const id = createHash("sha256").update(`${salt}|${context.ip || ""}|${ua}`).digest("hex").slice(0, 24);
    await store.set(`uv/${d}/${id}`, "");
  } else {
    await store.set(`ev/${d}/${b.e}/${slug(b.d)}/${rnd}`, "");
  }
  return done;
};

export const config = { path: "/api/t" };
