// SEO-crawl av ett körande bygge – samma kontroller som en extern crawler
// (Screaming Frog-liknande) men i CI, så att fel fångas före deploy.
//
//   npx tsx scripts/seo-crawl.mts [bas-URL]      (standard http://127.0.0.1:3122)
//
// Kontrollerar: status och kanonisk URL på varje sida i sitemap.xml, exakt en
// H1, titel- och beskrivningslängd, dubbletter, alt på bilder, giltig JSON-LD
// med definierade @id-referenser, inlänkar (inga föräldralösa sidor), interna
// länkar som inte ger 200, robots.txt, noindex på privata sidor och att
// områdessidorna inte är kopior av varandra. Avslutar med icke-noll vid fel.

const B = (process.argv[2] ?? "http://127.0.0.1:3122").replace(/\/$/, "");
const origin = new URL(B).origin;

interface Page {
  path: string;
  status: number;
  title: string;
  desc: string;
  canonical: string;
  robots: string;
  h1: string[];
  words: number;
  imgsNoAlt: number;
  ldTypes: string[];
  ldIssues: string[];
  links: string[];
  text: string;
}

let failures = 0;
const fail = (msg: string) => { failures++; console.log(`✗ ${msg}`); };
const ok = (msg: string) => console.log(`✓ ${msg}`);
const warn = (msg: string) => console.log(`! ${msg}`);

const strip = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

async function fetchPage(path: string): Promise<Page> {
  const r = await fetch(B + path, { redirect: "manual" });
  const html = r.status === 200 ? await r.text() : "";
  const g = (re: RegExp) => (html.match(re) || [])[1] ?? "";
  const ldIssues: string[] = [];
  const nodes = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => {
    try { const d = JSON.parse(m[1]); return (d["@graph"] ?? [d]) as Record<string, unknown>[]; } catch { ldIssues.push("ogiltig JSON-LD"); return []; }
  });
  const ids = new Set(nodes.map((n) => n["@id"]).filter((x): x is string => typeof x === "string"));
  const refs = JSON.stringify(nodes).match(/"@id":"([^"]+)"/g)?.map((s) => s.slice(7, -1)) ?? [];
  for (const ref of new Set(refs)) if (!ids.has(ref)) ldIssues.push(`odefinierad @id ${ref}`);
  for (const n of nodes) {
    if (n["@type"] === "Product") {
      const o = n.offers as Record<string, unknown> | undefined;
      if (!n.image || !o?.price || !o?.priceCurrency || !o?.availability) ldIssues.push("Product saknar bild/pris/valuta/tillgänglighet");
    }
    if (n["@type"] === "FAQPage" && !(n.mainEntity as unknown[])?.length) ldIssues.push("tom FAQPage");
  }
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  const links = [...html.matchAll(/<a\b[^>]*href="([^"#]*)"/g)]
    .map((m) => m[1])
    .map((h) => { try { const u = new URL(h.replace(/&amp;/g, "&"), B); return u.origin === origin ? u.pathname + u.search : null; } catch { return null; } })
    .filter((x): x is string => !!x);
  return {
    path,
    status: r.status,
    title: g(/<title[^>]*>([^<]*)<\/title>/).replace(/&amp;/g, "&"),
    desc: g(/<meta name="description" content="([^"]*)"/),
    canonical: g(/<link rel="canonical" href="([^"]*)"/).replace(/^https?:\/\/[^/]+/, "") || "/",
    robots: g(/<meta name="robots" content="([^"]*)"/),
    h1: [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim()),
    words: strip(html).split(" ").filter(Boolean).length,
    imgsNoAlt: imgs.filter((i) => !/\balt=/.test(i)).length,
    ldTypes: nodes.map((n) => String(n["@type"])),
    ldIssues,
    links,
    // Likhet mäts på huvudinnehållet – sidhuvud och sidfot är per definition lika.
    text: strip((html.match(/<main[\s\S]*?<\/main>/) || [html])[0]).toLowerCase(),
  };
}

function shingles(text: string, n = 8): Set<string> {
  const w = text.split(" ");
  const s = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) s.add(w.slice(i, i + n).join(" "));
  return s;
}
function similarity(a: string, b: string): number {
  const sa = shingles(a), sb = shingles(b);
  let same = 0;
  for (const x of sa) if (sb.has(x)) same++;
  return sa.size ? same / sa.size : 0;
}

