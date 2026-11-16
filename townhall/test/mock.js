(() => {
  const now = () => new Date().toISOString();
  const uuid = () => "id" + Math.random().toString(36).slice(2, 10);
  const ME = { id: "u_me", handle: "ahmad", profession: "AI training", staff_area: "IT & digital", institution: "", ac_verified: false, role: "admin", banned: false, prefs: {}, created_at: now() };
  const OTHER = { id: "u_b", handle: "registry_jo", profession: "Exams officer", staff_area: "Professional services", institution: "University of Example", ac_verified: true, role: "member", banned: false, prefs: {}, created_at: now() };
  const db = {
    profiles: [ME, OTHER],
    boards: [["townhall","general","Town Hall",0],["marking-feedback","space","marking-feedback",10],["exams-timetabling","space","exams-timetabling",40],["student-support","space","student-support",50],["policy-governance","space","policy-governance",100],["other","space","other",110]].map(([id,cat,name,sort])=>({id,cat,name,descr:"Description of "+name,sort,is_private:false})),
    uploads: [],
    board_mods: [], library_items: [], notifications: [], news_items: [
      { source_id: 'jisc-ai', source: 'Jisc National Centre for AI', title: 'When does AI improve marking and feedback? Evidence from the AI in Marking and Feedback Pilot', url: 'https://example.org/a', published_at: new Date(Date.now()-4*864e5).toISOString() },
      { source_id: 'wonkhe', source: 'Wonkhe', title: 'Podcast: Budget 2026, AI procurement', url: 'https://example.org/b', published_at: new Date(Date.now()-8*864e5).toISOString() },
      { source_id: 'jisc-ai', source: 'Jisc National Centre for AI', title: 'AI detection and assessment: an update for 2026', url: 'https://example.org/c', published_at: new Date(Date.now()-23*864e5).toISOString() }], posts: [], replies: [], likes: [], tries: [], motion_votes: [], follows: [], reports: []
  };
  const P = (o) => Object.assign({ id: uuid(), author: OTHER.id, board_id: "exams-timetabling", type: "WORKFLOW", tool_key: "claude", screenshots: [], knowledge_sources: [], data_class: "internal", title: "Sample", body: "Copilot drafts the narrative sections from the agreed board template. The officer still checks every figure.", prompt: "", task: "Notes", tool: "Claude", model_version: "Claude Sonnet 5.5", minutes_before: 180, minutes_after: 40, what_wrong: "Invented things", tags: ["claude", "education"], forked_from: null, status: "published", pinned: false, is_sample: false, tested_on: "2026-11-01", created_at: now(), updated_at: now() }, o);
  db.posts.push(P({ title: "Exam board papers: 3 hours down to 45 minutes", tool_key: "copilot", screenshots: ["u_b/abcdefgh.webp", "u_b/ijklmnop.webp"], prompt: "Using only the attached anonymised summary tables, draft the module commentary. Do not interpret marks.", tags: ["copilot", "exam-boards"] }));
  db.posts.push(P({ title: "Copilot Studio agent that answers regulations questions", type: "AGENT", board_id: "student-support", tool_key: "copilot-studio", tags: ["copilot-studio", "regulations"], knowledge_sources: [{ kind: "website", note: "Published academic regulations pages only" }, { kind: "instructions-only", note: "No actions or connectors" }], prompt: Array.from({length: 14}, (_, i) => `${i + 1}. Rule ${i + 1}: answer only from the regulations and quote the section you used.`).join("\n") }));
  db.posts.push(P({ title: "Old tender summary", type: "FAIL", tags: ["copilot"], tested_on: "2025-01-01", minutes_before: 240, minutes_after: 5 }));
  db.posts.push(P({ title: "This week: AI for admin you hate", type: "MEETING", board_id: "townhall", pinned: true, author: ME.id, tags: ["meeting"] }));
  db.posts.push(P({ title: "Motion: require model version", type: "MOTION", board_id: "townhall", tags: ["site"] }));
  db.posts.push(P({ title: "Pending first post", status: "pending", author: "u_new", tags: ["x"] }));
  let session = { user: { id: ME.id, email: "me@test" } };
  const prof = id => db.profiles.find(p => p.id === id);
  function feed() {
    return db.posts.map(p => ({ ...p, author_handle: (prof(p.author) || {}).handle || null, author_profession: (prof(p.author) || {}).profession || null, author_ac: (prof(p.author) || {}).ac_verified, author_area: (prof(p.author) || {}).staff_area, author_institution: (prof(p.author) || {}).institution,
      likes: db.likes.filter(l => l.post_id === p.id).length,
      tries_worked: db.tries.filter(t => t.post_id === p.id && t.result === "worked").length,
      tries_partly: db.tries.filter(t => t.post_id === p.id && t.result === "partly").length,
      tries_failed: db.tries.filter(t => t.post_id === p.id && t.result === "failed").length,
      replies: db.replies.filter(r => r.post_id === p.id).length, forks: db.posts.filter(f => f.forked_from === p.id).length,
      vote_score: db.motion_votes.filter(v => v.post_id === p.id).reduce((a, v) => a + v.vote, 0), vote_count: db.motion_votes.filter(v => v.post_id === p.id).length }));
  }
  function table(name) {
    if (name === "post_feed") return feed();
    if (name === "member_directory") return db.profiles.map(p => ({ ...p, rep: 7 }));
    if (name === "tag_savings") { const m = {}; db.posts.filter(p => p.status === "published" && ["WORKFLOW", "TOOL"].includes(p.type)).forEach(p => p.tags.forEach(t => { (m[t] = m[t] || []).push(p); })); return Object.entries(m).map(([tag, ps]) => ({ tag, posts: ps.length, median_saving_pct: 78, minutes_saved_total: 140 })); }
    return db[name];
  }
  function embed(name, row, sel) {
    const out = { ...row };
    if (/profiles\(/.test(sel)) out.profiles = prof(row.author || row.user_id) || null;
    if (/posts\(/.test(sel)) out.posts = db.posts.find(p => p.id === row.post_id) || null;
    if (/replies\(/.test(sel)) out.replies = db.replies.find(r => r.id === row.reply_id) || null;
    return out;
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
    function run() {
      const T = db[name];
      const match = r => st.filters.every(f => f(r));
      if (st.op === "insert") {
        const row = { ...st.payload };
        if (name === "posts") {
          if (/@/.test(row.body || "")) throw new Error("Remove email addresses before posting.");
          Object.assign(row, P({}), st.payload, { id: uuid(), author: session.user.id, status: "published", created_at: now() });
        }
        if (name === "library_items") { if (row.kind === "saved" && T.some(r => r.source_post === row.source_post && r.kind === "saved")) throw new Error("Already saved."); if (/@/.test([row.notes, row.prompt, row.body].join(" "))) throw new Error("Remove email addresses. Use dummy data."); Object.assign(row, { id: uuid(), owner: session.user.id, published_post: null, created_at: now(), updated_at: now(), snapshot_at: now(), source_post: row.source_post || null }); }
        if (name === "replies") Object.assign(row, { id: uuid(), author: session.user.id, status: "published", created_at: now() });
        if (["likes", "follows", "reports"].includes(name)) Object.assign(row, { user_id: session.user.id, reporter: session.user.id, id: uuid(), status: "open", created_at: now() });
        T.push(row);
        return { data: st.single ? row : [row], error: null };
      }
      if (st.op === "upsert") {
        const row = { ...st.payload, created_at: now() };
        const i = T.findIndex(r => r.post_id === row.post_id && r.user_id === row.user_id);
        if (i >= 0) T[i] = row; else T.push(row); return { data: null, error: null };
      }
      if (st.op === "update") { T.filter(match).forEach(r => Object.assign(r, st.payload, name === "library_items" || name === "posts" ? { updated_at: now() } : {})); return { data: null, error: null }; }
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
      if (fn === "admin_metrics") return { data: { weeks: [{ week: "2026-10-26", tries: 3, posts: 4, replies: 6, members: 9, views: 120 }, { week: "2026-11-02", tries: 7, posts: 5, replies: 8, members: 12, views: 210 }], top_pages: [{ path: "index", views: 150 }, { path: "post", views: 90 }] }, error: null };
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
