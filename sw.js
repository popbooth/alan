/**
 * sw.js — TIPS Service Worker
 * v1.5: 静态资源缓存 + 离线可用
 */

const CACHE = 'tips-static-v1'
const STATIC = [
  './',
  './index.html',
  './app.js',
  './db.js',
  './charts.js',
  './prompts.js',
  './manifest.json',
  './icons/icon.svg',
]

// 安装: 预缓存静态资源
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  )
})

// 激活: 清理旧缓存
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// 请求: 缓存优先，网络回退
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // 只处理同源请求
  if (url.origin !== self.location.origin) return

  // API 请求不走缓存
  if (url.pathname === '/v1/chat/completions') return

  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      // 静态资源缓存更新
      if (res.ok && url.pathname.match(/\.(js|css|html|json|svg|png)$/)) {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
      }
      return res
    }).catch(() => {
      // 离线时返回缓存的首页
      if (url.pathname === '/' || url.pathname === '/index.html') {
        return caches.match('./index.html')
      }
      return new Response('离线中', { status: 503 })
    }))
  )
})
