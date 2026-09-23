/** AMap / Apple Maps deep links (GCJ-02). Pattern from TRIP2609-AMAP-导航.html */
const NavLinks = (() => {
  function enc(s) { return encodeURIComponent(s || ''); }

  function amapMarker(place) {
    const c = place.coordinates || {};
    const lng = c.lng, lat = c.lat;
    if (lng == null || lat == null) return null;
    const name = enc(place.name || place.short_name || '');
    return `https://uri.amap.com/marker?position=${lng},${lat}&name=${name}&coordinate=gaode&callnative=1`;
  }

  function amapAppPoi(place) {
    if (place.poi_id) return `amap://poi/detail?poiid=${place.poi_id}`;
    return amapMarker(place);
  }

  function appleMaps(place) {
    const c = place.coordinates || {};
    const lng = c.lng, lat = c.lat;
    if (lng == null || lat == null) return null;
    // Apple Maps accepts q=name&ll=lat,lng; GCJ is acceptable for CN destinations in practice
    const name = enc(place.name || place.short_name || '');
    return `https://maps.apple.com/?ll=${lat},${lng}&q=${name}&dirflg=d`;
  }

  function buttonsHtml(place) {
    const a = amapMarker(place);
    const apple = appleMaps(place);
    if (!a && !apple) return '';
    let html = '<div class="nav-btns">';
    if (a) html += `<a class="btn btn-nav" href="${a}" target="_blank" rel="noopener">高德导航</a>`;
    if (apple) html += `<a class="btn btn-nav btn-ghost" href="${apple}" target="_blank" rel="noopener">Apple Maps</a>`;
    html += '</div>';
    return html;
  }

  return { amapMarker, amapAppPoi, appleMaps, buttonsHtml };
})();

window.NavLinks = NavLinks;
