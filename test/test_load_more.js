const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const SCRIPT_PATH = path.join(__dirname, "../site/_includes/script.js");
const src = fs.readFileSync(SCRIPT_PATH, "utf8");

function extractFunction(src, name) {
  const startMarker = "function " + name + "(";
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error(name + " bulunamadı");
  let i = src.indexOf("{", start);
  let depth = 0;
  let end = -1;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) throw new Error(name + " kapanışı bulunamadı");
  return src.slice(start, end);
}

const fnSrc = extractFunction(src, "setupPostsLoadMore");

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("PASS:", msg);
  }
}

function makeDom(nextPath) {
  const dom = new JSDOM(`
    <div class="post-list-wrapper" id="posts-list">
      <div class="post-list-item"><a class="post-list-link" href="/1.html"><div class="post-list-title">P1</div></a></div>
      <div class="post-list-item"><a class="post-list-link" href="/2.html"><div class="post-list-title">P2</div></a></div>
    </div>
    <div class="panel-toolbar">
      <button type="button" class="load-more" id="posts-load-more" data-i18n="load_more" ${nextPath ? `data-next="${nextPath}"` : ""}>Daha Fazla Yükle</button>
    </div>
  `, { runScripts: "dangerously" });
  return dom;
}

function loadSetup(dom) {
  dom.window.eval(fnSrc);
  return dom.window.setupPostsLoadMore;
}

(async function scenario1_appendsNextPageAndKeepsNextButton() {
  const dom = makeDom("/page2/");
  const { window } = dom;
  const nextPageHtml = `
    <div id="posts-list">
      <div class="post-list-item"><a class="post-list-link" href="/3.html"><div class="post-list-title">P3</div></a></div>
      <div class="post-list-item"><a class="post-list-link" href="/4.html"><div class="post-list-title">P4</div></a></div>
    </div>
    <button id="posts-load-more" data-next="/page3/"></button>
  `;

  let fetchedUrl = null;
  window.fetch = function (url) {
    fetchedUrl = url;
    return Promise.resolve({ ok: true, text: () => Promise.resolve(nextPageHtml) });
  };

  const setup = loadSetup(dom);
  setup();

  const button = window.document.getElementById("posts-load-more");
  const container = window.document.getElementById("posts-list");

  assert(button.style.display === "flex", "next_page_path varken buton başlangıçta görünür (flex)");

  button.dispatchEvent(new window.Event("click"));
  assert(button.disabled === true, "tıklama anında buton disabled olur (çift tıklama engeli)");
  assert(button.textContent === "Yükleniyor...", "tıklama anında buton metni 'Yükleniyor...' olur");

  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  assert(fetchedUrl === "/page2/", "fetch, data-next (paginator.next_page_path) değerine yapılır: " + fetchedUrl);
  assert(container.querySelectorAll(".post-list-item").length === 4, "mevcut listeye yeni post-list-item'lar eklenir (2 + 2 = 4)");
  assert(container.querySelector('a[href="/3.html"]') !== null, "yeni sayfadan gelen post linki listeye eklendi");
  assert(button.disabled === false, "işlem bitince buton tekrar aktif olur");
  assert(button.textContent !== "Yükleniyor...", "işlem bitince buton metni eski haline döner");
  assert(button.style.display === "flex", "bir sonraki sayfa daha varsa (page3) buton görünür kalır");
})();

(async function scenario2_lastPageHidesButton() {
  const dom = makeDom("/page2/");
  const { window } = dom;
  const lastPageHtml = `
    <div id="posts-list">
      <div class="post-list-item"><a class="post-list-link" href="/5.html"><div class="post-list-title">P5</div></a></div>
    </div>
  `; // Son sayfa: buton yok / data-next yok

  window.fetch = function () {
    return Promise.resolve({ ok: true, text: () => Promise.resolve(lastPageHtml) });
  };

  const setup = loadSetup(dom);
  setup();
  const button = window.document.getElementById("posts-load-more");

  button.dispatchEvent(new window.Event("click"));
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  assert(button.style.display === "none", "son sayfaya gelindiğinde buton tamamen gizlenir");

  const clicksBefore = 1;
  button.dispatchEvent(new window.Event("click"));
  await new Promise((r) => setTimeout(r, 0));
  assert(button.style.display === "none", "gizlenen buton tekrar tıklanınca hiçbir şey yapmaz (nextPath null guard)");
})();

(async function scenario3_noInitialButtonWhenNoNextPage() {
  const dom = makeDom(null); // paginator.next_page_path yok -> Liquid'de buton hiç render edilmez
  const { window } = dom;
  window.document.getElementById("posts-load-more").removeAttribute("data-next");

  const setup = loadSetup(dom);
  setup();
  const button = window.document.getElementById("posts-load-more");
  assert(button.style.display === "none", "next_page_path olmadan buton görünmez");
})();

(async function scenario4_fetchFailureKeepsContentAndReenablesButton() {
  const dom = makeDom("/page2/");
  const { window } = dom;

  window.fetch = function () {
    return Promise.reject(new Error("network down"));
  };

  const setup = loadSetup(dom);
  setup();
  const button = window.document.getElementById("posts-load-more");
  const container = window.document.getElementById("posts-list");
  const originalCount = container.querySelectorAll(".post-list-item").length;

  button.dispatchEvent(new window.Event("click"));
  assert(button.disabled === true, "hata senaryosunda da tıklama anında buton disabled olur");

  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  assert(container.querySelectorAll(".post-list-item").length === originalCount, "fetch başarısız olunca mevcut içerik bozulmaz");
  assert(button.disabled === false, "fetch başarısız olunca buton tekrar kullanılabilir olur");
  assert(button.textContent === "Daha Fazla Yükle", "fetch başarısız olunca buton metni eski haline döner");

  setTimeout(() => {
    if (failures > 0) {
      console.error("\n" + failures + " test başarısız oldu.");
      process.exit(1);
    } else {
      console.log("\nTüm testler geçti.");
    }
  }, 20);
})();
