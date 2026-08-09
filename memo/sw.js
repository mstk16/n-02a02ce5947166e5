// 配信メモ — オフライン用 Service Worker
const CACHE = 'haisin-memo-v2';
const CORE = ['./', './index.html', './manifest.webmanifest',
              './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', function(e){
  // {cache:'reload'}でブラウザのHTTPキャッシュを迂回し、必ずネットワークから
  // 取り直す。これが無いと、キャッシュ済みのCORE資産をそのままCache Storageに
  // コピーしてしまい、新版に切り替わらないコトがある。
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(CORE.map(function(url){
      return fetch(url, {cache:'reload'}).then(function(res){
        return c.put(url, res);
      });
    }));
  }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k!==CACHE; })
      .map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

// 全データが端末内(localStorage)完結のアプリなので、シェルはキャッシュ優先で
// オフラインでも即座に開けるようにする。新版はバックグラウンドで取得して次回に反映。
self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var url = new URL(req.url);
  if(url.origin !== location.origin) return;

  e.respondWith(
    caches.match(req).then(function(cached){
      // no-storeでブラウザのHTTPキャッシュも迂回し、必ず実ネットワークまで取りに行く。
      // これが無いと、Cache Storageを消しても中間のHTTPキャッシュ層が古い応答を
      // 返し続けるコトがある(強制アップデートが効かない不具合の原因だった)。
      var network = fetch(req, {cache:'no-store'}).then(function(res){
        if(res && res.ok){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){ return cached; });
      return cached || network;
    })
  );
});
