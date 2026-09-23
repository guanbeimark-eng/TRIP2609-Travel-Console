# TRIP2609 Travel Console — P0 Acceptance

Date: 2026-09-23 (CST)

## P0 checklist

| ID | Item | Result | Notes |
|----|------|--------|-------|
| P0-01 | False fallback overlay | **PASS** | `attemptToken` guards tileload/timeout; `hideFallback()` on first tileload; `.map-fallback[hidden]{display:none!important}`; status「底图」implies overlay hidden |
| P0-02 | Day filter detail mismatch | **PASS** | `setFilter` clears/reselects when selected ∉ day visits; boot selects first visit of `d-all` (not hardcoded Jinan hotel) |
| P0-03 | Rebuild daily sequence | **PASS** | `visits.json` + `days.json` from ROUTE-FINAL MAIN_PLAN; 09-27 sz→handan→hotel→qianxi; 09-28 laoma 12:20 before scenic 13:40 |
| P0-04 | Regenerate routes.json | **PASS** | SCHEMATIC/RAIL only; no Shenzhen↔Fengfeng-food edges on 09-28; `whole_trip` = rail legs |
| P0-05 | Split places vs visits | **PASS** | `visits.json` source of truth; places stripped of day times/weather/next; UI detail from `activeVisit` |
| P0-06 | Image re-audit | **PASS** | Foods remapped to own assets; no shared facades; null `source_url` → not VERIFIED; markers glyph unless VERIFIED |
| P1-01 | Transport strip | **PASS** | Specific day with no legs →「今日无跨城交通」; full locked trains only on `d-all` / days with legs |

## Per-day checklist (09-27 … 10-04)

| Day | DAY_SELECTED | TIMELINE_ORDER | DETAIL_MATCH_DAY | MAP_VISIBLE | NO_FALSE_FALLBACK | MARKER_MATCH | IMAGE_MATCH | ROUTE_MATCH | WEATHER_MATCH | TRANSPORT_MATCH |
|-----|--------------|----------------|------------------|-------------|-------------------|--------------|-------------|-------------|---------------|------------------|
| 09-27 | PASS | PASS sz→handan→hotel→qianxi | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS (G904) |
| 09-28 | PASS | PASS hotel→scenic→laoma→scenic→qianxi | PASS | PASS | PASS | PASS | PASS | PASS no SZ edge | PASS | PASS 今日无跨城交通 |
| 09-29 | PASS | PASS MAIN order | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS 今日无跨城交通 |
| 09-30 | PASS | PASS MAIN order | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS 今日无跨城交通 |
| 10-01 | PASS | PASS MAIN + rail to JN | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS (G1832) |
| 10-02 | PASS | PASS MAIN concert day | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS 今日无跨城交通 |
| 10-03 | PASS | PASS MAIN + G2076 return | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS (G2076) |
| 10-04 | PASS | PASS hotel→HD→WH→SZ | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS (G689+G399) |

## Automated tests

`node test-p0.mjs` → **SUMMARY PASS** (see `P0-TEST-RESULTS.json`).

## Sample timelines after fix

**09-27:** st-sz-north (09:41) → st-handandong (17:44) → hotel-ff-quanyi (18:00) → food-qianxi (19:15)

**09-28:** hotel-ff-quanyi (09:00) → scenic-cizhouyao (09:15) → food-laoma (12:20) → scenic-cizhouyao (13:40) → food-qianxi (17:40)
