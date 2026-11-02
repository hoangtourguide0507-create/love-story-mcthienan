/**
 * Love Story · MC Thiên Ân — backend (Google Apps Script)
 *
 * Dán toàn bộ file này vào Apps Script gắn với Google Sheet (Tiện ích mở rộng → Apps Script).
 * Hướng dẫn chi tiết: xem SETUP.md trong repo.
 *
 * Script Properties (Cài đặt dự án → Thuộc tính tập lệnh):
 *   ADMIN_PASSWORD  (bắt buộc)  mật khẩu trang quản trị
 *   NOTIFY_EMAIL    (tuỳ chọn)  email nhận thông báo; mặc định là email chủ Sheet
 *   ADMIN_URL       (tuỳ chọn)  link trang quản trị, chèn vào email thông báo
 */

var SHEET_COUPLES = 'Couples';
var SHEET_RESPONSES = 'Responses';
var COUPLE_HEADERS = ['code', 'brideName', 'groomName', 'weddingDate', 'venue', 'note',
  'brideKey', 'groomKey', 'brideStatus', 'groomStatus', 'createdAt', 'updatedAt'];
var RESPONSE_HEADERS = ['key', 'code', 'role', 'status', 'lang', 'updatedAt', 'submittedAt', 'answersJson'];
var RETENTION_MONTHS = 6;
var MAX_ANSWER_CHARS = 10000;
var MAX_TOTAL_CHARS = 45000; // giới hạn 1 ô Google Sheet là 50.000 ký tự
var STATUS_RANK = { '': 0, 'new': 0, 'opened': 1, 'draft': 2, 'submitted': 3 };

/* ============================================================
 * Cài đặt lần đầu — chạy hàm này 1 lần trong trình soạn Apps Script
 * ============================================================ */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_COUPLES, COUPLE_HEADERS);
  ensureSheet_(ss, SHEET_RESPONSES, RESPONSE_HEADERS);
  // Cột ngày cưới để dạng chữ thuần, tránh Google Sheet tự đổi sang kiểu ngày
  ss.getSheetByName(SHEET_COUPLES).getRange('D:D').setNumberFormat('@');

  var hasTrigger = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'purgeOldCouples';
  });
  if (!hasTrigger) {
    ScriptApp.newTrigger('purgeOldCouples').timeBased().everyDays(1).atHour(3).create();
  }
  if (!getProp_('ADMIN_PASSWORD')) {
    Logger.log('⚠️ Chưa đặt ADMIN_PASSWORD trong Thuộc tính tập lệnh. Trang quản trị sẽ chưa đăng nhập được.');
  }
  Logger.log('✅ Đã cài đặt xong. Bước tiếp theo: Triển khai → Tùy chọn triển khai mới → Ứng dụng web.');
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* ============================================================
 * Web app
 * ============================================================ */
