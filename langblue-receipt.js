/* LangBlue Receipt System
   Purchase summary + Telegram + Activation
*/
(function () {
  "use strict";

  function money(n) {
    return Number(n || 0).toLocaleString("en-US") + " T";
  }

  function selectedProducts() {
    return Array.from(document.querySelectorAll("#receiptProducts input:checked"))
      .map(function (input) { return input.value; });
  }

  function selectedPlan() {
    return document.getElementById("receiptPlan").value;
  }

  function renderSummary() {
    var ids = selectedProducts();
    var plan = window.LangBlueCommerce.displayPlan(selectedPlan());
    var box = document.getElementById("receiptSummary");

    if (!ids.length) {
      box.innerHTML = '<div style="color:#ff7777">حداقل یک محصول را انتخاب کن.</div>';
      return;
    }

    var isBundle = selectedPlan() === "irt_12m" && ids.length === 4;
    var discount = isBundle
      ? (window.LangBlueCommerce.ALL_PRODUCTS_12M_DISCOUNT || 15)
      : 0;
    var subtotal = plan.finalPrice * ids.length;
    var total = window.LangBlueCommerce.discountedPrice(subtotal, discount);

    box.innerHTML = `
      <div class="receipt-summary-row"><span>تعداد محصولات</span><strong>${ids.length}</strong></div>
      <div class="receipt-summary-row"><span>قیمت هر محصول</span><strong>${money(plan.finalPrice)}</strong></div>
      ${discount ? `<div class="receipt-summary-row"><span>تخفیف بسته کامل</span><strong>${discount}%</strong></div>` : ""}
      <div class="receipt-summary-total"><span>مبلغ نهایی</span><strong>${money(total)}</strong></div>
    `;
  }

  function buildReceipt() {
    var ids = selectedProducts();
    if (!ids.length) {
      renderSummary();
      return;
    }

    var order = window.LangBlueCommerce.buildOrder(ids, selectedPlan());
    var output = document.getElementById("receiptOutput");
    var date = new Date(order.createdAt).toLocaleString("fa-IR");

    output.innerHTML = `
      <div class="receipt-head">
        <div><strong>LangBlue</strong><br><small>فیش سفارش</small></div>
        <div><small>شماره: ${order.id}<br>${date}</small></div>
      </div>
      ${order.products.map(function (product) { return `
        <div class="receipt-line">
          <span>${product.icon} ${product.label}</span>
          <strong>${money(order.plan.finalPrice)}</strong>
        </div>`; }).join("")}
      <div class="receipt-line"><span>پلن</span><strong>${order.plan.label}</strong></div>
      <div class="receipt-total"><span>مبلغ نهایی</span><span>${order.totalStr}</span></div>
      <div class="receipt-actions">
        <button class="btn btn-primary" id="sendReceiptTelegram">📨 ارسال تلگرام</button>
        <button class="btn btn-secondary" id="activateReceipt">🔑 فعال‌سازی</button>
      </div>
    `;

    output.classList.add("show");
    document.getElementById("printReceipt").style.display = "inline-flex";

    document.getElementById("sendReceiptTelegram").onclick = function () {
      var text = `
درخواست خرید LangBlue

شماره فیش:
${order.id}

محصولات:
${order.products.map(function (product) { return product.label; }).join("، ")}

پلن:
${order.plan.label}

مبلغ:
${order.totalStr}

لطفاً بررسی شود.
`;
      var url = "https://t.me/share/url?url=" +
        encodeURIComponent("https://lngbl.github.io/") +
        "&text=" + encodeURIComponent(text);
      window.open(url, "_blank");
    };

    document.getElementById("activateReceipt").onclick = function () {
      if (!window.LangBlueCore || typeof window.LangBlueCore.hasPermission !== "function" ||
          !window.LangBlueCore.hasPermission()) {
        alert("ابتدا وارد حساب LangBlue شوید.");
        return;
      }

      var code = prompt("کد فعال سازی را وارد کنید:");
      if (!code) return;

      // The Core activation API accepts the activation code only.
      // Product IDs are already represented by the selected receipt/order.
      var result = window.LangBlueCore.subscription.activate(code);
      if (!result.ok) {
        alert("❌ " + result.error);
        return;
      }
      alert("✅ فعال شد");
    };

    output.scrollIntoView({ behavior: "smooth" });
  }

  document.querySelectorAll("#receiptProducts input").forEach(function (input) {
    input.addEventListener("change", renderSummary);
  });
  document.getElementById("receiptPlan").addEventListener("change", renderSummary);
  document.getElementById("buildReceipt").addEventListener("click", buildReceipt);
  document.getElementById("printReceipt").addEventListener("click", function () {
    window.print();
  });

  renderSummary();
})();
