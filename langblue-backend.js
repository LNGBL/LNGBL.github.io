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
