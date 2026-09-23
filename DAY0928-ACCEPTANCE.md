# DAY0928-ACCEPTANCE — TRIP2609 V3 one-day fork

Date: 2026-09-23 (Asia/Shanghai)
URL: http://127.0.0.1:3010
Overall: **PASS**

Scope: 2026-09-28 Fengfeng only (全季 / 老马羊汤 / 磁州窑 / 千禧 + Discover 峰峰博物馆).

| Check | Result | Detail |
|-------|--------|--------|
| first paint / Today UI | PASS | uiReadyMs=331 (target <1s cold may vary in CI) |
| weather shown | PASS | 雷阵雨转多云 28/19℃ |
| day timeline | PASS | items=5 |
| map present (async OK even if tiles fail) | PASS | tiles=20 markers≈10 status=地图就绪（异步） |
| markers (thumb) | PASS | count=10 |
| route between stops | PASS | paths=1 |
| place images (thumbs) | PASS | thumbs=5 |
| image enlarge / lightbox | PASS | lightbox=1 |
| 高德 + Apple nav deep links | PASS | amap=5 apple=5 |
| timeline → marker focus | PASS | hl=1 popup=1 |
| marker → timeline highlight | PASS | active=2 markerHl=1 |
| Discover candidate | PASS | cards=1 |
| mobile 390×844 | PASS | overflowX=false |
| no AMap JS API on boot | PASS | AMap=false |
| boot metric recorded | PASS | bootMs=9 |

Screenshots: `/workspace/trip-console/v3/_qa/screenshots-day0928/`

## How to serve
```bash
cd /workspace/trip-console/v3/trip2609 && PORT=3010 node server.js
# http://127.0.0.1:3010/
```

Do **not** migrate full 09-27–10-04 yet.