function doGet() {
  return json_({ ok: true, service: 'love-story-mcthienan' });
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = String(req.action || '');
    var publicActions = { couple: apiCouple_, session: apiSession_, save: apiSave_, submit: apiSubmit_ };
    var adminActions = {
      adminLogin: function () { return { ok: true }; },
      adminList: apiAdminList_,
      adminGet: apiAdminGet_,
      adminCreate: apiAdminCreate_,
      adminUpdate: apiAdminUpdate_,
      adminDelete: apiAdminDelete_
    };
    if (publicActions[action]) return json_(publicActions[action](req));
    if (adminActions[action]) {
      checkAdmin_(req.password);
      return json_(adminActions[action](req));
    }
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
 * API cho dâu rể
 * ============================================================ */
// Link chung của cặp đôi: trả về tên hai người để chọn "Bạn là ai?"
function apiCouple_(req) {
  var found = findByKey_(req.k);
  if (!found) return { ok: false, error: 'invalid_link' };
  var c = found.couple;
  return {
    ok: true, brideName: c.brideName, groomName: c.groomName,
    brideKey: c.brideKey, groomKey: c.groomKey, weddingDate: c.weddingDate
  };
}

function apiSession_(req) {
  var found = findByKey_(req.k);
  if (!found) return { ok: false, error: 'invalid_link' };
  var c = found.couple, role = found.role;
  var resp = findResponse_(req.k);
  var statusField = role + 'Status';
  if (!c[statusField] || c[statusField] === 'new') {
    withLock_(function () { setCoupleStatus_(found.row, role, 'opened'); });
  }
  return {
    ok: true,
    role: role,
    selfName: role === 'bride' ? c.brideName : c.groomName,
    partnerName: role === 'bride' ? c.groomName : c.brideName,
    couple: { weddingDate: c.weddingDate, venue: c.venue },
    status: resp ? resp.status : 'new',
    lang: resp ? resp.lang : '',
    updatedAt: resp ? resp.updatedAt : '',
    answers: resp ? resp.answers : {}
  };
}

function apiSave_(req) { return saveAnswers_(req, false); }
function apiSubmit_(req) { return saveAnswers_(req, true); }

function saveAnswers_(req, isSubmit) {
  var found = findByKey_(req.k);
  if (!found) return { ok: false, error: 'invalid_link' };
  var answers = sanitizeAnswers_(req.answers);
  var lang = req.lang === 'en' ? 'en' : 'vi';
  var now = new Date().toISOString();
  var result = withLock_(function () {
    var sh = sheet_(SHEET_RESPONSES);
    var existing = findResponse_(req.k);
    var status = isSubmit ? 'submitted' : (existing && existing.status === 'submitted' ? 'submitted' : 'draft');
    var submittedAt = isSubmit ? now : (existing ? existing.submittedAt : '');
    var record = {
      key: req.k, code: found.couple.code, role: found.role, status: status, lang: lang,
      updatedAt: now, submittedAt: submittedAt, answersJson: JSON.stringify(answers)
    };
    writeResponseRow_(sh, existing ? existing.row : null, record, answers);
    setCoupleStatus_(found.row, found.role, status);
    return { ok: true, status: status, updatedAt: now };
  });
  if (isSubmit) {
    try { notifySubmit_(found, answers); } catch (err) { Logger.log('Email lỗi: ' + err); }
  }
  return result;
}

function sanitizeAnswers_(raw) {
  var out = {}, total = 0;
  if (!raw || typeof raw !== 'object') return out;
  Object.keys(raw).forEach(function (id) {
    if (!/^q[0-9a-z_]{1,20}$/i.test(id)) return;
    var v = raw[id];
    if (Array.isArray(v)) {
      v = v.slice(0, 10).map(function (x) { return String(x == null ? '' : x).slice(0, MAX_ANSWER_CHARS); });
      total += v.join('').length;
    } else if (v != null) {
      v = String(v).slice(0, MAX_ANSWER_CHARS);
      total += v.length;
    } else return;
    if (total > MAX_TOTAL_CHARS) throw new Error('too_long');
    out[id] = v;
  });
  return out;
}

function writeResponseRow_(sh, rowIndex, record, answers) {
  var lastCol = Math.max(sh.getLastColumn(), RESPONSE_HEADERS.length);
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  // Thêm cột cho câu hỏi mới (mỗi câu hỏi một cột để dễ đọc trực tiếp trên Sheet)
  Object.keys(answers).sort().forEach(function (id) {
    if (headers.indexOf(id) === -1) {
      headers.push(id);
      sh.getRange(1, headers.length).setValue(id).setFontWeight('bold');
    }
  });
  var row = headers.map(function (h) {
    if (record.hasOwnProperty(h)) return safeCell_(record[h]);
    if (answers.hasOwnProperty(h)) {
      var v = answers[h];
      return safeCell_(Array.isArray(v) ? v.filter(String).join('\n') : v);
    }
    return '';
  });
  if (rowIndex) sh.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
}

// Chặn chuỗi bắt đầu bằng = + - @ để Sheet không hiểu nhầm thành công thức
function safeCell_(v) {
  var s = v == null ? '' : String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/* ============================================================
 * API trang quản trị
 * ============================================================ */
function checkAdmin_(password) {
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('adminFails') || 0);
  if (fails >= 10) throw new Error('locked');
  var expected = getProp_('ADMIN_PASSWORD');
  if (!expected) throw new Error('no_admin_password');
  if (String(password || '') !== expected) {
    cache.put('adminFails', String(fails + 1), 600);
    throw new Error('wrong_password');
  }
}

function apiAdminList_() {
  var couples = readCouples_().map(function (c) { return publicCouple_(c); });
  couples.sort(function (a, b) { return String(a.weddingDate).localeCompare(String(b.weddingDate)); });
  return { ok: true, couples: couples };
}

function apiAdminGet_(req) {
  var c = findCoupleByCode_(req.code);
  if (!c) return { ok: false, error: 'not_found' };
  var bride = findResponse_(c.brideKey), groom = findResponse_(c.groomKey);
  function pack(r) {
    return r ? { status: r.status, lang: r.lang, updatedAt: r.updatedAt, submittedAt: r.submittedAt, answers: r.answers } : null;
  }
  return { ok: true, couple: publicCouple_(c), bride: pack(bride), groom: pack(groom) };
}

function apiAdminCreate_(req) {
  var d = req.couple || {};
  var bride = clean_(d.brideName, 80), groom = clean_(d.groomName, 80);
  var date = String(d.weddingDate || '');
  if (!bride || !groom) return { ok: false, error: 'missing_names' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'invalid_date' };
  return withLock_(function () {
    var now = new Date().toISOString();
    var code = slug_(bride) + '-' + slug_(groom) + '-' + randomId_(4);
    var keys = coupleKeys_(bride, groom);
    var c = {
      code: code, brideName: bride, groomName: groom, weddingDate: date,
      venue: clean_(d.venue, 200), note: clean_(d.note, 1000),
      brideKey: keys.bride, groomKey: keys.groom,
      brideStatus: 'new', groomStatus: 'new', createdAt: now, updatedAt: now
    };
    sheet_(SHEET_COUPLES).appendRow(COUPLE_HEADERS.map(function (h) { return safeCell_(c[h]); }));
    return { ok: true, couple: publicCouple_(c) };
  });
}

function apiAdminUpdate_(req) {
  var d = req.couple || {};
  return withLock_(function () {
    var c = findCoupleByCode_(req.code);
    if (!c) return { ok: false, error: 'not_found' };
    if (d.brideName != null) c.brideName = clean_(d.brideName, 80) || c.brideName;
    if (d.groomName != null) c.groomName = clean_(d.groomName, 80) || c.groomName;
    if (d.weddingDate != null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.weddingDate))) return { ok: false, error: 'invalid_date' };
      c.weddingDate = String(d.weddingDate);
    }
    if (d.venue != null) c.venue = clean_(d.venue, 200);
    if (d.note != null) c.note = clean_(d.note, 1000);
    c.updatedAt = new Date().toISOString();
    sheet_(SHEET_COUPLES).getRange(c.row, 1, 1, COUPLE_HEADERS.length)
      .setValues([COUPLE_HEADERS.map(function (h) { return safeCell_(c[h]); })]);
    return { ok: true, couple: publicCouple_(c) };
  });
}

