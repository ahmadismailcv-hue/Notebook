"use strict";
// ================= config =================
const APP_NAME = "The Boring Bits"; // the product name lives here only (build.py copies it into shell.html)
const TAGLINE = "AI help for everyday life. Shared by people, tested by us.";
const NOT_ADVICE = "This is general information, not legal, financial or medical advice.";
const SUPABASE_URL = "https://dlqltqsojkjygzzehvjk.supabase.co";
const SUPABASE_KEY = "sb_publishable_cjOiFDs528cpWXSYkWa7fw_J5w0xas5";
const SITE = () => location.origin + location.pathname;
// Remember things across the login step (works across tabs, expires after a day)
function remember(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify({ v, t: Date.now() })); } catch (_) { } }
function recall(k, maxAge = 864e5) { try { const o = JSON.parse(localStorage.getItem(k) || "null"); if (!o || Date.now() - o.t > maxAge) { localStorage.removeItem(k); return null; } return o.v; } catch (_) { return null; } }
let lastPage = "";
const sb = (window.__mockSupabase || window.supabase).createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

// ================= state =================
const S = { session: null, me: null, boards: [], myFollows: [], isMod: false, modBoards: new Set() };
const V = document.getElementById("view");
const HELD = ["money", "health-admin", "complaints"]; // tips here always wait for a moderator
const TOOLS = { chatgpt: "ChatGPT", copilot: "Microsoft Copilot", gemini: "Google Gemini", claude: "Claude", other: "Another tool" };
// Database types stay STORY and RECIPE; people see "tip" and "guide".
const KIND = { STORY: "Tip", RECIPE: "Guide" };
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const TOPICS = {
  money: ["Bills and money", "Energy bills, benefits, refunds and banks", '<circle cx="12" cy="12" r="9"/><path d="M14.5 8.5a2.5 2.5 0 00-4.5 1.5v5.5M8.5 13h4.5M8.5 16h7"/>'],
  home: ["Home and renting", "Tenancies, repairs, moving and neighbours", '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>'],
  complaints: ["Complaints", "Complaining to a company or council, and taking it further", '<path d="M4 10v4h3l6 4V6L7 10z"/><path d="M17 9a4 4 0 010 6"/>'],
  letters: ["Letters and forms", "Understanding official letters and replying", '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 8l9 6 9-6"/>'],
  work: ["Work and jobs", "Job applications, CVs and letters at work", '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>'],
  "health-admin": ["Health appointments", "Appointments, forms and NHS paperwork. Not medical advice", '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>'],
  family: ["Family and school", "School, childcare and caring for someone", '<circle cx="9" cy="8" r="3"/><path d="M3 20c.6-3.5 3-5.5 6-5.5s5.4 2 6 5.5"/><circle cx="17" cy="9" r="2.3"/><path d="M15.5 14.6c2.6.1 4.6 2 5.2 5.4"/>'],
  "getting-started": ["Getting started with AI", "First steps with free AI tools", '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>'],
  "staying-safe": ["Staying safe", "Scams, privacy and what not to paste into AI", '<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>']
};
const topicName = id => (TOPICS[id] || [])[0] || (board(id) || {}).name || id;
const topicHref = id => "#/" + id;
const shotUrl = p => sb.storage.from("shots").getPublicUrl(p).data.publicUrl;

// ================= helpers =================
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const day = t => { const d = new Date(t); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
const isoDay = d => new Date(d).toISOString().slice(0, 10);
const ago = t => { const s = (Date.now() - new Date(t)) / 1000; if (s < 3600) { const m = Math.max(1, Math.round(s / 60)); return m + (m === 1 ? " minute ago" : " minutes ago"); } if (s < 86400) { const h = Math.round(s / 3600); return h + (h === 1 ? " hour ago" : " hours ago"); } if (s < 7 * 86400) { const d = Math.round(s / 86400); return d + (d === 1 ? " day ago" : " days ago"); } return day(t); };
const cleanTag = t => String(t).toLowerCase().replace(/^#/, "").replace(/[^a-z0-9-]/g, "").slice(0, 30);
const parseTags = s => [...new Set(String(s).split(/[\s,]+/).map(cleanTag).filter(Boolean))].slice(0, 8);
const board = id => S.boards.find(b => b.id === id);
const toolList = keys => (keys || []).map(k => TOOLS[k] || k).join(", ");
const isStale = p => p.type === "RECIPE" && !!p.retest_due && new Date(p.retest_due + "T23:59:59") < new Date();
const isTested = p => p.type === "RECIPE" && (p.tested_tools || []).length > 0;
const authorName = p => !p.author && (p.is_sample || p.type === "RECIPE") ? APP_NAME + " team" : (p.author_handle || (p.profiles && p.profiles.handle) || "a former member");
const userLink = h => h && h !== "a former member" && h !== APP_NAME + " team" ? `<a href="#u-${esc(h)}">${esc(h)}</a>` : esc(h);
const plural = (n, one, many) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
// The same checks as private.pii_problem in the database. "(this will be blocked)" marks the ones the database refuses on tips.
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
  if (/\b(Mr|Mrs|Ms|Miss|Dr|Prof)\.?\s+[A-Z][a-z]+/.test(txt)) w.push("what looks like a person's name");
  if (/\b\d{1,4}\s+[A-Z][a-z]+\s+(Road|Street|Lane|Avenue|Close|Drive|Way|Crescent|Gardens)\b/.test(txt)) w.push("what looks like a street address");
  if (/\b(my|our)\s+(son|daughter|husband|wife|partner|mum|dad|mother|father)\s+[A-Z][a-z]+/.test(txt)) w.push("what may be a family member's name");
  return w;
}
// Shows [square bracket] placeholders with a highlighter mark, so people see what to replace
const phText = t => esc(t).replace(/\[[^\]\n]{1,80}\]/g, m => `<mark class="ph">${m}</mark>`);
const blockedOnly = w => w.filter(x => x.includes("blocked")).join(", ").replace(/ \(this will be blocked\)/g, "");
const errMsg = e => (e && (e.message || e.error_description)) || "Something went wrong. Try again.";
function setStatus(html) { document.getElementById("status").innerHTML = html || ""; }

// ================= text size =================
function applyDisplay(p) {
  const large = p.font === "large";
  document.body.classList.toggle("f-large", large);
  try { localStorage.setItem("ath_display", JSON.stringify({ font: large ? "large" : "standard" })); } catch (_) { }
}
function currentDisplay() { try { return JSON.parse(localStorage.getItem("ath_display")) || {}; } catch (_) { return {}; } }
applyDisplay(currentDisplay());
async function saveDisplay(p) {
  applyDisplay(p);
  if (S.me) { const prefs = { ...(S.me.prefs || {}), font: p.font }; const { error } = await sb.from("profiles").update({ prefs }).eq("id", S.me.id); if (!error) S.me.prefs = prefs; }
}

// ================= shell =================
const IC = {
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 011-1h10"/>',
  save: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  bell: '<path d="M6 9a6 6 0 0112 0c0 5 2 6.5 2 6.5H4S6 14 6 9"/><path d="M10 19a2 2 0 004 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  ext: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>'
};
const LABELS = { index: "Find help", post: "Share a tip", library: "Saved", login: "Log in", join: "Create an account", newpass: "New password", me: "Your account", display: "Text size", mod: "Admin", notifications: "Notifications", search: "Search", help: "Help", about: "About", rules: "House rules", terms: "Terms of use", privacy: "Privacy", accessibility: "Accessibility", "safe-sharing": "What you can safely share", complaints: "Reports and complaints", "guide-new": "New guide", badge: "Badge" };
function routeLabel(h) {
  if (LABELS[h]) return LABELS[h];
  if (h.startsWith("/")) return topicName(h.slice(1));
  if (h.startsWith("u-")) return h.slice(2);
  if (h.startsWith("lib-")) return "Saved";
  if (h.startsWith("post-")) return "Share a tip";
  if (h.startsWith("guide-")) return "Guide editor";
  return "";
}
function renderShell() {
  const h = location.hash.slice(1) || "index";
  const sec = h === "post" || h.startsWith("post-") ? "post" : h === "library" || h.startsWith("lib-") ? "library" : (h === "index" || h.startsWith("/") || h.startsWith("t-") || h === "search") ? "index" : "";
  const nav = [["index", "Find help"], ["post", "Share a tip"], ["library", "Saved"]];
  document.getElementById("nav").innerHTML = nav.map(([k, l]) => `<a href="#${k}" class="${sec === k ? "on" : ""}"${sec === k ? ' aria-current="page"' : ""}>${l}</a>`).join("");
  const acct = document.getElementById("acct");
  if (S.me) acct.innerHTML = `<a class="bell" id="bell" href="#notifications" aria-label="Notifications">${svg(IC.bell)}<span class="dot" hidden>0</span></a>${S.isMod ? `<a class="btn sm" href="#mod">Admin</a>` : ""}<a class="btn sm" href="#me">${esc(S.me.handle)}</a>`;
  else if (S.session) acct.innerHTML = `<span class="small muted">Setting up your account...</span>`;
  else acct.innerHTML = `<a class="btn sm" href="#login">Log in</a>`;
  const lbl = routeLabel(h);
  document.title = (lbl && h !== "index" ? lbl + " · " : "") + APP_NAME;
}
function topicIcon(id) { const t = TOPICS[id]; return t ? svg(t[2]) : svg('<circle cx="12" cy="12" r="8"/>'); }
// One line in a list of guides or tips
function itemRow(p, showTopic = true) {
  const recipe = p.type === "RECIPE";
  const meta = [
    `<span class="badge ${recipe ? "guide" : "tip"}">${KIND[p.type]}</span>`,
    recipe ? (isStale(p) ? '<span class="badge warn">May be out of date</span>' : isTested(p) ? `<span class="badge ok">${svg(IC.check)}Tested</span>` : '<span class="badge warn">Not tested yet</span>') : "",
    p.status === "draft" ? '<span class="badge warn">Draft</span>' : "",
    p.is_sample ? '<span class="badge">Example</span>' : "",
    recipe && (p.tries_worked || p.tries_failed) ? `<span>Worked for ${plural(p.tries_worked, "person", "people")}</span>` : "",
    !recipe ? `<span>Used ${esc(TOOLS[p.tool_key] || "an AI tool")}</span>` : "",
    !recipe ? `<span>by ${esc(authorName(p))}</span>` : "",
    showTopic && board(p.board_id) ? `<span>${esc(topicName(p.board_id))}</span>` : ""
  ].filter(Boolean).join("");
  const sum = recipe ? p.task : (p.body || p.task);
  const ba = !recipe && (p.outcome_before || p.outcome_after) ? `<span class="d ba-line">${p.outcome_before ? `<b>Before:</b> ${esc(p.outcome_before)}` : ""}${p.outcome_before && p.outcome_after ? " · " : ""}${p.outcome_after ? `<b>After:</b> ${esc(p.outcome_after)}` : ""}</span>` : "";
  return `<li><a class="item" href="#t-${esc(p.id)}"><span class="t">${esc(p.title)}</span>${ba || (sum ? `<span class="d">${esc(sum.slice(0, 180))}${sum.length > 180 ? "..." : ""}</span>` : "")}<span class="m">${meta}</span></a></li>`;
}
function itemList(list, empty, showTopic = true) {
  return list.length ? `<ul class="items">${list.map(p => itemRow(p, showTopic)).join("")}</ul>` : `<div class="empty">${empty}</div>`;
}
// Guides first, most "worked for me" first; tips newest first
const byWorked = (a, b) => (b.tries_worked - a.tries_worked) || (a.tries_failed - b.tries_failed) || (new Date(b.created_at) - new Date(a.created_at));
const byNew = (a, b) => new Date(b.created_at) - new Date(a.created_at);

// ================= feedback: loading, busy buttons, toasts =================
let loadTimer = null;
function showSkeleton() { V.setAttribute("aria-busy", "true"); V.innerHTML = `<div aria-hidden="true" class="read"><div class="sk" style="height:36px;width:60%"></div><div class="sk" style="width:80%"></div><div class="sk" style="width:70%"></div></div>`; }
function busy(btn, on) { if (!btn) return; btn.disabled = on; btn.classList.toggle("busy", on); if (on) btn.setAttribute("aria-busy", "true"); else btn.removeAttribute("aria-busy"); }
function toast(message, kind = "ok") {
  const box = document.getElementById("toasts"); if (!box) return;
  const t = document.createElement("div"); t.className = "toast " + kind;
  t.innerHTML = `${kind === "ok" ? svg(IC.check) : ""}<span>${esc(message)}</span>`;
  box.appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, 2800);
}
function pendingToast(m) { S.toastNext = m; }
function flushToast() { if (S.toastNext) { toast(S.toastNext); S.toastNext = ""; } }

