// Renders a one-page wrap-up PDF: headline, progress bar, done and left lists.
// Usage: node make_pdf.cjs <input.json> <output.pdf>
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const [inFile, outFile] = process.argv.slice(2);
if (!inFile || !outFile) { console.error("Usage: node make_pdf.cjs <input.json> <output.pdf>"); process.exit(2); }
const d = JSON.parse(fs.readFileSync(inFile, "utf8"));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const done = d.done || [], left = d.left || [];
let pct = Number.isFinite(d.percent) ? d.percent : (done.length + left.length ? Math.round(done.length / (done.length + left.length) * 100) : 0);
pct = Math.max(0, Math.min(100, Math.round(pct)));
const list = items => items.length ? `<ul>${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>` : `<p class="none">Nothing listed.</p>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.title)}</title><style>
@page { size: A4; margin: 18mm 18mm 16mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #18181b; font-size: 11pt; line-height: 1.45; }
h1 { font-size: 22pt; line-height: 1.2; margin: 0 0 4pt; letter-spacing: -0.2pt; }
.sub { color: #5c5c63; margin: 0 0 16pt; }
.bar-label { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5pt; }
.bar-label b { font-size: 18pt; }
.bar-label span { color: #5c5c63; font-size: 10pt; }
.bar { height: 14pt; background: #e7e7e3; border-radius: 7pt; overflow: hidden; }
.fill { height: 100%; width: ${pct}%; background: #1a7f37; border-radius: 7pt; }
.basis { color: #5c5c63; font-size: 9pt; margin: 5pt 0 20pt; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18pt; }
h2 { font-size: 13pt; margin: 0 0 6pt; padding-bottom: 4pt; border-bottom: 2pt solid; }
.done h2 { border-color: #1a7f37; } .left h2 { border-color: #9a6700; }
ul { margin: 0; padding-left: 14pt; } li { margin: 0 0 4pt; break-inside: avoid; }
.none { color: #5c5c63; }
</style></head><body>
<h1>${esc(d.title)}</h1>
<p class="sub">${esc(d.subtitle || new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))}</p>
<div class="bar-label"><b>${pct}% done</b><span>${done.length} done, ${left.length} left</span></div>
<div class="bar" role="img" aria-label="${pct} percent done"><div class="fill"></div></div>
<p class="basis">${esc(d.basis || "")}</p>
<div class="cols"><section class="done"><h2>Done</h2>${list(done)}</section><section class="left"><h2>Left</h2>${list(left)}</section></div>
</body></html>`;

(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage();
  await pg.setContent(html, { waitUntil: "load" });
  await pg.pdf({ path: path.resolve(outFile), format: "A4", printBackground: true, preferCSSPageSize: true });
  await b.close();
  console.log(`Wrote ${outFile} (${pct}% done, ${done.length} done, ${left.length} left)`);
})().catch(e => { console.error(e); process.exit(1); });
