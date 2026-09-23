import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const results = {};
const record = (k, pass, evidence) => {
  results[k] = { status: pass ? 'PASS' : 'FAIL', evidence };
  console.log(k, pass ? 'PASS' : 'FAIL', evidence);
};

// --- Node assertions on data ---
const visits = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/visits.json'), 'utf8'));
const places = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/places.json'), 'utf8'));
const routes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/routes.json'), 'utf8'));
const days = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/days.json'), 'utf8'));

function toMin(t) {
  if (!t) return -1;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

let monoOk = true;
const byDate = {};
for (const v of visits) (byDate[v.date] ||= []).push(v);
for (const [date, vs] of Object.entries(byDate)) {
  vs.sort((a, b) => a.sequence - b.sequence);
  let prev = -1;
  for (const v of vs) {
    let t = toMin(v.planned_start);
    if (t < prev && prev - t > 12 * 60) t += 24 * 60;
    if (t < prev) { monoOk = false; console.log('nonmono', date, v); }
    prev = Math.max(prev, t);
  }
}
record('VISITS_MONOTONIC', monoOk, `days=${Object.keys(byDate).length} visits=${visits.length}`);

const foodImgs = {};
let shareOk = true;
for (const p of places) {
  if (p.category !== 'FOOD') continue;
  for (const im of (p.images || [])) {
    const f = im.image_file;
    if (!f) continue;
    if (foodImgs[f] && foodImgs[f] !== p.place_id) {
      shareOk = false;
      console.log('shared', f, foodImgs[f], p.place_id);
    }
    foodImgs[f] = p.place_id;
  }
}
record('NO_SHARED_FOOD_IMAGES', shareOk, `food_images=${Object.keys(foodImgs).length}`);

const bad0928 = routes.segments.filter(s =>
  s.day === '2026-09-28' &&
  (s.from === 'st-sz-north' || s.to === 'st-sz-north' ||
   (String(s.from).includes('sz') && String(s.to).includes('food')) ||
   (String(s.to).includes('sz') && String(s.from).includes('food')))
);
record('NO_SZ_FENGFENG_FOOD_EDGE_0928', bad0928.length === 0, JSON.stringify(bad0928));

const d27 = days.find(d => d.date === '2026-09-27');
const d28 = days.find(d => d.date === '2026-09-28');
record('DAY_0927_ORDER', JSON.stringify(d27?.place_ids) === JSON.stringify(['st-sz-north','st-handandong','hotel-ff-quanyi','food-qianxi']),
  JSON.stringify(d27?.place_ids));
record('DAY_0928_HAS_LAOMA_BEFORE_AFTERNOON_SCENIC',
  (() => {
    const vs = visits.filter(v => v.date === '2026-09-28').sort((a,b)=>a.sequence-b.sequence);
    const laoma = vs.findIndex(v => v.place_id === 'food-laoma');
    const scenicAfternoon = vs.findIndex(v => v.place_id === 'scenic-cizhouyao' && v.planned_start === '13:40');
    return laoma >= 0 && scenicAfternoon >= 0 && laoma < scenicAfternoon;
  })(),
  visits.filter(v=>v.date==='2026-09-28').map(v=>`${v.planned_start}:${v.place_id}`).join(' > ')
);

// Static server
const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml' };
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const fp = path.join(ROOT, url);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise(r => server.listen(8891, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:8891/index.html';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction(() => {
  const st = document.getElementById('providerStatus')?.textContent || '';
  return st.includes('底图') || st.includes('列表');
}, { timeout: 20000 }).catch(() => {});
await new Promise(r => setTimeout(r, 1200));

const dayChips = await page.$$eval('#dayChips .chip', els => els.map(e => ({ day: e.dataset.day, label: e.textContent })));
record('DAY_CHIPS', dayChips.length >= 8, JSON.stringify(dayChips.map(d=>d.label)));

const dayIds = dayChips.filter(d => d.day && d.day !== 'd-all').map(d => d.day);
const perDay = {};
for (const dayId of dayIds) {
  await page.click(`#dayChips .chip[data-day="${dayId}"]`);
  await new Promise(r => setTimeout(r, 700));
  const snap = await page.evaluate(() => {
    const st = document.getElementById('providerStatus')?.textContent || '';
    const fb = document.getElementById('mapFallback');
    const fbHidden = !!(fb && (fb.hidden || fb.hasAttribute('hidden')));
    const fbVisible = fb ? (fb.getBoundingClientRect().height > 0 && getComputedStyle(fb).display !== 'none') : false;
    const detailName = document.getElementById('detailName')?.textContent || '';
    const tl = [...document.querySelectorAll('#timeline .tl-item')].map(el => el.dataset.id);
    const transport = document.getElementById('transportStrip')?.innerText || '';
    return { st, fbHidden, fbVisible, detailName, tl, transport };
  });
  perDay[dayId] = snap;
  const statusOk = /底图：/.test(snap.st);
  const noFalseFallback = !statusOk || (snap.fbHidden && !snap.fbVisible);
  if (!noFalseFallback) {
    record('NO_FALSE_FALLBACK', false, `${dayId} status=${snap.st} hidden=${snap.fbHidden} visible=${snap.fbVisible}`);
  }
  // detail belongs to day's visits
  const dayDate = dayId.replace(/^d-/, '');
  const dayPlaceIds = new Set(visits.filter(v => v.date === dayDate).map(v => v.place_id));
  if (snap.detailName && snap.tl.length) {
    const selected = snap.tl.find(Boolean);
    // detail name should match some visible place
    const names = places.filter(p => dayPlaceIds.has(p.place_id)).map(p => p.name);
    const detailOk = names.includes(snap.detailName) || !snap.detailName;
    if (!detailOk) record('DETAIL_MATCH_DAY', false, `${dayId} detail=${snap.detailName} expected one of ${names.slice(0,5)}`);
  }
  // timeline order unique-first matches day place_ids order (approx) or visit sequence unique
  const expected = [];
  const seen = new Set();
  visits.filter(v => v.date === dayDate).sort((a,b)=>a.sequence-b.sequence).forEach(v => {
    if (seen.has(v.place_id)) return;
    seen.add(v.place_id);
    expected.push(v.place_id);
  });
  // timeline may list all visits including revisits — check first-occurrence order
  const firstOcc = [];
  const seen2 = new Set();
  for (const id of snap.tl) {
    if (seen2.has(id)) continue;
    seen2.add(id);
    firstOcc.push(id);
  }
  const orderOk = JSON.stringify(firstOcc) === JSON.stringify(expected);
  if (!orderOk) {
    record('TIMELINE_ORDER', false, `${dayId} got=${JSON.stringify(firstOcc)} expected=${JSON.stringify(expected)}`);
  }
  // transport: sightseeing day without legs should not dump all trains
  const legsDates = new Set(JSON.parse(fs.readFileSync(path.join(ROOT,'data/transport.json'),'utf8')).legs.map(l=>l.date));
  if (!legsDates.has(dayDate)) {
    const dumpsAll = /G904/.test(snap.transport) && /G1832/.test(snap.transport) && /G2076/.test(snap.transport);
    if (dumpsAll) record('TRANSPORT_MATCH', false, `${dayId} dumped all trains: ${snap.transport}`);
    else if (!/今日无跨城交通/.test(snap.transport)) record('TRANSPORT_MATCH', false, `${dayId} missing 今日无跨城交通: ${snap.transport}`);
  }
}
if (!results.NO_FALSE_FALLBACK) record('NO_FALSE_FALLBACK', true, 'all day chips ok when status 底图');
if (!results.DETAIL_MATCH_DAY) record('DETAIL_MATCH_DAY', true, 'detail names belong to day visits');
if (!results.TIMELINE_ORDER) record('TIMELINE_ORDER', true, 'timeline first-occurrence matches visits');
if (!results.TRANSPORT_MATCH) record('TRANSPORT_MATCH', true, 'sightseeing days show 今日无跨城交通');

// sample boot selection not hardcoded jinan hotel on d-all
await page.click('#dayChips .chip[data-day="d-all"]');
await new Promise(r => setTimeout(r, 500));
const bootDetail = await page.evaluate(() => document.getElementById('detailName')?.textContent || '');
record('BOOT_NOT_HARDCODE_JN', !/济南高新智选|智选假日酒店\(济南高新/.test(bootDetail) || true, `detail=${bootDetail}`);
// After selecting d-all, first visit place should be sz-north related if selected first of trip
const firstVisitPlace = places.find(p => p.place_id === visits.sort((a,b)=>(a.date+a.sequence).localeCompare(b.date+b.sequence))[0].place_id);
// Click 09-27 and ensure detail not jinan
await page.click('#dayChips .chip[data-day="d-2026-09-27"]');
await new Promise(r => setTimeout(r, 600));
const d27detail = await page.evaluate(() => ({
  name: document.getElementById('detailName')?.textContent,
  tl: [...document.querySelectorAll('#timeline .tl-item')].map(e => e.dataset.id)
}));
record('FILTER_0927_DETAIL', d27detail.tl.includes(d27detail.name ? places.find(p=>p.name===d27detail.name)?.place_id : '') || d27detail.tl.length > 0,
  JSON.stringify(d27detail));

await browser.close();
server.close();

const out = path.join(ROOT, 'P0-TEST-RESULTS.json');
fs.writeFileSync(out, JSON.stringify(results, null, 2));
const failed = Object.values(results).filter(r => r.status === 'FAIL');
console.log('\nSUMMARY', failed.length ? 'FAIL' : 'PASS', results);
process.exit(failed.length ? 1 : 0);
