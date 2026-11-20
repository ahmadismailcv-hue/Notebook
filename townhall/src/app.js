"use strict";
// ================= config =================
const APP_NAME = "The Boring Bits"; // the product name lives here only (build.py copies it into shell.html)
const TAGLINE = "AI help for everyday life. Shared by people, tested by us.";
const NOT_ADVICE = "This is general information, not legal, financial or medical advice.";
const SUPABASE_URL = "https://dlqltqsojkjygzzehvjk.supabase.co";
const SUPABASE_KEY = "sb_publishable_cjOiFDs528cpWXSYkWa7fw_J5w0xas5";
const SHOW_COUNT_FROM = 50; // hide the member total until it says something good
const SITE = () => location.origin + location.pathname;
// Remember things across the login step (works across tabs, expires after a day)
function remember(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify({ v, t: Date.now() })); } catch (_) { } }
function recall(k, maxAge = 864e5) { try { const o = JSON.parse(localStorage.getItem(k) || "null"); if (!o || Date.now() - o.t > maxAge) { localStorage.removeItem(k); return null; } return o.v; } catch (_) { return null; } }
let lastPage = "";
const sb = (window.__mockSupabase || window.supabase).createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

// ================= state =================
const S = { session: null, me: null, boards: [], myLikes: new Set(), myFollows: [], isMod: false, modBoards: new Set() };
const V = document.getElementById("view");
const TYPES = ["STORY", "RECIPE"];
const HELD = ["money", "health-admin", "complaints"]; // stories here always wait for a moderator
const SUGGEST = ["energy", "council-tax", "parking", "renting", "benefits", "gp", "letters", "scams", "cv", "school"];
let sortMode = "top";
const TOOLS = { chatgpt: "ChatGPT", copilot: "Microsoft Copilot", gemini: "Google Gemini", claude: "Claude", other: "Other tool" };
const spaceHref = id => "#/" + id;
const spaceName = b => "/" + b.id;
const shotUrl = p => sb.storage.from("shots").getPublicUrl(p).data.publicUrl;

