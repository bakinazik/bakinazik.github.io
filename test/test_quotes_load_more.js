const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const SCRIPT_PATH = path.join(__dirname, "../site/_includes/script.js");
const src = fs.readFileSync(SCRIPT_PATH, "utf8");

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("PASS:", msg);
  }
}

function quoteItems(n) {
  var html = "";
  for (var i = 0; i < n; i++) {
    html += `<p id="quote-${i}" class="quote-item"><span class="text">Söz ${i}</span><span class="date">2024</span></p>`;
  }
  return html;
}

function makeDom(quoteCount, batchSize) {
  const dom = new JSDOM(
    `
    <div class="quote-featured" id="quote-featured"></div>
    <div class="quotes" id="quotes-list" tabindex="0">${quoteItems(quoteCount)}</div>
    <div class="panel-toolbar">
      <button type="button" class="load-more" id="quotes-load-more" data-batch-size="${batchSize}">Daha Fazla Yükle</button>
    </div>
    `,
    { runScripts: "dangerously", url: "https://example.com/?tab=quotes" }
  );
  dom.window.eval(src.replace(/^\(function \(\) \{/, "").replace(/\}\)\(\);\s*$/, ""));
  return dom;
}

(function scenario1_batchDrivenBySiteConfig() {
  const dom = makeDom(11, 5); // 11 söz, site.paginate=5 (_config.yml'deki değer)
  const { window } = dom;
  window.setupQuotesLoadMore();

  const button = window.document.getElementById("quotes-load-more");
  const container = window.document.getElementById("quotes-list");
  const visibleCount = () => container.querySelectorAll(".quote-item:not(.quote-hidden)").length;

  assert(visibleCount() === 5, "başlangıçta site.paginate (5) kadar söz görünür: " + visibleCount());
  assert(button.style.display === "flex", "11 söz > 5 batch olduğundan buton görünür");

  button.dispatchEvent(new window.Event("click"));
  assert(visibleCount() === 10, "1. tıklamada 5 daha açılır, toplam 10: " + visibleCount());
  assert(button.style.display === "flex", "hâlâ 1 söz kaldığından buton görünür kalır");

  button.dispatchEvent(new window.Event("click"));
  assert(visibleCount() === 11, "2. tıklamada kalan son söz de açılır (11 kayıp değil): " + visibleCount());
  assert(button.style.display === "none", "tüm sözler açıldığında buton gizlenir");
})();

(function scenario2_fewerQuotesThanBatchNoButtonNeeded() {
  const dom = makeDom(3, 5); // Liquid tarafında zaten buton render edilmezdi (3 <= 5), ama JS de güvenli davranmalı
  const { window } = dom;
  window.setupQuotesLoadMore();
  const container = window.document.getElementById("quotes-list");
  const visibleCount = () => container.querySelectorAll(".quote-item:not(.quote-hidden)").length;
  assert(visibleCount() === 3, "söz sayısı batch'ten azsa tümü görünür: " + visibleCount());
})();

(function scenario3_deepLinkedHiddenQuoteStillShowsFeatured() {
  const dom = makeDom(11, 5);
  const { window } = dom;
  window.setupQuotesLoadMore(); // ilk 5 görünür, quote-8 (index 8) gizli kalır

  const hiddenTarget = window.document.getElementById("quote-8");
  assert(hiddenTarget.classList.contains("quote-hidden"), "quote-8 başlangıçta batch tarafından gizlenmiş olmalı");

  window.focusQuoteTarget("quote-8");
  const featured = window.document.getElementById("quote-featured");

  assert(featured.contains(hiddenTarget), "gizli söz deep-link ile featured kutusuna taşınır");
  assert(!hiddenTarget.classList.contains("quote-hidden"), "featured'a taşınan söz quote-hidden sınıfından temizlenir (görünür olur)");
  assert(featured.style.display === "block", "featured kutusu görünür olur");

  window.clearQuoteTarget();
  const listAgain = window.document.getElementById("quotes-list");
  assert(listAgain.contains(hiddenTarget), "featured kapatılınca söz asıl listeye geri döner");
  assert(hiddenTarget.classList.contains("quote-hidden"), "listeye dönen söz, batch'te gizliyse yeniden quote-hidden olur (kalıcı olarak açığa çıkmaz)");
})();

(function scenario4_deepLinkedVisibleQuoteStaysVisibleAfterClear() {
  const dom = makeDom(11, 5);
  const { window } = dom;
  window.setupQuotesLoadMore(); // quote-2 zaten ilk 5 içinde, gizli değil

  const visibleTarget = window.document.getElementById("quote-2");
  assert(!visibleTarget.classList.contains("quote-hidden"), "quote-2 başlangıçta zaten görünür olmalı");

  window.focusQuoteTarget("quote-2");
  window.clearQuoteTarget();

  assert(!visibleTarget.classList.contains("quote-hidden"), "başlangıçta görünür olan söz, featured kapatılınca yine görünür kalır (yanlışlıkla gizlenmez)");
})();

if (failures > 0) {
  console.error("\n" + failures + " test başarısız oldu.");
  process.exit(1);
} else {
  console.log("\nTüm sözler testleri geçti.");
}
