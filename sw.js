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
