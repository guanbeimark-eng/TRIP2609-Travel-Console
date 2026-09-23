const UI = (() => {
  let tab = 'today';
  let dayId = null;
  let selectedId = null;
  let discoverReady = false;

  function catLabel(c) {
    return ({
      HOTEL: '酒店', FOOD: '美食', PHOTO: '拍照', ACTIVITY: '活动', CONCERT: '演唱会',
      ATTRACTION: '景点', COFFEE: '咖啡', BAR: '酒吧', SHOPPING: '购物', TRANSPORT: '交通'
    })[c] || c;
  }

  function setTab(name) {
    tab = name;
    document.querySelectorAll('#primaryTabs [data-tab]').forEach(btn => {
      const on = btn.dataset.tab === name;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('#bottomNav [data-mtab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mtab === name);
    });
    ['overview', 'today', 'itinerary', 'discover'].forEach(v => {
      const el = document.getElementById('view' + v.charAt(0).toUpperCase() + v.slice(1));
      if (el) el.hidden = v !== name;
    });
    // Map host remount
    const mapEl = document.getElementById('map');
    if (name === 'today') {
      const pane = document.querySelector('#viewToday .map-pane');
      if (pane && mapEl && mapEl.parentElement !== pane) {
        pane.insertBefore(mapEl, pane.querySelector('.map-fallback') || null);
        if (!pane.contains(mapEl)) pane.appendChild(mapEl);
      }
      renderToday();
      refreshTodayMap();
    } else if (name === 'itinerary') {
      MapModule.remount(document.getElementById('mapItinHost'));
      renderItinerary();
      refreshItinMap();
    } else if (name === 'discover') {
      ensureDiscover().then(() => {
        MapModule.remount(document.getElementById('mapDiscoverHost'));
        renderDiscover();
        refreshDiscoverMap();
      });
    } else if (name === 'overview') {
      renderOverview();
    }
    setTimeout(() => MapModule.invalidateSize(), 80);
  }

  function setDay(id) {
    if (!id || id === 'd-all') {
      id = TripData.defaultDayId();
    }
    dayId = id;
    closeDrawer();
    if (tab === 'today') {
      renderToday();
      refreshTodayMap();
    } else if (tab === 'itinerary') {
      renderItinerary();
      refreshItinMap();
    }
  }

  /* ---------- Overview ---------- */
  function renderOverview() {
    const t = TripData.trip || {};
    document.getElementById('ovRoute').textContent = t.route || '';
    const d = t.dates || {};
    document.getElementById('ovDates').textContent = (d.start || '') + ' → ' + (d.end || '') + ' · Asia/Shanghai';
    const party = t.party || {};
    document.getElementById('ovParty').textContent =
      '同行：' + (party.through_2026_10_03_overnight || party['through_2026-10-03_overnight'] || '') +
      '；返程 ' + (party['2026-10-04_return'] || '');
    document.getElementById('ovAxis').textContent = t.axis_note || '';
    const nodes = [];
    (t.locked_trains || []).forEach(tr => nodes.push({ kind: '列车', text: tr }));
    (t.hotels || []).forEach(h => nodes.push({ kind: '酒店', text: h.name + (h.poi_id ? ' · ' + h.poi_id : '') }));
    if (t.concert) nodes.push({ kind: '演唱会', text: (t.concert.venue || '') + ' · ' + (t.concert.datetime || '') });
    document.getElementById('ovHardNodes').innerHTML = nodes.map(n =>
      `<li><span class="hn-kind">${n.kind}</span>${n.text}</li>`
    ).join('');
  }

  /* ---------- Today ---------- */
  function renderToday() {
    const st = TripData.todayStatus(dayId);
    const day = st.day;
    const label = document.getElementById('todayDateLabel');
    if (label) {
      label.textContent = (day && day.label ? day.label : '') +
        (day && day.theme ? ' · ' + day.theme : '') +
        (day && day.city ? ' · ' + day.city : '');
    }
    const wEl = document.getElementById('todayWeather');
    if (wEl) {
      const w = st.weather;
      wEl.textContent = w
        ? ('天气：' + (w.condition || w.summary || '—') + (w.gear ? ' · ' + w.gear : ''))
        : '天气：—';
    }
    document.getElementById('todayWhere').textContent = st.whereLabel || '—';
    const nextName = st.next ? (st.next.short_name || st.next.name) : (st.phase === 'done' ? '本日结束' : '—');
    document.getElementById('todayNext').textContent = nextName;
    document.getElementById('todayNextWhy').textContent = st.next
      ? (st.next.description || catLabel(st.next.category))
      : '';
    document.getElementById('todayDepart').textContent = st.depart;
    document.getElementById('todayTransit').textContent = st.transit;
    document.getElementById('todayDo').textContent = st.doWhat;
    const navHost = document.getElementById('todayNav');
    if (navHost) {
      const target = st.next || st.current;
      navHost.innerHTML = target ? NavLinks.buttonsHtml(target) : '';
    }
    const chip = document.getElementById('mapTopChip');
    if (chip) {
      chip.innerHTML = `<span>${day && day.label ? day.label : ''}</span>` +
        `<span>${(st.weather && (st.weather.condition || '')) || ''}</span>`;
    }
    // transport
    const strip = document.getElementById('todayTransport');
    if (strip) {
      const legs = TripData.transportForDate(day && day.date);
      if (!legs.length) strip.innerHTML = '<strong>今日无跨城交通</strong>';
      else strip.innerHTML = legs.map(l =>
        `<div><strong>${l.train}</strong> ${l.from}→${l.to} ${l.dep || ''}-${l.arr || ''} · ${l.pax || '?'}人</div>`
      ).join('');
    }
  }

  function refreshTodayMap() {
    const st = TripData.todayStatus(dayId);
    const places = [];
    if (st.current) places.push(st.current);
    if (st.next && (!st.current || st.next.place_id !== st.current.place_id)) places.push(st.next);
    // If before day start, show first stop only (next)
    if (!places.length) {
      const list = TripData.placesForDay(dayId);
      if (list[0]) places.push(list[0]);
    }
    const fromId = (st.current && st.current.place_id) || (places[0] && places[0].place_id);
    const segs = fromId ? TripData.nextSegment(fromId, dayId) : [];
    MapModule.update(places, segs);
    const focusId = (st.next && st.next.place_id) || (st.current && st.current.place_id);
    if (focusId) MapModule.select(focusId, false);
  }

  /* ---------- Itinerary ---------- */
  function renderItinerary() {
    const host = document.getElementById('dayPick');
    if (host) {
      host.innerHTML = TripData.travelDays().map(d =>
        `<button type="button" class="chip ${d.day_id === dayId ? 'active' : ''}" data-day="${d.day_id}">${d.label}<span class="chip-sub">${d.city || ''}</span></button>`
      ).join('');
      host.querySelectorAll('.chip').forEach(btn => {
        btn.addEventListener('click', () => setDay(btn.dataset.day));
      });
    }
    const day = TripData.dayById(dayId);
    const strip = document.getElementById('itinTransport');
    if (strip) {
      const legs = TripData.transportForDate(day && day.date);
      if (!legs.length) strip.innerHTML = '<strong>今日无跨城交通</strong>';
      else strip.innerHTML = legs.map(l =>
        `<div><strong>${l.train}</strong> ${l.from}→${l.to} ${l.dep || ''}-${l.arr || ''}</div>`
      ).join('');
    }
    const list = document.getElementById('timeline');
    if (!list) return;
    const vs = TripData.visitsForDayId(dayId);
    const color = {
      HOTEL: '#6aa8ff', FOOD: '#ff8f5a', PHOTO: '#c084fc', CONCERT: '#f472b6',
      ATTRACTION: '#22d3ee', TRANSPORT: '#94a3b8', ACTIVITY: '#34d399'
    };
    list.innerHTML = vs.map((v, idx) => {
      const p = TripData.placeById(v.place_id);
      if (!p || TripData.isCandidate(p)) return '';
      return `<li class="tl-item ${p.place_id === selectedId ? 'active' : ''}" data-id="${p.place_id}">
        <div class="tl-ord" style="background:${color[p.category] || '#64748b'}">${idx + 1}</div>
        <div>
          <div class="tl-name">${p.short_name || p.name}${v.optional ? ' <span class="opt">可选</span>' : ''}</div>
          <div class="tl-meta">${catLabel(p.category)}${v.planned_start ? ' · ' + v.planned_start : ''}</div>
        </div>
      </li>`;
    }).join('') || '<li class="tl-meta">本日无行程点</li>';
    list.querySelectorAll('.tl-item').forEach(el => {
      el.addEventListener('click', () => openPlace(el.dataset.id, 'timeline'));
    });
  }

  function refreshItinMap() {
    const places = TripData.placesForDay(dayId);
    // Slim: full day markers OK on itinerary tab; geometry = day segments
    const segs = TripData.daySegments(dayId);
    MapModule.update(places, segs);
    if (selectedId) MapModule.select(selectedId, false);
  }

  /* ---------- Discover (deferred) ---------- */
  async function ensureDiscover() {
    if (discoverReady) return;
    discoverReady = true;
    TripData.markDiscoverLoaded();
  }

  function renderDiscover() {
    const list = document.getElementById('discoverList');
    if (!list) return;
    const cands = TripData.candidatePlaces();
    list.innerHTML = cands.map((p, idx) =>
      `<li class="tl-item ${p.place_id === selectedId ? 'active' : ''}" data-id="${p.place_id}">
        <div class="tl-ord" style="background:#94a3b8">${idx + 1}</div>
        <div>
          <div class="tl-name">${p.short_name || p.name}</div>
          <div class="tl-meta">${catLabel(p.category)} · 候选</div>
        </div>
      </li>`
    ).join('') || '<li class="tl-meta">暂无候选</li>';
    list.querySelectorAll('.tl-item').forEach(el => {
      el.addEventListener('click', () => openPlace(el.dataset.id, 'discover'));
    });
  }

  function refreshDiscoverMap() {
    const cands = TripData.candidatePlaces();
    MapModule.update(cands, []);
  }

  /* ---------- Drawer ---------- */
  function openPlace(id, source) {
    selectedId = id;
    const place = TripData.placeById(id);
    if (!place) return;
    MapModule.focus(id);
    openDrawer(place);
    if (tab === 'itinerary') renderItinerary();
    if (tab === 'discover') renderDiscover();
  }

  function openDrawer(place) {
    const drawer = document.getElementById('drawer');
    const backdrop = document.getElementById('drawerBackdrop');
    const body = document.getElementById('drawerBody');
    if (!drawer || !body) return;

    const visit = TripData.activeVisit(place.place_id, dayId);
    const day = TripData.dayById(dayId);
    const wDate = (visit && visit.weather_ref) || (day && day.date);
    const dayW = TripData.weatherForDate(wDate);
    let timeText = '—';
    if (visit && (visit.planned_start || visit.planned_end)) {
      timeText = [visit.planned_start, visit.planned_end].filter(Boolean).join('–');
    }
    let nextPlace = null;
    if (visit && visit.route_to_next && visit.route_to_next.to_place_id) {
      nextPlace = TripData.placeById(visit.route_to_next.to_place_id);
    }
    if (!nextPlace) {
      const n = TripData.neighbors(place.place_id, dayId);
      nextPlace = n.next;
    }

    // Images: thumb in list strip; full on open (use full paths here)
    const imgs = (place.images || []).filter(i => i.image_file);
    let gal = '';
    if (imgs.length) {
      gal = '<div class="drawer-gal">' + imgs.map(im =>
        `<img data-full="${im.image_file}" src="${im.image_file}" alt="${im.caption || place.name}" loading="lazy"/>`
      ).join('') + '</div>';
    } else {
      gal = `<div class="img-fallback">${catLabel(place.category)} · ${place.short_name || place.name}</div>`;
    }

    const why = place.description || (visit && visit.activity) || '行程推荐点';
    body.innerHTML = `
      ${gal}
      <div class="detail-kicker">${catLabel(place.category)}${TripData.isCandidate(place) ? ' · 候选' : ''}</div>
      <h3>${place.name}</h3>
      <p class="detail-addr">${place.address || ''}</p>
      <p class="detail-desc"><strong>为何推荐：</strong>${why}</p>
      <div class="detail-meta">
        <span>时间：${timeText}</span>
        <span>天气：${(dayW && (dayW.condition || dayW.summary)) || '—'}</span>
        <span>评分：${place.rating_summary || '—'}</span>
        <span>费用：${place.price || '—'}</span>
      </div>
      <div class="detail-next">下一站 → ${nextPlace ? (nextPlace.short_name || nextPlace.name) : '本日结束'}</div>
      ${NavLinks.buttonsHtml(place)}
    `;
    body.querySelectorAll('.drawer-gal img').forEach(img => {
      img.addEventListener('click', () => openLightbox(img.dataset.full || img.src, img.alt));
    });

    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    drawer.classList.add('open');
    if (backdrop) { backdrop.hidden = false; backdrop.classList.add('open'); }
  }

  function closeDrawer() {
    const drawer = document.getElementById('drawer');
    const backdrop = document.getElementById('drawerBackdrop');
    if (drawer) {
      drawer.classList.remove('open');
      drawer.hidden = true;
      drawer.setAttribute('aria-hidden', 'true');
    }
    if (backdrop) {
      backdrop.classList.remove('open');
      backdrop.hidden = true;
    }
  }

  function openLightbox(src, cap) {
    const box = document.getElementById('lightbox');
    document.getElementById('lightboxImg').src = src;
    document.getElementById('lightboxCap').textContent = cap || '';
    box.hidden = false;
  }

  function bindChrome() {
    document.querySelectorAll('#primaryTabs [data-tab]').forEach(btn => {
      btn.addEventListener('click', () => setTab(btn.dataset.tab));
    });
    document.querySelectorAll('#bottomNav [data-mtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.mtab;
        // Mobile: 地图 = today
        setTab(t === 'map' ? 'today' : t);
      });
    });
    document.getElementById('drawerClose')?.addEventListener('click', closeDrawer);
    document.getElementById('drawerBackdrop')?.addEventListener('click', closeDrawer);
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
    dayId = TripData.defaultDayId();
    bindChrome();
    renderOverview();
    renderToday();
    // Do NOT render discover or all-day markers on boot
  }

  return {
    initChrome, setTab, setDay, openPlace, closeDrawer, renderToday, refreshTodayMap,
    get tab(){return tab;}, get dayId(){return dayId;}, get selectedId(){return selectedId;}
  };
})();

window.UI = UI;
