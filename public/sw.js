// Service Worker للعمل بدون إنترنت
const CACHE_NAME = "branch-gear-v3";
const urlsToCache = ["/", "/index.html", "/offline.html"];

// تثبيت Service Worker
self.addEventListener("install", (event) => {
  console.log("[SW] Installing Service Worker...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Caching app shell");
      return cache.addAll(urlsToCache).catch((err) => {
        console.error("[SW] Cache addAll failed:", err);
      });
    })
  );
  // تفعيل Service Worker الجديد فوراً
  self.skipWaiting();
});

// تفعيل Service Worker
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating Service Worker...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[SW] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // السيطرة على جميع الصفحات فوراً
  return self.clients.claim();
});

// اعتراض الطلبات - Cache First للملفات الثابتة
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // تجاهل طلبات غير HTTP/HTTPS (مثل chrome-extension://)
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // تجاهل طلبات API - نريدها تذهب للشبكة أو تفشل لتفعيل الوضع Offline
  if (
    event.request.url.includes("/rest/v1/") ||
    event.request.url.includes("/auth/v1/") ||
    event.request.method !== "GET"
  ) {
    return;
  }

  // معالجة تنقلات SPA: لو offline، رجّع index.html من الكاش كـ fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedIndex = await cache.match("/index.html");
        if (cachedIndex) return cachedIndex;
        const offlinePage = await cache.match("/offline.html");
        if (offlinePage) return offlinePage;
        return new Response("Offline - App shell not cached", { status: 503 });
      })
    );
    return;
  }

  // للأصول الثابتة: Cache First مع تحديث في الخلفية
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, response).catch(() => {});
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache).catch(() => {});
            });
          }
          return response;
        })
        .catch(async () => {
          // لو أصل ثابت ومش موجود: حاول إرجاع offline.html للأمان
          const cache = await caches.open(CACHE_NAME);
          const offlinePage = await cache.match("/offline.html");
          if (offlinePage) return offlinePage;
          return new Response("Offline - Resource not cached", { status: 503 });
        });
    })
  );
});

// الاستماع للرسائل من التطبيق
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
