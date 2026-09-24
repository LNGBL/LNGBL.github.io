(function(window){
  'use strict';

  /*
   * مرکزی اعلان‌های LangBlue
   * برای انتشار یک اعلان جدید، فقط این مقادیر را تغییر بده و Commit کن.
   * enabled=false یعنی هیچ اعلان جدیدی نمایش داده نشود.
   */
  var ANNOUNCEMENT = {
    enabled: false,
    id: 'lb-2026-09-20-001',
    title: 'LangBlue',
    body: 'اعلان جدید LangBlue',
    type: 'update',
    url: 'index.html',
    publishedAt: '2026-09-20T00:00:00Z'
  };

  function supported(){
    return 'Notification' in window;
  }

  function permission(){
    return supported() ? Notification.permission : 'unsupported';
  }

  async function request(){
    if(!supported()) return 'unsupported';
    if(Notification.permission==='granted') return 'granted';
    if(Notification.permission==='denied') return 'denied';
    return await Notification.requestPermission();
  }

  async function show(){
    if(!supported() || Notification.permission!=='granted' || !ANNOUNCEMENT.enabled) return false;
    var key='lb:last-notification';
    if(localStorage.getItem(key)===ANNOUNCEMENT.id) return false;

    try{
      if('serviceWorker' in navigator){
        var reg=await navigator.serviceWorker.getRegistration();
        if(reg && reg.showNotification){
          await reg.showNotification(ANNOUNCEMENT.title,{
            body:ANNOUNCEMENT.body,
            icon:'/favicon.svg',
            tag:ANNOUNCEMENT.id,
            data:{url:ANNOUNCEMENT.url}
          });
        }else{
          new Notification(ANNOUNCEMENT.title,{body:ANNOUNCEMENT.body,tag:ANNOUNCEMENT.id});
        }
      }else{
        new Notification(ANNOUNCEMENT.title,{body:ANNOUNCEMENT.body,tag:ANNOUNCEMENT.id});
      }
      localStorage.setItem(key,ANNOUNCEMENT.id);
      return true;
    }catch(e){
      return false;
    }
  }

  window.LangBlueNotifications={
    announcement:ANNOUNCEMENT,
    permission:permission,
    request:request,
    show:show
  };
})(window);