// ================= helpers =================
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const when = t => { const d = new Date(t); return `${String(d.getDate()).padStart(2, "0")} ${MON[d.getMonth()]} ${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const day = t => { const d = new Date(t); return `${String(d.getDate()).padStart(2, "0")} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
const isoDay = d => new Date(d).toISOString().slice(0, 10);
const cleanTag = t => String(t).toLowerCase().replace(/^#/, "").replace(/[^a-z0-9-]/g, "").slice(0, 30);
const parseTags = s => [...new Set(String(s).split(/[\s,]+/).map(cleanTag).filter(Boolean))].slice(0, 8);
const board = id => S.boards.find(b => b.id === id);
const TYPE_LABEL = { STORY: "Story", RECIPE: "Recipe" };
const TYPE_CLASS = { STORY: "TOOL", RECIPE: "WORKFLOW" }; // reuse the existing label colours
const typeTag = t => t ? `<span class="tg ${esc(TYPE_CLASS[t] || t)}">${esc(TYPE_LABEL[t] || t)}</span>` : "";
const plural = (n, one, many) => `<b>${n.toLocaleString("en-GB")}</b> ${n === 1 ? one : many}`;
const toolList = keys => (keys || []).map(k => TOOLS[k] || k).join(", ");
const tagLinks = tags => (tags || []).map(t => `<a class="ht" href="#tag-${esc(t)}">#${esc(t)}</a>`).join("");
const isStale = p => p.type === "RECIPE" && !!p.retest_due && new Date(p.retest_due + "T23:59:59") < new Date();
const isTested = p => p.type === "RECIPE" && (p.tested_tools || []).length > 0;
const crumb = rest => rest ? `<h1 class="h-page" style="margin:0 0 18px">${rest}</h1>` : "";
const authorName = p => !p.author && (p.is_sample || p.type === "RECIPE") ? APP_NAME + " team" : (p.author_handle || (p.profiles && p.profiles.handle) || "[deleted member]");
const userLink = h => h && h !== "[deleted member]" && h !== APP_NAME + " team" ? `<a href="#u-${esc(h)}">${esc(h)}</a>` : esc(h);
function rankOf(rep, role) { if (role === "admin") return "Admin"; return rep >= 60 ? "Trusted member" : rep >= 20 ? "Regular" : rep >= 5 ? "Member" : "New member"; }
function hot(p) { const h = (Date.now() - new Date(p.created_at)) / 36e5; return (p.likes + 3 * p.tries_worked + 1) / Math.pow(h + 2, 1.5); }
function sorted(list, mode = sortMode) {
  const a = [...list];
  if (mode === "new") a.sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
  else if (mode === "hot") a.sort((x, y) => hot(y) - hot(x));
  else if (mode === "worked") a.sort((x, y) => (y.type === "RECIPE") - (x.type === "RECIPE") || y.tries_worked - x.tries_worked || x.tries_failed - y.tries_failed || new Date(y.created_at) - new Date(x.created_at));
  else a.sort((x, y) => (y.likes + y.tries_worked) - (x.likes + x.tries_worked) || new Date(y.created_at) - new Date(x.created_at));
  return a.sort((x, y) => (y.pinned ? 1 : 0) - (x.pinned ? 1 : 0));
}
function identicon(key, name) {
  let h = 2166136261; for (const c of String(key)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } h >>>= 0;
  const hue = h % 360, n = String(name || "").replace(/[^a-z0-9]/gi, " ").trim();
  const parts = n.split(/\s+/).filter(Boolean);
  const ini = (parts.length > 1 ? parts[0][0] + parts[1][0] : n.slice(0, 2)).toUpperCase() || "?";
  const svgs = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="hsl(${hue},42%,90%)"/><text x="32" y="41" text-anchor="middle" font-family="Inter,Segoe UI,Helvetica,Arial,sans-serif" font-size="25" font-weight="600" fill="hsl(${hue},45%,28%)">${esc(ini)}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgs);
}
// The same checks as private.pii_problem in the database. "(this will be blocked)" marks the ones the database refuses on stories.
const POSTCODE_AREAS = "ab|al|b|ba|bb|bd|bh|bl|bn|br|bs|bt|ca|cb|cf|ch|cm|co|cr|ct|cv|cw|da|dd|de|dg|dh|dl|dn|dt|dy|e|ec|eh|en|ex|fk|fy|g|gl|gu|gy|ha|hd|hg|hp|hr|hs|hu|hx|ig|im|ip|iv|je|ka|kt|kw|ky|l|la|ld|le|ll|ln|ls|lu|m|me|mk|ml|n|ne|ng|nn|np|nr|nw|ol|ox|pa|pe|ph|pl|po|pr|rg|rh|rm|s|sa|se|sg|sk|sl|sm|sn|so|sp|sr|ss|st|sw|sy|ta|td|tf|tn|tq|tr|ts|tw|ub|w|wa|wc|wd|wf|wn|wr|ws|wv|yo|ze";
const PII = [
  [/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, "an email address"],
  [/(\+44\s?7\d{3}|\b07\d{3})\s?\d{3}\s?\d{3}|(\+44\s?[123]\d{2,3}|\b0[123]\d{2,3})\s?\d{3}\s?\d{3,4}\b/, "a phone number"],
  [/\b[a-z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[a-d]\b/i, "a National Insurance number"],
  [new RegExp("\\b(" + POSTCODE_AREAS + ")\\d[a-z\\d]?\\s?\\d[a-z]{2}\\b", "i"), "a postcode"],
  [/\b\d{2}-\d{2}-\d{2}\b/, "a sort code"],
  [/\b(\d[ -]?){12,18}\d\b/, "a card number"],
  [/\b\d{8}\b/, "an account number"]
];
function piiWarnings(txt) {
  const w = PII.filter(([re]) => re.test(txt)).map(([, l]) => l + " (this will be blocked)");
  if (/\b(Mr|Mrs|Ms|Miss|Dr|Prof)\.?\s+[A-Z][a-z]+/.test(txt)) w.push("what looks like a person's name with a title");
  if (/\b\d{1,4}\s+[A-Z][a-z]+\s+(Road|Street|Lane|Avenue|Close|Drive|Way|Crescent|Gardens)\b/.test(txt)) w.push("what looks like a street address");
  if (/\b(my|our)\s+(son|daughter|husband|wife|partner|mum|dad|mother|father)\s+[A-Z][a-z]+/.test(txt)) w.push("what may be a family member's name");
  return w;
}
const blockedOnly = w => w.filter(x => x.includes("blocked")).join(", ").replace(/ \(this will be blocked\)/g, "");
const errMsg = e => (e && (e.message || e.error_description)) || "Something went wrong. Try again.";
function setStatus(html) { document.getElementById("status").innerHTML = html || ""; }

// ================= display prefs =================
function applyDisplay(p) {
  const font = ["tech", "retro", "read", "large"].includes(p.font) ? p.font : "tech";
  document.body.classList.remove("f-tech", "f-retro", "f-read", "f-large");
  document.body.classList.add("f-" + font);
  document.body.classList.toggle("x2", font === "retro" && !!p.x2);
  try { localStorage.setItem("ath_display", JSON.stringify({ font, x2: !!p.x2 })); } catch (_) { }
}
function currentDisplay() { try { return JSON.parse(localStorage.getItem("ath_display")) || {}; } catch (_) { return {}; } }
applyDisplay(currentDisplay());
async function saveDisplay(p) {
  applyDisplay(p);
  if (S.me) {
    const prefs = { ...(S.me.prefs || {}), font: p.font, x2: !!p.x2 };
    const { error } = await sb.from("profiles").update({ prefs }).eq("id", S.me.id);
    if (!error) S.me.prefs = prefs;
  }
}

// ================= shell (sidebar, icons, cards) =================
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  hall: '<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 21h18"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c1.8.7 3 2.4 3.5 5.2"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  chat: '<path d="M21 12a8 8 0 01-11.5 7.2L4 20l1-4.6A8 8 0 1121 12z"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  news: '<path d="M5 4h11v15a1 1 0 001 1H6a1 1 0 01-1-1z"/><path d="M16 8h3v11a1 1 0 01-2 0"/><path d="M8 8h5M8 11h5M8 14h3"/>',
  ext: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  book: '<path d="M5 4.5A1.5 1.5 0 016.5 3H19v15H6.5A1.5 1.5 0 005 19.5z"/><path d="M5 19.5A1.5 1.5 0 006.5 21H19"/><path d="M9 7h6"/>',
  badge: '<path d="M12 2.5l2.3 1.7 2.9-.2.9 2.7 2.4 1.7-.9 2.7.9 2.7-2.4 1.7-.9 2.7-2.9-.2L12 21.5l-2.3-1.7-2.9.2-.9-2.7-2.4-1.7.9-2.7-.9-2.7 2.4-1.7.9-2.7 2.9.2z"/><path d="M8.7 12l2.3 2.3 4.3-4.6"/>'
};
const ago = t => { const s = (Date.now() - new Date(t)) / 1000; if (s < 3600) return Math.max(1, Math.round(s / 60)) + " min ago"; if (s < 86400) return Math.round(s / 3600) + " h ago"; if (s < 7 * 86400) return Math.round(s / 86400) + " d ago"; return day(t); };
const LABELS = { terms: "Terms of use", about: "About", accessibility: "Accessibility", "safe-sharing": "What you can safely share", notifications: "Notifications", index: "Home", categories: "Categories", recipes: "Recipes", news: "AI safety news", library: "My library", post: "Share a story", login: "Log in", join: "Join", newpass: "New password", me: "Settings", display: "Text & display", search: "Search", mod: "Moderation", badge: "Badge", faq: "FAQ", rules: "House rules", privacy: "Privacy", complaints: "Reports and complaints", "recipe-new": "New recipe" };
function routeLabel(h) {
  if (LABELS[h]) return LABELS[h];
  if (h.startsWith("tag-")) return "#" + h.slice(4);
  if (h.startsWith("u-")) return "Member / " + h.slice(2);
  if (h.startsWith("/")) return h;
  if (h.startsWith("lib-")) return "My library";
  if (h.startsWith("post-")) return "Share a story";
  if (h.startsWith("recipe-")) return "Recipe";
  return "";
}
function crumbHtml(h) {
  if (h.startsWith("lib-")) return `<a href="#library">My library</a>`;
  if (h.startsWith("post-")) { const b = board(h.slice(5)); return b ? `<a href="${spaceHref(b.id)}">${esc(spaceName(b))}</a>` : ""; }
  if (h.startsWith("recipe-")) return `<a href="#recipes">Recipes</a>`;
  return "";
}
function renderShell() {
  const h = location.hash.slice(1) || "index";
  const nav = [["categories", "Categories", IC.grid], ["index", "Home", IC.home], ["recipes", "Recipes", IC.check], ["news", "AI safety news", IC.news], ["library", "My library", IC.book]];
  const nav2 = [["post", "Share a story", IC.plus]];
  if (S.isMod) nav2.push(["mod", "Moderation", IC.shield]);
  nav2.push(["me", "Settings", IC.gear]);
  const on = k => k === h || (k === "library" && h.startsWith("lib-")) || (k === "post" && h.startsWith("post-")) || (k === "recipes" && h.startsWith("recipe-")) || (k === "categories" && h.startsWith("/"));
  const links = list => list.map(([k, l, i]) => `<a href="#${k}" class="${on(k) ? "on" : ""}"${on(k) ? ' aria-current="page"' : ""}>${svg(i)}${l}</a>`).join("");
  document.getElementById("snav").innerHTML = links(nav);
  document.getElementById("snav2").innerHTML = links(nav2);
  const bc = S.boardCounts || {};
  document.getElementById("sboards").innerHTML = S.boards.map(b => `<a href="${spaceHref(b.id)}" class="${h === "/" + b.id ? "on" : ""}" style="display:flex;align-items:center" title="${esc(b.descr)}">${esc(spaceName(b))}${bc[b.id] ? `<span class="count">${bc[b.id]}</span>` : ""}</a>`).join("");
  const who = document.getElementById("who");
  if (S.me) who.innerHTML = `<img src="${identicon(S.me.id, S.me.handle)}" alt=""><div style="min-width:0;flex:1"><a class="nm" href="#u-${esc(S.me.handle)}">${esc(S.me.handle)}</a>${S.me.banned ? " (suspended)" : ""}<div class="sub">${esc(S.me.role === "admin" ? "Admin" : (S.me.profession || "Member"))}</div></div><a href="#" id="signout" class="sub">Log out</a>`;
  else if (S.session) who.innerHTML = `<div class="sub">Signed in. Setting up your profile...</div>`;
  else who.innerHTML = `<div><div class="nm">Used AI for a boring job?</div><div class="sub"><a href="#join">Join</a> or <a href="#login">log in</a></div></div>`;
  const so = document.getElementById("signout"); if (so) so.onclick = async e => { e.preventDefault(); await sb.auth.signOut(); location.hash = "index"; };
  const lbl = routeLabel(h);
  document.title = (lbl ? lbl.replace(/^Member \/ /, "") + " · " : "") + APP_NAME;
  document.getElementById("crumbbar").innerHTML = crumbHtml(h);
  const cta = document.getElementById("topCta"), ctaT = document.getElementById("topCtaTxt");
  if (cta) {
    cta.hidden = h === "post" || h.startsWith("post-") || h.startsWith("recipe-") || h === "join" || h === "login";
    const ico = cta.querySelector("svg");
    if (S.me) { cta.href = "#post"; ctaT.textContent = "Share a story"; cta.className = "btn primary"; ico.style.display = ""; }
    else if (h === "index") { cta.href = "#login"; ctaT.textContent = "Log in"; cta.className = "btn"; ico.style.display = "none"; }
    else { cta.href = "#join"; ctaT.textContent = "Join free"; cta.className = "btn primary"; ico.style.display = "none"; }
  }
}
// Recipe feedback counts, shown on cards and the recipe page
function workedMeter(p) {
  const w = p.tries_worked || 0, f = p.tries_failed || 0, n = w + f;
  const pc = x => n ? (x / n * 100).toFixed(1) + "%" : "0%";
  return `<span title="${w} worked, ${f} didn't work">${n ? `<span class="tmeter" aria-hidden="true"><i style="width:${pc(w)};background:var(--good)"></i><i style="width:${pc(f)};background:var(--bad)"></i></span>` : ""}Worked for ${w} · Didn't work for ${f}</span>`;
}
function postCard(p, showBoard = true) {
  const name = authorName(p), b = board(p.board_id);
  const thumb = (p.screenshots || [])[0];
  const labels = `${p.pinned ? '<span class="tg MEETING">Pinned</span>' : ""}${typeTag(p.type)}${p.status === "draft" ? '<span class="tg PENDING">Draft</span>' : ""}${p.is_sample ? '<span class="tg SAMPLE">Example</span>' : ""}${p.type === "RECIPE" && !isTested(p) ? '<span class="tg STALE">Not tested yet</span>' : ""}${isStale(p) ? '<span class="tg STALE">May be out of date</span>' : ""}`;
  const tools = p.type === "RECIPE" ? (p.tools || []) : (p.tool_key ? [p.tool_key] : []);
  const foot = [
    tools.map(k => `<span class="toolchip">${esc(TOOLS[k] || k)}</span>`).join(""),
    p.type === "RECIPE" ? workedMeter(p) : "",
    p.replies ? `<span>${svg(IC.chat)}${p.replies} ${p.replies === 1 ? "reply" : "replies"}</span>` : "",
    p.type === "STORY" && p.likes ? `<span title="Likes">${svg(IC.heart)}${p.likes}</span>` : "",
    (p.tags || []).length ? `<span class="tagline">${p.tags.slice(0, 4).map(t => `<a href="#tag-${esc(t)}">#${esc(t)}</a>`).join(" ")}</span>` : "",
    showBoard && b ? `<a class="spacelink" href="${spaceHref(b.id)}">${esc(spaceName(b))}</a>` : ""
  ].filter(Boolean).join("");
  const sum = p.type === "RECIPE" ? p.task : (p.body || p.task);
  return `<article class="post${thumb ? " has-thumb" : ""}"><div class="post-main">
   <div class="post-head"><img class="av" src="${identicon(p.author || "team", name)}" alt="" width="32" height="32"><span class="who">${userLink(name)}</span>${p.author_profession ? `<span class="org">${esc(p.author_profession)}</span>` : ""}<span class="when">${esc(ago(p.created_at))}</span></div>
   <a class="post-title" href="#t-${esc(p.id)}">${esc(p.title)}</a>
   ${labels ? `<div class="post-labels">${labels}</div>` : ""}
   ${sum ? `<p class="post-sum">${esc(sum.slice(0, 400))}</p>` : ""}
   ${foot ? `<div class="post-foot">${foot}</div>` : ""}
   </div>${thumb ? `<a class="post-thumb" href="#t-${esc(p.id)}" tabindex="-1" aria-hidden="true"><img src="${esc(shotUrl(thumb))}" alt="" loading="lazy"></a>` : ""}</article>`;
}
function feed(list, showBoard = true, empty) {
  return list.length ? `<div class="feed">${list.map(p => postCard(p, showBoard)).join("")}</div>` : `<div class="empty">${empty || (toolFilter || typeFilter ? `Nothing matches these filters. <a href="#" id="fClear">Clear filters</a>` : `Nothing here yet. <a href="#post">Share the first story.</a>`)}</div>`;
}

// ================= filters & quick switcher =================
let toolFilter = "", typeFilter = "";
const trackEv = k => { try { sb.rpc("track_view", { p: k }).then(() => {}, () => {}); } catch (_) { } };
const usesTool = (p, k) => p.type === "RECIPE" ? (p.tools || []).includes(k) : p.tool_key === k;
const applyFilters = list => list.filter(p => (!toolFilter || usesTool(p, toolFilter)) && (!typeFilter || p.type === typeFilter));
function filterBar(withType = true) {
  return `<div class="filters" role="group" aria-label="Filters"><select id="fTool" aria-label="Filter by AI tool"><option value="">All tools</option>${Object.entries(TOOLS).map(([k, v]) => `<option value="${k}"${toolFilter === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>${withType ? `<select id="fType" aria-label="Filter by post type"><option value="">Stories and recipes</option>${TYPES.map(t => `<option value="${t}"${typeFilter === t ? " selected" : ""}>${TYPE_LABEL[t]}s</option>`).join("")}</select>` : ""}</div>`;
}
function bindFilters(rerender) {
  const a = document.getElementById("fTool"), b = document.getElementById("fType");
  if (a) a.onchange = () => { toolFilter = a.value; rerender(); };
  if (b) b.onchange = () => { typeFilter = b.value; rerender(); };
  const c = document.getElementById("fClear"); if (c) c.onclick = e => { e.preventDefault(); toolFilter = typeFilter = ""; rerender(); };
}
function openSwitcher() {
  if (document.getElementById("qs")) return;
  const d = document.createElement("div"); d.id = "qs"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", "Jump to a space");
  d.innerHTML = `<div class="qs-box"><input type="text" id="qsIn" placeholder="Jump to a /space, or type words to search posts" autocomplete="off" aria-label="Jump to a space or search"><div id="qsList" role="listbox"></div><div class="small qs-hint">Up and down to choose · Enter to open · Esc to close</div></div>`;
  document.body.appendChild(d);
  const back = document.activeElement, inp = d.querySelector("input"), lst = d.querySelector("#qsList");
  let sel = 0;
  const close = () => { d.remove(); if (back && back.focus) back.focus(); };
  const items = () => {
    const q = inp.value.toLowerCase().replace(/^\//, "").trim();
    const sp = S.boards.filter(b => !q || b.id.includes(q) || (b.descr || "").toLowerCase().includes(q)).map(b => ({ href: spaceHref(b.id), label: spaceName(b), sub: b.descr }));
    return q ? [...sp, { href: "#search", label: `Search posts for "${inp.value.trim()}"`, sub: "", q: inp.value.trim() }] : sp;
  };
  const draw = () => { const it = items(); sel = Math.max(0, Math.min(sel, it.length - 1));
    lst.innerHTML = it.map((x, i) => `<a href="${x.href}" class="qs-item${i === sel ? " on" : ""}" role="option" aria-selected="${i === sel}"${x.q ? ` data-q="${esc(x.q)}"` : ""}><b>${esc(x.label)}</b><span class="small">${esc(x.sub || "")}</span></a>`).join(""); };
  const go = x => { if (x.q) S.pendingQuery = x.q; close(); if (location.hash === x.href) route(); else location.hash = x.href; };
  inp.oninput = () => { sel = 0; draw(); };
  inp.onkeydown = e => { const it = items();
    if (e.key === "ArrowDown") { sel = Math.min(sel + 1, it.length - 1); draw(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
    else if (e.key === "Enter" && it[sel]) { e.preventDefault(); go(it[sel]); }
    else if (e.key === "Escape") close(); };
  lst.onclick = e => { const a = e.target.closest("a"); if (!a) return; e.preventDefault(); const it = items()[[...lst.children].indexOf(a)]; if (it) go(it); };
  d.onclick = e => { if (e.target === d) close(); };
  draw(); inp.focus();
}

// ================= feedback: loading, busy buttons, toasts =================
let loadTimer = null;
function showSkeleton() {
  V.setAttribute("aria-busy", "true");
  V.innerHTML = `<div aria-hidden="true"><div class="sk sk-h"></div><div class="sk sk-p"></div>${Array.from({ length: 3 }, () => `<div class="sk-card"><div class="sk sk-line w40"></div><div class="sk sk-line w80"></div><div class="sk sk-line w60"></div></div>`).join("")}</div>`;
}
function busy(btn, on) {
  if (!btn) return;
  btn.disabled = on; btn.classList.toggle("busy", on);
  if (on) btn.setAttribute("aria-busy", "true"); else btn.removeAttribute("aria-busy");
}
function toast(message, kind = "ok") {
  const box = document.getElementById("toasts"); if (!box) return;
  const t = document.createElement("div"); t.className = "toast " + kind;
  t.innerHTML = `${kind === "ok" ? svg(IC.check) : ""}<span>${esc(message)}</span>`;
  box.appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, 2600);
}
function pendingToast(m) { S.toastNext = m; }
function flushToast() { if (S.toastNext) { toast(S.toastNext); S.toastNext = ""; } }

// ================= data =================
async function loadMe() {
  const { data } = await sb.auth.getSession();
  S.session = data.session;
  S.me = null; S.myLikes = new Set(); S.myFollows = []; S.isMod = false; S.modBoards = new Set();
  if (S.session) {
    const uid = S.session.user.id;
    const [pr, lk, fl, md] = await Promise.all([
      sb.rpc("my_profile"),
      sb.from("likes").select("post_id").eq("user_id", uid),
      sb.from("follows").select("kind,target").eq("user_id", uid),
      sb.from("board_mods").select("board_id").eq("user_id", uid)
    ]);
    S.me = pr.data && pr.data.id ? pr.data : null;
    (lk.data || []).forEach(r => S.myLikes.add(r.post_id));
    S.myFollows = fl.data || [];
    (md.data || []).forEach(r => S.modBoards.add(r.board_id));
    S.isMod = !!S.me && (S.me.role === "admin" || S.modBoards.size > 0);
    if (S.me && S.me.prefs && S.me.prefs.font) applyDisplay(S.me.prefs);
  }
  renderShell(); loadNotifCount();
}
async function loadBoards() {
  const [bd, pc] = await Promise.all([sb.from("boards").select("*").order("sort"), sb.from("post_feed").select("board_id").eq("status", "published").limit(2000)]);
  S.boards = (bd.data || []).filter(b => !b.archived); S.boardCounts = {};
  (pc.data || []).forEach(r => S.boardCounts[r.board_id] = (S.boardCounts[r.board_id] || 0) + 1);
  renderShell();
}
const FEED_COLS = "id,author,task,body,tool_key,screenshots,author_profession,board_id,type,title,tags,status,pinned,is_sample,tested_on,created_at,author_handle,likes,tries_worked,tries_failed,replies,tools,tested_tools,retest_due";
async function fetchPosts(q) { const { data, error } = await q; if (error) throw error; return data || []; }
const publishedPosts = () => sb.from("post_feed").select(FEED_COLS).eq("status", "published").order("created_at", { ascending: false }).limit(300);
const isAdmin = () => !!(S.me && S.me.role === "admin");
const isModOf = b => S.me && (S.me.role === "admin" || S.modBoards.has(b));
const follows = (kind, target) => S.myFollows.some(f => f.kind === kind && f.target === target);
function needLogin(what) { return `<div class="notice">${esc(what)} needs an account. <a href="#login">Log in</a> or <a href="#join">join</a>. It's free.</div>`; }
const logEntry = k => { try { sb.rpc("log_entry", { k }).then(() => {}, () => {}); } catch (_) { } };

// ================= list rendering =================
const SORTS = [["top", "Top"], ["worked", "Most worked"], ["hot", "Hot"], ["new", "Newest"]];
function sortTabs(withType = true) { return `<div class="feedbar"><div class="tabs" role="tablist">${SORTS.map(([k, l]) => `<a href="#" role="tab" data-sort="${k}" class="${sortMode === k ? "on" : ""}">${l}</a>`).join("")}</div>${filterBar(withType)}</div>`; }
function bindSort(rerender) { V.querySelectorAll("[data-sort]").forEach(a => a.onclick = e => { e.preventDefault(); sortMode = a.dataset.sort; rerender(); }); bindFilters(rerender); }
function followBtn(kind, target) {
  if (!S.me) return "";
  const on = follows(kind, target);
  return `<button class="btn ${on ? "on" : ""}" data-follow="${kind}:${esc(target)}">${on ? "Following" : "+ Follow"}</button>`;
}
function bindFollow(after) {
  V.querySelectorAll("[data-follow]").forEach(b => b.onclick = async () => {
    const [kind, target] = b.dataset.follow.split(":"); b.disabled = true;
    const on = follows(kind, target);
    const { error } = on ? await sb.from("follows").delete().eq("user_id", S.me.id).eq("kind", kind).eq("target", target)
      : await sb.from("follows").insert({ kind, target });
    if (error) { b.textContent = errMsg(error); b.disabled = false; return; }
    if (on) S.myFollows = S.myFollows.filter(f => !(f.kind === kind && f.target === target)); else S.myFollows.push({ kind, target });
    toast(on ? "Unfollowed" : `Following ${kind === "tag" ? "#" + target : (board(target) ? spaceName(board(target)) : target)}`);
    after();
  });
}

// ================= views =================
async function viewIndex() {
  const [posts, mem, ppl, nw] = await Promise.all([fetchPosts(publishedPosts()),
    sb.from("member_directory").select("id", { count: "exact", head: true }),
    sb.from("member_directory").select("*").order("rep", { ascending: false }).limit(5),
    sb.from("news_items").select("source,title,url,published_at").order("published_at", { ascending: false }).limit(5)]);
  const news = nw.data || [];
  const memberCount = mem.count || 0;
  const people = (ppl.data || []).filter(u => u.rep > 0 && u.role !== "admin");
  const recipes = posts.filter(p => p.type === "RECIPE"), stories = posts.filter(p => p.type === "STORY");
  const draw = () => {
    const list = sorted(applyFilters(posts)).slice(0, 30);
    const tc = {}; posts.forEach(p => (p.tags || []).forEach(t => tc[t] = (tc[t] || 0) + 1));
    const tags = Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 16);
    const best = sorted(recipes, "worked").filter(p => p.tries_worked > 0).slice(0, 5);
    V.innerHTML = `<div class="grid2"><div class="colmain">
      <section class="hero"><h1 class="h-page">${esc(TAGLINE.split(". ")[0])}</h1>
       <p class="lead">Bills, letters, complaints and forms. Members share how a free AI tool helped them. We turn the best into step-by-step recipes and test them ourselves.</p>
       <div class="hero-cta"><a class="btn primary lg" href="#post" data-entry="share">Share how AI helped you</a><a class="btn primary lg" href="#recipes" data-entry="browse">Browse tested recipes</a></div>
       <div class="small counter" aria-label="Site totals">${memberCount < SHOW_COUNT_FROM ? `<b>Founding members wanted.</b> Early stories shape what ${esc(APP_NAME)} becomes` : `<b>${memberCount.toLocaleString("en-GB")}</b> members`} · ${plural(stories.filter(p => !p.is_sample).length, "story", "stories")} · ${plural(recipes.length, "recipe", "recipes")}</div>
      </section>
      ${sortTabs()}${feed(list, true)}
    </div>
    <aside class="colrail rail" aria-label="Highlights">
      <div class="card card-pad"><h2 class="h3">Recipes that worked</h2>${best.length ? best.map(p => `<div class="rail-item"><a href="#t-${esc(p.id)}">${esc(p.title)}</a><div class="small">Worked for ${p.tries_worked}</div></div>`).join("") : `<div class="small">Nobody has said a recipe worked for them yet.</div>`}<div style="margin-top:8px"><a class="small" href="#recipes">All recipes</a></div></div>
      ${news.length ? `<div class="card card-pad"><h2 class="h3">AI safety news</h2><div class="newslist mini">${news.map(newsLink).join("")}</div><div style="margin-top:8px"><a class="small" href="#news">All news</a></div></div>` : ""}
      <div class="card card-pad"><h2 class="h3">Trending tags</h2>${tags.length ? tags.map(([t, n]) => `<a class="ht" href="#tag-${esc(t)}">#${esc(t)} <span style="opacity:.6">${n}</span></a>`).join("") : `<div class="small">No tags yet.</div>`}</div>
      <div class="card card-pad"><h2 class="h3">Most helpful members</h2>${people.length ? people.map(u => `<a class="person" href="#u-${esc(u.handle)}" style="text-decoration:none"><img class="av" src="${identicon(u.id, u.handle)}" alt="" width="36" height="36"><span class="t"><span class="n" style="display:block">${esc(u.handle)}</span><span class="s">${esc(u.profession || rankOf(u.rep, u.role))} · ${u.rep} rep</span></span></a>`).join("") : `<div class="small">Reputation comes from sharing stories. Nobody has earned any yet.</div>`}</div>
      <div class="card card-pad"><div class="small">${esc(NOT_ADVICE)}</div></div>
    </aside></div>`;
    bindSort(draw);
    V.querySelectorAll("[data-entry]").forEach(a => a.addEventListener("click", () => logEntry(a.dataset.entry)));
  };
  draw();
}
function pageHead(title, sub, actions) {
  return `<div class="bar"><div style="min-width:0"><h1 class="h-page">${title}</h1>${sub ? `<div class="small" style="margin-top:6px;max-width:720px">${sub}</div>` : ""}</div>${actions ? `<span class="trybar">${actions}</span>` : ""}</div>`;
}
let recipeSort = "worked";
async function viewRecipes() {
  const posts = await fetchPosts(publishedPosts().eq("type", "RECIPE"));
  const draw = () => {
    const keep = sortMode; sortMode = recipeSort;
    V.innerHTML = `${pageHead("Recipes", "Step-by-step guides for everyday jobs, written and tested by us with free AI tools. Each one says when it was last tested and how to check the answer.", isAdmin() ? `<a class="btn blue" href="#recipe-new">Write a recipe</a>` : "")}
      <div class="notice small">${esc(NOT_ADVICE)} Always check the answer with the official sources each recipe links to.</div>
      ${sortTabs(false)}${feed(sorted(applyFilters(posts), recipeSort), true, toolFilter ? `Nothing matches these filters. <a href="#" id="fClear">Clear filters</a>` : "No recipes published yet. They are being tested.")}`;
    sortMode = keep;
    V.querySelectorAll("[data-sort]").forEach(a => a.onclick = e => { e.preventDefault(); recipeSort = a.dataset.sort; draw(); });
    V.querySelectorAll("[data-sort]").forEach(a => a.classList.toggle("on", a.dataset.sort === recipeSort));
    bindFilters(draw);
  };
  draw();
}
async function viewBoard(id) {
  const b = board(id); if (!b) return viewNotFound();
  const posts = await fetchPosts(publishedPosts().eq("board_id", id));
  const mods = (await sb.from("board_mods").select("profiles(handle)").eq("board_id", id)).data || [];
  const draw = () => {
    V.innerHTML = `${pageHead(esc(spaceName(b)), `${esc(b.descr)}. ${mods.length ? "Space moderator" + (mods.length > 1 ? "s" : "") + ": " + mods.map(m => userLink(m.profiles && m.profiles.handle)).join(", ") : ""}`, `${followBtn("board", id)} <a class="btn" href="#post-${esc(id)}">Share a story here</a>`)}
      ${HELD.includes(id) ? `<div class="notice">A moderator checks every story here before it goes live, because these topics often involve money, health or a dispute.</div>` : ""}
      ${id === "health-admin" ? `<div class="notice">This space is for appointments, forms and paperwork only. Nothing here is diagnosis or treatment advice. For health worries, contact your GP, NHS 111 or, in an emergency, 999.</div>` : ""}
      ${sortTabs()}${feed(sorted(applyFilters(posts)), false)}`;
    bindSort(draw); bindFollow(draw);
  };
  draw();
}
async function viewTag(t) {
  t = cleanTag(t); if (!t) return viewNotFound();
  const posts = await fetchPosts(publishedPosts().contains("tags", [t]));
  const draw = () => {
    V.innerHTML = `${pageHead("#" + esc(t), `Every story and recipe tagged #${esc(t)}.`, followBtn("tag", t))}
      ${sortTabs()}${feed(sorted(applyFilters(posts)))}`;
    bindSort(draw); bindFollow(draw);
  };
  draw();
}
let newsSource = "";
const newsLink = n => `<a class="newsrow" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer"><span class="nt">${esc(n.title)}${svg(IC.ext)}</span><span class="small">${esc(n.source)} · ${esc(day(n.published_at))}</span></a>`;
async function viewNews() {
  const { data, error } = await sb.from("news_items").select("source_id,source,title,url,published_at").order("published_at", { ascending: false }).limit(300);
  if (error) throw error;
  const items = data || [];
  const sources = [...new Map(items.map(n => [n.source, n.source])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const draw = () => {
    const list = items.filter(n => !newsSource || n.source === newsSource);
    V.innerHTML = `${pageHead("AI safety news", "Headlines about scams, consumer warnings and privacy, including scams that use AI. Gathered automatically every 6 hours from public news feeds. Each title opens the full story on the publisher's own site.")}
      ${sources.length > 1 ? `<div class="chips" style="margin-bottom:14px" role="group" aria-label="Filter by source"><a href="#" class="ht${!newsSource ? " on" : ""}" data-ns="">All sources</a>${sources.map(([id, name]) => `<a href="#" class="ht${newsSource === id ? " on" : ""}" data-ns="${esc(id)}">${esc(name)}</a>`).join("")}</div>` : ""}
      ${list.length ? `<div class="card newslist">${list.map(newsLink).join("")}</div>` : `<div class="empty">No headlines yet. The next check runs within 6 hours.</div>`}
      <div class="small" style="margin-top:12px">${esc(APP_NAME)} shows headlines and links only. Stories belong to their publishers, and we aren't responsible for their content. If you think you've been scammed, contact your bank straight away and report it to Action Fraud (or Police Scotland in Scotland).</div>`;
    V.querySelectorAll("[data-ns]").forEach(a => a.onclick = e => { e.preventDefault(); newsSource = a.dataset.ns; draw(); });
  };
  draw();
}
async function viewCategories() {
  const posts = await fetchPosts(publishedPosts());
  const draw = () => {
    V.innerHTML = `${pageHead("Categories", "Find stories and recipes by the job you need to get done. Follow the ones that matter to you.")}
    <div class="catgrid">${S.boards.map(b => {
      const ps = posts.filter(p => p.board_id === b.id), last = ps[0], nr = ps.filter(p => p.type === "RECIPE").length;
      return `<section class="card catcard">
        <div class="cathead"><a class="catname" href="${spaceHref(b.id)}">${esc(spaceName(b))}</a><span class="small">${ps.length - nr} ${ps.length - nr === 1 ? "story" : "stories"} · ${nr} ${nr === 1 ? "recipe" : "recipes"}</span></div>
        <p class="small catdesc">${esc(b.descr)}</p>
        <div class="catlast small">${last ? `Latest: <a href="#t-${esc(last.id)}">${esc(last.title.slice(0, 70))}${last.title.length > 70 ? "..." : ""}</a> · ${esc(ago(last.created_at))}` : "No posts yet. Be the first."}</div>
        <div class="trybar catacts">${followBtn("board", b.id)}<a class="btn" href="#post-${esc(b.id)}">Share a story here</a></div>
      </section>`;
    }).join("")}</div>`;
    bindFollow(draw);
  };
  draw();
}

// ---- story and recipe pages ----
function storyFacts(p) {
  const f = [["What I needed to do", esc(p.task)], ["AI tool", esc(TOOLS[p.tool_key] || p.tool || "Not stated")]];
  if (p.checks) f.push(["What I checked before using the answer", esc(p.checks)]);
  return `<div class="facts">${f.map(([k, v]) => `<div class="k">${k}</div><div>${v}</div>`).join("")}</div>`;
}
function storyPrompt(p) {
  if (!p.prompt) return "";
  return `<div class="prompt" id="promptBox"><div class="lbl"><span>Roughly what I typed</span><button type="button" class="copy" id="copyPrompt" data-copy="${esc(p.prompt)}">Copy</button></div><pre id="promptText" hidden>${esc(p.prompt)}</pre>
    <button type="button" class="seemore" id="seeMore" aria-expanded="false" aria-controls="promptText">See more</button></div>`;
}
function recipeBody(p, sources) {
  const prompts = p.prompts || [], checks = p.how_to_check || [];
  const fact = (k, v) => v ? `<div class="k">${k}</div><div style="white-space:pre-wrap">${v}</div>` : "";
  return `<div class="notice small" role="note">${esc(NOT_ADVICE)}</div>
    ${p.deadline_warning ? `<div class="notice dummy" role="note"><b>Deadline:</b> ${esc(p.deadline_warning)}</div>` : ""}
    <p class="lead" style="margin:12px 0">${esc(p.task)}</p>
    <div class="facts">
      ${fact("Recommended free tools", esc(toolList(p.tools)) || "Any")}
      ${fact("Last tested", isTested(p) ? `${esc(day(p.tested_on))} with ${esc(toolList(p.tested_tools))}` : "Not tested yet")}
      ${p.retest_due ? fact("Re-test due", `${esc(day(p.retest_due))}${isStale(p) ? ' <span class="tg STALE">May be out of date</span>' : ""}`) : ""}
    </div>
    ${prompts.map((x, i) => `<div class="prompt"><div class="lbl"><span>${esc(x.label || "Prompt " + (i + 1))}</span><button type="button" class="copy" data-copy="${esc(x.text)}">Copy</button></div><pre>${esc(x.text)}</pre></div>`).join("")}
    ${p.never_paste ? `<div class="notice dummy"><b>Never paste this into an AI tool</b><div style="white-space:pre-wrap;margin-top:4px">${esc(p.never_paste)}</div></div>` : ""}
    ${checks.length ? `<div class="kslist"><div class="lbl">How to check the answer</div>${checks.map(c => `<div class="ksitem"><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.label)}<span class="sr"> (opens in a new tab)</span></a></div>`).join("")}</div>` : ""}
    ${p.failure_points ? `<div class="facts">${fact("Known failure points", esc(p.failure_points))}</div>` : ""}
    ${sources.length ? `<div class="small" style="margin-top:8px">Based on stories from members: ${sources.map(s => `<a href="#t-${esc(s.id)}">${esc(s.title)}</a>`).join(", ")}</div>` : ""}
    <div class="small printonly">From ${esc(APP_NAME)}, ${esc(SITE())}#t-${esc(p.id)}. Printed ${esc(day(new Date()))}.</div>`;
}
const TRY_LBL = { worked: ["Worked for me", "WORKFLOW"], failed: ["Didn't work for me", "FAIL"] };
function feedbackBox(p, myTry) {
  const radios = [["worked", "Worked for me"], ["failed", "Didn't work for me"]].map(([k, l]) => `<label><input type="radio" name="tr" value="${k}"${myTry && myTry.result === k ? " checked" : ""}> ${l}</label>`).join(" ");
  const tool = `<label class="small" style="display:block;margin-top:8px" for="trTool">AI tool you used</label><select id="trTool" style="width:auto"><option value="">Choose...</option>${Object.entries(TOOLS).map(([k, v]) => `<option value="${k}"${myTry && myTry.tool_key === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>`;
  const note = `<label class="small" style="display:block;margin-top:8px" for="trNote">Optional: what happened? <span id="trNoteHint">${myTry && myTry.result === "failed" ? "Tell us where it went wrong so we can fix the recipe." : ""}</span></label><input type="text" id="trNote" maxlength="500" value="${esc(myTry ? myTry.note : "")}">`;
  const acts = S.me ? `<button class="btn blue" id="trSave">${myTry ? "Update" : "Save"}</button>${myTry ? `<button class="btn danger" id="trDel">Remove my answer</button>` : ""}`
    : `<button class="btn primary" data-trygo="join">Join to save</button><button class="btn" data-trygo="login">Log in to save</button>`;
  return `<div class="box" style="margin:16px 0 0;background:var(--soft)"><h2 class="h3">Did this recipe work for you?</h2><div class="in">
    <div class="trybar">${radios}</div>${tool}${note}
    <div style="margin-top:8px" class="trybar">${acts}<span id="trMsg" class="small"></span></div>
    ${S.me ? "" : `<div class="small" style="margin-top:6px">We'll keep your answer and save it once you're in.</div>`}</div></div>`;
}
function justPostedPanel(p, b) {
  const link = SITE() + "#t-" + p.id;
  const body = `I shared how AI helped me with: ${p.task || p.title}\n\n${link}`;
  return `<div class="okmsg" role="status" style="margin-top:12px"><b>Your story is live${b ? ` in <a href="${spaceHref(b.id)}">${esc(spaceName(b))}</a>` : ""}.</b> Thank you. The most useful stories become tested recipes. You'll see replies under the bell.
    <div class="trybar" style="margin-top:10px"><button type="button" class="btn" id="jpCopy">Copy link</button><a class="btn" id="jpMail" href="mailto:?subject=${encodeURIComponent("How AI helped me")}&amp;body=${encodeURIComponent(body)}">Email it</a><span class="small" id="jpMsg" aria-live="polite"></span></div></div>`;
}
async function viewTopic(id) {
  const { data: p, error } = await sb.from("post_feed").select("*").eq("id", id).maybeSingle();
  if (error || !p) return viewNotFound("This post doesn't exist, is waiting for approval, or was removed.");
  const recipe = p.type === "RECIPE";
  const [reps, tries, src, rep] = await Promise.all([
    sb.from("replies").select("id,body,status,created_at,author,profiles(handle,profession)").eq("post_id", id).order("created_at"),
    recipe ? sb.from("tries").select("result,note,tool_key,created_at,user_id,profiles(handle)").eq("post_id", id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    sb.from("recipe_sources").select("recipe_id,story_id").eq(recipe ? "recipe_id" : "story_id", id),
    p.author ? sb.from("member_directory").select("rep,role").eq("id", p.author).maybeSingle() : Promise.resolve({ data: null })
  ]);
  const linkIds = (src.data || []).map(r => recipe ? r.story_id : r.recipe_id);
  const linked = linkIds.length ? ((await sb.from("post_feed").select("id,title,status").in("id", linkIds)).data || []).filter(x => x.status === "published" || isAdmin()) : [];
  const b = board(p.board_id), mine = S.me && p.author === S.me.id, mod = isModOf(p.board_id), admin = isAdmin();
  const canSave = S.me && p.status === "published";
  const mySaved = canSave ? (await sb.from("library_items").select("id").eq("source_post", p.id).maybeSingle()).data : null;
  const myTry = S.me ? (tries.data || []).find(t => t.user_id === S.me.id) : null;
  const canRate = recipe && p.status === "published" && !mine;
  const r = rep.data;
  const rl = (reps.data || []).length;
  const statusTag = p.status !== "published" ? `<span class="tg ${p.status === "removed" ? "REMOVED" : "PENDING"}">${esc(p.status === "draft" ? "Draft" : p.status === "pending" ? "Waiting for approval" : "Removed")}</span>` : "";
  let h = `<div class="grid2"><div class="colmain">
   <article class="topic-card${recipe ? " recipe-sheet" : ""}">
    <div class="post-head"><img class="av" src="${identicon(p.author || "team", authorName(p))}" width="40" height="40" alt=""><div><span class="who">${userLink(authorName(p))}</span><div class="small">${esc(p.author_profession || "")}</div></div><span class="when">${esc(when(p.created_at))}</span></div>
    <h1 class="topic-title">${esc(p.title)}</h1>
    <div>${p.pinned ? '<span class="tg MEETING">Pinned</span>' : ""}${typeTag(p.type)}${statusTag}${p.is_sample ? '<span class="tg SAMPLE">Example</span>' : ""}${recipe && !isTested(p) ? '<span class="tg STALE">Not tested yet</span>' : ""}${b ? `<a class="ht" href="${spaceHref(b.id)}">${esc(spaceName(b))}</a>` : ""}${tagLinks(p.tags)}</div>
    ${p.status === "pending" ? `<div class="notice" style="margin-top:12px">This story is waiting for a moderator. Stories from new members are checked until three have been approved, and stories in /money, /health-admin and /complaints are always checked. This usually takes up to 2 working days.${mine ? " You'll get a notification under the bell when it's approved." : ""}</div>` : ""}
    ${p.status === "draft" ? `<div class="notice" style="margin-top:12px">Draft. Only admins can see it. Test it, then edit it and press Publish.</div>` : ""}
    ${S.justPosted === p.id && mine && p.status === "published" ? justPostedPanel(p, b) : ""}
    ${recipe ? recipeBody(p, linked) : `${storyFacts(p)}${p.body ? `<h2 class="h3" style="margin-top:16px">What happened</h2><pre class="topic-body">${esc(p.body)}</pre>` : ""}${storyPrompt(p)}`}
    ${(p.screenshots || []).length ? `<div class="shots">${p.screenshots.map((s, i) => `<a href="${esc(shotUrl(s))}" target="_blank" rel="noopener"><img src="${esc(shotUrl(s))}" alt="Screenshot ${i + 1} shared by the author" loading="lazy"></a>`).join("")}</div>` : ""}
    ${!recipe && linked.length ? `<div class="okmsg small" style="margin-top:12px">This story helped us write a recipe: ${linked.map(x => `<a href="#t-${esc(x.id)}">${esc(x.title)}</a>`).join(", ")}</div>` : ""}
    <div class="trybar" style="margin-top:18px">
      ${!recipe && S.me && p.status === "published" ? `<button class="btn ${S.myLikes.has(p.id) ? "on" : ""}${S.pop === p.id ? " pop" : ""}" id="likeBtn" aria-pressed="${S.myLikes.has(p.id)}">${svg(IC.heart)}${S.myLikes.has(p.id) ? "Liked" : "Like"}</button>` : ""} ${!recipe && p.likes ? `<span class="likes">${p.likes} ${p.likes === 1 ? "like" : "likes"}</span>` : ""}
      ${recipe ? `<span class="likes">${workedMeter(p)}</span>` : ""}
    </div>
    ${canRate ? feedbackBox(p, myTry) : ""}
    <div class="trybar small" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line)">
      ${recipe ? `<button class="btn" id="printBtn">Print this recipe</button>` : ""}
      ${canSave ? (mySaved ? `<a class="btn on" href="#lib-${esc(mySaved.id)}">${svg(IC.book)}In your library</a>` : `<button class="btn" id="libSave">${svg(IC.book)}Save to library</button>`) : ""}
      ${!mine ? (S.me ? `<button class="btn" id="reportPost">Report</button>` : `<a class="btn" href="#login">Report</a>`) : ""}
      ${admin && !recipe && p.status === "published" ? `<a class="btn" href="#recipe-from-${esc(p.id)}" id="toRecipe">Turn into recipe</a>` : ""}
      ${admin && recipe ? `<a class="btn" href="#recipe-edit-${esc(p.id)}">Edit recipe</a>` : ""}
      ${mine || admin ? `<button class="btn danger" id="delPost">Delete</button>` : ""}
      ${mod ? `<span class="trybar">Moderator: ${p.status === "pending" || p.status === "removed" ? `<button class="btn" data-modset="published">Approve</button>` : ""}${p.status === "draft" && admin ? `<button class="btn" data-modset="published">Publish</button>` : ""}${p.status !== "removed" ? `<button class="btn danger" data-modset="removed">Take down</button>` : ""}${admin ? `<button class="btn" id="pinBtn">${p.pinned ? "Unpin" : "Pin"}</button>` : ""}</span>` : ""}
      <span id="actMsg"></span>
    </div>
   </article>
   <section class="card card-pad"><h2 class="h3">${rl} ${rl === 1 ? "reply" : "replies"}</h2>`;
  (tries.data || []).filter(t => t.note).slice(0, 10).forEach(t => {
    const [lbl, cls] = TRY_LBL[t.result] || TRY_LBL.failed, hd = t.profiles && t.profiles.handle;
    h += `<div class="reply"><img class="av" src="${identicon(t.user_id || hd, hd)}" width="34" height="34" alt=""><div class="body"><div class="meta"><span class="who">${userLink(hd || "[deleted member]")}</span><span class="tg ${cls}">${lbl}</span>${t.tool_key ? `<span>${esc(TOOLS[t.tool_key] || t.tool_key)}</span>` : ""}<span>${esc(day(t.created_at))}</span></div><pre>${esc(t.note)}</pre></div></div>`;
  });
  (reps.data || []).forEach(rr => {
    const pr = rr.profiles || {};
    h += `<div class="reply"><img class="av" src="${identicon(rr.author || rr.id, pr.handle)}" width="34" height="34" alt=""><div class="body"><div class="meta"><span class="who">${userLink(pr.handle || "[deleted member]")}</span>${pr.profession ? `<span>${esc(pr.profession)}</span>` : ""}<span>${esc(when(rr.created_at))}</span>${rr.status === "removed" ? '<span class="tg REMOVED">REMOVED</span>' : ""}
      <span class="acts">${!S.me ? `<a class="btn" href="#login">Report</a>` : rr.author !== S.me.id ? `<button class="btn" data-repr="${esc(rr.id)}">Report</button>` : ""}${S.me && (rr.author === S.me.id || S.me.role === "admin") ? `<button class="btn danger" data-delr="${esc(rr.id)}">Delete</button>` : ""}${mod && rr.status !== "removed" ? `<button class="btn danger" data-remr="${esc(rr.id)}">Take down</button>` : ""}</span></div>
      <pre>${esc(rr.body)}</pre></div></div>`;
  });
  if (!rl && !(tries.data || []).some(t => t.note)) h += `<div class="small" style="padding:4px 0 12px">No replies yet.</div>`;
  if (!S.me) h += `<div style="margin-top:12px">${needLogin("Replying")}</div>`;
  else if (p.status === "published") h += `<div style="padding-top:14px;border-top:1px solid var(--line)"><label class="sr" for="rtext">Reply</label><textarea id="rtext" maxlength="4000" placeholder="${recipe ? "Did you try it? What would make it clearer?" : "Has this happened to you? What did you do?"}"></textarea>
    <div class="trybar" style="margin-top:8px"><button class="btn blue" id="rsend">Post reply</button><span class="err" id="rmsg"></span></div></div>`;
  h += `</section></div>
  <aside class="colrail rail" aria-label="About this post">
    <div class="card card-pad"><h2 class="h3">${recipe ? "About recipes" : "About the author"}</h2>
      ${recipe ? `<div class="small">Recipes are written and tested by ${esc(APP_NAME)} admins with free AI tools. They are re-tested regularly, because AI tools change. ${esc(NOT_ADVICE)}</div>`
        : `<div class="person"><img class="av" src="${identicon(p.author || "team", authorName(p))}" width="44" height="44" alt=""><div class="t"><div class="n">${userLink(authorName(p))}</div><div class="s">${esc(p.author_profession || "Member")}</div></div></div>${r ? `<div class="small" style="margin-top:4px">${rankOf(r.rep, r.role)} · ${r.rep} reputation</div>` : ""}`}
    </div>
  </aside></div>`;
  V.innerHTML = h;
  document.getElementById("crumbbar").innerHTML = recipe ? `<a href="#recipes">Recipes</a>` : (b ? `<a href="${spaceHref(b.id)}">${esc(spaceName(b))}</a>` : "");
  document.title = p.title + " · " + APP_NAME;
  if (S.justPosted === p.id) {
    S.justPosted = null;
    const jc = document.getElementById("jpCopy"), jm = document.getElementById("jpMail");
    if (jc) jc.onclick = async () => { const link = SITE() + "#t-" + p.id, m = document.getElementById("jpMsg"); try { await navigator.clipboard.writeText(link); m.textContent = "Link copied."; } catch (_) { m.textContent = link; } trackEv("ev-share-copy"); };
    if (jm) jm.onclick = () => trackEv("ev-share-mail");
  }
  bindCopy();
  const sm = document.getElementById("seeMore"), pt = document.getElementById("promptText");
  if (sm) sm.onclick = () => { const o = pt.hidden; pt.hidden = !o; sm.textContent = o ? "See less" : "See more"; sm.setAttribute("aria-expanded", o); };
  const pb2 = document.getElementById("printBtn"); if (pb2) pb2.onclick = () => window.print();
  const msg = (id, t, ok) => { const el = document.getElementById(id); if (el) { el.className = ok ? "tries" : "err"; el.textContent = t; } };
  const reload = () => viewTopic(id);
  const ls = document.getElementById("libSave");
  if (ls) ls.onclick = async () => { busy(ls, true);
    const { data, error } = await sb.from("library_items").insert({ kind: "saved", source_post: p.id, ...libCopy(p) }).select("id").single();
    if (error) { msg("actMsg", errMsg(error)); busy(ls, false); return; }
    toast("Saved to your library");
    const a = document.createElement("a"); a.className = "btn on"; a.href = "#lib-" + data.id; a.innerHTML = svg(IC.book) + "Saved. Open in library"; ls.replaceWith(a); };
  const lb = document.getElementById("likeBtn");
  if (lb) lb.onclick = async () => { lb.disabled = true; const on = S.myLikes.has(p.id);
    const { error } = on ? await sb.from("likes").delete().eq("post_id", p.id).eq("user_id", S.me.id) : await sb.from("likes").insert({ post_id: p.id });
    if (error) { msg("actMsg", errMsg(error)); lb.disabled = false; return; } on ? S.myLikes.delete(p.id) : S.myLikes.add(p.id); S.pop = on ? null : p.id; await reload(); S.pop = null; };
  V.querySelectorAll('input[name="tr"]').forEach(x => x.addEventListener("change", () => { const m = document.getElementById("trMsg"); if (m) m.textContent = ""; const hn = document.getElementById("trNoteHint"); if (hn) hn.textContent = x.value === "failed" ? "Tell us where it went wrong so we can fix the recipe." : ""; }));
  const tryRow = () => { const sel = V.querySelector('input[name="tr"]:checked'); return sel ? { result: sel.value, note: document.getElementById("trNote").value.trim(), tool_key: document.getElementById("trTool").value } : null; };
  V.querySelectorAll("[data-trygo]").forEach(bt => bt.onclick = () => {
    const t = tryRow(); if (!t) { msg("trMsg", "Choose whether it worked first."); return; }
    remember("th-pendtry", { post_id: p.id, ...t });
    location.hash = bt.dataset.trygo;
  });
  const ts = document.getElementById("trSave");
  if (ts) ts.onclick = async () => { const t = tryRow(); if (!t) { msg("trMsg", "Choose whether it worked first."); return; }
    const w = blockedOnly(piiWarnings(t.note)); if (w) { msg("trMsg", "Remove " + w + " first."); return; }
    busy(ts, true); const { error } = await sb.from("tries").upsert({ post_id: p.id, user_id: S.me.id, ...t });
    if (error) { msg("trMsg", errMsg(error)); busy(ts, false); return; } await reload(); toast("Thanks. Your answer is recorded."); };
  const td = document.getElementById("trDel");
  if (td) td.onclick = async () => { await sb.from("tries").delete().eq("post_id", p.id).eq("user_id", S.me.id); reload(); };
  const rp = document.getElementById("reportPost");
  if (rp) rp.onclick = () => inlinePrompt(rp, "Why are you reporting this?", "", async v => {
    const { error } = await sb.from("reports").insert({ post_id: p.id, reason: v.slice(0, 300) });
    if (error) msg("actMsg", errMsg(error)); else toast("Reported. A moderator will look at it."); });
  V.querySelectorAll("[data-repr]").forEach(bn => bn.onclick = () => inlinePrompt(bn, "Why are you reporting this reply?", "", async v => {
    const { error } = await sb.from("reports").insert({ reply_id: bn.dataset.repr, reason: v.slice(0, 300) });
    if (error) msg("actMsg", errMsg(error)); else toast("Reported. A moderator will look at it."); }));
  const dp = document.getElementById("delPost");
  if (dp) dp.onclick = () => confirmTwice(dp, async () => { const { error } = await sb.from("posts").delete().eq("id", p.id); if (error) msg("actMsg", errMsg(error)); else location.hash = "index"; });
  V.querySelectorAll("[data-delr]").forEach(bn => bn.onclick = () => confirmTwice(bn, async () => { await sb.from("replies").delete().eq("id", bn.dataset.delr); reload(); }));
  V.querySelectorAll("[data-remr]").forEach(bn => bn.onclick = async () => { await sb.from("replies").update({ status: "removed" }).eq("id", bn.dataset.remr); reload(); });
  V.querySelectorAll("[data-modset]").forEach(bn => bn.onclick = async () => { const { error } = await sb.from("posts").update({ status: bn.dataset.modset }).eq("id", p.id); if (error) msg("actMsg", errMsg(error)); else reload(); });
  const pb = document.getElementById("pinBtn");
  if (pb) pb.onclick = async () => { await sb.from("posts").update({ pinned: !p.pinned }).eq("id", p.id); reload(); };
  const rs = document.getElementById("rsend");
  if (rs) rs.onclick = async () => {
    const v = document.getElementById("rtext").value.trim();
    if (v.length < 2) { msg("rmsg", "Write something first."); return; }
    const w = blockedOnly(piiWarnings(v));
    if (w) { msg("rmsg", "Remove " + w + " first."); return; }
    busy(rs, true); const { error } = await sb.from("replies").insert({ post_id: p.id, body: v });
    if (error) { msg("rmsg", errMsg(error)); busy(rs, false); return; } await reload(); toast("Reply posted");
  };
}
function bindCopy() {
  V.querySelectorAll("button.copy[data-copy]").forEach(cp => cp.onclick = async () => {
    try { await navigator.clipboard.writeText(cp.dataset.copy); cp.textContent = "Copied"; toast("Prompt copied"); } catch (_) { cp.textContent = "Select and copy"; }
    setTimeout(() => { if (cp.isConnected) cp.textContent = "Copy"; }, 2000); });
}
// What goes into the library when you save a post
function libCopy(p) {
  const prompt = p.type === "RECIPE" ? (p.prompts || []).map(x => (x.label ? x.label + ":\n" : "") + x.text).join("\n\n") : (p.prompt || "");
  return { type: p.type, title: p.title, body: p.type === "RECIPE" ? p.task || "" : p.body || "", prompt, tool_key: p.type === "RECIPE" ? "" : p.tool_key || "", tags: p.tags || [] };
}
function inlinePrompt(anchor, label, value, onOk) {
  const box = document.createElement("span");
  box.innerHTML = ` <label class="small">${esc(label)} <input type="text" style="width:auto;min-width:200px" maxlength="300" value="${esc(value || "")}"></label> <button class="btn">OK</button> <button class="btn">Cancel</button>`;
  anchor.after(box); anchor.disabled = true;
  const [inp] = box.getElementsByTagName("input"), [ok, cancel] = box.getElementsByTagName("button");
  inp.focus();
  cancel.onclick = () => { box.remove(); anchor.disabled = false; };
  ok.onclick = async () => { const v = inp.value.trim(); if (v.length < 3 && label.startsWith("Why")) { inp.focus(); return; } ok.disabled = true; await onOk(v); box.remove(); anchor.disabled = false; };
}
function confirmTwice(btn, fn) {
  if (btn.dataset.armed) { btn.disabled = true; fn(); return; }
  btn.dataset.armed = "1"; const old = btn.textContent; btn.textContent = "Click again to confirm";
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = old; } }, 4000);
}

// ================= sharing a story =================
const fld = (id, label, input, hint = "", cls = "") => `<div class="fld ${cls}"><label for="${id}">${label}</label>${hint ? `<div class="hint">${hint}</div>` : ""}${input}</div>`;
async function shrinkImage(file) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); // redrawing drops EXIF and other metadata
  const enc = (t, q) => new Promise(r => c.toBlob(r, t, q));
  let blob = await enc("image/webp", 0.85);
  if (!blob || blob.type !== "image/webp") blob = await enc("image/jpeg", 0.85);
  if (blob.size > 1400000) blob = await enc("image/jpeg", 0.7);
  if (blob.size > 1400000) throw new Error("too big");
  return blob;
}
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
const DUMMY_NOTE = `<b>Leave out anything personal.</b> Everything you post is public. Don't include your name, address, postcode, phone number, email, bank or card details, National Insurance number, or account and reference numbers. Write [my postcode] or [account number] instead. The same goes for screenshots. <a href="#safe-sharing">What you can safely share</a>.`;
async function viewPost(boardId) {
  if (!S.me) { V.innerHTML = crumb("Share a story") + needLogin("Sharing a story"); return; }
  if (S.me.banned) { V.innerHTML = crumb("Share a story") + `<div class="notice">Your account is suspended.</div>`; return; }
  const pre = S.prefill || null; S.prefill = null;
  const def = boardId || "";
  const shots = [];
  V.innerHTML = `${crumb("Share how AI helped you")}
  ${pre ? `<div class="okmsg">Publishing your library draft. Check each part, then publish. Your draft stays in your library.</div>` : ""}
  ${isAdmin() ? `<div class="okmsg small">You're an admin. To write a tested guide instead, <a href="#recipe-new">write a recipe</a>.</div>` : ""}
  <div class="notice dummy">${DUMMY_NOTE}</div>
  <form id="pf" novalidate>
   <section class="card card-pad fsec"><h2 class="h3">Your story</h2>
    ${fld("pfS", "Title", `<input type="text" id="pfS" maxlength="120" placeholder="e.g. ChatGPT helped me reply to a council tax letter">`)}
    <div class="fgrid">
    ${fld("pfB", "Space", `<select id="pfB"><option value="">Choose a space...</option>${S.boards.map(b => `<option value="${esc(b.id)}"${b.id === def ? " selected" : ""}>${esc(spaceName(b))}: ${esc(b.descr)}</option>`).join("")}</select>`, "Pick the job, not the tool. A moderator checks stories in /money, /health-admin and /complaints before they go live.")}
    ${fld("c8", "AI tool", `<select id="c8"><option value="">Choose...</option>${Object.entries(TOOLS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select>`)}
    </div>
    ${fld("c1", "What I needed to do", `<input type="text" id="c1" maxlength="300" placeholder="e.g. Understand a letter about my council tax and reply to it">`, "In plain words")}
    ${fld("pfP", `Roughly what I typed <span class="small">(optional)</span>`, `<textarea id="pfP" maxlength="8000" style="min-height:120px;font-family:ui-monospace,Menlo,monospace;font-size:14px"></textarea>`, "Readers see this when they press See more. Take out anything personal first.")}
    ${fld("pfM", "What happened", `<textarea id="pfM" maxlength="8000" placeholder="What the AI did, what was good, and what it got wrong."></textarea>`, "Shown as the summary on the feed.")}
    ${fld("pfC", `What I checked before using the answer <span class="small">(optional)</span>`, `<textarea id="pfC" maxlength="2000" style="min-height:80px" placeholder="e.g. I checked the deadline on GOV.UK and rang the council to confirm."></textarea>`)}
    <div class="fld"><label for="shotIn">Screenshot <span class="small">(optional, up to 3)</span></label>
     <div class="hint">Upload or paste (Ctrl+V). Crop out anything personal. Images are resized and their hidden metadata removed before upload.</div>
     <div class="shotpick"><label class="btn" for="shotIn">Add screenshot</label><input type="file" id="shotIn" accept="image/png,image/jpeg,image/webp" multiple class="sr"><span class="small" id="shotMsg"></span></div>
     <div class="shotprev" id="shotPrev"></div>
     <label class="chk" id="shotOkRow" style="display:none"><input type="checkbox" id="shotOk"> These screenshots show nothing personal: no names, addresses, account numbers or reference numbers.</label></div>
   </section>
   <section class="card card-pad fsec"><h2 class="h3">Finish</h2>
    ${fld("pfH", "Hashtags <span class='small'>(optional)</span>", `<input type="text" id="pfH" placeholder="#energy #complaint"><div class="chips" style="margin-top:6px">${SUGGEST.map(t => `<a href="#" class="ht" data-tag="${t}">#${t}</a>`).join("")}</div>`)}
    <div id="pii" class="small"></div>
    <label class="chk"><input type="checkbox" id="pfOk"> I've left out or changed anything personal, about me or anyone else.</label>
    <div class="hint" style="margin-top:8px">Everything you post is shared under <a href="#terms">CC BY 4.0</a>: others can reuse it with credit to you. ${esc(NOT_ADVICE)}</div>
    <div class="trybar" style="margin-top:14px"><button class="btn blue" type="submit" id="pfGo">Publish</button><span class="err" id="pfMsg" role="alert"></span></div>
    ${!isAdmin() ? `<div class="hint" style="margin-top:6px">A moderator checks your first three stories before they go live, usually within 2 working days. After that they go live straight away, except in /money, /health-admin and /complaints. Links unlock at 5 reputation.</div>` : ""}
   </section>
  </form>`;
  const g = id => document.getElementById(id).value.trim();
  if (pre) {
    const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
    set("pfS", pre.title); set("pfM", pre.body); set("pfP", pre.prompt); set("c8", pre.tool_key);
    set("pfH", (pre.tags || []).map(t => "#" + t).join(" "));
  }
  const shotMsg = t => document.getElementById("shotMsg").textContent = t || "";
  const drawShots = () => {
    document.getElementById("shotPrev").innerHTML = shots.map((s, i) => `<div class="shot"><img src="${s.url}" alt="Screenshot ${i + 1}"><button type="button" class="btn" data-rmshot="${i}" aria-label="Remove screenshot ${i + 1}">Remove</button></div>`).join("");
    document.getElementById("shotOkRow").style.display = shots.length ? "" : "none";
  };
  const addFiles = async files => {
    shotMsg("");
    for (const f of files) {
      if (shots.length >= 3) { shotMsg("Up to 3 screenshots."); break; }
      if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { shotMsg("Use PNG, JPEG or WebP images."); continue; }
      try { const blob = await shrinkImage(f); shots.push({ blob, url: URL.createObjectURL(blob) }); }
      catch (_) { shotMsg("Couldn't read that image. Try a smaller screenshot."); }
    }
    drawShots();
  };
  const shotIn = document.getElementById("shotIn");
  shotIn.onchange = async () => { await addFiles([...shotIn.files]); shotIn.value = ""; };
  document.getElementById("pf").addEventListener("paste", e => { const fs = [...(e.clipboardData || {}).files || []].filter(f => f.type.startsWith("image/")); if (fs.length) { e.preventDefault(); addFiles(fs); } });
  document.getElementById("shotPrev").onclick = e => { const b = e.target.closest("[data-rmshot]"); if (b) { const [s] = shots.splice(+b.dataset.rmshot, 1); URL.revokeObjectURL(s.url); drawShots(); } };
  const allText = () => [g("pfS"), g("pfM"), g("pfP"), g("c1"), g("pfC")].join(" ");
  const piiCheck = () => {
    const w = piiWarnings(allText());
    document.getElementById("pii").innerHTML = w.length ? `<div class="notice">Your story may contain ${w.map(esc).join("; ")}. Take it out or write something like [my postcode] instead.</div>` : "";
  };
  V.querySelectorAll("#pf input[type=text], #pf textarea").forEach(el => el.addEventListener("input", piiCheck));
  V.querySelectorAll("[data-tag]").forEach(a => a.onclick = e => { e.preventDefault(); const i = document.getElementById("pfH"); const cur = parseTags(i.value); if (!cur.includes(a.dataset.tag)) { cur.push(a.dataset.tag); i.value = cur.map(t => "#" + t).join(" "); } });
  document.getElementById("pf").onsubmit = async e => {
    e.preventDefault(); const m = document.getElementById("pfMsg"); m.textContent = "";
    const tags = parseTags(g("pfH") + " " + (g("pfM").match(/#[a-z0-9-]+/gi) || []).join(" "));
    if (g("pfS").length < 3) { m.textContent = "Add a title."; return; }
    if (!g("pfB")) { m.textContent = "Choose a space."; return; }
    if (!g("c8")) { m.textContent = "Choose the AI tool you used."; return; }
    if (!g("c1")) { m.textContent = "Say what you needed to do."; return; }
    if (g("pfM").length < 20) { m.textContent = "Say what happened (at least a sentence)."; return; }
    const blocked = blockedOnly(piiWarnings(allText()));
    if (blocked) { m.textContent = "Remove " + blocked + " first. Write something like [my postcode] instead."; return; }
    if (shots.length && !document.getElementById("shotOk").checked) { m.textContent = "Confirm the screenshots show nothing personal."; return; }
    if (!document.getElementById("pfOk").checked) { m.textContent = "Tick the box to confirm you've left out anything personal."; return; }
    const btn = document.getElementById("pfGo"); busy(btn, true);
    const paths = [];
    for (const s of shots) {
      const path = `${S.me.id}/${rid()}.${s.blob.type === "image/webp" ? "webp" : s.blob.type === "image/png" ? "png" : "jpg"}`;
      const { error } = await sb.storage.from("shots").upload(path, s.blob, { contentType: s.blob.type, upsert: false });
      if (error) { if (paths.length) await sb.storage.from("shots").remove(paths); m.textContent = "Screenshot upload failed: " + errMsg(error); busy(btn, false); return; }
      paths.push(path);
    }
    const row = { board_id: g("pfB"), type: "STORY", title: g("pfS"), tags, body: g("pfM"), prompt: g("pfP"), task: g("c1"), tool_key: g("c8"), tool: TOOLS[g("c8")], checks: g("pfC"), screenshots: paths };
    const { data, error } = await sb.from("posts").insert(row).select("id,status").single();
    if (error) { if (paths.length) await sb.storage.from("shots").remove(paths); m.textContent = errMsg(error); busy(btn, false); return; }
    shots.forEach(s => URL.revokeObjectURL(s.url));
    if (pre && pre.libId) await sb.from("library_items").update({ published_post: data.id }).eq("id", pre.libId);
    pendingToast(data.status === "pending" ? "Sent for approval. A moderator will check it, usually within 2 working days." : "Published");
    S.justPosted = data.id;
    location.hash = "t-" + data.id;
  };
}

// ================= writing a recipe (admins) =================
async function viewRecipeForm(editId, fromStory) {
  if (!isAdmin()) return viewNotFound("Only admins can write recipes.");
  let p = null, story = null, sources = [];
  if (editId) {
    p = (await sb.from("post_feed").select("*").eq("id", editId).maybeSingle()).data;
    if (!p || p.type !== "RECIPE") return viewNotFound("That recipe doesn't exist.");
    const ids = ((await sb.from("recipe_sources").select("story_id").eq("recipe_id", editId)).data || []).map(r => r.story_id);
    if (ids.length) sources = (await sb.from("post_feed").select("id,title").in("id", ids)).data || [];
  } else if (fromStory) {
    story = (await sb.from("post_feed").select("*").eq("id", fromStory).maybeSingle()).data;
    if (!story || story.type !== "STORY") return viewNotFound("That story doesn't exist.");
    sources = [{ id: story.id, title: story.title }];
  }
  const v = p || (story ? { title: story.title, board_id: story.board_id, task: story.task, tools: story.tool_key ? [story.tool_key] : [], prompts: story.prompt ? [{ label: "What to type", text: story.prompt }] : [], tags: story.tags || [] } : {});
  const prompts = (v.prompts || []).map(x => ({ ...x })), checks = (v.how_to_check || []).map(x => ({ ...x }));
  if (!prompts.length) prompts.push({ label: "", text: "" });
  const toolBoxes = (name, on) => Object.entries(TOOLS).map(([k, l]) => `<label class="chk" style="display:inline-flex;margin-right:14px"><input type="checkbox" name="${name}" value="${k}"${(on || []).includes(k) ? " checked" : ""}> ${esc(l)}</label>`).join("");
  document.getElementById("crumbbar").innerHTML = `<a href="#recipes">Recipes</a>`;
  V.innerHTML = `${crumb(p ? "Edit recipe" : "New recipe")}
   ${story ? `<div class="okmsg">Turning <a href="#t-${esc(story.id)}">${esc(story.title)}</a> into a recipe. It's saved as a draft until you test it and press Publish.</div>` : ""}
   <div class="notice small">Personal-data patterns only warn here, because recipes quote official addresses. Don't include anyone's real details. Every recipe shows: ${esc(NOT_ADVICE)}</div>
   <form id="rf" novalidate>
    <section class="card card-pad fsec"><h2 class="h3">The job</h2>
     ${fld("rS", "Title", `<input type="text" id="rS" maxlength="120" value="${esc(v.title || "")}">`, 'New, untested recipes start with "DRAFT, NOT TESTED: "')}
     <div class="fgrid">${fld("rB", "Space", `<select id="rB"><option value="">Choose a space...</option>${S.boards.map(b => `<option value="${esc(b.id)}"${b.id === v.board_id ? " selected" : ""}>${esc(spaceName(b))}</option>`).join("")}</select>`)}
     ${fld("rH", "Hashtags <span class='small'>(optional)</span>", `<input type="text" id="rH" value="${esc((v.tags || []).map(t => "#" + t).join(" "))}">`)}</div>
     ${fld("rT", "The task in one sentence", `<input type="text" id="rT" maxlength="300" value="${esc(v.task || "")}">`)}
     <div class="fld"><span class="lbl-like"><b>Recommended free tools</b></span><div role="group" aria-label="Recommended free tools">${toolBoxes("rTools", v.tools)}</div></div>
     ${fld("rD", `Deadline warning <span class="small">(optional, shown prominently)</span>`, `<input type="text" id="rD" maxlength="400" value="${esc(v.deadline_warning || "")}">`)}
    </section>
    <section class="card card-pad fsec"><h2 class="h3">Prompts</h2><div class="hint">Each prompt gets its own Copy button.</div><div id="rPrompts"></div><button type="button" class="btn" id="rPromptAdd" style="margin-top:8px">+ Add a prompt</button></section>
    <section class="card card-pad fsec"><h2 class="h3">Safety and checking</h2>
     ${fld("rN", "Never paste this", `<textarea id="rN" maxlength="2000" style="min-height:80px">${esc(v.never_paste || "")}</textarea>`, "What people must keep out of the AI tool.")}
     <div class="fld"><label>How to check the answer</label><div class="hint">Official sources: GOV.UK, Citizens Advice, the relevant ombudsman. Links must start with https://.</div><div id="rChecks"></div><button type="button" class="btn" id="rCheckAdd" style="margin-top:8px">+ Add a source</button></div>
     ${fld("rF", "Known failure points", `<textarea id="rF" maxlength="3000" style="min-height:80px">${esc(v.failure_points || "")}</textarea>`)}
    </section>
    <section class="card card-pad fsec"><h2 class="h3">Testing</h2>
     <div class="fgrid">${fld("rTd", "Last tested on", `<input type="date" id="rTd" value="${esc(v.tested_on || "")}">`, "Leave blank if not tested yet.")}
     ${fld("rR", "Re-test due", `<input type="date" id="rR" value="${esc(v.retest_due || "")}">`, 'After this date the recipe shows "May be out of date".')}</div>
     <div class="fld"><span class="lbl-like"><b>Tools it was tested with</b></span><div role="group" aria-label="Tools it was tested with">${toolBoxes("rTested", v.tested_tools)}</div></div>
     <div class="fld"><label>Based on stories</label><div id="rSrc"></div></div>
     <div id="rPii" class="small"></div>
     <div class="trybar" style="margin-top:14px"><button class="btn" type="button" id="rDraft">Save as draft</button><button class="btn blue" type="button" id="rPub">Publish</button><span class="err" id="rMsg" role="alert"></span></div>
    </section>
   </form>`;
  const g = id => document.getElementById(id).value.trim();
  const picked = name => [...V.querySelectorAll(`input[name="${name}"]:checked`)].map(x => x.value);
  const rowList = (elId, list, fields, addId, blank) => {
    const el = document.getElementById(elId);
    const draw = () => { el.innerHTML = list.map((x, i) => `<div class="ksrow" style="grid-template-columns:${fields.map(f => f[2]).join(" ")} auto">${fields.map(([k, l]) => k === "text" ? `<textarea data-k="${k}" data-i="${i}" aria-label="${l} ${i + 1}" style="min-height:90px;font-family:ui-monospace,Menlo,monospace;font-size:14px">${esc(x[k] || "")}</textarea>` : `<input type="text" data-k="${k}" data-i="${i}" aria-label="${l} ${i + 1}" placeholder="${l}" value="${esc(x[k] || "")}">`).join("")}<button type="button" class="btn" data-rm="${i}">Remove</button></div>`).join("") || `<div class="small">None yet.</div>`; };
    el.addEventListener("input", e => { const t = e.target; if (t.dataset.k) { list[+t.dataset.i][t.dataset.k] = t.value; piiCheck(); } });
    el.addEventListener("click", e => { const t = e.target.closest("[data-rm]"); if (t) { list.splice(+t.dataset.rm, 1); draw(); } });
    document.getElementById(addId).onclick = () => { if (list.length < 12) { list.push({ ...blank }); draw(); } };
    draw();
  };
  rowList("rPrompts", prompts, [["label", "Prompt name", "200px"], ["text", "Prompt", "1fr"]], "rPromptAdd", { label: "", text: "" });
  rowList("rChecks", checks, [["label", "Source name", "200px"], ["url", "https://...", "1fr"]], "rCheckAdd", { label: "", url: "" });
  const srcEl = document.getElementById("rSrc");
  const drawSrc = () => { srcEl.innerHTML = sources.length ? sources.map((s, i) => `<div class="ksitem"><a href="#t-${esc(s.id)}">${esc(s.title)}</a><button type="button" class="btn" data-rms="${i}">Unlink</button></div>`).join("") : `<div class="small">None. Use "Turn into recipe" on a story to link it.</div>`; };
  srcEl.onclick = e => { const t = e.target.closest("[data-rms]"); if (t) { sources.splice(+t.dataset.rms, 1); drawSrc(); } };
  drawSrc();
  const allText = () => [g("rS"), g("rT"), g("rN"), g("rF"), g("rD"), prompts.map(x => x.label + " " + x.text).join(" ")].join(" ");
  const piiCheck = () => { const w = piiWarnings(allText()).map(x => x.replace(" (this will be blocked)", "")); document.getElementById("rPii").innerHTML = w.length ? `<div class="notice">This recipe contains ${w.map(esc).join("; ")}. That's allowed for official addresses, but make sure none of it is a real person's details.</div>` : ""; };
  V.querySelectorAll("#rf input[type=text], #rf textarea").forEach(el => el.addEventListener("input", piiCheck)); piiCheck();
  const save = async status => {
    const m = document.getElementById("rMsg"); m.textContent = "";
    const ps = prompts.map(x => ({ label: (x.label || "").trim(), text: (x.text || "").trim() })).filter(x => x.text);
    const cs = checks.map(x => ({ label: (x.label || "").trim(), url: (x.url || "").trim() })).filter(x => x.label || x.url);
    if (g("rS").length < 3) { m.textContent = "Add a title."; return; }
    if (!g("rB")) { m.textContent = "Choose a space."; return; }
    if (!g("rT")) { m.textContent = "Add the task in one sentence."; return; }
    if (status === "published" && !ps.length) { m.textContent = "Add at least one prompt before publishing."; return; }
    if (cs.some(c => !c.label || !/^https:\/\/\S+$/.test(c.url))) { m.textContent = "Each source needs a name and a link that starts with https://."; return; }
    if (status === "published" && /^DRAFT, NOT TESTED/i.test(g("rS"))) { m.textContent = 'Test it first, then remove "DRAFT, NOT TESTED" from the title.'; return; }
    const row = { board_id: g("rB"), title: g("rS"), task: g("rT"), tags: parseTags(g("rH")), tools: picked("rTools"), prompts: ps, never_paste: g("rN"), how_to_check: cs, failure_points: g("rF"), deadline_warning: g("rD"), tested_tools: picked("rTested"), tested_on: g("rTd") || isoDay(new Date()), retest_due: g("rR") || null, status };
    const btn = document.getElementById(status === "draft" ? "rDraft" : "rPub"); busy(btn, true);
    let rid2 = editId, error;
    if (editId) ({ error } = await sb.from("posts").update(row).eq("id", editId));
    else { const r = await sb.from("posts").insert({ ...row, type: "RECIPE" }).select("id,status").single(); error = r.error; if (r.data) rid2 = r.data.id; }
    if (error) { m.textContent = errMsg(error); busy(btn, false); return; }
    if (editId) await sb.from("recipe_sources").delete().eq("recipe_id", editId);
    if (sources.length) { const r2 = await sb.from("recipe_sources").insert(sources.map(s => ({ recipe_id: rid2, story_id: s.id }))); if (r2.error) { m.textContent = "Saved, but the story links failed: " + errMsg(r2.error); busy(btn, false); return; } }
    pendingToast(status === "draft" ? "Recipe saved as a draft" : "Recipe published");
    location.hash = "t-" + rid2;
  };
  document.getElementById("rDraft").onclick = () => save("draft");
  document.getElementById("rPub").onclick = () => save("published");
}

// ================= notifications, metrics =================
async function loadNotifCount() {
  const bell = document.getElementById("bell"); if (!bell) return;
  if (!S.me) { bell.hidden = true; return; }
  bell.hidden = false;
  const { count } = await sb.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  const n = count || 0, dot = bell.querySelector(".dot");
  if (n > (S.lastNotif || 0)) { bell.classList.remove("pulse"); void bell.offsetWidth; bell.classList.add("pulse"); }
  S.lastNotif = n;
  dot.textContent = n > 99 ? "99+" : n; dot.hidden = !n;
  bell.setAttribute("aria-label", n ? `Notifications, ${n} unread` : "Notifications");
}
const TRY_TXT = { worked: "Worked for me", failed: "Didn't work for me" };
async function viewNotifications() {
  if (!S.me) { V.innerHTML = crumb("Notifications") + needLogin("Notifications"); return; }
  const { data, error } = await sb.from("notifications").select("id,kind,post_id,actor,detail,read_at,created_at").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  const list = data || [];
  const pids = [...new Set(list.map(n => n.post_id).filter(Boolean))], aids = [...new Set(list.map(n => n.actor).filter(Boolean))];
  const [ps, as] = await Promise.all([pids.length ? sb.from("post_feed").select("id,title").in("id", pids) : { data: [] }, aids.length ? sb.from("profiles").select("id,handle").in("id", aids) : { data: [] }]);
  const title = {}, who = {}; (ps.data || []).forEach(p => title[p.id] = p.title); (as.data || []).forEach(p => who[p.id] = p.handle);
  const row = n => {
    const t = `<a href="#t-${esc(n.post_id)}">${esc(title[n.post_id] || "a post")}</a>`, a = n.actor ? userLink(who[n.actor] || "[deleted member]") : "";
    const line = n.kind === "approved" ? `Your story ${t} was approved and is now live. <a href="#t-${esc(n.post_id)}">See it</a>.`
      : n.kind === "try" ? `${a} rated your recipe ${t}: <b>${esc(TRY_TXT[n.detail] || n.detail)}</b>.`
      : n.kind === "fork" ? `${a} reused ${t} as "${esc(n.detail)}".`
      : `${a} replied to ${t}: <span class="small">"${esc(n.detail)}${n.detail.length >= 140 ? "..." : ""}"</span>`;
    return `<div class="noterow${n.read_at ? "" : " unread"}"><span class="notedot" aria-hidden="true"></span><div>${line}<div class="small">${esc(ago(n.created_at))}${n.read_at ? "" : ' · <span class="sr">unread</span>New'}</div></div></div>`;
  };
  V.innerHTML = `${pageHead("Notifications", "Replies to your stories, and approvals. Kept for 120 days.")}
    ${list.length ? `<div class="card notelist">${list.map(row).join("")}</div>` : `<div class="empty">Nothing yet. When someone replies to your story, or a moderator approves it, you'll see it here.</div>`}`;
  if (list.some(n => !n.read_at)) { await sb.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null); loadNotifCount(); }
}
async function loadMetrics() {
  const box = document.getElementById("metrics"); if (!box || !isAdmin()) return;
  const { data, error } = await sb.rpc("admin_metrics");
  if (error || !data) { box.innerHTML = `<div class="small">Weekly figures unavailable: ${esc(error ? errMsg(error) : "no data")}</div>`; return; }
  const w = (data.weeks || []).slice().reverse();
  box.innerHTML = `<div class="box"><h2 class="h3">How it's going (admins only)</h2><div class="in">
    <div class="small" style="margin-bottom:8px">"Share" and "Browse" count clicks on the two buttons at the top of the home page. Visits are counted per page type per day. None of these figures store anything that identifies a person.</div>
    <table class="fl"><thead><tr><th scope="col">Week from</th><th scope="col">Recipe ratings</th><th scope="col">Posts</th><th scope="col">Replies</th><th scope="col">New members</th><th scope="col">Share clicks</th><th scope="col">Browse clicks</th><th scope="col">Visits</th></tr></thead>
    <tbody>${w.map(r => `<tr><td>${esc(r.week)}</td><td><b>${r.tries}</b></td><td>${r.posts}</td><td>${r.replies}</td><td>${r.members}</td><td>${r.share_clicks ?? 0}</td><td>${r.browse_clicks ?? 0}</td><td>${r.views}</td></tr>`).join("")}</tbody></table>
    ${(data.top_pages || []).length ? `<div class="small" style="margin-top:10px">Most visited, last 4 weeks: ${data.top_pages.map(t => `${esc(t.path)} (${t.views})`).join(", ")}</div>` : ""}
  </div></div>`;
}

// ================= my library =================
const LIB_COLS = "id,kind,source_post,published_post,type,title,body,prompt,notes,tool_key,tags,snapshot_at,created_at,updated_at";
const LIB_TYPES = ["STORY", "RECIPE"];
const PRIVATE_NOTE = `<b>Only you can see your library.</b> Even so, ${esc(APP_NAME)} doesn't store personal details here. Keep using placeholders like [my postcode] in your own prompts and notes.`;
let libTab = "all";
const isUpdated = (it, src) => !!(src && it.snapshot_at && new Date(src.updated_at) > new Date(it.snapshot_at));
function download(name, text, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function libMarkdown(items) {
  const fence = t => "```text\n" + t.replace(/```/g, "'''") + "\n```";
  return `# My ${APP_NAME} library\n\nExported ${day(new Date())}. ${items.length} items.\n\n` + items.map(i => [
    `## ${i.title}`,
    `- ${i.kind === "saved" ? `Saved from ${SITE()}#t-${i.source_post || "(removed)"}` : "My own prompt"}`,
    `- Type: ${TYPE_LABEL[i.type] || i.type}${i.tool_key ? `, tool: ${TOOLS[i.tool_key] || i.tool_key}` : ""}`,
    (i.tags || []).length ? `- Tags: ${i.tags.map(t => "#" + t).join(" ")}` : "",
    i.body ? `\n### Description\n\n${i.body}` : "",
    i.prompt ? `\n### Prompt\n\n${fence(i.prompt)}` : "",
    i.notes ? `\n### My notes\n\n${i.notes}` : ""
  ].filter(Boolean).join("\n")).join("\n\n---\n\n") + "\n";
}
async function viewLibrary() {
  if (!S.me) { V.innerHTML = crumb("My library") + needLogin("Your library"); return; }
  const { data, error } = await sb.from("library_items").select(LIB_COLS).order("updated_at", { ascending: false }).limit(300);
  if (error) throw error;
  const items = data || [];
  const ids = [...new Set(items.map(i => i.source_post).filter(Boolean))];
  const srcMap = {};
  if (ids.length) ((await sb.from("post_feed").select(FEED_COLS + ",updated_at").in("id", ids)).data || []).forEach(p => srcMap[p.id] = p);
  const counts = { all: items.length, saved: items.filter(i => i.kind === "saved").length, draft: items.filter(i => i.kind === "draft").length };
  const card = i => {
    const src = srcMap[i.source_post], upd = isUpdated(i, src);
    return `<article class="post"><div class="post-main">
      <div class="post-head"><span class="tg ${i.kind === "draft" ? "PENDING" : "SAMPLE"}">${i.kind === "draft" ? "My prompt" : "Saved"}</span>${typeTag(i.type)}${upd ? '<span class="tg STALE">Updated since you saved</span>' : ""}${i.kind === "saved" && !i.source_post ? '<span class="tg REMOVED">Original removed</span>' : ""}${i.published_post ? '<span class="tg WORKFLOW">Shared as a story</span>' : ""}<span class="when">Edited ${esc(ago(i.updated_at))}</span></div>
      <a class="post-title" href="#lib-${esc(i.id)}">${esc(i.title)}</a>
      ${i.body ? `<p class="post-sum">${esc(i.body.slice(0, 300))}</p>` : ""}
      <div class="post-foot">${i.tool_key ? `<span class="toolchip">${esc(TOOLS[i.tool_key] || i.tool_key)}</span>` : ""}${src ? `<span>From ${userLink(authorName(src))}</span>${src.type === "RECIPE" ? workedMeter(src) : ""}` : ""}${i.notes ? `<span>Your notes: ${esc(i.notes.slice(0, 60))}${i.notes.length > 60 ? "..." : ""}</span>` : ""}</div>
    </div></article>`;
  };
  const draw = () => {
    const list = items.filter(i => libTab === "all" || i.kind === libTab);
    V.innerHTML = `${pageHead("My library", "Recipes and stories you've saved, and your own prompts. Saving keeps your own editable copy, linked to the original so you see when we update it.", `<button class="btn" id="exJson">Export JSON</button><button class="btn" id="exMd">Export Markdown</button><a class="btn blue" href="#lib-new">New prompt</a>`)}
      <div class="notice dummy small">${PRIVATE_NOTE}</div>
      <div class="feedbar"><div class="tabs" role="tablist">${[["all", "All"], ["saved", "Saved"], ["draft", "My prompts"]].map(([k, l]) => `<a href="#" role="tab" data-lt="${k}" class="${libTab === k ? "on" : ""}" aria-selected="${libTab === k}">${l} <span class="small">${counts[k]}</span></a>`).join("")}</div></div>
      ${list.length ? `<div class="feed">${list.map(card).join("")}</div>` : `<div class="empty">${libTab === "draft" ? `No prompts of your own yet. <a href="#lib-new">Add one</a>.` : `Nothing saved yet. Press <b>Save to library</b> on any recipe or story you want to keep.`}</div>`}`;
    V.querySelectorAll("[data-lt]").forEach(a => a.onclick = e => { e.preventDefault(); libTab = a.dataset.lt; draw(); });
    document.getElementById("exJson").onclick = () => download("boring-bits-library.json", JSON.stringify(items.map(({ id, ...r }) => r), null, 2), "application/json");
    document.getElementById("exMd").onclick = () => download("boring-bits-library.md", libMarkdown(items), "text/markdown");
  };
  draw();
}
async function viewLibItem(id) {
  if (!S.me) { V.innerHTML = crumb("My library") + needLogin("Your library"); return; }
  const isNew = id === "new";
  const it = isNew ? { kind: "draft", type: "STORY", title: "", body: "", prompt: "", notes: "", tool_key: "", tags: [] }
    : (await sb.from("library_items").select(LIB_COLS).eq("id", id).maybeSingle()).data;
  if (!it) return viewNotFound("That library item doesn't exist, or it isn't yours.");
  const src = it.source_post ? (await sb.from("post_feed").select("*").eq("id", it.source_post).maybeSingle()).data : null;
  const upd = isUpdated(it, src);
  document.getElementById("crumbbar").innerHTML = `<a href="#library">My library</a>`;
  document.title = (isNew ? "New prompt" : it.title) + " · " + APP_NAME;
  V.innerHTML = `${pageHead(isNew ? "New prompt" : esc(it.title), it.kind === "saved"
      ? (src ? `Your copy of <a href="#t-${esc(src.id)}">${esc(src.title)}</a> by ${userLink(authorName(src))}. Edit it freely: the original doesn't change.` : "The original post has been removed. Your copy is still here.")
      : "A private prompt. Share it as a story when you've used it.", `<a class="btn" href="#library">Back to library</a>`)}
    <div class="notice dummy small">${PRIVATE_NOTE}</div>
    ${upd ? `<div class="okmsg trybar">This has been updated or re-tested since you saved it. <button type="button" class="btn" id="libRefresh">Replace my copy with the latest version</button><a href="#t-${esc(src.id)}">See the original</a></div>` : ""}
    ${it.published_post ? `<div class="okmsg">You shared this as <a href="#t-${esc(it.published_post)}">a story</a>.</div>` : ""}
    <form id="lf" novalidate><section class="card card-pad fsec">
     <div class="fgrid">
      ${fld("lT", "Title", `<input type="text" id="lT" maxlength="120" value="${esc(it.title)}">`, "", "full")}
      ${fld("lY", "Type", `<select id="lY">${LIB_TYPES.map(t => `<option value="${t}"${it.type === t ? " selected" : ""}>${TYPE_LABEL[t]}</option>`).join("")}</select>`)}
      ${fld("lTool", "AI tool", `<select id="lTool"><option value="">Not set</option>${Object.entries(TOOLS).map(([k, v]) => `<option value="${k}"${it.tool_key === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>`)}
     </div>
     ${fld("lB", "Description", `<textarea id="lB" maxlength="8000">${esc(it.body)}</textarea>`)}
     ${fld("lP", "Prompt", `<textarea id="lP" maxlength="8000" style="min-height:200px;font-family:ui-monospace,Menlo,monospace;font-size:14px">${esc(it.prompt)}</textarea>`)}
     ${fld("lN", "My notes <span class='small'>(private)</span>", `<textarea id="lN" maxlength="4000" placeholder="What you changed, what to try next.">${esc(it.notes)}</textarea>`)}
     ${fld("lH", "Tags", `<input type="text" id="lH" value="${esc((it.tags || []).map(t => "#" + t).join(" "))}" placeholder="#energy #letters">`)}
     <div id="lPii" class="small"></div>
     <div class="trybar"><button class="btn blue" type="submit" id="lSave">${isNew ? "Save prompt" : "Save"}</button>
      ${!isNew && it.kind === "draft" ? `<button type="button" class="btn" id="lPub">Share as a story</button>` : ""}
      ${!isNew ? `<button type="button" class="btn danger" id="lDel">Delete</button>` : ""}<span id="lMsg" role="status"></span></div>
    </section></form>`;
  const g = x => document.getElementById(x).value.trim();
  const out = (t, ok) => { const el = document.getElementById("lMsg"); el.className = ok ? "tries" : "err"; el.textContent = t; };
  const fromRecipe = it.kind === "saved" && src && src.type === "RECIPE";
  const scanText = () => fromRecipe ? g("lN") : [g("lT"), g("lB"), g("lP"), g("lN")].join(" ");
  const piiCheck = () => { const w = piiWarnings(scanText()); document.getElementById("lPii").innerHTML = w.length ? `<div class="notice">This may contain ${w.map(esc).join("; ")}. Use a placeholder like [my postcode] instead.</div>` : ""; };
  V.querySelectorAll("#lf input[type=text], #lf textarea").forEach(el => el.addEventListener("input", piiCheck));
  const payload = () => ({ title: g("lT"), type: g("lY"), tool_key: g("lTool"), body: g("lB"), prompt: g("lP"), notes: g("lN"), tags: parseTags(g("lH")) });
  const save = async () => {
    const row = payload();
    if (!row.title) { out("Add a title."); return null; }
    const blocked = blockedOnly(piiWarnings(scanText()));
    if (blocked) { out("Remove " + blocked + " first."); return null; }
    if (isNew) { const { data, error } = await sb.from("library_items").insert({ kind: "draft", ...row }).select("id").single(); if (error) { out(errMsg(error)); return null; } return data.id; }
    const { error } = await sb.from("library_items").update(row).eq("id", it.id); if (error) { out(errMsg(error)); return null; } return it.id;
  };
  document.getElementById("lf").onsubmit = async e => { e.preventDefault(); const b = document.getElementById("lSave"); busy(b, true); const nid = await save(); busy(b, false); if (!nid) return; if (isNew) { pendingToast("Prompt saved"); location.hash = "lib-" + nid; } else toast("Saved"); };
  const pub = document.getElementById("lPub");
  if (pub) pub.onclick = async () => { const nid = await save(); if (!nid) return; S.prefill = { libId: nid, ...payload() }; location.hash = "post"; };
  const del = document.getElementById("lDel");
  if (del) del.onclick = () => confirmTwice(del, async () => { const { error } = await sb.from("library_items").delete().eq("id", it.id); if (error) out(errMsg(error)); else location.hash = "library"; });
  const rf = document.getElementById("libRefresh");
  if (rf) rf.onclick = () => confirmTwice(rf, async () => {
    const { error } = await sb.from("library_items").update({ ...libCopy(src), snapshot_at: src.updated_at || new Date().toISOString() }).eq("id", it.id);
    if (error) out(errMsg(error)); else viewLibItem(it.id);
  });
}

// ================= auth =================
function viewLogin(mode = "login") {
  if (S.me) { location.hash = "me"; return; }
  const join = mode === "join";
  V.innerHTML = `${crumb(join ? "Join" : "Log in")}
  <div class="split"><div class="box"><h2 class="h3">${join ? "Create an account" : "Log in"}</h2><div class="in">
   <form id="af" novalidate>
    ${join ? `<label for="aH">Username</label><input type="text" id="aH" maxlength="20" autocomplete="username" placeholder="3 to 20 letters, numbers or _">
    <div class="hint">Shown on your posts. Don't use your real name if you'd rather not.</div>
    <label for="aP" style="display:block;margin-top:6px">About you <span class="small">(optional, shown on your posts)</span></label><input type="text" id="aP" maxlength="60" placeholder="e.g. Library volunteer, or helping my mum with forms">` : ""}
    <label for="aE" style="display:block;margin-top:6px">Email</label><input type="email" id="aE" autocomplete="email">${join ? `<div class="hint">Any email works. Your email is never shown.</div>` : ""}
    <label for="aW" style="display:block;margin-top:6px">Password</label><input type="password" id="aW" autocomplete="${join ? "new-password" : "current-password"}" minlength="8">
    ${join ? `<label style="display:block;margin-top:4px"><input type="checkbox" id="aR"> I'm 18 or over and I agree to the <a href="#terms">terms</a> and <a href="#rules">house rules</a>, including sharing my posts under CC BY 4.0. I've read the <a href="#privacy">privacy notice</a>.</label>` : ""}
    <div style="margin-top:8px"><button class="btn" type="submit">${join ? "Join" : "Log in"}</button></div>
    <div id="aMsg" role="alert" style="margin-top:6px"></div>
   </form>
   ${join ? `<div class="small" style="margin-top:6px">Already a member? <a href="#login">Log in</a></div>` : `<div class="small" style="margin-top:6px">New here? <a href="#join">Join</a> | <a href="#" id="forgot">Forgot password</a> | <a href="#" id="magic">Email me a login link</a></div>`}
  </div></div>
  <div class="box"><h2 class="h3">Why join?</h2><div class="in">Share how a free AI tool helped you with a boring job, say whether our recipes worked for you, save recipes and your own prompts to a private library, and follow the topics you care about.<br><br>You need to be 18 or over. We store your email to log you in and your posts to show them. Nothing is sold, and there are no adverts. See the <a href="#privacy">privacy notice</a>.</div></div></div>`;
  const out = (t, ok) => { const el = document.getElementById("aMsg"); el.className = ok ? "okmsg" : "err"; el.textContent = t; };
  const g = id => (document.getElementById(id) || {}).value?.trim() || "";
  document.getElementById("af").onsubmit = async e => {
    e.preventDefault();
    const email = g("aE"), pw = document.getElementById("aW").value;
    if (!/^\S+@\S+\.\S+$/.test(email)) return out("Enter a valid email address.");
    if (pw.length < 8) return out("Passwords need at least 8 characters.");
    if (join) {
      const handle = g("aH").toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(handle)) return out("Usernames are 3 to 20 letters, numbers or underscores.");
      if (!document.getElementById("aR").checked) return out("Please confirm you're 18 or over and agree to the terms and house rules.");
      const { data, error } = await sb.auth.signUp({ email, password: pw, options: { data: { handle, profession: g("aP") }, emailRedirectTo: SITE() } });
      if (error) return out(errMsg(error));
      if (data.session) { await loadMe(); await afterLogin(); }
      else out("Check your email for a link to confirm your account. The link brings you back to where you were.", true);
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password: pw });
      if (error) return out(errMsg(error));
      await loadMe(); await afterLogin();
    }
  };
  const fg = document.getElementById("forgot");
  if (fg) fg.onclick = async e => { e.preventDefault(); const email = g("aE"); if (!email) return out("Enter your email above first.");
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: SITE() + "#newpass" }); out(error ? errMsg(error) : "If that email has an account, a reset link is on its way.", !error); };
  const mg = document.getElementById("magic");
  if (mg) mg.onclick = async e => { e.preventDefault(); const email = g("aE"); if (!email) return out("Enter your email above first.");
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: SITE() } }); out(error ? errMsg(error) : "If that email has an account, a login link is on its way.", !error); };
}
async function afterLogin() {
  const back = recall("th-return"); remember("th-return", null);
  const pend = recall("th-pendtry"); remember("th-pendtry", null);
  if (pend && S.me) {
    const { error } = await sb.from("tries").upsert({ post_id: pend.post_id, user_id: S.me.id, result: pend.result, note: pend.note || "", tool_key: pend.tool_key || "" });
    pendingToast(error ? "We couldn't save your answer. " + errMsg(error) : "Your answer is recorded");
    location.hash = "t-" + pend.post_id; return;
  }
  if (back) pendingToast("Welcome back");
  location.hash = back || "index";
}
function viewNewPass() {
  V.innerHTML = `${crumb("Set a new password")}<div class="box"><h2 class="h3">New password</h2><div class="in"><label for="np">New password</label><input type="password" id="np" autocomplete="new-password" minlength="8">
   <div style="margin-top:6px"><button class="btn" id="npGo">Save</button> <span id="npMsg" role="alert"></span></div></div></div>`;
  document.getElementById("npGo").onclick = async () => { const v = document.getElementById("np").value; const m = document.getElementById("npMsg");
    if (v.length < 8) { m.className = "err"; m.textContent = "At least 8 characters."; return; }
    const { error } = await sb.auth.updateUser({ password: v }); m.className = error ? "err" : "tries"; m.textContent = error ? errMsg(error) : "Saved. You're logged in."; };
}

// ================= settings / display =================
function displayBox() {
  const d = currentDisplay(), font = d.font || "tech";
  return `<div class="box"><h2 class="h3">Text &amp; display</h2><div class="in" role="radiogroup" aria-label="Text style">
    <label style="display:block"><input type="radio" name="font" value="tech"${font === "tech" ? " checked" : ""}> <span style="font-family:Inter;font-size:15px">Standard: Inter, with Newsreader headings</span></label>
    <label style="display:block;margin-top:6px"><input type="radio" name="font" value="retro"${font === "retro" ? " checked" : ""}> <span style="font-family:Fixed6x10;font-size:10px">Retro: the original 6x10 pixel font</span></label>
    <label style="display:block;margin-left:22px"><input type="checkbox" id="x2"${d.x2 ? " checked" : ""}> Double the pixel size</label>
    <label style="display:block;margin-top:6px"><input type="radio" name="font" value="read"${font === "read" ? " checked" : ""}> <span style="font-family:Atkinson;font-size:16px">Readable: Atkinson Hyperlegible, 16px</span></label>
    <label style="display:block;margin-top:6px"><input type="radio" name="font" value="large"${font === "large" ? " checked" : ""}> <span style="font-family:Atkinson;font-size:20px">Large &amp; high contrast: 20px, black on white</span></label>
    <div class="small" style="margin-top:6px">Atkinson Hyperlegible was designed by the Braille Institute for readers with low vision. ${S.me ? "Your choice is saved to your account." : "Your choice is saved in this browser. Log in to keep it on every device."}</div>
  </div></div>`;
}
function bindDisplay() {
  const save = () => { const f = (V.querySelector('input[name="font"]:checked') || {}).value || "tech"; saveDisplay({ font: f, x2: document.getElementById("x2").checked }); };
  V.querySelectorAll('input[name="font"], #x2').forEach(el => el.onchange = save);
}
function viewDisplay() { V.innerHTML = crumb("Text & display") + displayBox(); bindDisplay(); }
async function viewMe() {
  if (!S.me) { V.innerHTML = crumb("Settings") + displayBox() + needLogin("Account settings"); bindDisplay(); return; }
  const rep = (await sb.from("member_directory").select("rep").eq("id", S.me.id).maybeSingle()).data;
  const prefs = S.me.prefs || {};
  V.innerHTML = `${crumb("Settings")}
  <div class="split">
   <div class="box"><h2 class="h3">Your profile</h2><div class="in">
     Rank: <b>${rankOf(rep ? rep.rep : 0, S.me.role)}</b> (reputation ${rep ? rep.rep : 0})<br><span class="small">You earn 1 reputation for each published story. Links in stories unlock at 5.</span><br><br>
     <label for="sH">Username</label><input type="text" id="sH" maxlength="20" value="${esc(S.me.handle)}">
     <label for="sP" style="display:block;margin-top:6px">About you</label><input type="text" id="sP" maxlength="60" value="${esc(S.me.profession)}" placeholder="e.g. Library volunteer">
     <label style="display:block;margin-top:6px"><input type="checkbox" id="sD"${prefs.digest ? " checked" : ""}> Send me a weekly email digest of the spaces I follow</label>
     <div class="small">Digest emails start once the mail service is connected.</div>
     <div style="margin-top:6px"><button class="btn" id="sGo">Save</button> <span id="sMsg" role="alert"></span></div>
   </div></div>
   ${displayBox()}
  </div>
  <div class="box"><h2 class="h3">Following</h2><div class="in">${S.myFollows.length ? S.myFollows.map(f => f.kind === "tag" ? `<a class="ht" href="#tag-${esc(f.target)}">#${esc(f.target)}</a>` : `<a class="ht" href="${spaceHref(f.target)}">${esc(board(f.target) ? spaceName(board(f.target)) : f.target)}</a>`).join(" ") : "Nothing yet."}</div></div>
  <div class="box"><h2 class="h3">Your data</h2><div class="in">
    <button class="btn" id="exp">Show a copy of my data</button> <button class="btn danger" id="delAcc">Delete my account</button>
    <div class="small" style="margin-top:4px">Deleting removes your login, profile, library, notifications, likes, recipe ratings and follows. Your stories stay up as "[deleted member]" unless you delete them first.</div>
    <pre id="expOut" class="small" style="margin-top:6px"></pre></div></div>`;
  bindDisplay();
  document.getElementById("sGo").onclick = async () => {
    const m = document.getElementById("sMsg"), h = document.getElementById("sH").value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(h)) { m.className = "err"; m.textContent = "Usernames are 3 to 20 letters, numbers or underscores."; return; }
    const { error } = await sb.from("profiles").update({ handle: h, profession: document.getElementById("sP").value.trim(), prefs: { ...prefs, digest: document.getElementById("sD").checked } }).eq("id", S.me.id);
    m.className = "err"; m.textContent = error ? (/duplicate|unique/i.test(error.message) ? "That username is taken." : errMsg(error)) : "";
    if (!error) { await loadMe(); toast("Settings saved"); }
  };
  document.getElementById("exp").onclick = async () => {
    const id = S.me.id;
    const [po, re, tr, li, lb] = await Promise.all([sb.from("posts").select("*").eq("author", id), sb.from("replies").select("*").eq("author", id), sb.from("tries").select("*").eq("user_id", id), sb.from("likes").select("*").eq("user_id", id), sb.from("library_items").select("*").eq("owner", id)]);
    document.getElementById("expOut").textContent = JSON.stringify({ account: { email: S.session.user.email, ...S.me }, posts: po.data, replies: re.data, recipe_ratings: tr.data, likes: li.data, follows: S.myFollows, library: lb.data }, null, 2);
  };
  const da = document.getElementById("delAcc");
  da.onclick = () => confirmTwice(da, async () => { const { error } = await sb.rpc("delete_my_account"); if (error) { da.textContent = errMsg(error); return; } await sb.auth.signOut(); location.hash = "index"; });
}

// ================= people =================
async function viewProfile(handle) {
  const { data: u } = await sb.from("member_directory").select("*").eq("handle", handle).maybeSingle();
  if (!u) return viewNotFound("No member with that name.");
  const [posts, wd, tr] = await Promise.all([fetchPosts(publishedPosts().eq("author", u.id)), sb.from("board_mods").select("board_id").eq("user_id", u.id), sb.from("tries").select("post_id", { count: "exact", head: true }).eq("user_id", u.id)]);
  const wards = wd.data || [], triedN = tr.count || 0;
  const active = [...new Set(posts.map(p => p.board_id))].map(board).filter(Boolean);
  const canAdmin = isAdmin() && u.role !== "admin";
  V.innerHTML = `<div class="grid2"><div class="colmain">
   <section class="card card-pad" style="margin-bottom:16px">
    <div class="post-head" style="align-items:flex-start;gap:16px"><img class="av" src="${identicon(u.id, u.handle)}" width="72" height="72" alt=""><div style="min-width:0"><h1 class="h-page">${esc(u.handle)}</h1>
      <div class="small" style="margin-top:2px">${esc(u.profession || "")}</div>
      <div class="trybar" style="margin-top:6px"><span class="small">Member since ${esc(day(u.created_at))} · ${rankOf(u.rep, u.role)}</span></div></div></div>
    <div class="stats3"><div><b>${posts.length}</b><span>Posts</span></div><div><b>${triedN}</b><span>Recipes rated</span></div><div><b>${u.rep}</b><span>Reputation</span></div></div>
    ${active.length ? `<div class="small" style="margin-bottom:6px">Posts in</div>${active.map(b => `<a class="ht" href="${spaceHref(b.id)}">${esc(spaceName(b))}</a>`).join("")}` : ""}
    ${wards.length ? `<div class="small" style="margin:8px 0 6px">Space moderator for</div>${wards.map(w => `<a class="ht" href="${spaceHref(w.board_id)}">${esc(board(w.board_id) ? spaceName(board(w.board_id)) : w.board_id)}</a>`).join("")}` : ""}
    ${canAdmin ? `<div class="notice trybar small" style="margin-top:12px">Admin tools: <button class="btn danger" id="ban">Suspend</button><button class="btn" id="unban">Restore</button><select id="wardB" style="width:auto" aria-label="Space to moderate">${S.boards.map(b => `<option value="${esc(b.id)}">${esc(spaceName(b))}</option>`).join("")}</select><button class="btn" id="wardAdd">Make space moderator</button><button class="btn" id="wardDel">Remove as moderator</button><span id="admMsg"></span></div>` : ""}
   </section>
   <h2 style="font-size:22px;margin:8px 0 0">Posts</h2>${feed(sorted(posts, "new"), true, "No published posts yet.")}
  </div>
  <aside class="colrail rail"><div class="card card-pad"><h2 class="h3">Reputation</h2><div class="small">1 for each published story. Ranks: New member (0 to 4), Member (5 to 19), Regular (20 to 59), Trusted member (60 and over). Admins show as Admin.</div></div></aside></div>`;
  const am = t => { const el = document.getElementById("admMsg"); if (el) el.textContent = t; };
  const call = async (fn, args) => { const { error } = await sb.rpc(fn, args); am(error ? errMsg(error) : "Done."); };
  const bb = id => document.getElementById(id);
  if (bb("ban")) {
    bb("ban").onclick = () => call("set_ban", { target_handle: u.handle, ban: true });
    bb("unban").onclick = () => call("set_ban", { target_handle: u.handle, ban: false });
    bb("wardAdd").onclick = () => call("set_board_mod", { target_handle: u.handle, board: bb("wardB").value, make: true });
    bb("wardDel").onclick = () => call("set_board_mod", { target_handle: u.handle, board: bb("wardB").value, make: false });
  }
}
async function viewSearch() {
  const all = await fetchPosts(publishedPosts());
  V.innerHTML = `${crumb("Search")}<div class="box"><div class="in" style="padding-top:18px"><label class="sr" for="q">Search</label><input type="text" id="q" placeholder="Words or #hashtags, e.g. parking appeal #complaint">
  <div style="margin-top:6px"><label for="qt">Type:</label> <select id="qt" style="width:auto"><option value="">Any</option>${TYPES.map(t => `<option value="${t}">${TYPE_LABEL[t]}</option>`).join("")}</select></div></div></div><div id="res"></div>`;
  const run = () => {
    const raw = document.getElementById("q").value.toLowerCase(), ty = document.getElementById("qt").value;
    const tags = (raw.match(/#[a-z0-9-]+/g) || []).map(cleanTag), words = raw.replace(/#[a-z0-9-]+/g, " ").split(/\s+/).filter(Boolean);
    const r = all.filter(p => (!ty || p.type === ty) && tags.every(t => (p.tags || []).includes(t)) && words.every(w => [p.title, p.task, p.body, (p.tags || []).join(" ")].join(" ").toLowerCase().includes(w)));
    document.getElementById("res").innerHTML = feed(sorted(r), true, "No posts match that search.");
  };
  if (S.pendingQuery) { document.getElementById("q").value = S.pendingQuery; S.pendingQuery = ""; }
  document.getElementById("q").oninput = run; document.getElementById("qt").onchange = run; run();
}

// ================= moderation =================
async function viewMod() {
  if (!S.isMod) return viewNotFound();
  const [pend, reps, drafts] = await Promise.all([
    sb.from("post_feed").select(FEED_COLS + ",body").eq("status", "pending").order("created_at"),
    sb.from("reports").select("id,reason,created_at,post_id,reply_id,status,posts(title,board_id),replies(body,post_id)").eq("status", "open").order("created_at"),
    isAdmin() ? sb.from("post_feed").select("id,title,board_id,created_at,type").eq("status", "draft").order("created_at") : Promise.resolve({ data: [] })
  ]);
  const pp = (pend.data || []).filter(p => isModOf(p.board_id));
  const rc = i => i % 2 ? "r2" : "r1";
  V.innerHTML = `${crumb("Moderation")}<div id="metrics"></div>
  <table class="fl"><tr><th colspan="3">Waiting for approval (${pp.length})</th></tr>
  ${pp.map((p, i) => `<tr><td class="${rc(i)}">${typeTag(p.type)}<a class="b" href="#t-${esc(p.id)}">${esc(p.title)}</a><br><span class="small">${userLink(p.author_handle)} in /${esc(p.board_id)}, ${esc(when(p.created_at))}${HELD.includes(p.board_id) ? " · always checked in this space" : ""}</span><pre class="small">${esc((p.body || "").slice(0, 300))}</pre></td>
   <td class="${rc(i)} ctr"><button class="btn" data-ap="${esc(p.id)}">Approve</button></td><td class="${rc(i)} ctr"><button class="btn danger" data-rm="${esc(p.id)}">Take down</button></td></tr>`).join("") || `<tr><td class="r1" colspan="3">Nothing waiting.</td></tr>`}
  </table>
  ${isAdmin() ? `<table class="fl"><tr><th colspan="2">Draft recipes (${(drafts.data || []).length})</th></tr>
  ${(drafts.data || []).map((p, i) => `<tr><td class="${rc(i)}"><a class="b" href="#t-${esc(p.id)}">${esc(p.title)}</a><br><span class="small">/${esc(p.board_id)}, started ${esc(day(p.created_at))}</span></td><td class="${rc(i)} ctr"><a class="btn" href="#recipe-edit-${esc(p.id)}">Edit</a></td></tr>`).join("") || `<tr><td class="r1" colspan="2">No drafts.</td></tr>`}
  </table>` : ""}
  <table class="fl"><tr><th colspan="3">Open reports (${(reps.data || []).length})</th></tr>
  ${(reps.data || []).map((r, i) => `<tr><td class="${rc(i)}">"${esc(r.reason)}"<br><span class="small">${r.post_id ? `Post: <a href="#t-${esc(r.post_id)}">${esc(r.posts ? r.posts.title : "")}</a>` : `Reply on <a href="#t-${esc(r.replies ? r.replies.post_id : "")}">this post</a>: ${esc(r.replies ? r.replies.body.slice(0, 120) : "")}`} | ${esc(when(r.created_at))}</span></td>
   <td class="${rc(i)} ctr"><button class="btn danger" data-act="${esc(r.id)}">Take down</button></td><td class="${rc(i)} ctr"><button class="btn" data-dis="${esc(r.id)}">Dismiss</button></td></tr>`).join("") || `<tr><td class="r1" colspan="3">No open reports.</td></tr>`}
  </table>
  <div class="small">Keep a short note of serious reports and what you did. Under the Online Safety Act you should be able to show how you handle illegal content and complaints.</div>`;
  const re = () => viewMod().then(loadMetrics);
  V.querySelectorAll("[data-ap]").forEach(b => b.onclick = async () => { await sb.from("posts").update({ status: "published" }).eq("id", b.dataset.ap); re(); });
  V.querySelectorAll("[data-rm]").forEach(b => b.onclick = async () => { await sb.from("posts").update({ status: "removed" }).eq("id", b.dataset.rm); re(); });
  V.querySelectorAll("[data-dis]").forEach(b => b.onclick = async () => { await sb.from("reports").update({ status: "dismissed" }).eq("id", b.dataset.dis); re(); });
  V.querySelectorAll("[data-act]").forEach(b => b.onclick = async () => {
    const r = (reps.data || []).find(x => x.id === b.dataset.act);
    if (r.post_id) await sb.from("posts").update({ status: "removed" }).eq("id", r.post_id);
    else await sb.from("replies").update({ status: "removed" }).eq("id", r.reply_id);
    await sb.from("reports").update({ status: "actioned" }).eq("id", r.id); re();
  });
}

// ================= static pages =================
function viewBadge() {
  const site = SITE();
  const code = `<a href="${site}"><img src="${site.replace(/[^/]*$/, "")}badge.png" width="88" height="31" alt="Featured on ${APP_NAME}"></a>`;
  V.innerHTML = `${crumb("Get a badge")}<div class="box"><h2 class="h3">Featured on ${esc(APP_NAME)}</h2><div class="in">
    <img src="badge.png" width="88" height="31" alt="Featured on ${esc(APP_NAME)} badge" style="image-rendering:pixelated"><br><br>
    Paste this into your own site to link back to ${esc(APP_NAME)}:
    <textarea id="bc" readonly style="min-height:60px">${esc(code)}</textarea>
    <button class="btn" id="cp">Copy</button> <span id="cpm" class="small"></span></div></div>`;
  document.getElementById("cp").onclick = async () => { try { await navigator.clipboard.writeText(code); document.getElementById("cpm").textContent = "Copied."; } catch (_) { document.getElementById("bc").select(); document.getElementById("cpm").textContent = "Press Ctrl+C to copy."; } };
}
function viewFaq() {
  const qa = [
    ["Who is this for?", `Adults in the UK who want help with everyday paperwork using free AI tools such as ChatGPT, Microsoft Copilot, Google Gemini and Claude. It's also for people who help others: library volunteers, support workers and family members.`],
    ["What's the difference between a story and a recipe?", `A story is a member saying what they needed to do, which tool they used, roughly what they typed and what happened. A recipe is a step-by-step guide that we write from the best stories and test ourselves. Recipes have prompts you can copy, what never to paste, and links to official sources to check the answer.`],
    ["Is this advice?", `No. ${esc(NOT_ADVICE)} AI tools make mistakes. Always check the answer with the official sources each recipe links to, such as GOV.UK, Citizens Advice or the relevant ombudsman.`],
    ["What does \"Worked for me\" do?", `It tells us and other readers that the recipe worked when you tried it. If it didn't, tell us which tool you used and what went wrong, so we can fix it. Recipes are sorted by how many people say they worked.`],
    ["What does \"May be out of date\" mean?", `Every recipe has a re-test date. AI tools change fast. Once that date passes, the recipe shows this label until we test it again.`],
    ["What shouldn't I paste into an AI tool?", `Your full name and address, National Insurance number, bank or card details, passwords, and reference numbers you don't need. Each recipe lists what to keep out. See <a href="#safe-sharing">What you can safely share</a>.`],
    ["Why was my story held?", `A moderator checks the first three stories from each new member. After that yours go live straight away, except in /money, /health-admin and /complaints, where every story is checked. Everyone's posts pass an automatic check for personal details, and anyone can report a post.`],
    ["Can I get medical advice here?", `No. /health-admin is only for appointments, forms and NHS paperwork. For health worries, contact your GP or NHS 111. In an emergency, call 999.`],
    ["The text is hard to read.", `Open <a href="#display">Text &amp; display</a> and pick Readable or Large &amp; high contrast.`]
  ];
  V.innerHTML = `${crumb("FAQ")}<table class="fl"><tr><th>Frequently asked questions</th></tr>${qa.map(([q, a], i) => `<tr><td class="${i % 2 ? "r2" : "r1"}"><b>${q}</b><br>${a}</td></tr>`).join("")}</table>`;
}
// ================= legal and guidance pages =================
const OPERATOR = { name: "Ahmad Ismail", email: "ahmadismailcv@gmail.com" }; // who runs the site and how to contact them (shown publicly on purpose)
const LAST_UPDATED = "20 November 2026";
const opName = () => OPERATOR.name ? esc(OPERATOR.name) : `<mark>[operator name: add before launch]</mark>`;
const opEmail = () => OPERATOR.email ? `<a href="mailto:${esc(OPERATOR.email)}">${esc(OPERATOR.email)}</a>` : `<mark>[contact email: add before launch]</mark>`;
function docPage(title, intro, sections) {
  V.innerHTML = `${pageHead(title, intro)}
   <nav class="doc-toc small" aria-label="On this page">${sections.map(([h], i) => `<a href="#" data-sec="${i}">${esc(h)}</a>`).join("")}</nav>
   <article class="card card-pad doc">${sections.map(([h, b], i) => `<section id="sec-${i}"><h2>${esc(h)}</h2>${b}</section>`).join("")}
   <p class="small" style="margin-top:20px">Last updated ${LAST_UPDATED}.</p></article>`;
  V.querySelectorAll("[data-sec]").forEach(a => a.onclick = e => { e.preventDefault(); const t = document.getElementById("sec-" + a.dataset.sec); t.scrollIntoView({ behavior: "smooth" }); t.querySelector("h2").setAttribute("tabindex", "-1"); t.querySelector("h2").focus({ preventScroll: true }); });
}
const notAdviceSec = ["Not advice", `<p><b>${esc(NOT_ADVICE)}</b> Stories are members' own experiences. Recipes are our best attempt at a reliable method, tested on the dates shown, but AI tools change and make mistakes. Check every answer against the official sources linked, and get proper advice for anything important, for example from Citizens Advice, a solicitor, your GP or NHS 111.</p>`];
function viewRules() {
  docPage("House rules", "Short version: share what really happened, keep personal details out, and be decent to each other.", [
    ["Who it's for", `<p>Adults (18 and over) in the UK who use, or want to use, free AI tools for everyday jobs, and the people who help them. Anyone can read. Anyone 18 or over can join.</p>`],
    ["Share what really happened", `<p>Say what you needed to do, which tool you used and what happened, including what went wrong. Don't invent results.</p>`],
    ["Nothing personal, anywhere", `<p>Everything here is public. Leave out names, addresses, postcodes, phone numbers, email addresses, bank and card details, National Insurance numbers, and account or reference numbers, about you or anyone else. Write [my postcode] or [account number] instead. The site blocks the most common ones automatically. See <a href="#safe-sharing">What you can safely share</a>.</p>`],
    ["No diagnosis or treatment advice", `<p>/health-admin is for appointments, forms and paperwork only. Don't post or ask for medical diagnosis or treatment advice.</p>`],
    ["Be honest about interests", `<p>If you sell, built or are paid to promote a tool you mention, say so. No selling, spam or affiliate links.</p>`],
    ["Respect people", `<p>No harassment, hate, threats, scams or illegal content of any kind.</p>`],
    ["Moderation", `<p>Press Report on any post or reply that breaks these rules. Moderators can hold or take down posts and suspend accounts. The first three stories from each new member, and every story in /money, /health-admin and /complaints, are checked before they go live. To complain about a decision, see <a href="#complaints">Reports and complaints</a>.</p>`],
    notAdviceSec
  ]);
}
function viewSafeSharing() {
  docPage("What you can safely share", "Use this checklist before you post, upload a screenshot or paste anything into an AI tool.", [
    ["Share freely", `<ul><li>What you needed to do, in general terms.</li><li>Which AI tool you used.</li><li>Roughly what you typed, once anything personal is taken out.</li><li>What the AI got right and wrong, and what you checked.</li></ul>`],
    ["Swap for placeholders", `<table class="fl small"><thead><tr><th scope="col">Real</th><th scope="col">Write instead</th></tr></thead><tbody>
      <tr><td>Your name, or anyone else's</td><td>[my name], [my landlord]</td></tr>
      <tr><td>Address and postcode</td><td>[my address], [my postcode]</td></tr>
      <tr><td>Phone number, email</td><td>[my phone], [my email]</td></tr>
      <tr><td>Bank, sort code, card</td><td>[account number], [sort code]</td></tr>
      <tr><td>National Insurance number</td><td>[NI number]</td></tr>
      <tr><td>Account or reference numbers</td><td>[reference number]</td></tr>
      <tr><td>Amounts and dates</td><td>Fine to include if they don't identify you</td></tr></tbody></table>`],
    ["Screenshots", `<ul><li>Crop to the part that matters.</li><li>Check for your name, address, email previews, account numbers and profile photos.</li><li>We resize images and remove hidden metadata such as location, but we can't read what's in the picture. You're responsible for what it shows.</li></ul>`],
    ["What never to paste into an AI tool", `<ul><li>Passwords, PINs and security codes.</li><li>Full bank or card details.</li><li>Your National Insurance number or passport number.</li><li>Anything about someone else that they wouldn't want shared.</li></ul><p>Free AI tools may store what you type and use it to improve their service. Check the tool's own settings and privacy notice.</p>`],
    ["If you make a mistake", `<p>Delete the post straight away, or press Report on it so a moderator can take it down. If you shared bank or card details, contact your bank.</p>`]
  ]);
}
function viewTerms() {
  docPage("Terms of use", `The agreement between you and ${esc(APP_NAME)}. Plain English, kept short.`, [
    ["Who runs it", `<p>${esc(APP_NAME)} is run by ${opName()} as an independent, non-commercial site. Contact: ${opEmail()}.</p>`],
    ["Your account", `<p>You must be 18 or over. Keep your login to yourself. You're responsible for what you post from your account. You can delete your account at any time in <a href="#me">Settings</a>.</p>`],
    ["What you post and the licence", `<p>You keep the copyright in what you post. By posting, you license it to everyone under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">Creative Commons Attribution 4.0 (CC BY 4.0)</a>, so others can reuse it with credit to you. We may use stories to write recipes, and we credit and link the stories we use. Only post material you have the right to share. Items in your private library aren't published.</p>`],
    ["Rules", `<p>Follow the <a href="#rules">house rules</a>. In particular, never post personal details about you or anyone else.</p>`],
    notAdviceSec,
    ["Moderation, reports and complaints", `<p>We can hold, take down or restrict content, and suspend or close accounts, if they break these terms or the house rules, or if the law requires it. We'll explain why where we can. To report content, press Report on it. To complain, including about a moderation decision, see <a href="#complaints">Reports and complaints</a>.</p>`],
    ["Online safety", `<p>We take steps to protect users from illegal content, as the Online Safety Act 2023 requires: automatic checks, moderation before publishing for new members and sensitive spaces, a Report button on every post and reply, and a complaints route.</p><p><mark>TODO before launch: add a summary of the Online Safety Act illegal content risk assessment here (risks found, and what we do about each).</mark></p>`],
    ["No guarantees", `<p>Stories and recipes are provided as they are. They may be wrong, out of date or unsuitable for your situation. ${esc(APP_NAME)} is provided without any warranty, and we aren't liable for losses from using content posted here, except where the law doesn't allow us to exclude that liability.</p>`],
    ["Changes", `<p>We may update these terms. If a change matters, we'll say so on the site before it takes effect.</p>`],
    ["Law", `<p>These terms are governed by the law of England and Wales.</p>`]
  ]);
}
function viewComplaints() {
  docPage("Reports and complaints", "How to report a post, and how to complain if you're unhappy with us.", [
    ["Report a post or reply", `<p>Press <b>Report</b> under any post or reply and say what's wrong. You need to be logged in. A moderator looks at every report, usually within 2 working days, and takes content down if it breaks the <a href="#rules">house rules</a> or the law.</p>`],
    ["Something urgent or illegal", `<p>If content puts someone in danger, contact the police first (999 in an emergency). Then report it here, or email ${opEmail()} with a link to the post.</p>`],
    ["Complain about a decision", `<p>If we took down your post, held it, or suspended your account and you think we got it wrong, email ${opEmail()}. Say which post or account, and why. We'll reply within 10 working days and explain what we decided.</p>`],
    ["Personal data", `<p>If you think your personal details have been posted, report the post and email ${opEmail()}. You can also complain to the <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener">Information Commissioner's Office</a>.</p>`],
    ["If you're not happy with our answer", `<p>Online safety complaints can also go to Ofcom, the online safety regulator. See <a href="https://www.ofcom.org.uk/online-safety" target="_blank" rel="noopener">Ofcom: online safety</a>.</p>`]
  ]);
}
function viewPrivacy() {
  docPage("Privacy notice", `What ${esc(APP_NAME)} collects, why, and what you can do about it.`, [
    ["Who is responsible", `<p>${opName()} is the data controller for ${esc(APP_NAME)}. Contact: ${opEmail()}.</p>`],
    ["What we collect", `<ul><li><b>Account:</b> your email address and password (stored as a secure hash), your username and, if you give it, a short line about you.</li><li><b>What you do:</b> your stories, screenshots, replies, likes, recipe ratings, follows, reports, library items and display settings.</li><li><b>Notifications</b> about activity on your posts, kept for 120 days.</li><li><b>Counts:</b> one number per page type per day, and a count of clicks on the two home page buttons. No cookies, IP addresses or anything that identifies you is stored for these.</li></ul>`],
    ["Why, and the lawful basis", `<ul><li>To run your account and show your posts: legitimate interests in running a community you've chosen to join.</li><li>To keep the site safe: moderation, reports and automatic checks for personal details.</li><li>Weekly digest emails, only if you switch them on: consent, which you can withdraw in Settings.</li></ul><p>We don't sell data, show adverts or use your content to train AI models.</p>`],
    ["Who can see what", `<p><b>Public:</b> your username, the line about you, your posts, replies and recipe ratings.</p><p><b>Private:</b> your email address, display settings, library, follows, notifications and reports.</p>`],
    ["AI tools you use", `<p>We don't send anything you type here to an AI tool. When you use ChatGPT, Copilot, Gemini or Claude yourself, that company's own privacy notice applies.</p>`],
    ["Where it's stored and who processes it", `<p>Data is stored by Supabase in its London (UK) region. The website is served by a hosting provider, and, once switched on, emails are sent by an email delivery service. These providers process data only to run the service.</p>`],
    ["How long we keep it", `<p>Until you delete your account. When you do, your login, profile, library, notifications, likes, ratings and follows are deleted. Stories you didn't delete stay up as "[deleted member]". Notifications are deleted after 120 days. Daily counts are deleted after about 13 months.</p>`],
    ["Your rights", `<p>You can see a copy of your data, correct your profile and delete your account at any time from <a href="#me">Settings</a>. You can also ask for access, correction, deletion or restriction, or object to processing, by contacting ${opEmail()}. If you're unhappy with how we've handled your data, you can complain to the <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener">Information Commissioner's Office</a>.</p>`],
    ["Cookies and browser storage", `<p>We store your login session and display choice in your browser so the site works. When you log in from a recipe, we also keep the page you were on, and any answer you gave before logging in, for up to a day. There are no advertising, tracking or analytics cookies, so there's no cookie banner.</p>`],
    ["Children", `<p>${esc(APP_NAME)} is for adults. You must be 18 or over to join.</p>`]
  ]);
}
function viewAccessibility() {
  docPage("Accessibility statement", `We want everyone to be able to use ${esc(APP_NAME)}.`, [
    ["How accessible the site is", `<p>We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. We test every page with an automated checker (axe-core) and fix what it finds, and the site can be used with a keyboard alone.</p>`],
    ["Ways to adjust the site", `<ul><li><a href="#display">Text &amp; display</a> offers a Readable mode with an easy-to-read font, and a Large &amp; high-contrast mode.</li><li>You can zoom to 200% without losing content, and the layout works on phones.</li><li>Every recipe has a print button that gives a clean one-page copy.</li><li>Press <kbd>/</kbd> to jump to any space, and use Back and Forward in the top bar or Alt and the arrow keys.</li></ul>`],
    ["Known limitations", `<ul><li>Screenshots in posts are uploaded by members and usually have no text description.</li><li>Automated testing finds many but not all problems. We haven't yet had a full manual audit with assistive-technology users.</li><li>News headlines link to other organisations' sites, which have their own accessibility.</li></ul>`],
    ["Reporting a problem", `<p>If something doesn't work for you, contact ${opEmail()} and say which page and what happened. We'll aim to reply within 5 working days.</p>`]
  ]);
}
function viewAbout() {
  docPage(`About ${esc(APP_NAME)}`, esc(TAGLINE), [
    ["Why it exists", `<p>Free AI tools can help with the boring bits of life: bills, letters, complaints and forms. But most people don't know what to type, what to keep private, or how to check the answer. Here, members share what worked for them, and we turn the best into tested, step-by-step recipes.</p>`],
    ["Who runs it", `<p>${esc(APP_NAME)} is run by ${opName()} in a personal capacity. It's independent and non-commercial: no adverts, no data sales, no paid placements. It isn't connected to any AI company.</p>`],
    ["How it works", `<ul><li><b>Stories</b> come from members: what they needed to do, the tool, roughly what they typed, and what happened.</li><li><b>Recipes</b> are written and tested by us. Each shows the prompts, what never to paste, how to check the answer, and when it was last tested.</li><li>Readers say whether a recipe worked for them, so the best rise to the top.</li></ul>`],
    notAdviceSec,
    ["Get involved", `<p><a href="#join">Join</a> and share one thing AI helped you with. If you try a recipe, say whether it worked.</p>`]
  ]);
}
function viewNotFound(msg) { V.innerHTML = crumb("") + `<div class="notice">${esc(msg || "That page doesn't exist.")}</div>`; }

// ================= router & history =================
async function route() {
  const h = (location.hash.slice(1) || "index");
  if (h.startsWith("access_token") || h.startsWith("error")) return; // supabase handles auth fragments
  if (h === "join" || h === "login") remember("th-return", lastPage && !/^(index|me|newpass|notifications)$/.test(lastPage) ? lastPage : null);
  else if (h !== "newpass") lastPage = h;
  setStatus(""); renderShell(); loadNotifCount();
  clearTimeout(loadTimer); loadTimer = setTimeout(showSkeleton, 150);
  try { sb.rpc("track_view", { p: location.hash || "#index" }).then(() => {}, () => {}); } catch (_) { }
  try {
    if (h === "index") await viewIndex();
    else if (h === "recipes") await viewRecipes();
    else if (h === "recipe-new") await viewRecipeForm(null, null);
    else if (h.startsWith("recipe-edit-")) await viewRecipeForm(h.slice(12), null);
    else if (h.startsWith("recipe-from-")) await viewRecipeForm(null, h.slice(12));
    else if (h.startsWith("b-")) await viewBoard(h.slice(2));
    else if (h.startsWith("tag-")) await viewTag(h.slice(4));
    else if (h.startsWith("t-")) await viewTopic(h.slice(2));
    else if (h.startsWith("u-")) await viewProfile(decodeURIComponent(h.slice(2)));
    else if (h.startsWith("/")) await viewBoard(h.slice(1));
    else if (h.startsWith("fork-")) { location.replace("#t-" + h.slice(5)); return; }
    else if (h === "post" || h.startsWith("post-")) await viewPost(h.slice(5) || null);
    else if (h === "categories") await viewCategories();
    else if (h === "news") await viewNews();
    else if (h === "feed") { location.replace("#categories"); return; }
    else if (h === "library") await viewLibrary();
    else if (h.startsWith("lib-")) await viewLibItem(h.slice(4));
    else if (h === "login") viewLogin("login");
    else if (h === "join") viewLogin("join");
    else if (h === "newpass") viewNewPass();
    else if (h === "me") await viewMe();
    else if (h === "display") viewDisplay();
    else if (h === "members") { location.replace("#index"); return; }
    else if (h === "stats") { location.replace("#recipes"); return; }
    else if (h === "search") await viewSearch();
    else if (h === "mod") { await viewMod(); await loadMetrics(); }
    else if (h === "notifications") await viewNotifications();
    else if (h === "terms") viewTerms();
    else if (h === "complaints") viewComplaints();
    else if (h === "about") viewAbout();
    else if (h === "accessibility") viewAccessibility();
    else if (h === "safe-sharing") viewSafeSharing();
    else if (h === "badge") viewBadge();
    else if (h === "faq") viewFaq();
    else if (h === "rules") viewRules();
    else if (h === "privacy") viewPrivacy();
    else viewNotFound();
  } catch (e) {
    console.error(e);
    V.innerHTML = crumb("") + `<div class="notice err">Couldn't load this page: ${esc(errMsg(e))}. Check your connection and try again.</div>`;
  } finally {
    clearTimeout(loadTimer); V.removeAttribute("aria-busy"); flushToast();
  }
}
const norm = h => (h && h !== "#") ? h : "#index";
let HIST = [norm(location.hash)], HI = 0, stepping = false;
const bBack = document.getElementById("goBack"), bFwd = document.getElementById("goFwd");
function syncHist() { bBack.disabled = HI <= 0; bFwd.disabled = HI >= HIST.length - 1; }
function step(d) { const n = HI + d; if (n < 0 || n >= HIST.length) return; HI = n; if (norm(location.hash) === HIST[HI]) { route(); syncHist(); return; } stepping = true; location.hash = HIST[HI]; syncHist(); }
bBack.onclick = () => step(-1); bFwd.onclick = () => step(1);
document.addEventListener("keydown", e => { if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); step(-1); } else if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); step(1); } });
window.addEventListener("hashchange", () => {
  const h = norm(location.hash);
  if (stepping) stepping = false;
  else if (h !== HIST[HI]) { HIST = HIST.slice(0, HI + 1); HIST.push(h); if (HIST.length > 100) HIST.shift(); HI = HIST.length - 1; }
  syncHist(); route().then(() => { window.scrollTo(0, 0); V.focus({ preventScroll: true }); });
});

const sideEl = document.getElementById("side"), menuBtn = document.getElementById("menuBtn");
menuBtn.onclick = () => { const o = sideEl.classList.toggle("open"); menuBtn.setAttribute("aria-expanded", o); };
window.addEventListener("hashchange", () => { const q = document.getElementById("qs"); if (q) q.remove(); sideEl.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); });
document.addEventListener("keydown", e => { if (e.key === "/" && !e.ctrlKey && !e.metaKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { e.preventDefault(); openSwitcher(); } });
document.querySelector(".sbox").addEventListener("click", e => { e.preventDefault(); openSwitcher(); });

// ================= boot =================
(async () => {
  sb.auth.onAuthStateChange(async (ev) => {
    if (ev === "PASSWORD_RECOVERY") { location.hash = "newpass"; return; }
    if (ev === "SIGNED_IN" || ev === "SIGNED_OUT" || ev === "USER_UPDATED") { await loadMe(); if (/^#?(access_token|error)/.test(location.hash.slice(1))) { if (ev === "SIGNED_IN") await afterLogin(); else location.hash = "index"; } }
  });
  try { await Promise.all([loadMe(), loadBoards()]); } catch (e) { setStatus(`<div class="notice err">Can't reach the ${esc(APP_NAME)} database right now. Try again in a minute.</div>`); }
  syncHist(); route();
})();
