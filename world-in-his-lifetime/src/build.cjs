const fs=require("fs");
const path=require("path");const ROOT=path.join(__dirname,"..");const OUT=ROOT;process.chdir(__dirname);
const topo=JSON.parse(fs.readFileSync("countries-110m.json","utf8"));
const names=topo.objects.countries.geometries.map(g=>g.properties.name).filter(Boolean);
const data={};
for(const f of fs.readdirSync("../data").filter(f=>f.endsWith(".json")&&f!=="sira.json")) Object.assign(data,JSON.parse(fs.readFileSync("../data/"+f,"utf8")));
const sira=JSON.parse(fs.readFileSync("../data/sira.json","utf8"));
const problems=[];
const missing=names.filter(n=>!data[n]); if(missing.length) problems.push("missing: "+missing.join(", "));
// honorific: enforce "Muhammad ﷺ"; flag possessives
const fixH=(s,where)=>{ if(typeof s!=="string") return s;
  if(/Muhammad['’]s/.test(s)) problems.push("possessive in "+where+": "+s);
  return s.replace(/Muhammad(?!\s*ﷺ)(?![a-z])/g,"Muhammad ﷺ"); };
for(const [n,d] of Object.entries(data)){
  for(const k of ["polity","summary","link"]) d[k]=fixH(d[k],n+"."+k);
  for(const e of d.events||[]) e.t=fixH(e.t,n+" event "+e.y);
  if(!["rich","moderate","sparse"].includes(d.evidence)) problems.push("bad evidence "+n);
  for(const s of d.sources||[]) if(s.url&&/wikipedia\.org/.test(s.url)) problems.push("wikipedia source: "+n);
}
for(const e of sira) e.t=fixH(e.t,"sira "+e.y);
// entries without at least one online source are held back: no summary, events or link published
let pending=[];
for(const [n,d] of Object.entries(data)){ if(!(d.sources||[]).some(s=>s.url)){ pending.push(n); data[n]={polity:null,evidence:d.evidence,pending:true,sources:[],events:[],link:null}; } }
console.log("pending",pending.length,pending.join(", "));
const safe=s=>JSON.stringify(s).replace(/</g,"\\u003c");
const tpl=fs.readFileSync("template.html","utf8").replace("/*__TOPO__*/null",()=>safe(topo)).replace("/*__DATA__*/{}",()=>safe(data)).replace("/*__SIRA__*/[]",()=>safe(sira));
const DESC="An interactive map of the world during the lifetime of the Prophet Muhammad ﷺ (570–632 CE): what every region was doing, year by year, with sources.";
const fonts=`<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Marcellus&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri&text=%EF%B7%BA&display=swap">`;
const icon=`<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%231d4f7a'/%3E%3Cpath d='M4 16h24M16 2c5 5 5 23 0 28M16 2c-5 5-5 23 0 28' stroke='%23e0b250' stroke-width='1.6' fill='none'/%3E%3C/svg%3E">`;
const siteHead=`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>The World in His Lifetime</title>
<meta name="description" content="${DESC}">
<meta property="og:title" content="The World in His Lifetime">
<meta property="og:description" content="${DESC}">
<meta property="og:type" content="website">
${icon}
${fonts}`;
const site=tpl.replace("<!--HEAD-->",siteHead).replace("<style>","<style>\n*{box-sizing:border-box}body{margin:0}[hidden]{display:none!important}")
  .replace("<!--LIBS-->",`<script src="vendor/d3.min.js"></script>\n<script src="vendor/topojson.min.js"></script>`)
  .replace(/<\/script>\s*$/,"</script>\n</head>")  // placeholder, fixed below
;
// proper doc close: head ends before body content; simplest valid structure
const siteDoc=site.replace("</head>","").replace("<style>","<style>").replace(/(<\/style>)/,"$1\n</head>\n<body>")+"\n</body>\n</html>\n";
fs.mkdirSync(OUT+"/vendor",{recursive:true});
fs.writeFileSync(OUT+"/index.html",siteDoc);
const art=tpl.replace("<!--HEAD-->",`<title>The World in His Lifetime</title>\n${fonts}`)
  .replace("<!--LIBS-->",`<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>\n<script src="https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js"></script>`);
fs.writeFileSync(path.join(__dirname,"artifact.html"),art);
const nsrc=Object.values(data).reduce((a,d)=>a+(d.sources||[]).length,0);
console.log("countries",Object.keys(data).length,"sira",sira.length,"sources",nsrc,"bytes",siteDoc.length);
console.log(problems.length?problems.join("\n"):"no problems");
