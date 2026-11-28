import base64
r=lambda p:open(p,encoding='utf-8').read()
b64=lambda p:base64.b64encode(open(p,'rb').read()).decode()
s=r('src/shell.html')
APP_NAME=__import__('re').search(r'const APP_NAME = "([^"]+)"', r('src/app.js')).group(1)
s=s.replace('__APP_NAME__',APP_NAME)
for k,f2 in {'__LOGO_HEADER__':'logo/brand/logo-header.webp','__LOGO_FULL__':'logo/brand/logo-full.webp','__FAVICON__':'logo/brand/favicon.png'}.items(): s=s.replace(k,b64(f2))
s=s.replace('__ATK400__',b64('node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2'))
s=s.replace('__ATK700__',b64('node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2'))
f=lambda n:b64('node_modules/@fontsource/'+n+'.woff2')
for k,n in {'__YS400__':'young-serif/files/young-serif-latin-400-normal','__LEX400__':'lexend/files/lexend-latin-400-normal','__LEX700__':'lexend/files/lexend-latin-700-normal'}.items():
    s=s.replace(k,f(n))
js=r('node_modules/@supabase/supabase-js/dist/umd/supabase.js').replace('</script','<\\/script')
s=s.replace('__SUPABASE_JS__',js).replace('__APP_JS__',r('src/app.js'))
__import__('os').makedirs('dist',exist_ok=True); open('dist/index.html','w',encoding='utf-8').write(s)
__import__('shutil').copytree('static','dist',dirs_exist_ok=True)  # favicon, home-screen icon, badge.png, badge-icon.png
print(len(s), 'em dashes in app/shell:', r('src/app.js').count('—')+r('src/shell.html').count('—'))
