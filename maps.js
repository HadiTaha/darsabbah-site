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

  function palestine(el, geo, places) {
    var all = topojson.feature(geo, geo.objects.countries).features;
    var parts = geo.objects.countries.geometries.filter(function (g) { return g.id === '376' || g.id === '275'; });
    var land = topojson.merge(geo, parts);
    var W = 420, H = 760;
    var proj = d3.geoMercator().fitExtent([[30, 20], [W - 30, H - 20]], land), path = d3.geoPath(proj);
    var rtl = DS.LANG === 'ar';
    var marks = places.map(function (p) {
      var xy = proj([p.lon, p.lat]), x = xy[0], y = xy[1], s = p.old ? 26 : 34;
      var lx = x + (p.la === 'al-Kabri' ? -20 : 20), anchor = p.la === 'al-Kabri' ? 'end' : 'start';
      return '<g class="mk' + (p.old ? ' old' : '') + '"><use href="#sprig" x="' + (x - s / 2) + '" y="' + (y - s / 2) + '" width="' + s + '" height="' + s + '"/>' +
        '<text x="' + lx + '" y="' + (y + 5) + '" text-anchor="' + anchor + '">' + DS.esc(name(p)) + '</text></g>';
    }).join('');
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="mapsvg pal" style="direction:ltr"><defs>' + SPRIG + '</defs>' +
      '<path class="land" d="' + path(land) + '"/>' + marks + '</svg>';
  }
  function world(el, geo, places) {
    var land = topojson.feature(geo, geo.objects.countries);
    var W = 960, H = 500;
    var proj = d3.geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], {type: 'Sphere'}), path = d3.geoPath(proj);
    var marks = places.map(function (p) {
      var xy = proj([p.lon, p.lat]), s = 22;
      return '<use class="mk" href="#sprig" x="' + (xy[0] - s / 2) + '" y="' + (xy[1] - s / 2) + '" width="' + s + '" height="' + s + '"><title>' + DS.esc(name(p)) + '</title></use>';
    }).join('');
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="mapsvg wld" style="direction:ltr"><defs>' + SPRIG + '</defs>' +
      '<path class="sphere" d="' + path({type: 'Sphere'}) + '"/><path class="land" d="' + path(land) + '"/>' + marks + '</svg>' +
      '<div class="mapchips">' + places.map(function (p) { return '<span>' + DS.esc(name(p)) + '</span>'; }).join('') + '</div>';
  }
  DS.renderMaps = function () {
    var els = document.querySelectorAll('.dsmap'); if (!els.length || !DS.MAPS) return;
    els.forEach(function (el) { el.innerHTML = '<p class="muted">' + DS.t('loading') + '</p>'; });
    loadGeo().then(function (geo) {
      els.forEach(function (el) {
        var k = el.getAttribute('data-map');
        if (k === 'palestine') palestine(el, geo, DS.MAPS.palestine || []);
        else if (k === 'world') world(el, geo, DS.MAPS.world || []);
      });
    }, function () { els.forEach(function (el) { el.innerHTML = '<p class="err">⚠</p>'; }); });
  };
})();
