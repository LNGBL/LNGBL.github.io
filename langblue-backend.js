(function(window){
"use strict";

const CONFIG = Object.assign({
  enabled:true,
  supabaseUrl:"https://ocxeyponzzcvlrvwndji.supabase.co"
}, window.LangBlueBackendConfig || {});


async function invoke(name, body) {
  // کد فعلی invoke تو اینجا باشد
}


async function activateCode(code, productIds) {
  return invoke("activate-code", {
    code: String(code || "").trim(),
    productIds: Array.isArray(productIds) ? productIds : []
  });
}


window.LangBlueBackend = {
  CONFIG,
  invoke,
  activateCode
};

console.log("LangBlueBackend READY", window.LangBlueBackend);

})(window);
