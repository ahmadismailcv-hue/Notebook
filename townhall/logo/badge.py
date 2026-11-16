# One-off script. Not used by build.py or the tests.
# Renders dist/_badge.html to dist/badge.png, dist/badge-icon.png and logo/badge_zoom.png.
# Run from the project root: python3 logo/badge.py
# dist/_badge.html did not come across with the project, so this script cannot run until it is restored.
import asyncio, pathlib
from playwright.async_api import async_playwright
SRC = pathlib.Path("dist/_badge.html").resolve().as_uri()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await b.new_page(viewport={"width":100,"height":80},device_scale_factor=1)
        await pg.goto(SRC); await pg.wait_for_timeout(300)
        await (await pg.query_selector("#b")).screenshot(path="dist/badge.png")
        await (await pg.query_selector("#i")).screenshot(path="dist/badge-icon.png")
        pg2=await b.new_page(viewport={"width":100,"height":80},device_scale_factor=3)
        await pg2.goto(SRC); await pg2.wait_for_timeout(300)
        await (await pg2.query_selector("#b")).screenshot(path="logo/badge_zoom.png")
        await b.close()
asyncio.run(main())
