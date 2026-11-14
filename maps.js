/* Family maps: historic Palestine and the world, with an olive sprig at each family place. No text beyond place names. */
(function () {
  'use strict';
  var GEO = null;
  function loadGeo() {
    if (GEO) return GEO;
    GEO = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'topojson-client.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    }).then(function () { return fetch('geo/countries-50m.json'); }).then(function (r) { return r.json(); });
    return GEO;
  }
  var SPRIG = '<symbol id="sprig" viewBox="-14 -14 28 28" overflow="visible">' +
    '<path d="M-9 9 C-3 3 3 -3 9 -10" fill="none" stroke="#5b4a2e" stroke-width="1.6" stroke-linecap="round"/>' +
    '<g fill="#5f7f45" stroke="#3f5a2c" stroke-width=".6">' +
    '<ellipse cx="-4" cy="1" rx="5.5" ry="2.2" transform="rotate(-70 -4 1)"/><ellipse cx="0" cy="5" rx="5.5" ry="2.2" transform="rotate(10 0 5)"/>' +
    '<ellipse cx="1" cy="-4" rx="5.5" ry="2.2" transform="rotate(-75 1 -4)"/><ellipse cx="5" cy="0" rx="5.5" ry="2.2" transform="rotate(5 5 0)"/>' +
    '<ellipse cx="6" cy="-9" rx="4.5" ry="1.9" transform="rotate(-50 6 -9)"/></g>' +
    '<circle cx="-7" cy="3" r="2.4" fill="#2f3b22"/></symbol>';
  function name(p) { return DS.LANG === 'ar' ? p.ar : p.la; }

  var PAL = null;
  function loadPal() { if (!PAL) PAL = fetch('geo/palestine.json').then(function (r) { return r.json(); }); return PAL; }
  function palestine(el, ring, places, mini) {
    var W = 420, H = 760, feat = {type: 'Feature', geometry: {type: 'Polygon', coordinates: [ring]}};
    var proj = d3.geoMercator().fitExtent([[30, 20], [W - 30, H - 20]], feat);
    var line = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5));
    var d = line(ring.slice(0, -1).map(function (c) { return proj(c); }));
    var marks = places.map(function (p) {
      var xy = proj([p.lon, p.lat]), x = xy[0], y = xy[1], s = (p.old ? 26 : 34) * (mini ? 1.5 : 1);
      var left = p.la === 'al-Kabri' || p.la === 'Gaza';
      var lab = mini ? '' : '<text x="' + (x + (left ? -20 : 20)) + '" y="' + (y + 5) + '" text-anchor="' + (left ? 'end' : 'start') + '">' + DS.esc(name(p)) + '</text>';
      return '<g class="mk' + (p.old ? ' old' : '') + '"><use href="#sprig" x="' + (x - s / 2) + '" y="' + (y - s / 2) + '" width="' + s + '" height="' + s + '"/>' + lab + '</g>';
    }).join('');
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="mapsvg pal' + (mini ? ' mini' : '') + '" style="direction:ltr"><defs>' + SPRIG + '</defs>' +
      '<path class="land" d="' + d + '"/>' + marks + '</svg>';
  }
  function world(el, geo, places) {
    var land = topojson.feature(geo, geo.objects.countries);
    var W = 960, H = 500, BASE = 26;
    var proj = d3.geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], {type: 'Sphere'}), path = d3.geoPath(proj);
    var marks = places.map(function (p) {
      var xy = proj([p.lon, p.lat]);
      return '<g class="mk" data-x="' + xy[0] + '" data-y="' + xy[1] + '" transform="translate(' + xy[0] + ',' + xy[1] + ')"><use href="#sprig" x="' + (-BASE / 2) + '" y="' + (-BASE / 2) + '" width="' + BASE + '" height="' + BASE + '"/><title>' + DS.esc(name(p)) + '</title></g>';
    }).join('');
    el.innerHTML = '<div class="mapzoom"><svg viewBox="0 0 ' + W + ' ' + H + '" class="mapsvg wld" style="direction:ltr"><defs>' + SPRIG + '</defs><g class="zg">' +
      '<path class="sphere" vector-effect="non-scaling-stroke" d="' + path({type: 'Sphere'}) + '"/><path class="land" vector-effect="non-scaling-stroke" d="' + path(land) + '"/>' + marks + '</g></svg>' +
      '<div class="mapbtns"><button type="button" class="btn zbtn" data-z="in">＋</button><button type="button" class="btn zbtn" data-z="out">−</button><button type="button" class="btn zbtn" data-z="reset">⟲</button></div></div>' +
      '<div class="mapchips">' + places.map(function (p, i) { return '<button type="button" class="chip" data-i="' + i + '">' + DS.esc(name(p)) + '</button>'; }).join('') + '</div>';
    var svg = d3.select(el).select('svg'), zg = svg.select('.zg'), mk = zg.selectAll('g.mk');
    var zoom = d3.zoom().scaleExtent([1, 24]).translateExtent([[0, 0], [W, H]]).on('zoom', function (e) {
      var k = e.transform.k;
      zg.attr('transform', e.transform);
      // sprigs keep a modest size on screen, so close places separate as you zoom in
      var s = 0.55 * Math.pow(k, 0.45) / k;
      mk.attr('transform', function () { return 'translate(' + this.getAttribute('data-x') + ',' + this.getAttribute('data-y') + ') scale(' + s + ')'; });
    });
    svg.call(zoom).call(zoom.transform, d3.zoomIdentity);
    el.querySelectorAll('.mapbtns button').forEach(function (b) {
      b.onclick = function () {
        var z = b.getAttribute('data-z'), t = svg.transition().duration(350);
        if (z === 'in') t.call(zoom.scaleBy, 1.8); else if (z === 'out') t.call(zoom.scaleBy, 1 / 1.8); else t.call(zoom.transform, d3.zoomIdentity);
      };
    });
    el.querySelectorAll('.mapchips .chip').forEach(function (c) {
      c.onclick = function () {
        var p = places[+c.getAttribute('data-i')], xy = proj([p.lon, p.lat]), k = 6;
        svg.transition().duration(700).call(zoom.transform, d3.zoomIdentity.translate(W / 2 - xy[0] * k, H / 2 - xy[1] * k).scale(k));
      };
    });
  }
  DS.renderMaps = function () {
    var els = document.querySelectorAll('.dsmap'); if (!els.length || !DS.MAPS) return;
    els.forEach(function (el) {
      var k = el.getAttribute('data-map');
      if (k === 'palestine' || k === 'palestine-mini') {
        loadPal().then(function (ring) { palestine(el, ring, DS.MAPS.palestine || [], k === 'palestine-mini'); }, function () { el.innerHTML = '<p class="err">⚠</p>'; });
      } else if (k === 'world') {
        el.innerHTML = '<p class="muted">' + DS.t('loading') + '</p>';
        loadGeo().then(function (geo) { world(el, geo, DS.MAPS.world || []); }, function () { el.innerHTML = '<p class="err">⚠</p>'; });
      }
    });
  };
})();
