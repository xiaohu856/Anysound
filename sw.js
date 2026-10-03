var CACHE_NAME = 'anysound-v26.24.5';
var STATIC_ASSETS = [
    '/',
    'index.html',
    'css/style.css',
    'js/script.js',
    'manifest.json',
    'favicon.ico',
    'anysound_icon_new.png',
    'anysoundico.png',
    'skm1.png',
    'skm2.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2'
];

// ============ Install: 预缓存核心资源，立即激活 ============
self.addEventListener('install', function(event) {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(STATIC_ASSETS).catch(function(err) {
                console.log('[SW] 预缓存部分资源失败，将继续安装:', err);
            });
        })
    );
});

self.addEventListener('message', function(event) {
    if (event.data && event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
    if (event.data && event.data.action === 'clearCache') {
        caches.keys().then(function(keys) {
            keys.forEach(function(key) { caches.delete(key); });
        }).then(function() {
            return self.registration.unregister();
        });
    }
});

// ============ Activate: 清理旧缓存 ============
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(keys.map(function(key) {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// ============ Fetch: 智能缓存策略 ============
self.addEventListener('fetch', function(event) {
    var url = new URL(event.request.url);

    // 跳过非 GET 请求
    if (event.request.method !== 'GET') return;

    // 跳过 chrome-extension 等特殊协议
    if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') return;

    // 跳过音频/视频请求，直接走网络（避免 WebView 兼容性问题）
    var dest = event.request.destination;
    var pathLower = url.pathname.toLowerCase();
    if (dest === 'audio' || dest === 'video' ||
        pathLower.endsWith('.mp3') || pathLower.endsWith('.flac') || pathLower.endsWith('.m4a') ||
        pathLower.endsWith('.aac') || pathLower.endsWith('.ogg') || pathLower.endsWith('.wav') ||
        pathLower.endsWith('.mp4') || pathLower.endsWith('.webm')) return;

    // 跳过图片请求，直接走网络（避免 WebView 兼容性问题）
    if (dest === 'image' ||
        pathLower.endsWith('.jpg') || pathLower.endsWith('.jpeg') || pathLower.endsWith('.png') ||
        pathLower.endsWith('.gif') || pathLower.endsWith('.webp') || pathLower.endsWith('.svg') ||
        pathLower.endsWith('.ico') || pathLower.endsWith('.bmp')) return;

    // 跳过 Netlify 函数代理请求（保持在线）
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/functions/')) {
        event.respondWith(networkFirst(event.request));
        return;
    }

    // JS/HTML/CSS：网络优先（确保 WebView 始终加载最新版本）
    if (isCoreAsset(url)) {
        event.respondWith(networkFirst(event.request));
        return;
    }

    // 静态资源（图片/字体等）：缓存优先
    if (isStaticAsset(url)) {
        event.respondWith(cacheFirst(event.request));
        return;
    }

    // API 请求：网络优先，离线时返回空数据
    if (isApiRequest(url)) {
        event.respondWith(networkFirstWithFallback(event.request));
        return;
    }

    // 默认：缓存优先
    event.respondWith(cacheFirst(event.request));
});

// ============ 缓存策略实现 ============

// 缓存优先：先查缓存，缓存未命中再走网络
function cacheFirst(request) {
    return caches.match(request).then(function(cached) {
        if (cached) return cached;
        return fetch(request).then(function(response) {
            if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
            }
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
                cache.put(request, clone);
            });
            return response;
        }).catch(function() {
            // 离线且缓存未命中，返回离线页面
            if (request.mode === 'navigate') {
                return caches.match('index.html');
            }
            return new Response('', { status: 408 });
        });
    });
}

// 网络优先：先走网络，失败则用缓存
function networkFirst(request) {
    return fetch(request).then(function(response) {
        if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
                cache.put(request, clone);
            });
        }
        return response;
    }).catch(function() {
        return caches.match(request).then(function(cached) {
            return cached || new Response(JSON.stringify({ error: 'offline' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            });
        });
    });
}

// 网络优先（API 专用）：网络失败返回空数据
function networkFirstWithFallback(request) {
    return fetch(request).then(function(response) {
        return response;
    }).catch(function() {
        return caches.match(request).then(function(cached) {
            if (cached) return cached;
            return new Response(JSON.stringify({ code: -1, data: [], msg: '离线模式' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        });
    });
}

// ============ 判断请求类型 ============

function isCoreAsset(url) {
    var path = url.pathname;
    return path.endsWith('.html') ||
           path.endsWith('.js') ||
           path.endsWith('.css') ||
           path === '/';
}

function isStaticAsset(url) {
    var path = url.pathname;
    return path.endsWith('.png') ||
           path.endsWith('.jpg') ||
           path.endsWith('.ico') ||
           path.endsWith('.woff2') ||
           path.endsWith('.woff') ||
           path.endsWith('.json') ||
           path.endsWith('.svg');
}

function isApiRequest(url) {
    var host = url.hostname;
    return host.includes('kuwo.') ||
           host.includes('kugou.') ||
           host.includes('163.com') ||
           host.includes('music.') ||
           host.includes('api.');
}