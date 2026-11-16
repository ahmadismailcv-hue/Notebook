# Renders logo/badge.html to static/badge.png (88 by 31), static/badge-icon.png (64 by 64)
# and logo/badge_zoom.png (the badge at 3 times, for checking by eye).
# Not part of the build: run it by hand after changing logo/badge.html.
# Needs npm install first (the fonts come from node_modules). Run from the project root: python3 logo/badge.py
import asyncio, pathlib
from playwright.async_api import async_playwright
SRC = pathlib.Path("logo/badge.html").resolve().as_uri()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await b.new_page(viewport={"width":120,"height":120},device_scale_factor=1)
        await pg.goto(SRC); await pg.evaluate("document.fonts.ready"); await pg.wait_for_timeout(300)
        await (await pg.query_selector("#b")).screenshot(path="static/badge.png", omit_background=True)
        await (await pg.query_selector("#i")).screenshot(path="static/badge-icon.png", omit_background=True)
        pg2=await b.new_page(viewport={"width":120,"height":120},device_scale_factor=3)
        await pg2.goto(SRC); await pg2.evaluate("document.fonts.ready"); await pg2.wait_for_timeout(300)
        await (await pg2.query_selector("#b")).screenshot(path="logo/badge_zoom.png", omit_background=True)
        await b.close()
asyncio.run(main())
