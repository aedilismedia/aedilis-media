// Ondan Sonra haritası: Leaflet + OpenStreetMap karoları. JavaScript yoksa sayfadaki liste yeterli.
(function () {
  var holder = document.getElementById('harita-data');
  var el = document.getElementById('harita');
  if (!holder || !el || !window.L) return;
  var data = JSON.parse(holder.textContent);
  var map = L.map(el, { scrollWheelZoom: false, zoomControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> katkıda bulunanlar'
  }).addTo(map);
  // Sayfa kaydırılırken harita yanlışlıkla yakınlaşmasın: tekerlek yalnızca haritaya tıklandıktan sonra çalışır.
  map.on('focus', function () { map.scrollWheelZoom.enable(); });
  map.on('blur', function () { map.scrollWheelZoom.disable(); });

  var byId = {};
  data.places.forEach(function (p) { byId[p.id] = p; });
  var vTitle = {};
  data.videos.forEach(function (v) { vTitle[v.id] = v.title; });

  var markers = {};
  function popup(p) {
    var box = document.createElement('div');
    box.className = 'pop';
    var h = document.createElement('strong');
    h.textContent = p.name;
    var a = document.createElement('p');
    a.className = 'pop-area';
    a.textContent = p.area;
    box.appendChild(h);
    box.appendChild(a);
    if (p.note) {
      var n = document.createElement('p');
      n.textContent = p.note;
      box.appendChild(n);
    }
    if (p.article) {
      var r = document.createElement('p');
      var ra = document.createElement('a');
      ra.href = p.article;
      ra.textContent = 'Yazıyı oku';
      r.appendChild(ra);
      box.appendChild(r);
    }
    var ul = document.createElement('ul');
    p.videos.forEach(function (id) {
      var li = document.createElement('li');
      var l = document.createElement('a');
      l.href = 'https://www.youtube.com/watch?v=' + id;
      l.target = '_blank';
      l.rel = 'noopener';
      l.textContent = vTitle[id];
      li.appendChild(l);
      ul.appendChild(li);
    });
    box.appendChild(ul);
    return box;
  }
  data.places.forEach(function (p) {
    var icon = L.divIcon({ className: 'pin', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -12] });
    var m = L.marker([p.lat, p.lng], { icon: icon, title: p.name, alt: p.name, keyboard: true }).addTo(map);
    m.bindPopup(popup(p), { maxWidth: 280 });
    markers[p.id] = m;
  });

  var all = L.latLngBounds(data.places.map(function (p) { return [p.lat, p.lng]; }));
  var line = null;
  function setActive(ids) {
    Object.keys(markers).forEach(function (id) {
      var node = markers[id].getElement();
      if (node) node.classList.toggle('dim', !!ids && ids.indexOf(id) === -1);
    });
  }
  function showAll() {
    map.closePopup();
    if (line) { map.removeLayer(line); line = null; }
    setActive(null);
    map.fitBounds(all, { padding: [30, 30] });
  }
  function showRoute(r) {
    map.closePopup();
    if (line) map.removeLayer(line);
    var pts = r.stops.map(function (id) { return [byId[id].lat, byId[id].lng]; });
    line = L.polyline(pts, { color: '#e4b040', weight: 3, opacity: 0.9, dashArray: '8 8' }).addTo(map);
    setActive(r.stops);
    map.fitBounds(L.latLngBounds(pts), { padding: [50, 50] });
  }

  var bar = document.getElementById('harita-routes');
  function chip(label, fn) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip-btn';
    b.textContent = label;
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(bar.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      fn();
    });
    b.setAttribute('aria-pressed', 'false');
    bar.appendChild(b);
    return b;
  }
  var first = chip('Tüm yerler', showAll);
  data.routes.forEach(function (r) { chip(r.label, function () { showRoute(r); }); });
  first.setAttribute('aria-pressed', 'true');
  showAll();

  try {
    var want = new URLSearchParams(location.search).get('yer');
    if (want && byId[want]) {
      map.setView([byId[want].lat, byId[want].lng], 11);
      markers[want].openPopup();
    }
  } catch (e) {}

  document.querySelectorAll('[data-focus]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var p = byId[btn.getAttribute('data-focus')];
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      map.setView([p.lat, p.lng], 11);
      markers[p.id].openPopup();
    });
  });
})();