function apiAdminDelete_(req) {
  return withLock_(function () {
    var c = findCoupleByCode_(req.code);
    if (!c) return { ok: false, error: 'not_found' };
    deleteCouple_(c);
    return { ok: true };
  });
}

function publicCouple_(c) {
  var out = {};
  COUPLE_HEADERS.forEach(function (h) { out[h] = c[h]; });
  out.purgeDate = purgeDate_(c.weddingDate);
  return out;
}

/* ============================================================
 * Xoá dữ liệu sau 6 tháng kể từ ngày cưới (chạy tự động mỗi ngày)
 * ============================================================ */
function purgeOldCouples() {
  var today = Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd');
  withLock_(function () {
    readCouples_().reverse().forEach(function (c) {
      var p = purgeDate_(c.weddingDate);
      if (p && p <= today) deleteCouple_(c);
    });
  });
}

function purgeDate_(weddingDate) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(weddingDate || ''));
  if (!m) return '';
  var d = new Date(Date.UTC(+m[1], +m[2] - 1 + RETENTION_MONTHS, +m[3]));
  return d.toISOString().slice(0, 10);
}

function deleteCouple_(c) {
  var rsh = sheet_(SHEET_RESPONSES);
  if (rsh.getLastRow() > 1) {
    var codes = rsh.getRange(2, 2, rsh.getLastRow() - 1, 1).getValues();
    for (var i = codes.length - 1; i >= 0; i--) {
      if (String(codes[i][0]) === c.code) rsh.deleteRow(i + 2);
    }
  }
  sheet_(SHEET_COUPLES).deleteRow(c.row);
}

/* ============================================================
 * Email thông báo
 * ============================================================ */
function notifySubmit_(found, answers) {
  var to = getProp_('NOTIFY_EMAIL') || Session.getEffectiveUser().getEmail();
  if (!to) return;
  var c = found.couple;
  var who = found.role === 'bride' ? 'Cô dâu ' + c.brideName : 'Chú rể ' + c.groomName;
  var other = found.role === 'bride' ? c.groomStatus : c.brideStatus;
  var count = Object.keys(answers).filter(function (k) {
    var v = answers[k];
    return Array.isArray(v) ? v.some(function (x) { return String(x).trim(); }) : String(v).trim();
  }).length;
  var adminUrl = getProp_('ADMIN_URL');
  var subject = '💌 ' + who + ' đã gửi Love Story (' + c.brideName + ' & ' + c.groomName + ')';
  var html =
    '<div style="font-family:Georgia,serif;color:#111110;line-height:1.6">' +
    '<p><b>' + esc_(who) + '</b> vừa gửi câu trả lời Love Story.</p>' +
    '<p>Cặp đôi: ' + esc_(c.brideName) + ' &amp; ' + esc_(c.groomName) + '<br>' +
    'Ngày cưới: ' + esc_(c.weddingDate) + '<br>' +
    'Số câu đã trả lời: ' + count + '<br>' +
    'Người còn lại: ' + (other === 'submitted' ? 'đã gửi ✅' : 'chưa gửi') + '</p>' +
    (adminUrl ? '<p><a href="' + esc_(adminUrl) + '" style="color:#b5794a">Mở trang quản trị</a></p>' : '') +
    '</div>';
  MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, name: 'Love Story · Thiên Ân' });
}

