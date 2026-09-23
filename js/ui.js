const UI = (() => {
  let filter = 'd-all';
  let selectedId = null;
  let routeScope = 'day'; // day | all
  const ALL_CATS = ['HOTEL', 'FOOD', 'PHOTO', 'ACTIVITY', 'CONCERT', 'ATTRACTION', 'COFFEE', 'BAR', 'SHOPPING', 'TRANSPORT'];
  let enabledCats = new Set(ALL_CATS);

  function catLabel(c) {
    return ({
      HOTEL: '酒店', FOOD: '美食', PHOTO: '拍照', ACTIVITY: '活动', CONCERT: '演唱会',
      ATTRACTION: '景点', COFFEE: '咖啡', BAR: '酒吧', SHOPPING: '购物', TRANSPORT: '交通'
    })[c] || c;
  }

  function renderChips() {
    const host = document.getElementById('dayChips');
    const mob = document.getElementById('mobileDays');
    const html = TripData.days.map(d => {
      const active = filter === d.day_id ? 'active' : '';
      return `<button type="button" class="chip ${active}" data-day="${d.day_id}">${d.label}</button>`;
    }).join('');
    [host, mob].forEach(el => {
      if (!el) return;
      el.innerHTML = html;
      el.querySelectorAll('.chip').forEach(btn => {
        btn.addEventListener('click', () => setFilter(btn.dataset.day));
      });
    });

    const catHost = document.getElementById('catChips');
    if (catHost) {
      const present = new Set(TripData.places.map(p => p.category));
      catHost.innerHTML = ALL_CATS.filter(c => present.has(c)).map(c => {
        const on = enabledCats.has(c);
        return `<button type="button" class="chip cat ${on ? '' : 'off'}" data-cat="${c}">${catLabel(c)}</button>`;
      }).join('');
      catHost.querySelectorAll('.chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const c = btn.dataset.cat;
          if (enabledCats.has(c)) enabledCats.delete(c); else enabledCats.add(c);
          if (enabledCats.size === 0) enabledCats = new Set(ALL_CATS);
          renderChips();
          renderTimeline();
          refreshMap();
        });
      });
    }
  }

  function renderTransportStrip() {
    let strip = document.getElementById('transportStrip');
    if (!strip) {
      const pane = document.getElementById('timelinePane');
      if (!pane) return;
      strip = document.createElement('div');
      strip.id = 'transportStrip';
      strip.className = 'transport-strip';
      const title = pane.querySelector('.pane-title');
      if (title && title.nextSibling) pane.insertBefore(strip, title.nextSibling);
      else pane.insertBefore(strip, pane.firstChild);
    }
    const day = TripData.dayByFilter(filter);
    const legs = (TripData.transport && TripData.transport.legs) || [];
    // P1-01: specific date with no legs → 「今日无跨城交通」
    if (day && day.date) {
      const relevant = legs.filter(l => l.date === day.date);
      if (!relevant.length) {
        strip.innerHTML = '<strong>今日无跨城交通</strong>';
        return;
      }
      strip.innerHTML = relevant.map(l =>
        `<div><strong>${l.train}</strong> ${l.date} ${l.from}→${l.to} ${l.dep || ''}-${l.arr || ''} · ${l.pax || '?'}人 · ${l.purchase_status || ''}</div>`
      ).join('');
      return;
    }
    // d-all: show all locked legs
    if (!legs.length) {
      strip.innerHTML = '<strong>锁定车次</strong> G904 · G1832 · G2076 · G689+G399';
      return;
    }
    strip.innerHTML = legs.map(l =>
      `<div><strong>${l.train}</strong> ${l.date} ${l.from}→${l.to} ${l.dep || ''}-${l.arr || ''} · ${l.pax || '?'}人 · ${l.purchase_status || ''}</div>`
    ).join('');
  }

  function renderTimeline() {
    renderTransportStrip();
    const list = document.getElementById('timeline');
    if (!list) return;
    const vs = TripData.visitsForFilter(filter).filter(v => {
      const p = TripData.placeById(v.place_id);
      return p && enabledCats.has(p.category);
    });
    const color = {
      HOTEL: '#6aa8ff', FOOD: '#ff8f5a', PHOTO: '#c084fc', CONCERT: '#f472b6',
      ATTRACTION: '#22d3ee', TRANSPORT: '#94a3b8', ACTIVITY: '#34d399'
    };
    list.innerHTML = vs.map((v, idx) => {
      const p = TripData.placeById(v.place_id);
      if (!p) return '';
      const active = p.place_id === selectedId ? 'active' : '';
      const t = v.planned_start || '';
      const optMark = v.optional ? ' <span style="opacity:.7;font-size:11px">可选</span>' : '';
      return `<li class="tl-item ${active}" data-id="${p.place_id}" data-visit="${v.visit_id || ''}">
        <div class="tl-ord" style="background:${color[p.category] || '#64748b'}">${idx + 1}</div>
        <div>
          <div class="tl-name">${p.short_name || p.name}${optMark}</div>
          <div class="tl-meta">${catLabel(p.category)}${t ? ' · ' + t : ''}</div>
        </div>
      </li>`;
    }).join('') || '<li class="tl-meta">当前筛选无地点</li>';
    list.querySelectorAll('.tl-item').forEach(el => {
      el.addEventListener('click', () => selectPlace(el.dataset.id, 'timeline'));
      el.addEventListener('mouseenter', () => MapModule.select(el.dataset.id, false));
    });
    syncMobileSheet();
  }

  function imgFallbackNode(place) {
    const div = document.createElement('div');
    div.className = 'img-fallback';
    div.textContent = catLabel(place.category) + ' · ' + (place.short_name || place.name);
    return div;
  }

  function openLightbox(src, cap) {
    const box = document.getElementById('lightbox');
    document.getElementById('lightboxImg').src = src;
    document.getElementById('lightboxCap').textContent = cap || '';
    box.hidden = false;
  }

  function renderDetail(place) {
    const empty = document.getElementById('detailEmpty');
    const body = document.getElementById('detailBody');
    if (!place) {
      if (empty) empty.hidden = false;
      if (body) body.hidden = true;
      syncMobileSheet();
      return;
    }
    if (empty) empty.hidden = true;
    if (body) body.hidden = false;
    document.getElementById('detailCat').textContent = catLabel(place.category);
    document.getElementById('detailName').textContent = place.name;
    document.getElementById('detailAddr').textContent = place.address || '';
    document.getElementById('detailDesc').textContent = place.description || '';

    const visit = TripData.activeVisit(place.place_id, filter);
    const wDate = (visit && visit.weather_ref) || (TripData.dayByFilter(filter) || {}).date;
    const dayW = TripData.weatherForDate(wDate);
    document.getElementById('detailWeather').textContent = '天气：' + ((dayW && (dayW.condition || dayW.summary)) || '—');

    let timeText = '—';
    if (visit && (visit.planned_start || visit.planned_end)) {
      timeText = [visit.planned_start, visit.planned_end].filter(Boolean).join('–');
    }
    document.getElementById('detailTime').textContent = '时间：' + timeText;
    document.getElementById('detailPrice').textContent = place.price ? ('费用：' + place.price) : '费用：—';

    let nextPlace = null;
    if (visit && visit.route_to_next && visit.route_to_next.to_place_id) {
      nextPlace = TripData.placeById(visit.route_to_next.to_place_id);
    }
    if (!nextPlace) {
      const nav = TripData.neighbors(place.place_id, filter, enabledCats);
      nextPlace = nav.next;
    }
    document.getElementById('detailNext').textContent = nextPlace
      ? (`下一站 → ${nextPlace.short_name || nextPlace.name}`)
      : '下一站 → 本日/筛选结束';

    const gal = document.getElementById('detailGallery');
    gal.innerHTML = '';
    const imgs = (place.images || []).filter(i => i.image_file);
    if (!imgs.length) {
      gal.appendChild(imgFallbackNode(place));
    } else {
      imgs.forEach(im => {
        const el = document.createElement('img');
        el.src = im.image_file;
        el.alt = im.caption || place.name;
        el.loading = 'lazy';
        el.addEventListener('error', () => el.replaceWith(imgFallbackNode(place)));
        el.addEventListener('click', () => openLightbox(im.image_file, im.caption || place.name));
        gal.appendChild(el);
      });
    }
    syncMobileSheet();
  }

  function syncMobileSheet() {
    const host = document.getElementById('mobileSheetContent');
    if (!host) return;
    const vs = TripData.visitsForFilter(filter).filter(v => {
      const p = TripData.placeById(v.place_id);
      return p && enabledCats.has(p.category);
    });
    const place = selectedId ? TripData.placeById(selectedId) : null;
    let html = '<ol class="timeline">';
    vs.forEach((v, idx) => {
      const p = TripData.placeById(v.place_id);
      if (!p) return;
      html += `<li class="tl-item ${p.place_id === selectedId ? 'active' : ''}" data-id="${p.place_id}">
        <div class="tl-ord" style="background:#3d9cf0">${idx + 1}</div>
        <div><div class="tl-name">${p.short_name || p.name}</div>
        <div class="tl-meta">${catLabel(p.category)}${v.planned_start ? ' · ' + v.planned_start : ''}</div></div></li>`;
    });
    html += '</ol>';
    if (place) {
      const visit = TripData.activeVisit(place.place_id, filter);
      const dayW = TripData.weatherForDate(visit && visit.weather_ref);
      html += `<div style="margin-top:10px;padding:10px;background:#232d3a;border-radius:12px">
        <div class="detail-kicker">${catLabel(place.category)}</div>
        <strong>${place.name}</strong>
        <p class="detail-desc">${place.description || ''}</p>
        <div class="detail-meta"><span>${(dayW && dayW.condition) || ''}</span></div>
      </div>`;
    }
    host.innerHTML = html;
    host.querySelectorAll('.tl-item').forEach(el => {
      el.addEventListener('click', () => selectPlace(el.dataset.id, 'timeline'));
    });
  }

  function refreshMap() {
    const places = TripData.placesForFilter(filter, enabledCats);
    const ids = places.map(p => p.place_id);
    const day = TripData.dayByFilter(filter);
    const dayDate = routeScope === 'all' ? null : (day && day.date);
    let segs;
    if (routeScope === 'all') {
      segs = TripData.routeSegmentsFor(ids, 'all', null);
    } else {
      segs = TripData.routeSegmentsFor(ids, 'day', dayDate || null);
    }
    MapModule.update(places, segs);
    if (selectedId) MapModule.select(selectedId, false);
  }

  function setFilter(dayId) {
    filter = dayId;
    const visiblePlaces = TripData.placesForFilter(filter, enabledCats);
    const visibleIds = new Set(visiblePlaces.map(p => p.place_id));
    // P0-02: if selected not in visible → select first visit of that day (or clear)
    if (selectedId && !visibleIds.has(selectedId)) {
      if (visiblePlaces.length) {
        selectedId = visiblePlaces[0].place_id;
        MapModule.select(selectedId, false);
        renderDetail(TripData.placeById(selectedId));
      } else {
        selectedId = null;
        if (MapModule.clearSelection) MapModule.clearSelection();
        MapModule.select(null, false);
        renderDetail(null);
      }
    } else if (selectedId) {
      renderDetail(TripData.placeById(selectedId));
    }
    renderChips();
    renderTimeline();
    refreshMap();
  }

  function selectPlace(id, source) {
    selectedId = id;
    renderTimeline();
    renderDetail(TripData.placeById(id));
    MapModule.focus(id);
  }

  function bindMobileNav() {
    const shell = document.getElementById('mobileShell');
    const nav = document.getElementById('bottomNav');
    if (!shell || !nav) return;
    nav.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        nav.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        shell.classList.remove('tab-map', 'tab-timeline', 'tab-places');
        shell.classList.add('tab-' + btn.dataset.tab);
        if (btn.dataset.tab === 'map') {
          MapModule.remount(document.getElementById('mapMobileHost'));
          MapModule.invalidateSize();
        }
      });
    });
  }

  function mountMapForViewport() {
    const mobile = window.matchMedia('(max-width: 820px)').matches;
    const desktopMap = document.getElementById('map');
    const mobileHost = document.getElementById('mapMobileHost');
    if (mobile) {
      if (desktopMap && mobileHost && desktopMap.parentElement !== mobileHost) {
        mobileHost.appendChild(desktopMap);
      }
    } else {
      const pane = document.querySelector('.map-pane') || document.querySelector('.map-pane');
      if (pane && desktopMap && desktopMap.parentElement !== pane) {
        pane.insertBefore(desktopMap, pane.firstChild);
      }
    }
    MapModule.invalidateSize();
  }

  function bindExtras() {
    document.getElementById('btnRouteDay')?.addEventListener('click', () => {
      routeScope = 'day';
      document.getElementById('btnRouteDay').classList.add('active');
      document.getElementById('btnRouteAll')?.classList.remove('active');
      refreshMap();
    });
    document.getElementById('btnRouteAll')?.addEventListener('click', () => {
      routeScope = 'all';
      document.getElementById('btnRouteAll').classList.add('active');
      document.getElementById('btnRouteDay')?.classList.remove('active');
      refreshMap();
    });
    document.getElementById('btnPrevPlace')?.addEventListener('click', () => {
      if (!selectedId) return;
      const n = TripData.neighbors(selectedId, filter, enabledCats);
      if (n.prev) selectPlace(n.prev.place_id, 'prev');
    });
    document.getElementById('btnNextPlace')?.addEventListener('click', () => {
      if (!selectedId) return;
      const n = TripData.neighbors(selectedId, filter, enabledCats);
      if (n.next) selectPlace(n.next.place_id, 'next');
    });
    document.getElementById('lightboxClose')?.addEventListener('click', () => {
      document.getElementById('lightbox').hidden = true;
    });
    document.getElementById('lightbox')?.addEventListener('click', (e) => {
      if (e.target.id === 'lightbox') e.currentTarget.hidden = true;
    });
  }

  function initChrome(trip) {
    const nameEl = document.getElementById('tripName');
    const routeEl = document.getElementById('tripRoute');
    if (nameEl) nameEl.textContent = trip.name || 'TRIP2609';
    if (routeEl) routeEl.textContent = trip.route || '';
    renderChips();
    renderTimeline();
    renderDetail(null);
    bindMobileNav();
    bindExtras();
    mountMapForViewport();
    window.addEventListener('resize', () => {
      mountMapForViewport();
      MapModule.invalidateSize();
    });
    window.__tripConsoleRefresh = refreshMap;
  }

  return {
    initChrome, setFilter, selectPlace, refreshMap,
    get filter() { return filter; },
    get selectedId() { return selectedId; }
  };
})();
