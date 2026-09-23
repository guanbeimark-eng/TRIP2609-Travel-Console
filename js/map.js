const MapModule = (() => {
  let map = null;
  let clusterGroup = null;
  let routeLayer = null;
  let markerLookup = {};
  let selectedId = null;
  let onSelect = null;
  let tileMode = 'gcj';
  let currentProvider = null;
  let tileLayer = null;
  let firstTileTimer = null;
  let listOnly = false;
  let useCluster = true;
  let attemptToken = 0;

  const PROVIDERS = [
    {
      id: 'gaode', label: '高德', mode: 'gcj',
      url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
      options: { subdomains: '1234', maxZoom: 18, attribution: '&copy; 高德' }
    },
    {
      id: 'geoq', label: 'GeoQ', mode: 'gcj',
      url: 'https://map.geoq.cn/ArcGIS/rest/services/ChinaOnlineCommunity/MapServer/tile/{z}/{y}/{x}',
      options: { maxZoom: 16, attribution: '&copy; GeoQ' }
    },
    {
      id: 'carto', label: 'Carto(WGS)', mode: 'wgs',
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      options: { subdomains: 'abcd', maxZoom: 19, attribution: '&copy; OSM &copy; CARTO' }
    }
  ];

  const CAT_COLOR = {
    HOTEL: '#6aa8ff', FOOD: '#ff8f5a', PHOTO: '#c084fc', ACTIVITY: '#34d399',
    CONCERT: '#f472b6', ATTRACTION: '#22d3ee', COFFEE: '#d4a574', BAR: '#a78bfa',
    SHOPPING: '#fbbf24', TRANSPORT: '#94a3b8'
  };
  const CAT_GLYPH = {
    HOTEL: '宿', FOOD: '食', PHOTO: '拍', ACTIVITY: '活', CONCERT: '演',
    ATTRACTION: '景', COFFEE: '咖', BAR: '吧', SHOPPING: '购', TRANSPORT: '行'
  };

  function setStatus(text, cls) {
    const el = document.getElementById('providerStatus');
    if (!el) return;
    el.textContent = text;
    el.className = 'provider-status' + (cls ? ' ' + cls : '');
  }
  function showFallback(msg) {
    listOnly = true;
    const box = document.getElementById('mapFallback');
    const m = document.getElementById('mapFallbackMsg');
    if (m) m.textContent = msg || '底图加载失败，已进入列表模式。';
    if (box) {
      box.hidden = false;
      box.removeAttribute('hidden');
    }
    setStatus('列表模式（无底图）', 'err');
  }
  function hideFallback() {
    listOnly = false;
    const box = document.getElementById('mapFallback');
    if (box) {
      box.hidden = true;
      box.setAttribute('hidden', '');
    }
  }

  function init(containerId, selectCb) {
    onSelect = selectCb;
    map = L.map(containerId, { center: [36.5, 115.5], zoom: 7, zoomControl: true, maxZoom: 18 });
    routeLayer = L.layerGroup().addTo(map);
    if (typeof L.markerClusterGroup === 'function') {
      clusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 48,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 15
      });
      map.addLayer(clusterGroup);
    } else {
      clusterGroup = L.layerGroup().addTo(map);
      useCluster = false;
    }
    setTimeout(() => map.invalidateSize(), 80);
    tryProvider(0);
    const retry = document.getElementById('btnRetryTiles');
    if (retry) retry.addEventListener('click', () => tryProvider(0));
    return map;
  }

  function clearTileTimer() {
    if (firstTileTimer) { clearTimeout(firstTileTimer); firstTileTimer = null; }
  }

  function tryProvider(index) {
    clearTileTimer();
    const myToken = ++attemptToken;
    hideFallback();
    if (tileLayer) { map.removeLayer(tileLayer); tileLayer = null; }
    if (index >= PROVIDERS.length) {
      if (myToken !== attemptToken) return;
      tileMode = 'none'; currentProvider = null;
      showFallback('高德 / GeoQ / Carto 均超时或失败。时间线与详情仍可用。');
      return;
    }
    const p = PROVIDERS[index];
    currentProvider = p; tileMode = p.mode;
    setStatus('尝试底图：' + p.label + '…', 'warn');
    let gotTile = false;
    tileLayer = L.tileLayer(p.url, Object.assign({ crossOrigin: true }, p.options));
    tileLayer.on('tileload', () => {
      if (myToken !== attemptToken) return;
      if (!gotTile) {
        gotTile = true;
        clearTileTimer();
        hideFallback();
        const box = document.getElementById('mapFallback');
        if (box) box.hidden = true;
        setStatus('底图：' + p.label + (p.mode === 'wgs' ? ' · 已GCJ→WGS' : ' · GCJ-02'), 'ok');
        if (window.__tripConsoleRefresh) window.__tripConsoleRefresh();
      }
    });
    tileLayer.on('tileerror', () => {
      if (myToken !== attemptToken) return;
      // ignore individual tile errors; timeout handles failover
    });
    tileLayer.addTo(map);
    firstTileTimer = setTimeout(() => {
      if (myToken !== attemptToken) return;
      if (!gotTile) tryProvider(index + 1);
    }, 8000);
  }

  function toDisplayLatLng(place) {
    const c = place.coordinates || {};
    let lat = c.lat, lng = c.lng;
    if (tileMode === 'wgs' && (c.coordinate_system || 'GCJ-02') === 'GCJ-02') {
      const w = Coord.gcj02ToWgs84(lat, lng);
      lat = w.lat; lng = w.lng;
    }
    return [lat, lng];
  }

  function makeIcon(place, selected) {
    const color = CAT_COLOR[place.category] || '#64748b';
    const glyph = CAT_GLYPH[place.category] || '·';
    // Marker cover: only VERIFIED image_file; else category glyph
    const imgObj = (place.images || []).find(i =>
      i.image_file && (i.source_status === 'VERIFIED' || i.status === 'VERIFIED')
    );
    const img = imgObj ? (imgObj.thumbnail_file || imgObj.image_file) : '';
    const html = img
      ? `<div class="poi-marker ${selected ? 'selected' : ''}" style="border-color:${color}"><img src="${img}" alt="" onerror="this.remove();this.parentNode.textContent='${glyph}';"/></div>`
      : `<div class="poi-marker ${selected ? 'selected' : ''}" style="background:${color}">${glyph}</div>`;
    return L.divIcon({
      className: 'poi-divicon' + (selected ? ' marker-highlight' : ''),
      html, iconSize: [40, 40], iconAnchor: [20, 20]
    });
  }

  function clearLayers() {
    if (clusterGroup) clusterGroup.clearLayers();
    routeLayer.clearLayers();
    markerLookup = {};
  }

  function update(places, segments) {
    if (!map) return;
    clearLayers();
    const latlngs = [];
    const dense = places.length >= 8;

    places.forEach(place => {
      const ll = toDisplayLatLng(place);
      latlngs.push(ll);
      const m = L.marker(ll, { icon: makeIcon(place, place.place_id === selectedId), title: place.name });
      m.on('click', () => {
        select(place.place_id, true);
        if (onSelect) onSelect(place.place_id, 'map');
      });
      clusterGroup.addLayer(m);
      markerLookup[place.place_id] = m;
    });

    (segments || []).forEach(seg => {
      const coords = (seg.geometry && seg.geometry.coordinates) || [];
      const style = seg.style || {};
      const color = style.color || '#3d9cf0';
      const dash = style.dashArray || style.dash || null;
      const pts = coords.map(c => {
        let lat = c[1], lng = c[0];
        if (tileMode === 'wgs') {
          const w = Coord.gcj02ToWgs84(lat, lng);
          lat = w.lat; lng = w.lng;
        }
        return [lat, lng];
      });
      if (pts.length >= 2) {
        L.polyline(pts, { color, weight: 5, opacity: 0.22 }).addTo(routeLayer);
        L.polyline(pts, { color, weight: 3, opacity: 0.9, dashArray: dash || undefined }).addTo(routeLayer);
      }
    });

    if (latlngs.length) {
      try { map.fitBounds(L.latLngBounds(latlngs).pad(0.2), { maxZoom: dense ? 13 : 14 }); } catch (e) {}
    }
    setTimeout(() => map.invalidateSize(), 50);
  }

  function select(placeId, pan) {
    selectedId = placeId;
    Object.keys(markerLookup).forEach(id => {
      const place = TripData.placeById(id);
      if (!place) return;
      markerLookup[id].setIcon(makeIcon(place, id === placeId));
    });
    if (!placeId) return;
    const m = markerLookup[placeId];
    if (m && pan) {
      if (clusterGroup && clusterGroup.zoomToShowLayer) {
        clusterGroup.zoomToShowLayer(m, () => {
          map.panTo(m.getLatLng(), { animate: true });
        });
      } else {
        map.panTo(m.getLatLng(), { animate: true });
      }
    }
  }
  function clearSelection() { selectedId = null; }
  function focus(placeId) { select(placeId, true); }
  function invalidateSize() { if (map) map.invalidateSize(); }
  function remount(container) {
    if (!map) return;
    container.appendChild(map.getContainer());
    setTimeout(() => map.invalidateSize(), 60);
  }

  return {
    init, update, select, clearSelection, focus, invalidateSize, remount, tryProvider,
    get listOnly(){return listOnly;}, get provider(){return currentProvider;},
    get tileMode(){return tileMode;}, get map(){return map;},
    get selectedId(){return selectedId;}
  };
})();
