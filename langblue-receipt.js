document.getElementById("activateReceipt").onclick = async function () {
  if (!window.LangBlueCore ||
      !window.LangBlueCore.subscription ||
      typeof window.LangBlueCore.subscription.activateAsync !== "function") {
    alert("سیستم فعال‌سازی آماده نیست.");
    return;
  }

  if (typeof window.LangBlueCore.hasPermission === "function" &&
      !window.LangBlueCore.hasPermission()) {
    alert("ابتدا وارد حساب LangBlue شوید.");
    return;
  }

  var code = prompt("کد فعال سازی را وارد کنید:");
  if (!code) return;

  var ids = selectedProducts();

  if (!ids.length) {
    alert("حداقل یک محصول انتخاب کنید.");
    return;
  }

  try {
    var result = await window.LangBlueCore.subscription.activateAsync(code, ids);

    console.log("Activation result:", result);

    if (!result || !result.ok) {
      alert("❌ " + (result && result.error ? result.error : "فعال‌سازی ناموفق بود."));
      return;
    }

    alert("✅ اشتراک با موفقیت فعال شد.");

    // refresh account/subscription state
    if (typeof window.LangBlueCore.refresh === "function") {
      await window.LangBlueCore.refresh();
    }

    location.reload();

  } catch (err) {
    console.error("Activation error:", err);
    alert("❌ خطای ارتباط با سرور.");
  }
};
