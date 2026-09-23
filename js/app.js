(async function boot() {
  try {
    const data = await TripData.loadAll();
    UI.initChrome(data.trip);
    // Default day already set inside initChrome via TripData.defaultDayId() — never d-all
    try {
      await MapModule.init('map', (placeId) => UI.openPlace(placeId, 'map'));
      UI.refreshTodayMap();
    } catch (mapErr) {
      console.error('Map init failed', mapErr);
      const st = document.getElementById('providerStatus');
      if (st) {
        st.textContent = '地图初始化失败';
        st.className = 'provider-status err';
      }
      const box = document.getElementById('mapFallback');
      if (box) { box.hidden = false; box.removeAttribute('hidden'); }
    }
    // Slim first paint: stay on Today; no discover / all-day render
    UI.setTab('today');
    setTimeout(() => MapModule.invalidateSize && MapModule.invalidateSize(), 200);
    setTimeout(() => MapModule.invalidateSize && MapModule.invalidateSize(), 800);
  } catch (err) {
    console.error(err);
    const st = document.getElementById('providerStatus');
    if (st) {
      st.textContent = '数据加载失败：请用静态服务器打开本目录';
      st.className = 'provider-status err';
    }
  }
})();
