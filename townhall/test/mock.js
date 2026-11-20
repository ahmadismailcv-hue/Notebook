(() => {
  const now = () => new Date().toISOString();
  const uuid = () => "id" + Math.random().toString(36).slice(2, 10);
  const daysAgo = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const ME = { id: "u_me", handle: "ahmad", profession: "Runs the site", staff_area: "", institution: "", ac_verified: false, role: "admin", banned: false, prefs: {}, created_at: now() };
  const TESTER = { id: "u_tester", handle: "recipe_tester", profession: "Tests recipes", staff_area: "", institution: "", ac_verified: false, role: "admin", banned: false, prefs: {}, created_at: now() };
  const OTHER = { id: "u_b", handle: "jo_reads", profession: "Library volunteer", staff_area: "", institution: "", ac_verified: false, role: "member", banned: false, prefs: {}, created_at: now() };
  const NEWBIE = { id: "u_new", handle: "new_member", profession: "", staff_area: "", institution: "", ac_verified: false, role: "member", banned: false, prefs: {}, created_at: now() };
  const HELD = ["money", "health-admin", "complaints"];
  const db = {
    profiles: [ME, TESTER, OTHER, NEWBIE],
    boards: [["money", 10], ["home", 20], ["complaints", 30], ["letters", 40], ["work", 50], ["health-admin", 60], ["family", 70], ["getting-started", 80], ["staying-safe", 90]]
      .map(([id, sort]) => ({ id, cat: "space", name: id, descr: "Description of " + id, sort, is_private: false, archived: false }))
      .concat([{ id: "marking-feedback", cat: "space", name: "marking-feedback", descr: "Old higher education space", sort: 5, is_private: false, archived: true }]),
    uploads: [], board_mods: [], library_items: [], notifications: [], recipe_sources: [], entry_events: [],
    news_items: [
      { source_id: "govuk-scam", source: "GOV.UK", title: "Pensioners urged to be alert to Winter Fuel Payment scams", url: "https://example.org/a", published_at: new Date(Date.now() - 4 * 864e5).toISOString() },
      { source_id: "govuk-deepfake", source: "GOV.UK", title: "New guidance on spotting deepfake videos", url: "https://example.org/b", published_at: new Date(Date.now() - 8 * 864e5).toISOString() }],
    posts: [], replies: [], likes: [], tries: [], follows: [], reports: []
  };
  const P = (o) => Object.assign({ id: uuid(), author: OTHER.id, board_id: "letters", type: "STORY", tool_key: "chatgpt", screenshots: [], knowledge_sources: [], data_class: "", title: "Sample", body: "ChatGPT explained the letter in plain words. I still rang the council to check the date.", prompt: "", task: "Understand a council letter", tool: "ChatGPT", model_version: "", minutes_before: null, minutes_after: null, what_wrong: "", checks: "", tools: [], prompts: [], never_paste: "", how_to_check: [], failure_points: "", deadline_warning: "", tested_tools: [], retest_due: null, tags: ["letters"], forked_from: null, status: "published", pinned: false, is_sample: false, tested_on: daysAgo(0), created_at: now(), updated_at: now() }, o);
  db.posts.push(P({ title: "ChatGPT turned my council tax letter into plain English", tool_key: "chatgpt", screenshots: ["u_b/abcdefgh.webp"], prompt: "Explain this letter in plain English. What do I need to do, and by when? [letter text pasted, with my name and address taken out]", checks: "I checked the deadline on the council website.", tags: ["council-tax", "letters"] }));
  db.posts.push(P({ title: "Complain to an energy supplier about a wrong bill", type: "RECIPE", author: TESTER.id, board_id: "complaints", task: "Write a clear complaint to your energy supplier about a bill you think is wrong.", tool_key: "", tools: ["chatgpt", "copilot"], tested_tools: ["chatgpt"], tested_on: daysAgo(20), retest_due: daysAgo(-150),
    prompts: [{ label: "Draft the complaint", text: "Write a short, polite complaint to my energy supplier. My bill for [month] says I used [X] kWh, but my meter reading on [date] was [reading]. Ask them to correct the bill and confirm in writing." }, { label: "Make it firmer", text: "Rewrite this complaint so it is firmer but still polite. Ask for a reply within 8 weeks." }],
    never_paste: "Your account number, full address, bank details or date of birth.", how_to_check: [{ label: "Energy Ombudsman", url: "https://www.energyombudsman.org/" }, { label: "Citizens Advice: problems with your energy bill", url: "https://www.citizensadvice.org.uk/consumer/energy/energy-supply/" }],
    failure_points: "The AI sometimes invents a complaint reference or a legal rule. Delete anything you can't check.", deadline_warning: "If the supplier hasn't sorted it within 8 weeks, you can go to the Energy Ombudsman. You then have 12 months.", tags: ["energy", "complaint"] }));
  db.posts.push(P({ title: "Appeal a private parking charge", type: "RECIPE", author: TESTER.id, board_id: "money", task: "Write an appeal to a private parking company.", tool_key: "", tools: ["gemini"], tested_tools: ["gemini"], tested_on: daysAgo(400), retest_due: daysAgo(30), prompts: [{ label: "Draft the appeal", text: "Write an appeal to [parking company] about parking charge [reference]. Explain that [reason]." }], tags: ["parking"] }));
  db.posts.push(P({ title: "DRAFT, NOT TESTED: Check a tenancy agreement", type: "RECIPE", author: TESTER.id, board_id: "home", status: "draft", task: "Spot unusual clauses in a tenancy agreement.", tool_key: "", prompts: [{ label: "Check it", text: "List any unusual clauses." }], tags: ["renting"] }));
  db.posts.push(P({ title: "Pending first story", status: "pending", author: NEWBIE.id, board_id: "money", tags: ["x"] }));
  let session = { user: { id: ME.id, email: "me@test" } };
  const prof = id => db.profiles.find(p => p.id === id);
  const meAdmin = () => !!(session && (prof(session.user.id) || {}).role === "admin");
  // the same personal-data rules as the database, in short
  const PII = [[/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, "Remove email addresses before posting."], [/\b(ab|al|b|ba|bs|cf|e|ec|g|l|m|n|nw|se|sw|w|wc)\d[a-z\d]?\s?\d[a-z]{2}\b/i, "Remove postcodes before posting."], [/\b\d{8}\b/, "Remove account numbers before posting."]];
  const pii = t => (PII.find(([re]) => re.test(t)) || [])[1];
  function feed() {
    return db.posts.filter(p => p.status !== "draft" || meAdmin()).map(p => ({ ...p, author_handle: (prof(p.author) || {}).handle || null, author_profession: (prof(p.author) || {}).profession || null,
      likes: db.likes.filter(l => l.post_id === p.id).length,
      tries_worked: db.tries.filter(t => t.post_id === p.id && t.result === "worked").length,
      tries_partly: 0,
      tries_failed: db.tries.filter(t => t.post_id === p.id && t.result === "failed").length,
      replies: db.replies.filter(r => r.post_id === p.id).length, forks: 0, vote_score: 0, vote_count: 0 }));
  }
  function table(name) {
    if (name === "post_feed") return feed();
    if (name === "boards") return db.boards.filter(b => !b.archived);
    if (name === "member_directory") return db.profiles.map(p => ({ ...p, rep: db.posts.filter(x => x.author === p.id && x.status === "published").length }));
    if (name === "news_items") return db.news_items.filter(n => n.source_id.startsWith("govuk-"));
    return db[name];
  }
  function embed(name, row, sel) {
    const out = { ...row };
    if (/profiles\(/.test(sel)) out.profiles = prof(row.author || row.user_id) || null;
    if (/posts\(/.test(sel)) out.posts = db.posts.find(p => p.id === row.post_id) || null;
    if (/replies\(/.test(sel)) out.replies = db.replies.find(r => r.id === row.reply_id) || null;
    return out;
  }
  function insertPost(payload) {
    const uid = session.user.id, admin = meAdmin();
    if (payload.type === "RECIPE" && !admin) throw new Error("Only admins can write recipes.");
    if (!db.boards.some(b => b.id === payload.board_id && !b.archived)) throw new Error("Choose a space.");
    if (payload.type === "STORY") { const pr = pii([payload.title, payload.body, payload.prompt, payload.task, payload.checks].join(" ")); if (pr) throw new Error(pr); }
    const row = P({ ...payload, id: uuid(), author: uid, created_at: now(), updated_at: now() });
    if (row.type === "RECIPE") row.status = ["draft", "published"].includes(payload.status) ? payload.status : "draft";
    else row.status = HELD.includes(row.board_id) ? "pending" : (admin || db.posts.filter(p => p.author === uid && p.type === "STORY" && p.status === "published").length >= 3) ? "published" : "pending";
    return row;
  }
  function builder(name) {
    const st = { op: "select", filters: [], order: null, limit: null, single: null, sel: "*", payload: null };
    const b = {
      select(sel, opts) { if (st.op === "select") { st.sel = sel || "*"; st.head = opts && opts.head; } else st.returning = true; return b; },
      eq(k, v) { st.filters.push(r => r[k] === v); return b; },
      in(k, v) { st.filters.push(r => v.includes(r[k])); return b; },
      is(k, v) { st.filters.push(r => (r[k] == null ? null : r[k]) === v); return b; },
      contains(k, v) { st.filters.push(r => v.every(x => (r[k] || []).includes(x))); return b; },
      order(k, o) { st.order = [k, (o && o.ascending === false) ? -1 : 1]; return b; },
      limit(n) { st.limit = n; return b; },
      maybeSingle() { st.single = "maybe"; return b; }, single() { st.single = "one"; return b; },
      insert(p) { st.op = "insert"; st.payload = p; return b; },
      upsert(p) { st.op = "upsert"; st.payload = p; return b; },
      update(p) { st.op = "update"; st.payload = p; return b; },
      delete() { st.op = "delete"; return b; },
      then(res, rej) { try { res(run()); } catch (e) { res({ data: null, error: { message: e.message } }); } }
    };
    function insertOne(payload) {
      const T = db[name];
      let row = { ...payload };
      if (name === "posts") row = insertPost(payload);
      if (name === "library_items") { if (row.kind === "saved" && T.some(r => r.source_post === row.source_post && r.kind === "saved")) throw new Error("Already saved."); const src = db.posts.find(p => p.id === row.source_post); const pr = pii(src && src.type === "RECIPE" ? row.notes || "" : [row.notes, row.prompt, row.body].join(" ")); if (pr) throw new Error(pr); Object.assign(row, { id: uuid(), owner: session.user.id, published_post: null, created_at: now(), updated_at: now(), snapshot_at: now(), source_post: row.source_post || null }); }
      if (name === "replies") { const pr = pii(row.body); if (pr) throw new Error(pr); Object.assign(row, { id: uuid(), author: session.user.id, status: "published", created_at: now() }); }
      if (name === "recipe_sources") { if (!meAdmin()) throw new Error("new row violates row-level security policy"); row.created_at = now(); }
      if (["likes", "follows", "reports"].includes(name)) {
        if (name === "likes") { const p = db.posts.find(x => x.id === row.post_id); if (!p || p.type !== "STORY") throw new Error("You can only like published stories."); }
        Object.assign(row, { user_id: session.user.id, reporter: session.user.id, id: uuid(), status: "open", created_at: now() });
      }
      T.push(row);
      return row;
    }
    function run() {
      const T = db[name];
      const match = r => st.filters.every(f => f(r));
      if (st.op === "insert") {
        const rows = (Array.isArray(st.payload) ? st.payload : [st.payload]).map(insertOne);
        return { data: st.single ? rows[0] : rows, error: null };
      }
      if (st.op === "upsert") {
        const row = { ...st.payload, created_at: now() };
        if (name === "tries") {
          const p = db.posts.find(x => x.id === row.post_id);
          if (!p || p.type !== "RECIPE" || p.status !== "published") throw new Error("You can only say whether a published recipe worked for you.");
          if (p.author === session.user.id) throw new Error("You can't rate your own recipe.");
          if (!["worked", "failed"].includes(row.result)) throw new Error("tries_result_check");
        }
        const i = T.findIndex(r => r.post_id === row.post_id && r.user_id === row.user_id);
        if (i >= 0) T[i] = row; else T.push(row); return { data: null, error: null };
      }
      if (st.op === "update") {
        T.filter(match).forEach(r => {
          if (name === "posts" && r.type === "RECIPE" && !meAdmin()) return;
          Object.assign(r, st.payload, name === "library_items" || name === "posts" ? { updated_at: now() } : {});
        });
        return { data: null, error: null };
      }
      if (st.op === "delete") { for (let i = T.length - 1; i >= 0; i--) if (match(T[i])) T.splice(i, 1); return { data: null, error: null }; }
      let rows = table(name).filter(match).map(r => embed(name, r, st.sel));
      if (st.head) return { data: null, count: rows.length, error: null };
      if (st.order) { const [k, d] = st.order; rows.sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * d); }
      if (st.limit) rows = rows.slice(0, st.limit);
      if (st.single) return { data: rows[0] || null, error: null };
      return { data: rows, error: null };
    }
    return b;
  }
  const listeners = [];
  window.__db = db;
  window.__setSession = s => { session = s; };
  window.__mockSupabase = { createClient: () => ({
    from: builder,
    storage: { from: () => ({
      upload: async (path, blob, o) => { db.uploads.push({ path, size: blob.size, type: o && o.contentType }); return { data: { path }, error: null }; },
      remove: async () => ({ data: null, error: null }),
      getPublicUrl: path => ({ data: { publicUrl: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#dfe8ee"/><rect x="40" y="40" width="720" height="60" fill="#fff"/><rect x="40" y="130" width="460" height="330" fill="#fff"/><text x="60" y="80" font-size="26" font-family="sans-serif">' + path.slice(-14) + '</text></svg>') } })
    }) },
    rpc: async (fn, args) => {
      if (fn === "my_profile") return { data: session ? db.profiles.find(p => p.id === session.user.id) || null : null, error: null };
      if (fn === "log_entry") { if (["share", "browse"].includes(args && args.k)) db.entry_events.push({ kind: args.k, created_at: now() }); return { data: null, error: null }; }
      if (fn === "admin_metrics") return { data: { weeks: [{ week: "2026-11-09", tries: 3, posts: 4, replies: 6, members: 9, views: 120, share_clicks: 5, browse_clicks: 11 }, { week: "2026-11-16", tries: 7, posts: 5, replies: 8, members: 12, views: 210, share_clicks: db.entry_events.filter(e => e.kind === "share").length, browse_clicks: db.entry_events.filter(e => e.kind === "browse").length }], top_pages: [{ path: "index", views: 150 }, { path: "post", views: 90 }] }, error: null };
      return { data: null, error: null };
    },
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: cb => { listeners.push(cb); return { data: { subscription: { unsubscribe() { } } } }; },
      signOut: async () => { session = null; listeners.forEach(l => l("SIGNED_OUT")); return {}; },
      signInWithPassword: async () => { session = { user: { id: ME.id, email: "me@test" } }; return { error: null }; },
      signUp: async () => ({ data: { session: null }, error: null }),
      resetPasswordForEmail: async () => ({ error: null }), signInWithOtp: async () => ({ error: null }), updateUser: async () => ({ error: null })
    }
  }) };
})();
