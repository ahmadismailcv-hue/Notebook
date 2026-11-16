import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome")
        pg=await b.new_page(viewport={"width":100,"height":80},device_scale_factor=1)
        await pg.goto("file:///home/claude/th/dist/_badge.html"); await pg.wait_for_timeout(300)
        await (await pg.query_selector("#b")).screenshot(path="dist/badge.png")
        await (await pg.query_selector("#i")).screenshot(path="dist/badge-icon.png")
        pg2=await b.new_page(viewport={"width":100,"height":80},device_scale_factor=3)
        await pg2.goto("file:///home/claude/th/dist/_badge.html"); await pg2.wait_for_timeout(300)
        await (await pg2.query_selector("#b")).screenshot(path="logo/badge_zoom.png")
        await b.close()
asyncio.run(main())
