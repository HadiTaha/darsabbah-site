/* Writing area: Hadi writes posts in the browser. The post is encrypted on the device with the
   family key and committed to GitHub (dyn/ folder) with his own fine-grained token. */
(function () {
  'use strict';
  var REPO = 'HadiTaha/darsabbah-site', BRANCH = 'main', TOKEN_KEY = 'ds-gh-token';
  var API = 'https://api.github.com/repos/' + REPO + '/contents/';
  var T = {
    ar: {title: 'كتابة مقال', setup: 'إعداد لمرة واحدة', setupText: 'لكي تنشر من هذا الجهاز، الصق مفتاح GitHub الخاص بك (Fine-grained token لمستودع darsabbah-site فقط، مع صلاحية Contents: Read and write). يُحفظ المفتاح على هذا الجهاز فقط.',
      token: 'مفتاح GitHub', saveToken: 'حفظ المفتاح', checking: 'جارٍ التحقق…', tokenOk: 'المفتاح يعمل.', tokenBad: 'المفتاح لا يعمل. تحقّق منه ومن صلاحياته.',
      tAr: 'العنوان بالعربية', tEn: 'العنوان بالإنجليزية', date: 'التاريخ', bAr: 'النص بالعربية', bEn: 'النص بالإنجليزية', photos: 'صور', addPhotos: 'إضافة صور',
      fmt: 'تنسيق: سطر فارغ = فقرة جديدة، **نص** = عريض، - في بداية السطر = قائمة، ## = عنوان فرعي.',
      publish: 'نشر', saving: 'جارٍ الحفظ والتشفير…', done: 'تم النشر. يظهر للجميع خلال دقيقة أو دقيقتين.', fail: 'لم ينجح النشر: ', need: 'اكتب عنوانًا ونصًا بلغة واحدة على الأقل.',
      forget: 'إزالة المفتاح من هذا الجهاز', confirmDel: 'حذف هذا المقال؟', deleted: 'تم الحذف.', view: 'عرض المقال', preview: 'معاينة'},
    la: {title: 'Write a post', setup: 'One-time setup', setupText: 'To publish from this device, paste your GitHub key (a fine-grained token for the darsabbah-site repository only, with Contents: Read and write). It is stored on this device only.',
      token: 'GitHub key', saveToken: 'Save key', checking: 'Checking…', tokenOk: 'The key works.', tokenBad: 'The key does not work. Check it and its permissions.',
      tAr: 'Title in Arabic', tEn: 'Title in English', date: 'Date', bAr: 'Text in Arabic', bEn: 'Text in English', photos: 'Photos', addPhotos: 'Add photos',
      fmt: 'Formatting: empty line = new paragraph, **text** = bold, - at line start = list, ## = subheading.',
      publish: 'Publish', saving: 'Encrypting and saving…', done: 'Published. Everyone sees it within a minute or two.', fail: 'Publishing failed: ', need: 'Write a title and a text in at least one language.',
      forget: 'Remove the key from this device', confirmDel: 'Delete this post?', deleted: 'Deleted.', view: 'View the post', preview: 'Preview'}
  };
  function tt(k) { return T[DS.LANG === 'ar' ? 'ar' : 'la'][k]; }
  function token() { return DS.store.get(TOKEN_KEY); }
  function $(id) { return document.getElementById(id); }
  function u8b64(u8) { var s = '', CH = 0x8000; for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s); }

  function gh(method, path, body) {
    return fetch(API + path + (method === 'GET' ? '?ref=' + BRANCH + '&t=' + Date.now() : ''), {
      method: method,
      headers: {'Authorization': 'Bearer ' + token(), 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'},
      body: body ? JSON.stringify(body) : undefined, cache: 'no-store'
    }).then(function (r) {
      if (r.status === 404 && method === 'GET') return null;
      if (!r.ok) return r.text().then(function (t) { throw new Error(r.status + ' ' + t.slice(0, 160)); });
      return r.json();
    });
  }
  function put(path, b64content, msg) {
    return gh('GET', path).then(function (cur) {
      return gh('PUT', path, {message: msg, content: b64content, branch: BRANCH, sha: cur ? cur.sha : undefined});
    });
  }
  function enc(bytes) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({name: 'AES-GCM', iv: iv}, DS.KEY, bytes).then(function (ct) { return {iv: u8b64(iv), ct: new Uint8Array(ct)}; });
  }
  function encJSON(obj) { return enc(new TextEncoder().encode(JSON.stringify(obj))); }
  function readIndex() {
    return gh('GET', 'dyn/index.json').then(function (f) {
      if (!f) return {list: [], sha: null};
      var o = JSON.parse(decodeURIComponent(escape(atob(f.content.replace(/\n/g, '')))));
      return crypto.subtle.decrypt({name: 'AES-GCM', iv: DS.b64(o.iv)}, DS.KEY, DS.b64(o.ct))
        .then(function (buf) { return {list: JSON.parse(new TextDecoder().decode(buf)), sha: f.sha}; });
    });
  }
  function writeIndex(list, msg) {
    return encJSON(list).then(function (e) {
      var o = {iv: e.iv, ct: u8b64(e.ct)};
      return put('dyn/index.json', btoa(unescape(encodeURIComponent(JSON.stringify(o)))), msg);
    }).then(function () {
      DS.DYN = list.map(function (p) { p.dyn = true; return p; });
    });
  }
  function resize(file) {
    return createImageBitmap(file).then(function (bmp) {
      var max = 1800, s = Math.min(1, max / Math.max(bmp.width, bmp.height));
      var c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.85); });
    }).then(function (blob) { return blob.arrayBuffer(); }).then(function (b) { return new Uint8Array(b); });
  }

  function viewSetup(next) {
    var m = $('main'); m.className = '';
    m.innerHTML = '<h1 class="pagetitle">' + tt('title') + '</h1><div class="card wform"><h2>' + tt('setup') + '</h2><p class="note">' + tt('setupText') + '</p>' +
      '<label for="w-token">' + tt('token') + '</label><input id="w-token" type="password" dir="ltr" autocomplete="off" placeholder="github_pat_…">' +
      '<div class="actions"><button class="btn primary" id="w-save" type="button">' + tt('saveToken') + '</button></div><p class="wstatus" id="w-st"></p></div>';
    $('w-save').onclick = function () {
      var v = $('w-token').value.trim(); if (!v) return;
      DS.store.set(TOKEN_KEY, v); $('w-st').textContent = tt('checking');
      gh('GET', 'CNAME').then(function (f) {
        if (!f) throw new Error('no access');
        $('w-st').textContent = tt('tokenOk'); setTimeout(next, 600);
      }).catch(function () { DS.store.del(TOKEN_KEY); $('w-st').textContent = tt('tokenBad'); });
    };
  }

  function viewEditor(args) {
    DS.setNav('posts');
    document.body.classList.remove('fullbleed');
    if (!token()) return viewSetup(function () { viewEditor(args); });
    var editId = args[0], existing = editId ? DS.DYN.filter(function (p) { return p.id === editId; })[0] : null;
    var photos = []; // {bytes, url} new, or {ref} kept
    var m = $('main'); m.className = '';
    m.innerHTML = '<h1 class="pagetitle">' + tt('title') + '</h1><div class="card wform">' +
      '<div class="row2"><div><label for="w-tar">' + tt('tAr') + '</label><input id="w-tar" type="text" lang="ar"></div>' +
      '<div><label for="w-ten">' + tt('tEn') + '</label><input id="w-ten" type="text" dir="ltr"></div></div>' +
      '<label for="w-date">' + tt('date') + '</label><input id="w-date" type="date" dir="ltr">' +
      '<label for="w-bar">' + tt('bAr') + '</label><textarea id="w-bar" lang="ar"></textarea>' +
      '<label for="w-ben">' + tt('bEn') + '</label><textarea id="w-ben" dir="ltr"></textarea>' +
      '<p class="muted" style="font-size:13px">' + tt('fmt') + '</p>' +
      '<label>' + tt('photos') + '</label><input id="w-files" type="file" accept="image/*" multiple hidden><button class="btn" type="button" id="w-add">＋ ' + tt('addPhotos') + '</button><div class="wthumbs" id="w-thumbs"></div>' +
      '<div class="actions" style="margin-top:18px"><button class="btn primary" type="button" id="w-pub">' + tt('publish') + '</button></div>' +
      '<p class="wstatus" id="w-st"></p></div><p><button class="btn" type="button" id="w-forget">' + tt('forget') + '</button></p>';
    $('w-date').value = new Date().toISOString().slice(0, 10);
    function thumbs() {
      $('w-thumbs').innerHTML = photos.map(function (p, i) { return '<figure><img src="' + (p.url || '') + '" alt=""><button type="button" data-i="' + i + '">✕</button></figure>'; }).join('');
      $('w-thumbs').querySelectorAll('button').forEach(function (b) { b.onclick = function () { photos.splice(+b.getAttribute('data-i'), 1); thumbs(); }; });
    }
    if (existing) {
      $('w-tar').value = existing.ar || ''; $('w-ten').value = existing.en || ''; $('w-date').value = existing.date || '';
      fetch(existing.body.f, {cache: 'no-store'}).then(function (r) { return r.arrayBuffer(); })
        .then(function (buf) { return crypto.subtle.decrypt({name: 'AES-GCM', iv: DS.b64(existing.body.iv)}, DS.KEY, buf); })
        .then(function (pl) {
          var body = JSON.parse(new TextDecoder().decode(pl));
          $('w-bar').value = body.md.ar || ''; $('w-ben').value = body.md.en || '';
          (body.images || []).forEach(function (ref) { var p = {ref: ref}; photos.push(p); DS.fetchBlob(ref).then(function (u) { p.url = u; thumbs(); }); });
          thumbs();
        });
    }
    $('w-add').onclick = function () { $('w-files').click(); };
    $('w-files').onchange = function () {
      Array.prototype.forEach.call(this.files, function (f) {
        var p = {url: URL.createObjectURL(f), file: f}; photos.push(p);
      });
      this.value = ''; thumbs();
    };
    $('w-forget').onclick = function () { DS.store.del(TOKEN_KEY); location.hash = '#/posts'; };
    $('w-pub').onclick = function () {
      var tar = $('w-tar').value.trim(), ten = $('w-ten').value.trim(), bar = $('w-bar').value.trim(), ben = $('w-ben').value.trim();
      if (!((tar && bar) || (ten && ben))) { $('w-st').textContent = tt('need'); return; }
      var btn = this; btn.disabled = true; $('w-st').textContent = tt('saving');
      var id = existing ? existing.id : $('w-date').value + '-' + Math.random().toString(36).slice(2, 8);
      var stamp = Date.now().toString(36);
      var refs = [];
      var chain = Promise.resolve();
      photos.forEach(function (p, i) {
        chain = chain.then(function () {
          if (p.ref) { refs.push(p.ref); return; }
          return resize(p.file).then(enc).then(function (e) {
            var path = 'dyn/' + id + '-' + stamp + '-' + i + '.bin';
            return put(path, u8b64(e.ct), 'Post photo').then(function () { refs.push({f: path, iv: e.iv, mime: 'image/jpeg', size: e.ct.length}); });
          });
        });
      });
      chain.then(function () {
        return encJSON({md: {ar: bar || ben, en: ben || bar}, images: refs});
      }).then(function (e) {
        var path = 'dyn/' + id + '-' + stamp + '.bin';
        return put(path, u8b64(e.ct), 'Post text').then(function () { return {f: path, iv: e.iv, mime: 'application/json', size: e.ct.length}; });
      }).then(function (bodyRef) {
        return readIndex().then(function (ix) {
          var list = ix.list.filter(function (p) { return p.id !== id; });
          list.push({id: id, date: $('w-date').value, ar: tar || ten, en: ten || tar, body: bodyRef});
          return writeIndex(list, (existing ? 'Edit' : 'New') + ' post');
        });
      }).then(function () {
        $('w-st').innerHTML = tt('done') + ' <a href="#/post/' + encodeURIComponent(id) + '">' + tt('view') + '</a>';
      }).catch(function (err) {
        btn.disabled = false; $('w-st').textContent = tt('fail') + (err && err.message || err);
      });
    };
    document.title = tt('title') + ' · ' + DS.t('brand');
  }

  DS.deletePost = function (id) {
    if (!confirm(tt('confirmDel'))) return;
    readIndex().then(function (ix) {
      return writeIndex(ix.list.filter(function (p) { return p.id !== id; }), 'Delete post');
    }).then(function () { location.hash = '#/posts'; }, function (e) { alert(tt('fail') + e.message); });
  };
  DS.routes.write = viewEditor;
})();
