/**
 * Map engine: prefer AMap JS API 2.0 via AMapLoader.
 * Leaflet is FALLBACK only — one fast tile attempt, then list-safe UI.
 * Coordinates stay GCJ-02 on AMap; convert only for WGS Leaflet tiles.
 */
const MapModule = (() => {
  let engine = null; // 'amap' | 'leaflet' | 'none'
  let amap = null;
  let amapMap = null;
  let leafletMap = null;
  let leafletTiles = null;
  let leafletRoute = null;
  let leafletMarkers = null;
  let tileMode = 'gcj'; // gcj | wgs | none
  let selectedId = null;
  let onSelect = null;
  let listOnly = false;
  let containerId = 'map';
  let lastPlaces = [];
  let lastSegments = [];
  let amapOverlays = [];

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
    if (box) { box.hidden = false; box.removeAttribute('hidden'); }
    setStatus('列表模式（无底图）', 'err');
  }
  function hideFallback() {
    listOnly = false;
    const box = document.getElementById('mapFallback');
    if (box) { box.hidden = true; box.setAttribute('hidden', ''); }
  }

  function keyUsable() {
    const k = (typeof window !== 'undefined' && window.TRIP_AMAP_KEY) || '';
    if (!k || k === 'YOUR_AMAP_WEB_JS_KEY') return false;
    if (/^\s*$/.test(k)) return false;
    if (/placeholder|changeme|todo/i.test(k)) return false;
    return k.length >= 16;
  }

  function markerContent(place, selected) {
    const color = CAT_COLOR[place.category] || '#64748b';
    const glyph = CAT_GLYPH[place.category] || '·';
    // VERIFIED only for cover; IMAGE_UNCERTAIN → glyph
    const imgObj = (place.images || []).find(i =>
      i.image_file && (i.source_status === 'VERIFIED' || i.status === 'VERIFIED')
    );
    const thumb = imgObj ? (imgObj.thumbnail_file || imgObj.image_file) : '';
    if (thumb) {
      return `<div class="poi-marker ${selected ? 'selected' : ''}" style="border-color:${color}"><img src="${thumb}" alt=""/></div>`;
    }
    return `<div class="poi-marker ${selected ? 'selected' : ''}" style="background:${color}">${glyph}</div>`;
  }

  async function init(id, selectCb) {
    containerId = id || 'map';
    onSelect = selectCb;
    hideFallback();
    const retry = document.getElementById('btnRetryMap');
    if (retry) retry.onclick = () => init(containerId, onSelect).then(() => {
      if (lastPlaces.length) update(lastPlaces, lastSegments);
    });

    if (keyUsable() && typeof AMapLoader !== 'undefined') {
      setStatus('加载高德地图…', 'warn');
      try {
        await initAmap();
        return engine;
      } catch (err) {
        console.warn('AMap init failed, falling back to Leaflet', err && err.message);
        setStatus('高德不可用，改用 Leaflet…', 'warn');
      }
    } else {
      setStatus('无有效高德 Key，改用 Leaflet…', 'warn');
    }
    try {
      await initLeaflet();
    } catch (err) {
      console.error('Leaflet init failed', err);
      engine = 'none';
      tileMode = 'none';
      showFallback('地图引擎均不可用。状态卡与抽屉仍可用。');
    }
    return engine;
  }

  function initAmap() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('AMapLoader timeout')), 8000);
      AMapLoader.load({
        key: window.TRIP_AMAP_KEY,
        version: '2.0',
        plugins: ['AMap.ToolBar', 'AMap.Scale']
      }).then((AMap) => {
        clearTimeout(timeout);
        amap = AMap;
        const el = document.getElementById(containerId);
        if (!el) return reject(new Error('map container missing'));
        el.innerHTML = '';
        amapMap = new AMap.Map(containerId, {
          viewMode: '2D',
          zoom: 7,
          center: [115.5, 36.5],
          mapStyle: 'amap://styles/normal'
        });
        try { amapMap.addControl(new AMap.ToolBar({ position: 'RB' })); } catch (_) {}
        engine = 'amap';
        tileMode = 'gcj';
        hideFallback();
        setStatus('底图：高德 JS API 2.0 · GCJ-02', 'ok');
        resolve('amap');
      }).catch((e) => {
        clearTimeout(timeout);
        reject(e);
      });
    });
  }

  function initLeaflet() {
    return new Promise((resolve) => {
      const el = document.getElementById(containerId);
      if (!el) { showFallback('无地图容器'); resolve('none'); return; }
      // Destroy previous leaflet if any
      if (leafletMap) {
        try { leafletMap.remove(); } catch (_) {}
        leafletMap = null;
      }
      el.innerHTML = '';
      leafletMap = L.map(el, { center: [36.5, 115.5], zoom: 7, zoomControl: true, maxZoom: 18 });
      leafletRoute = L.layerGroup().addTo(leafletMap);
      leafletMarkers = L.layerGroup().addTo(leafletMap);

      // ONE fast tile attempt (Gaode raster, GCJ) — 2.5s then list-safe
      const url = 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}';
      let got = false;
      const myLayer = L.tileLayer(url, {
        subdomains: '1234', maxZoom: 18, attribution: '&copy; 高德', crossOrigin: true
      });
      leafletTiles = myLayer;
      tileMode = 'gcj';
      myLayer.on('tileload', () => {
        if (got) return;
        got = true;
        hideFallback();
        setStatus('底图：Leaflet·高德瓦片 · GCJ-02', 'ok');
      });
      myLayer.addTo(leafletMap);
      engine = 'leaflet';
      setTimeout(() => {
        if (!got) {
          try { leafletMap.removeLayer(myLayer); } catch (_) {}
          tileMode = 'none';
          engine = 'leaflet';
          showFallback('Leaflet 瓦片超时。列表与抽屉仍可用。');
        }
      }, 2500);
      setTimeout(() => leafletMap && leafletMap.invalidateSize(), 80);
      resolve('leaflet');
    });
  }

  function clearOverlays() {
    if (engine === 'amap' && amapMap) {
      amapOverlays.forEach(o => { try { amapMap.remove(o); } catch (_) {} });
      amapOverlays = [];
    }
    if (engine === 'leaflet') {
      if (leafletMarkers) leafletMarkers.clearLayers();
      if (leafletRoute) leafletRoute.clearLayers();
    }
  }

  function toDisplay(place) {
    const c = place.coordinates || {};
    let lat = c.lat, lng = c.lng;
    if (tileMode === 'wgs' && (c.coordinate_system || 'GCJ-02') !== 'WGS-84') {
      const w = Coord.gcj02ToWgs84(lat, lng);
      lat = w.lat; lng = w.lng;
    }
    return { lat, lng };
  }

  function update(places, segments) {
    lastPlaces = places || [];
    lastSegments = segments || [];
    if (engine === 'none' || listOnly && engine !== 'amap' && engine !== 'leaflet') {
      // still allow marker-less; nothing to draw
    }
    clearOverlays();
    if (engine === 'amap' && amapMap) return updateAmap(lastPlaces, lastSegments);
    if (engine === 'leaflet' && leafletMap) return updateLeaflet(lastPlaces, lastSegments);
  }

  function updateAmap(places, segments) {
    const bounds = [];
    places.forEach(place => {
      const { lat, lng } = toDisplay(place);
      if (lat == null || lng == null) return;
      bounds.push([lng, lat]);
      const selected = place.place_id === selectedId;
      const marker = new amap.Marker({
        position: [lng, lat],
        title: place.name,
        content: markerContent(place, selected),
        offset: new amap.Pixel(-20, -20),
        extData: { id: place.place_id }
      });
      marker.on('click', () => {
        select(place.place_id, true);
        if (onSelect) onSelect(place.place_id, 'map');
      });
      amapMap.add(marker);
      amapOverlays.push(marker);
    });
    (segments || []).forEach(seg => {
      const coords = (seg.geometry && seg.geometry.coordinates) || [];
      if (coords.length < 2) return;
      const path = coords.map(c => [c[0], c[1]]);
      const style = seg.style || {};
      const line = new amap.Polyline({
        path,
        strokeColor: style.color || '#3d9cf0',
        strokeWeight: 4,
        strokeOpacity: 0.9,
        strokeStyle: style.dashArray ? 'dashed' : 'solid'
      });
      amapMap.add(line);
      amapOverlays.push(line);
    });
    if (bounds.length === 1) {
      amapMap.setZoomAndCenter(14, bounds[0]);
    } else if (bounds.length > 1) {
      amapMap.setFitView(amapOverlays, false, [60, 60, 60, 60]);
    }
  }

  function updateLeaflet(places, segments) {
    const latlngs = [];
    const lookup = {};
    places.forEach(place => {
      const { lat, lng } = toDisplay(place);
      if (lat == null || lng == null) return;
      const ll = [lat, lng];
      latlngs.push(ll);
      const selected = place.place_id === selectedId;
      const icon = L.divIcon({
        className: 'poi-divicon' + (selected ? ' marker-highlight' : ''),
        html: markerContent(place, selected),
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
      const m = L.marker(ll, { icon, title: place.name });
      m.on('click', () => {
        select(place.place_id, true);
        if (onSelect) onSelect(place.place_id, 'map');
      });
      leafletMarkers.addLayer(m);
      lookup[place.place_id] = m;
    });
    leafletMap._tripLookup = lookup;
    (segments || []).forEach(seg => {
      const coords = (seg.geometry && seg.geometry.coordinates) || [];
      const style = seg.style || {};
      const pts = coords.map(c => {
        let lat = c[1], lng = c[0];
        if (tileMode === 'wgs') {
          const w = Coord.gcj02ToWgs84(lat, lng);
          lat = w.lat; lng = w.lng;
        }
        return [lat, lng];
      });
      if (pts.length >= 2) {
        L.polyline(pts, { color: style.color || '#3d9cf0', weight: 3, opacity: 0.9, dashArray: style.dashArray || undefined }).addTo(leafletRoute);
      }
    });
    if (latlngs.length) {
      try { leafletMap.fitBounds(L.latLngBounds(latlngs).pad(0.25), { maxZoom: 14 }); } catch (_) {}
    }
    setTimeout(() => leafletMap.invalidateSize(), 50);
  }

  function select(placeId, pan) {
    selectedId = placeId;
    // re-render icons cheaply
    if (lastPlaces.length) update(lastPlaces, lastSegments);
    if (!placeId || !pan) return;
    const place = TripData.placeById(placeId);
    if (!place) return;
    const { lat, lng } = toDisplay(place);
    if (engine === 'amap' && amapMap) {
      amapMap.panTo([lng, lat]);
    } else if (engine === 'leaflet' && leafletMap) {
      leafletMap.panTo([lat, lng], { animate: true });
    }
  }

  function focus(placeId) { select(placeId, true); }
  function clearSelection() { selectedId = null; }

  function invalidateSize() {
    if (engine === 'amap' && amapMap) {
      try { amapMap.resize(); } catch (_) {}
    }
    if (engine === 'leaflet' && leafletMap) {
      leafletMap.invalidateSize();
    }
  }

  function remount(hostEl) {
    const mapEl = document.getElementById(containerId);
    if (!hostEl || !mapEl) return;
    if (mapEl.parentElement !== hostEl) hostEl.appendChild(mapEl);
    setTimeout(() => invalidateSize(), 60);
  }

  return {
    init, update, select, clearSelection, focus, invalidateSize, remount,
    get listOnly(){return listOnly;},
    get engine(){return engine;},
    get tileMode(){return tileMode;},
    get selectedId(){return selectedId;}
  };
})();

window.MapModule = MapModule;
