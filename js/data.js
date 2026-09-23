const TripData = (() => {
  let trip = null, days = [], places = [], visits = [], routes = null, weather = null, transport = null;
  let discoverLoaded = false;

  const TRIP_START = '2026-09-27';
  const TRIP_END = '2026-10-04';

  async function loadAll() {
    const base = 'data/';
    const [t, d, p, v, r, w, tr] = await Promise.all([
      fetch(base + 'trip.json').then(r => r.json()),
      fetch(base + 'days.json').then(r => r.json()),
      fetch(base + 'places.json').then(r => r.json()),
      fetch(base + 'visits.json').then(r => r.json()),
      fetch(base + 'routes.json').then(r => r.json()),
      fetch(base + 'weather.json').then(r => r.json()),
      fetch(base + 'transport.json').then(r => r.json()).catch(() => ({ legs: [] })),
    ]);
    trip = t; days = d; places = p; visits = v; routes = r; weather = w; transport = tr;
    return { trip, days, places, visits, routes, weather, transport };
  }

  function placeById(id) { return places.find(p => p.place_id === id); }
  function weatherForDate(date) {
    return (weather && weather.days || []).find(d => d.date === date) || null;
  }
  function dayById(dayId) {
    return days.find(d => d.day_id === dayId) || null;
  }
  function dayByDate(date) {
    return days.find(d => d.date === date) || null;
  }

  function isCandidate(place) {
    if (!place) return false;
    if (place.role === 'map_candidate') return true;
    const id = place.place_id || '';
    return id.startsWith('jn-map-');
  }

  function officialPlaces() {
    return places.filter(p => !isCandidate(p));
  }

  function candidatePlaces() {
    return places.filter(isCandidate);
  }

  /** Travel days only — never d-all */
  function travelDays() {
    return days.filter(d => d.date && d.day_id !== 'd-all');
  }

  /**
   * Default boot day (Asia/Shanghai calendar date):
   * before start → 09-27; within → today; after end → 10-04. Never d-all.
   */
  function defaultDayId(now = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const today = fmt.format(now); // YYYY-MM-DD
    if (today < TRIP_START) return 'd-' + TRIP_START;
    if (today > TRIP_END) return 'd-' + TRIP_END;
    const hit = dayByDate(today);
    return hit ? hit.day_id : 'd-' + TRIP_START;
  }

  function visitsForDate(date) {
    return visits.filter(v => v.date === date).sort((a, b) => a.sequence - b.sequence);
  }

  function visitsForDayId(dayId) {
    const day = dayById(dayId);
    if (!day || !day.date) return [];
    return visitsForDate(day.date);
  }

  /** Official places for a travel day, ordered by first visit sequence. */
  function placesForDay(dayId) {
    const vs = visitsForDayId(dayId);
    const seen = new Set();
    const list = [];
    vs.forEach(v => {
      if (seen.has(v.place_id)) return;
      const p = placeById(v.place_id);
      if (!p || isCandidate(p)) return;
      seen.add(v.place_id);
      list.push(p);
    });
    return list;
  }

  function activeVisit(placeId, dayId) {
    if (!placeId) return null;
    const day = dayById(dayId);
    if (!day || !day.date) return null;
    const vs = visits.filter(v => v.date === day.date && v.place_id === placeId)
      .sort((a, b) => a.sequence - b.sequence);
    return vs[0] || null;
  }

  function neighbors(placeId, dayId) {
    const list = placesForDay(dayId);
    const i = list.findIndex(p => p.place_id === placeId);
    return {
      prev: i > 0 ? list[i - 1] : null,
      next: i >= 0 && i < list.length - 1 ? list[i + 1] : null,
      index: i,
      total: list.length
    };
  }

  /** Next-segment geometry only (from current visit route_to_next / adjacent). */
  function nextSegment(fromPlaceId, dayId) {
    if (!routes || !routes.segments) return [];
    const day = dayById(dayId);
    const date = day && day.date;
    const visit = activeVisit(fromPlaceId, dayId);
    let toId = visit && visit.route_to_next && visit.route_to_next.to_place_id;
    if (!toId) {
      const n = neighbors(fromPlaceId, dayId);
      toId = n.next && n.next.place_id;
    }
    if (!toId) return [];
    return routes.segments.filter(s => {
      if (s.scope === 'whole_trip') return false;
      if (date && s.day && s.day !== date) return false;
      return s.from === fromPlaceId && s.to === toId;
    });
  }

  function daySegments(dayId) {
    if (!routes || !routes.segments) return [];
    const day = dayById(dayId);
    const date = day && day.date;
    const ids = new Set(placesForDay(dayId).map(p => p.place_id));
    return routes.segments.filter(s => {
      if (s.scope === 'whole_trip') return false;
      if (date && s.day && s.day !== date) return false;
      return ids.has(s.from) && ids.has(s.to);
    });
  }

  /**
   * Today status: where / next / depart / transit / do.
   * Uses Asia/Shanghai clock vs planned_start times.
   */
  function todayStatus(dayId, now = new Date()) {
    const day = dayById(dayId);
    const vs = visitsForDayId(dayId);
    const w = day && day.date ? weatherForDate(day.date) : null;
    const empty = {
      day, weather: w, whereLabel: '暂无行程', current: null, next: null, nextVisit: null,
      depart: '—', transit: '—', doWhat: '—', phase: 'empty'
    };
    if (!vs.length) return empty;

    const hm = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(now);
    const fmtDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(now);

    // Before trip / after trip relative to this day board
    let idx = -1;
    for (let i = 0; i < vs.length; i++) {
      const start = vs[i].planned_start || '00:00';
      if (hm >= start) idx = i;
    }

    // If viewing a future day (boot before trip), treat as pre-day
    const isFutureDay = day && day.date && fmtDate < day.date;
    const isPastDay = day && day.date && fmtDate > day.date;

    let phase, currentVisit = null, nextVisit = null;
    if (isFutureDay || (fmtDate === (day && day.date) && idx < 0)) {
      phase = 'before';
      nextVisit = vs[0];
    } else if (isPastDay || idx >= vs.length - 1) {
      phase = 'done';
      currentVisit = vs[vs.length - 1];
      nextVisit = null;
    } else {
      phase = 'in_progress';
      currentVisit = vs[idx];
      nextVisit = vs[idx + 1];
    }

    const current = currentVisit ? placeById(currentVisit.place_id) : null;
    const next = nextVisit ? placeById(nextVisit.place_id) : null;

    let whereLabel = '—';
    if (phase === 'before') whereLabel = '出发前 · 尚未开始本日';
    else if (phase === 'done') whereLabel = (current && (current.short_name || current.name)) || '本日已完成';
    else if (current) whereLabel = current.short_name || current.name;

    let depart = '—', transit = '—', doWhat = '—';
    if (nextVisit) {
      depart = nextVisit.planned_start || '—';
      const rt = (currentVisit && currentVisit.route_to_next) || null;
      // Prefer route from current → next; else from previous of next
      const prevOfNext = idx >= 0 ? vs[idx] : null;
      const edge = phase === 'before' ? null : (currentVisit && currentVisit.route_to_next);
      const info = edge || (phase === 'before' ? null : null);
      if (phase === 'before') {
        transit = '按时刻表前往首站';
      } else if (currentVisit && currentVisit.route_to_next) {
        const r = currentVisit.route_to_next;
        const parts = [];
        if (r.mode) parts.push(modeLabel(r.mode));
        if (r.duration_min != null) parts.push(r.duration_min + ' 分钟');
        if (r.distance_km != null) parts.push(r.distance_km + ' km');
        transit = parts.join(' · ') || '导航前往';
      } else {
        transit = '导航前往';
      }
      doWhat = nextVisit.activity || (next && next.description) || '抵达打卡';
    } else if (phase === 'done') {
      depart = '—';
      transit = '本日结束';
      doWhat = '休息 / 查看次日行程';
    }

    return {
      day, weather: w, phase, whereLabel,
      current, currentVisit, next, nextVisit,
      depart, transit, doWhat
    };
  }

  function modeLabel(m) {
    return ({ walk: '步行', drive: '驾车', taxi: '打车', transit: '公交', rail: '高铁', train: '火车', metro: '地铁' })[m] || m || '前往';
  }

  function transportForDate(date) {
    const legs = (transport && transport.legs) || [];
    if (!date) return legs;
    return legs.filter(l => l.date === date);
  }

  function markDiscoverLoaded() { discoverLoaded = true; }

  return {
    loadAll, placeById, weatherForDate, dayById, dayByDate,
    isCandidate, officialPlaces, candidatePlaces, travelDays,
    defaultDayId, visitsForDate, visitsForDayId, placesForDay,
    activeVisit, neighbors, nextSegment, daySegments, todayStatus,
    transportForDate, modeLabel, markDiscoverLoaded,
    get trip(){return trip;}, get days(){return days;}, get places(){return places;},
    get visits(){return visits;},
    get routes(){return routes;}, get weather(){return weather;}, get transport(){return transport;},
    get discoverLoaded(){return discoverLoaded;}
  };
})();

window.TripData = TripData;
