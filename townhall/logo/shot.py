# One-off script. Not used by build.py or the tests.
# Renders logo/test.html to logo/logo.png. Run from the project root: python3 logo/shot.py
import asyncio, pathlib
from playwright.async_api import async_playwright
SRC = pathlib.Path("logo/test.html").resolve().as_uri()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await b.new_page(viewport={"width":520,"height":300},device_scale_factor=2)
        await pg.goto(SRC); await pg.wait_for_timeout(300)
        await pg.screenshot(path="logo/logo.png"); await b.close()
asyncio.run(main())
