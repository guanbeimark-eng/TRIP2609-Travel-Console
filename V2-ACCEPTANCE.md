# TRIP2609 Travel Console — V2 UX Acceptance

Date: 2026-09-23 (CST / Asia/Shanghai)

## Scope

P0/P1 UX refactor only. No new trip data. No P2 (route animation, PWA, offline, live tracking, CarPlay).

## Checklist

| ID | Item | Result | Notes |
|----|------|--------|-------|
| P0-boot-day | Default day logic | **PASS** | Before trip start → `d-2026-09-27`; never `d-all`; no all-day markers on boot |
| P0-TTI | Slim first paint | **PASS** | Today tab only; Discover deferred; Today map = current→next segment only |
| P0-tabs | IA 总览\|今天\|行程\|发现 | **PASS** | Primary tabs; Today is default |
| P0-today | Today next-stop UI | **PASS** | where / next / depart / transit / do + weather + nav |
| P0-drawer | Closable Drawer | **PASS** | No permanent bottom detail bar; fields include why/time/weather/rating/price/next/nav |
| P0-candidates | Candidates off main map | **PASS** | Discover only (`role===map_candidate` / `jn-map-*`) |
| P0-thumbs | WebP thumbs + fulls | **PASS** | `assets/thumb/*.webp`, `assets/full/*`; SHA1 dedupe; markers VERIFIED-only (all current = glyph) |
| P0-map | AMap JS API 2.0 or Leaflet fallback | **PASS** | Primary AMapLoader 2.0 via `data/amap-config.js`; Leaflet = one 2.5s tile attempt then list-safe (no 8s chain) |
| P1-nav | 高德 + Apple Maps | **PASS** | Every official place drawer + Today target |
| P1-mobile | Mobile bottom nav | **PASS** | 地图 \| 行程 \| 发现; not shrunk desktop |

## Sample Today UI (boot 2026-09-23 → day 09-27)

- Date: 09-27 · 抵达日 G904→全季→千禧晚饭 · 邯郸·峰峰
- Weather: 多云转雷阵雨 29/19℃ · gear note
- Where: 出发前 · 尚未开始本日
- Next: 深圳北
- Depart: 09:41
- Transit: 按时刻表前往首站
- Do: 乘车（时刻RECHECK_12306）
- Nav: 高德导航 + Apple Maps

## Map / Key

- AMap Web JS Key: wired in `data/amap-config.js` (`window.TRIP_AMAP_KEY`)
- Smoke engine observed: **amap** (高德 JS API 2.0 · GCJ-02)
- No Web服务 Key in frontend

## Automated smoke

`node test-v2.mjs` → **SUMMARY PASS** (see `V2-TEST-RESULTS.json`).

Shots: `test-shots/v2-desktop-today.png`, `test-shots/v2-mobile-today.png`.
