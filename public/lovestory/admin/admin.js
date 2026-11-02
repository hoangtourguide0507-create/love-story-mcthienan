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
      '<button class="btn btn--solid btn--sm" data-act="copyAll">Copy toàn bộ</button></div></div>' +
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

  /* ---------------- modal ---------------- */
  function openModal(html) {
    modalPanel.innerHTML = html;
    modal.hidden = false;
    var f = modalPanel.querySelector('input, button');
    if (f) f.focus();
  }
  function closeModal() { modal.hidden = true; modalPanel.innerHTML = ''; }
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

  function message(c, role, lang) {
    var self = role === 'bride' ? c.brideName : c.groomName;
    var partner = role === 'bride' ? c.groomName : c.brideName;
    var url = link(role === 'bride' ? c.brideKey : c.groomKey) + (lang === 'en' ? '?lang=en' : '');
    if (lang === 'en') {
      return 'Hi ' + self + ' 💛\n' +
        "This is Thiên Ân. Here's your link to share your love story, so I can prepare the Love Story moment for your wedding on " + fmtDate(c.weddingDate) + '.\n\n' +
        '👉 ' + url + '\n\n' +
        'This link is just for you — ' + partner + ' has their own, so they won’t see your answers. ' +
        'It takes about 20–25 minutes, and your answers save automatically so you can come back anytime.\n' +
        'Thank you! — Thiên Ân';
    }
    return 'Chào ' + self + ' 💛\n' +
      'Thiên Ân gửi bạn link kể câu chuyện tình yêu của hai bạn, để mình chuẩn bị phần Love Story cho đám cưới ngày ' + fmtDate(c.weddingDate) + '.\n\n' +
      '👉 ' + url + '\n\n' +
      'Đây là link riêng của bạn. ' + partner + ' có link riêng nên sẽ không xem được câu trả lời của bạn đâu nhé. ' +
      'Bạn điền khoảng 20–25 phút, câu trả lời tự lưu nên có thể dừng lại và điền tiếp bất cứ lúc nào.\n' +
      'Cảm ơn bạn! — Thiên Ân';
  }

  function showLinks(c, justCreated) {
    function box(role) {
      var name = role === 'bride' ? c.brideName : c.groomName;
      var url = link(role === 'bride' ? c.brideKey : c.groomKey);
      return '<div class="linkbox"><h3>' + (role === 'bride' ? 'Cô dâu' : 'Chú rể') + ' · ' + esc(name) + '</h3>' +
        '<input class="field" readonly value="' + esc(url) + '" onclick="this.select()">' +
        '<div class="row"><button class="btn btn--solid btn--sm" data-copy="url" data-role="' + role + '">Copy link</button>' +
        '<button class="btn btn--outline btn--sm" data-copy="vi" data-role="' + role + '">Copy tin nhắn (VI)</button>' +
        '<button class="btn btn--outline btn--sm" data-copy="en" data-role="' + role + '">Copy tin nhắn (EN)</button></div></div>';
    }
    openModal('<h2>' + (justCreated ? 'Đã tạo link ✨' : 'Link mời') + '</h2>' +
      '<p class="body" style="font-size:14px">Gửi riêng từng link cho cô dâu và chú rể (Zalo, Messenger…). Mỗi người chỉ xem được câu trả lời của mình.</p>' +
      box('bride') + box('groom') +
      '<div class="modal__actions"><button type="button" class="btn btn--solid" data-close>Xong</button></div>');
    modalPanel.querySelector('.modal__actions [data-close]').addEventListener('click', closeModal);
    modalPanel.querySelectorAll('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var role = b.getAttribute('data-role'), kind = b.getAttribute('data-copy');
        if (kind === 'url') copy(link(role === 'bride' ? c.brideKey : c.groomKey), 'Đã copy link');
        else copy(message(c, role, kind), 'Đã copy tin nhắn');
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
