/**
 * Service Worker - 情侣空间 PWA
 * 策略：
 * - 核心外壳（index.html / config.js / loader.js）：cache first
 * - 同源静态资源（css / js / html / 图片 / icon）：stale-while-revalidate
 * - 跨域 CDN：network first，失败回退缓存
 * - Supabase API / 上传请求（POST/PUT/DELETE）：不拦截，直接放行
 */

const CACHE_VERSION = 'couple-v1';
const CORE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './icon.svg',
    './icon-maskable.svg',
    './js/config.js',
    './js/loader.js'
];

// ===== install：预缓存核心外壳 =====
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => {
            return cache.addAll(CORE_ASSETS).catch((e) => {
                console.warn('[SW] 部分核心资源缓存失败:', e);
            });
        })
    );
    self.skipWaiting();
});

// ===== activate：清理旧缓存 =====
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
            );
        })
    );
    self.clients.claim();
});

// ===== fetch：路由策略 =====
self.addEventListener('fetch', (event) => {
    const req = event.request;

    // 只处理 GET
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Supabase API 请求直接放行（不缓存）
    if (url.hostname.includes('supabase') || url.pathname.includes('/rest/') || url.pathname.includes('/auth/') || url.pathname.includes('/storage/')) {
        return;
    }

    // 导航请求（页面）→ network first，失败回退缓存的 index.html
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req).catch(() => caches.match('./index.html'))
        );
        return;
    }

    // 跨域请求直接放行（不拦截，避免 CORS 导致 SW 报错）
    if (url.origin !== self.location.origin) {
        return;
    }

    // 同源资源 → stale-while-revalidate
    event.respondWith(
        caches.match(req).then((cached) => {
            const fetchPromise = fetch(req).then((resp) => {
                if (resp && resp.status === 200) {
                    const clone = resp.clone();
                    caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
                }
                return resp;
            }).catch(() => cached);
            return cached || fetchPromise;
        })
    );
});
