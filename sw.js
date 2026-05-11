const CACHE_NAME = 'sourdough-v11'; // Bumped version
const ASSETS = [
    './',
    'index.html',
    'style.css',
    'app.js',
    'manifest.json',
    'eyes_open.png',
    'eyes_star.png',
    'temperature.png',
    'dutch.png',
    'knife.png',
    'boule.png',
    'start_screen.png',
    'celebration.gif',
    'celebration.mp4',
    'background.png',
    'oven.png',
    'Done - Cooking Mama Soundtrack.mp3',
    'Result - Cooking Mama Soundtrack 4.mp3',
    'Title Theme - Cooking Mama Soundtrack 4.mp3'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caching assets');
            // Using a non-blocking catch to ensure sw installs even if an image is missing
            return Promise.allSettled(
                ASSETS.map(asset => cache.add(asset))
            );
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            // Clear old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            clients.claim()
        ])
    );
});

// Smarter fetch strategy
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // For navigation requests (opening the app), try network first
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match('index.html');
            })
        );
        return;
    }

    // For static assets, use Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // If the response is valid, update the cache
                if (networkResponse && networkResponse.status === 200) {
                    const cacheCopy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, cacheCopy);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Return cached if network fails
            });

            return cachedResponse || fetchPromise;
        })
    );
});

let timerTimeout = null;

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'START_TIMER') {
        const { endTime, message } = event.data;
        const delay = endTime - Date.now();

        if (timerTimeout) clearTimeout(timerTimeout);

        if (delay > 0) {
            // event.waitUntil keeps the service worker alive for the duration of the promise
            event.waitUntil(
                new Promise((resolve) => {
                    timerTimeout = setTimeout(async () => {
                        await self.registration.showNotification('Sourdough Master', {
                            body: message,
                            icon: 'eyes_star.png',
                            tag: 'sourdough-progress',
                            renotify: false,
                            vibrate: [200, 100, 200]
                        });
                        resolve();
                    }, delay);
                })
            );
        }
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if there is already a window/tab open with the app
            for (const client of clientList) {
                if ('focus' in client) {
                    return client.focus();
                }
            }
            // If no window/tab is open, open a new one
            if (clients.openWindow) {
                return clients.openWindow(self.registration.scope);
            }
        })
    );
});
