/* Love Story · MC Thiên Ân — gọi API (Apps Script) hoặc chạy chế độ xem thử */
(function () {
  var cfg = window.LOVESTORY_CONFIG || {};
  var API_URL = (cfg.apiUrl || '').trim();
  var DEMO = !API_URL;

  function call(payload) {
    if (DEMO) return Promise.resolve().then(function () { return Demo.handle(JSON.parse(JSON.stringify(payload))); });
    // Gửi dạng text/plain để tránh preflight CORS với Apps Script
    return fetch(API_URL, { method: 'POST', body: JSON.stringify(payload), redirect: 'follow' })
      .then(function (r) {
        if (!r.ok) throw new Error('http_' + r.status);
        return r.json();
      });
  }

  /* ---------------- Chế độ xem thử: giả lập backend bằng localStorage ---------------- */
  var Demo = (function () {
    var KEY = 'lovestory_demo_db_v1';
    var RANK = { 'new': 0, opened: 1, draft: 2, submitted: 3 };
    function load() {
      var db = null;
      try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
      if (!db) {
        var d = new Date(); d.setDate(d.getDate() + 45);
        db = {
          couples: [{
            code: 'demo-cap-doi', brideName: 'Ngọc', groomName: 'Minh',
            weddingDate: d.toISOString().slice(0, 10), venue: 'Gem Center, TP.HCM', note: 'Cặp đôi mẫu để xem thử',
            brideKey: 'demobride00001', groomKey: 'demogroom00001', brideStatus: 'new', groomStatus: 'new',
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
          }],
          responses: {}
        };
        save(db);
      }
      return db;
    }
    function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
    function rid(n) { var c = 'abcdefghijkmnpqrstuvwxyz23456789', s = ''; for (var i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
    function slug(s) { return (String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12)) || 'x'; }
    function pkey(n) { var b = String(n).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 16).replace(/-+$/, ''); return b || 'ban'; }
    function purge(date) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || ''); if (!m) return ''; return new Date(Date.UTC(+m[1], +m[2] - 1 + 6, +m[3])).toISOString().slice(0, 10); }
    function pub(c) { var o = JSON.parse(JSON.stringify(c)); o.purgeDate = purge(c.weddingDate); return o; }
    function byKey(db, k) {
      for (var i = 0; i < db.couples.length; i++) {
        var c = db.couples[i];
        if (c.brideKey === k) return { c: c, role: 'bride' };
        if (c.groomKey === k) return { c: c, role: 'groom' };
      }
      return null;
    }
    function bump(c, role, st) { var f = role + 'Status'; if ((RANK[st] || 0) >= (RANK[c[f]] || 0)) c[f] = st; }

    function handle(req) {
      var db = load(), f, r, now = new Date().toISOString();
      switch (req.action) {
        case 'couple':
          f = byKey(db, req.k); if (!f) return { ok: false, error: 'invalid_link' };
          return { ok: true, brideName: f.c.brideName, groomName: f.c.groomName, brideKey: f.c.brideKey, groomKey: f.c.groomKey, weddingDate: f.c.weddingDate };
        case 'session':
          f = byKey(db, req.k); if (!f) return { ok: false, error: 'invalid_link' };
          bump(f.c, f.role, 'opened'); save(db);
          r = db.responses[req.k];
          return {
            ok: true, role: f.role,
            selfName: f.role === 'bride' ? f.c.brideName : f.c.groomName,
            partnerName: f.role === 'bride' ? f.c.groomName : f.c.brideName,
            couple: { weddingDate: f.c.weddingDate, venue: f.c.venue },
            status: r ? r.status : 'new', lang: r ? r.lang : '', updatedAt: r ? r.updatedAt : '',
            answers: r ? r.answers : {}
          };
        case 'save':
        case 'submit':
          f = byKey(db, req.k); if (!f) return { ok: false, error: 'invalid_link' };
          r = db.responses[req.k] || { status: 'draft' };
          var st = req.action === 'submit' ? 'submitted' : (r.status === 'submitted' ? 'submitted' : 'draft');
          db.responses[req.k] = {
            status: st, lang: req.lang === 'en' ? 'en' : 'vi', updatedAt: now,
            submittedAt: req.action === 'submit' ? now : (r.submittedAt || ''), answers: req.answers || {}
          };
          bump(f.c, f.role, st); save(db);
          return { ok: true, status: st, updatedAt: now };
      }
      // admin
      if (req.password !== 'demo') return { ok: false, error: 'wrong_password' };
      var find = function (code) { return db.couples.filter(function (c) { return c.code === code; })[0]; };
      switch (req.action) {
        case 'adminLogin': return { ok: true };
        case 'adminList':
          return { ok: true, couples: db.couples.map(pub).sort(function (a, b) { return a.weddingDate.localeCompare(b.weddingDate); }) };
        case 'adminGet':
          var c = find(req.code); if (!c) return { ok: false, error: 'not_found' };
          return { ok: true, couple: pub(c), bride: db.responses[c.brideKey] || null, groom: db.responses[c.groomKey] || null };
        case 'adminCreate':
          var d = req.couple || {};
          if (!d.brideName || !d.groomName) return { ok: false, error: 'missing_names' };
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d.weddingDate || '')) return { ok: false, error: 'invalid_date' };
          var nc = {
            code: slug(d.brideName) + '-' + slug(d.groomName) + '-' + rid(4), brideName: d.brideName.trim(), groomName: d.groomName.trim(),
            weddingDate: d.weddingDate, venue: (d.venue || '').trim(), note: (d.note || '').trim(),
            brideKey: '', groomKey: '', brideStatus: 'new', groomStatus: 'new', createdAt: now, updatedAt: now
          };
          var used = { admin: 1 }; db.couples.forEach(function (c) { used[c.brideKey] = 1; used[c.groomKey] = 1; });
          var sb = pkey(d.brideName), sg = pkey(d.groomName);
          for (var n = 1; n < 1000; n++) {
            var sf = n === 1 ? '' : '-' + n, kb = sb + '-' + sg + sf, kg = sg + '-' + sb + sf;
            if (kb === kg) kg += '-2';
            if (!used[kb] && !used[kg]) { nc.brideKey = kb; nc.groomKey = kg; break; }
          }
          db.couples.push(nc); save(db);
          return { ok: true, couple: pub(nc) };
        case 'adminUpdate':
          var u = find(req.code); if (!u) return { ok: false, error: 'not_found' };
          ['brideName', 'groomName', 'weddingDate', 'venue', 'note'].forEach(function (k) {
            if (req.couple && req.couple[k] != null) u[k] = String(req.couple[k]).trim();
          });
          u.updatedAt = now; save(db);
          return { ok: true, couple: pub(u) };
        case 'adminDelete':
          var x = find(req.code); if (!x) return { ok: false, error: 'not_found' };
          delete db.responses[x.brideKey]; delete db.responses[x.groomKey];
          db.couples = db.couples.filter(function (c) { return c !== x; }); save(db);
          return { ok: true };
      }
      return { ok: false, error: 'unknown_action' };
    }
    return { handle: handle };
  })();

  window.LoveStoryAPI = { call: call, demo: DEMO };
})();
