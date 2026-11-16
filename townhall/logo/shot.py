import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome")
        pg=await b.new_page(viewport={"width":520,"height":300},device_scale_factor=2)
        await pg.goto("file:///home/claude/th/logo/test.html"); await pg.wait_for_timeout(300)
        await pg.screenshot(path="logo/logo.png"); await b.close()
asyncio.run(main())
