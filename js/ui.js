const UI = (() => {
  let filter = 'd-all';
  let selectedId = null;
  let routeScope = 'day'; // day | all
  const ALL_CATS = ['HOTEL','FOOD','PHOTO','ACTIVITY','CONCERT','ATTRACTION','COFFEE','BAR','SHOPPING','TRANSPORT'];
  let enabledCats = new Set(ALL_CATS);

  function catLabel(c) {
    return ({
      HOTEL:'酒店', FOOD:'美食', PHOTO:'拍照', ACTIVITY:'活动', CONCERT:'演唱会',
      ATTRACTION:'景点', COFFEE:'咖啡', BAR:'酒吧', SHOPPING:'购物', TRANSPORT:'交通'
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
      el.querySelectorAll('.chip').forEach(btn => btn.addEventListener('click', () => setFilter(btn.dataset.day)));
    });

    const catHost = document.getElementById('catChips');
    if (catHost) {
      const present = new Set(TripData.places.map(p => p.category));
      catHost.innerHTML = ALL_CATS.filter(c => present.has(c)).map(c => {
        const on = enabledCats.has(c);
        return `<button type="button" class="chip cat ${on?'':'off'}" data-cat="${c}">${catLabel(c)}</button>`;
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
    // inject into timeline pane top
    let strip = document.getElementById('transportStrip');
    if (!strip) {
      const pane = document.getElementById('timelinePane');
      if (!pane) return;
      strip = document.createElement('div');
      strip.id = 'transportStrip';
      strip.className = 'transport-strip';
      pane.insertBefore(strip, pane.querySelector('.pane-title')?.nextSibling || pane.firstChild);
    }
    const day = TripData.dayByFilter(filter);
    const legs = (TripData.transport && TripData.transport.legs) || [];
    const relevant = day && day.date ? legs.filter(l => l.date === day.date) : legs;
    if (!relevant.length) {
      strip.innerHTML = '<strong>锁定车次</strong> G904 · G1832 · G2076 · G689+G399';
      return;
    }
    strip.innerHTML = relevant.map(l =>
      `<div><strong>${l.train}</strong> ${l.date} ${l.from}→${l.to} ${l.dep||''}-${l.arr||''} · ${l.pax||'?'}人 · ${l.purchase_status||''}</div>`
    ).join('');
  }

  function renderTimeline() {
    renderTransportStrip();
    const list = document.getElementById('timeline');
    const places = TripData.placesForFilter(filter, enabledCats);
    const color = {
      HOTEL:'#6aa8ff', FOOD:'#ff8f5a', PHOTO:'#c084fc', CONCERT:'#f472b6',
      ATTRACTION:'#22d3ee', TRANSPORT:'#94a3b8', ACTIVITY:'#34d399'
    };
    list.innerHTML = places.map((p, idx) => {
      const active = p.place_id === selectedId ? 'active' : '';
      const t = (p.times && (p.times.show || p.times.planned || p.times.planned_start || p.times.day_start || p.times.arrive)) || '';
      return `<li class="tl-item ${active}" data-id="${p.place_id}">
        <div class="tl-ord" style="background:${color[p.category]||'#64748b'}">${idx+1}</div>
        <div>
          <div class="tl-name">${p.short_name || p.name}</div>
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
      empty.hidden = false; body.hidden = true; syncMobileSheet(); return;
    }
    empty.hidden = true; body.hidden = false;
    document.getElementById('detailCat').textContent = catLabel(place.category);
    document.getElementById('detailName').textContent = place.name;
    document.getElementById('detailAddr').textContent = place.address || '';
    document.getElementById('detailDesc').textContent = place.description || '';
    const w = place.weather || {};
    const dayW = TripData.weatherForDate(w.date);
    document.getElementById('detailWeather').textContent = '天气：' + (w.summary || (dayW && dayW.condition) || '—');
    const t = place.times || {};
    document.getElementById('detailTime').textContent = '时间：' + (t.show || t.planned || t.doors || t.arrive || t.planned_start || '—');
    document.getElementById('detailPrice').textContent = place.price ? ('费用：' + place.price) : '费用：—';

    const nav = TripData.neighbors(place.place_id, filter, enabledCats);
    const next = nav.next || (place.next_place_id ? TripData.placeById(place.next_place_id) : null);
    document.getElementById('detailNext').textContent = next
      ? (`下一站 → ${next.short_name || next.name}`)
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
    const places = TripData.placesForFilter(filter, enabledCats);
    const place = selectedId ? TripData.placeById(selectedId) : null;
    let html = '<ol class="timeline">';
    places.forEach((p, idx) => {
      html += `<li class="tl-item ${p.place_id===selectedId?'active':''}" data-id="${p.place_id}">
        <div class="tl-ord" style="background:#3d9cf0">${idx+1}</div>
        <div><div class="tl-name">${p.short_name||p.name}</div>
        <div class="tl-meta">${catLabel(p.category)}</div></div></li>`;
    });
    html += '</ol>';
    if (place) {
      html += `<div style="margin-top:10px;padding:10px;background:#232d3a;border-radius:12px">
        <div class="detail-kicker">${catLabel(place.category)}</div>
        <strong>${place.name}</strong>
        <p class="detail-desc">${place.description||''}</p>
        <div class="detail-meta"><span>${(place.weather&&place.weather.summary)||''}</span></div>
      </div>`;
    }
    host.innerHTML = html;
    host.querySelectorAll('.tl-item').forEach(el => el.addEventListener('click', () => selectPlace(el.dataset.id, 'timeline')));
  }

  function refreshMap() {
    const places = TripData.placesForFilter(filter, enabledCats);
    const ids = places.map(p => p.place_id);
    const day = TripData.dayByFilter(filter);
    const dayDate = routeScope === 'all' ? null : (day && day.date);
    const scope = (filter === 'd-all' && routeScope === 'day') ? 'day' : routeScope;
    // when "全部" + day scope: show all day segments among visible places
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
    document.getElementById('bottomNav').querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('bottomNav').querySelectorAll('button').forEach(b => b.classList.remove('active'));
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
      const pane = document.querySelector('.map-pane');
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
      document.getElementById('btnRouteAll').classList.remove('active');
      refreshMap();
    });
    document.getElementById('btnRouteAll')?.addEventListener('click', () => {
      routeScope = 'all';
      document.getElementById('btnRouteAll').classList.add('active');
      document.getElementById('btnRouteDay').classList.remove('active');
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
    document.getElementById('tripName').textContent = trip.name || 'TRIP2609';
    document.getElementById('tripRoute').textContent = trip.route || '';
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
    get filter(){return filter;}, get selectedId(){return selectedId;}
  };
})();
