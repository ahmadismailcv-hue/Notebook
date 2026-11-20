# Builds a self-contained preview of the site that runs on test/mock.js instead of Supabase.
# Output: preview/dist/boring-bits-preview.html (no doctype/html/head/body: the Artifact host adds those).
# Run from the townhall folder after npm install: python3 preview/build_preview.py
import base64, os, re
r = lambda p: open(p, encoding='utf-8').read()
b64 = lambda p: base64.b64encode(open(p, 'rb').read()).decode()
s = r('src/shell.html')
app = r('src/app.js')
name = re.search(r'const APP_NAME = "([^"]+)"', app).group(1)
s = s.replace('__APP_NAME__', name).replace('__FIXED__', open('fonts/fixed.b64').read().strip())
s = s.replace('__ATK400__', b64('node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2'))
s = s.replace('__ATK700__', b64('node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2'))
f = lambda n: b64('node_modules/@fontsource/' + n + '.woff2')
for k, n in {'__INTER400__': 'inter/files/inter-latin-400-normal', '__INTER500__': 'inter/files/inter-latin-500-normal', '__INTER600__': 'inter/files/inter-latin-600-normal', '__YS400__': 'young-serif/files/young-serif-latin-400-normal', '__LEX400__': 'lexend/files/lexend-latin-400-normal', '__LEX700__': 'lexend/files/lexend-latin-700-normal', '__NEWS500__': 'newsreader/files/newsreader-latin-500-normal', '__NEWS600__': 'newsreader/files/newsreader-latin-600-normal', '__CP600__': 'chakra-petch/files/chakra-petch-latin-600-normal', '__CP700__': 'chakra-petch/files/chakra-petch-latin-700-normal', '__PS400__': 'ibm-plex-sans/files/ibm-plex-sans-latin-400-normal', '__PS600__': 'ibm-plex-sans/files/ibm-plex-sans-latin-600-normal', '__PM400__': 'ibm-plex-mono/files/ibm-plex-mono-latin-400-normal', '__PM500__': 'ibm-plex-mono/files/ibm-plex-mono-latin-500-normal'}.items():
    s = s.replace(k, f(n))
# Preview data: the mock, logged out, every post labelled Example, headlines marked as examples.
prep = r('preview/preview_data.js')
s = s.replace('__SUPABASE_JS__', r('test/mock.js') + '\n' + prep).replace('__APP_JS__', app)
# Banner and preview-only CSS (the viewer frame cannot print or download, so Print and Export are hidden)
banner = ('<div class="notice" role="note" style="margin:0;border-radius:0;text-align:center">'
          '<b>Preview with example data.</b> Nothing here is real or saved: reload to reset. '
          'Press Log in and use any email and password to try it as an admin.</div>')
s = s.replace('<body class="f-tech">', '<body class="f-tech">' + banner)
s = s.replace('</style>', 'html,body{background:var(--bg)}#printBtn,#exJson,#exMd{display:none!important}\n</style>', 1)
# Drop the document skeleton and the icon links; keep title, style and body content.
title = re.search(r'<title>.*?</title>', s).group(0)
style = re.search(r'<style>.*?</style>', s, re.S).group(0)
body = re.search(r'<body[^>]*>(.*)</body>', s, re.S).group(1)
os.makedirs('preview/dist', exist_ok=True)
out = title.replace('</title>', ' preview</title>') + '\n' + style + '\n' + body
open('preview/dist/boring-bits-preview.html', 'w', encoding='utf-8').write(out)
print(len(out), 'bytes; em dashes:', out.count('—'))
