/* Interactive family tree: tap to open and close branches, drag and pinch to move and zoom. */
(function () {
  'use strict';
  var T = {
    ar: {all: 'افتح فرعًا فرعًا', close: 'أغلق الكل', center: 'إلى الجذر', profile: 'الصفحة الشخصية', list: 'قائمة الشجرة',
      hint: 'اضغط على اسم لفتح فروعه أو إغلاقها. اسحب للتحريك، واستخدم إصبعين أو عجلة الفأرة للتكبير.', gen: 'الجيل', kids: 'أولاد', desc: 'ذرية', open: 'افتح', shut: 'أغلق', born: 'الولادة', died: 'الوفاة'},
    la: {all: 'Open branch by branch', close: 'Close all', center: 'Back to the root', profile: 'Open profile', list: 'Tree list',
      hint: 'Tap a name to open or close its branch. Drag to move, pinch or scroll to zoom.', gen: 'Generation', kids: 'children', desc: 'descendants', open: 'Open', shut: 'Close', born: 'Born', died: 'Died'}
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

  var svg, gRoot, gLinks, gNodes, zoom, W, H, selected = null, lastPos = {}, rtl;

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
    main.innerHTML =
      '<div class="graphbar"><button class="btn" type="button" id="g-close">' + tt('close') + '</button>' +
      '<button class="btn" type="button" id="g-root">' + tt('center') + '</button>' +
      '<button class="btn zbtn" type="button" id="g-in" aria-label="zoom in">＋</button><button class="btn zbtn" type="button" id="g-out" aria-label="zoom out">−</button>' +
      '<a class="btn" href="#/tree' + (focus ? '/' + focus : '') + '">' + tt('list') + '</a>' +
      '<span class="ghint">' + tt('hint') + '</span></div>' +
      '<div class="graphwrap" id="gwrap"><svg id="gsvg"></svg><div class="gpanel" id="gpanel" hidden></div></div>';
    var wrap = document.getElementById('gwrap');
    fitHeight(wrap);
    W = wrap.clientWidth; H = wrap.clientHeight;
    svg = d3.select('#gsvg').attr('width', W).attr('height', H);
    gRoot = svg.append('g');
    gLinks = gRoot.append('g').attr('class', 'glinks');
    gNodes = gRoot.append('g').attr('class', 'gnodes');
    zoom = d3.zoom().scaleExtent([0.15, 2.5]).on('zoom', function (e) { gRoot.attr('transform', e.transform); });
    svg.call(zoom).on('dblclick.zoom', null);
    lastPos = {};
    selected = focus && DS.P[focus] ? focus : null;
    render(null, false);
    var target = selected || DS.ROOTS[0];
    centerOn(target, false, selected ? 1 : 0.9);
    if (selected) showPanel(selected);
    document.getElementById('g-close').onclick = function () {
      OPEN = {}; OPEN[DS.ROOTS[0]] = 1; saveOpen(); selected = null; hidePanel(); render(DS.ROOTS[0], true); centerOn(DS.ROOTS[0], true, 0.9);
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
    var p = DS.P[id], el = document.getElementById('gpanel'); if (!el) return;
    var facts = [];
    if (p.b && (p.b.DATE || p.b.PLAC)) facts.push(tt('born') + ': ' + [p.b.DATE, p.b.PLAC].filter(Boolean).join(', '));
    if (p.d) facts.push(tt('died') + ': ' + ([p.d.DATE, p.d.PLAC].filter(Boolean).join(', ') || '✝'));
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