/* ============================================================
 * Đọc / ghi Sheet
 * ============================================================ */
function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('missing_sheet_' + name + ' (hãy chạy hàm setup)');
  return sh;
}

function readCouples_() {
  var sh = sheet_(SHEET_COUPLES);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, COUPLE_HEADERS.length).getValues();
  return values.map(function (r, i) {
    var c = { row: i + 2 };
    COUPLE_HEADERS.forEach(function (h, j) {
      var v = r[j];
      if (v instanceof Date) v = Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
      c[h] = v == null ? '' : String(v).replace(/^'/, '');
    });
    return c;
  }).filter(function (c) { return c.code; });
}

function findByKey_(k) {
  k = String(k || '').toLowerCase();
  return lookupKey_(k);
}

function lookupKey_(k) {
  if (!/^[a-z0-9-]{2,60}$/.test(k)) return null;
  var couples = readCouples_();
  for (var i = 0; i < couples.length; i++) {
    if (couples[i].brideKey === k) return { couple: couples[i], role: 'bride', row: couples[i].row };
    if (couples[i].groomKey === k) return { couple: couples[i], role: 'groom', row: couples[i].row };
  }
  return null;
}

function findCoupleByCode_(code) {
  code = String(code || '');
  var couples = readCouples_();
  for (var i = 0; i < couples.length; i++) if (couples[i].code === code) return couples[i];
  return null;
}

function findResponse_(k) {
  var sh = sheet_(SHEET_RESPONSES);
  var last = sh.getLastRow();
  if (last < 2 || !k) return null;
  var values = sh.getRange(2, 1, last - 1, RESPONSE_HEADERS.length).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(k)) {
      var r = {};
      RESPONSE_HEADERS.forEach(function (h, j) { r[h] = values[i][j] == null ? '' : String(values[i][j]); });
      try { r.answers = JSON.parse(r.answersJson || '{}'); } catch (e) { r.answers = {}; }
      r.row = i + 2;
      return r;
    }
  }
  return null;
}

function setCoupleStatus_(row, role, status) {
  var col = COUPLE_HEADERS.indexOf(role + 'Status') + 1;
  var cell = sheet_(SHEET_COUPLES).getRange(row, col);
  var current = String(cell.getValue() || '');
  if ((STATUS_RANK[status] || 0) >= (STATUS_RANK[current] || 0)) cell.setValue(status);
}

/* ============================================================
 * Tiện ích
 * ============================================================ */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function getProp_(name) { return PropertiesService.getScriptProperties().getProperty(name) || ''; }
function tz_() { return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || 'Asia/Ho_Chi_Minh'; }
function clean_(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max); }

function slug_(s) {
  var t = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12);
  return t || 'x';
}

// Link riêng của từng người = tên mình + tên nửa kia, viết không dấu.
// Ví dụ cô dâu Ân, chú rể Hoàng → "an-hoang" (của Ân) và "hoang-an" (của Hoàng).
// Trùng với cặp đã có thì thêm số: "an-hoang-2".
function nameSlug_(name) {
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24).replace(/-+$/, '') || 'ban';
}

function coupleKeys_(bride, groom) {
  var used = {};
  readCouples_().forEach(function (c) { used[c.brideKey] = 1; used[c.groomKey] = 1; });
  used.admin = 1;
  var b = nameSlug_(bride), g = nameSlug_(groom);
  for (var n = 1; n < 1000; n++) {
    var suffix = n === 1 ? '' : '-' + n;
    var kb = b + '-' + g + suffix, kg = g + '-' + b + suffix;
    if (kb === kg) kg = kg + '-2';
    if (!used[kb] && !used[kg]) return { bride: kb, groom: kg };
  }
  throw new Error('too_many_duplicates');
}

function randomId_(len) {
  var chars = 'abcdefghijkmnpqrstuvwxyz23456789', out = '';
  while (out.length < len) {
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random());
    for (var i = 0; i < bytes.length && out.length < len; i++) {
      var b = bytes[i] & 0xff;
      if (b < chars.length * 8) out += chars[b % chars.length];
    }
  }
  return out;
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}
