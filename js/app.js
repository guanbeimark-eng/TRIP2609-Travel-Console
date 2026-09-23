(async function boot() {
  try {
    const data = await TripData.loadAll();
    UI.initChrome(data.trip);
    try {
      MapModule.init('map', (placeId) => UI.selectPlace(placeId, 'map'));
      UI.refreshMap();
    } catch (mapErr) {
      console.error('Map init failed', mapErr);
      const st = document.getElementById('providerStatus');
      if (st) {
        st.textContent = '地图初始化失败：' + (mapErr && mapErr.message ? mapErr.message : mapErr);
        st.className = 'provider-status err';
      }
      const box = document.getElementById('mapFallback');
      const msg = document.getElementById('mapFallbackMsg');
      if (msg) msg.textContent = '地图引擎异常，已保留时间线/详情。可点重试或检查 Leaflet/cluster 资源。';
      if (box) box.hidden = false;
    }
    const prefer = data.places.find(p => p.place_id === 'hotel-jn-hiex') || data.places[0];
    if (prefer) UI.selectPlace(prefer.place_id, 'boot');
    setTimeout(() => MapModule.invalidateSize && MapModule.invalidateSize(), 200);
    setTimeout(() => MapModule.invalidateSize && MapModule.invalidateSize(), 1000);
  } catch (err) {
    console.error(err);
    const st = document.getElementById('providerStatus');
    if (st) {
      st.textContent = '数据加载失败：请用静态服务器打开本目录';
      st.className = 'provider-status err';
    }
  }
})();
