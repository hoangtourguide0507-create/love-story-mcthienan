/* Love Story · MC Thiên Ân — trang form cho cô dâu & chú rể */
(function () {
  'use strict';

  var API = window.LoveStoryAPI;
  var app = document.getElementById('app');
  var nav = document.getElementById('nav');
  var backBtn = document.getElementById('backBtn');
  var nextBtn = document.getElementById('nextBtn');
  var saveStateEl = document.getElementById('saveState');
  var progressBar = document.getElementById('progressBar');

  var UI = {
    back: { vi: '← Quay lại', en: '← Back' },
    next: { vi: 'Tiếp tục →', en: 'Next →' },
    toReview: { vi: 'Xem lại →', en: 'Review →' },
    part: { vi: 'Phần', en: 'Part' },
    saving: { vi: 'Đang lưu…', en: 'Saving…' },
    saved: { vi: 'Đã lưu', en: 'Saved' },
    saveError: { vi: 'Chưa lưu lên được, sẽ tự thử lại', en: "Couldn't save yet, retrying" },
    offline: { vi: 'Mất mạng — câu trả lời vẫn được giữ trên máy', en: 'Offline — your answers are kept on this device' },
    required: { vi: 'Bạn vui lòng điền câu này nhé.', en: 'Please fill this in.' },
    privateBadge: { vi: 'Chỉ Thiên Ân đọc', en: 'Only Thiên Ân reads this' },
    edit: { vi: 'Sửa', en: 'Edit' },
    empty: { vi: 'Chưa trả lời', en: 'Not answered' },
    answered: { vi: 'câu đã trả lời', en: 'questions answered' },
    sending: { vi: 'Đang gửi…', en: 'Sending…' },
    resend: { vi: 'Cập nhật câu trả lời', en: 'Update my answers' },
    sendError: { vi: 'Chưa gửi được. Bạn kiểm tra kết nối mạng rồi thử lại nhé — câu trả lời vẫn được giữ nguyên.', en: "Couldn't send. Please check your connection and try again — your answers are safe." },
    monthHint: { vi: 'Tháng / năm', en: 'Month / year' },
    partnerFallback: { vi: 'người ấy', en: 'your partner' },
    demo: {
      vi: 'Chế độ xem thử — câu trả lời chỉ lưu trên trình duyệt này, chưa gửi đi đâu.',
      en: 'Preview mode — answers are only stored in this browser and are not sent anywhere.'
    },
    badLinkTitle: { vi: 'Link chưa đúng', en: 'This link isn’t valid' },
    badLinkBody: {
      vi: 'Link này không còn hiệu lực hoặc bị thiếu ký tự khi sao chép. Bạn vui lòng liên hệ Thiên Ân để nhận lại link nhé.',
      en: 'This link has expired or was copied incompletely. Please contact Thiên Ân for a new link.'
    },
    demoBride: { vi: 'Xem thử với vai cô dâu', en: 'Preview as the bride' },
    demoGroom: { vi: 'Xem thử với vai chú rể', en: 'Preview as the groom' },
    netTitle: { vi: 'Chưa kết nối được', en: 'Can’t connect right now' },
    netBody: { vi: 'Bạn kiểm tra kết nối mạng rồi thử lại nhé.', en: 'Please check your connection and try again.' },
    retry: { vi: 'Thử lại', en: 'Try again' }
  };

  var params = new URLSearchParams(location.search);
  var S = {
    k: (params.get('k') || '').trim(),
    lang: 'vi',
    Q: null,
    session: null,
    answers: {},
    step: -1,
    status: 'new',
    ver: 0,
    syncedVer: 0,
    serverUpdatedAt: '',
    syncTimer: null,
    retryTimer: null,
    syncing: false,
    invalid: {}
  };

  /* ---------------- tiện ích ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function t(obj) { if (!obj) return ''; if (typeof obj === 'string') return obj; return obj[S.lang] || obj.vi || ''; }
  function fill(str) {
    var self = S.session ? S.session.selfName : '';
    var partner = (S.session && S.session.partnerName) || t(UI.partnerFallback);
    return String(str).replace(/\{(self|partner)\}/g, function (m, key, offset, whole) {
      var v = key === 'self' ? self : partner;
      var before = whole.slice(0, offset);
      if (!before.trim() || /[.!?]\s*$/.test(before)) v = v.charAt(0).toUpperCase() + v.slice(1);
      return v;
    }).replace(/\s+([,.!?])/g, '$1');
  }
  function txt(obj) { return esc(fill(t(obj))); }
  function rich(obj) { return txt(obj).replace(/\*([^*]+)\*/g, '<em>$1</em>'); }
  function sections() { return S.Q.sections; }
  function visible(q) {
    if (!q.showIf) return true;
    return q.showIf.in.indexOf(S.answers[q.showIf.q]) !== -1;
  }
  function hasValue(v) {
    if (Array.isArray(v)) return v.some(function (x) { return String(x || '').trim(); });
    return v != null && String(v).trim() !== '';
  }
  function storageKey() { return 'lovestory_' + S.k; }
  function readLocal() { try { return JSON.parse(localStorage.getItem(storageKey()) || 'null'); } catch (e) { return null; } }
  function writeLocal() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify({
        answers: S.answers, step: S.step, lang: S.lang,
        dirty: S.ver !== S.syncedVer, updatedAt: new Date().toISOString()
      }));
    } catch (e) {}
  }
  function fmtDate(v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : v; }
  function fmtMonth(v) { var m = /^(\d{4})-(\d{2})$/.exec(v || ''); return m ? m[2] + '/' + m[1] : v; }
  function timeNow() { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }

  /* ---------------- ngôn ngữ ---------------- */
  function setLang(lang, rerender) {
    S.lang = lang === 'en' ? 'en' : 'vi';
    document.documentElement.lang = S.lang;
    document.documentElement.setAttribute('data-lang', S.lang);
    document.querySelectorAll('[data-set-lang]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-set-lang') === S.lang);
      b.setAttribute('aria-pressed', b.getAttribute('data-set-lang') === S.lang);
    });
    var demoBanner = document.getElementById('demoBanner');
    if (API.demo) { demoBanner.hidden = false; demoBanner.textContent = t(UI.demo); }
    if (rerender && S.Q) { var y = window.scrollY; render(); window.scrollTo(0, y); writeLocal(); }
  }
  document.querySelectorAll('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.getAttribute('data-set-lang'), true); });
  });

  /* ---------------- lưu ---------------- */
  function setSaveState(kind) {
    saveStateEl.classList.toggle('is-error', kind === 'error' || kind === 'offline');
    if (kind === 'saving') saveStateEl.textContent = t(UI.saving);
    else if (kind === 'saved') saveStateEl.textContent = t(UI.saved) + ' · ' + timeNow();
    else if (kind === 'error') saveStateEl.textContent = t(UI.saveError);
    else if (kind === 'offline') saveStateEl.textContent = t(UI.offline);
    else saveStateEl.textContent = '';
  }

  function onEdit(id, value) {
    S.answers[id] = value;
    S.ver++;
    if (S.invalid[id] && hasValue(value)) {
      delete S.invalid[id];
      var el = app.querySelector('.q[data-q="' + id + '"]');
      if (el) { el.classList.remove('is-invalid'); var er = el.querySelector('.q__error'); if (er) er.remove(); }
    }
    writeLocal();
    setSaveState('saving');
    clearTimeout(S.syncTimer);
    S.syncTimer = setTimeout(sync, 3000);
  }

  function sync() {
    clearTimeout(S.syncTimer);
    clearTimeout(S.retryTimer);
    if (S.ver === S.syncedVer) return Promise.resolve(true);
    if (S.syncing) { S.syncTimer = setTimeout(sync, 1500); return Promise.resolve(false); }
    if (!navigator.onLine) { setSaveState('offline'); return Promise.resolve(false); }
    var v = S.ver;
    S.syncing = true;
    setSaveState('saving');
    return API.call({ action: 'save', k: S.k, lang: S.lang, answers: S.answers })
      .then(function (res) {
        S.syncing = false;
        if (!res || !res.ok) throw new Error((res && res.error) || 'save_failed');
        S.syncedVer = Math.max(S.syncedVer, v);
        S.serverUpdatedAt = res.updatedAt;
        if (res.status) S.status = res.status;
        writeLocal();
        setSaveState(S.ver === S.syncedVer ? 'saved' : 'saving');
        if (S.ver !== S.syncedVer) S.syncTimer = setTimeout(sync, 1500);
        return true;
      })
      .catch(function () {
        S.syncing = false;
        setSaveState(navigator.onLine ? 'error' : 'offline');
        S.retryTimer = setTimeout(sync, 15000);
        return false;
      });
  }
  window.addEventListener('online', function () { sync(); });
  window.addEventListener('offline', function () { setSaveState('offline'); });
  window.addEventListener('pagehide', function () {
    if (S.ver === S.syncedVer || API.demo || !navigator.sendBeacon) return;
    try {
      navigator.sendBeacon(window.LOVESTORY_CONFIG.apiUrl,
        new Blob([JSON.stringify({ action: 'save', k: S.k, lang: S.lang, answers: S.answers })], { type: 'text/plain' }));
    } catch (e) {}
  });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') sync(); });

  /* ---------------- điều hướng ---------------- */
  function lastSectionIndex() { return sections().length - 1; }
  function reviewIndex() { return sections().length; }
  function thanksIndex() { return sections().length + 1; }

  function goTo(step, opts) {
    if (S.step >= 0 && S.step <= lastSectionIndex()) sync();
    S.step = step;
    writeLocal();
    render();
    if (!opts || !opts.keepScroll) window.scrollTo(0, 0);
  }

  function missingRequired(sectionIdx) {
    var miss = [];
    sections().forEach(function (sec, i) {
      if (sectionIdx != null && i !== sectionIdx) return;
      sec.questions.forEach(function (q) {
        if (q.required && visible(q) && !hasValue(S.answers[q.id])) miss.push({ q: q, section: i });
      });
    });
    return miss;
  }

  function flagMissing(miss) {
    S.invalid = {};
    miss.forEach(function (m) { S.invalid[m.q.id] = true; });
    render();
    var first = app.querySelector('.q.is-invalid');
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var f = first.querySelector('.field, .chip');
      if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 350);
    }
  }

  backBtn.addEventListener('click', function () {
    if (S.step === reviewIndex()) goTo(lastSectionIndex());
    else goTo(S.step - 1);
  });
  nextBtn.addEventListener('click', function () {
    if (S.step >= 0 && S.step <= lastSectionIndex()) {
      var miss = missingRequired(S.step);
      if (miss.length) return flagMissing(miss);
      goTo(S.step + 1);
    } else if (S.step === reviewIndex()) {
      submit();
    }
  });

  function submit() {
    var miss = missingRequired(null);
    if (miss.length) { S.step = miss[0].section; writeLocal(); return flagMissing(miss); }
    var errEl = document.getElementById('submitError');
    if (errEl) errEl.hidden = true;
    nextBtn.disabled = true;
    nextBtn.textContent = t(UI.sending);
    var v = S.ver;
    API.call({ action: 'submit', k: S.k, lang: S.lang, answers: S.answers })
      .then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || 'submit_failed');
        S.status = 'submitted';
        S.syncedVer = Math.max(S.syncedVer, v);
        S.serverUpdatedAt = res.updatedAt;
        nextBtn.disabled = false;
        goTo(thanksIndex());
      })
      .catch(function () {
        nextBtn.disabled = false;
        renderNav();
        var e = document.getElementById('submitError');
        if (e) { e.hidden = false; e.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      });
  }

  /* ---------------- hiển thị ---------------- */
  function render() {
    var step = S.step, n = sections().length;
    var html;
    if (step < 0) html = renderWelcome();
    else if (step <= n - 1) html = renderSection(step);
    else if (step === n) html = renderReview();
    else html = renderThanks();
    app.innerHTML = '<div class="screen">' + html + '</div>';
    app.querySelectorAll('textarea.field').forEach(autoGrow);
    progressBar.style.width = (step < 0 ? 0 : Math.min(1, (step + 1) / (n + 1)) * 100) + '%';
    renderNav();
  }

  function renderNav() {
    var step = S.step, n = sections().length;
    var show = step >= 0 && step <= n;
    nav.hidden = !show;
    if (!show) return;
    backBtn.textContent = t(UI.back);
    if (step === n) nextBtn.textContent = S.status === 'submitted' ? t(UI.resend) : t(S.Q.review.button);
    else if (step === n - 1) nextBtn.textContent = t(UI.toReview);
    else nextBtn.textContent = t(UI.next);
    if (!saveStateEl.textContent && S.ver === S.syncedVer && S.serverUpdatedAt) saveStateEl.textContent = t(UI.saved);
  }

  function renderWelcome() {
    var I = S.Q.intro;
    var started = Object.keys(S.answers).some(function (k) { return hasValue(S.answers[k]); }) && S.resumeStep > 0;
    return '<p class="kicker-script">' + txt(I.kicker) + '</p>' +
      '<h1 class="display">' + rich(I.title) + '</h1>' +
      '<p class="lead">' + txt(I.greeting) + '</p>' +
      '<p class="body">' + txt(I.body) + '</p>' +
      '<ol class="points">' + I.points.map(function (p, i) {
        return '<li><b>0' + (i + 1) + '</b><span>' + txt(p) + '</span></li>';
      }).join('') + '</ol>' +
      '<button type="button" class="btn btn--solid btn--wide" data-action="start">' +
      (started ? txt(I.resume) : txt(I.button)) + ' →</button>';
  }

  function renderSection(i) {
    var sec = sections()[i], n = sections().length;
    var qs = sec.questions.filter(visible);
    return '<div class="section-head">' +
      '<p class="eyebrow">' + esc(t(UI.part)) + ' ' + ('0' + (i + 1)).slice(-2) + ' / ' + ('0' + n).slice(-2) + '</p>' +
      '<h2 class="title">' + rich(sec.title) + '</h2>' +
      (sec.intro ? '<p class="section-intro">' + txt(sec.intro) + '</p>' : '') +
      '</div>' +
      '<div class="questions">' + qs.map(renderQuestion).join('') + '</div>';
  }

  function renderQuestion(q) {
    var v = S.answers[q.id];
    var label = '<div class="q__label"><span class="q__num">' + esc(q.num) + '</span>' +
      '<label class="q__text" for="f_' + q.id + '">' + txt(q.label) + (q.required ? '<span class="q__req">*</span>' : '') + '</label></div>';
    var body = '';
    var hint = q.hint ? ' placeholder="' + txt(q.hint) + '"' : '';
    switch (q.type) {
      case 'long':
        body = '<textarea class="field' + (q.tall ? ' is-tall' : '') + '" id="f_' + q.id + '" data-q="' + q.id + '" rows="4" maxlength="10000"' + hint + '>' + esc(v || '') + '</textarea>';
        break;
      case 'date':
        body = '<input class="field" type="date" id="f_' + q.id + '" data-q="' + q.id + '" value="' + esc(v || '') + '">';
        break;
      case 'month':
        body = '<input class="field" type="month" id="f_' + q.id + '" data-q="' + q.id + '" value="' + esc(v || '') + '" placeholder="' + esc(t(UI.monthHint)) + '">';
        break;
      case 'url':
        body = '<input class="field" type="url" inputmode="url" autocomplete="off" id="f_' + q.id + '" data-q="' + q.id + '" value="' + esc(v || '') + '"' + hint + '>';
        break;
      case 'single':
      case 'multi':
        var multi = q.type === 'multi', arr = multi ? (Array.isArray(v) ? v : []) : [v];
        body = '<div class="chips" role="' + (multi ? 'group' : 'radiogroup') + '" aria-labelledby="f_' + q.id + '">' +
          q.options.map(function (o) {
            var on = arr.indexOf(o.value) !== -1;
            return '<button type="button" class="chip' + (on ? ' is-on' : '') + '" data-q="' + q.id + '" data-value="' + esc(o.value) + '" data-multi="' + (multi ? 1 : 0) + '" ' +
              (multi ? 'aria-pressed="' + on + '"' : 'role="radio" aria-checked="' + on + '"') + '>' + esc(t(o)) + '</button>';
          }).join('') + '</div>';
        label = label.replace('<label class="q__text" for="f_' + q.id + '"', '<span class="q__text" id="f_' + q.id + '"').replace('</label></div>', '</span></div>');
        break;
      case 'list':
        var list = Array.isArray(v) ? v : [];
        body = Array.apply(null, Array(q.count || 3)).map(function (_, idx) {
          return '<div class="list-item"><span>' + esc(t(q.itemLabel)) + ' ' + (idx + 1) + '</span>' +
            '<input class="field" type="text" maxlength="500" ' + (idx === 0 ? 'id="f_' + q.id + '" ' : '') +
            'aria-label="' + esc(t(q.itemLabel)) + ' ' + (idx + 1) + '" data-q="' + q.id + '" data-idx="' + idx + '" value="' + esc(list[idx] || '') + '"></div>';
        }).join('');
        break;
      default:
        body = '<input class="field" type="text" maxlength="500" id="f_' + q.id + '" data-q="' + q.id + '" value="' + esc(v || '') + '"' + hint + '>';
    }
    var invalid = S.invalid[q.id];
    return '<div class="q' + (invalid ? ' is-invalid' : '') + '" data-q="' + q.id + '">' + label +
      '<div class="q__body">' +
      (q.private ? '<p class="badge-private">' + lockIcon() + esc(t(UI.privateBadge)) + '</p>' : '') +
      body +
      (q.note ? '<p class="q__note">' + txt(q.note) + '</p>' : '') +
      (invalid ? '<p class="q__error">' + esc(t(UI.required)) + '</p>' : '') +
      '</div></div>';
  }

  function lockIcon() {
    return '<svg width="10" height="11" viewBox="0 0 10 11" aria-hidden="true"><rect x="1" y="5" width="8" height="6" rx="1" fill="currentColor"/><path d="M3 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>';
  }

  function displayValue(q, v) {
    if (!hasValue(v)) return null;
    if (q.type === 'single') { var o = q.options.filter(function (x) { return x.value === v; })[0]; return o ? t(o) : v; }
    if (q.type === 'multi') return q.options.filter(function (x) { return v.indexOf(x.value) !== -1; }).map(t).join(', ');
    if (q.type === 'list') return v.map(function (x, i) { return x && x.trim() ? (i + 1) + '. ' + x.trim() : ''; }).filter(Boolean).join('\n');
    if (q.type === 'date') return fmtDate(v);
    if (q.type === 'month') return fmtMonth(v);
    return String(v).trim();
  }

  function renderReview() {
    var total = 0, done = 0;
    var body = sections().map(function (sec, i) {
      var items = sec.questions.filter(visible).map(function (q) {
        total++;
        var d = displayValue(q, S.answers[q.id]);
        if (d != null) done++;
        return '<div class="review-item"><dt>' + esc(q.num) + ' · ' + txt(q.label) + '</dt>' +
          '<dd' + (d == null ? ' class="is-empty"' : '') + '>' + (d == null ? esc(t(UI.empty)) : esc(d)) + '</dd></div>';
      }).join('');
      return '<section class="review-sec"><div class="review-sec__head"><h3>' + rich(sec.title) + '</h3>' +
        '<button type="button" class="link-btn" data-action="goto" data-step="' + i + '">' + esc(t(UI.edit)) + '</button></div>' +
        '<dl>' + items + '</dl></section>';
    }).join('');
    return '<div class="section-head"><p class="eyebrow">Review</p>' +
      '<h2 class="title">' + rich(S.Q.review.title) + '</h2>' +
      '<p class="body">' + txt(S.Q.review.body) + '</p>' +
      '<p class="review-count">' + done + ' / ' + total + ' ' + esc(t(UI.answered)) + '</p></div>' +
      body +
      '<p id="submitError" class="q__error" hidden>' + esc(t(UI.sendError)) + '</p>';
  }

  function renderThanks() {
    var T = S.Q.thanks;
    return '<div class="thanks"><p class="kicker-script">' + txt(S.Q.intro.kicker) + '</p>' +
      '<h1 class="display">' + rich(T.title) + '</h1>' +
      '<div class="ornament"></div>' +
      '<p class="body">' + txt(T.body) + '</p>' +
      '<p class="signature">' + esc(T.signature) + '</p>' +
      '<button type="button" class="btn btn--outline" data-action="goto" data-step="' + reviewIndex() + '">' + txt(T.edit) + '</button></div>';
  }

  function renderNotice(kind) {
    nav.hidden = true;
    var html;
    if (kind === 'network') {
      html = '<h1 class="title">' + esc(t(UI.netTitle)) + '</h1><p class="body">' + esc(t(UI.netBody)) + '</p>' +
        '<div class="actions"><button type="button" class="btn btn--solid" onclick="location.reload()">' + esc(t(UI.retry)) + '</button></div>';
    } else {
      html = '<p class="kicker-script">Love Story</p><h1 class="title">' + esc(t(UI.badLinkTitle)) + '</h1>' +
        '<p class="body">' + esc(t(UI.badLinkBody)) + '</p>' +
        (API.demo ? '<div class="actions">' +
          '<a class="btn btn--solid" href="?k=demobride00001">' + esc(t(UI.demoBride)) + '</a>' +
          '<a class="btn btn--outline" href="?k=demogroom00001">' + esc(t(UI.demoGroom)) + '</a></div>' : '');
    }
    app.innerHTML = '<div class="screen notice">' + html + '</div>';
  }

  /* ---------------- sự kiện trong form ---------------- */
  function autoGrow(el) { el.style.height = 'auto'; el.style.height = (el.scrollHeight + 2) + 'px'; }

  app.addEventListener('input', function (e) {
    var el = e.target;
    if (!el.matches || !el.matches('.field[data-q]')) return;
    var id = el.getAttribute('data-q');
    if (el.tagName === 'TEXTAREA') autoGrow(el);
    if (el.hasAttribute('data-idx')) {
      var q = findQ(id);
      var arr = Array.isArray(S.answers[id]) ? S.answers[id].slice() : [];
      while (arr.length < (q.count || 3)) arr.push('');
      arr[+el.getAttribute('data-idx')] = el.value;
      onEdit(id, arr);
    } else {
      onEdit(id, el.value);
    }
  });

  app.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (chip) {
      var id = chip.getAttribute('data-q'), val = chip.getAttribute('data-value');
      if (chip.getAttribute('data-multi') === '1') {
        var arr = Array.isArray(S.answers[id]) ? S.answers[id].slice() : [];
        var pos = arr.indexOf(val);
        if (pos === -1) arr.push(val); else arr.splice(pos, 1);
        onEdit(id, arr);
      } else {
        onEdit(id, S.answers[id] === val ? '' : val);
      }
      var y = window.scrollY;
      render();
      window.scrollTo(0, y);
      return;
    }
    var act = e.target.closest('[data-action]');
    if (!act) return;
    var a = act.getAttribute('data-action');
    if (a === 'start') goTo(S.resumeStep > 0 && S.resumeStep <= reviewIndex() ? S.resumeStep : 0);
    if (a === 'goto') goTo(+act.getAttribute('data-step'));
  });

  function findQ(id) {
    for (var i = 0; i < S.Q.sections.length; i++) {
      for (var j = 0; j < S.Q.sections[i].questions.length; j++) {
        if (S.Q.sections[i].questions[j].id === id) return S.Q.sections[i].questions[j];
      }
    }
    return {};
  }

  /* ---------------- khởi động ---------------- */
  function init() {
    var local = S.k ? readLocal() : null;
    var urlLang = params.get('lang');
    setLang(urlLang || (local && local.lang) || 'vi', false);

    if (!S.k) { renderNotice('badlink'); return; }

    Promise.all([
      fetch('questions.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }),
      API.call({ action: 'session', k: S.k })
    ]).then(function (res) {
      S.Q = res[0];
      var sess = res[1];
      if (!sess || !sess.ok) {
        if (sess && sess.error === 'invalid_link') return renderNotice('badlink');
        throw new Error('session_failed');
      }
      S.session = sess;
      S.status = sess.status || 'new';
      S.serverUpdatedAt = sess.updatedAt || '';
      if (!urlLang && !local && sess.lang) setLang(sess.lang, false);

      var useLocal = local && local.dirty && (!sess.updatedAt || local.updatedAt >= sess.updatedAt);
      S.answers = (useLocal ? local.answers : sess.answers) || {};
      if (useLocal) S.ver = 1; // còn thay đổi chưa gửi lên → đồng bộ ngay

      // Điền sẵn từ thông tin cặp đôi
      sections().forEach(function (sec) {
        sec.questions.forEach(function (q) {
          if (q.prefill && !hasValue(S.answers[q.id])) {
            var pv = q.prefill === 'selfName' ? sess.selfName : (sess.couple || {})[q.prefill];
            if (pv) S.answers[q.id] = pv;
          }
        });
      });

      S.resumeStep = local && typeof local.step === 'number' ? Math.min(local.step, reviewIndex()) : -1;
      S.step = S.status === 'submitted' ? thanksIndex() : -1;
      render();
      if (S.ver !== S.syncedVer) sync();
    }).catch(function () { renderNotice('network'); });
  }

  init();
})();
