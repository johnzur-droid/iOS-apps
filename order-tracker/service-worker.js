// Order Tracker Service Worker v90
const CACHE_NAME = 'order-tracker-v90';
const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// Install - cache resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
            .catch((err) => console.log('Cache failed:', err))
    );
    self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) => {
            return Promise.all(
                names.map((name) => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch - network first for Google APIs
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Always network for Google APIs
    if (url.hostname.includes('googleapis.com') ||
        url.hostname.includes('accounts.google.com') ||
        url.hostname.includes('apis.google.com')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Network first, fallback to cache
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