// ================= data =================
async function loadMe() {
  const { data } = await sb.auth.getSession();
  S.session = data.session;
  S.me = null; S.myFollows = []; S.isMod = false; S.modBoards = new Set();
  if (S.session) {
    const uid = S.session.user.id;
    const [pr, md] = await Promise.all([sb.rpc("my_profile"), sb.from("board_mods").select("board_id").eq("user_id", uid)]);
    S.me = pr.data && pr.data.id ? pr.data : null;
    (md.data || []).forEach(r => S.modBoards.add(r.board_id));
    S.isMod = !!S.me && (S.me.role === "admin" || S.modBoards.size > 0);
    if (S.me && S.me.prefs && S.me.prefs.font) applyDisplay(S.me.prefs);
  }
  renderShell(); loadNotifCount();
}
async function loadBoards() {
  const { data } = await sb.from("boards").select("*").order("sort");
  S.boards = (data || []).filter(b => !b.archived);
  renderShell();
}
const FEED_COLS = "id,author,task,body,tool_key,screenshots,author_profession,board_id,type,title,tags,status,pinned,is_sample,tested_on,created_at,author_handle,likes,tries_worked,tries_failed,replies,tools,tested_tools,retest_due,outcome_before,outcome_after";
async function fetchPosts(q) { const { data, error } = await q; if (error) throw error; return data || []; }
const publishedPosts = () => sb.from("post_feed").select(FEED_COLS).eq("status", "published").order("created_at", { ascending: false }).limit(300);
const isAdmin = () => !!(S.me && S.me.role === "admin");
const isModOf = b => S.me && (S.me.role === "admin" || S.modBoards.has(b));
function needLogin(what) { return `<div class="notice plain read"><b>${esc(what)} needs a free account.</b> <a href="#login">Log in</a> or <a href="#join">create an account</a>. It takes a minute.</div>`; }
const logEntry = k => { try { sb.rpc("log_entry", { k }).then(() => {}, () => {}); } catch (_) { } };
const trackEv = k => { try { sb.rpc("track_view", { p: k }).then(() => {}, () => {}); } catch (_) { } };
function bindCopy() {
  V.querySelectorAll("button[data-copy]").forEach(cp => cp.onclick = async () => {
    const lbl = cp.innerHTML;
    try { await navigator.clipboard.writeText(cp.dataset.copy); cp.innerHTML = svg(IC.check) + "Copied"; toast("Copied. Now paste it into the AI tool."); }
    catch (_) { const pre = cp.closest(".copybox") && cp.closest(".copybox").querySelector("pre"); if (pre) { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } cp.textContent = "Press Ctrl+C to copy"; }
    setTimeout(() => { if (cp.isConnected) cp.innerHTML = lbl; }, 2500);
  });
}
// Shown when someone presses submit: a last reminder to take out personal details.
// Anything the database would refuse is listed and blocks sending; softer matches are listed as things to check.
function confirmPersonalData(text, onSend) {
  const old = document.getElementById("piiBar"); if (old) old.remove();
  const back = document.activeElement;
  const found = piiWarnings(text), blocked = found.filter(x => x.includes("blocked")).map(x => x.replace(" (this will be blocked)", "")), soft = found.filter(x => !x.includes("blocked"));
  const bar = document.createElement("div");
  bar.id = "piiBar"; bar.className = "confirmbar"; bar.setAttribute("role", "alertdialog"); bar.setAttribute("aria-modal", "false"); bar.setAttribute("aria-labelledby", "piiBarH"); bar.setAttribute("aria-describedby", "piiBarD");
  bar.innerHTML = `<div class="wrap confirmin">
    <div class="stack" style="gap:6px;min-width:0">
      <h2 id="piiBarH">${blocked.length ? "Take out personal details first" : "Before you share: is anything personal still in there?"}</h2>
      <div id="piiBarD">${blocked.length ? `<p>We found ${esc(blocked.join(", "))}. Remove ${blocked.length > 1 ? "them" : "it"}, or write something like [my postcode] instead.</p>`
        : `<p>Your tip will be public. Check you've removed names, addresses, postcodes, phone numbers, emails, bank or card details, and reference numbers, about you or anyone else.</p>${soft.length ? `<p class="flag">We spotted ${esc(soft.join("; "))}. Have another look.</p>` : ""}`}</div>
    </div>
    <div class="row confirmbtns">${blocked.length ? `<button type="button" class="btn primary" id="piiBack">Go back and fix it</button>`
      : `<button type="button" class="btn primary" id="piiSend">It's safe, share my tip</button><button type="button" class="btn" id="piiBack">Go back and check</button>`}</div>
  </div>`;
  document.body.appendChild(bar);
  const close = () => { bar.remove(); document.removeEventListener("keydown", onKey); if (back && back.focus) back.focus(); };
  const onKey = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  document.getElementById("piiBack").onclick = close;
  const go = document.getElementById("piiSend");
  if (go) go.onclick = () => { bar.remove(); document.removeEventListener("keydown", onKey); onSend(); };
  (go || document.getElementById("piiBack")).focus();
}
window.addEventListener("hashchange", () => { const b = document.getElementById("piiBar"); if (b) b.remove(); });
function inlinePrompt(anchor, label, value, onOk) {
  const box = document.createElement("div"); box.className = "field"; box.style.width = "100%";
  const id = "ip" + Math.random().toString(36).slice(2, 7);
  box.innerHTML = `<label for="${id}">${esc(label)}</label><input type="text" id="${id}" maxlength="300" value="${esc(value || "")}"><div class="row"><button type="button" class="btn sm primary">Send</button><button type="button" class="btn sm">Cancel</button></div>`;
  anchor.after(box); anchor.disabled = true;
  const inp = box.querySelector("input"), [ok, cancel] = box.querySelectorAll("button");
  inp.focus();
  cancel.onclick = () => { box.remove(); anchor.disabled = false; };
  ok.onclick = async () => { const v = inp.value.trim(); if (v.length < 3) { inp.focus(); return; } ok.disabled = true; await onOk(v); box.remove(); anchor.disabled = false; };
}
function confirmTwice(btn, fn) {
  if (btn.dataset.armed) { btn.disabled = true; fn(); return; }
  btn.dataset.armed = "1"; const old = btn.textContent; btn.textContent = "Press again to confirm";
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = old; } }, 4000);
}
const fld = (id, label, input, hint = "") => `<div class="field"><label for="${id}">${label}</label>${hint ? `<div class="hint">${hint}</div>` : ""}${input}</div>`;

// ================= home =================
function searchBox(q = "") {
  return `<form class="search" id="sf" role="search"><label class="sr" for="q">Search guides and tips, then press Enter</label>${svg(IC.search)}<input type="search" id="q" placeholder="Search, for example: parking fine or council tax" value="${esc(q)}" autocomplete="off" enterkeyhint="search"></form>`;
}
function bindSearch() { const f = document.getElementById("sf"); if (f) f.onsubmit = e => { e.preventDefault(); S.pendingQuery = document.getElementById("q").value.trim(); if (location.hash === "#search") route(); else location.hash = "search"; }; }
async function viewIndex() {
  const posts = await fetchPosts(publishedPosts());
  const guides = posts.filter(p => p.type === "RECIPE").sort(byWorked).slice(0, 5);
  const tips = posts.filter(p => p.type === "STORY").sort(byNew).slice(0, 5);
  const topics = S.boards.length ? S.boards.map(b => b.id) : Object.keys(TOPICS);
  V.innerHTML = `
    <section class="hero">
      <h1>What do you need help with?</h1>
      <p class="lead">Step-by-step help for bills, letters, complaints and forms, using free AI tools like ChatGPT. Every guide says what to type, what to keep private, and how to check the answer.</p>
      ${searchBox()}
    </section>
    <section aria-labelledby="topicsH"><h2 class="sr" id="topicsH">Topics</h2>
      <div class="tiles">${topics.map(id => `<a class="tile" href="${topicHref(id)}"><span class="ic">${topicIcon(id)}</span><span><b>${esc(topicName(id))}</b><span>${esc((TOPICS[id] || [])[1] || (board(id) || {}).descr || "")}</span></span></a>`).join("")}</div>
    </section>
    <section class="rules section" aria-labelledby="rulesH">
      <h2 id="rulesH">3 rules for staying safe</h2>
      <ol class="rulelist">
        <li><b>Swap private details for [brackets].</b> Write [account number] or [my postcode] instead of the real thing.</li>
        <li><b>Fill in only what the AI needs.</b> Replace the <mark class="ph">[highlighted parts]</mark> in a guide, but never with passwords, bank details or your National Insurance number.</li>
        <li><b>Check before you send.</b> AI makes mistakes. Check dates, amounts and rules with the official source each guide links to.</li>
      </ol>
      <a class="small" href="#safe-sharing">More on what you can safely share</a>
    </section>
    <div class="two section">
      <section><h2>Popular guides</h2><p class="muted small" style="margin-bottom:12px">Written and tested by us. Sorted by how many people said they worked.</p>${itemList(guides, "No guides yet. We're testing the first ones now.", true)}</section>
      <section><h2>Latest tips from people</h2><p class="muted small" style="margin-bottom:12px">How others used AI for a boring job, in their own words.</p>${itemList(tips, `No tips yet. <a href="#post">Be the first to share one.</a>`, true)}</section>
    </div>
    <section class="section"><h2 style="margin-bottom:16px">How it works</h2>
      <ol class="howto">
        <li><span><b>Pick what you need to do.</b><br><span class="muted">A letter, a bill, a complaint, a form.</span></span></li>
        <li><span><b>Follow the guide.</b><br><span class="muted">Copy the words into a free AI tool. Leave out anything private.</span></span></li>
        <li><span><b>Check the answer.</b><br><span class="muted">Each guide links to GOV.UK, Citizens Advice or the right ombudsman.</span></span></li>
      </ol>
      <div class="row" style="margin-top:24px"><a class="btn primary big" href="#post" data-entry="share">Share how AI helped you</a><a class="btn big" href="#search" data-entry="browse">Browse all guides</a></div>
    </section>`;
  bindSearch();
  V.querySelectorAll("[data-entry]").forEach(a => a.addEventListener("click", () => { logEntry(a.dataset.entry); if (a.dataset.entry === "browse") S.pendingQuery = ""; }));
}
async function viewSearch() {
  const all = await fetchPosts(publishedPosts());
  const q = (S.pendingQuery || "").trim(); S.pendingQuery = "";
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = p => words.every(w => [p.title, p.task, p.body, topicName(p.board_id), (p.tags || []).join(" ")].join(" ").toLowerCase().includes(w));
  const res = all.filter(hit);
  const guides = res.filter(p => p.type === "RECIPE").sort(byWorked), tips = res.filter(p => p.type === "STORY").sort(byNew);
  V.innerHTML = `<div class="read stack">
    <h1>${q ? `Results for "${esc(q)}"` : "All guides and tips"}</h1>
    ${searchBox(q)}
    <section class="stack"><h2>Guides (${guides.length})</h2>${itemList(guides, q ? "No guides match. Try fewer or different words." : "No guides yet.")}</section>
    <section class="stack"><h2>Tips (${tips.length})</h2>${itemList(tips, q ? "No tips match." : "No tips yet.")}</section>
  </div>`;
  bindSearch();
}
async function viewTopic(id) {
  const b = board(id); if (!b) return viewNotFound("That topic doesn't exist.");
  const posts = await fetchPosts(publishedPosts().eq("board_id", id));
  const guides = posts.filter(p => p.type === "RECIPE").sort(byWorked), tips = posts.filter(p => p.type === "STORY").sort(byNew);
  V.innerHTML = `<div class="read stack">
    <a class="crumb" href="#index">All topics</a>
    <div class="row" style="gap:14px"><span class="tile" style="padding:0;border:0;min-height:0;background:none"><span class="ic">${topicIcon(id)}</span></span><h1>${esc(topicName(id))}</h1></div>
    <p class="muted">${esc((TOPICS[id] || [])[1] || b.descr)}</p>
    ${id === "health-admin" ? `<div class="notice stop"><b>This topic is for appointments, forms and paperwork only.</b> Nothing here is medical advice. For health worries, contact your GP or NHS 111. In an emergency, call 999.</div>` : ""}
    <section class="stack section" style="margin-top:24px"><h2>Guides</h2>${itemList(guides, "No guides in this topic yet.", false)}</section>
    <section class="stack section" style="margin-top:32px"><div class="row" style="justify-content:space-between"><h2>Tips from people</h2><a class="btn sm" href="#post-${esc(id)}">Share a tip about this</a></div>
      ${HELD.includes(id) ? `<p class="small muted">A moderator checks every tip in this topic before it goes live.</p>` : ""}
      ${itemList(tips, "No tips here yet.", false)}</section>
  </div>`;
}

// ================= guide and tip pages =================
const TRY_LBL = { worked: ["It worked for me", "ok"], failed: ["It didn't work for me", "stop"] };
function guideBody(p, sources) {
  const prompts = p.prompts || [], checks = p.how_to_check || [];
  const tools = (p.tools || []).length ? toolList(p.tools) : "any free AI tool";
  let n = 0;
  const steps = [];
  steps.push(`<li><div class="stack" style="gap:8px"><h2>Open a free AI tool</h2><p>This guide works with ${esc(tools)}. You don't need to pay.</p></div></li>`);
  prompts.forEach((x, i) => steps.push(`<li><div class="stack" style="gap:8px"><h2>${esc(x.label || (prompts.length > 1 ? "Copy and paste this, part " + (i + 1) : "Copy and paste this"))}</h2>
    <p class="muted small">Copy these words into the AI tool. Then replace the <mark class="ph">[highlighted parts]</mark> with your own details, but keep private details out.</p>
    <div class="copybox"><pre id="prompt${i}">${phText(x.text)}</pre><div class="bar"><span>Words to copy</span><button type="button" class="btn sm primary" data-copy="${esc(x.text)}">${svg(IC.copy)}Copy</button></div></div></div></li>`));
  if (checks.length) steps.push(`<li><div class="stack" style="gap:8px"><h2>Check the answer</h2><p>AI tools make mistakes. Before you use the answer, check it against these official sources:</p><ul style="margin:0;padding-left:1.2em">${checks.map(c => `<li><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.label)}<span class="sr"> (opens in a new tab)</span></a></li>`).join("")}</ul></div></li>`);
  return `
    ${p.deadline_warning ? `<div class="notice stop"><b>Watch the deadline</b>${esc(p.deadline_warning)}</div>` : ""}
    <p style="font-size:1.1rem">${esc(p.task)}</p>
    ${p.never_paste ? `<div class="notice"><b>Don't put these into the AI tool</b><span class="prose">${esc(p.never_paste)}</span></div>` : ""}
    <ol class="steps">${steps.join("")}</ol>
    ${p.failure_points ? `<details class="more" open><summary>Things that can go wrong</summary><div class="prose">${esc(p.failure_points)}</div></details>` : ""}
    <p class="small muted">${esc(NOT_ADVICE)}</p>
    ${sources.length ? `<p class="small">Based on tips from: ${sources.map(s => `<a href="#t-${esc(s.id)}">${esc(s.title)}</a>`).join(", ")}</p>` : ""}
    <p class="small printonly">From ${esc(APP_NAME)}: ${esc(SITE())}#t-${esc(p.id)}. Printed ${esc(day(new Date()))}.</p>`;
}
function feedbackBox(p, myTry) {
  const radios = [["worked", "Yes, it worked"], ["failed", "No, it didn't"]].map(([k, l]) => `<label><input type="radio" name="tr" value="${k}"${myTry && myTry.result === k ? " checked" : ""}> ${l}</label>`).join("");
  return `<section class="feedback" aria-labelledby="fbH"><h2 id="fbH">Did this guide work for you?</h2>
    <div class="choice" role="radiogroup" aria-labelledby="fbH">${radios}</div>
    <div class="row">
      ${fld("trTool", "Which AI tool did you use?", `<select id="trTool"><option value="">Choose...</option>${Object.entries(TOOLS).map(([k, v]) => `<option value="${k}"${myTry && myTry.tool_key === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>`)}
    </div>
    ${fld("trNote", `What happened? <span class="muted" style="font-weight:400">(optional)</span>`, `<input type="text" id="trNote" maxlength="500" value="${esc(myTry ? myTry.note : "")}">`, `<span id="trNoteHint">${myTry && myTry.result === "failed" ? "Tell us where it went wrong so we can fix the guide." : "Leave out anything personal."}</span>`)}
    <div class="row">${S.me ? `<button class="btn primary" id="trSave">${myTry ? "Update my answer" : "Send my answer"}</button>${myTry ? `<button class="btn quiet" id="trDel">Remove my answer</button>` : ""}`
      : `<button class="btn primary" data-trygo="join">Create an account to send</button><button class="btn" data-trygo="login">Log in to send</button>`}<span id="trMsg" class="err" role="alert"></span></div>
    ${S.me ? "" : `<p class="small muted">We'll keep your answer while you log in.</p>`}
  </section>`;
}
function justPostedPanel(p) {
  const link = SITE() + "#t-" + p.id;
  return `<div class="notice ok" role="status"><b>Your tip is live. Thank you.</b>The most useful tips become tested guides. You'll see comments under the bell.
    <div class="row" style="margin-top:10px"><button type="button" class="btn sm" id="jpCopy">Copy the link</button><span class="small" id="jpMsg" aria-live="polite"></span></div><p class="small muted" style="margin-top:6px">${esc(link)}</p></div>`;
}
async function viewTopicPost(id) {
  const { data: p, error } = await sb.from("post_feed").select("*").eq("id", id).maybeSingle();
  if (error || !p) return viewNotFound("This page doesn't exist, is waiting for a moderator, or was taken down.");
  const recipe = p.type === "RECIPE";
  const [reps, tries, src] = await Promise.all([
    sb.from("replies").select("id,body,status,created_at,author,profiles(handle,profession)").eq("post_id", id).order("created_at"),
    recipe ? sb.from("tries").select("result,note,tool_key,created_at,user_id,profiles(handle)").eq("post_id", id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    sb.from("recipe_sources").select("recipe_id,story_id").eq(recipe ? "recipe_id" : "story_id", id)
  ]);
  const linkIds = (src.data || []).map(r => recipe ? r.story_id : r.recipe_id);
  const linked = linkIds.length ? ((await sb.from("post_feed").select("id,title,status").in("id", linkIds)).data || []).filter(x => x.status === "published" || isAdmin()) : [];
  const b = board(p.board_id), mine = S.me && p.author === S.me.id, mod = isModOf(p.board_id), admin = isAdmin();
  const mySaved = S.me && p.status === "published" ? (await sb.from("library_items").select("id").eq("source_post", p.id).maybeSingle()).data : null;
  const myTry = S.me ? (tries.data || []).find(t => t.user_id === S.me.id) : null;
  const status = recipe ? (isStale(p) ? `<span class="badge warn">May be out of date: re-test was due ${esc(day(p.retest_due))}</span>` : isTested(p) ? `<span class="badge ok">${svg(IC.check)}Tested ${esc(day(p.tested_on))} with ${esc(toolList(p.tested_tools))}</span>` : `<span class="badge warn">Not tested yet</span>`) : "";
  const notes = (tries.data || []).filter(t => t.note);
  const comments = (reps.data || []);
  let h = `<article class="page stack" style="gap:20px">
    ${b ? `<a class="crumb noprint" href="${topicHref(b.id)}">${esc(topicName(b.id))}</a>` : ""}
    <header class="page-head">
      <div class="row"><span class="badge ${recipe ? "guide" : "tip"}">${recipe ? "Guide" : "Tip from a member"}</span>${status}${p.is_sample ? '<span class="badge">Example</span>' : ""}${p.status === "draft" ? '<span class="badge warn">Draft: only admins can see this</span>' : p.status === "pending" ? '<span class="badge warn">Waiting for a moderator</span>' : p.status === "removed" ? '<span class="badge stop">Taken down</span>' : ""}</div>
      <h1 class="topic-title">${esc(p.title)}</h1>
      <p class="byline">${recipe ? "Written and tested by our team" : `Shared by ${userLink(authorName(p))}${p.author_profession ? `, ${esc(p.author_profession)}` : ""}`} · ${esc(day(p.created_at))}</p>
      ${recipe ? `<div class="counts" aria-label="What people said"><span class="y">${svg(IC.check)} Worked for ${plural(p.tries_worked, "person", "people")}</span><span class="n">Didn't work for ${plural(p.tries_failed, "person", "people")}</span></div>` : ""}
    </header>
    ${p.status === "pending" ? `<div class="notice">A moderator checks tips from new members, and every tip about money, health or complaints, before they go live. This usually takes up to 2 working days.${mine ? " We'll tell you under the bell when it's live." : ""}</div>` : ""}
    ${S.justPosted === p.id && mine && p.status === "published" ? justPostedPanel(p) : ""}
    ${recipe ? guideBody(p, linked) : `
      <dl class="facts"><dt>What they needed to do</dt><dd>${esc(p.task)}</dd><dt>AI tool</dt><dd>${esc(TOOLS[p.tool_key] || p.tool || "Not said")}</dd>${p.checks ? `<dt>What they checked</dt><dd>${esc(p.checks)}</dd>` : ""}</dl>
      ${p.outcome_before || p.outcome_after ? `<div class="ba" aria-label="What changed"><div><span class="lbl">Before</span><p>${esc(p.outcome_before || "Not said")}</p></div><div class="after"><span class="lbl">After</span><p>${esc(p.outcome_after || "Not said")}</p></div><p class="small muted ba-note">In their own words. Your result may be different.</p></div>` : ""}
      <section class="stack" style="gap:8px"><h2>What happened</h2><p class="prose">${esc(p.body)}</p></section>
      ${p.prompt ? `<details class="more" id="promptBox"><summary>What they typed</summary><div><div class="copybox"><pre id="promptText">${phText(p.prompt)}</pre><div class="bar"><span>Their words</span><button type="button" class="btn sm" data-copy="${esc(p.prompt)}">${svg(IC.copy)}Copy</button></div></div></div></details>` : ""}
      <p class="small muted">This is one person's experience. ${esc(NOT_ADVICE)}</p>
      ${linked.length ? `<div class="notice ok"><b>This tip helped us write a guide</b>${linked.map(x => `<a href="#t-${esc(x.id)}">${esc(x.title)}</a>`).join(", ")}</div>` : ""}`}
    ${(p.screenshots || []).length ? `<div class="shots">${p.screenshots.map((s, i) => `<a href="${esc(shotUrl(s))}" target="_blank" rel="noopener"><img src="${esc(shotUrl(s))}" alt="Screenshot ${i + 1} from the author" loading="lazy"></a>`).join("")}</div>` : ""}
    ${recipe && p.status === "published" && !mine ? feedbackBox(p, myTry) : ""}
    <div class="actions">
      ${recipe ? `<button class="btn" id="printBtn">Print this guide</button>` : ""}
      ${S.me && p.status === "published" ? (mySaved ? `<a class="btn on" href="#lib-${esc(mySaved.id)}">${svg(IC.save)}Saved</a>` : `<button class="btn" id="libSave">${svg(IC.save)}Save</button>`) : ""}
      ${!mine ? (S.me ? `<button class="btn quiet" id="reportPost">Report a problem</button>` : `<a class="btn quiet" href="#login">Report a problem</a>`) : ""}
      <span id="actMsg" role="status"></span>
    </div>
    ${mod || mine ? `<div class="admin noprint"><b>${mod ? "Admin" : "Your tip"}</b>
      ${admin && !recipe && p.status === "published" ? `<a class="btn sm" href="#guide-from-${esc(p.id)}" id="toRecipe">Turn into a guide</a>` : ""}
      ${admin && recipe ? `<a class="btn sm" href="#guide-edit-${esc(p.id)}">Edit guide</a>` : ""}
      ${mod && (p.status === "pending" || p.status === "removed") ? `<button class="btn sm" data-modset="published">Approve</button>` : ""}
      ${admin && p.status === "draft" ? `<button class="btn sm primary" data-modset="published">Publish</button>` : ""}
      ${mod && p.status !== "removed" ? `<button class="btn sm danger" data-modset="removed">Take down</button>` : ""}
      ${mine || admin ? `<button class="btn sm danger" id="delPost">Delete</button>` : ""}</div>` : ""}
    <section class="comments stack" style="gap:8px"><h2>${recipe ? "What people said" : "Comments"}</h2>
      ${notes.map(t => { const [lbl, cls] = TRY_LBL[t.result] || TRY_LBL.failed, hd = t.profiles && t.profiles.handle; return `<div class="comment"><div class="meta"><b>${userLink(hd || "a former member")}</b><span class="badge ${cls}">${lbl}</span>${t.tool_key ? `<span>${esc(TOOLS[t.tool_key] || t.tool_key)}</span>` : ""}<span>${esc(day(t.created_at))}</span></div><pre>${esc(t.note)}</pre></div>`; }).join("")}
      ${comments.map(rr => { const pr = rr.profiles || {}; return `<div class="comment"><div class="meta"><b>${userLink(pr.handle || "a former member")}</b><span>${esc(ago(rr.created_at))}</span>${rr.status === "removed" ? '<span class="badge stop">Taken down</span>' : ""}
        ${!S.me ? `<a href="#login">Report</a>` : rr.author !== S.me.id ? `<button class="btn quiet sm" data-repr="${esc(rr.id)}">Report</button>` : ""}${S.me && (rr.author === S.me.id || S.me.role === "admin") ? `<button class="btn quiet sm" data-delr="${esc(rr.id)}">Delete</button>` : ""}${mod && rr.status !== "removed" ? `<button class="btn quiet sm" data-remr="${esc(rr.id)}">Take down</button>` : ""}</div><pre>${esc(rr.body)}</pre></div>`; }).join("")}
      ${!notes.length && !comments.length ? `<p class="muted">Nothing yet.</p>` : ""}
      ${!S.me ? needLogin("Commenting") : p.status === "published" ? `<div class="field" style="margin-top:8px"><label for="rtext">Add a comment</label><textarea id="rtext" maxlength="4000" placeholder="${recipe ? "Did you try it? What would make it clearer?" : "Has this happened to you? What did you do?"}"></textarea><div class="row"><button class="btn primary" id="rsend">Post comment</button><span class="err" id="rmsg" role="alert"></span></div></div>` : ""}
    </section>
  </article>`;
  V.innerHTML = h;
  document.title = p.title + " · " + APP_NAME;
  if (S.justPosted === p.id) {
    S.justPosted = null;
    const jc = document.getElementById("jpCopy");
    if (jc) jc.onclick = async () => { const m = document.getElementById("jpMsg"); try { await navigator.clipboard.writeText(SITE() + "#t-" + p.id); m.textContent = "Link copied."; } catch (_) { m.textContent = "Select the link below and copy it."; } trackEv("ev-share-copy"); };
  }
  bindCopy();
  const pb2 = document.getElementById("printBtn"); if (pb2) pb2.onclick = () => window.print();
  const msg = (mid, t, ok) => { const el = document.getElementById(mid); if (el) { el.className = ok ? "okmsg" : "err"; el.textContent = t; } };
  const reload = () => viewTopicPost(id);
  const ls = document.getElementById("libSave");
  if (ls) ls.onclick = async () => { busy(ls, true);
    const { data, error } = await sb.from("library_items").insert({ kind: "saved", source_post: p.id, ...libCopy(p) }).select("id").single();
    if (error) { msg("actMsg", errMsg(error)); busy(ls, false); return; }
    toast("Saved. Find it under Saved.");
    const a = document.createElement("a"); a.className = "btn on"; a.href = "#lib-" + data.id; a.innerHTML = svg(IC.save) + "Saved"; ls.replaceWith(a); };
  V.querySelectorAll('input[name="tr"]').forEach(x => x.addEventListener("change", () => { const m = document.getElementById("trMsg"); if (m) m.textContent = ""; const hn = document.getElementById("trNoteHint"); if (hn) hn.textContent = x.value === "failed" ? "Tell us where it went wrong so we can fix the guide." : "Leave out anything personal."; }));
  const tryRow = () => { const sel = V.querySelector('input[name="tr"]:checked'); return sel ? { result: sel.value, note: document.getElementById("trNote").value.trim(), tool_key: document.getElementById("trTool").value } : null; };
  V.querySelectorAll("[data-trygo]").forEach(bt => bt.onclick = () => {
    const t = tryRow(); if (!t) { msg("trMsg", "Choose yes or no first."); return; }
    remember("th-pendtry", { post_id: p.id, ...t });
    location.hash = bt.dataset.trygo;
  });
  const ts = document.getElementById("trSave");
  if (ts) ts.onclick = async () => { const t = tryRow(); if (!t) { msg("trMsg", "Choose yes or no first."); return; }
    const w = blockedOnly(piiWarnings(t.note)); if (w) { msg("trMsg", "Take out " + w + " first."); return; }
    busy(ts, true); const { error } = await sb.from("tries").upsert({ post_id: p.id, user_id: S.me.id, ...t });
    if (error) { msg("trMsg", errMsg(error)); busy(ts, false); return; } await reload(); toast("Thanks. Your answer helps other people."); };
  const td = document.getElementById("trDel");
  if (td) td.onclick = async () => { await sb.from("tries").delete().eq("post_id", p.id).eq("user_id", S.me.id); reload(); };
  const rp = document.getElementById("reportPost");
  if (rp) rp.onclick = () => inlinePrompt(rp, "What's wrong with it?", "", async v => {
    const { error } = await sb.from("reports").insert({ post_id: p.id, reason: v.slice(0, 300) });
    if (error) msg("actMsg", errMsg(error)); else toast("Thanks. A moderator will look at it."); });
  V.querySelectorAll("[data-repr]").forEach(bn => bn.onclick = () => inlinePrompt(bn, "What's wrong with this comment?", "", async v => {
    const { error } = await sb.from("reports").insert({ reply_id: bn.dataset.repr, reason: v.slice(0, 300) });
    if (error) toast(errMsg(error), "err"); else toast("Thanks. A moderator will look at it."); }));
  const dp = document.getElementById("delPost");
  if (dp) dp.onclick = () => confirmTwice(dp, async () => { const { error } = await sb.from("posts").delete().eq("id", p.id); if (error) toast(errMsg(error), "err"); else location.hash = "index"; });
  V.querySelectorAll("[data-delr]").forEach(bn => bn.onclick = () => confirmTwice(bn, async () => { await sb.from("replies").delete().eq("id", bn.dataset.delr); reload(); }));
  V.querySelectorAll("[data-remr]").forEach(bn => bn.onclick = async () => { await sb.from("replies").update({ status: "removed" }).eq("id", bn.dataset.remr); reload(); });
  V.querySelectorAll("[data-modset]").forEach(bn => bn.onclick = async () => { const { error } = await sb.from("posts").update({ status: bn.dataset.modset }).eq("id", p.id); if (error) toast(errMsg(error), "err"); else reload(); });
  const rs = document.getElementById("rsend");
  if (rs) rs.onclick = async () => {
    const v = document.getElementById("rtext").value.trim();
    if (v.length < 2) { msg("rmsg", "Write something first."); return; }
    const w = blockedOnly(piiWarnings(v));
    if (w) { msg("rmsg", "Take out " + w + " first."); return; }
    busy(rs, true); const { error } = await sb.from("replies").insert({ post_id: p.id, body: v });
    if (error) { msg("rmsg", errMsg(error)); busy(rs, false); return; } await reload(); toast("Comment posted");
  };
}
// What goes into Saved when you save a guide or tip
function libCopy(p) {
  const prompt = p.type === "RECIPE" ? (p.prompts || []).map(x => (x.label ? x.label + ":\n" : "") + x.text).join("\n\n") : (p.prompt || "");
  return { type: p.type, title: p.title, body: p.type === "RECIPE" ? p.task || "" : p.body || "", prompt, tool_key: p.type === "RECIPE" ? "" : p.tool_key || "", tags: p.tags || [] };
}

// ================= share a tip =================
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
const q = (n, inner) => `<div class="qnum"><span class="n" aria-hidden="true">${n}</span><div class="stack" style="gap:6px;min-width:0">${inner}</div></div>`;
async function viewPost(boardId) {
  if (!S.me) { V.innerHTML = `<div class="read stack"><h1>Share a tip</h1><p>Tell other people how a free AI tool helped you with a boring job.</p>${needLogin("Sharing a tip")}</div>`; return; }
  if (S.me.banned) { V.innerHTML = `<div class="read stack"><h1>Share a tip</h1><div class="notice stop">Your account is suspended.</div></div>`; return; }
  const pre = S.prefill || null; S.prefill = null;
  const shots = [];
  V.innerHTML = `<div class="read stack" style="gap:24px">
   <div class="stack" style="gap:8px"><h1>Share a tip</h1><p class="muted">Tell other people how a free AI tool helped you with a boring job. It takes about 5 minutes.</p></div>
   ${pre ? `<div class="notice ok">We've filled this in from your saved prompt. Check each part before you share it.</div>` : ""}
   ${isAdmin() ? `<p class="small">You're an admin. To write a tested guide instead, <a href="#guide-new">start a guide</a>.</p>` : ""}
   <div class="notice"><b>Leave out anything personal</b>Everything you share is public. Don't include names, addresses, postcodes, phone numbers, emails, bank or card details, or reference numbers. Write [my postcode] or [account number] instead. <a href="#safe-sharing">What you can safely share</a></div>
   <form id="pf" class="formcard" novalidate>
    ${q(1, fld("pfB", "What is it about?", `<select id="pfB"><option value="">Choose a topic...</option>${S.boards.map(b => `<option value="${esc(b.id)}"${b.id === boardId ? " selected" : ""}>${esc(topicName(b.id))}</option>`).join("")}</select>`))}
    ${q(2, fld("c1", "What did you need to do?", `<input type="text" id="c1" maxlength="300" placeholder="For example: reply to a letter about my council tax">`))}
    ${q(3, `<fieldset style="border:0;padding:0;margin:0"><legend style="font-weight:700;margin-bottom:6px">Which AI tool did you use?</legend><div class="choice">${Object.entries(TOOLS).map(([k, v]) => `<label><input type="radio" name="tool" value="${k}"> ${esc(v)}</label>`).join("")}</div></fieldset>`)}
    ${q(4, fld("pfM", "What happened?", `<textarea id="pfM" maxlength="8000" placeholder="What did the AI do? What was good? What did it get wrong?"></textarea>`))}
    ${q(5, `<fieldset style="border:0;padding:0;margin:0" class="stack"><legend style="font-weight:700;margin-bottom:6px">What changed? <span class="muted" style="font-weight:400">(optional)</span></legend><p class="small muted" style="margin:0 0 6px">A few words each. Readers see it as your own account.</p><div class="row" style="align-items:flex-start">${fld("pfBefore", "Before", `<input type="text" id="pfBefore" maxlength="200" placeholder="For example: a bill I didn't understand">`)}${fld("pfAfter", "After", `<input type="text" id="pfAfter" maxlength="200" placeholder="For example: a reply sent in 20 minutes">`)}</div></fieldset>`)}
    ${q(6, fld("pfP", `What did you type? <span class="muted" style="font-weight:400">(optional)</span>`, `<textarea id="pfP" maxlength="8000" placeholder="Roughly the words you used. Take out anything personal first."></textarea>`))}
    ${q(7, fld("pfC", `What did you check before using the answer? <span class="muted" style="font-weight:400">(optional)</span>`, `<textarea id="pfC" maxlength="2000" style="min-height:80px" placeholder="For example: I checked the date on the council website."></textarea>`))}
    ${q(8, fld("pfS", "Give your tip a short title", `<input type="text" id="pfS" maxlength="120" placeholder="For example: ChatGPT helped me reply to a council tax letter">`))}
    <details class="more"><summary>Add a screenshot (optional)</summary><div class="stack" style="gap:8px">
      <p class="small muted">Crop out anything personal. We shrink the picture and remove hidden details like location before it's uploaded.</p>
      <div class="row"><label class="btn sm" for="shotIn">Choose a picture</label><input type="file" id="shotIn" accept="image/png,image/jpeg,image/webp" multiple class="sr"><span class="small" id="shotMsg"></span></div>
      <div class="shotprev" id="shotPrev"></div>
      <label class="check" id="shotOkRow" style="display:none"><input type="checkbox" id="shotOk"> These pictures show nothing personal: no names, addresses or reference numbers.</label></div></details>
    <div id="pii"></div>
    <div class="stack" style="gap:8px"><div class="row"><button class="btn primary big" type="submit" id="pfGo">Share my tip</button><span class="err" id="pfMsg" role="alert"></span></div>
    <p class="small muted">Tips are shared under <a href="#terms">CC BY 4.0</a>, so others can reuse them with credit to you. ${isAdmin() ? "" : "A moderator checks your first three tips before they go live, usually within 2 working days."}</p></div>
   </form></div>`;
  const g = id => document.getElementById(id).value.trim();
  const tool = () => (V.querySelector('input[name="tool"]:checked') || {}).value || "";
  if (pre) {
    const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
    set("pfS", pre.title); set("pfM", pre.body); set("pfP", pre.prompt);
    const r = V.querySelector(`input[name="tool"][value="${pre.tool_key}"]`); if (r) r.checked = true;
  }
  const shotMsg = t => document.getElementById("shotMsg").textContent = t || "";
  const drawShots = () => {
    document.getElementById("shotPrev").innerHTML = shots.map((s, i) => `<div class="shot"><img src="${s.url}" alt="Picture ${i + 1}"><button type="button" class="btn sm quiet" data-rmshot="${i}" aria-label="Remove picture ${i + 1}">Remove</button></div>`).join("");
    document.getElementById("shotOkRow").style.display = shots.length ? "" : "none";
  };
  const addFiles = async files => {
    shotMsg("");
    for (const f of files) {
      if (shots.length >= 3) { shotMsg("Up to 3 pictures."); break; }
      if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { shotMsg("Use a PNG, JPEG or WebP picture."); continue; }
      try { const blob = await shrinkImage(f); shots.push({ blob, url: URL.createObjectURL(blob) }); }
      catch (_) { shotMsg("We couldn't read that picture. Try a smaller one."); }
    }
    drawShots();
  };
  const shotIn = document.getElementById("shotIn");
  shotIn.onchange = async () => { await addFiles([...shotIn.files]); shotIn.value = ""; };
  document.getElementById("pf").addEventListener("paste", e => { const fs = [...(e.clipboardData || {}).files || []].filter(f => f.type.startsWith("image/")); if (fs.length) { e.preventDefault(); addFiles(fs); } });
  document.getElementById("shotPrev").onclick = e => { const b = e.target.closest("[data-rmshot]"); if (b) { const [s] = shots.splice(+b.dataset.rmshot, 1); URL.revokeObjectURL(s.url); drawShots(); } };
  const allText = () => [g("pfS"), g("pfM"), g("pfP"), g("c1"), g("pfC"), g("pfBefore"), g("pfAfter")].join(" ");
  const piiCheck = () => { const w = piiWarnings(allText()); document.getElementById("pii").innerHTML = w.length ? `<div class="notice stop" role="status"><b>Check for personal details</b>Your tip may contain ${w.map(x => esc(x.replace(" (this will be blocked)", ""))).join("; ")}. Take it out or write something like [my postcode] instead.</div>` : ""; };
  V.querySelectorAll("#pf input[type=text], #pf textarea").forEach(el => el.addEventListener("input", piiCheck));
  document.getElementById("pf").onsubmit = async e => {
    e.preventDefault(); const m = document.getElementById("pfMsg"); m.textContent = "";
    if (!g("pfB")) { m.textContent = "Choose what it's about (question 1)."; return; }
    if (!g("c1")) { m.textContent = "Say what you needed to do (question 2)."; return; }
    if (!tool()) { m.textContent = "Choose the AI tool you used (question 3)."; return; }
    if (g("pfM").length < 20) { m.textContent = "Say what happened in at least a sentence (question 4)."; return; }
    if (g("pfS").length < 3) { m.textContent = "Give your tip a short title (question 8)."; return; }
    if (shots.length && !document.getElementById("shotOk").checked) { m.textContent = "Confirm the pictures show nothing personal."; return; }
    confirmPersonalData(allText(), send);
  };
  const send = async () => {
    const m = document.getElementById("pfMsg");
    const btn = document.getElementById("pfGo"); busy(btn, true);
    const paths = [];
    for (const s of shots) {
      const path = `${S.me.id}/${rid()}.${s.blob.type === "image/webp" ? "webp" : s.blob.type === "image/png" ? "png" : "jpg"}`;
      const { error } = await sb.storage.from("shots").upload(path, s.blob, { contentType: s.blob.type, upsert: false });
      if (error) { if (paths.length) await sb.storage.from("shots").remove(paths); m.textContent = "The picture didn't upload: " + errMsg(error); busy(btn, false); return; }
      paths.push(path);
    }
    const row = { board_id: g("pfB"), type: "STORY", title: g("pfS"), tags: [], body: g("pfM"), prompt: g("pfP"), task: g("c1"), tool_key: tool(), tool: TOOLS[tool()], checks: g("pfC"), outcome_before: g("pfBefore"), outcome_after: g("pfAfter"), screenshots: paths };
    const { data, error } = await sb.from("posts").insert(row).select("id,status").single();
    if (error) { if (paths.length) await sb.storage.from("shots").remove(paths); m.textContent = errMsg(error); busy(btn, false); return; }
    shots.forEach(s => URL.revokeObjectURL(s.url));
    if (pre && pre.libId) await sb.from("library_items").update({ published_post: data.id }).eq("id", pre.libId);
    pendingToast(data.status === "pending" ? "Sent. A moderator will check it, usually within 2 working days." : "Your tip is live");
    S.justPosted = data.id;
    location.hash = "t-" + data.id;
  };
}

// ================= guide editor (admins) =================
async function viewRecipeForm(editId, fromStory) {
  if (!isAdmin()) return viewNotFound("Only admins can write guides.");
  let p = null, story = null, sources = [];
  if (editId) {
    p = (await sb.from("post_feed").select("*").eq("id", editId).maybeSingle()).data;
    if (!p || p.type !== "RECIPE") return viewNotFound("That guide doesn't exist.");
    const ids = ((await sb.from("recipe_sources").select("story_id").eq("recipe_id", editId)).data || []).map(r => r.story_id);
    if (ids.length) sources = (await sb.from("post_feed").select("id,title").in("id", ids)).data || [];
  } else if (fromStory) {
    story = (await sb.from("post_feed").select("*").eq("id", fromStory).maybeSingle()).data;
    if (!story || story.type !== "STORY") return viewNotFound("That tip doesn't exist.");
    sources = [{ id: story.id, title: story.title }];
  }
  const v = p || (story ? { title: story.title, board_id: story.board_id, task: story.task, tools: story.tool_key && story.tool_key !== "other" ? [story.tool_key] : [], prompts: story.prompt ? [{ label: "Copy and paste this", text: story.prompt }] : [], tags: story.tags || [] } : {});
  const prompts = (v.prompts || []).map(x => ({ ...x })), checks = (v.how_to_check || []).map(x => ({ ...x }));
  if (!prompts.length) prompts.push({ label: "", text: "" });
  const toolBoxes = (name, on) => `<div class="choice">${Object.entries(TOOLS).filter(([k]) => k !== "other").map(([k, l]) => `<label><input type="checkbox" name="${name}" value="${k}"${(on || []).includes(k) ? " checked" : ""}> ${esc(l)}</label>`).join("")}</div>`;
  V.innerHTML = `<div class="read stack" style="gap:20px">
   <a class="crumb" href="#mod">Admin</a>
   <h1>${p ? "Edit guide" : "New guide"}</h1>
   ${story ? `<div class="notice ok">Turning <a href="#t-${esc(story.id)}">${esc(story.title)}</a> into a guide. It stays a draft until you test it and press Publish.</div>` : ""}
   <div class="notice plain small">Personal-data checks only warn here, because guides quote official addresses. Don't include anyone's real details. Every guide shows: ${esc(NOT_ADVICE)}</div>
   <form id="rf" class="formcard" novalidate>
     ${fld("rS", "Title", `<input type="text" id="rS" maxlength="120" value="${esc(v.title || "")}">`, 'Untested guides start with "DRAFT, NOT TESTED: "')}
     ${fld("rB", "Topic", `<select id="rB"><option value="">Choose a topic...</option>${S.boards.map(b => `<option value="${esc(b.id)}"${b.id === v.board_id ? " selected" : ""}>${esc(topicName(b.id))}</option>`).join("")}</select>`)}
     ${fld("rT", "What this guide helps with, in one sentence", `<input type="text" id="rT" maxlength="300" value="${esc(v.task || "")}">`)}
     <fieldset style="border:0;padding:0;margin:0"><legend style="font-weight:700;margin-bottom:6px">Recommended free tools</legend>${toolBoxes("rTools", v.tools)}</fieldset>
     ${fld("rD", `Deadline warning <span class="muted" style="font-weight:400">(optional, shown in red at the top)</span>`, `<input type="text" id="rD" maxlength="400" value="${esc(v.deadline_warning || "")}">`)}
     <div class="stack" style="gap:8px"><b>Words to copy</b><span class="small muted">Each gets its own numbered step and Copy button.</span><div class="repeat" id="rPrompts"></div><div><button type="button" class="btn sm" id="rPromptAdd">Add more words to copy</button></div></div>
     ${fld("rN", "Don't put these into the AI tool", `<textarea id="rN" maxlength="2000" style="min-height:80px">${esc(v.never_paste || "")}</textarea>`)}
     <div class="stack" style="gap:8px"><b>Check the answer here</b><span class="small muted">Official sources: GOV.UK, Citizens Advice, the right ombudsman. Links must start with https://.</span><div class="repeat" id="rChecks"></div><div><button type="button" class="btn sm" id="rCheckAdd">Add a source</button></div></div>
     ${fld("rF", "Things that can go wrong", `<textarea id="rF" maxlength="3000" style="min-height:80px">${esc(v.failure_points || "")}</textarea>`)}
     ${fld("rH", `Search words <span class="muted" style="font-weight:400">(optional, separated by spaces)</span>`, `<input type="text" id="rH" value="${esc((v.tags || []).join(" "))}">`)}
     <div class="row" style="align-items:flex-start">${fld("rTd", "Last tested on", `<input type="date" id="rTd" value="${esc((v.tested_tools || []).length ? (v.tested_on || "") : "")}">`, "Leave blank if not tested yet.")}${fld("rR", "Re-test by", `<input type="date" id="rR" value="${esc(v.retest_due || "")}">`, 'After this the guide shows "May be out of date".')}</div>
     <fieldset style="border:0;padding:0;margin:0"><legend style="font-weight:700;margin-bottom:6px">Tested with</legend>${toolBoxes("rTested", v.tested_tools)}</fieldset>
     <div class="stack" style="gap:6px"><b>Based on tips</b><div id="rSrc"></div></div>
     <div id="rPii"></div>
     <div class="row"><button class="btn" type="button" id="rDraft">Save as draft</button><button class="btn primary" type="button" id="rPub">Publish</button><span class="err" id="rMsg" role="alert"></span></div>
   </form></div>`;
  const g = id => document.getElementById(id).value.trim();
  const picked = name => [...V.querySelectorAll(`input[name="${name}"]:checked`)].map(x => x.value);
  const rowList = (elId, list, fields, addId, blank) => {
    const el = document.getElementById(elId);
    const draw = () => { el.innerHTML = list.map((x, i) => `<div class="r"><div>${fields.map(([k, l]) => k === "text" ? `<textarea data-k="${k}" data-i="${i}" aria-label="${l} ${i + 1}" placeholder="${l}">${esc(x[k] || "")}</textarea>` : `<input type="text" data-k="${k}" data-i="${i}" aria-label="${l} ${i + 1}" placeholder="${l}" value="${esc(x[k] || "")}">`).join("")}</div><button type="button" class="btn sm quiet" data-rm="${i}">Remove</button></div>`).join("") || `<div class="small muted">None yet.</div>`; };
    el.addEventListener("input", e => { const t = e.target; if (t.dataset.k) { list[+t.dataset.i][t.dataset.k] = t.value; piiCheck(); } });
    el.addEventListener("click", e => { const t = e.target.closest("[data-rm]"); if (t) { list.splice(+t.dataset.rm, 1); draw(); } });
    document.getElementById(addId).onclick = () => { if (list.length < 12) { list.push({ ...blank }); draw(); } };
    draw();
  };
  rowList("rPrompts", prompts, [["label", "Step heading, e.g. Draft the letter"], ["text", "The words to copy"]], "rPromptAdd", { label: "", text: "" });
  rowList("rChecks", checks, [["label", "Source name, e.g. Citizens Advice"], ["url", "https://..."]], "rCheckAdd", { label: "", url: "" });
  const srcEl = document.getElementById("rSrc");
  const drawSrc = () => { srcEl.innerHTML = sources.length ? sources.map((s, i) => `<div class="row"><a href="#t-${esc(s.id)}">${esc(s.title)}</a><button type="button" class="btn sm quiet" data-rms="${i}">Unlink</button></div>`).join("") : `<span class="small muted">None. Use "Turn into a guide" on a tip to link it.</span>`; };
  srcEl.onclick = e => { const t = e.target.closest("[data-rms]"); if (t) { sources.splice(+t.dataset.rms, 1); drawSrc(); } };
  drawSrc();
  const allText = () => [g("rS"), g("rT"), g("rN"), g("rF"), g("rD"), prompts.map(x => x.label + " " + x.text).join(" ")].join(" ");
  const piiCheck = () => { const w = piiWarnings(allText()).map(x => x.replace(" (this will be blocked)", "")); document.getElementById("rPii").innerHTML = w.length ? `<div class="notice">This guide contains ${w.map(esc).join("; ")}. That's fine for official addresses, but make sure none of it is a real person's details.</div>` : ""; };
  V.querySelectorAll("#rf input[type=text], #rf textarea").forEach(el => el.addEventListener("input", piiCheck)); piiCheck();
  const save = async status => {
    const m = document.getElementById("rMsg"); m.textContent = "";
    const ps = prompts.map(x => ({ label: (x.label || "").trim(), text: (x.text || "").trim() })).filter(x => x.text);
    const cs = checks.map(x => ({ label: (x.label || "").trim(), url: (x.url || "").trim() })).filter(x => x.label || x.url);
    if (g("rS").length < 3) { m.textContent = "Add a title."; return; }
    if (!g("rB")) { m.textContent = "Choose a topic."; return; }
    if (!g("rT")) { m.textContent = "Say what the guide helps with."; return; }
    if (status === "published" && !ps.length) { m.textContent = "Add at least one set of words to copy before publishing."; return; }
    if (cs.some(c => !c.label || !/^https:\/\/\S+$/.test(c.url))) { m.textContent = "Each source needs a name and a link that starts with https://."; return; }
    if (status === "published" && /^DRAFT, NOT TESTED/i.test(g("rS"))) { m.textContent = 'Test it first, then remove "DRAFT, NOT TESTED" from the title.'; return; }
    const row = { board_id: g("rB"), title: g("rS"), task: g("rT"), tags: parseTags(g("rH")), tools: picked("rTools"), prompts: ps, never_paste: g("rN"), how_to_check: cs, failure_points: g("rF"), deadline_warning: g("rD"), tested_tools: picked("rTested"), tested_on: g("rTd") || isoDay(new Date()), retest_due: g("rR") || null, status };
    const btn = document.getElementById(status === "draft" ? "rDraft" : "rPub"); busy(btn, true);
    let rid2 = editId, error;
    if (editId) ({ error } = await sb.from("posts").update(row).eq("id", editId));
    else { const r = await sb.from("posts").insert({ ...row, type: "RECIPE" }).select("id,status").single(); error = r.error; if (r.data) rid2 = r.data.id; }
    if (error) { m.textContent = errMsg(error); busy(btn, false); return; }
    if (editId) await sb.from("recipe_sources").delete().eq("recipe_id", editId);
    if (sources.length) { const r2 = await sb.from("recipe_sources").insert(sources.map(s => ({ recipe_id: rid2, story_id: s.id }))); if (r2.error) { m.textContent = "Saved, but linking the tips failed: " + errMsg(r2.error); busy(btn, false); return; } }
    pendingToast(status === "draft" ? "Guide saved as a draft" : "Guide published");
    location.hash = "t-" + rid2;
  };
  document.getElementById("rDraft").onclick = () => save("draft");
  document.getElementById("rPub").onclick = () => save("published");
}

// ================= notifications, metrics =================
async function loadNotifCount() {
  const bell = document.getElementById("bell"); if (!bell || !S.me) return;
  const { count } = await sb.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  const n = count || 0, dot = bell.querySelector(".dot");
  dot.textContent = n > 99 ? "99+" : n; dot.hidden = !n;
  bell.setAttribute("aria-label", n ? `Notifications, ${n} new` : "Notifications");
}
const TRY_TXT = { worked: "it worked", failed: "it didn't work" };
async function viewNotifications() {
  if (!S.me) { V.innerHTML = `<div class="read stack"><h1>Notifications</h1>${needLogin("Notifications")}</div>`; return; }
  const { data, error } = await sb.from("notifications").select("id,kind,post_id,actor,detail,read_at,created_at").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  const list = data || [];
  const pids = [...new Set(list.map(n => n.post_id).filter(Boolean))], aids = [...new Set(list.map(n => n.actor).filter(Boolean))];
  const [ps, as] = await Promise.all([pids.length ? sb.from("post_feed").select("id,title").in("id", pids) : { data: [] }, aids.length ? sb.from("profiles").select("id,handle").in("id", aids) : { data: [] }]);
  const title = {}, who = {}; (ps.data || []).forEach(p => title[p.id] = p.title); (as.data || []).forEach(p => who[p.id] = p.handle);
  const row = n => {
    const t = `<a href="#t-${esc(n.post_id)}">${esc(title[n.post_id] || "your post")}</a>`, a = n.actor ? esc(who[n.actor] || "Someone") : "";
    const line = n.kind === "approved" ? `Your tip ${t} is now live.`
      : n.kind === "try" ? `${a} said ${esc(TRY_TXT[n.detail] || n.detail)} for ${t}.`
      : n.kind === "fork" ? `${a} reused ${t}.`
      : `${a} commented on ${t}: "${esc(n.detail)}${n.detail.length >= 140 ? "..." : ""}"`;
    return `<li class="comment"><div>${n.read_at ? "" : '<span class="badge ok">New</span> '}${line}</div><div class="meta">${esc(ago(n.created_at))}</div></li>`;
  };
  V.innerHTML = `<div class="read stack"><h1>Notifications</h1><p class="muted">Comments on your tips, and when a moderator approves one. Kept for 120 days.</p>
    ${list.length ? `<ul class="items" style="border:0">${list.map(row).join("")}</ul>` : `<div class="empty">Nothing yet.</div>`}</div>`;
  if (list.some(n => !n.read_at)) { await sb.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null); loadNotifCount(); }
}
async function loadMetrics() {
  const box = document.getElementById("metrics"); if (!box || !isAdmin()) return;
  const { data, error } = await sb.rpc("admin_metrics");
  if (error || !data) { box.innerHTML = `<p class="small muted">Weekly figures unavailable: ${esc(error ? errMsg(error) : "no data")}</p>`; return; }
  const w = (data.weeks || []).slice().reverse();
  box.innerHTML = `<section class="stack" style="gap:8px"><h2>How it's going</h2><p class="small muted">"Share" and "Browse" count clicks on the two buttons on the home page. Nothing here identifies a person.</p>
    <div class="tablewrap" tabindex="0" role="region" aria-label="Weekly figures"><table><thead><tr><th scope="col">Week from</th><th scope="col">Guide answers</th><th scope="col">Posts</th><th scope="col">Comments</th><th scope="col">New members</th><th scope="col">Share clicks</th><th scope="col">Browse clicks</th><th scope="col">Visits</th></tr></thead>
    <tbody>${w.map(r => `<tr><td>${esc(r.week)}</td><td><b>${r.tries}</b></td><td>${r.posts}</td><td>${r.replies}</td><td>${r.members}</td><td>${r.share_clicks ?? 0}</td><td>${r.browse_clicks ?? 0}</td><td>${r.views}</td></tr>`).join("")}</tbody></table></div></section>`;
}

// ================= saved (library) =================
const LIB_COLS = "id,kind,source_post,published_post,type,title,body,prompt,notes,tool_key,tags,snapshot_at,created_at,updated_at";
const isUpdated = (it, src) => !!(src && it.snapshot_at && new Date(src.updated_at) > new Date(it.snapshot_at));
function download(name, text, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function libMarkdown(items) {
  return `# Saved from ${APP_NAME}\n\nDownloaded ${day(new Date())}.\n\n` + items.map(i => [
    `## ${i.title}`, i.kind === "saved" ? `Saved from ${SITE()}#t-${i.source_post || ""}` : "My own prompt",
    i.body ? `\n${i.body}` : "", i.prompt ? `\nWords to copy:\n\n${i.prompt}` : "", i.notes ? `\nMy notes:\n\n${i.notes}` : ""
  ].filter(Boolean).join("\n")).join("\n\n---\n\n") + "\n";
}
async function viewLibrary() {
  if (!S.me) { V.innerHTML = `<div class="read stack"><h1>Saved</h1><p>Keep the guides and tips you want to come back to, and your own prompts, in one private place.</p>${needLogin("Saving")}</div>`; return; }
  const { data, error } = await sb.from("library_items").select(LIB_COLS).order("updated_at", { ascending: false }).limit(300);
  if (error) throw error;
  const items = data || [];
  const ids = [...new Set(items.map(i => i.source_post).filter(Boolean))];
  const srcMap = {};
  if (ids.length) ((await sb.from("post_feed").select(FEED_COLS + ",updated_at").in("id", ids)).data || []).forEach(p => srcMap[p.id] = p);
  const saved = items.filter(i => i.kind === "saved"), own = items.filter(i => i.kind === "draft");
  const row = i => { const src = srcMap[i.source_post];
    return `<li><a class="item" href="#lib-${esc(i.id)}"><span class="t">${esc(i.title)}</span>${i.notes ? `<span class="d">Your notes: ${esc(i.notes.slice(0, 100))}</span>` : ""}<span class="m"><span class="badge ${i.type === "RECIPE" ? "guide" : "tip"}">${i.kind === "draft" ? "My prompt" : KIND[i.type] || "Saved"}</span>${isUpdated(i, src) ? '<span class="badge warn">Updated since you saved it</span>' : ""}${i.kind === "saved" && !i.source_post ? '<span class="badge stop">Original removed</span>' : ""}${i.published_post ? '<span class="badge ok">Shared as a tip</span>' : ""}<span>Changed ${esc(ago(i.updated_at))}</span></span></a></li>`; };
  V.innerHTML = `<div class="read stack" style="gap:24px">
    <div class="stack" style="gap:8px"><h1>Saved</h1><p class="muted">Only you can see this page. Keep using placeholders like [my postcode] in your own prompts and notes.</p></div>
    <section class="stack" style="gap:8px"><h2>Guides and tips you saved</h2>${saved.length ? `<ul class="items">${saved.map(row).join("")}</ul>` : `<div class="empty">Nothing saved yet. Press <b>Save</b> on any guide or tip.</div>`}</section>
    <section class="stack" style="gap:8px"><div class="row" style="justify-content:space-between"><h2>My own prompts</h2><a class="btn sm" href="#lib-new">Add a prompt</a></div>${own.length ? `<ul class="items">${own.map(row).join("")}</ul>` : `<div class="empty">Keep the words that work for you here.</div>`}</section>
    ${items.length ? `<div><button class="btn sm" id="exMd">Download a copy</button></div>` : ""}</div>`;
  const ex = document.getElementById("exMd"); if (ex) ex.onclick = () => download("boring-bits-saved.md", libMarkdown(items), "text/markdown");
}
async function viewLibItem(id) {
  if (!S.me) { V.innerHTML = `<div class="read stack"><h1>Saved</h1>${needLogin("Saving")}</div>`; return; }
  const isNew = id === "new";
  const it = isNew ? { kind: "draft", type: "STORY", title: "", body: "", prompt: "", notes: "", tool_key: "", tags: [] }
    : (await sb.from("library_items").select(LIB_COLS).eq("id", id).maybeSingle()).data;
  if (!it) return viewNotFound("That doesn't exist, or it isn't yours.");
  const src = it.source_post ? (await sb.from("post_feed").select("*").eq("id", it.source_post).maybeSingle()).data : null;
  const upd = isUpdated(it, src), fromGuide = it.kind === "saved" && src && src.type === "RECIPE";
  document.title = (isNew ? "New prompt" : it.title) + " · " + APP_NAME;
  V.innerHTML = `<div class="read stack" style="gap:20px">
    <a class="crumb" href="#library">Saved</a>
    <h1>${isNew ? "Add a prompt" : esc(it.title)}</h1>
    <p class="muted">${it.kind === "saved" ? (src ? `Your own copy of <a href="#t-${esc(src.id)}">${esc(src.title)}</a>. Change it however you like. The original stays the same.` : "The original has been removed. Your copy is still here.") : "Private to you. Share it as a tip once you've used it."}</p>
    ${upd ? `<div class="notice ok"><b>The original has changed since you saved it.</b><div class="row" style="margin-top:8px"><button type="button" class="btn sm" id="libRefresh">Replace my copy with the latest version</button><a href="#t-${esc(src.id)}">See the original</a></div></div>` : ""}
    ${it.published_post ? `<div class="notice ok">You shared this as <a href="#t-${esc(it.published_post)}">a tip</a>.</div>` : ""}
    <form id="lf" class="formcard" novalidate>
     ${fld("lT", "Title", `<input type="text" id="lT" maxlength="120" value="${esc(it.title)}">`)}
     ${fld("lP", "Words to copy", `<textarea id="lP" maxlength="8000" style="min-height:180px">${esc(it.prompt)}</textarea>`)}
     ${fld("lB", "What it's for", `<textarea id="lB" maxlength="8000" style="min-height:80px">${esc(it.body)}</textarea>`)}
     ${fld("lTool", "AI tool", `<select id="lTool"><option value="">Not set</option>${Object.entries(TOOLS).map(([k, v]) => `<option value="${k}"${it.tool_key === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>`)}
     ${fld("lN", "My notes", `<textarea id="lN" maxlength="4000" style="min-height:80px" placeholder="What you changed, what to try next.">${esc(it.notes)}</textarea>`)}
     <div id="lPii"></div>
     <div class="row"><button class="btn primary" type="submit" id="lSave">${isNew ? "Save prompt" : "Save changes"}</button>
      ${!isNew && it.kind === "draft" ? `<button type="button" class="btn" id="lPub">Share as a tip</button>` : ""}
      ${!isNew ? `<button type="button" class="btn danger" id="lDel">Delete</button>` : ""}<span id="lMsg" role="status"></span></div>
    </form></div>`;
  const g = x => document.getElementById(x).value.trim();
  const out = (t, ok) => { const el = document.getElementById("lMsg"); el.className = ok ? "okmsg" : "err"; el.textContent = t; };
  const scanText = () => fromGuide ? g("lN") : [g("lT"), g("lB"), g("lP"), g("lN")].join(" ");
  const piiCheck = () => { const w = piiWarnings(scanText()); document.getElementById("lPii").innerHTML = w.length ? `<div class="notice stop">This may contain ${w.map(x => esc(x.replace(" (this will be blocked)", ""))).join("; ")}. Use a placeholder like [my postcode] instead.</div>` : ""; };
  V.querySelectorAll("#lf input[type=text], #lf textarea").forEach(el => el.addEventListener("input", piiCheck));
  const payload = () => ({ title: g("lT"), type: it.type || "STORY", tool_key: g("lTool"), body: g("lB"), prompt: g("lP"), notes: g("lN"), tags: it.tags || [] });
  const save = async () => {
    const row = payload();
    if (!row.title) { out("Add a title."); return null; }
    const blocked = blockedOnly(piiWarnings(scanText()));
    if (blocked) { out("Take out " + blocked + " first."); return null; }
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

// ================= accounts =================
function viewLogin(mode = "login") {
  if (S.me) { location.hash = "me"; return; }
  const join = mode === "join";
  V.innerHTML = `<div class="read stack" style="gap:20px;max-width:520px">
   <h1>${join ? "Create an account" : "Log in"}</h1>
   <p class="muted">${join ? "It's free. You need an account to share a tip, save guides, or say whether a guide worked." : `New here? <a href="#join">Create an account</a>.`}</p>
   <form id="af" class="formcard" novalidate>
    ${join ? fld("aH", "Choose a username", `<input type="text" id="aH" maxlength="20" autocomplete="username" placeholder="3 to 20 letters, numbers or _">`, "Shown on your tips. It doesn't have to be your real name.") : ""}
    ${fld("aE", "Email", `<input type="email" id="aE" autocomplete="email">`, join ? "We never show your email." : "")}
    ${fld("aW", "Password", `<input type="password" id="aW" autocomplete="${join ? "new-password" : "current-password"}" minlength="8">`, join ? "At least 8 characters." : "")}
    ${join ? `<label class="check"><input type="checkbox" id="aR"> I'm 18 or over, and I agree to the <a href="#terms">terms</a> and <a href="#rules">house rules</a>. I've read the <a href="#privacy">privacy notice</a>.</label>` : ""}
    <div class="row"><button class="btn primary big" type="submit">${join ? "Create my account" : "Log in"}</button></div>
    <div id="aMsg" role="alert"></div>
    ${join ? `<p class="small">Already have an account? <a href="#login">Log in</a></p>` : `<p class="small"><a href="#" id="forgot">I forgot my password</a> · <a href="#" id="magic">Email me a login link</a></p>`}
   </form></div>`;
  const out = (t, ok) => { const el = document.getElementById("aMsg"); el.className = ok ? "notice ok" : "err"; el.textContent = t; };
  const g = id => (document.getElementById(id) || {}).value?.trim() || "";
  document.getElementById("af").onsubmit = async e => {
    e.preventDefault();
    const email = g("aE"), pw = document.getElementById("aW").value;
    if (!/^\S+@\S+\.\S+$/.test(email)) return out("Enter a valid email address.");
    if (pw.length < 8) return out("Passwords need at least 8 characters.");
    if (join) {
      const handle = g("aH").toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(handle)) return out("Usernames are 3 to 20 letters, numbers or underscores.");
      if (!document.getElementById("aR").checked) return out("Please confirm you're 18 or over and agree to the terms.");
      const { data, error } = await sb.auth.signUp({ email, password: pw, options: { data: { handle }, emailRedirectTo: SITE() } });
      if (error) return out(errMsg(error));
      if (data.session) { await loadMe(); await afterLogin(); }
      else out("Check your email for a link to confirm your account. It brings you back to where you were.", true);
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password: pw });
      if (error) return out(errMsg(error));
      await loadMe(); await afterLogin();
    }
  };
  const fg = document.getElementById("forgot");
  if (fg) fg.onclick = async e => { e.preventDefault(); const email = g("aE"); if (!email) return out("Enter your email above first.");
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: SITE() + "#newpass" }); out(error ? errMsg(error) : "If that email has an account, we've sent a link to reset the password.", !error); };
  const mg = document.getElementById("magic");
  if (mg) mg.onclick = async e => { e.preventDefault(); const email = g("aE"); if (!email) return out("Enter your email above first.");
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: SITE() } }); out(error ? errMsg(error) : "If that email has an account, we've sent a login link.", !error); };
}
async function afterLogin() {
  const back = recall("th-return"); remember("th-return", null);
  const pend = recall("th-pendtry"); remember("th-pendtry", null);
  if (pend && S.me) {
    const { error } = await sb.from("tries").upsert({ post_id: pend.post_id, user_id: S.me.id, result: pend.result, note: pend.note || "", tool_key: pend.tool_key || "" });
    pendingToast(error ? "We couldn't send your answer. " + errMsg(error) : "Thanks. Your answer is saved.");
    location.hash = "t-" + pend.post_id; return;
  }
  if (back) pendingToast("You're logged in");
  location.hash = back || "index";
}
function viewNewPass() {
  V.innerHTML = `<div class="read stack" style="max-width:520px"><h1>Choose a new password</h1><div class="formcard">${fld("np", "New password", `<input type="password" id="np" autocomplete="new-password" minlength="8">`, "At least 8 characters.")}<div class="row"><button class="btn primary" id="npGo">Save</button><span id="npMsg" role="alert"></span></div></div></div>`;
  document.getElementById("npGo").onclick = async () => { const v = document.getElementById("np").value; const m = document.getElementById("npMsg");
    if (v.length < 8) { m.className = "err"; m.textContent = "At least 8 characters."; return; }
    const { error } = await sb.auth.updateUser({ password: v }); m.className = error ? "err" : "okmsg"; m.textContent = error ? errMsg(error) : "Saved. You're logged in."; };
}
function displayBox() {
  const large = currentDisplay().font === "large";
  return `<section class="stack" style="gap:8px"><h2 id="tsH">Text size</h2><div class="choice" role="radiogroup" aria-labelledby="tsH">
    <label><input type="radio" name="font" value="standard"${!large ? " checked" : ""}> Standard</label>
    <label style="font-size:1.15em"><input type="radio" name="font" value="large"${large ? " checked" : ""}> Larger, higher contrast</label></div>
    <p class="small muted">${S.me ? "Saved to your account." : "Saved in this browser."} The larger option switches to Atkinson Hyperlegible, a font designed for people with low vision.</p></section>`;
}
function bindDisplay() { V.querySelectorAll('input[name="font"]').forEach(el => el.onchange = () => saveDisplay({ font: el.value })); }
function viewDisplay() { V.innerHTML = `<div class="read stack"><h1>Text size</h1>${displayBox()}</div>`; bindDisplay(); }
async function viewMe() {
  if (!S.me) { V.innerHTML = `<div class="read stack"><h1>Your account</h1>${displayBox()}${needLogin("An account")}</div>`; bindDisplay(); return; }
  V.innerHTML = `<div class="read stack" style="gap:28px">
   <div class="row" style="justify-content:space-between"><h1>Your account</h1><button class="btn" id="signout">Log out</button></div>
   <section class="formcard"><h2>Your profile</h2>
     ${fld("sH", "Username", `<input type="text" id="sH" maxlength="20" value="${esc(S.me.handle)}">`)}
     ${fld("sP", `About you <span class="muted" style="font-weight:400">(optional, shown on your tips)</span>`, `<input type="text" id="sP" maxlength="60" value="${esc(S.me.profession)}" placeholder="For example: library volunteer">`)}
     <div class="row"><button class="btn primary" id="sGo">Save</button><span id="sMsg" role="alert"></span></div></section>
   ${displayBox()}
   <section class="stack" style="gap:8px"><h2>Your data</h2>
    <div class="row"><button class="btn" id="exp">Show a copy of my data</button><button class="btn danger" id="delAcc">Delete my account</button></div>
    <p class="small muted">Deleting removes your login, profile, saved items, notifications and answers. Your tips stay up as "a former member" unless you delete them first.</p>
    <pre id="expOut" class="small" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre></section></div>`;
  bindDisplay();
  document.getElementById("signout").onclick = async () => { await sb.auth.signOut(); location.hash = "index"; };
  document.getElementById("sGo").onclick = async () => {
    const m = document.getElementById("sMsg"), h = document.getElementById("sH").value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(h)) { m.className = "err"; m.textContent = "Usernames are 3 to 20 letters, numbers or underscores."; return; }
    const { error } = await sb.from("profiles").update({ handle: h, profession: document.getElementById("sP").value.trim() }).eq("id", S.me.id);
    m.className = "err"; m.textContent = error ? (/duplicate|unique/i.test(error.message) ? "That username is taken." : errMsg(error)) : "";
    if (!error) { await loadMe(); toast("Saved"); }
  };
  document.getElementById("exp").onclick = async () => {
    const id = S.me.id;
    const [po, re, tr, lb] = await Promise.all([sb.from("posts").select("*").eq("author", id), sb.from("replies").select("*").eq("author", id), sb.from("tries").select("*").eq("user_id", id), sb.from("library_items").select("*").eq("owner", id)]);
    document.getElementById("expOut").textContent = JSON.stringify({ account: { email: S.session.user.email, ...S.me }, posts: po.data, comments: re.data, guide_answers: tr.data, saved: lb.data }, null, 2);
  };
  const da = document.getElementById("delAcc");
  da.onclick = () => confirmTwice(da, async () => { const { error } = await sb.rpc("delete_my_account"); if (error) { da.textContent = errMsg(error); return; } await sb.auth.signOut(); location.hash = "index"; });
}
async function viewProfile(handle) {
  const { data: u } = await sb.from("member_directory").select("*").eq("handle", handle).maybeSingle();
  if (!u) return viewNotFound("We couldn't find that member.");
  const posts = await fetchPosts(publishedPosts().eq("author", u.id));
  const canAdmin = isAdmin() && u.role !== "admin";
  V.innerHTML = `<div class="read stack" style="gap:20px">
    <h1>${esc(u.handle)}</h1>
    <p class="muted">${u.role === "admin" ? "Admin · " : ""}${u.profession ? esc(u.profession) + " · " : ""}Member since ${esc(day(u.created_at))}</p>
    ${canAdmin ? `<div class="admin"><b>Admin</b><button class="btn sm danger" id="ban">Suspend</button><button class="btn sm" id="unban">Restore</button><label class="sr" for="wardB">Topic</label><select id="wardB" style="width:auto">${S.boards.map(b => `<option value="${esc(b.id)}">${esc(topicName(b.id))}</option>`).join("")}</select><button class="btn sm" id="wardAdd">Make moderator</button><button class="btn sm" id="wardDel">Remove as moderator</button><span id="admMsg" role="status"></span></div>` : ""}
    <section class="stack" style="gap:8px"><h2>Their tips and guides</h2>${itemList(posts.sort(byNew), "Nothing published yet.")}</section></div>`;
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

// ================= admin =================
async function viewMod() {
  if (!S.isMod) return viewNotFound();
  const [pend, reps, drafts] = await Promise.all([
    sb.from("post_feed").select(FEED_COLS + ",body").eq("status", "pending").order("created_at"),
    sb.from("reports").select("id,reason,created_at,post_id,reply_id,status,posts(title,board_id),replies(body,post_id)").eq("status", "open").order("created_at"),
    isAdmin() ? sb.from("post_feed").select("id,title,board_id,created_at,type").eq("status", "draft").order("created_at") : Promise.resolve({ data: [] })
  ]);
  const pp = (pend.data || []).filter(p => isModOf(p.board_id)), dr = drafts.data || [], rp = reps.data || [];
  V.innerHTML = `<div class="stack" style="gap:32px">
   <div class="row" style="justify-content:space-between"><h1>Admin</h1>${isAdmin() ? `<a class="btn primary" href="#guide-new">Write a guide</a>` : ""}</div>
   <section class="stack" style="gap:8px"><h2>Tips waiting for approval (${pp.length})</h2>
    ${pp.length ? `<div class="tablewrap" tabindex="0" role="region" aria-label="Tips waiting for approval"><table><tbody>${pp.map(p => `<tr><td><a href="#t-${esc(p.id)}"><b>${esc(p.title)}</b></a><br><span class="small muted">${esc(p.author_handle || "")} · ${esc(topicName(p.board_id))} · ${esc(ago(p.created_at))}${HELD.includes(p.board_id) ? " · always checked in this topic" : ""}</span><p class="small" style="margin-top:4px">${esc((p.body || "").slice(0, 300))}</p></td><td style="white-space:nowrap"><button class="btn sm primary" data-ap="${esc(p.id)}">Approve</button> <button class="btn sm danger" data-rm="${esc(p.id)}">Take down</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Nothing waiting.</div>`}</section>
   ${isAdmin() ? `<section class="stack" style="gap:8px"><h2>Draft guides (${dr.length})</h2>${dr.length ? `<div class="tablewrap" tabindex="0" role="region" aria-label="Draft guides"><table><tbody>${dr.map(p => `<tr><td><a href="#t-${esc(p.id)}"><b>${esc(p.title)}</b></a><br><span class="small muted">${esc(topicName(p.board_id))} · started ${esc(day(p.created_at))}</span></td><td><a class="btn sm" href="#guide-edit-${esc(p.id)}">Edit</a></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No drafts.</div>`}</section>` : ""}
   <section class="stack" style="gap:8px"><h2>Reports (${rp.length})</h2>
    ${rp.length ? `<div class="tablewrap" tabindex="0" role="region" aria-label="Reports"><table><tbody>${rp.map(r => `<tr><td>"${esc(r.reason)}"<br><span class="small muted">${r.post_id ? `About <a href="#t-${esc(r.post_id)}">${esc(r.posts ? r.posts.title : "a post")}</a>` : `About a comment on <a href="#t-${esc(r.replies ? r.replies.post_id : "")}">this page</a>: ${esc(r.replies ? r.replies.body.slice(0, 120) : "")}`} · ${esc(ago(r.created_at))}</span></td><td style="white-space:nowrap"><button class="btn sm danger" data-act="${esc(r.id)}">Take down</button> <button class="btn sm" data-dis="${esc(r.id)}">Dismiss</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No open reports.</div>`}
    <p class="small muted">Keep a short note of serious reports and what you did. Under the Online Safety Act you should be able to show how you handle illegal content and complaints.</p></section>
   <div id="metrics"></div></div>`;
  const re = () => viewMod().then(loadMetrics);
  V.querySelectorAll("[data-ap]").forEach(b => b.onclick = async () => { await sb.from("posts").update({ status: "published" }).eq("id", b.dataset.ap); re(); });
  V.querySelectorAll("[data-rm]").forEach(b => b.onclick = async () => { await sb.from("posts").update({ status: "removed" }).eq("id", b.dataset.rm); re(); });
  V.querySelectorAll("[data-dis]").forEach(b => b.onclick = async () => { await sb.from("reports").update({ status: "dismissed" }).eq("id", b.dataset.dis); re(); });
  V.querySelectorAll("[data-act]").forEach(b => b.onclick = async () => {
    const r = rp.find(x => x.id === b.dataset.act);
    if (r.post_id) await sb.from("posts").update({ status: "removed" }).eq("id", r.post_id);
    else await sb.from("replies").update({ status: "removed" }).eq("id", r.reply_id);
    await sb.from("reports").update({ status: "actioned" }).eq("id", r.id); re();
  });
}

// ================= help and legal pages =================
const OPERATOR = { name: "Ahmad Ismail", email: "ahmadismailcv@gmail.com" }; // who runs the site and how to contact them (shown publicly on purpose)
const LAST_UPDATED = "20 November 2026";
const opName = () => esc(OPERATOR.name);
const opEmail = () => `<a href="mailto:${esc(OPERATOR.email)}">${esc(OPERATOR.email)}</a>`;
function docPage(title, intro, sections) {
  V.innerHTML = `<article class="doc"><h1>${title}</h1><p class="muted" style="margin-top:8px;font-size:1.1rem">${intro}</p>
   ${sections.map(([h, b]) => `<section><h2>${esc(h)}</h2>${b}</section>`).join("")}
   <p class="small muted" style="margin-top:32px">Last updated ${LAST_UPDATED}.</p></article>`;
}
const notAdviceSec = ["This is not advice", `<p><b>${esc(NOT_ADVICE)}</b> Tips are people's own experiences. Guides are our best attempt at a reliable method, tested on the dates shown, but AI tools change and make mistakes. Check every answer against the official sources linked, and get proper advice for anything important, for example from Citizens Advice, a solicitor, your GP or NHS 111.</p>`];
function viewHelp() {
  docPage("Help", "Answers to common questions.", [
    ["What is this site?", `<p>Free help with everyday paperwork using free AI tools such as ChatGPT, Microsoft Copilot, Google Gemini and Claude. It's for adults in the UK, and for people who help others, like library volunteers, support workers and family members.</p>`],
    ["What's the difference between a guide and a tip?", `<p>A <b>guide</b> is step by step. We write it and test it ourselves. It tells you what to type, what to keep private, and where to check the answer.</p><p>A <b>tip</b> is shared by a member. It says what they needed to do, which tool they used and what happened.</p>`],
    ["Do I need to pay for an AI tool?", `<p>No. Every guide works with the free versions.</p>`],
    ["What should I never type into an AI tool?", `<p>Passwords, PINs, bank or card details, your National Insurance number, and anything about someone else they wouldn't want shared. Each guide lists what to leave out. See <a href="#safe-sharing">What you can safely share</a>.</p>`],
    ["What does \"May be out of date\" mean?", `<p>Every guide has a date to test it again, because AI tools change. After that date it shows this label until we've tested it again.</p>`],
    ["Why is my tip waiting?", `<p>A moderator checks the first three tips from each new member. After that yours go live straight away, except tips about money, health or complaints, which are always checked. This usually takes up to 2 working days.</p>`],
    ["Can I get medical advice here?", `<p>No. The health topic is only for appointments, forms and NHS paperwork. For health worries, contact your GP or NHS 111. In an emergency, call 999.</p>`],
    ["The text is hard to read.", `<p>Go to <a href="#display">Text size</a> and choose the larger option.</p>`],
    notAdviceSec
  ]);
}
function viewRules() {
  docPage("House rules", "Share what really happened, keep personal details out, and be kind.", [
    ["Who it's for", `<p>Adults (18 and over) in the UK who use, or want to use, free AI tools for everyday jobs, and the people who help them.</p>`],
    ["Share what really happened", `<p>Say what you needed to do, which tool you used and what happened, including what went wrong.</p>`],
    ["Nothing personal", `<p>Everything here is public. Leave out names, addresses, postcodes, phone numbers, email addresses, bank and card details, National Insurance numbers, and account or reference numbers, about you or anyone else. Write [my postcode] or [account number] instead. The site blocks the most common ones automatically.</p>`],
    ["No medical advice", `<p>Don't post or ask for diagnosis or treatment advice.</p>`],
    ["No selling", `<p>If you sell, built or are paid to promote a tool you mention, say so. No adverts, spam or affiliate links.</p>`],
    ["Be kind", `<p>No harassment, hate, threats, scams or illegal content.</p>`],
    ["Moderation", `<p>Press "Report a problem" on anything that breaks these rules. Moderators can hold or take down posts and suspend accounts. To complain about a decision, see <a href="#complaints">Reports and complaints</a>.</p>`],
    notAdviceSec
  ]);
}
function viewSafeSharing() {
  docPage("What you can safely share", "Check this before you post, add a picture, or type anything into an AI tool.", [
    ["Fine to share", `<ul><li>What you needed to do, in general terms.</li><li>Which AI tool you used.</li><li>Roughly what you typed, with anything personal taken out.</li><li>What the AI got right and wrong, and what you checked.</li></ul>`],
    ["Swap these for placeholders", `<div class="tablewrap" tabindex="0" role="region" aria-label="Placeholders to use"><table><thead><tr><th scope="col">Instead of</th><th scope="col">Write</th></tr></thead><tbody>
      <tr><td>Your name, or anyone else's</td><td>[my name], [my landlord]</td></tr>
      <tr><td>Address and postcode</td><td>[my address], [my postcode]</td></tr>
      <tr><td>Phone number, email</td><td>[my phone], [my email]</td></tr>
      <tr><td>Bank, sort code, card</td><td>[account number], [sort code]</td></tr>
      <tr><td>National Insurance number</td><td>[NI number]</td></tr>
      <tr><td>Account or reference numbers</td><td>[reference number]</td></tr></tbody></table></div><p>Amounts and dates are fine if they don't identify you.</p>`],
    ["Pictures", `<ul><li>Crop to the part that matters.</li><li>Check for your name, address, email previews, account numbers and photos of you.</li><li>We remove hidden details like location, but we can't see what's in the picture. You're responsible for what it shows.</li></ul>`],
    ["Never type these into an AI tool", `<ul><li>Passwords, PINs and security codes.</li><li>Full bank or card details.</li><li>Your National Insurance or passport number.</li><li>Anything about someone else that they wouldn't want shared.</li></ul><p>Free AI tools may keep what you type. Check the tool's own settings and privacy notice.</p>`],
    ["If you make a mistake", `<p>Delete the post straight away, or report it so a moderator can take it down. If you shared bank or card details, contact your bank.</p>`]
  ]);
}
function viewTerms() {
  docPage("Terms of use", "The agreement between you and us, kept short.", [
    ["Who runs it", `<p>${esc(APP_NAME)} is run by ${opName()} as an independent, non-commercial site. Contact: ${opEmail()}.</p>`],
    ["Your account", `<p>You must be 18 or over. Keep your login to yourself. You're responsible for what you post. You can delete your account at any time in <a href="#me">Your account</a>.</p>`],
    ["What you post", `<p>You keep the copyright in what you post. By posting, you license it to everyone under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">Creative Commons Attribution 4.0 (CC BY 4.0)</a>, so others can reuse it with credit to you. We may use tips to write guides, and we credit and link the tips we use. Only post material you have the right to share. Your saved items are private.</p>`],
    ["Rules", `<p>Follow the <a href="#rules">house rules</a>. Never post personal details about you or anyone else.</p>`],
    notAdviceSec,
    ["Moderation, reports and complaints", `<p>We can hold, take down or restrict content, and suspend or close accounts, if they break these terms or the house rules, or if the law requires it. To report something, press "Report a problem" on it. To complain, see <a href="#complaints">Reports and complaints</a>.</p>`],
    ["Online safety", `<p>We take steps to protect users from illegal content, as the Online Safety Act 2023 requires: automatic checks, moderation before publishing for new members and sensitive topics, a report option on every post and comment, and a complaints route.</p><p><mark>TODO before launch: add a summary of the Online Safety Act illegal content risk assessment here (risks found, and what we do about each).</mark></p>`],
    ["No guarantees", `<p>Guides and tips are provided as they are. They may be wrong, out of date or not right for your situation. We aren't liable for losses from using them, except where the law doesn't allow us to exclude that.</p>`],
    ["Changes", `<p>We may update these terms. If a change matters, we'll say so on the site first.</p>`],
    ["Law", `<p>These terms are governed by the law of England and Wales.</p>`]
  ]);
}
function viewComplaints() {
  docPage("Reports and complaints", "How to report a post, and how to complain if you're unhappy with us.", [
    ["Report a post or comment", `<p>Press <b>Report a problem</b> on any guide or tip, or <b>Report</b> on a comment, and say what's wrong. You need to be logged in. A moderator looks at every report, usually within 2 working days.</p>`],
    ["Something urgent or illegal", `<p>If content puts someone in danger, contact the police first (999 in an emergency). Then report it here, or email ${opEmail()} with a link to the page.</p>`],
    ["Complain about a decision", `<p>If we took down your post or suspended your account and you think we got it wrong, email ${opEmail()}. Say which post or account, and why. We'll reply within 10 working days.</p>`],
    ["Personal data", `<p>If your personal details have been posted, report the post and email ${opEmail()}. You can also complain to the <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener">Information Commissioner's Office</a>.</p>`],
    ["If you're still not happy", `<p>Online safety complaints can also go to Ofcom. See <a href="https://www.ofcom.org.uk/online-safety" target="_blank" rel="noopener">Ofcom: online safety</a>.</p>`]
  ]);
}
function viewPrivacy() {
  docPage("Privacy notice", "What we collect, why, and what you can do about it.", [
    ["Who is responsible", `<p>${opName()} is the data controller for ${esc(APP_NAME)}. Contact: ${opEmail()}.</p>`],
    ["What we collect", `<ul><li><b>Account:</b> your email address, password (stored as a secure hash), username and, if you give it, a short line about you.</li><li><b>What you do:</b> your tips, pictures, comments, answers to "Did this guide work?", reports, saved items and text size.</li><li><b>Notifications</b> about your tips, kept for 120 days.</li><li><b>Counts:</b> one number per page type per day, and a count of clicks on two home page buttons. Nothing that identifies you.</li></ul>`],
    ["Why", `<ul><li>To run your account and show your posts: legitimate interests in running a community you've chosen to join.</li><li>To keep the site safe: moderation, reports and automatic checks for personal details.</li></ul><p>We don't sell data, show adverts or use your content to train AI.</p>`],
    ["Who can see what", `<p><b>Public:</b> your username, the line about you, your tips, comments and answers.</p><p><b>Private:</b> your email address, saved items, notifications, reports and text size.</p>`],
    ["AI tools you use", `<p>We don't send anything you type here to an AI tool. When you use ChatGPT, Copilot, Gemini or Claude yourself, that company's privacy notice applies.</p>`],
    ["Where it's stored", `<p>Data is stored by Supabase in its London region. Our hosting and email providers process data only to run the service.</p>`],
    ["How long we keep it", `<p>Until you delete your account. Then your login, profile, saved items, notifications and answers are deleted. Tips you didn't delete stay up as "a former member".</p>`],
    ["Your rights", `<p>You can see a copy of your data, correct it and delete your account from <a href="#me">Your account</a>. You can also contact ${opEmail()}. If you're unhappy, you can complain to the <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener">Information Commissioner's Office</a>.</p>`],
    ["Cookies", `<p>We store your login and text size in your browser so the site works. When you log in from a guide, we briefly remember the page and any answer you gave. There are no advertising or tracking cookies.</p>`],
    ["Children", `<p>You must be 18 or over to join.</p>`]
  ]);
}
function viewAccessibility() {
  docPage("Accessibility statement", "We want everyone to be able to use this site.", [
    ["How accessible it is", `<p>We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. We test every page with an automated checker and fix what it finds. The site works with a keyboard alone.</p>`],
    ["Ways to adjust it", `<ul><li><a href="#display">Text size</a> has a larger, higher-contrast option.</li><li>The text uses Lexend, a font designed to make reading easier. The larger text option uses Atkinson Hyperlegible, designed for people with low vision.</li><li>You can zoom to 200%, and the site works on phones.</li><li>Guides have a print button for a clean paper copy.</li></ul>`],
    ["Known problems", `<ul><li>Pictures in tips are added by members and usually have no description.</li><li>We haven't yet had a full check with people who use assistive technology.</li></ul>`],
    ["Tell us about a problem", `<p>Email ${opEmail()} and say which page and what happened. We aim to reply within 5 working days.</p>`]
  ]);
}
function viewAbout() {
  docPage(`About ${esc(APP_NAME)}`, esc(TAGLINE), [
    ["Why it exists", `<p>Free AI tools can help with the boring bits of life: bills, letters, complaints and forms. But most people don't know what to type, what to keep private, or how to check the answer. Here, people share what worked for them, and we turn the best into tested, step-by-step guides.</p>`],
    ["Who runs it", `<p>${esc(APP_NAME)} is run by ${opName()}. It's independent and non-commercial: no adverts, no selling data, no paid placements, and no link to any AI company.</p>`],
    notAdviceSec,
    ["Get involved", `<p><a href="#join">Create an account</a> and share one thing AI helped you with. If you try a guide, tell us whether it worked.</p>`]
  ]);
}
function viewBadge() {
  const site = SITE(), code = `<a href="${site}"><img src="${site.replace(/[^/]*$/, "")}badge.png" width="88" height="31" alt="Featured on ${APP_NAME}"></a>`;
  V.innerHTML = `<div class="read stack"><h1>Link to us</h1><img src="badge.png" width="88" height="31" alt="Featured on ${esc(APP_NAME)}"><p>Paste this into your own website:</p><textarea id="bc" readonly style="min-height:70px">${esc(code)}</textarea><div><button class="btn sm" id="cp">Copy</button> <span id="cpm" class="small"></span></div></div>`;
  document.getElementById("cp").onclick = async () => { try { await navigator.clipboard.writeText(code); document.getElementById("cpm").textContent = "Copied."; } catch (_) { document.getElementById("bc").select(); document.getElementById("cpm").textContent = "Press Ctrl+C to copy."; } };
}
function viewNotFound(msg) { V.innerHTML = `<div class="read stack"><h1>Page not found</h1><p>${esc(msg || "That page doesn't exist.")}</p><p><a class="btn primary" href="#index">Go to the home page</a></p></div>`; }

// ================= router =================
async function route() {
  const h = (location.hash.slice(1) || "index");
  if (h.startsWith("access_token") || h.startsWith("error")) return; // supabase handles auth fragments
  if (h === "join" || h === "login") remember("th-return", lastPage && !/^(index|me|newpass|notifications)$/.test(lastPage) ? lastPage : null);
  else if (h !== "newpass") lastPage = h;
  setStatus(""); renderShell(); loadNotifCount();
  clearTimeout(loadTimer); loadTimer = setTimeout(showSkeleton, 150);
  try { sb.rpc("track_view", { p: location.hash || "#index" }).then(() => {}, () => {}); } catch (_) { }
  const redirect = { categories: "index", feed: "index", news: "index", members: "index", stats: "index", recipes: "search", faq: "help" };
  try {
    if (redirect[h]) { location.replace("#" + redirect[h]); return; }
    if (h === "index") await viewIndex();
    else if (h === "search") await viewSearch();
    else if (h === "guide-new" || h === "recipe-new") await viewRecipeForm(null, null);
    else if (h.startsWith("guide-edit-")) await viewRecipeForm(h.slice(11), null);
    else if (h.startsWith("guide-from-")) await viewRecipeForm(null, h.slice(11));
    else if (h.startsWith("t-")) await viewTopicPost(h.slice(2));
    else if (h.startsWith("u-")) await viewProfile(decodeURIComponent(h.slice(2)));
    else if (h.startsWith("/")) await viewTopic(h.slice(1));
    else if (h.startsWith("b-")) await viewTopic(h.slice(2));
    else if (h === "post" || h.startsWith("post-")) await viewPost(h.slice(5) || null);
    else if (h === "library") await viewLibrary();
    else if (h.startsWith("lib-")) await viewLibItem(h.slice(4));
    else if (h === "login") viewLogin("login");
    else if (h === "join") viewLogin("join");
    else if (h === "newpass") viewNewPass();
    else if (h === "me") await viewMe();
    else if (h === "display") viewDisplay();
    else if (h === "mod") { await viewMod(); await loadMetrics(); }
    else if (h === "notifications") await viewNotifications();
    else if (h === "help") viewHelp();
    else if (h === "terms") viewTerms();
    else if (h === "complaints") viewComplaints();
    else if (h === "about") viewAbout();
    else if (h === "accessibility") viewAccessibility();
    else if (h === "safe-sharing") viewSafeSharing();
    else if (h === "badge") viewBadge();
    else if (h === "rules") viewRules();
    else if (h === "privacy") viewPrivacy();
    else viewNotFound();
  } catch (e) {
    console.error(e);
    V.innerHTML = `<div class="read stack"><h1>Something went wrong</h1><div class="notice stop">We couldn't load this page: ${esc(errMsg(e))}. Check your connection and try again.</div></div>`;
  } finally {
    clearTimeout(loadTimer); V.removeAttribute("aria-busy"); flushToast();
  }
}
window.addEventListener("hashchange", () => { route().then(() => { window.scrollTo(0, 0); V.focus({ preventScroll: true }); }); });

// ================= boot =================
(async () => {
  sb.auth.onAuthStateChange(async (ev) => {
    if (ev === "PASSWORD_RECOVERY") { location.hash = "newpass"; return; }
    if (ev === "SIGNED_IN" || ev === "SIGNED_OUT" || ev === "USER_UPDATED") { await loadMe(); if (/^#?(access_token|error)/.test(location.hash.slice(1))) { if (ev === "SIGNED_IN") await afterLogin(); else location.hash = "index"; } }
  });
  try { await Promise.all([loadMe(), loadBoards()]); } catch (e) { setStatus(`<div class="notice stop" style="margin-top:16px">We can't reach ${esc(APP_NAME)} right now. Try again in a minute.</div>`); }
  route();
})();
