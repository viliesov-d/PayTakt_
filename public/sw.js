/* PayTakt offline app-shell only. Never cache Firebase, Auth, NBU, or user data. */
const SHELL_CACHE='paytakt-pwa-shell-v4'
const PREFIX='paytakt-pwa-shell-'
const BASE=self.registration.scope
const baseUrl=new URL(BASE)

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const response=await fetch(BASE,{cache:'reload'})
    if(!response.ok)throw Error('PayTakt shell unavailable')
    const html=await response.clone().text()
    const cache=await caches.open(SHELL_CACHE)
    await cache.put(BASE,response)
    // Vite uses hashed ./assets/* filenames. Capture the currently deployed
    // entrypoints so the app can open after an offline restart.
    const assets=[...html.matchAll(/(?:src|href)=["']([^"']*assets\/[^"']+\.(?:js|css))["']/g)]
      .map(m=>new URL(m[1],BASE).href)
    const staticFiles=['manifest.webmanifest','pwa-192.png','pwa-512.png','favicon.svg']
      .map(path=>new URL(path,BASE).href)
    await Promise.all([...new Set([...assets,...staticFiles])].map(async url=>{
      try{await cache.add(new Request(url,{cache:'reload'}))}catch{/* optional assets */}
    }))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys()
    await Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==SHELL_CACHE).map(k=>caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch',event=>{
  const request=event.request
  if(request.method!=='GET')return
  const url=new URL(request.url)
  if(url.origin!==baseUrl.origin||!url.pathname.startsWith(baseUrl.pathname))return
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request)
        if(response.ok) {
          const cache=await caches.open(SHELL_CACHE)
          await cache.put(BASE,response.clone())
        }
        return response
      }catch{
        return (await caches.match(BASE))||Response.error()
      }
    })())
    return
  }
  // Only same-origin versioned Vite bundles are cached. No data/API requests.
  if(url.pathname.startsWith(baseUrl.pathname+'assets/')&&
      /\.(?:js|css)$/.test(url.pathname)){
    event.respondWith((async()=>{
      const cached=await caches.match(request)
      if(cached)return cached
      const response=await fetch(request)
      if(response.ok){
        const cache=await caches.open(SHELL_CACHE)
        await cache.put(request,response.clone())
      }
      return response
    })())
  }
})
