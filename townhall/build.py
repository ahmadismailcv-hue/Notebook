import base64
r=lambda p:open(p,encoding='utf-8').read()
b64=lambda p:base64.b64encode(open(p,'rb').read()).decode()
s=r('src/shell.html')
s=s.replace('__FIXED__',open('fonts/fixed.b64').read().strip())
s=s.replace('__ATK400__',b64('node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2'))
s=s.replace('__ATK700__',b64('node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2'))
f=lambda n:b64('node_modules/@fontsource/'+n+'.woff2')
for k,n in {'__INTER400__':'inter/files/inter-latin-400-normal','__INTER500__':'inter/files/inter-latin-500-normal','__INTER600__':'inter/files/inter-latin-600-normal','__NEWS500__':'newsreader/files/newsreader-latin-500-normal','__NEWS600__':'newsreader/files/newsreader-latin-600-normal','__CP600__':'chakra-petch/files/chakra-petch-latin-600-normal','__CP700__':'chakra-petch/files/chakra-petch-latin-700-normal','__PS400__':'ibm-plex-sans/files/ibm-plex-sans-latin-400-normal','__PS600__':'ibm-plex-sans/files/ibm-plex-sans-latin-600-normal','__PM400__':'ibm-plex-mono/files/ibm-plex-mono-latin-400-normal','__PM500__':'ibm-plex-mono/files/ibm-plex-mono-latin-500-normal'}.items():
    s=s.replace(k,f(n))
js=r('node_modules/@supabase/supabase-js/dist/umd/supabase.js').replace('</script','<\\/script')
s=s.replace('__SUPABASE_JS__',js).replace('__APP_JS__',r('src/app.js'))
__import__('os').makedirs('dist',exist_ok=True); open('dist/index.html','w',encoding='utf-8').write(s)
__import__('shutil').copytree('static','dist',dirs_exist_ok=True)  # favicon.svg, badge.png, badge-icon.png
print(len(s), 'em dashes in app/shell:', r('src/app.js').count('—')+r('src/shell.html').count('—'))