async function main() {
  console.log(`SEO-crawl av ${B}`);
  const robots = await (await fetch(B + "/robots.txt")).text();
  if (/Sitemap:/.test(robots) && /Disallow: \/admin/.test(robots)) ok("robots.txt pekar på sitemap och stänger /admin"); else fail("robots.txt saknar Sitemap eller Disallow /admin");
  if (/Disallow: \/_next|Disallow: \/$/m.test(robots)) fail("robots.txt blockerar renderresurser eller hela sajten");

  const sm = await (await fetch(B + "/sitemap.xml")).text();
  const smPaths = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  if (smPaths.length < 10) fail(`sitemap har bara ${smPaths.length} adresser`); else ok(`sitemap: ${smPaths.length} adresser`);

  const pages = new Map<string, Page>();
  for (const p of smPaths) pages.set(p, await fetchPage(p));

  // Sidkontroller
  const titles = new Map<string, string[]>(); const descs = new Map<string, string[]>();
  for (const pg of pages.values()) {
    const issues: string[] = [];
    if (pg.status !== 200) issues.push(`status ${pg.status}`);
    if (pg.canonical !== pg.path) issues.push(`canonical ${pg.canonical || "saknas"}`);
    if (pg.robots && /noindex/.test(pg.robots)) issues.push("noindex i sitemap");
    if (pg.h1.length !== 1) issues.push(`h1×${pg.h1.length}`);
    if (pg.title.length < 25 || pg.title.length > 60) issues.push(`titel ${pg.title.length} tecken`);
    if (pg.desc.length < 70 || pg.desc.length > 158) issues.push(`beskrivning ${pg.desc.length} tecken`);
    if (pg.imgsNoAlt) issues.push(`${pg.imgsNoAlt} bild utan alt`);
    if (pg.ldIssues.length) issues.push(pg.ldIssues.join(", "));
    if (!pg.ldTypes.includes("Organization") || !pg.ldTypes.includes("WebSite")) issues.push("saknar Organization/WebSite");
    if (pg.words < 250) issues.push(`${pg.words} ord`);
    titles.set(pg.title, [...(titles.get(pg.title) ?? []), pg.path]);
    descs.set(pg.desc, [...(descs.get(pg.desc) ?? []), pg.path]);
    if (issues.length) fail(`${pg.path}: ${issues.join("; ")}`); else ok(`${pg.path} (${pg.words} ord, ${pg.ldTypes.length} schema-noder)`);
  }
  for (const [t, ps] of titles) if (ps.length > 1) fail(`dubblett-titel "${t}": ${ps.join(", ")}`);
  for (const ps of descs.values()) if (ps.length > 1) fail(`dubblett-beskrivning: ${ps.join(", ")}`);

  // Inlänkar och interna länkar
  const inbound = new Map<string, Set<string>>();
  const targets = new Set<string>();
  for (const pg of pages.values()) for (const l of pg.links) {
    const clean = l.split("?")[0];
    if (clean !== pg.path) { inbound.set(clean, (inbound.get(clean) ?? new Set()).add(pg.path)); }
    targets.add(l);
  }
  for (const p of smPaths) { const n = inbound.get(p)?.size ?? 0; if (n < 2) fail(`${p}: bara ${n} inlänkar`); }
  ok(`inlänkar: lägst ${Math.min(...smPaths.map((p) => inbound.get(p)?.size ?? 0))} per sida`);
  let bad = 0;
  for (const t of targets) {
    if (/^\/(admin|api)\b/.test(t)) continue;
    const r = await fetch(B + t, { redirect: "manual" });
    if (r.status !== 200) { bad++; fail(`intern länk ${t} → ${r.status}`); }
  }
  if (!bad) ok(`alla ${targets.size} interna länkmål svarar 200`);

  // Privata sidor ska vara noindex
  for (const p of ["/faktura-saknas", "/admin/login"]) {
    const r = await fetch(B + p);
    const html = await r.text();
    const noindex = /noindex/.test(r.headers.get("x-robots-tag") ?? "") || /<meta name="robots" content="[^"]*noindex/.test(html);
    if (noindex) ok(`${p} är noindex`); else fail(`${p} saknar noindex`);
  }

  // Områdessidor: egna sidor, inte kopior (delade 8-gram)
  const areas = smPaths.filter((p) => /^\/(tyreso|nacka|haninge|huddinge)$/.test(p));
  for (let i = 0; i < areas.length; i++) for (let j = i + 1; j < areas.length; j++) {
    const sim = similarity(pages.get(areas[i])!.text, pages.get(areas[j])!.text);
    if (sim > 0.5) fail(`${areas[i]} och ${areas[j]} delar ${Math.round(sim * 100)} % av texten`);
  }
  if (areas.length) ok(`områdessidor: högst ${Math.round(100 * Math.max(...areas.flatMap((a, i) => areas.slice(i + 1).map((b) => similarity(pages.get(a)!.text, pages.get(b)!.text)))))} % delad text`);

  // Sidor som svarar 200 men inte finns i sitemap (indexbloat)
  const notInSitemap = [...targets].map((t) => t.split("?")[0]).filter((t, i, arr) => arr.indexOf(t) === i && !smPaths.includes(t) && !/^\/(admin|api)\b/.test(t));
  for (const t of notInSitemap) {
    const r = await fetch(B + t); const html = await r.text();
    if (r.status === 200 && !/noindex/.test(html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? "")) warn(`${t} är indexerbar men inte i sitemap`);
  }

  console.log(failures ? `\n${failures} fel` : "\nInga fel");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
