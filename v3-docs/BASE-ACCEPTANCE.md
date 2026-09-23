# BASE-ACCEPTANCE — stock EasyItinerary

Date: 2026-09-23 (Asia/Shanghai)
URL: http://127.0.0.1:3003
Overall: **PASS**

| Check | Result | Detail |
|-------|--------|--------|
| page loads | PASS | title=EasyItinerary - Trip Planner |
| map container visible | PASS |  |
| map tiles/leaflet present | PASS | leaflet=1 tiles=12 |
| map markers appear | PASS | markers=3 |
| day itinerary works | PASS | days=1 activities=3 |
| map ↔ itinerary interaction | PASS | highlight=1 popup=1 |
| mobile 390×844 layout OK | PASS | overflowX=false mapVisible=true |
| no fatal app console errors (CDN/API noise ignored) | PASS | ignoredNoise=4 |

Screenshots: `/workspace/trip-console/v3/_qa/screenshots-base/`

Gate: Phase B PASS — proceed to Phase C (TRIP2609 one-day fork).
