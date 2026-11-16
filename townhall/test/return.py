import asyncio
from playwright.async_api import async_playwright
import pathlib; U=pathlib.Path("dist/index.html").resolve().as_uri()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await b.new_page(viewport={"width":1000,"height":900}); errs=[]
        pg.on("pageerror",lambda e:errs.append(str(e)))
        await pg.add_init_script(path="test/mock.js")
        await pg.goto(U); await pg.wait_for_timeout(500)
        await pg.evaluate("sb.auth.signOut()"); await pg.wait_for_timeout(200); 
        # pick a published tryable post not by ME
        pid=await pg.evaluate("(()=>{const me=__db.profiles[0].id;const p=__db.posts.find(p=>p.status==='published'&&['PROMPT','AGENT','WORKFLOW','TIP','BUILD'].includes(p.type)&&p.author!==me);return p&&p.id})()")
        print("post", pid)
        # 1. plain login returns to post
        await pg.evaluate(f"location.hash='t-{pid}'"); await pg.wait_for_timeout(300)
        await pg.evaluate("location.hash='login'"); await pg.wait_for_timeout(200)
        await pg.fill("#aE","me@test.ac.uk"); await pg.fill("#aW","password1"); await pg.click("#af button[type=submit]"); await pg.wait_for_timeout(400)
        print("1 after login hash:", await pg.evaluate("location.hash"), "| toast:", await pg.inner_text("#toasts"))
        # 2. logged-out try is kept and saved after login
        await pg.evaluate("sb.auth.signOut()"); await pg.wait_for_timeout(200); await pg.evaluate("location.hash='index'"); await pg.wait_for_timeout(200)
        await pg.evaluate(f"location.hash='t-{pid}'"); await pg.wait_for_timeout(300)
        await pg.click('[data-trygo="login"]'); await pg.wait_for_timeout(100)
        print("2a no choice msg:", await pg.inner_text("#trMsg"))
        await pg.check('input[name="tr"][value="partly"]'); await pg.fill("#trNote","Needed a tweak")
        await pg.screenshot(path="test/s_try_loggedout.png")
        await pg.click('[data-trygo="login"]'); await pg.wait_for_timeout(250)
        print("2b on:", await pg.evaluate("location.hash"))
        await pg.fill("#aE","me@test.ac.uk"); await pg.fill("#aW","password1"); await pg.click("#af button[type=submit]"); await pg.wait_for_timeout(500)
        tr=await pg.evaluate(f"__db.tries.filter(t=>t.post_id==='{pid}').map(t=>t.result+':'+t.note)")
        print("2c hash:", await pg.evaluate("location.hash"), "| tries:", tr, "| toast:", await pg.inner_text("#toasts"))
        # 3. login from home goes home
        await pg.evaluate("sb.auth.signOut()"); await pg.wait_for_timeout(200); await pg.evaluate("location.hash='index'"); await pg.wait_for_timeout(200)
        await pg.evaluate("location.hash='login'"); await pg.wait_for_timeout(200)
        await pg.fill("#aE","me@test.ac.uk"); await pg.fill("#aW","password1"); await pg.click("#af button[type=submit]"); await pg.wait_for_timeout(400)
        print("3 hash:", await pg.evaluate("location.hash"))
        # 4. stored return via email link: simulate token hash + SIGNED_IN
        await pg.evaluate("sb.auth.signOut()"); await pg.wait_for_timeout(200); await pg.evaluate(f"location.hash='t-{pid}'"); await pg.wait_for_timeout(250)
        await pg.evaluate("location.hash='join'"); await pg.wait_for_timeout(200)
        print("4 stored:", await pg.evaluate("localStorage.getItem('th-return')"))
        print("ERRORS:", errs)
        await b.close()
asyncio.run(main())
