/* Dar Sabbah family site. Data is decrypted in the browser with the family password. */
(function () {
  'use strict';
  var P = {}, ROOTS = [], BUILT = '', INTRO = {};
  var LANG = 'ar';
  var KEY_PW = 'ds-pw', KEY_LANG = 'ds-lang', KEY_OPEN = 'ds-open';
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  var T = {
    ar: {
      brand: 'دار صبّاح', home: 'الرئيسية', tree: 'الشجرة', search: 'ابحث عن اسم…', lang: 'Latin',
      logout: 'خروج', son: 'ابن', dau: 'بنت', born: 'الولادة', died: 'الوفاة', lived: 'السكن',
      oval: 'رقم على اللوحة', surname: 'اسم العائلة', gen: 'الجيل', father: 'الأب', siblings: 'الإخوة والأخوات',
      children: 'الأولاد', notes: 'ملاحظات', none: 'لا يوجد', desc: 'ذرية', chart: 'مخطط الذرية',
      showTree: 'في الشجرة', expand: 'افتح الكل', collapse: 'أغلق الكل', people: 'شخص', gens: 'جيل',
      noRes: 'لا توجد نتائج',
      start: 'ابدأ من الجد الأعلى', find: 'ابحث عن نفسك أو عن أحد أقاربك في خانة البحث في الأعلى.',
      built: 'آخر تحديث', private: 'موقع خاص بالعائلة. الرجاء عدم نشر كلمة السر.',
      upTo: 'السلسلة إلى الأعلى', ancestors: 'الأجداد', wrong: 'كلمة السر غير صحيحة', needHttps: 'افتح الموقع عبر https',
      father1: 'والد', chartOf: 'ذرية', back: 'عودة إلى الصفحة', children2: 'أولاد'
    },
    la: {
      brand: 'Dar Sabbah', home: 'Home', tree: 'Tree', search: 'Search a name…', lang: 'عربي',
      logout: 'Log out', son: 'son of', dau: 'daughter of', born: 'Born', died: 'Died', lived: 'Lived',
      oval: 'Board oval', surname: 'Surname', gen: 'Generation', father: 'Father', siblings: 'Brothers and sisters',
      children: 'Children', notes: 'Notes', none: 'None recorded', desc: 'descendants', chart: 'Descendants chart',
      showTree: 'Show in tree', expand: 'Open all', collapse: 'Close all', people: 'people', gens: 'generations',
      noRes: 'No matches',
      start: 'Start at the earliest ancestor', find: 'Find yourself or a relative with the search box at the top.',
      built: 'Last updated', private: 'Private family site. Please do not share the password outside the family.',
      upTo: 'Line upwards', ancestors: 'Ancestors', wrong: 'Wrong password', needHttps: 'Open the site over https',
      father1: 'Father of', chartOf: 'Descendants of', back: 'Back to the page', children2: 'children'
    }
  };
  function t(k) { return T[LANG][k]; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  function $(id) { return document.getElementById(id); }

  /* ---------- decrypt ---------- */
  function b64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function decrypt(pw) {
    var D = window.DS_DATA, enc = new TextEncoder();
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error('https'));
    return crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return crypto.subtle.deriveKey({name: 'PBKDF2', salt: b64(D.salt), iterations: D.iter, hash: 'SHA-256'},
          base, {name: 'AES-GCM', length: 256}, false, ['decrypt']);
      })
      .then(function (key) { return crypto.subtle.decrypt({name: 'AES-GCM', iv: b64(D.iv)}, key, b64(D.ct)); })
      .then(function (buf) { return JSON.parse(new TextDecoder().decode(buf)); });
  }

  /* ---------- model ---------- */
  var DESC = {}, GEN = {}, ORDER = [], SEARCH = [];
  function prep(data) {
    P = data.people; ROOTS = data.roots; BUILT = data.built; INTRO = data.intro || {};
    Object.keys(P).forEach(function (id) { P[id].id = id; P[id].c = P[id].c || []; });
    function walk(id, g) {
      GEN[id] = g; ORDER.push(id);
      var n = 0;
      P[id].c.forEach(function (k) { if (P[k]) n += 1 + walk(k, g + 1); });
      DESC[id] = n; return n;
    }
    ROOTS.forEach(function (r) { walk(r, 1); });
  }
  function nm(p, lang) {
    lang = lang || LANG;
    return lang === 'ar' ? (p.ar || p.la) : (p.la || p.ar);
  }
  function akaList(p) { var a = LANG === 'ar' ? p.akaAr : p.akaLa; return a || []; }
  function label(p) {
    var a = akaList(p);
    return esc(nm(p)) + (a.length ? ' <span class="aka">(' + esc(a.join(LANG === 'ar' ? '، ' : ', ')) + ')</span>' : '');
  }
  function plain(p) { var a = akaList(p); return nm(p) + (a.length ? ' (' + a.join(LANG === 'ar' ? '، ' : ', ') + ')' : ''); }
  function line(id) { var out = [], p = P[id]; while (p) { out.push(p); p = p.f ? P[p.f] : null; } return out; }
  function nasab(p, depth) {
    var chain = line(p.id).slice(1, 1 + (depth || 3));
    if (!chain.length) return '';
    if (LANG === 'ar') {
      return (p.s === 'F' ? 'بنت ' : 'بن ') + chain.map(function (q) { return nm(q); }).join(' بن ');
    }
    return (p.s === 'F' ? 'daughter of ' : 'son of ') + chain.map(function (q) { return nm(q); }).join(' son of ');
  }
  function link(id, extra) { var p = P[id]; return '<a href="#/p/' + id + '"' + (p.s === 'F' ? ' class="sexF"' : '') + '>' + label(p) + '</a>' + (extra || ''); }

  /* ---------- search ---------- */
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[ً-ْٰـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/['’‘ʿʾ`\-]/g, '').replace(/\bal\s?/g, 'al').replace(/\s+/g, ' ').trim();
  }
  function buildSearch() {
    SEARCH = ORDER.map(function (id) {
      var p = P[id], chainAr = line(id).map(function (q) { return [q.ar].concat(q.akaAr || []).join(' '); }),
        chainLa = line(id).map(function (q) { return [q.la].concat(q.akaLa || []).join(' '); });
      return {id: id, own: norm([p.ar, p.la, p.surAr, p.surLa].concat(p.akaAr || [], p.akaLa || []).join(' ')),
        chainAr: chainAr.map(norm), chainLa: chainLa.map(norm), oval: p.o ? String(p.o) : ''};
    });
  }
  function has(field, w) { return (' ' + field).indexOf(' ' + w) >= 0; }
  function search(q) {
    var words = norm(q).split(' ').filter(Boolean);
    if (!words.length) return [];
    var res = [];
    SEARCH.forEach(function (s) {
      if (/^\d+$/.test(q.trim())) { if (s.oval === q.trim()) res.push({id: s.id, sc: 0}); return; }
      // first word must match the person, the rest walk up the line (name, father, grandfather...)
      var best = null;
      [s.chainAr, s.chainLa].forEach(function (ch) {
        if (!(has(ch[0], words[0]) || has(s.own, words[0]))) return;
        var pos = 0, ok = true;
        for (var i = 1; i < words.length; i++) {
          var found = -1;
          for (var j = pos + 1; j < ch.length; j++) if (has(ch[j], words[i])) { found = j; break; }
          if (found < 0) { if (has(s.own, words[i])) continue; ok = false; break; }
          pos = found;
        }
        if (ok) { var sc = (ch[0].split(' ')[0] === words[0] ? 0 : 1) + pos; if (best === null || sc < best) best = sc; }
      });
      if (best !== null) res.push({id: s.id, sc: best});
    });
    res.sort(function (a, b) { return a.sc - b.sc || GEN[a.id] - GEN[b.id]; });
    return res.slice(0, 40).map(function (r) { return r.id; });
  }
  var selIdx = -1;
  function showResults() {
    var q = $('q').value, box = $('results');
    if (!q.trim()) { box.hidden = true; return; }
    var ids = search(q);
    selIdx = -1;
    box.innerHTML = ids.length ? ids.map(function (id) {
      var p = P[id];
      return '<a href="#/p/' + id + '">' + label(p) + '<small>' + esc(nasab(p, 3)) + (p.o ? ' · ' + t('oval') + ' ' + p.o : '') + '</small></a>';
    }).join('') : '<div style="padding:10px 12px" class="muted">' + t('noRes') + '</div>';
    box.hidden = false;
  }

  /* ---------- views ---------- */
  function setNav(k) {
    document.querySelectorAll('.top nav a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-k') === k); });
  }
  function fmtEvent(e) {
    if (!e) return '';
    return [e.DATE, e.PLAC].filter(Boolean).map(esc).join(', ') + (e.CAUS ? ' (' + esc(e.CAUS) + ')' : '') + (e.NOTE ? '<br><span class="muted">' + esc(e.NOTE) + '</span>' : '');
  }
  function viewHome() {
    setNav('home');
    var maxG = 0; Object.keys(GEN).forEach(function (k) { if (GEN[k] > maxG) maxG = GEN[k]; });
    var root = ROOTS[0];
    $('main').className = 'home';
    $('main').innerHTML = '<div class="card"><h1>' + t('brand') + '</h1><p>' + esc(INTRO[LANG] || '') + '</p>' +
      '<div class="stats"><div class="stat"><b>' + Object.keys(P).length + '</b>' + t('people') + '</div><div class="stat"><b>' + maxG + '</b>' + t('gens') + '</div></div>' +
      '<p>' + t('find') + '</p><div class="actions">' + ROOTS.map(function (r) { return '<a class="btn" href="#/p/' + r + '">' + t('start') + ': ' + esc(nm(P[r])) + '</a>'; }).join('') +
      '<a class="btn" href="#/tree">' + t('tree') + '</a><a class="btn" href="#/chart/' + root + '">' + t('chart') + '</a></div></div>';
  }
  function viewPerson(id) {
    var p = P[id]; if (!p) return viewHome();
    setNav('');
    var chain = line(id).reverse();
    var crumbs = chain.map(function (q) { return q.id === id ? '<b>' + esc(nm(q)) + '</b>' : '<a href="#/p/' + q.id + '">' + esc(nm(q)) + '</a>'; })
      .join('<span class="sep">' + (LANG === 'ar' ? '‹' : '›') + '</span>');
    var f = p.f ? P[p.f] : null;
    var sibs = f ? f.c.filter(function (k) { return k !== id && P[k]; }) : [];
    var facts = [];
    if (p.b) facts.push([t('born'), fmtEvent(p.b)]);
    if (p.d) facts.push([t('died'), fmtEvent(p.d) || '&#10013;']);
    (p.r || []).forEach(function (r) { facts.push([t('lived'), fmtEvent(r)]); });
    var sur = LANG === 'ar' ? p.surAr : p.surLa; if (sur) facts.push([t('surname'), esc(sur)]);
    facts.push([t('gen'), GEN[id]]);
    if (p.o) facts.push([t('oval'), p.o]);
    var pre = LANG === 'ar' ? p.preAr : p.preLa;
    function li(k) { return '<li>' + link(k) + (DESC[k] ? '<span class="count">' + DESC[k] + ' ' + t('desc') + '</span>' : '') + '</li>'; }
    $('main').className = '';
    $('main').innerHTML =
      '<div class="crumbs">' + crumbs + '</div>' +
      '<div class="card"><h1 class="pname' + (p.s === 'F' ? ' sexF' : '') + '">' + (pre ? '<span class="pre">' + esc(pre) + '</span>' : '') + label(p) + '</h1>' +
      (p.f ? '<p class="nasab">' + esc(nasab(p, 4)) + '</p>' : '') +
      '<dl class="facts">' + facts.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>'; }).join('') + '</dl>' +
      '<div class="actions">' + (DESC[id] ? '<a class="btn" href="#/chart/' + id + '">' + t('chart') + '</a>' : '') +
      '<a class="btn" href="#/tree/' + id + '">' + t('showTree') + '</a></div></div>' +
      '<div class="grid2"><div class="card"><h2>' + t('children') + ' (' + p.c.length + ')</h2>' +
      (p.c.length ? '<ul class="plist">' + p.c.filter(function (k) { return P[k]; }).map(li).join('') + '</ul>' : '<p class="muted">' + t('none') + '</p>') + '</div>' +
      '<div class="card"><h2>' + t('father') + '</h2>' + (f ? '<ul class="plist">' + li(f.id) + '</ul>' : '<p class="muted">' + t('none') + '</p>') +
      '<h2 style="margin-top:16px">' + t('siblings') + ' (' + sibs.length + ')</h2>' +
      (sibs.length ? '<ul class="plist">' + sibs.map(li).join('') + '</ul>' : '<p class="muted">' + t('none') + '</p>') + '</div></div>' +
      (p.n ? '<div class="card notes"><h2>' + t('notes') + '</h2>' + p.n.map(function (n) { return '<p dir="auto">' + esc(n) + '</p>'; }).join('') + '</div>' : '');
    document.title = plain(p) + ' · ' + t('brand');
  }

  /* outline tree */
  var OPEN = {};
  try { OPEN = JSON.parse(store.get(KEY_OPEN) || '{}') || {}; } catch (e) { OPEN = {}; }
  function saveOpen() { store.set(KEY_OPEN, JSON.stringify(OPEN)); }
  function viewTree(focus) {
    setNav('tree');
    if (focus && P[focus]) line(focus).slice(1).forEach(function (q) { OPEN[q.id] = 1; });
    else if (!Object.keys(OPEN).length) { ROOTS.forEach(function (r) { OPEN[r] = 1; }); var r0 = P[ROOTS[0]]; r0.c.forEach(function (k) { OPEN[k] = 1; }); }
    saveOpen();
    function node(id) {
      var p = P[id], kids = p.c.filter(function (k) { return P[k]; }), open = OPEN[id];
      return '<li data-id="' + id + '"><div class="row' + (id === focus ? ' cur' : '') + '" id="t-' + id + '">' +
        (kids.length ? '<button class="tog" data-t="' + id + '" aria-expanded="' + (open ? 'true' : 'false') + '">' + (open ? '−' : '+') + '</button>' : '<span class="leaf">•</span>') +
        link(id) + (DESC[id] ? ' <span class="count">' + DESC[id] + '</span>' : '') + '</div>' +
        (kids.length && open ? '<ul>' + kids.map(node).join('') + '</ul>' : '') + '</li>';
    }
    $('main').className = '';
    $('main').innerHTML = '<div class="toolbar"><button class="btn" id="openall" type="button">' + t('expand') + '</button><button class="btn" id="closeall" type="button">' + t('collapse') + '</button></div>' +
      '<div class="card tree"><ul>' + ROOTS.map(node).join('') + '</ul></div>';
    $('openall').onclick = function () { ORDER.forEach(function (k) { OPEN[k] = 1; }); saveOpen(); viewTree(focus); };
    $('closeall').onclick = function () { OPEN = {}; ROOTS.forEach(function (r) { OPEN[r] = 1; }); saveOpen(); viewTree(); };
    document.querySelectorAll('.tog').forEach(function (b) {
      b.onclick = function () { var k = b.getAttribute('data-t'); if (OPEN[k]) delete OPEN[k]; else OPEN[k] = 1; saveOpen(); var y = window.scrollY; viewTree(focus); window.scrollTo(0, y); };
    });
    if (focus && $('t-' + focus)) $('t-' + focus).scrollIntoView({block: 'center'});
    document.title = t('tree') + ' · ' + t('brand');
  }

  /* descendants chart (SVG, generations run across the page) */
  var meas = null;
  function textW(s) {
    if (!meas) meas = document.createElement('canvas').getContext('2d');
    meas.font = '14px ' + (LANG === 'ar' ? '"Noto Naskh Arabic", serif' : '"Source Serif 4", serif');
    return meas.measureText(s).width;
  }
  function viewChart(id) {
    var p = P[id]; if (!p) return viewHome();
    setNav('');
    var nodes = [], maxD = 0, leaf = 0, colW = [];
    function lay(k, d) {
      var q = P[k], kids = q.c.filter(function (c) { return P[c]; }), n = {id: k, d: d, kids: []};
      var w = textW(plain(q)) + 22; colW[d] = Math.max(colW[d] || 0, Math.min(w, 260));
      if (d > maxD) maxD = d;
      nodes.push(n);
      if (!kids.length) { n.y = leaf++; }
      else { n.kids = kids.map(function (c) { return lay(c, d + 1); }); n.y = (n.kids[0].y + n.kids[n.kids.length - 1].y) / 2; }
      return n;
    }
    lay(id, 0);
    var gap = 46, rowH = 30, bh = 24, pad = 16, xs = [pad];
    for (var i = 1; i <= maxD + 1; i++) xs[i] = xs[i - 1] + colW[i - 1] + gap;
    var W = xs[maxD] + colW[maxD] + pad, H = leaf * rowH + pad * 2;
    var rtl = LANG === 'ar';
    function X(n) { return rtl ? W - xs[n.d] - colW[n.d] : xs[n.d]; }
    function Y(n) { return pad + n.y * rowH + rowH / 2; }
    var paths = '', boxes = '';
    nodes.forEach(function (n) {
      var q = P[n.id], x = X(n), y = Y(n), w = colW[n.d];
      var s = plain(q); while (textW(s) + 22 > 260 && s.length > 4) s = s.slice(0, -2);
      if (s !== plain(q)) s = s.replace(/.$/, '…');
      boxes += '<a href="#/p/' + n.id + '" class="node ' + (q.s === 'F' ? 'F' : '') + (n.id === id ? ' cur' : '') + '"><rect x="' + x + '" y="' + (y - bh / 2) + '" width="' + w + '" height="' + bh + '" rx="6"/>' +
        '<text x="' + (rtl ? x + w - 10 : x + 10) + '" y="' + (y + 5) + '" text-anchor="' + (rtl ? 'end' : 'start') + '">' + esc(s) + '</text><title>' + esc(plain(q) + (q.f ? ' ' + nasab(q, 2) : '')) + '</title></a>';
      n.kids.forEach(function (c) {
        var x1 = rtl ? x : x + w, x2 = rtl ? X(c) + colW[c.d] : X(c), mx = (x1 + x2) / 2;
        paths += '<path d="M' + x1 + ' ' + y + 'H' + mx + 'V' + Y(c) + 'H' + x2 + '"/>';
      });
    });
    var up = p.f ? '<a class="btn" href="#/chart/' + p.f + '">' + (LANG === 'ar' ? '→ ' : '← ') + esc(nm(P[p.f])) + '</a>' : '';
    $('main').className = 'wide';
    $('main').innerHTML = '<div class="toolbar">' + up + '<a class="btn" href="#/p/' + id + '">' + t('back') + '</a>' +
      '<span class="muted" style="align-self:center">' + t('chartOf') + ' ' + esc(plain(p)) + ': ' + DESC[id] + '</span></div>' +
      '<div class="chartwrap" id="cw"><svg style="direction:ltr" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">' + paths + boxes + '</svg></div>';
    var cw = $('cw'), r0 = nodes[0];
    cw.scrollTop = Math.max(0, Y(r0) - cw.clientHeight / 2);
    if (rtl) cw.scrollLeft = cw.scrollWidth;
    document.title = t('chart') + ': ' + plain(p) + ' · ' + t('brand');
  }

  /* ---------- router & chrome ---------- */
  function applyLang() {
    document.documentElement.lang = LANG === 'ar' ? 'ar' : 'en';
    document.documentElement.dir = LANG === 'ar' ? 'rtl' : 'ltr';
    $('brand').textContent = t('brand');
    $('navhome').textContent = t('home');
    $('navtree').textContent = t('tree');
    $('q').placeholder = t('search');
    $('lang').textContent = t('lang');
    $('logout').textContent = t('logout');
    $('foot').textContent = t('private') + ' ' + t('built') + ': ' + BUILT;
  }
  function route() {
    $('results').hidden = true;
    var h = location.hash.replace(/^#\/?/, '').split('/');
    if (h[0] === 'p' && h[1]) viewPerson(h[1]);
    else if (h[0] === 'tree') viewTree(h[1]);
    else if (h[0] === 'chart' && h[1]) viewChart(h[1]);
    else { viewHome(); document.title = t('brand'); }
    if (h[0] !== 'tree') window.scrollTo(0, 0);
  }
  function start(data) {
    prep(data); buildSearch();
    LANG = store.get(KEY_LANG) || 'ar';
    $('lock').hidden = true; $('lock').style.display = 'none'; $('app').hidden = false;
    applyLang(); route();
    window.addEventListener('hashchange', route);
    $('lang').onclick = function () { LANG = LANG === 'ar' ? 'la' : 'ar'; store.set(KEY_LANG, LANG); applyLang(); route(); showResults(); $('results').hidden = true; };
    $('logout').onclick = function () { store.del(KEY_PW); location.hash = ''; location.reload(); };
    var q = $('q');
    q.addEventListener('input', showResults);
    q.addEventListener('focus', showResults);
    q.addEventListener('keydown', function (e) {
      var as = $('results').querySelectorAll('a');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); if (!as.length) return;
        selIdx = (selIdx + (e.key === 'ArrowDown' ? 1 : -1) + as.length) % as.length;
        as.forEach(function (a, i) { a.classList.toggle('sel', i === selIdx); });
      } else if (e.key === 'Enter') {
        var a = as[selIdx >= 0 ? selIdx : 0]; if (a) { location.hash = a.getAttribute('href'); q.blur(); }
      } else if (e.key === 'Escape') { $('results').hidden = true; q.blur(); }
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.searchwrap')) $('results').hidden = true;
      else if (e.target.closest('.results a')) { $('results').hidden = true; q.value = ''; }
    });
  }
  function tryOpen(pw, remember, quiet) {
    return decrypt(pw).then(function (data) {
      if (remember) store.set(KEY_PW, pw);
      start(data);
    }, function (err) {
      if (quiet) { store.del(KEY_PW); return; }
      $('lockerr').textContent = err && err.message === 'https' ? 'Open the site over https · افتح الموقع عبر https' : 'Wrong password · كلمة السر غير صحيحة';
    });
  }
  $('lockform').addEventListener('submit', function (e) {
    e.preventDefault(); $('lockerr').textContent = '';
    tryOpen($('pw').value, $('remember').checked, false);
  });
  var saved = store.get(KEY_PW);
  if (saved) tryOpen(saved, true, true); else $('pw').focus();
})();
