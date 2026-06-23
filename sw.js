const CACHE_NAME = 'pulmuone-ecs-pwa-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './풀무원.png',
  './manifest.json'
];

// 서비스 워커 설치 시 리소스 캐싱
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] 리소스 캐싱 중...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// 서비스 워커 활성화 및 구 버전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] 오래된 캐시 정리 중...', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 오프라인 상태에서도 리소스 로드 가능하도록 캐시 우선 제공
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // 네트워크 실패 시 대안 제시 (오프라인 지원)
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// 백그라운드 실시간 모바일 푸시 알림(FCM) 수신 대기
self.addEventListener('push', (event) => {
  let payload = {
    title: '🚨 [품질 위반 Alert] 긴급 공지',
    body: 'UCL 초과 리스크 감지! 모바일 대시보드를 확인하세요.',
    url: './index.html'
  };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: './풀무원.png',
    badge: './풀무원.png',
    vibrate: [300, 100, 300],
    data: {
      url: payload.url || './index.html'
    },
    actions: [
      { action: 'open_url', title: '📊 대시보드 바로가기' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// 알림 배너 클릭 시 해당 URL로 브라우저 창 열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const targetUrl = event.notification.data.url;
      // 이미 켜져 있는 창이 있으면 포커스, 없으면 새 창
      for (let client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
