const TripData = (() => {
  let trip = null, days = [], places = [], routes = null, weather = null, transport = null;

  async function loadAll() {
    const base = 'data/';
    const [t, d, p, r, w, tr] = await Promise.all([
      fetch(base + 'trip.json').then(r => r.json()),
      fetch(base + 'days.json').then(r => r.json()),
      fetch(base + 'places.json').then(r => r.json()),
      fetch(base + 'routes.json').then(r => r.json()),
      fetch(base + 'weather.json').then(r => r.json()),
      fetch(base + 'transport.json').then(r => r.json()).catch(() => ({ legs: [] })),
    ]);
    trip = t; days = d; places = p; routes = r; weather = w; transport = tr;
    return { trip, days, places, routes, weather, transport };
  }

  function placeById(id) { return places.find(p => p.place_id === id); }
  function weatherForDate(date) {
    return (weather && weather.days || []).find(d => d.date === date) || null;
  }
  function dayByFilter(filter) {
    return days.find(d => d.day_id === filter || d.date === filter) || days[0];
  }
  function placesForFilter(filter, catSet) {
    const day = dayByFilter(filter);
    let list;
    if (!day || day.day_id === 'd-all' || !day.date) {
      list = places.slice();
    } else {
      const set = new Set(day.place_ids || []);
      list = places.filter(p => set.has(p.place_id));
      // preserve day order
      const order = day.place_ids || [];
      list.sort((a, b) => order.indexOf(a.place_id) - order.indexOf(b.place_id));
      return catSet ? list.filter(p => catSet.has(p.category)) : list;
    }
    list.sort((a, b) => (minDay(a) + String(a.order||99)) .localeCompare(minDay(b) + String(b.order||99)));
    return catSet ? list.filter(p => catSet.has(p.category)) : list;
  }
  function minDay(p){ return (p.days && p.days[0]) || '9999'; }

  function routeSegmentsFor(placeIds, scope, dayDate) {
    if (!routes || !routes.segments) return [];
    const set = new Set(placeIds);
    if (scope === 'all') {
      return routes.segments.filter(s => s.scope === 'whole_trip');
    }
    // day scope
    return routes.segments.filter(s => {
      if (s.scope === 'whole_trip') return false;
      if (dayDate && s.day && s.day !== dayDate) return false;
      if (!dayDate && s.day) {
        // when filter is all, show day segments that connect visible places
      }
      return set.has(s.from) && set.has(s.to);
    });
  }

  function neighbors(placeId, filter, catSet) {
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
    loadAll, placeById, weatherForDate, placesForFilter, routeSegmentsFor, dayByFilter, neighbors,
    get trip(){return trip;}, get days(){return days;}, get places(){return places;},
    get routes(){return routes;}, get weather(){return weather;}, get transport(){return transport;}
  };
})();
