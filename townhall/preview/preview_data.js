// Preview only: start logged out, show the demo admin as "demo_admin", and label all sample content.
(() => {
  window.__setSession(null);
  const db = window.__db;
  db.profiles.forEach(p => { if (p.id === "u_me") { p.handle = "demo_admin"; p.profession = "Demo admin account"; } });
  db.posts.forEach(p => { p.is_sample = true; });
  db.news_items.forEach(n => { n.source = "Example headline"; n.url = "https://www.gov.uk/search/news-and-communications?keywords=scam"; });
})();
