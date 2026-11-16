"use strict";
// ================= config =================
const SUPABASE_URL = "https://dlqltqsojkjygzzehvjk.supabase.co";
const SUPABASE_KEY = "sb_publishable_cjOiFDs528cpWXSYkWa7fw_J5w0xas5";
const RSS_URL = SUPABASE_URL + "/functions/v1/rss";
const STALE_DAYS = 180;
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
const S = { session: null, me: null, boards: [], myLikes: new Set(), myVotes: new Map(), myFollows: [], isMod: false, modBoards: new Set() };
const V = document.getElementById("view");
const TYPES_BUILD = ["WORKFLOW", "TOOL", "AGENT", "FAIL"];
const TRYABLE = ["WORKFLOW", "TOOL", "AGENT"];
const OWNER_EMAIL = "ahmadismailcv@gmail.com";
const AREAS = ["Academic", "Professional services", "Research", "Learning technology", "IT & digital", "Library", "Student support", "Leadership", "Other"];
const DATA_CLASS = { none: "None, or public information only", internal: "Internal information, no personal data", personal: "Personal data, in an institution-approved tool" };
const TYPES_ALL = ["WORKFLOW", "AGENT", "TOOL", "FAIL", "QUESTION", "MOTION"];
const SUGGEST = ["copilot", "copilot-studio", "chatgpt-edu", "claude", "gemini", "notebooklm", "marking", "feedback", "accessibility", "timetabling", "admissions", "research-admin", "minutes", "policy"];
let sortMode = "top";
const TOOLS = { copilot: "Microsoft 365 Copilot", "copilot-studio": "Copilot Studio", "chatgpt-edu": "ChatGPT Edu", chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini", notebooklm: "NotebookLM", other: "Other tool" };
const KS = { sharepoint: "SharePoint or OneDrive", files: "Uploaded files", website: "Public website", dataverse: "Dataverse or a database", connector: "Connector or action", "instructions-only": "Instructions only", other: "Other" };
const spaceHref = id => id === "townhall" ? "#b-townhall" : "#/" + id;
const spaceName = b => b.id === "townhall" ? "Motions & meetings" : "/" + b.id;
const shotUrl = p => sb.storage.from("shots").getPublicUrl(p).data.publicUrl;

// ================= helpers =================
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const when = t => { const d = new Date(t); return `${String(d.getDate()).padStart(2, "0")} ${MON[d.getMonth()]} ${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const day = t => { const d = new Date(t); return `${String(d.getDate()).padStart(2, "0")} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
const cleanTag = t => String(t).toLowerCase().replace(/^#/, "").replace(/[^a-z0-9-]/g, "").slice(0, 30);
const parseTags = s => [...new Set(String(s).split(/[\s,]+/).map(cleanTag).filter(Boolean))].slice(0, 8);
const board = id => S.boards.find(b => b.id === id);
const TYPE_LABEL = { WORKFLOW: "Workflow", TOOL: "Tool", AGENT: "Agent", FAIL: "Fail", QUESTION: "Question", MOTION: "Motion", MEETING: "Town meeting" };
const typeTag = t => t ? `<span class="tg ${esc(t)}">${esc(TYPE_LABEL[t] || t)}</span>` : "";
const fmtShort = m => m == null ? "?" : m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`;
const tagLinks = tags => (tags || []).map(t => `<a class="ht" href="#tag-${esc(t)}">#${esc(t)}</a>`).join("");
const isStale = p => TYPES_BUILD.includes(p.type) && (Date.now() - new Date(p.tested_on).getTime()) > STALE_DAYS * 864e5;
const crumb = rest => rest ? `<h1 class="h-page" style="margin:0 0 18px">${rest}</h1>` : "";
const authorName = p => p.is_sample && !p.author ? "Townhall team" : (p.author_handle || (p.profiles && p.profiles.handle) || "[deleted member]");
const userLink = h => h && h !== "[deleted member]" && h !== "Townhall team" ? `<a href="#u-${esc(h)}">${esc(h)}</a>` : esc(h);
const fmtMins = m => m == null ? "?" : m >= 120 ? `${Math.round(m / 60 * 10) / 10} hours` : `${m} min`;
const saving = p => p.minutes_before > 0 && p.minutes_after != null ? Math.round((p.minutes_before - p.minutes_after) / p.minutes_before * 100) : null;
function rankOf(rep, role) { if (role === "admin") return "Town Clerk"; return rep >= 60 ? "Alderman" : rep >= 20 ? "Councillor" : rep >= 5 ? "Citizen" : "Resident"; }
function hot(p) { const h = (Date.now() - new Date(p.created_at)) / 36e5; return (p.likes + 3 * p.tries_worked + p.tries_partly + 1) / Math.pow(h + 2, 1.5); }
function sorted(list, mode = sortMode) {
  const a = [...list];
  if (mode === "new") a.sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
  else if (mode === "hot") a.sort((x, y) => hot(y) - hot(x));
  else if (mode === "tried") a.sort((x, y) => (y.tries_worked * 3 + y.tries_partly) - (x.tries_worked * 3 + x.tries_partly) || y.likes - x.likes);
  else a.sort((x, y) => y.likes - x.likes || new Date(y.created_at) - new Date(x.created_at));
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
function piiWarnings(txt) {
  const w = [];
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(txt)) w.push("an email address (this will be blocked)");
  if (/(\+44\s?7\d{3}|\b07\d{3})\s?\d{3}\s?\d{3}/.test(txt)) w.push("a phone number (this will be blocked)");
  if (/\b[a-z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[a-d]\b/i.test(txt)) w.push("a National Insurance number (this will be blocked)");
  if (/\b(Mr|Mrs|Ms|Miss|Dr|Prof)\.?\s+[A-Z][a-z]+/.test(txt)) w.push("what looks like a person's name with a title");
  if (/\b\d{1,4}\s+[A-Z][a-z]+\s+(Road|Street|Lane|Avenue|Close|Drive|Way)\b/.test(txt)) w.push("what looks like a street address");
  if (/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/.test(txt)) w.push("what looks like a postcode");
  if (/\b(patient|client|pupil|student)\s+[A-Z][a-z]+/.test(txt)) w.push("what may be a patient, client or student's name");
  return w;
}
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
const verified = on => on ? `<span class="verified" title="Uses a UK university or college email address (.ac.uk)">${svg(IC.badge)}ac.uk</span>` : "";
const ago = t => { const s = (Date.now() - new Date(t)) / 1000; if (s < 3600) return Math.max(1, Math.round(s / 60)) + " min ago"; if (s < 86400) return Math.round(s / 3600) + " h ago"; if (s < 7 * 86400) return Math.round(s / 86400) + " d ago"; return day(t); };
const LABELS = { terms: "Terms of use", about: "About", accessibility: "Accessibility", "safe-sharing": "What you can safely share", notifications: "Notifications", index: "Townhall", categories: "Categories", news: "HE AI news", library: "My library", post: "Share a build", login: "Log in", join: "Join", newpass: "New password", me: "Settings", display: "Text & display", stats: "Time saved", search: "Search", mod: "Moderation", badge: "Badge", faq: "FAQ", rules: "House rules", privacy: "Privacy" };
function routeLabel(h) {
  if (LABELS[h]) return LABELS[h];
  if (h.startsWith("b-")) return board(h.slice(2)) ? spaceName(board(h.slice(2))) : "Space";
  if (h.startsWith("tag-")) return "#" + h.slice(4);
  if (h.startsWith("u-")) return "Member / " + h.slice(2);
  if (h.startsWith("/")) return h;
  if (h.startsWith("lib-")) return "My library";
  if (h.startsWith("post-")) return "Share a build";
  if (h.startsWith("fork-")) return "Fork a setup";
  return "";
}
function crumbHtml(h) {
  if (h.startsWith("lib-")) return `<a href="#library">My library</a>`;
  if (h.startsWith("post-")) { const b = board(h.slice(5)); return b ? `<a href="${spaceHref(b.id)}">${esc(spaceName(b))}</a>` : ""; }
  return "";
}
function renderShell() {
  const h = location.hash.slice(1) || "index";
  const nav = [["categories", "Categories", IC.grid], ["index", "Townhall", IC.hall], ["news", "HE AI news", IC.news], ["library", "My library", IC.book]];
  const nav2 = [["post", "Share a build", IC.plus], ["stats", "Time saved", IC.clock]];
  if (S.isMod) nav2.push(["mod", "Moderation", IC.shield]);
  nav2.push(["me", "Settings", IC.gear]);
  const on = k => k === h || (k === "library" && h.startsWith("lib-")) || (k === "post" && (h.startsWith("post-") || h.startsWith("fork-"))) || (k === "categories" && (h.startsWith("/") || h.startsWith("b-")));
  const links = list => list.map(([k, l, i]) => `<a href="#${k}" class="${on(k) ? "on" : ""}"${on(k) ? ' aria-current="page"' : ""}>${svg(i)}${l}</a>`).join("");
  document.getElementById("snav").innerHTML = links(nav);
  document.getElementById("snav2").innerHTML = links(nav2);
  const bc = S.boardCounts || {};
  document.getElementById("sboards").innerHTML = S.boards.filter(b => b.id !== "townhall").map(b => `<a href="${spaceHref(b.id)}" class="${h === "/" + b.id || h === "b-" + b.id ? "on" : ""}" style="display:flex;align-items:center" title="${esc(b.descr)}">${esc(spaceName(b))}${bc[b.id] ? `<span class="count">${bc[b.id]}</span>` : ""}</a>`).join("");
  const who = document.getElementById("who");
  if (S.me) who.innerHTML = `<img src="${identicon(S.me.id, S.me.handle)}" alt=""><div style="min-width:0;flex:1"><a class="nm" href="#u-${esc(S.me.handle)}">${esc(S.me.handle)}</a>${S.me.banned ? " (suspended)" : ""}<div class="sub">${esc(S.me.role === "admin" ? "Town Clerk" : (S.me.staff_area || S.me.profession || "Member"))}</div></div><a href="#" id="signout" class="sub">Log out</a>`;
  else if (S.session) who.innerHTML = `<div class="sub">Signed in. Setting up your profile...</div>`;
  else who.innerHTML = `<div><div class="nm">Staff at a UK university or college?</div><div class="sub"><a href="#join">Join</a> or <a href="#login">log in</a></div></div>`;
  const so = document.getElementById("signout"); if (so) so.onclick = async e => { e.preventDefault(); await sb.auth.signOut(); location.hash = "index"; };
  const lbl = routeLabel(h);
  document.title = (lbl ? lbl.replace(/^Member \/ /, "") + " · " : "") + "Townhall";
  document.getElementById("crumbbar").innerHTML = crumbHtml(h);
  const cta = document.getElementById("topCta"), ctaT = document.getElementById("topCtaTxt");
  if (cta) {
    cta.hidden = h === "post" || h.startsWith("post-") || h.startsWith("fork-") || h === "join" || h === "login";
    const ico = cta.querySelector("svg");
    if (S.me) { cta.href = "#post"; ctaT.textContent = "Share a build"; cta.className = "btn primary"; ico.style.display = ""; }
    else if (h === "index") { cta.href = "#login"; ctaT.textContent = "Log in"; cta.className = "btn"; ico.style.display = "none"; }
    else { cta.href = "#join"; ctaT.textContent = "Join free"; cta.className = "btn primary"; ico.style.display = "none"; }
  }
}
function tryMeter(p) {
  const n = p.tries_worked + p.tries_partly + p.tries_failed;
  if (!n) return `<span>No tries yet</span>`;
  const pc = x => (x / n * 100).toFixed(1) + "%";
  return `<span title="${p.tries_worked} worked, ${p.tries_partly} partly, ${p.tries_failed} didn't"><span class="tmeter" aria-hidden="true"><i style="width:${pc(p.tries_worked)};background:var(--good)"></i><i style="width:${pc(p.tries_partly)};background:#e3b341"></i><i style="width:${pc(p.tries_failed)};background:var(--bad)"></i></span>Tried by ${n}: ${p.tries_worked} worked</span>`;
}
function statBlock(p) {
  const sv = saving(p);
  if (!TYPES_BUILD.includes(p.type) || sv == null) return "";
  return `<div class="stat" title="Times reported by the author"><span class="st-from">${fmtShort(p.minutes_before)}</span><span class="st-arrow" aria-hidden="true">→</span><span class="sr"> down to </span><span class="st-to">${fmtShort(p.minutes_after)}</span>${sv > 0 ? `<span class="st-save">${sv}% less time</span>` : `<span class="st-none">no time saved</span>`}</div>`;
}
function postCard(p, showBoard = true) {
  const name = authorName(p), b = board(p.board_id);
  const sub = [p.author_area, p.author_institution].filter(Boolean).map(esc).join(" · ");
  const thumb = (p.screenshots || [])[0], n = p.tries_worked + p.tries_partly + p.tries_failed;
  const labels = `${p.pinned ? '<span class="tg MEETING">Pinned</span>' : ""}${typeTag(p.type)}${p.is_sample ? '<span class="tg SAMPLE">Example</span>' : ""}${isStale(p) ? '<span class="tg STALE">May be out of date</span>' : ""}`;
  const foot = [
    p.type === "MOTION" ? `<span>Score <b>${p.vote_score > 0 ? "+" : ""}${p.vote_score}</b> from ${p.vote_count} ${p.vote_count === 1 ? "vote" : "votes"}</span>` : "",
    p.tool_key ? `<span class="toolchip">${esc(TOOLS[p.tool_key] || p.tool_key)}</span>` : "",
    TRYABLE.includes(p.type) && n ? tryMeter(p) : "",
    p.replies ? `<span>${svg(IC.chat)}${p.replies} ${p.replies === 1 ? "reply" : "replies"}</span>` : "",
    p.likes ? `<span title="Likes">${svg(IC.heart)}${p.likes}</span>` : "",
    (p.tags || []).length ? `<span class="tagline">${p.tags.slice(0, 4).map(t => `<a href="#tag-${esc(t)}">#${esc(t)}</a>`).join(" ")}</span>` : "",
    showBoard && b ? `<a class="spacelink" href="${spaceHref(b.id)}">${esc(spaceName(b))}</a>` : ""
  ].filter(Boolean).join("");
  return `<article class="post${thumb ? " has-thumb" : ""}"><div class="post-main">
   <div class="post-head"><img class="av" src="${identicon(p.author || "team", name)}" alt="" width="32" height="32"><span class="who">${userLink(name)}</span>${verified(p.author_ac)}${sub ? `<span class="org">${sub}</span>` : ""}<span class="when">${esc(ago(p.created_at))}</span></div>
   <a class="post-title" href="#t-${esc(p.id)}">${esc(p.title)}</a>
   ${labels ? `<div class="post-labels">${labels}</div>` : ""}
   ${p.body || p.task ? `<p class="post-sum">${esc((p.body || p.task).slice(0, 400))}</p>` : ""}
   ${statBlock(p)}
   ${foot ? `<div class="post-foot">${foot}</div>` : ""}
   </div>${thumb ? `<a class="post-thumb" href="#t-${esc(p.id)}" tabindex="-1" aria-hidden="true"><img src="${esc(shotUrl(thumb))}" alt="" loading="lazy"></a>` : ""}</article>`;
}
function feed(list, showBoard = true, empty) {
  return list.length ? `<div class="feed">${list.map(p => postCard(p, showBoard)).join("")}</div>` : `<div class="empty">${empty || (toolFilter || typeFilter ? `Nothing matches these filters. <a href="#" id="fClear">Clear filters</a>` : `Nothing here yet. <a href="#post">Share the first build.</a>`)}</div>`;
}

// ================= filters & quick switcher =================
let toolFilter = "", typeFilter = "";
const applyFilters = list => list.filter(p => (!toolFilter || p.tool_key === toolFilter) && (!typeFilter || p.type === typeFilter));
function filterBar() {
  return `<div class="filters" role="group" aria-label="Filters"><select id="fTool" aria-label="Filter by tool"><option value="">All tools</option>${Object.entries(TOOLS).map(([k, v]) => `<option value="${k}"${toolFilter === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select><select id="fType" aria-label="Filter by post type"><option value="">All types</option>${["WORKFLOW", "AGENT", "TOOL", "FAIL", "QUESTION"].map(t => `<option${typeFilter === t ? " selected" : ""}>${t}</option>`).join("")}</select></div>`;
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
  S.me = null; S.myLikes = new Set(); S.myVotes = new Map(); S.myFollows = []; S.isMod = false; S.modBoards = new Set();
  if (S.session) {
    const uid = S.session.user.id;
    const [pr, lk, vt, fl, md] = await Promise.all([
      sb.rpc("my_profile"),
      sb.from("likes").select("post_id").eq("user_id", uid),
      sb.from("motion_votes").select("post_id,vote").eq("user_id", uid),
      sb.from("follows").select("kind,target").eq("user_id", uid),
      sb.from("board_mods").select("board_id").eq("user_id", uid)
    ]);
    S.me = pr.data && pr.data.id ? pr.data : null;
    (lk.data || []).forEach(r => S.myLikes.add(r.post_id));
    (vt.data || []).forEach(r => S.myVotes.set(r.post_id, r.vote));
    S.myFollows = fl.data || [];
    (md.data || []).forEach(r => S.modBoards.add(r.board_id));
    S.isMod = !!S.me && (S.me.role === "admin" || S.modBoards.size > 0);
    if (S.me && S.me.prefs && S.me.prefs.font) applyDisplay(S.me.prefs);
  }
  renderShell(); loadNotifCount();
}
async function loadBoards() {
  const [bd, pc] = await Promise.all([sb.from("boards").select("*").order("sort"), sb.from("post_feed").select("board_id").eq("status", "published").limit(2000)]);
  S.boards = bd.data || []; S.boardCounts = {};
  (pc.data || []).forEach(r => S.boardCounts[r.board_id] = (S.boardCounts[r.board_id] || 0) + 1);
  renderShell();
}
const FEED_COLS = "id,author,task,body,tool_key,screenshots,author_area,author_institution,author_ac,author_profession,board_id,type,title,tags,status,pinned,is_sample,tested_on,created_at,model_version,minutes_before,minutes_after,author_handle,likes,tries_worked,tries_partly,tries_failed,replies,forks,vote_score,vote_count";
async function fetchPosts(q) { const { data, error } = await q; if (error) throw error; return data || []; }
const publishedPosts = () => sb.from("post_feed").select(FEED_COLS).eq("status", "published").order("created_at", { ascending: false }).limit(300);
const isModOf = b => S.me && (S.me.role === "admin" || S.modBoards.has(b));
const follows = (kind, target) => S.myFollows.some(f => f.kind === kind && f.target === target);
function needLogin(what) { return `<div class="notice">${esc(what)} needs an account. <a href="#login">Log in</a> or <a href="#join">join</a>. It's free.</div>`; }

// ================= list rendering =================
function sortTabs() { return `<div class="feedbar"><div class="tabs" role="tablist">${[["top", "Top"], ["tried", "Most tried"], ["hot", "Hot"], ["new", "Newest"]].map(([k, l]) => `<a href="#" role="tab" data-sort="${k}" class="${sortMode === k ? "on" : ""}">${l}</a>`).join("")}</div>${filterBar()}</div>`; }
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
  const [posts, savings, mem, tri, ppl, nw] = await Promise.all([fetchPosts(publishedPosts()), sb.from("tag_savings").select("*").order("posts", { ascending: false }).limit(6),
    sb.from("member_directory").select("id", { count: "exact", head: true }), sb.from("tries").select("post_id", { count: "exact", head: true }),
    sb.from("member_directory").select("*").order("rep", { ascending: false }).limit(5),
    sb.from("news_items").select("source,title,url,published_at").order("published_at", { ascending: false }).limit(5)]);
  const news = nw.data || [];
  const memberCount = mem.count || 0, tryCount = tri.count || 0;
  const meeting = posts.find(p => p.type === "MEETING" && p.pinned);
  const people = (ppl.data || []).filter(u => u.rep > 0);
  const draw = () => {
    const ex = !S.me ? sorted(posts.filter(p => TYPES_BUILD.includes(p.type) && saving(p) > 0), "top")[0] : null;
    const list = sorted(applyFilters(posts.filter(p => p.type !== "MEETING" && (!ex || p.id !== ex.id)))).slice(0, 30);
    const tc = {}; posts.forEach(p => (p.tags || []).forEach(t => tc[t] = (tc[t] || 0) + 1));
    const tags = Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 16);
    const sv = savings.data || [];
    V.innerHTML = `<div class="grid2"><div class="colmain">
      <section class="hero"><h1 class="h-page">AI workflows from UK university staff, with the time they save</h1>
       <p class="lead">Each post shows the task, the tool, the minutes before and after, and what went wrong. Colleagues at other institutions then say whether it worked for them.</p>
       ${S.me ? `<a class="composer" href="#post"><img class="av" src="${identicon(S.me.id, S.me.handle)}" alt="" width="36" height="36"><span>Share something you built with AI. It takes about 15 minutes.</span><span class="composer-go" aria-hidden="true">${svg(IC.plus)}</span></a>`
         : `<div class="hero-cta"><a class="btn primary lg" href="#join">Join free</a><a class="btn lg" href="#categories">Browse categories</a></div>`}
       ${ex ? `<div class="example"><div class="ex-lbl">A post from the community</div>${postCard(ex)}</div>` : ""}
       <div class="small counter" aria-label="Site totals">${memberCount < SHOW_COUNT_FROM ? `<b>Founding members wanted.</b> Early posts shape what Townhall becomes` : `<b>${memberCount.toLocaleString("en-GB")}</b> members`} · <b>${posts.filter(p => !p.is_sample).length.toLocaleString("en-GB")}</b> posts · <b>${tryCount.toLocaleString("en-GB")}</b> workflows tried</div>
      </section>
      ${sortTabs()}${feed(list)}
    </div>
    <aside class="colrail rail" aria-label="Highlights">
      ${meeting ? `<div class="card card-pad"><h2 class="h3">Town meeting this week</h2><a class="b" href="#t-${esc(meeting.id)}">${esc(meeting.title)}</a><div class="small" style="margin-top:4px">${meeting.replies} ${meeting.replies === 1 ? "reply" : "replies"}</div></div>`
        : `<div class="card card-pad"><h2 class="h3">Motions & meetings</h2><div class="small">Proposals on how Townhall is run. Members vote for or against.</div><a class="btn" style="margin-top:12px" href="#b-townhall">See motions</a></div>`}
      ${news.length ? `<div class="card card-pad"><h2 class="h3">Latest HE AI news</h2><div class="newslist mini">${news.map(newsLink).join("")}</div><div style="margin-top:8px"><a class="small" href="#news">All news</a></div></div>` : ""}
      <div class="card card-pad"><h2 class="h3">Trending tags</h2>${tags.length ? tags.map(([t, n]) => `<a class="ht" href="#tag-${esc(t)}">#${esc(t)} <span style="opacity:.6">${n}</span></a>`).join("") : `<div class="small">No tags yet.</div>`}</div>
      <div class="card card-pad"><h2 class="h3">Most helpful members</h2>${people.length ? people.map(u => `<a class="person" href="#u-${esc(u.handle)}" style="text-decoration:none"><img class="av" src="${identicon(u.id, u.handle)}" alt="" width="36" height="36"><span class="t"><span class="n" style="display:block">${esc(u.handle)}</span><span class="s">${esc(u.profession || u.staff_area || rankOf(u.rep, u.role))} · ${u.rep} rep</span></span></a>`).join("") : `<div class="small">Reputation comes from colleagues saying your workflow worked for them. Nobody has earned any yet.</div>`}
</div>
      <div class="card card-pad"><h2 class="h3">Time saved, as reported</h2>${sv.length ? sv.map(s => `<div class="rail-item" style="display:flex;justify-content:space-between;gap:8px"><a href="#tag-${esc(s.tag)}">#${esc(s.tag)}</a><span><b>${s.median_saving_pct}%</b> <span class="small">median, ${s.posts} posts</span></span></div>`).join("") + `<div style="margin-top:8px"><a class="small" href="#stats">All figures</a></div>` : `<div class="small">No build posts yet.</div>`}
        <div class="small" style="margin-top:8px">Self-reported by authors. Not independently checked.</div></div>
    </aside></div>`;
    bindSort(draw);
  };
  draw();
}
function pageHead(title, sub, actions) {
  return `<div class="bar"><div style="min-width:0"><h1 class="h-page">${title}</h1>${sub ? `<div class="small" style="margin-top:6px;max-width:720px">${sub}</div>` : ""}</div>${actions ? `<span class="trybar">${actions}</span>` : ""}</div>`;
}
async function viewBoard(id) {
  const b = board(id); if (!b) return viewNotFound();
  const posts = await fetchPosts(publishedPosts().eq("board_id", id));
  const mods = (await sb.from("board_mods").select("profiles(handle)").eq("board_id", id)).data || [];
  const draw = () => {
    V.innerHTML = `${pageHead(esc(spaceName(b)), `${esc(b.descr)} ${mods.length ? "Ward moderator" + (mods.length > 1 ? "s" : "") + ": " + mods.map(m => userLink(m.profiles && m.profiles.handle)).join(", ") : ""}`, `${followBtn("board", id)} <a class="btn" href="#post-${esc(id)}">${id === "townhall" ? "Propose a motion" : "Post here"}</a>`)}
      ${id === "townhall" ? `<div class="notice">Motions are proposals for how Townhall is run. Members vote for or against. The town clerk reviews any motion with a clear majority and at least 10 votes.</div>` : ""}
      ${sortTabs()}${feed(sorted(applyFilters(posts)), false)}`;
    bindSort(draw); bindFollow(draw);
  };
  draw();
}
async function viewTag(t) {
  t = cleanTag(t); if (!t) return viewNotFound();
  const [posts, sv] = await Promise.all([fetchPosts(publishedPosts().contains("tags", [t])), sb.from("tag_savings").select("*").eq("tag", t).maybeSingle()]);
  const draw = () => {
    const s = sv.data;
    V.innerHTML = `${pageHead("#" + esc(t), `Every topic tagged #${esc(t)}. ${s ? `Build posts here report a median <b>${s.median_saving_pct}%</b> time saving across ${s.posts} posts (self-reported).` : ""}`, ``)}
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
  const sources = [...new Map(items.map(n => [n.source_id, n.source])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const draw = () => {
    const list = items.filter(n => !newsSource || n.source_id === newsSource);
    V.innerHTML = `${pageHead("HE AI news", "Headlines about AI in higher education, gathered automatically every 6 hours from public news feeds. Each title opens the full story on the publisher's own site.")}
      ${sources.length > 1 ? `<div class="chips" style="margin-bottom:14px" role="group" aria-label="Filter by source"><a href="#" class="ht${!newsSource ? " on" : ""}" data-ns="">All sources</a>${sources.map(([id, name]) => `<a href="#" class="ht${newsSource === id ? " on" : ""}" data-ns="${esc(id)}">${esc(name)}</a>`).join("")}</div>` : ""}
      ${list.length ? `<div class="card newslist">${list.map(newsLink).join("")}</div>` : `<div class="empty">No headlines yet. The next check runs within 6 hours.</div>`}
      <div class="small" style="margin-top:12px">Townhall shows headlines and links only. Stories belong to their publishers; Townhall isn't responsible for their content.</div>`;
    V.querySelectorAll("[data-ns]").forEach(a => a.onclick = e => { e.preventDefault(); newsSource = a.dataset.ns; draw(); });
  };
  draw();
}
async function viewCategories() {
  const posts = await fetchPosts(publishedPosts());
  const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
  const spaces = [...S.boards.filter(b => b.id !== "townhall"), ...S.boards.filter(b => b.id === "townhall")];
  const draw = () => {
    V.innerHTML = `${pageHead("Categories", "Find workflows by the job they help with, from marking to minutes. Follow the ones you work in.")}
    <div class="catgrid">${spaces.map(b => {
      const ps = posts.filter(p => p.board_id === b.id), last = ps[0];
      const sv = med(ps.map(saving).filter(x => x != null));
      const tools = Object.entries(ps.reduce((m, p) => (p.tool_key && (m[p.tool_key] = (m[p.tool_key] || 0) + 1), m), {})).sort((x, y) => y[1] - x[1]).slice(0, 3);
      return `<section class="card catcard">
        <div class="cathead"><a class="catname" href="${spaceHref(b.id)}">${esc(spaceName(b))}</a><span class="small">${ps.length} ${ps.length === 1 ? "post" : "posts"}</span></div>
        <p class="small catdesc">${esc(b.id === "townhall" ? "Motions and town meetings on how the site is run. Members vote for or against." : b.descr)}</p>
        ${tools.length ? `<div>${tools.map(([k]) => `<span class="toolchip">${esc(TOOLS[k] || k)}</span>`).join(" ")}</div>` : ""}
        <div class="catlast small">${last ? `Latest: <a href="#t-${esc(last.id)}">${esc(last.title.slice(0, 70))}${last.title.length > 70 ? "..." : ""}</a> · ${esc(ago(last.created_at))}` : "No posts yet. Be the first."}</div>
        ${sv != null ? `<div class="small">${svg(IC.clock)} Median <b>${sv}%</b> less time, self-reported</div>` : ""}
        <div class="trybar catacts">${followBtn("board", b.id).replace('btn blue', 'btn')}<a class="btn" href="#post-${esc(b.id)}">${b.id === "townhall" ? "Propose a motion" : "Post here"}</a></div>
      </section>`;
    }).join("")}</div>`;
    bindFollow(draw);
  };
  draw();
}

function topicStats(p) {
  if (!TYPES_BUILD.includes(p.type)) return "";
  const sv = saving(p), n = p.tries_worked + p.tries_partly + p.tries_failed;
  return `<div class="statrow">
    <div><span class="k">Before</span><b>${fmtShort(p.minutes_before)}</b></div>
    <div><span class="k">After</span><b>${fmtShort(p.minutes_after)}</b></div>
    ${sv != null ? `<div class="${sv > 0 ? "hl" : ""}"><span class="k">Time saved</span><b>${sv > 0 ? sv + "%" : "None"}</b></div>` : ""}
    ${TRYABLE.includes(p.type) ? `<div><span class="k">Tried by colleagues</span><b>${n || "None yet"}</b>${n ? `<span class="k">${p.tries_worked} worked · ${p.tries_partly} partly · ${p.tries_failed} didn't</span>` : ""}</div>` : ""}
  </div>
  <div class="small statnote">Times reported by the author${p.tested_on ? `, last tested ${esc(day(p.tested_on))}` : ""}.${isStale(p) ? ' <span class="tg STALE">May be out of date</span>' : ""}</div>`;
}
function renderCard(p) {
  let h = "";
  if (TYPES_BUILD.includes(p.type)) {
    const sv = saving(p);
    const f = [["Task", esc(p.task)], ["Tool", esc(p.tool || TOOLS[p.tool_key] || "")], ...(p.model_version ? [["Model or version", esc(p.model_version)]] : []),
      ["Data that went in", esc(DATA_CLASS[p.data_class] || "Not stated")], ["What went wrong", esc(p.what_wrong)]];
    h += `<div class="facts">${f.map(([k, v]) => `<div class="k">${k}</div><div>${v}</div>`).join("")}</div>`;
  }
  const ks = p.knowledge_sources || [];
  if (ks.length) h += `<div class="kslist"><div class="lbl">Knowledge sources</div>${ks.map(k => `<div class="ksitem"><span class="tg">${esc(KS[k.kind] || k.kind)}</span><span>${esc(k.note || "")}</span></div>`).join("")}</div>`;
  if (p.prompt) {
    const long = p.prompt.length > 420 || p.prompt.split("\n").length > 7;
    h += `<div class="prompt${long ? " clip" : ""}" id="promptBox"><div class="lbl"><span>${p.type === "AGENT" ? "Agent instructions" : "Prompt or setup"}</span><button type="button" class="copy" id="copyPrompt">Copy</button></div><pre id="promptText">${esc(p.prompt)}</pre>
      ${long ? `<button type="button" class="seemore" id="seeMore" aria-expanded="false" aria-controls="promptText">See more</button>` : ""}</div>`;
  }
  return h;
}
function bindPromptBox(p) {
  const sm = document.getElementById("seeMore"), box = document.getElementById("promptBox");
  if (sm) sm.onclick = () => { const o = box.classList.toggle("open"); sm.textContent = o ? "See less" : "See more"; sm.setAttribute("aria-expanded", o); };
  const cp = document.getElementById("copyPrompt");
  if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(p.prompt); cp.textContent = "Copied"; toast("Prompt copied"); } catch (_) { cp.textContent = "Select and copy"; } setTimeout(() => { if (cp.isConnected) cp.textContent = "Copy"; }, 2000); };
}
const acBadge = verified;
async function viewTopic(id) {
  const { data: p, error } = await sb.from("post_feed").select("*").eq("id", id).maybeSingle();
  if (error || !p) return viewNotFound("This topic doesn't exist, is waiting for approval, or was removed.");
  const [reps, tries, forks, parent, rep] = await Promise.all([
    sb.from("replies").select("id,body,status,created_at,author,profiles(handle,profession)").eq("post_id", id).order("created_at"),
    sb.from("tries").select("result,note,created_at,user_id,profiles(handle)").eq("post_id", id).order("created_at", { ascending: false }),
    sb.from("posts").select("id,title").eq("forked_from", id).eq("status", "published").limit(20),
    p.forked_from ? sb.from("posts").select("id,title").eq("id", p.forked_from).maybeSingle() : Promise.resolve({ data: null }),
    p.author ? sb.from("member_directory").select("rep,role").eq("id", p.author).maybeSingle() : Promise.resolve({ data: null })
  ]);
  const b = board(p.board_id), mine = S.me && p.author === S.me.id, mod = isModOf(p.board_id);
  const canSave = S.me && LIB_TYPES.includes(p.type) && p.status === "published";
  const mySaved = canSave ? (await sb.from("library_items").select("id").eq("source_post", p.id).maybeSingle()).data : null;
  const myTry = S.me ? (tries.data || []).find(t => t.user_id === S.me.id) : null;
  const canTry = S.me && !mine && TRYABLE.includes(p.type) && p.status === "published";
  const r = rep.data;
  const nTries = p.tries_worked + p.tries_partly + p.tries_failed;
  const rl = (reps.data || []).length;
  const tryLbl = { worked: ["It worked", "WORKFLOW"], partly: ["Partly worked", "QUESTION"], failed: ["Didn't work", "FAIL"] };
  let h = `<div class="grid2"><div class="colmain">
   <article class="topic-card">
    <div class="post-head"><img class="av" src="${identicon(p.author || "team", authorName(p))}" width="40" height="40" alt=""><div><span class="who">${userLink(authorName(p))}</span> ${verified(p.author_ac)}<div class="small">${[p.author_profession, p.author_area, p.author_institution].filter(Boolean).map(esc).join(" · ")}</div></div><span class="when">${esc(when(p.created_at))}</span></div>
    <h1 class="topic-title">${esc(p.title)}</h1>
    <div>${p.pinned ? '<span class="tg MEETING">Pinned</span>' : ""}${typeTag(p.type)}${p.status !== "published" ? `<span class="tg ${p.status.toUpperCase()}">${p.status.toUpperCase()}</span>` : ""}${p.is_sample ? '<span class="tg SAMPLE">SAMPLE</span>' : ""}${b ? `<a class="ht" href="${spaceHref(b.id)}">${esc(spaceName(b))}</a>` : ""}${tagLinks(p.tags)}</div>
    ${p.status === "pending" ? `<div class="notice" style="margin-top:12px">This post is waiting for a moderator. Posts from accounts without a university email are checked until three have been approved.</div>` : ""}
    ${parent.data ? `<div class="small" style="margin-top:8px">Forked from <a href="#t-${esc(parent.data.id)}">${esc(parent.data.title)}</a></div>` : ""}
    ${topicStats(p)}
    ${p.body ? `<pre class="topic-body">${esc(p.body)}</pre>` : ""}
    ${(p.screenshots || []).length ? `<div class="shots">${p.screenshots.map((s, i) => `<a href="${esc(shotUrl(s))}" target="_blank" rel="noopener"><img src="${esc(shotUrl(s))}" alt="Screenshot ${i + 1} shared by the author" loading="lazy"></a>`).join("")}</div>` : ""}
    ${renderCard(p)}
    <div class="trybar" style="margin-top:18px">
      ${p.type === "MOTION" ? motionBar(p) : (S.me && p.status === "published" ? `<button class="btn ${S.myLikes.has(p.id) ? "on" : ""}${S.pop === p.id ? " pop" : ""}" id="likeBtn" aria-pressed="${S.myLikes.has(p.id)}">${svg(IC.heart)}${S.myLikes.has(p.id) ? "Liked" : "Like"}</button>` : "")} ${p.type !== "MOTION" && p.likes ? `<span class="likes">${p.likes} ${p.likes === 1 ? "like" : "likes"}</span>` : ""}
      ${TRYABLE.includes(p.type) && nTries ? `<span class="likes">${tryMeter(p)}</span>` : ""}
    </div>
    ${canTry ? `<div class="box" style="margin:16px 0 0;background:var(--soft)"><h2 class="h3">I tried this</h2><div class="in">
       <div class="trybar">${[["worked", "It worked"], ["partly", "Partly worked"], ["failed", "Didn't work"]].map(([k, l]) => `<label><input type="radio" name="tr" value="${k}"${myTry && myTry.result === k ? " checked" : ""}> ${l}</label>`).join(" ")}</div>
       <input type="text" id="trNote" maxlength="500" placeholder="Optional: what was different at your institution?" value="${esc(myTry ? myTry.note : "")}" style="margin-top:8px">
       <div style="margin-top:8px" class="trybar"><button class="btn blue" id="trSave">${myTry ? "Update" : "Save"}</button>${myTry ? `<button class="btn danger" id="trDel">Remove my try</button>` : ""}<span id="trMsg" class="small"></span></div></div></div>`
      : (!S.me && TRYABLE.includes(p.type) && p.status === "published" ? `<div class="box" style="margin:16px 0 0;background:var(--soft)"><h2 class="h3">I tried this</h2><div class="in">
       <div class="trybar">${[["worked", "It worked"], ["partly", "Partly worked"], ["failed", "Didn't work"]].map(([k, l]) => `<label><input type="radio" name="tr" value="${k}"> ${l}</label>`).join(" ")}</div>
       <input type="text" id="trNote" maxlength="500" placeholder="Optional: what was different at your institution?" aria-label="Note about your try" style="margin-top:8px">
       <div style="margin-top:8px" class="trybar"><button class="btn primary" data-trygo="join">Join to save</button><button class="btn" data-trygo="login">Log in to save</button><span id="trMsg" class="small"></span></div>
       <div class="small" style="margin-top:6px">We'll keep your answer and save it once you're in.</div></div></div>` : "")}
    <div class="trybar small" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line)">
      ${canSave ? (mySaved ? `<a class="btn on" href="#lib-${esc(mySaved.id)}">${svg(IC.book)}In your library</a>` : `<button class="btn" id="libSave">${svg(IC.book)}Save to library</button>`) : ""}
      ${S.me && TYPES_BUILD.includes(p.type) && p.status === "published" ? `<a class="btn" href="#fork-${esc(p.id)}">Fork this setup</a>` : ""}
      ${mine && TYPES_BUILD.includes(p.type) ? `<button class="btn" id="retest">I've re-tested this</button>` : ""}
      ${S.me && !mine ? `<button class="btn" id="reportPost">Report</button>` : ""}
      ${mine || (S.me && S.me.role === "admin") ? `<button class="btn danger" id="delPost">Delete</button>` : ""}
      ${mod ? `<span class="trybar">Moderator: ${p.status !== "published" ? `<button class="btn" data-modset="published">Approve</button>` : ""}${p.status !== "removed" ? `<button class="btn danger" data-modset="removed">Remove</button>` : ""}${S.me.role === "admin" ? `<button class="btn" id="pinBtn">${p.pinned ? "Unpin" : "Pin"}</button>` : ""}</span>` : ""}
      <span id="actMsg"></span>
    </div>
    ${(forks.data || []).length ? `<div class="small" style="margin-top:10px">Forks: ${(forks.data).map(f => `<a href="#t-${esc(f.id)}">${esc(f.title)}</a>`).join(", ")}</div>` : ""}
   </article>
   <section class="card card-pad"><h2 class="h3">${rl} ${rl === 1 ? "reply" : "replies"}</h2>`;
  (tries.data || []).filter(t => t.note).slice(0, 10).forEach(t => {
    const [lbl, cls] = tryLbl[t.result] || tryLbl.partly, hd = t.profiles && t.profiles.handle;
    h += `<div class="reply"><img class="av" src="${identicon(t.user_id || hd, hd)}" width="34" height="34" alt=""><div class="body"><div class="meta"><span class="who">${userLink(hd || "[deleted member]")}</span><span class="tg ${cls}">Try report: ${lbl}</span><span>${esc(day(t.created_at))}</span></div><pre>${esc(t.note)}</pre></div></div>`;
  });
  (reps.data || []).forEach(rr => {
    const pr = rr.profiles || {};
    h += `<div class="reply"><img class="av" src="${identicon(rr.author || rr.id, pr.handle)}" width="34" height="34" alt=""><div class="body"><div class="meta"><span class="who">${userLink(pr.handle || "[deleted member]")}</span>${pr.profession ? `<span>${esc(pr.profession)}</span>` : ""}<span>${esc(when(rr.created_at))}</span>${rr.status === "removed" ? '<span class="tg REMOVED">REMOVED</span>' : ""}
      <span class="acts">${S.me && rr.author !== S.me.id ? `<button class="btn" data-repr="${esc(rr.id)}">Report</button>` : ""}${S.me && (rr.author === S.me.id || S.me.role === "admin") ? `<button class="btn danger" data-delr="${esc(rr.id)}">Delete</button>` : ""}${mod && rr.status !== "removed" ? `<button class="btn danger" data-remr="${esc(rr.id)}">Remove</button>` : ""}</span></div>
      <pre>${esc(rr.body)}</pre></div></div>`;
  });
  if (!rl && !(tries.data || []).some(t => t.note)) h += `<div class="small" style="padding:4px 0 12px">No replies yet.</div>`;
  if (!S.me) h += `<div style="margin-top:12px">${needLogin("Replying")}</div>`;
  else if (p.status === "published") h += `<div style="padding-top:14px;border-top:1px solid var(--line)"><label class="sr" for="rtext">Reply</label><textarea id="rtext" maxlength="4000" placeholder="Did you try it? What happened? What would you change?"></textarea>
    <div class="trybar" style="margin-top:8px"><button class="btn blue" id="rsend">Post reply</button><span class="err" id="rmsg"></span></div></div>`;
  h += `</section></div>
  <aside class="colrail rail" aria-label="About this post">
    <div class="card card-pad"><h2 class="h3">About the author</h2>
      <div class="person"><img class="av" src="${identicon(p.author || "team", authorName(p))}" width="44" height="44" alt=""><div class="t"><div class="n">${userLink(authorName(p))}</div><div class="s">${esc(p.author_profession || (p.is_sample ? "Example content" : "Job title not given"))}</div></div></div>
      ${p.author_institution ? `<div class="small">${esc(p.author_institution)}</div>` : ""}
      ${r ? `<div class="small" style="margin-top:4px">${rankOf(r.rep, r.role)} · ${r.rep} reputation</div>` : ""}
</div>
  </aside></div>`;
  V.innerHTML = h;
  document.getElementById("crumbbar").innerHTML = b ? `<a href="${spaceHref(b.id)}">${esc(spaceName(b))}</a>` : "";
  document.title = p.title + " · Townhall";
  bindPromptBox(p);
  const ls = document.getElementById("libSave");
  if (ls) ls.onclick = async () => { busy(ls, true);
    const { data, error } = await sb.from("library_items").insert({ kind: "saved", source_post: p.id, type: p.type, title: p.title, body: p.body || "", prompt: p.prompt || "", tool_key: p.tool_key || "", knowledge_sources: p.knowledge_sources || [], tags: p.tags || [] }).select("id").single();
    if (error) { msg("actMsg", errMsg(error)); busy(ls, false); return; }
    toast("Saved to your library");
    const a = document.createElement("a"); a.className = "btn on"; a.href = "#lib-" + data.id; a.innerHTML = svg(IC.book) + "Saved. Open in library"; ls.replaceWith(a); };
  const msg = (id, t, ok) => { const el = document.getElementById(id); if (el) { el.className = ok ? "tries" : "err"; el.textContent = t; } };
  const reload = () => viewTopic(id);
  const lb = document.getElementById("likeBtn");
  if (lb) lb.onclick = async () => { lb.disabled = true; const on = S.myLikes.has(p.id);
    const { error } = on ? await sb.from("likes").delete().eq("post_id", p.id).eq("user_id", S.me.id) : await sb.from("likes").insert({ post_id: p.id });
    if (error) { msg("actMsg", errMsg(error)); lb.disabled = false; return; } on ? S.myLikes.delete(p.id) : S.myLikes.add(p.id); S.pop = on ? null : p.id; await reload(); S.pop = null; };
  V.querySelectorAll("[data-vote]").forEach(bn => bn.onclick = async () => {
    const v = +bn.dataset.vote, cur = S.myVotes.get(p.id); bn.disabled = true;
    const { error } = cur === v ? await sb.from("motion_votes").delete().eq("post_id", p.id).eq("user_id", S.me.id)
      : await sb.from("motion_votes").upsert({ post_id: p.id, user_id: S.me.id, vote: v });
    if (error) { msg("actMsg", errMsg(error)); bn.disabled = false; return; }
    cur === v ? S.myVotes.delete(p.id) : S.myVotes.set(p.id, v); reload(); });
  V.querySelectorAll('input[name="tr"]').forEach(r => r.addEventListener("change", () => { const m = document.getElementById("trMsg"); if (m) m.textContent = ""; }));
  V.querySelectorAll("[data-trygo]").forEach(b => b.onclick = () => {
    const sel = V.querySelector('input[name="tr"]:checked');
    if (!sel) { msg("trMsg", "Choose how it went first."); return; }
    remember("th-pendtry", { post_id: p.id, result: sel.value, note: document.getElementById("trNote").value.trim() });
    location.hash = b.dataset.trygo;
  });
  const ts = document.getElementById("trSave");
  if (ts) ts.onclick = async () => { const sel = V.querySelector('input[name="tr"]:checked'); if (!sel) { msg("trMsg", "Pick how it went first."); return; }
    busy(ts, true); const { error } = await sb.from("tries").upsert({ post_id: p.id, user_id: S.me.id, result: sel.value, note: document.getElementById("trNote").value.trim() });
    if (error) { msg("trMsg", errMsg(error)); busy(ts, false); return; } await reload(); toast("Thanks. Your try is recorded."); };
  const td = document.getElementById("trDel");
  if (td) td.onclick = async () => { await sb.from("tries").delete().eq("post_id", p.id).eq("user_id", S.me.id); reload(); };
  const rt = document.getElementById("retest");
  if (rt) rt.onclick = () => inlinePrompt(rt, "Model or version you re-tested with", p.model_version, async v => {
    const { error } = await sb.from("posts").update({ tested_on: new Date().toISOString().slice(0, 10), model_version: v.slice(0, 80) }).eq("id", p.id);
    if (error) msg("actMsg", errMsg(error)); else reload(); });
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
    const w = piiWarnings(v).filter(x => x.includes("blocked"));
    if (w.length) { msg("rmsg", "Remove " + w.join(", ").replace(/ \(this will be blocked\)/g, "") + " first."); return; }
    busy(rs, true); const { error } = await sb.from("replies").insert({ post_id: p.id, body: v });
    if (error) { msg("rmsg", errMsg(error)); busy(rs, false); return; } await reload(); toast("Reply posted");
  };
}
function motionBar(p) {
  const my = S.myVotes.get(p.id);
  return `<span class="vote">Score <b>${p.vote_score > 0 ? "+" : ""}${p.vote_score}</b> from ${p.vote_count} votes</span>
    ${S.me && p.status === "published" ? `<button class="btn ${my === 1 ? "on" : ""}" data-vote="1" aria-pressed="${my === 1}">For</button><button class="btn ${my === -1 ? "on" : ""}" data-vote="-1" aria-pressed="${my === -1}">Against</button>` : ""}`;
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

// ================= posting =================
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
const DUMMY_NOTE = `<b>No real data, anywhere in your post.</b> Townhall is public. Before you share, replace anything real in your prompt, agent instructions, knowledge sources, examples and screenshots with dummy data: made-up names, fake student IDs, sample figures, "Module ABC123". No personal data, no confidential institutional information, no internal links or file paths. <a href="#safe-sharing">What you can safely share</a>.`;
async function viewPost(boardId, forkId) {
  if (!S.me) { V.innerHTML = crumb("Share a build") + needLogin("Posting"); return; }
  if (S.me.banned) { V.innerHTML = crumb("Share a build") + `<div class="notice">Your account is suspended.</div>`; return; }
  let src = null;
  if (forkId) { const { data } = await sb.from("posts").select("*").eq("id", forkId).maybeSingle(); src = data; }
  const pre = !src && S.prefill ? S.prefill : null; S.prefill = null;
  const isAdmin = S.me.role === "admin";
  const types = isAdmin ? [...TYPES_ALL, "MEETING"] : TYPES_ALL;
  const def = src ? src.board_id : (boardId || "");
  const spaces = S.boards.filter(b => b.id !== "townhall");
  const ks = (src || pre) ? ((src || pre).knowledge_sources || []).map(k => ({ ...k })) : [];
  const shots = [];
  V.innerHTML = `${crumb(src ? "Fork a setup" : "Share a build")}
  ${src ? `<div class="okmsg">Forking <a href="#t-${esc(src.id)}">${esc(src.title)}</a>. Change what you did differently. The original author gets credit automatically.</div>` : ""}
  ${pre ? `<div class="okmsg">Publishing your library draft. Pick a space, add the numbers, then publish. Your draft stays in your library.</div>` : ""}
  <div class="notice dummy">${DUMMY_NOTE}</div>
  <form id="pf" novalidate>
   <section class="card card-pad fsec"><h2 class="h3">Where it goes</h2><div class="fgrid">
    ${fld("pfB", "Space", `<select id="pfB"><option value="">Choose a space...</option>${spaces.map(b => `<option value="${esc(b.id)}"${b.id === def ? " selected" : ""}>${esc(spaceName(b))}: ${esc(b.descr)}</option>`).join("")}</select>`, "Pick the task it helps with, not the tool. Use /other if nothing fits.", "boardrow")}
    ${fld("pfT", "Type", `<select id="pfT">${types.map(t => `<option${src && src.type === t ? " selected" : (!src && boardId === "townhall" && t === "MOTION" ? " selected" : "")}>${t}</option>`).join("")}</select>`, "WORKFLOW: something you do regularly. AGENT: a Copilot or other agent. TOOL: something you built. FAIL: what went wrong. QUESTION: ask colleagues.")}
   </div></section>
   <section class="card card-pad fsec"><h2 class="h3">What you built</h2>
    ${fld("pfS", "Title", `<input type="text" id="pfS" maxlength="120" placeholder="e.g. Exam board papers: 3 hours down to 45 minutes" value="${esc(src ? src.title + " (fork)" : "")}">`)}
    ${fld("pfM", "Description", `<textarea id="pfM" maxlength="8000" placeholder="What it does, who it's for, and how you use it day to day.">${esc(src ? src.body : "")}</textarea>`, "Shown as the summary on the feed.")}
    <div class="fld"><label for="shotIn">Screenshots <span class="small">(optional, up to 3)</span></label>
     <div class="hint">Upload or paste (Ctrl+V). Use screenshots of a test run with dummy data. Images are resized and their hidden metadata removed before upload.</div>
     <div class="shotpick"><label class="btn" for="shotIn">Add screenshot</label><input type="file" id="shotIn" accept="image/png,image/jpeg,image/webp" multiple class="sr"><span class="small" id="shotMsg"></span></div>
     <div class="shotprev" id="shotPrev"></div>
     <label class="chk" id="shotOkRow" style="display:none"><input type="checkbox" id="shotOk"> These screenshots show only dummy data: no real names, emails, IDs, marks or internal details are visible.</label></div>
   </section>
   <section class="card card-pad fsec bld"><h2 class="h3">The numbers</h2><div class="fgrid">
    ${fld("c8", "Tool", `<select id="c8"><option value="">Choose...</option>${Object.entries(TOOLS).map(([k, v]) => `<option value="${k}"${src && src.tool_key === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>`)}
    ${fld("c2", "Plan or licence", `<input type="text" id="c2" maxlength="120" placeholder="e.g. institution licence">`, "Optional")}
    ${fld("c6", "Model or version", `<input type="text" id="c6" maxlength="80" value="${esc(src ? src.model_version : "")}">`, 'Optional, e.g. "Copilot, Nov 2026"')}
    ${fld("c1", "Task", `<input type="text" id="c1" maxlength="300" value="${esc(src ? src.task : "")}">`, "In plain words")}
    ${fld("c3", "Minutes before", `<input type="number" id="c3" min="0" max="100000" inputmode="numeric">`, "How long it took without AI")}
    ${fld("c4", "Minutes after", `<input type="number" id="c4" min="0" max="100000" inputmode="numeric">`, "Including checking the output")}
    ${fld("c7", "Data that went in", `<select id="c7"><option value="">Choose...</option>${Object.entries(DATA_CLASS).map(([k, v]) => `<option value="${k}"${src && src.data_class === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>`, "What the tool handles when you use it. Your post itself must still use dummy data.")}
    ${fld("c5", "What went wrong", `<input type="text" id="c5" maxlength="400">`, "Required. Something always does.")}
   </div></section>
   <section class="card card-pad fsec bldp"><h2 class="h3" id="promptHead">Prompt or setup</h2>
    ${fld("pfP", `<span id="promptLbl">Prompt</span> <span class="small">(optional)</span>`, `<textarea id="pfP" maxlength="8000" style="min-height:160px;font-family:ui-monospace,Menlo,monospace;font-size:14px">${esc(src ? src.prompt : "")}</textarea>`, "Long prompts are folded on the post. Readers press See more to open them. Swap any real names, examples or figures for dummy ones.")}
    <div class="fld ksbox"><label>Knowledge sources <span class="small" id="ksReq">(optional)</span></label>
     <div class="hint">What the agent or tool reads from. Describe each in words, e.g. "Published regulations pages" or "Sample marking rubric (dummy)". No internal links, file paths, site names or tenant details.</div>
     <div id="ksList"></div><button type="button" class="btn" id="ksAdd" style="margin-top:8px">+ Add a source</button></div>
   </section>
   <section class="card card-pad fsec"><h2 class="h3">Finish</h2>
    ${fld("pfH", "Hashtags <span class='small'>(optional)</span>", `<input type="text" id="pfH" placeholder="#rubrics #minutes" value="${esc(src ? (src.tags || []).map(t => "#" + t).join(" ") : "")}"><div class="chips" style="margin-top:6px">${SUGGEST.map(t => `<a href="#" class="ht" data-tag="${t}">#${t}</a>`).join("")}</div>`)}
    <div id="pii" class="small"></div>
    <label class="chk"><input type="checkbox" id="pfOk"> I've replaced any real data with dummy data. There are no names, student or staff details, or confidential information in my prompt, knowledge sources, description or screenshots.</label>
    <div class="hint" style="margin-top:8px">Everything you post is shared under <a href="#terms">CC BY 4.0</a>: colleagues can reuse and adapt it with credit to you.</div>
    <div class="trybar" style="margin-top:14px"><button class="btn blue" type="submit" id="pfGo">Publish</button><span class="err" id="pfMsg" role="alert"></span></div>
    ${!isAdmin ? `<div class="hint" style="margin-top:6px">${S.me.ac_verified ? "Your university email means your posts go live straight away. The personal-data checks still apply." : "A moderator approves your posts before they go live, until three have been approved. Accounts with a university email (.ac.uk) skip this."}. Links unlock at 5 reputation.</div>` : ""}
   </section>
  </form>`;
  const g = id => document.getElementById(id).value.trim();
  if (pre) {
    const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
    set("pfT", pre.type); set("pfS", pre.title); set("pfM", pre.body); set("pfP", pre.prompt); set("c8", pre.tool_key);
    set("pfH", (pre.tags || []).map(t => "#" + t).join(" "));
  }
  const ksList = document.getElementById("ksList");
  const drawKs = () => {
    ksList.innerHTML = ks.map((k, i) => `<div class="ksrow"><select data-ksk="${i}" aria-label="Source type">${Object.entries(KS).map(([v, l]) => `<option value="${v}"${k.kind === v ? " selected" : ""}>${esc(l)}</option>`).join("")}</select><input type="text" data-ksn="${i}" maxlength="300" placeholder="Describe it in words" value="${esc(k.note || "")}" aria-label="Describe this source"><button type="button" class="btn" data-ksr="${i}">Remove</button></div>`).join("") || `<div class="small">None added yet.</div>`;
    document.getElementById("ksAdd").disabled = ks.length >= 10;
  };
  ksList.addEventListener("input", e => { const t = e.target; if (t.dataset.ksn) ks[+t.dataset.ksn].note = t.value; piiCheck(); });
  ksList.addEventListener("change", e => { const t = e.target; if (t.dataset.ksk) ks[+t.dataset.ksk].kind = t.value; });
  ksList.addEventListener("click", e => { const t = e.target.closest("[data-ksr]"); if (t) { ks.splice(+t.dataset.ksr, 1); drawKs(); } });
  document.getElementById("ksAdd").onclick = () => { if (ks.length < 10) { ks.push({ kind: "website", note: "" }); drawKs(); ksList.querySelector(`[data-ksn="${ks.length - 1}"]`).focus(); } };
  drawKs();
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
  const sync = () => {
    const t = g("pfT"), build = TYPES_BUILD.includes(t), civic = t === "MOTION" || t === "MEETING";
    V.querySelectorAll(".bld").forEach(r => r.style.display = build ? "" : "none");
    V.querySelector(".bldp").style.display = civic ? "none" : "";
    V.querySelector(".ksbox").style.display = build ? "" : "none";
    V.querySelector(".boardrow").style.display = civic ? "none" : "";
    document.getElementById("promptLbl").textContent = t === "AGENT" ? "Agent instructions" : t === "TOOL" ? "Prompt or setup" : "Prompt";
    document.getElementById("promptHead").textContent = t === "AGENT" ? "Agent setup" : "Prompt or setup";
    document.getElementById("ksReq").textContent = t === "AGENT" ? "(at least one)" : "(optional)";
  };
  const piiCheck = () => {
    const w = piiWarnings([g("pfS"), g("pfM"), g("pfP"), g("c1"), g("c2"), g("c5"), ks.map(k => k.note).join(" ")].join(" "));
    document.getElementById("pii").innerHTML = w.length ? `<div class="notice">This post may contain ${w.map(esc).join("; ")}. Swap it for dummy data.</div>` : "";
  };
  document.getElementById("pfT").onchange = sync; sync();
  V.querySelectorAll("#pf input[type=text], #pf textarea").forEach(el => el.addEventListener("input", piiCheck));
  V.querySelectorAll("[data-tag]").forEach(a => a.onclick = e => { e.preventDefault(); const i = document.getElementById("pfH"); const cur = parseTags(i.value); if (!cur.includes(a.dataset.tag)) { cur.push(a.dataset.tag); i.value = cur.map(t => "#" + t).join(" "); } });
  document.getElementById("pf").onsubmit = async e => {
    e.preventDefault(); const m = document.getElementById("pfMsg"); m.textContent = "";
    const type = g("pfT"), build = TYPES_BUILD.includes(type), civic = type === "MOTION" || type === "MEETING";
    const tags = parseTags(g("pfH") + " " + (g("pfM").match(/#[a-z0-9-]+/gi) || []).join(" "));
    const sources = ks.map(k => ({ kind: k.kind, note: (k.note || "").trim() })).filter(k => k.note || k.kind === "instructions-only");
    if (!civic && !g("pfB")) { m.textContent = "Choose a space."; return; }
    if (g("pfS").length < 3) { m.textContent = "Add a title."; return; }
    if (g("pfM").length < 20) { m.textContent = "Add a short description (at least a sentence)."; return; }
    if (build && (!g("c8") || !g("c1") || g("c3") === "" || g("c4") === "" || !g("c5") || !g("c7"))) { m.textContent = "Build posts need the tool, task, both times, the data used and what went wrong."; return; }
    if (type === "AGENT" && !sources.length) { m.textContent = 'Add at least one knowledge source, or "Instructions only".'; return; }
    if (shots.length && !document.getElementById("shotOk").checked) { m.textContent = "Confirm the screenshots show only dummy data."; return; }
    if (!document.getElementById("pfOk").checked) { m.textContent = "Tick the box to confirm you've used dummy data."; return; }
    const blocked = piiWarnings([g("pfS"), g("pfM"), g("pfP"), g("c1"), g("c5"), sources.map(k => k.note).join(" ")].join(" ")).filter(x => x.includes("blocked"));
    if (blocked.length) { m.textContent = "Remove " + blocked.join(", ").replace(/ \(this will be blocked\)/g, "") + " first."; return; }
    const btn = document.getElementById("pfGo"); busy(btn, true);
    const paths = [];
    for (const s of shots) {
      const path = `${S.me.id}/${rid()}.${s.blob.type === "image/webp" ? "webp" : s.blob.type === "image/png" ? "png" : "jpg"}`;
      const { error } = await sb.storage.from("shots").upload(path, s.blob, { contentType: s.blob.type, upsert: false });
      if (error) { if (paths.length) await sb.storage.from("shots").remove(paths); m.textContent = "Screenshot upload failed: " + errMsg(error); busy(btn, false); return; }
      paths.push(path);
    }
    const row = { board_id: civic ? "townhall" : g("pfB"), type, title: g("pfS"), tags, body: g("pfM"), prompt: civic ? "" : g("pfP"), screenshots: paths };
    if (build) Object.assign(row, { tool_key: g("c8"), tool: TOOLS[g("c8")] + (g("c2") ? ` (${g("c2")})` : ""), task: g("c1"), model_version: g("c6"), minutes_before: parseInt(g("c3"), 10), minutes_after: parseInt(g("c4"), 10), what_wrong: g("c5"), data_class: g("c7"), knowledge_sources: sources });
    if (src) row.forked_from = src.id;
    const { data, error } = await sb.from("posts").insert(row).select("id,status").single();
    if (error) { if (paths.length) await sb.storage.from("shots").remove(paths); m.textContent = errMsg(error); busy(btn, false); return; }
    shots.forEach(s => URL.revokeObjectURL(s.url));
    if (pre && pre.libId) await sb.from("library_items").update({ published_post: data.id }).eq("id", pre.libId);
    pendingToast(data.status === "pending" ? "Sent for approval. A moderator will check it soon." : "Published");
    location.hash = "t-" + data.id;
  };
}

// ================= notifications, CPD export, metrics =================
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
const NOTE_TXT = { reply: "replied to", try: "recorded a try on", fork: "forked", approved: "" };
const TRY_TXT = { worked: "It worked", partly: "Partly worked", failed: "Didn't work" };
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
    const line = n.kind === "approved" ? `Your post ${t} was approved and is now live.`
      : n.kind === "try" ? `${a} tried your workflow ${t}: <b>${esc(TRY_TXT[n.detail] || n.detail)}</b>.`
      : n.kind === "fork" ? `${a} forked ${t} as "${esc(n.detail)}".`
      : `${a} replied to ${t}: <span class="small">"${esc(n.detail)}${n.detail.length >= 140 ? "..." : ""}"</span>`;
    return `<div class="noterow${n.read_at ? "" : " unread"}"><span class="notedot" aria-hidden="true"></span><div>${line}<div class="small">${esc(ago(n.created_at))}${n.read_at ? "" : ' · <span class="sr">unread</span>New'}</div></div></div>`;
  };
  V.innerHTML = `${pageHead("Notifications", "Replies, tries and forks on your posts, and approvals. Kept for 120 days.")}
    ${list.length ? `<div class="card notelist">${list.map(row).join("")}</div>` : `<div class="empty">Nothing yet. When colleagues reply to, try or fork your posts, you'll see it here.</div>`}`;
  if (list.some(n => !n.read_at)) { await sb.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null); loadNotifCount(); }
}
function cpdRecord(posts, tries) {
  const lines = [`# Townhall contributions: ${S.me.handle}`, "", `Record generated ${day(new Date())}. Townhall is a community where UK higher education staff share what they have built with AI, with the time it took before and after, and colleagues record whether it worked for them.`, ""];
  const tot = { w: 0, p: 0, f: 0 }; posts.forEach(p => { tot.w += p.tries_worked; tot.p += p.tries_partly; tot.f += p.tries_failed; });
  lines.push("## Summary", "", `- Published posts: ${posts.length}`, `- Colleagues who tried my workflows: ${tot.w + tot.p + tot.f} (${tot.w} worked, ${tot.p} partly, ${tot.f} did not work)`, `- Workflows I tried and reported on: ${tries.length}`, `- Forks of my posts by colleagues: ${posts.reduce((a, p) => a + (p.forks || 0), 0)}`, "");
  if (posts.length) {
    lines.push("## My posts", "");
    posts.forEach(p => {
      const sv = saving(p);
      lines.push(`### ${p.title}`, `- ${p.type}, ${board(p.board_id) ? spaceName(board(p.board_id)) : p.board_id}, published ${day(p.created_at)}`, `- Link: ${SITE()}#t-${p.id}`);
      if (TYPES_BUILD.includes(p.type)) lines.push(`- Task: ${p.task}`, `- Tool: ${p.tool}`, `- Time: ${p.minutes_before} minutes before, ${p.minutes_after} after${sv != null ? ` (${sv}% less, self-reported)` : ""}`, `- What went wrong: ${p.what_wrong}`);
      if (TRYABLE.includes(p.type)) lines.push(`- Tried by colleagues: ${p.tries_worked} worked, ${p.tries_partly} partly, ${p.tries_failed} did not work`);
      lines.push(`- Replies: ${p.replies}, likes: ${p.likes}, forks: ${p.forks || 0}`, "");
    });
  }
  if (tries.length) { lines.push("## Workflows I tried", ""); tries.forEach(t => lines.push(`- ${day(t.created_at)}: ${TRY_TXT[t.result] || t.result}${t.note ? ` (${t.note})` : ""} - ${SITE()}#t-${t.post_id}`)); lines.push(""); }
  lines.push("## Reflection (fill in)", "", "- What I learned about using AI in my role:", "- How this changed my practice or my team's practice:", "- What I would do differently:", "");
  return lines.join("\n");
}
async function loadMetrics() {
  const box = document.getElementById("metrics"); if (!box || !S.me || S.me.role !== "admin") return;
  const { data, error } = await sb.rpc("admin_metrics");
  if (error || !data) { box.innerHTML = `<div class="small">Weekly figures unavailable: ${esc(error ? errMsg(error) : "no data")}</div>`; return; }
  const w = (data.weeks || []).slice().reverse();
  box.innerHTML = `<div class="box"><h2 class="h3">How it's going (admins only)</h2><div class="in">
    <div class="small" style="margin-bottom:8px">The main measure is <b>tries per week</b>: colleagues reusing a workflow, not just reading it. Visits are counted per page type per day, with no cookies and nothing that identifies a person.</div>
    <table class="fl"><thead><tr><th scope="col">Week from</th><th scope="col">Tries</th><th scope="col">Posts</th><th scope="col">Replies</th><th scope="col">New members</th><th scope="col">Visits</th></tr></thead>
    <tbody>${w.map(r => `<tr><td>${esc(r.week)}</td><td><b>${r.tries}</b></td><td>${r.posts}</td><td>${r.replies}</td><td>${r.members}</td><td>${r.views}</td></tr>`).join("")}</tbody></table>
    ${(data.top_pages || []).length ? `<div class="small" style="margin-top:10px">Most visited, last 4 weeks: ${data.top_pages.map(t => `${esc(t.path)} (${t.views})`).join(", ")}</div>` : ""}
  </div></div>`;
}

// ================= my library =================
const LIB_COLS = "id,kind,source_post,published_post,type,title,body,prompt,notes,tool_key,knowledge_sources,tags,snapshot_at,created_at,updated_at";
const LIB_TYPES = ["WORKFLOW", "AGENT", "TOOL", "FAIL", "QUESTION"];
const PRIVATE_NOTE = `<b>Only you can see your library.</b> Private still means no real data. Townhall blocks personal details here as well, so keep using dummy data in prompts, notes and knowledge sources.`;
let libTab = "all";
const isUpdated = (it, src) => !!(src && it.snapshot_at && new Date(src.updated_at) > new Date(it.snapshot_at));
function download(name, text, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function libMarkdown(items) {
  const fence = t => "```text\n" + t.replace(/```/g, "'''") + "\n```";
  return `# My Townhall library\n\nExported ${day(new Date())}. ${items.length} items.\n\n` + items.map(i => [
    `## ${i.title}`,
    `- ${i.kind === "saved" ? `Saved from ${SITE()}#t-${i.source_post || "(removed)"}` : "Draft"}`,
    `- Type: ${i.type}${i.tool_key ? `, tool: ${TOOLS[i.tool_key] || i.tool_key}` : ""}`,
    (i.tags || []).length ? `- Tags: ${i.tags.map(t => "#" + t).join(" ")}` : "",
    i.body ? `\n### Description\n\n${i.body}` : "",
    i.prompt ? `\n### ${i.type === "AGENT" ? "Agent instructions" : "Prompt"}\n\n${fence(i.prompt)}` : "",
    (i.knowledge_sources || []).length ? `\n### Knowledge sources\n\n${i.knowledge_sources.map(k => `- ${KS[k.kind] || k.kind}: ${k.note || ""}`).join("\n")}` : "",
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
      <div class="post-head"><span class="tg ${i.kind === "draft" ? "PENDING" : "SAMPLE"}">${i.kind === "draft" ? "Draft" : "Saved"}</span>${typeTag(i.type)}${upd ? '<span class="tg STALE">Updated since you saved</span>' : ""}${i.kind === "saved" && !i.source_post ? '<span class="tg REMOVED">Original removed</span>' : ""}${i.published_post ? '<span class="tg WORKFLOW">Published</span>' : ""}<span class="when">Edited ${esc(ago(i.updated_at))}</span></div>
      <a class="post-title" href="#lib-${esc(i.id)}">${esc(i.title)}</a>
      ${i.body ? `<p class="post-sum">${esc(i.body.slice(0, 300))}</p>` : ""}
      <div class="post-foot">${i.tool_key ? `<span class="toolchip">${esc(TOOLS[i.tool_key] || i.tool_key)}</span>` : ""}${src ? `<span>From ${userLink(authorName(src))}</span>${TRYABLE.includes(src.type) ? tryMeter(src) : ""}` : ""}${i.notes ? `<span>Your notes: ${esc(i.notes.slice(0, 60))}${i.notes.length > 60 ? "..." : ""}</span>` : ""}</div>
    </div></article>`;
  };
  const draw = () => {
    const list = items.filter(i => libTab === "all" || i.kind === libTab);
    V.innerHTML = `${pageHead("My library", "Prompts, agents and workflows you've saved or are drafting. Saving a post keeps your own editable copy, linked to the original so you see when the author updates it.", `<button class="btn" id="exJson">Export JSON</button><button class="btn" id="exMd">Export Markdown</button><a class="btn blue" href="#lib-new">New draft</a>`)}
      <div class="notice dummy small">${PRIVATE_NOTE}</div>
      <div class="feedbar"><div class="tabs" role="tablist">${[["all", "All"], ["saved", "Saved"], ["draft", "Drafts"]].map(([k, l]) => `<a href="#" role="tab" data-lt="${k}" class="${libTab === k ? "on" : ""}" aria-selected="${libTab === k}">${l} <span class="small">${counts[k]}</span></a>`).join("")}</div></div>
      ${list.length ? `<div class="feed">${list.map(card).join("")}</div>` : `<div class="empty">${libTab === "draft" ? `No drafts yet. <a href="#lib-new">Start one</a>.` : `Nothing saved yet. Press <b>Save to library</b> on any post you want to keep.`}</div>`}`;
    V.querySelectorAll("[data-lt]").forEach(a => a.onclick = e => { e.preventDefault(); libTab = a.dataset.lt; draw(); });
    document.getElementById("exJson").onclick = () => download("townhall-library.json", JSON.stringify(items.map(({ id, ...r }) => r), null, 2), "application/json");
    document.getElementById("exMd").onclick = () => download("townhall-library.md", libMarkdown(items), "text/markdown");
  };
  draw();
}
async function viewLibItem(id) {
  if (!S.me) { V.innerHTML = crumb("My library") + needLogin("Your library"); return; }
  const isNew = id === "new";
  const it = isNew ? { kind: "draft", type: "WORKFLOW", title: "", body: "", prompt: "", notes: "", tool_key: "", knowledge_sources: [], tags: [] }
    : (await sb.from("library_items").select(LIB_COLS).eq("id", id).maybeSingle()).data;
  if (!it) return viewNotFound("That library item doesn't exist, or it isn't yours.");
  const src = it.source_post ? (await sb.from("post_feed").select("*").eq("id", it.source_post).maybeSingle()).data : null;
  const upd = isUpdated(it, src);
  const ks = (it.knowledge_sources || []).map(k => ({ ...k }));
  document.getElementById("crumbbar").innerHTML = `<a href="#library">My library</a>`;
  document.title = (isNew ? "New draft" : it.title) + " · Townhall";
  V.innerHTML = `${pageHead(isNew ? "New draft" : esc(it.title), it.kind === "saved"
      ? (src ? `Your copy of <a href="#t-${esc(src.id)}">${esc(src.title)}</a> by ${userLink(authorName(src))}. Edit it freely: the original doesn't change.` : "The original post has been removed. Your copy is still here.")
      : "A private draft. Publish it to a space when it's ready.", `<a class="btn" href="#library">Back to library</a>`)}
    <div class="notice dummy small">${PRIVATE_NOTE}</div>
    ${upd ? `<div class="okmsg trybar">The author has updated or re-tested this since you saved it. <button type="button" class="btn" id="libRefresh">Replace my copy with the latest version</button><a href="#t-${esc(src.id)}">See the original</a></div>` : ""}
    ${it.published_post ? `<div class="okmsg">You published this draft as <a href="#t-${esc(it.published_post)}">a post</a>.</div>` : ""}
    <form id="lf" novalidate><section class="card card-pad fsec">
     <div class="fgrid">
      ${fld("lT", "Title", `<input type="text" id="lT" maxlength="120" value="${esc(it.title)}">`, "", "full")}
      ${fld("lY", "Type", `<select id="lY">${LIB_TYPES.map(t => `<option${it.type === t ? " selected" : ""}>${t}</option>`).join("")}</select>`)}
      ${fld("lTool", "Tool", `<select id="lTool"><option value="">Not set</option>${Object.entries(TOOLS).map(([k, v]) => `<option value="${k}"${it.tool_key === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>`)}
     </div>
     ${fld("lB", "Description", `<textarea id="lB" maxlength="8000">${esc(it.body)}</textarea>`)}
     ${fld("lP", `<span id="lPl">${it.type === "AGENT" ? "Agent instructions" : "Prompt"}</span>`, `<textarea id="lP" maxlength="8000" style="min-height:200px;font-family:ui-monospace,Menlo,monospace;font-size:14px">${esc(it.prompt)}</textarea>`)}
     <div class="fld"><label>Knowledge sources</label><div class="hint">Describe each in words. No internal links, file paths or site names.</div><div id="lKs"></div><button type="button" class="btn" id="lKsAdd" style="margin-top:8px">+ Add a source</button></div>
     ${fld("lN", "My notes <span class='small'>(private)</span>", `<textarea id="lN" maxlength="4000" placeholder="What you changed, what to try next, where you use it.">${esc(it.notes)}</textarea>`)}
     ${fld("lH", "Tags", `<input type="text" id="lH" value="${esc((it.tags || []).map(t => "#" + t).join(" "))}" placeholder="#rubrics #minutes">`)}
     <div id="lPii" class="small"></div>
     <div class="trybar"><button class="btn blue" type="submit" id="lSave">${isNew ? "Save draft" : "Save"}</button>
      ${!isNew && it.kind === "draft" ? `<button type="button" class="btn" id="lPub">Publish to a space</button>` : ""}
      ${it.kind === "saved" && src && TYPES_BUILD.includes(src.type) ? `<a class="btn" href="#fork-${esc(src.id)}">Fork publicly</a>` : ""}
      ${!isNew ? `<button type="button" class="btn danger" id="lDel">Delete</button>` : ""}<span id="lMsg" role="status"></span></div>
    </section></form>`;
  const g = x => document.getElementById(x).value.trim();
  const out = (t, ok) => { const el = document.getElementById("lMsg"); el.className = ok ? "tries" : "err"; el.textContent = t; };
  const ksEl = document.getElementById("lKs");
  const drawKs = () => { ksEl.innerHTML = ks.map((k, i) => `<div class="ksrow"><select data-ksk="${i}" aria-label="Source type">${Object.entries(KS).map(([v, l]) => `<option value="${v}"${k.kind === v ? " selected" : ""}>${esc(l)}</option>`).join("")}</select><input type="text" data-ksn="${i}" maxlength="300" value="${esc(k.note || "")}" aria-label="Describe this source"><button type="button" class="btn" data-ksr="${i}">Remove</button></div>`).join("") || `<div class="small">None.</div>`; document.getElementById("lKsAdd").disabled = ks.length >= 10; };
  ksEl.addEventListener("input", e => { if (e.target.dataset.ksn) ks[+e.target.dataset.ksn].note = e.target.value; });
  ksEl.addEventListener("change", e => { if (e.target.dataset.ksk) ks[+e.target.dataset.ksk].kind = e.target.value; });
  ksEl.addEventListener("click", e => { const b = e.target.closest("[data-ksr]"); if (b) { ks.splice(+b.dataset.ksr, 1); drawKs(); } });
  document.getElementById("lKsAdd").onclick = () => { if (ks.length < 10) { ks.push({ kind: "website", note: "" }); drawKs(); } };
  drawKs();
  document.getElementById("lY").onchange = () => document.getElementById("lPl").textContent = g("lY") === "AGENT" ? "Agent instructions" : "Prompt";
  const piiCheck = () => { const w = piiWarnings([g("lT"), g("lB"), g("lP"), g("lN"), ks.map(k => k.note).join(" ")].join(" ")); document.getElementById("lPii").innerHTML = w.length ? `<div class="notice">This may contain ${w.map(esc).join("; ")}. Swap it for dummy data.</div>` : ""; };
  V.querySelectorAll("#lf input[type=text], #lf textarea").forEach(el => el.addEventListener("input", piiCheck));
  const payload = () => ({ title: g("lT"), type: g("lY"), tool_key: g("lTool"), body: g("lB"), prompt: g("lP"), notes: g("lN"), tags: parseTags(g("lH")), knowledge_sources: ks.map(k => ({ kind: k.kind, note: (k.note || "").trim() })).filter(k => k.note || k.kind === "instructions-only") });
  const save = async () => {
    const row = payload();
    if (!row.title) { out("Add a title."); return null; }
    const blocked = piiWarnings([row.title, row.body, row.prompt, row.notes, row.knowledge_sources.map(k => k.note).join(" ")].join(" ")).filter(x => x.includes("blocked"));
    if (blocked.length) { out("Remove " + blocked.join(", ").replace(/ \(this will be blocked\)/g, "") + " first."); return null; }
    if (isNew) { const { data, error } = await sb.from("library_items").insert({ kind: "draft", ...row }).select("id").single(); if (error) { out(errMsg(error)); return null; } return data.id; }
    const { error } = await sb.from("library_items").update(row).eq("id", it.id); if (error) { out(errMsg(error)); return null; } return it.id;
  };
  document.getElementById("lf").onsubmit = async e => { e.preventDefault(); const b = document.getElementById("lSave"); busy(b, true); const nid = await save(); busy(b, false); if (!nid) return; if (isNew) { pendingToast("Draft saved"); location.hash = "lib-" + nid; } else toast("Saved"); };
  const pub = document.getElementById("lPub");
  if (pub) pub.onclick = async () => { const nid = await save(); if (!nid) return; S.prefill = { libId: nid, ...payload() }; location.hash = "post"; };
  const del = document.getElementById("lDel");
  if (del) del.onclick = () => confirmTwice(del, async () => { const { error } = await sb.from("library_items").delete().eq("id", it.id); if (error) out(errMsg(error)); else location.hash = "library"; });
  const rf = document.getElementById("libRefresh");
  if (rf) rf.onclick = () => confirmTwice(rf, async () => {
    const { error } = await sb.from("library_items").update({ title: src.title, type: LIB_TYPES.includes(src.type) ? src.type : it.type, body: src.body || "", prompt: src.prompt || "", tool_key: src.tool_key || "", knowledge_sources: src.knowledge_sources || [], tags: src.tags || [], snapshot_at: src.updated_at || new Date().toISOString() }).eq("id", it.id);
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
    <label for="aP" style="display:block;margin-top:6px">Job title <span class="small">(optional, shown on your posts)</span></label><input type="text" id="aP" maxlength="60" placeholder="e.g. Learning technologist">
    <label for="aA" style="display:block;margin-top:6px">Area of work</label><select id="aA"><option value="">Choose...</option>${AREAS.map(x => `<option>${esc(x)}</option>`).join("")}</select>
    <label for="aI" style="display:block;margin-top:6px">Institution <span class="small">(optional, shown publicly; leave blank to stay unnamed)</span></label><input type="text" id="aI" maxlength="80">` : ""}
    <label for="aE" style="display:block;margin-top:6px">Email</label><input type="email" id="aE" autocomplete="email">${join ? `<div class="hint">Any email works. Use your university email (.ac.uk) to get the verified "ac.uk" badge. Your email is never shown.</div>` : ""}
    <label for="aW" style="display:block;margin-top:6px">Password</label><input type="password" id="aW" autocomplete="${join ? "new-password" : "current-password"}" minlength="8">
    ${join ? `<label style="display:block;margin-top:4px"><input type="checkbox" id="aR"> I'm 18 or over and I agree to the <a href="#terms">terms</a> and <a href="#rules">house rules</a>, including sharing my posts under CC BY 4.0. I've read the <a href="#privacy">privacy notice</a>.</label>` : ""}
    <div style="margin-top:8px"><button class="btn" type="submit">${join ? "Join" : "Log in"}</button></div>
    <div id="aMsg" role="alert" style="margin-top:6px"></div>
   </form>
   ${join ? `<div class="small" style="margin-top:6px">Already a member? <a href="#login">Log in</a></div>` : `<div class="small" style="margin-top:6px">New here? <a href="#join">Join</a> | <a href="#" id="forgot">Forgot password</a> | <a href="#" id="magic">Email me a login link</a></div>`}
  </div></div>
  <div class="box"><h2 class="h3">Why join?</h2><div class="in">See what staff at other universities have built with AI, record whether their workflows worked for you, share your own, follow the categories you work in, and vote on motions about how the site is run.<br><br>Anyone can join with any email address. Members who use a university email (.ac.uk) get an "ac.uk" badge on their posts, so readers can see who works in the sector. We store your email to log you in and your posts to show them. Nothing is sold. See the <a href="#privacy">privacy notice</a>.</div></div></div>`;
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
      if (!g("aA")) return out("Choose your area of work.");
      if (!document.getElementById("aR").checked) return out("Please confirm you're 18 or over and agree to the terms and house rules.");
      const { data, error } = await sb.auth.signUp({ email, password: pw, options: { data: { handle, profession: g("aP"), staff_area: g("aA"), institution: g("aI") }, emailRedirectTo: SITE() } });
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
    const { error } = await sb.from("tries").upsert({ post_id: pend.post_id, user_id: S.me.id, result: pend.result, note: pend.note || "" });
    pendingToast(error ? "We couldn't save your try. " + errMsg(error) : "Your try is recorded");
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
     Rank: <b>${rankOf(rep ? rep.rep : 0, S.me.role)}</b> (reputation ${rep ? rep.rep : 0})<br><span class="small">You earn 3 for each "it worked" on your posts, 1 for "partly", and 1 per published post.</span><br><br>
     <label for="sH">Username</label><input type="text" id="sH" maxlength="20" value="${esc(S.me.handle)}">
     <label for="sP" style="display:block;margin-top:6px">Job title</label><input type="text" id="sP" maxlength="60" value="${esc(S.me.profession)}">
     <label for="sA" style="display:block;margin-top:6px">Area of work</label><select id="sA"><option value="">Not given</option>${AREAS.map(x => `<option${S.me.staff_area === x ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>
     <label for="sI" style="display:block;margin-top:6px">Institution</label><input type="text" id="sI" maxlength="80" value="${esc(S.me.institution)}">
     <label class="chk"><input type="checkbox" id="sHide"${S.me.hide_institution ? " checked" : ""}> Hide my institution from other people. Your posts show your area of work only.</label>
     <label style="display:block;margin-top:6px"><input type="checkbox" id="sD"${prefs.digest ? " checked" : ""}> Send me a weekly email digest of the categories I follow</label>
     <div class="small">Digest emails start once the mail service is connected.</div>
     <div style="margin-top:6px"><button class="btn" id="sGo">Save</button> <span id="sMsg" role="alert"></span></div>
   </div></div>
   ${displayBox()}
  </div>
  <div class="box"><h2 class="h3">Following</h2><div class="in">${S.myFollows.length ? S.myFollows.map(f => f.kind === "tag" ? `<a class="ht" href="#tag-${esc(f.target)}">#${esc(f.target)}</a>` : `<a class="ht" href="${spaceHref(f.target)}">${esc(board(f.target) ? spaceName(board(f.target)) : f.target)}</a>`).join(" ") : "Nothing yet."}</div></div>
  <div class="box"><h2 class="h3">Your data</h2><div class="in">
    <button class="btn" id="cpd">Download my contributions (CPD record)</button> <button class="btn" id="exp">Show a copy of my data</button> <button class="btn danger" id="delAcc">Delete my account</button>
    <div class="small" style="margin-top:4px">The CPD record lists your posts, how colleagues got on with them, and the workflows you tried, ready to use as evidence of practice (for example in a Fellowship application). Deleting removes your login, profile, library, notifications, likes, tries, votes and follows. Your posts stay up as "[deleted member]" unless you delete them first.</div>
    <pre id="expOut" class="small" style="margin-top:6px"></pre></div></div>`;
  bindDisplay();
  document.getElementById("sGo").onclick = async () => {
    const m = document.getElementById("sMsg"), h = document.getElementById("sH").value.trim().toLowerCase(), sb2 = document.getElementById("sGo");
    if (!/^[a-z0-9_]{3,20}$/.test(h)) { m.className = "err"; m.textContent = "Usernames are 3 to 20 letters, numbers or underscores."; return; }
    const { error } = await sb.from("profiles").update({ handle: h, profession: document.getElementById("sP").value.trim(), staff_area: document.getElementById("sA").value, institution: document.getElementById("sI").value.trim(), hide_institution: document.getElementById("sHide").checked, prefs: { ...prefs, digest: document.getElementById("sD").checked } }).eq("id", S.me.id);
    m.className = "err"; m.textContent = error ? (/duplicate|unique/i.test(error.message) ? "That username is taken." : errMsg(error)) : "";
    if (!error) { await loadMe(); toast("Settings saved"); }
  };
  document.getElementById("cpd").onclick = async () => {
    const [po, tr] = await Promise.all([fetchPosts(publishedPosts().eq("author", S.me.id)), sb.from("tries").select("post_id,result,note,created_at").eq("user_id", S.me.id).order("created_at", { ascending: false })]);
    download(`townhall-cpd-${S.me.handle}.md`, cpdRecord(sorted(po, "new"), tr.data || []), "text/markdown");
  };
  document.getElementById("exp").onclick = async () => {
    const id = S.me.id;
    const [po, re, tr, li, vo, lb] = await Promise.all([sb.from("posts").select("*").eq("author", id), sb.from("replies").select("*").eq("author", id), sb.from("tries").select("*").eq("user_id", id), sb.from("likes").select("*").eq("user_id", id), sb.from("motion_votes").select("*").eq("user_id", id), sb.from("library_items").select("*").eq("owner", id)]);
    document.getElementById("expOut").textContent = JSON.stringify({ account: { email: S.session.user.email, ...S.me }, posts: po.data, replies: re.data, tries: tr.data, likes: li.data, votes: vo.data, follows: S.myFollows, library: lb.data }, null, 2);
  };
  const da = document.getElementById("delAcc");
  da.onclick = () => confirmTwice(da, async () => { const { error } = await sb.rpc("delete_my_account"); if (error) { da.textContent = errMsg(error); return; } await sb.auth.signOut(); location.hash = "index"; });
}

// ================= people & stats =================
async function viewProfile(handle) {
  const { data: u } = await sb.from("member_directory").select("*").eq("handle", handle).maybeSingle();
  if (!u) return viewNotFound("No member with that name.");
  const [posts, wd, tr] = await Promise.all([fetchPosts(publishedPosts().eq("author", u.id)), sb.from("board_mods").select("board_id").eq("user_id", u.id), sb.from("tries").select("post_id", { count: "exact", head: true }).eq("user_id", u.id)]);
  const wards = wd.data || [], triedN = tr.count || 0;
  const active = [...new Set(posts.map(p => p.board_id))].map(board).filter(Boolean);
  const isClerk = S.me && S.me.role === "admin" && u.role !== "admin";
  V.innerHTML = `<div class="grid2"><div class="colmain">
   <section class="card card-pad" style="margin-bottom:16px">
    <div class="post-head" style="align-items:flex-start;gap:16px"><img class="av" src="${identicon(u.id, u.handle)}" width="72" height="72" alt=""><div style="min-width:0"><h1 class="h-page">${esc(u.handle)}</h1>
      <div class="small" style="margin-top:2px">${[u.profession, u.staff_area, u.institution].filter(Boolean).map(esc).join(" · ") || "Job title not given"}</div>
      <div class="trybar" style="margin-top:6px">${verified(u.ac_verified)}<span class="small">Member since ${esc(day(u.created_at))} · ${rankOf(u.rep, u.role)}</span></div></div></div>
    <div class="stats3"><div><b>${posts.length}</b><span>Posts</span></div><div><b>${triedN}</b><span>Tries recorded</span></div><div><b>${u.rep}</b><span>Reputation</span></div></div>
    ${active.length ? `<div class="small" style="margin-bottom:6px">Posts in</div>${active.map(b => `<a class="ht" href="${spaceHref(b.id)}">${esc(spaceName(b))}</a>`).join("")}` : ""}
    ${wards.length ? `<div class="small" style="margin:8px 0 6px">Ward moderator for</div>${wards.map(w => `<a class="ht" href="${spaceHref(w.board_id)}">${esc(board(w.board_id) ? spaceName(board(w.board_id)) : w.board_id)}</a>`).join("")}` : ""}
    ${isClerk ? `<div class="notice trybar small" style="margin-top:12px">Clerk tools: <button class="btn danger" id="ban">Suspend</button><button class="btn" id="unban">Restore</button><select id="wardB" style="width:auto" aria-label="Category to moderate">${S.boards.map(b => `<option value="${esc(b.id)}">${esc(spaceName(b))}</option>`).join("")}</select><button class="btn" id="wardAdd">Make ward moderator</button><button class="btn" id="wardDel">Remove as moderator</button><span id="admMsg"></span></div>` : ""}
   </section>
   <h2 style="font-size:22px;margin:8px 0 0">Posts</h2>${feed(sorted(posts, "new"), true, "No published posts yet.")}
  </div>
  <aside class="colrail rail"><div class="card card-pad"><h2 class="h3">Reputation</h2><div class="small">Earned when colleagues say a workflow worked for them: 3 for "it worked", 1 for "partly", 1 per published post. Ranks: Resident (0-4), Citizen (5-19), Councillor (20-59), Alderman (60+).</div></div></aside></div>`;
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
async function viewStats() {
  const { data } = await sb.from("tag_savings").select("*").order("posts", { ascending: false }).limit(200);
  const list = data || [];
  V.innerHTML = `${crumb("Time saved")}<div class="notice">These figures come from authors' own before and after times. Nobody has checked them. Treat them as a rough guide, and look at the "I tried this" counts on each post for a second opinion.</div>
  <table class="fl"><tr><th>Hashtag</th><th class="ctr">Build posts</th><th class="ctr">Median saving</th><th class="ctr hide-s">Total time saved</th></tr>
  ${list.map((s, i) => `<tr><td class="${i % 2 ? "r2" : "r1"}"><a class="ht" href="#tag-${esc(s.tag)}">#${esc(s.tag)}</a></td><td class="${i % 2 ? "r2" : "r1"} ctr">${s.posts}</td><td class="${i % 2 ? "r2" : "r1"} ctr"><b>${s.median_saving_pct}%</b></td><td class="${i % 2 ? "r2" : "r1"} ctr hide-s">${fmtMins(s.minutes_saved_total)}</td></tr>`).join("") || `<tr><td class="r1" colspan="4">No build posts yet.</td></tr>`}</table>`;
}
async function viewSearch() {
  const all = await fetchPosts(publishedPosts());
  V.innerHTML = `${crumb("Search")}<div class="box"><div class="in" style="padding-top:18px"><label class="sr" for="q">Search</label><input type="text" id="q" placeholder="Words or #hashtags, e.g. rota #copilot">
  <div style="margin-top:6px"><label for="qt">Type:</label> <select id="qt" style="width:auto"><option value="">Any</option>${TYPES_ALL.map(t => `<option>${t}</option>`).join("")}</select></div></div></div><div id="res"></div>`;
  const run = () => {
    const raw = document.getElementById("q").value.toLowerCase(), ty = document.getElementById("qt").value;
    const tags = (raw.match(/#[a-z0-9-]+/g) || []).map(cleanTag), words = raw.replace(/#[a-z0-9-]+/g, " ").split(/\s+/).filter(Boolean);
    const r = all.filter(p => (!ty || p.type === ty) && tags.every(t => (p.tags || []).includes(t)) && words.every(w => (p.title + " " + (p.tags || []).join(" ")).toLowerCase().includes(w)));
    document.getElementById("res").innerHTML = feed(sorted(r), true, "No posts match that search.");
  };
  if (S.pendingQuery) { document.getElementById("q").value = S.pendingQuery; S.pendingQuery = ""; }
  document.getElementById("q").oninput = run; document.getElementById("qt").onchange = run; run();
}

// ================= moderation =================
async function viewMod() {
  if (!S.isMod) return viewNotFound();
  const [pend, reps] = await Promise.all([
    sb.from("post_feed").select(FEED_COLS + ",body").eq("status", "pending").order("created_at"),
    sb.from("reports").select("id,reason,created_at,post_id,reply_id,status,posts(title,board_id),replies(body,post_id)").eq("status", "open").order("created_at")
  ]);
  const pp = (pend.data || []).filter(p => isModOf(p.board_id));
  V.innerHTML = `${crumb("Moderation")}<div id="metrics"></div>
  <table class="fl"><tr><th colspan="3">Waiting for approval (${pp.length})</th></tr>
  ${pp.map((p, i) => `<tr><td class="${i % 2 ? "r2" : "r1"}">${typeTag(p.type)}<a class="b" href="#t-${esc(p.id)}">${esc(p.title)}</a><br><span class="small">${userLink(p.author_handle)} in ${esc((board(p.board_id) || {}).name || p.board_id)}, ${esc(when(p.created_at))}</span><pre class="small">${esc((p.body || "").slice(0, 300))}</pre></td>
   <td class="${i % 2 ? "r2" : "r1"} ctr"><button class="btn" data-ap="${esc(p.id)}">Approve</button></td><td class="${i % 2 ? "r2" : "r1"} ctr"><button class="btn danger" data-rm="${esc(p.id)}">Remove</button></td></tr>`).join("") || `<tr><td class="r1" colspan="3">Nothing waiting.</td></tr>`}
  </table>
  <table class="fl"><tr><th colspan="3">Open reports (${(reps.data || []).length})</th></tr>
  ${(reps.data || []).map((r, i) => `<tr><td class="${i % 2 ? "r2" : "r1"}">"${esc(r.reason)}"<br><span class="small">${r.post_id ? `Post: <a href="#t-${esc(r.post_id)}">${esc(r.posts ? r.posts.title : "")}</a>` : `Reply on <a href="#t-${esc(r.replies ? r.replies.post_id : "")}">this topic</a>: ${esc(r.replies ? r.replies.body.slice(0, 120) : "")}`} | ${esc(when(r.created_at))}</span></td>
   <td class="${i % 2 ? "r2" : "r1"} ctr"><button class="btn danger" data-act="${esc(r.id)}">Remove content</button></td><td class="${i % 2 ? "r2" : "r1"} ctr"><button class="btn" data-dis="${esc(r.id)}">Dismiss</button></td></tr>`).join("") || `<tr><td class="r1" colspan="3">No open reports.</td></tr>`}
  </table>
  <div class="small">Keep a short note of serious reports and what you did. Under the Online Safety Act you should be able to show how you handle illegal content.</div>`;
  const re = () => viewMod();
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
  const code = `<a href="${site}"><img src="${site.replace(/[^/]*$/, "")}badge.png" width="88" height="31" alt="Featured on Townhall"></a>`;
  V.innerHTML = `${crumb("Get a badge")}<div class="box"><h2 class="h3">Featured on Townhall</h2><div class="in">
    <img src="badge.png" width="88" height="31" alt="Featured on Townhall badge" style="image-rendering:pixelated"><br><br>
    Paste this into your own site to link back to Townhall:
    <textarea id="bc" readonly style="min-height:60px">${esc(code)}</textarea>
    <button class="btn" id="cp">Copy</button> <span id="cpm" class="small"></span></div></div>`;
  document.getElementById("cp").onclick = async () => { try { await navigator.clipboard.writeText(code); document.getElementById("cpm").textContent = "Copied."; } catch (_) { document.getElementById("bc").select(); document.getElementById("cpm").textContent = "Press Ctrl+C to copy."; } };
}
function viewFaq() {
  V.innerHTML = `${crumb("FAQ")}<table class="fl"><tr><th>Frequently asked questions</th></tr>
  <tr><td class="r1"><b>Who is Townhall for?</b><br>Staff at UK universities and colleges: academics, professional services, researchers, learning technologists, library and IT teams. Anyone can read. Anyone can join with any email address. Accounts that use a .ac.uk email show an "ac.uk" badge, so readers can see who is verified as working at a UK university or college.</td></tr>
  <tr><td class="r2"><b>Is this run by my university?</b><br>No. Townhall is independent. Post as yourself, and only share what your institution would be happy to see in public.</td></tr>
  <tr><td class="r1"><b>What's the difference between Like and "I tried this"?</b><br>Like means you found it interesting. "I tried this" means you used the workflow or agent yourself and say whether it worked at your institution. Tries count for far more in rankings and reputation.</td></tr>
  <tr><td class="r2"><b>Can I share a Copilot agent?</b><br>Yes: post it as AGENT. Put the agent's instructions in "Prompt or setup" and describe its knowledge sources and actions in words. Never paste internal links, file paths or anything from your tenant.</td></tr>
  <tr><td class="r1"><b>Can I share a prompt or agent that uses real data?</b><br>Not as it is. Townhall is public. Replace anything real in the prompt, agent instructions, knowledge sources, examples and screenshots with dummy data first: made-up names, fake student IDs, sample figures, "Module ABC123". The workflow is what colleagues need, not your data.</td></tr>
  <tr><td class="r2"><b>What does "Data that went in" mean?</b><br>Every build post says whether it used no data, internal information, or personal data in a tool your institution approved. It helps colleagues judge whether they could do the same under their own policies.</td></tr>
  <tr><td class="r2"><b>What does "may be out of date" mean?</b><br>The post hasn't been re-tested for 6 months. AI tools change fast. Authors can press "I've re-tested this" to clear it.</td></tr>
  <tr><td class="r1"><b>What's a fork?</b><br>A copy of someone's setup that you changed for your context. Your post links back to theirs, so they get credit.</td></tr>
  <tr><td class="r2"><b>Why was my post held?</b><br>Posts from accounts without a university email (.ac.uk) are checked by a moderator until three have been approved. After that, yours go live straight away. Accounts with a .ac.uk email go live straight away from the start. Everyone's posts still pass the automatic personal-data checks, and anyone can report a post.</td></tr>
  <tr><td class="r1"><b>The text is hard to read.</b><br>Open <a href="#display">Text &amp; display</a> and pick Readable or Large &amp; high contrast.</td></tr></table>`;
}
// ================= legal and guidance pages =================
const OPERATOR = { name: "Ahmad Ismail", email: "ahmadismailcv@gmail.com" }; // fill in before launch: who runs Townhall and how to contact them
const LAST_UPDATED = "7 November 2026";
const opName = () => OPERATOR.name ? esc(OPERATOR.name) : `<mark>[operator name: add before launch]</mark>`;
const opEmail = () => OPERATOR.email ? `<a href="mailto:${esc(OPERATOR.email)}">${esc(OPERATOR.email)}</a>` : `<mark>[contact email: add before launch]</mark>`;
function docPage(title, intro, sections) {
  V.innerHTML = `${pageHead(title, intro)}
   <nav class="doc-toc small" aria-label="On this page">${sections.map(([h], i) => `<a href="#" data-sec="${i}">${esc(h)}</a>`).join("")}</nav>
   <article class="card card-pad doc">${sections.map(([h, b], i) => `<section id="sec-${i}"><h2>${esc(h)}</h2>${b}</section>`).join("")}
   <p class="small" style="margin-top:20px">Last updated ${LAST_UPDATED}.</p></article>`;
  V.querySelectorAll("[data-sec]").forEach(a => a.onclick = e => { e.preventDefault(); const t = document.getElementById("sec-" + a.dataset.sec); t.scrollIntoView({ behavior: "smooth" }); t.querySelector("h2").setAttribute("tabindex", "-1"); t.querySelector("h2").focus({ preventScroll: true }); });
}
function viewRules() {
  docPage("House rules", "Short version: share what you actually did, use dummy data, and be decent to each other.", [
    ["Who Townhall is for", `<p>People who work in or with UK higher and further education and use AI in their jobs. Anyone can read. Anyone can join; accounts with a university email show an "ac.uk" badge.</p>`],
    ["Post what you actually did", `<p>Report real times and real results, including what went wrong. Don't invent or round up savings. If you haven't re-tested something in six months, it will be marked as possibly out of date.</p>`],
    ["No real data, anywhere", `<p>Townhall is public. Before you post, replace anything real in your prompt, agent instructions, knowledge sources, examples and screenshots with dummy data. That means no names, emails, student or staff IDs, marks, cases, health or financial details, or anything that could identify a person. See <a href="#safe-sharing">What you can safely share</a>.</p>`],
    ["Nothing confidential to your institution", `<p>No internal documents, internal links, file paths, SharePoint or Teams site names, tenant or system details, credentials, API keys, contract terms or unpublished policy.</p>`],
    ["Post as yourself", `<p>You speak for yourself, not your institution, unless you have permission. Check your institution's AI and data policies before sharing how you use a tool at work.</p>`],
    ["Be honest about interests", `<p>If you sell, built or are paid to promote the tool you're posting about, say so in the post. No undisclosed selling, spam or affiliate links.</p>`],
    ["Respect people", `<p>Disagree with the work, not the person. No harassment, hate, threats, or illegal content of any kind.</p>`],
    ["Moderation", `<p>Use the Report button on anything that breaks these rules. Moderators can hold, remove or edit-lock posts and suspend accounts. Posts from accounts without a university email are checked by a moderator until three have been approved. If you think a decision was wrong, contact ${opEmail()}.</p>`]
  ]);
}
function viewSafeSharing() {
  docPage("What you can safely share", "Colleagues need your method, not your data. Use this checklist before you post or upload a screenshot.", [
    ["Share freely", `<ul><li>What the task was and roughly how long it took before and after.</li><li>The tool, plan and model version.</li><li>Your prompt or agent instructions, once any real details are swapped out.</li><li>Knowledge sources described in words, e.g. "published regulations pages" or "a sample rubric".</li><li>What went wrong and how you fixed it.</li></ul>`],
    ["Swap for dummy data", `<table class="fl small"><thead><tr><th scope="col">Real</th><th scope="col">Use instead</th></tr></thead><tbody>
      <tr><td>Student or staff names</td><td>Student A, Lecturer B, "Sam Example"</td></tr>
      <tr><td>Student or staff ID numbers</td><td>U0000001, 1234567</td></tr>
      <tr><td>Module or course codes</td><td>ABC123, "Module X"</td></tr>
      <tr><td>Marks, grades, cases</td><td>Invented values that show the format</td></tr>
      <tr><td>Emails, phone numbers</td><td>name@example.ac.uk, 01234 567890</td></tr>
      <tr><td>Internal links and file paths</td><td>"the team SharePoint site", "a shared Excel file"</td></tr>
      <tr><td>Committee papers, minutes</td><td>A short made-up example in the same layout</td></tr></tbody></table>`],
    ["Screenshots", `<ul><li>Take them from a test run that uses dummy data.</li><li>Crop to the part that matters. Check browser tabs, bookmarks, notification pop-ups, your name and photo in the corner, and email previews.</li><li>Hide tenant names, site addresses and account details.</li><li>Townhall resizes images and removes hidden metadata such as location, but it can't read what's in the picture. You're responsible for what it shows.</li></ul>`],
    ["Check you're allowed to", `<ul><li>Work you create in your job may belong to your employer. Most institutions are happy for staff to share good practice, but check if you're unsure.</li><li>Follow your institution's AI policy and data protection rules. If a workflow used personal data, say so in "Data that went in", and say whether the tool was approved for it.</li><li>Don't share material that belongs to someone else, such as a supplier's documentation or a paid course.</li></ul>`],
    ["If you make a mistake", `<p>Delete or edit the post straight away, or press Report on your own post so a moderator can remove it. If real personal data was shared, tell your institution's data protection officer: they may need to assess it.</p>`]
  ]);
}
function viewTerms() {
  docPage("Terms of use", "The agreement between you and Townhall. Plain English, kept short.", [
    ["Who runs Townhall", `<p>Townhall is run by ${opName()} as an independent, non-commercial community. It is not run by, or speaking for, any university, college or sector body. Contact: ${opEmail()}.</p>`],
    ["Your account", `<p>You need to be 18 or over. Keep your login to yourself. You're responsible for what you post from your account. You can delete your account at any time in <a href="#me">Settings</a>.</p>`],
    ["What you post and the licence", `<p>You keep the copyright in what you post. By posting, you license it to everyone under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">Creative Commons Attribution 4.0 (CC BY 4.0)</a>. That covers titles, descriptions, prompts, agent instructions, knowledge-source descriptions, screenshots and replies. Anyone can reuse and adapt it, including by forking or saving it to their library, as long as they credit you. This is what makes sharing and forking work.</p><p>Only post material you have the right to share. Items in your private library aren't published or licensed to anyone until you publish them.</p>`],
    ["Rules", `<p>Follow the <a href="#rules">house rules</a>. In particular, never post personal data or confidential institutional information. Use dummy data.</p>`],
    ["Moderation and removal", `<p>We can hold, remove or restrict content, and suspend or close accounts, if they break these terms or the house rules, or if we must by law. We'll explain why where we can. You can ask for a decision to be reviewed by contacting ${opEmail()}.</p>`],
    ["No guarantees", `<p>Workflows, prompts and agents are shared by colleagues as they are. They may be wrong, out of date or unsuitable for your institution. Test with dummy data, check your own policies, and check AI output before relying on it. Time savings are reported by authors and aren't independently checked. Townhall is provided without any warranty, and we aren't liable for losses from using content posted here, except where the law doesn't allow us to exclude that liability.</p>`],
    ["Changes", `<p>We may update these terms. If a change matters, we'll say so on the site before it takes effect. Carrying on using Townhall means you accept the updated terms.</p>`],
    ["Law", `<p>These terms are governed by the law of England and Wales.</p>`]
  ]);
}
function viewPrivacy() {
  docPage("Privacy notice", "What Townhall collects, why, and what you can do about it.", [
    ["Who is responsible", `<p>${opName()} is the data controller for Townhall. Contact: ${opEmail()}.</p>`],
    ["What we collect", `<ul><li><b>Account:</b> your email address and password (the password is stored as a secure hash), your username, area of work, and optionally your job title and institution.</li><li><b>What you do:</b> your posts, screenshots, replies, likes, tries, votes, follows, reports, library items and display settings.</li><li><b>Notifications</b> about activity on your posts, kept for 120 days.</li><li><b>Visit counts:</b> one number per page type per day (for example "post pages: 140"). No cookies, IP addresses or anything that identifies you is stored for this.</li></ul>`],
    ["Why, and the lawful basis", `<ul><li>To run your account and show your contributions: legitimate interests in running a professional community you've chosen to join.</li><li>To show the "ac.uk" badge: we check whether your email ends in .ac.uk. The email itself is never shown.</li><li>To keep the site safe: moderation, reports and automatic checks for personal data.</li><li>Weekly digest emails, only if you switch them on: consent, which you can withdraw in Settings.</li></ul><p>We don't sell data, show adverts or use your content to train AI models.</p>`],
    ["Who can see what", `<p><b>Public:</b> your username, area of work, posts, replies, tries and, if you give them, your job title and institution. You can hide your institution in <a href="#me">Settings</a>.</p><p><b>Private:</b> your email address, display settings, library, follows, notifications and reports.</p>`],
    ["Where it's stored and who processes it", `<p>Data is stored by Supabase in its London (UK) region. The website is served by a hosting provider, and, once switched on, emails are sent by an email delivery service. These providers process data only to run the service. A full list is available on request.</p>`],
    ["How long we keep it", `<p>Until you delete your account. When you do, your login, profile, library, notifications, likes, tries, votes and follows are deleted. Posts you didn't delete stay up as "[deleted member]". Notifications are deleted after 120 days. Daily visit counts are deleted after about 13 months.</p>`],
    ["Your rights", `<p>You can see a copy of your data, download a record of your contributions, correct your profile and delete your account at any time from <a href="#me">Settings</a>. You can also ask for access, correction, deletion or restriction, or object to processing, by contacting ${opEmail()}. If you're unhappy with how we've handled your data, you can complain to the <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener">Information Commissioner's Office</a>.</p>`],
    ["Cookies and browser storage", `<p>Townhall stores your login session and display choice in your browser so the site works. When you log in from a post, it also keeps the page you were on, and any try you recorded before logging in, for up to a day so it can take you back there. There are no advertising, tracking or analytics cookies, so there's no cookie banner.</p>`],
    ["Children", `<p>Townhall is for adults working in education. You must be 18 or over to join.</p>`]
  ]);
}
function viewAccessibility() {
  docPage("Accessibility statement", "We want everyone who works in higher and further education to be able to use Townhall.", [
    ["How accessible the site is", `<p>We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. We test every page with an automated checker (axe-core) and fix what it finds, and the site can be used with a keyboard alone.</p>`],
    ["Ways to adjust the site", `<ul><li><a href="#display">Text &amp; display</a> offers a Readable mode with a dyslexia-friendly font, and a Large &amp; high-contrast mode.</li><li>You can zoom to 200% without losing content, and the layout works on phones.</li><li>Press <kbd>/</kbd> to jump to any category, and use Back and Forward in the top bar or Alt and the arrow keys.</li></ul>`],
    ["Known limitations", `<ul><li>Screenshots in posts are uploaded by members and usually have no text description.</li><li>Automated testing finds many but not all problems. We haven't yet had a full manual audit with assistive-technology users.</li><li>News headlines link to other organisations' sites, which have their own accessibility.</li></ul>`],
    ["Reporting a problem", `<p>If something doesn't work for you, contact ${opEmail()} and say which page and what happened. We'll aim to reply within 5 working days.</p>`]
  ]);
}
function viewAbout() {
  docPage("About Townhall", "A place for staff in UK higher and further education to share what they've built with AI, honestly, including what went wrong.", [
    ["Why it exists", `<p>Staff across the sector are building the same AI workflows in parallel, often alone and often without knowing what works. Townhall puts the real details in one place: the task, the tool, the time before and after, the data used and what went wrong. Colleagues then say whether it worked for them too.</p>`],
    ["Who runs it", `<p>Townhall is run by ${opName()} in a personal capacity. It's independent and non-commercial: no adverts, no data sales, no paid placements, and it isn't connected to any commercial service. It isn't run by, or endorsed by, any university, college or sector body.</p>`],
    ["How it works", `<ul><li>Every post sits in one <a href="#categories">category</a>, named after the task it helps with.</li><li>"I tried this" counts for more than likes, and reputation comes from colleagues saying your workflow worked.</li><li>Everything posted is shared under CC BY 4.0, so anyone can fork and adapt it with credit. See the <a href="#terms">terms</a>.</li></ul>`],
    ["Get involved", `<p><a href="#join">Join</a>, share one thing you've built, and record a try when you use someone else's workflow. Suggestions for how the site is run go in <a href="#b-townhall">Motions &amp; meetings</a>.</p>`]
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
    else if (h.startsWith("b-")) await viewBoard(h.slice(2));
    else if (h.startsWith("tag-")) await viewTag(h.slice(4));
    else if (h.startsWith("t-")) await viewTopic(h.slice(2));
    else if (h.startsWith("u-")) await viewProfile(decodeURIComponent(h.slice(2)));
    else if (h.startsWith("/")) await viewBoard(h.slice(1));
    else if (h.startsWith("fork-")) await viewPost(null, h.slice(5));
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
    else if (h === "stats") await viewStats();
    else if (h === "search") await viewSearch();
    else if (h === "mod") { await viewMod(); await loadMetrics(); }
    else if (h === "notifications") await viewNotifications();
    else if (h === "terms") viewTerms();
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
  try { await Promise.all([loadMe(), loadBoards()]); } catch (e) { setStatus(`<div class="notice err">Can't reach Townhall's database right now. Try again in a minute.</div>`); }
  syncHist(); route();
})();
