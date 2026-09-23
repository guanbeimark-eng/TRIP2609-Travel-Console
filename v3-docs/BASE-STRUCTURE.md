# EasyItinerary base structure (stock, MIT — Dobidop)

Source: `/workspace/trip-console/v3/easyitinerary-base/` (from Dobidop/easyItinerary).  
Do **not** rewrite this architecture for V3; fork and adapt the data layer only.

## Layout

| Path | Role |
|------|------|
| `index.html` | SPA shell: left panel (nav/sections), right map panel, modals |
| `css/style.css` | Themes + responsive (mobile map collapse) |
| `js/theme-init.js` | Apply saved theme before paint |
| `js/storage.js` | localStorage CRUD, import/export, optional share sync |
| `js/map.js` | Leaflet map, markers, search, route line, highlight/focus |
| `js/itinerary.js` | Days, activities, lodging endpoints, DnD, OSRM gaps |
| `js/resources.js` | Bookmarks / potentials / geocode helpers |
| `js/budget.js` | Expenses |
| `js/weather.js` | Open-Meteo weather |
| `js/app.js` | Boot, nav, overview, reservations, checklist |
| `server.js` | Static + share API (Node built-ins, default port 3003) |
| `poi-server.js` | Optional AI POI (not required for core) |

CDN: Leaflet 1.9.4 + Font Awesome from cdnjs. Tiles: CARTO (OSM). No API keys for core.

## Data model (localStorage)

- Store holds trips; each trip has `days[]`, `activities` per day (`lat`/`lng`/`title`/`startTime`/…), `resources[]`, `reservations[]`.
- Marker keys: `act-{dayIdx}-{actIdx}`, `res-{id}` for lodging/resources.
- Day filter on map: `#mapDayFilter` (`all` or day index string).

## How days / markers / map sync

1. **Boot**: `DOMContentLoaded` → Storage loads active trip → `MapModule.init()` → `Itinerary.init(trip)` → `MapModule.updateMarkers(trip, dayFilter)`.
2. **Markers**: `updateMarkers` clears markers, walks filtered days’ activities (+ lodging endpoints; resources only when filter=`all`), `addMarker` stores into `markerLookup[key]`. Optional OSRM-style **route polyline** via `drawRouteLine` when route toggle on.
3. **Timeline → map** (primary sync):
   - Activity card `data-marker-key="act-d-a"`.
   - `mouseenter` → `MapModule.highlightMarker(key)` (CSS `marker-highlight` + popup if in view).
   - `mouseleave` → `clearHighlight`.
   - `click` (not action buttons) → `focusMarker(key)` (pan/zoom ≥15, open popup; expands mobile map if minimized).
   - Lodging banners/endpoints use the same hover/click pattern.
4. **Map → timeline**: Stock app does **not** strongly reverse-sync; marker click opens Leaflet popup. Overview may `scrollIntoView` day cards. V3 should add explicit marker→timeline highlight (natcat38 idea) without changing Leaflet stack.
5. **Day filter**: `filterMapToDay` / `#mapDayFilter` change re-runs `updateMarkers` for that day only.
6. **Mobile**: `.right-panel.map-minimized` + `#mobileMapToggle`; `focusMarker` expands map then `invalidateSize`.

## Serving

```bash
cd /workspace/trip-console/v3/easyitinerary-base && node server.js
# http://localhost:3003
```

Static open of `index.html` also works (share API needs server).

## License

MIT — preserve `LICENSE` and attribution in any fork.
