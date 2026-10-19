import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const receiptSource = fs.readFileSync("assets/js/langblue-receipt.js", "utf8");

function loadReceipt({ selected = ["grammar"], planId = "monthly", buildOrder } = {}) {
  const inputs = selected.map((value) => ({ value }));
  const plan = planId == null ? null : { value: planId };
  const document = {
    readyState: "complete",
    getElementById(id) {
      if (id === "receiptPlan") return plan;
      return null;
    },
    querySelectorAll(selector) {
      return selector === '#receiptProducts input[type="checkbox"]:checked' ? inputs : [];
    }
  };
  const window = {
    LangBlueCommerce: {
      buildOrder: buildOrder || ((ids, selectedPlan, date) => ({
        products: ids.map((id) => ({ id, label: id })),
        plan: { id: selectedPlan, label: selectedPlan, finalPrice: 100 },
        subtotal: 100,
        total: 100,
        createdAt: date.toISOString()
      }))
    }
  };
  vm.runInNewContext(receiptSource, { window, document, console });
  return window.LangBlueReceipt;
}

test("receipt getOrder calls the commerce builder and returns its order", () => {
  let calls = 0;
  const receipt = loadReceipt({
    selected: ["grammar", "vocabulary"],
    planId: "annual",
    buildOrder(ids, planId, date) {
      calls += 1;
      assert.deepEqual(Array.from(ids), ["grammar", "vocabulary"]);
      assert.equal(planId, "annual");
      assert.equal(typeof date.toISOString, "function");
      return { id: "order-1", total: 200 };
    }
  });

  assert.deepEqual(receipt.getOrder(), { id: "order-1", total: 200 });
  assert.equal(calls, 1);
});

test("receipt getOrder returns null when no products or plan are selected", () => {
  assert.equal(loadReceipt({ selected: [] }).getOrder(), null);
  assert.equal(loadReceipt({ planId: null }).getOrder(), null);
});
