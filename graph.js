/* Interactive family tree: tap to open and close branches, drag and pinch to move and zoom. */
(function () {
  'use strict';
  var T = {
    ar: {all: 'افتح فرعًا فرعًا', openAll: 'افتح الكل', close: 'أغلق الكل', center: 'إلى الجذر', profile: 'الصفحة الشخصية', list: 'قائمة الشجرة',
      old: 'السلسلة المتوارثة', oldTag: 'رواية، غير موثّقة', hint: 'اضغط على اسم لفتح فروعه أو إغلاقها. اسحب للتحريك، واستخدم إصبعين أو عجلة الفأرة للتكبير.', gen: 'الجيل', kids: 'أولاد', desc: 'ذرية', open: 'افتح', shut: 'أغلق', born: 'الولادة', died: 'الوفاة'},
    la: {all: 'Open branch by branch', openAll: 'Open all', close: 'Close all', center: 'Back to the root', profile: 'Open profile', list: 'Tree list',
      old: 'Traditional line', oldTag: 'tradition, not documented', hint: 'Tap a name to open or close its branch. Drag to move, pinch or scroll to zoom.', gen: 'Generation', kids: 'children', desc: 'descendants', open: 'Open', shut: 'Close', born: 'Born', died: 'Died'}
  };
  function tt(k) { return T[DS.LANG === 'ar' ? 'ar' : 'la'][k]; }
  var OPEN = null, KEYOPEN = 'ds-graph-open';
  var NODE_W = 128, NODE_H = 34, GAP_X = 14, GAP_Y = 64;

  function loadOpen() {
    if (OPEN) return;
    try { OPEN = JSON.parse(DS.store.get(KEYOPEN) || 'null'); } catch (e) { OPEN = null; }
    if (!OPEN) {
      OPEN = {};
      // open the single-child trunk down to the first real branching, then one level more
      var id = DS.ROOTS[0], guard = 0;
      while (id && guard++ < 40) {
        OPEN[id] = 1;
        var kids = DS.P[id].c.filter(function (k) { return DS.P[k]; });
        if (kids.length !== 1) break;
        id = kids[0];
      }
    }
  }
  function saveOpen() { DS.store.set(KEYOPEN, JSON.stringify(OPEN)); }

  function hierarchy() {
    function build(id) {
      var p = DS.P[id], kids = p.c.filter(function (k) { return DS.P[k]; });
      var n = {id: id, total: kids.length};
      if (OPEN[id] && kids.length) n.children = kids.map(build);
      return n;
    }
    return d3.hierarchy(build(DS.ROOTS[0]));
  }

  var gOld, oldOpen = false, svg, gRoot, gLinks, gNodes, zoom, W, H, selected = null, lastPos = {}, rtl;

  function view(args) {
    var focus = args[0];
    DS.setNav('tree');
    document.body.classList.add('fullbleed');
    loadOpen();
    rtl = DS.LANG === 'ar';
    if (focus && DS.P[focus]) {
      var p = DS.P[focus];
      while (p && p.f) { OPEN[p.f] = 1; p = DS.P[p.f]; }
      saveOpen();
    }
    var main = document.getElementById('main');
    main.className = 'graphmain';
    main.innerHTML = '<div class="graphtabs">' + DS.treeTabs('graph', focus) + '</div>' +
      '<div class="graphbar"><button class="btn" type="button" id="g-openall">' + tt('openAll') + '</button><button class="btn" type="button" id="g-close">' + tt('close') + '</button>' +
      '<button class="btn" type="button" id="g-root">' + tt('center') + '</button>' +
      '<button class="btn zbtn" type="button" id="g-in" aria-label="zoom in">＋</button><button class="btn zbtn" type="button" id="g-out" aria-label="zoom out">−</button>' +

      '<span class="ghint">' + tt('hint') + '</span></div>' +
      '<div class="graphwrap" id="gwrap"><svg id="gsvg"></svg><div class="gpanel" id="gpanel" hidden></div></div>';
    var wrap = document.getElementById('gwrap');
    fitHeight(wrap);
    W = wrap.clientWidth; H = wrap.clientHeight;
    svg = d3.select('#gsvg').attr('width', W).attr('height', H);
    gRoot = svg.append('g');
    gOld = gRoot.append('g').attr('class', 'gold');
    gLinks = gRoot.append('g').attr('class', 'glinks');
    gNodes = gRoot.append('g').attr('class', 'gnodes');
    zoom = d3.zoom().scaleExtent([0.15, 2.5]).on('zoom', function (e) { gRoot.attr('transform', e.transform); });
    svg.call(zoom).on('dblclick.zoom', null);
    lastPos = {};
    selected = focus && DS.P[focus] ? focus : null;
    oldOpen = DS.store.get('ds-graph-old') === '1';
    render(null, false);
    drawOld(false);
    var target = selected || DS.ROOTS[0], saved = null;
    try { saved = JSON.parse(sessionStorage.getItem('ds-graph-tf') || 'null'); } catch (e) {}
    if (saved && saved.id === (focus || '')) svg.call(zoom.transform, d3.zoomIdentity.translate(saved.x, saved.y).scale(saved.k));
    else centerOn(target, false, selected ? 1 : 0.9);
    zoom.on('end', function (e) { try { sessionStorage.setItem('ds-graph-tf', JSON.stringify({id: selected || '', x: e.transform.x, y: e.transform.y, k: e.transform.k})); } catch (x) {} });
    if (selected) showPanel(selected);
    document.getElementById('g-close').onclick = function () {
      OPEN = {}; OPEN[DS.ROOTS[0]] = 1; saveOpen(); selected = null; hidePanel(); render(DS.ROOTS[0], true); centerOn(DS.ROOTS[0], true, 0.9);
    };
    document.getElementById('g-openall').onclick = function () {
      Object.keys(DS.P).forEach(function (id) { if (DS.P[id].c.some(function (k) { return DS.P[k]; })) OPEN[id] = 1; });
      saveOpen(); render(null, false);
      var xs = [], ys = [];
      Object.keys(lastPos).forEach(function (id) { xs.push(lastPos[id].x); ys.push(lastPos[id].y); });
      var x0 = Math.min.apply(null, xs) - NODE_W / 2, x1 = Math.max.apply(null, xs) + NODE_W / 2;
      var y0 = Math.min.apply(null, ys) - NODE_H / 2 - 40, y1 = Math.max.apply(null, ys) + NODE_H / 2, pad = 20;
      var k = Math.max(0.4, Math.min(1, (W - pad * 2) / (x1 - x0), (H - pad * 2) / (y1 - y0)));
      var tx = (x1 - x0) * k < W ? W / 2 - k * (x0 + x1) / 2 : W / 2;
      svg.call(zoom.transform, d3.zoomIdentity.translate(tx, pad + 50 * k).scale(k));
    };
    document.getElementById('g-in').onclick = function () { svg.transition().duration(300).call(zoom.scaleBy, 1.4); };
    document.getElementById('g-out').onclick = function () { svg.transition().duration(300).call(zoom.scaleBy, 1 / 1.4); };
    document.getElementById('g-root').onclick = function () { centerOn(DS.ROOTS[0], true, 0.9); };
    window.addEventListener('resize', onResize);
    document.title = (DS.LANG === 'ar' ? 'الشجرة التفاعلية' : 'Interactive tree') + ' · ' + DS.t('brand');
  }
  function onResize() {
    var wrap = document.getElementById('gwrap');
    if (!wrap) { window.removeEventListener('resize', onResize); return; }
    fitHeight(wrap); W = wrap.clientWidth; H = wrap.clientHeight; svg.attr('width', W).attr('height', H);
  }
  function fitHeight(wrap) {
    var top = wrap.getBoundingClientRect().top + window.scrollY;
    wrap.style.height = Math.max(380, window.innerHeight - top) + 'px';
  }

  function render(sourceId, animate) {
    var root = hierarchy();
    d3.tree().nodeSize([NODE_W + GAP_X, NODE_H + GAP_Y]).separation(function (a, b) { return a.parent === b.parent ? 1 : 1.15; })(root);
    var nodes = root.descendants(), links = root.links();
    var prev = lastPos, NEW = {};
    nodes.forEach(function (d) { if (rtl) d.x = -d.x; NEW[d.data.id] = {x: d.x, y: d.y}; });
    var src = (sourceId && (prev[sourceId] || NEW[sourceId])) || {x: 0, y: 0};
    var dst = (sourceId && NEW[sourceId]) || src;
    var dur = animate ? 450 : 0;
    var tr = svg.transition().duration(dur).ease(d3.easeCubicOut);

    // links
    var elbow = function (s, t) {
      var my = s.y + NODE_H / 2 + GAP_Y / 2;
      return 'M' + s.x + ',' + (s.y + NODE_H / 2) + 'V' + my + 'H' + t.x + 'V' + (t.y - NODE_H / 2);
    };
    var link = gLinks.selectAll('path').data(links, function (d) { return d.target.data.id; });
    link.enter().append('path').attr('d', function () { return elbow(src, src); })
      .merge(link).transition(tr).attr('d', function (d) { return elbow(d.source, d.target); });
    link.exit().transition(tr).attr('d', function () { return elbow(dst, dst); }).remove();

    // nodes
    var node = gNodes.selectAll('g.gn').data(nodes, function (d) { return d.data.id; });
    var enter = node.enter().append('g').attr('class', 'gn')
      .attr('transform', 'translate(' + src.x + ',' + src.y + ')').style('opacity', 0)
      .on('click', function (e, d) { e.stopPropagation(); clickNode(d.data.id); });
    enter.append('rect').attr('x', -NODE_W / 2).attr('y', -NODE_H / 2).attr('width', NODE_W).attr('height', NODE_H).attr('rx', 10);
    enter.append('text').attr('class', 'nm').attr('dy', '0.35em').attr('text-anchor', 'middle');
    var badge = enter.append('g').attr('class', 'badge').attr('transform', 'translate(0,' + (NODE_H / 2) + ')');
    badge.append('circle').attr('r', 10);
    badge.append('text').attr('dy', '0.35em').attr('text-anchor', 'middle');
    var all = enter.merge(node);
    all.attr('class', function (d) {
      var p = DS.P[d.data.id];
      return 'gn' + (p.s === 'F' ? ' F' : '') + (d.data.id === selected ? ' sel' : '') + (d.data.total ? ' haskids' : '') + (d.data.total && !OPEN[d.data.id] ? ' closed' : '');
    });
    all.select('text.nm').text(function (d) { return fit(DS.plain(DS.P[d.data.id])); });
    all.select('g.badge').style('display', function (d) { return d.data.total ? null : 'none'; });
    all.select('g.badge text').text(function (d) { return OPEN[d.data.id] ? '−' : '+' + d.data.total; });
    all.transition(tr).style('opacity', 1).attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });
    node.exit().transition(tr).style('opacity', 0)
      .attr('transform', 'translate(' + dst.x + ',' + dst.y + ')').remove();
    lastPos = NEW;
  }
  /* the board's border chain above Mustafa, drawn dashed and labelled as tradition */
  var OLD_STEP = NODE_H + 22, PILL_W = 224;
  function drawOld(animate) {
    var O = DS.OLD; if (!O || !gOld) return;
    gOld.selectAll('*').remove();
    var ar = DS.LANG === 'ar', n = O.chain.length, py = -NODE_H / 2 - 30;
    gOld.append('path').attr('class', 'oldlink').attr('d', 'M0,' + (-NODE_H / 2) + 'V' + (py + 14));
    var pill = gOld.append('g').attr('class', 'oldpill').attr('transform', 'translate(0,' + py + ')').style('cursor', 'pointer')
      .on('click', function (e) { e.stopPropagation(); oldOpen = !oldOpen; DS.store.set('ds-graph-old', oldOpen ? '1' : '0'); drawOld(true); });
    pill.append('rect').attr('x', -PILL_W / 2).attr('y', -14).attr('width', PILL_W).attr('height', 28).attr('rx', 14);
    pill.append('text').attr('dy', '0.35em').attr('text-anchor', 'middle')
      .text((oldOpen ? '▾ ' : '▴ ') + tt('old') + ' (' + n + ') · ' + tt('oldTag'));
    if (!oldOpen) return;
    var top = py - 14 - n * OLD_STEP;
    gOld.insert('path', ':first-child').attr('class', 'oldlink').attr('d', 'M0,' + (py - 14) + 'V' + (top + OLD_STEP - NODE_H / 2));
    var g = gOld.selectAll('g.oldn').data(O.chain).enter().append('g').attr('class', 'oldn')
      .attr('transform', function (d, i) { return 'translate(0,' + (py - 14 - (i + 1) * OLD_STEP + NODE_H / 2 - 6) + ')'; });
    var last = n - 1;
    g.append('rect').attr('x', function (d, i) { return i === last ? -150 : -NODE_W / 2; }).attr('y', -NODE_H / 2)
      .attr('width', function (d, i) { return i === last ? 300 : NODE_W; }).attr('height', NODE_H).attr('rx', 10);
    g.append('text').attr('dy', '0.35em').attr('text-anchor', 'middle').text(function (d) { return d[ar ? 0 : 1]; });
    gOld.append('text').attr('class', 'oldcap').attr('text-anchor', 'middle').attr('y', top - 10)
      .text(ar ? O.source_ar : O.source_en);
    if (animate) g.style('opacity', 0).transition().duration(350).delay(function (d, i) { return i * 12; }).style('opacity', 1);
  }

  var ctx = null;
  function fit(s) {
    if (!ctx) ctx = document.createElement('canvas').getContext('2d');
    ctx.font = '600 14px ' + (DS.LANG === 'ar' ? '"Noto Naskh Arabic", serif' : '"Source Serif 4", serif');
    if (ctx.measureText(s).width <= NODE_W - 14) return s;
    while (s.length > 3 && ctx.measureText(s + '…').width > NODE_W - 14) s = s.slice(0, -1);
    return s + '…';
  }

  function clickNode(id) {
    var p = DS.P[id], kids = p.c.filter(function (k) { return DS.P[k]; });
    var before = lastPos[id];
    selected = id;
    if (kids.length) { if (OPEN[id]) closeBranch(id); else OPEN[id] = 1; saveOpen(); }
    render(id, true);
    // keep the tapped node where the finger is, then ease it into view if needed
    var now = lastPos[id];
    if (before && now && (before.x !== now.x || before.y !== now.y)) {
      var tf = d3.zoomTransform(svg.node());
      svg.transition().duration(450).ease(d3.easeCubicOut)
        .call(zoom.transform, tf.translate(before.x - now.x, before.y - now.y));
    }
    showPanel(id);
  }
  function closeBranch(id) {
    delete OPEN[id];
    DS.P[id].c.forEach(function (k) { if (DS.P[k] && OPEN[k]) closeBranch(k); });
  }
  function centerOn(id, animate, k) {
    var p = lastPos[id]; if (!p) return;
    var tf = d3.zoomIdentity.translate(W / 2 - p.x * k, Math.min(H * 0.3, 90) - p.y * k + (id === DS.ROOTS[0] ? 0 : H * 0.15)).scale(k);
    (animate ? svg.transition().duration(600).ease(d3.easeCubicInOut) : svg).call(zoom.transform, tf);
  }
  function showPanel(id) {
    if (location.hash !== '#/graph/' + id) { history.replaceState(null, '', '#/graph/' + id); DS.fixTop('#/graph/' + id); }
    var p = DS.P[id], el = document.getElementById('gpanel'); if (!el) return;
    var facts = [];
    if (p.b && (p.b.DATE || p.b.PLAC)) facts.push(tt('born') + ': ' + [DS.fmtDate(p.b.DATE), p.b.PLAC].filter(Boolean).join(', '));
    if (p.d) facts.push(tt('died') + ': ' + ([DS.fmtDate(p.d.DATE), p.d.PLAC].filter(Boolean).join(', ') || '✝'));
    var kids = p.c.filter(function (k) { return DS.P[k]; }).length;
    el.innerHTML = '<button class="gx" type="button" aria-label="close">✕</button>' +
      '<b class="' + (p.s === 'F' ? 'sexF' : '') + '">' + DS.label(p) + '</b>' +
      (p.f ? '<span class="muted">' + DS.esc(DS.nasab(p, 3)) + '</span>' : '') +
      '<span class="muted">' + tt('gen') + ' ' + DS.GEN[id] + (kids ? ' · ' + kids + ' ' + tt('kids') + ' · ' + DS.DESC[id] + ' ' + tt('desc') : '') + '</span>' +
      (facts.length ? '<span>' + DS.esc(facts.join(' · ')) + '</span>' : '') +
      '<span class="gact"><a class="btn" href="#/p/' + id + '">' + tt('profile') + '</a></span>';
    el.hidden = false;
    el.querySelector('.gx').onclick = hidePanel;
  }
  function hidePanel() { var el = document.getElementById('gpanel'); if (el) el.hidden = true; }

  DS.routes.graph = view;
})();
