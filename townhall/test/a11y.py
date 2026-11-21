import asyncio, json, sys
from playwright.async_api import async_playwright
import pathlib; U=pathlib.Path("dist/index.html").resolve().as_uri()
AXE=open("node_modules/axe-core/axe.min.js").read()
PAGES=["index","search","/money","/health-admin","/letters/chatgpt","ai/gemini","library","lib-new","post","notifications","me","display","mod","help","about","terms","complaints","privacy","accessibility","safe-sharing","rules","u-jo_reads","TOPIC","login","join"]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        out={}
        for mode in ["desktop","mobile","f-large","logged-out"]:
            vp={"width":390,"height":844} if mode=="mobile" else {"width":1440,"height":1000}
            pg=await b.new_page(viewport=vp)
            await pg.add_init_script(path="test/mock.js")
            if mode=="logged-out": await pg.add_init_script("window.__setSession && window.__setSession(null)")
            await pg.goto(U); await pg.wait_for_timeout(600)
            if mode=="f-large": await pg.evaluate("document.body.classList.add('f-large')")
            tid=await pg.evaluate("__db.posts[0].id"); 
            pages=PAGES if mode!="logged-out" else ["index","join","login","post","search","/money","TOPIC"]
            for h in pages:
                hh={"TOPIC":"t-"+tid}.get(h,h)
                await pg.evaluate(f"location.hash={json.dumps(hh)}"); await pg.wait_for_timeout(350)
                if mode=="f-large": await pg.evaluate("document.body.classList.add('f-large')")
                await pg.add_script_tag(content=AXE) if not await pg.evaluate("!!window.axe") else None
                r=await pg.evaluate("""async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}});
                  return r.violations.map(v=>({id:v.id,impact:v.impact,n:v.nodes.length,help:v.help,t:v.nodes.slice(0,3).map(x=>x.target.join(' ')+' :: '+(x.failureSummary||'').split('\\n').slice(1,2).join(''))}))}""")
                for v in r:
                    k=(v["id"]); out.setdefault(k,{"impact":v["impact"],"help":v["help"],"where":set(),"ex":v["t"]})
                    out[k]["where"].add(f"{mode}:{h}")
            await pg.close()
        await b.close()
        if not out: print("NO VIOLATIONS")
        for k,v in sorted(out.items(), key=lambda kv: ["critical","serious","moderate","minor",None].index(kv[1]["impact"])):
            print(f"[{v['impact']}] {k}: {v['help']}\n   pages: {', '.join(sorted(v['where']))[:300]}\n   e.g. {v['ex'][:2]}")
        return out
sys.exit(1 if asyncio.run(main()) else 0)
