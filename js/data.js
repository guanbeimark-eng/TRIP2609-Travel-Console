const TripData = (() => {
  let trip = null, days = [], places = [], visits = [], routes = null, weather = null, transport = null;

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
  function dayByFilter(filter) {
    return days.find(d => d.day_id === filter || d.date === filter) || days[0];
  }

  function visitsForFilter(filter) {
    const day = dayByFilter(filter);
    if (!day || day.day_id === 'd-all' || !day.date) {
      return visits.slice().sort((a, b) =>
        (a.date + String(a.sequence).padStart(3, '0')).localeCompare(b.date + String(b.sequence).padStart(3, '0'))
      );
    }
    return visits.filter(v => v.date === day.date).sort((a, b) => a.sequence - b.sequence);
  }

  /** Unique places for a filter, ordered by first visit sequence that day (or trip). */
  function placesForFilter(filter, catSet) {
    const vs = visitsForFilter(filter);
    const seen = new Set();
    const list = [];
    vs.forEach(v => {
      if (seen.has(v.place_id)) return;
      const p = placeById(v.place_id);
      if (!p) return;
      seen.add(v.place_id);
      list.push(p);
    });
    // Fallback if visits empty for some reason
    if (!list.length) {
      const day = dayByFilter(filter);
      if (day && day.place_ids) {
        day.place_ids.forEach(id => {
          const p = placeById(id);
          if (p) list.push(p);
        });
      } else {
        list.push(...places);
      }
    }
    return catSet ? list.filter(p => catSet.has(p.category)) : list;
  }

  /** Active visit for a place under current filter (for detail card times/weather/next). */
  function activeVisit(placeId, filter) {
    if (!placeId) return null;
    const day = dayByFilter(filter);
    if (day && day.date) {
      const vs = visits.filter(v => v.date === day.date && v.place_id === placeId)
        .sort((a, b) => a.sequence - b.sequence);
      return vs[0] || null;
    }
    // d-all: first visit of this place chronologically
    const vs = visits.filter(v => v.place_id === placeId)
      .sort((a, b) => (a.date + String(a.sequence).padStart(3, '0')).localeCompare(b.date + String(b.sequence).padStart(3, '0')));
    return vs[0] || null;
  }

  function routeSegmentsFor(placeIds, scope, dayDate) {
    if (!routes || !routes.segments) return [];
    const set = new Set(placeIds);
    if (scope === 'all') {
      return routes.segments.filter(s => s.scope === 'whole_trip');
    }
    return routes.segments.filter(s => {
      if (s.scope === 'whole_trip') return false;
      if (dayDate && s.day && s.day !== dayDate) return false;
      return set.has(s.from) && set.has(s.to);
    });
  }

  function neighbors(placeId, filter, catSet) {
    // Prefer visit-sequence neighbors for a specific day
    const day = dayByFilter(filter);
    if (day && day.date) {
      const vs = visitsForFilter(filter);
      const placesList = [];
      const seen = new Set();
      vs.forEach(v => {
        if (seen.has(v.place_id)) return;
        const p = placeById(v.place_id);
        if (!p) return;
        if (catSet && !catSet.has(p.category)) return;
        seen.add(v.place_id);
        placesList.push(p);
      });
      const i = placesList.findIndex(p => p.place_id === placeId);
      return {
        prev: i > 0 ? placesList[i - 1] : null,
        next: i >= 0 && i < placesList.length - 1 ? placesList[i + 1] : null,
        index: i,
        total: placesList.length
      };
    }
    const list = placesForFilter(filter, catSet);
    const i = list.findIndex(p => p.place_id === placeId);
    return {
      prev: i > 0 ? list[i - 1] : null,
      next: i >= 0 && i < list.length - 1 ? list[i + 1] : null,
      index: i,
      total: list.length
    };
  }

  return {
    loadAll, placeById, weatherForDate, placesForFilter, visitsForFilter, activeVisit,
    routeSegmentsFor, dayByFilter, neighbors,
    get trip(){return trip;}, get days(){return days;}, get places(){return places;},
    get visits(){return visits;},
    get routes(){return routes;}, get weather(){return weather;}, get transport(){return transport;}
  };
})();
