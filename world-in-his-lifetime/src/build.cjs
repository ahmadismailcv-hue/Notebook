// Builds the site from data/*.json and src/template.html.
//   node src/build.cjs
// Outputs: index.html (the map), country/<slug>/ and seerah/ (static pages for search engines and sharing),
// countries/ (A–Z index), sitemap.xml and robots.txt (when baseUrl is set), and src/artifact.html (preview build).
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = p => fs.readFileSync(path.join(__dirname, p), "utf8");
const out = (p, s) => { const f = path.join(ROOT, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };

const SITE = JSON.parse(rd("site.config.json"));
const BASE = (SITE.baseUrl || "").replace(/\/?$/, "/");
const topo = JSON.parse(rd("countries-110m.json"));
const names = topo.objects.countries.geometries.map(g => g.properties.name).filter(Boolean);
const data = {};
for (const f of fs.readdirSync(path.join(ROOT, "data")).filter(f => f.endsWith(".json") && f !== "sira.json"))
  Object.assign(data, JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8")));
const sira = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "sira.json"), "utf8"));

// ---------- checks ----------
const problems = [];
const missing = names.filter(n => !data[n]); if (missing.length) problems.push("missing: " + missing.join(", "));
// honorific: enforce "Muhammad ﷺ"; flag possessives
const fixH = (s, where) => {
  if (typeof s !== "string") return s;
  if (/Muhammad['’]s/.test(s)) problems.push("possessive in " + where + ": " + s);
  return s.replace(/Muhammad(?!\s*ﷺ)(?![a-z])/g, "Muhammad ﷺ");
};
for (const [n, d] of Object.entries(data)) {
  for (const k of ["polity", "summary", "link"]) d[k] = fixH(d[k], n + "." + k);
  for (const e of d.events || []) e.t = fixH(e.t, n + " event " + e.y);
  if (!["rich", "moderate", "sparse"].includes(d.evidence)) problems.push("bad evidence " + n);
  for (const s of d.sources || []) if (s.url && /wikipedia\.org/.test(s.url)) problems.push("wikipedia source: " + n);
}
for (const e of sira) e.t = fixH(e.t, "sira " + e.y);
// entries without at least one online source are held back: no summary, events or link published
const pending = [];
for (const [n, d] of Object.entries(data)) {
  if (!(d.sources || []).some(s => s.url)) { pending.push(n); data[n] = { polity: null, evidence: d.evidence, pending: true, sources: [], events: [], link: null }; }
}
console.log("pending", pending.length, pending.join(", "));

// ---------- shared bits ----------
const slug = n => n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = s => esc(s).replace(/ﷺ/g, '<span class="saw" lang="ar">ﷺ</span>');
const safe = s => JSON.stringify(s).replace(/</g, "\\u003c");
const TITLE = "The World in His Lifetime";
const DESC = "An interactive map of the world during the lifetime of the Prophet Muhammad ﷺ (570–632 CE): what every region was doing, year by year, with sources.";
const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Marcellus&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri&text=%EF%B7%BA&display=swap">`;
const icon = `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%231d4f7a'/%3E%3Cpath d='M4 16h24M16 2c5 5 5 23 0 28M16 2c-5 5-5 23 0 28' stroke='%23e0b250' stroke-width='1.6' fill='none'/%3E%3C/svg%3E">`;
const head = ({ title, desc, rel, canonical }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
${SITE.baseUrl ? `<link rel="canonical" href="${esc(BASE + canonical)}">\n<meta property="og:url" content="${esc(BASE + canonical)}">` : ""}
${icon}
${fonts}
<link rel="stylesheet" href="${rel}page.css">
</head>`;

// ---------- map page ----------
const tpl = rd("template.html")
  .replace("/*__TOPO__*/null", () => safe(topo))
  .replace("/*__DATA__*/{}", () => safe(data))
  .replace("/*__SIRA__*/[]", () => safe(sira))
  .replace("/*__SITE__*/{}", () => safe({ reportUrl: SITE.reportUrl || "", baseUrl: SITE.baseUrl || "" }));
const noscript = `<noscript><div class="noscript"><p>The interactive map needs JavaScript. You can read every entry as a plain page:</p>
<p><a href="seerah/">The seerah timeline</a> · <a href="countries/">All countries A–Z</a></p></div></noscript>
<nav class="sr-only" aria-label="Plain pages"><a href="countries/">All countries as plain pages</a> <a href="seerah/">Seerah timeline</a></nav>`;
const mapHead = head({ title: TITLE, desc: DESC, rel: "", canonical: "" }).replace(`<link rel="stylesheet" href="page.css">\n</head>`, "");
const siteDoc = mapHead + "\n" +
  tpl.replace("<!--HEAD-->", "")
     .replace("<style>", "<style>\n*{box-sizing:border-box}body{margin:0}[hidden]{display:none!important}\n.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}\n.noscript{padding:16px}")
     .replace(/(<\/style>)/, "$1\n</head>\n<body>\n" + noscript)
     .replace("<!--LIBS-->", `<script src="vendor/d3.min.js"></script>\n<script src="vendor/topojson.min.js"></script>`)
  + "\n</body>\n</html>\n";
out("index.html", siteDoc);
const art = tpl.replace("<!--HEAD-->", `<title>${TITLE}</title>\n${fonts}`)
  .replace("<!--LIBS-->", `<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>\n<script src="https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js"></script>`);
fs.writeFileSync(path.join(__dirname, "artifact.html"), art);

// ---------- static reading pages ----------
const nav = rel => `<nav class="top"><a href="${rel}">← Map</a><a href="${rel}seerah/">Seerah</a><a href="${rel}countries/">All countries</a></nav>`;
const foot = `<footer><p>Countries are today’s borders, used only as a way in, and imply no position on present-day disputes. Arabian dates follow Ibn Hishām (tr. Guillaume) and al-Mubārakpūrī, <i>The Sealed Nectar</i>.</p></footer>`;
const evList = evs => `<ol class="ev">${evs.map(e => `<li><span class="y">${e.approx ? "c. " : ""}${e.y}</span><div>${fmt(e.t)}${e.ah || e.src ? `<span class="src">${esc([e.ah, e.src].filter(Boolean).join(" · "))}</span>` : ""}</div></li>`).join("")}</ol>`;
const srcList = list => `<ul class="sources">${list.map(s => {
  const label = esc(s.title) + (s.publisher ? `, <i>${esc(s.publisher)}</i>` : "");
  return `<li>${s.url ? `<a href="${esc(s.url)}" rel="noopener">${label}</a>` : label}</li>`;
}).join("")}</ul>`;
const report = n => SITE.reportUrl ? `<p class="report"><a href="${esc(SITE.reportUrl)}?title=${encodeURIComponent("Correction: " + n)}&amp;body=${encodeURIComponent(`Country: ${n}\n\nWhat is wrong:\n\nYour source (book, article or link):\n`)}" rel="noopener">Report an error in this entry</a></p>` : "";

const sorted = Object.keys(data).sort((a, b) => a.localeCompare(b));
for (const n of sorted) {
  const d = data[n], s = slug(n);
  const desc = d.pending ? `${n} in 570–632 CE: entry under review.` : `${n} in 570–632 CE, during the lifetime of the Prophet Muhammad ﷺ. ${d.summary || ""}`.slice(0, 300);
  const body = d.pending
    ? `<p class="note">This entry has not yet been checked against reliable sources, so its details are not shown.</p>`
    : `${d.polity ? `<p class="polity">${fmt(d.polity)}</p>` : ""}
<p>${fmt(d.summary)}</p>
${d.link ? `<aside class="link"><b>Connection to Arabia</b> ${fmt(d.link)}</aside>` : ""}
${(d.events || []).length ? `<h2>Timeline</h2>${evList(d.events)}` : ""}
<h2>Sources</h2>${srcList(d.sources)}`;
  out(`country/${s}/index.html`, `${head({ title: `${n}, 570–632 CE · ${TITLE}`, desc, rel: "../../", canonical: `country/${s}/` })}
<body><main>
${nav("../../")}
<h1>${esc(n)} <small>570–632 CE</small></h1>
${body}
${report(n)}
<p><a class="cta" href="../../#${s}-610">Open ${esc(n)} on the map</a></p>
${foot}
</main></body></html>
`);
}
out("countries/index.html", `${head({ title: `All countries · ${TITLE}`, desc: "Every country on the map, with what was happening there in 570–632 CE.", rel: "../", canonical: "countries/" })}
<body><main>
${nav("../")}
<h1>All countries <small>570–632 CE</small></h1>
<ul class="clist">${sorted.map(n => `<li><a href="../country/${slug(n)}/">${esc(n)}</a>${data[n].pending ? ' <span class="muted">(under review)</span>' : ""}</li>`).join("")}</ul>
${foot}
</main></body></html>
`);
out("seerah/index.html", `${head({ title: `The seerah, 570–632 CE · ${TITLE}`, desc: "The life of the Prophet Muhammad ﷺ year by year, following Ibn Hishām and The Sealed Nectar, with Hijri dates.", rel: "../", canonical: "seerah/" })}
<body><main>
${nav("../")}
<h1>The life of the Prophet Muhammad <span class="saw" lang="ar">ﷺ</span></h1>
<p>Following Ibn Isḥāq as edited by Ibn Hishām (tr. A. Guillaume, <i>The Life of Muhammad</i> ﷺ, Oxford University Press, 1955) and Ṣafī al-Raḥmān al-Mubārakpūrī, <i>Ar-Raḥīq al-Makhtūm</i> (<i>The Sealed Nectar</i>), Darussalam. Where the two differ, both are given.</p>
${evList(sira)}
${foot}
</main></body></html>
`);
out("page.css", `/* Reading pages. Same palette as the map. */
:root{--bg:#eef0ee;--fg:#1d2326;--muted:#5b666b;--line:#c4ccce;--accent:#1d4f7a;--gold:#a87411;
--font-display:"Marcellus",Georgia,serif;--font-body:"Literata",Georgia,serif;--font-data:"IBM Plex Mono",ui-monospace,Menlo,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#12171b;--fg:#e4e8ea;--muted:#94a1a7;--line:#2d383f;--accent:#7fb0dc;--gold:#e0b250;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 var(--font-body)}
main{max-width:44rem;margin:0 auto;padding:24px 16px 48px}
h1{font:400 2rem/1.2 var(--font-display);margin:16px 0 8px;text-wrap:balance}h1 small{font:.8rem var(--font-data);color:var(--muted);margin-left:8px}
h2{font:500 .75rem var(--font-data);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:28px 0 10px}
a{color:var(--accent)}nav.top{display:flex;gap:16px;font:.8rem var(--font-data)}
.polity{color:var(--muted);font-style:italic}.muted{color:var(--muted)}
.link{border-left:2px solid var(--gold);padding:8px 12px;margin:16px 0}.link b{display:block;font:500 .7rem var(--font-data);letter-spacing:.1em;text-transform:uppercase;color:var(--gold)}
ol.ev{list-style:none;padding:0;display:grid;gap:12px}ol.ev li{display:grid;grid-template-columns:4.5rem minmax(0,1fr);gap:12px}
.y{font:500 .8rem var(--font-data);font-variant-numeric:tabular-nums;color:var(--gold)}
.src{display:block;font:.72rem/1.4 var(--font-data);color:var(--muted);margin-top:3px}
ul.sources{padding-left:18px;font-size:.9rem}ul.clist{columns:2;column-gap:24px;padding-left:18px}
.saw{font-family:"Amiri","Scheherazade New","Noto Naskh Arabic",serif;font-size:1.15em;line-height:1}
.cta{display:inline-block;margin-top:16px;font:500 .8rem var(--font-data);letter-spacing:.05em;text-transform:uppercase}
footer{margin-top:40px;border-top:1px solid var(--line);padding-top:12px;font-size:.82rem;color:var(--muted)}
@media (max-width:480px){ul.clist{columns:1}ol.ev li{grid-template-columns:3.5rem minmax(0,1fr)}}
`);

// ---------- sitemap / robots ----------
if (SITE.baseUrl) {
  const urls = ["", "seerah/", "countries/", ...sorted.filter(n => !data[n].pending).map(n => `country/${slug(n)}/`)];
  out("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${esc(BASE + u)}</loc></url>`).join("\n")}\n</urlset>\n`);
  out("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${BASE}sitemap.xml\n`);
}

const nsrc = Object.values(data).reduce((a, d) => a + (d.sources || []).length, 0);
console.log("countries", Object.keys(data).length, "pages", sorted.length + 2, "sira", sira.length, "sources", nsrc, "bytes", siteDoc.length);
console.log(problems.length ? problems.join("\n") : "no problems");
