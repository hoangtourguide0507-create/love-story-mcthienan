/* Love Story · MC Thiên Ân — trang quản trị */
(function () {
  'use strict';

  var API = window.LoveStoryAPI;
  var view = document.getElementById('view');
  var modal = document.getElementById('modal');
  var modalPanel = document.getElementById('modalPanel');
  var toastEl = document.getElementById('toast');
  var logoutBtn = document.getElementById('logoutBtn');
  var PW_KEY = 'lovestory_admin_pw';

  var A = { pw: '', couples: [], Q: null, current: null };
  try { A.pw = sessionStorage.getItem(PW_KEY) || ''; } catch (e) {}

  var STATUS = { 'new': 'Chưa mở', opened: 'Đã mở link', draft: 'Đang điền', submitted: 'Đã gửi' };
  var ERRORS = {
    wrong_password: 'Sai mật khẩu.',
    locked: 'Đăng nhập sai quá nhiều lần. Bạn thử lại sau 10 phút.',
    no_admin_password: 'Chưa đặt ADMIN_PASSWORD trong Apps Script (xem SETUP.md).',
    invalid_date: 'Ngày cưới chưa đúng.',
    missing_names: 'Cần nhập tên cô dâu và chú rể.',
    not_found: 'Không tìm thấy cặp đôi này.'
  };
  var MONTHS = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];

  if (API.demo) document.getElementById('demoBanner').hidden = false;

  /* ---------------- tiện ích ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function errMsg(e) { return ERRORS[e] || 'Có lỗi: ' + e; }
  function fmtDate(v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : (v || ''); }
  function fmtMonth(v) { var m = /^(\d{4})-(\d{2})$/.exec(v || ''); return m ? m[2] + '/' + m[1] : v; }
  function fmtStamp(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d)) return iso;
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ' ' +
      ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function daysUntil(date) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || ''); if (!m) return null;
    var t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((new Date(+m[1], +m[2] - 1, +m[3]) - t) / 86400000);
  }
  function formBase() { return location.origin + '/lovestory/'; }
  function link(key) { return formBase() + key; }
  function hasValue(v) {
    if (Array.isArray(v)) return v.some(function (x) { return String(x || '').trim(); });
    return v != null && String(v).trim() !== '';
  }
  function toast(msg) {
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { toastEl.hidden = true; }, 1800);
  }
  function copy(text, msg) {
    var done = function () { toast(msg || 'Đã copy'); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
  }

  function call(action, extra) {
    var payload = Object.assign({ action: action, password: A.pw }, extra || {});
    return API.call(payload).then(function (res) {
      if (!res.ok && (res.error === 'wrong_password' || res.error === 'locked' || res.error === 'no_admin_password')) {
        logout(errMsg(res.error));
        throw new Error(res.error);
      }
      return res;
    });
  }

  function loadQuestions() {
    if (A.Q) return Promise.resolve(A.Q);
    return fetch('/lovestory/questions.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })
      .then(function (q) { A.Q = q; return q; });
  }

  /* ---------------- đăng nhập ---------------- */
  function showLogin(error) {
    logoutBtn.hidden = true;
    view.innerHTML = '<div class="login screen"><p class="kicker-script">Love Story</p>' +
      '<h1 class="title">Trang quản trị</h1>' +
      '<form id="loginForm"><div><label class="eyebrow" for="pw">Mật khẩu</label>' +
      '<input class="field" id="pw" type="password" autocomplete="current-password" required></div>' +
      (error ? '<p class="err">' + esc(error) + '</p>' : '') +
      '<button class="btn btn--solid btn--wide" type="submit">Đăng nhập</button></form></div>';
    var pw = document.getElementById('pw');
    pw.focus();
    document.getElementById('loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      A.pw = pw.value;
      var btn = e.target.querySelector('button'); btn.disabled = true;
      API.call({ action: 'adminLogin', password: A.pw }).then(function (res) {
        if (!res.ok) return showLogin(errMsg(res.error));
        try { sessionStorage.setItem(PW_KEY, A.pw); } catch (er) {}
        showList();
      }).catch(function () { showLogin('Không kết nối được Apps Script. Kiểm tra lại apiUrl trong config.js.'); });
    });
  }

  function logout(msg) {
    A.pw = '';
    try { sessionStorage.removeItem(PW_KEY); } catch (e) {}
    showLogin(msg);
  }
  logoutBtn.addEventListener('click', function () { logout(); });

  /* ---------------- danh sách ---------------- */
  function showList() {
    logoutBtn.hidden = false;
    A.current = null;
    view.innerHTML = '<div class="loading"><span></span></div>';
    return call('adminList').then(function (res) {
      if (!res.ok) throw new Error(res.error);
      A.couples = res.couples || [];
      renderList();
    }).catch(function (e) {
      if (A.pw) view.innerHTML = '<p class="empty">Không tải được danh sách (' + esc(e.message) + '). <button class="link-btn" data-act="reload">Thử lại</button></p>';
    });
  }

  function renderList() {
    var t = today();
    var upcoming = A.couples.filter(function (c) { return c.weddingDate >= t; });
    var past = A.couples.filter(function (c) { return c.weddingDate < t; }).reverse();
    var html = '<div class="toolbar screen"><div><p class="eyebrow">' + A.couples.length + ' cặp đôi</p>' +
      '<h1 class="title">Love Story</h1></div>' +
      '<div class="toolbar__actions"><button class="btn btn--outline btn--sm" data-act="reload">Làm mới</button>' +
      '<button class="btn btn--solid btn--sm" data-act="new">+ Cặp mới</button></div></div>';
    if (!A.couples.length) {
      html += '<p class="empty">Chưa có cặp đôi nào. Bấm <b>+ Cặp mới</b> để tạo link đầu tiên.</p>';
    } else {
      if (upcoming.length) html += '<p class="group-label">Sắp cưới</p>' + upcoming.map(coupleRow).join('');
      if (past.length) html += '<p class="group-label">Đã cưới · dữ liệu tự xoá sau 6 tháng</p>' + past.map(coupleRow).join('');
    }
    view.innerHTML = html;
  }

  function statusChip(role, st) {
    st = st || 'new';
    return '<span class="status status--' + esc(st) + '">' + (role === 'bride' ? 'Dâu' : 'Rể') + ' · ' + esc(STATUS[st] || st) + '</span>';
  }

  function coupleRow(c) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(c.weddingDate || '') || [];
    var d = daysUntil(c.weddingDate);
    var when = d == null ? '' : d > 0 ? 'còn ' + d + ' ngày' : d === 0 ? 'hôm nay' : 'đã cưới ' + (-d) + ' ngày';
    return '<div class="couple' + (d != null && d < 0 ? ' is-past' : '') + '">' +
      '<div class="datebox"><b>' + esc(m[3] || '–') + '</b><span>' + esc(m[2] ? MONTHS[+m[2] - 1] + ' ' + m[1] : '') + '</span></div>' +
      '<div><p class="couple__names">' + esc(c.brideName) + ' <em>&amp;</em> ' + esc(c.groomName) + '</p>' +
      '<p class="couple__meta">' + esc(when) + (c.venue ? ' · ' + esc(c.venue) : '') + '</p>' +
      '<div class="status-row">' + statusChip('bride', c.brideStatus) + statusChip('groom', c.groomStatus) + '</div></div>' +
      '<div class="couple__actions"><button class="btn btn--solid btn--sm" data-act="open" data-code="' + esc(c.code) + '">Xem câu trả lời</button>' +
      '<button class="btn btn--outline btn--sm" data-act="links" data-code="' + esc(c.code) + '">Link mời</button></div></div>';
  }

  /* ---------------- chi tiết ---------------- */
  function showDetail(code) {
    view.innerHTML = '<div class="loading"><span></span></div>';
    window.scrollTo(0, 0);
    Promise.all([loadQuestions(), call('adminGet', { code: code })]).then(function (res) {
      var data = res[1];
      if (!data.ok) { toast(errMsg(data.error)); return showList(); }
      A.current = data;
      var i = A.couples.findIndex(function (c) { return c.code === code; });
      if (i !== -1) A.couples[i] = data.couple;
      renderDetail();
    }).catch(function (e) { view.innerHTML = '<p class="empty">Không tải được (' + esc(e.message) + ').</p>'; });
  }

  function answerText(q, v) {
    if (!hasValue(v)) return null;
    if (q.type === 'single') { var o = (q.options || []).filter(function (x) { return x.value === v; })[0]; return o ? o.vi : v; }
    if (q.type === 'multi') return (q.options || []).filter(function (x) { return v.indexOf(x.value) !== -1; }).map(function (o) { return o.vi; }).join(', ');
    if (q.type === 'list') return v.map(function (x, i) { return x && String(x).trim() ? (i + 1) + '. ' + String(x).trim() : ''; }).filter(Boolean).join('\n');
    if (q.type === 'date') return fmtDate(v);
    if (q.type === 'month') return fmtMonth(v);
    return String(v).trim();
  }

  function visibleFor(q, answers) {
    if (!q.showIf) return true;
    return q.showIf.in.indexOf((answers || {})[q.showIf.q]) !== -1;
  }

  function labelVi(q, partner) {
    return String(q.label.vi).replace(/\{partner\}/g, partner || 'người ấy').replace(/\{self\}/g, '');
  }

  function renderDetail() {
    var d = A.current, c = d.couple;
    var ba = (d.bride && d.bride.answers) || {}, ga = (d.groom && d.groom.answers) || {};
    function meta(side, name) {
      if (!side) return 'Chưa có câu trả lời';
      return (STATUS[side.status] || side.status) + (side.submittedAt ? ' · gửi lúc ' + fmtStamp(side.submittedAt) : side.updatedAt ? ' · lưu lúc ' + fmtStamp(side.updatedAt) : '') +
        (side.lang === 'en' ? ' · điền bằng tiếng Anh' : '');
    }
    var html = '<div class="screen"><div class="toolbar no-print"><button class="btn btn--ghost" data-act="back">← Danh sách</button>' +
      '<div class="toolbar__actions">' +
      '<button class="btn btn--outline btn--sm" data-act="links" data-code="' + esc(c.code) + '">Link mời</button>' +
      '<button class="btn btn--outline btn--sm" data-act="edit">Sửa thông tin</button>' +
      '<button class="btn btn--outline btn--sm" data-act="print">In / PDF</button>' +
      '<button class="btn btn--outline btn--sm" data-act="copyAll">Copy câu trả lời</button>' +
      '<button class="btn btn--solid btn--sm" data-act="ai">✨ Tạo bản cho AI</button></div></div>' +
      '<div class="detail-head"><p class="kicker-script">Love Story</p>' +
      '<h1 class="display">' + esc(c.brideName) + ' <em>&amp;</em> ' + esc(c.groomName) + '</h1>' +
      '<p class="detail-meta"><span>Ngày cưới <b>' + esc(fmtDate(c.weddingDate)) + '</b></span>' +
      (c.venue ? '<span>Địa điểm <b>' + esc(c.venue) + '</b></span>' : '') +
      '<span>Tự xoá dữ liệu <b>' + esc(fmtDate(c.purgeDate)) + '</b></span></p>' +
      (c.note ? '<p class="detail-note">' + esc(c.note) + '</p>' : '') +
      '<div class="status-row">' + statusChip('bride', c.brideStatus) + statusChip('groom', c.groomStatus) + '</div>' +
      '<p class="sub-meta" style="margin-top:10px">Dâu: ' + esc(meta(d.bride)) + '<br>Rể: ' + esc(meta(d.groom)) + '</p></div>';

    A.Q.sections.forEach(function (sec, i) {
      var rows = sec.questions.filter(function (q) { return visibleFor(q, ba) || visibleFor(q, ga); }).map(function (q) {
        var bv = visibleFor(q, ba) ? answerText(q, ba[q.id]) : null;
        var gv = visibleFor(q, ga) ? answerText(q, ga[q.id]) : null;
        function cell(who, name, v) {
          return '<div class="qa__cell"><div class="qa__who">' + who + ' · ' + esc(name) + '</div>' +
            '<div class="qa__a' + (v == null ? ' is-empty' : '') + '">' + (v == null ? '—' : esc(v)) + '</div></div>';
        }
        return '<div class="qa' + (q.private ? ' is-private' : '') + '"><p class="qa__q"><b>' + esc(q.num) + '</b>' +
          esc(labelVi(q, 'nửa kia')) + '</p><div class="qa__grid">' +
          cell('Cô dâu', c.brideName, bv) + cell('Chú rể', c.groomName, gv) + '</div></div>';
      }).join('');
      html += '<h2 class="sec-title"><span>Phần ' + ('0' + (i + 1)).slice(-2) + '</span>' + esc(sec.title.vi) + '</h2>' + rows;
    });

    html += '<div class="no-print" style="margin-top:50px;text-align:center">' +
      '<button class="link-btn" data-act="delete" style="color:#b3261e">Xoá cặp đôi và toàn bộ câu trả lời</button></div></div>';
    view.innerHTML = html;
  }

  function plainText() {
    var d = A.current, c = d.couple;
    var ba = (d.bride && d.bride.answers) || {}, ga = (d.groom && d.groom.answers) || {};
    var out = ['LOVE STORY — ' + c.brideName + ' & ' + c.groomName,
      'Ngày cưới: ' + fmtDate(c.weddingDate) + (c.venue ? ' · ' + c.venue : '')];
    if (c.note) out.push('Ghi chú: ' + c.note);
    A.Q.sections.forEach(function (sec, i) {
      out.push('', '== ' + (i + 1) + '. ' + sec.title.vi.toUpperCase() + ' ==');
      sec.questions.forEach(function (q) {
        if (!visibleFor(q, ba) && !visibleFor(q, ga)) return;
        var bv = visibleFor(q, ba) ? answerText(q, ba[q.id]) : null;
        var gv = visibleFor(q, ga) ? answerText(q, ga[q.id]) : null;
        if (bv == null && gv == null) return;
        out.push('', q.num + ' ' + labelVi(q, 'nửa kia') + (q.private ? ' [RIÊNG TƯ — chỉ MC đọc]' : ''));
        out.push('• Cô dâu (' + c.brideName + '): ' + (bv == null ? '—' : bv));
        out.push('• Chú rể (' + c.groomName + '): ' + (gv == null ? '—' : gv));
      });
    });
    return out.join('\n');
  }

  /* ---------------- bản tổng hợp cho AI viết kịch bản ---------------- */
  var LENGTHS = {
    short: { label: 'Ngắn · khoảng 2 phút', words: 'khoảng 250–300 từ' },
    medium: { label: 'Vừa · khoảng 3–4 phút', words: 'khoảng 450–550 từ' },
    long: { label: 'Dài · khoảng 5–6 phút', words: 'khoảng 700–850 từ' }
  };
  var LANGS = {
    both: 'Song ngữ. Mỗi đoạn tiếng Việt viết liền mạch, ngay sau là đoạn tiếng Anh tương ứng in nghiêng. Chỉ dùng tiêu đề phần, không ghi nhãn VI/EN trong câu.',
    vi: 'Tiếng Việt.',
    en: 'Tiếng Anh.'
  };
  var MOODS = { warm: 'Ấm áp, xúc động', fun: 'Vui nhộn, hài hước', romantic: 'Lãng mạn', elegant: 'Trang trọng, sang trọng' };

  function both(id) {
    var d = A.current, ba = (d.bride && d.bride.answers) || {}, ga = (d.groom && d.groom.answers) || {};
    return { b: ba[id], g: ga[id] };
  }

  function aiDefaults() {
    var m = both('q5_4'), l = both('q5_5');
    var moods = [].concat(Array.isArray(m.b) ? m.b : [], Array.isArray(m.g) ? m.g : [])
      .filter(function (x, i, arr) { return MOODS[x] && arr.indexOf(x) === i; });
    var lang = l.b === 'both' || l.g === 'both' || (l.b && l.g && l.b !== l.g) ? 'both' : (l.b || l.g || 'both');
    return { lang: lang, length: 'medium', moods: moods.length ? moods : ['warm', 'romantic'], mcs: '1', note: '' };
  }

  function aiBrief(o) {
    var d = A.current, c = d.couple;
    var ba = (d.bride && d.bride.answers) || {}, ga = (d.groom && d.groom.answers) || {};
    var B = c.brideName, G = c.groomName;
    function val(q, ans) { return visibleFor(q, ans) ? answerText(q, ans[q.id]) : null; }
    function qById(id) {
      for (var i = 0; i < A.Q.sections.length; i++) for (var j = 0; j < A.Q.sections[i].questions.length; j++)
        if (A.Q.sections[i].questions[j].id === id) return A.Q.sections[i].questions[j];
      return null;
    }
    function pair(id) { var q = qById(id); return q ? { b: val(q, ba), g: val(q, ga) } : { b: null, g: null }; }

    var avoid = pair('q5_6');
    var L = [];
    L.push('# YÊU CẦU');
    L.push('Bạn là người viết kịch bản cho MC Thiên Ân, MC đám cưới cao cấp, dẫn song ngữ Việt – Anh.');
    L.push('Hãy viết phần dẫn **Love Story** cho đám cưới của ' + B + ' & ' + G + ', dựa trên chia sẻ riêng của cô dâu và chú rể ở bên dưới.');
    L.push('');
    L.push('- Độ dài: ' + LENGTHS[o.length].label.split('·')[1].trim() + ' đọc trên sân khấu, ' + LENGTHS[o.length].words + (o.lang === 'both' ? ' cho mỗi ngôn ngữ.' : '.'));
    L.push('- Ngôn ngữ: ' + LANGS[o.lang]);
    L.push('- Giọng điệu: ' + (o.moods.length ? o.moods.map(function (m) { return MOODS[m]; }).join('; ') : 'ấm áp, tinh tế') + '.');
    L.push('- Số MC: ' + (o.mcs === '2' ? '2 MC dẫn đối đáp (Thiên Ân và một MC nữa). Ghi rõ tên người nói ở đầu mỗi lượt lời.' : '1 MC (Thiên Ân).'));
    L.push('- Kể theo dòng thời gian: gặp gỡ → hẹn hò → cầu hôn hoặc quyết định về chung nhà → hôm nay → tương lai.');
    L.push('- Đan xen góc nhìn của cả hai. Khi hai người kể khác nhau về cùng một chuyện, dùng chính sự khác biệt đó một cách duyên dáng.');
    L.push('- Có thể dùng tên thân mật, cách xưng hô và những câu nói chỉ hai người hiểu, nếu phù hợp với không khí trang trọng của tiệc.');
    L.push('- Nếu có lời hứa của hai bạn, gợi ý cách lồng vào nghi thức "I Do" ở cuối phần dẫn.');
    if (avoid.b || avoid.g) {
      L.push('- TUYỆT ĐỐI KHÔNG nhắc tới những điều sau:');
      if (avoid.b) L.push('  - Theo cô dâu: ' + avoid.b.replace(/\n/g, ' '));
      if (avoid.g) L.push('  - Theo chú rể: ' + avoid.g.replace(/\n/g, ' '));
    }
    L.push('- Không bịa thêm chi tiết không có trong chia sẻ. Chỗ nào thiếu thông tin, ghi [CẦN HỎI THÊM: …] để MC hỏi lại cặp đôi.');
    if (o.note.trim()) L.push('- Ghi chú thêm của MC: ' + o.note.trim().replace(/\n/g, ' '));

    L.push('', '# THÔNG TIN CẶP ĐÔI');
    function person(role, name, ans) {
      function v(id) { var q = qById(id); return q ? val(q, ans) : null; }
      var parts = [role + ': ' + name];
      if (v('q1_2')) parts.push('tên thân mật: ' + v('q1_2'));
      if (v('q1_4')) parts.push('bố: ' + v('q1_4'));
      if (v('q1_5')) parts.push('mẹ: ' + v('q1_5'));
      return '- ' + parts.join(' · ');
    }
    L.push(person('Cô dâu', B, ba));
    L.push(person('Chú rể', G, ga));
    L.push('- Ngày cưới: ' + fmtDate(c.weddingDate) + (c.venue ? ' · Địa điểm: ' + c.venue : ''));
    var met = pair('q2_1');
    if (met.b || met.g) L.push('- Quen nhau từ: ' + (met.b || met.g) + (met.b && met.g && met.b !== met.g ? ' (chú rể nhớ là ' + met.g + ')' : ''));
    var lg = pair('q5_5');
    if (lg.b || lg.g) L.push('- Ngôn ngữ khách mời: ' + (lg.b || lg.g));
    var fam = pair('q1_6');
    if (fam.b) L.push('- Lưu ý về gia đình (cô dâu): ' + fam.b.replace(/\n/g, ' '));
    if (fam.g) L.push('- Lưu ý về gia đình (chú rể): ' + fam.g.replace(/\n/g, ' '));
    if (c.note) L.push('- Ghi chú của MC về cặp đôi: ' + c.note.replace(/\n/g, ' '));

    L.push('', '# CHIA SẺ CỦA CÔ DÂU VÀ CHÚ RỂ');
    var skip = { q2_1: 1, q5_4: 1, q5_5: 1, q5_6: 1 };
    var hasAny = false;
    A.Q.sections.forEach(function (sec) {
      if (sec.id === 'about') return;
      var block = [];
      sec.questions.forEach(function (q) {
        if (skip[q.id]) return;
        var bv = val(q, ba), gv = val(q, ga);
        if (bv == null && gv == null) return;
        block.push('', '### ' + labelVi(q, 'nửa kia'));
        block.push('- Cô dâu (' + B + '): ' + (bv == null ? '(không trả lời)' : bv.replace(/\n/g, '\n  ')));
        block.push('- Chú rể (' + G + '): ' + (gv == null ? '(không trả lời)' : gv.replace(/\n/g, '\n  ')));
      });
      if (block.length) { hasAny = true; L.push('', '## ' + sec.title.vi); Array.prototype.push.apply(L, block); }
    });
    if (!hasAny) L.push('', '(Chưa có câu trả lời nào.)');
    return L.join('\n');
  }

  function showAiBrief() {
    var o = aiDefaults();
    function radio(name, opts, cur) {
      return Object.keys(opts).map(function (k) {
        return '<button type="button" class="chip' + (k === cur ? ' is-on' : '') + '" data-opt="' + name + '" data-val="' + k + '">' + esc(opts[k]) + '</button>';
      }).join('');
    }
    function draw() {
      var lens = {}; Object.keys(LENGTHS).forEach(function (k) { lens[k] = LENGTHS[k].label; });
      openModal('<h2>Bản tổng hợp cho AI</h2>' +
        '<p class="body" style="font-size:14px">Chọn vài thông số, rồi copy hoặc tải về và dán vào Claude để viết kịch bản Love Story.</p>' +
        '<div class="form-grid ai-opts">' +
        '<div><label>Ngôn ngữ kịch bản</label><div class="chips">' + radio('lang', { both: 'Song ngữ', vi: 'Tiếng Việt', en: 'Tiếng Anh' }, o.lang) + '</div></div>' +
        '<div><label>Độ dài</label><div class="chips">' + radio('length', lens, o.length) + '</div></div>' +
        '<div><label>Giọng điệu <span style="text-transform:none;letter-spacing:0">(lấy sẵn từ câu 5.4, chọn được nhiều)</span></label><div class="chips">' +
        Object.keys(MOODS).map(function (k) {
          return '<button type="button" class="chip' + (o.moods.indexOf(k) !== -1 ? ' is-on' : '') + '" data-mood="' + k + '">' + esc(MOODS[k]) + '</button>';
        }).join('') + '</div></div>' +
        '<div><label>Số MC</label><div class="chips">' + radio('mcs', { '1': '1 MC', '2': '2 MC đối đáp' }, o.mcs) + '</div></div>' +
        '<div><label for="ai_note">Ghi chú thêm cho AI (tuỳ chọn)</label><textarea class="field" id="ai_note" style="min-height:70px" placeholder="Ví dụ: mở đầu bằng câu thơ, kết thúc bằng lời mời nâng ly…">' + esc(o.note) + '</textarea></div>' +
        '<div><label for="ai_out">Xem trước</label><textarea class="field ai-out" id="ai_out" readonly></textarea></div>' +
        '</div>' +
        '<div class="modal__actions"><button type="button" class="btn btn--ghost" data-close>Đóng</button>' +
        '<button type="button" class="btn btn--outline" id="ai_dl">Tải file .txt</button>' +
        '<button type="button" class="btn btn--solid" id="ai_copy">Copy cho AI</button></div>');
      modal.querySelector('.modal__panel').classList.add('modal__panel--wide');
      var out = document.getElementById('ai_out');
      function refresh() { out.value = aiBrief(o); }
      refresh();
      modalPanel.querySelector('[data-close]').addEventListener('click', closeModal);
      modalPanel.querySelectorAll('[data-opt]').forEach(function (b) {
        b.addEventListener('click', function () {
          o[b.getAttribute('data-opt')] = b.getAttribute('data-val');
          modalPanel.querySelectorAll('[data-opt="' + b.getAttribute('data-opt') + '"]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
          refresh();
        });
      });
      modalPanel.querySelectorAll('[data-mood]').forEach(function (b) {
        b.addEventListener('click', function () {
          var m = b.getAttribute('data-mood'), i = o.moods.indexOf(m);
          if (i === -1) o.moods.push(m); else o.moods.splice(i, 1);
          b.classList.toggle('is-on', i === -1);
          refresh();
        });
      });
      document.getElementById('ai_note').addEventListener('input', function (e) { o.note = e.target.value; refresh(); });
      document.getElementById('ai_copy').addEventListener('click', function () { copy(out.value, 'Đã copy — dán vào Claude để viết kịch bản'); });
      document.getElementById('ai_dl').addEventListener('click', function () {
        var c = A.current.couple;
        var blob = new Blob([out.value], { type: 'text/plain;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'love-story-' + c.code.replace(/-[a-z0-9]{4}$/, '') + '.txt';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      });
    }
    draw();
  }

  /* ---------------- modal ---------------- */
  function openModal(html) {
    modalPanel.innerHTML = html;
    modal.hidden = false;
    var f = modalPanel.querySelector('input, button');
    if (f) f.focus();
  }
  function closeModal() { modal.hidden = true; modalPanel.innerHTML = ''; modalPanel.classList.remove('modal__panel--wide'); }
  modal.addEventListener('click', function (e) { if (e.target.hasAttribute('data-close')) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  function coupleForm(c) {
    var isNew = !c; c = c || {};
    openModal('<h2>' + (isNew ? 'Cặp đôi mới' : 'Sửa thông tin') + '</h2>' +
      '<form id="coupleForm" class="form-grid">' +
      '<div class="two"><div><label for="cf_b">Tên cô dâu *</label><input class="field" id="cf_b" required maxlength="80" value="' + esc(c.brideName) + '"></div>' +
      '<div><label for="cf_g">Tên chú rể *</label><input class="field" id="cf_g" required maxlength="80" value="' + esc(c.groomName) + '"></div></div>' +
      '<p class="hint" style="margin-top:-8px">Nhập tên gọi thân mật (ví dụ: Ngọc, Minh). Tên này hiện trong câu hỏi: "Điều gì ở <b>Minh</b> thu hút bạn…"</p>' +
      '<div class="two"><div><label for="cf_d">Ngày cưới *</label><input class="field" id="cf_d" type="date" required value="' + esc(c.weddingDate) + '"></div>' +
      '<div><label for="cf_v">Địa điểm</label><input class="field" id="cf_v" maxlength="200" value="' + esc(c.venue) + '"></div></div>' +
      '<div><label for="cf_n">Ghi chú riêng (chỉ bạn thấy)</label><textarea class="field" id="cf_n" maxlength="1000" style="min-height:80px">' + esc(c.note) + '</textarea></div>' +
      '<p class="err" id="cf_err" hidden></p>' +
      '<div class="modal__actions"><button type="button" class="btn btn--ghost" data-close>Huỷ</button>' +
      '<button type="submit" class="btn btn--solid">' + (isNew ? 'Tạo link' : 'Lưu') + '</button></div></form>');
    modalPanel.querySelector('[data-close]').addEventListener('click', closeModal);
    document.getElementById('coupleForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
      var data = {
        brideName: document.getElementById('cf_b').value.trim(),
        groomName: document.getElementById('cf_g').value.trim(),
        weddingDate: document.getElementById('cf_d').value,
        venue: document.getElementById('cf_v').value.trim(),
        note: document.getElementById('cf_n').value.trim()
      };
      var req = isNew ? call('adminCreate', { couple: data }) : call('adminUpdate', { code: c.code, couple: data });
      req.then(function (res) {
        btn.disabled = false;
        if (!res.ok) { var er = document.getElementById('cf_err'); er.textContent = errMsg(res.error); er.hidden = false; return; }
        if (isNew) {
          A.couples.push(res.couple);
          A.couples.sort(function (a, b) { return String(a.weddingDate).localeCompare(String(b.weddingDate)); });
          renderList();
          showLinks(res.couple, true);
        } else {
          closeModal();
          showDetail(c.code);
          toast('Đã lưu');
        }
      }).catch(function () { btn.disabled = false; });
    });
  }

  function coupleLink(c) { return link(c.brideKey); }

  function message(c, lang) {
    var url = coupleLink(c) + (lang === 'en' ? '?lang=en' : '');
    if (lang === 'en') {
      return 'Hi ' + c.brideName + ' & ' + c.groomName + ' 💛\n' +
        "This is Thiên Ân. Here's the link to share your love story, so I can prepare the Love Story moment for your wedding on " + fmtDate(c.weddingDate) + '.\n\n' +
        '👉 ' + url + '\n\n' +
        'Each of you, please open the link, tap your own name and answer separately. It takes about 20–25 minutes, and your answers save automatically so you can come back anytime.\n' +
        'Thank you both! — Thiên Ân';
    }
    return 'Chào ' + c.brideName + ' & ' + c.groomName + ' 💛\n' +
      'Thiên Ân gửi hai bạn link kể câu chuyện tình yêu, để mình chuẩn bị phần Love Story cho đám cưới ngày ' + fmtDate(c.weddingDate) + '.\n\n' +
      '👉 ' + url + '\n\n' +
      'Mỗi bạn mở link, bấm chọn đúng tên mình rồi trả lời riêng nhé, khoảng 20–25 phút mỗi người. Câu trả lời tự lưu nên có thể dừng lại và điền tiếp bất cứ lúc nào.\n' +
      'Cảm ơn hai bạn! — Thiên Ân';
  }

  function showLinks(c, justCreated) {
    var url = coupleLink(c);
    openModal('<h2>' + (justCreated ? 'Đã tạo link ✨' : 'Link mời') + '</h2>' +
      '<p class="body" style="font-size:14px">Một link chung cho cả hai bạn, gửi thẳng vào group. Khi mở link, mỗi người bấm chọn tên mình rồi trả lời riêng.</p>' +
      '<div class="linkbox"><h3>' + esc(c.brideName) + ' &amp; ' + esc(c.groomName) + '</h3>' +
      '<input class="field" readonly value="' + esc(url) + '" onclick="this.select()">' +
      '<div class="row"><button class="btn btn--solid btn--sm" data-copy="url">Copy link</button>' +
      '<button class="btn btn--outline btn--sm" data-copy="vi">Copy tin nhắn group (VI)</button>' +
      '<button class="btn btn--outline btn--sm" data-copy="en">Copy tin nhắn group (EN)</button></div></div>' +
      '<div class="modal__actions"><button type="button" class="btn btn--solid" data-close>Xong</button></div>');
    modalPanel.querySelector('.modal__actions [data-close]').addEventListener('click', closeModal);
    modalPanel.querySelectorAll('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var kind = b.getAttribute('data-copy');
        if (kind === 'url') copy(url, 'Đã copy link');
        else copy(message(c, kind), 'Đã copy tin nhắn');
      });
    });
  }

  /* ---------------- sự kiện ---------------- */
  view.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act'), code = b.getAttribute('data-code');
    var couple = code ? A.couples.filter(function (c) { return c.code === code; })[0] : null;
    if (act === 'reload') showList();
    else if (act === 'new') coupleForm(null);
    else if (act === 'open') showDetail(code);
    else if (act === 'links') showLinks((A.current && A.current.couple.code === code) ? A.current.couple : couple);
    else if (act === 'back') showList();
    else if (act === 'edit') coupleForm(A.current.couple);
    else if (act === 'print') window.print();
    else if (act === 'copyAll') copy(plainText(), 'Đã copy toàn bộ câu trả lời');
    else if (act === 'ai') showAiBrief();
    else if (act === 'delete') {
      var c = A.current.couple;
      if (!window.confirm('Xoá ' + c.brideName + ' & ' + c.groomName + ' và toàn bộ câu trả lời? Không thể khôi phục.')) return;
      call('adminDelete', { code: c.code }).then(function (res) {
        if (!res.ok) return toast(errMsg(res.error));
        toast('Đã xoá'); showList();
      });
    }
  });

  if (A.pw) showList(); else showLogin();
})();
