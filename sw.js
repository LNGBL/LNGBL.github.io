const LANGBLUE_CACHE='langblue-shell-v1';
const LANGBLUE_SHELL=['/','/index.html','/pages/LangKz.html','/assets/js/langblue-kz-harmony.js'];
self.addEventListener('install',function(event){event.waitUntil(caches.open(LANGBLUE_CACHE).then(cache=>cache.addAll(LANGBLUE_SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',function(event){event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('langblue-shell-')&&key!==LANGBLUE_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',function(event){const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(url.origin!==self.location.origin||!LANGBLUE_SHELL.includes(url.pathname))return;event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response&&response.ok){const copy=response.clone();caches.open(LANGBLUE_CACHE).then(cache=>cache.put(request,copy));}return response;})));});
self.addEventListener('notificationclick',function(event){
  event.notification.close();
  var url=(event.notification.data&&event.notification.data.url)||'index.html';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(function(list){
    for(var i=0;i<list.length;i++){
      if('focus' in list[i]){
        list[i].focus();
        if('navigate' in list[i]) return list[i].navigate(url);
      }
    }
    if(clients.openWindow) return clients.openWindow(url);
  }));
});
