# The World in His Lifetime

An interactive map of the world during the lifetime of the Prophet Muhammad ﷺ (c. 570–632 CE).
Select any country to see who ruled it, what was happening there, and the sources.

## Run it

It is a static site: `index.html` plus `vendor/` (d3 7.8.5, topojson 3.0.2). Open `index.html` in a
browser, or host the folder on any static host (GitHub Pages, Netlify, Cloudflare Pages).

## Sources

- Seerah: Ibn Hishām, *al-Sīra al-Nabawiyya*, tr. A. Guillaume, *The Life of Muhammad* (OUP, 1955);
  al-Mubārakpūrī, *Ar-Raḥīq al-Makhtūm* (*The Sealed Nectar*), Darussalam.
- Country entries: each lists its own sources (Encyclopaedia Britannica, Encyclopaedia Iranica,
  UNESCO, museum and university publications, peer-reviewed studies).
- Entries not yet checked against an online source are marked "Under review" and their details are withheld.

Map data: Natural Earth via world-atlas 2.0.2 (public domain).

## Rebuild

Edit `data/*.json` or `src/template.html`, then run `node src/build.cjs`. It regenerates `index.html` and checks every entry for missing sources and the ﷺ honorific.

## Deploy (GitHub Pages)

1. This folder is the root of the `world-in-his-lifetime` repository.
2. In the repo on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` runs `.github/workflows/pages.yml`, which builds and publishes the site.

### Custom domain

Set `"domain"` in `src/site.config.json` (for example `"example.org"`) and push. The build writes the
`CNAME` file and uses the domain for links and the sitemap. Then add DNS records at your registrar:

- Apex domain (`example.org`): four `A` records to `185.199.108.153`, `185.199.109.153`,
  `185.199.110.153`, `185.199.111.153`.
- Subdomain (`www.example.org`): one `CNAME` record to `ahmadismailcv-hue.github.io`.

Then in **Settings → Pages**, enter the domain and tick **Enforce HTTPS** once the certificate is issued.
